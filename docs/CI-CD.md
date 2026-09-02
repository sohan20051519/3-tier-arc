# Production CI/CD Pipeline Documentation

This document describes the automated, zero-trust CI/CD pipeline and multi-tier deployment architecture for the Task Manager application on AWS.

---

## 1. System Architecture Diagram

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                 GITHUB REPOSITORY                                │
│                                                                                  │
│   git push origin main / workflow_dispatch                                       │
│         │                                                                        │
│         ▼                                                                        │
│   ┌──────────────────────────────────────────────────────────────────────────┐   │
│   │ GitHub Actions Workflow: .github/workflows/ci-cd.yml                     │   │
│   │                                                                          │   │
│   │  [Stage 1] test: npm ci ──► backend vitest ──► backend tsc ──► vite build│   │
│   │                      │ (fail-fast)                                       │   │
│   │                      ▼                                                   │   │
│   │  [Stage 2] sonarqube: Scanner ──► SonarQube Quality Gate Check           │   │
│   │                      │ (block on gate failure)                           │   │
│   │                      ▼                                                   │   │
│   │  [Stage 3] build-and-scan:                                               │   │
│   │             ├── Docker Buildx: taskmanager-frontend:${GITHUB_SHA}        │   │
│   │             ├── Docker Buildx: taskmanager-backend:${GITHUB_SHA}         │   │
│   │             ├── Trivy Image Scan (Frontend & Backend - HIGH,CRITICAL)    │   │
│   │             └── GHCR Push (ghcr.io verified images)                      │   │
│   │                      │ (block if vulnerabilities detected)               │   │
│   │                      ▼                                                   │   │
│   │  [Stage 4] deploy: AWS OIDC Authenticate (No Long-Lived Keys)            │   │
│   │             ├── AWS SSM SendCommand ──► Backend EC2 (Pull & Health Check)│   │
│   │             ├── AWS SSM SendCommand ──► Frontend EC2 (Pull & Health Check)│  │
│   │             └── Public Ingress Health Check (Optional via curl)          │   │
│   └───────────────────────────────────┬──────────────────────────────────────┘   │
└───────────────────────────────────────┼──────────────────────────────────────────┘
                                        │ AWS SSM (Zero SSH Keys)
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                               AWS INFRASTRUCTURE                                 │
│                                                                                  │
│  [Public Internet]                                                               │
│         │                                                                        │
│         ▼ (Port 80 / 443)                                                        │
│  ┌─────────────────────────────────┐                                             │
│  │   Public Nginx Reverse Proxy    │ (10.0.1.148)                                │
│  └──────┬───────────────────┬──────┘                                             │
│         │                   │                                                    │
│         │ Path: /           │ Path: /api/*                                       │
│         ▼ (Port 80)         ▼ (Port 5000)                                        │
│  ┌─────────────────┐   ┌──────────────────────────────┐                          │
│  │  Frontend EC2   │   │         Backend EC2          │ (10.0.10.164)            │
│  │   (10.0.10.39)  │   │  ┌────────────────────────┐  │                          │
│  │ ┌─────────────┐ │   │  │   taskmanager-backend  │  │                          │
│  │ │ Nginx (SPA) │ │   │  │ (Node.js/Express:5000) │  │                          │
│  │ └─────────────┘ │   │  └───────────┬────────────┘  │                          │
│  └─────────────────┘   └──────────────┼───────────────┘                          │
│                                       │ (TCP 5432 - Private Subnet)              │
│                                       ▼                                          │
│                        ┌──────────────────────────────┐                          │
│                        │    PostgreSQL Database       │                          │
│                        │   (Isolated Database Tier)   │                          │
│                        └──────────────────────────────┘                          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Pipeline Stages

The GitHub Actions workflow (`.github/workflows/ci-cd.yml`) executes in 4 sequential, fail-fast stages:

1. **Stage 1: `test` (Test & Build Validation)**
   - Checks out the repository code.
   - Sets up Node.js 20 with npm caching for both `backend` and `frontend`.
   - Executes deterministic dependency installation (`npm --prefix backend ci` and `npm --prefix frontend ci`).
   - Runs backend integration tests via Vitest (`npm --prefix backend test`).
   - Verifies TypeScript compilation for backend (`npm --prefix backend run build`) and React production bundling for frontend (`npm --prefix frontend run build`).
   - If any step fails, the pipeline halts immediately.

2. **Stage 2: `sonarqube` (Static Code Analysis & Quality Gate)**
   - Depends on the `test` stage.
   - Fetches complete Git history (`fetch-depth: 0`).
   - Runs SonarScanner using `sonar-project.properties`.
   - Evaluates the SonarQube Quality Gate using `sonarsource/sonarqube-quality-gate-action`.
   - **Hard gate**: If the Quality Gate fails (e.g. coverage dropped, bugs or security hotspots found), the pipeline terminates. No Docker images are built or pushed.

3. **Stage 3: `build-and-scan` (Docker Build, Trivy Security Scan & Registry Push)**
   - Depends on `sonarqube`.
   - Sets up Docker Buildx and authenticates to GitHub Container Registry (`ghcr.io`) using the dynamic `GITHUB_TOKEN` and `github.actor`.
   - Builds two production Docker images:
     - Frontend: `ghcr.io/<owner>/<repo>/taskmanager-frontend:<GITHUB_SHA>` and `latest`
     - Backend: `ghcr.io/<owner>/<repo>/taskmanager-backend:<GITHUB_SHA>` and `latest`
   - Scans the exact immutable SHA tags of both images with **Trivy** for `CRITICAL` and `HIGH` OS/library vulnerabilities (`exit-code: 1`).
   - If Trivy detects unmitigated high/critical vulnerabilities, the pipeline stops immediately.
   - Upon successful scan verification, pushes both images to GHCR.
   - Emits outputs: `frontend_image`, `backend_image`, and `image_tag`.

4. **Stage 4: `deploy` (Production Deployment via AWS SSM with Rollback)**
   - Depends on `build-and-scan`.
   - Uses AWS OIDC (`aws-actions/configure-aws-credentials`) to assume an IAM role securely without stored AWS access keys.
   - Deploys the Backend container to the Backend EC2 via AWS Systems Manager `AWS-RunShellScript`.
   - Deploys the Frontend container to the Frontend EC2 via AWS Systems Manager `AWS-RunShellScript`.
   - Runs polling health verification on both tiers with automated rollback if the new container fails.
   - Optionally tests end-to-end routing through the public Nginx ingress proxy (`PUBLIC_NGINX_HOST`).

---

## 3. Required GitHub Secrets

Configure these in **GitHub Repository &rarr; Settings &rarr; Secrets and variables &rarr; Actions &rarr; Secrets**:

| Secret Name | Description | Example / Format |
| :--- | :--- | :--- |
| `SONAR_TOKEN` | Authentication token for SonarQube analysis | `sqp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `SONAR_HOST_URL` | Base URL of your self-hosted SonarQube instance | `http://3.110.114.245:9000` |
| `AWS_DEPLOY_ROLE_ARN` | ARN of the IAM role assumed by GitHub Actions via OIDC | `arn:aws:iam::<ACCOUNT_ID>:role/github-actions-taskmanager-deploy-role` |

> **Note**: `GITHUB_TOKEN` is automatically provided by GitHub Actions runtime with permissions `packages: write` and `contents: read`.

---

## 4. Required GitHub Variables

Configure these in **GitHub Repository &rarr; Settings &rarr; Secrets and variables &rarr; Actions &rarr; Variables**:

| Variable Name | Required / Optional | Description | Default / Example |
| :--- | :--- | :--- | :--- |
| `AWS_REGION` | Optional | AWS Region for EC2 and SSM operations | `ap-south-1` |
| `BACKEND_INSTANCE_ID` | Optional | EC2 Instance ID of the backend server (falls back to tag `Role=backend`) | `i-0123456789abcdef0` |
| `FRONTEND_INSTANCE_ID` | Optional | EC2 Instance ID of the frontend server (falls back to tag `Role=frontend`) | `i-0abcdef0123456789` |
| `DB_SECRET_ARN` | Optional | AWS Secrets Manager ARN storing PostgreSQL credentials JSON | `arn:aws:secretsmanager:ap-south-1:<ID>:secret:taskmanager/db` |
| `PUBLIC_NGINX_HOST` | Optional | Public DNS / IP of the Nginx reverse proxy for health check | `3.110.114.245` |

---

## 5. SonarQube Setup

The repository root includes `sonar-project.properties`:
```properties
sonar.projectKey=Task-Manager
sonar.projectName=Task Manager

sonar.sources=frontend/src,backend/src
sonar.tests=backend/tests
sonar.test.inclusions=backend/tests/**/*.ts,backend/tests/**/*.test.ts

sonar.exclusions=**/node_modules/**,**/dist/**,**/build/**,**/coverage/**,**/*.config.ts,**/*.config.js,**/database/**
sonar.sourceEncoding=UTF-8
```

### Steps on SonarQube Server:
1. Log in to your SonarQube web UI (`http://<SONAR_HOST>:9000`).
2. Create a project with Project Key: `Task-Manager`.
3. Generate a project analysis token under **My Account &rarr; Security &rarr; Generate Token** or **Project Settings &rarr; Analysis Method**.
4. Set the token as `SONAR_TOKEN` in GitHub Secrets.
5. Set `SONAR_HOST_URL` as `http://<SONARQUBE_IP>:9000`.
6. Ensure the SonarQube EC2 instance security group permits inbound TCP traffic on port `9000` from the GitHub Actions IP ranges or NAT gateway.

---

## 6. GitHub Container Registry (GHCR) Setup

Images are automatically pushed to GHCR using normalized repository names:
- Frontend: `ghcr.io/<owner>/<repo>/taskmanager-frontend:<git-sha>`
- Backend: `ghcr.io/<owner>/<repo>/taskmanager-backend:<git-sha>`

The GitHub Actions job uses:
```yaml
permissions:
  contents: read
  packages: write
```
For EC2 instances to pull from private GHCR repositories, the deployment step logs in dynamically using the GitHub Actions token or a machine token.

---

## 7. AWS OIDC Configuration (Least Privilege)

No long-lived access keys (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`) are stored in GitHub.

### 1. Create Identity Provider in IAM:
- **Provider Type**: `OpenID Connect`
- **Provider URL**: `https://token.actions.githubusercontent.com`
- **Audience**: `sts.amazonaws.com`

### 2. IAM Role Trust Policy (`github-actions-taskmanager-deploy-role`):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<YOUR_AWS_ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:<YOUR_GITHUB_ORG_OR_USER>/<YOUR_REPO>:*"
        }
      }
    }
  ]
}
```

### 3. IAM Role Permissions Policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SSMSendCommandPermissions",
      "Effect": "Allow",
      "Action": [
        "ssm:SendCommand",
        "ssm:ListCommands",
        "ssm:ListCommandInvocations",
        "ssm:GetCommandInvocation",
        "ssm:DescribeInstanceInformation"
      ],
      "Resource": "*"
    },
    {
      "Sid": "EC2TargetDiscovery",
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "ec2:DescribeTags"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## 8. AWS Systems Manager (SSM) Requirements

1. **SSM Agent**: Must be installed and running on both target EC2 instances.
2. **EC2 Instance Profile**: Both EC2 instances must have an IAM role attached containing the AWS-managed policy:
   - `AmazonSSMManagedInstanceCore`
3. **Outbound Connectivity**: The private EC2 instances must have outbound internet access via an AWS NAT Gateway or VPC Endpoints for Systems Manager (`ssm`, `ssmmessages`, `ec2messages`) and container image downloads (`ghcr.io`).

---

## 9. Backend Deployment Architecture

- **Private Network Isolation**: The Backend EC2 instance resides in a private subnet. Port `5000` is **NOT** exposed to `0.0.0.0/0`.
- **Targeting**: Dispatches SSM command to `${{ vars.BACKEND_INSTANCE_ID }}` or instances tagged `Role=backend` and `Name=taskmanager-backend`.
- **Container Execution**: Deploys via `BACKEND_IMAGE="$BACKEND_IMAGE" docker compose -f docker-compose.backend.yml up -d --no-build --no-deps backend`, preserving the PostgreSQL container, internal bridge network (`backend-db-network`), `.env` configuration, and data volumes.
- **Health Verification**: Retries up to 12 times (60 seconds total) querying `http://localhost:5000/api/health`.
- Validates that the response includes:
  - `"status": "ok"`
  - `"dbConnected": true`

---

## 10. Frontend Deployment Architecture

- **Web Server**: React SPA bundled in a multi-stage Dockerfile served by Nginx on port `80`.
- **Targeting**: Dispatches SSM command to `${{ vars.FRONTEND_INSTANCE_ID }}` or instances tagged `Role=frontend` and `Name=taskmanager-frontend`.
- **Container Execution**: Runs with `--restart unless-stopped -p 80:80`.
- **Health Verification**: Retries querying `http://localhost:80/` to ensure Nginx returns HTTP success (200/304).

---

## 11. Database Connectivity & Credentials Management

The backend container connects to PostgreSQL over TCP port 5432.

### Credentials Resolution Hierarchy:
1. **AWS Secrets Manager (Recommended)**:
   If `DB_SECRET_ARN` is set, the EC2 instance fetches the secret JSON via AWS CLI:
   ```json
   {
     "host": "database-private-ip-or-dns",
     "port": "5432",
     "dbname": "taskmanager_db",
     "username": "postgres",
     "password": "your_secure_password"
   }
   ```
2. **Local Environment File**:
   If `DB_SECRET_ARN` is not configured, the deployment looks for `/etc/taskmanager/backend.env` or `/opt/taskmanager/.env` on the host.
3. **Instance Environment Variables**:
   Falls back to standard system environment variables (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`).

> **Zero Hardcoded Secrets**: No database passwords exist in the workflow YAML, Dockerfiles, or git repository.

---

## 12. Trivy Security Scanning Behavior

- Runs before image pushing.
- Scans both `taskmanager-frontend:<GITHUB_SHA>` and `taskmanager-backend:<GITHUB_SHA>`.
- Filter settings:
  - Vulnerability types: `os,library`
  - Severity: `CRITICAL,HIGH`
  - Option: `ignore-unfixed: true`
- If unmitigated critical or high vulnerabilities exist in the container base image or packages, Trivy exits with code `1`, immediately aborting the pipeline before pushing to GHCR or triggering SSM.

---

## 13. SonarQube Quality Gate Behavior

- The `sonarsource/sonarqube-quality-gate-action` monitors project status on the SonarQube server.
- If code coverage is insufficient, new security hotspots exist, or blocker/critical bugs are detected, the Quality Gate fails.
- The pipeline aborts immediately, blocking the Docker build and deployment stages.

---

## 14. Safe Rollback Behavior

Before stopping the active container during SSM deployment:
1. The script inspects the running container and saves the previous image tag (`PREV_IMAGE=$(docker inspect -f '{{.Config.Image}}' ...)`).
2. The new immutable SHA container is started via `docker compose -f docker-compose.backend.yml up -d --no-build --no-deps backend`.
3. Health verification runs against `http://localhost:5000/api/health` checking for `"status":"ok"` and `"dbConnected":true`.
4. If health checks fail or time out:
   - Safe rollback is automatically triggered: `BACKEND_IMAGE="$PREV_IMAGE" docker compose -f docker-compose.backend.yml up -d --no-build --no-deps backend`.
   - The deployment script exits with code `1` so GitHub Actions marks the build as failed and alerts the team.

---

## 15. How to Manually Trigger the Workflow

1. Navigate to your repository on GitHub.
2. Click the **Actions** tab.
3. Select **CI/CD Pipeline** from the left sidebar.
4. Click the **Run workflow** dropdown on the right.
5. Select the `main` branch and click **Run workflow**.

---

## 16. Troubleshooting Failed Deployments

### 1. Test / Build Step Fails:
- Run integration tests locally: `npm --prefix backend test`
- Run TypeScript build locally: `npm --prefix backend run build` and `npm --prefix frontend run build`

### 2. SonarQube Step Fails:
- Verify `SONAR_TOKEN` and `SONAR_HOST_URL` secrets in GitHub.
- Check that port 9000 on the SonarQube EC2 instance is reachable.
- Review Quality Gate rules on the SonarQube dashboard (`http://<SONAR_HOST>:9000/dashboard?id=Task-Manager`).

### 3. Trivy Scan Fails:
- Check GitHub Actions log output under the **Trivy Vulnerability Scan** step.
- Update outdated npm packages (`npm audit fix`) or update the Alpine base image in `backend/Dockerfile` / `frontend/Dockerfile`.

### 4. AWS SSM Deployment Fails:
- Verify the IAM role ARN (`AWS_DEPLOY_ROLE_ARN`) and trust policy.
- Confirm the target EC2 instance IDs or tags match (`BACKEND_INSTANCE_ID`, `FRONTEND_INSTANCE_ID`).
- Verify the SSM Agent is running on target instances:
  ```bash
  sudo systemctl status amazon-ssm-agent || sudo systemctl status snap.amazon-ssm-agent.amazon-ssm-agent
  ```
- Check that target EC2 instances have the `AmazonSSMManagedInstanceCore` IAM policy attached.
- Review detailed SSM invocation logs printed in the GitHub Actions step or AWS Systems Manager Console &rarr; Run Command &rarr; Command history.

### 5. Backend Health Check Fails (`dbConnected: false`):
- Verify PostgreSQL is running on the database tier.
- Confirm security groups allow inbound TCP port 5432 from Backend EC2 (`10.0.10.164/32`).
- Check backend environment variables in `/etc/taskmanager/backend.env` or AWS Secrets Manager.

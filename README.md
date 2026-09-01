# Task Manager (3-Tier Web Application)

A clean, production-ready 3-tier **Task Manager** application designed for containerization and multi-tier AWS cloud deployment.

---

## 1. Architecture Overview

### Target AWS Deployment Architecture

In the target AWS deployment, the tiers are separated across distinct EC2 instances across Public and Private subnets:

```text
Internet
   │
   ▼
Public Subnet
   │
   └── Nginx EC2 (Reverse Proxy / Ingress)
       │
       ├── HTTP / HTTPS (:80 / :443)
       │
       ▼
Private Subnet
   │
   ├── Frontend EC2 (:80)
   │     │
   │     └── Frontend Docker Container (`taskmanager-frontend`)
   │
   └── Backend + Database EC2
         │
         ├── Backend Docker Container (`taskmanager-backend` :5000)
         │     │
         │     └── Docker Internal Bridge Network (`backend-db-network`)
         │           │
         │           ▼
         └── PostgreSQL Docker Container (`taskmanager-postgres` :5432)
```

### Traffic Flow & Network Routing

```text
Browser Client
   │
   ▼
Nginx EC2 (:80/:443)
   │
   ├── / (SPA Root & Static Assets) ────────► Frontend EC2 (:80)
   │
   └── /api/* (REST API Calls) ─────────────► Backend EC2 (:5000)
                                                    │
                                                    ▼
                                            PostgreSQL (:5432 internal)
```

### Key Network & Security Isolations:
1. **Frontend and Backend on Separate Hosts**: The frontend container runs on a dedicated Frontend EC2 instance, while the backend and database run on a separate Backend+DB EC2 instance.
2. **PostgreSQL Isolation**: PostgreSQL runs in an isolated Docker bridge network on the Backend+DB EC2 instance. Port 5432 is **never** published to the host or internet. Only the backend container can reach PostgreSQL via the Docker service name (`postgres`).
3. **No Private IPs in Browser**: The browser interacts exclusively with the public Nginx reverse proxy. All frontend API requests use relative `/api` paths (`/api/tasks`, `/api/health`).
4. **Independent Frontend Nginx**: The frontend container's internal Nginx configuration only serves static React files and handles SPA client-side routing (`try_files $uri $uri/ /index.html`). It does not assume or require a local backend container on the same host.

---

## 2. Technology Stack

| Tier | Component | Technology | Container Name |
| :--- | :--- | :--- | :--- |
| **Tier 1 (Frontend)** | Web UI / SPA | React 19, Vite, TypeScript, Tailwind CSS, Nginx | `taskmanager-frontend` |
| **Tier 2 (Backend)** | REST API | Node.js 20, Express, TypeScript (Compiled to `dist/`) | `taskmanager-backend` |
| **Tier 3 (Database)** | Persistent Data | PostgreSQL 16 (Alpine), Named Volume | `taskmanager-postgres` |
| **Ingress / Routing** | Reverse Proxy | Nginx (EC2 Ingress) | — |

---

## 3. Project Structure

```text
task-manager/
├── frontend/                       # Tier 1: React Single Page Application
│   ├── src/
│   │   ├── components/             # UI Components (TaskForm, TaskList, TaskItem)
│   │   ├── services/               # HTTP client (api.ts - uses relative /api)
│   │   ├── types.ts                # Shared TypeScript interfaces
│   │   ├── App.tsx                 # Main application view
│   │   ├── main.tsx                # React DOM entrypoint
│   │   └── index.css               # Global stylesheet
│   ├── Dockerfile                  # Multi-stage build (Node builder -> Nginx runner)
│   ├── nginx.conf                  # Nginx static asset & SPA routing config
│   ├── package.json
│   ├── package-lock.json           # Lockfile for deterministic npm ci builds
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── .dockerignore
│   └── .env.example
│
├── backend/                        # Tier 2: Express REST API
│   ├── src/
│   │   ├── controllers/            # Request handlers (taskController.ts)
│   │   ├── routes/                 # API route declarations (tasks.ts)
│   │   ├── services/               # Business logic & database operations (taskService.ts)
│   │   ├── db/                     # PostgreSQL pool & connection manager (database.ts)
│   │   ├── middleware/             # Centralized error handler (errorHandler.ts)
│   │   ├── app.ts                  # Express application setup & CORS
│   │   └── server.ts               # Server entrypoint
│   ├── dist/                       # Compiled JavaScript output (generated on build)
│   ├── tests/                      # Automated API integration tests (Vitest + Supertest)
│   │   └── tasks.test.ts
│   ├── Dockerfile                  # Multi-stage build (Node builder -> Non-root runner)
│   ├── package.json                # Includes `npm run build` (tsc) and `npm start` (node dist/server.js)
│   ├── package-lock.json           # Lockfile for deterministic npm ci builds
│   ├── tsconfig.json               # TypeScript ES2022 / NodeNext compiler options
│   ├── .dockerignore
│   └── .env.example
│
├── database/                       # Tier 3: Database Schemas & Migrations
│   ├── migrations/
│   │   └── 001_create_tasks_table.sql
│   └── init.sql                    # Initial seed & table definition for Docker initialization
│
├── docker-compose.backend.yml      # AWS deployment compose for Backend + PostgreSQL EC2
├── docker-compose.frontend.yml     # AWS deployment compose for Frontend EC2
├── docker-compose.yml              # Local development all-in-one orchestration
├── .env.example
└── README.md
```

---

## 4. Environment Variables Configuration

### Backend & Database (`backend/.env` or deployment environment)
```env
PORT=5000
NODE_ENV=production

# PostgreSQL Connection
DB_HOST=postgres
DB_PORT=5432
DB_NAME=taskmanager_db
DB_USER=postgres
DB_PASSWORD=your_secure_db_password_here
```

### Frontend (`frontend/.env`)
```env
# In production (behind Nginx reverse proxy): leave empty to use relative /api
VITE_API_URL=

# In local standalone development without reverse proxy:
# VITE_API_URL=http://localhost:5000
```

---

## 5. Production AWS Deployment Guide

### A. Deploying the Backend + Database EC2 Instance
On the **Backend + Database EC2 instance**:
1. Copy the codebase or Docker Compose configuration.
2. Provide database credentials via environment variables or a `.env` file.
3. Start the Backend and PostgreSQL containers:
   ```bash
   docker compose -f docker-compose.backend.yml up --build -d
   ```
4. Verify container health:
   ```bash
   docker compose -f docker-compose.backend.yml ps
   ```
   - `taskmanager-postgres`: Healthy, database port 5432 accessible **only** within `backend-db-network`.
   - `taskmanager-backend`: Healthy, listening on port 5000 for internal VPC traffic from Nginx.

### B. Deploying the Frontend EC2 Instance
On the **Frontend EC2 instance**:
1. Build and run the frontend container:
   ```bash
   docker compose -f docker-compose.frontend.yml up --build -d
   ```
2. Verify frontend container is healthy:
   ```bash
   docker compose -f docker-compose.frontend.yml ps
   ```
   - `taskmanager-frontend`: Serving static React build on port 80.

### C. Nginx Reverse Proxy Configuration (Public Ingress EC2)
On the **Public Nginx EC2**:
```nginx
server {
    listen 80;
    server_name your-domain.com; # or public IP

    # Route frontend static requests to Frontend EC2 private IP
    location / {
        proxy_pass http://<FRONTEND_EC2_PRIVATE_IP>:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Route API requests to Backend EC2 private IP
    location /api/ {
        proxy_pass http://<BACKEND_EC2_PRIVATE_IP>:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 6. Local Development

### Option 1: All-in-One Docker Compose
To run all tiers locally on a single machine:
```bash
docker compose up --build -d
```
- Frontend UI: `http://localhost:80`
- Backend API: `http://localhost:5000`
- Health Probe: `http://localhost:5000/api/health`

### Option 2: Running Without Docker (Native Node.js)
1. **Database**: Start local PostgreSQL on port 5432 and run `database/init.sql`.
2. **Backend**:
   ```bash
   cd backend
   npm install
   npm run build
   npm start # or npm run dev for hot reloading
   ```
3. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

## 7. Automated Testing & Verification

Run the integration test suite:
```bash
cd backend
npm test
```

### Verified Test Suite:
- `GET /api/health` &rarr; 200 OK, returns server uptime and database connectivity probe.
- `GET /api/tasks` &rarr; 200 OK, returns list of tasks.
- `POST /api/tasks` &rarr; 201 Created on valid input; 400 Bad Request on missing title.
- `PUT /api/tasks/:id` &rarr; 200 OK on valid status toggle; 400 on invalid type; 404 on nonexistent task.
- `DELETE /api/tasks/:id` &rarr; 200 OK on deletion; 404 on nonexistent task.

---

## 8. REST API Endpoints

| Method | Endpoint | Description | Request Body | Status Codes |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Health probe & DB connectivity | None | `200` |
| `GET` | `/api/tasks` | Fetch all tasks | None | `200` |
| `POST` | `/api/tasks` | Create a new task | `{"title": "...", "description": "..."}` | `201`, `400` |
| `PUT` | `/api/tasks/:id` | Update completion state | `{"completed": true}` | `200`, `400`, `404` |
| `DELETE` | `/api/tasks/:id` | Delete a task | None | `200`, `400`, `404` |

---

## 9. CI/CD Pipeline (GitHub Actions)

A fully automated, zero-trust production CI/CD pipeline is implemented in `.github/workflows/ci-cd.yml`.

### Pipeline Execution Flow

```text
git push origin main (or workflow_dispatch)
    │
    ▼
1. Test & Build Validation (npm ci, backend vitest, tsc build, frontend build)
    │
    ▼
2. SonarQube Analysis & Quality Gate (sonarsource/sonarqube-scan-action & quality-gate-action)
    │  └─► If Quality Gate fails: STOP
    ▼
3. Docker Build & Security Scan
    ├─► Build taskmanager-frontend:${GITHUB_SHA} & :latest
    ├─► Build taskmanager-backend:${GITHUB_SHA} & :latest
    ├─► Trivy Vulnerability Scan (Frontend Image) ──► Fail on HIGH/CRITICAL
    ├─► Trivy Vulnerability Scan (Backend Image)  ──► Fail on HIGH/CRITICAL
    └─► Push verified images to GitHub Container Registry (ghcr.io)
    │
    ▼
4. Production Deployment via AWS SSM (OIDC Authentication)
    ├─► Authenticate to AWS via OIDC (Role Assumption, No Long-Lived Keys)
    ├─► Deploy Backend to Backend EC2 (10.0.10.164)
    │     ├── Pull exact SHA image from GHCR
    │     ├── Update backend container (Port 5000)
    │     ├── Preserve PostgreSQL volume (`postgres_data`) intact
    │     └── Verify health: http://10.0.10.164:5000/api/health
    ├─► Deploy Frontend to Frontend EC2 (10.0.10.39)
    │     ├── Pull exact SHA image from GHCR
    │     ├── Start frontend container (Port 80)
    │     └── Verify HTTP 200 on port 80
    └─► Verify Public Nginx reverse proxy endpoint
```

### GitHub Secrets & Variables

#### Required GitHub Secrets (`Settings -> Secrets and variables -> Actions -> Secrets`)
| Secret Name | Description | Example / Note |
| :--- | :--- | :--- |
| `SONAR_TOKEN` | Authentication token for SonarQube project analysis | Created in SonarQube User/Project Security |
| `SONAR_HOST_URL` | Endpoint of SonarQube Server | `http://3.110.114.245:9000` |
| `AWS_DEPLOY_ROLE_ARN` | IAM Role ARN assumed by GitHub Actions via OIDC | `arn:aws:iam::<ACCOUNT_ID>:role/github-actions-taskmanager-deploy-role` |

#### Recommended GitHub Variables (`Settings -> Secrets and variables -> Actions -> Variables`)
| Variable Name | Description | Default / Example |
| :--- | :--- | :--- |
| `AWS_REGION` | AWS Region where EC2 instances reside | `ap-south-1` |
| `BACKEND_INSTANCE_ID` | EC2 Instance ID for Backend + Database (Optional if using tags) | `i-0123456789abcdef0` |
| `FRONTEND_INSTANCE_ID` | EC2 Instance ID for Frontend Web App (Optional if using tags) | `i-0abcdef0123456789` |
| `PUBLIC_NGINX_HOST` | Public IP or domain of Public Nginx EC2 (for health check validation) | `3.110.114.245` |

---

### AWS OIDC & IAM Setup (Least-Privilege)

To authenticate GitHub Actions to AWS without storing long-lived access keys:

1. **Create Identity Provider**:
   - Provider Type: `OpenID Connect`
   - Provider URL: `https://token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`

2. **IAM Role Trust Policy (`github-actions-taskmanager-deploy-role`)**:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
         },
         "Action": "sts:AssumeRoleWithWebIdentity",
         "Condition": {
           "StringEquals": {
             "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
           },
           "StringLike": {
             "token.actions.githubusercontent.com:sub": "repo:<GITHUB_OWNER>/<GITHUB_REPO>:*"
           }
         }
       }
     ]
   }
   ```

3. **IAM Role Permission Policy**:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "SSMSendCommand",
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
         "Sid": "EC2DescribeForTargeting",
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

### EC2 Security Groups & Network Rules

| Instance | Role | Inbound Ports Allowed | Source / Notes |
| :--- | :--- | :--- | :--- |
| **Nginx EC2** (`10.0.1.148`) | Public Reverse Proxy | `80/TCP`, `443/TCP` | `0.0.0.0/0` (Public Internet) |
| **Frontend EC2** (`10.0.10.39`) | Private Frontend App | `80/TCP` | `10.0.1.148/32` (Only Nginx EC2 private IP) |
| **Backend EC2** (`10.0.10.164`) | Private REST API & DB | `5000/TCP` | `10.0.1.148/32` (Only Nginx EC2 private IP). **Port 5000 is NEVER exposed to 0.0.0.0/0**. Port 5432 is internal to Docker. |
| **SonarQube Server** | Code Quality Analysis | `9000/TCP` | GitHub Actions Runner IP range or Authorized Admin CIDR |

---

### Rollback Procedure

All production container images are tagged with their immutable commit SHA:
`ghcr.io/<owner>/<repo>/taskmanager-backend:<COMMIT_SHA>`
`ghcr.io/<owner>/<repo>/taskmanager-frontend:<COMMIT_SHA>`

To instantly roll back to a previous verified release:
1. Identify the desired previous commit SHA (e.g., `abc1234`).
2. Run the workflow manually via **Actions &rarr; CI/CD Pipeline &rarr; Run workflow** on the previous commit, or execute SSM commands with the target SHA image tag:
   ```bash
   # On Backend EC2 via SSM:
   docker pull ghcr.io/<owner>/<repo>/taskmanager-backend:abc1234
   docker stop taskmanager-backend && docker rm taskmanager-backend
   docker run -d --name taskmanager-backend --restart unless-stopped --network backend-db-network -p 5000:5000 \
     -e PORT=5000 -e NODE_ENV=production -e DB_HOST=postgres -e DB_PORT=5432 \
     -e DB_NAME=taskmanager_db -e DB_USER=postgres -e DB_PASSWORD=postgres_secure_password \
     ghcr.io/<owner>/<repo>/taskmanager-backend:abc1234

   # On Frontend EC2 via SSM:
   docker pull ghcr.io/<owner>/<repo>/taskmanager-frontend:abc1234
   docker stop taskmanager-frontend && docker rm taskmanager-frontend
   docker run -d --name taskmanager-frontend --restart unless-stopped -p 80:80 \
     ghcr.io/<owner>/<repo>/taskmanager-frontend:abc1234
   ```


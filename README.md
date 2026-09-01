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

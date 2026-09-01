# Task Manager (3-Tier Web Application)

A clean, modular 3-tier **Task Manager** application engineered for containerization and automated cloud deployment (e.g. Docker, Docker Compose, AWS VPC with public/private subnets, Amazon ECR, and CI/CD pipelines).

---

## 1. What the Application Does

The Task Manager allows users to:
- **View all tasks** (retrieved from the PostgreSQL database through the REST API)
- **Create new tasks** with a title and optional description
- **Toggle completion status** between pending and completed
- **Delete tasks**
- **Monitor system health** via the `/api/health` probe endpoint (checking backend uptime and database connectivity)

---

## 2. Architecture

The application follows a standard **3-tier architecture**:

```text
                Browser
                   |
                   v
             React Frontend
                   |
                   | HTTP
                   v
             Express Backend
                   |
                   | SQL
                   v
               PostgreSQL
```

### AWS VPC Deployment Mapping (Target Architecture)
- **Public Subnet**: React Frontend (served via Nginx reverse proxy or S3/CloudFront) with Internet Gateway access.
- **Private App Subnet**: Node.js / Express REST API backend running on private EC2 or ECS tasks.
- **Private Data Subnet**: PostgreSQL database (or Amazon RDS PostgreSQL) isolated with security groups accepting traffic only from the backend tier.

---

## 3. Technology Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Frontend (Tier 1)** | React 19, Vite, TypeScript, Tailwind CSS | Responsive SPA with optimistic UI and live status indicators |
| **Backend (Tier 2)** | Node.js, Express, TypeScript | Layered REST API (Routes &rarr; Controllers &rarr; Services &rarr; DB pool) |
| **Database (Tier 3)** | PostgreSQL 16 | Relational store with migration scripts and indexing |
| **Orchestration** | Docker, Docker Compose | Multi-stage Dockerfiles and custom bridge networking |
| **Testing** | Vitest, Supertest | Automated integration tests for all REST endpoints |

---

## 4. Project Structure

```text
task-manager/
│
├── frontend/                       # Tier 1: React Single Page Application
│   ├── src/
│   │   ├── components/             # UI Components (TaskForm, TaskList, TaskItem)
│   │   ├── services/               # HTTP client (api.ts)
│   │   ├── types.ts                # TypeScript interface definitions
│   │   ├── App.tsx                 # Main application view
│   │   ├── main.tsx                # React DOM entrypoint
│   │   └── index.css               # Global stylesheet
│   ├── public/                     # Static assets
│   ├── Dockerfile                  # Multi-stage Nginx build
│   ├── nginx.conf                  # Nginx proxy configuration
│   ├── package.json
│   ├── .env.example
│   └── README.md
│
├── backend/                        # Tier 2: Express REST API
│   ├── src/
│   │   ├── controllers/            # Request handlers (taskController.ts)
│   │   ├── routes/                 # API route declarations (tasks.ts)
│   │   ├── services/               # Business logic & SQL queries (taskService.ts)
│   │   ├── db/                     # PostgreSQL pool & connection manager (database.ts)
│   │   ├── middleware/             # Centralized error handler (errorHandler.ts)
│   │   ├── app.ts                  # Express application setup & CORS
│   │   └── server.ts               # Standalone server entrypoint
│   ├── tests/                      # Automated API integration tests
│   │   └── tasks.test.ts
│   ├── Dockerfile                  # Multi-stage Node.js container build
│   ├── package.json
│   ├── .env.example
│   └── README.md
│
├── database/                       # Tier 3: Database Schemas & Migrations
│   ├── migrations/
│   │   └── 001_create_tasks_table.sql
│   └── init.sql                    # Initial seed & table definition for Docker
│
├── docker-compose.yml              # Local multi-container orchestration
├── .gitignore
├── .env.example
└── README.md
```

---

## 5. Environment Variables

### Root / Backend (`backend/.env` or `.env`)
```env
PORT=5000
NODE_ENV=development

# PostgreSQL Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=taskmanager_db
DB_USER=postgres
DB_PASSWORD=postgres
```

### Frontend (`frontend/.env`)
```env
# URL for the Express Backend API
# In development without reverse proxy:
VITE_API_URL=http://localhost:5000

# When using Nginx reverse proxy or Docker Compose, leave empty to use relative /api path:
# VITE_API_URL=
```

---

## 6. Running Without Docker

### Prerequisites
- Node.js (v20+)
- PostgreSQL (v14+) running locally

### 1. Database Setup
```bash
psql -U postgres -c "CREATE DATABASE taskmanager_db;"
psql -U postgres -d taskmanager_db -f database/migrations/001_create_tasks_table.sql
```

### 2. Start Backend API
```bash
cd backend
npm install
npm run dev
# Backend starts on http://localhost:5000
```

### 3. Start Frontend Web App
```bash
cd frontend
npm install
npm run dev
# Frontend starts on http://localhost:5173
```

---

## 7. Running With Docker Compose

Docker Compose orchestrates all 3 tiers (`frontend`, `backend`, `postgres`) connected through an isolated bridge network (`task-network`).

```bash
# Build and start all 3 containers in the background
docker compose up --build -d

# Verify all containers are healthy
docker compose ps

# View real-time logs
docker compose logs -f

# Stop and remove containers and network
docker compose down
```

### Accessing Services
- **Frontend Web UI**: `http://localhost` (Port 80)
- **Backend API**: `http://localhost:5000` (Port 5000)
- **Health Check Endpoint**: `http://localhost:5000/api/health`

---

## 8. Running Automated Tests

Integration tests verify all REST endpoints using Vitest and Supertest:

```bash
# Run tests from the project root
npm run test

# Or run tests directly inside the backend directory
cd backend
npm test
```

### Verified Test Cases:
- `GET /api/health` &rarr; Verifies 200 OK and database connectivity probe
- `GET /api/tasks` &rarr; Verifies 200 OK and JSON task collection
- `POST /api/tasks` &rarr; Validates task creation (201 Created) and title requirement rejection (400)
- `PUT /api/tasks/:id` &rarr; Validates completion toggle (200 OK), non-boolean rejection (400), and not-found handling (404)
- `DELETE /api/tasks/:id` &rarr; Validates deletion (200 OK) and 404 for nonexistent tasks

---

## 9. REST API Endpoints

| Method | Endpoint | Description | Request Body | Response Codes |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Health probe & DB status | None | `200` |
| `GET` | `/api/tasks` | Get all tasks | None | `200` |
| `POST` | `/api/tasks` | Create new task | `{"title": "string", "description": "string"}` | `201`, `400` |
| `PUT` | `/api/tasks/:id` | Update completion state | `{"completed": true}` | `200`, `400`, `404` |
| `DELETE` | `/api/tasks/:id` | Delete task | None | `200`, `400`, `404` |

---

## 10. Database Schema

```sql
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tasks_completed ON tasks (completed);
CREATE INDEX idx_tasks_created_at ON tasks (created_at DESC);
```

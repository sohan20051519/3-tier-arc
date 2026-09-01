# Task Manager Backend

Express REST API backend for the 3-tier Task Manager application.

## Endpoints

- `GET /api/health` - Health check & DB connection status
- `GET /api/tasks` - Retrieve all tasks (ordered by created_at DESC)
- `POST /api/tasks` - Create a new task (`{ title, description }`)
- `PUT /api/tasks/:id` - Update completion status (`{ completed }`)
- `DELETE /api/tasks/:id` - Delete a task by ID

## Environment Variables

- `PORT` - Port to listen on (default: `5000`)
- `DB_HOST` - PostgreSQL host (default: `localhost`, or `postgres` in Docker)
- `DB_PORT` - PostgreSQL port (default: `5432`)
- `DB_NAME` - PostgreSQL database name (default: `taskmanager_db`)
- `DB_USER` - PostgreSQL username (default: `postgres`)
- `DB_PASSWORD` - PostgreSQL password (default: `postgres`)

## Running Locally

```bash
npm install
npm run dev
```

## Running Tests

```bash
npm run test
```

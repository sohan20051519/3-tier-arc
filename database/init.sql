-- Docker entrypoint database initialization script
-- Runs automatically when the PostgreSQL container is first initialized

CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial tasks for testing and demonstration
INSERT INTO tasks (title, description, completed) VALUES
    ('Set up AWS VPC', 'Create public and private subnets with internet gateway and NAT gateway', false),
    ('Configure Docker Compose', 'Define multi-container network with frontend, backend, and database', true),
    ('Deploy 3-tier Architecture', 'Run frontend in public subnet, backend and DB in private subnets', false)
ON CONFLICT DO NOTHING;

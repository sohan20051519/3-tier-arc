import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Environment variables with production/Docker defaults
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'taskmanager_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

let pool: pg.Pool | null = null;
let isConnectedToPostgres = false;
let checkedConnection = false;

// In-memory fallback store for standalone sandbox/dev runs without active Postgres container
interface TaskRecord {
  id: number;
  title: string;
  description: string | null;
  completed: boolean;
  created_at: string;
}

let inMemoryTasks: TaskRecord[] = [
  {
    id: 1,
    title: 'Learn AWS VPC',
    description: 'Understand public and private subnets, routing tables, and gateways',
    completed: false,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 2,
    title: 'Configure Docker Containers',
    description: 'Create multi-stage Dockerfiles for React frontend and Node.js Express backend',
    completed: true,
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 3,
    title: 'Deploy 3-Tier Architecture',
    description: 'Deploy frontend in public subnet, backend & PostgreSQL in private subnets with reverse proxy',
    completed: false,
    created_at: new Date(Date.now() - 10800000).toISOString(),
  }
];
let nextId = 4;

function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool(dbConfig);
    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
    });
  }
  return pool;
}

export async function checkDatabaseConnection(): Promise<{ connected: boolean; source: 'postgresql' | 'memory'; message?: string }> {
  try {
    const currentPool = getPool();
    const client = await currentPool.connect();
    try {
      await client.query('SELECT 1');
      // Ensure tasks table exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS tasks (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          completed BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      isConnectedToPostgres = true;
      checkedConnection = true;
      return { connected: true, source: 'postgresql' };
    } finally {
      client.release();
    }
  } catch (err: any) {
    isConnectedToPostgres = false;
    checkedConnection = true;
    return {
      connected: false,
      source: 'memory',
      message: `PostgreSQL connection attempt failed (${err.message}). Using in-memory fallback.`,
    };
  }
}

export const db = {
  async query(text: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    if (!checkedConnection) {
      await checkDatabaseConnection();
    }

    if (isConnectedToPostgres && pool) {
      try {
        const result = await pool.query(text, params);
        return { rows: result.rows, rowCount: result.rowCount ?? result.rows.length };
      } catch (error) {
        console.warn('PostgreSQL query error, falling back to memory store:', error);
        isConnectedToPostgres = false;
      }
    }

    // In-memory fallback query emulation for development & test previews
    const normalized = text.trim().toUpperCase();

    if (normalized.startsWith('SELECT') && normalized.includes('FROM TASKS')) {
      const sorted = [...inMemoryTasks].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return { rows: sorted, rowCount: sorted.length };
    }

    if (normalized.startsWith('INSERT INTO TASKS')) {
      const [title, description] = params;
      const newTask: TaskRecord = {
        id: nextId++,
        title: title || 'Untitled Task',
        description: description || null,
        completed: false,
        created_at: new Date().toISOString(),
      };
      inMemoryTasks.push(newTask);
      return { rows: [newTask], rowCount: 1 };
    }

    if (normalized.startsWith('UPDATE TASKS')) {
      // e.g. UPDATE tasks SET completed = $1 WHERE id = $2 RETURNING *
      const [completed, id] = params;
      const taskIndex = inMemoryTasks.findIndex((t) => t.id === parseInt(id, 10));
      if (taskIndex === -1) {
        return { rows: [], rowCount: 0 };
      }
      inMemoryTasks[taskIndex].completed = Boolean(completed);
      return { rows: [inMemoryTasks[taskIndex]], rowCount: 1 };
    }

    if (normalized.startsWith('DELETE FROM TASKS')) {
      const [id] = params;
      const taskIndex = inMemoryTasks.findIndex((t) => t.id === parseInt(id, 10));
      if (taskIndex === -1) {
        return { rows: [], rowCount: 0 };
      }
      const [deleted] = inMemoryTasks.splice(taskIndex, 1);
      return { rows: [deleted], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  },

  // Reset in-memory state (useful for tests)
  _resetMemoryStore() {
    inMemoryTasks = [
      {
        id: 1,
        title: 'Learn AWS VPC',
        description: 'Understand public and private subnets, routing tables, and gateways',
        completed: false,
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
    ];
    nextId = 2;
    isConnectedToPostgres = false;
    checkedConnection = true;
  },

  async close() {
    if (pool) {
      await pool.end();
      pool = null;
    }
  }
};

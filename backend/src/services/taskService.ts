import { db } from '../db/database.js';

export interface Task {
  id: number;
  title: string;
  description: string | null;
  completed: boolean;
  created_at: string;
}

export class TaskService {
  async getAllTasks(): Promise<Task[]> {
    const query = 'SELECT id, title, description, completed, created_at FROM tasks ORDER BY created_at DESC;';
    const result = await db.query(query);
    return result.rows;
  }

  async getTaskById(id: number): Promise<Task | null> {
    const query = 'SELECT id, title, description, completed, created_at FROM tasks WHERE id = $1;';
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  async createTask(title: string, description?: string): Promise<Task> {
    const cleanTitle = (title || '').trim();
    if (!cleanTitle) {
      throw new Error('Task title is required');
    }

    const cleanDescription = description ? description.trim() : null;
    const query = `
      INSERT INTO tasks (title, description, completed)
      VALUES ($1, $2, false)
      RETURNING id, title, description, completed, created_at;
    `;
    const result = await db.query(query, [cleanTitle, cleanDescription]);
    return result.rows[0];
  }

  async updateTaskCompletion(id: number, completed: boolean): Promise<Task | null> {
    const query = `
      UPDATE tasks
      SET completed = $1
      WHERE id = $2
      RETURNING id, title, description, completed, created_at;
    `;
    const result = await db.query(query, [Boolean(completed), id]);
    return result.rows[0] || null;
  }

  async deleteTask(id: number): Promise<boolean> {
    const query = 'DELETE FROM tasks WHERE id = $1 RETURNING id;';
    const result = await db.query(query, [id]);
    return result.rowCount > 0;
  }
}

export const taskService = new TaskService();

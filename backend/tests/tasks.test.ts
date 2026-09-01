import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/database.js';

const app = createApp();

describe('Task Manager Backend API Tests', () => {
  beforeEach(() => {
    db._resetMemoryStore();
  });

  describe('GET /api/health', () => {
    it('should return 200 OK and health status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('database');
    });
  });

  describe('GET /api/tasks', () => {
    it('should return a list of tasks with 200 OK', async () => {
      const res = await request(app).get('/api/tasks');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('title');
      expect(res.body[0]).toHaveProperty('completed');
    });
  });

  describe('POST /api/tasks', () => {
    it('should create a new task successfully with 201 Created', async () => {
      const payload = {
        title: 'Learn AWS VPC',
        description: 'Understand public and private subnets',
      };

      const res = await request(app)
        .post('/api/tasks')
        .send(payload)
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe('Learn AWS VPC');
      expect(res.body.description).toBe('Understand public and private subnets');
      expect(res.body.completed).toBe(false);
      expect(res.body).toHaveProperty('created_at');
    });

    it('should return 400 Bad Request if title is missing or empty', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({ description: 'No title provided' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Validation Error');
    });
  });

  describe('PUT /api/tasks/:id', () => {
    it('should update task completed status with 200 OK', async () => {
      const res = await request(app)
        .put('/api/tasks/1')
        .send({ completed: true });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(1);
      expect(res.body.completed).toBe(true);
    });

    it('should return 400 for non-boolean completed status', async () => {
      const res = await request(app)
        .put('/api/tasks/1')
        .send({ completed: 'not-a-boolean' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 404 if task is not found', async () => {
      const res = await request(app)
        .put('/api/tasks/999999')
        .send({ completed: true });

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Not Found');
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('should delete an existing task with 200 OK', async () => {
      const res = await request(app).delete('/api/tasks/1');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', 1);

      // Verify it is gone
      const verifyRes = await request(app).get('/api/tasks');
      const found = verifyRes.body.find((t: any) => t.id === 1);
      expect(found).toBeUndefined();
    });

    it('should return 404 for non-existent task deletion', async () => {
      const res = await request(app).delete('/api/tasks/999999');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Not Found');
    });
  });
});

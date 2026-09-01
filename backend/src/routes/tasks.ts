import { Router } from 'express';
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  getHealth
} from '../controllers/taskController.js';

const router = Router();

// Health check endpoint
router.get('/health', getHealth);

// Task CRUD endpoints
router.get('/tasks', getTasks);
router.post('/tasks', createTask);
router.put('/tasks/:id', updateTask);
router.delete('/tasks/:id', deleteTask);

export default router;

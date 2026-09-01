import { Request, Response, NextFunction } from 'express';
import { taskService } from '../services/taskService.js';
import { checkDatabaseConnection } from '../db/database.js';

export async function getHealth(req: Request, res: Response, next: NextFunction) {
  try {
    const dbStatus = await checkDatabaseConnection();
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: dbStatus.source,
      dbConnected: dbStatus.connected
    });
  } catch (error) {
    next(error);
  }
}

export async function getTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const tasks = await taskService.getAllTasks();
    res.status(200).json(tasks);
  } catch (error) {
    next(error);
  }
}

export async function createTask(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, description } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Task title is required and must be a non-empty string.'
      });
    }

    const newTask = await taskService.createTask(title, description);
    res.status(201).json(newTask);
  } catch (error) {
    next(error);
  }
}

export async function updateTask(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Task ID must be a valid integer.'
      });
    }

    const { completed } = req.body;
    if (typeof completed !== 'boolean') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Field "completed" is required and must be a boolean.'
      });
    }

    const updatedTask = await taskService.updateTaskCompletion(id, completed);
    if (!updatedTask) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Task with id ${id} not found.`
      });
    }

    res.status(200).json(updatedTask);
  } catch (error) {
    next(error);
  }
}

export async function deleteTask(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Task ID must be a valid integer.'
      });
    }

    const success = await taskService.deleteTask(id);
    if (!success) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Task with id ${id} not found.`
      });
    }

    res.status(200).json({
      message: `Task ${id} deleted successfully.`,
      id
    });
  } catch (error) {
    next(error);
  }
}

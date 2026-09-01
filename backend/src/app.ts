import express, { Express } from 'express';
import cors from 'cors';
import taskRoutes from './routes/tasks.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp(): Express {
  const app = express();

  // Middleware
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  app.use(express.json());

  // Mount API routes
  app.use('/api', taskRoutes);

  // Error handling
  app.use(errorHandler);

  return app;
}

export default createApp();

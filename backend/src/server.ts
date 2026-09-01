import dotenv from 'dotenv';
import app from './app.js';
import { checkDatabaseConnection } from './db/database.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = '0.0.0.0';

async function start() {
  // Check DB status on startup
  const dbStatus = await checkDatabaseConnection();
  console.log(`[Database] Mode: ${dbStatus.source} (Postgres connected: ${dbStatus.connected})`);

  app.listen(PORT, HOST, () => {
    console.log(`[Task Manager Backend API] listening on http://${HOST}:${PORT}`);
    console.log(`[Health Endpoint] http://${HOST}:${PORT}/api/health`);
    console.log(`[Tasks Endpoint] http://${HOST}:${PORT}/api/tasks`);
  });
}

start();

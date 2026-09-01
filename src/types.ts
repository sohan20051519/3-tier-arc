export interface Task {
  id: number;
  title: string;
  description: string | null;
  completed: boolean;
  created_at: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
}

export interface HealthStatus {
  status: string;
  uptime?: number;
  timestamp?: string;
  database?: string;
  dbConnected?: boolean;
}

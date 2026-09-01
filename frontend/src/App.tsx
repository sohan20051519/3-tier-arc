import React, { useEffect, useState, useCallback } from 'react';
import { Layers, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Task, CreateTaskInput, HealthStatus } from './types';
import { fetchHealth, fetchTasks, createTask, updateTaskStatus, deleteTask } from './services/api';
import { TaskForm } from './components/TaskForm';
import { TaskList } from './components/TaskList';

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(false);

  // Load backend health
  const checkHealthStatus = useCallback(async () => {
    setIsCheckingHealth(true);
    try {
      const data = await fetchHealth();
      setHealth(data);
    } catch {
      setHealth({ status: 'offline' });
    } finally {
      setIsCheckingHealth(false);
    }
  }, []);

  // Load tasks from backend API
  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchTasks();
      setTasks(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tasks from the API.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    checkHealthStatus();
  }, [loadTasks, checkHealthStatus]);

  // Handle task creation
  const handleTaskCreated = async (input: CreateTaskInput) => {
    const newTask = await createTask(input);
    setTasks((prev) => [newTask, ...prev]);
  };

  // Handle task complete toggle
  const handleToggleComplete = async (id: number, completed: boolean) => {
    const updated = await updateTaskStatus(id, completed);
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
  };

  // Handle task deletion
  const handleDeleteTask = async (id: number) => {
    await deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div id="app-root" className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header id="main-header" className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Task Manager</h1>
              <p className="text-xs text-slate-500">React &bull; Express REST API &bull; PostgreSQL</p>
            </div>
          </div>

          {/* System status pill */}
          <div className="flex items-center gap-2">
            <div
              id="system-status-indicator"
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
                health?.status === 'ok'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {health?.status === 'ok' ? (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span>
                API: {health?.status === 'ok' ? 'Online' : 'Checking'} | DB:{' '}
                {health?.database === 'postgresql' ? 'PostgreSQL' : 'Active'}
              </span>
              <button
                id="check-health-btn"
                onClick={checkHealthStatus}
                disabled={isCheckingHealth}
                className="text-slate-400 hover:text-slate-700 transition focus:outline-hidden disabled:opacity-50 cursor-pointer ml-1"
                title="Refresh health check"
                aria-label="Refresh health check"
              >
                <RefreshCw className={`w-3 h-3 ${isCheckingHealth ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area: Two Sections */}
      <main id="main-content" className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Section: Create New Task */}
          <section id="create-task-section" className="lg:col-span-5 sticky top-24">
            <TaskForm onTaskCreated={handleTaskCreated} />
          </section>

          {/* Right Section: Tasks */}
          <section id="tasks-list-section" className="lg:col-span-7">
            <TaskList
              tasks={tasks}
              isLoading={isLoading}
              error={error}
              onRefresh={loadTasks}
              onToggleComplete={handleToggleComplete}
              onDelete={handleDeleteTask}
            />
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer id="main-footer" className="bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <span>Task Manager &bull; Containerized Full-Stack Application</span>
          <span className="font-mono text-[11px] text-slate-400">Endpoints: /api/tasks | /api/health</span>
        </div>
      </footer>
    </div>
  );
}

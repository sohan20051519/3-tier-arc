import React from 'react';
import { CheckCircle2, ListTodo, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { Task } from '../types';
import { TaskItem } from './TaskItem';

interface TaskListProps {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onToggleComplete: (id: number, completed: boolean) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  isLoading,
  error,
  onRefresh,
  onToggleComplete,
  onDelete,
}) => {
  const completedCount = tasks.filter((t) => t.completed).length;
  const pendingCount = tasks.length - completedCount;

  return (
    <div id="task-list-section" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-indigo-600" />
            Tasks
          </h2>
          <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-medium">
            {tasks.length} total
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>{pendingCount} Pending</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>{completedCount} Completed</span>
          </span>
          <button
            id="refresh-tasks-btn"
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1 text-slate-500 hover:text-indigo-600 transition focus:outline-hidden disabled:opacity-50 cursor-pointer"
            title="Refresh list"
            aria-label="Refresh tasks"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div id="task-list-error" className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-800 text-sm">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Unable to load tasks</p>
            <p className="text-red-600 text-xs mt-0.5">{error}</p>
          </div>
          <button
            id="retry-fetch-btn"
            onClick={onRefresh}
            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-md text-xs font-medium transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && tasks.length === 0 && (
        <div id="task-list-loading" className="py-12 text-center bg-white border border-slate-200 rounded-lg">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-700">Loading tasks from database...</p>
          <p className="text-xs text-slate-400 mt-1">Connecting to REST API backend</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && tasks.length === 0 && (
        <div id="task-list-empty" className="py-12 text-center bg-white border border-dashed border-slate-300 rounded-lg p-6">
          <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-700">No tasks found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            You are all caught up! Use the form above to add a new task to the database.
          </p>
        </div>
      )}

      {/* Tasks list */}
      <div id="task-items-container" className="space-y-2.5">
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            onToggleComplete={onToggleComplete}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { CheckCircle2, Circle, Trash2, Clock, Loader2 } from 'lucide-react';
import { Task } from '../types';

interface TaskItemProps {
  task: Task;
  onToggleComplete: (id: number, completed: boolean) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export const TaskItem: React.FC<TaskItemProps> = ({ task, onToggleComplete, onDelete }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleToggle = async () => {
    if (isUpdating || isDeleting) return;
    setIsUpdating(true);
    try {
      await onToggleComplete(task.id, !task.completed);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (isUpdating || isDeleting) return;
    if (!window.confirm?.(`Are you sure you want to delete "${task.title}"?`)) {
      return;
    }
    setIsDeleting(true);
    try {
      await onDelete(task.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const formattedDate = new Date(task.created_at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      id={`task-item-${task.id}`}
      className={`p-4 rounded-lg border transition duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        task.completed
          ? 'bg-slate-50/80 border-slate-200 opacity-90'
          : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
      }`}
    >
      <div className="flex items-start gap-3.5 flex-1 min-w-0">
        <button
          id={`toggle-task-${task.id}-btn`}
          onClick={handleToggle}
          disabled={isUpdating || isDeleting}
          className="mt-0.5 text-slate-400 hover:text-indigo-600 transition focus:outline-hidden disabled:opacity-50 cursor-pointer"
          title={task.completed ? 'Mark as pending' : 'Mark as completed'}
          aria-label={task.completed ? 'Mark as pending' : 'Mark as completed'}
        >
          {isUpdating ? (
            <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
          ) : task.completed ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ) : (
            <Circle className="w-5 h-5 text-slate-400 hover:text-indigo-600" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3
              className={`text-sm font-semibold leading-snug break-words ${
                task.completed ? 'text-slate-500 line-through' : 'text-slate-800'
              }`}
            >
              {task.title}
            </h3>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                task.completed
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {task.completed ? 'Completed' : 'Pending'}
            </span>
          </div>

          {task.description && (
            <p className={`text-xs leading-relaxed mb-2 break-words ${task.completed ? 'text-slate-400' : 'text-slate-600'}`}>
              {task.description}
            </p>
          )}

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            <span>Created {formattedDate}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center">
        <button
          id={`complete-task-${task.id}-action`}
          onClick={handleToggle}
          disabled={isUpdating || isDeleting}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer disabled:opacity-50 ${
            task.completed
              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
          }`}
        >
          {task.completed ? 'Mark Pending' : 'Complete'}
        </button>

        <button
          id={`delete-task-${task.id}-btn`}
          onClick={handleDelete}
          disabled={isUpdating || isDeleting}
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition cursor-pointer disabled:opacity-50"
          title="Delete task"
          aria-label="Delete task"
        >
          {isDeleting ? (
            <Loader2 className="w-4 h-4 animate-spin text-red-600" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
};

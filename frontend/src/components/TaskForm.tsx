import React, { useState } from 'react';
import { PlusCircle, Loader2 } from 'lucide-react';
import { CreateTaskInput } from '../types';

interface TaskFormProps {
  onTaskCreated: (data: CreateTaskInput) => Promise<void>;
  disabled?: boolean;
}

export const TaskForm: React.FC<TaskFormProps> = ({ onTaskCreated, disabled }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();

    if (!cleanTitle) {
      setValidationError('Please enter a task title.');
      return;
    }

    setValidationError(null);
    setIsSubmitting(true);

    try {
      await onTaskCreated({
        title: cleanTitle,
        description: description.trim() || undefined,
      });
      setTitle('');
      setDescription('');
    } catch (err: any) {
      setValidationError(err.message || 'Failed to add task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="task-form-container" className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
      <h2 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
        <PlusCircle className="w-5 h-5 text-indigo-600" />
        Create New Task
      </h2>

      <form id="create-task-form" onSubmit={handleSubmit} className="space-y-4">
        {validationError && (
          <div id="form-validation-error" className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md">
            {validationError}
          </div>
        )}

        <div>
          <label htmlFor="task-title-input" className="block text-xs font-medium text-slate-700 uppercase tracking-wider mb-1">
            Task Title <span className="text-red-500">*</span>
          </label>
          <input
            id="task-title-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Set up public and private subnets in AWS VPC"
            disabled={disabled || isSubmitting}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
            maxLength={255}
          />
        </div>

        <div>
          <label htmlFor="task-desc-input" className="block text-xs font-medium text-slate-700 uppercase tracking-wider mb-1">
            Description <span className="text-slate-400 font-normal lowercase">(optional)</span>
          </label>
          <textarea
            id="task-desc-input"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details, acceptance criteria, or architectural notes..."
            disabled={disabled || isSubmitting}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition resize-none"
          />
        </div>

        <div className="flex justify-end">
          <button
            id="submit-task-btn"
            type="submit"
            disabled={disabled || isSubmitting || !title.trim()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-md shadow-xs transition focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 cursor-pointer disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Task...</span>
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4" />
                <span>Add Task</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

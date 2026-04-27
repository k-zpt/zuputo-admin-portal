'use client';

import {
  SYSTEM_JOB_STATUSES,
  type CreateBackgroundJobPayload,
  type SystemJobStatus,
} from '@/lib/api/types';

const STATUS_LABELS: Record<SystemJobStatus, string> = {
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  DISABLED: 'Disabled',
};

export function RegisterJobForm({
  form,
  onChange,
  disabled,
  saving,
  onSubmit,
}: {
  form: CreateBackgroundJobPayload;
  onChange: (f: CreateBackgroundJobPayload) => void;
  disabled: boolean;
  saving: boolean;
  onSubmit: () => void;
}) {
  const field =
    'mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 dark:border-gray-600 dark:bg-gray-800 dark:text-white';

  const selectClass = `${field} appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat pr-10 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')]`;

  return (
    <div className="grid max-w-lg gap-5">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Name
        <input
          type="text"
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          className={field}
          placeholder="e.g. my_custom_job"
        />
      </label>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Description
        <textarea
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
          className={field}
          rows={3}
          placeholder="Short description of what this job does"
        />
      </label>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Status
        <select
          value={form.status}
          onChange={(e) =>
            onChange({
              ...form,
              status: e.target.value as SystemJobStatus,
            })
          }
          className={selectClass}
        >
          {SYSTEM_JOB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="w-fit rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-600 dark:hover:bg-slate-500"
        disabled={disabled || !form.name.trim()}
        onClick={onSubmit}
      >
        {saving ? 'Creating…' : 'Create job'}
      </button>
    </div>
  );
}

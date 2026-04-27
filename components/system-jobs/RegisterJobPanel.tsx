'use client';

import type { CreateBackgroundJobPayload } from '@/lib/api/types';
import { useState } from 'react';
import { RegisterJobForm } from './RegisterJobForm';

const EMPTY_FORM: CreateBackgroundJobPayload = {
  name: '',
  description: '',
  status: 'ACTIVE',
};

export function RegisterJobPanel({
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
  const [open, setOpen] = useState(false);

  const handleCancel = () => {
    setOpen(false);
    onChange({ ...EMPTY_FORM });
  };

  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/40 dark:border-gray-700 dark:bg-gray-800/20">
      {!open ? (
        <div className="p-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
            disabled={disabled}
          >
            <span className="text-lg leading-none text-blue-600 dark:text-blue-400" aria-hidden>
              +
            </span>
            Register a new job
          </button>
        </div>
      ) : (
        <div className="space-y-4 border-t border-gray-200/80 p-4 dark:border-gray-700">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              New job registration
            </h3>
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200/80 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700/80"
            >
              Cancel
            </button>
          </div>
          <RegisterJobForm
            form={form}
            onChange={onChange}
            disabled={disabled}
            saving={saving}
            onSubmit={onSubmit}
          />
        </div>
      )}
    </div>
  );
}

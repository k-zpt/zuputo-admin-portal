'use client';

import { validateRenewalOffsets } from '@/lib/systemJobs';
import { useMemo } from 'react';

const RULES =
  'Whole numbers greater than 0 · no duplicates · strictly descending (e.g. 12, 7, 3, 2, 1).';

export function RenewalOffsetsField({
  value,
  onChange,
  savePending,
  onSave,
}: {
  value: string;
  onChange: (v: string) => void;
  savePending: boolean;
  onSave: (offsets: number[]) => void;
}) {
  const validation = useMemo(() => validateRenewalOffsets(value), [value]);
  const isEmpty = value.trim() === '';
  const showNeutral = isEmpty;
  const isValid = validation.ok;
  const borderClass = showNeutral
    ? 'border-gray-300 dark:border-gray-600'
    : isValid
      ? 'border-emerald-400 ring-1 ring-emerald-400/30 dark:border-emerald-600 dark:ring-emerald-500/20'
      : 'border-amber-400 ring-1 ring-amber-400/40 dark:border-amber-600 dark:ring-amber-500/25';

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Days before renewal to act. Separate with commas or spaces.{' '}
        <span className="font-medium text-gray-800 dark:text-gray-200">{RULES}</span>
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1 space-y-2">
          <label className="sr-only" htmlFor="renewal-offsets-input">
            Renewal offsets
          </label>
          <input
            id="renewal-offsets-input"
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoComplete="off"
            placeholder="12, 7, 3, 2, 1"
            aria-invalid={!showNeutral && !isValid}
            aria-describedby="offsets-hint offsets-feedback"
            className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500 ${borderClass}`}
          />
          <p id="offsets-hint" className="text-xs text-gray-500 dark:text-gray-400">
            {showNeutral
              ? 'Start typing numbers — the field border turns green when the list is valid.'
              : isValid
                ? 'Looks good — you can save this list.'
                : 'Fix the issues below to enable Save.'}
          </p>
        </div>
        <button
          type="button"
          disabled={savePending || !validation.ok}
          onClick={() => {
            if (validation.ok) onSave(validation.values);
          }}
          className="shrink-0 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {savePending ? 'Saving…' : 'Save offsets'}
        </button>
      </div>

      <div
        id="offsets-feedback"
        role="status"
        className={`rounded-xl px-4 py-3 text-sm ${
          showNeutral
            ? 'border border-dashed border-gray-200 bg-gray-50/80 text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400'
            : isValid
              ? 'border border-emerald-200 bg-emerald-50/90 text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-100'
              : 'border border-amber-200 bg-amber-50/90 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100'
        }`}
      >
        {!showNeutral && isValid ? (
          <p className="font-medium">Valid sequence: {validation.values.join(' → ')}</p>
        ) : !showNeutral && !isValid ? (
          <ul className="list-inside list-disc space-y-1">
            {validation.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        ) : (
          <p>Validation runs as you type. Empty input is not saved.</p>
        )}
      </div>
    </div>
  );
}

'use client';

import type { BackgroundJobConfig } from '@/lib/api/types';

export function ConfigJsonPanel({
  jobConfig,
  pending,
  onRefresh,
}: {
  jobConfig: BackgroundJobConfig | null;
  pending: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onRefresh}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
        >
          <span className="text-base leading-none" aria-hidden>
            ↻
          </span>
          {pending ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <div className="relative overflow-hidden rounded-xl ring-1 ring-gray-200/80 dark:ring-gray-700/80">
        <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-gray-100/90 to-transparent dark:from-gray-950/90" />
        <pre className="max-h-[min(28rem,55vh)] overflow-auto bg-gray-50/90 p-4 pt-6 font-mono text-[11px] leading-relaxed text-gray-800 dark:bg-gray-950/90 dark:text-gray-200">
          {jobConfig ? JSON.stringify(jobConfig, null, 2) : '—'}
        </pre>
      </div>
    </div>
  );
}

'use client';

import type { SystemJobRecord } from '@/lib/api/types';

export function JobsRegistryPanel({
  jobs,
  loadError,
  refreshing,
  onRefresh,
}: {
  jobs: SystemJobRecord[];
  loadError: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-4">
        {jobs.length > 0 ? (
          <p className="mr-auto text-sm text-gray-600 dark:text-gray-400">
            {jobs.length} job{jobs.length === 1 ? '' : 's'} listed
          </p>
        ) : null}
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
        >
          <span className="text-base leading-none" aria-hidden>
            ↻
          </span>
          {refreshing ? 'Refreshing…' : 'Refresh list'}
        </button>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100">
          {loadError}
        </div>
      ) : null}

      {jobs.length === 0 && !loadError ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-8 text-center text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/30 dark:text-gray-400">
          No jobs in the registry yet, or the list is empty.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl ring-1 ring-gray-200/80 dark:ring-gray-700/80">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50/90 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Id</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {jobs.map((job, i) => (
                  <tr
                    key={typeof job.id === 'string' ? job.id : `job-${i}`}
                    className="bg-white/80 hover:bg-gray-50/80 dark:bg-gray-900/40 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {typeof job.name === 'string' ? job.name : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {typeof job.status === 'string' ? job.status : '—'}
                    </td>
                    <td className="max-w-md px-4 py-3 text-gray-600 dark:text-gray-400">
                      {typeof job.description === 'string' ? job.description : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-500">
                      {typeof job.id === 'string' ? job.id : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

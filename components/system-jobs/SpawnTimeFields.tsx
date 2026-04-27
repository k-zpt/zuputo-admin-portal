'use client';

export function SpawnTimeFields({
  hour,
  minute,
  onHourChange,
  onMinuteChange,
  disabled,
  saving,
  onSave,
}: {
  hour: number;
  minute: number;
  onHourChange: (h: number) => void;
  onMinuteChange: (m: number) => void;
  disabled: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  const inputClass =
    'h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 dark:border-gray-600 dark:bg-gray-800 dark:text-white sm:w-24';

  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap items-end gap-4">
        <div className="grid min-w-0 gap-1.5">
          <label
            htmlFor="spawn-hour"
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Hour
          </label>
          <input
            id="spawn-hour"
            type="number"
            min={0}
            max={23}
            value={hour}
            onChange={(e) => onHourChange(Number(e.target.value))}
            className={inputClass}
            aria-describedby="spawn-range-hint"
          />
        </div>
        <div className="grid min-w-0 gap-1.5">
          <label
            htmlFor="spawn-minute"
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Minute
          </label>
          <input
            id="spawn-minute"
            type="number"
            min={0}
            max={59}
            value={minute}
            onChange={(e) => onMinuteChange(Number(e.target.value))}
            className={inputClass}
            aria-describedby="spawn-range-hint"
          />
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={onSave}
          className="h-10 shrink-0 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {saving ? 'Saving…' : 'Save spawn time'}
        </button>
      </div>
      <p id="spawn-range-hint" className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        24-hour clock — hour <span className="font-medium">0–23</span>, minute{' '}
        <span className="font-medium">0–59</span>.
      </p>
    </div>
  );
}

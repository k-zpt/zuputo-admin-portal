'use client';

export function MechanismActions({
  pending,
  onEnable,
  onDisable,
  onTriggerSpawn,
}: {
  pending: string | null;
  onEnable: () => void;
  onDisable: () => void;
  onTriggerSpawn: () => void;
}) {
  const busy = !!pending;

  const cardBtn =
    'flex min-h-0 min-w-0 flex-row items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition disabled:opacity-50';

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={onEnable}
        className={`${cardBtn} border-emerald-200/80 bg-emerald-50/90 text-emerald-900 hover:bg-emerald-100/90 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-900/50`}
      >
        <span className="shrink-0 text-xl leading-none" aria-hidden>
          ▶
        </span>
        <div className="min-w-0">
          <div className="font-semibold leading-tight">Enable</div>
          <div className="mt-0.5 text-xs font-normal text-emerald-800/90 dark:text-emerald-300/85">
            {pending === 'enable' ? 'Working…' : 'Resume scheduled runs'}
          </div>
        </div>
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onDisable}
        className={`${cardBtn} border-rose-200/80 bg-rose-50/90 text-rose-900 hover:bg-rose-100/90 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100 dark:hover:bg-rose-900/50`}
      >
        <span className="shrink-0 text-xl leading-none" aria-hidden>
          ◼
        </span>
        <div className="min-w-0">
          <div className="font-semibold leading-tight">Disable</div>
          <div className="mt-0.5 text-xs font-normal text-rose-800/90 dark:text-rose-300/85">
            {pending === 'disable' ? 'Working…' : 'Pause scheduler'}
          </div>
        </div>
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onTriggerSpawn}
        className={`${cardBtn} border-violet-200/80 bg-violet-50/90 text-violet-900 hover:bg-violet-100/90 dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-900/50`}
      >
        <span className="shrink-0 text-xl leading-none" aria-hidden>
          ⚡
        </span>
        <div className="min-w-0">
          <div className="font-semibold leading-tight">Trigger spawn</div>
          <div className="mt-0.5 text-xs font-normal text-violet-800/90 dark:text-violet-300/85">
            {pending === 'triggerSpawn' ? 'Working…' : 'Run spawn cycle now'}
          </div>
        </div>
      </button>
    </div>
  );
}

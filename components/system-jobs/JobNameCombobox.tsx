'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

export function JobNameCombobox({
  value,
  onChange,
  knownJobNames,
  pending,
  onTrigger,
}: {
  value: string;
  onChange: (v: string) => void;
  knownJobNames: string[];
  pending: boolean;
  onTrigger: () => void;
}) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const q = value.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!knownJobNames.length) return [];
    if (!q) return knownJobNames.slice(0, 12);
    return knownJobNames.filter((n) => n.toLowerCase().includes(q)).slice(0, 12);
  }, [knownJobNames, q]);

  useEffect(() => {
    setHighlight(0);
  }, [q, open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (name: string) => {
    onChange(name);
    setOpen(false);
    inputRef.current?.focus();
  };

  const helperText = (() => {
    if (!knownJobNames.length) {
      return 'No suggestions yet — type a job name.';
    }
    if (!q) {
      return `${filtered.length} of ${knownJobNames.length} jobs shown. Keep typing to narrow the list.`;
    }
    if (filtered.length === 0) {
      return 'No name in the list matches — you can still run the job if it is registered.';
    }
    return `${filtered.length} match${filtered.length === 1 ? '' : 'es'}. Use arrow keys and Enter to choose.`;
  })();

  return (
    <div ref={containerRef} className="space-y-3">
      <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">Job name</span>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (!open || filtered.length === 0) return;
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlight((i) => (i + 1) % filtered.length);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlight((i) => (i - 1 + filtered.length) % filtered.length);
              } else if (e.key === 'Enter') {
                e.preventDefault();
                pick(filtered[highlight]!);
              } else if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            placeholder={
              knownJobNames.length
                ? 'Type to filter registered jobs…'
                : 'e.g. subscription_renewal'
            }
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
          {open && filtered.length > 0 ? (
            <ul
              id={listId}
              role="listbox"
              className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
            >
              {filtered.map((name, i) => (
                <li key={name} role="option" aria-selected={i === highlight}>
                  <button
                    type="button"
                    className={`flex w-full px-4 py-2.5 text-left text-sm ${
                      i === highlight
                        ? 'bg-blue-50 text-blue-900 dark:bg-blue-950/80 dark:text-blue-100'
                        : 'text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-700/80'
                    }`}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(name)}
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <p
            className={`mt-1.5 text-xs ${
              !knownJobNames.length
                ? 'text-amber-700 dark:text-amber-300/90'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {helperText}
          </p>
        </div>
        <button
          type="button"
          disabled={pending || !value.trim()}
          onClick={onTrigger}
          className="shrink-0 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {pending ? 'Running…' : 'Trigger job'}
        </button>
      </div>
    </div>
  );
}

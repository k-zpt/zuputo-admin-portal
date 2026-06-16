/**
 * Format numeric amounts with thousand separators (e.g. 5000 -> 5,000).
 * Handles string or number input; preserves up to 2 decimal places.
 */
export function formatAmount(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return typeof value === 'string' ? value : '';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

/** Date in API responses: { "$date": "..." } or { date: "..." } */
type DateLikeObject = { $date?: string | number; date?: string | number };

type DateInput = string | number | Date | DateLikeObject | undefined;

/**
 * Parse a date that may be ISO string, DD/MM/YYYY[, time], epoch ms, Date, or { $date: ... }.
 * Does not use US date interpretation: "04/03/2026" is treated as 4 March 2026 (DD/MM/YYYY).
 */
function parseDate(value: DateInput): Date | null {
  if (value == null) return null;
  // Wrapped date: { $date: "..." } or { date: "..." }
  if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
    const obj = value as DateLikeObject;
    const inner = obj.$date ?? obj.date;
    if (inner !== undefined && inner !== null) return parseDate(inner as string | number);
    return null;
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== 'string') return null;
  // Normalise: trim and remove surrounding quotes (e.g. from double-encoded JSON)
  let trimmed = value.trim().replace(/^["']|["']$/g, '');
  if (!trimmed) return null;
  // ISO: 2026-03-04 or 2026-03-04T00:29:21.256Z (year first)
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed) || trimmed.includes('T')) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  // DD/MM/YYYY or "04/03/2026, 00:29:21" (day first = 4 Mar 2026, never US Apr 3)
  if (trimmed.includes('/')) {
    const datePart = trimmed.split(/[,\s]+/)[0]?.trim() ?? '';
    const parts = datePart.split('/').map((p) => parseInt(p, 10));
    if (parts.length >= 3 && parts.every((n) => !isNaN(n))) {
      const [day, month, year] = parts;
      const d = new Date(year, month - 1, day);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

/** Ordinal suffix for day: 1st, 2nd, 3rd, 4th, ... */
function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

/** Pad number to 2 digits (e.g. 4 -> "04") */
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** YYYY-MM-DD for `<input type="date">`. */
export function toDateInputValue(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** YYYY-MM-DD for a date N calendar days from today (local). */
export function addDaysToDateInputValue(days: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return toDateInputValue(d);
}

/**
 * Parse YYYY-MM-DD (from type="date") to UTC midnight epoch ms.
 * Backend date fields require zero time (00:00:00 UTC).
 */
export function dateInputToUtcMidnightMs(value: string): number | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return Date.UTC(year, month - 1, day, 0, 0, 0, 0);
}

/** Parse YYYY-MM-DD as local calendar midnight (for day-diff / terms). */
export function parseDateInputLocal(value: string): Date | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return isNaN(d.getTime()) ? null : d;
}

/** Display dd/mm/yyyy from a date input value (YYYY-MM-DD). */
export function formatDateInputValue(value: string): string {
  const ms = dateInputToUtcMidnightMs(value);
  if (ms == null) return '';
  return formatDate(ms, { format: 'dd/mm/yyyy' });
}

/**
 * Format a date for display. Uses en-GB (day-first), not US formatting.
 * Accepts ISO string, DD/MM string "04/03/2026, 00:29:21", epoch ms, or Date.
 * - format 'dd/mm/yyyy': 04/03/2026 (never American mm/dd/yyyy)
 * - default: 4th March, 2026
 */
export function formatDate(
  dateInput: DateInput,
  options?: { includeTime?: boolean; format?: 'dd/mm/yyyy' }
): string {
  const date = parseDate(dateInput);
  if (!date) return 'N/A';
  if (options?.format === 'dd/mm/yyyy') {
    const day = pad2(date.getDate());
    const month = pad2(date.getMonth() + 1);
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
  const day = date.getDate();
  const month = date.toLocaleDateString('en-GB', { month: 'long' });
  const year = date.getFullYear();
  const dateStr = `${getOrdinal(day)} ${month}, ${year}`;
  if (options?.includeTime) {
    const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return `${dateStr}, ${time}`;
  }
  return dateStr;
}

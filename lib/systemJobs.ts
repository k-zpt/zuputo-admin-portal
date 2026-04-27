import type { BackgroundJobConfig } from '@/lib/api/types';

export function offsetsFromConfig(config: BackgroundJobConfig | null): string {
  if (!config) return '';
  const raw = config.offsets ?? config.renewalOffsets ?? config.renewal_offsets;
  if (Array.isArray(raw) && raw.every((n) => typeof n === 'number')) {
    return (raw as number[]).join(', ');
  }
  return '';
}

export function pickNumber(
  obj: Record<string, unknown>,
  keys: string[]
): number | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
  }
  return undefined;
}

export type OffsetsValidation =
  | { ok: true; values: number[] }
  | { ok: false; errors: string[] };

/**
 * Validates renewal offset input: positive integers, unique, strictly descending.
 */
export function validateRenewalOffsets(input: string): OffsetsValidation {
  const rawTokens = input
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (rawTokens.length === 0) {
    return { ok: false, errors: ['Enter at least one day offset.'] };
  }

  const numbers: number[] = [];
  const errors: string[] = [];

  for (const t of rawTokens) {
    if (!/^-?\d+$/.test(t)) {
      errors.push(`“${t}” is not a valid whole number.`);
      continue;
    }
    const n = Number(t);
    if (!Number.isSafeInteger(n)) {
      errors.push(`“${t}” is out of range.`);
      continue;
    }
    numbers.push(n);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  if (numbers.some((n) => n <= 0)) {
    return { ok: false, errors: ['Every offset must be greater than 0.'] };
  }

  if (new Set(numbers).size !== numbers.length) {
    return { ok: false, errors: ['Each day offset must appear only once (no duplicates).'] };
  }

  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] >= numbers[i - 1]) {
      return {
        ok: false,
        errors: [
          'Offsets must be in strictly descending order (each value smaller than the previous), e.g. 12, 7, 3, 2, 1.',
        ],
      };
    }
  }

  return { ok: true, values: numbers };
}

function collectNamesFromArray(arr: unknown, into: Set<string>) {
  if (!Array.isArray(arr)) return;
  for (const item of arr) {
    if (typeof item === 'string' && item.trim()) {
      into.add(item.trim());
    } else if (item && typeof item === 'object' && 'name' in item) {
      const n = (item as { name: unknown }).name;
      if (typeof n === 'string' && n.trim()) into.add(n.trim());
    }
  }
}

/**
 * Best-effort extraction of registered job names from GET /jobs/config payload.
 */
export function extractJobNamesFromConfig(config: BackgroundJobConfig | null): string[] {
  if (!config) return [];
  const names = new Set<string>();

  collectNamesFromArray(config.jobs, names);
  const jobsObj = config.jobs;
  if (jobsObj && typeof jobsObj === 'object' && !Array.isArray(jobsObj)) {
    for (const k of Object.keys(jobsObj as Record<string, unknown>)) {
      if (k.trim()) names.add(k.trim());
    }
  }
  collectNamesFromArray(config.jobDefinitions, names);
  collectNamesFromArray(config.registeredJobs, names);
  collectNamesFromArray(config.backgroundJobs, names);
  collectNamesFromArray(config.definitions, names);

  const jobList = config.jobList;
  if (jobList && typeof jobList === 'object' && !Array.isArray(jobList)) {
    for (const k of Object.keys(jobList as Record<string, unknown>)) {
      if (k.trim()) names.add(k.trim());
    }
  }

  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

'use client';

import { AdminLayout } from '@/components/AdminLayout';
import { bookingService } from '@/lib/api/services';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ApiResponse, SchedulingBooking } from '@/lib/api/types';

/** Normalize datetime-local or API ISO to `YYYY-MM-DDTHH:mm:ss` for comparison. */
function normalizeDatetime(value: string): string {
  let v = value.trim().replace(' ', 'T');
  v = v.replace(/\.\d{3}Z$/i, '').replace(/Z$/i, '');
  if (v.length === 16) return `${v}:00`;
  return v.slice(0, 19);
}

/**
 * Parse booking start/end from the API.
 * - With `Z` or offset: absolute instant.
 * - Otherwise: wall-clock in the booking's IANA timezone (matches DB storage).
 */
function bookingDatetimeToUtcMs(value: string, timezone: string): number | null {
  const trimmed = value.trim();
  if (/Z$/i.test(trimmed) || /[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    const ms = Date.parse(trimmed.replace(' ', 'T'));
    return Number.isNaN(ms) ? null : ms;
  }
  return zonedDatetimeToUtcMs(trimmed, timezone);
}

function formatBookingSlot(start: string, end: string, timezone: string): string {
  try {
    const startMs = bookingDatetimeToUtcMs(start, timezone);
    const endMs = bookingDatetimeToUtcMs(end, timezone);
    if (startMs == null || endMs == null) {
      return `${start} – ${end} (${timezone})`;
    }
    const startDate = new Date(startMs);
    const endDate = new Date(endMs);
    const dateFmt = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: timezone,
    });
    const timeFmt = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    });
    return `${dateFmt.format(startDate)}, ${timeFmt.format(startDate)} – ${timeFmt.format(endDate)} (${timezone})`;
  } catch {
    return `${start} – ${end} (${timezone})`;
  }
}

function getDatetimeNormInTimezone(utcMs: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
}

/** Interpret a wall-clock datetime as belonging to `timezone` and return UTC ms. */
function zonedDatetimeToUtcMs(value: string, timezone: string): number | null {
  const norm = normalizeDatetime(value);
  const [datePart, timePart] = norm.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second = 0] = timePart.split(':').map(Number);
  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const windowMs = 36 * 60 * 60 * 1000;
  const stepMs = 60 * 1000;
  const target = norm.slice(0, 16);

  for (let offset = 0; offset <= windowMs; offset += stepMs) {
    for (const sign of [0, 1, -1] as const) {
      const candidate = naiveUtc + sign * offset;
      if (getDatetimeNormInTimezone(candidate, timezone).slice(0, 16) === target) {
        return candidate;
      }
    }
  }
  return null;
}

function utcMsToDatetimeLocal(utcMs: number, timezone: string): string {
  return getDatetimeNormInTimezone(utcMs, timezone).slice(0, 16);
}

/** If end is before start, bump end forward (preserving slot duration when possible). */
function adjustEndForStart(
  newStart: string,
  currentEnd: string,
  timezone: string,
  slotDurationMs: number
): string {
  if (!newStart.trim()) return currentEnd;
  const tz = timezone.trim() || 'UTC';
  const newStartMs = zonedDatetimeToUtcMs(newStart, tz);
  if (newStartMs == null) return currentEnd;

  const currentEndMs = currentEnd.trim() ? zonedDatetimeToUtcMs(currentEnd, tz) : null;
  if (currentEndMs != null && currentEndMs >= newStartMs) return currentEnd;

  const durationMs = slotDurationMs > 0 ? slotDurationMs : 30 * 60 * 1000;
  return utcMsToDatetimeLocal(newStartMs + durationMs, tz);
}

/** True when the booking end time (in its timezone) is before now. */
function isBookingPast(end: string, timezone: string): boolean {
  try {
    const endMs = bookingDatetimeToUtcMs(end, timezone);
    if (endMs == null) return false;
    return endMs <= Date.now();
  } catch {
    return false;
  }
}

function isApprovedStatus(status: string): boolean {
  const s = status.toUpperCase();
  return s === 'CONFIRMED' || s === 'APPROVED';
}

function getBookingStatusClasses(status: string): string {
  switch (status.toUpperCase()) {
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200';
    case 'CONFIRMED':
    case 'APPROVED':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200';
    case 'REJECTED':
    case 'CANCELLED':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  }
}

function bookingHasActions(status: string): boolean {
  const s = status.toUpperCase();
  return s === 'PENDING' || isApprovedStatus(s);
}

/** Returns a user-facing error message, or null when valid. */
function validateRescheduleTimes(
  newStart: string,
  newEnd: string,
  timezone: string
): string | null {
  if (!newStart.trim() || !newEnd.trim()) {
    return 'Start and end times are required.';
  }
  const startMs = zonedDatetimeToUtcMs(newStart, timezone);
  const endMs = zonedDatetimeToUtcMs(newEnd, timezone);
  if (startMs == null || endMs == null) {
    return 'Invalid start or end time for the selected timezone.';
  }
  if (startMs <= Date.now()) {
    return 'New start time cannot be in the past.';
  }
  if (endMs < startMs) {
    return 'End time cannot be before start time.';
  }
  return null;
}

function openDatetimePicker(input: HTMLInputElement, event: React.MouseEvent<HTMLInputElement>) {
  if (event.target !== input) return;
  try {
    input.showPicker?.();
  } catch {
    input.focus();
  }
}

/** Prefill datetime-local from API value in the booking's timezone. */
function bookingDatetimeToDatetimeLocal(value: string, timezone: string): string {
  const ms = bookingDatetimeToUtcMs(value, timezone);
  if (ms == null) return isoToDatetimeLocal(value);
  return utcMsToDatetimeLocal(ms, timezone);
}

/** API expects `YYYY-MM-DDTHH:mm:ss`; datetime-local gives `YYYY-MM-DDTHH:mm`. */
function isoToDatetimeLocal(iso: string): string {
  if (!iso) return '';
  return iso.replace(' ', 'T').slice(0, 16);
}

function datetimeLocalToApiIso(value: string): string {
  const v = value.trim();
  if (!v) return '';
  return v.length === 16 ? `${v}:00` : v;
}

function listIanaTimeZones(): string[] {
  try {
    return [...Intl.supportedValuesOf('timeZone')].sort((a, b) => a.localeCompare(b));
  } catch {
    return ['Africa/Accra', 'America/Toronto', 'Europe/London', 'UTC'];
  }
}

const RESCHEDULE_TIMEZONE_OPTIONS = listIanaTimeZones();

const selectFieldClass =
  'mt-1 w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url(\'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E\')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url(\'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E\')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400';

type BookingActionsMenuProps = {
  booking: SchedulingBooking;
  isBusy: boolean;
  openActionsMenuId: string | null;
  setOpenActionsMenuId: (id: string | null) => void;
  actionsMenuRef: React.RefObject<HTMLDivElement | null>;
  onConfirm: (booking: SchedulingBooking) => void;
  onReject: (booking: SchedulingBooking) => void;
  onReschedule: (booking: SchedulingBooking) => void;
  onCancel: (booking: SchedulingBooking) => void;
};

function BookingActionsMenu({
  booking,
  isBusy,
  openActionsMenuId,
  setOpenActionsMenuId,
  actionsMenuRef,
  onConfirm,
  onReject,
  onReschedule,
  onCancel,
}: BookingActionsMenuProps) {
  if (!bookingHasActions(booking.status)) {
    return <span className="text-xs text-gray-400 dark:text-gray-500">—</span>;
  }

  const isPending = booking.status.toUpperCase() === 'PENDING';
  const isApproved = isApprovedStatus(booking.status);
  const isOpen = openActionsMenuId === booking.id;

  const menuItemClass =
    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700';

  return (
    <div
      ref={isOpen ? actionsMenuRef : undefined}
      className="relative inline-block"
    >
      <button
        type="button"
        disabled={isBusy}
        onClick={(e) => {
          e.stopPropagation();
          setOpenActionsMenuId(isOpen ? null : booking.id);
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
      >
        {isBusy ? 'Working…' : 'Actions'}
        <svg
          className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && !isBusy && (
        <div className="absolute right-0 z-20 mt-1 min-w-[10rem] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {isPending && (
            <button type="button" onClick={() => onConfirm(booking)} className={menuItemClass}>
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              Confirm
            </button>
          )}
          <button type="button" onClick={() => onReschedule(booking)} className={menuItemClass}>
            <span className="inline-flex h-2 w-2 rounded-full bg-blue-500" />
            Reschedule
          </button>
          {isPending && (
            <button
              type="button"
              onClick={() => onReject(booking)}
              className={`${menuItemClass} hover:bg-red-50 dark:hover:bg-red-900/20`}
            >
              <span className="inline-flex h-2 w-2 rounded-full bg-red-500" />
              Reject
            </button>
          )}
          {isApproved && (
            <button
              type="button"
              onClick={() => onCancel(booking)}
              className={`${menuItemClass} hover:bg-amber-50 dark:hover:bg-amber-900/20`}
            >
              <span className="inline-flex h-2 w-2 rounded-full bg-amber-500" />
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function SchedulingBookingsPage() {
  const [bookings, setBookings] = useState<SchedulingBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [actionBookingId, setActionBookingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<SchedulingBooking | null>(null);
  const [openActionsMenuId, setOpenActionsMenuId] = useState<string | null>(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<SchedulingBooking | null>(null);
  const [rescheduleForm, setRescheduleForm] = useState({
    new_start: '',
    new_end: '',
    timezone: '',
    proposed_by: '',
  });
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const rescheduleSlotDurationMsRef = useRef(30 * 60 * 1000);

  const syncRescheduleEnd = useCallback(
    (start: string, end: string, timezone: string) =>
      adjustEndForStart(start, end, timezone, rescheduleSlotDurationMsRef.current),
    []
  );

  const rescheduleTimezoneOptions = useMemo(() => {
    const current = rescheduleForm.timezone.trim();
    if (current && !RESCHEDULE_TIMEZONE_OPTIONS.includes(current)) {
      return [current, ...RESCHEDULE_TIMEZONE_OPTIONS];
    }
    return RESCHEDULE_TIMEZONE_OPTIONS;
  }, [rescheduleForm.timezone]);

  useEffect(() => {
    if (!openActionsMenuId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setOpenActionsMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openActionsMenuId]);

  useEffect(() => {
    if (!showRescheduleModal || !rescheduleForm.new_start) return;
    setRescheduleForm((f) => {
      const syncedEnd = syncRescheduleEnd(f.new_start, f.new_end, f.timezone);
      if (syncedEnd === f.new_end) return f;
      return { ...f, new_end: syncedEnd };
    });
  }, [showRescheduleModal, rescheduleForm.new_start, rescheduleForm.timezone, syncRescheduleEnd]);

  const loadBookings = useCallback(async (append = false) => {
    try {
      setLoading(true);
      setError(null);
      const response: ApiResponse<SchedulingBooking[]> = await bookingService.list({
        cursor: append ? cursor || undefined : undefined,
        limit: 20,
        status: statusFilter || undefined,
      });

      if (append) {
        setBookings((prev) => [...prev, ...response.data]);
      } else {
        setBookings(response.data);
      }

      setCursor(response.pagination?.nextCursor || null);
      setHasNext(response.pagination?.hasNext || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [cursor, statusFilter]);

  useEffect(() => {
    setCursor(null);
    loadBookings(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when filter changes; cursor reset above
  }, [statusFilter]);

  const handleFilterChange = (value: string) => {
    setStatusFilter(value);
    setCursor(null);
  };

  const refreshList = async () => {
    setCursor(null);
    await loadBookings(false);
  };

  const handleConfirm = async (booking: SchedulingBooking) => {
    setOpenActionsMenuId(null);
    try {
      setActionBookingId(booking.id);
      setError(null);
      setSuccess(null);
      await bookingService.confirm(booking.id);
      setSuccess('Booking confirmed.');
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm booking');
    } finally {
      setActionBookingId(null);
    }
  };

  const openRejectModal = (booking: SchedulingBooking) => {
    setOpenActionsMenuId(null);
    setRejectTarget(booking);
    setRejectNote('');
    setShowRejectModal(true);
    setError(null);
    setSuccess(null);
  };

  const closeRejectModal = () => {
    setShowRejectModal(false);
    setRejectTarget(null);
    setRejectNote('');
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;
    const note = rejectNote.trim();
    if (!note) {
      setError('Please provide a reason for rejecting this booking.');
      return;
    }
    try {
      setActionBookingId(rejectTarget.id);
      setError(null);
      setSuccess(null);
      await bookingService.reject(rejectTarget.id, { notes: note });
      setSuccess('Booking rejected.');
      closeRejectModal();
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject booking');
    } finally {
      setActionBookingId(null);
    }
  };

  const handleCancel = async (booking: SchedulingBooking) => {
    setOpenActionsMenuId(null);
    try {
      setActionBookingId(booking.id);
      setError(null);
      setSuccess(null);
      await bookingService.cancel(booking.id);
      setSuccess('Booking cancelled.');
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel booking');
    } finally {
      setActionBookingId(null);
    }
  };

  const openRescheduleModal = (booking: SchedulingBooking) => {
    setOpenActionsMenuId(null);
    setRescheduleTarget(booking);
    const tz = booking.timezone || 'UTC';
    const newStart = bookingDatetimeToDatetimeLocal(booking.start, tz);
    const newEnd = bookingDatetimeToDatetimeLocal(booking.end, tz);
    const startMs = bookingDatetimeToUtcMs(booking.start, tz);
    const endMs = bookingDatetimeToUtcMs(booking.end, tz);
    rescheduleSlotDurationMsRef.current =
      startMs != null && endMs != null && endMs > startMs ? endMs - startMs : 30 * 60 * 1000;
    setRescheduleForm({
      new_start: newStart,
      new_end: newEnd,
      timezone: booking.timezone || '',
      proposed_by: booking.customer?.id || '',
    });
    setShowRescheduleModal(true);
    setError(null);
    setSuccess(null);
  };

  const closeRescheduleModal = () => {
    setShowRescheduleModal(false);
    setRescheduleTarget(null);
    setRescheduleForm({ new_start: '', new_end: '', timezone: '', proposed_by: '' });
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleTarget) return;
    const new_start = datetimeLocalToApiIso(rescheduleForm.new_start);
    const new_end = datetimeLocalToApiIso(rescheduleForm.new_end);
    const timezone = rescheduleForm.timezone.trim();
    const proposed_by = rescheduleForm.proposed_by.trim();
    if (!new_start || !new_end || !timezone || !proposed_by) {
      setError('All reschedule fields are required.');
      return;
    }
    const validationError = validateRescheduleTimes(
      rescheduleForm.new_start,
      rescheduleForm.new_end,
      timezone
    );
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      setActionBookingId(rescheduleTarget.id);
      setError(null);
      setSuccess(null);
      await bookingService.reschedule(rescheduleTarget.id, {
        new_start,
        new_end,
        timezone,
        proposed_by,
      });
      setSuccess('Booking rescheduled.');
      closeRescheduleModal();
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reschedule booking');
    } finally {
      setActionBookingId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Bookings</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Review and approve customer consultation bookings
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
            {success}
          </div>
        )}

        <div className="flex flex-wrap gap-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="min-w-[12rem] flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Filter by status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => handleFilterChange(e.target.value)}
              className="w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          {statusFilter && (
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => handleFilterChange('')}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Clear filter
              </button>
            </div>
          )}
        </div>

        {loading && bookings.length === 0 ? (
          <div className="text-center text-gray-600 dark:text-gray-400">Loading bookings…</div>
        ) : (
          <>
            <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Lawyer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Slot
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Meeting
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                    {bookings.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
                        >
                          No bookings found
                        </td>
                      </tr>
                    ) : (
                      bookings.map((booking) => {
                        const isBusy = actionBookingId === booking.id;
                        return (
                          <tr key={booking.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                            <td className="px-6 py-4 text-sm">
                              {booking.customer?.id ? (
                                <Link
                                  href={`/customers/${booking.customer.id}`}
                                  className="group block rounded-md -mx-1 px-1 py-0.5 transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                >
                                  <div className="font-medium text-gray-900 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">
                                    {booking.customer.name || 'N/A'}
                                  </div>
                                  {booking.customer.email && (
                                    <div className="text-gray-500 group-hover:text-blue-600 dark:text-gray-400 dark:group-hover:text-blue-400">
                                      {booking.customer.email}
                                    </div>
                                  )}
                                </Link>
                              ) : (
                                <>
                                  <div className="font-medium text-gray-900 dark:text-white">
                                    {booking.customer?.name || 'N/A'}
                                  </div>
                                  {booking.customer?.email && (
                                    <div className="text-gray-500 dark:text-gray-400">
                                      {booking.customer.email}
                                    </div>
                                  )}
                                </>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-white">
                              {booking.lawyerEmail}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                              {formatBookingSlot(booking.start, booking.end, booking.timezone)}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getBookingStatusClasses(booking.status)}`}
                              >
                                {booking.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm">
                              {booking.meet_url ? (
                                isBookingPast(booking.end, booking.timezone) ? (
                                  <span
                                    title="Past meetings can no longer be joined"
                                    className="cursor-not-allowed text-gray-400 dark:text-gray-500"
                                  >
                                    Join
                                  </span>
                                ) : (
                                  <a
                                    href={booking.meet_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                  >
                                    Join
                                  </a>
                                )
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500">—</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm">
                              <BookingActionsMenu
                                booking={booking}
                                isBusy={isBusy}
                                openActionsMenuId={openActionsMenuId}
                                setOpenActionsMenuId={setOpenActionsMenuId}
                                actionsMenuRef={actionsMenuRef}
                                onConfirm={handleConfirm}
                                onReject={openRejectModal}
                                onReschedule={openRescheduleModal}
                                onCancel={handleCancel}
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {hasNext && (
              <button
                type="button"
                onClick={() => loadBookings(true)}
                disabled={loading}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {loading ? 'Loading…' : 'Load more'}
              </button>
            )}
          </>
        )}
      </div>

      {showRejectModal && rejectTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeRejectModal}
        >
          <div
            className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Reject booking
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {rejectTarget.customer?.name || 'Customer'} ·{' '}
              {formatBookingSlot(rejectTarget.start, rejectTarget.end, rejectTarget.timezone)}
            </p>
            <form onSubmit={handleReject} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="reject-note"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Reason for rejection *
                </label>
                <textarea
                  id="reject-note"
                  required
                  rows={4}
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Explain why this slot cannot be accepted…"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeRejectModal}
                  disabled={actionBookingId === rejectTarget.id}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionBookingId === rejectTarget.id}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-500 dark:hover:bg-red-600"
                >
                  {actionBookingId === rejectTarget.id ? 'Rejecting…' : 'Reject booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRescheduleModal && rescheduleTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeRescheduleModal}
        >
          <div
            className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Reschedule booking
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {rescheduleTarget.customer?.name || 'Customer'} · current slot{' '}
              {formatBookingSlot(
                rescheduleTarget.start,
                rescheduleTarget.end,
                rescheduleTarget.timezone
              )}
            </p>
            <form onSubmit={handleReschedule} className="mt-4 space-y-4">
              <div>
                <span
                  id="reschedule-start-label"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  New start *
                </span>
                <input
                  id="reschedule-start"
                  type="datetime-local"
                  required
                  aria-labelledby="reschedule-start-label"
                  value={rescheduleForm.new_start}
                  onClick={(e) => openDatetimePicker(e.currentTarget, e)}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    setRescheduleForm((f) => ({
                      ...f,
                      new_start: newStart,
                      new_end: syncRescheduleEnd(newStart, f.new_end, f.timezone),
                    }));
                  }}
                  className="mt-1 block w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                />
              </div>
              <div>
                <span
                  id="reschedule-end-label"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  New end *
                </span>
                <input
                  id="reschedule-end"
                  type="datetime-local"
                  required
                  aria-labelledby="reschedule-end-label"
                  min={rescheduleForm.new_start || undefined}
                  value={rescheduleForm.new_end}
                  onClick={(e) => openDatetimePicker(e.currentTarget, e)}
                  onChange={(e) =>
                    setRescheduleForm((f) => ({ ...f, new_end: e.target.value }))
                  }
                  className="mt-1 block w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                />
              </div>
              <div>
                <label
                  htmlFor="reschedule-timezone"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Timezone *
                </label>
                <select
                  id="reschedule-timezone"
                  required
                  value={rescheduleForm.timezone}
                  onChange={(e) => {
                    const newTimezone = e.target.value;
                    setRescheduleForm((f) => {
                      const prevTimezone = f.timezone.trim();
                      if (
                        !prevTimezone ||
                        !f.new_start ||
                        !f.new_end ||
                        prevTimezone === newTimezone
                      ) {
                        return { ...f, timezone: newTimezone };
                      }
                      const startMs = zonedDatetimeToUtcMs(f.new_start, prevTimezone);
                      const endMs = zonedDatetimeToUtcMs(f.new_end, prevTimezone);
                      if (startMs == null || endMs == null) {
                        return { ...f, timezone: newTimezone };
                      }
                      const newStart = utcMsToDatetimeLocal(startMs, newTimezone);
                      const newEnd = utcMsToDatetimeLocal(endMs, newTimezone);
                      return {
                        ...f,
                        timezone: newTimezone,
                        new_start: newStart,
                        new_end: syncRescheduleEnd(newStart, newEnd, newTimezone),
                      };
                    });
                  }}
                  className={selectFieldClass}
                >
                  <option value="">Select timezone</option>
                  {rescheduleTimezoneOptions.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="reschedule-proposed-by"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Proposed by
                </label>
                <input
                  id="reschedule-proposed-by"
                  type="text"
                  disabled
                  value={rescheduleForm.proposed_by}
                  className="mt-1 w-full cursor-not-allowed rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600 shadow-sm dark:border-gray-600 dark:bg-gray-800/60 dark:text-gray-400"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeRescheduleModal}
                  disabled={actionBookingId === rescheduleTarget.id}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={actionBookingId === rescheduleTarget.id}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  {actionBookingId === rescheduleTarget.id ? 'Saving…' : 'Reschedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

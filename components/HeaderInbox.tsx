'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { customerService, notificationService } from '@/lib/api/services';
import type { AppNotification } from '@/lib/api/types';

type InboxTab = 'notifications' | 'messages';

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function InboxIconButton({
  count,
  onClick,
  label,
  children,
}: {
  count: number;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="relative rounded-full p-2 text-gray-600 outline-none ring-blue-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
    >
      {children}
      {count > 0 ? (
        <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-none text-white">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </button>
  );
}

function InboxTabButton({
  label,
  count,
  active,
  onClick,
  icon,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
          : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
      }`}
    >
      {icon}
      <span>{label}</span>
      {count > 0 ? (
        <span
          className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${
            active ? 'bg-blue-600 text-white dark:bg-blue-500' : 'bg-rose-500 text-white'
          }`}
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </button>
  );
}

function NotificationRow({
  notification,
  onMarkRead,
}: {
  notification: AppNotification;
  onMarkRead: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`px-4 py-3 ${notification.hasBeenRead ? '' : 'bg-blue-50/60 dark:bg-blue-900/10'}`}
    >
      <button
        type="button"
        className="flex w-full items-start gap-2 text-left"
        onClick={() => {
          setExpanded((v) => !v);
          if (!notification.hasBeenRead) {
            onMarkRead(notification.id);
          }
        }}
      >
        {!notification.hasBeenRead ? (
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600 dark:bg-blue-400" />
        ) : (
          <span className="mt-2 h-1.5 w-1.5 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div
            className={`text-sm ${notification.hasBeenRead ? 'font-medium text-gray-900 dark:text-white' : 'font-semibold text-gray-900 dark:text-white'}`}
          >
            {notification.header}
          </div>
          <div
            className={`mt-0.5 text-sm text-gray-600 dark:text-gray-300 ${expanded ? 'whitespace-pre-wrap' : 'line-clamp-1'}`}
          >
            {notification.content}
          </div>
          <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            {formatRelativeTime(notification.created)}
          </div>
        </div>
        <span className="shrink-0 text-xs text-gray-400">{expanded ? '−' : '+'}</span>
      </button>
    </div>
  );
}

export function HeaderInbox() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<InboxTab>('notifications');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    const email = session?.user?.email?.trim();
    if (!email) return;
    setLoadingNotifications(true);
    try {
      const searchRes = await customerService.search(email, { limit: 5 });
      const match =
        searchRes.data?.find(
          (c) => c.emailAddress?.toLowerCase() === email.toLowerCase()
        ) ?? searchRes.data?.[0];
      if (!match?.id) {
        setCustomerId(null);
        setNotifications([]);
        return;
      }
      setCustomerId(match.id);
      const listRes = await notificationService.listForCustomer(match.id);
      setNotifications(Array.isArray(listRes.data) ? listRes.data : []);
    } catch {
      setNotifications([]);
    } finally {
      setLoadingNotifications(false);
    }
  }, [session?.user?.email]);

  useEffect(() => {
    if (open) {
      loadNotifications();
    }
  }, [open, loadNotifications]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const notificationUnread = notifications.filter((n) => !n.hasBeenRead).length;
  const messageUnread: number = 0;

  const openOn = (tab: InboxTab) => {
    setActiveTab(tab);
    setOpen(true);
  };

  const handleMarkRead = async (notificationId: string) => {
    if (!customerId) return;
    try {
      await notificationService.markRead(customerId, notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, hasBeenRead: true } : n))
      );
    } catch {
      /* ignore */
    }
  };

  const bellIcon = (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  );

  const chatIcon = (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
    </svg>
  );

  return (
    <div className="relative inline-flex items-center gap-0.5" ref={containerRef}>
      <InboxIconButton
        count={notificationUnread}
        onClick={() => openOn('notifications')}
        label="Open notifications"
      >
        {bellIcon}
      </InboxIconButton>
      <InboxIconButton
        count={messageUnread}
        onClick={() => openOn('messages')}
        label="Open messages"
      >
        {chatIcon}
      </InboxIconButton>

      {open ? (
        <div
          role="dialog"
          aria-label="Inbox"
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-full flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 sm:w-[420px] lg:w-[600px]"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">Inbox</div>
              <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {notificationUnread} unread{' '}
                {notificationUnread === 1 ? 'notification' : 'notifications'}
                {' · '}
                {messageUnread} new {messageUnread === 1 ? 'message' : 'messages'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close inbox"
              className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="border-b border-gray-100 px-5 pt-3 dark:border-gray-800">
            <div className="flex items-center gap-1">
              <InboxTabButton
                label="Notifications"
                count={notificationUnread}
                active={activeTab === 'notifications'}
                onClick={() => setActiveTab('notifications')}
                icon={
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                  </svg>
                }
              />
              <InboxTabButton
                label="Messages"
                count={messageUnread}
                active={activeTab === 'messages'}
                onClick={() => setActiveTab('messages')}
                icon={
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                  </svg>
                }
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === 'notifications' ? (
              loadingNotifications ? (
                <div className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">
                  Loading notifications…
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center p-10 text-center text-gray-400">
                  {bellIcon}
                  <div className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                    You&apos;re all caught up
                  </div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    New notifications will appear here.
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {notifications.map((n) => (
                    <NotificationRow key={n.id} notification={n} onMarkRead={handleMarkRead} />
                  ))}
                </div>
              )
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-10 text-center text-gray-500">
                {chatIcon}
                <div className="mt-3 text-sm font-medium text-gray-900 dark:text-white">
                  No new messages
                </div>
                <div className="mt-1 max-w-[260px] text-xs text-gray-500 dark:text-gray-400">
                  Threads with customers live on each service request.
                </div>
                <Link
                  href="/service-requests"
                  onClick={() => setOpen(false)}
                  className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  View service requests
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
                  </svg>
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

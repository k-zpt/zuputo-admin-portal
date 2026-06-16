'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ThemeToggle } from './ThemeToggle';

interface MenuItem {
  name: string;
  href?: string;
  icon: string;
  children?: MenuItem[];
  /** When true, also active for paths under `href/` (e.g. /forms/[id]). */
  matchPrefix?: boolean;
}

const menuItems: MenuItem[] = [
  { name: 'Customers', href: '/customers', icon: '👥' },
  { name: 'Service Requests', href: '/service-requests', icon: '📋' },
  { name: 'Bookings', href: '/scheduling/bookings', icon: '📅' },
  {
    name: 'Catalog',
    icon: '📚',
    children: [
      { name: 'Countries', href: '/countries', icon: '🌍' },
      { name: 'Currencies', href: '/currencies', icon: '💰' },
      { name: 'Forms', href: '/forms', icon: '📝', matchPrefix: true },
    ],
  },
  {
    name: 'System',
    icon: '🎛️',
    children: [
      { name: 'Config', href: '/config', icon: '⚙️' },
      { name: 'Background Jobs', href: '/system/jobs', icon: '⏱️' },
      { name: 'Message Templates', href: '/message-templates', icon: '📧' },
    ],
  },
  {
    name: 'Commercial',
    icon: '💼',
    children: [
      { name: 'Transactions', href: '/transactions', icon: '💳' },
      { name: 'Payment Links', href: '/payment-links', icon: '🔗' },
      { name: 'Subscription Plans', href: '/subscription-plans', icon: '📦' },
      { name: 'Discount Programs', href: '/discount-programs', icon: '🎫' },
    ],
  },
  { name: 'Blog', href: '/blog', icon: '📰' },
];

export function Sidebar() {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    const expanded: string[] = [];
    if (
      pathname === '/config' ||
      pathname === '/message-templates' ||
      pathname.startsWith('/system/')
    ) {
      expanded.push('System');
    }
    if (
      pathname === '/countries' ||
      pathname === '/currencies' ||
      pathname === '/forms' ||
      pathname.startsWith('/forms/')
    ) {
      expanded.push('Catalog');
    }
    if (
      pathname === '/transactions' ||
      pathname === '/payment-links' ||
      pathname === '/discount-programs' ||
      pathname === '/subscription-plans' ||
      pathname.startsWith('/subscription-plans')
    ) {
      expanded.push('Commercial');
    }
    return expanded;
  });

  const pathMatchesItem = (pathname: string, item: MenuItem): boolean => {
    if (!item.href) return false;
    if (item.matchPrefix) {
      return pathname === item.href || pathname.startsWith(`${item.href}/`);
    }
    return pathname === item.href;
  };

  const toggleExpand = (itemName: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemName)
        ? prev.filter((name) => name !== itemName)
        : [...prev, itemName]
    );
  };

  const isItemActive = (item: MenuItem): boolean => {
    if (item.href) {
      return pathMatchesItem(pathname, item);
    }
    if (item.children) {
      return item.children.some((child) => isItemActive(child));
    }
    return false;
  };

  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    const isActive = isItemActive(item);
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.name);

    if (hasChildren) {
      return (
        <div key={item.name}>
          <button
            onClick={() => toggleExpand(item.name)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
                : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{item.icon}</span>
              <span>{item.name}</span>
            </div>
            <svg
              className={`h-4 w-4 transition-transform ${
                isExpanded ? 'rotate-90' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
          {isExpanded && (
            <div className="ml-4 mt-1 space-y-1 border-l border-gray-200 pl-2 dark:border-gray-700">
              {item.children!.map((child) => renderMenuItem(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href!}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
            : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
        }`}
      >
        <span className="text-lg">{item.icon}</span>
        <span>{item.name}</span>
      </Link>
    );
  };

  return (
    <div className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex h-16 items-center justify-between border-b border-gray-200 px-6 dark:border-gray-800">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Admin Portal
        </h1>
        <ThemeToggle />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {menuItems.map((item) => renderMenuItem(item))}
      </nav>
    </div>
  );
}

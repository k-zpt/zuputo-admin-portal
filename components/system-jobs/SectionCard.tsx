import type { ReactNode } from 'react';

export function SectionCard({
  title,
  description,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-gray-200/80 bg-white/80 shadow-sm backdrop-blur-sm dark:border-gray-700/80 dark:bg-gray-900/80 ${className}`}
    >
      <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-800">
        <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</p>
        ) : null}
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

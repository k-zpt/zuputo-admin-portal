import { AdminLayout } from "@/components/AdminLayout";

export default function Home() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Welcome to the admin portal. Use the sidebar to navigate to different sections.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Quick Stats
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Overview of key metrics and statistics
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Activity
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Latest actions and updates
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              System Status
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Current system health and status
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

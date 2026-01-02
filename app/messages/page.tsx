import { AdminLayout } from "@/components/AdminLayout";

export default function MessagesPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Messages
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Review and manage messages
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-gray-600 dark:text-gray-400">
            Messages interface coming soon...
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}


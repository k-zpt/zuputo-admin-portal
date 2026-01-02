'use client';

import { AdminLayout } from "@/components/AdminLayout";
import { customerService } from "@/lib/api/services";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Customer, ApiResponse } from "@/lib/api/types";

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);

  const loadCustomers = async (query?: string) => {
    try {
      setLoading(true);
      setError(null);
      const response: ApiResponse<Customer[]> = query
        ? await customerService.search(query, { cursor: cursor || undefined, limit: 20 })
        : await customerService.list({ cursor: cursor || undefined, limit: 20 });
      
      setCustomers(response.data);
      setCursor(response.pagination?.nextCursor || null);
      setHasNext(response.pagination?.hasNext || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCursor(null);
    loadCustomers(searchQuery);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Customers
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Manage and review customer information
            </p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Search
          </button>
        </form>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-600 dark:text-gray-400">Loading...</div>
        ) : (
          <>
            <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                    {customers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                          No customers found
                        </td>
                      </tr>
                    ) : (
                      customers.map((customer) => (
                        <tr 
                          key={customer.id} 
                          className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                          onClick={() => router.push(`/customers/${customer.id}`)}
                        >
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-white">
                            {[customer.firstName, customer.otherNames, customer.lastName]
                              .filter(Boolean)
                              .join(' ') || 'N/A'}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {customer.emailAddress || 'N/A'}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {customer.type}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {customer.status}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {hasNext && (
              <button
                onClick={() => loadCustomers(searchQuery)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Load More
              </button>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}

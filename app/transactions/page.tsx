'use client';

import { AdminLayout } from "@/components/AdminLayout";
import { transactionService } from "@/lib/api/services";
import { useState, useEffect } from "react";
import type { Transaction, ApiResponse } from "@/lib/api/types";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadTransactions();
  }, [statusFilter]);

  const loadTransactions = async (append = false) => {
    try {
      setLoading(true);
      setError(null);
      const response: ApiResponse<Transaction[]> = await transactionService.list({ 
        cursor: append ? cursor || undefined : undefined, 
        limit: 20,
        status: statusFilter || undefined,
      });
      
      if (append) {
        setTransactions(prev => [...prev, ...response.data]);
      } else {
        setTransactions(response.data);
        setCursor(null); // Reset cursor when filters change
      }
      
      setCursor(response.pagination?.nextCursor || null);
      setHasNext(response.pagination?.hasNext || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (value: string) => {
    setStatusFilter(value);
    setCursor(null); // Reset pagination when filters change
  };

  const clearFilters = () => {
    setStatusFilter('');
    setCursor(null);
  };

  const formatCustomerName = (customer: Transaction['customer']): string => {
    const parts = [customer.firstName, customer.otherNames, customer.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : customer.emailAddress || 'Unknown';
  };

  const getStatusColor = (status: string): string => {
    switch (status.toUpperCase()) {
      case 'SUCCESSFUL':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200';
      case 'FAILED':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200';
    }
  };

  const formatAmount = (amount: string): string => {
    const num = parseFloat(amount);
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Transactions
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            View and manage all transactions
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="flex gap-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Filter by Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => handleFilterChange(e.target.value)}
              className="w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="FAILED">FAILED</option>
              <option value="SUCCESSFUL">SUCCESSFUL</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="UNKNOWN">UNKNOWN</option>
            </select>
          </div>
          {statusFilter && (
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Clear Filter
              </button>
            </div>
          )}
        </div>

        {loading && transactions.length === 0 ? (
          <div className="text-center text-gray-600 dark:text-gray-400">Loading...</div>
        ) : (
          <>
            <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Payment Reference
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Provider Reference
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Narration
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                          No transactions found
                        </td>
                      </tr>
                    ) : (
                      transactions.map((transaction) => (
                        <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-gray-900 dark:text-white">
                            {transaction.id.slice(0, 8)}...
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                            <div>
                              <div className="font-medium">{formatCustomerName(transaction.customer)}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {transaction.customer.emailAddress}
                              </div>
                              {transaction.customer.country && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {transaction.customer.country.name}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">
                            {formatAmount(transaction.amount)}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm">
                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(transaction.status)}`}>
                              {transaction.status}
                            </span>
                            {transaction.statusDescription && (
                              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {transaction.statusDescription}
                              </div>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {transaction.type}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-gray-600 dark:text-gray-400">
                            {transaction.paymentReference}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-gray-600 dark:text-gray-400">
                            {transaction.providerReference}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {transaction.narration || '—'}
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
                onClick={() => loadTransactions(true)}
                disabled={loading}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}

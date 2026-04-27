'use client';

import { AdminLayout } from "@/components/AdminLayout";
import { formService } from "@/lib/api/services";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Form, ApiResponse } from "@/lib/api/types";

const FORMS_LIST_TIMEOUT_MS = 60_000;

export default function FormsPage() {
  const router = useRouter();
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const listRequestIdRef = useRef(0);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => window.clearTimeout(id);
  }, [searchQuery]);

  useEffect(() => {
    const requestId = ++listRequestIdRef.current;

    const loadForms = async () => {
      try {
        setLoading(true);
        setError(null);
        const response: ApiResponse<Form[]> = await Promise.race([
          formService.list({
            q: debouncedSearch || undefined,
            featured: featuredOnly || undefined,
            limit: 100,
          }),
          new Promise<ApiResponse<Form[]>>((_, reject) =>
            window.setTimeout(
              () => reject(new Error('FORMS_LIST_TIMEOUT')),
              FORMS_LIST_TIMEOUT_MS
            )
          ),
        ]);
        if (requestId !== listRequestIdRef.current) return;
        const data = response?.data;
        setForms(Array.isArray(data) ? data : []);
      } catch (err) {
        if (requestId !== listRequestIdRef.current) return;
        if (err instanceof Error && err.message === 'FORMS_LIST_TIMEOUT') {
          setError(
            'Request timed out. Check that the backend is running and NEXT_PUBLIC_API_BASE_URL is correct.'
          );
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load forms');
        }
        setForms([]);
      } finally {
        if (requestId === listRequestIdRef.current) setLoading(false);
      }
    };

    loadForms();
  }, [debouncedSearch, featuredOnly]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Forms
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Manage and configure forms
            </p>
          </div>
          <button
            onClick={() => router.push('/forms/new')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            + Create Form
          </button>
        </div>

        <div className="flex gap-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search forms..."
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <label className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-800">
            <input
              type="checkbox"
              checked={featuredOnly}
              onChange={(e) => setFeaturedOnly(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Featured only</span>
          </label>
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-600 dark:text-gray-400">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {forms.length === 0 ? (
              <div className="col-span-full text-center text-gray-500 dark:text-gray-400">
                No forms found
              </div>
            ) : (
              forms.map((form) => (
                <div
                  key={form.id}
                  onClick={() => router.push(`/forms/${form.id}`)}
                  className="cursor-pointer rounded-lg border border-gray-200 bg-white p-6 transition-all hover:border-blue-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-600"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {form.label || form.name}
                      </h3>
                      {form.description && (
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                          {form.description}
                        </p>
                      )}
                    </div>
                    {form.featured && (
                      <span className="ml-2 rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                        Featured
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

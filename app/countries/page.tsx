'use client';

import { AdminLayout } from "@/components/AdminLayout";
import { countryService, currencyService } from "@/lib/api/services";
import { useState, useEffect } from "react";
import type { Country, Currency, ApiResponse } from "@/lib/api/types";

export default function CountriesPage() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCountryId, setEditingCountryId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    currencies: [] as string[], // Array of currency IDs
    defaultCurrency: '',
  });

  useEffect(() => {
    loadCountries();
  }, []);

  useEffect(() => {
    if (showCreateForm || editingCountryId) {
      loadCurrencies();
    }
  }, [showCreateForm, editingCountryId]);

  const loadCountries = async () => {
    try {
      setLoading(true);
      setError(null);
      const response: ApiResponse<Country[]> = await countryService.list({ limit: 100 });
      setCountries(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load countries');
    } finally {
      setLoading(false);
    }
  };

  const loadCurrencies = async () => {
    try {
      setLoadingCurrencies(true);
      const response: ApiResponse<Currency[]> = await currencyService.list({ limit: 100 });
      setCurrencies(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load currencies');
    } finally {
      setLoadingCurrencies(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      setSuccess(null);
      // Convert currency codes to IDs
      const currencyIds = formData.currencies.map(code => {
        const currency = currencies.find(c => c.code === code);
        return currency?.id || code;
      });
      const defaultCurrencyId = formData.defaultCurrency 
        ? currencies.find(c => c.code === formData.defaultCurrency)?.id || formData.defaultCurrency
        : undefined;
      
      const payload = {
        name: formData.name,
        code: formData.code,
        currencies: currencyIds,
        defaultCurrency: defaultCurrencyId,
      };
      await countryService.create(payload);
      setShowCreateForm(false);
      setFormData({ name: '', code: '', currencies: [], defaultCurrency: '' });
      setSuccess('Country created successfully!');
      loadCountries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create country');
    }
  };

  const handleEdit = (country: Country) => {
    // Convert Currency objects to IDs
    const currencyIds = country.currencies.map(c => c.id);
    const defaultCurrencyId = country.defaultCurrency?.id || '';
    
    setFormData({
      name: country.name,
      code: country.code,
      currencies: currencyIds,
      defaultCurrency: defaultCurrencyId,
    });
    setEditingCountryId(country.id);
    setShowCreateForm(false);
    setError(null);
    setSuccess(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCountryId) return;
    
    try {
      setError(null);
      setSuccess(null);
      
      // Build update payload with only changed fields
      const country = countries.find(c => c.id === editingCountryId);
      if (!country) return;
      
      const payload: any = {};
      
      if (formData.name !== country.name) {
        payload.name = formData.name;
      }
      if (formData.code !== country.code) {
        payload.code = formData.code;
      }
      
      // Compare currencies (convert current to IDs for comparison)
      const currentCurrencyIds = country.currencies.map(c => c.id).sort();
      const newCurrencyIds = formData.currencies.sort();
      if (JSON.stringify(currentCurrencyIds) !== JSON.stringify(newCurrencyIds)) {
        payload.currencies = formData.currencies;
      }
      
      // Compare default currency
      const currentDefaultCurrencyId = country.defaultCurrency?.id || '';
      if (formData.defaultCurrency !== currentDefaultCurrencyId) {
        payload.defaultCurrency = formData.defaultCurrency || undefined;
      }
      
      await countryService.update(editingCountryId, payload);
      setEditingCountryId(null);
      setFormData({ name: '', code: '', currencies: [], defaultCurrency: '' });
      setSuccess('Country updated successfully!');
      loadCountries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update country');
    }
  };

  const handleCancel = () => {
    setShowCreateForm(false);
    setEditingCountryId(null);
    setFormData({ name: '', code: '', currencies: [], defaultCurrency: '' });
    setError(null);
    setSuccess(null);
  };

  const handleCurrencyChange = (currencyId: string, checked: boolean) => {
    if (checked) {
      setFormData({
        ...formData,
        currencies: [...formData.currencies, currencyId],
      });
    } else {
      setFormData({
        ...formData,
        currencies: formData.currencies.filter(c => c !== currencyId),
        // Clear default currency if it was removed
        defaultCurrency: formData.defaultCurrency === currencyId ? '' : formData.defaultCurrency,
      });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Countries
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Configure and manage countries
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {showCreateForm ? 'Cancel' : 'Create Country'}
          </button>
        </div>

        {(showCreateForm || editingCountryId) && (
          <form onSubmit={editingCountryId ? handleUpdate : handleCreate} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingCountryId ? 'Edit Country' : 'Create Country'}
              </h2>
              <button
                type="button"
                onClick={handleCancel}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Code (ISO 3166 Alpha-2) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={2}
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Currencies *
                </label>
                {loadingCurrencies ? (
                  <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">Loading currencies...</div>
                ) : (
                  <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-300 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
                    {currencies.length === 0 ? (
                      <div className="text-sm text-gray-500 dark:text-gray-400">No currencies available</div>
                    ) : (
                      <div className="space-y-2">
                        {currencies.map((currency) => (
                          <label
                            key={currency.id}
                            className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={formData.currencies.includes(currency.id)}
                              onChange={(e) => handleCurrencyChange(currency.id, e.target.checked)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                            />
                            <span className="text-sm text-gray-900 dark:text-white">
                              {currency.label} ({currency.code})
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {formData.currencies.length > 0 && (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Selected: {formData.currencies.map(id => {
                      const currency = currencies.find(c => c.id === id);
                      return currency ? `${currency.label} (${currency.code})` : id;
                    }).join(', ')}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Default Currency
                </label>
                <select
                  value={formData.defaultCurrency}
                  onChange={(e) => setFormData({ ...formData, defaultCurrency: e.target.value })}
                  disabled={formData.currencies.length === 0}
                  className="mt-1 w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400 dark:disabled:bg-gray-900 dark:disabled:text-gray-400"
                >
                  <option value="">
                    {formData.currencies.length === 0 ? 'Select currencies first' : 'Select a currency'}
                  </option>
                  {formData.currencies.map((id) => {
                    const currency = currencies.find(c => c.id === id);
                    return currency ? (
                      <option key={id} value={id}>
                        {currency.label} ({currency.code})
                      </option>
                    ) : null;
                  })}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formData.currencies.length === 0}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                {editingCountryId ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        )}

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

        {loading ? (
          <div className="text-center text-gray-600 dark:text-gray-400">Loading...</div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Currencies
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Default Currency
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                  {countries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                        No countries found
                      </td>
                    </tr>
                  ) : (
                    countries.map((country) => (
                      <tr key={country.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                          {country.name}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {country.code}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {country.currencies && country.currencies.length > 0
                            ? country.currencies.map(c => c.code || c.label || c.name || 'N/A').join(', ')
                            : 'N/A'}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {country.defaultCurrency
                            ? country.defaultCurrency.code || country.defaultCurrency.label || country.defaultCurrency.name || 'N/A'
                            : 'N/A'}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm">
                          <button
                            onClick={() => handleEdit(country)}
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

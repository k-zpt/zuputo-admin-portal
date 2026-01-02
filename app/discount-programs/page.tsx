'use client';

import { AdminLayout } from "@/components/AdminLayout";
import { discountProgramService, countryService, customerService } from "@/lib/api/services";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ApiResponse, DiscountProgram, CreateDiscountProgramPayload, UpdateDiscountProgramPayload, Country, Customer } from "@/lib/api/types";

export default function DiscountProgramsPage() {
  const router = useRouter();
  const [discountPrograms, setDiscountPrograms] = useState<DiscountProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState<DiscountProgram | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  
  // Form state
  const [formData, setFormData] = useState<CreateDiscountProgramPayload | UpdateDiscountProgramPayload>({
    code: '',
    type: 'SUBSIDY',
    name: '',
    description: '',
    config: {
      strategy: 'PERCENTAGE',
      value: 0,
    },
    perCustomerAvailLimit: 1,
    totalCustomerAvailLimit: 1,
    validUntil: undefined,
  });

  useEffect(() => {
    loadDiscountPrograms();
    loadCountries();
  }, []);

  // Load customers when creating/editing referral programs
  useEffect(() => {
    if (showCreateModal || editingProgram) {
      loadCustomers();
    }
  }, [showCreateModal, editingProgram]);

  // Close customer dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
    };

    if (isCustomerDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isCustomerDropdownOpen]);

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      loadDiscountPrograms();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadDiscountPrograms = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: { q?: string } = {};
      if (searchQuery.trim()) {
        params.q = searchQuery.trim();
      }
      const response: ApiResponse<DiscountProgram[]> = await discountProgramService.list(params);
      setDiscountPrograms(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load discount programs');
    } finally {
      setLoading(false);
    }
  };

  const loadCountries = async () => {
    try {
      const response: ApiResponse<Country[]> = await countryService.list({ limit: 100 });
      setCountries(response.data);
    } catch (err) {
      console.error('Failed to load countries:', err);
    }
  };

  const loadCustomers = async () => {
    try {
      const response: ApiResponse<Customer[]> = await customerService.list({ limit: 100 });
      setCustomers(response.data);
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  };

  const handleCreate = async () => {
    try {
      setError(null);
      if ((formData as any).validUntil) {
        const d = parseValidUntilDate((formData as any).validUntil);
        if (!d) {
          setError('Valid Until is not a valid date.');
          return;
        }
        if (d.getTime() < Date.now()) {
          setError('Valid Until cannot be in the past.');
          return;
        }
      }
      await discountProgramService.create(formData as CreateDiscountProgramPayload);
      setShowCreateModal(false);
      resetForm();
      loadDiscountPrograms();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create discount program');
    }
  };

  const handleUpdate = async () => {
    if (!editingProgram) return;
    
    try {
      setError(null);
      if ((formData as any).validUntil) {
        const d = parseValidUntilDate((formData as any).validUntil);
        if (!d) {
          setError('Valid Until is not a valid date.');
          return;
        }
        const unchanged = String((formData as any).validUntil) === String(editingProgram.validUntil || '');
        if (!unchanged && d.getTime() < Date.now()) {
          setError('Valid Until cannot be in the past.');
          return;
        }
      }
      await discountProgramService.update(editingProgram.id, formData as UpdateDiscountProgramPayload);
      setEditingProgram(null);
      resetForm();
      loadDiscountPrograms();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update discount program');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      type: 'SUBSIDY',
      name: '',
      description: '',
      config: {
        strategy: 'PERCENTAGE',
        value: 0,
      },
      perCustomerAvailLimit: 1,
      totalCustomerAvailLimit: 1,
      validUntil: undefined,
    });
    setCustomerSearchTerm('');
    setIsCustomerDropdownOpen(false);
  };

  const startEdit = (program: DiscountProgram) => {
    setEditingProgram(program);
    setFormData({
      name: program.name,
      description: program.description || '',
      applicableCountries: program.applicableCountries,
      isActive: program.isActive,
      validUntil: program.validUntil,
      perCustomerAvailLimit: program.perCustomerAvailLimit,
      totalCustomerAvailLimit: program.totalCustomerAvailLimit,
    });
    // Reset customer search when editing
    setCustomerSearchTerm('');
    setIsCustomerDropdownOpen(false);
  };

  const cancelEdit = () => {
    setEditingProgram(null);
    resetForm();
  };

  const updateConfig = (updates: Partial<CreateDiscountProgramPayload['config']>) => {
    setFormData(prev => {
      const currentConfig = (prev as any).config || {};
      return {
        ...prev,
        config: {
          ...currentConfig,
          ...updates,
        },
      } as CreateDiscountProgramPayload | UpdateDiscountProgramPayload;
    });
  };

  const updateReferrerConfig = (updates: Partial<{ id: string; commission: { strategy: string; value: number } }>) => {
    setFormData(prev => {
      const config = (prev as any).config || {};
      return {
        ...prev,
        config: {
          ...config,
          referrer: {
            ...config.referrer,
            ...updates,
            commission: {
              ...config.referrer?.commission,
              ...updates.commission,
            },
          },
        },
      } as CreateDiscountProgramPayload | UpdateDiscountProgramPayload;
    });
  };

  const updateCustomerConfig = (updates: Partial<{ commission: { strategy: string; value: number } }>) => {
    setFormData(prev => {
      const config = (prev as any).config || {};
      return {
        ...prev,
        config: {
          ...config,
          customer: {
            ...config.customer,
            commission: {
              ...config.customer?.commission,
              ...updates.commission,
            },
          },
        },
      } as CreateDiscountProgramPayload | UpdateDiscountProgramPayload;
    });
  };

  // Customer lookup helpers
  const filteredCustomers = customers.filter((customer) => {
    if (!customerSearchTerm) return true;
    const searchLower = customerSearchTerm.toLowerCase();
    const name = [customer.firstName, customer.otherNames, customer.lastName]
      .filter(Boolean)
      .join(' ') || '';
    const email = customer.emailAddress || '';
    return name.toLowerCase().includes(searchLower) || email.toLowerCase().includes(searchLower);
  });

  const getSelectedCustomerName = () => {
    const referrerId = ((formData as any).config as any)?.referrer?.id;
    if (!referrerId) return '';
    const customer = customers.find(c => c.id === referrerId);
    if (!customer) return '';
    const name = [customer.firstName, customer.otherNames, customer.lastName]
      .filter(Boolean)
      .join(' ') || customer.emailAddress || 'Unknown';
    return customer.emailAddress ? `${name} (${customer.emailAddress})` : name;
  };

  // Helpers for datetime picker (API displays a human-readable string, but we need a Date for picker + validation)
  const parseValidUntilDate = (value?: string | null) => {
    if (!value) return null;

    // ISO / RFC-like strings
    const d1 = new Date(value);
    if (!Number.isNaN(d1.getTime())) return d1;

    // dd/mm/yyyy[, ]hh:mm[:ss]
    const match = String(value).trim().match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s*,\s*|\s+)?(\d{1,2}):(\d{2})(?::(\d{2}))?$/
    );
    if (!match) return null;

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const hour = Number(match[4] ?? 0);
    const minute = Number(match[5] ?? 0);
    const second = Number(match[6] ?? 0);
    const d2 = new Date(year, month - 1, day, hour, minute, second);
    return Number.isNaN(d2.getTime()) ? null : d2;
  };

  const pad2 = (n: number) => String(n).padStart(2, '0');

  const toDatetimeLocalValue = (value?: string | null) => {
    const d = parseValidUntilDate(value);
    if (!d) return '';
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };

  const nowDatetimeLocalMin = () => {
    const d = new Date();
    d.setSeconds(0, 0);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };

  const displayValidUntil = (value?: string | null) => {
    // API already provides a human-readable string (e.g. "26/12/2025, 22:49:00")
    return value && String(value).trim() ? String(value) : 'No expiry';
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Discount Programs</h1>
          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            + Create Discount Program
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        )}

        {/* Search */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <input
            type="text"
            placeholder="Search by name, code, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
          />
        </div>

        {/* Discount Programs List */}
        {loading ? (
          <div className="text-center text-gray-600 dark:text-gray-400">Loading discount programs...</div>
        ) : discountPrograms.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400">No discount programs found</div>
        ) : (
          <div className="space-y-4">
            {discountPrograms.map((program) => (
              <div
                key={program.id}
                className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {program.name}
                      </h3>
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                        program.type === 'SUBSIDY'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                      }`}>
                        {program.type}
                      </span>
                      {program.isActive !== undefined && (
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                          program.isActive
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                        }`}>
                          {program.isActive ? 'Active' : 'Inactive'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      <span className="font-medium">Code:</span> {program.code}
                    </p>
                    {program.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {program.description}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Configuration</p>
                        {program.type === 'SUBSIDY' ? (
                          <p className="text-sm text-gray-900 dark:text-white">
                            {(program.config as any).strategy}: {(program.config as any).value}
                            {(program.config as any).strategy === 'PERCENTAGE' ? '%' : ''}
                          </p>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-sm text-gray-900 dark:text-white">
                              Referrer: {(program.config as any).referrer?.commission?.strategy} {(program.config as any).referrer?.commission?.value}
                              {(program.config as any).referrer?.commission?.strategy === 'PERCENTAGE' ? '%' : ''}
                            </p>
                            <p className="text-sm text-gray-900 dark:text-white">
                              Customer: {(program.config as any).customer?.commission?.strategy} {(program.config as any).customer?.commission?.value}
                              {(program.config as any).customer?.commission?.strategy === 'PERCENTAGE' ? '%' : ''}
                            </p>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Limits</p>
                        <p className="text-sm text-gray-900 dark:text-white">
                          Per Customer: {program.perCustomerAvailLimit ?? 'Unlimited'}
                        </p>
                        <p className="text-sm text-gray-900 dark:text-white">
                          Total: {program.totalCustomerAvailLimit ?? 'Unlimited'}
                        </p>
                        <p className="text-sm text-gray-900 dark:text-white">
                          Valid Until:{' '}
                          <span>{displayValidUntil(program.validUntil)}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => startEdit(program)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Create Discount Program</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={(formData as CreateDiscountProgramPayload).code || ''}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}
                    placeholder="UNICEF_STARTUP_LAB_5"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Type *
                  </label>
                  <select
                    required
                    value={(formData as CreateDiscountProgramPayload).type}
                    onChange={(e) => {
                      const type = e.target.value as 'SUBSIDY' | 'REFERRAL';
                      if (type === 'SUBSIDY') {
                        setFormData({
                          ...formData,
                          type,
                          config: {
                            strategy: 'PERCENTAGE',
                            value: 0,
                          },
                        });
                      } else {
                        setFormData({
                          ...formData,
                          type,
                          config: {
                            referrer: {
                              id: '',
                              commission: {
                                strategy: 'PERCENTAGE',
                                value: 0,
                              },
                            },
                            customer: {
                              commission: {
                                strategy: 'PERCENTAGE',
                                value: 0,
                              },
                            },
                          },
                        });
                        setCustomerSearchTerm('');
                        setIsCustomerDropdownOpen(false);
                      }
                    }}
                    className="w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                  >
                    <option value="SUBSIDY">SUBSIDY</option>
                    <option value="REFERRAL">REFERRAL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Valid Until
                  </label>
                  <input
                    type="datetime-local"
                    min={nowDatetimeLocalMin()}
                    value={toDatetimeLocalValue((formData as any).validUntil)}
                    onChange={(e) => {
                      if (!e.target.value) {
                        setFormData({ ...formData, validUntil: undefined });
                        return;
                      }
                      const d = new Date(e.target.value);
                      if (Number.isNaN(d.getTime()) || d.getTime() < Date.now()) {
                        setError('Valid Until cannot be in the past.');
                        return;
                      }
                      setError(null);
                      setFormData({ ...formData, validUntil: d.toISOString() });
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Optional. Leave empty for no expiry.
                  </p>
                </div>

                {/* Configuration based on type */}
                {(formData as CreateDiscountProgramPayload).type === 'SUBSIDY' ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Subsidy Configuration</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Strategy *
                        </label>
                        <select
                          required
                          value={((formData as any).config as any).strategy}
                          onChange={(e) => updateConfig({ strategy: e.target.value as 'PERCENTAGE' | 'FIXED' })}
                          className="w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                        >
                          <option value="PERCENTAGE">PERCENTAGE</option>
                          <option value="FIXED">FIXED</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Value *
                        </label>
                        <input
                          type="text"
                          required
                          value={((formData as any).config as any).value?.toString() || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            // Allow only numbers and a single decimal point
                            if (value === '' || /^\d*\.?\d*$/.test(value)) {
                              const numValue = value === '' ? 0 : (value === '.' ? 0 : parseFloat(value));
                              if (!isNaN(numValue) || value === '' || value === '.') {
                                updateConfig({ value: value === '' || value === '.' ? 0 : numValue });
                              }
                            }
                          }}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Referral Configuration</h3>
                    <div className="space-y-4">
                      <div className="relative" ref={customerDropdownRef}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Referrer (Customer) *
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            value={isCustomerDropdownOpen ? customerSearchTerm : getSelectedCustomerName()}
                            onChange={(e) => {
                              setCustomerSearchTerm(e.target.value);
                              setIsCustomerDropdownOpen(true);
                              if (!e.target.value) {
                                updateReferrerConfig({ id: '' });
                              }
                            }}
                            onFocus={() => {
                              setIsCustomerDropdownOpen(true);
                              if (!customerSearchTerm && ((formData as any).config as any).referrer?.id) {
                                setCustomerSearchTerm(getSelectedCustomerName());
                              }
                            }}
                            placeholder="Search customer by name or email..."
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setIsCustomerDropdownOpen(!isCustomerDropdownOpen);
                              if (!isCustomerDropdownOpen) {
                                setCustomerSearchTerm(getSelectedCustomerName());
                              }
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            <svg
                              className={`h-5 w-5 transform transition-transform ${isCustomerDropdownOpen ? 'rotate-180' : ''}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                        
                        {isCustomerDropdownOpen && (
                          <div className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                            {filteredCustomers.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                                No customers found
                              </div>
                            ) : (
                              filteredCustomers.map((customer) => {
                                const name = [customer.firstName, customer.otherNames, customer.lastName]
                                  .filter(Boolean)
                                  .join(' ') || customer.emailAddress || 'Unknown';
                                const displayName = customer.emailAddress ? `${name} (${customer.emailAddress})` : name;
                                const isSelected = customer.id === ((formData as any).config as any).referrer?.id;
                                
                                return (
                                  <button
                                    key={customer.id}
                                    type="button"
                                    onClick={() => {
                                      updateReferrerConfig({ id: customer.id });
                                      setCustomerSearchTerm('');
                                      setIsCustomerDropdownOpen(false);
                                    }}
                                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                                      isSelected ? 'bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-200' : 'text-gray-900 dark:text-white'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span>{displayName}</span>
                                      {isSelected && (
                                        <svg className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                    </div>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Referrer Strategy *
                          </label>
                          <select
                            required
                            value={((formData as any).config as any).referrer?.commission?.strategy || 'PERCENTAGE'}
                            onChange={(e) => updateReferrerConfig({ commission: { strategy: e.target.value, value: ((formData as any).config as any).referrer?.commission?.value || 0 } })}
                            className="w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                          >
                            <option value="PERCENTAGE">PERCENTAGE</option>
                            <option value="FIXED">FIXED</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Referrer Value *
                          </label>
                          <input
                            type="text"
                            required
                            value={((formData as any).config as any).referrer?.commission?.value?.toString() || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              // Allow only numbers and a single decimal point
                              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                const numValue = value === '' ? 0 : (value === '.' ? 0 : parseFloat(value));
                                if (!isNaN(numValue) || value === '' || value === '.') {
                                  updateReferrerConfig({ commission: { strategy: ((formData as any).config as any).referrer?.commission?.strategy || 'PERCENTAGE', value: value === '' || value === '.' ? 0 : numValue } });
                                }
                              }
                            }}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Customer Strategy *
                          </label>
                          <select
                            required
                            value={((formData as any).config as any).customer?.commission?.strategy || 'PERCENTAGE'}
                            onChange={(e) => updateCustomerConfig({ commission: { strategy: e.target.value, value: ((formData as any).config as any).customer?.commission?.value || 0 } })}
                            className="w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                          >
                            <option value="PERCENTAGE">PERCENTAGE</option>
                            <option value="FIXED">FIXED</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Customer Value *
                          </label>
                          <input
                            type="text"
                            required
                            value={((formData as any).config as any).customer?.commission?.value?.toString() || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              // Allow only numbers and a single decimal point
                              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                const numValue = value === '' ? 0 : (value === '.' ? 0 : parseFloat(value));
                                if (!isNaN(numValue) || value === '' || value === '.') {
                                  updateCustomerConfig({ commission: { strategy: ((formData as any).config as any).customer?.commission?.strategy || 'PERCENTAGE', value: value === '' || value === '.' ? 0 : numValue } });
                                }
                              }
                            }}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Per Customer Availability Limit
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.perCustomerAvailLimit || 0}
                      onChange={(e) => setFormData({ ...formData, perCustomerAvailLimit: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Total Customer Availability Limit
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.totalCustomerAvailLimit || 0}
                      onChange={(e) => setFormData({ ...formData, totalCustomerAvailLimit: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingProgram && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Edit Discount Program</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Applicable Countries
                  </label>
                  <select
                    multiple
                    value={formData.applicableCountries || []}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, option => option.value);
                      setFormData({ ...formData, applicableCountries: selected });
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                    size={5}
                  >
                    {countries.map((country) => (
                      <option key={country.id} value={country.id}>
                        {country.name} ({country.code})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Hold Ctrl/Cmd to select multiple countries. Leave empty for all countries.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive ?? false}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                  <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300">
                    Active
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Valid Until
                  </label>
                  <input
                    type="datetime-local"
                    min={nowDatetimeLocalMin()}
                    value={toDatetimeLocalValue((formData as any).validUntil)}
                    onChange={(e) => {
                      if (!e.target.value) {
                        setFormData({ ...formData, validUntil: undefined });
                        return;
                      }
                      const d = new Date(e.target.value);
                      if (Number.isNaN(d.getTime()) || d.getTime() < Date.now()) {
                        setError('Valid Until cannot be in the past.');
                        return;
                      }
                      setError(null);
                      setFormData({ ...formData, validUntil: d.toISOString() });
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Optional. Leave empty for no expiry.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Per Customer Availability Limit
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.perCustomerAvailLimit || 0}
                      onChange={(e) => setFormData({ ...formData, perCustomerAvailLimit: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Total Customer Availability Limit
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.totalCustomerAvailLimit || 0}
                      onChange={(e) => setFormData({ ...formData, totalCustomerAvailLimit: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdate}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}


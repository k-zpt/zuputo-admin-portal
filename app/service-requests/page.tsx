'use client';

import { AdminLayout } from "@/components/AdminLayout";
import { serviceRequestService, countryService } from "@/lib/api/services";
import { formatTypeLabel, formatStatusLabel, SERVICE_REQUEST_TYPE_LABELS, SERVICE_REQUEST_STATUS_LABELS } from "@/lib/serviceRequestLabels";
import { formatAmount, formatDate } from "@/lib/format";
import { useState, useEffect } from "react";
import type { ServiceRequest, ApiResponse, Country, Currency, ServiceRequestStatusLogEntry } from "@/lib/api/types";

export default function ServiceRequestsPage() {
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [filters, setFilters] = useState({
    type: '',
    status: '',
  });
  const [selectedServiceRequest, setSelectedServiceRequest] = useState<ServiceRequest | null>(null);
  const [showServiceRequestModal, setShowServiceRequestModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateForm, setUpdateForm] = useState({ status: '', price: '', currency: '', notes: '' });
  const [updateSubmitting, setUpdateSubmitting] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateModalCurrencies, setUpdateModalCurrencies] = useState<Currency[]>([]);
  const [countriesList, setCountriesList] = useState<Country[]>([]);
  const [expandedStatusLogForId, setExpandedStatusLogForId] = useState<string | null>(null);

  useEffect(() => {
    loadServiceRequests();
  }, [filters.type, filters.status]);

  useEffect(() => {
    const loadCountries = async () => {
      try {
        const res = await countryService.list({ limit: 100 });
        setCountriesList(res.data ?? []);
      } catch {
        setCountriesList([]);
      }
    };
    loadCountries();
  }, []);

  const loadServiceRequests = async (append = false) => {
    try {
      setLoading(true);
      setError(null);
      const response: ApiResponse<ServiceRequest[]> = await serviceRequestService.list({ 
        cursor: append ? cursor || undefined : undefined, 
        limit: 20,
        type: filters.type || undefined,
        status: filters.status || undefined,
      });
      
      if (append) {
        setServiceRequests(prev => [...prev, ...response.data]);
      } else {
        setServiceRequests(response.data);
        setCursor(null); // Reset cursor when filters change
      }
      
      setCursor(response.pagination?.nextCursor || null);
      setHasNext(response.pagination?.hasNext || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load service requests');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: 'type' | 'status', value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCursor(null); // Reset pagination when filters change
  };

  const clearFilters = () => {
    setFilters({ type: '', status: '' });
    setCursor(null);
  };

  const formatCustomerName = (entity?: ServiceRequest['entity']): string => {
    if (!entity) return 'N/A';
    if (entity.name) return entity.name;
    const parts = [entity.firstName, entity.otherNames, entity.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'N/A';
  };

  const formatOwnerName = (entity?: ServiceRequest['entity']): string => {
    if (!entity?.owner) return 'N/A';
    const parts = [entity.owner.firstName, entity.owner.otherNames, entity.owner.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : entity.owner.emailAddress || 'N/A';
  };

  const getCustomerOrOwner = (entity?: ServiceRequest['entity']): string => {
    const customerName = formatCustomerName(entity);
    if (customerName === 'ME') {
      return formatOwnerName(entity);
    }
    return customerName;
  };

  const getStatusColorClasses = (status: string | undefined | null): string => {
    const statusUpper = (status ?? '').toUpperCase();
    switch (statusUpper) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      case 'RECEIVED':
      case 'ACKNOWLEDGED':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200';
      case 'PENDING_ASSESSMENT':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200';
      case 'PENDING_PAYMENT':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200';
      case 'IN_PROGRESS':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200';
      case 'UNDER_REVIEW':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200';
      case 'TRANSFERRED':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getInvoiceStatusColorClasses = (status?: string): string => {
    if (!status) return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    const statusUpper = status.toUpperCase();
    switch (statusUpper) {
      case 'PAID':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200';
      case 'UNPAID':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Service Requests
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            View and manage service requests
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
              Filter by Type
            </label>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
            >
              <option value="">All Types</option>
              {Object.entries(SERVICE_REQUEST_TYPE_LABELS).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Filter by Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
            >
              <option value="">All Statuses</option>
              {Object.entries(SERVICE_REQUEST_STATUS_LABELS).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>
          {(filters.type || filters.status) && (
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>

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
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Customer/Owner
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Invoice
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                    {serviceRequests.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                          No service requests found
                        </td>
                      </tr>
                    ) : (
                      serviceRequests.map((request, index) => {
                        const invoice = request.invoice;
                        const currency = invoice?.pricing?.currency 
                          ? (typeof invoice.pricing.currency === 'object' 
                              ? invoice.pricing.currency.code 
                              : invoice.pricing.currency)
                          : (request.pricingInfo?.currency 
                            ? (typeof request.pricingInfo.currency === 'object' 
                                ? request.pricingInfo.currency.code 
                                : request.pricingInfo.currency)
                            : 'N/A');
                        const amount = invoice?.pricing?.total || request.pricingInfo?.price || 'N/A';
                        
                        return (
                          <tr 
                            key={request.id ?? `sr-${index}`} 
                            className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                            onClick={() => {
                              setSelectedServiceRequest(request);
                              setShowServiceRequestModal(true);
                            }}
                          >
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                              <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                                {formatTypeLabel(request.type)}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                              <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColorClasses(request.status)}`}>
                                {formatStatusLabel(request.status)}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                              {getCustomerOrOwner(request.entity)}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                              {request.created ? formatDate(request.created, { format: 'dd/mm/yyyy' }) : '—'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                              {invoice ? (
                                <div className="space-y-1">
                                  <div className="font-medium text-gray-900 dark:text-white">
                                    {currency} {formatAmount(amount)}
                                  </div>
                                  <div className="flex items-center">
                                    <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${getInvoiceStatusColorClasses(invoice.status)}`}>
                                      {invoice.status || 'UNPAID'}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-500 dark:text-gray-400 italic">No invoice</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {hasNext && (
              <button
                onClick={() => loadServiceRequests(true)}
                disabled={loading}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            )}
          </>
        )}

        {/* Service Request Details Modal */}
        {showServiceRequestModal && selectedServiceRequest && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" 
            onClick={() => setShowServiceRequestModal(false)}
          >
            <div 
              className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900" 
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Service Request Details</h2>
                <div className="flex items-center gap-2">
                  {selectedServiceRequest.status === 'PENDING_ASSESSMENT' && (
                    <button
                      type="button"
                      onClick={() => {
                        const req = selectedServiceRequest;
                        const country = req.entity?.country;
                        const countryId = country == null
                          ? null
                          : typeof country === 'string'
                            ? country
                            : (country as Country)?.id ?? null;
                        const currencies: Currency[] = countryId
                          ? (countriesList.find((c) => c.id === countryId)?.currencies ?? [])
                          : [];
                        setUpdateModalCurrencies(currencies);
                        const currentCurrency = (() => {
                          const c = req.pricingInfo?.currency;
                          if (!c) return currencies[0]?.id ?? '';
                          if (typeof c === 'object') return (c as Currency).id ?? '';
                          const byId = currencies.find((x) => x.id === c);
                          const byCode = currencies.find((x) => x.code === c);
                          return (byId ?? byCode)?.id ?? c;
                        })();
                        setUpdateForm({
                          status: req.status,
                          price: req.pricingInfo?.price != null ? String(req.pricingInfo.price) : '',
                          currency: currentCurrency,
                          notes: '',
                        });
                        setUpdateError(null);
                        setShowUpdateModal(true);
                      }}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                    >
                      Update
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowServiceRequestModal(false)}
                    className="rounded-lg p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Basic Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Basic Information</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">ID</label>
                      <p className="mt-1 text-sm font-mono text-gray-900 dark:text-white">{selectedServiceRequest.id}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Type</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                          {formatTypeLabel(selectedServiceRequest.type)}
                        </span>
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColorClasses(selectedServiceRequest.status)}`}>
                          {formatStatusLabel(selectedServiceRequest.status)}
                        </span>
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Price</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        {selectedServiceRequest.pricingInfo?.currency 
                          ? (typeof selectedServiceRequest.pricingInfo.currency === 'object' 
                              ? selectedServiceRequest.pricingInfo.currency.code 
                              : selectedServiceRequest.pricingInfo.currency)
                          : 'N/A'} {selectedServiceRequest.pricingInfo?.price != null ? formatAmount(selectedServiceRequest.pricingInfo.price) : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status history (expandable when API provides statusLogs / statusLog / status_log) */}
                {(() => {
                  const statusLog: ServiceRequestStatusLogEntry[] =
                    selectedServiceRequest.statusLogs ??
                    selectedServiceRequest.statusLog ??
                    (selectedServiceRequest as { status_log?: ServiceRequestStatusLogEntry[] }).status_log ??
                    [];
                  if (statusLog.length === 0) return null;
                  const isExpanded = expandedStatusLogForId === selectedServiceRequest.id;
                  return (
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedStatusLogForId((prev) =>
                            prev === selectedServiceRequest.id ? null : selectedServiceRequest.id
                          )
                        }
                        className="flex items-center gap-2 text-left text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <span>
                          {isExpanded ? 'Hide' : 'View'} status history ({statusLog.length} update{statusLog.length === 1 ? '' : 's'})
                        </span>
                        <svg
                          className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {isExpanded && (
                        <div className="mt-3 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                          {[...statusLog].reverse().map((entry, i) => {
                            const status = entry.toStatus ?? entry.status ?? entry.fromStatus;
                            const at = entry.created ?? entry.timestamp ?? entry.at;
                            const by = entry.updatedBy ?? entry.by;
                            const note = entry.notes ?? entry.note;
                            return (
                              <div
                                key={i}
                                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-gray-200 py-2 last:border-0 last:pb-0 dark:border-gray-700"
                              >
                                {status != null && status !== '' && (
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColorClasses(status)}`}>
                                    {formatStatusLabel(status)}
                                  </span>
                                )}
                                {at != null && at !== '' && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(at, { format: 'dd/mm/yyyy' })}</span>
                                )}
                                {by != null && by !== '' && (
                                  <span className="text-xs text-gray-600 dark:text-gray-300">by {String(by)}</span>
                                )}
                                {note != null && note !== '' && (
                                  <span className="w-full text-xs text-gray-600 dark:text-gray-300 mt-1">Note: {String(note)}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Context Information */}
                {selectedServiceRequest.context && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Context</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {selectedServiceRequest.context.label && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Label</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedServiceRequest.context.label}</p>
                        </div>
                      )}
                      {selectedServiceRequest.context.description && (
                        <div className="md:col-span-2">
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedServiceRequest.context.description}</p>
                        </div>
                      )}
                      {selectedServiceRequest.context.status && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Context Status</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedServiceRequest.context.status}</p>
                        </div>
                      )}
                      {(selectedServiceRequest.context?.created ?? selectedServiceRequest.created) && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(selectedServiceRequest.context?.created ?? selectedServiceRequest.created)}</p>
                        </div>
                      )}
                      {(selectedServiceRequest.context?.modified ?? selectedServiceRequest.modified) && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Modified</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(selectedServiceRequest.context?.modified ?? selectedServiceRequest.modified)}</p>
                        </div>
                      )}
                      {selectedServiceRequest.context.validUntil && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Valid Until</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(selectedServiceRequest.context.validUntil)}</p>
                        </div>
                      )}
                      {selectedServiceRequest.context.paymentToken && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Payment Token</label>
                          <p className="mt-1 text-sm font-mono text-gray-900 dark:text-white">{selectedServiceRequest.context.paymentToken}</p>
                        </div>
                      )}
                      {selectedServiceRequest.context.url && (
                        <div className="md:col-span-2">
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">URL</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white break-all">
                            <a 
                              href={selectedServiceRequest.context.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              {selectedServiceRequest.context.url}
                            </a>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Entity Information */}
                {selectedServiceRequest.entity && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Entity Information</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Entity ID</label>
                        <p className="mt-1 text-sm font-mono text-gray-900 dark:text-white">{selectedServiceRequest.entity.id}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Type</label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedServiceRequest.entity.type}</p>
                      </div>
                      {selectedServiceRequest.entity.name && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedServiceRequest.entity.name}</p>
                        </div>
                      )}
                      {(selectedServiceRequest.entity.firstName || selectedServiceRequest.entity.lastName) && (
                        <>
                          {selectedServiceRequest.entity.title && (
                            <div>
                              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Title</label>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedServiceRequest.entity.title}</p>
                            </div>
                          )}
                          {selectedServiceRequest.entity.firstName && (
                            <div>
                              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">First Name</label>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedServiceRequest.entity.firstName}</p>
                            </div>
                          )}
                          {selectedServiceRequest.entity.otherNames && (
                            <div>
                              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Other Names</label>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedServiceRequest.entity.otherNames}</p>
                            </div>
                          )}
                          {selectedServiceRequest.entity.lastName && (
                            <div>
                              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Name</label>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedServiceRequest.entity.lastName}</p>
                            </div>
                          )}
                        </>
                      )}
                      {selectedServiceRequest.entity.emailAddress && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedServiceRequest.entity.emailAddress}</p>
                        </div>
                      )}
                      {selectedServiceRequest.entity.country && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Country</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">
                            {typeof selectedServiceRequest.entity.country === 'object' && selectedServiceRequest.entity.country !== null
                              ? (selectedServiceRequest.entity.country as any).name || (selectedServiceRequest.entity.country as any).code || 'N/A'
                              : String(selectedServiceRequest.entity.country)}
                          </p>
                        </div>
                      )}
                      {selectedServiceRequest.entity.address && (
                        <div className="md:col-span-2">
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Address</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedServiceRequest.entity.address}</p>
                        </div>
                      )}
                      {selectedServiceRequest.entity.owner && (
                        <div className="md:col-span-2">
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Owner</label>
                          <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                            <p className="text-sm text-gray-900 dark:text-white">{formatOwnerName(selectedServiceRequest.entity)}</p>
                            {selectedServiceRequest.entity.owner.emailAddress && (
                              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                {selectedServiceRequest.entity.owner.emailAddress}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Invoice Information */}
                {selectedServiceRequest.invoice && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Invoice</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Invoice ID</label>
                        <p className="mt-1 text-sm font-mono text-gray-900 dark:text-white">{selectedServiceRequest.invoice.id}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Invoice Number</label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedServiceRequest.invoice.number}</p>
                      </div>
                      {selectedServiceRequest.invoice.status && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getInvoiceStatusColorClasses(selectedServiceRequest.invoice.status)}`}>
                              {selectedServiceRequest.invoice.status}
                            </span>
                          </p>
                        </div>
                      )}
                      {selectedServiceRequest.invoice.name && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Invoice Name</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedServiceRequest.invoice.name}</p>
                        </div>
                      )}
                      {(selectedServiceRequest.invoice.created ?? selectedServiceRequest.created) && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(selectedServiceRequest.invoice.created ?? selectedServiceRequest.created)}</p>
                        </div>
                      )}
                      {(selectedServiceRequest.invoice.modified ?? selectedServiceRequest.modified) && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Modified</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(selectedServiceRequest.invoice.modified ?? selectedServiceRequest.modified)}</p>
                        </div>
                      )}
                      {selectedServiceRequest.invoice.validUntil && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Valid Until</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(selectedServiceRequest.invoice.validUntil)}</p>
                        </div>
                      )}
                      {selectedServiceRequest.invoice.billedTo && (
                        <div className="md:col-span-2">
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Billed To</label>
                          <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                            <p className="text-sm text-gray-900 dark:text-white">
                              {[selectedServiceRequest.invoice.billedTo.firstName, selectedServiceRequest.invoice.billedTo.otherNames, selectedServiceRequest.invoice.billedTo.lastName]
                                .filter(Boolean)
                                .join(' ') || selectedServiceRequest.invoice.billedTo.emailAddress || 'N/A'}
                            </p>
                            {selectedServiceRequest.invoice.billedTo.emailAddress && (
                              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                {selectedServiceRequest.invoice.billedTo.emailAddress}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      {selectedServiceRequest.invoice.pricing && (
                        <div className="md:col-span-2">
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 block">Pricing</label>
                          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="text-sm text-gray-500 dark:text-gray-400">Subtotal:</span>
                                <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                                  {selectedServiceRequest.invoice.pricing?.currency 
                                    ? (typeof selectedServiceRequest.invoice.pricing.currency === 'object' 
                                        ? selectedServiceRequest.invoice.pricing.currency.code 
                                        : selectedServiceRequest.invoice.pricing.currency)
                                    : 'N/A'} {selectedServiceRequest.invoice.pricing?.subTotal != null ? formatAmount(selectedServiceRequest.invoice.pricing.subTotal) : 'N/A'}
                                </span>
                              </div>
                              {selectedServiceRequest.invoice.pricing?.tax && (
                                <div>
                                  <span className="text-sm text-gray-500 dark:text-gray-400">Tax:</span>
                                  <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                                    {selectedServiceRequest.invoice.pricing?.currency 
                                      ? (typeof selectedServiceRequest.invoice.pricing.currency === 'object' 
                                          ? selectedServiceRequest.invoice.pricing.currency.code 
                                          : selectedServiceRequest.invoice.pricing.currency)
                                      : 'N/A'} {selectedServiceRequest.invoice.pricing.tax != null ? formatAmount(selectedServiceRequest.invoice.pricing.tax) : 'N/A'}
                                  </span>
                                </div>
                              )}
                              <div className="col-span-2 border-t border-gray-200 pt-2 dark:border-gray-700">
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">Total:</span>
                                <span className="ml-2 text-lg font-bold text-gray-900 dark:text-white">
                            {selectedServiceRequest.invoice.pricing?.currency 
                              ? (typeof selectedServiceRequest.invoice.pricing.currency === 'object' 
                                  ? selectedServiceRequest.invoice.pricing.currency.code 
                                  : selectedServiceRequest.invoice.pricing.currency)
                              : 'N/A'} {selectedServiceRequest.invoice.pricing?.total != null ? formatAmount(selectedServiceRequest.invoice.pricing.total) : 'N/A'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      {selectedServiceRequest.invoice.items && selectedServiceRequest.invoice.items.length > 0 && (
                        <div className="md:col-span-2">
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 block">Items</label>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-gray-100 dark:bg-gray-800">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Label</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Quantity</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Price</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {selectedServiceRequest.invoice.items.map((item, index) => (
                                  <tr key={index}>
                                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{item.label}</td>
                                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{item.quantity}</td>
                                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                                      {item.pricing?.currency 
                                        ? (typeof item.pricing.currency === 'object' 
                                            ? item.pricing.currency.code 
                                            : item.pricing.currency)
                                        : 'N/A'} {item.pricing?.price != null ? formatAmount(item.pricing.price) : 'N/A'}
                                    </td>
                                    <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-white">
                                      {item.pricing?.currency 
                                        ? (typeof item.pricing.currency === 'object' 
                                            ? item.pricing.currency.code 
                                            : item.pricing.currency)
                                        : 'N/A'} {item.total != null ? formatAmount(item.total) : 'N/A'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Update Service Request Modal (PENDING_ASSESSMENT only) */}
        {showUpdateModal && selectedServiceRequest && selectedServiceRequest.status === 'PENDING_ASSESSMENT' && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4"
            onClick={() => setShowUpdateModal(false)}
          >
            <div
              className="relative w-full max-w-md rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Update Service Request</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Update status and pricing after assessment.</p>
              </div>
              <form
                className="p-6 space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setUpdateError(null);
                  setUpdateSubmitting(true);
                  try {
                    const payload = {
                      status: updateForm.status,
                      ...(updateForm.notes.trim() ? { notes: updateForm.notes.trim() } : {}),
                      ...(updateForm.price !== '' && updateForm.currency
                        ? { pricingInfo: { price: Number(updateForm.price), currency: updateForm.currency } }
                        : {}),
                    };
                    const res = await serviceRequestService.update(selectedServiceRequest.id, payload);
                    setShowUpdateModal(false);
                    setUpdateForm({ status: '', price: '', currency: '', notes: '' });
                    const id = selectedServiceRequest.id;
                    const data = (res && res.data != null && typeof res.data === 'object') ? res.data : {};
                    const merged = { ...selectedServiceRequest, ...data, id };
                    setSelectedServiceRequest(merged);
                    setServiceRequests((prev) =>
                      prev.map((r) => (r.id === id ? { ...r, ...data } : r))
                    );
                  } catch (err) {
                    setUpdateError(err instanceof Error ? err.message : 'Update failed');
                  } finally {
                    setUpdateSubmitting(false);
                  }
                }}
              >
                {updateError && (
                  <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    {updateError}
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                  <select
                    value={updateForm.status}
                    onChange={(e) => setUpdateForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    required
                  >
                    {Object.entries(SERVICE_REQUEST_STATUS_LABELS).map(([code, label]) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Price</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={updateForm.price}
                    onChange={(e) => setUpdateForm((f) => ({ ...f, price: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Currency</label>
                  <select
                    value={updateForm.currency}
                    onChange={(e) => setUpdateForm((f) => ({ ...f, currency: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  >
                    {updateModalCurrencies.length === 0 ? (
                      <option value="">No currencies available</option>
                    ) : (
                      updateModalCurrencies.map((c) => (
                        <option key={c.id} value={c.id}>{c.label} ({c.code})</option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Notes (optional)</label>
                  <textarea
                    value={updateForm.notes}
                    onChange={(e) => setUpdateForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    placeholder="Assessment notes..."
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowUpdateModal(false)}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateSubmitting || !updateForm.status}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                  >
                    {updateSubmitting ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}


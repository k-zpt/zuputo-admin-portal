'use client';

import { AdminLayout } from "@/components/AdminLayout";
import { customerService, serviceRequestService } from "@/lib/api/services";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { CustomerProfile, ServiceRequest, ApiResponse, SubscriptionUsage } from "@/lib/api/types";

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;
  
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [selectedServiceRequest, setSelectedServiceRequest] = useState<ServiceRequest | null>(null);
  const [showServiceRequestModal, setShowServiceRequestModal] = useState(false);
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    paid: '', // 'paid', 'unpaid', or ''
  });
  const [subscriptionUsage, setSubscriptionUsage] = useState<SubscriptionUsage | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [showUpdateUsageModal, setShowUpdateUsageModal] = useState(false);
  const [selectedServiceRequestForUsage, setSelectedServiceRequestForUsage] = useState<ServiceRequest | null>(null);
  const [updatingUsage, setUpdatingUsage] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const response: ApiResponse<CustomerProfile> = await customerService.getProfile(customerId);
        setProfile(response.data);
        // Load subscription usage if customer has a subscription
        if (response.data.subscription) {
          loadSubscriptionUsage();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load customer profile');
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [customerId]);

  const loadSubscriptionUsage = async () => {
    try {
      setLoadingUsage(true);
      const response: ApiResponse<SubscriptionUsage> = await customerService.getSubscriptionUsage(customerId);
      setSubscriptionUsage(response.data);
    } catch (err) {
      console.error('Failed to load subscription usage:', err);
      // Don't show error if customer doesn't have usage (might not have subscription)
    } finally {
      setLoadingUsage(false);
    }
  };

  const handleUpdateUsage = async () => {
    if (!selectedServiceRequestForUsage) return;
    
    try {
      setUpdatingUsage(true);
      setError(null);
      await customerService.updateSubscriptionUsage(customerId, {
        service_request_id: selectedServiceRequestForUsage.id,
      });
      setShowUpdateUsageModal(false);
      setSelectedServiceRequestForUsage(null);
      // Reload usage to show updated values
      await loadSubscriptionUsage();
      // Show success message
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update subscription usage');
    } finally {
      setUpdatingUsage(false);
    }
  };

  useEffect(() => {
    const loadServiceRequests = async () => {
      try {
        setLoadingRequests(true);
        setCursor(null); // Reset cursor when filters change
        const response: ApiResponse<ServiceRequest[]> = await serviceRequestService.list({ 
          limit: 50,
          customerId: customerId,
          type: filters.type || undefined,
          status: filters.status || undefined,
        });
        
        let requests = response.data;
        
        // Filter by customer (if API doesn't support customerId filter, filter client-side)
        requests = requests.filter(req => {
          return req.entity?.owner?.id === customerId;
        });
        
        // Filter by paid status if specified
        if (filters.paid === 'paid') {
          requests = requests.filter(req => req.invoice && req.invoice.id);
        } else if (filters.paid === 'unpaid') {
          requests = requests.filter(req => !req.invoice || !req.invoice.id);
        }
        
        // Sort: paid first, then by most recent (created/modified date), then by status
        requests.sort((a, b) => {
          // First: paid vs unpaid
          const aPaid = a.invoice && a.invoice.id ? 1 : 0;
          const bPaid = b.invoice && b.invoice.id ? 1 : 0;
          if (aPaid !== bPaid) {
            return bPaid - aPaid; // Paid first
          }
          
          // Second: most recent first (use modified or created date)
          const aDate = a.context?.modified || a.context?.created || '';
          const bDate = b.context?.modified || b.context?.created || '';
          if (aDate && bDate) {
            const dateCompare = new Date(bDate).getTime() - new Date(aDate).getTime();
            if (dateCompare !== 0) {
              return dateCompare;
            }
          }
          
          // Third: by status (alphabetical)
          return a.status.localeCompare(b.status);
        });
        
        setServiceRequests(requests);
        setCursor(response.pagination?.nextCursor || null);
        setHasNext(response.pagination?.hasNext || false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load service requests');
      } finally {
        setLoadingRequests(false);
      }
    };
    
    loadServiceRequests();
  }, [customerId, filters.type, filters.status, filters.paid]);

  const loadMoreServiceRequests = async () => {
    if (!cursor || loadingRequests) return;
    try {
      setLoadingRequests(true);
      const response: ApiResponse<ServiceRequest[]> = await serviceRequestService.list({ 
        cursor: cursor,
        limit: 50,
        customerId: customerId,
        type: filters.type || undefined,
        status: filters.status || undefined,
      });
      
      let requests = response.data.filter(req => req.entity?.owner?.id === customerId);
      
      if (filters.paid === 'paid') {
        requests = requests.filter(req => req.invoice && req.invoice.id);
      } else if (filters.paid === 'unpaid') {
        requests = requests.filter(req => !req.invoice || !req.invoice.id);
      }
      
      setServiceRequests(prev => [...prev, ...requests]);
      setCursor(response.pagination?.nextCursor || null);
      setHasNext(response.pagination?.hasNext || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more service requests');
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleFilterChange = (key: 'type' | 'status' | 'paid', value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCursor(null);
  };

  const clearFilters = () => {
    setFilters({ type: '', status: '', paid: '' });
    setCursor(null);
  };

  const formatCustomerName = (customer?: CustomerProfile): string => {
    if (!customer) return 'N/A';
    const parts = [customer.firstName, customer.otherNames, customer.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : customer.emailAddress || 'N/A';
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const formatPrice = (pricingInfo?: ServiceRequest['pricingInfo']): string => {
    if (!pricingInfo) return 'N/A';
    const currency = pricingInfo.currency 
      ? (typeof pricingInfo.currency === 'object' 
          ? pricingInfo.currency.code 
          : pricingInfo.currency)
      : 'N/A';
    const price = pricingInfo.price || 'N/A';
    return `${currency} ${price}`;
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-center text-gray-600 dark:text-gray-400">Loading customer profile...</div>
      </AdminLayout>
    );
  }

  if (error && !profile) {
    return (
      <AdminLayout>
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => router.back()}
              className="mb-4 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              ← Back to Customers
            </button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Customer Profile
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {formatCustomerName(profile || undefined)}
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        )}

        {/* Customer Profile Overview */}
        {profile && (
          <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Profile Overview</h2>
            </div>
            <div className="px-6 py-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {formatCustomerName(profile)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {profile.emailAddress || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Type</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {profile.type}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {profile.status}
                  </p>
                </div>
                {profile.country && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Country</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {profile.residentCountryName || 
                       (typeof profile.country === 'object' ? profile.country.name || profile.country.code : profile.country) || 
                       'N/A'}
                    </p>
                  </div>
                )}
                {profile.address && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Address</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {profile.address}
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Subscription</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {profile.subscription ? (
                      <Link
                        href={`/subscription-plans?planId=${profile.subscription.plan?.id || profile.subscription.planId}`}
                        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <span className="inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                        <span>{profile.subscription.plan?.label || profile.subscription.plan?.code || `Plan ${profile.subscription.planId}` || 'Active Subscription'}</span>
                      </Link>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                        None
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Subscription Usage Section */}
        {profile?.subscription && (
          <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Subscription Usage</h2>
                <button
                  onClick={() => {
                    setShowUpdateUsageModal(true);
                    setSelectedServiceRequestForUsage(null);
                  }}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  Update Usage
                </button>
              </div>
            </div>

            <div className="p-6">
              {loadingUsage ? (
                <div className="text-center text-gray-600 dark:text-gray-400 py-4">Loading usage...</div>
              ) : subscriptionUsage && Object.keys(subscriptionUsage).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(subscriptionUsage).map(([serviceType, usage]) => (
                    <div key={serviceType} className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {serviceType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                          usage.remaining > 0
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                        }`}>
                          {usage.remaining > 0 ? `${usage.remaining} remaining` : 'Exhausted'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Limit</label>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{usage.limit}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Used</label>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{usage.used}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Remaining</label>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{usage.remaining}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Discount</label>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{usage.discount_percent}%</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                          <span>Usage Progress</span>
                          <span>{Math.round((usage.used / usage.limit) * 100)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                          <div
                            className={`h-2 rounded-full ${
                              usage.remaining > 0 ? 'bg-blue-600' : 'bg-red-600'
                            }`}
                            style={{ width: `${Math.min((usage.used / usage.limit) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Period: {usage.period}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-600 dark:text-gray-400 py-4">
                  No usage data available
                </div>
              )}
            </div>
          </div>
        )}

        {/* Service Requests Section */}
        <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Service Requests</h2>
          </div>

          {/* Filters */}
          <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[150px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Filter by Type
                </label>
                <select
                  value={filters.type}
                  onChange={(e) => handleFilterChange('type', e.target.value)}
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                >
                  <option value="">All Types</option>
                  <option value="AD_HOC">AD_HOC</option>
                  <option value="IP_REGISTRATION">IP_REGISTRATION</option>
                  <option value="TRADEMARK_REGISTRATION">TRADEMARK_REGISTRATION</option>
                  <option value="CONTRACT_REQUEST">CONTRACT_REQUEST</option>
                  <option value="CONTRACT_REVIEW">CONTRACT_REVIEW</option>
                  <option value="COMPANY_INCORPORATION">COMPANY_INCORPORATION</option>
                  <option value="SOLE_PROPRIETORSHIP_INCORPORATION">SOLE_PROPRIETORSHIP_INCORPORATION</option>
                </select>
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Filter by Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                >
                  <option value="">All Statuses</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="RECEIVED">RECEIVED</option>
                  <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                  <option value="COMPLETED">COMPLETED</option>
                </select>
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Payment Status
                </label>
                <select
                  value={filters.paid}
                  onChange={(e) => handleFilterChange('paid', e.target.value)}
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                >
                  <option value="">All</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </div>
              {(filters.type || filters.status || filters.paid) && (
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
          </div>

          {/* Service Requests Table */}
          {loadingRequests ? (
            <div className="px-6 py-8 text-center text-gray-600 dark:text-gray-400">Loading service requests...</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Label/Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Invoice
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                    {serviceRequests.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                          No service requests found
                        </td>
                      </tr>
                    ) : (
                      serviceRequests.map((request) => (
                        <tr 
                          key={request.id} 
                          className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                          onClick={() => {
                            setSelectedServiceRequest(request);
                            setShowServiceRequestModal(true);
                          }}
                        >
                          <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-gray-900 dark:text-white">
                            {request.id.slice(0, 8)}...
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                              {request.type}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-200">
                              {request.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                            <div>
                              <div className="font-medium">{request.context?.label || 'N/A'}</div>
                              {request.context?.description && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {request.context.description}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-white">
                            {formatPrice(request.pricingInfo)}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {request.invoice?.number ? (
                              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-200">
                                {request.invoice.number}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                Unpaid
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {formatDate(request.context?.modified || request.context?.created)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {hasNext && serviceRequests.length > 0 && (
                <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-700">
                  <button
                    onClick={loadMoreServiceRequests}
                    disabled={loadingRequests || !hasNext}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    {loadingRequests ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Service Request Details Modal */}
        {showServiceRequestModal && selectedServiceRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowServiceRequestModal(false)}>
            <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 m-4" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-900 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Service Request Details</h2>
                <button
                  onClick={() => setShowServiceRequestModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
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
                          {selectedServiceRequest.type}
                        </span>
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-200">
                          {selectedServiceRequest.status}
                        </span>
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Price</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatPrice(selectedServiceRequest.pricingInfo)}</p>
                    </div>
                  </div>
                </div>

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
                      {selectedServiceRequest.context.created && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(selectedServiceRequest.context.created)}</p>
                        </div>
                      )}
                      {selectedServiceRequest.context.modified && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Modified</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(selectedServiceRequest.context.modified)}</p>
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
                      {selectedServiceRequest.entity.name && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedServiceRequest.entity.name}</p>
                        </div>
                      )}
                      {selectedServiceRequest.entity.emailAddress && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedServiceRequest.entity.emailAddress}</p>
                        </div>
                      )}
                      {selectedServiceRequest.entity.type && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Type</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedServiceRequest.entity.type}</p>
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
                      {selectedServiceRequest.invoice.number && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Invoice Number</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedServiceRequest.invoice.number}</p>
                        </div>
                      )}
                      {selectedServiceRequest.invoice.pricing && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Total</label>
                          <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                            {selectedServiceRequest.invoice.pricing.currency 
                              ? (typeof selectedServiceRequest.invoice.pricing.currency === 'object' 
                                  ? selectedServiceRequest.invoice.pricing.currency.code 
                                  : selectedServiceRequest.invoice.pricing.currency)
                              : 'N/A'} {selectedServiceRequest.invoice.pricing.total || 'N/A'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Update Subscription Usage Modal */}
        {showUpdateUsageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowUpdateUsageModal(false)}>
            <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 m-4" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-900 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Update Subscription Usage</h2>
                <button
                  onClick={() => {
                    setShowUpdateUsageModal(false);
                    setSelectedServiceRequestForUsage(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-6">
                {error && (
                  <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Service Request *
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Only service requests with types matching your subscription benefits are shown.
                  </p>
                  {loadingRequests ? (
                    <div className="text-center text-gray-600 dark:text-gray-400 py-4">Loading service requests...</div>
                  ) : (() => {
                    // Filter service requests to only show those whose types match subscription usage keys
                    const allowedTypes = subscriptionUsage ? Object.keys(subscriptionUsage) : [];
                    const filteredRequests = serviceRequests.filter(req => 
                      allowedTypes.includes(req.type)
                    );

                    if (filteredRequests.length === 0) {
                      return (
                        <div className="text-center text-gray-600 dark:text-gray-400 py-4">
                          No service requests available that match your subscription benefits.
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {filteredRequests.map((request) => (
                          <div
                            key={request.id}
                            onClick={() => setSelectedServiceRequestForUsage(request)}
                            className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                              selectedServiceRequestForUsage?.id === request.id
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {request.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                  </span>
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                    request.status === 'COMPLETED'
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                                      : request.status === 'PENDING'
                                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
                                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                  }`}>
                                    {request.status}
                                  </span>
                                </div>
                                
                                {/* Created Date */}
                                {request.context?.created && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Created:</span>
                                    <span className="text-xs text-gray-700 dark:text-gray-300">
                                      {new Date(request.context.created).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  </div>
                                )}

                                {/* Pricing Info */}
                                {request.pricingInfo && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Price:</span>
                                    <span className="text-xs font-semibold text-gray-900 dark:text-white">
                                      {typeof request.pricingInfo.currency === 'string' 
                                        ? request.pricingInfo.currency 
                                        : request.pricingInfo.currency.code} {request.pricingInfo.price}
                                    </span>
                                  </div>
                                )}

                                {/* Invoice Details */}
                                {request.invoice ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Invoice:</span>
                                      <span className="text-xs font-semibold text-gray-900 dark:text-white">
                                        {request.invoice.number}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Invoice Status:</span>
                                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                        request.invoice.status === 'PAID'
                                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                                          : request.invoice.status === 'UNPAID'
                                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
                                          : request.invoice.status === 'CANCELLED'
                                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                      }`}>
                                        {request.invoice.status || 'N/A'}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Invoice:</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 italic">No invoice</span>
                                  </div>
                                )}

                                {/* Request ID (smaller, at bottom) */}
                                <p className="text-xs text-gray-400 dark:text-gray-500 pt-1 border-t border-gray-200 dark:border-gray-700">
                                  ID: {request.id}
                                </p>
                              </div>
                              {selectedServiceRequestForUsage?.id === request.id && (
                                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setShowUpdateUsageModal(false);
                      setSelectedServiceRequestForUsage(null);
                    }}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    disabled={updatingUsage}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateUsage}
                    disabled={!selectedServiceRequestForUsage || updatingUsage}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600"
                  >
                    {updatingUsage ? 'Updating...' : 'Update Usage'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}


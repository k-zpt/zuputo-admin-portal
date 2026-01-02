'use client';

import { AdminLayout } from "@/components/AdminLayout";
import { serviceRequestService } from "@/lib/api/services";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import type { ServiceRequest, ApiResponse } from "@/lib/api/types";

export default function ServiceRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const serviceRequestId = params.id as string;
  
  const [serviceRequest, setServiceRequest] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadServiceRequest();
  }, [serviceRequestId]);

  const loadServiceRequest = async () => {
    try {
      setLoading(true);
      setError(null);
      const response: ApiResponse<ServiceRequest> = await serviceRequestService.getById(serviceRequestId);
      setServiceRequest(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load service request details');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const formatCustomerName = (entity?: ServiceRequest['entity']): string => {
    if (!entity) return 'N/A';
    if (entity.name) return entity.name;
    const parts = [entity.firstName, entity.otherNames, entity.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : entity.emailAddress || 'N/A';
  };

  const formatOwnerName = (entity?: ServiceRequest['entity']): string => {
    if (!entity?.owner) return 'N/A';
    const parts = [entity.owner.firstName, entity.owner.otherNames, entity.owner.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : entity.owner.emailAddress || 'N/A';
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-center text-gray-600 dark:text-gray-400">Loading service request details...</div>
      </AdminLayout>
    );
  }

  if (error || !serviceRequest) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            ← Back
          </button>
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {error || 'Service request not found'}
          </div>
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
              ← Back
            </button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Service Request Details
            </h1>
            <p className="mt-2 text-sm font-mono text-gray-600 dark:text-gray-400">
              {serviceRequest.id}
            </p>
          </div>
        </div>

        {/* Basic Information */}
        <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Basic Information</h2>
          </div>
          <div className="px-6 py-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Type</label>
                <p className="mt-1 text-sm text-gray-900 dark:text-white">
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                    {serviceRequest.type}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
                <p className="mt-1 text-sm text-gray-900 dark:text-white">
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-200">
                    {serviceRequest.status}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Price</label>
                <p className="mt-1 text-sm text-gray-900 dark:text-white">
                  {serviceRequest.pricingInfo?.currency 
                    ? (typeof serviceRequest.pricingInfo.currency === 'object' 
                        ? serviceRequest.pricingInfo.currency.code 
                        : serviceRequest.pricingInfo.currency)
                    : 'N/A'} {serviceRequest.pricingInfo?.price || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Context Information */}
        {serviceRequest.context && (
          <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Context</h2>
            </div>
            <div className="px-6 py-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Label</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {serviceRequest.context.label || 'N/A'}
                  </p>
                </div>
                {serviceRequest.context.description && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {serviceRequest.context.description}
                    </p>
                  </div>
                )}
                {serviceRequest.context.status && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Context Status</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {serviceRequest.context.status}
                    </p>
                  </div>
                )}
                {serviceRequest.context.created && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {formatDate(serviceRequest.context.created)}
                    </p>
                  </div>
                )}
                {serviceRequest.context.modified && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Modified</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {formatDate(serviceRequest.context.modified)}
                    </p>
                  </div>
                )}
                {serviceRequest.context.validUntil && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Valid Until</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {formatDate(serviceRequest.context.validUntil)}
                    </p>
                  </div>
                )}
                {serviceRequest.context.paymentToken && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Payment Token</label>
                    <p className="mt-1 text-sm font-mono text-gray-900 dark:text-white">
                      {serviceRequest.context.paymentToken}
                    </p>
                  </div>
                )}
                {serviceRequest.context.url && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">URL</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white break-all">
                      <a 
                        href={serviceRequest.context.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        {serviceRequest.context.url}
                      </a>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Entity Information */}
        {serviceRequest.entity && (
          <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Entity Information</h2>
            </div>
            <div className="px-6 py-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Entity ID</label>
                  <p className="mt-1 text-sm font-mono text-gray-900 dark:text-white">
                    {serviceRequest.entity.id}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Type</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {serviceRequest.entity.type}
                  </p>
                </div>
                {serviceRequest.entity.name && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {serviceRequest.entity.name}
                    </p>
                  </div>
                )}
                {(serviceRequest.entity.firstName || serviceRequest.entity.lastName) && (
                  <>
                    {serviceRequest.entity.title && (
                      <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Title</label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {serviceRequest.entity.title}
                        </p>
                      </div>
                    )}
                    {serviceRequest.entity.firstName && (
                      <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">First Name</label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {serviceRequest.entity.firstName}
                        </p>
                      </div>
                    )}
                    {serviceRequest.entity.otherNames && (
                      <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Other Names</label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {serviceRequest.entity.otherNames}
                        </p>
                      </div>
                    )}
                    {serviceRequest.entity.lastName && (
                      <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Name</label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {serviceRequest.entity.lastName}
                        </p>
                      </div>
                    )}
                  </>
                )}
                {serviceRequest.entity.emailAddress && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {serviceRequest.entity.emailAddress}
                    </p>
                  </div>
                )}
                {serviceRequest.entity.country && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Country</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {serviceRequest.entity.country}
                    </p>
                  </div>
                )}
                {serviceRequest.entity.address && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Address</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {serviceRequest.entity.address}
                    </p>
                  </div>
                )}
                {serviceRequest.entity.owner && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Owner</label>
                    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                      <p className="text-sm text-gray-900 dark:text-white">
                        {formatOwnerName(serviceRequest.entity)}
                      </p>
                      {serviceRequest.entity.owner.emailAddress && (
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                          {serviceRequest.entity.owner.emailAddress}
                        </p>
                      )}
                      {serviceRequest.entity.owner.id && (
                        <button
                          onClick={() => router.push(`/customers/${serviceRequest.entity?.owner?.id}`)}
                          className="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          View Owner Profile →
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Invoice Information */}
        {serviceRequest.invoice && (
          <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Invoice</h2>
            </div>
            <div className="px-6 py-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Invoice ID</label>
                  <p className="mt-1 text-sm font-mono text-gray-900 dark:text-white">
                    {serviceRequest.invoice.id}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Invoice Number</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {serviceRequest.invoice.number}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Invoice Name</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {serviceRequest.invoice.name}
                  </p>
                </div>
                {serviceRequest.invoice.created && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {formatDate(serviceRequest.invoice.created)}
                    </p>
                  </div>
                )}
                {serviceRequest.invoice.modified && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Modified</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {formatDate(serviceRequest.invoice.modified)}
                    </p>
                  </div>
                )}
                {serviceRequest.invoice.validUntil && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Valid Until</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {formatDate(serviceRequest.invoice.validUntil)}
                    </p>
                  </div>
                )}
                {serviceRequest.invoice.billedTo && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Billed To</label>
                    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                      <p className="text-sm text-gray-900 dark:text-white">
                        {[serviceRequest.invoice.billedTo.firstName, serviceRequest.invoice.billedTo.otherNames, serviceRequest.invoice.billedTo.lastName]
                          .filter(Boolean)
                          .join(' ') || serviceRequest.invoice.billedTo.emailAddress || 'N/A'}
                      </p>
                      {serviceRequest.invoice.billedTo.emailAddress && (
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                          {serviceRequest.invoice.billedTo.emailAddress}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {serviceRequest.invoice.pricing && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 block">Pricing</label>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-sm text-gray-500 dark:text-gray-400">Subtotal:</span>
                          <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                            {serviceRequest.invoice.pricing?.currency 
                              ? (typeof serviceRequest.invoice.pricing.currency === 'object' 
                                  ? serviceRequest.invoice.pricing.currency.code 
                                  : serviceRequest.invoice.pricing.currency)
                              : 'N/A'} {serviceRequest.invoice.pricing?.subTotal || 'N/A'}
                          </span>
                        </div>
                        {serviceRequest.invoice.pricing?.tax && (
                          <div>
                            <span className="text-sm text-gray-500 dark:text-gray-400">Tax:</span>
                            <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                              {serviceRequest.invoice.pricing?.currency 
                                ? (typeof serviceRequest.invoice.pricing.currency === 'object' 
                                    ? serviceRequest.invoice.pricing.currency.code 
                                    : serviceRequest.invoice.pricing.currency)
                                : 'N/A'} {serviceRequest.invoice.pricing.tax}
                            </span>
                          </div>
                        )}
                        <div className="col-span-2 border-t border-gray-200 pt-2 dark:border-gray-700">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">Total:</span>
                          <span className="ml-2 text-lg font-bold text-gray-900 dark:text-white">
                            {serviceRequest.invoice.pricing?.currency 
                              ? (typeof serviceRequest.invoice.pricing.currency === 'object' 
                                  ? serviceRequest.invoice.pricing.currency.code 
                                  : serviceRequest.invoice.pricing.currency)
                              : 'N/A'} {serviceRequest.invoice.pricing?.total || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {serviceRequest.invoice.items && serviceRequest.invoice.items.length > 0 && (
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
                          {serviceRequest.invoice.items.map((item, index) => (
                            <tr key={index}>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{item.label}</td>
                              <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{item.quantity}</td>
                              <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                                {item.pricing?.currency 
                                  ? (typeof item.pricing.currency === 'object' 
                                      ? item.pricing.currency.code 
                                      : item.pricing.currency)
                                  : 'N/A'} {item.pricing?.price || 'N/A'}
                              </td>
                              <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-white">
                                {item.pricing?.currency 
                                  ? (typeof item.pricing.currency === 'object' 
                                      ? item.pricing.currency.code 
                                      : item.pricing.currency)
                                  : 'N/A'} {item.total || 'N/A'}
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
          </div>
        )}
      </div>
    </AdminLayout>
  );
}


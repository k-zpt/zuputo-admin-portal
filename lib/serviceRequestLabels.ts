/**
 * User-friendly labels for service request types and statuses.
 * API continues to use the standard codes (e.g. PENDING_PAYMENT).
 */

export const SERVICE_REQUEST_TYPE_LABELS: Record<string, string> = {
  AD_HOC: 'Ad Hoc',
  IP_REGISTRATION: 'IP Registration',
  TRADEMARK_REGISTRATION: 'Trademark Registration',
  CONTRACT_REQUEST: 'Contract Request',
  CONTRACT_REVIEW: 'Contract Review',
  COMPANY_INCORPORATION: 'Company Incorporation',
  SOLE_PROPRIETORSHIP_INCORPORATION: 'Sole Proprietorship Incorporation',
};

export const SERVICE_REQUEST_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  RECEIVED: 'Received',
  ACKNOWLEDGED: 'Acknowledged',
  PENDING_ASSESSMENT: 'Pending Assessment',
  PENDING_PAYMENT: 'Pending Payment',
  IN_PROGRESS: 'In Progress',
  UNDER_REVIEW: 'Under Review',
  TRANSFERRED: 'Transferred',
  COMPLETED: 'Completed',
};

export function formatTypeLabel(typeCode: string | undefined | null): string {
  if (typeCode == null || typeCode === '') return '—';
  return SERVICE_REQUEST_TYPE_LABELS[typeCode] ?? typeCode.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatStatusLabel(statusCode: string | undefined | null): string {
  if (statusCode == null || statusCode === '') return '—';
  return SERVICE_REQUEST_STATUS_LABELS[statusCode] ?? statusCode.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

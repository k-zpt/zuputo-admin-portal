// Common response structure
export interface ApiResponse<T> {
  code: string;
  data: T;
  msg: string;
  pagination?: Pagination;
}

export interface Pagination {
  nextCursor: string | null;
  hasNext: boolean;
  pageSize: number;
}

// Currency types
export interface Currency {
  id: string;
  name: string;
  label: string;
  code: string;
}

// Country types
export interface Country {
  id: string;
  name: string;
  code: string;
  currencies: Currency[]; // API typically returns Currency objects, not strings
  defaultCurrency?: Currency | null;
  /** Same as `defaultCurrency` when the backend uses snake_case JSON keys. */
  default_currency?: Currency | string | null;
}

export interface CreateCountryPayload {
  name: string;
  code: string;
  currencies: string[];
  defaultCurrency?: string;
}

export interface UpdateCountryPayload {
  name?: string;
  code?: string;
  currencies?: string[];
  defaultCurrency?: string;
}

// Customer types
export interface Customer {
  id: string;
  firstName?: string;
  otherNames?: string;
  lastName?: string;
  emailAddress?: string;
  type: 'INDIVIDUAL' | 'ORGANIZATION';
  country?: string;
  residentCountryName?: string;
  address?: string;
  status: string;
}

export interface NotifyCustomerPayload {
  header: string;
  content: string;
  source?: 'SYSTEM' | 'PORTAL' | 'UNKNOWN';
  type?: 'SERVICE_REQUEST' | 'INFO' | 'FEEDBACK';
}

/** PATCH /api/v1/customers/{id}/profile */
export interface UpdateCustomerProfilePayload {
  firstName?: string;
  otherNames?: string;
  lastName?: string;
  country?: string;
  /** ISO date string e.g. "1990-07-15"; null clears when supported by API */
  dateOfBirth?: string | null;
  address?: string;
}

export interface CustomerSubscription {
  id: string;
  planId: string;
  status: string;
  startDate?: string;
  endDate?: string;
  [key: string]: any; // Allow for additional subscription fields
}

export interface CustomerProfile extends Omit<Customer, 'country'> {
  country?: string | Country; // Can be string ID or full Country object
  /** ISO date or API-specific string; snake_case may appear via index signature */
  dateOfBirth?: string;
  subscription?: CustomerSubscription | null;
  /** Optional; backend may return entity ids or objects for linking usage, etc. */
  entities?: string[] | Array<{ id: string; name?: string; [key: string]: unknown }>;
  [key: string]: any; // Allow for additional profile fields
}

// Subscription Usage types
export interface SubscriptionUsageItem {
  limit: number;
  used: number;
  remaining: number;
  discount_percent: number;
  period: string;
}

export interface SubscriptionUsage {
  [serviceType: string]: SubscriptionUsageItem; // e.g., "CONTRACT_REQUEST", "CONTRACT_REVIEW"
}

export interface UpdateSubscriptionUsagePayload {
  service_request_id: string;
}

/** POST /api/v2/customers/{id}/subscription/usage */
export interface AddSubscriptionUsagePayload {
  type: string;
  status?: string;
  entity_id?: string;
  pricingInfo?: {
    price: number;
    currency: string;
  };
  context?: Record<string, unknown>;
}

// Form types
export interface FieldOption {
  label: string;
  value: string;
}

export interface Conditional {
  field: string;
  value: any;
  operator: string;
}

export interface FieldInfo {
  id: string;
  name?: string;
  label?: string;
  description?: string;
  isRequired?: boolean;
  type?: string;
  widget?: string;
  validator?: string;
  options?: FieldOption[];
  conditional?: Conditional;
}

export interface FieldsetInfo {
  id: string;
  name?: string;
  label?: string;
  description?: string;
  fields?: FieldInfo[];
  arrayConfig?: Record<string, any>;
}

export interface Form {
  id: string;
  name: string;
  label?: string;
  description?: string;
  country?: string | Country; // Can be string ID or full Country object
  featured?: boolean;
  isFeatured?: boolean;
  pricingInfo?: PricingInfo;
  fieldsets?: FieldsetInfo[];
  type?: string;
}

export interface UpdateFormPayload {
  name?: string;
  label?: string;
  description?: string;
  country?: string;
  isFeatured?: boolean;
  pricingInfo?: PricingInfo;
  fieldsets?: FieldsetInfo[];
}

// Create Form types
export interface CreateFieldPayload {
  name: string;
  label: string;
  description?: string;
  type: string;
  isRequired?: boolean;
  options?: FieldOption[];
  conditional?: Conditional;
  widget?: string;
  validator?: string;
}

export interface CreateFieldsetPayload {
  name: string;
  label?: string;
  description?: string;
  fields: CreateFieldPayload[];
  arrayConfig?: Record<string, any>;
}

// Fieldset configuration payload (for PUT /api/v2/forms/{id}/fieldsets)
export interface ConfigureFieldsetPayload {
  name: string;
  fields: Array<{
    name: string;
    label?: string;
    description?: string;
    type?: string;
  }>;
}

export interface CreateFormPayload {
  name: string;
  label: string;
  description?: string;
  type: string;
  fieldsets: CreateFieldsetPayload[];
  template: string;
  countryCode: string;
  pricingInfo: {
    price: number;
    currency: string;
  };
}

// Config types
export interface PricingConfig {
  countryId: string;
  price: string;
  currencyId: string;
}

// API response format for config
export interface ConfigPricingItem {
  country: {
    id: string;
    name: string;
    code: string;
  };
  pricingInfo: {
    price: string;
    currency: Currency;
  };
}

export interface ConfigResponse {
  trademarkClassificationPricing?: ConfigPricingItem[];
  trademarkClassPricing?: ConfigPricingItem[];
  trademarkSearchPricing?: ConfigPricingItem[];
  contractReviewPricing?: ConfigPricingItem[];
  created?: string;
  modified?: string;
}

// Internal form format
export interface Config {
  trademarkClassificationPricing?: PricingConfig[];
  trademarkClassPricing?: PricingConfig[];
  trademarkSearchPricing?: PricingConfig[];
  contractReviewPricing?: PricingConfig[];
}

export interface UpdateConfigPayload {
  trademarkClassificationPricing?: PricingConfig[];
  trademarkClassPricing?: PricingConfig[];
  trademarkSearchPricing?: PricingConfig[];
  contractReviewPricing?: PricingConfig[];
}

// Message Template types
export interface MessageTemplate {
  id: string;
  type: string;
  name: string;
  code?: string;
  title?: string;
  content: string;
  created?: string;
  modified?: string;
}

export interface CreateMessageTemplatePayload {
  type: string;
  name: string;
  code?: string;
  title?: string;
  content: string;
}

export interface UpdateMessageTemplatePayload {
  type?: string;
  name?: string;
  code?: string;
  title?: string;
  content?: string;
}

// Transaction types
export interface TransactionCustomer {
  id: string;
  firstName: string;
  otherNames?: string | null;
  lastName?: string | null;
  emailAddress: string;
  type: string;
  country?: {
    id: string;
    name: string;
    code: string;
  } | null;
  residentCountryName?: string | null;
  address?: string | null;
  status: string;
}

export interface Transaction {
  id: string;
  amount: string;
  status: string;
  statusDescription?: string | null;
  type: string;
  narration?: string | null;
  paymentReference: string;
  providerReference: string;
  customer: TransactionCustomer;
}

// Payment Link types
export interface PricingInfo {
  price: number;
  currency: string | Currency; // Can be string code or full Currency object
}

// Subscription Plan types
export type BillingFrequency = 'MONTHLY' | 'YEARLY' | 'WEEKLY' | 'DAILY' | 'QUARTERLY' | 'BIANNUAL';

export interface PlanBenefit {
  serviceType: string;
  description: string;
  active: boolean;
  limit: number;
  discountPercent: number;
}

export interface SubscriptionPlan {
  id: string;
  code: string;
  label: string;
  country: string | Country;
  active: boolean;
  billingFrequency?: BillingFrequency;
  pricingInfo?: PricingInfo;
  description?: string;
  features?: string[];
  benefits?: PlanBenefit[];
}

export interface CreateSubscriptionPlanPayload {
  code?: string;
  label: string;
  country: string;
  active: boolean;
  billingFrequency: BillingFrequency;
  pricingInfo: {
    price: number;
    currency: string;
  };
  description?: string;
  features?: string[];
  benefits?: PlanBenefit[];
}

export interface UpdateSubscriptionPlanPayload {
  country?: string;
  active?: boolean;
  label?: string;
  description?: string;
  billingFrequency?: BillingFrequency;
  features?: string[];
  pricingInfo?: {
    price: number;
    currency: string;
  };
  benefits?: PlanBenefit[];
}

export interface AdhocRequest {
  id: string;
  label: string;
  description?: string;
  status: string;
  paymentToken: string;
  url: string;
  validUntil: string;
  modified: string;
  created: string;
}

export interface CreateAdhocRequestPayload {
  countryId: string;
  label: string;
  description?: string;
  pricingInfo: PricingInfo;
  discountProgramIds?: string[];
  customerId?: string;
  validUntil?: string | number; // Accepts ISO/date string or epoch ms (backend expects an exact date)
}

export interface UpdateAdhocRequestPayload {
  customerId: string;
}

export interface PaymentResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

// Notifier types
export interface CreateNotificationPayload {
  header: string;
  content: string;
  recipientId: string;
  type: string;
  source: string;
}

export interface AppNotification {
  id: string;
  header: string;
  content: string;
  hasBeenRead: boolean;
  created: string;
  type?: string;
  source?: string;
  [key: string]: unknown;
}

export interface SendEmailPayload {
  recipients: string[];
  subject: string;
  content: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: string; // Base64 encoded file content
    contentType: string; // e.g., 'application/pdf'
  }>;
}

// Service Request types
export interface ServiceRequestContext {
  id: string;
  label: string;
  description?: string;
  status: string;
  paymentToken?: string;
  url?: string;
  validUntil?: string;
  modified?: string;
  created?: string;
}

export interface ServiceRequestEntity {
  id: string;
  title?: string | null;
  firstName?: string | null;
  otherNames?: string | null;
  lastName?: string | null;
  name?: string;
  emailAddress?: string | null;
  type: string;
  owner?: Customer;
  country?: string | null;
  address?: string;
  isDefault?: boolean;
}

export interface ServiceRequestInvoiceItem {
  label: string;
  quantity: number;
  pricing: {
    price: string;
    currency: Currency;
  };
  total: string;
}

export interface ServiceRequestInvoice {
  id: string;
  name: string;
  number: string;
  status?: string; // Payment status: PAID, UNPAID, CANCELLED
  billedTo: Customer;
  items: ServiceRequestInvoiceItem[];
  pricing: {
    currency: Currency;
    subTotal: string;
    discounts?: Record<string, unknown>;
    tax?: string;
    total: string;
  };
  validUntil?: string;
  modified?: string;
  created?: string;
}

/** Single entry in a service request's status change log. */
export interface ServiceRequestStatusLogEntry {
  status?: string;
  fromStatus?: string;
  toStatus?: string;
  /** When this status was set (API may use created, timestamp, or at). */
  created?: string;
  timestamp?: string;
  at?: string;
  updatedBy?: string;
  by?: string;
  /** Free-text note (API may use notes or note). */
  notes?: string | null;
  note?: string;
  [key: string]: unknown;
}

export interface ServiceRequest {
  id: string;
  type: string;
  status: string;
  pricingInfo?: {
    price: string;
    currency: Currency;
  } | null;
  context?: ServiceRequestContext;
  entity?: ServiceRequestEntity;
  invoice?: ServiceRequestInvoice;
  created?: string;
  modified?: string;
  /** Status change history (API may use statusLogs, statusLog, or status_log). */
  statusLogs?: ServiceRequestStatusLogEntry[];
  statusLog?: ServiceRequestStatusLogEntry[];
}

export interface UpdateServiceRequestPayload {
  status: string;
  notes?: string;
  pricingInfo?: {
    price: number;
    currency: string; // Currency id (never use label/code)
  };
}

// Discount Program types
export interface DiscountProgramConfig {
  strategy: 'PERCENTAGE' | 'FIXED';
  value: number;
}

export interface ReferrerCommission {
  id: string;
  commission: DiscountProgramConfig;
}

export interface CustomerCommission {
  commission: DiscountProgramConfig;
}

export interface ReferralConfig {
  referrer: ReferrerCommission;
  customer: CustomerCommission;
}

export interface SubsidyConfig {
  strategy: 'PERCENTAGE' | 'FIXED';
  value: number;
}

export interface DiscountProgram {
  id: string;
  code: string;
  type: 'SUBSIDY' | 'REFERRAL';
  name: string;
  description?: string;
  config: SubsidyConfig | ReferralConfig;
  applicableCountries?: string[];
  isActive?: boolean;
  validUntil?: string;
  perCustomerAvailLimit?: number;
  totalCustomerAvailLimit?: number;
  created?: string;
  modified?: string;
}

export interface CreateDiscountProgramPayload {
  code: string;
  type: 'SUBSIDY' | 'REFERRAL';
  name: string;
  description?: string;
  config: SubsidyConfig | ReferralConfig;
  applicableCountries?: string[];
  isActive?: boolean;
  validUntil?: string;
  perCustomerAvailLimit?: number;
  totalCustomerAvailLimit?: number;
}

export interface UpdateDiscountProgramPayload {
  name?: string;
  description?: string;
  applicableCountries?: string[];
  isActive?: boolean;
  validUntil?: string;
  perCustomerAvailLimit?: number;
  totalCustomerAvailLimit?: number;
}

// Offline Invoice types
export interface InvoiceItemPayload {
  date: string | number; // epoch ms or ISO string
  service: string;
  description: string;
  quantity: number;
  rate: number;
}

export interface CustomerInfoPayload {
  name: string;
  address: string;
  emailAddress: string;
}

export interface OfflineInvoicePayload {
  date: string | number;
  validUntil: string | number;
  terms?: string;
  items: InvoiceItemPayload[];
  notes?: string;
  tax: number;
  discountRate?: number;
  amountPaid?: number;
  currencyId: string;
  countryId: string;
  customerInfo: CustomerInfoPayload;
}

export interface EmailInfoPayload {
  content: string;
  recipients: string[];
  bccRecipients?: string[];
  ccRecipients?: string[];
  subject?: string;
}

export interface CreateOfflineInvoicePayload {
  invoiceInfo: OfflineInvoicePayload;
  emailInfo: EmailInfoPayload;
}

// System / background jobs
/** Response shape for GET /api/v2/system/jobs/config (backend may extend fields). */
export type BackgroundJobConfig = Record<string, unknown>;

export const SYSTEM_JOB_STATUSES = ['ACTIVE', 'PAUSED', 'DISABLED'] as const;
export type SystemJobStatus = (typeof SYSTEM_JOB_STATUSES)[number];

export interface UpdateRenewalOffsetsPayload {
  offsets: number[];
}

export interface UpdateJobSpawnTimePayload {
  hour: number;
  minute: number;
}

export interface CreateBackgroundJobPayload {
  name: string;
  description: string;
  status: SystemJobStatus;
}

/** Response for POST /api/v2/system/jobs (fields depend on backend). */
export type BackgroundJob = Record<string, unknown>;

/** Single job from GET /api/v2/system/jobs (shape may vary by backend). */
export type SystemJobRecord = {
  id?: string;
  name?: string;
  description?: string;
  status?: string;
  [key: string]: unknown;
};

// Scheduling / bookings
export interface SchedulingBookingCustomer {
  id: string;
  email?: string;
  name?: string;
}

export interface SchedulingBookingRescheduleEntry {
  [key: string]: unknown;
}

export interface SchedulingBooking {
  id: string;
  lawyerEmail: string;
  customer: SchedulingBookingCustomer;
  start: string;
  end: string;
  status: string;
  notes?: string | null;
  meet_url?: string | null;
  timezone: string;
  created?: string;
  modified?: string;
  rescheduleLog?: SchedulingBookingRescheduleEntry[];
}

/** PATCH .../bookings/{id}/confirm or /reject response (unwrapped by backend). */
export interface SchedulingBookingActionResponse {
  status: string;
  meet_url?: string | null;
}

export interface RejectBookingPayload {
  notes: string;
}

export interface RescheduleBookingPayload {
  new_start: string;
  new_end: string;
  timezone: string;
  proposed_by: string;
}


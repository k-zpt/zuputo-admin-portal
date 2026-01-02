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
  currencies: Currency[]; // API always returns Currency objects, not strings
  defaultCurrency?: Currency | null;
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

export interface CustomerSubscription {
  id: string;
  planId: string;
  status: string;
  startDate?: string;
  endDate?: string;
  [key: string]: any; // Allow for additional subscription fields
}

export interface CustomerProfile extends Customer {
  subscription?: CustomerSubscription | null;
  [key: string]: any; // Allow for additional profile fields
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
export interface SubscriptionPlan {
  id: string;
  code: string;
  label: string;
  country: string | Country;
  active: boolean;
  monthlyPricingInfo?: PricingInfo;
  yearlyPricingInfo?: PricingInfo;
  description?: string;
  features?: string[];
}

export interface CreateSubscriptionPlanPayload {
  code: string;
  label: string;
  country: string;
  active: boolean;
  monthlyPricingInfo: {
    price: number;
    currency: string;
  };
  yearlyPricingInfo: {
    price: number;
    currency: string;
  };
  description?: string;
  features?: string[];
}

export interface UpdateSubscriptionPlanPayload {
  country?: string;
  active?: boolean;
  label?: string;
  description?: string;
  features?: string[];
  monthlyPricingInfo?: {
    price: number;
    currency: string;
  };
  yearlyPricingInfo?: {
    price: number;
    currency: string;
  };
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

export interface SendEmailPayload {
  recipients: string[];
  subject: string;
  content: string;
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

export interface ServiceRequest {
  id: string;
  type: string;
  status: string;
  pricingInfo: {
    price: string;
    currency: Currency;
  };
  context?: ServiceRequestContext;
  entity?: ServiceRequestEntity;
  invoice?: ServiceRequestInvoice;
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


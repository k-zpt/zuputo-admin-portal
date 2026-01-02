export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
export const PAYMENT_LINK_BASE_URL = process.env.NEXT_PUBLIC_PAYMENT_LINK_BASE_URL || 'http://localhost:8001';

export const API_ENDPOINTS = {
  // Currencies
  currencies: '/api/v1/currencies',
  currencyById: (id: string) => `/api/v1/currencies/${id}`,
  
  // Countries
  countries: '/api/v1/countries',
  countryById: (id: string) => `/api/v1/countries/${id}`,
  
  // Customers
  customers: '/api/v2/customers',
  customerById: (id: string) => `/api/v2/customers/${id}`,
  customerProfile: (id: string) => `/api/v1/customers/${id}/profile`,
  notifyCustomer: (id: string) => `/api/v2/customers/${id}/notify`,
  
  // Service Requests
  serviceRequests: '/api/v2/service-requests',
  serviceRequestById: (id: string) => `/api/v2/service-requests/${id}`,
  
  // Transactions
  transactions: '/api/v2/transactions',
  
  // Forms
  forms: '/api/v1/forms',
  formById: (id: string) => `/api/v1/forms/${id}`,
  formTemplateUpload: (id: string) => `/api/v2/forms/${id}/template`,
  formTemplateDownload: (id: string) => `/api/v2/forms/${id}/template`,
  formConfigureFieldsets: (id: string) => `/api/v2/forms/${id}/fieldsets`,
  
  // Configs
  configs: '/api/v1/configs',
  
  // Message Templates
  messageTemplates: '/api/v2/message-templates',
  messageTemplateById: (id: string) => `/api/v2/message-templates/${id}`,
  
  // Payment Links
  adhocRequests: '/api/v2/adhoc-requests',
  adhocRequestByToken: (token: string) => `/api/v2/adhoc-requests/${token}`,
  initiatePayment: (customerId: string, invoiceId: string) => 
    `/api/v1/customers/${customerId}/invoices/${invoiceId}/payments`,
  
  // Notifier
  sendEmail: '/api/v2/notifier/email',
  
  // Notifications
  notifications: '/api/v1/notifications',
  
  // Discount Programs
  discountPrograms: '/api/v2/discount-programs',
  discountProgramsV1: '/api/v1/discount-programs',
  discountProgramById: (id: string) => `/api/v1/discount-programs/${id}`,
  
  // Subscription Plans
  subscriptionPlans: '/api/v2/subscription-plans',
  subscriptionPlanById: (id: string) => `/api/v2/subscription-plans/${id}`,
} as const;


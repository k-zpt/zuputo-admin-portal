export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
export const PAYMENT_LINK_BASE_URL = process.env.NEXT_PUBLIC_PAYMENT_LINK_BASE_URL || 'http://localhost:8001';

// Application configuration
export const FINANCE_EMAIL = process.env.NEXT_PUBLIC_FINANCE_EMAIL || 'finance@zuputo.com';

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
  customerEntities: (customerId: string) => `/api/v1/customers/${customerId}/entities`,
  notifyCustomer: (id: string) => `/api/v2/customers/${id}/notify`,
  customerSubscriptionUsage: (id: string) => `/api/v2/customers/${id}/subscription/usage`,
  
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
  // Mail Compose (new API with bcc/cc support)
  mailCompose: '/api/v2/mail/compose',
  // Offline Invoices
  offlineInvoices: '/api/v2/offline-invoices',
  
  // Notifications
  notifications: '/api/v1/notifications',
  
  // Discount Programs
  discountPrograms: '/api/v2/discount-programs',
  discountProgramsV1: '/api/v1/discount-programs',
  discountProgramById: (id: string) => `/api/v1/discount-programs/${id}`,
  
  // Subscription Plans
  subscriptionPlans: '/api/v2/subscription-plans',
  subscriptionPlanById: (id: string) => `/api/v2/subscription-plans/${id}`,

  // System / background jobs
  systemJobsConfig: '/api/v2/system/jobs/config',
  systemJobs: '/api/v2/system/jobs',
  systemJobTrigger: (jobName: string) => `/api/v2/system/jobs/${jobName}/trigger`,
  systemJobsTriggerSpawn: '/api/v2/system/jobs/trigger-spawn',
  systemJobsEnable: '/api/v2/system/jobs/enable',
  systemJobsDisable: '/api/v2/system/jobs/disable',
  systemJobsSpawnTime: '/api/v2/system/jobs/spawn-time',
  systemJobConfigRenewalOffsets: '/api/v2/system/job-config/renewal-offsets',
} as const;


import { apiClient } from './client';
import { API_ENDPOINTS } from './config';
import type {
  Currency,
  Country,
  CreateCountryPayload,
  UpdateCountryPayload,
  Customer,
  NotifyCustomerPayload,
  Form,
  Config,
  UpdateConfigPayload,
  AdhocRequest,
  CreateAdhocRequestPayload,
  UpdateAdhocRequestPayload,
  PaymentResponse,
  SendEmailPayload,
  SubscriptionPlan,
  CreateSubscriptionPlanPayload,
  UpdateSubscriptionPlanPayload,
  ApiResponse,
} from './types';

// Currency services
export const currencyService = {
  list: async (params?: { page?: number; limit?: number }) => {
    return apiClient.get<Currency[]>(API_ENDPOINTS.currencies, params);
  },
  
  getById: async (id: string) => {
    return apiClient.get<Currency>(API_ENDPOINTS.currencyById(id));
  },
  
  create: async (data: { name: string; label: string; code: string }) => {
    return apiClient.post<Currency>(API_ENDPOINTS.currencies, data);
  },
};

// Country services
export const countryService = {
  list: async (params?: { page?: number; limit?: number }) => {
    return apiClient.get<Country[]>(API_ENDPOINTS.countries, params);
  },
  
  getById: async (id: string) => {
    return apiClient.get<Country>(API_ENDPOINTS.countryById(id));
  },
  
  create: async (data: CreateCountryPayload) => {
    return apiClient.post<Country>(API_ENDPOINTS.countries, data);
  },
  
  update: async (id: string, data: UpdateCountryPayload) => {
    return apiClient.patch<Country>(API_ENDPOINTS.countryById(id), data);
  },
};

// Customer services
export const customerService = {
  list: async (params?: { cursor?: string; limit?: number }) => {
    return apiClient.get<Customer[]>(API_ENDPOINTS.customers, params);
  },
  
  search: async (query: string, params?: { cursor?: string; limit?: number }) => {
    return apiClient.get<Customer[]>(API_ENDPOINTS.customers, {
      ...params,
      q: query,
    });
  },
  
  getProfile: async (id: string) => {
    return apiClient.get<import('./types').CustomerProfile>(API_ENDPOINTS.customerProfile(id));
  },
  
  notify: async (customerId: string, data: NotifyCustomerPayload) => {
    return apiClient.post<{ success: boolean }>(API_ENDPOINTS.notifyCustomer(customerId), data);
  },
};

// Form services
export const formService = {
  list: async (params?: { page?: number; limit?: number; q?: string; featured?: boolean }) => {
    return apiClient.get<Form[]>(API_ENDPOINTS.forms, params);
  },
  
  getById: async (id: string) => {
    return apiClient.get<Form>(API_ENDPOINTS.formById(id));
  },
  
  create: async (data: import('./types').CreateFormPayload) => {
    return apiClient.post<Form>(API_ENDPOINTS.forms, data);
  },
  
  update: async (id: string, data: import('./types').UpdateFormPayload) => {
    return apiClient.patch<Form>(API_ENDPOINTS.formById(id), data);
  },
  
  uploadTemplate: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.put<{
      template_uploaded: boolean;
      file_location?: string;
      filename?: string;
      file_size?: number;
      extraction_results?: {
        valid_variables: string[];
        invalid_variables: string[];
        total_variables_found: number;
      };
      status?: 'success' | 'has_errors';
      upload_timestamp?: string;
      backup_created?: string;
    }>(API_ENDPOINTS.formTemplateUpload(id), formData);
  },
  
  getTemplateInfo: async (id: string) => {
    return apiClient.get<{
      exists: boolean;
      file_location?: string;
      filename?: string;
      file_size?: number;
      upload_timestamp?: string;
    }>(API_ENDPOINTS.formTemplateDownload(id));
  },
  
  configureFieldsets: async (id: string, fieldsets: import('./types').ConfigureFieldsetPayload[]) => {
    return apiClient.put<{ success: boolean }>(API_ENDPOINTS.formConfigureFieldsets(id), fieldsets);
  },
};

// Config services
export const configService = {
  get: async () => {
    return apiClient.get<import('./types').ConfigResponse>(API_ENDPOINTS.configs);
  },
  
  update: async (data: UpdateConfigPayload) => {
    return apiClient.patch<import('./types').ConfigResponse>(API_ENDPOINTS.configs, data);
  },
};

// Message Template services
export const messageTemplateService = {
  list: async (params?: { code?: string }) => {
    return apiClient.get<import('./types').MessageTemplate[]>(API_ENDPOINTS.messageTemplates, params);
  },
  
  getById: async (id: string) => {
    return apiClient.get<import('./types').MessageTemplate>(API_ENDPOINTS.messageTemplateById(id));
  },
  
  create: async (data: import('./types').CreateMessageTemplatePayload) => {
    return apiClient.post<import('./types').MessageTemplate>(API_ENDPOINTS.messageTemplates, data);
  },
  
  update: async (id: string, data: import('./types').UpdateMessageTemplatePayload) => {
    return apiClient.patch<import('./types').MessageTemplate>(API_ENDPOINTS.messageTemplateById(id), data);
  },
};

// Payment Link services
export const paymentLinkService = {
  generate: async (data: CreateAdhocRequestPayload) => {
    return apiClient.post<AdhocRequest>(API_ENDPOINTS.adhocRequests, data);
  },
  
  getByToken: async (token: string) => {
    return apiClient.get<AdhocRequest>(API_ENDPOINTS.adhocRequestByToken(token));
  },
  
  update: async (token: string, data: UpdateAdhocRequestPayload) => {
    return apiClient.patch<AdhocRequest>(API_ENDPOINTS.adhocRequestByToken(token), data);
  },
  
  initiatePayment: async (customerId: string, invoiceId: string) => {
    return apiClient.post<PaymentResponse>(API_ENDPOINTS.initiatePayment(customerId, invoiceId));
  },
};

// Notifier services
export const notifierService = {
  sendEmail: async (data: SendEmailPayload) => {
    return apiClient.post<{ success: boolean }>(API_ENDPOINTS.sendEmail, data);
  },
};

// Notification services
export const notificationService = {
  create: async (data: import('./types').CreateNotificationPayload) => {
    return apiClient.post<{ success: boolean }>(API_ENDPOINTS.notifications, data);
  },
};

// Service Request services
export const serviceRequestService = {
  list: async (params?: { cursor?: string; limit?: number; type?: string; status?: string; customerId?: string }) => {
    return apiClient.get<import('./types').ServiceRequest[]>(API_ENDPOINTS.serviceRequests, params);
  },
  
  getById: async (id: string) => {
    return apiClient.get<import('./types').ServiceRequest>(API_ENDPOINTS.serviceRequestById(id));
  },
};

// Transaction services
export const transactionService = {
  list: async (params?: { cursor?: string; limit?: number; status?: string }) => {
    return apiClient.get<import('./types').Transaction[]>(API_ENDPOINTS.transactions, params);
  },
};

// Discount Program services
export const discountProgramService = {
  list: async (params?: { q?: string; cursor?: string; limit?: number }) => {
    return apiClient.get<import('./types').DiscountProgram[]>(API_ENDPOINTS.discountPrograms, params);
  },
  getById: async (id: string) => {
    return apiClient.get<import('./types').DiscountProgram>(API_ENDPOINTS.discountProgramById(id));
  },
  create: async (data: import('./types').CreateDiscountProgramPayload) => {
    return apiClient.post<import('./types').DiscountProgram>(API_ENDPOINTS.discountProgramsV1, data);
  },
  update: async (id: string, data: import('./types').UpdateDiscountProgramPayload) => {
    return apiClient.patch<import('./types').DiscountProgram>(API_ENDPOINTS.discountProgramById(id), data);
  },
};

// Subscription Plan services
export const subscriptionPlanService = {
  list: async (params?: { q?: string; cursor?: string; limit?: number }) => {
    return apiClient.get<SubscriptionPlan[]>(API_ENDPOINTS.subscriptionPlans, params);
  },
  getById: async (id: string) => {
    return apiClient.get<SubscriptionPlan>(API_ENDPOINTS.subscriptionPlanById(id));
  },
  create: async (data: CreateSubscriptionPlanPayload) => {
    return apiClient.post<SubscriptionPlan>(API_ENDPOINTS.subscriptionPlans, data);
  },
  update: async (id: string, data: UpdateSubscriptionPlanPayload) => {
    return apiClient.patch<SubscriptionPlan>(API_ENDPOINTS.subscriptionPlanById(id), data);
  },
};


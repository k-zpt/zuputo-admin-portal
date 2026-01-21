import { API_ENDPOINTS } from './config';
import type { ApiResponse } from './types';

class ApiClient {
  // Use Next.js API routes as proxy to avoid CORS issues
  private baseUrl: string = '/api';

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    // Endpoints already include the full path (e.g., /api/v1/currencies)
    // We route through Next.js API proxy at /api, so we need to construct the path correctly
    // Remove leading slash from endpoint
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const url = `${this.baseUrl}/${cleanEndpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorData: any = {};
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          errorData = await response.json();
        } else {
          const text = await response.text();
          errorData = { msg: text || response.statusText };
        }
      } catch (parseError) {
        // If we can't parse the error response, use status text
        errorData = { msg: response.statusText || 'Unknown error' };
      }
      
      const errorMessage = errorData.msg || errorData.message || `API request failed: ${response.statusText} (${response.status})`;
      const error = new Error(errorMessage) as Error & { response?: any; errorData?: any; status?: number };
      error.response = response;
      error.errorData = errorData;
      error.status = response.status;
      throw error;
    }

    return response.json();
  }

  async get<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>): Promise<ApiResponse<T>> {
    const url = new URL(endpoint, 'http://dummy.com');
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const queryString = url.search ? `?${url.searchParams.toString()}` : '';
    return this.request<T>(endpoint + queryString);
  }

  async post<T>(endpoint: string, data?: FormData | unknown): Promise<ApiResponse<T>> {
    // For file uploads (FormData), don't set Content-Type header
    // Let the browser set it with the boundary for multipart/form-data
    const isFormData = data instanceof FormData;
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const url = `${this.baseUrl}/${cleanEndpoint}`;
    
    const headers: HeadersInit = {};
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: isFormData ? data : (data ? JSON.stringify(data) : undefined),
    });

    if (!response.ok) {
      let errorData: any = {};
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          errorData = await response.json();
        } else {
          const text = await response.text();
          errorData = { msg: text || response.statusText };
        }
      } catch (parseError) {
        // If we can't parse the error response, use status text
        errorData = { msg: response.statusText || 'Unknown error' };
      }
      
      const errorMessage = errorData.msg || errorData.message || `API request failed: ${response.statusText} (${response.status})`;
      const error = new Error(errorMessage) as Error & { response?: any; errorData?: any; status?: number };
      error.response = response;
      error.errorData = errorData;
      error.status = response.status;
      throw error;
    }

    return response.json();
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: FormData | unknown): Promise<ApiResponse<T>> {
    // For file uploads (FormData), don't set Content-Type header
    // Let the browser set it with the boundary for multipart/form-data
    const isFormData = data instanceof FormData;
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const url = `${this.baseUrl}/${cleanEndpoint}`;
    
    const headers: HeadersInit = {};
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }
    
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: isFormData ? data : (data ? JSON.stringify(data) : undefined),
    });

    if (!response.ok) {
      let errorData: any = {};
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          errorData = await response.json();
        } else {
          const text = await response.text();
          errorData = { msg: text || response.statusText };
        }
      } catch (parseError) {
        // If we can't parse the error response, use status text
        errorData = { msg: response.statusText || 'Unknown error' };
      }
      
      const errorMessage = errorData.msg || errorData.message || `API request failed: ${response.statusText} (${response.status})`;
      const error = new Error(errorMessage) as Error & { response?: any; errorData?: any; status?: number };
      error.response = response;
      error.errorData = errorData;
      error.status = response.status;
      throw error;
    }

    return response.json();
  }
}

export const apiClient = new ApiClient();


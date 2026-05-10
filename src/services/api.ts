import { toast } from 'sonner';

interface FetchOptions extends RequestInit {
  retries?: number;
  retryDelay?: number;
  silent?: boolean; // If true, won't show default error toast
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export const apiService = {
  async fetch<T>(url: string, options: FetchOptions = {}): Promise<T> {
    const { retries = 2, retryDelay = 1000, silent = false, ...fetchOptions } = options;
    
    for (let i = 0; i <= retries; i++) {
      try {
        const response = await fetch(url, fetchOptions);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: response.statusText }));
          throw new ApiError(response.status, errorData.message || response.statusText || 'Unknown API Error');
        }
        return await response.json();
      } catch (error) {
        const isClientError = error instanceof ApiError && error.status >= 400 && error.status < 500;
        
        // Don't retry on client errors (4xx) or if we've exhausted retries
        if (isClientError || i === retries) {
           if (!silent) {
              const errorMessage = error instanceof Error ? error.message : 'Network error';
              toast.error(`API Error: ${errorMessage}`);
           }
           throw error;
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, i)));
      }
    }
    throw new Error('Unreachable');
  },
  
  get<T>(url: string, options?: FetchOptions): Promise<T> {
    return apiService.fetch<T>(url, { ...options, method: 'GET' });
  },
  
  post<T>(url: string, data?: any, options?: FetchOptions): Promise<T> {
    return apiService.fetch<T>(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(data),
    });
  },
  
  put<T>(url: string, data?: any, options?: FetchOptions): Promise<T> {
    return apiService.fetch<T>(url, {
      ...options,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(data),
    });
  },
  
  delete<T>(url: string, options?: FetchOptions): Promise<T> {
    return apiService.fetch<T>(url, { ...options, method: 'DELETE' });
  }
};

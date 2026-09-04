import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export interface ApiClientConfig {
  baseURL: string;
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  onTokenRefreshed: (tokens: { accessToken: string; refreshToken: string }) => void;
  onAuthFailure: () => void;
}

export class ApiClient {
  private http: AxiosInstance;
  private config: ApiClientConfig;
  private isRefreshing = false;
  private refreshQueue: Array<(token: string) => void> = [];

  constructor(config: ApiClientConfig) {
    this.config = config;
    this.http = axios.create({
      baseURL: config.baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor: attach access token
    this.http.interceptors.request.use((reqConfig) => {
      const token = this.config.getAccessToken();
      if (token && reqConfig.headers) {
        reqConfig.headers['Authorization'] = `Bearer ${token}`;
      }
      return reqConfig;
    });

    // Response interceptor: handle 401 and refresh token
    this.http.interceptors.response.use(
      (res) => res,
      async (error) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          if (this.isRefreshing) {
            return new Promise((resolve) => {
              this.refreshQueue.push((token: string) => {
                if (originalRequest.headers) {
                  originalRequest.headers['Authorization'] = `Bearer ${token}`;
                }
                resolve(this.http(originalRequest));
              });
            });
          }

          this.isRefreshing = true;
          try {
            const refreshToken = this.config.getRefreshToken();
            if (!refreshToken) throw new Error('No refresh token');

            const res = await axios.post<{ accessToken: string; refreshToken: string }>(
              `${this.config.baseURL}/auth/refresh`,
              { refreshToken }
            );

            const { accessToken, refreshToken: newRefresh } = res.data;
            this.config.onTokenRefreshed({ accessToken, refreshToken: newRefresh });

            this.refreshQueue.forEach((cb) => cb(accessToken));
            this.refreshQueue = [];

            if (originalRequest.headers) {
              originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
            }
            return this.http(originalRequest);
          } catch {
            this.refreshQueue = [];
            this.config.onAuthFailure();
            return Promise.reject(error);
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(this.normalizeError(error));
      }
    );
  }

  private normalizeError(error: unknown): ApiError {
    if (axios.isAxiosError(error)) {
      return {
        message: error.response?.data?.message ?? error.message ?? 'Network error',
        statusCode: error.response?.status ?? 0,
        errors: error.response?.data?.errors ?? null,
      };
    }
    return { message: 'Unknown error', statusCode: 0, errors: null };
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const res: AxiosResponse<T> = await this.http.get(url, config);
    return res.data;
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const res: AxiosResponse<T> = await this.http.post(url, data, config);
    return res.data;
  }

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const res: AxiosResponse<T> = await this.http.put(url, data, config);
    return res.data;
  }

  async patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const res: AxiosResponse<T> = await this.http.patch(url, data, config);
    return res.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const res: AxiosResponse<T> = await this.http.delete(url, config);
    return res.data;
  }
}

export interface ApiError {
  message: string;
  statusCode: number;
  errors: Record<string, string[]> | null;
}

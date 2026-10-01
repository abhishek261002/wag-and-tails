import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export interface ApiClientConfig {
  baseURL: string;
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  onTokenRefreshed: (tokens: { accessToken: string; refreshToken: string }) => void | Promise<void>;
  onAuthFailure: () => void;
}

/**
 * Reads the token pair from an auth response. The API nests it as `{ user, tokens: { accessToken, refreshToken } }`;
 * a flat `{ accessToken, refreshToken }` is accepted too. Anything else (missing or non-string values) is rejected
 * here, so a bad response can never be written into secure storage.
 */
export function extractTokens(data: unknown): { accessToken: string; refreshToken: string } | null {
  const root = data as any;
  const t = root?.tokens ?? root;
  const ok = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
  return ok(t?.accessToken) && ok(t?.refreshToken) ? { accessToken: t.accessToken, refreshToken: t.refreshToken } : null;
}

export class ApiClient {
  private http: AxiosInstance;
  private config: ApiClientConfig;
  // One refresh at a time: every request that hits a 401 while it runs waits on the same promise.
  private refreshPromise: Promise<string> | null = null;

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

      // A multipart body is only parseable if its Content-Type carries the
      // boundary axios generates from the FormData itself. Both this
      // client's JSON default and callers passing an explicit
      // 'multipart/form-data' overwrite that header with a boundary-less
      // value, so the server sees no parts at all — every upload silently
      // stored nothing. Dropping the header lets axios set the real one.
      if (typeof FormData !== 'undefined' && reqConfig.data instanceof FormData && reqConfig.headers) {
        delete reqConfig.headers['Content-Type'];
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
          try {
            const accessToken = await this.refreshAccessToken();
            if (originalRequest.headers) {
              originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
            }
            return this.http(originalRequest);
          } catch {
            // The session is only cleared (in doRefresh) when the server rejected the refresh token. A network
            // blip must not destroy a still-valid session; the next request simply tries the refresh again.
            return Promise.reject(this.normalizeError(error));
          }
        }

        return Promise.reject(this.normalizeError(error));
      }
    );
  }

  private refreshAccessToken(): Promise<string> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.doRefresh().finally(() => { this.refreshPromise = null; });
    }
    return this.refreshPromise;
  }

  private async doRefresh(): Promise<string> {
    const refreshToken = this.config.getRefreshToken();
    if (!refreshToken) {
      this.config.onAuthFailure();
      throw new Error('No refresh token');
    }
    let data: unknown;
    try {
      data = (await axios.post(`${this.config.baseURL}/auth/refresh`, { refreshToken })).data;
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status === 401 || status === 403) this.config.onAuthFailure();
      throw err;
    }
    const tokens = extractTokens(data);
    if (!tokens) throw new Error('Unexpected refresh response');
    await this.config.onTokenRefreshed(tokens);
    return tokens.accessToken;
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

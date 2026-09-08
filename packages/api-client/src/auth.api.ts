import type { ApiClient } from './client.js';
import type {
  AuthResponse,
  AuthTokens,
  OtpRequest,
  OtpVerify,
  RegisterRequest,
  LoginRequest,
} from '@wag/shared-types';

export class AuthApi {
  constructor(private client: ApiClient) {}

  requestOtp(data: OtpRequest): Promise<{ message: string }> {
    return this.client.post('/auth/otp/request', data);
  }

  // New phone: check-only, returns a session token to pass into register().
  // Existing phone: this check *is* the login, so it consumes the code and
  // returns full tokens directly.
  verifyOtp(data: OtpVerify): Promise<
    | { isNewUser: true; sessionToken: string }
    | ({ isNewUser: false } & AuthResponse)
  > {
    return this.client.post('/auth/otp/verify', data);
  }

  register(data: RegisterRequest): Promise<AuthResponse> {
    return this.client.post('/auth/register', data);
  }

  login(data: LoginRequest): Promise<AuthResponse> {
    return this.client.post('/auth/login', data);
  }

  refresh(refreshToken: string): Promise<AuthTokens> {
    return this.client.post('/auth/refresh', { refreshToken });
  }

  logout(): Promise<void> {
    return this.client.post('/auth/logout');
  }

  registerPushToken(token: string, platform: 'ios' | 'android' | 'web'): Promise<void> {
    return this.client.post('/auth/push-token', { token, platform });
  }
}

export type UserRole = 'customer' | 'partner' | 'staff' | 'admin';

export interface User {
  id: string;
  phone: string;
  email: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  avatarUrl: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface OtpRequest {
  phone: string;
}

export interface OtpVerify {
  phone: string;
  otp: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  phone: string;
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  otp: string;
}

export interface AuthResponse {
  user: User;
  profile: UserProfile;
  tokens: AuthTokens;
}

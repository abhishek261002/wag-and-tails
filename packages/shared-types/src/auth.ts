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

export interface RegisterPartnerRequest {
  email: string;
  password: string;
  phone: string;
  firstName: string;
  lastName: string;
  age: number;
  address: string;
  city: string;
  /** What the partner wants to do: groomer, walker, or both. */
  modes: ('grooming' | 'walking')[];
  /** Groomers only: also take cat grooming jobs (default true). */
  groomsCats?: boolean;
  /** Proof of a completed DigiLocker verification, from getDigilockerStatus(). */
  kycToken: string;
}

export interface DigilockerStartRequest {
  /** Explicit consent to fetch Aadhaar details for KYC. Must be true. */
  consent: boolean;
  /** Deep link the DigiLocker browser session returns to. */
  appRedirect?: string;
  /** Development mock provider only. */
  name?: string;
  age?: number;
}

export interface DigilockerStartResponse {
  requestId: string;
  authorizeUrl: string;
  expiresInSeconds: number;
}

export type DigilockerFailureCode = 'DENIED' | 'UNDERAGE' | 'DUPLICATE' | 'PROVIDER' | 'EXPIRED' | 'INCOMPLETE';

export type DigilockerStatus =
  | { status: 'pending' }
  | { status: 'verified'; kycToken: string; expiresInSeconds: number; name: string | null; aadhaarLast4: string | null }
  | { status: 'cancelled' | 'failed'; code: DigilockerFailureCode; message: string };

export interface AuthResponse {
  user: User;
  profile: UserProfile;
  tokens: AuthTokens;
}

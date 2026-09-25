import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'crypto';

export interface KycIdentity {
  /** Stable id of the person at the provider (DigiLocker id). Used only to detect duplicates. */
  subjectId: string;
  name: string;
  /** YYYY-MM-DD */
  dob: string;
  gender: string | null;
  address: string | null;
  /** Last four digits of the Aadhaar when the provider releases them. */
  aadhaarLast4: string | null;
}

export class KycProviderError extends Error {
  constructor(message: string, readonly retryable = true) {
    super(message);
  }
}

export interface AuthorizeInput {
  state: string;
  codeChallenge: string;
  /** Where the provider must send the user back to (our API callback). */
  redirectUri: string;
}

export interface KycHint {
  name?: string;
  age?: number;
}

// The user is redirected to the provider, authenticates and consents there, and is redirected back to
// our API with a `code`. Only these two calls are needed.
export interface KycProvider {
  readonly name: string;
  /** Set when the provider dictates the redirect URI (it is registered with them). */
  readonly fixedRedirectUri: string | null;
  buildAuthorizeUrl(input: AuthorizeInput): string;
  exchange(input: { code: string; codeVerifier: string; hint?: KycHint }): Promise<KycIdentity>;
}

export const codeChallengeS256 = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');

// Development provider: "authorizing" bounces straight back to our callback, and the identity is built
// from the name/age typed in the sign-up form. Refused in production.
export class MockKycProvider implements KycProvider {
  readonly name = 'mock';
  readonly fixedRedirectUri = null;

  buildAuthorizeUrl({ state, redirectUri }: AuthorizeInput): string {
    return `${redirectUri}?code=mock_ok&state=${encodeURIComponent(state)}`;
  }

  async exchange({ code, hint }: { code: string; hint?: KycHint }): Promise<KycIdentity> {
    if (code !== 'mock_ok') throw new KycProviderError('Invalid authorization code', false);
    const dob = new Date();
    dob.setUTCFullYear(dob.getUTCFullYear() - (hint?.age ?? 30));
    dob.setUTCDate(1);
    const name = hint?.name?.trim() || 'Verified Partner';
    return {
      subjectId: `mock:${name.toLowerCase().replace(/\s+/g, '-')}:${dob.toISOString().slice(0, 10)}`,
      name,
      dob: dob.toISOString().slice(0, 10),
      gender: null,
      address: null,
      aadhaarLast4: '1234',
    };
  }
}

// Manual AbortController: AbortSignal.timeout() clashes with the mixed DOM/undici typings in this repo.
async function timedFetch(url: string, init: Record<string, unknown> = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal } as never);
  } finally {
    clearTimeout(timer);
  }
}

const dlBase = () => process.env['DIGILOCKER_BASE_URL'] ?? 'https://api.digitallocker.gov.in/public/oauth2';

// DigiLocker Authorized Partner API (OAuth 2.0 + PKCE). Endpoint shapes follow the published
// requester documentation; verify against the sandbox once the requester registration is approved.
export class DigiLockerKycProvider implements KycProvider {
  readonly name = 'digilocker';
  private readonly logger = new Logger('DigiLockerKycProvider');

  constructor(private clientId: string, private clientSecret: string, readonly fixedRedirectUri: string) {}

  buildAuthorizeUrl({ state, codeChallenge }: AuthorizeInput): string {
    const q = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.fixedRedirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return `${dlBase()}/1/authorize?${q.toString()}`;
  }

  private async post(path: string, form: Record<string, string>): Promise<Record<string, unknown>> {
    const res = await timedFetch(`${dlBase()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      this.logger.warn(`DigiLocker ${path} -> ${res.status} ${String(body['error'] ?? '')}`);
      throw new KycProviderError('DigiLocker rejected the request', res.status >= 500);
    }
    return body;
  }

  async exchange({ code, codeVerifier }: { code: string; codeVerifier: string }): Promise<KycIdentity> {
    const token = await this.post('/2/token', {
      grant_type: 'authorization_code',
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.fixedRedirectUri,
      code_verifier: codeVerifier,
    });
    const digilockerId = String(token['digilockerid'] ?? '');
    const name = String(token['name'] ?? '').trim();
    const m = /^(\d{2})(\d{2})(\d{4})$/.exec(String(token['dob'] ?? ''));
    if (!digilockerId || !name || !m) throw new KycProviderError('DigiLocker did not return the required details', false);

    // Best effort: the eAadhaar XML carries a masked uid such as "xxxxxxxx1234".
    let last4: string | null = null;
    const accessToken = String(token['access_token'] ?? '');
    if (accessToken && String(token['eaadhaar'] ?? '').toUpperCase() === 'Y') {
      try {
        const res = await timedFetch(`${dlBase()}/3/xml/eaadhaar`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const xml = await res.text();
        last4 = /uid="[xX*]{8}(\d{4})"/.exec(xml)?.[1] ?? null;
      } catch (err) {
        this.logger.warn(`eAadhaar fetch failed: ${(err as Error).message}`);
      }
    }
    const g = String(token['gender'] ?? '').toUpperCase();
    return {
      subjectId: digilockerId,
      name,
      dob: `${m[3]}-${m[2]}-${m[1]}`,
      gender: g === 'M' ? 'male' : g === 'F' ? 'female' : g ? 'other' : null,
      address: null,
      aadhaarLast4: last4,
    };
  }
}

// Fail closed with a clear message instead of silently skipping verification.
export class NotConfiguredKycProvider implements KycProvider {
  readonly fixedRedirectUri = null;
  constructor(readonly name: string) {}
  private fail(): never {
    new Logger('KycProvider').error(`KYC_PROVIDER="${this.name}" is not configured`);
    throw new ServiceUnavailableException('Aadhaar verification is temporarily unavailable. Please try again later.');
  }
  buildAuthorizeUrl(): string {
    return this.fail();
  }
  async exchange(): Promise<KycIdentity> {
    return this.fail();
  }
}

export function createKycProvider(): KycProvider {
  const name = (process.env['KYC_PROVIDER'] ?? 'mock').toLowerCase();
  if (name === 'mock') {
    if (process.env['NODE_ENV'] === 'production' && process.env['KYC_ALLOW_MOCK'] !== 'true') {
      throw new Error('KYC_PROVIDER=mock is not allowed in production');
    }
    return new MockKycProvider();
  }
  if (name === 'digilocker') {
    const id = process.env['DIGILOCKER_CLIENT_ID'];
    const secret = process.env['DIGILOCKER_CLIENT_SECRET'];
    const redirect = process.env['DIGILOCKER_REDIRECT_URI'];
    if (id && secret && redirect) return new DigiLockerKycProvider(id, secret, redirect);
  }
  return new NotConfiguredKycProvider(name);
}

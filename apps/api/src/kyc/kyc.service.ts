import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { ageFromDob, hashIdentity, hashIp } from './aadhaar.util.js';
import { codeChallengeS256, createKycProvider, type KycProvider } from './kyc.provider.js';

export const KYC_REDIRECT_TTL_SECONDS = 15 * 60;
export const KYC_TOKEN_TTL_SECONDS = 30 * 60;
const MAX_STARTS_PER_IP_PER_HOUR = 10;
const MIN_PARTNER_AGE = 18;
const DEFAULT_APP_REDIRECT = 'wagandtailspartner://kyc';

export type KycFailure = 'DENIED' | 'UNDERAGE' | 'DUPLICATE' | 'PROVIDER' | 'EXPIRED' | 'INCOMPLETE';

export interface VerifiedKyc {
  requestId: string;
  aadhaarRefHash: string;
  aadhaarLast4: string | null;
  provider: string;
  consentAt: Date;
  verifiedAt: Date;
  name: string;
  dob: Date;
  gender: string | null;
  address: string | null;
}

const FAILURE_MESSAGES: Record<KycFailure, string> = {
  DENIED: 'Verification was cancelled. You can try again whenever you are ready.',
  UNDERAGE: `Partners must be at least ${MIN_PARTNER_AGE} years old.`,
  DUPLICATE: 'A partner account already exists for this identity.',
  PROVIDER: 'DigiLocker could not verify your identity right now. Please try again in a moment.',
  EXPIRED: 'This verification session expired. Please start again.',
  INCOMPLETE: 'DigiLocker did not share the details we need. Make sure your Aadhaar is linked in DigiLocker and try again.',
};

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);
  private readonly provider: KycProvider = createKycProvider();
  private readonly secret = () => process.env['JWT_SECRET'] ?? 'dev-secret-change-me';

  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  // The deep link the API sends the user back to. Only our own app scheme is allowed (Expo Go's exp://
  // scheme outside production), so this endpoint can never be used as an open redirect.
  private resolveAppRedirect(requested: string | undefined): string {
    const fallback = process.env['KYC_APP_REDIRECT'] ?? DEFAULT_APP_REDIRECT;
    if (!requested) return fallback;
    const allowed = [fallback.split('://')[0] + '://'];
    if (process.env['NODE_ENV'] !== 'production') allowed.push('exp://', 'exp+wagandtailspartner://');
    if (!allowed.some((p) => requested.startsWith(p)) || requested.length > 300 || /[\s<>"']/.test(requested)) {
      throw new BadRequestException('Invalid return address');
    }
    return requested;
  }

  async start(input: {
    consent: unknown;
    name?: string;
    age?: number;
    appRedirect?: string;
    ip?: string;
    /** Public base of this API as the caller sees it, used only by the mock provider. */
    callbackBase: string;
  }) {
    if (input.consent !== true) {
      throw new BadRequestException('Please agree to the Aadhaar verification consent to continue');
    }
    const appRedirect = this.resolveAppRedirect(input.appRedirect);
    const now = Date.now();
    const ipHash = hashIp(input.ip);

    const dailyCap = Number(process.env['KYC_DAILY_LIMIT'] ?? 2000);
    const startedToday = await this.prisma.kycRequest.count({ where: { createdAt: { gte: new Date(now - 24 * 60 * 60 * 1000) } } });
    if (startedToday >= dailyCap) {
      this.logger.error(`KYC daily provider cap (${dailyCap}) reached`);
      throw new ServiceUnavailableException('Aadhaar verification is busy right now. Please try again later.');
    }
    if (ipHash) {
      const ipCount = await this.prisma.kycRequest.count({ where: { ipHash, createdAt: { gte: new Date(now - 60 * 60 * 1000) } } });
      if (ipCount >= MAX_STARTS_PER_IP_PER_HOUR) {
        throw new HttpException(
          { statusCode: 429, message: 'Too many attempts from this device. Please try again later.', retryAfterSeconds: 3600 },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const state = randomBytes(24).toString('hex');
    const codeVerifier = randomBytes(48).toString('base64url');
    const redirectUri = this.provider.fixedRedirectUri ?? `${input.callbackBase}/api/v1/auth/partner/digilocker/callback`;
    // Throws 503 when the provider is not configured, before anything is stored.
    const authorizeUrl = this.provider.buildAuthorizeUrl({ state, codeChallenge: codeChallengeS256(codeVerifier), redirectUri });

    const req = await this.prisma.kycRequest.create({
      data: {
        provider: this.provider.name,
        status: 'redirect_started',
        state,
        codeVerifier,
        appRedirect,
        hintName: input.name?.slice(0, 120) || null,
        hintAge: Number.isInteger(input.age) ? input.age : null,
        ipHash,
        consentAt: new Date(),
        expiresAt: new Date(now + KYC_REDIRECT_TTL_SECONDS * 1000),
      },
      select: { id: true },
    });
    return { requestId: req.id, authorizeUrl, expiresInSeconds: KYC_REDIRECT_TTL_SECONDS };
  }

  private appUrl(base: string, requestId: string, result: 'ok' | 'cancelled' | 'error') {
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}requestId=${requestId}&result=${result}`;
  }

  private async fail(id: string, reason: KycFailure) {
    await this.prisma.kycRequest.updateMany({
      where: { id, status: 'redirect_started' },
      data: { status: reason === 'DENIED' ? 'cancelled' : 'failed', failureReason: reason, codeVerifier: null },
    });
  }

  /**
   * Handles the provider redirect. Returns the app deep link to send the browser to, or null when the
   * state is unknown (nothing safe to redirect to). Idempotent: replaying the same callback never
   * exchanges the code twice.
   */
  async handleCallback(input: { code?: string; state?: string; error?: string }): Promise<string | null> {
    if (!input.state || !/^[a-f0-9]{48}$/.test(input.state)) return null;
    const req = await this.prisma.kycRequest.findUnique({ where: { state: input.state } });
    if (!req) return null;
    const base = req.appRedirect ?? DEFAULT_APP_REDIRECT;

    if (req.status !== 'redirect_started') {
      const result = req.status === 'verified' || req.status === 'consumed' ? 'ok' : req.status === 'cancelled' ? 'cancelled' : 'error';
      return this.appUrl(base, req.id, result);
    }
    if (req.expiresAt.getTime() < Date.now()) {
      await this.fail(req.id, 'EXPIRED');
      return this.appUrl(base, req.id, 'error');
    }
    if (input.error || !input.code) {
      await this.fail(req.id, 'DENIED');
      return this.appUrl(base, req.id, 'cancelled');
    }

    // Claim the callback atomically so a replay or double-tap cannot exchange the code twice.
    const claimed = await this.prisma.kycRequest.updateMany({
      where: { id: req.id, status: 'redirect_started' },
      data: { status: 'locked' },
    });
    if (claimed.count === 0) return this.appUrl(base, req.id, 'error');

    let identity;
    try {
      identity = await this.provider.exchange({
        code: input.code,
        codeVerifier: req.codeVerifier ?? '',
        hint: { name: req.hintName ?? undefined, age: req.hintAge ?? undefined },
      });
    } catch (err) {
      this.logger.error(`exchange failed: ${(err as Error).message}`);
      await this.prisma.kycRequest.update({ where: { id: req.id }, data: { status: 'failed', failureReason: 'PROVIDER', codeVerifier: null } });
      return this.appUrl(base, req.id, 'error');
    }

    const dob = new Date(`${identity.dob}T00:00:00Z`);
    const finishFailed = async (reason: KycFailure) => {
      await this.prisma.kycRequest.update({ where: { id: req.id }, data: { status: 'failed', failureReason: reason, codeVerifier: null } });
      return this.appUrl(base, req.id, 'error');
    };
    if (Number.isNaN(dob.getTime()) || !identity.name || !identity.subjectId) return finishFailed('INCOMPLETE');
    if (ageFromDob(dob) < MIN_PARTNER_AGE) return finishFailed('UNDERAGE');

    const refHash = hashIdentity(identity.subjectId);
    const taken = await this.prisma.partnerProfile.findUnique({ where: { aadhaarRefHash: refHash }, select: { userId: true } });
    if (taken) return finishFailed('DUPLICATE');

    const verifiedAt = new Date();
    await this.prisma.kycRequest.update({
      where: { id: req.id },
      data: {
        status: 'verified',
        codeVerifier: null,
        verifiedAt,
        expiresAt: new Date(verifiedAt.getTime() + KYC_TOKEN_TTL_SECONDS * 1000),
        aadhaarRefHash: refHash,
        aadhaarLast4: identity.aadhaarLast4,
        identityName: identity.name,
        identityDob: dob,
        identityGender: identity.gender,
        identityAddress: identity.address,
      },
    });
    return this.appUrl(base, req.id, 'ok');
  }

  // The app calls this after the browser session closes (or on relaunch). The deep link is only a hint;
  // this is the source of truth. A kycToken is issued only for a verified, unconsumed, unexpired request.
  async getStatus(requestId: string) {
    const req = await this.prisma.kycRequest.findUnique({ where: { id: requestId } });
    if (!req) throw new BadRequestException('Verification request not found');

    if (req.status === 'redirect_started') {
      if (req.expiresAt.getTime() < Date.now()) {
        await this.fail(req.id, 'EXPIRED');
        return { status: 'failed' as const, code: 'EXPIRED' as const, message: FAILURE_MESSAGES.EXPIRED };
      }
      return { status: 'pending' as const };
    }
    if (req.status === 'verified') {
      if (req.expiresAt.getTime() < Date.now()) {
        return { status: 'failed' as const, code: 'EXPIRED' as const, message: FAILURE_MESSAGES.EXPIRED };
      }
      const kycToken = this.jwt.sign({ purpose: 'partner_kyc', rid: req.id }, { expiresIn: KYC_TOKEN_TTL_SECONDS, secret: this.secret() });
      return {
        status: 'verified' as const,
        kycToken,
        expiresInSeconds: KYC_TOKEN_TTL_SECONDS,
        name: req.identityName,
        aadhaarLast4: req.aadhaarLast4,
      };
    }
    if (req.status === 'cancelled') return { status: 'cancelled' as const, code: 'DENIED' as const, message: FAILURE_MESSAGES.DENIED };
    if (req.status === 'consumed') return { status: 'failed' as const, code: 'EXPIRED' as const, message: 'This verification was already used.' };
    const code = (req.failureReason as KycFailure | null) ?? 'PROVIDER';
    return { status: 'failed' as const, code, message: FAILURE_MESSAGES[code] ?? FAILURE_MESSAGES.PROVIDER };
  }

  // Validates the token and returns the verified identity. Registration consumes it in the same
  // transaction that creates the account (see AuthService.registerPartner).
  async resolveVerifiedToken(kycToken: string): Promise<VerifiedKyc> {
    let payload: { purpose?: string; rid?: string };
    try {
      payload = this.jwt.verify(kycToken, { secret: this.secret() });
    } catch {
      throw new BadRequestException('Aadhaar verification has expired. Please verify again.');
    }
    if (payload.purpose !== 'partner_kyc' || !payload.rid) throw new BadRequestException('Invalid verification token');

    const req = await this.prisma.kycRequest.findUnique({ where: { id: payload.rid } });
    if (!req || req.status !== 'verified' || req.consumedAt || req.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Aadhaar verification is no longer valid. Please verify again.');
    }
    if (!req.identityName || !req.identityDob || !req.verifiedAt || !req.aadhaarRefHash) {
      throw new BadRequestException('Aadhaar verification is incomplete');
    }

    return {
      requestId: req.id,
      aadhaarRefHash: req.aadhaarRefHash,
      aadhaarLast4: req.aadhaarLast4,
      provider: req.provider,
      consentAt: req.consentAt,
      verifiedAt: req.verifiedAt,
      name: req.identityName,
      dob: req.identityDob,
      gender: req.identityGender,
      address: req.identityAddress,
    };
  }

  /** Purges identity rows nobody finished (run from the scheduler; safe to call any time). */
  async purgeStale(): Promise<number> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const res = await this.prisma.kycRequest.deleteMany({
      where: { OR: [{ createdAt: { lt: cutoff }, status: { not: 'consumed' } }, { consumedAt: { lt: cutoff } }] },
    });
    return res.count;
  }
}

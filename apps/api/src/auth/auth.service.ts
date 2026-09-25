import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { OtpService } from './otp.service.js';
import { KycService } from '../kyc/kyc.service.js';
import { ageFromDob, namesMatch } from '../kyc/aadhaar.util.js';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { addDays } from 'date-fns';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private otpService: OtpService,
    private kycService: KycService
  ) {}

  async requestOtp(phone: string) {
    return this.otpService.sendOtp(phone);
  }

  async verifyOtp(phone: string, otp: string) {
    const existing = await this.prisma.user.findUnique({ where: { phone } });

    if (existing) {
      // Returning user: this OTP check *is* the login, so consume it now
      // and hand back full tokens — there's no separate registration step
      // to consume it later, and leaving it unconsumed would let the same
      // code be replayed.
      const valid = await this.otpService.verifyOtp(phone, otp);
      if (!valid) throw new UnauthorizedException('Invalid or expired OTP');
      const session = await this.issueTokens(existing.id, existing.role);
      return { isNewUser: false, ...session };
    }

    // New user: check-only, so the client can confirm the code before the
    // register step actually completes the account and consumes it.
    const valid = await this.otpService.verifyOtp(phone, otp, { consume: false });
    if (!valid) throw new UnauthorizedException('Invalid or expired OTP');
    const sessionToken = this.jwtService.sign(
      { phone, purpose: 'otp_verified' },
      { expiresIn: '10m', secret: process.env['JWT_SECRET'] }
    );
    return { isNewUser: true, sessionToken };
  }

  async registerCustomer(data: {
    phone: string;
    otp: string;
    email: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
  }) {
    const valid = await this.otpService.verifyOtp(data.phone, data.otp);
    if (!valid) throw new UnauthorizedException('Invalid or expired OTP');

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ phone: data.phone }, { email: data.email }] },
    });
    if (existing) throw new ConflictException('Account already exists with this phone or email');

    const user = await this.prisma.user.create({
      data: {
        phone: data.phone,
        email: data.email,
        role: 'customer',
        isActive: true,
        profile: {
          create: {
            firstName: data.firstName,
            lastName: data.lastName,
            dateOfBirth: new Date(data.dateOfBirth),
          },
        },
        customerProfile: { create: {} },
      },
      include: { profile: true },
    });

    return this.issueTokens(user.id, user.role);
  }

  // Partners sign up with email+password directly (no login OTP) — unlike registerCustomer, which
  // is phone-first — but an account can only be created after the Aadhaar OTP has been verified
  // (see KycService): the kycToken proves that. The account is then created so the partner can log
  // in and see their pending-approval status, and PartnerProfile.status stays 'pending' until a
  // staff member reviews the details and calls PartnersService.approve.
  async registerPartner(data: {
    email: string;
    password: string;
    phone: string;
    firstName: string;
    lastName: string;
    age: number;
    address: string;
    city: string;
    modes: string[];
    groomsCats?: boolean;
    kycToken: string;
  }) {
    const kyc = await this.kycService.resolveVerifiedToken(data.kycToken);

    const email = data.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ phone: data.phone }, { email }] },
    });
    if (existing) throw new ConflictException('Account already exists with this phone or email');

    const passwordHash = await bcrypt.hash(data.password, 12);
    const enteredName = `${data.firstName} ${data.lastName}`;
    const modes = Array.from(new Set(data.modes));
    // Walking is dogs only; a groomer may opt out of cats.
    const petSpecies = modes.includes('grooming') && data.groomsCats === false ? ['dog'] : ['dog', 'cat'];

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        // Consuming the request is what makes the token single-use, even under concurrent submits.
        const consumed = await tx.kycRequest.updateMany({
          where: { id: kyc.requestId, status: 'verified', consumedAt: null },
          data: {
            status: 'consumed',
            consumedAt: new Date(),
            identityName: null,
            identityDob: null,
            identityGender: null,
            identityAddress: null,
          },
        });
        if (consumed.count !== 1) throw new ConflictException('This Aadhaar verification has already been used');

        return tx.user.create({
          data: {
            phone: data.phone,
            email,
            passwordHash,
            role: 'partner',
            isActive: true,
            profile: { create: { firstName: data.firstName, lastName: data.lastName } },
            partnerProfile: {
              create: {
                status: 'pending',
                modes,
                petSpecies,
                // The age on the KYC record is the source of truth, not the typed one.
                age: ageFromDob(kyc.dob),
                address: data.address,
                city: data.city,
                aadhaarLast4: kyc.aadhaarLast4,
                aadhaarRefHash: kyc.aadhaarRefHash,
                kycStatus: 'verified',
                kycProvider: kyc.provider,
                kycVerifiedAt: kyc.verifiedAt,
                kycName: kyc.name,
                kycDob: kyc.dob,
                kycGender: kyc.gender,
                kycAddress: kyc.address,
                kycConsentAt: kyc.consentAt,
                kycNameMatch: namesMatch(enteredName, kyc.name),
              },
            },
          },
          include: { profile: true },
        });
      });

      return this.issueTokens(user.id, user.role);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const target = String(err?.meta?.target ?? '');
        if (target.includes('aadhaar_ref_hash')) throw new ConflictException('A partner account already exists for this Aadhaar number');
        throw new ConflictException('Account already exists with this phone or email');
      }
      throw err;
    }
  }

  async loginWithEmail(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Please login with OTP');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokens(user.id, user.role);
  }

  async refreshTokens(refreshToken: string) {
    const record = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!record || record.expiresAt < new Date() || record.revoked) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate refresh token
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revoked: true },
    });

    return this.issueTokens(record.userId, record.user.role);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { revoked: true },
    });
  }

  async registerPushToken(userId: string, token: string, platform: string) {
    if (!/^Expo(nent)?PushToken\[[^\]\s]+\]$/.test(token)) throw new BadRequestException('Invalid push token');
    if (!['ios', 'android', 'web'].includes(platform)) throw new BadRequestException('Invalid platform');
    // A device that signs in as someone else moves its token, so the previous account stops getting its pushes.
    await this.prisma.pushToken.upsert({
      where: { token },
      update: { userId, platform, updatedAt: new Date() },
      create: { userId, token, platform },
    });
  }

  async removePushToken(userId: string, token: string) {
    await this.prisma.pushToken.deleteMany({ where: { userId, token } });
  }

  private async issueTokens(userId: string, role: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true },
    });

    const payload = { sub: userId, role };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = uuidv4();

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt: addDays(new Date(), 30),
      },
    });

    return {
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
      profile: user.profile,
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 900, // 15 min in seconds
      },
    };
  }
}

import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { OtpService } from './otp.service.js';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { addDays } from 'date-fns';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private otpService: OtpService
  ) {}

  async requestOtp(phone: string) {
    return this.otpService.sendOtp(phone);
  }

  async verifyOtp(phone: string, otp: string) {
    const valid = await this.otpService.verifyOtp(phone, otp);
    if (!valid) throw new UnauthorizedException('Invalid or expired OTP');
    // Return a short-lived session token to be exchanged during register/login
    const sessionToken = this.jwtService.sign(
      { phone, purpose: 'otp_verified' },
      { expiresIn: '10m', secret: process.env['JWT_SECRET'] }
    );
    return { sessionToken };
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

  async loginWithEmail(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('Account suspended');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

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
    await this.prisma.pushToken.upsert({
      where: { token },
      update: { userId, platform, updatedAt: new Date() },
      create: { userId, token, platform },
    });
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

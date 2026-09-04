import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { addMinutes } from 'date-fns';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;

function generateOtp(): string {
  // Cryptographically adequate for dev; use crypto.randomInt in production
  const digits = Array.from({ length: OTP_LENGTH }, () => Math.floor(Math.random() * 10));
  return digits.join('');
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(private prisma: PrismaService) {}

  async sendOtp(phone: string): Promise<{ otp?: string }> {
    const otp = generateOtp();
    const expiresAt = addMinutes(new Date(), OTP_EXPIRY_MINUTES);

    // Invalidate old OTPs for this phone
    await this.prisma.otpToken.updateMany({
      where: { phone, used: false },
      data: { used: true },
    });

    await this.prisma.otpToken.create({
      data: { phone, otp, expiresAt },
    });

    const provider = process.env['SMS_PROVIDER'] ?? 'mock';

    if (provider === 'mock') {
      this.logger.log(`[MOCK OTP] Phone: ${phone} → OTP: ${otp}`);
      // Return otp in dev so tests can use it
      return { otp };
    }

    // TODO: integrate Twilio or other provider
    this.logger.log(`OTP sent to ${phone}`);
    return {};
  }

  async verifyOtp(phone: string, otp: string): Promise<boolean> {
    const record = await this.prisma.otpToken.findFirst({
      where: {
        phone,
        otp,
        used: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) return false;

    await this.prisma.otpToken.update({
      where: { id: record.id },
      data: { used: true },
    });

    return true;
  }
}

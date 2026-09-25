import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtStrategy } from './jwt.strategy.js';
import { OtpService } from './otp.service.js';
import { KycService } from '../kyc/kyc.service.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env['JWT_SECRET'] ?? 'dev-secret-change-me',
        signOptions: { expiresIn: process.env['JWT_EXPIRES_IN'] ?? '15m' },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, OtpService, KycService],
  controllers: [AuthController],
  exports: [AuthService, JwtModule, KycService],
})
export class AuthModule {}

import {
  Controller,
  Post,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  Get,
  Query,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength, Min, MinLength } from 'class-validator';
import { AuthService } from './auth.service.js';
import { KycService } from '../kyc/kyc.service.js';
import { CurrentUser } from '../common/decorators.js';

class OtpRequestDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;
}

class OtpVerifyDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  otp!: string;
}

class RegisterDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  otp!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  dateOfBirth!: string;
}

class DigilockerStartDto {
  // Explicit consent to fetch Aadhaar details for KYC (Aadhaar Act / DPDP).
  @IsBoolean()
  consent!: boolean;

  // Only used by the development mock provider so the returned identity matches what was typed.
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsInt()
  age?: number;

  // Deep link the browser session returns to (validated against an allowlist server-side).
  @IsOptional()
  @IsString()
  @MaxLength(300)
  appRedirect?: string;
}

class RegisterPartnerDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(72)
  password!: string;

  @IsString()
  @Matches(/^\+?\d{10,15}$/, { message: 'Enter a valid phone number' })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  lastName!: string;

  @IsInt()
  @Min(18)
  age!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  address!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  // What the partner wants to do: groomer, walker, or both.
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(['grooming', 'walking'], { each: true })
  modes!: string[];

  // Groomers only: whether they also take cat grooming jobs (default yes).
  @IsOptional()
  @IsBoolean()
  groomsCats?: boolean;

  // Proof that the Aadhaar OTP was verified (from GET /auth/partner/digilocker/status/:requestId).
  @IsString()
  @IsNotEmpty()
  kycToken!: string;
}

class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

class PushTokenDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @IsNotEmpty()
  platform!: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService, private kycService: KycService) {}

  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  requestOtp(@Body() body: OtpRequestDto) {
    return this.authService.requestOtp(body.phone);
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body() body: OtpVerifyDto) {
    return this.authService.verifyOtp(body.phone, body.otp);
  }

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.registerCustomer(body);
  }

  @Post('partner/digilocker/start')
  @HttpCode(HttpStatus.OK)
  startDigilocker(@Body() body: DigilockerStartDto, @Req() req: FastifyRequest) {
    const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol ?? 'http').split(',')[0];
    return this.kycService.start({ ...body, ip: req.ip, callbackBase: `${proto}://${req.headers.host}` });
  }

  // Public: DigiLocker sends the browser here. Answers with a redirect back into the app.
  @Get('partner/digilocker/callback')
  async digilockerCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() reply: FastifyReply,
  ) {
    const target = await this.kycService.handleCallback({ code, state, error });
    if (!target) {
      return reply
        .code(400)
        .header('Content-Type', 'text/html; charset=utf-8')
        .send('<p>This verification link is no longer valid. Please return to the app and try again.</p>');
    }
    return reply.code(302).header('Location', target).header('Cache-Control', 'no-store').send();
  }

  @Get('partner/digilocker/status/:requestId')
  digilockerStatus(@Param('requestId', new ParseUUIDPipe()) requestId: string) {
    return this.kycService.getStatus(requestId);
  }

  @Post('register/partner')
  registerPartner(@Body() body: RegisterPartnerDto) {
    return this.authService.registerPartner(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: LoginDto) {
    return this.authService.loginWithEmail(body.email, body.password);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: RefreshDto) {
    return this.authService.refreshTokens(body.refreshToken);
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body() body: RefreshDto) {
    return this.authService.logout(body.refreshToken);
  }

  @Post('push-token')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  registerPushToken(@CurrentUser() user: { sub: string }, @Body() body: PushTokenDto) {
    return this.authService.registerPushToken(user.sub, body.token, body.platform);
  }

  // Called on logout so a signed-out device stops receiving that account's notifications.
  @Delete('push-token')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  removePushToken(@CurrentUser() user: { sub: string }, @Body() body: { token: string }) {
    return this.authService.removePushToken(user.sub, String(body?.token ?? ''));
  }
}
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { CurrentUser } from '../common/decorators.js';

class OtpRequestDto { phone!: string; }
class OtpVerifyDto { phone!: string; otp!: string; }
class RegisterDto {
  phone!: string; otp!: string; email!: string;
  firstName!: string; lastName!: string; dateOfBirth!: string;
}
class LoginDto { email!: string; password!: string; }
class RefreshDto { refreshToken!: string; }
class PushTokenDto { token!: string; platform!: string; }

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

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
}

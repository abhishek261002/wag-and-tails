import { ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('phone-code login', () => {
  const login = (role: string) => {
    const service = Object.create(AuthService.prototype) as AuthService & Record<string, any>;
    Object.assign(service, {
      prisma: { user: { findUnique: jest.fn(async () => ({ id: 'u1', role })) } },
      otpService: { verifyOtp: jest.fn(async () => true) },
      issueTokens: jest.fn(async () => ({ tokens: { accessToken: 'a', refreshToken: 'r' } })),
    });
    return service;
  };

  it('signs in a customer', async () => {
    const service = login('customer');
    await expect(service.verifyOtp('+919000000101', '123456')).resolves.toMatchObject({ isNewUser: false });
  });

  it.each(['partner', 'staff', 'admin'])('never signs in a %s account, even with the right code', async (role) => {
    const service = login(role) as any;
    await expect(service.verifyOtp('+919900000000', '123456')).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.issueTokens).not.toHaveBeenCalled();
  });
});

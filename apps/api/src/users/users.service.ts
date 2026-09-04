import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        addresses: { where: { isActive: true }, orderBy: { isDefault: 'desc' } },
        customerProfile: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash, ...safe } = user;
    return safe;
  }

  async updateProfile(userId: string, data: {
    firstName?: string; lastName?: string; dateOfBirth?: string; avatarUrl?: string;
  }) {
    const { dateOfBirth, ...rest } = data;
    return this.prisma.userProfile.update({
      where: { userId },
      data: {
        ...rest,
        ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth) } : {}),
      },
    });
  }

  async addAddress(userId: string, data: {
    label: string; line1: string; line2?: string;
    city: string; state: string; pincode: string;
    lat: number; lng: number; isDefault?: boolean;
  }) {
    if (data.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }
    return this.prisma.address.create({ data: { ...data, userId, isDefault: data.isDefault ?? false } });
  }

  async updateAddress(addressId: string, userId: string, data: Partial<{
    label: string; line1: string; line2: string;
    city: string; state: string; pincode: string;
    lat: number; lng: number; isDefault: boolean;
  }>) {
    const address = await this.prisma.address.findFirst({ where: { id: addressId, userId } });
    if (!address) throw new NotFoundException('Address not found');
    if (data.isDefault) {
      await this.prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    return this.prisma.address.update({ where: { id: addressId }, data });
  }

  async deleteAddress(addressId: string, userId: string) {
    const address = await this.prisma.address.findFirst({ where: { id: addressId, userId } });
    if (!address) throw new NotFoundException('Address not found');
    await this.prisma.address.update({ where: { id: addressId }, data: { isActive: false } });
  }

  async getWallet(userId: string) {
    const profile = await this.prisma.customerProfile.findUnique({ where: { userId } });
    return { balance: profile?.walletBalance ?? 0 };
  }
}

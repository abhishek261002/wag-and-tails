import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MapsLocationService } from '../maps-location/maps-location.service.js';
import { isServiceCity, isValidCoordinate } from '../maps-location/places.js';

export interface AddressInput {
  label?: string; line1?: string; line2?: string | null;
  city?: string; state?: string; pincode?: string;
  lat?: number; lng?: number; isDefault?: boolean;
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');


@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService, private maps: MapsLocationService) {}

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
    return { ...safe, addresses: safe.addresses.map((a) => ({ ...a, serviceable: isServiceCity(a.city) })) };
  }

  /**
   * Updates the signed-in user's own details. Only these fields are accepted (nothing else in the body reaches the
   * database): first and last name, email, date of birth and photo. An empty email or date of birth clears it.
   */
  async updateProfile(userId: string, data: {
    firstName?: unknown; lastName?: unknown; email?: unknown; dateOfBirth?: unknown; avatarUrl?: unknown;
  }) {
    const bad = (msg: string) => { throw new BadRequestException(msg); };
    const profileData: Record<string, unknown> = {};
    const userData: Record<string, unknown> = {};

    const name = (v: unknown, label: string) => {
      const t = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
      if (t.length < 1 || t.length > 60) bad(`${label} must be 1 to 60 characters`);
      if (!/^[\p{L}][\p{L}\p{M} .'\-]*$/u.test(t)) bad(`${label} can only contain letters, spaces and . ' -`);
      return t;
    };
    if (data.firstName !== undefined) profileData['firstName'] = name(data.firstName, 'First name');
    if (data.lastName !== undefined) {
      // A single-word name is fine: the last name may be left empty.
      const t = typeof data.lastName === 'string' ? data.lastName.trim() : '';
      profileData['lastName'] = t === '' ? '' : name(t, 'Last name');
    }

    if (data.email !== undefined) {
      const raw = typeof data.email === 'string' ? data.email.trim().toLowerCase() : null;
      if (raw === null) bad('Email is not valid');
      if (raw === '') userData['email'] = null;
      else {
        if (raw!.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw!)) bad('Please enter a valid email address');
        userData['email'] = raw;
      }
    }

    if (data.dateOfBirth !== undefined) {
      if (data.dateOfBirth === null || data.dateOfBirth === '') profileData['dateOfBirth'] = null;
      else {
        const d = new Date(data.dateOfBirth as string);
        if (typeof data.dateOfBirth !== 'string' || !Number.isFinite(d.getTime())) bad('Please enter a valid date of birth');
        const now = Date.now();
        if (d.getTime() > now) bad('Date of birth cannot be in the future');
        if (now - d.getTime() > 120 * 365.25 * 86_400_000) bad('Please enter a valid date of birth');
        profileData['dateOfBirth'] = d;
      }
    }

    if (data.avatarUrl !== undefined) {
      if (data.avatarUrl === null || data.avatarUrl === '') profileData['avatarUrl'] = null;
      else if (typeof data.avatarUrl === 'string' && data.avatarUrl.length <= 500 && /^\/uploads\/[\w.\-]+$/.test(data.avatarUrl)) profileData['avatarUrl'] = data.avatarUrl;
      else bad('Photo must be uploaded through the app first');
    }

    if (Object.keys(profileData).length === 0 && Object.keys(userData).length === 0) bad('Nothing to update');

    const existing = await this.prisma.userProfile.findUnique({ where: { userId } });
    if (!existing) throw new NotFoundException('Profile not found');

    try {
      await this.prisma.$transaction([
        ...(Object.keys(userData).length ? [this.prisma.user.update({ where: { id: userId }, data: userData })] : []),
        ...(Object.keys(profileData).length ? [this.prisma.userProfile.update({ where: { userId }, data: profileData })] : []),
      ]);
    } catch (err: any) {
      if (err?.code === 'P2002') throw new ConflictException('That email is already used by another account');
      throw err;
    }
    return this.getProfile(userId);
  }

  /**
   * Checks and normalises an address. The coordinates must be a real point in India (they are what the
   * partner navigates to), and the city is replaced by the operating city that point falls in, so dispatch
   * matches partners by the same name they picked. If the map provider is down the client's city is kept.
   */
  private async prepareAddress(data: AddressInput, partial: boolean) {
    const out: Record<string, unknown> = {};
    const need = (cond: boolean, msg: string) => { if (!cond) throw new BadRequestException(msg); };

    if (!partial || data.line1 !== undefined) {
      const line1 = clean(data.line1, 200);
      need(line1.length >= 3, 'Please enter your flat / house number and building');
      out['line1'] = line1;
    }
    if (data.line2 !== undefined) out['line2'] = clean(data.line2, 200) || null;
    if (data.label !== undefined || !partial) out['label'] = clean(data.label, 30) || 'Home';
    if (!partial || data.pincode !== undefined) {
      const pincode = clean(data.pincode, 6);
      need(/^[1-9]\d{5}$/.test(pincode), 'Please enter a valid 6-digit pincode');
      out['pincode'] = pincode;
    }
    if (!partial || data.city !== undefined) {
      const city = clean(data.city, 80);
      need(city.length >= 2, 'City is required');
      out['city'] = city;
    }
    if (!partial || data.state !== undefined) {
      const state = clean(data.state, 80);
      need(state.length >= 2, 'State is required');
      out['state'] = state;
    }

    const hasCoords = data.lat !== undefined || data.lng !== undefined;
    if (!partial || hasCoords) {
      need(isValidCoordinate(data.lat, data.lng), 'Please pin your location on the map');
      out['lat'] = data.lat;
      out['lng'] = data.lng;
      try {
        const place = await this.maps.reverseGeocode(data.lat as number, data.lng as number);
        if (place?.serviceCity) out['city'] = place.serviceCity;
      } catch (err) {
        this.logger.warn(`Could not verify address city: ${(err as Error).message}`);
      }
    }
    return out;
  }

  async addAddress(userId: string, data: AddressInput) {
    const fields = await this.prepareAddress(data, false);
    const count = await this.prisma.address.count({ where: { userId, isActive: true } });
    const isDefault = data.isDefault === true || count === 0;
    if (isDefault) {
      await this.prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    const created = await this.prisma.address.create({ data: { ...(fields as any), userId, isDefault } });
    return { ...created, serviceable: isServiceCity(created.city) };
  }

  async updateAddress(addressId: string, userId: string, data: AddressInput) {
    const address = await this.prisma.address.findFirst({ where: { id: addressId, userId, isActive: true } });
    if (!address) throw new NotFoundException('Address not found');
    const fields = await this.prepareAddress(data, true);
    if (data.isDefault === true) {
      await this.prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
      fields['isDefault'] = true;
    }
    const updated = await this.prisma.address.update({ where: { id: addressId }, data: fields as any });
    return { ...updated, serviceable: isServiceCity(updated.city) };
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

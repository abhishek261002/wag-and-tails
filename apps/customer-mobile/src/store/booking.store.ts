import { create } from 'zustand';
import type { GroomingPackage, AddOn, Pet } from '@wag/shared-types';

interface BookingDraft {
  petId: string | null;
  pet: Pet | null;
  packageId: string | null;
  package: GroomingPackage | null;
  addOnIds: string[];
  addOns: AddOn[];
  scheduledAt: string | null;
  addressId: string | null;
  addressLine: string | null;
  notes: string;
  couponCode: string | null;
  discount: number;
  paymentMethod: 'upi' | 'card' | 'wallet' | 'cash_after_service';
}

interface WalkDraft {
  petId: string | null;
  pet: Pet | null;
  durationMinutes: 30 | 45 | 60;
  scheduleNow: boolean;
  scheduledAt: string | null;
  addressId: string | null;
  addressLine: string | null;
  couponCode: string | null;
  discount: number;
  paymentMethod: 'upi' | 'card' | 'wallet' | 'cash_after_service';
}

interface BookingStore {
  groomingDraft: BookingDraft;
  walkDraft: WalkDraft;
  updateGroomingDraft: (updates: Partial<BookingDraft>) => void;
  updateWalkDraft: (updates: Partial<WalkDraft>) => void;
  resetGroomingDraft: () => void;
  resetWalkDraft: () => void;
}

const defaultGroomingDraft: BookingDraft = {
  petId: null, pet: null, packageId: null, package: null,
  addOnIds: [], addOns: [], scheduledAt: null, addressId: null,
  addressLine: null, notes: '', couponCode: null, discount: 0,
  paymentMethod: 'upi',
};

const defaultWalkDraft: WalkDraft = {
  petId: null, pet: null, durationMinutes: 30,
  scheduleNow: true, scheduledAt: null, addressId: null,
  addressLine: null, couponCode: null, discount: 0, paymentMethod: 'upi',
};

export const useBookingStore = create<BookingStore>((set) => ({
  groomingDraft: defaultGroomingDraft,
  walkDraft: defaultWalkDraft,
  updateGroomingDraft: (updates) =>
    set((s) => ({ groomingDraft: { ...s.groomingDraft, ...updates } })),
  updateWalkDraft: (updates) =>
    set((s) => ({ walkDraft: { ...s.walkDraft, ...updates } })),
  resetGroomingDraft: () => set({ groomingDraft: defaultGroomingDraft }),
  resetWalkDraft: () => set({ walkDraft: defaultWalkDraft }),
}));

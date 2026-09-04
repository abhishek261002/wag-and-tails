import { z } from 'zod';

export const paymentMethodSchema = z.enum(['upi', 'card', 'wallet', 'cash_after_service']);
export const bookingChannelSchema = z.enum([
  'app',
  'whatsapp',
  'phone_call',
  'instagram',
  'walk_in',
  'other',
]);

export const createGroomingBookingSchema = z.object({
  petId: z.string().uuid(),
  packageId: z.string().uuid(),
  addOnIds: z.array(z.string().uuid()).default([]),
  scheduledAt: z.string().datetime({ message: 'Invalid datetime' }),
  addressId: z.string().uuid(),
  notes: z.string().max(500).optional(),
  couponCode: z.string().max(30).optional(),
  paymentMethod: paymentMethodSchema,
  channel: bookingChannelSchema.default('app'),
});

export const createWalkingBookingSchema = z.object({
  petId: z.string().uuid(),
  durationMinutes: z.union([z.literal(30), z.literal(45), z.literal(60)]),
  scheduleNow: z.boolean(),
  scheduledAt: z.string().datetime().optional(),
  addressId: z.string().uuid(),
  couponCode: z.string().max(30).optional(),
  paymentMethod: paymentMethodSchema,
});

export const staffCreateBookingSchema = createGroomingBookingSchema.extend({
  customerId: z.string().uuid(),
  partnerPhone: z.string().optional(),
  channel: bookingChannelSchema,
});

export const rescheduleBookingSchema = z.object({
  bookingId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  reason: z.string().max(300).optional(),
});

export const cancelBookingSchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().max(300).optional(),
});

export const applyCouponSchema = z.object({
  couponCode: z.string().min(1).max(30),
  service: z.enum(['grooming', 'walking', 'store']),
  orderValue: z.number().positive(),
});

export type CreateGroomingBookingInput = z.infer<typeof createGroomingBookingSchema>;
export type CreateWalkingBookingInput = z.infer<typeof createWalkingBookingSchema>;
export type RescheduleBookingInput = z.infer<typeof rescheduleBookingSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;

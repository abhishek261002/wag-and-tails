import { z } from 'zod';

export const addToCartSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().int().positive().max(99),
});

export const updateCartItemSchema = z.object({
  cartItemId: z.string().uuid(),
  quantity: z.number().int().min(0).max(99), // 0 means remove
});

export const checkoutSchema = z.object({
  addressId: z.string().uuid(),
  paymentMethod: z.enum(['upi', 'card', 'wallet', 'cod']),
  couponCode: z.string().max(30).optional(),
});

export const createProductSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  mrp: z.number().positive(),
  retailPrice: z.number().positive(),
  tradePrice: z.number().positive(),
  tags: z.array(z.string()).default([]),
  allergyWarnings: z.array(z.string()).default([]),
});

export const createProductVariantSchema = z.object({
  productId: z.string().uuid(),
  name: z.string().min(1).max(100),
  sku: z.string().min(1).max(50),
  mrp: z.number().positive(),
  retailPrice: z.number().positive(),
  tradePrice: z.number().positive(),
  stockQty: z.number().int().min(0),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;

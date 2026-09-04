export type OrderStatus =
  | 'placed'
  | 'packed'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type ProductCategorySlug =
  | 'grooming'
  | 'food_and_treats'
  | 'health'
  | 'walk_gear'
  | 'toys'
  | 'other';

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  displayOrder: number;
}

export interface Product {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrls: string[];
  mrp: number;
  retailPrice: number;
  tradePrice: number;
  rating: number;
  reviewCount: number;
  tags: string[];
  allergyWarnings: string[];
  isActive: boolean;
  createdAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku: string;
  mrp: number;
  retailPrice: number;
  tradePrice: number;
  stockQty: number;
  imageUrl: string | null;
}

export interface CartItem {
  id: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Cart {
  id: string;
  userId: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  couponCode: string | null;
  updatedAt: string;
}

export interface StoreOrder {
  id: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  addressId: string;
  addressLine: string;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  couponCode: string | null;
  paymentMethod: string;
  paymentStatus: string;
  status: OrderStatus;
  packedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  trackingNumber: string | null;
  labelUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

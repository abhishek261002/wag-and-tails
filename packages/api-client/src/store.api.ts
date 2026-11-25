import type { ApiClient } from './client.js';
import type { Product, ProductVariant, Cart, StoreOrder } from '@wag/shared-types';
import type { PaginatedResponse } from './bookings.api.js';

export interface ProductFilters {
  categoryId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

/** What the cart costs now, as the website's shop works it out. */
export interface StoreQuote {
  subtotal: number;
  discount: number;
  shipping: number;
  shippingMethod?: string;
  tax: number;
  total: number;
  coupons: string[];
  couponError: string;
  /** Cash on delivery is offered. */
  cod: boolean;
  /** The prices come from the website's shop (the app's own coupon list does not apply). */
  woo: boolean;
}

export class StoreApi {
  constructor(private client: ApiClient) {}

  listCategories() {
    return this.client.get<{ id: string; name: string; slug: string; imageUrl: string | null }[]>(
      '/store/categories'
    );
  }

  listProducts(filters?: ProductFilters): Promise<PaginatedResponse<Product>> {
    return this.client.get('/store/products', { params: filters });
  }

  getProduct(productId: string): Promise<Product & { variants: ProductVariant[] }> {
    return this.client.get(`/store/products/${productId}`);
  }

  getCart(): Promise<Cart> {
    return this.client.get('/store/cart');
  }

  addToCart(productId: string, quantity: number, variantId?: string): Promise<Cart> {
    return this.client.post('/store/cart/items', { productId, variantId, quantity });
  }

  updateCartItem(cartItemId: string, quantity: number): Promise<Cart> {
    return this.client.patch(`/store/cart/items/${cartItemId}`, { quantity });
  }

  removeCartItem(cartItemId: string): Promise<Cart> {
    return this.client.delete(`/store/cart/items/${cartItemId}`);
  }

  applyCoupon(code: string): Promise<Cart> {
    return this.client.post('/store/cart/coupon', { couponCode: code });
  }

  quote(addressId?: string, couponCode?: string): Promise<StoreQuote> {
    return this.client.post('/store/quote', { addressId, couponCode });
  }

  /** `expectedTotal` is the total the customer saw; if the price changed meanwhile the order is refused (409). */
  checkout(addressId: string, paymentMethod: string, couponCode?: string, expectedTotal?: number): Promise<StoreOrder> {
    return this.client.post('/store/orders', { addressId, paymentMethod, couponCode, expectedTotal });
  }

  listOrders(): Promise<StoreOrder[]> {
    return this.client.get('/store/orders');
  }

  getOrder(orderId: string): Promise<StoreOrder> {
    return this.client.get(`/store/orders/${orderId}`);
  }
}

import type { ApiClient } from './client.js';
import type { Product, ProductVariant, Cart, StoreOrder } from '@wag/shared-types';
import type { PaginatedResponse } from './bookings.api.js';

export interface ProductFilters {
  categoryId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
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

  checkout(addressId: string, paymentMethod: string, couponCode?: string): Promise<StoreOrder> {
    return this.client.post('/store/orders', { addressId, paymentMethod, couponCode });
  }

  listOrders(): Promise<StoreOrder[]> {
    return this.client.get('/store/orders');
  }

  getOrder(orderId: string): Promise<StoreOrder> {
    return this.client.get(`/store/orders/${orderId}`);
  }
}

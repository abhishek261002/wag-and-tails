import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CouponsService } from '../coupons/coupons.service.js';
import { WpStoreService } from '../wp/wp-store.service.js';

// When the website is connected (WP_CONNECTOR_*), the store is the website's WooCommerce shop: the products here are
// a copy of it (wp-store.service), and quotes, coupons and orders are made by WooCommerce. Without the connection the
// old app-only store below still works (development).

@Injectable()
export class StoreService {
  constructor(
    private prisma: PrismaService,
    private couponsService: CouponsService,
    private wpStore: WpStoreService
  ) {}

  /** The address used for a quote when the customer has not picked one yet (their default, else the newest). */
  private async defaultAddress(userId: string) {
    const a = await this.prisma.address.findFirst({ where: { userId, isActive: true }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
    if (!a) throw new BadRequestException('Add a delivery address first.');
    return a.id;
  }

  /** Totals for the checkout screen: WooCommerce's prices, coupon, shipping and whether cash on delivery is offered. */
  async quote(userId: string, role: string, addressId?: string, couponCode?: string) {
    if (!this.wpStore.enabled) {
      const cart = await this.getOrCreateCart(userId);
      let discount = 0;
      let couponError = '';
      if (couponCode) {
        try {
          discount = (await this.couponsService.apply(couponCode, 'store', cart.subtotal, userId)).discount;
        } catch (e) {
          couponError = (e as Error).message;
        }
      }
      return { subtotal: cart.subtotal, discount, shipping: 0, tax: 0, total: cart.subtotal - discount, coupons: couponCode && !couponError ? [couponCode] : [], couponError, cod: true, woo: false, lines: [] };
    }
    return { ...(await this.wpStore.quote(userId, role, addressId ?? (await this.defaultAddress(userId)), couponCode)), woo: true };
  }

  async listCategories() {
    return this.prisma.productCategory.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async listProducts(filters: {
    categoryId?: string; search?: string; page?: number; pageSize?: number;
  } = {}) {
    const { categoryId, search, page = 1, pageSize = 20 } = filters;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = { isActive: true };
    if (categoryId) where['categoryId'] = categoryId;
    if (search) where['name'] = { contains: search, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: pageSize,
        include: { category: true, variants: { where: { stockQty: { gt: 0 } } } },
        // Most products share a rating, so name and id break the tie: without them pages can repeat or skip products.
        orderBy: [{ rating: 'desc' }, { name: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async getProduct(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { category: true, variants: true, reviews: { take: 20, orderBy: { createdAt: 'desc' } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async getOrCreateCart(userId: string) {
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true, variant: true } } },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
        include: { items: { include: { product: true, variant: true } } },
      });
    }

    return this.formatCart(cart);
  }

  async addToCart(userId: string, productId: string, quantity: number, variantId?: string, isTradeUser = false) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { variants: true },
    });
    if (!product || !product.isActive) throw new NotFoundException('Product not found');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new BadRequestException('Quantity must be between 1 and 20');
    // Every product has at least one variant (sizes, or "Standard"): pick the first in stock when none is given.
    if (!variantId && product.variants.length) variantId = (product.variants.find((v) => v.stockQty > 0) ?? product.variants[0])!.id;
    const variant = variantId ? product.variants.find((v) => v.id === variantId) : undefined;
    if (variantId && !variant) throw new NotFoundException('That option is not available');
    if (variant && variant.stockQty <= 0) throw new ConflictException('Out of stock');

    const unitPrice = isTradeUser
      ? (variantId
          ? (product.variants.find((v) => v.id === variantId)?.tradePrice ?? product.tradePrice)
          : product.tradePrice)
      : (variantId
          ? (product.variants.find((v) => v.id === variantId)?.retailPrice ?? product.retailPrice)
          : product.retailPrice);

    let cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!cart) cart = await this.prisma.cart.create({ data: { userId } });

    const existing = await this.prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId, variantId: variantId ?? null },
    });

    if (variant && (existing?.quantity ?? 0) + quantity > variant.stockQty) {
      throw new ConflictException(`Only ${variant.stockQty} left`);
    }
    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: Math.min(20, existing.quantity + quantity), unitPrice },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          variantId: variantId ?? null,
          quantity,
          unitPrice,
        },
      });
    }

    return this.getOrCreateCart(userId);
  }

  async updateCartItem(userId: string, cartItemId: string, quantity: number) {
    const cart = await this.prisma.cart.findUniqueOrThrow({ where: { userId } });
    const item = await this.prisma.cartItem.findFirst({ where: { id: cartItemId, cartId: cart.id } });
    if (!item) throw new NotFoundException('Cart item not found');

    if (quantity === 0) {
      await this.prisma.cartItem.delete({ where: { id: cartItemId } });
    } else {
      await this.prisma.cartItem.update({ where: { id: cartItemId }, data: { quantity } });
    }

    return this.getOrCreateCart(userId);
  }

  async applyCoupon(userId: string, couponCode: string, role = 'customer') {
    if (this.wpStore.enabled) {
      const cart = await this.getOrCreateCart(userId);
      const q = await this.quote(userId, role, undefined, couponCode);
      if (q.couponError) throw new BadRequestException(q.couponError);
      await this.prisma.cart.update({ where: { userId }, data: { couponCode } });
      return { ...cart, discount: q.discount, shipping: q.shipping, total: q.total, couponCode };
    }
    const cart = await this.getOrCreateCart(userId);
    const result = await this.couponsService.apply(couponCode, 'store', cart.subtotal, userId);
    await this.prisma.cart.update({ where: { userId }, data: { couponCode } });
    return { ...cart, discount: result.discount, total: cart.subtotal - result.discount, couponCode };
  }

  async checkout(userId: string, addressId: string, paymentMethod: string, couponCode?: string, role = 'customer', expectedTotal?: number) {
    if (this.wpStore.enabled) {
      return this.wpStore.placeOrder(userId, role, addressId, paymentMethod, couponCode, expectedTotal);
    }
    const cart = await this.getOrCreateCart(userId);
    if (cart.items.length === 0) throw new BadRequestException('Cart is empty');

    const address = await this.prisma.address.findFirst({ where: { id: addressId, userId } });
    if (!address) throw new NotFoundException('Address not found');

    let discount = 0;
    let appliedCoupon: any = null;
    if (couponCode) {
      const result = await this.couponsService.apply(couponCode, 'store', cart.subtotal, userId);
      discount = result.discount;
      appliedCoupon = result.coupon;
    }

    // Generate order number
    const orderNumber = `WT${Date.now().toString().slice(-8)}`;

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true },
    });

    const order = await this.prisma.storeOrder.create({
      data: {
        orderNumber,
        userId,
        customerName: user.profile ? `${user.profile.firstName} ${user.profile.lastName}` : 'Customer',
        customerPhone: user.phone,
        addressId,
        addressLine: `${address.line1}, ${address.city}`,
        subtotal: cart.subtotal,
        discount,
        shippingFee: 0,
        total: cart.subtotal - discount,
        couponCode: couponCode ?? null,
        paymentMethod,
        paymentStatus: 'pending',
        status: 'placed',
        items: {
          create: cart.items.map((i: {
            productId: string; variantId: string | null;
            productName: string; variantName: string | null;
            imageUrl: string | null; quantity: number;
            unitPrice: number; totalPrice: number;
          }) => ({
            productId: i.productId,
            variantId: i.variantId,
            productName: i.productName,
            variantName: i.variantName,
            imageUrl: i.imageUrl,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            totalPrice: i.quantity * i.unitPrice,
          })),
        },
      },
      include: { items: true },
    });

    // Clear cart
    await this.prisma.cartItem.deleteMany({ where: { cart: { userId } } });
    await this.prisma.cart.update({ where: { userId }, data: { couponCode: null } });

    if (appliedCoupon) {
      await this.couponsService.recordRedemption(appliedCoupon.id, userId, undefined, order.id);
    }

    return order;
  }

  private formatCart(cart: any) {
    const items = (cart.items ?? []).map((i: any) => ({
      id: i.id,
      productId: i.productId,
      variantId: i.variantId,
      productName: i.product?.name ?? '',
      variantName: i.variant?.name ?? null,
      imageUrl: i.product?.imageUrls?.[0] ?? null,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      totalPrice: Number(i.unitPrice) * i.quantity,
    }));

    const subtotal = items.reduce((s: number, i: any) => s + i.totalPrice, 0);
    return {
      id: cart.id,
      userId: cart.userId,
      items,
      subtotal,
      discount: 0,
      total: subtotal,
      couponCode: cart.couponCode ?? null,
      updatedAt: cart.updatedAt,
    };
  }
}

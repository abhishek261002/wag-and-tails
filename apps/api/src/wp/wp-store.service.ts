import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma, type OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { WpClientService, WpError } from './wp-client.service.js';
import { WpOutboxService } from './wp-outbox.service.js';
import { toPluginPhone } from './wp-link.js';

// The apps' store is the website's WooCommerce shop (decided 25 Nov 2026).
//  - The catalogue (products, variations, prices, stock) is copied every 10 minutes and when the website says a
//    product changed. The apps keep reading the same tables as before.
//  - Prices, coupons, shipping and cash on delivery are decided by WooCommerce: the app asks for a quote, and the
//    order is created in WooCommerce first; the app pays exactly that total.
//  - The online payment is confirmed to WooCommerce through the outbox (retried until it lands).
//  - Order status changes in WooCommerce come back as signed messages (type "order").

const SETTINGS_KEY = 'store_settings';
const SYNC_MS = 10 * 60_000;

interface WcVar { id: number; name?: string; sku?: string; price: number; mrp: number; qty: number; img?: string }
interface WcProduct {
  id: number; name: string; cat: string; price: number; mrp: number; qty: number; sku?: string; img?: string; imgs?: string[];
  desc?: string; lead?: string; type?: string; vars?: WcVar[]; pets?: string[];
}
export interface WcOrderOut {
  id: number; number: string; status: string; paid: boolean; subtotal: number; discount: number; shipping: number; shippingMethod?: string;
  tax: number; total: number; coupons: string[]; lines: { product: number; variation: number; name: string; qty: number; total: number }[];
  couponError?: string; cod?: boolean; late?: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const slug = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'other';

export function statusFromWc(wc: string, current: OrderStatus): OrderStatus {
  switch (wc) {
    case 'completed': return 'delivered';
    case 'cancelled': case 'failed': return 'cancelled';
    case 'refunded': return 'refunded';
    case 'pending': case 'processing': case 'on-hold': case 'checkout-draft': return current === 'packed' || current === 'out_for_delivery' ? current : 'placed';
    default:
      // Shipping plugins add their own statuses ("shipped", "in-transit", "out-for-delivery").
      if (/ship|transit|out-for|dispatch/.test(wc)) return 'out_for_delivery';
      if (/pack|ready/.test(wc)) return 'packed';
      if (/deliver/.test(wc)) return 'delivered';
      return current;
  }
}

@Injectable()
export class WpStoreService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WpStoreService.name);
  private timer: NodeJS.Timeout | null = null;
  private syncing = false;
  private pending: NodeJS.Timeout | null = null;

  constructor(private prisma: PrismaService, private wp: WpClientService, private outbox: WpOutboxService, private notifications: NotificationsService) {}

  get enabled() {
    return this.wp.enabled;
  }

  onModuleInit() {
    if (!this.wp.enabled || (process.env['SCHEDULER_ENABLED'] ?? 'true') === 'false') return;
    this.timer = setInterval(() => void this.syncCatalog().catch((e) => this.logger.warn(`Catalogue copy failed: ${(e as Error).message}`)), SYNC_MS);
    setTimeout(() => void this.syncCatalog().catch((e) => this.logger.warn(`Catalogue copy failed: ${(e as Error).message}`)), 5_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.pending) clearTimeout(this.pending);
  }

  /** A product changed on the website: copy again shortly (several changes in a row = one copy). */
  soon() {
    if (this.pending) return;
    this.pending = setTimeout(() => {
      this.pending = null;
      void this.syncCatalog().catch((e) => this.logger.warn(`Catalogue copy failed: ${(e as Error).message}`));
    }, 15_000);
  }

  async partnerPct(): Promise<number> {
    const st = await this.prisma.wpSyncState.findUnique({ where: { key: SETTINGS_KEY } });
    return Number((st?.value as { partnerDiscountPct?: number } | null)?.partnerDiscountPct ?? 0) || 0;
  }

  /** Copies the WooCommerce catalogue into the app's product tables. Products no longer on sale are hidden. */
  async syncCatalog(): Promise<{ products: number; variants: number; hidden: number }> {
    if (!this.wp.enabled || this.syncing) return { products: 0, variants: 0, hidden: 0 };
    this.syncing = true;
    try {
      const res = await this.wp.get<{ woo: boolean; products: WcProduct[]; partnerDiscountPct: number }>('store/catalog');
      const pct = Math.max(0, Math.min(90, Number(res.partnerDiscountPct) || 0));
      await this.prisma.wpSyncState.upsert({
        where: { key: SETTINGS_KEY },
        create: { key: SETTINGS_KEY, value: { partnerDiscountPct: pct, syncedAt: new Date().toISOString() } },
        update: { value: { partnerDiscountPct: pct, syncedAt: new Date().toISOString() } },
      });
      if (!res.woo) return { products: 0, variants: 0, hidden: 0 };
      const trade = (p: number) => round2(p * (1 - pct / 100));

      // Categories in the website's order of first appearance.
      const cats = new Map<string, string>();
      const catNames = [...new Set(res.products.map((p) => p.cat || 'Other'))];
      for (const [i, name] of catNames.entries()) {
        const s = slug(name);
        const c = await this.prisma.productCategory.upsert({
          where: { slug: s },
          create: { name, slug: s, displayOrder: i, isActive: true },
          update: { name, displayOrder: i, isActive: true },
        });
        cats.set(name, c.id);
      }

      const seenProducts: number[] = [];
      const seenVariants: number[] = [];
      let variants = 0;
      for (const p of res.products) {
        seenProducts.push(p.id);
        const vars: WcVar[] = p.vars?.length ? p.vars : [{ id: p.id, name: 'Standard', sku: p.sku, price: p.price, mrp: p.mrp, qty: p.qty, img: p.img }];
        const images = [...new Set([...(p.imgs ?? []), p.img].filter((x): x is string => !!x))];
        const data = {
          name: p.name,
          categoryId: cats.get(p.cat || 'Other')!,
          description: (p.lead || p.desc || '').slice(0, 5000) || null,
          imageUrls: images,
          mrp: Math.max(p.mrp, p.price),
          retailPrice: p.price,
          tradePrice: trade(p.price),
          tags: (p.pets ?? []).map((x) => x.toLowerCase()),
          isActive: true,
        };
        // Products imported from the sheet earlier carry the website id in their SKU ("WT-<id>"): adopt them.
        const existing = (await this.prisma.product.findUnique({ where: { wcId: p.id } })) ?? (await this.prisma.product.findFirst({ where: { sku: `WT-${p.id}`, wcId: null } }));
        const prod = existing
          ? await this.prisma.product.update({ where: { id: existing.id }, data: { ...data, wcId: p.id } })
          : await this.prisma.product.create({ data: { ...data, wcId: p.id, slug: `${slug(p.name).slice(0, 50)}-${p.id}`, sku: `WT-${p.id}` } });
        for (const v of vars) {
          seenVariants.push(v.id);
          const vdata = { name: (v.name || 'Standard').slice(0, 120), mrp: Math.max(v.mrp, v.price), retailPrice: v.price, tradePrice: trade(v.price), stockQty: Math.max(0, Math.min(999, v.qty)), imageUrl: v.img || null };
          const vSku = (v.sku || '').trim();
          const had = (await this.prisma.productVariant.findUnique({ where: { wcId: v.id } }))
            ?? (vSku ? await this.prisma.productVariant.findFirst({ where: { sku: { equals: vSku, mode: 'insensitive' }, productId: prod.id, wcId: null } }) : null)
            ?? (!p.vars?.length ? await this.prisma.productVariant.findFirst({ where: { productId: prod.id, wcId: null } }) : null);
          if (had) {
            await this.prisma.productVariant.update({ where: { id: had.id }, data: { ...vdata, wcId: v.id, productId: prod.id } });
          } else {
            const skuTaken = vSku ? await this.prisma.productVariant.findUnique({ where: { sku: vSku } }) : null;
            await this.prisma.productVariant.create({ data: { ...vdata, wcId: v.id, productId: prod.id, sku: vSku && !skuTaken ? vSku : `WC-${v.id}` } });
          }
          variants++;
        }
        // Variations removed on the website: out of stock here (kept for old orders).
        await this.prisma.productVariant.updateMany({ where: { productId: prod.id, OR: [{ wcId: null }, { wcId: { notIn: vars.map((v) => v.id) } }] }, data: { stockQty: 0 } });
      }
      // Anything not on sale on the website any more (and the old app-only catalogue) is hidden from the apps.
      const hidden = await this.prisma.product.updateMany({ where: { isActive: true, OR: [{ wcId: null }, { wcId: { notIn: seenProducts } }] }, data: { isActive: false } });
      await this.prisma.productCategory.updateMany({ where: { isActive: true, products: { none: { isActive: true } } }, data: { isActive: false } });
      return { products: seenProducts.length, variants, hidden: hidden.count };
    } finally {
      this.syncing = false;
    }
  }

  private async cartLines(userId: string) {
    const cart = await this.prisma.cart.findUnique({ where: { userId }, include: { items: { include: { product: true, variant: true } } } });
    if (!cart || cart.items.length === 0) throw new BadRequestException('Your cart is empty.');
    const lines = cart.items.map((i) => {
      if (!i.product.wcId || !i.product.isActive) throw new ConflictException({ code: 'ITEM_UNAVAILABLE', message: `${i.product.name} is no longer sold. Remove it from your cart.` });
      const variant = i.variant;
      const isVariation = !!variant?.wcId && variant.wcId !== i.product.wcId;
      return { product: i.product.wcId, variation: isVariation ? variant!.wcId! : 0, qty: i.quantity };
    });
    return { cart, lines };
  }

  private async who(userId: string, addressId: string) {
    const [user, address] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { profile: true } }),
      this.prisma.address.findFirst({ where: { id: addressId, userId, isActive: true } }),
    ]);
    if (!address) throw new NotFoundException('Address not found');
    return {
      user,
      address,
      customer: { name: user.profile ? `${user.profile.firstName} ${user.profile.lastName}`.trim() : 'Customer', phone: toPluginPhone(user.phone), email: user.email ?? '' },
      addr: { line1: address.line1, line2: address.line2 ?? '', city: address.city, state: address.state, pincode: address.pincode },
    };
  }

  private translate(e: unknown): never {
    const err = e as WpError & { data?: any };
    if (err instanceof WpError) {
      if (err.status === 409) throw new ConflictException({ code: err.code ?? 'STORE_CONFLICT', message: err.message, details: (err as any).data ?? null });
      if (err.status && err.status < 500) throw new BadRequestException(err.message);
      throw new ServiceUnavailableException('The shop is not reachable right now. Please try again in a few minutes.');
    }
    throw e;
  }

  /** What the cart costs now, as WooCommerce calculates it (coupon, shipping, cash on delivery). */
  async quote(userId: string, role: string, addressId: string, coupon?: string) {
    const { lines } = await this.cartLines(userId);
    const w = await this.who(userId, addressId);
    try {
      return await this.wp.post<WcOrderOut>('store/quote', { items: lines, coupon: coupon ?? '', partner: role === 'partner', customer: w.customer, address: w.addr });
    } catch (e) {
      this.translate(e);
    }
  }

  /**
   * Places the order: created in WooCommerce first (stock and price checked there), then saved here. Online orders
   * stay "payment pending" until the app's payment is confirmed; cash on delivery goes straight to Processing.
   */
  async placeOrder(userId: string, role: string, addressId: string, paymentMethod: string, coupon: string | undefined, expectedTotal: number | undefined) {
    const cod = paymentMethod === 'cod';
    if (!cod && !['upi', 'card', 'online'].includes(paymentMethod)) throw new BadRequestException('Choose a payment method.');
    const { cart, lines } = await this.cartLines(userId);
    const w = await this.who(userId, addressId);
    const appOrderId = randomUUID();
    const body = {
      appOrderId, items: lines, coupon: coupon ?? '', partner: role === 'partner', customer: w.customer, address: w.addr,
      payment: cod ? 'cod' : 'online', ...(expectedTotal !== undefined ? { expectedTotal } : {}),
    };
    let wc: WcOrderOut;
    try {
      wc = await this.wp.post<WcOrderOut>('store/orders', body);
    } catch (e) {
      // The answer was lost (timeout, network): the website may have created it. The same appOrderId is safe to
      // send again: the website returns the order it already made instead of a second one.
      if (!(e instanceof WpError) || e.status < 500) this.translate(e);
      try {
        wc = await this.wp.post<WcOrderOut>('store/orders', body);
      } catch (e2) {
        this.translate(e2);
      }
    }
    const byWc = new Map(cart.items.map((i) => [`${i.product.wcId}:${i.variant?.wcId && i.variant.wcId !== i.product.wcId ? i.variant.wcId : 0}`, i]));
    const order = await this.prisma.storeOrder.create({
      data: {
        id: appOrderId,
        orderNumber: `WC${wc.number}`,
        userId,
        customerName: w.customer.name,
        customerPhone: w.user.phone,
        addressId,
        addressLine: [w.address.line1, w.address.line2, w.address.city, w.address.pincode].filter(Boolean).join(', '),
        subtotal: wc.subtotal,
        discount: wc.discount,
        shippingFee: wc.shipping,
        total: wc.total,
        couponCode: wc.coupons[0] ?? null,
        paymentMethod: cod ? 'cod' : 'online',
        paymentStatus: 'pending',
        status: 'placed',
        wcOrderId: wc.id,
        wcStatus: wc.status,
        items: {
          create: wc.lines.map((l) => {
            const ci = byWc.get(`${l.product}:${l.variation}`);
            return {
              productId: ci?.productId ?? cart.items[0]!.productId,
              variantId: ci?.variantId ?? null,
              productName: l.name.slice(0, 200),
              variantName: ci?.variant?.name ?? null,
              imageUrl: ci?.variant?.imageUrl ?? ci?.product.imageUrls[0] ?? null,
              quantity: l.qty,
              unitPrice: round2(l.total / Math.max(1, l.qty)),
              totalPrice: l.total,
            };
          }),
        },
      },
      include: { items: true },
    });
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    await this.prisma.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
    return order;
  }

  /** The app's payment for an order went through: tell WooCommerce (through the outbox, so it is never lost). */
  async paid(orderId: string, txn: string) {
    const o = await this.prisma.storeOrder.findUnique({ where: { id: orderId }, select: { wcOrderId: true } });
    if (!o?.wcOrderId) return;
    await this.outbox.enqueue('order', `order:${orderId}:paid`, { path: `store/orders/${o.wcOrderId}/paid`, body: { txn } });
  }

  /** A WooCommerce order changed: bring the app's copy up to date and tell the customer about real progress. */
  async applyOrder(wcId: number) {
    const o = await this.prisma.storeOrder.findUnique({ where: { wcOrderId: wcId } });
    if (!o) return { ignored: 'not an app order' };
    let wc: WcOrderOut;
    try {
      wc = await this.wp.get<WcOrderOut>(`store/orders/${wcId}`);
    } catch (e) {
      if (e instanceof WpError && e.status === 404) return { ignored: 'gone' };
      throw e;
    }
    const status = statusFromWc(wc.status, o.status);
    const data: Prisma.StoreOrderUpdateInput = { wcStatus: wc.status, status };
    if (wc.paid && o.paymentStatus !== 'paid' && o.paymentMethod !== 'cod') data.paymentStatus = 'paid';
    if (o.paymentMethod === 'cod' && status === 'delivered') data.paymentStatus = 'paid';
    if (status === 'delivered' && !o.deliveredAt) data.deliveredAt = new Date();
    if (status === 'out_for_delivery' && !o.shippedAt) data.shippedAt = new Date();
    if (status === 'packed' && !o.packedAt) data.packedAt = new Date();
    if ((wc as any).tracking) data.trackingNumber = String((wc as any).tracking).slice(0, 120);
    await this.prisma.storeOrder.update({ where: { id: o.id }, data });
    if (status !== o.status) {
      const text: Partial<Record<OrderStatus, string>> = {
        packed: 'Your order is packed.',
        out_for_delivery: 'Your order is on its way.',
        delivered: 'Your order was delivered. Enjoy!',
        cancelled: 'Your order was cancelled.',
        refunded: 'Your order was refunded.',
      };
      if (text[status]) {
        await this.notifications.sendPush(o.userId, { title: `Order ${o.orderNumber}`, body: text[status]!, data: { orderId: o.id } }, { type: 'order_status' }).catch(() => undefined);
      }
    }
    return { action: 'updated', status };
  }
}

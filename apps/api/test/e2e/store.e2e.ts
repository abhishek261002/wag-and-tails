// The store is the website's WooCommerce shop: catalogue copy, quotes (price, coupon, shipping, COD), orders created in
// WooCommerce, online payment confirmed there, stock, status coming back, partner price, and insurance leads.
// LOCAL ONLY (API on :3001, dev DB, staging WordPress on :8090).
import { APP_CUSTOMER, PARTNERS, api, http, login, otpLogin, preflight, runWpQueue, signedWp, sql, waitFor, wp, wpJson } from './helpers';

const stamp = String(Date.now()).slice(-6);
let cust = '';
let partner = '';
let addressId = '';
let partnerAddressId = '';
let simple = { id: 0, price: 0 };
let variable = { id: 0, vid: 0, price: 0 };
const orders: number[] = [];

const wcOrder = (id: number) => wpJson<any>(`( function(){ $o = wc_get_order( ${id} ); return $o ? array( 'status' => $o->get_status(), 'total' => (float) $o->get_total(), 'shipping' => (float) $o->get_shipping_total(), 'discount' => (float) $o->get_discount_total(), 'paid' => $o->is_paid(), 'via' => $o->get_created_via(), 'method' => $o->get_payment_method(), 'partner' => (bool) $o->get_meta( '_wt_partner' ), 'items' => count( $o->get_items() ), 'phone' => $o->get_billing_phone(), 'city' => $o->get_shipping_city() ) : null; } )()`);
const stock = (id: number) => Number(wp(`echo (int) wc_get_product( ${id} )->get_stock_quantity();`));
const wcCount = () => Number(wp(`echo count( wc_get_orders( array( 'limit' => -1, 'return' => 'ids', 'status' => array_keys( wc_get_order_statuses() ) ) ) );`));
const setStock = (id: number, qty: number) => wp(`$p = wc_get_product( ${id} ); $p->set_manage_stock( true ); $p->set_stock_quantity( ${qty} ); $p->set_stock_status( ${qty} > 0 ? 'instock' : 'outofstock' ); $p->save(); echo 'ok';`);
const syncCatalog = async () => { await api(await login('admin@wagandtails.in', 'WagTails@123'), 'POST', '/admin/wp/store/sync'); };

async function addToCart(token: string, productId: string, variantId: string | undefined, qty: number) {
  return api(token, 'POST', '/store/cart/items', { productId, variantId, quantity: qty });
}
const clearCart = async (token: string) => {
  const c = await api(token, 'GET', '/store/cart');
  for (const i of c.b.items ?? []) await api(token, 'PATCH', `/store/cart/items/${i.id}`, { quantity: 0 });
};
const appProduct = (wcId: number) => sql(`select id from products where wc_id=${wcId}`);
const appVariant = (wcId: number) => sql(`select id from product_variants where wc_id=${wcId}`);

beforeAll(async () => {
  await preflight();
  // Staging shop settings used by these tests: cash on delivery on, a flat shipping rate with free shipping from 999,
  // a 10% coupon, a 20% partner price, and two test products with known stock.
  wp(`
    update_option( 'woocommerce_cod_settings', array( 'enabled' => 'yes', 'title' => 'Cash on delivery' ) );
    foreach ( WC_Shipping_Zones::get_zones() as $z ) { $zone = new WC_Shipping_Zone( $z['id'] ); foreach ( $zone->get_shipping_methods() as $m ) { $zone->delete_shipping_method( $m->get_instance_id() ); } $zone->delete(); }
    $zone = new WC_Shipping_Zone(); $zone->set_zone_name( 'India e2e' ); $zone->add_location( 'IN', 'country' ); $zone->save();
    $flat = $zone->add_shipping_method( 'flat_rate' ); $free = $zone->add_shipping_method( 'free_shipping' );
    update_option( 'woocommerce_flat_rate_' . $flat . '_settings', array( 'title' => 'Flat rate', 'tax_status' => 'none', 'cost' => '60' ) );
    update_option( 'woocommerce_free_shipping_' . $free . '_settings', array( 'title' => 'Free shipping', 'requires' => 'min_amount', 'min_amount' => '999' ) );
    WC_Cache_Helper::get_transient_version( 'shipping', true );
    if ( ! wc_get_coupon_id_by_code( 'E2E10' ) ) { $c = new WC_Coupon(); $c->set_code( 'E2E10' ); $c->set_discount_type( 'percent' ); $c->set_amount( 10 ); $c->save(); }
    $cfg = wt_config(); $cfg['settings']['partnerDiscountPct'] = 20; wt_save_config( $cfg );
    echo 'ok';`);
  const ids = wpJson<{ simple: number; variable: number; vid: number }>(`( function(){
    $s = new WC_Product_Simple(); $s->set_name( 'E2E Test Treat ${stamp}' ); $s->set_regular_price( '500' ); $s->set_manage_stock( true ); $s->set_stock_quantity( 5 ); $s->set_status( 'publish' ); $s->save();
    $v = null; foreach ( wc_get_products( array( 'type' => 'variable', 'status' => 'publish', 'limit' => 20 ) ) as $p ) { foreach ( $p->get_children() as $c ) { $x = wc_get_product( $c ); if ( $x && $x->is_in_stock() && '' !== $x->get_price() ) { $v = array( $p->get_id(), $c ); break 2; } } }
    return array( 'simple' => $s->get_id(), 'variable' => $v[0], 'vid' => $v[1] ); } )()`);
  const sp = Number(wp(`echo wc_get_product( ${ids.simple} )->get_price();`));
  simple = { id: ids.simple, price: sp };
  variable = { id: ids.variable, vid: ids.vid, price: Number(wp(`echo wc_get_product( ${ids.vid} )->get_price();`)) };
  await syncCatalog();
  cust = await otpLogin(APP_CUSTOMER);
  partner = await login(PARTNERS.ritika.email, PARTNERS.ritika.password);
  addressId = sql(`select a.id from addresses a join users u on u.id=a.user_id where u.phone='${APP_CUSTOMER}' and a.is_active limit 1`);
  const pid = sql(`select id from users where phone='${PARTNERS.ritika.phone}'`);
  partnerAddressId = sql(`select id from addresses where user_id='${pid}' and is_active limit 1`);
  if (!partnerAddressId) partnerAddressId = sql(`insert into addresses(user_id, label, line1, city, state, pincode, lat, lng, is_active, updated_at) values ('${pid}', 'Home', '12 Test Road', 'Lucknow', 'Uttar Pradesh', '226001', 26.85, 80.95, true, now()) returning id`).split('\n')[0]!;
  await clearCart(cust);
  await clearCart(partner);
}, 180000);

afterAll(() => {
  wp(`foreach ( wc_get_products( array( 'name' => 'E2E Test Treat ${stamp}', 'limit' => 5 ) ) as $p ) { $p->delete( true ); } echo 'ok';`);
  for (const id of orders) wp(`$o = wc_get_order( ${id} ); if ( $o ) { $o->delete( true ); } echo 'ok';`);
});

describe('the catalogue is a copy of the WooCommerce shop', () => {
  it('has the same products on sale, with the website\'s prices and stock', async () => {
    const wcPublished = Number(wp(`echo count( array_filter( wc_get_products( array( 'status' => 'publish', 'limit' => -1 ) ), function( $p ) { return 'hidden' !== $p->get_catalog_visibility() && ( '' !== $p->get_price() || $p->is_type( 'variable' ) ); } ) );`));
    const active = Number(sql(`select count(*) from products where is_active and wc_id is not null`));
    expect(Math.abs(active - wcPublished)).toBeLessThanOrEqual(2);
    expect(sql(`select count(*) from products where is_active and wc_id is null`)).toBe('0'); // old app-only products are hidden
    const row = sql(`select p.retail_price, v.stock_qty from products p join product_variants v on v.product_id=p.id where p.wc_id=${simple.id}`).split('|');
    expect(Number(row[0])).toBe(simple.price);
    expect(Number(row[1])).toBe(5);
    expect(Number(sql(`select retail_price from product_variants where wc_id=${variable.vid}`))).toBe(variable.price);
  });

  it('follows the website: a product taken off sale disappears, sold-out shows as out of stock, and it comes back', async () => {
    wp(`$p = wc_get_product( ${simple.id} ); $p->set_status( 'draft' ); $p->save(); echo 'ok';`);
    await syncCatalog();
    expect(sql(`select is_active from products where wc_id=${simple.id}`)).toBe('f');
    const list = await api(cust, 'GET', '/store/products?pageSize=200');
    expect(JSON.stringify(list.b)).not.toContain(`E2E Test Treat ${stamp}`);
    wp(`$p = wc_get_product( ${simple.id} ); $p->set_status( 'publish' ); $p->save(); echo 'ok';`);
    setStock(simple.id, 0);
    await syncCatalog();
    expect(sql(`select is_active from products where wc_id=${simple.id}`)).toBe('t');
    expect(sql(`select stock_qty from product_variants where product_id=(select id from products where wc_id=${simple.id})`)).toBe('0');
    setStock(simple.id, 5);
    await syncCatalog();
    expect(sql(`select stock_qty from product_variants where product_id=(select id from products where wc_id=${simple.id})`)).toBe('5');
  });

  it('a copy that fails half way does not hide the shop (the website being unreachable leaves the old copy)', async () => {
    const before = sql(`select count(*) from products where is_active`);
    const r = await api(await login('admin@wagandtails.in', 'WagTails@123'), 'POST', '/admin/wp/store/sync');
    expect(r.s).toBeLessThan(500);
    expect(sql(`select count(*) from products where is_active`)).toBe(before);
  });
});

describe('quote: WooCommerce decides price, coupon, shipping and cash on delivery', () => {
  it('charges the website price plus the shipping rule, free above 999', async () => {
    await clearCart(cust);
    expect((await addToCart(cust, appProduct(simple.id), appVariant(simple.id), 1)).s).toBeLessThan(300);
    const q = await api(cust, 'POST', '/store/quote', { addressId });
    expect(q.s).toBeLessThan(300);
    expect(q.b.subtotal).toBe(500);
    expect(q.b.shipping).toBe(60);
    expect(q.b.total).toBe(560);
    expect(q.b.cod).toBe(true);
    await addToCart(cust, appProduct(simple.id), appVariant(simple.id), 1);
    const q2 = await api(cust, 'POST', '/store/quote', { addressId });
    expect(q2.b.subtotal).toBe(1000);
    expect(q2.b.shipping).toBe(0);
    expect(q2.b.total).toBe(1000);
  });

  it('applies the website coupon and refuses a wrong one, without creating any WooCommerce order', async () => {
    const n = wcCount();
    const ok = await api(cust, 'POST', '/store/quote', { addressId, couponCode: 'E2E10' });
    expect(ok.b.discount).toBe(100);
    expect(ok.b.total).toBe(960); // 1000 - 100 + 60 shipping (900 < 999)
    expect(ok.b.shipping).toBe(60);
    const bad = await api(cust, 'POST', '/store/quote', { addressId, couponCode: 'NOPE' });
    expect(bad.s).toBeLessThan(300);
    expect(bad.b.couponError).toBeTruthy();
    expect((await api(cust, 'POST', '/store/cart/coupon', { couponCode: 'NOPE' })).s).toBe(400);
    expect((await api(cust, 'POST', '/store/cart/coupon', { couponCode: 'E2E10' })).s).toBeLessThan(300);
    expect(wcCount()).toBe(n);
  });

  it('turns cash on delivery off when the website does', async () => {
    wp(`update_option( 'woocommerce_cod_settings', array( 'enabled' => 'no' ) ); echo 'ok';`);
    const q = await api(cust, 'POST', '/store/quote', { addressId });
    expect(q.b.cod).toBe(false);
    const o = await api(cust, 'POST', '/store/orders', { addressId, paymentMethod: 'cod' });
    expect(o.s).toBe(409);
    wp(`update_option( 'woocommerce_cod_settings', array( 'enabled' => 'yes' ) ); echo 'ok';`);
  });

  it('handles a variation product and refuses nonsense quantities and unavailable items', async () => {
    await clearCart(cust);
    expect((await addToCart(cust, appProduct(variable.id), appVariant(variable.vid), 1)).s).toBeLessThan(300);
    const q = await api(cust, 'POST', '/store/quote', { addressId });
    expect(q.b.subtotal).toBe(variable.price);
    await clearCart(cust);
    expect((await addToCart(cust, appProduct(simple.id), appVariant(simple.id), 0)).s).toBe(400);
    expect((await addToCart(cust, appProduct(simple.id), appVariant(simple.id), 500)).s).toBe(400);
    expect((await addToCart(cust, appProduct(simple.id), appVariant(simple.id), 6)).s).toBe(409); // only 5 in stock
    expect((await addToCart(cust, '00000000-0000-0000-0000-000000000000', undefined, 1)).s).toBe(404);
    expect((await api(cust, 'POST', '/store/quote', { addressId })).s).toBe(400); // empty cart
  });
});

describe('placing orders', () => {
  it('cash on delivery: the order exists in WooCommerce as Processing, stock goes down, the app copy matches', async () => {
    await clearCart(cust);
    await addToCart(cust, appProduct(simple.id), appVariant(simple.id), 2);
    const quote = (await api(cust, 'POST', '/store/quote', { addressId })).b;
    const o = await api(cust, 'POST', '/store/orders', { addressId, paymentMethod: 'cod', expectedTotal: quote.total });
    expect(o.s).toBeLessThan(300);
    expect(o.b.orderNumber).toMatch(/^WC\d+$/);
    expect(Number(o.b.total)).toBe(quote.total);
    expect(o.b.wcOrderId).toBeGreaterThan(0);
    orders.push(o.b.wcOrderId);
    const w = wcOrder(o.b.wcOrderId);
    expect(w.status).toBe('processing');
    expect(w.via).toBe('wag-app');
    expect(w.method).toBe('cod');
    expect(w.total).toBe(quote.total);
    expect(w.phone).toBe(APP_CUSTOMER.slice(3));
    expect(stock(simple.id)).toBe(3);
    // the cart is empty and an online payment for a COD order is refused
    expect((await api(cust, 'GET', '/store/cart')).b.items).toHaveLength(0);
    expect((await api(cust, 'POST', '/payments/orders', { orderId: o.b.id })).s).toBe(400);
    expect(sql(`select payment_status from store_orders where id='${o.b.id}'`)).toBe('pending');
  });

  it('online: pending in WooCommerce with the stock held, paid in the app means Processing there', async () => {
    await addToCart(cust, appProduct(simple.id), appVariant(simple.id), 2);
    const quote = (await api(cust, 'POST', '/store/quote', { addressId })).b;
    const o = await api(cust, 'POST', '/store/orders', { addressId, paymentMethod: 'upi', expectedTotal: quote.total });
    expect(o.s).toBeLessThan(300);
    orders.push(o.b.wcOrderId);
    expect(wcOrder(o.b.wcOrderId).status).toBe('pending');
    // stock is held for this order: a second shopper cannot take the last items meanwhile
    expect(Number(wp(`echo wc_get_held_stock_quantity( wc_get_product( ${simple.id} ) );`))).toBe(2);
    const pay = await api(cust, 'POST', '/payments/orders', { orderId: o.b.id });
    expect(pay.s).toBeLessThan(300);
    expect(Number(pay.b.payment.amount)).toBe(quote.total);
    const done = await api(cust, 'PATCH', `/payments/${pay.b.payment.id}/confirm`, { method: 'upi', providerPaymentId: 'mock_pay_' + stamp, signature: 'mock' });
    expect(done.s).toBeLessThan(300);
    const paid = await waitFor(() => (wcOrder(o.b.wcOrderId).status === 'processing' ? true : undefined), 60000, 2000);
    expect(paid).toBe(true);
    expect(wcOrder(o.b.wcOrderId).paid).toBe(true);
    expect(stock(simple.id)).toBe(1); // 5 - 2 (cod) - 2 (online)
    expect(sql(`select payment_status from store_orders where id='${o.b.id}'`)).toBe('paid');
    // confirming twice does nothing more
    expect((await api(cust, 'PATCH', `/payments/${pay.b.payment.id}/confirm`, { method: 'upi', providerPaymentId: 'mock_pay_' + stamp, signature: 'mock' })).s).toBeLessThan(300);
    expect(stock(simple.id)).toBe(1);
    // and cannot be paid again
    expect((await api(cust, 'POST', '/payments/orders', { orderId: o.b.id })).s).toBe(409);
  });

  it('the customer sees what WooCommerce does with the order (packed, shipped, delivered)', async () => {
    const id = Number(sql(`select wc_order_id from store_orders where wc_order_id=${orders[1]}`));
    const app = sql(`select id from store_orders where wc_order_id=${id}`);
    wp(`wc_get_order( ${id} )->update_status( 'completed' ); echo 'ok';`);
    runWpQueue();
    const done = await waitFor(() => { runWpQueue(); return sql(`select status from store_orders where id='${app}'`) === 'delivered' ? true : undefined; }, 60000, 3000);
    expect(done).toBe(true);
    const me = await api(cust, 'GET', `/store/orders/${app}`);
    expect(me.b.status).toBe('delivered');
    expect(JSON.stringify(me.b)).not.toMatch(/passwordHash/);
  });

  it('the price changed between the quote and the order: nothing is created and the new price is returned', async () => {
    await clearCart(cust);
    await addToCart(cust, appProduct(simple.id), appVariant(simple.id), 1);
    const before = wcCount();
    const o = await api(cust, 'POST', '/store/orders', { addressId, paymentMethod: 'cod', expectedTotal: 1 });
    expect(o.s).toBe(409);
    expect(wcCount()).toBe(before);
    expect((await api(cust, 'GET', '/store/cart')).b.items).toHaveLength(1); // the cart is kept
    await clearCart(cust);
  });

  it('a lost answer is safe: the same order sent twice becomes one', async () => {
    const appId = '5f1d0c0e-1111-4222-8333-' + stamp.padStart(12, '0');
    const body = { appOrderId: appId, items: [{ product: simple.id, qty: 1 }], customer: { name: 'Retry Test', phone: APP_CUSTOMER.slice(3) }, address: { line1: '1 Test St', city: 'Lucknow', state: 'Uttar Pradesh', pincode: '226001' }, payment: 'cod' };
    const a = await signedWp('POST', '/wt/v1/connector/store/orders', { body });
    const b = await signedWp('POST', '/wt/v1/connector/store/orders', { body });
    expect(a.s).toBe(200);
    expect(b.b.duplicate).toBe(true);
    expect(b.b.id).toBe(a.b.id);
    orders.push(a.b.id);
    expect(stock(simple.id)).toBe(0); // 5 - 2 - 2 - 1
    setStock(simple.id, 5);
  });
});

describe('stock safety', () => {
  it('only the last item: two shoppers at once, exactly one gets it', async () => {
    setStock(simple.id, 1);
    const body = (n: number) => ({ appOrderId: `6a2e1d1f-2222-4333-8444-${stamp}${n}`.padEnd(36, '0').slice(0, 36), items: [{ product: simple.id, qty: 1 }], customer: { name: 'Racer ' + n, phone: APP_CUSTOMER.slice(3) }, address: { line1: '1 Test St', city: 'Lucknow', state: 'Uttar Pradesh', pincode: '226001' }, payment: 'online' });
    const [a, b] = await Promise.all([signedWp('POST', '/wt/v1/connector/store/orders', { body: body(1) }), signedWp('POST', '/wt/v1/connector/store/orders', { body: body(2) })]);
    const results = [a.s, b.s].sort();
    expect(results).toEqual([200, 409]);
    const won = a.s === 200 ? a : b;
    orders.push(won.b.id);
    const lost = a.s === 200 ? b : a;
    expect(JSON.stringify(lost.b)).toMatch(/no longer available|out of stock/);
    // the winner's items are held, nobody else can order them
    const third = await signedWp('POST', '/wt/v1/connector/store/orders', { body: body(3) });
    expect(third.s).toBe(409);
    // an unpaid order that is cancelled gives the item back
    wp(`wc_get_order( ${won.b.id} )->update_status( 'cancelled' ); echo 'ok';`);
    const again = await signedWp('POST', '/wt/v1/connector/store/orders', { body: body(4) });
    expect(again.s).toBe(200);
    orders.push(again.b.id);
    wp(`wc_get_order( ${again.b.id} )->update_status( 'cancelled' ); echo 'ok';`);
    setStock(simple.id, 5);
  });

  it('more than the stock is refused with what is left', async () => {
    setStock(simple.id, 2);
    const r = await signedWp('POST', '/wt/v1/connector/store/quote', { body: { items: [{ product: simple.id, qty: 3 }], customer: { name: 'X', phone: APP_CUSTOMER.slice(3) }, address: { line1: '1', city: 'Lucknow', state: 'Uttar Pradesh', pincode: '226001' } } });
    expect(r.s).toBe(409);
    expect(JSON.stringify(r.b)).toMatch(/only 2 left/);
    setStock(simple.id, 5);
  });

  it('a payment that arrives after the unpaid order was cancelled is reported, not hidden', async () => {
    const body = { appOrderId: `7b3f2e20-3333-4444-8555-${stamp}9`.padEnd(36, '0').slice(0, 36), items: [{ product: simple.id, qty: 1 }], customer: { name: 'Late Payer', phone: APP_CUSTOMER.slice(3) }, address: { line1: '1 Test St', city: 'Lucknow', state: 'Uttar Pradesh', pincode: '226001' }, payment: 'online' };
    const o = await signedWp('POST', '/wt/v1/connector/store/orders', { body });
    expect(o.s).toBe(200);
    orders.push(o.b.id);
    wp(`wc_get_order( ${o.b.id} )->update_status( 'cancelled' ); echo 'ok';`);
    const late = await signedWp('POST', `/wt/v1/connector/store/orders/${o.b.id}/paid`, { body: { txn: 'late_1' } });
    expect(late.s).toBe(200);
    expect(late.b.late).toBe(true);
    expect(wcOrder(o.b.id).status).toBe('cancelled');
    const notes = wp(`echo count( wc_get_order_notes( array( 'order_id' => ${o.b.id} ) ) );`);
    expect(Number(notes)).toBeGreaterThan(0);
  });
});

describe('who can use the connector store routes', () => {
  it('refuses unsigned and wrongly signed calls and unknown orders', async () => {
    expect((await http('GET', 'http://localhost:8090/wp-json/wt/v1/connector/store/catalog')).s).toBe(401);
    expect((await signedWp('GET', '/wt/v1/connector/store/catalog', { secret: 'wrong' })).s).toBe(401);
    expect((await signedWp('GET', '/wt/v1/connector/store/orders/999999')).s).toBe(404);
    // a normal WooCommerce order (not made in the app) is not readable through the connector
    const id = Number(wp(`$o = wc_create_order(); $o->save(); echo $o->get_id();`));
    orders.push(id);
    expect((await signedWp('GET', `/wt/v1/connector/store/orders/${id}`)).s).toBe(404);
    expect((await signedWp('POST', `/wt/v1/connector/store/orders/${id}/paid`, { body: {} })).s).toBe(404);
  });

  it('customers cannot read each other\'s orders in the app', async () => {
    const mine = sql(`select id from store_orders where wc_order_id=${orders[0]}`);
    expect((await api(cust, 'GET', `/store/orders/${mine}`)).s).toBe(200);
    expect((await api(partner, 'GET', `/store/orders/${mine}`)).s).toBeGreaterThanOrEqual(403);
  });
});

describe('partner price', () => {
  it('groomers see the shop price minus the partner discount, and coupons are not allowed on top', async () => {
    await syncCatalog();
    expect(Number(sql(`select trade_price from products where wc_id=${simple.id}`))).toBe(400); // 500 - 20%
    await clearCart(partner);
    expect((await addToCart(partner, appProduct(simple.id), appVariant(simple.id), 1)).s).toBeLessThan(300);
    const q = await api(partner, 'POST', '/store/quote', { addressId: partnerAddressId });
    expect(q.s).toBeLessThan(300);
    expect(q.b.subtotal).toBe(400);
    const withCoupon = await api(partner, 'POST', '/store/quote', { addressId: partnerAddressId, couponCode: 'E2E10' });
    expect(withCoupon.b.couponError).toMatch(/partner/i);
    expect(withCoupon.b.discount).toBe(0);
  });

  it('a partner can order and pay online; the order is marked Partner in WooCommerce', async () => {
    const quote = (await api(partner, 'POST', '/store/quote', { addressId: partnerAddressId })).b;
    const o = await api(partner, 'POST', '/store/orders', { addressId: partnerAddressId, paymentMethod: 'upi', expectedTotal: quote.total });
    expect(o.s).toBeLessThan(300);
    orders.push(o.b.wcOrderId);
    expect(wcOrder(o.b.wcOrderId).partner).toBe(true);
    const pay = await api(partner, 'POST', '/payments/orders', { orderId: o.b.id });
    expect(pay.s).toBeLessThan(300);
    expect((await api(partner, 'PATCH', `/payments/${pay.b.payment.id}/confirm`, { method: 'upi', providerPaymentId: 'mock_pay_p' + stamp, signature: 'mock' })).s).toBeLessThan(300);
    expect(await waitFor(() => (wcOrder(o.b.wcOrderId).status === 'processing' ? true : undefined), 60000, 2000)).toBe(true);
  });

  it('a partner cannot pay for a booking, and a customer cannot use partner prices', async () => {
    expect((await api(partner, 'POST', '/payments/orders', { bookingId: '00000000-0000-0000-0000-000000000000' })).s).toBe(403);
    await clearCart(cust);
    await addToCart(cust, appProduct(simple.id), appVariant(simple.id), 1);
    expect((await api(cust, 'POST', '/store/quote', { addressId })).b.subtotal).toBe(500);
    await clearCart(cust);
    await clearCart(partner);
  });
});

describe('pet insurance goes to the website\'s Insurance leads and the status comes back', () => {
  it('a request from the app appears once in the website list, and closing it there updates the app', async () => {
    const pet = sql(`select p.id from pets p join users u on u.id=p.customer_id where u.phone='${APP_CUSTOMER}' and p.is_active limit 1`);
    if (!pet) return;
    sql(`delete from pet_insurance_requests where customer_id=(select id from users where phone='${APP_CUSTOMER}')`);
    const r = await api(cust, 'POST', '/insurance/requests', {
      petId: pet, ownerName: 'Insurance Tester', phone: APP_CUSTOMER.slice(3), city: 'Lucknow', planType: 'accident', coverAmount: '50000', preExisting: false, preferredCallTime: 'any', consent: true,
    });
    expect(r.s).toBeLessThan(300);
    const lead = await waitFor(() => {
      const j = wpJson<any[]>(`array_values( array_filter( wt_rec_list( 'insurance', array(), 'id DESC', 20 ), function( $l ) { return ( $l['appId'] ?? '' ) === '${r.b.id}'; } ) )`);
      return j.length ? j : undefined;
    }, 60000, 3000);
    expect(lead).toBeTruthy();
    expect(lead!).toHaveLength(1);
    expect(lead![0].data['Pet name']).toBeTruthy();
    expect(lead![0].data['Source']).toBe('App');
    // the same request again is still one lead
    const dup = await signedWp('POST', '/wt/v1/connector/insurance', { body: { appId: r.b.id, phone: APP_CUSTOMER.slice(3), fields: { 'Pet name': 'x' } } });
    expect(dup.b.duplicate).toBe(true);
    // closing it in the website's list reaches the app
    wp(`$l = wt_rec_get( 'insurance', '${lead![0].id}' ); $l['status'] = 'Contacted'; wt_rec_save( 'insurance', $l ); echo 'ok';`);
    const ok = await waitFor(() => { runWpQueue(); return sql(`select status from pet_insurance_requests where id='${r.b.id}'`) === 'contacted' ? true : undefined; }, 150000, 5000);
    expect(ok).toBe(true);
  });
});

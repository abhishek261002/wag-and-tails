<?php
/**
 * The apps' store is this site's WooCommerce shop (one store, decided 25 Nov 2026).
 *
 *  - connector/store/catalog        products, variations, stock and the partner discount, copied by the backend
 *  - connector/store/quote          what an order would cost: WooCommerce prices, coupon, shipping, cash on delivery
 *  - connector/store/orders         create the order (pending until paid online, processing for cash on delivery)
 *  - connector/store/orders/{id}    read it; /paid confirms the online payment; /cancel cancels an unpaid one
 *
 * App orders are ordinary WooCommerce orders (created_via "wag-app"), handled in WooCommerce → Orders and by
 * Shiprocket/BigShip like website orders. Their status changes are sent to the backend so the app shows them.
 * All routes are signed (wt_conn_auth): only the backend can call them.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Partner (groomer) price = shop price minus this percent. */
function wt_store_partner_pct() {
	$v = (float) ( wt_config()['settings']['partnerDiscountPct'] ?? 0 );
	return max( 0, min( 90, $v ) );
}

function wt_store_qty( $p ) {
	if ( ! $p->is_in_stock() ) {
		return 0;
	}
	if ( ! $p->managing_stock() ) {
		return 999;
	}
	// Stock held for orders that are waiting for payment (website checkouts and app orders) is not for sale.
	$held = function_exists( 'wc_get_held_stock_quantity' ) ? (int) wc_get_held_stock_quantity( $p ) : 0;
	return max( 0, (int) $p->get_stock_quantity() - $held );
}

function wt_conn_store_catalog() {
	if ( ! wt_woo_on() ) {
		return array( 'woo' => false, 'products' => array(), 'partnerDiscountPct' => wt_store_partner_pct() );
	}
	$out = array();
	foreach ( wt_catalog() as $row ) {
		$p = wc_get_product( $row['id'] );
		if ( ! $p ) {
			continue;
		}
		$row['qty'] = wt_store_qty( $p );
		$row['sku'] = (string) $p->get_sku();
		if ( ! empty( $row['vars'] ) ) {
			foreach ( $row['vars'] as &$v ) {
				$vp       = wc_get_product( $v['id'] );
				$v['qty'] = $vp ? wt_store_qty( $vp ) : 0;
				$v['sku'] = $vp ? (string) $vp->get_sku() : '';
				$names    = array();
				foreach ( (array) $v['a'] as $ak => $av ) {
					$tax     = str_replace( 'attribute_', '', $ak );
					$names[] = taxonomy_exists( $tax ) ? wt_attr_label( $tax, $av ) : $av;
				}
				$v['name'] = implode( ' / ', array_filter( $names ) );
			}
			unset( $v );
		}
		$out[] = $row;
	}
	return array( 'woo' => true, 'products' => $out, 'partnerDiscountPct' => wt_store_partner_pct() );
}

/** WooCommerce state code for a state name ("Uttar Pradesh" → "UP"); unknown names pass through. */
function wt_store_state( $name ) {
	$states = WC()->countries ? (array) WC()->countries->get_states( 'IN' ) : array();
	foreach ( $states as $code => $label ) {
		if ( 0 === strcasecmp( trim( (string) $name ), $label ) || 0 === strcasecmp( trim( (string) $name ), $code ) ) {
			return $code;
		}
	}
	return sanitize_text_field( (string) $name );
}

function wt_store_cod_on() {
	$g = WC()->payment_gateways() ? WC()->payment_gateways()->payment_gateways() : array();
	return isset( $g['cod'] ) && 'yes' === $g['cod']->enabled;
}

/**
 * Builds a WooCommerce order from the app's cart. Prices, stock, coupon and shipping all come from WooCommerce.
 * $in: items [{product, variation?, qty}], coupon?, partner (bool), customer {name, phone, email?}, address {...}
 */
function wt_store_build( $in, $status ) {
	if ( ! wt_woo_on() ) {
		return wt_err( 'The shop is not available.', 'wt_no_store', 503 );
	}
	// WooCommerce's cart, session and customer are not loaded in a REST call; shipping rates need them.
	if ( function_exists( 'wc_load_cart' ) && ( ! WC()->session || ! WC()->cart ) ) {
		wc_load_cart();
	}
	$items = isset( $in['items'] ) && is_array( $in['items'] ) ? array_slice( $in['items'], 0, 50 ) : array();
	if ( ! $items ) {
		return wt_err( 'The cart is empty.' );
	}
	$partner = ! empty( $in['partner'] );
	$cust    = isset( $in['customer'] ) && is_array( $in['customer'] ) ? $in['customer'] : array();
	$addr    = isset( $in['address'] ) && is_array( $in['address'] ) ? $in['address'] : array();
	$phone   = wt_phone( $cust['phone'] ?? '' );
	if ( ! wt_valid_mobile( $phone ) ) {
		return wt_err( 'A valid phone is required.' );
	}

	// Check every line first, so nothing is created for a cart that cannot be bought.
	$lines    = array();
	$problems = array();
	foreach ( $items as $it ) {
		$pid = (int) ( $it['product'] ?? 0 );
		$vid = (int) ( $it['variation'] ?? 0 );
		$qty = (int) ( $it['qty'] ?? 0 );
		$p   = wc_get_product( $vid ? $vid : $pid );
		if ( $qty < 1 || $qty > 20 ) {
			return wt_err( 'Quantity must be between 1 and 20.' );
		}
		if ( ! $p || ( $vid && $p->get_parent_id() !== $pid ) || 'publish' !== get_post_status( $vid ? $p->get_parent_id() : $p->get_id() ) || ! $p->is_purchasable() || ( ! $vid && $p->is_type( 'variable' ) ) ) {
			$problems[] = array( 'product' => $pid, 'variation' => $vid, 'reason' => 'unavailable' );
			continue;
		}
		$have = wt_store_qty( $p );
		if ( $have < $qty ) {
			$problems[] = array( 'product' => $pid, 'variation' => $vid, 'reason' => $have > 0 ? 'only ' . $have . ' left' : 'out of stock', 'left' => $have );
			continue;
		}
		$lines[] = array( $p, $qty );
	}
	if ( $problems ) {
		return new WP_Error( 'wt_stock', 'Some items are no longer available.', array( 'status' => 409, 'problems' => $problems ) );
	}

	$user  = wt_user_by_phone( $phone );
	$order = wc_create_order(
		array(
			'status'      => $status,
			'customer_id' => $user ? $user->ID : 0,
			'created_via' => 'wag-app',
		)
	);
	if ( is_wp_error( $order ) ) {
		return wt_err( 'Could not create the order.', 'wt_order', 500 );
	}
	$pct = $partner ? wt_store_partner_pct() : 0;
	foreach ( $lines as $l ) {
		$order->add_product( $l[0], $l[1] );
	}
	// Partner price: the shop price minus the partner discount, on every line (items have no id until the order is saved).
	if ( $pct > 0 ) {
		foreach ( $order->get_items() as $item ) {
			$prod = $item->get_product();
			if ( $prod ) {
				$line = round( round( (float) $prod->get_price() * ( 1 - $pct / 100 ), 2 ) * $item->get_quantity(), 2 );
				$item->set_subtotal( $line );
				$item->set_total( $line );
			}
		}
	}
	$name  = trim( sanitize_text_field( (string) ( $cust['name'] ?? '' ) ) );
	$parts = explode( ' ', $name, 2 );
	$a     = array(
		'first_name' => $parts[0] ?? '',
		'last_name'  => $parts[1] ?? '',
		'phone'      => $phone,
		'email'      => sanitize_email( (string) ( $cust['email'] ?? '' ) ),
		'address_1'  => sanitize_text_field( (string) ( $addr['line1'] ?? '' ) ),
		'address_2'  => sanitize_text_field( (string) ( $addr['line2'] ?? '' ) ),
		'city'       => sanitize_text_field( (string) ( $addr['city'] ?? '' ) ),
		'state'      => wt_store_state( $addr['state'] ?? '' ),
		'postcode'   => preg_replace( '/\D/', '', (string) ( $addr['pincode'] ?? '' ) ),
		'country'    => 'IN',
	);
	$order->set_address( $a, 'billing' );
	unset( $a['email'] );
	$order->set_address( $a, 'shipping' );

	// Coupon: WooCommerce decides (expiry, minimum, usage limits, products). Not for partner prices.
	$coupon_error = '';
	$code         = wc_format_coupon_code( (string) ( $in['coupon'] ?? '' ) );
	if ( $code ) {
		if ( $partner ) {
			$coupon_error = 'Coupons cannot be used with partner prices.';
		} else {
			$r = $order->apply_coupon( $code );
			if ( is_wp_error( $r ) ) {
				$coupon_error = wp_strip_all_tags( $r->get_error_message() );
			}
		}
	}

	// Shipping: put the same items in WooCommerce's own cart and let it work out the rates for this address, so every
	// rule (zones, flat rate, free shipping above an amount, classes, coupons) behaves exactly as at the website checkout.
	$order->calculate_totals( false );
	$best = null;
	if ( WC()->cart && WC()->customer && WC()->shipping() ) {
		$price_cut = function ( $price ) use ( $pct ) {
			return '' === $price ? $price : round( (float) $price * ( 1 - $pct / 100 ), 2 );
		};
		if ( $pct > 0 ) {
			add_filter( 'woocommerce_product_get_price', $price_cut );
			add_filter( 'woocommerce_product_variation_get_price', $price_cut );
		}
		WC()->cart->empty_cart( false );
		foreach ( $lines as $l ) {
			$pp = $l[0]->is_type( 'variation' ) ? $l[0]->get_parent_id() : $l[0]->get_id();
			$vv = $l[0]->is_type( 'variation' ) ? $l[0]->get_id() : 0;
			WC()->cart->add_to_cart( $pp, $l[1], $vv, $vv ? $l[0]->get_variation_attributes() : array() );
		}
		foreach ( $order->get_coupon_codes() as $cc ) {
			WC()->cart->apply_coupon( $cc );
		}
		foreach ( array( 'billing', 'shipping' ) as $kind ) {
			WC()->customer->{"set_{$kind}_location"}( 'IN', $a['state'], $a['postcode'], $a['city'] );
		}
		WC()->cart->calculate_totals();
		foreach ( (array) WC()->shipping()->get_packages() as $pkg ) {
			foreach ( (array) ( $pkg['rates'] ?? array() ) as $rate ) {
				if ( null === $best || (float) $rate->get_cost() < (float) $best->get_cost() ) {
					$best = $rate;
				}
			}
		}
		WC()->cart->empty_cart( false );
		if ( $pct > 0 ) {
			remove_filter( 'woocommerce_product_get_price', $price_cut );
			remove_filter( 'woocommerce_product_variation_get_price', $price_cut );
		}
	}
	if ( $best ) {
		$ship = new WC_Order_Item_Shipping();
		$ship->set_method_title( $best->get_label() );
		$ship->set_method_id( $best->get_method_id() );
		$ship->set_instance_id( $best->get_instance_id() );
		$ship->set_total( (float) $best->get_cost() );
		$order->add_item( $ship );
	}
	$order->calculate_totals( true );
	$order->update_meta_data( '_wt_app_order', sanitize_text_field( (string) ( $in['appOrderId'] ?? '' ) ) ?: 'quote' );
	if ( $partner ) {
		$order->update_meta_data( '_wt_partner', 1 );
	}
	$order->save();
	return array( 'order' => $order, 'couponError' => $coupon_error );
}

function wt_store_out( $order, $extra = array() ) {
	$lines = array();
	foreach ( $order->get_items() as $item ) {
		$lines[] = array(
			'product'   => $item->get_product_id(),
			'variation' => $item->get_variation_id(),
			'name'      => $item->get_name(),
			'qty'       => $item->get_quantity(),
			'total'     => round( (float) $item->get_total(), 2 ),
		);
	}
	return array_merge(
		array(
			'id'        => $order->get_id(),
			'number'    => (string) $order->get_order_number(),
			'status'    => $order->get_status(),
			'paid'      => (bool) $order->is_paid(),
			'lines'     => $lines,
			'subtotal'  => round( (float) $order->get_subtotal(), 2 ),
			'discount'  => round( (float) $order->get_discount_total(), 2 ),
			'shipping'  => round( (float) $order->get_shipping_total(), 2 ),
			'shippingMethod' => $order->get_shipping_method(),
			'tax'       => round( (float) $order->get_total_tax(), 2 ),
			'total'     => round( (float) $order->get_total(), 2 ),
			'coupons'   => $order->get_coupon_codes(),
			'partner'   => (bool) $order->get_meta( '_wt_partner' ),
			'appOrder'  => (string) $order->get_meta( '_wt_app_order' ),
			'tracking'  => (string) ( $order->get_meta( '_wt_tracking' ) ?: $order->get_meta( '_tracking_number' ) ),
		),
		$extra
	);
}

/** What the order would cost now. Built as a hidden draft and deleted at once. */
function wt_conn_store_quote( $in ) {
	$r = wt_store_build( $in, 'checkout-draft' );
	if ( is_wp_error( $r ) ) {
		return $r;
	}
	$out = wt_store_out( $r['order'], array( 'couponError' => $r['couponError'], 'cod' => wt_store_cod_on() ) );
	unset( $out['id'], $out['number'], $out['status'], $out['paid'] );
	$r['order']->delete( true );
	return $out;
}

/** Creates the order once per app order id. expectedTotal must match, so the customer pays what they saw. */
function wt_conn_store_create( $in ) {
	$app_id = preg_match( '/^[0-9a-f\-]{36}$/i', (string) ( $in['appOrderId'] ?? '' ) ) ? strtolower( $in['appOrderId'] ) : '';
	if ( ! $app_id ) {
		return wt_err( 'appOrderId is required.' );
	}
	// One order at a time site-wide: two shoppers for the last item must not both pass the stock check.
	return wt_conn_locked(
		'storeall',
		function () use ( $in, $app_id ) {
			return wt_conn_locked(
				'store' . $app_id,
				function () use ( $in, $app_id ) {
					return wt_conn_store_create_locked( $in, $app_id );
				}
			);
		}
	);
}

function wt_conn_store_create_locked( $in, $app_id ) {
	return call_user_func(
		function () use ( $in, $app_id ) {
			$prev = wt_conn_xref_get( 'O' . str_replace( '-', '', $app_id ) );
			if ( $prev && ( $o = wc_get_order( (int) $prev ) ) ) {
				return wt_store_out( $o, array( 'duplicate' => true ) );
			}
			$cod = 'cod' === ( $in['payment'] ?? '' );
			if ( $cod && ! wt_store_cod_on() ) {
				return wt_err( 'Cash on delivery is not available. Please pay online.', 'wt_no_cod', 409 );
			}
			$r = wt_store_build( $in, 'pending' );
			if ( is_wp_error( $r ) ) {
				return $r;
			}
			$order = $r['order'];
			if ( '' !== $r['couponError'] ) {
				$order->delete( true );
				return new WP_Error( 'wt_coupon', $r['couponError'], array( 'status' => 409 ) );
			}
			$expected = isset( $in['expectedTotal'] ) ? (float) $in['expectedTotal'] : null;
			if ( null !== $expected && abs( (float) $order->get_total() - $expected ) > 0.5 ) {
				$out = wt_store_out( $order );
				$order->delete( true );
				return new WP_Error( 'wt_price', 'The price changed. Please check the new total.', array( 'status' => 409, 'quote' => $out ) );
			}
			$order->update_meta_data( '_wt_app_order', $app_id );
			$order->add_order_note( ( empty( $in['partner'] ) ? 'Ordered in the Wag & Tails app.' : 'Ordered by a partner in the partner app (partner price, ' . wt_store_partner_pct() . '% off).' ) );
			if ( $cod ) {
				$order->set_payment_method( 'cod' );
				$order->set_payment_method_title( 'Cash on delivery' );
				$order->save();
				$order->update_status( 'processing', 'Cash on delivery (app).' );
			} else {
				$order->set_payment_method( 'wt_app_online' );
				$order->set_payment_method_title( 'Paid online in the app (Razorpay)' );
				$order->save();
				// Keep the items aside while the customer pays (the same hold a website checkout gets).
				try {
					( new \Automattic\WooCommerce\Checkout\Helpers\ReserveStock() )->reserve_stock_for_order( $order, (int) get_option( 'woocommerce_hold_stock_minutes', 60 ) ?: 60 );
				} catch ( \Exception $e ) {
					$order->delete( true );
					return new WP_Error( 'wt_stock', 'Some items are no longer available.', array( 'status' => 409, 'problems' => array( array( 'reason' => 'out of stock' ) ) ) );
				}
			}
			wt_conn_xref_set( 'O' . str_replace( '-', '', $app_id ), (string) $order->get_id() );
			return wt_store_out( $order );
		}
	);
}

function wt_store_app_order( $in ) {
	$o = wc_get_order( (int) ( $in['id'] ?? 0 ) );
	if ( ! $o || ! $o->get_meta( '_wt_app_order' ) || 'quote' === $o->get_meta( '_wt_app_order' ) ) {
		return wt_err( 'Order not found.', 'wt_404', 404 );
	}
	return $o;
}

function wt_conn_store_get( $in ) {
	$o = wt_store_app_order( $in );
	return is_wp_error( $o ) ? $o : wt_store_out( $o );
}

/** The app's payment went through. Idempotent; a cancelled order (unpaid too long) is reported, not revived. */
function wt_conn_store_paid( $in ) {
	$o = wt_store_app_order( $in );
	if ( is_wp_error( $o ) ) {
		return $o;
	}
	if ( $o->is_paid() ) {
		return wt_store_out( $o );
	}
	if ( in_array( $o->get_status(), array( 'cancelled', 'failed', 'refunded' ), true ) ) {
		$o->add_order_note( 'Online payment arrived after the order was ' . $o->get_status() . ' (payment ' . sanitize_text_field( (string) ( $in['txn'] ?? '' ) ) . '). Refund it or restore the order.' );
		return wt_store_out( $o, array( 'late' => true ) );
	}
	$o->payment_complete( sanitize_text_field( (string) ( $in['txn'] ?? '' ) ) );
	return wt_store_out( wc_get_order( $o->get_id() ) );
}

function wt_conn_store_cancel( $in ) {
	$o = wt_store_app_order( $in );
	if ( is_wp_error( $o ) ) {
		return $o;
	}
	if ( 'pending' === $o->get_status() ) {
		$o->update_status( 'cancelled', sanitize_text_field( (string) ( $in['reason'] ?? 'Cancelled in the app before payment.' ) ) );
	}
	return wt_store_out( wc_get_order( $o->get_id() ) );
}

add_action(
	'rest_api_init',
	function () {
		$routes = array(
			array( 'GET', 'connector/store/catalog', 'wt_conn_store_catalog' ),
			array( 'POST', 'connector/store/quote', 'wt_conn_store_quote' ),
			array( 'POST', 'connector/store/orders', 'wt_conn_store_create' ),
			array( 'GET', 'connector/store/orders/(?P<id>\d+)', 'wt_conn_store_get' ),
			array( 'POST', 'connector/store/orders/(?P<id>\d+)/paid', 'wt_conn_store_paid' ),
			array( 'POST', 'connector/store/orders/(?P<id>\d+)/cancel', 'wt_conn_store_cancel' ),
		);
		foreach ( $routes as $rt ) {
			register_rest_route( 'wt/v1', '/' . $rt[1], array( 'methods' => $rt[0], 'permission_callback' => 'wt_conn_auth', 'callback' => wt_rest( $rt[2] ) ) );
		}
	}
);

/** App orders' status changes (Processing, Completed, Cancelled, ...) go to the backend, so the app shows them. */
add_action(
	'woocommerce_order_status_changed',
	function ( $order_id, $from, $to, $order ) {
		$order = $order ? $order : wc_get_order( $order_id );
		$app   = $order ? (string) $order->get_meta( '_wt_app_order' ) : '';
		if ( ! $app || 'quote' === $app || '' === wt_conn_secret() || ! defined( 'WT_CONNECTOR_URL' ) || ! WT_CONNECTOR_URL ) {
			return;
		}
		$GLOBALS['wt_conn_queue'][ 'order|' . $order_id ] = array( 'order', (string) $order_id, 'update', ! empty( $GLOBALS['wt_conn_in'] ) );
	},
	20,
	4
);

/** Unpaid app orders are cancelled after WooCommerce's "hold stock" time, like unpaid website orders. */
add_filter(
	'woocommerce_cancel_unpaid_order',
	function ( $cancel, $order ) {
		return $cancel || ( $order && 'wt_app_online' === $order->get_payment_method() && $order->get_meta( '_wt_app_order' ) );
	},
	10,
	2
);

/** Product changes reach the apps within a minute instead of waiting for the next 10-minute copy. */
function wt_store_ping() {
	if ( '' === wt_conn_secret() || ! defined( 'WT_CONNECTOR_URL' ) || ! WT_CONNECTOR_URL ) {
		return;
	}
	$GLOBALS['wt_conn_queue']['catalog|all'] = array( 'catalog', 'all', 'update', false );
}
add_action( 'woocommerce_update_product', 'wt_store_ping' );
add_action( 'woocommerce_update_product_variation', 'wt_store_ping' );
add_action( 'woocommerce_product_set_stock', 'wt_store_ping' );
add_action( 'woocommerce_variation_set_stock', 'wt_store_ping' );

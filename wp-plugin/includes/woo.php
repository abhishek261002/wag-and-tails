<?php
/**
 * WooCommerce: the store. Products shown in the app, reward points earned on delivered
 * orders, and points used as a discount at the WooCommerce checkout.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function wt_woo_on() {
	return class_exists( 'WooCommerce' );
}

/** Size codes used by the shop filter, keyed by the Size attribute's term name. */
function wt_size_code( $name ) {
	$n = strtolower( trim( (string) $name ) );
	$map = array( 'x-small' => 'XS', 'xs' => 'XS', 'small' => 'S', 's' => 'S', 'medium' => 'M', 'm' => 'M', 'large' => 'L', 'l' => 'L', 'x-large' => 'XL', 'xl' => 'XL', 'xlarge' => 'XL' );
	return isset( $map[ $n ] ) ? $map[ $n ] : '';
}

/** Breed -> usual size, plus the size-guide text the shop shows. */
function wt_shop_guides() {
	$dog = array(
		'chihuahua' => 'XS', 'yorkshire terrier' => 'XS',
		'pug' => 'S', 'shih tzu' => 'S', 'lhasa apso' => 'S', 'pomeranian' => 'S', 'maltese' => 'S', 'dachshund' => 'S', 'poodle' => 'S',
		'beagle' => 'M', 'cocker spaniel' => 'M', 'french bulldog' => 'M', 'indie / desi' => 'M',
		'labrador retriever' => 'L', 'golden retriever' => 'L', 'german shepherd' => 'L', 'siberian husky' => 'L', 'boxer' => 'L', 'doberman' => 'L',
		'rottweiler' => 'XL', 'great dane' => 'XL', 'saint bernard' => 'XL',
	);
	$cat = array( 'maine coon' => 'M', 'ragdoll' => 'M' );
	$cfg = wt_config();
	$out = array( 'Dog' => array(), 'Cat' => array() );
	foreach ( array( 'Dog', 'Cat' ) as $pet ) {
		$names = isset( $cfg['breeds'][ $pet ] ) ? (array) $cfg['breeds'][ $pet ] : array();
		foreach ( $names as $b ) {
			$k = strtolower( trim( $b ) );
			if ( 'Cat' === $pet ) {
				$out['Cat'][ $b ] = isset( $cat[ $k ] ) ? $cat[ $k ] : ( false !== strpos( $k, 'other' ) ? '' : 'S' );
			} else {
				$out['Dog'][ $b ] = isset( $dog[ $k ] ) ? $dog[ $k ] : '';
			}
		}
	}
	$guides = array(
		'bed'    => array(
			'how'  => 'Measure your pet lying down in its usual sleeping position, nose to base of tail, and add 15 to 20 cm. Between sizes, or likes to stretch out? Choose the larger size.',
			'rows' => array(
				'S'  => 'Cats, kittens, puppies and toy breeds up to about 8 kg: Shih Tzu, Pug, Pomeranian, Maltese, Lhasa Apso, Persian cat',
				'M'  => 'Dogs of 8 to 18 kg: Beagle, Cocker Spaniel, French Bulldog, Dachshund, young Indie dogs',
				'L'  => 'Dogs of 18 to 30 kg: Indie dogs, young Labradors, Siberian Husky, Boxer',
				'XL' => 'Dogs above 30 kg: Labrador, Golden Retriever, German Shepherd, Rottweiler, Great Dane',
			),
		),
		'jacket' => array(
			'how'  => 'Measure the back from the base of the neck to the base of the tail. Broad chest or stocky build? Choose one size up.',
			'rows' => array(
				'XS' => 'Back about 12 in (30 cm): Chihuahua, Yorkshire Terrier, toy Pomeranian, kittens',
				'S'  => 'Back about 16 in (40 cm): Shih Tzu, Pug, Lhasa Apso, Pomeranian, cats',
				'M'  => 'Back about 20 in (50 cm): Beagle, Cocker Spaniel, French Bulldog, Indie dogs',
				'L'  => 'Back about 24 in (60 cm): Labrador, Golden Retriever, German Shepherd, Husky',
			),
		),
		'shirt'  => array(
			'how'  => 'Measure the back from the base of the neck to the base of the tail. Between sizes? Choose the larger one.',
			'rows' => array(
				'XS' => 'Puppies and toy breeds: Chihuahua, Yorkshire Terrier',
				'S'  => 'Small breeds: Shih Tzu, Pug, Lhasa Apso, Pomeranian',
				'M'  => 'Medium breeds: Beagle, Cocker Spaniel, Indie dogs',
				'L'  => 'Large breeds: Labrador, Golden Retriever, German Shepherd',
			),
		),
		'walk'   => array(
			'how'  => 'Measure around the neck (collar) or the widest part of the chest behind the front legs (harness). Two fingers should slide under the strap.',
			'rows' => array(
				'S' => 'Puppies and small breeds: Shih Tzu, Pug, Pomeranian, Lhasa Apso, Maltese',
				'M' => 'Medium breeds: Beagle, Cocker Spaniel, French Bulldog, Indie dogs',
				'L' => 'Large breeds over 8 months: Labrador, Golden Retriever, German Shepherd, Rottweiler',
			),
		),
	);
	$up = array();
	foreach ( array_keys( $out['Dog'] ) as $b ) {
		if ( in_array( strtolower( $b ), array( 'labrador retriever', 'golden retriever', 'german shepherd', 'doberman' ), true ) ) {
			$up[] = $b;
		}
	}
	return array( 'breeds' => $out, 'guides' => $guides, 'bedUp' => $up );
}

function wt_attr_label( $key, $value ) {
	if ( taxonomy_exists( $key ) ) {
		$t = get_term_by( 'slug', $value, $key );
		return $t ? $t->name : $value;
	}
	return $value;
}

/** The full store catalogue for the app's Shop page (sizes, pets, options, variations, gallery). */
function wt_catalog() {
	if ( ! wt_woo_on() ) {
		return array();
	}
	$cache = get_transient( 'wt_catalog' );
	if ( is_array( $cache ) ) {
		return $cache;
	}
	$out   = array();
	$items = wc_get_products(
		array(
			'status'  => 'publish',
			'limit'   => 600,
			'orderby' => array( 'menu_order' => 'ASC', 'date' => 'DESC' ),
		)
	);
	foreach ( $items as $p ) {
		if ( 'hidden' === $p->get_catalog_visibility() ) {
			continue;
		}
		$id   = $p->get_id();
		$cats = wp_get_post_terms( $id, 'product_cat', array( 'fields' => 'names' ) );
		$cats = array_values(
			array_filter(
				(array) $cats,
				function ( $n ) {
					return 'Uncategorized' !== $n;
				}
			)
		);
		/* pet: Pet attribute first, then dog/cat tags */
		$pets = array_filter( array_map( 'trim', explode( ',', (string) $p->get_attribute( 'pa_pet' ) ) ) );
		if ( ! $pets ) {
			$tags = array_map( 'strtolower', (array) wp_get_post_terms( $id, 'product_tag', array( 'fields' => 'names' ) ) );
			if ( in_array( 'dog', $tags, true ) ) {
				$pets[] = 'Dog';
			}
			if ( in_array( 'cat', $tags, true ) ) {
				$pets[] = 'Cat';
			}
		}
		$pets  = array_values( array_intersect( array( 'Dog', 'Cat' ), array_map( 'ucfirst', array_map( 'strtolower', $pets ) ) ) );
		$sizes = array();
		foreach ( array_map( 'trim', explode( ',', (string) $p->get_attribute( 'pa_size' ) ) ) as $sn ) {
			$c = wt_size_code( $sn );
			if ( $c && ! in_array( $c, $sizes, true ) ) {
				$sizes[] = $c;
			}
		}
		$img_ids = array_filter( array_merge( array( $p->get_image_id() ), $p->get_gallery_image_ids() ) );
		$imgs    = array();
		foreach ( array_slice( array_unique( $img_ids ), 0, 6 ) as $iid ) {
			$u = wp_get_attachment_image_url( $iid, 'woocommerce_single' );
			if ( $u ) {
				$imgs[] = $u;
			}
		}
		$thumb = $p->get_image_id() ? wp_get_attachment_image_url( $p->get_image_id(), 'woocommerce_thumbnail' ) : '';
		$sd    = (string) $p->get_short_description();
		preg_match_all( '#<li[^>]*>(.*?)</li>#is', $sd, $m );
		$pts  = array_map( 'wp_strip_all_tags', $m[1] );
		$lead = trim( wp_strip_all_tags( preg_replace( '#<ul.*?</ul>#is', '', $sd ) ) );
		$row  = array(
			'id'    => $id,
			'name'  => $p->get_name(),
			'cat'   => $cats ? html_entity_decode( $cats[0], ENT_QUOTES, 'UTF-8' ) : 'Other',
			'pets'  => $pets,
			'pet'   => ( 1 === count( $pets ) ) ? $pets[0] : 'Both',
			'sizes' => $sizes,
			'price' => (float) $p->get_price(),
			'mrp'   => (float) ( $p->get_regular_price() ? $p->get_regular_price() : $p->get_price() ),
			'stock' => $p->is_in_stock() ? 1 : 0,
			'img'   => $thumb ? $thumb : '',
			'imgs'  => $imgs,
			'desc'  => wp_trim_words( $lead ? $lead : wp_strip_all_tags( $p->get_description() ), 18 ),
			'lead'  => $lead,
			'pts'   => array_slice( $pts, 0, 6 ),
			'url'   => get_permalink( $id ),
			'type'  => $p->get_type(),
			'guide' => (string) $p->get_meta( '_wt_guide' ),
			'brand' => '',
		);
		if ( $p->is_type( 'variable' ) ) {
			$opts = array();
			foreach ( $p->get_variation_attributes() as $key => $vals ) {
				$tax  = taxonomy_exists( $key );
				$k    = $tax ? $key : sanitize_title( $key );
				$list = array();
				if ( $tax ) {
					foreach ( wc_get_product_terms( $id, $key, array( 'fields' => 'all' ) ) as $term ) {
						if ( in_array( $term->slug, (array) $vals, true ) ) {
							$list[] = array( 'v' => $term->slug, 't' => $term->name );
						}
					}
				} else {
					foreach ( (array) $vals as $v ) {
						$list[] = array( 'v' => $v, 't' => $v );
					}
				}
				if ( 'pa_size' === $key ) {
					usort(
						$list,
						function ( $x, $y ) {
							$o = array( 'XS', 'S', 'M', 'L', 'XL' );
							return array_search( wt_size_code( $x['t'] ), $o, true ) - array_search( wt_size_code( $y['t'] ), $o, true );
						}
					);
				}
				$opts[] = array( 'k' => 'attribute_' . $k, 'label' => wc_attribute_label( $key, $p ), 'vals' => $list, 'size' => 'pa_size' === $key );
			}
			$vars = array();
			$min  = null;
			$mrp  = 0;
			foreach ( $p->get_children() as $vid ) {
				$v = wc_get_product( $vid );
				if ( ! $v || ! $v->exists() || 'publish' !== $v->get_status() || '' === $v->get_price() ) {
					continue;
				}
				$a = array();
				foreach ( $v->get_variation_attributes() as $ak => $av ) {
					$a[ $ak ] = $av;
				}
				$sz = '';
				if ( ! empty( $a['attribute_pa_size'] ) ) {
					$sz = wt_size_code( wt_attr_label( 'pa_size', $a['attribute_pa_size'] ) );
				}
				$vimg   = $v->get_image_id() ? wp_get_attachment_image_url( $v->get_image_id(), 'woocommerce_single' ) : '';
				$vars[] = array(
					'id'    => $vid,
					'a'     => $a,
					'sz'    => $sz,
					'price' => (float) $v->get_price(),
					'mrp'   => (float) ( $v->get_regular_price() ? $v->get_regular_price() : $v->get_price() ),
					'stock' => $v->is_in_stock() ? 1 : 0,
					'img'   => $vimg ? $vimg : '',
				);
				if ( null === $min || (float) $v->get_price() < $min ) {
					$min = (float) $v->get_price();
					$mrp = (float) ( $v->get_regular_price() ? $v->get_regular_price() : $v->get_price() );
				}
			}
			if ( ! $vars ) {
				continue;
			}
			$row['opts']  = $opts;
			$row['vars']  = $vars;
			$row['price'] = (float) $min;
			$row['mrp']   = (float) $mrp;
			$row['from']  = count( array_unique( wp_list_pluck( $vars, 'price' ) ) ) > 1;
		} elseif ( '' === $p->get_price() ) {
			continue;
		}
		$out[] = $row;
	}
	set_transient( 'wt_catalog', $out, 6 * HOUR_IN_SECONDS );
	return $out;
}

/** Light product list for the boot data (home page strip, booking add-ons, admin suggestions). */
function wt_products() {
	$keep = array( 'id', 'name', 'cat', 'pet', 'price', 'mrp', 'stock', 'img', 'desc', 'url', 'type', 'from' );
	$out  = array();
	foreach ( wt_catalog() as $p ) {
		$out[] = array_intersect_key( $p, array_flip( $keep ) );
	}
	return $out;
}

function wt_flush_products() {
	delete_transient( 'wt_products' );
	delete_transient( 'wt_catalog' );
}
add_action( 'save_post_product', 'wt_flush_products' );
add_action( 'woocommerce_update_product', 'wt_flush_products' );
add_action( 'woocommerce_product_import_inserted_product_object', 'wt_flush_products' );
add_action( 'woocommerce_product_set_stock_status', 'wt_flush_products' );
add_action( 'deleted_post', 'wt_flush_products' );
add_action( 'woocommerce_update_product_variation', 'wt_flush_products' );
add_action( 'woocommerce_product_import_inserted_product_object', 'wt_flush_products' );
add_action( 'woocommerce_variation_set_stock_status', 'wt_flush_products' );

function wt_cart_count() {
	if ( ! wt_woo_on() || ! function_exists( 'WC' ) || ! WC()->cart ) {
		return 0;
	}
	return (int) WC()->cart->get_cart_contents_count();
}

/* ---------- phone for an order ---------- */

function wt_order_phone( $order ) {
	$uid = $order->get_customer_id();
	if ( $uid ) {
		$p = wt_user_phone( $uid );
		if ( $p ) {
			return $p;
		}
	}
	return wt_phone( $order->get_billing_phone() );
}

/* ---------- using points at checkout ---------- */

add_action(
	'wp_loaded',
	function () {
		if ( ! isset( $_GET['wt_points'] ) || ! wt_woo_on() || ! WC()->session ) { // phpcs:ignore
			return;
		}
		WC()->session->set( 'wt_use_points', 'on' === $_GET['wt_points'] ); // phpcs:ignore
		wp_safe_redirect( remove_query_arg( 'wt_points' ) );
		exit;
	}
);

add_action(
	'woocommerce_cart_calculate_fees',
	function ( $cart ) {
		if ( ( is_admin() && ! wp_doing_ajax() ) || ! is_user_logged_in() || ! WC()->session || ! WC()->session->get( 'wt_use_points' ) ) {
			return;
		}
		$phone = wt_user_phone( get_current_user_id() );
		if ( ! $phone ) {
			return;
		}
		$bill = (float) $cart->get_subtotal() - (float) $cart->get_discount_total();
		$rd   = wt_points_redeemable( $phone, $bill );
		if ( $rd['amount'] > 0 ) {
			$cart->add_fee( 'Reward points (' . $rd['pts'] . ')', -$rd['amount'], false );
		}
	}
);

/** Box above the cart and checkout: "Use my points". Works with classic and block cart/checkout pages. */
add_filter(
	'the_content',
	function ( $content ) {
		if ( ! wt_woo_on() || ! in_the_loop() || ! is_main_query() || ! ( is_cart() || is_checkout() ) || is_wc_endpoint_url( 'order-received' ) ) {
			return $content;
		}
		$r = wt_config()['rewards'];
		if ( empty( $r['enabled'] ) ) {
			return $content;
		}
		$style = 'style="border:1px dashed #7A3A12;border-radius:12px;padding:12px 16px;margin:0 0 20px;background:#F4ECE5;color:#2A1608;font-size:15px"';
		if ( ! is_user_logged_in() ) {
			$box = '<div ' . $style . '>Earn reward points on this order. <a href="' . esc_url( wt_app_url( 'login' ) ) . '">Log in or create an account</a> first.</div>';
			return $box . $content;
		}
		$phone = wt_user_phone( get_current_user_id() );
		$bal   = wt_points_balance( $phone );
		$on    = WC()->session && WC()->session->get( 'wt_use_points' );
		$bill  = WC()->cart ? (float) WC()->cart->get_subtotal() - (float) WC()->cart->get_discount_total() : 0;
		$rd    = wt_points_redeemable( $phone, $bill );
		if ( $on && $rd['amount'] > 0 ) {
			$box = sprintf( 'Using %d reward points to save %s. <a href="%s">Don\'t use points</a>', $rd['pts'], esc_html( wt_money( $rd['amount'] ) ), esc_url( add_query_arg( 'wt_points', 'off' ) ) );
		} elseif ( $rd['amount'] > 0 ) {
			$box = sprintf( 'You have <b>%d reward points</b>. <a href="%s">Use %d points to save %s</a>', $bal, esc_url( add_query_arg( 'wt_points', 'on' ) ), $rd['pts'], esc_html( wt_money( $rd['amount'] ) ) );
		} else {
			$box = sprintf( 'You have %d reward points. You can use them from %d points.', $bal, (int) $r['minRedeem'] );
		}
		return '<div ' . $style . '>' . $box . '</div>' . $content;
	},
	5
);

function wt_order_points_used( $order ) {
	foreach ( $order->get_fees() as $fee ) {
		if ( preg_match( '/^Reward points \((\d+)\)$/', $fee->get_name(), $m ) ) {
			return (int) $m[1];
		}
	}
	return 0;
}

/* ---------- earning / taking / returning points on order status changes ---------- */

add_action(
	'woocommerce_order_status_changed',
	function ( $order_id, $from, $to, $order ) {
		if ( ! $order ) {
			$order = wc_get_order( $order_id );
		}
		if ( ! $order ) {
			return;
		}
		$phone = wt_order_phone( $order );
		if ( ! $phone ) {
			return;
		}
		$num  = $order->get_order_number();
		$used = wt_order_points_used( $order );

		// Take the points once the order is placed and paid (or COD on-hold/processing).
		if ( $used && in_array( $to, array( 'processing', 'on-hold', 'completed' ), true ) && ! $order->get_meta( '_wt_pts_taken' ) ) {
			wt_points_add( $phone, -$used, 'Redeemed on order #' . $num, 'WC' . $order_id );
			$order->update_meta_data( '_wt_pts_taken', $used );
			$order->save_meta_data();
			if ( WC()->session ) {
				WC()->session->set( 'wt_use_points', false );
			}
		}
		// Earn on delivery/completion.
		if ( 'completed' === $to && ! $order->get_meta( '_wt_pts_earned' ) ) {
			$e = wt_points_earn_for( (float) $order->get_total(), 'order' );
			if ( $e > 0 ) {
				wt_points_add( $phone, $e, 'Earned on order #' . $num, 'WC' . $order_id );
				$order->update_meta_data( '_wt_pts_earned', $e );
				$order->save_meta_data();
				$bal = wt_points_balance( $phone );
				wt_whatsapp( $phone, 'points_earned', array( wt_first( $order->get_billing_first_name() ), $e, $bal ), sprintf( 'You earned %d Wag & Tails reward points on order #%s. Your balance is %d points.', $e, $num, $bal ) );
			}
		}
		// Cancelled or refunded: give back used points, take back earned points.
		if ( in_array( $to, array( 'cancelled', 'refunded', 'failed' ), true ) ) {
			$taken = (int) $order->get_meta( '_wt_pts_taken' );
			if ( $taken && ! $order->get_meta( '_wt_pts_returned' ) ) {
				wt_points_add( $phone, $taken, 'Returned for ' . $to . ' order #' . $num, 'WC' . $order_id );
				$order->update_meta_data( '_wt_pts_returned', 1 );
			}
			$earned = (int) $order->get_meta( '_wt_pts_earned' );
			if ( $earned && ! $order->get_meta( '_wt_pts_reversed' ) ) {
				wt_points_add( $phone, -$earned, 'Reversed for ' . $to . ' order #' . $num, 'WC' . $order_id );
				$order->update_meta_data( '_wt_pts_reversed', 1 );
			}
			$order->save_meta_data();
		}
	},
	10,
	4
);

/** Orders for the customer's My account page. */
function wt_customer_orders( $user_id, $phone ) {
	if ( ! wt_woo_on() ) {
		return array();
	}
	$orders = wc_get_orders(
		array(
			'customer_id' => $user_id,
			'limit'       => 50,
			'orderby'     => 'date',
			'order'       => 'DESC',
		)
	);
	$out    = array();
	foreach ( $orders as $o ) {
		$items = array();
		foreach ( $o->get_items() as $it ) {
			$items[] = array( 'name' => $it->get_name(), 'qty' => $it->get_quantity() );
		}
		$out[] = array(
			'id'         => '#' . $o->get_order_number(),
			'date'       => $o->get_date_created() ? $o->get_date_created()->date_i18n( 'j M Y' ) : '',
			'status'     => wc_get_order_status_name( $o->get_status() ),
			'total'      => (float) $o->get_total(),
			'items'      => $items,
			'ptsEarned'  => (int) $o->get_meta( '_wt_pts_earned' ),
			'pointsUsed' => (int) $o->get_meta( '_wt_pts_taken' ),
			'url'        => $o->get_view_order_url(),
		);
	}
	return $out;
}

/* ---------- full catalogue for the app's Shop page ---------- */

function wt_api_catalog() {
	$g = wt_shop_guides();
	return array(
		'products' => wt_catalog(),
		'breeds'   => $g['breeds'],
		'guides'   => $g['guides'],
		'bedUp'    => $g['bedUp'],
	);
}

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'wt/v1',
			'/products',
			array(
				'methods'             => 'GET',
				'permission_callback' => '__return_true',
				'callback'            => wt_rest( 'wt_api_catalog' ),
			)
		);
	}
);


/** Links to the published policy pages (privacy, terms, returns, shipping, cancellation). */
function wt_legal_links() {
	$slugs = array(
		'privacy'  => array( 'privacy-policy' ),
		'terms'    => array( 'terms-and-conditions', 'terms' ),
		'refund'   => array( 'refund-and-return-policy', 'refund_returns', 'refund-policy' ),
		'shipping' => array( 'shipping-policy', 'shipping-and-delivery-policy' ),
		'cancel'   => array( 'cancellation-policy' ),
	);
	$ids = array(
		'privacy' => (int) get_option( 'wp_page_for_privacy_policy' ),
		'terms'   => (int) get_option( 'woocommerce_terms_page_id' ),
	);
	$out = array();
	foreach ( $slugs as $k => $list ) {
		$page = ! empty( $ids[ $k ] ) ? get_post( $ids[ $k ] ) : null;
		if ( ! $page || 'publish' !== $page->post_status ) {
			$page = null;
			foreach ( $list as $slug ) {
				$pg = get_page_by_path( $slug );
				if ( $pg && 'publish' === $pg->post_status ) {
					$page = $pg;
					break;
				}
			}
		}
		if ( $page && 'publish' === $page->post_status ) {
			$out[ $k ] = get_permalink( $page );
		}
	}
	return $out;
}

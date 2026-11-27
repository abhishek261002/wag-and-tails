<?php
/**
 * Brand skin for the normal WordPress / WooCommerce pages (product pages, cart, checkout,
 * my account, policy pages): the app's header and footer, fonts and colours, so every page
 * looks like the Wag & Tails app.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** True on front-end pages that are not the app page itself. */
function wt_skin_on() {
	if ( is_admin() || wp_doing_ajax() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) || is_feed() || is_embed() ) {
		return false;
	}
	$app = (int) get_option( 'wt_page_id' );
	if ( $app && ( is_page( $app ) || ( is_front_page() && (int) get_option( 'page_on_front' ) === $app ) ) ) {
		return false;
	}
	return true;
}

add_filter(
	'body_class',
	function ( $c ) {
		if ( wt_skin_on() ) {
			$c[] = 'wt-skin';
		}
		return $c;
	}
);

add_action(
	'wp_enqueue_scripts',
	function () {
		if ( ! wt_skin_on() ) {
			return;
		}
		wp_enqueue_style( 'wt-fonts', 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito+Sans:opsz,wght@6..12,400;6..12,600;6..12,700&display=swap', array(), null ); // phpcs:ignore
		wp_enqueue_style( 'wt-skin', WT_URL . 'assets/skin.css', array(), WT_VER );
	},
	99
);

function wt_skin_links() {
	$app   = wt_app_url();
	$items = array( array( 'home', 'Home' ) );
	$c     = wt_config();
	if ( array_filter( $c['cities'], function ( $x ) { return ! empty( $x['service'] ); } ) ) { // phpcs:ignore
		$items[] = array( 'book', 'Book Grooming' );
	}
	$items[] = array( 'shop', 'Shop' );
	if ( function_exists( 'wt_events_boot' ) && wt_events_boot() ) {
		$items[] = array( 'events', 'Events' );
	}
	$items[] = array( 'insurance', 'Pet Insurance' );
	if ( function_exists( 'wt_jobs_open' ) && wt_jobs_open() ) {
		$items[] = array( 'careers', 'Careers' );
	}
	$items[] = array( 'about', 'About Us' );
	$items[] = array( 'contact', 'Contact Us' );
	return array_map(
		function ( $i ) use ( $app ) {
			return array( $app . '#' . $i[0], $i[1], $i[0] );
		},
		$items
	);
}

add_action(
	'wp_body_open',
	function () {
		if ( ! wt_skin_on() ) {
			return;
		}
		$app   = wt_app_url();
		$count = ( function_exists( 'WC' ) && WC()->cart ) ? WC()->cart->get_cart_contents_count() : 0;
		$cart  = function_exists( 'wc_get_cart_url' ) ? wc_get_cart_url() : '';
		$user  = is_user_logged_in();
		$shop  = function_exists( 'is_woocommerce' ) && ( is_woocommerce() || is_cart() || is_checkout() );
		echo '<header class="wts-top"><div class="wts-wrap wts-topin">';
		echo '<a class="wts-brand" href="' . esc_url( $app . '#home' ) . '"><img src="' . esc_url( WT_URL . 'assets/logo.webp' ) . '" alt="" width="46" height="46"><span><b>Wag &amp; Tails</b><small>Home pet grooming</small></span></a>';
		echo '<nav class="wts-nav" aria-label="Main">';
		foreach ( wt_skin_links() as $l ) {
			$on = ( 'shop' === $l[2] && $shop ) ? ' class="on" aria-current="page"' : '';
			echo '<a href="' . esc_url( $l[0] ) . '"' . $on . '>' . esc_html( $l[1] ) . '</a>'; // phpcs:ignore
		}
		echo '</nav><div class="wts-tools">';
		if ( $cart ) {
			echo '<a class="wts-chip" href="' . esc_url( $cart ) . '" aria-label="Cart, ' . (int) $count . ' items"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 7h12l-1 13H7L6 7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg><span class="wts-badge">' . (int) $count . '</span></a>';
		}
		echo '<a class="wts-chip" href="' . esc_url( $app . ( $user ? '#account' : '#login' ) ) . '">' . ( $user ? 'My account' : 'Login' ) . '</a>';
		echo '</div></div></header>';
	},
	5
);

add_action(
	'wp_footer',
	function () {
		if ( ! wt_skin_on() ) {
			return;
		}
		$s     = wt_config()['settings'];
		$phone = $s['phone'] ? $s['phone'] : '+91 73077 69104';
		$mail  = 'info@wagandtails.in';
		$addr  = $s['address'] ? $s['address'] : '7/43 D2, Tilak Nagar, Kanpur 208002, Uttar Pradesh';
		$legal = function_exists( 'wt_legal_links' ) ? wt_legal_links() : array();
		$names = array( 'privacy' => 'Privacy policy', 'terms' => 'Terms & conditions', 'refund' => 'Returns & refunds', 'shipping' => 'Shipping policy', 'cancel' => 'Cancellation policy' );
		echo '<footer class="wts-foot"><div class="wts-wrap wts-footgrid">';
		echo '<div><img src="' . esc_url( WT_URL . 'assets/logo.webp' ) . '" alt="Wag &amp; Tails logo" width="64" height="64"><p>Professional pet grooming at your doorstep since 2022. Trained groomers, sanitised kits, pet-safe products.</p></div>';
		echo '<div><h4>Explore</h4>';
		foreach ( wt_skin_links() as $l ) {
			echo '<a href="' . esc_url( $l[0] ) . '">' . esc_html( $l[1] ) . '</a>';
		}
		echo '</div><div><h4>Policies</h4>';
		foreach ( $names as $k => $n ) {
			if ( ! empty( $legal[ $k ] ) ) {
				echo '<a href="' . esc_url( $legal[ $k ] ) . '">' . esc_html( $n ) . '</a>';
			}
		}
		echo '</div><div><h4>Contact</h4><p>' . esc_html( $addr ) . '</p><a href="tel:' . esc_attr( preg_replace( '/[^\d+]/', '', $phone ) ) . '">' . esc_html( $phone ) . '</a><a href="mailto:' . esc_attr( $mail ) . '">' . esc_html( $mail ) . '</a></div>';
		echo '</div><div class="wts-wrap wts-copy">© ' . esc_html( wp_date( 'Y' ) ) . ' Wag &amp; Tails Home Pet Groomers</div></footer>';
	},
	1
);

/* "5% off" instead of "Sale!" */
add_filter(
	'woocommerce_sale_flash',
	function ( $html, $post, $product ) {
		$reg  = (float) $product->get_regular_price();
		$sale = (float) $product->get_sale_price();
		if ( $product->is_type( 'variable' ) ) {
			$reg  = (float) $product->get_variation_regular_price( 'max' );
			$sale = (float) $product->get_variation_sale_price( 'max' );
		}
		if ( $reg > 0 && $sale > 0 && $sale < $reg ) {
			return '<span class="onsale">' . (int) round( ( 1 - $sale / $reg ) * 100 ) . '% off</span>';
		}
		return $html;
	},
	10,
	3
);

/* Trust strip under Add to cart */
add_action(
	'woocommerce_single_product_summary',
	function () {
		$legal = function_exists( 'wt_legal_links' ) ? wt_legal_links() : array();
		echo '<ul class="wts-trust"><li><b>Ships across India</b><span>Dispatched in 1–3 days</span></li><li><b>Secure payment</b><span>UPI, cards, net banking</span></li><li><b>Easy returns</b><span>Within 3 days' . ( ! empty( $legal['refund'] ) ? ' · <a href="' . esc_url( $legal['refund'] ) . '">policy</a>' : '' ) . '</span></li></ul>';
	},
	35
);

/* After a plugin update, clear the page cache once so visitors see the new look straight away. */
add_action(
	'init',
	function () {
		if ( get_option( 'wt_purged_ver' ) === WT_VER ) {
			return;
		}
		update_option( 'wt_purged_ver', WT_VER, false );
		do_action( 'litespeed_purge_all' );
		if ( function_exists( 'wp_cache_flush' ) ) {
			wp_cache_flush();
		}
	},
	99
);

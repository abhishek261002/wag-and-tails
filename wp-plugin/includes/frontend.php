<?php
/**
 * The app page: shortcode, full-screen template, scripts and the data the app starts with.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function wt_app_url( $view = '' ) {
	$id   = (int) get_option( 'wt_page_id' );
	$base = $id && get_post( $id ) ? get_permalink( $id ) : home_url( '/' );
	if ( $id && (int) get_option( 'page_on_front' ) === $id ) {
		$base = home_url( '/' );
	}
	return $view ? $base . '#' . $view : $base;
}

function wt_current_role() {
	if ( ! is_user_logged_in() ) {
		return null;
	}
	if ( current_user_can( 'manage_options' ) ) {
		return 'admin';
	}
	if ( current_user_can( 'wt_desk' ) ) {
		return 'staff';
	}
	return 'customer';
}

/* ---------- full-screen page template (no theme header/footer) ---------- */

add_filter(
	'theme_page_templates',
	function ( $templates ) {
		$templates['wt-app-template'] = 'Wag & Tails – full screen';
		return $templates;
	}
);

add_filter(
	'template_include',
	function ( $template ) {
		if ( is_singular( 'page' ) && 'wt-app-template' === get_page_template_slug( get_queried_object_id() ) ) {
			return WT_DIR . 'templates/app.php';
		}
		return $template;
	},
	99
);

function wt_is_app_page() {
	if ( ! is_singular() ) {
		return false;
	}
	$post = get_post( get_queried_object_id() );
	return $post && has_shortcode( $post->post_content, 'wag_and_tails' );
}

function wt_is_fullscreen() {
	return is_singular( 'page' ) && 'wt-app-template' === get_page_template_slug( get_queried_object_id() );
}

add_action( 'wp_enqueue_scripts', 'wt_enqueue', 20 );

function wt_enqueue() {
	if ( ! wt_is_app_page() ) {
		return;
	}
	wt_enqueue_assets();
}

function wt_enqueue_assets() {
	wp_enqueue_style( 'wt-fonts', 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito+Sans:opsz,wght@6..12,400;6..12,600;6..12,700&display=swap', array(), null ); // phpcs:ignore
	wp_enqueue_style( 'wt-app', WT_URL . 'assets/app.css', array(), WT_VER );
	wp_enqueue_script( 'leaflet', 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js', array(), '1.9.4', true );
	$deps = array( 'leaflet' );
	if ( in_array( wt_current_role(), array( 'admin', 'staff' ), true ) ) {
		wp_enqueue_script( 'chartjs', 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js', array(), '4.4.1', true );
		// Full map styles for the Apps & partners live map (zoom buttons, attribution, popups).
		wp_enqueue_style( 'leaflet', 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css', array(), '1.9.4' );
		$deps[] = 'chartjs';
	}
	wp_enqueue_script( 'wt-app', WT_URL . 'assets/app.js', $deps, WT_VER, true );
	wp_add_inline_script( 'wt-app', 'window.WT_BOOT = ' . wp_json_encode( wt_boot_data() ) . ';', 'before' );
}

/* On the full-screen page, drop the theme's and store styles so they can't clash with the app. */
function wt_strip_styles() {
		if ( ! wt_is_fullscreen() ) {
			return;
		}
		global $wp_styles;
		$theme_uris = array( get_stylesheet_directory_uri(), get_template_directory_uri() );
		foreach ( (array) $wp_styles->queue as $handle ) {
			$src = isset( $wp_styles->registered[ $handle ] ) ? (string) $wp_styles->registered[ $handle ]->src : '';
			foreach ( $theme_uris as $uri ) {
				if ( $src && 0 === strpos( $src, $uri ) ) {
					wp_dequeue_style( $handle );
				}
			}
		}
		foreach ( array( 'global-styles', 'classic-theme-styles', 'wp-block-library-theme', 'woocommerce-general', 'woocommerce-layout', 'woocommerce-smallscreen', 'woocommerce-blocktheme', 'brands-styles', 'wc-blocks-style', 'core-block-supports' ) as $h ) {
			wp_dequeue_style( $h );
		}
}
add_action( 'wp_enqueue_scripts', 'wt_strip_styles', 100 );
add_action( 'wp_print_styles', 'wt_strip_styles', 1 );
add_action( 'wp_print_footer_scripts', 'wt_strip_styles', 1 );

function wt_boot_data() {
	$role  = wt_current_role();
	$user  = null;
	$cfg   = wt_client_config( $role ? $role : 'public' );
	if ( $role ) {
		$u     = wp_get_current_user();
		$phone = wt_user_phone( $u->ID );
		$user  = array(
			'role'   => $role,
			'name'   => $u->display_name,
			'email'  => $u->user_email,
			'phone'  => $phone,
			'points' => $phone ? wt_points_balance( $phone ) : 0,
			'city'   => 'staff' === $role ? ( get_user_meta( $u->ID, 'wt_city', true ) ? get_user_meta( $u->ID, 'wt_city', true ) : 'all' ) : 'all',
		);
		if ( 'customer' === $role && $phone && function_exists( 'wt_profile_public' ) ) {
			$user['profile'] = wt_profile_public( $phone );
		}
		if ( 'staff' === $role ) {
			$user['att']   = wt_att_state( $u->ID );
			$user['perms'] = wt_staff_perms( $u->ID );
		}
	}
	$woo   = wt_woo_on();
	$links = array(
		'wpAdmin'     => admin_url(),
		'orders'      => admin_url( $woo ? 'admin.php?page=wc-orders' : '' ),
		'ordersOld'   => admin_url( 'edit.php?post_type=shop_order' ),
		'products'    => admin_url( 'edit.php?post_type=product' ),
		'newProduct'  => admin_url( 'post-new.php?post_type=product' ),
		'import'      => admin_url( 'edit.php?post_type=product&page=product_importer' ),
		'wooCoupons'  => admin_url( 'edit.php?post_type=shop_coupon' ),
		'payments'    => admin_url( 'admin.php?page=wc-settings&tab=checkout' ),
		'users'       => admin_url( 'users.php' ),
		'lostPass'    => wp_lostpassword_url(),
		'template'    => WT_URL . 'assets/products-import-template.csv',
	);
	return array(
		'rest'        => esc_url_raw( rest_url( 'wt/v1/' ) ),
		'nonce'       => wp_create_nonce( 'wp_rest' ),
		'home'        => wt_app_url(),
		'logo'        => WT_URL . 'assets/logo.webp',
		'siteName'    => get_bloginfo( 'name' ),
		'user'        => $user,
		'config'      => $cfg,
		'products'    => wt_products(),
		'woo'         => $woo,
		'cartUrl'     => $woo ? wc_get_cart_url() : '',
		'checkoutUrl' => $woo ? wc_get_checkout_url() : '',
		'addToCart'   => $woo ? WC_AJAX::get_endpoint( 'add_to_cart' ) : '',
		'cartCount'   => wt_cart_count(),
		'legal'       => wt_legal_links(),
		// Apps and partners (includes/apps.php): only the desk and admin need it.
		'apps'        => in_array( $role, array( 'admin', 'staff' ), true ) && function_exists( 'wt_api_apps_status' ) ? wt_api_apps_status() : null,
		'blockedDays' => wt_blocked_days(),
		'events'      => wt_events_boot(),
		'jobs'        => function_exists( 'wt_jobs_open' ) ? count( wt_jobs_open() ) : 0,
		'today'       => wt_today(),
		'links'       => 'admin' === $role ? $links : array( 'lostPass' => wp_lostpassword_url() ),
		'waEvents'    => 'admin' === $role ? wt_wa_events() : null,
	);
}

add_shortcode(
	'wag_and_tails',
	function () {
		if ( ! wp_script_is( 'wt-app', 'enqueued' ) ) {
			wt_enqueue_assets();
		}
		return '<div id="wt-root"><div id="app"><noscript>Please turn on JavaScript to book a groomer.</noscript></div><div id="layer"></div><div id="toast" class="toast" role="status" aria-live="polite" hidden></div></div>';
	}
);

/* The app page must never be cached with someone's login inside it. */
add_action(
	'template_redirect',
	function () {
		if ( wt_is_app_page() ) {
			nocache_headers();
			if ( ! defined( 'DONOTCACHEPAGE' ) ) {
				define( 'DONOTCACHEPAGE', true );
			}
		}
	}
);

/* ---------- logins, admin bar, wp-admin ---------- */

add_filter(
	'show_admin_bar',
	function ( $show ) {
		return $show && current_user_can( 'edit_posts' );
	}
);

add_action(
	'admin_init',
	function () {
		if ( wp_doing_ajax() || current_user_can( 'edit_posts' ) ) {
			return;
		}
		if ( current_user_can( 'wt_desk' ) ) {
			wp_safe_redirect( wt_app_url( 'staff' ) );
			exit;
		}
	}
);

add_filter(
	'login_redirect',
	function ( $redirect, $requested, $user ) {
		if ( $user instanceof WP_User && ! user_can( $user, 'edit_posts' ) && user_can( $user, 'wt_desk' ) ) {
			return wt_app_url( 'staff' );
		}
		return $redirect;
	},
	10,
	3
);

add_action(
	'admin_menu',
	function () {
		add_menu_page( 'Wag & Tails', 'Wag & Tails', 'manage_options', 'wag-and-tails', 'wt_admin_screen', 'dashicons-pets', 3 );
	}
);

function wt_admin_screen() {
	$woo = wt_woo_on();
	?>
	<div class="wrap">
		<h1>Wag &amp; Tails</h1>
		<p>Bookings, prices, cities, staff, coupons, reward points, insurance form and all other settings are managed in the Wag &amp; Tails admin panel on your website.</p>
		<p>
			<a class="button button-primary button-hero" href="<?php echo esc_url( wt_app_url( 'admin' ) ); ?>">Open the admin panel</a>
			<a class="button button-hero" href="<?php echo esc_url( wt_app_url( 'staff' ) ); ?>">Open the booking desk</a>
		</p>
		<h2>Setup checklist</h2>
		<ol>
			<li><?php echo $woo ? '✅' : '⚠️'; ?> WooCommerce is <?php echo $woo ? 'active' : '<b>not installed</b>. Install it for the store (Plugins → Add New → WooCommerce)'; ?>.</li>
			<li><?php echo wt_rzp_ready() ? '✅ Razorpay keys are saved.' : '⚠️ Add your Razorpay Key ID and Key Secret in the admin panel → Settings so customers can pay online for grooming.'; ?></li>
			<li><?php echo 'off' !== wt_config()['settings']['waMode'] ? '✅ WhatsApp is connected.' : '⚠️ Connect WhatsApp in the admin panel → Settings. Until then messages are only listed in the Notifications log.'; ?></li>
			<li>Install <b>WP Mail SMTP</b> and connect your Hostinger email so confirmation emails reach the inbox.</li>
			<li>Add each city's Google review link in the admin panel → Cities &amp; walking.</li>
		</ol>
	</div>
	<?php
}

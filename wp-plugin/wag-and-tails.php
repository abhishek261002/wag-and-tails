<?php
/**
 * Plugin Name:       Wag & Tails
 * Description:       Home pet grooming bookings with city-wise prices, Razorpay or pay-after-service, booking desk for staff, customer accounts with reward points, pet insurance leads, dog walking, and a WooCommerce-powered store.
 * Version:           1.14.0
 * Requires at least: 6.2
 * Requires PHP:      7.4
 * Author:            Wag & Tails
 * License:           GPL-2.0-or-later
 * Text Domain:       wag-and-tails
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'WT_VER', '1.14.0' );
define( 'WT_FILE', __FILE__ );
define( 'WT_DIR', plugin_dir_path( __FILE__ ) );
define( 'WT_URL', plugin_dir_url( __FILE__ ) );
define( 'WT_DB_VER', '2' );

require_once WT_DIR . 'includes/config.php';
require_once WT_DIR . 'includes/records.php';
require_once WT_DIR . 'includes/notify.php';
require_once WT_DIR . 'includes/razorpay.php';
require_once WT_DIR . 'includes/bookings.php';
require_once WT_DIR . 'includes/slots.php';
require_once WT_DIR . 'includes/woo.php';
require_once WT_DIR . 'includes/rest.php';
require_once WT_DIR . 'includes/frontend.php';
require_once WT_DIR . 'includes/import-bookingpress.php';
require_once WT_DIR . 'includes/reports.php';
require_once WT_DIR . 'includes/campaigns.php';
require_once WT_DIR . 'includes/customers.php';
require_once WT_DIR . 'includes/blocks.php';
require_once WT_DIR . 'includes/events.php';
require_once WT_DIR . 'includes/complaints.php';
require_once WT_DIR . 'includes/watemplates.php';
require_once WT_DIR . 'includes/wabulk.php';
require_once WT_DIR . 'includes/skin.php';
require_once WT_DIR . 'includes/connector.php';
require_once WT_DIR . 'includes/apps.php';

register_activation_hook( __FILE__, 'wt_activate' );
register_deactivation_hook(
	__FILE__,
	function () {
		wp_clear_scheduled_hook( 'wt_campaign_tick' );
	wp_clear_scheduled_hook( 'wt_tpl_check' );
	}
);

/**
 * Create the records table, the Booking Desk role and the app page.
 */
function wt_activate() {
	wt_install_table();

	add_role(
		'wt_desk',
		'Booking Desk',
		array(
			'read'    => true,
			'wt_desk' => true,
		)
	);
	$admin = get_role( 'administrator' );
	if ( $admin ) {
		$admin->add_cap( 'wt_desk' );
	}

	if ( false === get_option( 'wt_config', false ) ) {
		add_option( 'wt_config', wt_default_config(), '', false );
	}

	$page_id = (int) get_option( 'wt_page_id' );
	if ( ! $page_id || ! get_post( $page_id ) ) {
		$page_id = wp_insert_post(
			array(
				'post_title'   => 'Wag & Tails',
				'post_name'    => 'wag-and-tails',
				'post_status'  => 'publish',
				'post_type'    => 'page',
				'post_content' => '<!-- wp:shortcode -->[wag_and_tails]<!-- /wp:shortcode -->',
			)
		);
		if ( $page_id && ! is_wp_error( $page_id ) ) {
			update_post_meta( $page_id, '_wp_page_template', 'wt-app-template' );
			update_option( 'wt_page_id', $page_id );
			// Make it the home page only if the site does not already use a static home page.
			if ( 'page' !== get_option( 'show_on_front' ) ) {
				update_option( 'show_on_front', 'page' );
				update_option( 'page_on_front', $page_id );
			}
		}
	}
	flush_rewrite_rules();
}

function wt_install_table() {
	global $wpdb;
	require_once ABSPATH . 'wp-admin/includes/upgrade.php';
	$table   = $wpdb->prefix . 'wt_records';
	$charset = $wpdb->get_charset_collate();
	$sql     = "CREATE TABLE $table (
		id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
		type varchar(20) NOT NULL,
		ref varchar(40) NOT NULL DEFAULT '',
		phone varchar(15) NOT NULL DEFAULT '',
		city varchar(60) NOT NULL DEFAULT '',
		status varchar(30) NOT NULL DEFAULT '',
		skey varchar(20) NOT NULL DEFAULT '',
		amount int(11) NOT NULL DEFAULT 0,
		rev int(11) unsigned NOT NULL DEFAULT 0,
		data longtext NOT NULL,
		created_at datetime NOT NULL,
		updated_at datetime NOT NULL,
		PRIMARY KEY  (id),
		KEY type_phone (type,phone),
		KEY type_status (type,status),
		KEY type_skey (type,skey),
		KEY ref (ref),
		KEY type_updated (type,updated_at)
	) $charset;";
	dbDelta( $sql );
	update_option( 'wt_db_ver', WT_DB_VER );
}

add_action(
	'plugins_loaded',
	function () {
		if ( get_option( 'wt_db_ver' ) !== WT_DB_VER ) {
			wt_install_table();
		}
	}
);

/* Plugins screen: quick link to the admin panel. */
add_filter(
	'plugin_action_links_' . plugin_basename( __FILE__ ),
	function ( $links ) {
		array_unshift( $links, '<a href="' . esc_url( wt_app_url( 'admin' ) ) . '">Open admin panel</a>' );
		return $links;
	}
);

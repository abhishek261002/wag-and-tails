<?php
/**
 * Panel pages for the apps (one panel for the client and his staff, decided 25 Nov 2026): Partners, Partner money,
 * Payouts, Support tickets, the app side of a customer, dashboard numbers and the activity log.
 *
 * The browser only talks to this site, with the WordPress login. This site checks who it is and calls the backend
 * signed (wt_apps_call), passing the person's name and role. Roles:
 *  - Administrator (manage_options) = the owner: everything.
 *  - Booking staff (wt_desk): everything except the activity log and changing money (the backend refuses those).
 *    Staff tied to one city only see that city's partners.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function wt_panel_can() {
	return current_user_can( 'manage_options' ) || current_user_can( 'wt_desk' );
}

function wt_panel_who() {
	$u = wp_get_current_user();
	return array(
		'by'   => $u && $u->exists() ? ( $u->display_name ? $u->display_name : $u->user_login ) : 'Unknown',
		'role' => current_user_can( 'manage_options' ) ? 'admin' : 'staff',
	);
}

/** The staff member's city ('all' for the owner and for staff without one). */
function wt_panel_city() {
	return current_user_can( 'manage_options' ) || ! function_exists( 'wt_desk_city' ) ? 'all' : wt_desk_city();
}

function wt_panel_id( $v ) {
	$v = (string) $v;
	return preg_match( '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $v ) ? strtolower( $v ) : '';
}

/** A partner this person may see (city staff: their city only). */
function wt_panel_partner_ok( $id ) {
	$p = wt_apps_call( 'GET', 'connector/panel/partners/' . $id );
	if ( is_wp_error( $p ) ) {
		return $p;
	}
	$city = wt_panel_city();
	if ( 'all' !== $city && strcasecmp( (string) ( $p['city'] ?? '' ), $city ) !== 0 && 'pending' !== ( $p['status'] ?? '' ) ) {
		return wt_err( 'Partner not found.', 'wt_404', 404 );
	}
	return $p;
}

/** Health of the link to the apps, and the buttons to fix it (owner only). */
function wt_api_panel_system() {
	return wt_apps_call( 'GET', 'connector/panel/system' );
}

function wt_api_panel_system_action( $in ) {
	$action = sanitize_key( (string) ( $in['action'] ?? '' ) );
	if ( ! in_array( $action, array( 'sync', 'store-sync', 'retry' ), true ) ) {
		return wt_err( 'Unknown action.' );
	}
	$body = array( 'id' => wt_panel_id( $in['rowId'] ?? '' ) );
	return wt_apps_call( 'POST', 'connector/panel/system/' . $action, array(), array_merge( $body, wt_panel_who() ) );
}

function wt_api_panel_overview() {
	return wt_apps_call( 'GET', 'connector/panel/overview' );
}

function wt_api_panel_partners( $in ) {
	$q = array();
	foreach ( array( 'status', 'type', 'city', 'q', 'page' ) as $k ) {
		if ( isset( $in[ $k ] ) && '' !== (string) $in[ $k ] ) {
			$q[ $k ] = sanitize_text_field( (string) $in[ $k ] );
		}
	}
	$city = wt_panel_city();
	if ( 'all' !== $city ) {
		$q['city'] = $city;
	}
	return wt_apps_call( 'GET', 'connector/panel/partners', $q );
}

function wt_api_panel_partner( $in ) {
	$id = wt_panel_id( $in['id'] ?? '' );
	return $id ? wt_panel_partner_ok( $id ) : wt_err( 'Partner not found.', 'wt_404', 404 );
}

function wt_api_panel_partner_action( $in ) {
	$id     = wt_panel_id( $in['id'] ?? '' );
	$action = sanitize_key( (string) ( $in['action'] ?? '' ) );
	$allow  = array( 'approve', 'reject', 'suspend', 'reactivate', 'type', 'city', 'aadhaar-reveal', 'aadhaar-delete', 'commission', 'discount', 'dues-offline', 'dues-adjust' );
	if ( ! $id || ! in_array( $action, $allow, true ) ) {
		return wt_err( 'Unknown action.' );
	}
	$ok = wt_panel_partner_ok( $id );
	if ( is_wp_error( $ok ) ) {
		return $ok;
	}
	$body = array();
	foreach ( array( 'employmentType', 'city', 'reason', 'commissionPct', 'commissionLimitOverride', 'percent', 'startsAt', 'endsAt', 'note', 'amount' ) as $k ) {
		if ( array_key_exists( $k, $in ) ) {
			$body[ $k ] = is_scalar( $in[ $k ] ) || null === $in[ $k ] ? ( is_string( $in[ $k ] ) ? sanitize_text_field( $in[ $k ] ) : $in[ $k ] ) : null;
		}
	}
	// City staff can only place partners in their own city.
	$city = wt_panel_city();
	if ( 'all' !== $city && isset( $body['city'] ) && strcasecmp( (string) $body['city'], $city ) !== 0 ) {
		return wt_err( 'You can only choose your own city.' );
	}
	if ( 'aadhaar-reveal' === $action ) {
		nocache_headers();
	}
	return wt_apps_call( 'POST', 'connector/panel/partners/' . $id . '/' . $action, array(), array_merge( $body, wt_panel_who() ) );
}

function wt_api_panel_discount( $in ) {
	$id = wt_panel_id( $in['id'] ?? '' );
	if ( ! $id ) {
		return wt_err( 'Not found.', 'wt_404', 404 );
	}
	$body = array();
	foreach ( array( 'percent', 'startsAt', 'endsAt', 'note', 'status' ) as $k ) {
		if ( array_key_exists( $k, $in ) ) {
			$body[ $k ] = is_string( $in[ $k ] ) ? sanitize_text_field( $in[ $k ] ) : $in[ $k ];
		}
	}
	return wt_apps_call( 'POST', 'connector/panel/discounts/' . $id, array(), array_merge( $body, wt_panel_who() ) );
}

function wt_api_panel_money( $in, $r ) {
	if ( 'POST' === $r->get_method() ) {
		$body = array();
		foreach ( array( 'defaultCommissionPct', 'commissionLimit', 'maxPartnerDiscountPct' ) as $k ) {
			if ( isset( $in[ $k ] ) && '' !== $in[ $k ] ) {
				$body[ $k ] = (float) $in[ $k ];
			}
		}
		return wt_apps_call( 'POST', 'connector/panel/money/settings', array(), array_merge( $body, wt_panel_who() ) );
	}
	return wt_apps_call( 'GET', 'connector/panel/money/settings' );
}

function wt_api_panel_reconcile() {
	return wt_apps_call( 'POST', 'connector/panel/money/reconcile', array(), wt_panel_who() );
}

function wt_api_panel_payouts( $in ) {
	$q = array();
	if ( ! empty( $in['status'] ) ) {
		$q['status'] = sanitize_key( $in['status'] );
	}
	if ( ! empty( $in['partner'] ) && wt_panel_id( $in['partner'] ) ) {
		$q['partner'] = wt_panel_id( $in['partner'] );
	}
	$out  = wt_apps_call( 'GET', 'connector/panel/payouts', $q );
	$city = wt_panel_city();
	if ( ! is_wp_error( $out ) && 'all' !== $city ) {
		$out['list'] = array_values( array_filter( (array) $out['list'], function ( $p ) use ( $city ) {
			return 0 === strcasecmp( (string) ( $p['city'] ?? '' ), $city );
		} ) );
	}
	return $out;
}

function wt_api_panel_batch( $in ) {
	$ids = array_values( array_filter( array_map( 'wt_panel_id', (array) ( $in['payoutIds'] ?? array() ) ) ) );
	return wt_apps_call( 'POST', 'connector/panel/payouts/batch', array(), array_merge( array( 'payoutIds' => $ids ), wt_panel_who() ) );
}

function wt_api_panel_batch_paid( $in ) {
	$id = wt_panel_id( $in['id'] ?? '' );
	return $id ? wt_apps_call( 'POST', 'connector/panel/payouts/batches/' . $id . '/paid', array(), array_merge( array( 'reference' => sanitize_text_field( (string) ( $in['reference'] ?? '' ) ) ), wt_panel_who() ) ) : wt_err( 'Not found.', 'wt_404', 404 );
}

function wt_api_panel_tickets( $in ) {
	$q = array();
	if ( ! empty( $in['status'] ) ) {
		$q['status'] = sanitize_key( $in['status'] );
	}
	if ( ! empty( $in['escalated'] ) ) {
		$q['escalated'] = '1';
	}
	return wt_apps_call( 'GET', 'connector/panel/tickets', $q );
}

function wt_api_panel_ticket( $in ) {
	$id = wt_panel_id( $in['id'] ?? '' );
	return $id ? wt_apps_call( 'GET', 'connector/panel/tickets/' . $id, wt_panel_who() ) : wt_err( 'Not found.', 'wt_404', 404 );
}

function wt_api_panel_ticket_action( $in ) {
	$id     = wt_panel_id( $in['id'] ?? '' );
	$action = sanitize_key( (string) ( $in['action'] ?? '' ) );
	if ( ! $id || ! in_array( $action, array( 'reply', 'status', 'escalate' ), true ) ) {
		return wt_err( 'Unknown action.' );
	}
	$body = array(
		'text'   => sanitize_textarea_field( (string) ( $in['text'] ?? '' ) ),
		'status' => sanitize_key( (string) ( $in['status'] ?? '' ) ),
		'reason' => sanitize_text_field( (string) ( $in['reason'] ?? '' ) ),
	);
	return wt_apps_call( 'POST', 'connector/panel/tickets/' . $id . '/' . $action, array(), array_merge( $body, wt_panel_who() ) );
}

function wt_api_panel_customer( $in ) {
	$phone = wt_phone( $in['phone'] ?? '' );
	if ( ! wt_valid_mobile( $phone ) ) {
		return wt_err( 'Enter a valid 10-digit mobile number.' );
	}
	return wt_apps_call( 'GET', 'connector/panel/customer', array( 'phone' => $phone ) );
}

function wt_api_panel_activity( $in ) {
	$q = array( 'page' => max( 1, (int) ( $in['page'] ?? 1 ) ) );
	if ( ! empty( $in['entityId'] ) && wt_panel_id( $in['entityId'] ) ) {
		$q['entityId'] = wt_panel_id( $in['entityId'] );
	}
	return wt_apps_call( 'GET', 'connector/panel/activity', $q );
}

add_action(
	'rest_api_init',
	function () {
		$uuid   = '(?P<id>[0-9a-fA-F\-]{36})';
		$routes = array(
			array( 'GET', 'panel/system', 'wt_can_admin', 'wt_api_panel_system' ),
			array( 'POST', 'panel/system/(?P<action>[a-z\-]+)', 'wt_can_admin', 'wt_api_panel_system_action' ),
			array( 'GET', 'panel/overview', 'wt_panel_can', 'wt_api_panel_overview' ),
			array( 'GET', 'panel/partners', 'wt_panel_can', 'wt_api_panel_partners' ),
			array( 'GET', 'panel/partners/' . $uuid, 'wt_panel_can', 'wt_api_panel_partner' ),
			array( 'POST', 'panel/partners/' . $uuid . '/(?P<action>[a-z\-]+)', 'wt_panel_can', 'wt_api_panel_partner_action' ),
			array( 'POST', 'panel/discounts/' . $uuid, 'wt_panel_can', 'wt_api_panel_discount' ),
			array( 'GET,POST', 'panel/money', 'wt_panel_can', 'wt_api_panel_money' ),
			array( 'POST', 'panel/money/reconcile', 'wt_can_admin', 'wt_api_panel_reconcile' ),
			array( 'GET', 'panel/payouts', 'wt_panel_can', 'wt_api_panel_payouts' ),
			array( 'POST', 'panel/payouts/batch', 'wt_can_admin', 'wt_api_panel_batch' ),
			array( 'POST', 'panel/payouts/batches/' . $uuid . '/paid', 'wt_can_admin', 'wt_api_panel_batch_paid' ),
			array( 'GET', 'panel/tickets', 'wt_panel_can', 'wt_api_panel_tickets' ),
			array( 'GET', 'panel/tickets/' . $uuid, 'wt_panel_can', 'wt_api_panel_ticket' ),
			array( 'POST', 'panel/tickets/' . $uuid . '/(?P<action>[a-z]+)', 'wt_panel_can', 'wt_api_panel_ticket_action' ),
			array( 'GET', 'panel/customer', 'wt_panel_can', 'wt_api_panel_customer' ),
			array( 'GET', 'panel/activity', 'wt_can_admin', 'wt_api_panel_activity' ),
		);
		foreach ( $routes as $rt ) {
			register_rest_route( 'wt/v1', '/' . $rt[1], array( 'methods' => $rt[0], 'permission_callback' => $rt[2], 'callback' => wt_rest( $rt[3] ) ) );
		}
	}
);

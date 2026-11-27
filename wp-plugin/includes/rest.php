<?php
/**
 * REST API used by the app: /wp-json/wt/v1/...
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function wt_can_admin() {
	return current_user_can( 'manage_options' );
}
function wt_can_desk() {
	if ( current_user_can( 'manage_options' ) ) {
		return true;
	}
	if ( ! current_user_can( 'wt_desk' ) ) {
		return false;
	}
	if ( function_exists( 'wt_att_on_duty' ) && ! wt_att_on_duty( get_current_user_id() ) ) {
		return new WP_Error( 'wt_punch', 'Punch in to start work. If you have punched out, the booking desk opens again tomorrow.', array( 'status' => 403 ) );
	}
	return true;
}

/** Wrap a handler so WP_Error and arrays become proper REST responses. */
function wt_rest( $fn ) {
	return function ( WP_REST_Request $r ) use ( $fn ) {
		$in  = $r->get_json_params();
		$in  = is_array( $in ) ? $in : array();
		$in  = array_merge( $r->get_query_params(), $r->get_url_params(), $in );
		$out = $fn( $in, $r );
		if ( is_wp_error( $out ) ) {
			return $out;
		}
		return rest_ensure_response( $out );
	};
}

add_action( 'rest_api_init', 'wt_register_routes' );

/**
 * Live data must never be cached. Hosting caches (LiteSpeed, Hostinger) otherwise keep old copies of
 * booking lists, so a deleted or new booking would not show for several minutes.
 */
add_filter(
	'rest_pre_dispatch',
	function ( $result, $server, $request ) {
		if ( 0 === strpos( (string) $request->get_route(), '/wt/v1' ) ) {
			do_action( 'litespeed_control_set_nocache', 'Wag & Tails live data' );
			if ( ! headers_sent() ) {
				header( 'X-LiteSpeed-Cache-Control: no-cache' );
				header( 'Cache-Control: no-store, no-cache, must-revalidate, max-age=0' );
			}
		}
		return $result;
	},
	10,
	3
);

function wt_register_routes() {
	$ns     = 'wt/v1';
	$public = '__return_true';
	$routes = array(
		array( 'POST', 'bookings', $public, 'wt_create_web_booking_locked' ),
		array( 'POST', 'bookings/verify', $public, 'wt_verify_web_booking' ),
		array( 'POST', 'walks', $public, 'wt_api_walk' ),
		array( 'POST', 'insurance', $public, 'wt_api_insurance' ),
		array( 'POST', 'contact', $public, 'wt_api_contact' ),
		array( 'POST', 'register', $public, 'wt_api_register' ),
		array( 'POST', 'login', $public, 'wt_api_login' ),
		array( 'POST', 'logout', 'is_user_logged_in', 'wt_api_logout' ),
		array( 'GET', 'me', 'is_user_logged_in', 'wt_api_me' ),
		array( 'GET', 'desk/bookings', 'wt_can_desk', 'wt_api_desk_list' ),
		array( 'POST', 'desk/bookings', 'wt_can_desk', 'wt_desk_add_locked' ),
		array( 'POST', 'desk/bookings/(?P<ref>[A-Za-z0-9\-]+)', 'wt_can_desk', 'wt_api_desk_action' ),
		array( 'POST', 'admin/config', 'wt_can_admin', 'wt_api_save_config' ),
		array( 'GET', 'admin/records', 'wt_can_admin', 'wt_api_records' ),
		array( 'GET', 'admin/insurance/report', 'wt_can_admin', 'wt_api_insurance_report' ),
		array( 'POST', 'admin/records/(?P<ref>[A-Za-z0-9\-]+)', 'wt_can_admin', 'wt_api_record_update' ),
		array( 'GET', 'admin/customers', 'wt_can_admin', 'wt_api_customers' ),
		array( 'POST', 'admin/points', 'wt_can_admin', 'wt_api_points_adjust' ),
		array( 'GET', 'admin/staff', 'wt_can_admin', 'wt_api_staff_list' ),
		array( 'POST', 'admin/staff', 'wt_can_admin', 'wt_api_staff_create' ),
		array( 'POST', 'admin/staff/(?P<uid>\d+)/delete', 'wt_can_admin', 'wt_api_staff_delete' ),
		array( 'GET', 'admin/dashboard', 'wt_can_admin', 'wt_api_dashboard' ),
		array( 'GET', 'admin/admins', 'wt_can_admin', 'wt_api_admins_list' ),
		array( 'POST', 'admin/admins', 'wt_can_admin', 'wt_api_admin_create' ),
		array( 'POST', 'admin/admins/(?P<uid>\d+)/delete', 'wt_can_admin', 'wt_api_admin_delete' ),
	);
	foreach ( $routes as $rt ) {
		register_rest_route(
			$ns,
			'/' . $rt[1],
			array(
				'methods'             => $rt[0],
				'permission_callback' => $rt[2],
				'callback'            => wt_rest( $rt[3] ),
			)
		);
	}
}

/* ---------- public forms ---------- */

function wt_api_walk( $in ) {
	if ( ! empty( $in['website'] ) ) {
		return wt_err( 'Something went wrong. Please try again.' );
	}
	$c    = wt_config();
	$city = wt_city( $in['city'] ?? '', $c );
	if ( ! $city || empty( $city['walking'] ) || empty( $city['service'] ) ) {
		return wt_err( 'Dog walking is not available in this city yet.' );
	}
	$w = array(
		'city'    => $city['id'],
		'name'    => wt_str( $in, 'name', 80 ),
		'phone'   => wt_phone( $in['phone'] ?? '' ),
		'email'   => sanitize_email( $in['email'] ?? '' ),
		'pincode' => wt_str( $in, 'pincode', 6 ),
		'dog'     => wt_str( $in, 'dog', 100 ),
		'freq'    => wt_str( $in, 'freq', 60 ),
		'time'    => wt_str( $in, 'time', 60 ),
		'start'   => wt_str( $in, 'start', 10 ),
		'address' => mb_substr( sanitize_textarea_field( (string) ( $in['address'] ?? '' ) ), 0, 400 ),
		'status'  => 'New',
	);
	$plan = wt_find( $c['walkPlans'], 'id', $in['plan'] ?? '' );
	if ( mb_strlen( $w['name'] ) < 2 || ! wt_valid_mobile( $w['phone'] ) || ! is_email( $w['email'] ) || ! preg_match( '/^\d{6}$/', $w['pincode'] ) || ! $w['dog'] || ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $w['start'] ) || mb_strlen( $w['address'] ) < 8 || ! $plan ) {
		return wt_err( 'Fill every required field: valid phone, email, 6-digit pincode, start date and address.' );
	}
	$w['planName'] = $plan['name'] . ' (' . wt_money( $plan['price'] ) . ')';
	$w             = wt_rec_insert( 'walk', $w, 'WK' );
	$line          = sprintf( 'Walk request %s: %s, %s, %s, from %s (%s).', $w['id'], $w['dog'], $w['planName'], $w['freq'], wt_fmt_date( $w['start'] ), $w['time'] );
	$s             = $c['settings'];
	wt_email( $w['email'], 'We received your dog walking request', 'Hi ' . wt_first( $w['name'] ) . ",\n\n" . $line . "\n\nWe'll call you within a day to confirm your walker." );
	wt_email( $s['notifyEmail'], 'New dog walking request – ' . $city['name'], $w['name'] . ' (' . $w['phone'] . '). ' . $line . ' Address: ' . $w['address'] . ', ' . $w['pincode'] );
	if ( $s['notifyWhatsApp'] ) {
		wt_whatsapp( $s['notifyWhatsApp'], 'walk_admin', array( $w['name'], $w['phone'], $line ), $w['name'] . ' (' . $w['phone'] . '). ' . $line );
	}
	return array( 'ok' => true, 'id' => $w['id'] );
}

function wt_api_insurance( $in ) {
	if ( ! empty( $in['website'] ) ) {
		return wt_err( 'Something went wrong. Please try again.' );
	}
	$c      = wt_config();
	$values = isset( $in['fields'] ) && is_array( $in['fields'] ) ? $in['fields'] : array();
	$data   = array();
	$name   = '';
	$phone  = '';
	foreach ( $c['insFields'] as $f ) {
		$v = isset( $values[ $f['id'] ] ) ? mb_substr( sanitize_textarea_field( (string) $values[ $f['id'] ] ), 0, 1000 ) : '';
		if ( ! empty( $f['required'] ) && '' === trim( $v ) ) {
			return wt_err( 'Please fill "' . $f['label'] . '".' );
		}
		if ( '' !== $v ) {
			$data[ $f['label'] ] = $v;
			if ( 'tel' === $f['type'] && ! $phone ) {
				$phone = wt_phone( $v );
			}
			if ( 'text' === $f['type'] && ! $name ) {
				$name = $v;
			}
		}
	}
	$lead = wt_rec_insert( 'insurance', array( 'data' => $data, 'phone' => $phone, 'status' => 'New' ), 'IN' );
	$text = implode(
		"\n",
		array_map(
			function ( $k, $v ) {
				return $k . ': ' . $v;
			},
			array_keys( $data ),
			$data
		)
	);
	$s = $c['settings'];
	wt_email( $s['notifyEmail'], 'New pet insurance enquiry', $text );
	if ( $s['notifyWhatsApp'] ) {
		wt_whatsapp( $s['notifyWhatsApp'], 'insurance_admin', array( $name, $phone, str_replace( "\n", ', ', $text ) ), str_replace( "\n", ', ', $text ) );
	}
	return array( 'ok' => true, 'id' => $lead['id'] );
}

function wt_api_contact( $in ) {
	if ( ! empty( $in['website'] ) ) {
		return wt_err( 'Something went wrong. Please try again.' );
	}
	$e = array(
		'name'  => wt_str( $in, 'name', 80 ),
		'phone' => wt_str( $in, 'phone', 20 ),
		'msg'   => mb_substr( sanitize_textarea_field( (string) ( $in['msg'] ?? '' ) ), 0, 2000 ),
	);
	if ( ! $e['name'] || ! $e['phone'] || ! $e['msg'] ) {
		return wt_err( 'Fill your name, phone and message.' );
	}
	$e = wt_rec_insert( 'enquiry', $e, 'EQ' );
	wt_email( wt_config()['settings']['notifyEmail'], 'New website enquiry from ' . $e['name'], $e['name'] . ' (' . $e['phone'] . "):\n\n" . $e['msg'] );
	return array( 'ok' => true );
}

/* ---------- accounts ---------- */

function wt_api_register( $in ) {
	$name  = wt_str( $in, 'name', 80 );
	$phone = wt_phone( $in['phone'] ?? '' );
	$email = sanitize_email( $in['email'] ?? '' );
	$pass  = (string) ( $in['pass'] ?? '' );
	if ( mb_strlen( $name ) < 2 ) {
		return wt_err( 'Enter your full name.' );
	}
	if ( ! wt_valid_mobile( $phone ) ) {
		return wt_err( 'Enter a valid 10-digit mobile number.' );
	}
	if ( ! is_email( $email ) ) {
		return wt_err( 'Enter a valid email address.' );
	}
	if ( strlen( $pass ) < 6 ) {
		return wt_err( 'Password needs at least 6 characters.' );
	}
	if ( wt_user_by_phone( $phone ) || username_exists( $phone ) ) {
		return wt_err( 'An account with this mobile number exists. Sign in instead.' );
	}
	if ( email_exists( $email ) ) {
		return wt_err( 'An account with this email exists. Sign in instead.' );
	}
	$role = get_role( 'customer' ) ? 'customer' : get_option( 'default_role', 'subscriber' );
	$parts = explode( ' ', $name, 2 );
	$uid   = wp_insert_user(
		array(
			'user_login'   => $phone,
			'user_pass'    => $pass,
			'user_email'   => $email,
			'display_name' => $name,
			'first_name'   => $parts[0],
			'last_name'    => isset( $parts[1] ) ? $parts[1] : '',
			'role'         => $role,
		)
	);
	if ( is_wp_error( $uid ) ) {
		return wt_err( $uid->get_error_message() );
	}
	update_user_meta( $uid, 'wt_phone', $phone );
	update_user_meta( $uid, 'billing_phone', $phone );
	update_user_meta( $uid, 'billing_email', $email );
	update_user_meta( $uid, 'billing_first_name', $parts[0] );
	update_user_meta( $uid, 'billing_last_name', isset( $parts[1] ) ? $parts[1] : '' );
	$r = wt_config()['rewards'];
	if ( ! empty( $r['enabled'] ) && $r['signupBonus'] > 0 ) {
		wt_points_add( $phone, $r['signupBonus'], 'Welcome bonus', '' );
	}
	wt_email( $email, 'Welcome to Wag & Tails', 'Hi ' . $parts[0] . ",\n\nYour account is ready. You have " . wt_points_balance( $phone ) . " reward points.\n\nSign in with your mobile number " . $phone . '.' );
	wp_set_current_user( $uid );
	wp_set_auth_cookie( $uid, true, is_ssl() );
	return array( 'ok' => true, 'role' => 'customer' );
}

function wt_api_login( $in ) {
	$who  = $in['who'] ?? 'customer';
	$user = trim( (string) ( $in['user'] ?? '' ) );
	$pass = (string) ( $in['pass'] ?? '' );
	if ( '' === $user || '' === $pass ) {
		return wt_err( 'Enter your login and password.' );
	}
	$login = $user;
	if ( 'customer' === $who ) {
		$u = wt_user_by_phone( $user );
		if ( $u ) {
			$login = $u->user_login;
		}
	}
	$signed = wp_signon(
		array(
			'user_login'    => $login,
			'user_password' => $pass,
			'remember'      => true,
		),
		is_ssl()
	);
	if ( is_wp_error( $signed ) ) {
		return wt_err( 'customer' === $who ? 'Mobile number or password is incorrect.' : 'Username or password is incorrect.', 'wt_login', 403 );
	}
	wp_set_current_user( $signed->ID );
	$role = user_can( $signed, 'manage_options' ) ? 'admin' : ( user_can( $signed, 'wt_desk' ) ? 'staff' : 'customer' );
	if ( 'admin' === $who && 'admin' !== $role ) {
		wp_logout();
		return wt_err( 'This is not an admin account.', 'wt_login', 403 );
	}
	if ( 'staff' === $who && 'customer' === $role ) {
		wp_logout();
		return wt_err( 'This is not a booking staff account.', 'wt_login', 403 );
	}
	return array( 'ok' => true, 'role' => $role );
}

function wt_api_logout() {
	wp_logout();
	return array( 'ok' => true );
}

function wt_api_me() {
	$uid   = get_current_user_id();
	$u     = wp_get_current_user();
	$phone = wt_user_phone( $uid );
	return array(
		'user'     => array(
			'name'  => $u->display_name,
			'email' => $u->user_email,
			'phone' => $phone,
		),
		'balance'  => wt_points_balance( $phone ),
		'bookings' => $phone ? array_map(
			'wt_booking_for_client',
			array_values(
				array_filter(
					wt_rec_list( 'booking', array( 'phone' => $phone ), 'skey DESC', 100 ),
					function ( $b ) {
						return 'Pending payment' !== $b['status'];
					}
				)
			)
		) : array(),
		'orders'   => wt_customer_orders( $uid, $phone ),
		'points'   => $phone ? wt_rec_list( 'points', array( 'phone' => $phone ), 'id DESC', 200 ) : array(),
		'ordersUrl' => wt_woo_on() ? wc_get_account_endpoint_url( 'orders' ) : '',
		'profile'   => $phone && function_exists( 'wt_profile_public' ) ? wt_profile_public( $phone ) : null,
	);
}

/* ---------- booking desk ---------- */

function wt_api_desk_list( $in ) {
	return wt_desk_list( sanitize_key( $in['filter'] ?? 'upcoming' ), sanitize_text_field( $in['city'] ?? 'all' ), sanitize_text_field( $in['q'] ?? '' ) );
}

function wt_api_desk_action( $in ) {
	return wt_desk_action( sanitize_text_field( $in['ref'] ), $in );
}

/* ---------- admin ---------- */

function wt_api_save_config( $in ) {
	wt_merge_admin_config( $in );
	return array( 'ok' => true, 'config' => wt_client_config( 'admin' ) );
}

function wt_api_records( $in ) {
	$type = sanitize_key( $in['type'] ?? '' );
	if ( ! in_array( $type, array( 'walk', 'insurance', 'enquiry', 'notif', 'points' ), true ) ) {
		return wt_err( 'Unknown list.' );
	}
	return array( 'list' => wt_rec_list( $type, array(), 'id DESC', 'notif' === $type ? 300 : 500 ) );
}

/** Insurance form leads as a CSV: one column per question, filtered by date received and status. */
function wt_api_insurance_report( $in ) {
	global $wpdb;
	$from   = wt_ymd( $in['from'] ?? '', '2000-01-01' );
	$to     = wt_ymd( $in['to'] ?? '', wt_today() );
	$status = sanitize_text_field( $in['status'] ?? 'all' );
	if ( $from > $to ) {
		list( $from, $to ) = array( $to, $from );
	}
	$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT data, created_at FROM ' . wt_table() . " WHERE type = 'insurance' AND created_at >= %s AND created_at <= %s ORDER BY id DESC", $from . ' 00:00:00', $to . ' 23:59:59' ), ARRAY_A ); // phpcs:ignore
	$leads = array();
	foreach ( $rows as $r ) {
		$d = json_decode( $r['data'], true );
		if ( ! $d || ( 'all' !== $status && ( $d['status'] ?? 'New' ) !== $status ) ) {
			continue;
		}
		$d['_at'] = $r['created_at'];
		$leads[]  = $d;
	}
	$cols = wp_list_pluck( wt_config()['insFields'], 'label' );
	foreach ( $leads as $l ) {
		foreach ( array_keys( (array) ( $l['data'] ?? array() ) ) as $k ) {
			if ( ! in_array( $k, $cols, true ) ) {
				$cols[] = $k;
			}
		}
	}
	if ( 'csv' !== ( $in['format'] ?? '' ) ) {
		return array( 'count' => count( $leads ) );
	}
	$out = array();
	foreach ( $leads as $l ) {
		$t   = strtotime( $l['_at'] . ' UTC' ); // saved in site time; read it back unchanged
		$row = array( $l['id'] ?? '', $t ? gmdate( 'd M Y', $t ) : '', $t ? gmdate( 'h:i A', $t ) : '', $l['status'] ?? 'New', $l['phone'] ?? '' );
		foreach ( $cols as $c ) {
			$row[] = (string) ( $l['data'][ $c ] ?? '' );
		}
		$out[] = $row;
	}
	wt_csv_send( 'insurance-leads-' . $from . '-to-' . $to . '.csv', array_merge( array( 'Lead ID', 'Date', 'Time', 'Status', 'Phone' ), $cols ), $out );
}

function wt_api_record_update( $in ) {
	$ref  = sanitize_text_field( $in['ref'] );
	$type = sanitize_key( $in['type'] ?? '' );
	if ( ! in_array( $type, array( 'walk', 'insurance', 'enquiry' ), true ) ) {
		return wt_err( 'Unknown record.' );
	}
	if ( 'delete' === ( $in['action'] ?? '' ) ) {
		wt_rec_delete( $type, $ref );
		return array( 'ok' => true );
	}
	$rec = wt_rec_get( $type, $ref );
	if ( ! $rec ) {
		return wt_err( 'Not found.', 'wt_404', 404 );
	}
	$rec['status'] = wt_str( $in, 'status', 30 );
	wt_rec_save( $type, $rec );
	return array( 'ok' => true );
}

function wt_api_customers() {
	global $wpdb;
	$t    = wt_table();
	$pts  = $wpdb->get_results( "SELECT phone, SUM(amount) AS s FROM $t WHERE type = 'points' GROUP BY phone", OBJECT_K ); // phpcs:ignore
	$bks  = $wpdb->get_results( "SELECT phone, COUNT(*) AS n FROM $t WHERE type = 'booking' AND status <> 'Pending payment' GROUP BY phone", OBJECT_K ); // phpcs:ignore
	$users = get_users(
		array(
			'meta_key'     => 'wt_phone', // phpcs:ignore
			'meta_compare' => 'EXISTS',
			'number'       => 2000,
		)
	);
	$rows = array();
	foreach ( $users as $u ) {
		$p          = get_user_meta( $u->ID, 'wt_phone', true );
		$rows[ $p ] = array( 'name' => $u->display_name, 'email' => $u->user_email, 'phone' => $p, 'registered' => true );
	}
	foreach ( wt_rec_list( 'customer', array(), 'id DESC', 20000 ) as $cr ) {
		if ( $cr['phone'] && ! isset( $rows[ $cr['phone'] ] ) ) {
			$rows[ $cr['phone'] ] = array( 'name' => $cr['name'], 'email' => $cr['email'], 'phone' => $cr['phone'], 'registered' => false );
		}
	}
	foreach ( array_unique( array_merge( array_keys( (array) $pts ), array_keys( (array) $bks ) ) ) as $p ) {
		if ( ! $p || isset( $rows[ $p ] ) ) {
			continue;
		}
		if ( count( $rows ) > 1500 ) {
			break;
		}
		$last       = wt_rec_list( 'booking', array( 'phone' => $p ), 'id DESC', 1 );
		$rows[ $p ] = array( 'name' => $last ? $last[0]['name'] : '', 'email' => $last ? $last[0]['email'] : '', 'phone' => $p, 'registered' => false );
	}
	foreach ( $rows as $p => &$r ) {
		$r['points']   = isset( $pts[ $p ] ) ? (int) $pts[ $p ]->s : 0;
		$r['bookings'] = isset( $bks[ $p ] ) ? (int) $bks[ $p ]->n : 0;
	}
	unset( $r );
	$rows = array_values( $rows );
	usort(
		$rows,
		function ( $a, $b ) {
			return $b['bookings'] <=> $a['bookings'];
		}
	);
	return array( 'list' => $rows );
}

function wt_api_points_adjust( $in ) {
	$phone = wt_phone( $in['phone'] ?? '' );
	$pts   = (int) ( $in['pts'] ?? 0 );
	if ( strlen( $phone ) !== 10 ) {
		return wt_err( 'Enter a 10-digit mobile number.' );
	}
	if ( ! $pts ) {
		return wt_err( 'Enter the number of points, e.g. 50 or -20.' );
	}
	$bal = wt_points_balance( $phone );
	if ( $bal + $pts < 0 ) {
		return wt_err( 'This customer has only ' . $bal . ' points.' );
	}
	$reason = wt_str( $in, 'reason', 120 );
	wt_points_add( $phone, $pts, $reason ? $reason : 'Adjusted by admin', '' );
	return array( 'ok' => true, 'balance' => wt_points_balance( $phone ) );
}

function wt_api_staff_list() {
	$out = array();
	foreach ( get_users( array( 'role' => 'wt_desk', 'number' => 200 ) ) as $u ) {
		$out[] = array(
			'id'       => $u->ID,
			'name'     => $u->display_name,
			'username' => $u->user_login,
			'phone'    => get_user_meta( $u->ID, 'wt_staff_phone', true ),
			'city'     => get_user_meta( $u->ID, 'wt_city', true ) ? get_user_meta( $u->ID, 'wt_city', true ) : 'all',
			'perms'    => wt_staff_perms( $u->ID ),
			'att'      => wt_att_state( $u->ID ),
		);
	}
	return array( 'list' => $out );
}

function wt_api_staff_create( $in ) {
	$name  = wt_str( $in, 'name', 80 );
	$login = sanitize_user( $in['username'] ?? '', true );
	$pass  = (string) ( $in['password'] ?? '' );
	$email = sanitize_email( $in['email'] ?? '' );
	$city  = sanitize_text_field( $in['city'] ?? 'all' );
	if ( mb_strlen( $name ) < 2 || ! $login ) {
		return wt_err( 'Enter the full name and a username.' );
	}
	if ( strlen( $pass ) < 8 ) {
		return wt_err( 'Use a password of at least 8 characters.' );
	}
	if ( username_exists( $login ) ) {
		return wt_err( 'That username is taken.' );
	}
	if ( $email && email_exists( $email ) ) {
		return wt_err( 'That email already has an account.' );
	}
	$uid = wp_insert_user(
		array(
			'user_login'   => $login,
			'user_pass'    => $pass,
			'user_email'   => $email,
			'display_name' => $name,
			'role'         => 'wt_desk',
		)
	);
	if ( is_wp_error( $uid ) ) {
		return wt_err( $uid->get_error_message() );
	}
	update_user_meta( $uid, 'wt_staff_phone', wt_str( $in, 'phone', 20 ) );
	update_user_meta( $uid, 'wt_city', 'all' === $city || wt_city( $city ) ? $city : 'all' );
	return array( 'ok' => true );
}

function wt_api_staff_delete( $in ) {
	$uid = (int) $in['uid'];
	$u   = get_userdata( $uid );
	if ( ! $u || ! in_array( 'wt_desk', (array) $u->roles, true ) || user_can( $u, 'manage_options' ) ) {
		return wt_err( 'Only booking staff logins can be removed here.' );
	}
	require_once ABSPATH . 'wp-admin/includes/user.php';
	wp_delete_user( $uid );
	return array( 'ok' => true );
}

function wt_api_dashboard() {
	$today = wt_today();
	$open  = wt_rec_list( 'booking', array( 'status' => WT_OPEN ), 'skey ASC', 2000 );
	$done  = wt_rec_list( 'booking', array( 'status' => 'Completed' ), 'skey DESC', 2000 );
	$since = wt_today( -30 );
	$sum   = 0;
	foreach ( $done as $b ) {
		if ( $b['date'] >= $since && ! empty( $b['payMode'] ) ) {
			$sum += (float) $b['total'];
		}
	}
	global $wpdb;
	$t     = wt_table();
	$count = function ( $type, $status = null ) use ( $wpdb, $t ) {
		if ( $status ) {
			return (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM $t WHERE type = %s AND status = %s", $type, $status ) ); // phpcs:ignore
		}
		return (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM $t WHERE type = %s", $type ) ); // phpcs:ignore
	};
	return array(
		'today'     => count(
			array_filter(
				$open,
				function ( $b ) use ( $today ) {
					return $b['date'] === $today;
				}
			)
		),
		'upcoming'  => count( $open ),
		'collected' => $sum,
		'leads'     => $count( 'insurance', 'New' ),
		'walks'     => $count( 'walk', 'New' ),
		'enquiries' => $count( 'enquiry' ),
		'next'      => array_slice( $open, 0, 5 ),
	);
}

/* ---------- admin logins ---------- */

function wt_api_admins_list() {
	$out = array();
	foreach ( get_users( array( 'role' => 'administrator', 'number' => 100 ) ) as $u ) {
		$out[] = array(
			'id'       => $u->ID,
			'name'     => $u->display_name,
			'username' => $u->user_login,
			'email'    => $u->user_email,
			'me'       => get_current_user_id() === $u->ID,
		);
	}
	return array( 'list' => $out );
}

function wt_api_admin_create( $in ) {
	$name  = wt_str( $in, 'name', 80 );
	$email = sanitize_email( $in['email'] ?? '' );
	$login = sanitize_user( (string) ( $in['username'] ?? '' ), true );
	$pass  = (string) ( $in['password'] ?? '' );
	if ( mb_strlen( $name ) < 2 ) {
		return wt_err( 'Enter the full name.' );
	}
	if ( ! is_email( $email ) ) {
		return wt_err( 'Enter a valid email address.' );
	}
	if ( strlen( $pass ) < 8 ) {
		return wt_err( 'Use a password of at least 8 characters.' );
	}
	if ( email_exists( $email ) ) {
		return wt_err( 'That email already has an account on this website.' );
	}
	$login = $login ? $login : strtolower( $email );
	if ( username_exists( $login ) ) {
		return wt_err( 'That username is taken.' );
	}
	$uid = wp_insert_user(
		array(
			'user_login'   => $login,
			'user_pass'    => $pass,
			'user_email'   => $email,
			'display_name' => $name,
			'first_name'   => explode( ' ', $name )[0],
			'role'         => 'administrator',
		)
	);
	if ( is_wp_error( $uid ) ) {
		return wt_err( $uid->get_error_message() );
	}
	return array( 'ok' => true, 'id' => $uid );
}

function wt_api_admin_delete( $in ) {
	$uid = (int) $in['uid'];
	$u   = get_userdata( $uid );
	if ( ! $u || ! in_array( 'administrator', (array) $u->roles, true ) ) {
		return wt_err( 'Admin login not found.' );
	}
	if ( get_current_user_id() === $uid ) {
		return wt_err( 'You cannot remove your own login.' );
	}
	if ( count( get_users( array( 'role' => 'administrator', 'fields' => 'ID' ) ) ) < 2 ) {
		return wt_err( 'The website needs at least one admin.' );
	}
	require_once ABSPATH . 'wp-admin/includes/user.php';
	wp_delete_user( $uid, get_current_user_id() );
	return array( 'ok' => true );
}

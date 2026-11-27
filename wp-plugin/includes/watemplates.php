<?php
/**
 * WhatsApp templates: submit the plugin's message templates to Meta for approval with the saved
 * access token, then switch each message over to its template once Meta approves it.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Templates the plugin can submit. Key = message (wt_wa_events key). */
function wt_wa_template_defs() {
	return array(
		'booking_customer'     => array(
			'name'     => 'wag_booking_confirmed_v2',
			'category' => 'UTILITY',
			'text'     => "Hi {{1}}, your Wag & Tails home grooming is confirmed! 🐾\n\nBooking ID: {{2}}\nPackage: {{3}}\nDate: {{4}}\nTime: {{5}}\nTotal: {{6}} ({{7}})\n\n24-hour happy-groom promise: if anything is not right, log in at wagandtails.in with this mobile number within 24 hours of the groom and raise a complaint. We will send the groomer back for a free redo.\n\nWe also help with pet insurance and have pet products like beds, jackets and shampoos at wagandtails.in.",
			'example'  => array( 'Riya', 'WT-ABC123', 'Full Groom', '20 Oct 2026', '11:00am - 12:30pm', '₹1,299', 'Pay after service' ),
		),
		'booking_customer_basic' => array(
			'name'     => 'wag_booking_confirmed_basic',
			'category' => 'UTILITY',
			'text'     => "Hi {{1}}, your Wag & Tails home grooming is confirmed! 🐾\n\nBooking ID: {{2}}\nPackage: {{3}}\nDate: {{4}}\nTime: {{5}}\nTotal: {{6}} ({{7}})\n\nNeed to change something? Just reply to this message.\n\nWe also help with pet insurance and have pet products like beds, jackets and shampoos at wagandtails.in.",
			'example'  => array( 'Riya', 'WT-ABC123', 'Full Groom', '20 Oct 2026', '11:00am - 12:30pm', '₹1,299', 'Pay after service' ),
		),
		'complaint_registered' => array(
			'name'     => 'wag_complaint_registered',
			'category' => 'UTILITY',
			'text'     => "Hi {{1}}, we have registered your complaint {{2}} about {{3}}.\n\nOur team will call you within 24 hours to sort it out. You can see the status any time by logging in at wagandtails.in with this mobile number.",
			'example'  => array( 'Riya', 'CM-ABC123', 'booking WT-ABC123' ),
		),
		'complaint_resolved'   => array(
			'name'     => 'wag_complaint_resolved',
			'category' => 'UTILITY',
			'text'     => "Hi {{1}}, your complaint {{2}} has been resolved.\n\nWhat we did: {{3}}\n\nThank you for your patience. If anything is still not right, just reply to this message. – Team Wag & Tails",
			'example'  => array( 'Riya', 'CM-ABC123', 'Free redo done and nails trimmed properly' ),
		),
	);
}

function wt_wa_graph( $method, $path, $body = null ) {
	$s   = wt_config()['settings'];
	$res = wp_remote_request(
		'https://graph.facebook.com/v23.0/' . ltrim( $path, '/' ),
		array(
			'method'  => $method,
			'timeout' => 20,
			'headers' => array(
				'Authorization' => 'Bearer ' . $s['waToken'],
				'Content-Type'  => 'application/json',
			),
			'body'    => null === $body ? null : wp_json_encode( $body ),
		)
	);
	if ( is_wp_error( $res ) ) {
		return $res;
	}
	$j = json_decode( wp_remote_retrieve_body( $res ), true );
	if ( wp_remote_retrieve_response_code( $res ) >= 300 ) {
		$msg = $j['error']['error_user_msg'] ?? ( $j['error']['message'] ?? 'Meta rejected the request.' );
		return new WP_Error( 'wt_meta', $msg, array( 'status' => 400 ) );
	}
	return $j;
}

/** WhatsApp Business Account ID that owns the sending phone number (checked, not guessed). */
function wt_wa_waba_id() {
	$id = (string) get_option( 'wt_waba_id' );
	$s  = wt_config()['settings'];
	if ( ! $id || empty( $s['waPhoneId'] ) ) {
		return '';
	}
	if ( get_option( 'wt_waba_ok' ) === $id . ':' . $s['waPhoneId'] ) {
		return $id;
	}
	$p = wt_wa_graph( 'GET', $id . '/phone_numbers?fields=id' );
	if ( ! is_wp_error( $p ) && in_array( (string) $s['waPhoneId'], array_map( 'strval', wp_list_pluck( (array) ( $p['data'] ?? array() ), 'id' ) ), true ) ) {
		update_option( 'wt_waba_ok', $id . ':' . $s['waPhoneId'], false );
		return $id;
	}
	return '';
}

/** Status of our templates at Meta, and switch messages to newly approved ones. */
function wt_wa_templates_sync() {
	$waba = wt_wa_waba_id();
	if ( ! $waba ) {
		return new WP_Error( 'wt_meta', 'Enter the WhatsApp Business Account ID that owns your sending number (WhatsApp Manager → account ID) in the box below.' );
	}
	$r = wt_wa_graph( 'GET', $waba . '/message_templates?fields=name,status,category,language,rejected_reason&limit=200' );
	if ( is_wp_error( $r ) ) {
		return $r;
	}
	$byname = array();
	foreach ( (array) ( $r['data'] ?? array() ) as $t ) {
		$byname[ $t['name'] ] = $t;
	}
	$pending = (array) get_option( 'wt_tpl_pending', array() );
	$raw     = get_option( 'wt_config' );
	$cfg     = wt_config();
	$changed = false;
	foreach ( $pending as $event => $name ) {
		$want = wt_wa_template_defs()[ $event ]['category'] ?? '';
		if ( isset( $byname[ $name ] ) && 'APPROVED' === $byname[ $name ]['status'] && $want && strtoupper( $byname[ $name ]['category'] ) !== $want ) {
			unset( $pending[ $event ] ); // Meta changed the category (e.g. to Marketing): keep the current template
			update_option( 'wt_tpl_recat', array_merge( (array) get_option( 'wt_tpl_recat', array() ), array( $event => $byname[ $name ]['category'] ) ), false );
		} elseif ( isset( $byname[ $name ] ) && 'APPROVED' === $byname[ $name ]['status'] ) {
			$cfg['settings']['waTemplates'][ $event ] = $name;
			if ( is_array( $raw ) ) {
				$raw['settings']['waTemplates'][ $event ] = $name;
			}
			unset( $pending[ $event ] );
			$changed = true;
		} elseif ( isset( $byname[ $name ] ) && in_array( $byname[ $name ]['status'], array( 'REJECTED', 'DISABLED' ), true ) ) {
			unset( $pending[ $event ] );
		}
	}
	if ( $changed ) {
		wt_save_config( is_array( $raw ) ? $raw : $cfg );
	}
	update_option( 'wt_tpl_pending', $pending, false );
	$out = array();
	foreach ( wt_wa_template_defs() as $event => $d ) {
		$t           = $byname[ $d['name'] ] ?? null;
		$out[ $event ] = array(
			'name'     => $d['name'],
			'status'   => $t ? $t['status'] : 'NOT_SUBMITTED',
			'category' => $t ? $t['category'] : $d['category'],
			'reason'   => $t['rejected_reason'] ?? '',
			'inUse'    => ( $cfg['settings']['waTemplates'][ $event ] ?? '' ) === $d['name'],
		);
	}
	return $out;
}

function wt_api_wa_templates_get( $in = array() ) {
	if ( ! empty( $in['waba'] ) && ctype_digit( (string) $in['waba'] ) ) {
		update_option( 'wt_waba_id', (string) $in['waba'], false );
	}
	if ( ! empty( $in['debug'] ) ) {
		$waba = wt_wa_waba_id();
		$s    = wt_config()['settings'];
		$t    = wt_wa_graph( 'GET', $waba . '/message_templates?fields=name,status,language,category&limit=200' );
		$p    = wt_wa_graph( 'GET', $waba . '/phone_numbers?fields=id,display_phone_number,verified_name' );
		return array(
			'waba'      => $waba,
			'phoneId'   => $s['waPhoneId'],
			'templates' => is_wp_error( $t ) ? $t->get_error_message() : array_map( function ( $x ) { return $x['name'] . '|' . $x['language'] . '|' . $x['status']; }, $t['data'] ?? array() ),
			'phones'    => is_wp_error( $p ) ? $p->get_error_message() : $p['data'] ?? array(),
		);
	}
	$r = wt_wa_templates_sync();
	return is_wp_error( $r ) ? $r : array( 'templates' => $r );
}

function wt_api_wa_templates_create( $in ) {
	$waba = wt_wa_waba_id();
	if ( ! $waba ) {
		return wt_err( 'Enter the WhatsApp Business Account ID that owns your sending number (WhatsApp Manager → account ID) in the box below.' );
	}
	$s       = wt_config()['settings'];
	$defs    = wt_wa_template_defs();
	$keys    = array_intersect( (array) ( $in['keys'] ?? array_keys( $defs ) ), array_keys( $defs ) );
	$pending = (array) get_option( 'wt_tpl_pending', array() );
	$out     = array();
	foreach ( $keys as $event ) {
		$d = $defs[ $event ];
		$r = wt_wa_graph(
			'POST',
			$waba . '/message_templates',
			array(
				'name'       => $d['name'],
				'language'   => $s['waLang'] ? $s['waLang'] : 'en',
				'category'   => $d['category'],
				'components' => array(
					array(
						'type'    => 'BODY',
						'text'    => $d['text'],
						'example' => array( 'body_text' => array( $d['example'] ) ),
					),
				),
			)
		);
		if ( is_wp_error( $r ) ) {
			$out[ $event ] = 'Not submitted: ' . $r->get_error_message();
			if ( false !== stripos( $r->get_error_message(), 'already' ) ) {
				$pending[ $event ] = $d['name'];
			}
			continue;
		}
		$pending[ $event ] = $d['name'];
		$out[ $event ]     = 'Submitted (' . ( $r['status'] ?? 'PENDING' ) . ', ' . ( $r['category'] ?? $d['category'] ) . ')';
	}
	update_option( 'wt_tpl_pending', $pending, false );
	return array( 'result' => $out );
}

/** Send each plugin template once to a test number with sample values. */
function wt_api_wa_templates_test( $in ) {
	$phone = wt_phone( $in['phone'] ?? '' );
	if ( ! wt_valid_mobile( $phone ) ) {
		return wt_err( 'Enter a valid 10-digit mobile number.' );
	}
	$defs = wt_wa_template_defs();
	$keys = array_intersect( (array) ( $in['keys'] ?? array_keys( $defs ) ), array_keys( $defs ) );
	$out  = array();
	foreach ( $keys as $event ) {
		$before = wt_last_notif_id();
		wt_whatsapp( $phone, $event, $defs[ $event ]['example'], 'Test: ' . $defs[ $event ]['name'] );
		$out[ $event ] = wt_last_notif_result( $before );
	}
	return array( 'result' => $out );
}

/* Check pending templates every hour and switch messages over when Meta approves them. */
add_action(
	'wt_tpl_check',
	function () {
		if ( get_option( 'wt_tpl_pending' ) ) {
			wt_wa_templates_sync();
		}
	}
);
add_action(
	'init',
	function () {
		if ( ! wp_next_scheduled( 'wt_tpl_check' ) ) {
			wp_schedule_event( time() + 600, 'hourly', 'wt_tpl_check' );
		}
	}
);

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'wt/v1',
			'/admin/wa/templates/test',
			array(
				'methods'             => 'POST',
				'permission_callback' => 'wt_can_admin',
				'callback'            => wt_rest( 'wt_api_wa_templates_test' ),
			)
		);
		register_rest_route(
			'wt/v1',
			'/admin/wa/templates',
			array(
				array(
					'methods'             => 'GET',
					'permission_callback' => 'wt_can_admin',
					'callback'            => wt_rest( 'wt_api_wa_templates_get' ),
				),
				array(
					'methods'             => 'POST',
					'permission_callback' => 'wt_can_admin',
					'callback'            => wt_rest( 'wt_api_wa_templates_create' ),
				),
			)
		);
	}
);

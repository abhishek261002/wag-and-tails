<?php
/**
 * Time slots worked out from bookings already made:
 * a slot is "Booked" when it overlaps an existing booking (its package length plus buffer time)
 * and the city has no free groomer left. Past times are not offered.
 * Also: private coupon checks and the WhatsApp delivery-status webhook.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function wt_hm_to_min( $hm ) {
	if ( preg_match( '/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i', trim( (string) $hm ), $m ) ) {
		$h = (int) $m[1] % ( empty( $m[3] ) ? 24 : 12 );
		if ( ! empty( $m[3] ) && 'pm' === strtolower( $m[3] ) ) {
			$h += 12;
		}
		return $h * 60 + (int) $m[2];
	}
	return null;
}

function wt_min_to_hm( $min ) {
	return sprintf( '%02d:%02d', floor( $min / 60 ), $min % 60 );
}

/** 600 → "10:00am" */
function wt_min_to_label( $min ) {
	$h = floor( $min / 60 ) % 24;
	$m = $min % 60;
	return sprintf( '%d:%02d%s', ( $h % 12 ) ? $h % 12 : 12, $m, $h < 12 ? 'am' : 'pm' );
}

function wt_slot_label( $start, $mins ) {
	return wt_min_to_label( $start ) . ' - ' . wt_min_to_label( $start + $mins );
}

/** Length of a package in minutes. */
function wt_pkg_mins( $pkg ) {
	if ( ! $pkg ) {
		return 60;
	}
	if ( ! empty( $pkg['mins'] ) ) {
		return max( 15, (int) $pkg['mins'] );
	}
	if ( preg_match( '/(\d+(?:\.\d+)?)\s*(h|hr|hour)/i', (string) ( $pkg['duration'] ?? '' ), $m ) ) {
		return (int) round( $m[1] * 60 );
	}
	if ( preg_match( '/(\d+)/', (string) ( $pkg['duration'] ?? '' ), $m ) ) {
		return max( 15, (int) $m[1] );
	}
	return 60;
}

/** [start minute, length] of an existing booking. */
function wt_booking_span( $b, $cfg ) {
	$start = isset( $b['start'] ) ? wt_hm_to_min( $b['start'] ) : null;
	if ( null === $start && preg_match( '/(\d{1,2}):(\d{2})\s*(am|pm)/i', (string) ( $b['slot'] ?? '' ), $m ) ) {
		$start = wt_hm_to_min( $m[1] . ':' . $m[2] . ' ' . $m[3] );
	}
	if ( null === $start ) {
		return null;
	}
	$mins = ! empty( $b['mins'] ) ? (int) $b['mins'] : wt_pkg_mins( wt_find( $cfg['packages'], 'id', $b['pkg'] ?? '' ) );
	return array( $start, $mins );
}

function wt_slot_settings( $cfg ) {
	$s = $cfg['settings'];
	return array(
		'open'   => wt_hm_to_min( $s['dayStart'] ?? '09:00' ) ?? 540,
		'close'  => wt_hm_to_min( $s['dayEnd'] ?? '19:00' ) ?? 1140,
		'step'   => max( 15, (int) ( $s['slotStep'] ?? 30 ) ),
		'buffer' => max( 0, (int) ( $s['bufferMins'] ?? 30 ) ),
		'lead'   => max( 0, (int) ( $s['leadMins'] ?? 60 ) ),
	);
}

/**
 * All start times for a day, each free or booked. Past times are left out.
 *
 * @return array<int, array{start:string,label:string,free:bool}>
 */
function wt_day_slots( $city_id, $date, $mins, $exclude_ref = '', $desk = false ) {
	$cfg  = wt_config();
	$city = wt_city( $city_id, $cfg );
	if ( ! $city || ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) $date ) || ( ! $desk && $date < wt_today() ) ) {
		return array();
	}
	$st       = wt_slot_settings( $cfg );
	$capacity = max( 1, (int) ( $city['capacity'] ?? 1 ) );
	$existing = array();
	foreach ( wt_rec_list( 'booking', array( 'city' => $city_id, 'date' => $date, 'status' => array( 'Confirmed', 'Rescheduled', 'Pending payment' ) ), 'skey ASC', 500 ) as $b ) {
		if ( $b['id'] === $exclude_ref || $b['date'] !== $date ) {
			continue;
		}
		// An unpaid online booking holds its slot for 20 minutes only.
		if ( 'Pending payment' === $b['status'] && ( empty( $b['ts'] ) || time() - (int) $b['ts'] > 1200 ) ) {
			continue;
		}
		$span = wt_booking_span( $b, $cfg );
		if ( $span ) {
			$existing[] = $span;
		}
	}
	$earliest = -1;
	if ( ! $desk && wt_today() === $date ) {
		$earliest = (int) wp_date( 'G' ) * 60 + (int) wp_date( 'i' ) + $st['lead'];
	}
	$blocks = wt_blocks_for( $city_id, $date );
	$out    = array();
	for ( $s = $st['open']; $s + $mins <= $st['close']; $s += $st['step'] ) {
		if ( $s < $earliest ) {
			continue;
		}
		$overlap = 0;
		foreach ( $existing as $e ) {
			// Existing booking blocks [start, end + buffer); the new one needs [s, s + length + buffer).
			if ( $s < $e[0] + $e[1] + $st['buffer'] && $e[0] < $s + $mins + $st['buffer'] ) {
				$overlap++;
			}
		}
		$out[] = array(
			'start' => wt_min_to_hm( $s ),
			'label' => wt_slot_label( $s, $mins ),
			'free'  => $overlap < ( $blocks ? $capacity - wt_block_off( $blocks, $s, $mins ) : $capacity ),
		);
	}
	return $out;
}

/** Check a date + start time can be booked. Returns [start 'HH:MM', label] or WP_Error. */
function wt_check_slot( $city, $date, $start, $mins, $exclude_ref = '', $desk = false ) {
	$c = wt_config();
	if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) $date ) ) {
		return wt_err( 'Choose a date.' );
	}
	if ( $desk ) {
		return wt_check_slot_desk( $city, $date, $start, $mins, $exclude_ref );
	}
	if ( $date < wt_today() ) {
		return wt_err( 'That date has passed. Choose today or a later date.' );
	}
	if ( $date > wt_today( max( 1, (int) $c['settings']['maxDaysAhead'] ) ) ) {
		return wt_err( 'Bookings open up to ' . (int) $c['settings']['maxDaysAhead'] . ' days ahead.' );
	}
	$start = (string) $start;
	foreach ( wt_day_slots( $city, $date, $mins, $exclude_ref ) as $sl ) {
		if ( $sl['start'] === $start ) {
			if ( ! $sl['free'] ) {
				return wt_err( 'Sorry, ' . $sl['label'] . ' was just booked. Please choose another time.' );
			}
			return array( $sl['start'], $sl['label'] );
		}
	}
	return wt_err( 'Choose an available time slot.' );
}

/**
 * Booking desk: any date (past too) and any start time. A listed slot must still be free unless
 * "custom" is set, which accepts any HH:MM (the desk knows the groomer can do it).
 */
function wt_check_slot_desk( $city, $date, $start, $mins, $exclude_ref = '', $custom = false ) {
	$m = wt_hm_to_min( (string) $start );
	if ( null === $m ) {
		return wt_err( 'Choose a time, or enter a custom time like 07:30.' );
	}
	$hm = wt_min_to_hm( $m );
	if ( $custom ) {
		return array( $hm, wt_slot_label( $m, $mins ) );
	}
	foreach ( wt_day_slots( $city, $date, $mins, $exclude_ref, true ) as $sl ) {
		if ( $sl['start'] === $hm ) {
			if ( ! $sl['free'] ) {
				return wt_err( $sl['label'] . ' is already booked. Choose another time or use "Custom time".' );
			}
			return array( $sl['start'], $sl['label'] );
		}
	}
	return array( $hm, wt_slot_label( $m, $mins ) );
}

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'wt/v1',
			'/slots',
			array(
				'methods'             => 'GET',
				'permission_callback' => '__return_true',
				'callback'            => wt_rest(
					function ( $in ) {
						$cfg  = wt_config();
						$mins = 0;
						if ( ! empty( $in['ref'] ) && ( current_user_can( 'wt_desk' ) || current_user_can( 'manage_options' ) ) ) {
							$b    = wt_rec_get( 'booking', sanitize_text_field( $in['ref'] ) );
							$span = $b ? wt_booking_span( $b, $cfg ) : null;
							$mins = $span ? $span[1] : 60;
						}
						if ( ! $mins && '__custom' === ( $in['pkg'] ?? '' ) && ( current_user_can( 'wt_desk' ) || current_user_can( 'manage_options' ) ) ) {
							$mins = min( 600, max( 15, (int) ( $in['mins'] ?? 60 ) ) );
						}
						if ( ! $mins ) {
							$mins = wt_pkg_mins( wt_find( $cfg['packages'], 'id', sanitize_text_field( $in['pkg'] ?? '' ) ) );
						}
						return array(
							'slots' => wt_day_slots( sanitize_text_field( $in['city'] ?? '' ), sanitize_text_field( $in['date'] ?? '' ), $mins, sanitize_text_field( $in['ref'] ?? '' ), ! empty( $in['desk'] ) && ( current_user_can( 'wt_desk' ) || current_user_can( 'manage_options' ) ) ),
							'mins'  => $mins,
						);
					}
				),
			)
		);
		register_rest_route(
			'wt/v1',
			'/coupon',
			array(
				'methods'             => 'POST',
				'permission_callback' => '__return_true',
				'callback'            => wt_rest(
					function ( $in ) {
						$code = strtoupper( trim( sanitize_text_field( $in['code'] ?? '' ) ) );
						$ctx  = ( current_user_can( 'wt_desk' ) || current_user_can( 'manage_options' ) ) ? 'desk' : 'web';
						$cp   = wt_find_coupon( $code, $ctx );
						if ( ! $cp ) {
							return wt_err( 'This coupon code is not valid.' );
						}
						return array( 'coupon' => array_intersect_key( $cp, array_flip( array( 'code', 'type', 'value', 'min', 'desc', 'active' ) ) ) );
					}
				),
			)
		);
		// Meta calls this with delivery updates (sent / delivered / read / failed and the reason).
		register_rest_route(
			'wt/v1',
			'/wa-webhook',
			array(
				array(
					'methods'             => 'GET',
					'permission_callback' => '__return_true',
					'callback'            => function ( WP_REST_Request $r ) {
						$s = wt_config()['settings'];
						if ( $r->get_param( 'hub_verify_token' ) && hash_equals( (string) wt_wa_verify_token(), (string) $r->get_param( 'hub_verify_token' ) ) ) {
							header( 'Content-Type: text/plain' );
							echo esc_html( (string) $r->get_param( 'hub_challenge' ) );
							exit;
						}
						return new WP_Error( 'wt_forbidden', 'Wrong verify token', array( 'status' => 403 ) );
					},
				),
				array(
					'methods'             => 'POST',
					'permission_callback' => '__return_true',
					'callback'            => 'wt_wa_webhook_receive',
				),
			)
		);
	}
);

/** Coupon usable in this context: 'web' sees listed + hidden codes, 'desk' sees all. */
function wt_find_coupon( $code, $ctx ) {
	foreach ( wt_config()['coupons'] as $cp ) {
		if ( strtoupper( $cp['code'] ) === $code && ! empty( $cp['active'] ) ) {
			$vis = $cp['visibility'] ?? 'listed';
			if ( 'staff' === $vis && 'desk' !== $ctx ) {
				return null;
			}
			return $cp;
		}
	}
	return null;
}

function wt_wa_verify_token() {
	$t = get_option( 'wt_wa_verify_token' );
	if ( ! $t ) {
		$t = 'wagtails-' . wp_generate_password( 16, false );
		update_option( 'wt_wa_verify_token', $t, false );
	}
	return $t;
}

function wt_wa_webhook_receive( WP_REST_Request $r ) {
	// Meta signs each delivery report with the app secret. When the secret is set, unsigned or wrongly signed
	// calls are refused so nobody can forge delivery statuses in the Notifications log.
	$secret = (string) ( wt_config()['settings']['waAppSecret'] ?? '' );
	if ( defined( 'WT_WA_APP_SECRET' ) ) {
		$secret = (string) WT_WA_APP_SECRET;
	}
	if ( '' !== $secret ) {
		$sig = (string) $r->get_header( 'x_hub_signature_256' );
		$exp = 'sha256=' . hash_hmac( 'sha256', (string) $r->get_body(), $secret );
		if ( ! $sig || ! hash_equals( $exp, $sig ) ) {
			return new WP_Error( 'wt_forbidden', 'Bad signature', array( 'status' => 403 ) );
		}
	}
	$body = $r->get_json_params();
	foreach ( (array) ( $body['entry'] ?? array() ) as $entry ) {
		foreach ( (array) ( $entry['changes'] ?? array() ) as $ch ) {
			foreach ( (array) ( $ch['value']['statuses'] ?? array() ) as $st ) {
				$id     = sanitize_text_field( $st['id'] ?? '' );
				$status = sanitize_text_field( $st['status'] ?? '' );
				$reason = '';
				if ( ! empty( $st['errors'][0] ) ) {
					$e      = $st['errors'][0];
					$reason = trim( ( $e['code'] ?? '' ) . ' ' . ( $e['title'] ?? '' ) . ( ! empty( $e['error_data']['details'] ) ? ': ' . $e['error_data']['details'] : '' ) );
				}
				wt_wa_update_status( $id, $status, $reason );
			}
		}
	}
	return array( 'ok' => true );
}

/** Attach Meta's delivery result to the matching row in the Notifications log. */
function wt_wa_update_status( $wamid, $status, $reason ) {
	global $wpdb;
	if ( ! $wamid ) {
		return;
	}
	$t   = wt_table();
	$row = $wpdb->get_row( $wpdb->prepare( "SELECT ref, data FROM $t WHERE type = 'notif' AND data LIKE %s ORDER BY id DESC LIMIT 1", '%' . $wpdb->esc_like( $wamid ) . '%' ), ARRAY_A ); // phpcs:ignore
	if ( ! $row ) {
		return;
	}
	$d = json_decode( $row['data'], true );
	$labels = array( 'sent' => 'Sent', 'delivered' => 'Delivered', 'read' => 'Read', 'failed' => 'Failed' );
	$rank   = array( 'Sent' => 1, 'Delivered' => 2, 'Read' => 3, 'Failed' => 4 );
	$new    = $labels[ $status ] ?? ucfirst( $status );
	$old    = preg_replace( '/[:\s(].*$/', '', (string) ( $d['result'] ?? '' ) );
	if ( ( $rank[ $new ] ?? 0 ) >= ( $rank[ $old ] ?? 0 ) ) {
		$d['result'] = $new . ( $reason ? ': ' . $reason : '' );
		wt_rec_save( 'notif', $d );
		// A reminder that never arrived should not count as "reminded", so the next run tries again.
		if ( 'Failed' === $new && function_exists( 'wt_sent_unmark' ) && 0 === strpos( (string) ( $d['subject'] ?? '' ), 'Grooming reminder' ) ) {
			wt_sent_unmark( 'wa', wt_phone( $d['to'] ?? '' ) );
		}
	}
}

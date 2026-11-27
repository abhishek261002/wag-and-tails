<?php
/**
 * Customer directory (view and edit for booking staff and admin), customers editing their own details,
 * and login with a one-time code sent on WhatsApp.
 *
 * A customer is a mobile number. Their details come from their latest booking, their website account and any
 * imported record; anything saved here (a "profile") takes priority and is used to fill new bookings.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/* ---------- profiles ---------- */

function wt_profile_ref( $phone ) {
	return 'CP-' . wt_phone( $phone );
}

function wt_profile_get( $phone ) {
	$p = wt_rec_get( 'cprof', wt_profile_ref( $phone ) );
	return is_array( $p ) ? $p : null;
}

function wt_clean_pets( $pets ) {
	$out = array();
	foreach ( array_slice( (array) $pets, 0, 10 ) as $p ) {
		if ( ! is_array( $p ) ) {
			continue;
		}
		$pet = array(
			'name'       => mb_substr( sanitize_text_field( (string) ( $p['name'] ?? '' ) ), 0, 40 ),
			'type'       => 'Cat' === ( $p['type'] ?? '' ) ? 'Cat' : 'Dog',
			'breed'      => mb_substr( sanitize_text_field( (string) ( $p['breed'] ?? '' ) ), 0, 60 ),
			'gender'     => 'Female' === ( $p['gender'] ?? '' ) ? 'Female' : 'Male',
			'age'        => mb_substr( sanitize_text_field( (string) ( $p['age'] ?? '' ) ), 0, 20 ),
			'aggression' => mb_substr( sanitize_text_field( (string) ( $p['aggression'] ?? '' ) ), 0, 60 ),
		);
		if ( $pet['name'] || $pet['breed'] ) {
			$out[] = $pet;
		}
	}
	return $out;
}

/** Everything we know about each customer, keyed by mobile number. Cached for the request. */
function wt_customer_index() {
	static $idx = null;
	if ( null !== $idx ) {
		return $idx;
	}
	$idx = array();
	$add = function ( $p ) use ( &$idx ) {
		if ( ! isset( $idx[ $p ] ) ) {
			$idx[ $p ] = array( 'phone' => $p, 'name' => '', 'email' => '', 'address' => '', 'pincode' => '', 'city' => '', 'pets' => array(), 'bookings' => 0, 'spent' => 0, 'last' => '', 'registered' => false, 'source' => '', 'lat' => null, 'lng' => null, 'mapLink' => '', 'locDate' => '' );
		}
	};
	foreach ( wt_all_bookings() as $b ) {
		$p = wt_phone( $b['phone'] ?? '' );
		if ( strlen( $p ) !== 10 ) {
			continue;
		}
		$add( $p );
		$c = &$idx[ $p ];
		if ( wt_is_sale( $b ) ) {
			++$c['bookings'];
			$c['spent'] += (float) ( $b['total'] ?? 0 );
		}
		$d = (string) ( $b['date'] ?? '' );
		if ( $d >= $c['last'] ) {
			$c['last'] = $d;
			foreach ( array( 'name', 'email', 'address', 'pincode', 'city' ) as $k ) {
				if ( ! empty( $b[ $k ] ) ) {
					$c[ $k ] = $b[ $k ];
				}
			}
		}
		$loc = wt_booking_loc( $b );
		if ( $loc && $d >= $c['locDate'] ) {
			$c['lat']     = $loc['lat'];
			$c['lng']     = $loc['lng'];
			$c['mapLink'] = $loc['mapLink'];
			$c['locDate'] = $d;
		}
		if ( ! empty( $b['breed'] ) || ! empty( $b['petName'] ) ) {
			$key = strtolower( ( $b['petName'] ?? '' ) . '|' . ( $b['breed'] ?? '' ) );
			if ( ! isset( $c['pets'][ $key ] ) ) {
				$c['pets'][ $key ] = array( 'name' => $b['petName'] ?? '', 'type' => $b['petType'] ?? 'Dog', 'breed' => $b['breed'] ?? '', 'gender' => $b['gender'] ?? '', 'age' => $b['age'] ?? '', 'aggression' => $b['aggression'] ?? '' );
			}
		}
		unset( $c );
	}
	foreach ( wt_rec_list( 'customer', array(), 'id DESC', 20000 ) as $r ) {
		$p = wt_phone( $r['phone'] ?? '' );
		if ( strlen( $p ) !== 10 ) {
			continue;
		}
		$add( $p );
		foreach ( array( 'name', 'email', 'address', 'pincode', 'city' ) as $k ) {
			if ( empty( $idx[ $p ][ $k ] ) && ! empty( $r[ $k ] ) ) {
				$idx[ $p ][ $k ] = $r[ $k ];
			}
		}
		if ( empty( $idx[ $p ]['source'] ) && ! empty( $r['source'] ) ) {
			$idx[ $p ]['source'] = $r['source'];
		}
	}
	foreach ( get_users( array( 'meta_key' => 'wt_phone', 'meta_compare' => 'EXISTS', 'number' => 5000 ) ) as $u ) { // phpcs:ignore
		$p = wt_phone( get_user_meta( $u->ID, 'wt_phone', true ) );
		if ( strlen( $p ) !== 10 ) {
			continue;
		}
		$add( $p );
		$idx[ $p ]['registered'] = true;
		$idx[ $p ]['name']       = $idx[ $p ]['name'] ? $idx[ $p ]['name'] : $u->display_name;
		$idx[ $p ]['email']      = $idx[ $p ]['email'] ? $idx[ $p ]['email'] : $u->user_email;
	}
	foreach ( wt_rec_list( 'cprof', array(), 'id DESC', 20000 ) as $pr ) {
		$p = wt_phone( $pr['phone'] ?? '' );
		if ( strlen( $p ) !== 10 ) {
			continue;
		}
		$add( $p );
		foreach ( array( 'name', 'email', 'address', 'pincode', 'city', 'altPhone', 'notes', 'editedBy', 'editedAt', 'mapLink' ) as $k ) {
			if ( isset( $pr[ $k ] ) && '' !== $pr[ $k ] ) {
				$idx[ $p ][ $k ] = $pr[ $k ];
			}
		}
		if ( ! empty( $pr['pets'] ) ) {
			$idx[ $p ]['pets'] = $pr['pets'];
		}
		if ( isset( $pr['lat'], $pr['lng'] ) && is_numeric( $pr['lat'] ) ) {
			$idx[ $p ]['lat'] = (float) $pr['lat'];
			$idx[ $p ]['lng'] = (float) $pr['lng'];
		}
		$idx[ $p ]['profile'] = true;
	}
	foreach ( $idx as &$c ) {
		$c['pets'] = array_values( $c['pets'] );
	}
	unset( $c );
	return $idx;
}

/**
 * A booking's location: the pinned point, or the coordinates inside a shared Google Maps link.
 *
 * @return array|null lat, lng (may be null when only a short link was shared) and mapLink.
 */
function wt_booking_loc( $b ) {
	$lat  = isset( $b['lat'] ) && is_numeric( $b['lat'] ) ? (float) $b['lat'] : null;
	$lng  = isset( $b['lng'] ) && is_numeric( $b['lng'] ) ? (float) $b['lng'] : null;
	$link = (string) ( $b['mapLink'] ?? '' );
	if ( null === $lat && $link && preg_match( '/(?:[?&](?:q|query|ll)=|@)(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/', rawurldecode( $link ), $m ) ) {
		$lat = (float) $m[1];
		$lng = (float) $m[2];
	}
	if ( null === $lat && ! $link ) {
		return null;
	}
	if ( ! $link && null !== $lat ) {
		$link = 'https://www.google.com/maps?q=' . $lat . ',' . $lng;
	}
	return array( 'lat' => $lat, 'lng' => $lng, 'mapLink' => $link );
}

function wt_customer( $phone ) {
	$idx = wt_customer_index();
	$p   = wt_phone( $phone );
	return $idx[ $p ] ?? null;
}

/** Save edits. $who is 'staff' or 'self'; only staff may save internal notes. */
function wt_profile_save( $phone, $in, $who ) {
	$phone = wt_phone( $phone );
	if ( ! wt_valid_mobile( $phone ) ) {
		return wt_err( 'Not a valid mobile number.' );
	}
	$name  = mb_substr( sanitize_text_field( (string) ( $in['name'] ?? '' ) ), 0, 80 );
	$email = sanitize_email( $in['email'] ?? '' );
	if ( mb_strlen( $name ) < 2 ) {
		return wt_err( 'Enter the full name.' );
	}
	if ( '' !== (string) ( $in['email'] ?? '' ) && ! is_email( $email ) ) {
		return wt_err( 'The email address looks wrong.' );
	}
	$pin = preg_replace( '/\D/', '', (string) ( $in['pincode'] ?? '' ) );
	if ( $pin && strlen( $pin ) !== 6 ) {
		return wt_err( 'Pincode must be 6 digits.' );
	}
	$old = wt_profile_get( $phone );
	$rec = is_array( $old ) ? $old : array( 'id' => wt_profile_ref( $phone ) );
	$rec = array_merge(
		$rec,
		array(
			'id'       => wt_profile_ref( $phone ),
			'phone'    => $phone,
			'name'     => $name,
			'email'    => $email,
			'address'  => mb_substr( sanitize_textarea_field( (string) ( $in['address'] ?? '' ) ), 0, 400 ),
			'pincode'  => $pin,
			'city'     => wt_city( (string) ( $in['city'] ?? '' ) ) ? $in['city'] : '',
			'pets'     => wt_clean_pets( $in['pets'] ?? array() ),
			'editedBy' => 'self' === $who ? 'Customer' : wt_desk_name(),
			'editedAt' => wt_now_label(),
		)
	);
	if ( 'staff' === $who ) {
		$rec['altPhone'] = wt_phone( $in['altPhone'] ?? '' );
		$rec['notes']    = mb_substr( sanitize_textarea_field( (string) ( $in['notes'] ?? '' ) ), 0, 1000 );
	}
	if ( $old ) {
		wt_rec_save( 'cprof', $rec );
	} else {
		wt_rec_insert( 'cprof', $rec, 'CP' );
	}
	// Keep the website account in step.
	$u = wt_user_by_phone( $phone );
	if ( $u ) {
		$args = array( 'ID' => $u->ID, 'display_name' => $name, 'first_name' => explode( ' ', $name )[0] );
		if ( $email && strtolower( $email ) !== strtolower( $u->user_email ) ) {
			$other = email_exists( $email );
			if ( $other && (int) $other !== (int) $u->ID ) {
				return wt_err( 'That email is already used by another account.' );
			}
			$args['user_email'] = $email;
		}
		wp_update_user( $args );
		update_user_meta( $u->ID, 'billing_first_name', explode( ' ', $name )[0] );
		if ( $rec['address'] ) {
			update_user_meta( $u->ID, 'billing_address_1', $rec['address'] );
		}
		if ( $pin ) {
			update_user_meta( $u->ID, 'billing_postcode', $pin );
		}
	}
	return $rec;
}

/* ---------- staff/admin directory ---------- */

function wt_api_clients( $in ) {
	$q     = mb_strtolower( trim( sanitize_text_field( (string) ( $in['q'] ?? '' ) ) ) );
	$city  = wt_scope_city( sanitize_text_field( $in['city'] ?? 'all' ) );
	$page  = max( 1, (int) ( $in['page'] ?? 1 ) );
	$sort  = sanitize_key( $in['sort'] ?? 'last' );
	$list  = array();
	$qd    = preg_replace( '/\D/', '', $q );
	foreach ( wt_customer_index() as $c ) {
		if ( 'all' !== $city && $c['city'] !== $city ) {
			continue;
		}
		if ( $q ) {
			$hay = mb_strtolower( $c['name'] . ' ' . $c['email'] . ' ' . implode( ' ', array_column( $c['pets'], 'name' ) ) . ' ' . implode( ' ', array_column( $c['pets'], 'breed' ) ) );
			if ( false === mb_strpos( $hay, $q ) && ( ! $qd || strlen( $qd ) < 3 || false === strpos( $c['phone'] . ( $c['altPhone'] ?? '' ), $qd ) ) ) {
				continue;
			}
		}
		$list[] = $c;
	}
	usort(
		$list,
		function ( $a, $b ) use ( $sort ) {
			if ( 'name' === $sort ) {
				return strcasecmp( $a['name'], $b['name'] );
			}
			if ( 'spent' === $sort ) {
				return $b['spent'] <=> $a['spent'];
			}
			return strcmp( $b['last'], $a['last'] );
		}
	);
	$per = 40;
	return array(
		'total' => count( $list ),
		'page'  => $page,
		'pages' => max( 1, (int) ceil( count( $list ) / $per ) ),
		'list'  => array_slice( $list, ( $page - 1 ) * $per, $per ),
	);
}

function wt_api_client_get( $in ) {
	$c = wt_customer( $in['phone'] ?? '' );
	if ( ! $c ) {
		return wt_err( 'Customer not found.', 'wt_404', 404 );
	}
	$scope = wt_desk_city();
	if ( 'all' !== $scope && $c['city'] && $c['city'] !== $scope ) {
		return wt_err( 'This customer is in another city.', 'wt_forbidden', 403 );
	}
	$c['points']   = wt_points_balance( $c['phone'] );
	$c['history']  = array_map( 'wt_booking_for_client', wt_rec_list( 'booking', array( 'phone' => $c['phone'] ), 'skey DESC', 30 ) );
	return array( 'customer' => $c );
}

function wt_api_client_save( $in ) {
	$c = wt_customer( $in['phone'] ?? '' );
	if ( $c ) {
		$scope = wt_desk_city();
		if ( 'all' !== $scope && $c['city'] && $c['city'] !== $scope ) {
			return wt_err( 'This customer is in another city.', 'wt_forbidden', 403 );
		}
	}
	$r = wt_profile_save( $in['phone'] ?? '', $in, 'staff' );
	if ( is_wp_error( $r ) ) {
		return $r;
	}
	return array( 'ok' => true, 'profile' => $r );
}

/** Booking desk: fill a new booking from what we know about this number. */
function wt_api_desk_customer( $in ) {
	$c = wt_customer( $in['phone'] ?? '' );
	return array( 'customer' => $c ? wt_desk_customer_view( $c ) : null );
}

function wt_desk_customer_view( $c ) {
	$v             = array_intersect_key( $c, array_flip( array( 'phone', 'name', 'email', 'address', 'pincode', 'city', 'pets', 'notes', 'bookings', 'last', 'lat', 'lng', 'mapLink' ) ) );
	$v['cityName'] = $c['city'] ? wt_city_name( $c['city'] ) : '';
	return $v;
}

/** Booking desk: find customers by part of their name or mobile number. */
function wt_api_desk_customer_search( $in ) {
	$q  = mb_strtolower( trim( sanitize_text_field( (string) ( $in['q'] ?? '' ) ) ) );
	$qd = preg_replace( '/\D/', '', $q );
	$by_phone = strlen( $qd ) >= 3 && ! preg_match( '/\p{L}/u', $q );
	if ( ! $by_phone && mb_strlen( $q ) < 2 ) {
		return array( 'list' => array() );
	}
	$scope = wt_desk_city();
	$hits  = array();
	foreach ( wt_customer_index() as $c ) {
		if ( 'all' !== $scope && $c['city'] && $c['city'] !== $scope ) {
			continue;
		}
		$score = 0;
		if ( $by_phone ) {
			if ( 0 === strpos( $c['phone'], $qd ) ) {
				$score = 3;
			} elseif ( false !== strpos( $c['phone'], $qd ) || ( ! empty( $c['altPhone'] ) && false !== strpos( $c['altPhone'], $qd ) ) ) {
				$score = 2;
			}
		} else {
			$n = mb_strtolower( (string) $c['name'] );
			if ( '' === $n ) {
				continue;
			}
			if ( 0 === strpos( $n, $q ) ) {
				$score = 3;
			} elseif ( preg_match( '/\b' . preg_quote( $q, '/' ) . '/u', $n ) ) {
				$score = 2;
			} elseif ( false !== mb_strpos( $n, $q ) ) {
				$score = 1;
			} else {
				foreach ( (array) $c['pets'] as $pet ) {
					if ( ! empty( $pet['name'] ) && 0 === mb_strpos( mb_strtolower( $pet['name'] ), $q ) ) {
						$score = 1;
						break;
					}
				}
			}
		}
		if ( $score ) {
			$hits[] = array( $score, $c['bookings'], $c['last'], $c );
		}
	}
	usort(
		$hits,
		function ( $a, $b ) {
			return array( $b[0], $b[1], $b[2] ) <=> array( $a[0], $a[1], $a[2] );
		}
	);
	return array( 'list' => array_map( function ( $h ) { return wt_desk_customer_view( $h[3] ); }, array_slice( $hits, 0, 8 ) ) ); // phpcs:ignore
}

/* ---------- customer: own details ---------- */

function wt_api_me_profile( $in ) {
	$phone = wt_user_phone( get_current_user_id() );
	if ( ! $phone ) {
		return wt_err( 'Your account has no mobile number. Contact us to add it.' );
	}
	$r = wt_profile_save( $phone, $in, 'self' );
	if ( is_wp_error( $r ) ) {
		return $r;
	}
	return array( 'ok' => true, 'profile' => wt_profile_public( $phone ) );
}

/** What a customer sees and can edit about themselves. */
function wt_profile_public( $phone ) {
	$c = wt_customer( $phone );
	if ( ! $c ) {
		return null;
	}
	return array_intersect_key( $c, array_flip( array( 'phone', 'name', 'email', 'address', 'pincode', 'city', 'pets', 'lat', 'lng', 'mapLink' ) ) );
}

/* ---------- login with WhatsApp code ---------- */

function wt_otp_ip() {
	return preg_replace( '/[^0-9a-fA-F:.]/', '', (string) ( $_SERVER['REMOTE_ADDR'] ?? '' ) ); // phpcs:ignore
}

/** Count requests in a time window; false when over the limit. */
function wt_rate_ok( $key, $limit, $window ) {
	$k   = 'wt_rl_' . md5( $key );
	$now = time();
	$hit = array_filter(
		(array) get_transient( $k ),
		function ( $t ) use ( $now, $window ) {
			return $t > $now - $window;
		}
	);
	if ( count( $hit ) >= $limit ) {
		return false;
	}
	$hit[] = $now;
	set_transient( $k, array_values( $hit ), $window );
	return true;
}

function wt_send_otp_whatsapp( $phone, $code ) {
	$s   = wt_config()['settings'];
	$tpl = trim( (string) ( $s['waTemplates']['otp'] ?? '' ) );
	if ( 'cloud' !== $s['waMode'] || ! $tpl || ! $s['waPhoneId'] || ! $s['waToken'] ) {
		return wt_err( 'Login with a code is not ready yet. Please sign in with your password or call us.' );
	}
	$res = wp_remote_post(
		'https://graph.facebook.com/v23.0/' . rawurlencode( $s['waPhoneId'] ) . '/messages',
		array(
			'timeout' => 12,
			'headers' => array( 'Authorization' => 'Bearer ' . $s['waToken'], 'Content-Type' => 'application/json' ),
			'body'    => wp_json_encode(
				array(
					'messaging_product' => 'whatsapp',
					'to'                => '91' . $phone,
					'type'              => 'template',
					'template'          => array(
						'name'       => $tpl,
						'language'   => array( 'code' => $s['waLang'] ? $s['waLang'] : 'en' ),
						'components' => array(
							array( 'type' => 'body', 'parameters' => array( array( 'type' => 'text', 'text' => $code ) ) ),
							array( 'type' => 'button', 'sub_type' => 'url', 'index' => '0', 'parameters' => array( array( 'type' => 'text', 'text' => $code ) ) ),
						),
					),
				)
			),
		)
	);
	$result = wt_http_result( $res );
	$wamid  = '';
	if ( ! is_wp_error( $res ) ) {
		$rb    = json_decode( wp_remote_retrieve_body( $res ), true );
		$wamid = (string) ( $rb['messages'][0]['id'] ?? '' );
	}
	// The code itself is never written to the log.
	wt_log_notif( 'WhatsApp', '91' . $phone, 'Login code', 'Login code sent', 'Sent' === $result ? 'Accepted by WhatsApp (waiting for delivery report)' : $result, $wamid );
	if ( 'Sent' !== $result ) {
		return wt_err( 'We could not send the code on WhatsApp. Check the number, or sign in with your password.' );
	}
	return true;
}

function wt_api_otp_send( $in ) {
	$phone = wt_phone( $in['phone'] ?? '' );
	if ( ! wt_valid_mobile( $phone ) ) {
		return wt_err( 'Enter your 10-digit mobile number.' );
	}
	if ( ! wt_rate_ok( 'otp-ip-' . wt_otp_ip(), 12, HOUR_IN_SECONDS ) || ! wt_rate_ok( 'otp-ph-' . $phone, 4, 15 * MINUTE_IN_SECONDS ) ) {
		return wt_err( 'Too many codes requested. Please wait a few minutes and try again.', 'wt_rate', 429 );
	}
	$code = (string) wp_rand( 100000, 999999 );
	$sent = wt_send_otp_whatsapp( $phone, $code );
	if ( is_wp_error( $sent ) ) {
		return $sent;
	}
	set_transient( 'wt_otp_' . $phone, array( 'h' => wp_hash_password( $code ), 'exp' => time() + 10 * MINUTE_IN_SECONDS, 'tries' => 0 ), 10 * MINUTE_IN_SECONDS );
	$known = (bool) wt_user_by_phone( $phone ) || (bool) wt_customer( $phone );
	return array( 'ok' => true, 'known' => $known, 'name' => $known ? ( wt_customer( $phone )['name'] ?? '' ) : '' );
}

function wt_api_otp_verify( $in ) {
	$phone = wt_phone( $in['phone'] ?? '' );
	$code  = preg_replace( '/\D/', '', (string) ( $in['code'] ?? '' ) );
	$o     = get_transient( 'wt_otp_' . $phone );
	if ( ! $o || time() > $o['exp'] ) {
		return wt_err( 'This code has expired. Ask for a new one.' );
	}
	if ( $o['tries'] >= 5 ) {
		delete_transient( 'wt_otp_' . $phone );
		return wt_err( 'Too many wrong tries. Ask for a new code.' );
	}
	if ( strlen( $code ) !== 6 || ! wp_check_password( $code, $o['h'] ) ) {
		++$o['tries'];
		set_transient( 'wt_otp_' . $phone, $o, max( 60, $o['exp'] - time() ) );
		return wt_err( 'That code is not right. Check WhatsApp and try again.' );
	}
	$u = wt_user_by_phone( $phone );
	if ( ! $u ) {
		$u = get_user_by( 'login', $phone );
	}
	if ( $u && ( user_can( $u, 'manage_options' ) || user_can( $u, 'wt_desk' ) ) ) {
		return wt_err( 'Staff and admin accounts sign in with their password.' );
	}
	if ( ! $u ) {
		// First time: make the account from what we already know about this number.
		$c    = wt_customer( $phone );
		$name = trim( (string) ( $in['name'] ?? '' ) );
		$name = $name ? sanitize_text_field( $name ) : ( $c['name'] ?? '' );
		if ( mb_strlen( $name ) < 2 ) {
			return array( 'needName' => true );
		}
		$email = $c && ! empty( $c['email'] ) && ! email_exists( $c['email'] ) ? $c['email'] : '';
		$role  = get_role( 'customer' ) ? 'customer' : get_option( 'default_role', 'subscriber' );
		$parts = explode( ' ', $name, 2 );
		$uid   = wp_insert_user(
			array(
				'user_login'   => $phone,
				'user_pass'    => wp_generate_password( 24 ),
				'user_email'   => $email,
				'display_name' => $name,
				'first_name'   => $parts[0],
				'last_name'    => $parts[1] ?? '',
				'role'         => $role,
			)
		);
		if ( is_wp_error( $uid ) ) {
			return wt_err( $uid->get_error_message() );
		}
		update_user_meta( $uid, 'wt_phone', $phone );
		update_user_meta( $uid, 'billing_phone', $phone );
		$r = wt_config()['rewards'];
		if ( ! empty( $r['enabled'] ) && $r['signupBonus'] > 0 ) {
			wt_points_add( $phone, $r['signupBonus'], 'Welcome bonus', '' );
		}
		$u = get_user_by( 'id', $uid );
	} elseif ( ! get_user_meta( $u->ID, 'wt_phone', true ) ) {
		update_user_meta( $u->ID, 'wt_phone', $phone );
	}
	delete_transient( 'wt_otp_' . $phone );
	wp_set_current_user( $u->ID );
	wp_set_auth_cookie( $u->ID, true, is_ssl() );
	return array( 'ok' => true, 'role' => 'customer' );
}

/* ---------- routes ---------- */

function wt_can_customer() {
	return is_user_logged_in() && ! current_user_can( 'wt_desk' ) && ! current_user_can( 'manage_options' );
}

add_action(
	'rest_api_init',
	function () {
		$staff  = function () {
			return current_user_can( 'manage_options' ) || ( current_user_can( 'wt_desk' ) && wt_can_desk() === true );
		};
		$routes = array(
			array( 'GET', 'clients', $staff, 'wt_api_clients' ),
			array( 'GET', 'clients/(?P<phone>\d{10})', $staff, 'wt_api_client_get' ),
			array( 'POST', 'clients/(?P<phone>\d{10})', $staff, 'wt_api_client_save' ),
			array( 'GET', 'desk/customer', $staff, 'wt_api_desk_customer' ),
			array( 'GET', 'desk/customers/search', $staff, 'wt_api_desk_customer_search' ),
			array( 'POST', 'me/profile', 'wt_can_customer', 'wt_api_me_profile' ),
			array( 'POST', 'otp/send', '__return_true', 'wt_api_otp_send' ),
			array( 'POST', 'otp/verify', '__return_true', 'wt_api_otp_verify' ),
		);
		foreach ( $routes as $rt ) {
			register_rest_route( 'wt/v1', '/' . $rt[1], array( 'methods' => $rt[0], 'permission_callback' => $rt[2], 'callback' => wt_rest( $rt[3] ) ) );
		}
	}
);

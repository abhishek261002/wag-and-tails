<?php
/**
 * Connector: the link between this plugin and the Wag & Tails apps' backend (customer app, partner app).
 *
 * Inbound  /wp-json/wt/v1/connector/...  Signed server-to-server calls from the backend: read the business config and
 *          slots, read changed bookings and customers, create app bookings, push partner/job progress, complete,
 *          cancel or reschedule a booking, move reward points, submit leads.
 * Outbound After any booking, customer profile or lead changes, a small signed "something changed" message is sent to
 *          the backend (WT_CONNECTOR_URL), queued and retried, so the apps see website and desk changes quickly.
 *          The backend also polls connector/changes as a safety net.
 *
 * Signing: HMAC-SHA256 with WT_CONNECTOR_SECRET (defined in wp-config.php, never stored in the database) over
 *          "timestamp \n nonce \n METHOD \n /route \n body". Calls older than 5 minutes or reusing a nonce are refused.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const WT_CONN_SKEW      = 300;  // seconds a signed call stays valid
const WT_CONN_MAX_TRIES = 8;    // outgoing event attempts before giving up (the backend's polling still catches up)
const WT_CONN_TYPES     = array( 'booking', 'cprof', 'insurance', 'complaint', 'enquiry', 'walk', 'tomb' );

function wt_conn_secret() {
	return defined( 'WT_CONNECTOR_SECRET' ) ? (string) WT_CONNECTOR_SECRET : '';
}

function wt_conn_sign( $ts, $nonce, $method, $route, $body ) {
	return hash_hmac( 'sha256', $ts . "\n" . $nonce . "\n" . strtoupper( $method ) . "\n" . $route . "\n" . $body, wt_conn_secret() );
}

/** permission_callback for every connector route. */
function wt_conn_auth( WP_REST_Request $r ) {
	if ( '' === wt_conn_secret() ) {
		return new WP_Error( 'wt_conn_off', 'Connector is not configured.', array( 'status' => 503 ) );
	}
	$ts    = (string) $r->get_header( 'x_wt_timestamp' );
	$nonce = (string) $r->get_header( 'x_wt_nonce' );
	$sig   = (string) $r->get_header( 'x_wt_signature' );
	if ( ! ctype_digit( $ts ) || abs( time() - (int) $ts ) > WT_CONN_SKEW || ! preg_match( '/^[A-Za-z0-9_-]{16,64}$/', $nonce ) || '' === $sig ) {
		return new WP_Error( 'wt_conn_auth', 'Unsigned or expired request.', array( 'status' => 401 ) );
	}
	$route = '/' . ltrim( (string) $r->get_route(), '/' );
	$query = $r->get_query_params();
	if ( $query ) {
		ksort( $query );
		$route .= '?' . http_build_query( $query );
	}
	$exp = wt_conn_sign( $ts, $nonce, $r->get_method(), $route, (string) $r->get_body() );
	if ( ! hash_equals( $exp, $sig ) ) {
		return new WP_Error( 'wt_conn_auth', 'Bad signature.', array( 'status' => 401 ) );
	}
	$key = 'wt_conn_n_' . md5( $nonce );
	if ( get_transient( $key ) ) {
		return new WP_Error( 'wt_conn_auth', 'Request already used.', array( 'status' => 401 ) );
	}
	set_transient( $key, 1, 2 * WT_CONN_SKEW );
	return true;
}

/** Run a desk function as the apps (shows as "App", "App · Ritika" etc. in logs and on the desk card). */
function wt_conn_as( $actor, $fn ) {
	$prev                 = $GLOBALS['wt_actor'] ?? null;
	$GLOBALS['wt_actor']  = $actor;
	$GLOBALS['wt_conn_in'] = true;
	try {
		return $fn();
	} finally {
		$GLOBALS['wt_actor']   = $prev;
		$GLOBALS['wt_conn_in'] = false;
	}
}

/** Map of app job ids to booking refs, so creating the same app booking twice returns the first one. */
function wt_conn_xref_get( $key ) {
	$x = wt_rec_get( 'xref', 'X-' . substr( preg_replace( '/[^A-Za-z0-9\-]/', '', (string) $key ), 0, 36 ) );
	return $x ? $x['to'] : null;
}
function wt_conn_xref_set( $key, $to ) {
	wt_rec_insert( 'xref', array( 'id' => 'X-' . substr( preg_replace( '/[^A-Za-z0-9\-]/', '', (string) $key ), 0, 36 ), 'to' => $to ), 'X' );
}

/**
 * Run an idempotent write one at a time per key. Two identical requests that overlap (a retry while the first is still
 * running, a double tap) would both pass the "already done?" check and both write: a duplicate booking, or points
 * credited twice. The second now waits for the first, then finds its result and returns it.
 */
function wt_conn_locked( $key, $fn ) {
	global $wpdb;
	$name = 'wt_conn_' . md5( (string) $key );
	if ( 1 !== (int) $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK( %s, 25 )', $name ) ) ) { // phpcs:ignore
		return wt_err( 'The website is busy with the same request. Please try again in a moment.', 'wt_busy', 503 );
	}
	try {
		return $fn();
	} finally {
		$wpdb->query( $wpdb->prepare( 'SELECT RELEASE_LOCK( %s )', $name ) ); // phpcs:ignore
	}
}

/** A booking as the backend sees it: everything, plus revision and last-changed time. */
function wt_conn_booking_out( $b ) {
	unset( $b['rzpOrder'] );
	return $b;
}

/* ===================== reads ===================== */

function wt_conn_config() {
	$c = wt_config();
	$s = $c['settings'];
	return array(
		'cities'    => $c['cities'],
		'packages'  => $c['packages'],
		'breeds'    => $c['breeds'],
		'walkPlans' => $c['walkPlans'],
		'coupons'   => array_values( array_filter( $c['coupons'], function ( $cp ) { return ! empty( $cp['active'] ); } ) ),
		'rewards'   => $c['rewards'],
		'insFields' => $c['insFields'],
		'aggression' => WT_AGGRESSION,
		'settings'  => array(
			'dayStart' => $s['dayStart'], 'dayEnd' => $s['dayEnd'], 'slotStep' => (int) $s['slotStep'], 'bufferMins' => (int) $s['bufferMins'],
			'leadMins' => (int) $s['leadMins'], 'maxDaysAhead' => (int) $s['maxDaysAhead'], 'razorpayKey' => $s['razorpayKey'],
			'timezone' => wp_timezone_string(),
		),
		'blockedDays' => wt_blocked_days(),
		'apps'      => wt_apps_settings( $s ),
		'version'   => WT_VER,
	);
}

function wt_conn_slots( $in ) {
	$cfg  = wt_config();
	$mins = ! empty( $in['mins'] ) ? min( 600, max( 15, (int) $in['mins'] ) ) : wt_pkg_mins( wt_find( $cfg['packages'], 'id', sanitize_text_field( $in['pkg'] ?? '' ) ) );
	return array(
		'slots' => wt_day_slots( sanitize_text_field( $in['city'] ?? '' ), sanitize_text_field( $in['date'] ?? '' ), $mins, sanitize_text_field( $in['ref'] ?? '' ) ),
		'mins'  => $mins,
	);
}

/** Records changed after a point in time, oldest first, for the backend's catch-up polling. */
function wt_conn_changes( $in ) {
	global $wpdb;
	$t     = wt_table();
	$since = preg_match( '/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', (string) ( $in['since'] ?? '' ) ) ? $in['since'] : '1970-01-01 00:00:00';
	$after = (int) ( $in['afterId'] ?? 0 );
	$limit = min( 500, max( 1, (int) ( $in['limit'] ?? 200 ) ) );
	$types = "'" . implode( "','", WT_CONN_TYPES ) . "'";
	$rows  = $wpdb->get_results( $wpdb->prepare( "SELECT id, type, ref, rev, updated_at, data FROM $t WHERE type IN ($types) AND ( updated_at > %s OR ( updated_at = %s AND id > %d ) ) ORDER BY updated_at ASC, id ASC LIMIT %d", $since, $since, $after, $limit ), ARRAY_A ); // phpcs:ignore
	$out   = array();
	foreach ( $rows as $r ) {
		$d    = json_decode( $r['data'], true );
		$out[] = array( 'rowId' => (int) $r['id'], 'type' => $r['type'], 'ref' => $r['ref'], 'rev' => (int) $r['rev'], 'updatedAt' => $r['updated_at'], 'data' => 'booking' === $r['type'] ? wt_conn_booking_out( $d ) : $d );
	}
	return array( 'list' => $out, 'more' => count( $out ) === $limit );
}

function wt_conn_get_booking( $in ) {
	$b = wt_rec_get( 'booking', sanitize_text_field( $in['ref'] ?? '' ) );
	return $b ? array( 'booking' => wt_conn_booking_out( $b ) ) : wt_err( 'Booking not found.', 'wt_404', 404 );
}

function wt_conn_customer( $in ) {
	$phone = wt_phone( $in['phone'] ?? '' );
	if ( ! wt_valid_mobile( $phone ) ) {
		return wt_err( 'Enter a valid 10-digit mobile number.' );
	}
	$c = wt_customer( $phone );
	return array(
		'customer' => $c,
		'points'   => wt_points_balance( $phone ),
		'ledger'   => wt_rec_list( 'points', array( 'phone' => $phone ), 'id DESC', 100 ),
		'bookings' => array_map( 'wt_conn_booking_out', wt_rec_list( 'booking', array( 'phone' => $phone ), 'skey DESC', 100 ) ),
	);
}

/**
 * Price an app booking exactly as the website would (city price, coupon, points), without booking anything.
 * extras: priced add-ons from the app [{name, price}].
 */
function wt_conn_quote( $in ) {
	$b = array(
		'city'    => wt_str( $in, 'city', 60 ),
		'pkg'     => wt_str( $in, 'pkg', 40 ),
		'petType' => 'Cat' === ( $in['petType'] ?? '' ) ? 'Cat' : 'Dog',
		'coupon'  => strtoupper( wt_str( $in, 'coupon', 30 ) ),
		'usePts'  => ! empty( $in['usePts'] ),
	);
	$phone = wt_phone( $in['phone'] ?? '' );
	$q     = wt_booking_quote( $b, $b['usePts'] && wt_valid_mobile( $phone ) ? $phone : null );
	if ( is_wp_error( $q ) ) {
		return $q;
	}
	$extra = 0;
	foreach ( array_slice( (array) ( $in['extras'] ?? array() ), 0, 10 ) as $x ) {
		$extra += max( 0, (float) ( $x['price'] ?? 0 ) );
	}
	$q['subtotal'] += $extra;
	$q['total']    += $extra;
	$q['points']    = wt_valid_mobile( $phone ) ? wt_points_balance( $phone ) : 0;
	unset( $q['addons'] );
	return array( 'quote' => $q );
}

/* ===================== writes ===================== */

/**
 * A booking made in the customer app. The price is worked out here, from this site's packages, city prices,
 * coupons and points, so the app and the website always charge the same. The slot must be free (same rules as
 * the website). Repeating the call with the same jobId returns the booking made the first time.
 */
function wt_conn_create_booking( $in ) {
	return wt_conn_locked( 'B' . sanitize_text_field( $in['jobId'] ?? '' ), function () use ( $in ) {
		// One at a time per city and day: "is the slot free?" and "save the booking" must not interleave, or
		// simultaneous requests all see the last place as free.
		return wt_conn_locked( wt_slot_lock_key( $in['city'] ?? '', $in['date'] ?? '' ), function () use ( $in ) {
			return wt_conn_create_booking_run( $in );
		} );
	} );
}

function wt_slot_lock_key( $city, $date ) {
	return 'S' . sanitize_text_field( (string) $city ) . '|' . sanitize_text_field( (string) $date );
}

/** The website's own booking form and the desk's add-booking, with the same per-city-per-day lock. */
function wt_create_web_booking_locked( $in ) {
	return wt_conn_locked( wt_slot_lock_key( $in['city'] ?? '', $in['date'] ?? '' ), function () use ( $in ) {
		return wt_create_web_booking( $in );
	} );
}
function wt_desk_add_locked( $in ) {
	return wt_conn_locked( wt_slot_lock_key( $in['city'] ?? '', $in['date'] ?? '' ), function () use ( $in ) {
		return wt_desk_add( $in );
	} );
}

function wt_conn_create_booking_run( $in ) {
	$job = sanitize_text_field( $in['jobId'] ?? '' );
	if ( ! preg_match( '/^[A-Za-z0-9\-]{8,36}$/', $job ) ) {
		return wt_err( 'jobId is required.' );
	}
	$have = wt_conn_xref_get( $job );
	if ( $have && ( $b = wt_rec_get( 'booking', $have ) ) ) {
		return array( 'booking' => wt_conn_booking_out( $b ), 'repeat' => true );
	}
	$b = array(
		'city'       => wt_str( $in, 'city', 60 ),
		'pkg'        => wt_str( $in, 'pkg', 40 ),
		'petType'    => 'Cat' === ( $in['petType'] ?? '' ) ? 'Cat' : 'Dog',
		'petName'    => wt_str( $in, 'petName', 40 ),
		'breed'      => wt_str( $in, 'breed', 60 ),
		'gender'     => 'Female' === ( $in['gender'] ?? '' ) ? 'Female' : 'Male',
		'age'        => wt_str( $in, 'age', 20 ),
		'aggression' => in_array( $in['aggression'] ?? '', WT_AGGRESSION, true ) ? $in['aggression'] : WT_AGGRESSION[0],
		'name'       => wt_str( $in, 'name', 80 ),
		'email'      => sanitize_email( $in['email'] ?? '' ),
		'phone'      => wt_phone( $in['phone'] ?? '' ),
		'address'    => mb_substr( sanitize_textarea_field( (string) ( $in['address'] ?? '' ) ), 0, 400 ),
		'pincode'    => wt_str( $in, 'pincode', 6 ),
		'lat'        => isset( $in['lat'] ) && is_numeric( $in['lat'] ) ? round( (float) $in['lat'], 6 ) : null,
		'lng'        => isset( $in['lng'] ) && is_numeric( $in['lng'] ) ? round( (float) $in['lng'], 6 ) : null,
		'date'       => wt_str( $in, 'date', 10 ),
		'start'      => wt_str( $in, 'start', 5 ),
		'coupon'     => strtoupper( wt_str( $in, 'coupon', 30 ) ),
		'usePts'     => ! empty( $in['usePts'] ),
		'notes'      => mb_substr( sanitize_textarea_field( (string) ( $in['notes'] ?? '' ) ), 0, 500 ),
	);
	if ( mb_strlen( $b['name'] ) < 2 || ! wt_valid_mobile( $b['phone'] ) ) {
		return wt_err( 'Customer name and a valid mobile number are required.' );
	}
	if ( mb_strlen( $b['address'] ) < 8 || ! preg_match( '/^\d{6}$/', $b['pincode'] ) ) {
		return wt_err( 'A full address and a 6-digit pincode are required.' );
	}
	$pkg = wt_find( wt_config()['packages'], 'id', $b['pkg'] );
	if ( ! $pkg ) {
		return wt_err( 'Choose a grooming package.' );
	}
	$ds = wt_check_slot( $b['city'], $b['date'], $b['start'], wt_pkg_mins( $pkg ) );
	if ( is_wp_error( $ds ) ) {
		// Only a slot that really is taken is a 409 the app answers with "pick another time"; a date out of range or a
		// time that is not offered is a plain refusal with its own message.
		if ( preg_match( '/booked|taken|no longer/i', $ds->get_error_message() ) ) {
			$ds->add_data( array( 'status' => 409, 'code' => 'SLOT_TAKEN' ) );
		}
		return $ds;
	}
	$q = wt_booking_quote( $b, $b['usePts'] ? $b['phone'] : null );
	if ( is_wp_error( $q ) ) {
		return $q;
	}
	// Extra items priced in the app (add-ons). The backend is a trusted, signed caller.
	$extras = array();
	$extra  = 0;
	foreach ( array_slice( (array) ( $in['extras'] ?? array() ), 0, 10 ) as $x ) {
		$name = mb_substr( sanitize_text_field( (string) ( $x['name'] ?? '' ) ), 0, 80 );
		$amt  = max( 0, (float) ( $x['price'] ?? 0 ) );
		if ( $name && $amt > 0 ) {
			$extras[] = array( 'name' => $name, 'price' => $amt );
			$extra   += $amt;
		}
	}
	$paid   = 'online' === ( $in['pay'] ?? '' );
	// awaitPay: the customer is paying online in the app right now. Like a website booking, the slot is held as
	// "Pending payment" for 20 minutes; connector/bookings/{ref}/paid confirms it.
	$await  = $paid && ! empty( $in['awaitPay'] );
	$expect = isset( $in['expectTotal'] ) ? (float) $in['expectTotal'] : null;
	$total  = $q['total'] + $extra;
	if ( null !== $expect && abs( $expect - $total ) > 0.5 ) {
		return wt_err( sprintf( 'The price changed: it is now %s. Please review and book again.', wt_money( $total ) ), 'wt_price', 409 );
	}
	$use_pts = $b['usePts'];
	unset( $b['usePts'] );
	$b['slot'] = $ds[1];
	$b['mins'] = wt_pkg_mins( $pkg );
	$rec       = array_merge(
		$b,
		array(
			'acct'        => $b['phone'],
			'addons'      => array(),
			'addonItems'  => $extras,
			'subtotal'    => $q['subtotal'] + $extra,
			'coupon'      => $q['coupon'],
			'discount'    => $q['discount'],
			'pointsUsed'  => $use_pts ? $q['pointsUsed'] : 0,
			'ptsDiscount' => $use_pts ? $q['ptsDiscount'] : 0,
			'total'       => $total,
			'status'      => $await ? 'Pending payment' : 'Confirmed',
			'pay'         => $paid ? 'online' : 'later',
			'payStatus'   => 'Due',
			'payMode'     => '',
			'source'      => 'App',
			'by'          => 'App',
			'ts'          => time(),
			'job'         => array( 'id' => $job, 'status' => 'searching' ),
		)
	);
	$rec = wt_conn_as(
		'App',
		function () use ( $rec ) {
			return wt_rec_insert( 'booking', $rec, 'WT' );
		}
	);
	wt_conn_xref_set( $job, $rec['id'] );
	if ( $await ) {
		return array( 'booking' => wt_conn_booking_out( $rec ) );
	}
	$done = wt_conn_as(
		'App',
		function () use ( $rec, $paid, $in ) {
			return wt_confirm_booking( $rec, $paid ? 'Online' : '', $paid ? sanitize_text_field( $in['payId'] ?? 'app' ) : '' );
		}
	);
	$b = wt_rec_get( 'booking', $rec['id'] );
	if ( $paid ) {
		$b['payBy'] = 'App (Razorpay)';
		$b          = wt_rec_save( 'booking', $b );
	}
	return array( 'booking' => wt_conn_booking_out( $b ) );
}

/**
 * Partner and job progress from the apps: offered, assigned (with the partner), on the way, arrived, started,
 * released, needs staff. Stored on the booking under "job" and shown on the desk card. Retries on a revision
 * clash so a desk edit at the same moment is never overwritten.
 */
function wt_conn_job( $in ) {
	$ref     = sanitize_text_field( $in['ref'] ?? '' );
	$allowed = array( 'searching', 'offered', 'assigned', 'on_the_way', 'arrived', 'in_progress', 'needs_staff', 'released', 'completed', 'cancelled' );
	$status  = sanitize_key( $in['status'] ?? '' );
	if ( ! in_array( $status, $allowed, true ) ) {
		return wt_err( 'Unknown job status.' );
	}
	for ( $i = 0; $i < 3; $i++ ) {
		$b = wt_rec_get( 'booking', $ref );
		if ( ! $b ) {
			return wt_err( 'Booking not found.', 'wt_404', 404 );
		}
		$job           = is_array( $b['job'] ?? null ) ? $b['job'] : array();
		$job['status'] = $status;
		$job['at']     = wt_now_label();
		if ( ! empty( $in['jobId'] ) ) {
			$job['id'] = sanitize_text_field( $in['jobId'] );
		}
		if ( array_key_exists( 'partner', $in ) ) {
			$p              = is_array( $in['partner'] ) ? $in['partner'] : null;
			$job['partner'] = $p ? array(
				'id'    => sanitize_text_field( (string) ( $p['id'] ?? '' ) ),
				'name'  => mb_substr( sanitize_text_field( (string) ( $p['name'] ?? '' ) ), 0, 80 ),
				'phone' => wt_phone( $p['phone'] ?? '' ),
				'type'  => in_array( $p['type'] ?? '', array( 'team', 'freelancer' ), true ) ? $p['type'] : '',
			) : null;
		}
		foreach ( array( 'etaMins' => 'int', 'note' => 'str', 'trackUrl' => 'url', 'flag' => 'str' ) as $k => $kind ) {
			if ( array_key_exists( $k, $in ) ) {
				$v         = $in[ $k ];
				$job[ $k ] = null === $v ? null : ( 'int' === $kind ? (int) $v : ( 'url' === $kind ? esc_url_raw( (string) $v ) : mb_substr( sanitize_text_field( (string) $v ), 0, 200 ) ) );
			}
		}
		$job['log']   = array_slice( array_merge( (array) ( $job['log'] ?? array() ), array( array( 'status' => $status, 'at' => wt_now_label(), 'who' => $job['partner']['name'] ?? '' ) ) ), -30 );
		$b['job']     = $job;
		$saved        = wt_conn_as( 'App', function () use ( $b ) { return wt_rec_save( 'booking', $b, true ); } );
		if ( ! is_wp_error( $saved ) ) {
			wt_conn_job_notify( $saved, $status, $in );
			return array( 'booking' => wt_conn_booking_out( $saved ) );
		}
	}
	return $saved;
}

/** Customer WhatsApp for job milestones (templates must be set and approved in Settings; otherwise logged only). */
function wt_conn_job_notify( $b, $status, $in ) {
	if ( ! empty( $in['alert'] ) ) {
		$s     = wt_config()['settings'];
		$what  = mb_substr( sanitize_text_field( (string) $in['alert'] ), 0, 160 );
		$when  = wt_fmt_date( $b['date'] ) . ' ' . ( $b['slot'] ?? '' );
		$text  = sprintf( 'Booking %s needs the desk: %s. Customer %s (%s), %s, %s.', $b['id'], $what, $b['name'], $b['phone'], wt_city_name( $b['city'] ), $when );
		wt_email( $s['notifyEmail'], 'Booking ' . $b['id'] . ' needs the desk', $text );
		if ( $s['notifyWhatsApp'] ) {
			wt_whatsapp( $s['notifyWhatsApp'], 'job_alert_admin', array( $b['id'], $what, $b['name'], $when ), $text );
		}
	}
	if ( empty( $in['notify'] ) ) {
		return;
	}
	$first = wt_first( $b['name'] );
	$name  = $b['job']['partner']['name'] ?? 'your groomer';
	if ( 'assigned' === $status ) {
		wt_whatsapp( $b['phone'], 'groomer_assigned', array( $first, $b['id'], $name, wt_fmt_date( $b['date'] ), $b['slot'] ), sprintf( 'Hi %s, %s is your groomer for %s on %s at %s.', $first, $name, $b['id'], wt_fmt_date( $b['date'] ), $b['slot'] ) );
	} elseif ( 'on_the_way' === $status ) {
		$code = preg_replace( '/\D/', '', (string) ( $in['startCode'] ?? '' ) );
		$link = (string) ( $b['job']['trackUrl'] ?? '' );
		wt_whatsapp( $b['phone'], 'groomer_on_way', array( $first, $name, $link ? $link : '-', $code ? $code : '-' ), sprintf( 'Hi %s, %s is on the way. Track: %s. Share start code %s when they arrive.', $first, $name, $link, $code ) );
	} elseif ( 'in_progress' === $status && ! empty( $in['endCode'] ) ) {
		$code = preg_replace( '/\D/', '', (string) $in['endCode'] );
		wt_whatsapp( $b['phone'], 'groom_end_code', array( $first, $code ), sprintf( 'Hi %s, grooming has started. When it is done, share end code %s with %s.', $first, $code, $name ) );
	}
}

/** Complete, cancel, reschedule or change price, using the desk's own rules (points, WhatsApp, logs). */
function wt_conn_action( $in ) {
	// A reschedule checks the new slot: take the same per-city-per-day lock as bookings do.
	if ( 'reschedule' === sanitize_key( $in['action'] ?? '' ) ) {
		$b0 = wt_rec_get( 'booking', sanitize_text_field( $in['ref'] ?? '' ) );
		if ( $b0 ) {
			return wt_conn_locked( wt_slot_lock_key( $b0['city'] ?? '', $in['date'] ?? '' ), function () use ( $in ) {
				return wt_conn_action_run( $in );
			} );
		}
	}
	return wt_conn_action_run( $in );
}

function wt_conn_action_run( $in ) {
	$ref    = sanitize_text_field( $in['ref'] ?? '' );
	$action = sanitize_key( $in['action'] ?? '' );
	if ( ! in_array( $action, array( 'complete', 'cancel', 'reschedule', 'edit', 'note' ), true ) ) {
		return wt_err( 'Unknown action.' );
	}
	if ( 'complete' === $action ) {
		// Cash collected by the partner stays "Cash"; UPI to the partner or online payment counts as "Online".
		$in['mode'] = 'cash' === strtolower( (string) ( $in['mode'] ?? '' ) ) || 'Cash' === ( $in['mode'] ?? '' ) ? 'Cash' : 'Online';
	}
	$actor = 'App' . ( ! empty( $in['actor'] ) ? ' · ' . mb_substr( sanitize_text_field( (string) $in['actor'] ), 0, 60 ) : '' );
	$out   = wt_conn_as(
		$actor,
		function () use ( $ref, $in ) {
			return wt_desk_action( $ref, $in );
		}
	);
	if ( is_wp_error( $out ) ) {
		return $out;
	}
	if ( isset( $out['booking'] ) && 'complete' === $action ) {
		$b                  = wt_rec_get( 'booking', $ref );
		$b['job']           = array_merge( (array) ( $b['job'] ?? array() ), array( 'status' => 'completed', 'at' => wt_now_label() ) );
		$b['payBy']         = $actor;
		$out['booking']     = wt_rec_save( 'booking', $b );
	}
	return $out;
}

/** Add or take reward points. Repeating the same key does nothing the second time. */
function wt_conn_points( $in ) {
	return wt_conn_locked( 'P' . sanitize_text_field( $in['key'] ?? '' ), function () use ( $in ) {
		return wt_conn_points_run( $in );
	} );
}

function wt_conn_points_run( $in ) {
	$phone = wt_phone( $in['phone'] ?? '' );
	$pts   = (int) ( $in['pts'] ?? 0 );
	$key   = sanitize_text_field( $in['key'] ?? '' );
	if ( ! wt_valid_mobile( $phone ) || ! $pts || ! preg_match( '/^[A-Za-z0-9\-]{8,36}$/', $key ) ) {
		return wt_err( 'phone, pts and key are required.' );
	}
	if ( wt_conn_xref_get( 'P' . $key ) ) {
		return array( 'ok' => true, 'repeat' => true, 'balance' => wt_points_balance( $phone ) );
	}
	if ( $pts < 0 && wt_points_balance( $phone ) + $pts < 0 ) {
		return wt_err( 'Not enough points.', 'wt_points', 409 );
	}
	wt_points_add( $phone, $pts, wt_str( $in, 'reason', 120 ) ? wt_str( $in, 'reason', 120 ) : 'App', wt_str( $in, 'ref', 40 ) );
	wt_conn_xref_set( 'P' . $key, 'points' );
	return array( 'ok' => true, 'balance' => wt_points_balance( $phone ) );
}

/** Insurance enquiry from the app: same list, same alerts as the website form. */
function wt_conn_insurance( $in ) {
	$fields = isset( $in['fields'] ) && is_array( $in['fields'] ) ? $in['fields'] : array();
	$data   = array();
	foreach ( $fields as $label => $v ) {
		$label = mb_substr( sanitize_text_field( (string) $label ), 0, 80 );
		$v     = mb_substr( sanitize_textarea_field( (string) $v ), 0, 1000 );
		if ( $label && '' !== $v ) {
			$data[ $label ] = $v;
		}
	}
	$phone = wt_phone( $in['phone'] ?? '' );
	if ( ! $data || ! wt_valid_mobile( $phone ) ) {
		return wt_err( 'Fields and a valid phone are required.' );
	}
	$data['Source'] = 'App';
	$lead           = wt_rec_insert( 'insurance', array( 'data' => $data, 'phone' => $phone, 'status' => 'New' ), 'IN' );
	$text           = implode( ', ', array_map( function ( $k, $v ) { return $k . ': ' . $v; }, array_keys( $data ), $data ) );
	$s              = wt_config()['settings'];
	wt_email( $s['notifyEmail'], 'New pet insurance enquiry (app)', $text );
	if ( $s['notifyWhatsApp'] ) {
		wt_whatsapp( $s['notifyWhatsApp'], 'insurance_admin', array( $data[ array_keys( $data )[0] ], $phone, $text ), $text );
	}
	return array( 'ok' => true, 'id' => $lead['id'] );
}

/**
 * An app customer paid online for a booking held as "Pending payment". Confirms it exactly like a website payment
 * (points taken, WhatsApp, desk alert). If the 20-minute hold ran out and someone else took the slot meanwhile, a
 * 409 SLOT_TAKEN is returned so the backend can refund. Repeating the call is harmless.
 */
function wt_conn_paid( $in ) {
	$b0 = wt_rec_get( 'booking', sanitize_text_field( $in['ref'] ?? '' ) );
	return wt_conn_locked( $b0 ? wt_slot_lock_key( $b0['city'] ?? '', $b0['date'] ?? '' ) : 'S-none', function () use ( $in ) {
		return wt_conn_paid_run( $in );
	} );
}

function wt_conn_paid_run( $in ) {
	$b = wt_rec_get( 'booking', sanitize_text_field( $in['ref'] ?? '' ) );
	if ( ! $b ) {
		return wt_err( 'Booking not found.', 'wt_404', 404 );
	}
	$pay = sanitize_text_field( (string) ( $in['payId'] ?? 'app' ) );
	if ( 'Pending payment' !== $b['status'] ) {
		if ( 'Cancelled' === $b['status'] ) {
			return wt_err( 'This booking was cancelled.', 'wt_cancelled', 409 );
		}
		return array( 'booking' => wt_conn_booking_out( $b ), 'repeat' => true );
	}
	$free = wt_check_slot( $b['city'], $b['date'], $b['start'], (int) ( $b['mins'] ?? 60 ), $b['id'] );
	if ( is_wp_error( $free ) && time() - (int) ( $b['ts'] ?? 0 ) > 1200 ) {
		return new WP_Error( 'wt_slot', 'The time slot was taken while the payment was open.', array( 'status' => 409, 'code' => 'SLOT_TAKEN' ) );
	}
	$out = wt_conn_as(
		'App',
		function () use ( $b, $pay ) {
			return wt_confirm_booking( $b, 'Online', $pay );
		}
	);
	$b          = wt_rec_get( 'booking', $b['id'] );
	$b['payBy'] = 'App (Razorpay)';
	$b          = wt_rec_save( 'booking', $b );
	return array( 'booking' => wt_conn_booking_out( $b ) );
}

/**
 * A walk booked in the app (walks run app-only). Recorded in the Walk requests list with an "App · …" status so the
 * desk and the sales reports see it; it does not count as a new lead to call back. Same jobId = same record.
 */
function wt_conn_walk( $in ) {
	return wt_conn_locked( 'W' . sanitize_text_field( $in['jobId'] ?? '' ), function () use ( $in ) {
		return wt_conn_walk_run( $in );
	} );
}

function wt_conn_walk_run( $in ) {
	$job = sanitize_text_field( $in['jobId'] ?? '' );
	if ( ! preg_match( '/^[A-Za-z0-9\-]{8,36}$/', $job ) ) {
		return wt_err( 'jobId is required.' );
	}
	$status = 'App · ' . mb_substr( sanitize_text_field( (string) ( $in['status'] ?? 'Booked' ) ), 0, 30 );
	$have   = wt_conn_xref_get( 'W' . $job );
	if ( $have && ( $w = wt_rec_get( 'walk', $have ) ) ) {
		$w['status'] = $status;
		foreach ( array( 'walker', 'price', 'payMode' ) as $k ) {
			if ( isset( $in[ $k ] ) ) {
				$w[ $k ] = is_numeric( $in[ $k ] ) ? (float) $in[ $k ] : mb_substr( sanitize_text_field( (string) $in[ $k ] ), 0, 80 );
			}
		}
		return array( 'walk' => wt_rec_save( 'walk', $w ) );
	}
	$city = wt_city( $in['city'] ?? '', wt_config() );
	$w    = array(
		'city'     => $city ? $city['id'] : wt_str( $in, 'city', 60 ),
		'name'     => wt_str( $in, 'name', 80 ),
		'phone'    => wt_phone( $in['phone'] ?? '' ),
		'email'    => sanitize_email( $in['email'] ?? '' ),
		'pincode'  => wt_str( $in, 'pincode', 6 ),
		'dog'      => wt_str( $in, 'dog', 100 ),
		'freq'     => 'Once',
		'time'     => wt_str( $in, 'time', 60 ),
		'start'    => wt_str( $in, 'start', 10 ),
		'address'  => mb_substr( sanitize_textarea_field( (string) ( $in['address'] ?? '' ) ), 0, 400 ),
		'planName' => wt_str( $in, 'planName', 80 ),
		'price'    => (float) ( $in['price'] ?? 0 ),
		'walker'   => wt_str( $in, 'walker', 80 ),
		'source'   => 'App',
		'appJob'   => $job,
		'status'   => $status,
	);
	$w = wt_rec_insert( 'walk', $w, 'WK' );
	wt_conn_xref_set( 'W' . $job, $w['id'] );
	return array( 'walk' => $w );
}

/** Complaint from the app: the same checks, list, WhatsApp and desk alert as a website complaint. */
function wt_conn_complaint( $in ) {
	$phone = wt_phone( $in['phone'] ?? '' );
	if ( ! wt_valid_mobile( $phone ) ) {
		return wt_err( 'A valid phone is required.' );
	}
	$GLOBALS['wt_conn_phone'] = $phone;
	try {
		return wt_api_complaint_create( $in );
	} finally {
		unset( $GLOBALS['wt_conn_phone'] );
	}
}

/** The app customer's complaints and the bookings they may still complain about. */
function wt_conn_complaints( $in ) {
	$phone = wt_phone( $in['phone'] ?? '' );
	if ( ! wt_valid_mobile( $phone ) ) {
		return wt_err( 'A valid phone is required.' );
	}
	$GLOBALS['wt_conn_phone'] = $phone;
	try {
		return wt_api_my_complaints();
	} finally {
		unset( $GLOBALS['wt_conn_phone'] );
	}
}

/* ===================== outgoing change messages ===================== */

/** Deleted records leave a "tomb" so the backend's polling learns about deletions too. */
add_action(
	'wt_record_changed',
	function ( $type, $data, $op ) {
		if ( 'delete' === $op && in_array( $type, array( 'booking', 'cprof', 'insurance', 'complaint' ), true ) ) {
			wt_rec_insert( 'tomb', array( 'id' => 'T-' . substr( md5( $type . $data['id'] . microtime() ), 0, 12 ), 'of' => $type, 'ref' => $data['id'] ), 'T' );
		}
		if ( ! in_array( $type, WT_CONN_TYPES, true ) || '' === wt_conn_secret() || ! defined( 'WT_CONNECTOR_URL' ) || ! WT_CONNECTOR_URL ) {
			return;
		}
		$GLOBALS['wt_conn_queue'][ $type . '|' . $data['id'] ] = array( $type, (string) $data['id'], $op, ! empty( $GLOBALS['wt_conn_in'] ) );
	},
	10,
	3
);

/** Send the collected changes once, at the end of the request (several saves of one booking = one message). */
add_action(
	'shutdown',
	function () {
		foreach ( (array) ( $GLOBALS['wt_conn_queue'] ?? array() ) as $q ) {
			wt_conn_enqueue( $q[0], $q[1], $q[2], $q[3], 1 );
		}
		$GLOBALS['wt_conn_queue'] = array();
	}
);

function wt_conn_enqueue( $type, $ref, $op, $from_app, $attempt, $delay = 0 ) {
	$args = array( $type, $ref, $op, (bool) $from_app, (int) $attempt );
	if ( function_exists( 'as_schedule_single_action' ) ) {
		as_schedule_single_action( time() + $delay, 'wt_conn_push', $args, 'wag-and-tails' );
	} else {
		wp_schedule_single_event( time() + $delay, 'wt_conn_push', $args );
	}
}

add_action( 'wt_conn_push', 'wt_conn_push', 10, 5 );

function wt_conn_push( $type, $ref, $op, $from_app = false, $attempt = 1 ) {
	$body  = wp_json_encode( array( 'type' => $type, 'ref' => $ref, 'op' => $op, 'fromApp' => (bool) $from_app, 'at' => gmdate( 'c' ) ) );
	$ts    = (string) time();
	$nonce = wp_generate_password( 24, false, false );
	$path  = (string) wp_parse_url( WT_CONNECTOR_URL, PHP_URL_PATH );
	$res   = wp_remote_post(
		WT_CONNECTOR_URL,
		array(
			'timeout' => 8,
			'headers' => array(
				'Content-Type'   => 'application/json',
				'X-WT-Timestamp' => $ts,
				'X-WT-Nonce'     => $nonce,
				'X-WT-Signature' => wt_conn_sign( $ts, $nonce, 'POST', $path, $body ),
			),
			'body'    => $body,
		)
	);
	$code = is_wp_error( $res ) ? 0 : (int) wp_remote_retrieve_response_code( $res );
	if ( $code >= 200 && $code < 300 ) {
		return;
	}
	if ( $attempt < WT_CONN_MAX_TRIES ) {
		wt_conn_enqueue( $type, $ref, $op, $from_app, $attempt + 1, min( 3600, 30 * ( 2 ** ( $attempt - 1 ) ) ) );
	}
}

/* ===================== routes ===================== */

add_action(
	'rest_api_init',
	function () {
		$routes = array(
			array( 'GET', 'connector/config', 'wt_conn_config' ),
			array( 'GET', 'connector/slots', 'wt_conn_slots' ),
			array( 'GET', 'connector/changes', 'wt_conn_changes' ),
			array( 'GET', 'connector/bookings/(?P<ref>[A-Za-z0-9\-]+)', 'wt_conn_get_booking' ),
			array( 'GET', 'connector/customer', 'wt_conn_customer' ),
			array( 'POST', 'connector/quote', 'wt_conn_quote' ),
			array( 'POST', 'connector/bookings', 'wt_conn_create_booking' ),
			array( 'POST', 'connector/bookings/(?P<ref>[A-Za-z0-9\-]+)/job', 'wt_conn_job' ),
			array( 'POST', 'connector/bookings/(?P<ref>[A-Za-z0-9\-]+)/action', 'wt_conn_action' ),
			array( 'POST', 'connector/bookings/(?P<ref>[A-Za-z0-9\-]+)/paid', 'wt_conn_paid' ),
			array( 'POST', 'connector/walks', 'wt_conn_walk' ),
			array( 'POST', 'connector/complaints', 'wt_conn_complaint' ),
			array( 'GET', 'connector/complaints', 'wt_conn_complaints' ),
			array( 'POST', 'connector/points', 'wt_conn_points' ),
			array( 'POST', 'connector/insurance', 'wt_conn_insurance' ),
		);
		foreach ( $routes as $rt ) {
			register_rest_route( 'wt/v1', '/' . $rt[1], array( 'methods' => $rt[0], 'permission_callback' => 'wt_conn_auth', 'callback' => wt_rest( $rt[2] ) ) );
		}
	}
);

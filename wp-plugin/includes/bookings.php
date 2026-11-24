<?php
/**
 * Grooming bookings: price calculation, website bookings, booking desk actions.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const WT_AGGRESSION = array( 'Calm — loves people', 'Mild — nervous with strangers', 'Moderate — may nip when handled', 'High — needs a muzzle' );
const WT_OPEN       = array( 'Confirmed', 'Rescheduled' );

function wt_err( $msg, $code = 'wt_invalid', $status = 400 ) {
	return new WP_Error( $code, $msg, array( 'status' => $status ) );
}

function wt_str( $in, $key, $max = 300 ) {
	return isset( $in[ $key ] ) ? mb_substr( sanitize_text_field( (string) $in[ $key ] ), 0, $max ) : '';
}

function wt_coupon_discount( $code, $subtotal, $ctx = 'web' ) {
	$code = strtoupper( trim( (string) $code ) );
	if ( '' === $code ) {
		return 0;
	}
	$cp = wt_find_coupon( $code, $ctx );
	if ( ! $cp ) {
		return wt_err( 'This coupon code is not valid.' );
	}
	if ( $subtotal < (float) $cp['min'] ) {
		return wt_err( sprintf( 'Add %s more to use %s.', wt_money( $cp['min'] - $subtotal ), $code ) );
	}
	$d = 'pct' === $cp['type'] ? $subtotal * (float) $cp['value'] / 100 : (float) $cp['value'];
	return (int) min( round( $d ), $subtotal );
}

/**
 * Work out the price of a booking on the server.
 *
 * @param array       $in           Booking input.
 * @param string|null $points_phone Customer phone if points may be used.
 */
function wt_booking_quote( $in, $points_phone = null, $ctx = 'web' ) {
	$c    = wt_config();
	$city = wt_city( isset( $in['city'] ) ? $in['city'] : '', $c );
	if ( ! $city || empty( $city['service'] ) ) {
		return wt_err( 'Choose a city where we offer home grooming.' );
	}
	if ( 'desk' === $ctx && '__custom' === ( $in['pkg'] ?? '' ) ) {
		// Custom package made by the booking team: their own name, price and length.
		$cname = trim( (string) ( $in['customName'] ?? '' ) );
		$base  = (float) ( $in['customPrice'] ?? 0 );
		if ( mb_strlen( $cname ) < 2 ) {
			return wt_err( 'Enter a name for the custom package.' );
		}
		if ( $base <= 0 ) {
			return wt_err( 'Enter the price of the custom package.' );
		}
		$pkg = array(
			'id'   => '__custom',
			'name' => $cname,
			'pet'  => 'Both',
			'mins' => min( 600, max( 15, (int) ( $in['customMins'] ?? 60 ) ) ),
		);
	} else {
		$pkg = wt_find( $c['packages'], 'id', isset( $in['pkg'] ) ? $in['pkg'] : '' );
		if ( ! $pkg ) {
			return wt_err( 'Choose a grooming package.' );
		}
		$pet = isset( $in['petType'] ) ? $in['petType'] : 'Dog';
		if ( 'Both' !== $pkg['pet'] && $pkg['pet'] !== $pet ) {
			return wt_err( $pkg['name'] . ' is only for ' . strtolower( $pkg['pet'] ) . 's.' );
		}
		$base = isset( $pkg['prices'][ $city['id'] ] ) ? (float) $pkg['prices'][ $city['id'] ] : 0;
		if ( $base <= 0 ) {
			return wt_err( 'This package has no price for ' . $city['name'] . ' yet. Please choose another package.' );
		}
	}
	$addons = array();
	$add    = 0;
	if ( ! empty( $in['addons'] ) && function_exists( 'wc_get_product' ) ) {
		foreach ( array_slice( (array) $in['addons'], 0, 10 ) as $pid ) {
			$pid = (int) $pid;
			if ( ! in_array( $pid, array_map( 'intval', $c['suggested'] ), true ) ) {
				continue;
			}
			$p = wc_get_product( $pid );
			if ( $p && $p->is_in_stock() && 'publish' === $p->get_status() ) {
				$addons[] = array( 'id' => $pid, 'name' => $p->get_name(), 'price' => (float) $p->get_price() );
				$add     += (float) $p->get_price();
			}
		}
	}
	$subtotal = $base + $add;
	$discount = 0;
	$code     = isset( $in['coupon'] ) ? strtoupper( trim( (string) $in['coupon'] ) ) : '';
	if ( $code ) {
		$discount = wt_coupon_discount( $code, $subtotal, $ctx );
		if ( is_wp_error( $discount ) ) {
			return $discount;
		}
	}
	$after   = $subtotal - $discount;
	$pts     = 0;
	$pts_amt = 0;
	if ( $points_phone && ! empty( $in['usePts'] ) ) {
		$rd      = wt_points_redeemable( $points_phone, $after );
		$pts     = $rd['pts'];
		$pts_amt = $rd['amount'];
	}
	return array(
		'mins'        => wt_pkg_mins( $pkg ),
		'base'        => $base,
		'addons'      => $addons,
		'subtotal'    => $subtotal,
		'coupon'      => $discount ? $code : '',
		'discount'    => $discount,
		'pointsUsed'  => $pts,
		'ptsDiscount' => $pts_amt,
		'total'       => max( 0, $after - $pts_amt ),
	);
}

/** Validate a website booking form. Returns cleaned data or WP_Error. */
function wt_clean_web_booking( $in ) {
	$c = wt_config();
	$b = array(
		'city'       => wt_str( $in, 'city', 60 ),
		'pkg'        => wt_str( $in, 'pkg', 40 ),
		'petType'    => 'Cat' === ( $in['petType'] ?? '' ) ? 'Cat' : 'Dog',
		'breed'      => wt_str( $in, 'breed', 60 ),
		'gender'     => wt_str( $in, 'gender', 10 ),
		'age'        => wt_str( $in, 'age', 4 ),
		'ageUnit'    => 'months' === ( $in['ageUnit'] ?? '' ) ? 'months' : 'years',
		'aggression' => wt_str( $in, 'aggression', 60 ),
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
		'addons'     => array_map( 'intval', (array) ( $in['addons'] ?? array() ) ),
		'pay'        => 'online' === ( $in['pay'] ?? '' ) ? 'online' : 'later',
		'usePts'     => ! empty( $in['usePts'] ),
	);
	$breeds = isset( $c['breeds'][ $b['petType'] ] ) ? $c['breeds'][ $b['petType'] ] : array();
	if ( ! in_array( $b['breed'], $breeds, true ) ) {
		return wt_err( "Select your pet's breed." );
	}
	if ( ! in_array( $b['gender'], array( 'Male', 'Female' ), true ) ) {
		return wt_err( "Select your pet's gender." );
	}
	if ( ! is_numeric( $b['age'] ) || $b['age'] < 0 || $b['age'] > 30 ) {
		return wt_err( "Enter your pet's age." );
	}
	if ( ! in_array( $b['aggression'], WT_AGGRESSION, true ) ) {
		return wt_err( 'Select the aggression level so we can send the right groomer.' );
	}
	if ( mb_strlen( $b['name'] ) < 2 ) {
		return wt_err( 'Enter your full name.' );
	}
	if ( ! wt_valid_mobile( $b['phone'] ) ) {
		return wt_err( 'Enter a valid 10-digit mobile number.' );
	}
	if ( ! is_email( $b['email'] ) ) {
		return wt_err( 'Enter a valid email address.' );
	}
	if ( ! preg_match( '/^\d{6}$/', $b['pincode'] ) ) {
		return wt_err( 'Pincode must be 6 digits.' );
	}
	if ( mb_strlen( $b['address'] ) < 8 ) {
		return wt_err( 'Enter your full address.' );
	}
	if ( null === $b['lat'] || null === $b['lng'] ) {
		return wt_err( 'Pin your location on the map, or tap "Use my current location".' );
	}
	$pkg = wt_find( $c['packages'], 'id', $b['pkg'] );
	$ds  = wt_check_slot( $b['city'], $b['date'], $b['start'], wt_pkg_mins( $pkg ) );
	if ( is_wp_error( $ds ) ) {
		return $ds;
	}
	$b['slot'] = $ds[1];
	$b['mins'] = wt_pkg_mins( $pkg );
	$b['age']  = $b['age'] . ' ' . $b['ageUnit'];
	unset( $b['ageUnit'] );
	return $b;
}

function wt_current_customer_phone() {
	if ( ! empty( $GLOBALS['wt_conn_phone'] ) ) { // the apps' backend acting for an app customer (connector.php)
		return $GLOBALS['wt_conn_phone'];
	}
	if ( ! is_user_logged_in() ) {
		return null;
	}
	$p = wt_user_phone( get_current_user_id() );
	return $p ? $p : null;
}

/** Website booking. Online payments start as "Pending payment" until Razorpay confirms. */
function wt_create_web_booking( $in ) {
	if ( ! empty( $in['website'] ) ) { // Spam trap field.
		return wt_err( 'Something went wrong. Please try again.' );
	}
	$b = wt_clean_web_booking( $in );
	if ( is_wp_error( $b ) ) {
		return $b;
	}
	$cust_phone = wt_current_customer_phone();
	$q          = wt_booking_quote( $b, $cust_phone );
	if ( is_wp_error( $q ) ) {
		return $q;
	}
	if ( 'online' === $b['pay'] && ! wt_rzp_ready() ) {
		return wt_err( 'Online payment is not available yet. Please choose Pay after service.' );
	}
	$use_pts = $b['usePts'];
	unset( $b['usePts'] );
	$rec = array_merge(
		$b,
		array(
			'addons'      => array_column( $q['addons'], 'id' ),
			'addonItems'  => $q['addons'],
			'subtotal'    => $q['subtotal'],
			'coupon'      => $q['coupon'],
			'discount'    => $q['discount'],
			'pointsUsed'  => $use_pts ? $q['pointsUsed'] : 0,
			'ptsDiscount' => $use_pts ? $q['ptsDiscount'] : 0,
			'total'       => $q['total'],
			'acct'        => $cust_phone ? $cust_phone : $b['phone'],
			'status'      => 'online' === $b['pay'] ? 'Pending payment' : 'Confirmed',
			'payStatus'   => 'Due',
			'payMode'     => '',
			'source'      => 'Website',
			'by'          => 'Website',
			'notes'       => '',
			'ts'          => time(),
		)
	);
	$rec = wt_rec_insert( 'booking', $rec, 'WT' );

	if ( 'online' === $b['pay'] ) {
		if ( $rec['total'] <= 0 ) { // Fully covered by coupon/points.
			return wt_confirm_booking( $rec, 'Online', 'free' );
		}
		$order = wt_rzp_create_order( $rec['total'], $rec['id'], array( 'booking' => $rec['id'] ) );
		if ( is_wp_error( $order ) ) {
			wt_rec_delete( 'booking', $rec['id'] );
			return $order;
		}
		$rec['rzpOrder'] = $order['id'];
		wt_rec_save( 'booking', $rec );
		list( $key ) = wt_rzp_keys();
		return array(
			'ref' => $rec['id'],
			'rzp' => array(
				'key'      => $key,
				'order_id' => $order['id'],
				'amount'   => $order['amount'],
				'name'     => $rec['name'],
				'email'    => $rec['email'],
				'contact'  => $rec['phone'],
			),
		);
	}
	return wt_confirm_booking( $rec, '', '' );
}

/** Move a booking to Confirmed, take any points used, send the confirmations. */
function wt_confirm_booking( $rec, $pay_mode, $pay_id ) {
	if ( $pay_mode ) {
		$rec['payStatus'] = 'Paid';
		$rec['payMode']   = $pay_mode;
		$rec['payId']     = $pay_id;
		$rec['payAt']     = wt_now_label();
		$rec['payBy']     = 'Website (Razorpay)';
	}
	$rec['status'] = 'Confirmed';
	if ( ! empty( $rec['pointsUsed'] ) && empty( $rec['ptsTaken'] ) ) {
		$take = min( (int) $rec['pointsUsed'], wt_points_balance( $rec['acct'] ) );
		if ( $take > 0 ) {
			wt_points_add( $rec['acct'], -$take, 'Redeemed on grooming ' . $rec['id'], $rec['id'] );
		}
		$rec['pointsUsed'] = $take;
		$rec['ptsTaken']   = true;
	}
	wt_rec_save( 'booking', $rec );
	wt_notify_booking_new( $rec );
	return array( 'booking' => wt_booking_for_client( $rec ) );
}

function wt_verify_web_booking( $in ) {
	$rec = wt_rec_get( 'booking', sanitize_text_field( $in['ref'] ?? '' ) );
	if ( ! $rec ) {
		return wt_err( 'Booking not found.', 'wt_404', 404 );
	}
	$order = sanitize_text_field( $in['razorpay_order_id'] ?? '' );
	$pay   = sanitize_text_field( $in['razorpay_payment_id'] ?? '' );
	$sig   = sanitize_text_field( $in['razorpay_signature'] ?? '' );
	// Only the person holding a valid Razorpay signature for this booking's order may see it. Without one,
	// knowing a booking reference (it appears in emails and WhatsApp messages) reveals nothing.
	$proven = $order && $order === ( $rec['rzpOrder'] ?? '' ) && wt_rzp_verify( $order, $pay, $sig );
	if ( 'Pending payment' !== $rec['status'] ) {
		return $proven ? array( 'booking' => wt_booking_for_client( $rec ) ) : array( 'booking' => array( 'id' => $rec['id'], 'status' => $rec['status'] ) );
	}
	if ( ! $proven ) {
		return wt_err( 'We could not confirm this payment. If money was deducted, contact us with your booking ID ' . $rec['id'] . '.' );
	}
	return wt_confirm_booking( $rec, 'Online', $pay );
}

/** Fields the customer's own browser may see. */
function wt_booking_for_client( $b ) {
	unset( $b['rzpOrder'], $b['ptsTaken'] );
	if ( 'Completed' === ( $b['status'] ?? '' ) && function_exists( 'wt_redo_left' ) ) {
		$b['redoLeft'] = wt_redo_left( $b );
	}
	return apply_filters( 'wt_booking_for_client', $b );
}

/* ---------- booking desk ---------- */

function wt_desk_city() {
	if ( ! empty( $GLOBALS['wt_actor'] ) || current_user_can( 'manage_options' ) ) { // the apps' backend acts for every city
		return 'all';
	}
	$c = get_user_meta( get_current_user_id(), 'wt_city', true );
	return $c ? $c : 'all';
}

function wt_desk_name() {
	if ( ! empty( $GLOBALS['wt_actor'] ) ) {
		return (string) $GLOBALS['wt_actor']; // e.g. "App · Ritika" when the partner app completes a job
	}
	if ( current_user_can( 'manage_options' ) ) {
		return 'Admin';
	}
	$u = wp_get_current_user();
	return $u->display_name ? $u->display_name : $u->user_login;
}

function wt_desk_can_see( $b ) {
	$scope = wt_desk_city();
	return 'all' === $scope || $b['city'] === $scope;
}

function wt_desk_list( $filter, $city, $q ) {
	$scope = wt_desk_city();
	$where = array();
	if ( 'all' !== $scope ) {
		$where['city'] = $scope;
	} elseif ( $city && 'all' !== $city ) {
		$where['city'] = $city;
	}
	$today = wt_today();
	$q     = mb_strtolower( trim( (string) $q ) );
	switch ( $filter ) {
		case 'today':
		case 'upcoming':
			$where['status'] = WT_OPEN;
			$list            = wt_rec_list( 'booking', $where, 'skey ASC', 1000 );
			if ( 'today' === $filter ) {
				$list = array_values(
					array_filter(
						$list,
						function ( $b ) use ( $today ) {
							return $b['date'] === $today;
						}
					)
				);
			}
			break;
		case 'completed':
			$where['status'] = 'Completed';
			$list            = wt_rec_list( 'booking', $where, 'skey DESC', 300 );
			break;
		case 'cancelled':
			$where['status'] = 'Cancelled';
			$list            = wt_rec_list( 'booking', $where, 'skey DESC', 300 );
			break;
		case 'pending':
			$where['status'] = 'Pending payment';
			$list            = wt_rec_list( 'booking', $where, 'id DESC', 100 );
			break;
		case 'nogroomer':
		case 'late':
		case 'inprogress':
		case 'attention':
			$where['status'] = WT_OPEN;
			$list            = wt_apps_desk_filter( wt_rec_list( 'booking', $where, 'skey ASC', 1000 ), $filter );
			break;
		default:
			$list = wt_rec_list( 'booking', $where, 'skey DESC', $q ? 2000 : 300 );
	}
	if ( $q ) {
		$list = array_values(
			array_filter(
				$list,
				function ( $b ) use ( $q ) {
					return false !== mb_strpos( mb_strtolower( $b['id'] . ' ' . $b['name'] . ' ' . $b['phone'] ), $q );
				}
			)
		);
	}
	$open = wt_rec_list( 'booking', array_merge( $where, array( 'status' => WT_OPEN ) ), 'skey ASC', 2000 );
	$done = wt_rec_list( 'booking', array_merge( $where, array( 'status' => 'Completed' ) ), 'skey DESC', 300 );
	return array(
		'list'   => array_map( 'wt_booking_for_client', array_slice( $list, 0, 300 ) ),
		'counts' => array(
			'today'      => count(
				array_filter(
					$open,
					function ( $b ) use ( $today ) {
						return $b['date'] === $today;
					}
				)
			),
			'upcoming'   => count( $open ),
			'payPending' => count(
				array_filter(
					$done,
					function ( $b ) {
						return empty( $b['payMode'] );
					}
				)
			),
			'reviewsDue' => count(
				array_filter(
					$done,
					function ( $b ) {
						return empty( $b['reviewAt'] );
					}
				)
			),
		),
	);
}

/** Booking added by phone/WhatsApp from the booking desk. */
function wt_desk_add( $in ) {
	$c    = wt_config();
	$city = wt_str( $in, 'city', 60 );
	$scope = wt_desk_city();
	if ( 'all' !== $scope && $city !== $scope ) {
		return wt_err( 'You can only add bookings for ' . wt_city_name( $scope ) . '.' );
	}
	$b = array(
		'city'       => $city,
		'pkg'        => wt_str( $in, 'pkg', 40 ),
		'customName' => wt_str( $in, 'customName', 80 ),
		'customPrice' => max( 0, (float) ( $in['customPrice'] ?? 0 ) ),
		'customMins' => (int) ( $in['customMins'] ?? 60 ),
		'customNote' => mb_substr( sanitize_textarea_field( (string) ( $in['customNote'] ?? '' ) ), 0, 300 ),
		'source'     => wt_str( $in, 'source', 40 ),
		'coupon'     => strtoupper( wt_str( $in, 'coupon', 30 ) ),
		'name'       => wt_str( $in, 'name', 80 ),
		'phone'      => wt_phone( $in['phone'] ?? '' ),
		'email'      => sanitize_email( $in['email'] ?? '' ),
		'pincode'    => wt_str( $in, 'pincode', 6 ),
		'address'    => mb_substr( sanitize_textarea_field( (string) ( $in['address'] ?? '' ) ), 0, 400 ),
		'mapLink'    => esc_url_raw( $in['mapLink'] ?? '' ),
		'petType'    => 'Cat' === ( $in['petType'] ?? '' ) ? 'Cat' : 'Dog',
		'breed'      => wt_str( $in, 'breed', 60 ),
		'gender'     => 'Female' === ( $in['gender'] ?? '' ) ? 'Female' : 'Male',
		'age'        => wt_str( $in, 'age', 20 ),
		'aggression' => in_array( $in['aggression'] ?? '', WT_AGGRESSION, true ) ? $in['aggression'] : WT_AGGRESSION[0],
		'date'       => wt_str( $in, 'date', 10 ),
		'start'      => wt_str( $in, 'start', 5 ),
		'pay'        => 'online' === ( $in['pay'] ?? '' ) ? 'online' : 'later',
	);
	$custom_time = ! empty( $in['customTime'] );
	if ( mb_strlen( $b['name'] ) < 2 ) {
		return wt_err( 'Enter the customer name.' );
	}
	if ( ! wt_valid_mobile( $b['phone'] ) ) {
		return wt_err( 'Enter a valid 10-digit mobile number.' );
	}
	if ( $b['email'] && ! is_email( $b['email'] ) ) {
		return wt_err( 'The email address looks wrong.' );
	}
	if ( ! preg_match( '/^\d{6}$/', $b['pincode'] ) ) {
		return wt_err( 'Pincode must be 6 digits.' );
	}
	if ( mb_strlen( $b['address'] ) < 8 ) {
		return wt_err( 'Enter the full address.' );
	}
	if ( ! $b['breed'] || ! $b['age'] ) {
		return wt_err( 'Enter the pet breed and age.' );
	}
	$q = wt_booking_quote( $b, null, 'desk' );
	if ( is_wp_error( $q ) ) {
		return $q;
	}
	$ds = wt_check_slot_desk( $b['city'], $b['date'], $b['start'], $q['mins'], '', $custom_time );
	if ( is_wp_error( $ds ) ) {
		return $ds;
	}
	$b['start'] = $ds[0];
	$b['slot']  = $ds[1];
	$b['mins']  = $q['mins'];
	if ( $custom_time ) {
		$b['customTime'] = true;
	}
	if ( '__custom' === $b['pkg'] ) {
		$b['pkgName'] = $b['customName'];
		$b['custom']  = true;
		if ( $b['customNote'] ) {
			$b['items'] = $b['customNote'];
		}
	}
	unset( $b['customName'], $b['customPrice'], $b['customMins'], $b['customNote'] );
	if ( is_wp_error( $q ) ) {
		return $q;
	}
	$online = 'online' === $b['pay'];
	$rec    = array_merge(
		$b,
		array(
			'acct'       => $b['phone'],
			'addons'     => array(),
			'subtotal'   => $q['subtotal'],
			'coupon'     => $q['coupon'],
			'discount'   => $q['discount'],
			'pointsUsed' => 0,
			'total'      => $q['total'],
			'status'     => 'Confirmed',
			'payStatus'  => $online ? 'Paid' : 'Due',
			'payMode'    => $online ? 'Online' : '',
			'by'         => wt_desk_name(),
			'byUid'      => get_current_user_id(),
			'payBy'      => $online ? wt_desk_name() : '',
			'payAt'      => $online ? wt_now_label() : '',
			'lat'        => null,
			'lng'        => null,
			'notes'      => '',
		)
	);
	$past = strtotime( $b['date'] . ' ' . $ds[0] . ':00 ' . wp_timezone_string() ) < time();
	if ( $past ) {
		$rec['backdated'] = true;
	}
	$rec = wt_rec_insert( 'booking', $rec, 'WT' );
	if ( ! $past || ! empty( $in['notifyPast'] ) ) {
		wt_notify_booking_new( $rec );
	}
	return array( 'booking' => $rec, 'past' => $past );
}

function wt_booking_credit_points( &$b, $notify = true ) {
	if ( ! empty( $b['ptsEarned'] ) ) {
		return;
	}
	$e = wt_points_earn_for( $b['total'], 'booking' );
	if ( $e <= 0 ) {
		return;
	}
	$acct = $b['acct'] ? $b['acct'] : $b['phone'];
	wt_points_add( $acct, $e, 'Earned on grooming ' . $b['id'], $b['id'] );
	$b['ptsEarned'] = $e;
	if ( ! $notify ) {
		return;
	}
	$bal = wt_points_balance( $acct );
	wt_whatsapp( $b['phone'], 'points_earned', array( wt_first( $b['name'] ), $e, $bal ), sprintf( 'You earned %d Wag & Tails reward points on %s. Your balance is %d points.', $e, $b['id'], $bal ) );
}

function wt_booking_refund_points( &$b ) {
	$acct = $b['acct'] ? $b['acct'] : $b['phone'];
	if ( ! empty( $b['pointsUsed'] ) && ! empty( $b['ptsTaken'] ) && empty( $b['ptsRefunded'] ) ) {
		wt_points_add( $acct, (int) $b['pointsUsed'], 'Returned for cancelled ' . $b['id'], $b['id'] );
		$b['ptsRefunded'] = true;
	}
	if ( ! empty( $b['ptsEarned'] ) && empty( $b['ptsReversed'] ) ) {
		wt_points_add( $acct, -(int) $b['ptsEarned'], 'Reversed for cancelled ' . $b['id'], $b['id'] );
		$b['ptsReversed'] = true;
	}
}

function wt_desk_action( $ref, $in ) {
	$b = wt_rec_get( 'booking', $ref );
	if ( ! $b || ! wt_desk_can_see( $b ) ) {
		return wt_err( 'Booking not found.', 'wt_404', 404 );
	}
	$action = $in['action'] ?? '';
	$by     = wt_desk_name();
	$first  = wt_first( $b['name'] );
	$open   = in_array( $b['status'], WT_OPEN, true );

	switch ( $action ) {
		case 'complete':
			if ( ! $open ) {
				return wt_err( 'Only confirmed or rescheduled bookings can be marked complete.' );
			}
			$mode = $in['mode'] ?? '';
			if ( ! empty( $b['redo'] ) ) {
				$mode = 'Free redo';
			} elseif ( ! in_array( $mode, array( 'Online', 'Cash' ), true ) ) {
				return wt_err( 'Choose how the payment was received.' );
			}
			$b['status']      = 'Completed';
			$b['completedTs'] = time();
			if ( $b['payMode'] !== $mode || empty( $b['payAt'] ) ) {
				$b['payBy'] = $by;
				$b['payAt'] = wt_now_label();
			}
			$b['payMode']     = $mode;
			$b['payStatus']   = 'Paid';
			$b['completedAt'] = wt_now_label();
			$b['closedBy']    = $by;
			$note             = wt_str( $in, 'note', 300 );
			if ( $note ) {
				$b['notes'] = $note;
			}
			wt_booking_credit_points( $b );
			wt_whatsapp( $b['phone'], 'completed', array( $first, $b['id'], wt_money( $b['total'] ), $mode ), sprintf( "Thank you %s! Your pet's grooming (%s) is complete. Payment of %s received by %s.", $first, $b['id'], wt_money( $b['total'] ), strtolower( $mode ) ) );
			break;

		case 'cancel':
			if ( ! $open && 'Pending payment' !== $b['status'] ) {
				return wt_err( 'This booking is already ' . strtolower( $b['status'] ) . '.' );
			}
			$reason  = wt_str( $in, 'reason', 60 );
			$details = mb_substr( sanitize_textarea_field( (string) ( $in['details'] ?? '' ) ), 0, 400 );
			if ( ! $reason ) {
				return wt_err( 'Choose a reason for cancelling.' );
			}
			if ( 'Other' === $reason && ! $details ) {
				return wt_err( 'Add details when the reason is Other.' );
			}
			$b['status']       = 'Cancelled';
			$b['cancelReason'] = $reason . ( $details ? ': ' . $details : '' );
			$b['cancelledBy']  = $by;
			$b['cancelledAt']  = wt_now_label();
			wt_booking_refund_points( $b );
			wt_whatsapp( $b['phone'], 'cancelled', array( $first, $b['id'], $b['cancelReason'] ), sprintf( 'Hi %s, your grooming %s on %s at %s has been cancelled. Reason: %s.', $first, $b['id'], wt_fmt_date( $b['date'] ), $b['slot'], $b['cancelReason'] ) );
			if ( ! empty( $b['email'] ) ) {
				wt_email( $b['email'], 'Your Wag & Tails booking is cancelled', sprintf( "Hi %s,\n\nYour grooming %s on %s at %s has been cancelled.\nReason: %s", $first, $b['id'], wt_fmt_date( $b['date'] ), $b['slot'], $b['cancelReason'] ) );
			}
			wt_email( wt_config()['settings']['notifyEmail'], 'Booking ' . $b['id'] . ' cancelled', sprintf( '%s (%s) cancelled by %s. Reason: %s.', $b['id'], $b['name'], $by, $b['cancelReason'] ) );
			break;

		case 'reschedule':
			if ( ! $open ) {
				return wt_err( 'Only confirmed or rescheduled bookings can be moved.' );
			}
			$date = wt_str( $in, 'date', 10 );
			$span = wt_booking_span( $b, wt_config() );
			$mins = $span ? $span[1] : 60;
			$ds   = wt_check_slot_desk( $b['city'], $date, wt_str( $in, 'start', 5 ), $mins, $b['id'], ! empty( $in['customTime'] ) );
			if ( is_wp_error( $ds ) ) {
				return $ds;
			}
			$slot = $ds[1];
			if ( $date === $b['date'] && $slot === $b['slot'] ) {
				return wt_err( 'Pick a different date or time.' );
			}
			$b['start'] = $ds[0];
			$b['mins']  = $mins;
			$b['history']   = isset( $b['history'] ) ? $b['history'] : array();
			$b['history'][] = array(
				'date'   => $b['date'],
				'slot'   => $b['slot'],
				'reason' => wt_str( $in, 'reason', 200 ),
				'by'     => $by,
				'at'     => wt_now_label(),
			);
			$b['date']   = $date;
			$b['slot']   = $slot;
			$b['status'] = 'Rescheduled';
			wt_whatsapp( $b['phone'], 'rescheduled', array( $first, $b['id'], wt_fmt_date( $date ), $slot ), sprintf( 'Hi %s, your grooming %s is now on %s at %s.', $first, $b['id'], wt_fmt_date( $date ), $slot ) );
			if ( ! empty( $b['email'] ) ) {
				wt_email( $b['email'], 'New time for your Wag & Tails grooming', sprintf( "Hi %s,\n\nYour grooming %s is now on %s at %s.", $first, $b['id'], wt_fmt_date( $date ), $slot ) );
			}
			break;

		case 'paymode':
			if ( 'Cancelled' === $b['status'] ) {
				return wt_err( 'This booking is cancelled.' );
			}
			$mode           = $in['mode'] ?? '';
			$b['payMode']   = in_array( $mode, array( 'Online', 'Cash' ), true ) ? $mode : '';
			$b['payStatus'] = $b['payMode'] ? 'Paid' : 'Due';
			$b['payBy']     = $b['payMode'] ? $by : '';
			$b['payAt']     = $b['payMode'] ? wt_now_label() : '';
			unset( $b['balanceDue'] );
			break;

		case 'review':
			$b['reviewAt'] = wt_now_label();
			$b['reviewBy'] = $by;
			break;

		case 'edit':
			if ( 'Cancelled' === $b['status'] ) {
				return wt_err( 'This booking is cancelled.' );
			}
			$reason  = mb_substr( sanitize_textarea_field( (string) ( $in['reason'] ?? '' ) ), 0, 300 );
			$changed = array();
			$date    = wt_str( $in, 'date', 10 );
			$start   = wt_str( $in, 'start', 5 );
			if ( $date && preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date ) && $start ) {
				$span = wt_booking_span( $b, wt_config() );
				$mins = $span ? $span[1] : 60;
				$ds   = wt_check_slot_desk( $b['city'], $date, $start, $mins, $b['id'], ! empty( $in['customTime'] ) );
				if ( is_wp_error( $ds ) ) {
					return $ds;
				}
				if ( $date !== $b['date'] || $ds[1] !== $b['slot'] ) {
					$b['history']   = isset( $b['history'] ) ? $b['history'] : array();
					$b['history'][] = array( 'date' => $b['date'], 'slot' => $b['slot'], 'reason' => $reason ? $reason : 'Date changed', 'by' => $by, 'at' => wt_now_label() );
					$b['date']      = $date;
					$b['start']     = $ds[0];
					$b['slot']      = $ds[1];
					$b['mins']      = $mins;
					$changed[]      = 'date';
					if ( $open ) {
						$b['status'] = 'Rescheduled';
					}
					if ( $open && ! empty( $in['notify'] ) && $date >= wt_today() ) {
						wt_whatsapp( $b['phone'], 'rescheduled', array( $first, $b['id'], wt_fmt_date( $date ), $ds[1] ), sprintf( 'Hi %s, your grooming %s is now on %s at %s.', $first, $b['id'], wt_fmt_date( $date ), $ds[1] ) );
						if ( ! empty( $b['email'] ) ) {
							wt_email( $b['email'], 'New time for your Wag & Tails grooming', sprintf( "Hi %s,\n\nYour grooming %s is now on %s at %s.", $first, $b['id'], wt_fmt_date( $date ), $ds[1] ) );
						}
					}
				}
			}
			if ( isset( $in['price'] ) && '' !== (string) $in['price'] ) {
				$new = round( max( 0, (float) $in['price'] ), 2 );
				$old = (float) $b['total'];
				if ( abs( $new - $old ) >= 0.01 ) {
					if ( mb_strlen( trim( $reason ) ) < 3 ) {
						return wt_err( 'Write the reason for changing the price.' );
					}
					$b['priceLog']   = isset( $b['priceLog'] ) && is_array( $b['priceLog'] ) ? $b['priceLog'] : array();
					$b['priceLog'][] = array( 'from' => $old, 'to' => $new, 'reason' => $reason, 'by' => $by, 'at' => wt_now_label() );
					unset( $b['extraDiscount'], $b['totalBefore'], $b['discountReason'], $b['discountBy'] );
					$b['total']       = $new;
					$b['priceReason'] = $reason;
					$b['priceBy']     = $by;
					if ( 'Paid' === ( $b['payStatus'] ?? '' ) && $new > $old ) {
						$b['balanceDue'] = round( $new - $old + (float) ( $b['balanceDue'] ?? 0 ), 2 );
					}
					if ( ! empty( $b['ptsEarned'] ) && empty( $b['ptsReversed'] ) ) {
						$new_earn = wt_points_earn_for( $b['total'], 'booking' );
						$delta    = $new_earn - (int) $b['ptsEarned'];
						if ( $delta ) {
							wt_points_add( $b['acct'] ? $b['acct'] : $b['phone'], $delta, 'Points adjusted after price change on ' . $b['id'], $b['id'] );
							$b['ptsEarned'] = $new_earn;
						}
					}
					$changed[] = 'price';
				}
			}
			if ( ! $changed ) {
				return wt_err( 'Nothing changed. Pick a new date/time or enter a new price.' );
			}
			break;

		case 'discount':
			if ( ! in_array( $b['status'], array( 'Confirmed', 'Rescheduled', 'Completed' ), true ) ) {
				return wt_err( 'A discount can only be given on a confirmed or completed booking.' );
			}
			$reason = mb_substr( sanitize_textarea_field( (string) ( $in['reason'] ?? '' ) ), 0, 300 );
			$val    = max( 0, (float) ( $in['value'] ?? 0 ) );
			$kind   = 'pct' === ( $in['kind'] ?? '' ) ? 'pct' : 'amt';
			$before = isset( $b['totalBefore'] ) ? (float) $b['totalBefore'] : (float) $b['total'];
			$amount = 'pct' === $kind ? round( $before * min( 100, $val ) / 100 ) : round( $val );
			$amount = min( $amount, $before );
			if ( $amount > 0 && mb_strlen( trim( $reason ) ) < 3 ) {
				return wt_err( 'Write the reason for this discount.' );
			}
			$old = (float) ( $b['extraDiscount'] ?? 0 );
			if ( $amount <= 0 ) {
				// Remove the discount.
				$b['total'] = $before;
				unset( $b['extraDiscount'], $b['totalBefore'] );
			} else {
				$b['totalBefore']   = $before;
				$b['extraDiscount'] = $amount;
				$b['total']         = $before - $amount;
			}
			$b['discountLog']   = isset( $b['discountLog'] ) && is_array( $b['discountLog'] ) ? $b['discountLog'] : array();
			$b['discountLog'][] = array(
				'amount' => $amount,
				'was'    => $old,
				'kind'   => $kind,
				'value'  => $val,
				'reason' => $amount > 0 ? $reason : ( $reason ? $reason : 'Discount removed' ),
				'by'     => $by,
				'at'     => wt_now_label(),
			);
			$b['discountReason'] = $amount > 0 ? $reason : '';
			$b['discountBy']     = $amount > 0 ? $by : '';
			// Keep reward points in line with the new total if they were already given.
			if ( ! empty( $b['ptsEarned'] ) && empty( $b['ptsReversed'] ) ) {
				$new_earn = wt_points_earn_for( $b['total'], 'booking' );
				$delta    = $new_earn - (int) $b['ptsEarned'];
				if ( $delta ) {
					wt_points_add( $b['acct'] ? $b['acct'] : $b['phone'], $delta, 'Points adjusted after discount on ' . $b['id'], $b['id'] );
					$b['ptsEarned'] = $new_earn;
				}
			}
			break;

		case 'redo':
			$made = wt_make_redo( $b, $in, $by );
			if ( is_wp_error( $made ) ) {
				return $made;
			}
			return array( 'booking' => $made, 'original' => $b );

		case 'note':
			$b['notes'] = mb_substr( sanitize_textarea_field( (string) ( $in['note'] ?? '' ) ), 0, 500 );
			break;

		case 'delete':
			if ( ! current_user_can( 'manage_options' ) ) {
				return wt_err( 'Only the admin can delete bookings.', 'wt_forbidden', 403 );
			}
			if ( 'Cancelled' !== $b['status'] && 'Completed' !== $b['status'] ) {
				wt_booking_refund_points( $b );
			}
			wt_rec_delete( 'booking', $b['id'] );
			return array( 'deleted' => true );

		default:
			return wt_err( 'Unknown action.' );
	}
	$saved = wt_rec_save( 'booking', $b, true );
	if ( is_wp_error( $saved ) ) {
		return $saved;
	}
	return array( 'booking' => $saved );
}

/* ---------- redo service ---------- */

const WT_REDO_DAYS = 1; // 24 hours after a completed groom (longer while a complaint is open).

/** Seconds left to book a redo for a completed booking (0 when the window has closed). */
function wt_redo_left( $b ) {
	if ( 'Completed' !== ( $b['status'] ?? '' ) || ! empty( $b['redo'] ) || ! empty( $b['redoRef'] ) ) {
		return 0;
	}
	if ( ! empty( $b['complaintRef'] ) && empty( $b['complaintClosed'] ) ) {
		return 7 * DAY_IN_SECONDS; // a complaint is open: the redo stays available until it is resolved
	}
	$done = wt_done_ts( $b );
	if ( ! $done ) {
		return 0;
	}
	return max( 0, $done + WT_REDO_DAYS * DAY_IN_SECONDS - time() );
}

/** When the groom was finished: the completion time, or the end of the booked day. */
function wt_done_ts( $b ) {
	return ! empty( $b['completedTs'] ) ? (int) $b['completedTs'] : (int) strtotime( ( $b['date'] ?? '' ) . ' 23:59:59 ' . wp_timezone_string() );
}

/** Book a free follow-up visit for a completed booking, linked both ways. $b is updated in place. */
function wt_make_redo( &$b, $in, $by ) {
	if ( ! wt_redo_left( $b ) ) {
		return wt_err( ! empty( $b['redoRef'] ) ? 'A redo is already booked: ' . $b['redoRef'] . '.' : 'Redo is only available for 24 hours after a completed groom, or while the customer has an open complaint.' );
	}
	$reason = mb_substr( sanitize_textarea_field( (string) ( $in['reason'] ?? '' ) ), 0, 300 );
	if ( mb_strlen( trim( $reason ) ) < 3 ) {
		return wt_err( 'Write why the service is being redone.' );
	}
	$date  = wt_str( $in, 'date', 10 );
	$start = wt_str( $in, 'start', 5 );
	$cfg   = wt_config();
	$mins  = ! empty( $b['mins'] ) ? (int) $b['mins'] : wt_pkg_mins( wt_find( $cfg['packages'], 'id', $b['pkg'] ?? '' ) );
	$ds    = wt_check_slot_desk( $b['city'], $date, $start, $mins, '', ! empty( $in['customTime'] ) );
	if ( is_wp_error( $ds ) ) {
		return $ds;
	}
	$keep = array( 'city', 'pkg', 'pkgName', 'custom', 'items', 'name', 'phone', 'acct', 'email', 'address', 'pincode', 'lat', 'lng', 'mapLink', 'petType', 'breed', 'gender', 'age', 'ageUnit', 'aggression' );
	$r    = array();
	foreach ( $keep as $k ) {
		if ( isset( $b[ $k ] ) ) {
			$r[ $k ] = $b[ $k ];
		}
	}
	$r = array_merge(
		$r,
		array(
			'date'        => $date,
			'start'       => $start,
			'slot'        => $ds[1],
			'mins'        => $mins,
			'addons'      => array(),
			'subtotal'    => 0,
			'coupon'      => '',
			'discount'    => 0,
			'pointsUsed'  => 0,
			'total'       => 0,
			'status'      => 'Confirmed',
			'pay'         => 'later',
			'payStatus'   => 'Paid',
			'payMode'     => '',
			'source'      => 'Redo',
			'by'          => $by,
			'byUid'       => get_current_user_id(),
			'redo'        => true,
			'redoOf'      => $b['id'],
			'redoReason'  => $reason,
			'notes'       => 'Redo of ' . $b['id'] . ': ' . $reason,
		)
	);
	if ( empty( $r['acct'] ) ) {
		$r['acct'] = $r['phone'];
	}
	$r = wt_rec_insert( 'booking', $r, 'WT' );
	$b['redoRef']    = $r['id'];
	$b['redoReason'] = $reason;
	$b['redoBy']     = $by;
	wt_rec_save( 'booking', $b );
	wt_notify_booking_new( $r );
	return $r;
}

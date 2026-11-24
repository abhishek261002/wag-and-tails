<?php
/**
 * Team tools: report downloads (CSV), report access for booking staff, attendance punch in/out,
 * monthly targets with milestone rewards, and the sales dashboard numbers.
 *
 * Sales = bookings that are Confirmed, Rescheduled or Completed (cancelled and unpaid online bookings are left out).
 * Sales charts use the service date. Team performance and targets use the day the booking was added.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const WT_SALE_STATUSES = array( 'Confirmed', 'Rescheduled', 'Completed' );

function wt_report_kinds() {
	return array(
		'customers'  => 'Customer data',
		'bookings'   => 'Booking data',
		'payments'   => 'Payment report',
		'attendance' => 'Attendance of all staff',
		'dashboard'  => 'Sales dashboard',
	);
}

/* ---------- team settings (targets, milestones, attendance) ---------- */

function wt_team_defaults() {
	return array(
		'attendanceOn' => true,
		'missedPct'    => 1,
		'milestones'   => array(
			array( 'pct' => 50, 'basis' => 'both', 'reward' => '₹500 bonus' ),
			array( 'pct' => 75, 'basis' => 'both', 'reward' => '₹1,000 bonus' ),
			array( 'pct' => 100, 'basis' => 'both', 'reward' => '₹2,000 bonus' ),
			array( 'pct' => 120, 'basis' => 'both', 'reward' => '₹3,000 bonus + certificate' ),
		),
		'targets'      => array(),
	);
}

function wt_team() {
	$t = get_option( 'wt_team' );
	return wp_parse_args( is_array( $t ) ? $t : array(), wt_team_defaults() );
}

function wt_team_save( $t ) {
	update_option( 'wt_team', $t, false );
}

/* ---------- who can do what ---------- */

function wt_is_staff_only() {
	return is_user_logged_in() && current_user_can( 'wt_desk' ) && ! current_user_can( 'manage_options' );
}

function wt_staff_perms( $uid ) {
	$p = get_user_meta( $uid, 'wt_reports', true );
	return array_values( array_intersect( (array) $p, array_keys( wt_report_kinds() ) ) );
}

function wt_can_report( $kind ) {
	if ( current_user_can( 'manage_options' ) ) {
		return true;
	}
	if ( ! current_user_can( 'wt_desk' ) ) {
		return false;
	}
	return in_array( $kind, wt_staff_perms( get_current_user_id() ), true );
}

/** Staff city scope ('all' or a city id). Admin is always 'all'. */
function wt_scope_city( $asked = 'all' ) {
	$scope = function_exists( 'wt_desk_city' ) ? wt_desk_city() : 'all';
	if ( 'all' !== $scope ) {
		return $scope;
	}
	return $asked && 'all' !== $asked && wt_city( $asked ) ? $asked : 'all';
}

/* ---------- attendance ---------- */

function wt_att_ref( $uid, $date ) {
	return 'AT-' . (int) $uid . '-' . str_replace( '-', '', $date );
}

function wt_att_get( $uid, $date ) {
	return wt_rec_get( 'attend', wt_att_ref( $uid, $date ) );
}

function wt_att_status( $a ) {
	if ( ! empty( $a['out'] ) ) {
		return 'Present';
	}
	return $a['date'] < wt_today() ? 'Missed punch-out' : 'On duty';
}

function wt_att_hours( $a ) {
	if ( empty( $a['outTs'] ) || empty( $a['inTs'] ) ) {
		return '';
	}
	return round( max( 0, $a['outTs'] - $a['inTs'] ) / 3600, 2 );
}

/** Is this booking-staff user allowed into the desk right now? */
function wt_att_on_duty( $uid ) {
	if ( empty( wt_team()['attendanceOn'] ) ) {
		return true;
	}
	$a = wt_att_get( $uid, wt_today() );
	return $a && empty( $a['out'] );
}

function wt_att_state( $uid ) {
	$on = ! empty( wt_team()['attendanceOn'] );
	$a  = wt_att_get( $uid, wt_today() );
	return array(
		'required' => $on,
		'in'       => $a ? $a['in'] : '',
		'out'      => $a ? $a['out'] : '',
		'onDuty'   => $on ? ( $a && empty( $a['out'] ) ) : true,
		'missedThisMonth' => wt_att_missed_count( $uid, substr( wt_today(), 0, 7 ) ),
		'missedPct'       => (float) wt_team()['missedPct'],
	);
}

function wt_att_list( $from, $to, $uid = 0 ) {
	global $wpdb;
	$sql  = 'SELECT data FROM ' . wt_table() . " WHERE type = 'attend' AND skey >= %s AND skey <= %s";
	$args = array( $from . '0000', $to . '2359' );
	if ( $uid ) {
		$sql   .= ' AND phone = %s';
		$args[] = (string) (int) $uid;
	}
	$sql .= ' ORDER BY skey DESC LIMIT 5000';
	$rows = $wpdb->get_col( $wpdb->prepare( $sql, $args ) ); // phpcs:ignore
	$out  = array();
	foreach ( $rows as $r ) {
		$a           = json_decode( $r, true );
		$a['status'] = wt_att_status( $a );
		$a['hours']  = wt_att_hours( $a );
		$out[]       = $a;
	}
	return $out;
}

function wt_att_missed_count( $uid, $month ) {
	$n = 0;
	foreach ( wt_att_list( $month . '-01', $month . '-31', $uid ) as $a ) {
		if ( 'Missed punch-out' === $a['status'] ) {
			++$n;
		}
	}
	return $n;
}

function wt_api_punch( $in ) {
	$uid = get_current_user_id();
	$u   = wp_get_current_user();
	$day = wt_today();
	$a   = wt_att_get( $uid, $day );
	if ( 'in' === ( $in['action'] ?? '' ) ) {
		if ( $a ) {
			return wt_err( $a['out'] ? 'You already punched out today at ' . $a['out'] . '.' : 'You are already punched in since ' . $a['in'] . '.' );
		}
		$a = wt_rec_insert(
			'attend',
			array(
				'id'    => wt_att_ref( $uid, $day ),
				'acct'  => (string) $uid,
				'uid'   => $uid,
				'name'  => $u->display_name ? $u->display_name : $u->user_login,
				'city'  => get_user_meta( $uid, 'wt_city', true ) ? get_user_meta( $uid, 'wt_city', true ) : 'all',
				'date'  => $day,
				'in'    => wp_date( 'g:i A' ),
				'inTs'  => time(),
				'out'   => '',
				'outTs' => 0,
			),
			'AT'
		);
	} elseif ( 'out' === ( $in['action'] ?? '' ) ) {
		if ( ! $a ) {
			return wt_err( 'You have not punched in today.' );
		}
		if ( $a['out'] ) {
			return wt_err( 'You already punched out at ' . $a['out'] . '.' );
		}
		$a['out']   = wp_date( 'g:i A' );
		$a['outTs'] = time();
		wt_rec_save( 'attend', $a );
	} else {
		return wt_err( 'Unknown action.' );
	}
	return array( 'att' => wt_att_state( $uid ) );
}

/** Admin: list attendance, or set a missed punch-out time. */
function wt_api_attendance( $in ) {
	$from = wt_ymd( $in['from'] ?? '', wt_today( -30 ) );
	$to   = wt_ymd( $in['to'] ?? '', wt_today() );
	$uid  = current_user_can( 'manage_options' ) || wt_can_report( 'attendance' ) ? (int) ( $in['uid'] ?? 0 ) : get_current_user_id();
	return array( 'list' => wt_att_list( $from, $to, $uid ) );
}

function wt_api_attendance_fix( $in ) {
	$a = wt_rec_get( 'attend', sanitize_text_field( $in['ref'] ?? '' ) );
	if ( ! $a ) {
		return wt_err( 'Attendance record not found.', 'wt_404', 404 );
	}
	if ( 'delete' === ( $in['action'] ?? '' ) ) {
		wt_rec_delete( 'attend', $a['id'] );
		return array( 'ok' => true );
	}
	$t = sanitize_text_field( $in['out'] ?? '' );
	if ( ! preg_match( '/^(\d{1,2}):(\d{2})$/', $t, $m ) ) {
		return wt_err( 'Enter the punch-out time.' );
	}
	$ts = strtotime( $a['date'] . ' ' . $t . ':00 ' . wp_timezone_string() );
	if ( $ts && $ts < $a['inTs'] ) {
		return wt_err( 'Punch-out must be after punch-in (' . $a['in'] . ').' );
	}
	$a['out']     = wp_date( 'g:i A', $ts );
	$a['outTs']   = $ts;
	$a['fixedBy'] = wp_get_current_user()->display_name;
	wt_rec_save( 'attend', $a );
	return array( 'ok' => true );
}

/* ---------- booking data used by reports and charts ---------- */

function wt_ymd( $v, $fallback ) {
	$v = (string) $v;
	return preg_match( '/^\d{4}-\d{2}-\d{2}$/', $v ) ? $v : $fallback;
}

/** Every booking with the day it was added (site time). Cached for the request. */
function wt_all_bookings() {
	static $cache = null;
	if ( null !== $cache ) {
		return $cache;
	}
	global $wpdb;
	$rows  = $wpdb->get_results( 'SELECT data, created_at FROM ' . wt_table() . " WHERE type = 'booking' ORDER BY skey ASC", ARRAY_A ); // phpcs:ignore
	$cache = array();
	foreach ( $rows as $r ) {
		$b = json_decode( $r['data'], true );
		if ( ! is_array( $b ) ) {
			continue;
		}
		$b['_added'] = substr( (string) $r['created_at'], 0, 10 );
		$cache[]     = $b;
	}
	return $cache;
}

function wt_is_sale( $b ) {
	return empty( $b['redo'] ) && in_array( $b['status'] ?? '', WT_SALE_STATUSES, true );
}

/** Staff user id => display name, plus a name lookup for older bookings saved before user ids were stored. */
function wt_staff_index() {
	static $idx = null;
	if ( null !== $idx ) {
		return $idx;
	}
	$idx = array(
		'byId'   => array(),
		'byName' => array(),
	);
	foreach ( get_users( array( 'role' => 'wt_desk', 'number' => 300 ) ) as $u ) {
		$name                                     = $u->display_name ? $u->display_name : $u->user_login;
		$idx['byId'][ $u->ID ]                    = $name;
		$idx['byName'][ strtolower( trim( $name ) ) ] = $u->ID;
	}
	return $idx;
}

/** Who added a booking: a staff user id, 'admin', or '' (website / imported). */
function wt_booking_owner( $b ) {
	if ( ! empty( $b['byUid'] ) ) {
		$u = get_userdata( (int) $b['byUid'] );
		if ( $u && user_can( $u, 'manage_options' ) ) {
			return 'admin';
		}
		return (int) $b['byUid'];
	}
	$by = strtolower( trim( (string) ( $b['by'] ?? '' ) ) );
	if ( 'admin' === $by ) {
		return 'admin';
	}
	$idx = wt_staff_index();
	return isset( $idx['byName'][ $by ] ) ? $idx['byName'][ $by ] : '';
}

/* ---------- numbers for the dashboard ---------- */

function wt_add_to( &$bucket, $b ) {
	$bucket['count'] = ( $bucket['count'] ?? 0 ) + 1;
	$bucket['value'] = ( $bucket['value'] ?? 0 ) + (float) ( $b['total'] ?? 0 );
}

function wt_sales_stats( $from, $to, $city ) {
	$today      = wt_today();
	$cur_month  = substr( $today, 0, 7 );
	$prev_month = wp_date( 'Y-m', strtotime( $cur_month . '-01 -1 month' ) );
	$cur_year   = (int) substr( $today, 0, 4 );
	$prev_year  = $cur_year - 1;
	$md         = substr( $today, 5 ); // mm-dd for "year to date".
	$months     = array();
	for ( $i = 11; $i >= 0; $i-- ) {
		$months[ wp_date( 'Y-m', strtotime( $cur_month . '-01 -' . $i . ' month' ) ) ] = array( 'count' => 0, 'value' => 0 );
	}
	$out = array(
		'range'     => array( 'from' => $from, 'to' => $to, 'city' => $city ),
		'total'     => array( 'count' => 0, 'value' => 0 ),
		'cities'    => array(),
		'team'      => array(),
		'monthly'   => array(),
		'thisMonth' => array( 'label' => wp_date( 'M Y', strtotime( $cur_month . '-01' ) ), 'count' => 0, 'value' => 0 ),
		'lastMonth' => array( 'label' => wp_date( 'M Y', strtotime( $prev_month . '-01' ) ), 'count' => 0, 'value' => 0 ),
		'years'     => array(
			'cur'      => $cur_year,
			'prev'     => $prev_year,
			'curVals'  => array_fill( 0, 12, 0 ),
			'prevVals' => array_fill( 0, 12, 0 ),
			'curCnt'   => array_fill( 0, 12, 0 ),
			'prevCnt'  => array_fill( 0, 12, 0 ),
		),
		'ytd'       => array( 'asOf' => wp_date( 'j M', strtotime( $today ) ), 'cur' => array( 'count' => 0, 'value' => 0 ), 'prev' => array( 'count' => 0, 'value' => 0 ) ),
		'cancelled' => 0,
	);
	$idx  = wt_staff_index();
	$team = array();
	foreach ( wt_all_bookings() as $b ) {
		if ( 'all' !== $city && ( $b['city'] ?? '' ) !== $city ) {
			continue;
		}
		$d = (string) ( $b['date'] ?? '' );
		if ( ! wt_is_sale( $b ) ) {
			if ( 'Cancelled' === ( $b['status'] ?? '' ) && $d >= $from && $d <= $to ) {
				++$out['cancelled'];
			}
			continue;
		}
		$m = substr( $d, 0, 7 );
		$y = (int) substr( $d, 0, 4 );
		if ( $d >= $from && $d <= $to ) {
			wt_add_to( $out['total'], $b );
			$cid = $b['city'] ?? '';
			if ( ! isset( $out['cities'][ $cid ] ) ) {
				$out['cities'][ $cid ] = array( 'id' => $cid, 'name' => wt_city_name( $cid ), 'count' => 0, 'value' => 0 );
			}
			wt_add_to( $out['cities'][ $cid ], $b );
		}
		if ( isset( $months[ $m ] ) ) {
			wt_add_to( $months[ $m ], $b );
		}
		if ( $m === $cur_month ) {
			wt_add_to( $out['thisMonth'], $b );
		} elseif ( $m === $prev_month ) {
			wt_add_to( $out['lastMonth'], $b );
		}
		$mi = (int) substr( $d, 5, 2 ) - 1;
		if ( $mi >= 0 && $mi < 12 ) {
			if ( $y === $cur_year ) {
				$out['years']['curVals'][ $mi ] += (float) ( $b['total'] ?? 0 );
				++$out['years']['curCnt'][ $mi ];
				if ( substr( $d, 5 ) <= $md ) {
					wt_add_to( $out['ytd']['cur'], $b );
				}
			} elseif ( $y === $prev_year ) {
				$out['years']['prevVals'][ $mi ] += (float) ( $b['total'] ?? 0 );
				++$out['years']['prevCnt'][ $mi ];
				if ( substr( $d, 5 ) <= $md ) {
					wt_add_to( $out['ytd']['prev'], $b );
				}
			}
		}
		// Team: bookings added by staff or admin within the range (by day added).
		$added = $b['_added'];
		if ( $added >= $from && $added <= $to ) {
			$own = wt_booking_owner( $b );
			if ( '' !== $own ) {
				$key = (string) $own;
				if ( ! isset( $team[ $key ] ) ) {
					$team[ $key ] = array( 'uid' => $own, 'name' => 'admin' === $own ? 'Admin' : ( $idx['byId'][ $own ] ?? ( $b['by'] ?? 'Staff' ) ), 'count' => 0, 'value' => 0 );
				}
				wt_add_to( $team[ $key ], $b );
			}
		}
	}
	foreach ( $months as $k => $v ) {
		$out['monthly'][] = array( 'm' => $k, 'label' => wp_date( 'M y', strtotime( $k . '-01' ) ), 'count' => $v['count'], 'value' => $v['value'] );
	}
	$out['cities'] = array_values( $out['cities'] );
	usort(
		$out['cities'],
		function ( $a, $b ) {
			return $b['value'] <=> $a['value'];
		}
	);
	// Every staff member appears, even with no bookings yet.
	foreach ( $idx['byId'] as $uid => $name ) {
		if ( ! isset( $team[ (string) $uid ] ) ) {
			$team[ (string) $uid ] = array( 'uid' => $uid, 'name' => $name, 'count' => 0, 'value' => 0 );
		}
	}
	$out['team'] = array_values( $team );
	usort(
		$out['team'],
		function ( $a, $b ) {
			return $b['value'] <=> $a['value'];
		}
	);
	return $out;
}

function wt_api_stats( $in ) {
	if ( ! wt_can_report( 'dashboard' ) ) {
		return wt_err( 'You do not have access to the sales dashboard.', 'wt_forbidden', 403 );
	}
	$from = wt_ymd( $in['from'] ?? '', substr( wt_today(), 0, 7 ) . '-01' );
	$to   = wt_ymd( $in['to'] ?? '', wt_today() );
	if ( $from > $to ) {
		list( $from, $to ) = array( $to, $from );
	}
	return wt_sales_stats( $from, $to, wt_scope_city( sanitize_text_field( $in['city'] ?? 'all' ) ) );
}

/* ---------- loyal customers (booked grooming more than once) ---------- */

/** Top 50 repeat grooming customers, all time, by number of grooms then money spent. */
function wt_api_loyal( $in ) {
	if ( ! wt_can_report( 'dashboard' ) ) {
		return wt_err( 'You do not have access to the sales dashboard.', 'wt_forbidden', 403 );
	}
	$city = wt_scope_city( sanitize_text_field( $in['city'] ?? 'all' ) );
	$min  = max( 2, (int) ( $in['min'] ?? 2 ) );
	$rows = array();
	foreach ( wt_all_bookings() as $b ) {
		if ( ! wt_is_sale( $b ) || ( 'all' !== $city && ( $b['city'] ?? '' ) !== $city ) ) {
			continue;
		}
		$p = wt_phone( $b['phone'] ?? '' );
		if ( strlen( $p ) !== 10 ) {
			continue;
		}
		if ( ! isset( $rows[ $p ] ) ) {
			$rows[ $p ] = array( 'phone' => $p, 'name' => '', 'city' => '', 'count' => 0, 'spent' => 0, 'first' => '9999', 'last' => '', 'pets' => array() );
		}
		$r = &$rows[ $p ];
		++$r['count'];
		$r['spent'] += (float) ( $b['total'] ?? 0 );
		$d = (string) ( $b['date'] ?? '' );
		$r['first'] = min( $r['first'], $d );
		if ( $d >= $r['last'] ) {
			$r['last'] = $d;
			$r['name'] = $b['name'] ?? $r['name'];
			$r['city'] = $b['city'] ?? $r['city'];
		}
		if ( ! empty( $b['petName'] ) ) {
			$r['pets'][ strtolower( $b['petName'] ) ] = $b['petName'];
		}
		unset( $r );
	}
	$rows = array_filter( $rows, function ( $r ) use ( $min ) { return $r['count'] >= $min; } ); // phpcs:ignore
	usort(
		$rows,
		function ( $a, $b ) {
			return array( $b['count'], $b['spent'] ) <=> array( $a['count'], $a['spent'] );
		}
	);
	$total  = count( $rows );
	$rows   = array_slice( $rows, 0, 50 );
	$last   = array();
	foreach ( wt_rec_list( 'reward', array( 'phone' => wp_list_pluck( $rows, 'phone' ) ), 'id DESC', 2000 ) as $rw ) {
		if ( ! isset( $last[ $rw['phone'] ] ) ) {
			$last[ $rw['phone'] ] = array( 'what' => $rw['what'], 'at' => $rw['at'], 'by' => $rw['by'], 'count' => 0 );
		}
		++$last[ $rw['phone'] ]['count'];
	}
	foreach ( $rows as $i => &$r ) {
		$r['rank']     = $i + 1;
		$r['cityName'] = wt_city_name( $r['city'] );
		$r['pets']     = array_values( $r['pets'] );
		$r['spent']    = round( $r['spent'], 2 );
		$r['points']   = wt_points_balance( $r['phone'] );
		$r['reward']   = $last[ $r['phone'] ] ?? null;
	}
	unset( $r );
	return array(
		'list'   => $rows,
		'total'  => $total,
		'city'   => $city,
		'pointValue' => (float) wt_config()['rewards']['pointValue'],
	);
}

/** Reward a loyal customer: bonus points and/or a gift note, with an optional WhatsApp message. */
function wt_api_loyal_reward( $in ) {
	if ( ! wt_can_report( 'dashboard' ) ) {
		return wt_err( 'You do not have access to the sales dashboard.', 'wt_forbidden', 403 );
	}
	$phone = wt_phone( $in['phone'] ?? '' );
	if ( ! wt_valid_mobile( $phone ) ) {
		return wt_err( 'Pick a customer.' );
	}
	$scope = wt_scope_city( 'all' );
	$name  = '';
	$found = false;
	foreach ( wt_all_bookings() as $b ) {
		if ( wt_phone( $b['phone'] ?? '' ) === $phone && wt_is_sale( $b ) && ( 'all' === $scope || ( $b['city'] ?? '' ) === $scope ) ) {
			$found = true;
			$name  = $b['name'] ?? $name;
		}
	}
	if ( ! $found ) {
		return wt_err( 'This customer has no grooming bookings you can see.' );
	}
	$pts  = (int) ( $in['points'] ?? 0 );
	$gift = trim( sanitize_text_field( wp_unslash( (string) ( $in['gift'] ?? '' ) ) ) );
	$gift = mb_substr( $gift, 0, 200 );
	if ( $pts < 0 || $pts > 5000 ) {
		return wt_err( 'Give between 1 and 5000 points.' );
	}
	if ( ! $pts && '' === $gift ) {
		return wt_err( 'Enter bonus points or write the gift / offer.' );
	}
	$by   = wt_desk_name();
	$what = trim( ( $pts ? $pts . ' bonus points' : '' ) . ( $pts && $gift ? ' + ' : '' ) . $gift );
	$ref  = wt_rec_insert(
		'reward',
		array(
			'phone'  => $phone,
			'name'   => $name,
			'points' => $pts,
			'gift'   => $gift,
			'what'   => $what,
			'by'     => $by,
			'at'     => wt_now_label(),
		),
		'RW'
	);
	$ref = is_array( $ref ) ? ( $ref['id'] ?? '' ) : (string) $ref;
	if ( $pts ) {
		wt_points_add( $phone, $pts, 'Loyal customer reward' . ( $gift ? ': ' . $gift : '' ) . ' (by ' . $by . ')', $ref );
	}
	$bal  = wt_points_balance( $phone );
	$sent = false;
	if ( ! empty( $in['notify'] ) ) {
		$first = wt_first( $name );
		$text  = sprintf( 'Hi %s, thank you for being one of our most loyal Wag & Tails customers! 🐾 ', $first );
		if ( $pts ) {
			$text .= sprintf( 'We have added %d bonus reward points to your account. Your balance is %d points, which you can use on your next booking or order at wagandtails.in. ', $pts, $bal );
		}
		if ( $gift ) {
			$text .= 'Your thank-you gift: ' . $gift . '. ';
		}
		$text .= '– Team Wag & Tails';
		if ( $pts ) {
			wt_whatsapp( $phone, 'points_earned', array( $first, $pts, $bal ), $text );
		} else {
			wt_whatsapp( $phone, 'loyal_reward', array( $first, $gift ), $text );
		}
		$sent = true;
	}
	return array( 'ok' => true, 'balance' => $bal, 'what' => $what, 'sent' => $sent );
}

/* ---------- targets ---------- */

function wt_month( $v ) {
	$v = (string) $v;
	return preg_match( '/^\d{4}-\d{2}$/', $v ) ? $v : substr( wt_today(), 0, 7 );
}

/** Achievement of one staff member for a month: per city and overall, after the missed punch-out deduction. */
function wt_target_progress( $uid, $month ) {
	$team    = wt_team();
	$targets = $team['targets'][ $month ][ (string) $uid ] ?? array();
	$missed  = wt_att_missed_count( $uid, $month );
	$factor  = max( 0, 1 - $missed * (float) $team['missedPct'] / 100 );
	$by_city = array();
	foreach ( wt_all_bookings() as $b ) {
		if ( ! wt_is_sale( $b ) || substr( $b['_added'], 0, 7 ) !== $month ) {
			continue;
		}
		if ( (string) wt_booking_owner( $b ) !== (string) $uid ) {
			continue;
		}
		$cid = $b['city'] ?? '';
		if ( ! isset( $by_city[ $cid ] ) ) {
			$by_city[ $cid ] = array( 'count' => 0, 'value' => 0 );
		}
		wt_add_to( $by_city[ $cid ], $b );
	}
	$rows = array();
	$tot  = array( 'tValue' => 0, 'tQty' => 0, 'rawValue' => 0, 'rawQty' => 0 );
	foreach ( array_unique( array_merge( array_keys( $targets ), array_keys( $by_city ) ) ) as $cid ) {
		$t   = $targets[ $cid ] ?? array( 'value' => 0, 'qty' => 0 );
		$got = $by_city[ $cid ] ?? array( 'count' => 0, 'value' => 0 );
		$row = array(
			'city'     => $cid,
			'name'     => wt_city_name( $cid ),
			'tValue'   => (float) $t['value'],
			'tQty'     => (int) $t['qty'],
			'rawValue' => (float) $got['value'],
			'rawQty'   => (int) $got['count'],
			'value'    => round( $got['value'] * $factor, 2 ),
			'qty'      => round( $got['count'] * $factor, 2 ),
		);
		$row['valuePct'] = $row['tValue'] > 0 ? round( $row['value'] / $row['tValue'] * 100, 1 ) : null;
		$row['qtyPct']   = $row['tQty'] > 0 ? round( $row['qty'] / $row['tQty'] * 100, 1 ) : null;
		$rows[]          = $row;
		$tot['tValue']  += $row['tValue'];
		$tot['tQty']    += $row['tQty'];
		$tot['rawValue'] += $row['rawValue'];
		$tot['rawQty']  += $row['rawQty'];
	}
	$tot['value']    = round( $tot['rawValue'] * $factor, 2 );
	$tot['qty']      = round( $tot['rawQty'] * $factor, 2 );
	$tot['valuePct'] = $tot['tValue'] > 0 ? round( $tot['value'] / $tot['tValue'] * 100, 1 ) : null;
	$tot['qtyPct']   = $tot['tQty'] > 0 ? round( $tot['qty'] / $tot['tQty'] * 100, 1 ) : null;
	$miles           = array();
	foreach ( $team['milestones'] as $ms ) {
		$pct   = (float) $ms['pct'];
		$basis = $ms['basis'] ?? 'both';
		$v_ok  = null !== $tot['valuePct'] && $tot['valuePct'] >= $pct;
		$q_ok  = null !== $tot['qtyPct'] && $tot['qtyPct'] >= $pct;
		$has_t = ( 'value' === $basis && $tot['tValue'] > 0 ) || ( 'qty' === $basis && $tot['tQty'] > 0 ) || ( 'both' === $basis && ( $tot['tValue'] > 0 || $tot['tQty'] > 0 ) );
		if ( 'both' === $basis ) {
			$ok = $has_t && ( $tot['tValue'] <= 0 || $v_ok ) && ( $tot['tQty'] <= 0 || $q_ok );
		} else {
			$ok = $has_t && ( 'value' === $basis ? $v_ok : $q_ok );
		}
		$miles[] = array( 'pct' => $pct, 'basis' => $basis, 'reward' => $ms['reward'], 'reached' => $ok );
	}
	return array(
		'month'     => $month,
		'uid'       => $uid,
		'missed'    => $missed,
		'deductPct' => round( ( 1 - $factor ) * 100, 2 ),
		'cities'    => $rows,
		'total'     => $tot,
		'milestones' => $miles,
		'hasTarget' => $tot['tValue'] > 0 || $tot['tQty'] > 0,
	);
}

/** Admin: staff list with report access, targets and progress for a month; team settings. */
function wt_api_team( $in ) {
	$month = wt_month( $in['month'] ?? '' );
	$team  = wt_team();
	$staff = array();
	foreach ( get_users( array( 'role' => 'wt_desk', 'number' => 300 ) ) as $u ) {
		$staff[] = array(
			'id'       => $u->ID,
			'name'     => $u->display_name ? $u->display_name : $u->user_login,
			'city'     => get_user_meta( $u->ID, 'wt_city', true ) ? get_user_meta( $u->ID, 'wt_city', true ) : 'all',
			'perms'    => wt_staff_perms( $u->ID ),
			'targets'  => $team['targets'][ $month ][ (string) $u->ID ] ?? new stdClass(),
			'progress' => wt_target_progress( $u->ID, $month ),
			'att'      => wt_att_state( $u->ID ),
		);
	}
	return array(
		'month'    => $month,
		'kinds'    => wt_report_kinds(),
		'settings' => array(
			'attendanceOn' => (bool) $team['attendanceOn'],
			'missedPct'    => (float) $team['missedPct'],
			'milestones'   => array_values( $team['milestones'] ),
		),
		'staff'    => $staff,
	);
}

function wt_api_team_save( $in ) {
	$team = wt_team();
	$what = $in['what'] ?? '';
	if ( 'perms' === $what ) {
		$uid = (int) ( $in['uid'] ?? 0 );
		$u   = get_userdata( $uid );
		if ( ! $u || ! in_array( 'wt_desk', (array) $u->roles, true ) ) {
			return wt_err( 'Staff member not found.' );
		}
		$p = array_values( array_intersect( (array) ( $in['perms'] ?? array() ), array_keys( wt_report_kinds() ) ) );
		update_user_meta( $uid, 'wt_reports', $p );
		return array( 'ok' => true, 'perms' => $p );
	}
	if ( 'targets' === $what ) {
		$month = wt_month( $in['month'] ?? '' );
		$uid   = (string) (int) ( $in['uid'] ?? 0 );
		$clean = array();
		foreach ( (array) ( $in['targets'] ?? array() ) as $cid => $t ) {
			$cid = sanitize_key( $cid );
			if ( ! wt_city( $cid ) ) {
				continue;
			}
			$v = max( 0, (float) ( $t['value'] ?? 0 ) );
			$q = max( 0, (int) ( $t['qty'] ?? 0 ) );
			if ( $v > 0 || $q > 0 ) {
				$clean[ $cid ] = array( 'value' => $v, 'qty' => $q );
			}
		}
		$team['targets'][ $month ][ $uid ] = $clean;
		wt_team_save( $team );
		return array( 'ok' => true, 'progress' => wt_target_progress( (int) $uid, $month ) );
	}
	if ( 'copy' === $what ) {
		$month = wt_month( $in['month'] ?? '' );
		$prev  = wp_date( 'Y-m', strtotime( $month . '-01 -1 month' ) );
		if ( empty( $team['targets'][ $prev ] ) ) {
			return wt_err( 'No targets were set for ' . wp_date( 'F Y', strtotime( $prev . '-01' ) ) . '.' );
		}
		$team['targets'][ $month ] = $team['targets'][ $prev ];
		wt_team_save( $team );
		return array( 'ok' => true );
	}
	if ( 'settings' === $what ) {
		$team['attendanceOn'] = ! empty( $in['attendanceOn'] );
		$team['missedPct']    = min( 100, max( 0, (float) ( $in['missedPct'] ?? 1 ) ) );
		$ms                   = array();
		foreach ( (array) ( $in['milestones'] ?? array() ) as $m ) {
			$pct = (float) ( $m['pct'] ?? 0 );
			if ( $pct <= 0 ) {
				continue;
			}
			$ms[] = array(
				'pct'    => $pct,
				'basis'  => in_array( $m['basis'] ?? '', array( 'value', 'qty', 'both' ), true ) ? $m['basis'] : 'both',
				'reward' => sanitize_text_field( (string) ( $m['reward'] ?? '' ) ),
			);
		}
		usort(
			$ms,
			function ( $a, $b ) {
				return $a['pct'] <=> $b['pct'];
			}
		);
		$team['milestones'] = $ms;
		wt_team_save( $team );
		return array( 'ok' => true );
	}
	return wt_err( 'Unknown change.' );
}

/** Booking staff: own performance, target, attendance; plus which reports they may download. */
function wt_api_my( $in ) {
	$uid   = get_current_user_id();
	$month = wt_month( $in['month'] ?? '' );
	$team  = array();
	$seen  = array();
	// Own bookings by city and over the last 6 months (by day added).
	$six = array();
	for ( $i = 5; $i >= 0; $i-- ) {
		$k         = wp_date( 'Y-m', strtotime( substr( wt_today(), 0, 7 ) . '-01 -' . $i . ' month' ) );
		$six[ $k ] = array( 'm' => $k, 'label' => wp_date( 'M y', strtotime( $k . '-01' ) ), 'count' => 0, 'value' => 0 );
	}
	$cities = array();
	foreach ( wt_all_bookings() as $b ) {
		if ( ! wt_is_sale( $b ) || (string) wt_booking_owner( $b ) !== (string) $uid ) {
			continue;
		}
		$m = substr( $b['_added'], 0, 7 );
		if ( isset( $six[ $m ] ) ) {
			wt_add_to( $six[ $m ], $b );
		}
		if ( $m === $month ) {
			$cid = $b['city'] ?? '';
			if ( ! isset( $cities[ $cid ] ) ) {
				$cities[ $cid ] = array( 'id' => $cid, 'name' => wt_city_name( $cid ), 'count' => 0, 'value' => 0 );
			}
			wt_add_to( $cities[ $cid ], $b );
		}
	}
	$t = wt_team();
	return array(
		'month'      => $month,
		'progress'   => wt_target_progress( $uid, $month ),
		'cities'     => array_values( $cities ),
		'months'     => array_values( $six ),
		'attendance' => wt_att_list( $month . '-01', $month . '-31', $uid ),
		'att'        => wt_att_state( $uid ),
		'perms'      => wt_staff_perms( $uid ),
		'kinds'      => wt_report_kinds(),
		'missedPct'  => (float) $t['missedPct'],
	);
}

/* ---------- CSV downloads ---------- */

function wt_csv_send( $filename, $head, $rows ) {
	nocache_headers();
	header( 'Content-Type: text/csv; charset=utf-8' );
	header( 'Content-Disposition: attachment; filename="' . $filename . '"' );
	$out = fopen( 'php://output', 'w' );
	fwrite( $out, "\xEF\xBB\xBF" ); // Excel reads ₹ and Hindi names correctly with this.
	fputcsv( $out, $head );
	foreach ( $rows as $r ) {
		fputcsv(
			$out,
			array_map(
				function ( $v ) {
					$v = is_array( $v ) ? implode( ', ', $v ) : (string) $v;
					// Stop spreadsheet formulas from running when the file is opened.
					return preg_match( '/^[=+\-@]/', $v ) && ! is_numeric( $v ) ? "'" . $v : $v;
				},
				$r
			)
		);
	}
	fclose( $out );
	exit;
}

function wt_api_report( $in ) {
	$kind = sanitize_key( $in['kind'] ?? '' );
	if ( ! array_key_exists( $kind, wt_report_kinds() ) || 'dashboard' === $kind ) {
		return wt_err( 'Unknown report.' );
	}
	$self_att = 'attendance' === $kind && wt_is_staff_only() && ! wt_can_report( 'attendance' );
	if ( ! $self_att && ! wt_can_report( $kind ) ) {
		return wt_err( 'You do not have access to this report. Ask the admin.', 'wt_forbidden', 403 );
	}
	$from  = wt_ymd( $in['from'] ?? '', '2000-01-01' );
	$to    = wt_ymd( $in['to'] ?? '', '2100-12-31' );
	$city  = wt_scope_city( sanitize_text_field( $in['city'] ?? 'all' ) );
	$stamp = wp_date( 'Y-m-d' );
	$tag   = ( 'all' === $city ? '' : '-' . $city ) . ( '2000-01-01' === $from ? '' : '-' . $from . '-to-' . $to );

	if ( 'bookings' === $kind || 'payments' === $kind ) {
		$rows = array();
		foreach ( wt_all_bookings() as $b ) {
			$d = (string) ( $b['date'] ?? '' );
			if ( $d < $from || $d > $to || ( 'all' !== $city && ( $b['city'] ?? '' ) !== $city ) ) {
				continue;
			}
			if ( 'payments' === $kind && ! wt_is_sale( $b ) ) {
				continue;
			}
			$rows[] = $b;
		}
		if ( 'bookings' === $kind ) {
			$head = array( 'Booking ID', 'Service date', 'Time', 'City', 'Status', 'Customer', 'Phone', 'Email', 'Address', 'Pincode', 'Pet', 'Breed', 'Gender', 'Age', 'Aggression', 'Package', 'Add-ons', 'Subtotal', 'Coupon', 'Discount', 'Points used', 'Discount after booking', 'Discount reason', 'Discount given by', 'Total', 'Payment status', 'Payment mode', 'Booked via', 'Added by', 'Added on', 'Cancel reason', 'Notes' );
			$out  = array_map(
				function ( $b ) {
					return array( $b['id'], $b['date'] ?? '', $b['slot'] ?? '', wt_city_name( $b['city'] ?? '' ), $b['status'] ?? '', $b['name'] ?? '', $b['phone'] ?? '', $b['email'] ?? '', $b['address'] ?? '', $b['pincode'] ?? '', $b['petType'] ?? '', $b['breed'] ?? '', $b['gender'] ?? '', $b['age'] ?? '', $b['aggression'] ?? '', wt_report_pkg( $b ), implode( ', ', array_column( (array) ( $b['addonItems'] ?? array() ), 'name' ) ), $b['subtotal'] ?? '', $b['coupon'] ?? '', $b['discount'] ?? '', $b['pointsUsed'] ?? 0, $b['extraDiscount'] ?? 0, $b['discountReason'] ?? '', $b['discountBy'] ?? '', $b['total'] ?? '', $b['payStatus'] ?? '', $b['payMode'] ?? '', $b['source'] ?? 'Website', $b['by'] ?? '', $b['_added'], $b['cancelReason'] ?? '', $b['notes'] ?? '' );
				},
				$rows
			);
			wt_csv_send( 'wag-tails-bookings' . $tag . '-' . $stamp . '.csv', $head, $out );
		}
		$head = array( 'Booking ID', 'Service date', 'City', 'Customer', 'Phone', 'Package', 'Booking status', 'Amount', 'Payment status', 'Received as', 'Paid via', 'Razorpay payment ID', 'Recorded by', 'Recorded on', 'Added by' );
		$out  = array_map(
			function ( $b ) {
				$paid = 'Paid' === ( $b['payStatus'] ?? '' ) || ! empty( $b['payMode'] );
				$via  = ! empty( $b['payId'] ) && 'free' !== $b['payId'] ? 'Razorpay (website)' : ( $paid ? 'Booking desk' : '' );
				return array( $b['id'], $b['date'] ?? '', wt_city_name( $b['city'] ?? '' ), $b['name'] ?? '', $b['phone'] ?? '', wt_report_pkg( $b ), $b['status'] ?? '', $b['total'] ?? 0, $paid ? 'Paid' : 'Due', $b['payMode'] ?? '', $via, ( $b['payId'] ?? '' ) !== 'free' ? ( $b['payId'] ?? '' ) : '', $b['payBy'] ?? ( $b['closedBy'] ?? '' ), $b['payAt'] ?? ( $b['completedAt'] ?? '' ), $b['by'] ?? '' );
			},
			$rows
		);
		wt_csv_send( 'wag-tails-payments' . $tag . '-' . $stamp . '.csv', $head, $out );
	}

	if ( 'customers' === $kind ) {
		$list  = wt_api_customers()['list'];
		$spend = array();
		foreach ( wt_all_bookings() as $b ) {
			$p = $b['phone'] ?? '';
			if ( ! $p ) {
				continue;
			}
			if ( ! isset( $spend[ $p ] ) ) {
				$spend[ $p ] = array( 'value' => 0, 'last' => '', 'city' => '', 'first' => '' );
			}
			if ( wt_is_sale( $b ) ) {
				$spend[ $p ]['value'] += (float) ( $b['total'] ?? 0 );
				if ( ( $b['date'] ?? '' ) > $spend[ $p ]['last'] ) {
					$spend[ $p ]['last'] = $b['date'];
					$spend[ $p ]['city'] = $b['city'] ?? '';
				}
				if ( ! $spend[ $p ]['first'] || ( $b['date'] ?? '' ) < $spend[ $p ]['first'] ) {
					$spend[ $p ]['first'] = $b['date'];
				}
			}
		}
		$out = array();
		foreach ( $list as $c ) {
			$s = $spend[ $c['phone'] ] ?? array( 'value' => 0, 'last' => '', 'city' => '', 'first' => '' );
			if ( 'all' !== $city && $s['city'] !== $city ) {
				continue;
			}
			$out[] = array( $c['name'], $c['phone'], $c['email'], $s['city'] ? wt_city_name( $s['city'] ) : '', $c['registered'] ? 'Yes' : 'No', $c['bookings'], $s['value'], $s['first'], $s['last'], $c['points'] );
		}
		wt_csv_send( 'wag-tails-customers' . ( 'all' === $city ? '' : '-' . $city ) . '-' . $stamp . '.csv', array( 'Name', 'Phone', 'Email', 'City (last booking)', 'Has account', 'Bookings', 'Total spent', 'First booking', 'Last booking', 'Reward points' ), $out );
	}

	// Attendance.
	$uid = $self_att ? get_current_user_id() : (int) ( $in['uid'] ?? 0 );
	if ( '2000-01-01' === $from ) {
		$from = wt_today( -30 );
		$to   = wt_today();
	}
	$out = array_map(
		function ( $a ) {
			return array( $a['date'], $a['name'], 'all' === ( $a['city'] ?? 'all' ) ? 'All cities' : wt_city_name( $a['city'] ), $a['in'], $a['out'], $a['hours'], $a['status'], $a['fixedBy'] ?? '' );
		},
		wt_att_list( $from, $to, $uid )
	);
	wt_csv_send( 'wag-tails-attendance-' . $from . '-to-' . $to . '.csv', array( 'Date', 'Staff', 'City', 'Punch in', 'Punch out', 'Hours', 'Status', 'Punch-out added by' ), $out );
}

function wt_report_pkg( $b ) {
	$p = wt_find( wt_config()['packages'], 'id', $b['pkg'] ?? '' );
	return $p ? $p['name'] : ( $b['pkgName'] ?? ( $b['pkg'] ?? '' ) );
}

/* ---------- routes ---------- */

function wt_can_staff_or_admin() {
	return current_user_can( 'wt_desk' ) || current_user_can( 'manage_options' );
}
function wt_can_staff_only() {
	return wt_is_staff_only();
}

add_action(
	'rest_api_init',
	function () {
		$routes = array(
			array( 'POST', 'attendance/punch', 'wt_can_staff_only', 'wt_api_punch' ),
			array( 'GET', 'attendance', 'wt_can_staff_or_admin', 'wt_api_attendance' ),
			array( 'POST', 'attendance/fix', 'wt_can_admin', 'wt_api_attendance_fix' ),
			array( 'GET', 'my', 'wt_can_staff_only', 'wt_api_my' ),
			array( 'GET', 'stats', 'wt_can_staff_or_admin', 'wt_api_stats' ),
			array( 'GET', 'loyal', 'wt_can_staff_or_admin', 'wt_api_loyal' ),
			array( 'POST', 'loyal/reward', 'wt_can_staff_or_admin', 'wt_api_loyal_reward' ),
			array( 'GET', 'team', 'wt_can_admin', 'wt_api_team' ),
			array( 'POST', 'team', 'wt_can_admin', 'wt_api_team_save' ),
			array( 'GET', 'report/(?P<kind>[a-z]+)', 'wt_can_staff_or_admin', 'wt_api_report' ),
		);
		foreach ( $routes as $rt ) {
			register_rest_route(
				'wt/v1',
				'/' . $rt[1],
				array(
					'methods'             => $rt[0],
					'permission_callback' => $rt[2],
					'callback'            => wt_rest( $rt[3] ),
				)
			);
		}
	}
);

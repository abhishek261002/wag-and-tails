<?php
/**
 * Storage for bookings, walk requests, insurance leads, enquiries, notification log and reward points.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function wt_table() {
	global $wpdb;
	return $wpdb->prefix . 'wt_records';
}

function wt_now() {
	return current_time( 'mysql' );
}

function wt_now_label() {
	return wp_date( 'j M, g:i A' );
}

function wt_today( $offset_days = 0 ) {
	return wp_date( 'Y-m-d', time() + $offset_days * DAY_IN_SECONDS );
}

/** Last 10 digits of an Indian mobile number. */
function wt_phone( $p ) {
	$d = preg_replace( '/\D/', '', (string) $p );
	return substr( $d, -10 );
}

function wt_valid_mobile( $p ) {
	return (bool) preg_match( '/^[6-9]\d{9}$/', (string) $p );
}

function wt_new_ref( $prefix ) {
	global $wpdb;
	do {
		$ref    = $prefix . '-' . strtoupper( substr( base_convert( (string) time(), 10, 36 ), -4 ) . wp_generate_password( 3, false, false ) );
		$exists = $wpdb->get_var( $wpdb->prepare( 'SELECT id FROM ' . wt_table() . ' WHERE ref = %s', $ref ) ); // phpcs:ignore
	} while ( $exists );
	return $ref;
}

/** Sort key "YYYY-MM-DDHHMM" from a date and a "10:00 AM" slot. */
function wt_skey( $date, $slot ) {
	$hm = '0000';
	if ( preg_match( '/(\d+):(\d+)\s*(AM|PM)/i', (string) $slot, $m ) ) {
		$h  = ( (int) $m[1] % 12 ) + ( 'PM' === strtoupper( $m[3] ) ? 12 : 0 );
		$hm = sprintf( '%02d%02d', $h, (int) $m[2] );
	}
	return (string) $date . $hm;
}

function wt_rec_cols( $type, $data ) {
	unset( $data['_rev'] ); // the revision lives in its own column, never inside the JSON
	return array(
		'type'       => $type,
		'ref'        => (string) $data['id'],
		'phone'      => wt_phone( isset( $data['acct'] ) ? $data['acct'] : ( isset( $data['phone'] ) ? $data['phone'] : '' ) ),
		'city'       => (string) ( isset( $data['city'] ) ? $data['city'] : '' ),
		'status'     => (string) ( isset( $data['status'] ) ? $data['status'] : '' ),
		'skey'       => isset( $data['date'] ) ? wt_skey( $data['date'], isset( $data['slot'] ) ? $data['slot'] : '' ) : '',
		'amount'     => (int) ( isset( $data['amount'] ) ? $data['amount'] : 0 ),
		'data'       => wp_json_encode( $data ),
		'updated_at' => wt_now(),
	);
}

function wt_rec_insert( $type, $data, $prefix ) {
	global $wpdb;
	if ( empty( $data['id'] ) ) {
		$data['id'] = wt_new_ref( $prefix );
	}
	if ( empty( $data['created'] ) ) {
		$data['created'] = wt_now_label();
	}
	$cols               = wt_rec_cols( $type, $data );
	$cols['created_at'] = wt_now();
	$cols['rev']        = 1;
	$wpdb->insert( wt_table(), $cols ); // phpcs:ignore
	$data['_rev'] = 1;
	do_action( 'wt_record_changed', $type, $data, 'insert' );
	return $data;
}

/**
 * Save a record. Every save bumps its revision. With $strict, the save only happens if nobody else saved the
 * record since it was read (its `_rev` still matches); otherwise a 409 error is returned and nothing is written,
 * so two people (or a person and the apps' backend) can never silently overwrite each other.
 */
function wt_rec_save( $type, $data, $strict = false ) {
	global $wpdb;
	$t    = wt_table();
	$cols = wt_rec_cols( $type, $data );
	$sets = array();
	$args = array();
	foreach ( $cols as $k => $v ) {
		$sets[] = "$k = " . ( is_int( $v ) ? '%d' : '%s' );
		$args[] = $v;
	}
	$sql    = "UPDATE $t SET " . implode( ', ', $sets ) . ', rev = rev + 1 WHERE ref = %s AND type = %s';
	$args[] = (string) $data['id'];
	$args[] = $type;
	if ( $strict && isset( $data['_rev'] ) ) {
		$sql   .= ' AND rev = %d';
		$args[] = (int) $data['_rev'];
	}
	$n = $wpdb->query( $wpdb->prepare( $sql, $args ) ); // phpcs:ignore
	if ( $strict && isset( $data['_rev'] ) && 0 === (int) $n ) {
		return new WP_Error( 'wt_conflict', 'Someone else changed this booking a moment ago. Refresh and try again.', array( 'status' => 409 ) );
	}
	$data['_rev'] = (int) $wpdb->get_var( $wpdb->prepare( "SELECT rev FROM $t WHERE ref = %s AND type = %s", $data['id'], $type ) ); // phpcs:ignore
	do_action( 'wt_record_changed', $type, $data, 'update' );
	return $data;
}

function wt_rec_get( $type, $ref ) {
	global $wpdb;
	$row = $wpdb->get_row( $wpdb->prepare( 'SELECT data, rev FROM ' . wt_table() . ' WHERE type = %s AND ref = %s', $type, $ref ), ARRAY_A ); // phpcs:ignore
	if ( ! $row ) {
		return null;
	}
	$data = json_decode( $row['data'], true );
	if ( is_array( $data ) ) {
		$data['_rev'] = (int) $row['rev'];
	}
	return $data;
}

function wt_rec_delete( $type, $ref ) {
	global $wpdb;
	$ok = (bool) $wpdb->delete( wt_table(), array( 'type' => $type, 'ref' => $ref ) ); // phpcs:ignore
	if ( $ok ) {
		do_action( 'wt_record_changed', $type, array( 'id' => $ref ), 'delete' );
	}
	return $ok;
}

/**
 * @param string $type  Record type.
 * @param array  $where Column => value (value may be an array for IN).
 * @param string $order SQL order clause on safe columns.
 */
function wt_rec_list( $type, $where = array(), $order = 'id DESC', $limit = 500, $extra_sql = '' ) {
	global $wpdb;
	$sql  = 'SELECT data FROM ' . wt_table() . ' WHERE type = %s';
	$args = array( $type );
	foreach ( $where as $col => $val ) {
		if ( 'date' === $col ) {
			$sql   .= ' AND skey LIKE %s';
			$args[] = $wpdb->esc_like( (string) $val ) . '%';
			continue;
		}
		if ( ! in_array( $col, array( 'phone', 'city', 'status' ), true ) ) {
			continue;
		}
		if ( is_array( $val ) ) {
			if ( ! $val ) {
				continue;
			}
			$sql .= " AND $col IN (" . implode( ',', array_fill( 0, count( $val ), '%s' ) ) . ')';
			$args = array_merge( $args, array_values( $val ) );
		} else {
			$sql   .= " AND $col = %s";
			$args[] = $val;
		}
	}
	$allowed_order = array( 'id DESC', 'id ASC', 'skey ASC', 'skey DESC' );
	$order         = in_array( $order, $allowed_order, true ) ? $order : 'id DESC';
	$sql          .= $extra_sql . " ORDER BY $order LIMIT " . (int) $limit;
	$rows          = $wpdb->get_col( $wpdb->prepare( $sql, $args ) ); // phpcs:ignore
	return array_map(
		function ( $r ) {
			return json_decode( $r, true );
		},
		$rows
	);
}

/* ---------- reward points ---------- */

function wt_points_balance( $phone ) {
	global $wpdb;
	$phone = wt_phone( $phone );
	if ( ! $phone ) {
		return 0;
	}
	return (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COALESCE(SUM(amount),0) FROM ' . wt_table() . " WHERE type = 'points' AND phone = %s", $phone ) ); // phpcs:ignore
}

function wt_points_add( $phone, $pts, $reason, $ref = '' ) {
	$pts   = (int) round( $pts );
	$phone = wt_phone( $phone );
	if ( ! $phone || ! $pts ) {
		return;
	}
	wt_rec_insert(
		'points',
		array(
			'phone'  => $phone,
			'amount' => $pts,
			'pts'    => $pts,
			'reason' => $reason,
			'ref'    => $ref,
			'at'     => wt_now_label(),
		),
		'PT'
	);
}

function wt_points_earn_for( $amount, $kind ) {
	$r = wt_config()['rewards'];
	if ( empty( $r['enabled'] ) ) {
		return 0;
	}
	$rate = 'booking' === $kind ? $r['bookingRate'] : $r['orderRate'];
	return (int) floor( $amount / 100 * $rate );
}

/** How many points (and rupees) a customer can use on a bill. */
function wt_points_redeemable( $phone, $bill ) {
	$r   = wt_config()['rewards'];
	$bal = wt_points_balance( $phone );
	$out = array( 'pts' => 0, 'amount' => 0, 'bal' => $bal );
	if ( empty( $r['enabled'] ) || $bal < $r['minRedeem'] || $bill <= 0 ) {
		return $out;
	}
	$amount = (int) min( floor( $bill * $r['maxPct'] / 100 ), floor( $bal * $r['pointValue'] ) );
	if ( $amount <= 0 ) {
		return $out;
	}
	$out['amount'] = $amount;
	$out['pts']    = (int) ceil( $amount / $r['pointValue'] );
	return $out;
}

/** Phone attached to a WordPress user (customer accounts store it in wt_phone). */
function wt_user_phone( $user_id ) {
	$p = get_user_meta( $user_id, 'wt_phone', true );
	if ( ! $p ) {
		$p = get_user_meta( $user_id, 'billing_phone', true );
	}
	return wt_phone( $p );
}

function wt_user_by_phone( $phone ) {
	$users = get_users(
		array(
			'meta_key'   => 'wt_phone', // phpcs:ignore
			'meta_value' => wt_phone( $phone ), // phpcs:ignore
			'number'     => 1,
		)
	);
	return $users ? $users[0] : null;
}

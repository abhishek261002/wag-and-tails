<?php
/**
 * Blocked dates: groomer leave and holidays. A block stops new bookings in a city for whole days
 * or a time window. Customers simply see those times as "Booked".
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function wt_blocks() {
	$b = get_option( 'wt_blocks', array() );
	return is_array( $b ) ? $b : array();
}

/** Blocks that touch this city on this date. City 'all' blocks every city. */
function wt_blocks_for( $city_id, $date ) {
	$out = array();
	foreach ( wt_blocks() as $b ) {
		if ( ( 'all' === $b['city'] || $b['city'] === $city_id ) && $date >= $b['from'] && $date <= $b['to'] ) {
			$out[] = $b;
		}
	}
	return $out;
}

/**
 * How many groomers a block takes away from a slot [s, s+len) in minutes.
 * Returns PHP_INT_MAX for "all groomers".
 */
function wt_block_off( $blocks, $s, $len ) {
	$off = 0;
	foreach ( $blocks as $b ) {
		$bs = '' === $b['start'] ? 0 : wt_hm_to_min( $b['start'] );
		$be = '' === $b['end'] ? 24 * 60 : wt_hm_to_min( $b['end'] );
		if ( $s < $be && $bs < $s + $len ) {
			if ( empty( $b['off'] ) ) {
				return PHP_INT_MAX;
			}
			$off += (int) $b['off'];
		}
	}
	return $off;
}

/** Dates (next N days) when a city is closed all day, for the booking calendar. */
function wt_blocked_days() {
	$cfg  = wt_config();
	$days = max( 1, (int) ( $cfg['settings']['maxDaysAhead'] ?? 45 ) );
	$out  = array();
	$all  = wt_blocks();
	if ( ! $all ) {
		return $out;
	}
	foreach ( $cfg['cities'] as $c ) {
		if ( empty( $c['service'] ) ) {
			continue;
		}
		$cap  = max( 1, (int) ( $c['capacity'] ?? 1 ) );
		$list = array();
		for ( $i = 0; $i <= $days; $i++ ) {
			$d    = wt_today( $i );
			$bl   = wt_blocks_for( $c['id'], $d );
			$open = wt_slot_settings( $cfg );
			if ( $bl && wt_block_off( $bl, $open['open'], $open['close'] - $open['open'] ) >= $cap ) {
				// closed only if every part of the working day is covered
				$closed = true;
				for ( $m = $open['open']; $m < $open['close']; $m += 15 ) {
					if ( wt_block_off( $bl, $m, 15 ) < $cap ) {
						$closed = false;
						break;
					}
				}
				if ( $closed ) {
					$list[] = $d;
				}
			}
		}
		if ( $list ) {
			$out[ $c['id'] ] = $list;
		}
	}
	return $out;
}

/** Bookings already made inside a block, so the admin can reschedule them. */
function wt_block_clashes( $b ) {
	$cfg = wt_config();
	$out = array();
	foreach ( wt_rec_list( 'booking', array( 'status' => array( 'Confirmed', 'Rescheduled', 'Pending payment' ) ), 'skey ASC', 2000 ) as $bk ) {
		if ( empty( $bk['date'] ) || $bk['date'] < $b['from'] || $bk['date'] > $b['to'] || ( 'all' !== $b['city'] && $bk['city'] !== $b['city'] ) ) {
			continue;
		}
		$span = wt_booking_span( $bk, $cfg );
		if ( $span && wt_block_off( array( $b ), $span[0], $span[1] ) <= 0 ) {
			continue;
		}
		$out[] = array(
			'id'    => $bk['id'],
			'date'  => $bk['date'],
			'slot'  => $bk['slot'] ?? '',
			'name'  => $bk['name'] ?? '',
			'city'  => $bk['city'],
		);
	}
	return $out;
}

function wt_api_blocks_list() {
	$today = wt_today();
	$list  = array();
	foreach ( wt_blocks() as $b ) {
		if ( $b['to'] < $today ) {
			continue;
		}
		$b['clashes'] = wt_block_clashes( $b );
		$list[]       = $b;
	}
	usort(
		$list,
		function ( $x, $y ) {
			return strcmp( $x['from'], $y['from'] );
		}
	);
	return array( 'list' => $list );
}

function wt_api_blocks_save( $in ) {
	$all = wt_blocks();
	if ( 'delete' === ( $in['action'] ?? '' ) ) {
		$id  = sanitize_key( $in['id'] ?? '' );
		$all = array_values(
			array_filter(
				$all,
				function ( $b ) use ( $id ) {
					return $b['id'] !== $id;
				}
			)
		);
		update_option( 'wt_blocks', $all, false );
		return array( 'ok' => true );
	}
	$cfg  = wt_config();
	$city = sanitize_text_field( $in['city'] ?? '' );
	if ( 'all' !== $city && ! wt_city( $city, $cfg ) ) {
		return wt_err( 'Choose a city.' );
	}
	$from = sanitize_text_field( $in['from'] ?? '' );
	$to   = sanitize_text_field( $in['to'] ?? '' );
	$to   = $to ? $to : $from;
	if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $from ) || ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $to ) ) {
		return wt_err( 'Choose the dates to block.' );
	}
	if ( $to < $from ) {
		return wt_err( 'The end date is before the start date.' );
	}
	if ( $to < wt_today() ) {
		return wt_err( 'Those dates have already passed.' );
	}
	$start = '';
	$end   = '';
	if ( empty( $in['allDay'] ) ) {
		$start = sanitize_text_field( $in['start'] ?? '' );
		$end   = sanitize_text_field( $in['end'] ?? '' );
		if ( null === wt_hm_to_min( $start ) || null === wt_hm_to_min( $end ) || wt_hm_to_min( $end ) <= wt_hm_to_min( $start ) ) {
			return wt_err( 'Enter a time range, for example 13:00 to 17:00, or tick "Whole day".' );
		}
	}
	$b     = array(
		'id'    => strtolower( wp_generate_password( 8, false ) ),
		'city'  => $city,
		'from'  => $from,
		'to'    => $to,
		'start' => $start,
		'end'   => $end,
		'off'   => max( 0, (int) ( $in['off'] ?? 0 ) ),
		'note'  => sanitize_text_field( mb_substr( (string) ( $in['note'] ?? '' ), 0, 120 ) ),
		'by'    => wp_get_current_user()->display_name,
		'at'    => wp_date( 'Y-m-d H:i' ),
	);
	$all[] = $b;
	update_option( 'wt_blocks', $all, false );
	return array( 'block' => $b, 'clashes' => wt_block_clashes( $b ) );
}

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'wt/v1',
			'/blocked-days',
			array(
				'methods'             => 'GET',
				'permission_callback' => '__return_true',
				'callback'            => wt_rest(
					function () {
						return array( 'days' => wt_blocked_days() );
					}
				),
			)
		);
		register_rest_route(
			'wt/v1',
			'/admin/blocks',
			array(
				array(
					'methods'             => 'GET',
					'permission_callback' => 'wt_can_admin',
					'callback'            => wt_rest( 'wt_api_blocks_list' ),
				),
				array(
					'methods'             => 'POST',
					'permission_callback' => 'wt_can_admin',
					'callback'            => wt_rest( 'wt_api_blocks_save' ),
				),
			)
		);
	}
);

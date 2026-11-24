<?php
/**
 * Pet events: the admin adds events with pass types, customers buy passes online (Razorpay),
 * passes arrive on WhatsApp and email, and staff check people in at the gate.
 * Also a city-wise WhatsApp broadcast (event invites and general updates).
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const WT_PASS_HOLD = 1200; // An unpaid pass holds its seats for 20 minutes.

function wt_events_all() {
	$e = get_option( 'wt_events', array() );
	return is_array( $e ) ? $e : array();
}

function wt_event( $id ) {
	foreach ( wt_events_all() as $e ) {
		if ( $e['id'] === $id ) {
			return $e;
		}
	}
	return null;
}

function wt_event_link( $id ) {
	return add_query_arg( 'ev', $id, wt_app_url() ) . '#events';
}

function wt_event_when( $e ) {
	$t = wt_fmt_date( $e['date'] );
	if ( ! empty( $e['start'] ) ) {
		$t .= ', ' . wt_min_to_label( wt_hm_to_min( $e['start'] ) );
		if ( ! empty( $e['end'] ) ) {
			$t .= ' - ' . wt_min_to_label( wt_hm_to_min( $e['end'] ) );
		}
	}
	return $t;
}

/** All pass orders for an event. */
function wt_event_passes( $event_id ) {
	return array_values(
		array_filter(
			wt_rec_list( 'evpass', array(), 'id DESC', 5000 ),
			function ( $p ) use ( $event_id ) {
				return ( $p['event'] ?? '' ) === $event_id;
			}
		)
	);
}

function wt_pass_counts( $p ) {
	return 'Paid' === $p['status'] || ( 'Pending payment' === $p['status'] && time() - (int) ( $p['ts'] ?? 0 ) < WT_PASS_HOLD );
}

/** Seats taken per pass type: [pass id => qty]. */
function wt_event_sold( $event_id, $exclude_ref = '' ) {
	$out = array();
	foreach ( wt_event_passes( $event_id ) as $p ) {
		if ( $p['id'] === $exclude_ref || ! wt_pass_counts( $p ) ) {
			continue;
		}
		foreach ( (array) $p['items'] as $it ) {
			$out[ $it['pass'] ] = ( $out[ $it['pass'] ] ?? 0 ) + (int) $it['qty'];
		}
	}
	return $out;
}

/** What customers may see about an event. */
function wt_event_public( $e ) {
	$sold   = wt_event_sold( $e['id'] );
	$passes = array();
	foreach ( (array) $e['passes'] as $p ) {
		$left     = $p['qty'] > 0 ? max( 0, (int) $p['qty'] - (int) ( $sold[ $p['id'] ] ?? 0 ) ) : null;
		$passes[] = array(
			'id'    => $p['id'],
			'name'  => $p['name'],
			'desc'  => $p['desc'] ?? '',
			'price' => (float) $p['price'],
			'max'   => (int) ( $p['max'] ?? 10 ),
			'left'  => $left,
		);
	}
	$open = 'live' === $e['status'] && $e['date'] >= wt_today() && ( empty( $e['salesEnd'] ) || wt_today() <= $e['salesEnd'] );
	return array(
		'id'      => $e['id'],
		'title'   => $e['title'],
		'city'    => $e['city'],
		'venue'   => $e['venue'],
		'address' => $e['address'] ?? '',
		'map'     => $e['map'] ?? '',
		'date'    => $e['date'],
		'start'   => $e['start'] ?? '',
		'end'     => $e['end'] ?? '',
		'when'    => wt_event_when( $e ),
		'desc'    => $e['desc'] ?? '',
		'img'     => $e['img'] ?? '',
		'passes'  => $passes,
		'open'    => $open,
		'soldOut' => $passes && ! array_filter(
			$passes,
			function ( $p ) {
				return null === $p['left'] || $p['left'] > 0;
			}
		),
		'link'    => wt_event_link( $e['id'] ),
	);
}

/** Live events that have not happened yet (for the customer Events page). */
function wt_events_public() {
	$out = array();
	foreach ( wt_events_all() as $e ) {
		if ( 'draft' === $e['status'] || $e['date'] < wt_today() ) {
			continue;
		}
		$out[] = wt_event_public( $e );
	}
	usort(
		$out,
		function ( $a, $b ) {
			return strcmp( $a['date'] . $a['start'], $b['date'] . $b['start'] );
		}
	);
	return $out;
}

/** Small list for the boot data, so the menu knows whether to show "Events". */
function wt_events_boot() {
	return array_map(
		function ( $e ) {
			return array( 'id' => $e['id'], 'title' => $e['title'], 'city' => $e['city'], 'date' => $e['date'] );
		},
		wt_events_public()
	);
}

/* ---------- buying passes ---------- */

function wt_api_events_public() {
	return array( 'events' => wt_events_public() );
}

function wt_api_event_buy( $in ) {
	if ( ! empty( $in['website'] ) ) {
		return wt_err( 'Something went wrong. Please try again.' );
	}
	$e = wt_event( sanitize_text_field( $in['event'] ?? '' ) );
	if ( ! $e || 'draft' === $e['status'] ) {
		return wt_err( 'This event is not available.', 'wt_404', 404 );
	}
	$pub = wt_event_public( $e );
	if ( ! $pub['open'] ) {
		return wt_err( 'Passes for this event are no longer on sale.' );
	}
	$name  = sanitize_text_field( $in['name'] ?? '' );
	$phone = wt_phone( $in['phone'] ?? '' );
	$email = sanitize_email( $in['email'] ?? '' );
	if ( mb_strlen( trim( $name ) ) < 2 ) {
		return wt_err( 'Enter your name.' );
	}
	if ( ! wt_valid_mobile( $phone ) ) {
		return wt_err( 'Enter a valid 10-digit mobile number.' );
	}
	if ( $email && ! is_email( $email ) ) {
		return wt_err( 'Enter a valid email address, or leave it empty.' );
	}
	$want  = is_array( $in['items'] ?? null ) ? $in['items'] : array();
	$items = array();
	$total = 0;
	foreach ( $pub['passes'] as $p ) {
		$q = max( 0, (int) ( $want[ $p['id'] ] ?? 0 ) );
		if ( ! $q ) {
			continue;
		}
		if ( $q > $p['max'] ) {
			return wt_err( sprintf( 'You can buy up to %d "%s" passes at a time.', $p['max'], $p['name'] ) );
		}
		if ( null !== $p['left'] && $q > $p['left'] ) {
			return wt_err( $p['left'] ? sprintf( 'Only %d "%s" passes are left.', $p['left'], $p['name'] ) : sprintf( '"%s" passes are sold out.', $p['name'] ) );
		}
		$items[] = array( 'pass' => $p['id'], 'name' => $p['name'], 'price' => $p['price'], 'qty' => $q );
		$total  += $p['price'] * $q;
	}
	if ( ! $items ) {
		return wt_err( 'Choose at least one pass.' );
	}
	if ( $total > 0 && ! wt_rzp_ready() ) {
		return wt_err( 'Online payment is not set up yet. Please contact us to book passes.' );
	}
	$rec = wt_rec_insert(
		'evpass',
		array(
			'event'   => $e['id'],
			'title'   => $e['title'],
			'date'    => $e['date'],
			'city'    => $e['city'],
			'name'    => $name,
			'phone'   => $phone,
			'email'   => $email,
			'items'   => $items,
			'total'   => $total,
			'amount'  => $total,
			'status'  => 'Pending payment',
			'ts'      => time(),
			'checked' => 0,
		),
		'EP'
	);
	if ( $total <= 0 ) {
		return array( 'pass' => wt_pass_confirm( $rec, 'Free', '' ) );
	}
	$o = wt_rzp_create_order( $total, $rec['id'], array( 'pass' => $rec['id'], 'event' => $e['title'] ) );
	if ( is_wp_error( $o ) ) {
		wt_rec_delete( 'evpass', $rec['id'] );
		return wt_err( 'Online payment is unavailable right now. Please try again in a few minutes.' );
	}
	$rec['rzpOrder'] = $o['id'];
	wt_rec_save( 'evpass', $rec );
	list( $key ) = wt_rzp_keys();
	return array(
		'ref' => $rec['id'],
		'rzp' => array(
			'key'      => $key,
			'order_id' => $o['id'],
			'amount'   => $o['amount'],
			'name'     => $name,
			'email'    => $email,
			'contact'  => $phone,
			'desc'     => $e['title'] . ' passes',
		),
	);
}

function wt_api_event_verify( $in ) {
	$rec = wt_rec_get( 'evpass', sanitize_text_field( $in['ref'] ?? '' ) );
	if ( ! $rec ) {
		return wt_err( 'Pass not found.', 'wt_404', 404 );
	}
	if ( 'Paid' === $rec['status'] ) {
		return array( 'pass' => wt_pass_client( $rec ) );
	}
	$order = sanitize_text_field( $in['razorpay_order_id'] ?? '' );
	$pay   = sanitize_text_field( $in['razorpay_payment_id'] ?? '' );
	$sig   = sanitize_text_field( $in['razorpay_signature'] ?? '' );
	if ( $order !== ( $rec['rzpOrder'] ?? '' ) || ! wt_rzp_verify( $order, $pay, $sig ) ) {
		return wt_err( 'We could not confirm this payment. If money was deducted, contact us with your pass ID ' . $rec['id'] . '.' );
	}
	return array( 'pass' => wt_pass_confirm( $rec, 'Online', $pay ) );
}

function wt_pass_items_label( $p ) {
	return implode(
		', ',
		array_map(
			function ( $it ) {
				return $it['qty'] . ' x ' . $it['name'];
			},
			(array) $p['items']
		)
	);
}

function wt_pass_confirm( $rec, $mode, $pay_id ) {
	$rec['status']  = 'Paid';
	$rec['payMode'] = $mode;
	$rec['payId']   = $pay_id;
	$rec['paidAt']  = wt_now_label();
	wt_rec_save( 'evpass', $rec );
	$e     = wt_event( $rec['event'] );
	$when  = $e ? wt_event_when( $e ) : wt_fmt_date( $rec['date'] );
	$venue = $e ? trim( $e['venue'] . ( ! empty( $e['address'] ) ? ', ' . $e['address'] : '' ) ) : '';
	$items = wt_pass_items_label( $rec );
	wt_whatsapp(
		$rec['phone'],
		'event_pass',
		array( wt_first( $rec['name'] ), $rec['title'], $when, $venue, $items, $rec['id'] ),
		sprintf( 'Hi %s, your passes for %s are confirmed. %s at %s. Passes: %s. Pass ID: %s. Show this at the entry.', wt_first( $rec['name'] ), $rec['title'], $when, $venue, $items, $rec['id'] )
	);
	if ( ! empty( $rec['email'] ) ) {
		wt_email(
			$rec['email'],
			'Your passes for ' . $rec['title'] . ' (' . $rec['id'] . ')',
			"Hi {$rec['name']},\n\nYour passes are confirmed.\n\nEvent: {$rec['title']}\nWhen: {$when}\nWhere: {$venue}\nPasses: {$items}\nAmount paid: " . wt_money( $rec['total'] ) . "\nPass ID: {$rec['id']}\n\nShow this pass ID (or the WhatsApp message) at the entry. See you there!"
		);
	}
	return wt_pass_client( $rec );
}

function wt_pass_client( $rec ) {
	unset( $rec['rzpOrder'] );
	$e = wt_event( $rec['event'] );
	if ( $e ) {
		$rec['when']  = wt_event_when( $e );
		$rec['venue'] = $e['venue'];
		$rec['addr']  = $e['address'] ?? '';
		$rec['map']   = $e['map'] ?? '';
	}
	return $rec;
}

/** Passes bought with the logged-in customer's phone. */
function wt_api_my_passes() {
	$phone = wt_current_customer_phone();
	if ( ! $phone ) {
		return array( 'passes' => array() );
	}
	$out = array();
	foreach ( wt_rec_list( 'evpass', array( 'phone' => $phone, 'status' => 'Paid' ), 'id DESC', 100 ) as $p ) {
		$out[] = wt_pass_client( $p );
	}
	return array( 'passes' => $out );
}

/* ---------- admin: events, attendees, check-in ---------- */

function wt_api_admin_events() {
	$out = array();
	foreach ( wt_events_all() as $e ) {
		$paid    = array_filter(
			wt_event_passes( $e['id'] ),
			function ( $p ) {
				return 'Paid' === $p['status'];
			}
		);
		$people  = 0;
		$revenue = 0;
		$in      = 0;
		foreach ( $paid as $p ) {
			foreach ( (array) $p['items'] as $it ) {
				$people += (int) $it['qty'];
			}
			$revenue += (float) $p['total'];
			$in      += (int) ( $p['checked'] ?? 0 );
		}
		$e['sold']    = wt_event_sold( $e['id'] );
		$e['orders']  = count( $paid );
		$e['people']  = $people;
		$e['revenue'] = $revenue;
		$e['checked'] = $in;
		$e['link']    = wt_event_link( $e['id'] );
		$out[]        = $e;
	}
	usort(
		$out,
		function ( $a, $b ) {
			return strcmp( $b['date'], $a['date'] );
		}
	);
	return array( 'events' => $out );
}

function wt_api_admin_event_save( $in ) {
	$all = wt_events_all();
	$id  = sanitize_key( $in['id'] ?? '' );
	if ( 'delete' === ( $in['action'] ?? '' ) ) {
		foreach ( wt_event_passes( $id ) as $p ) {
			if ( 'Paid' === $p['status'] ) {
				return wt_err( 'People have already bought passes for this event. Close it instead of deleting it.' );
			}
		}
		$all = array_values(
			array_filter(
				$all,
				function ( $e ) use ( $id ) {
					return $e['id'] !== $id;
				}
			)
		);
		update_option( 'wt_events', $all, false );
		return array( 'ok' => true );
	}
	$cfg   = wt_config();
	$title = sanitize_text_field( $in['title'] ?? '' );
	$city  = sanitize_text_field( $in['city'] ?? '' );
	$date  = sanitize_text_field( $in['date'] ?? '' );
	if ( mb_strlen( $title ) < 3 ) {
		return wt_err( 'Give the event a name.' );
	}
	if ( ! wt_city( $city, $cfg ) ) {
		return wt_err( 'Choose the city.' );
	}
	if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date ) ) {
		return wt_err( 'Choose the event date.' );
	}
	$passes = array();
	foreach ( (array) ( $in['passes'] ?? array() ) as $p ) {
		$pn = sanitize_text_field( $p['name'] ?? '' );
		if ( '' === $pn ) {
			continue;
		}
		$passes[] = array(
			'id'    => ! empty( $p['id'] ) ? sanitize_key( $p['id'] ) : strtolower( wp_generate_password( 6, false ) ),
			'name'  => $pn,
			'desc'  => sanitize_text_field( $p['desc'] ?? '' ),
			'price' => max( 0, round( (float) ( $p['price'] ?? 0 ), 2 ) ),
			'qty'   => max( 0, (int) ( $p['qty'] ?? 0 ) ),
			'max'   => min( 50, max( 1, (int) ( $p['max'] ?? 10 ) ) ),
		);
	}
	if ( ! $passes ) {
		return wt_err( 'Add at least one pass type, for example "Pet + 1 parent" at ₹499.' );
	}
	$start  = sanitize_text_field( $in['start'] ?? '' );
	$end    = sanitize_text_field( $in['end'] ?? '' );
	$status = in_array( $in['status'] ?? '', array( 'draft', 'live', 'closed' ), true ) ? $in['status'] : 'draft';
	$e      = array(
		'id'       => $id ? $id : 'ev' . strtolower( wp_generate_password( 6, false ) ),
		'title'    => $title,
		'city'     => $city,
		'venue'    => sanitize_text_field( $in['venue'] ?? '' ),
		'address'  => sanitize_text_field( $in['address'] ?? '' ),
		'map'      => esc_url_raw( $in['map'] ?? '' ),
		'date'     => $date,
		'start'    => null !== wt_hm_to_min( $start ) ? $start : '',
		'end'      => null !== wt_hm_to_min( $end ) ? $end : '',
		'desc'     => sanitize_textarea_field( $in['desc'] ?? '' ),
		'img'      => esc_url_raw( $in['img'] ?? '' ),
		'passes'   => $passes,
		'status'   => $status,
		'salesEnd' => preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) ( $in['salesEnd'] ?? '' ) ) ? $in['salesEnd'] : '',
	);
	$found = false;
	foreach ( $all as $i => $old ) {
		if ( $old['id'] === $e['id'] ) {
			$e['created'] = $old['created'] ?? wt_now_label();
			$all[ $i ]    = $e;
			$found        = true;
		}
	}
	if ( ! $found ) {
		$e['created'] = wt_now_label();
		$all[]        = $e;
	}
	update_option( 'wt_events', array_values( $all ), false );
	return array( 'event' => $e );
}

function wt_api_event_attendees( $in ) {
	$e = wt_event( sanitize_key( $in['id'] ?? '' ) );
	if ( ! $e ) {
		return wt_err( 'Event not found.', 'wt_404', 404 );
	}
	$list = array_values(
		array_filter(
			wt_event_passes( $e['id'] ),
			function ( $p ) {
				return in_array( $p['status'], array( 'Paid', 'Cancelled' ), true );
			}
		)
	);
	if ( 'csv' === ( $in['format'] ?? '' ) ) {
		$rows = array_map(
			function ( $p ) {
				$qty = array_sum( wp_list_pluck( (array) $p['items'], 'qty' ) );
				return array( $p['id'], $p['name'], $p['phone'], $p['email'] ?? '', wt_pass_items_label( $p ), $qty, $p['total'], $p['payMode'] ?? '', $p['payId'] ?? '', $p['status'], (int) ( $p['checked'] ?? 0 ), $p['paidAt'] ?? $p['created'] );
			},
			$list
		);
		wt_csv_send( 'event-passes-' . sanitize_file_name( $e['title'] ) . '.csv', array( 'Pass ID', 'Name', 'Phone', 'Email', 'Passes', 'People', 'Amount', 'Paid by', 'Payment ID', 'Status', 'Checked in', 'Bought at' ), $rows );
	}
	return array( 'event' => $e, 'list' => $list );
}

function wt_api_pass_action( $in ) {
	$p = wt_rec_get( 'evpass', strtoupper( sanitize_text_field( $in['ref'] ?? '' ) ) );
	if ( ! $p ) {
		return wt_err( 'No pass with this ID.', 'wt_404', 404 );
	}
	$act = $in['action'] ?? '';
	if ( 'checkin' === $act ) {
		if ( 'Paid' !== $p['status'] ) {
			return wt_err( 'This pass is ' . strtolower( $p['status'] ) . ', not valid for entry.' );
		}
		$people       = array_sum( wp_list_pluck( (array) $p['items'], 'qty' ) );
		$n            = max( 0, min( $people, (int) ( $in['count'] ?? $people ) ) );
		$p['checked'] = $n;
		$p['inAt']    = wt_now_label();
		$p['inBy']    = wp_get_current_user()->display_name;
	} elseif ( 'cancel' === $act && current_user_can( 'manage_options' ) ) {
		$p['status']      = 'Cancelled';
		$p['cancelledAt'] = wt_now_label();
	} else {
		return wt_err( 'Unknown action.' );
	}
	wt_rec_save( 'evpass', $p );
	return array( 'pass' => $p );
}

/* ---------- WhatsApp broadcast, city wise ---------- */

/** Customers for a broadcast: city filter, optional event (holders / non-holders). */
function wt_broadcast_audience( $in ) {
	$city  = sanitize_text_field( $in['city'] ?? 'all' );
	$who   = sanitize_key( $in['who'] ?? 'all' );
	$event = sanitize_key( $in['event'] ?? '' );
	$gap   = max( 0, (int) ( $in['gap'] ?? 3 ) );
	$hold  = array();
	if ( $event ) {
		foreach ( wt_event_passes( $event ) as $p ) {
			if ( 'Paid' === $p['status'] ) {
				$hold[ wt_phone( $p['phone'] ) ] = $p['name'];
			}
		}
	}
	$map = wt_sent_map( 'bc' );
	$out = array();
	if ( 'holders' === $who ) {
		foreach ( $hold as $ph => $nm ) {
			$out[] = array( 'phone' => $ph, 'name' => $nm );
		}
		return $out;
	}
	$days  = max( 1, (int) ( $in['days'] ?? 30 ) );
	$min   = max( 2, (int) ( $in['min'] ?? 2 ) );
	$cut   = wt_today( -$days );
	$profs = wt_bulk_profiles();
	foreach ( wt_customer_index() as $c ) {
		if ( 'all' !== $city && ( $c['city'] ?? '' ) !== $city ) {
			continue;
		}
		if ( 'nonholders' === $who && isset( $hold[ $c['phone'] ] ) ) {
			continue;
		}
		$pr = $profs[ $c['phone'] ] ?? null;
		if ( 'due' === $who && ( ! $pr || $pr['ahead'] || ! $pr['last'] || $pr['last'] > $cut ) ) {
			continue;
		}
		if ( 'loyal' === $who && ( ! $pr || $pr['grooms'] < $min ) ) {
			continue;
		}
		if ( 'never' === $who && $pr && $pr['grooms'] > 0 ) {
			continue;
		}
		if ( $gap && wt_sent_recently( $map, $c['phone'], $gap ) ) {
			continue;
		}
		$out[] = array( 'phone' => $c['phone'], 'name' => $c['name'] );
	}
	return $out;
}

/** Template variables for one customer. */
function wt_broadcast_params( $job, $name ) {
	$first = wt_first( $name ) ? wt_first( $name ) : 'there';
	if ( 'event' === $job['kind'] ) {
		$e    = wt_event( $job['event'] );
		$paid = $e ? array_filter( array_map( 'floatval', wp_list_pluck( $e['passes'], 'price' ) ) ) : array();
		$from = $paid ? min( $paid ) : 0;
		return array(
			'event_invite',
			array( $first, $e['title'], wt_city_name( $e['city'] ), wt_event_when( $e ), $e['venue'], $from > 0 ? wt_money( $from ) : 'Free', wt_event_link( $e['id'] ) ),
			sprintf( 'Hi %s! Wag & Tails is hosting %s in %s on %s at %s. Passes from %s. %s', $first, $e['title'], wt_city_name( $e['city'] ), wt_event_when( $e ), $e['venue'], $from > 0 ? wt_money( $from ) : 'Free', wt_event_link( $e['id'] ) ),
		);
	}
	return array(
		'broadcast',
		array( $first, $job['text'], $job['link'] ? $job['link'] : wt_app_url() ),
		sprintf( 'Hi %s, %s %s', $first, $job['text'], $job['link'] ),
	);
}

function wt_broadcast_job_from( $in ) {
	if ( 'tpl' === ( $in['kind'] ?? '' ) ) {
		$s = wt_config()['settings'];
		if ( 'cloud' !== $s['waMode'] ) {
			return wt_err( 'Bulk templates need the WhatsApp Cloud API. Connect it in Settings first.' );
		}
		$tpl = wt_bulk_find_tpl( sanitize_text_field( $in['tpl'] ?? '' ), sanitize_text_field( $in['lang'] ?? '' ) );
		if ( is_wp_error( $tpl ) ) {
			return $tpl;
		}
		$map = wt_bulk_clean_map( $tpl, (array) ( $in['map'] ?? array() ) );
		if ( is_wp_error( $map ) ) {
			return $map;
		}
		$event = sanitize_key( $in['event'] ?? '' );
		foreach ( $map as $m ) {
			if ( 0 === strpos( $m['field'], 'event' ) && ! wt_event( $event ) ) {
				return wt_err( 'Choose the event for the event fields.' );
			}
		}
		return array( 'kind' => 'tpl', 'tpl' => $tpl, 'map' => $map, 'event' => $event, 'text' => '', 'link' => '' );
	}
	$kind = 'event' === ( $in['kind'] ?? '' ) ? 'event' : 'text';
	$job  = array(
		'kind'  => $kind,
		'event' => sanitize_key( $in['event'] ?? '' ),
		'text'  => trim( preg_replace( '/\s+/', ' ', sanitize_textarea_field( $in['text'] ?? '' ) ) ),
		'link'  => esc_url_raw( $in['link'] ?? '' ),
	);
	$s = wt_config()['settings'];
	if ( 'off' === $s['waMode'] ) {
		return wt_err( 'WhatsApp is not connected. Set it up in Settings first.' );
	}
	if ( 'event' === $kind ) {
		$e = wt_event( $job['event'] );
		if ( ! $e ) {
			return wt_err( 'Choose the event.' );
		}
		if ( 'cloud' === $s['waMode'] && empty( $s['waTemplates']['event_invite'] ) ) {
			return wt_err( 'Add the WhatsApp template name for "Event invite" in Settings → WhatsApp messages first.' );
		}
	} else {
		if ( mb_strlen( $job['text'] ) < 10 ) {
			return wt_err( 'Write the message (at least 10 characters).' );
		}
		if ( mb_strlen( $job['text'] ) > 600 ) {
			return wt_err( 'Keep the message under 600 characters.' );
		}
		if ( 'cloud' === $s['waMode'] && empty( $s['waTemplates']['broadcast'] ) ) {
			return wt_err( 'Add the WhatsApp template name for "Broadcast / update" in Settings → WhatsApp messages first.' );
		}
	}
	return $job;
}

function wt_api_broadcast_preview( $in ) {
	$list = wt_broadcast_audience( $in );
	return array(
		'count'  => count( $list ),
		'sample' => array_slice( wp_list_pluck( $list, 'name' ), 0, 5 ),
		'log'    => array_slice( (array) get_option( 'wt_broadcast_log', array() ), 0, 10 ),
	);
}

function wt_api_broadcast_test( $in ) {
	$job = wt_broadcast_job_from( $in );
	if ( is_wp_error( $job ) ) {
		return $job;
	}
	$phone = wt_phone( $in['phone'] ?? '' );
	if ( ! wt_valid_mobile( $phone ) ) {
		return wt_err( 'Enter a valid 10-digit mobile number for the test.' );
	}
	if ( 'tpl' === $job['kind'] ) {
		$res = wt_broadcast_send_tpl( $job, $phone, true, $in );
		if ( 0 === strpos( $res, 'Failed' ) || 0 === strpos( $res, 'Not sent' ) ) {
			return wt_err( wt_wa_reason( $res ) );
		}
		return array( 'ok' => true, 'result' => $res );
	}
	list( $ev, $params, $text ) = wt_broadcast_params( $job, 'Riya Sharma' );
	$before                     = wt_last_notif_id();
	wt_whatsapp( $phone, $ev, $params, 'Test: ' . $text );
	$res = wt_last_notif_result( $before );
	if ( 0 === strpos( $res, 'Failed' ) || 0 === strpos( $res, 'Not sent' ) ) {
		return wt_err( $res );
	}
	return array( 'ok' => true, 'result' => $res );
}

function wt_api_broadcast_start( $in ) {
	$job = wt_broadcast_job_from( $in );
	if ( is_wp_error( $job ) ) {
		return $job;
	}
	$list = wt_broadcast_audience( $in );
	if ( ! $list ) {
		return wt_err( 'Nobody matches these filters.' );
	}
	$id               = 'bc' . strtolower( wp_generate_password( 8, false, false ) );
	$job['list']      = $list;
	$job['sent']      = 0;
	$job['failed']    = 0;
	$job['by']        = wp_get_current_user()->display_name;
	$job['at']        = wt_now_label();
	$job['ts']        = time();
	$job['city']      = sanitize_text_field( $in['city'] ?? 'all' );
	$job['title']     = 'tpl' === $job['kind'] ? ( 'Template: ' . $job['tpl']['name'] ) : ( 'event' === $job['kind'] ? ( 'Invite: ' . ( wt_event( $job['event'] )['title'] ?? '' ) ) : mb_substr( $job['text'], 0, 60 ) );
	update_option( 'wt_job_' . $id, $job, false );
	return array( 'job' => $id, 'total' => count( $list ) );
}

function wt_api_broadcast_batch( $in ) {
	$id = sanitize_key( $in['job'] ?? '' );
	wp_cache_delete( 'wt_job_' . $id, 'options' );
	$j = get_option( 'wt_job_' . $id );
	if ( ! $j || ! is_array( $j ) || empty( $j['kind'] ) ) {
		return wt_err( 'This broadcast has expired. Start again.' );
	}
	if ( function_exists( 'set_time_limit' ) ) {
		@set_time_limit( 120 ); // phpcs:ignore
	}
	$offset                  = max( 0, (int) ( $in['offset'] ?? 0 ) );
	$part                    = array_slice( $j['list'], $offset, 10 );
	$done                    = array();
	$GLOBALS['wt_notif_tag'] = $id;
	foreach ( $part as $c ) {
		if ( 'tpl' === $j['kind'] ) {
			$res = wt_broadcast_send_tpl( $j, $c['phone'] );
		} else {
			list( $ev, $params, $text ) = wt_broadcast_params( $j, $c['name'] );
			$before                     = wt_last_notif_id();
			wt_whatsapp( $c['phone'], $ev, $params, $text );
			$res = wt_last_notif_result( $before );
		}
		if ( 0 === strpos( $res, 'Failed' ) || 0 === strpos( $res, 'Not sent' ) ) {
			++$j['failed'];
		} else {
			++$j['sent'];
			$done[] = $c['phone'];
		}
	}
	unset( $GLOBALS['wt_notif_tag'] );
	wt_sent_mark( 'bc', $done );
	$next = $offset + count( $part );
	$fin  = $next >= count( $j['list'] );
	update_option( 'wt_job_' . $id, $j, false );
	if ( $fin ) {
		$log = (array) get_option( 'wt_broadcast_log', array() );
		array_unshift( $log, array( 'job' => $id, 'title' => $j['title'], 'city' => $j['city'], 'at' => $j['at'], 'by' => $j['by'], 'total' => count( $j['list'] ), 'sent' => $j['sent'], 'failed' => $j['failed'] ) );
		update_option( 'wt_broadcast_log', array_slice( $log, 0, 30 ), false );
		delete_option( 'wt_job_' . $id );
	}
	return array( 'offset' => $next, 'total' => count( $j['list'] ), 'sent' => $j['sent'], 'failed' => $j['failed'], 'done' => $fin );
}

/** Send the chosen template to one phone, filled from that customer's details. */
function wt_broadcast_send_tpl( $job, $phone, $test = false, $in = array() ) {
	$profs = wt_bulk_profiles();
	$prof  = $profs[ $phone ] ?? null;
	if ( ! $prof && $test ) {
		$list = wt_broadcast_audience( $in );
		$prof = $list ? ( $profs[ $list[0]['phone'] ] ?? null ) : null;
	}
	if ( ! $prof ) {
		$prof = array( 'phone' => $phone, 'name' => 'Riya Sharma', 'city' => '', 'last' => wt_today( -30 ), 'lastPkg' => 'Full Groom', 'petName' => 'Bruno', 'breed' => 'Labrador', 'petType' => 'Dog', 'grooms' => 2, 'spent' => 2400 );
	}
	$prof['phone'] = $phone;
	list( $comp, $text ) = wt_bulk_build( $job['tpl'], $job['map'], $prof, $job['event'] ? wt_event( $job['event'] ) : null );
	return wt_wa_send_template( $phone, $job['tpl'], $comp, ( $test ? 'Test: ' : '' ) . $text );
}

/** How the message will look for the first customer in the list. */
function wt_api_broadcast_render( $in ) {
	$tpl = wt_bulk_find_tpl( sanitize_text_field( $in['tpl'] ?? '' ), sanitize_text_field( $in['lang'] ?? '' ) );
	if ( is_wp_error( $tpl ) ) {
		return $tpl;
	}
	$fields = wt_bulk_fields();
	$map    = array();
	foreach ( $tpl['slots'] as $sl ) {
		$r                 = (array) ( ( $in['map'] ?? array() )[ $sl['key'] ] ?? array() );
		$map[ $sl['key'] ] = array( 'field' => isset( $fields[ $r['field'] ?? '' ] ) ? $r['field'] : $sl['guess'], 'text' => sanitize_text_field( wp_unslash( (string) ( $r['text'] ?? '' ) ) ) );
	}
	$list  = wt_broadcast_audience( $in );
	$profs = wt_bulk_profiles();
	$prof  = $list ? ( $profs[ $list[0]['phone'] ] ?? null ) : null;
	if ( ! $prof ) {
		$prof = array( 'phone' => '9800000000', 'name' => 'Riya Sharma', 'city' => '', 'last' => wt_today( -30 ), 'lastPkg' => 'Full Groom', 'petName' => 'Bruno', 'breed' => 'Labrador', 'petType' => 'Dog', 'grooms' => 2, 'spent' => 2400 );
	}
	$ev             = sanitize_key( $in['event'] ?? '' );
	list( , $text ) = wt_bulk_build( $tpl, $map, $prof, $ev ? wt_event( $ev ) : null );
	return array( 'text' => $text, 'for' => $prof['name'] ? $prof['name'] : $prof['phone'], 'buttons' => $tpl['preview']['buttons'] );
}

/** Delivery report of one broadcast, from WhatsApp's delivery updates. */
function wt_api_broadcast_report( $in ) {
	global $wpdb;
	$id   = sanitize_key( $in['job'] ?? '' );
	$rows = $wpdb->get_col( $wpdb->prepare( 'SELECT data FROM ' . wt_table() . " WHERE type = 'notif' AND data LIKE %s", '%"tag":"' . $wpdb->esc_like( $id ) . '"%' ) ); // phpcs:ignore
	$out  = array( 'delivered' => 0, 'read' => 0, 'failed' => 0, 'waiting' => 0, 'reasons' => array() );
	$csv  = array();
	foreach ( $rows as $raw ) {
		$d = json_decode( $raw, true );
		$r = (string) ( $d['result'] ?? '' );
		if ( 0 === strpos( $r, 'Read' ) ) {
			$st = 'Read';
			++$out['read'];
		} elseif ( 0 === strpos( $r, 'Delivered' ) ) {
			$st = 'Delivered';
			++$out['delivered'];
		} elseif ( 0 === strpos( $r, 'Failed' ) || 0 === strpos( $r, 'Not sent' ) ) {
			$st = 'Failed';
			++$out['failed'];
			$why                    = wt_wa_reason( $r );
			$out['reasons'][ $why ] = ( $out['reasons'][ $why ] ?? 0 ) + 1;
		} else {
			$st = 'Waiting';
			++$out['waiting'];
		}
		$csv[] = array( wt_phone( $d['to'] ), $st, 'Failed' === $st ? wt_wa_reason( $r ) : '', $d['at'] ?? '' );
	}
	if ( 'csv' === ( $in['format'] ?? '' ) ) {
		wt_csv_send( 'whatsapp-broadcast-' . $id . '.csv', array( 'Phone', 'Status', 'Why it failed', 'Sent at' ), $csv );
	}
	arsort( $out['reasons'] );
	return $out;
}

/* ---------- routes ---------- */

add_action(
	'rest_api_init',
	function () {
		$ns     = 'wt/v1';
		$routes = array(
			array( 'GET', 'events', '__return_true', 'wt_api_events_public' ),
			array( 'POST', 'events/buy', '__return_true', 'wt_api_event_buy' ),
			array( 'POST', 'events/verify', '__return_true', 'wt_api_event_verify' ),
			array( 'GET', 'me/passes', 'is_user_logged_in', 'wt_api_my_passes' ),
			array( 'GET', 'admin/events', 'wt_can_admin', 'wt_api_admin_events' ),
			array( 'POST', 'admin/events', 'wt_can_admin', 'wt_api_admin_event_save' ),
			array( 'GET', 'admin/events/(?P<id>[a-z0-9]+)/passes', 'wt_can_desk', 'wt_api_event_attendees' ),
			array( 'POST', 'admin/passes/(?P<ref>[A-Za-z0-9\-]+)', 'wt_can_desk', 'wt_api_pass_action' ),
			array( 'GET', 'admin/broadcast', 'wt_can_admin', 'wt_api_broadcast_preview' ),
			array( 'POST', 'admin/broadcast/test', 'wt_can_admin', 'wt_api_broadcast_test' ),
			array( 'POST', 'admin/broadcast/start', 'wt_can_admin', 'wt_api_broadcast_start' ),
			array( 'POST', 'admin/broadcast/batch', 'wt_can_admin', 'wt_api_broadcast_batch' ),
			array( 'GET', 'admin/broadcast/report', 'wt_can_admin', 'wt_api_broadcast_report' ),
			array( 'POST', 'admin/broadcast/render', 'wt_can_admin', 'wt_api_broadcast_render' ),
			array( 'GET', 'admin/wa/approved', 'wt_can_admin', 'wt_api_bulk_templates' ),
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
);

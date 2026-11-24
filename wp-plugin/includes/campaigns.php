<?php
/**
 * Customer reminders:
 *  - Bulk WhatsApp reminder (one click, sent in small batches from the admin panel).
 *  - Daily reminder email with the admin's own image and text, sent automatically between two dates.
 * Both go to customers "due for grooming": their last groom was N or more days ago and nothing is booked ahead.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/* ---------- who is due ---------- */

/**
 * @param int    $days Days since the last groom.
 * @param string $city City id or 'all'.
 * @return array List of customers: phone, name, email, city, last, days, pet.
 */
function wt_due_customers( $days, $city = 'all' ) {
	$today = wt_today();
	$cut   = wt_today( -max( 1, (int) $days ) );
	$by    = array();
	foreach ( wt_all_bookings() as $b ) {
		$p = wt_phone( $b['phone'] ?? '' );
		if ( strlen( $p ) !== 10 ) {
			continue;
		}
		$st = $b['status'] ?? '';
		if ( ! isset( $by[ $p ] ) ) {
			$by[ $p ] = array( 'last' => '', 'ahead' => false, 'b' => null );
		}
		$d = (string) ( $b['date'] ?? '' );
		if ( in_array( $st, array( 'Confirmed', 'Rescheduled' ), true ) && $d >= $today ) {
			$by[ $p ]['ahead'] = true;
		}
		if ( 'Completed' === $st || ( in_array( $st, array( 'Confirmed', 'Rescheduled' ), true ) && $d < $today ) ) {
			if ( $d > $by[ $p ]['last'] ) {
				$by[ $p ]['last'] = $d;
				$by[ $p ]['b']    = $b;
			}
		}
	}
	$out = array();
	foreach ( $by as $p => $x ) {
		if ( $x['ahead'] || ! $x['last'] || $x['last'] > $cut ) {
			continue;
		}
		$b = $x['b'];
		if ( 'all' !== $city && ( $b['city'] ?? '' ) !== $city ) {
			continue;
		}
		$out[] = array(
			'phone' => $p,
			'name'  => trim( (string) ( $b['name'] ?? '' ) ),
			'email' => sanitize_email( $b['email'] ?? '' ),
			'city'  => $b['city'] ?? '',
			'last'  => $x['last'],
			'days'  => (int) floor( ( strtotime( $today ) - strtotime( $x['last'] ) ) / DAY_IN_SECONDS ),
			'pet'   => trim( (string) ( $b['breed'] ?? '' ) ) ? $b['breed'] : ( $b['petType'] ?? 'your pet' ),
		);
	}
	usort(
		$out,
		function ( $a, $b ) {
			return $a['days'] <=> $b['days'];
		}
	);
	return $out;
}

/** phone/email => last date reminded, per channel. */
function wt_sent_map( $channel ) {
	$m = get_option( 'wt_sent_' . $channel );
	return is_array( $m ) ? $m : array();
}
function wt_sent_mark( $channel, $keys ) {
	$m   = wt_sent_map( $channel );
	$day = wt_today();
	foreach ( (array) $keys as $k ) {
		$m[ $k ] = $day;
	}
	// Forget anything older than 120 days so the option stays small.
	$old = wt_today( -120 );
	$m   = array_filter(
		$m,
		function ( $d ) use ( $old ) {
			return $d >= $old;
		}
	);
	update_option( 'wt_sent_' . $channel, $m, false );
}
function wt_sent_unmark( $channel, $key ) {
	$m = wt_sent_map( $channel );
	if ( isset( $m[ $key ] ) ) {
		unset( $m[ $key ] );
		update_option( 'wt_sent_' . $channel, $m, false );
	}
}

/** Once: customers whose earlier reminder failed become eligible again. */
function wt_remind_fix_failed() {
	if ( get_option( 'wt_remind_fix1' ) ) {
		return;
	}
	global $wpdb;
	$m = wt_sent_map( 'wa' );
	foreach ( $wpdb->get_col( 'SELECT data FROM ' . wt_table() . " WHERE type = 'notif' AND data LIKE '%Grooming reminder%'" ) as $raw ) { // phpcs:ignore
		$d = json_decode( $raw, true );
		if ( $d && 0 === strpos( (string) $d['result'], 'Failed' ) ) {
			unset( $m[ wt_phone( $d['to'] ) ] );
		}
	}
	update_option( 'wt_sent_wa', $m, false );
	update_option( 'wt_remind_fix1', 1, false );
}

function wt_sent_recently( $map, $key, $gap ) {
	return $gap > 0 && isset( $map[ $key ] ) && $map[ $key ] > wt_today( -$gap );
}

/* ---------- bulk WhatsApp reminder ---------- */

function wt_api_remind_preview( $in ) {
	wt_remind_fix_failed();
	$days = max( 1, (int) ( $in['days'] ?? 15 ) );
	$gap  = max( 0, (int) ( $in['gap'] ?? 7 ) );
	$city = sanitize_text_field( $in['city'] ?? 'all' );
	$map  = wt_sent_map( 'wa' );
	$due  = wt_due_customers( $days, $city );
	$send = array();
	$skip = 0;
	foreach ( $due as $c ) {
		if ( wt_sent_recently( $map, $c['phone'], $gap ) ) {
			++$skip;
			continue;
		}
		$send[] = $c;
	}
	$s = wt_config()['settings'];
	return array(
		'count'    => count( $send ),
		'skipped'  => $skip,
		'sample'   => array_slice( $send, 0, 60 ),
		'template' => (string) ( $s['waTemplates']['reminder'] ?? '' ),
		'waOn'     => 'off' !== $s['waMode'],
		'history'  => array_map(
			function ( $h ) {
				$r = wt_remind_report( $h );
				unset( $r['rows'] );
				return array_merge( $h, array( 'report' => $r ) );
			},
			array_slice( (array) get_option( 'wt_remind_log', array() ), 0, 10 )
		),
	);
}

/** Start a run: freeze the list of phones, then the browser sends it in batches. */
function wt_api_remind_start( $in ) {
	$s = wt_config()['settings'];
	if ( 'off' === $s['waMode'] ) {
		return wt_err( 'WhatsApp is not connected. Set it up in Settings first.' );
	}
	if ( 'cloud' === $s['waMode'] && empty( $s['waTemplates']['reminder'] ) ) {
		return wt_err( 'Add the WhatsApp template name for "Grooming reminder" in Settings → WhatsApp messages first.' );
	}
	$all    = array();
	$map    = wt_sent_map( 'wa' );
	$gap    = max( 0, (int) ( $in['gap'] ?? 7 ) );
	foreach ( wt_due_customers( max( 1, (int) ( $in['days'] ?? 15 ) ), sanitize_text_field( $in['city'] ?? 'all' ) ) as $c ) {
		if ( ! wt_sent_recently( $map, $c['phone'], $gap ) ) {
			$all[] = $c;
		}
	}
	if ( ! $all ) {
		return wt_err( 'Nobody to remind right now.' );
	}
	global $wpdb;
	foreach ( $wpdb->get_col( "SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE 'wt\\_job\\_%'" ) as $old ) { // phpcs:ignore
		$o = get_option( $old );
		if ( ! is_array( $o ) || empty( $o['ts'] ) || $o['ts'] < time() - DAY_IN_SECONDS ) {
			delete_option( $old );
		}
	}
	$job = 'rj' . strtolower( wp_generate_password( 8, false, false ) );
	// Saved in the database (not the cache) so a big list can't disappear between batches.
	update_option( 'wt_job_' . $job, array( 'list' => $all, 'sent' => 0, 'failed' => 0, 'by' => wp_get_current_user()->display_name, 'at' => wt_now_label(), 'ts' => time(), 'fromId' => wt_last_notif_id() ), false );
	return array( 'job' => $job, 'total' => count( $all ) );
}

function wt_api_remind_batch( $in ) {
	$job = sanitize_key( $in['job'] ?? '' );
	wp_cache_delete( 'wt_job_' . $job, 'options' );
	$j = get_option( 'wt_job_' . $job );
	if ( ! $j || ! is_array( $j ) ) {
		return wt_err( 'This reminder run has expired. Start again.' );
	}
	if ( function_exists( 'set_time_limit' ) ) {
		@set_time_limit( 120 ); // phpcs:ignore
	}
	$offset = max( 0, (int) ( $in['offset'] ?? 0 ) );
	$part   = array_slice( $j['list'], $offset, 10 );
	$link   = wt_app_url( 'book' );
	$done   = array();
	$GLOBALS['wt_notif_tag'] = $job;
	foreach ( $part as $c ) {
		$before = wt_last_notif_id();
		wt_whatsapp(
			$c['phone'],
			'reminder',
			array( wt_first( $c['name'] ) ? wt_first( $c['name'] ) : 'there', $c['pet'], $c['days'], $link ),
			sprintf( 'Hi %s, it has been %d days since %s was groomed. Book the next home groom: %s', wt_first( $c['name'] ), $c['days'], $c['pet'], $link )
		);
		$res = wt_last_notif_result( $before );
		if ( 0 === strpos( $res, 'Failed' ) || 0 === strpos( $res, 'Not sent' ) ) {
			++$j['failed'];
		} else {
			++$j['sent'];
			$done[] = $c['phone'];
		}
	}
	unset( $GLOBALS['wt_notif_tag'] );
	wt_sent_mark( 'wa', $done );
	$next = $offset + count( $part );
	$fin  = $next >= count( $j['list'] );
	update_option( 'wt_job_' . $job, $j, false );
	if ( $fin ) {
		$log = (array) get_option( 'wt_remind_log', array() );
		array_unshift( $log, array( 'at' => $j['at'], 'by' => $j['by'], 'total' => count( $j['list'] ), 'sent' => $j['sent'], 'failed' => $j['failed'], 'job' => $job, 'fromId' => (int) ( $j['fromId'] ?? 0 ), 'toId' => wt_last_notif_id() ) );
		update_option( 'wt_remind_log', array_slice( $log, 0, 30 ), false );
		delete_option( 'wt_job_' . $job );
	}
	return array( 'offset' => $next, 'total' => count( $j['list'] ), 'sent' => $j['sent'], 'failed' => $j['failed'], 'done' => $fin );
}

/** Send one sample reminder to a number of the admin's choice. */
function wt_api_remind_test( $in ) {
	$phone = wt_phone( $in['phone'] ?? '' );
	if ( ! wt_valid_mobile( $phone ) ) {
		return wt_err( 'Enter a valid 10-digit mobile number.' );
	}
	$before = wt_last_notif_id();
	$link   = wt_app_url( 'book' );
	wt_whatsapp( $phone, 'reminder', array( 'Riya', 'Bruno', 21, $link ), 'Test reminder: Hi Riya, it has been 21 days since Bruno was groomed. ' . $link );
	$res = wt_last_notif_result( $before );
	if ( 0 === strpos( $res, 'Failed' ) || 0 === strpos( $res, 'Not sent' ) ) {
		return wt_err( $res );
	}
	return array( 'ok' => true, 'result' => $res );
}

/* ---------- delivery report for a reminder run ---------- */

/** What happened to each message of a run, from WhatsApp's delivery reports. */
function wt_remind_report( $entry ) {
	global $wpdb;
	$sql  = 'SELECT data FROM ' . wt_table() . " WHERE type = 'notif' AND data LIKE %s";
	$args = array( '%Grooming reminder%' );
	if ( ! empty( $entry['fromId'] ) ) {
		$sql   .= ' AND id > %d';
		$args[] = (int) $entry['fromId'];
	}
	if ( ! empty( $entry['toId'] ) ) {
		$sql   .= ' AND id <= %d';
		$args[] = (int) $entry['toId'];
	}
	$names = array();
	foreach ( wt_all_bookings() as $b ) {
		if ( ! empty( $b['phone'] ) ) {
			$names[ wt_phone( $b['phone'] ) ] = array( $b['name'] ?? '', $b['city'] ?? '' );
		}
	}
	$out = array( 'delivered' => 0, 'read' => 0, 'failed' => 0, 'waiting' => 0, 'reasons' => array(), 'rows' => array() );
	foreach ( $wpdb->get_col( $wpdb->prepare( $sql, $args ) ) as $raw ) { // phpcs:ignore
		$d = json_decode( $raw, true );
		if ( ! $d || 0 !== strpos( (string) ( $d['subject'] ?? '' ), 'Grooming reminder' ) ) {
			continue;
		}
		if ( ! empty( $entry['job'] ) && ( $d['tag'] ?? '' ) !== $entry['job'] ) {
			continue;
		}
		$r = (string) $d['result'];
		if ( 0 === strpos( $r, 'Read' ) ) {
			$st = 'Read';
			++$out['read'];
		} elseif ( 0 === strpos( $r, 'Delivered' ) ) {
			$st = 'Delivered';
			++$out['delivered'];
		} elseif ( 0 === strpos( $r, 'Failed' ) || 0 === strpos( $r, 'Not sent' ) ) {
			$st = 'Failed';
			++$out['failed'];
			$why = wt_wa_reason( $r );
			$out['reasons'][ $why ] = ( $out['reasons'][ $why ] ?? 0 ) + 1;
		} else {
			$st = 'Waiting';
			++$out['waiting'];
		}
		$p             = wt_phone( $d['to'] );
		$out['rows'][] = array( 'phone' => $p, 'name' => $names[ $p ][0] ?? '', 'city' => wt_city_name( $names[ $p ][1] ?? '' ), 'status' => $st, 'detail' => 'Failed' === $st ? wt_wa_reason( $r ) : '', 'at' => $d['at'] ?? '' );
	}
	arsort( $out['reasons'] );
	return $out;
}

/** Plain-language reason for a WhatsApp failure code. */
function wt_wa_reason( $r ) {
	$map = array(
		'131049' => 'Meta limit on marketing messages (try again in a few days)',
		'131026' => 'Not on WhatsApp or very old WhatsApp app',
		'130472' => 'Number in Meta experiment group (no marketing messages)',
		'131050' => 'Customer stopped marketing messages from you',
		'131047' => 'More than 24 hours since the customer last messaged',
		'131056' => 'Too many messages to this number at once',
		'131053' => 'Media could not be uploaded',
		'132001' => 'Template name or language wrong',
		'131008' => 'Template details missing',
		'190'    => 'WhatsApp access token expired',
	);
	foreach ( $map as $code => $label ) {
		if ( false !== strpos( $r, $code ) ) {
			return $label;
		}
	}
	return trim( preg_replace( '/^(Failed|Not sent)\W*/', '', $r ), " )" );
}

function wt_api_remind_report( $in ) {
	$log = array_values( (array) get_option( 'wt_remind_log', array() ) );
	$i   = (int) ( $in['i'] ?? 0 );
	if ( ! isset( $log[ $i ] ) ) {
		return wt_err( 'Run not found.' );
	}
	$rep = wt_remind_report( $log[ $i ] );
	if ( 'csv' === ( $in['format'] ?? '' ) ) {
		$rows = array_map(
			function ( $r ) {
				return array( $r['name'], $r['phone'], $r['city'], $r['status'], $r['detail'], $r['at'] );
			},
			$rep['rows']
		);
		wt_csv_send( 'whatsapp-reminder-report-' . sanitize_file_name( str_replace( array( ',', ' ', ':' ), '-', $log[ $i ]['at'] ) ) . '.csv', array( 'Customer', 'Phone', 'City', 'Status', 'Why it failed', 'Sent at' ), $rows );
	}
	unset( $rep['rows'] );
	return $rep;
}

function wt_last_notif_id() {
	global $wpdb;
	return (int) $wpdb->get_var( 'SELECT MAX(id) FROM ' . wt_table() . " WHERE type = 'notif'" ); // phpcs:ignore
}
function wt_last_notif_result( $after_id ) {
	global $wpdb;
	$row = $wpdb->get_var( $wpdb->prepare( 'SELECT data FROM ' . wt_table() . " WHERE type = 'notif' AND id > %d ORDER BY id DESC LIMIT 1", $after_id ) ); // phpcs:ignore
	$d   = $row ? json_decode( $row, true ) : null;
	return $d ? (string) $d['result'] : 'Not sent';
}

/* ---------- daily reminder email ---------- */

function wt_campaign_defaults() {
	return array(
		'on'      => false,
		'subject' => 'Time for {pet}\'s next groom?',
		'image'   => '',
		'text'    => "Hi {name},\n\nIt has been a while since {pet}'s last groom. Our groomers come to your home with everything needed.\n\nBook a slot that suits you.",
		'button'  => 'Book grooming',
		'start'   => wt_today(),
		'end'     => wt_today( 30 ),
		'time'    => '10:00',
		'days'    => 15,
		'gap'     => 7,
		'city'    => 'all',
		'perRun'  => 40,
		'lastRun' => '',
		'queue'   => array(),
		'log'     => array(),
	);
}

function wt_campaign() {
	$c = get_option( 'wt_campaign' );
	return wp_parse_args( is_array( $c ) ? $c : array(), wt_campaign_defaults() );
}

function wt_campaign_save( $c ) {
	update_option( 'wt_campaign', $c, false );
}

function wt_unsub_list() {
	$u = get_option( 'wt_unsub' );
	return is_array( $u ) ? $u : array();
}

function wt_unsub_link( $email ) {
	$email = strtolower( $email );
	return add_query_arg(
		array(
			'e' => rawurlencode( $email ),
			'k' => substr( hash_hmac( 'sha256', $email, wp_salt( 'auth' ) ), 0, 20 ),
		),
		rest_url( 'wt/v1/unsubscribe' )
	);
}

function wt_fill( $text, $c ) {
	return strtr(
		(string) $text,
		array(
			'{name}' => wt_first( $c['name'] ?? '' ) ? wt_first( $c['name'] ) : 'there',
			'{pet}'  => $c['pet'] ?? 'your pet',
			'{days}' => (string) ( $c['days'] ?? '' ),
		)
	);
}

/** Build the email HTML: image, text, button, unsubscribe line. */
function wt_campaign_html( $cfg, $c ) {
	$btn  = wt_app_url( 'book' );
	$html = '<div style="background:#FBF8F6;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#2A1608">'
		. '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #E7DAD0">';
	if ( $cfg['image'] ) {
		$html .= '<a href="' . esc_url( $btn ) . '"><img src="' . esc_url( $cfg['image'] ) . '" alt="Wag &amp; Tails" style="display:block;width:100%;height:auto;border:0"></a>';
	}
	$html .= '<div style="padding:22px 24px;font-size:15px;line-height:1.6">' . wpautop( esc_html( wt_fill( $cfg['text'], $c ) ) );
	if ( $cfg['button'] ) {
		$html .= '<p style="margin:22px 0 6px"><a href="' . esc_url( $btn ) . '" style="background:#4B1D00;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px;display:inline-block">' . esc_html( $cfg['button'] ) . '</a></p>';
	}
	$html .= '</div></div><p style="max-width:560px;margin:12px auto 0;font-size:12px;color:#76624F;text-align:center">' . esc_html( get_bloginfo( 'name' ) )
		. ( ! empty( $c['email'] ) ? ' · <a href="' . esc_url( wt_unsub_link( $c['email'] ) ) . '" style="color:#76624F">Stop these reminder emails</a>' : '' ) . '</p></div>';
	return $html;
}

function wt_campaign_send_one( $cfg, $c ) {
	$headers = array( 'Content-Type: text/html; charset=UTF-8' );
	if ( ! empty( $c['email'] ) ) {
		$headers[] = 'List-Unsubscribe: <' . wt_unsub_link( $c['email'] ) . '>';
	}
	return wp_mail( $c['email'], wt_fill( $cfg['subject'], $c ), wt_campaign_html( $cfg, $c ), $headers );
}

/** Who would get today's email (due, has email, not unsubscribed, not emailed within the gap). */
function wt_campaign_audience( $cfg ) {
	$unsub = wt_unsub_list();
	$map   = wt_sent_map( 'mail' );
	$seen  = array();
	$out   = array();
	foreach ( wt_due_customers( (int) $cfg['days'], $cfg['city'] ) as $c ) {
		$e = strtolower( (string) $c['email'] );
		if ( ! $e || ! is_email( $e ) || isset( $unsub[ $e ] ) || isset( $seen[ $e ] ) || wt_sent_recently( $map, $e, (int) $cfg['gap'] ) ) {
			continue;
		}
		$seen[ $e ] = true;
		$out[]      = $c;
	}
	return $out;
}

/** Runs every 5 minutes: fills today's queue once at the send time, then sends a few emails per run. */
function wt_campaign_tick() {
	$cfg = wt_campaign();
	if ( empty( $cfg['on'] ) ) {
		return;
	}
	$today = wt_today();
	if ( ! $cfg['queue'] && $cfg['lastRun'] !== $today && $today >= $cfg['start'] && $today <= $cfg['end'] && wp_date( 'H:i' ) >= $cfg['time'] ) {
		$aud            = wt_campaign_audience( $cfg );
		$cfg['queue']   = $aud;
		$cfg['lastRun'] = $today;
		array_unshift( $cfg['log'], array( 'date' => $today, 'queued' => count( $aud ), 'sent' => 0, 'failed' => 0 ) );
		$cfg['log'] = array_slice( $cfg['log'], 0, 60 );
		wt_campaign_save( $cfg );
	}
	if ( ! $cfg['queue'] ) {
		return;
	}
	$batch        = array_splice( $cfg['queue'], 0, max( 5, min( 100, (int) $cfg['perRun'] ) ) );
	$sent         = array();
	$ok           = 0;
	$bad          = 0;
	foreach ( $batch as $c ) {
		if ( wt_campaign_send_one( $cfg, $c ) ) {
			++$ok;
			$sent[] = strtolower( $c['email'] );
		} else {
			++$bad;
		}
	}
	wt_sent_mark( 'mail', $sent );
	if ( $cfg['log'] ) {
		$cfg['log'][0]['sent']   += $ok;
		$cfg['log'][0]['failed'] += $bad;
	}
	wt_campaign_save( $cfg );
}

add_filter(
	'cron_schedules',
	function ( $s ) {
		$s['wt_5min'] = array( 'interval' => 300, 'display' => 'Every 5 minutes (Wag & Tails)' );
		return $s;
	}
);
add_action( 'wt_campaign_tick', 'wt_campaign_tick' );
add_action(
	'init',
	function () {
		if ( ! wp_next_scheduled( 'wt_campaign_tick' ) ) {
			wp_schedule_event( time() + 60, 'wt_5min', 'wt_campaign_tick' );
		}
	}
);

function wt_api_campaign_get() {
	$cfg = wt_campaign();
	$aud = wt_campaign_audience( $cfg );
	return array(
		'campaign' => array_diff_key( $cfg, array( 'queue' => 1 ) ),
		'queueLeft' => count( $cfg['queue'] ),
		'audience' => count( $aud ),
		'sample'   => array_slice( $aud, 0, 20 ),
		'unsub'    => count( wt_unsub_list() ),
		'now'      => wp_date( 'j M Y, g:i A' ),
		'cronOk'   => (bool) wp_next_scheduled( 'wt_campaign_tick' ),
	);
}

function wt_api_campaign_save( $in ) {
	$cfg = wt_campaign();
	if ( 'test' === ( $in['action'] ?? '' ) ) {
		$to = sanitize_email( $in['to'] ?? '' );
		if ( ! is_email( $to ) ) {
			return wt_err( 'Enter the email address for the test.' );
		}
		$tmp = array_merge( $cfg, wt_campaign_clean( $in ) );
		$ok  = wt_campaign_send_one( $tmp, array( 'name' => 'Riya Sharma', 'pet' => 'Bruno', 'days' => 21, 'email' => $to ) );
		return $ok ? array( 'ok' => true ) : wt_err( 'The test email could not be sent. Check WP Mail SMTP.' );
	}
	if ( 'stop' === ( $in['action'] ?? '' ) ) {
		$cfg['queue'] = array();
		$cfg['on']    = false;
		wt_campaign_save( $cfg );
		return wt_api_campaign_get();
	}
	$new = wt_campaign_clean( $in );
	if ( ! empty( $new['on'] ) ) {
		if ( ! $new['subject'] || ! trim( $new['text'] ) ) {
			return wt_err( 'Add a subject and the email text before switching it on.' );
		}
		if ( $new['end'] < $new['start'] ) {
			return wt_err( 'The end date must be after the start date.' );
		}
	}
	// Changing the dates or time lets today's email go out again at the new time.
	if ( $new['time'] !== $cfg['time'] || $new['start'] !== $cfg['start'] ) {
		$cfg['lastRun'] = $cfg['queue'] ? $cfg['lastRun'] : '';
	}
	wt_campaign_save( array_merge( $cfg, $new ) );
	return wt_api_campaign_get();
}

function wt_campaign_clean( $in ) {
	$d = wt_campaign_defaults();
	return array(
		'on'      => ! empty( $in['on'] ),
		'subject' => mb_substr( sanitize_text_field( (string) ( $in['subject'] ?? '' ) ), 0, 150 ),
		'image'   => esc_url_raw( (string) ( $in['image'] ?? '' ) ),
		'text'    => mb_substr( sanitize_textarea_field( (string) ( $in['text'] ?? '' ) ), 0, 3000 ),
		'button'  => mb_substr( sanitize_text_field( (string) ( $in['button'] ?? '' ) ), 0, 40 ),
		'start'   => wt_ymd( $in['start'] ?? '', $d['start'] ),
		'end'     => wt_ymd( $in['end'] ?? '', $d['end'] ),
		'time'    => preg_match( '/^\d{2}:\d{2}$/', (string) ( $in['time'] ?? '' ) ) ? $in['time'] : '10:00',
		'days'    => max( 1, min( 365, (int) ( $in['days'] ?? 15 ) ) ),
		'gap'     => max( 1, min( 90, (int) ( $in['gap'] ?? 7 ) ) ),
		'city'    => wt_city( (string) ( $in['city'] ?? '' ) ) ? $in['city'] : 'all',
		'perRun'  => max( 5, min( 100, (int) ( $in['perRun'] ?? 40 ) ) ),
	);
}

/** Admin image upload for the email (saved to the Media Library). */
function wt_api_upload( WP_REST_Request $r ) {
	$files = $r->get_file_params();
	if ( empty( $files['file'] ) ) {
		return wt_err( 'Choose an image.' );
	}
	$f = $files['file'];
	if ( ! in_array( wp_check_filetype( $f['name'] )['type'], array( 'image/jpeg', 'image/png', 'image/gif', 'image/webp' ), true ) ) {
		return wt_err( 'Use a JPG, PNG, GIF or WEBP image.' );
	}
	if ( $f['size'] > 5 * MB_IN_BYTES ) {
		return wt_err( 'The image must be under 5 MB.' );
	}
	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once ABSPATH . 'wp-admin/includes/media.php';
	require_once ABSPATH . 'wp-admin/includes/image.php';
	$_FILES['wt_upload'] = $f;
	$id                  = media_handle_upload( 'wt_upload', 0 );
	if ( is_wp_error( $id ) ) {
		return wt_err( $id->get_error_message() );
	}
	return array( 'url' => wp_get_attachment_url( $id ), 'id' => $id );
}

/** One-click unsubscribe from the reminder emails. */
function wt_api_unsubscribe( WP_REST_Request $r ) {
	$e  = strtolower( sanitize_email( rawurldecode( (string) $r->get_param( 'e' ) ) ) );
	$k  = (string) $r->get_param( 'k' );
	$ok = $e && hash_equals( substr( hash_hmac( 'sha256', $e, wp_salt( 'auth' ) ), 0, 20 ), $k );
	if ( $ok ) {
		$u       = wt_unsub_list();
		$u[ $e ] = wt_today();
		update_option( 'wt_unsub', $u, false );
	}
	nocache_headers();
	header( 'Content-Type: text/html; charset=utf-8' );
	echo '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wag &amp; Tails</title><div style="font-family:Arial,sans-serif;max-width:460px;margin:60px auto;padding:0 16px;text-align:center;color:#2A1608"><h2>'
		. ( $ok ? 'You will not get reminder emails any more.' : 'This link is not valid.' ) . '</h2><p><a href="' . esc_url( home_url( '/' ) ) . '" style="color:#4B1D00">Back to Wag &amp; Tails</a></p></div>';
	exit;
}

add_action(
	'rest_api_init',
	function () {
		$routes = array(
			array( 'GET', 'admin/remind', 'wt_can_admin', 'wt_api_remind_preview' ),
			array( 'POST', 'admin/remind/start', 'wt_can_admin', 'wt_api_remind_start' ),
			array( 'POST', 'admin/remind/batch', 'wt_can_admin', 'wt_api_remind_batch' ),
			array( 'POST', 'admin/remind/test', 'wt_can_admin', 'wt_api_remind_test' ),
			array( 'GET', 'admin/remind/report', 'wt_can_admin', 'wt_api_remind_report' ),
			array( 'GET', 'admin/campaign', 'wt_can_admin', 'wt_api_campaign_get' ),
			array( 'POST', 'admin/campaign', 'wt_can_admin', 'wt_api_campaign_save' ),
		);
		foreach ( $routes as $rt ) {
			register_rest_route( 'wt/v1', '/' . $rt[1], array( 'methods' => $rt[0], 'permission_callback' => $rt[2], 'callback' => wt_rest( $rt[3] ) ) );
		}
		register_rest_route( 'wt/v1', '/admin/upload', array( 'methods' => 'POST', 'permission_callback' => 'wt_can_admin', 'callback' => 'wt_api_upload' ) );
		register_rest_route( 'wt/v1', '/unsubscribe', array( 'methods' => 'GET', 'permission_callback' => '__return_true', 'callback' => 'wt_api_unsubscribe' ) );
	}
);

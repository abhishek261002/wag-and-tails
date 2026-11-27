<?php
/**
 * Email (wp_mail) and WhatsApp messages. Every message is also written to the Notifications log.
 *
 * WhatsApp needs a WhatsApp Business API account. Two ways to connect:
 *  - Meta WhatsApp Cloud API: approved message templates, one per event (see WT_WA_EVENTS for the variables).
 *  - Webhook: the plugin POSTs JSON {event, to, message, params} to a URL from your provider or automation tool.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Event => list of template variables, in order ({{1}}, {{2}}, ...). */
function wt_wa_events() {
	return array(
		'booking_customer' => array( 'label' => 'Booking confirmed (to customer)', 'vars' => array( 'Customer first name', 'Booking ID', 'Package', 'Date', 'Time', 'Total', 'Payment' ) ),
		'booking_admin'    => array( 'label' => 'New booking (to your alert number)', 'vars' => array( 'Customer name', 'Customer phone', 'Booking ID', 'Package', 'City', 'Date & time', 'Address' ) ),
		'rescheduled'      => array( 'label' => 'Booking rescheduled (to customer)', 'vars' => array( 'Customer first name', 'Booking ID', 'New date', 'New time' ) ),
		'cancelled'        => array( 'label' => 'Booking cancelled (to customer)', 'vars' => array( 'Customer first name', 'Booking ID', 'Reason' ) ),
		'completed'        => array( 'label' => 'Grooming complete (to customer)', 'vars' => array( 'Customer first name', 'Booking ID', 'Amount', 'Payment mode' ) ),
		'booking_customer_basic' => array( 'label' => 'Booking confirmed, cities without the redo promise (to customer)', 'vars' => array( 'Customer first name', 'Booking ID', 'Package', 'Date', 'Time', 'Total', 'Payment' ) ),
		'groomer_assigned' => array( 'label' => 'Groomer assigned (to customer, from the partner app)', 'vars' => array( 'Customer first name', 'Booking ID', 'Groomer name', 'Date', 'Time' ) ),
		'groomer_on_way'   => array( 'label' => 'Groomer on the way (to customer, with tracking link and start code)', 'vars' => array( 'Customer first name', 'Groomer name', 'Tracking link', 'Start code' ) ),
		'groom_end_code'   => array( 'label' => 'Grooming started: end code (to customer)', 'vars' => array( 'Customer first name', 'End code' ) ),
		'job_alert_admin'  => array( 'label' => 'Booking needs the desk: no groomer, released, customer not home (to your alert number)', 'vars' => array( 'Booking ID', 'Problem', 'Customer name', 'Date & time' ) ),
		'points_earned'    => array( 'label' => 'Points earned (to customer)', 'vars' => array( 'Customer first name', 'Points earned', 'New balance' ) ),
		'loyal_reward'     => array( 'label' => 'Loyal customer gift (to customer)', 'vars' => array( 'Customer first name', 'Gift / offer' ) ),
		'walk_admin'       => array( 'label' => 'New dog walking request (to your alert number)', 'vars' => array( 'Customer name', 'Customer phone', 'Details' ) ),
		'reminder'         => array( 'label' => 'Grooming reminder (bulk, to customer)', 'vars' => array( 'Customer first name', 'Pet (breed)', 'Days since last groom', 'Booking link' ) ),
		'otp'              => array( 'label' => 'Login code (Authentication template with Copy code button)', 'vars' => array( 'Code' ) ),
		'insurance_admin'  => array( 'label' => 'New insurance enquiry (to your alert number)', 'vars' => array( 'Customer name', 'Customer phone', 'Details' ) ),
		'complaint_registered' => array( 'label' => 'Complaint registered (to customer)', 'vars' => array( 'Customer first name', 'Complaint ID', 'About (booking ID or topic)' ) ),
		'complaint_resolved'   => array( 'label' => 'Complaint resolved (to customer)', 'vars' => array( 'Customer first name', 'Complaint ID', 'Resolution' ) ),
		'job_application_admin' => array( 'label' => 'New job application (to your alert number, optional)', 'vars' => array( 'Job title', 'Applicant name', 'Applicant phone' ) ),
		'complaint_admin'      => array( 'label' => 'New complaint (to your alert number, optional)', 'vars' => array( 'Customer name', 'Customer phone', 'Complaint ID', 'Topic', 'Booking ID' ) ),
		'event_pass'       => array( 'label' => 'Event pass confirmed (to customer)', 'vars' => array( 'Customer first name', 'Event', 'Date & time', 'Venue', 'Passes', 'Pass ID' ) ),
		'event_invite'     => array( 'label' => 'Event invite (broadcast, Marketing template)', 'vars' => array( 'Customer first name', 'Event', 'City', 'Date & time', 'Venue', 'Pass price from', 'Event link' ) ),
		'broadcast'        => array( 'label' => 'Broadcast / update (Marketing template)', 'vars' => array( 'Customer first name', 'Your message', 'Link' ) ),
	);
}

function wt_log_notif( $channel, $to, $subject, $body, $result, $wamid = '' ) {
	wt_rec_insert(
		'notif',
		array(
			'channel' => $channel,
			'to'      => $to,
			'subject' => $subject,
			'body'    => $body,
			'result'  => $result,
			'wamid'   => $wamid,
			'tag'     => isset( $GLOBALS['wt_notif_tag'] ) ? (string) $GLOBALS['wt_notif_tag'] : '',
			'at'      => wt_now_label(),
		),
		'N'
	);
}

function wt_email( $to, $subject, $body ) {
	if ( ! $to || ! is_email( $to ) ) {
		return;
	}
	$site    = get_bloginfo( 'name' );
	$html    = '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#2A1608">' . wpautop( esc_html( $body ) ) . '<p style="color:#76624F;font-size:13px">' . esc_html( $site ) . '</p></div>';
	$headers = array( 'Content-Type: text/html; charset=UTF-8' );
	$ok      = wp_mail( $to, $subject, $html, $headers );
	wt_log_notif( 'Email', $to, $subject, $body, $ok ? 'Sent' : 'Failed (check WP Mail SMTP)' );
}

/**
 * @param string $to     Mobile number (10 digits or with 91).
 * @param string $event  Key from wt_wa_events().
 * @param array  $params Template variables, in order.
 * @param string $text   Readable message for the log and webhook.
 */
function wt_whatsapp( $to, $event, $params, $text ) {
	$s     = wt_config()['settings'];
	$digits = preg_replace( '/\D/', '', (string) $to );
	if ( strlen( $digits ) === 10 ) {
		$digits = '91' . $digits;
	}
	if ( strlen( $digits ) < 11 ) {
		return;
	}
	$events = wt_wa_events();
	$label  = isset( $events[ $event ] ) ? $events[ $event ]['label'] : $event;
	$params = array_map( 'strval', array_values( $params ) );
	$result = 'Not sent (WhatsApp is not connected)';
	$wamid  = '';

	if ( 'cloud' === $s['waMode'] ) {
		$tpl = isset( $s['waTemplates'][ $event ] ) ? trim( (string) $s['waTemplates'][ $event ] ) : '';
		if ( ! $tpl ) {
			$result = 'Not sent (no template name set for this message)';
		} elseif ( ! $s['waPhoneId'] || ! $s['waToken'] ) {
			$result = 'Not sent (Phone number ID or access token missing)';
		} else {
			$payload = array(
				'messaging_product' => 'whatsapp',
				'to'                => $digits,
				'type'              => 'template',
				'template'          => array(
					'name'       => $tpl,
					'language'   => array( 'code' => $s['waLang'] ? $s['waLang'] : 'en' ),
					'components' => array(
						array(
							'type'       => 'body',
							'parameters' => array_map(
								function ( $p ) {
									return array( 'type' => 'text', 'text' => '' !== $p ? $p : '-' );
								},
								$params
							),
						),
					),
				),
			);
			$res = wp_remote_post(
				'https://graph.facebook.com/v23.0/' . rawurlencode( $s['waPhoneId'] ) . '/messages',
				array(
					'timeout' => 10,
					'headers' => array(
						'Authorization' => 'Bearer ' . $s['waToken'],
						'Content-Type'  => 'application/json',
					),
					'body'    => wp_json_encode( $payload ),
				)
			);
			$result = wt_http_result( $res );
			if ( ! is_wp_error( $res ) ) {
				$rb    = json_decode( wp_remote_retrieve_body( $res ), true );
				$wamid = (string) ( $rb['messages'][0]['id'] ?? '' );
				if ( 'Sent' === $result ) {
					$result = 'Accepted by WhatsApp (waiting for delivery report)';
				}
			}
		}
	} elseif ( 'webhook' === $s['waMode'] ) {
		if ( ! $s['webhookUrl'] ) {
			$result = 'Not sent (webhook URL missing)';
		} else {
			$res    = wp_remote_post(
				$s['webhookUrl'],
				array(
					'timeout' => 10,
					'headers' => array( 'Content-Type' => 'application/json' ),
					'body'    => wp_json_encode(
						array(
							'event'   => $event,
							'to'      => $digits,
							'message' => $text,
							'params'  => $params,
						)
					),
				)
			);
			$result = wt_http_result( $res );
		}
	}
	wt_log_notif( 'WhatsApp', $digits, $label, $text, $result, $wamid );
}

function wt_http_result( $res ) {
	if ( is_wp_error( $res ) ) {
		return 'Failed: ' . $res->get_error_message();
	}
	$code = wp_remote_retrieve_response_code( $res );
	if ( $code >= 200 && $code < 300 ) {
		return 'Sent';
	}
	$body = json_decode( wp_remote_retrieve_body( $res ), true );
	$msg  = isset( $body['error']['message'] ) ? $body['error']['message'] : wp_remote_retrieve_response_message( $res );
	return 'Failed (' . $code . '): ' . $msg;
}

function wt_money( $n ) {
	return '₹' . number_format_i18n( round( (float) $n ) );
}

function wt_first( $name ) {
	$name = trim( preg_replace( '/^Sample:\s*/', '', (string) $name ) );
	$p    = explode( ' ', $name );
	return $p[0];
}

function wt_fmt_date( $ymd ) {
	$t = strtotime( $ymd . ' 00:00:00' );
	return $t ? date_i18n( 'j M Y', $t ) : $ymd;
}

/* ---------- booking messages ---------- */

function wt_booking_pkg_label( $b ) {
	if ( ! empty( $b['pkgName'] ) && ( ! empty( $b['custom'] ) || ! wt_find( wt_config()['packages'], 'id', $b['pkg'] ?? '' ) ) ) {
		return $b['pkgName'];
	}
	return wt_pkg_name( $b['pkg'] ?? '' );
}

function wt_pkg_name( $id ) {
	$p = wt_find( wt_config()['packages'], 'id', $id );
	return $p ? $p['name'] : $id;
}

/** True when bookings in this city get the 24-hour free redo promise in their messages. */
function wt_redo_city( $city ) {
	$list = array_map( 'strtolower', (array) wt_config()['settings']['redoCities'] );
	return in_array( strtolower( (string) $city ), $list, true );
}

function wt_notify_booking_new( $b ) {
	$s    = wt_config()['settings'];
	$pay  = ! empty( $b['redo'] ) ? 'Free redo service' : ( 'online' === $b['pay'] ? 'Paid online' : 'Pay after service' );
	$line = sprintf( 'Booking %s: %s for your %s (%s) on %s at %s, %s. Total %s (%s).', $b['id'], wt_booking_pkg_label( $b ), strtolower( $b['petType'] ), $b['breed'], wt_fmt_date( $b['date'] ), $b['slot'], wt_city_name( $b['city'] ), wt_money( $b['total'] ), strtolower( $pay ) );
	$site  = wt_app_url();
	$redo  = 'Not happy with anything? Within 24 hours of the groom, log in at ' . $site . ' with your mobile number and raise a complaint. We will send the groomer back for a free redo.';
	$promise = wt_redo_city( $b['city'] ?? '' );
	$more  = 'Did you know? We also help you choose pet insurance, and our store has beds, jackets, shampoos and more for your pet: ' . $site . '#shop';
	if ( ! empty( $b['email'] ) ) {
		wt_email( $b['email'], 'Your Wag & Tails grooming is booked', 'Hi ' . wt_first( $b['name'] ) . ",\n\n" . $line . "\n\nAddress: " . $b['address'] . ', ' . $b['pincode'] . "\n\n" . ( $promise ? $redo . "\n\n" : '' ) . $more . "\n\nNeed to change something? Reply to this email or message us on WhatsApp." );
	}
	$ev = 'booking_customer';
	if ( ! $promise ) {
		$tpls = (array) $s['waTemplates'];
		// Cities without the redo promise get the plain confirmation (no redo line); until Meta approves it, the usual one is used.
		$ev = ( 'cloud' !== $s['waMode'] || ! empty( $tpls['booking_customer_basic'] ) ) ? 'booking_customer_basic' : 'booking_customer';
	}
	wt_whatsapp( $b['phone'], $ev, array( wt_first( $b['name'] ), $b['id'], wt_booking_pkg_label( $b ), wt_fmt_date( $b['date'] ), $b['slot'], wt_money( $b['total'] ), $pay ), 'Hi ' . wt_first( $b['name'] ) . '! ' . $line . ' ' . ( $promise ? $redo . ' ' : '' ) . $more );

	$where = $b['address'] . ', ' . $b['pincode'];
	if ( ! empty( $b['lat'] ) ) {
		$where .= ' | Map: https://www.google.com/maps?q=' . $b['lat'] . ',' . $b['lng'];
	} elseif ( ! empty( $b['mapLink'] ) ) {
		$where .= ' | Map: ' . $b['mapLink'];
	}
	$admin_text = sprintf( 'New booking from %s (%s). %s Pet: %s, %s, %s, %s. Aggression: %s. Address: %s', $b['name'], $b['phone'], $line, $b['petType'], $b['breed'], $b['gender'], $b['age'], $b['aggression'], $where );
	wt_email( $s['notifyEmail'], 'New booking ' . $b['id'] . ' – ' . wt_city_name( $b['city'] ), $admin_text );
	if ( $s['notifyWhatsApp'] ) {
		wt_whatsapp( $s['notifyWhatsApp'], 'booking_admin', array( $b['name'], $b['phone'], $b['id'], wt_booking_pkg_label( $b ), wt_city_name( $b['city'] ), wt_fmt_date( $b['date'] ) . ' ' . $b['slot'], $where ), $admin_text );
	}
}

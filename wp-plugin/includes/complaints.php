<?php
/**
 * Complaints: logged-in customers raise a complaint (within 24 hours of a groom for a free redo),
 * staff and admin resolve it. Customers get WhatsApp messages when it is registered and resolved.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const WT_COMPLAINT_HOURS = 24;
const WT_COMPLAINT_CATS  = array( 'Grooming not done properly', 'Haircut / style not as asked', 'Nails, ears or hygiene missed', 'Pet got hurt or stressed', 'Groomer late or did not come', 'Groomer behaviour', 'Payment or price', 'Store order / product', 'Other' );

/** Seconds left to raise a complaint about this booking (0 = window closed). */
function wt_complaint_left( $b ) {
	if ( ! in_array( $b['status'] ?? '', array( 'Completed', 'Confirmed', 'Rescheduled' ), true ) || ! empty( $b['redo'] ) ) {
		return 0;
	}
	if ( 'Completed' !== $b['status'] && ( $b['date'] ?? '' ) > wt_today() ) {
		return 0; // not happened yet
	}
	$done = wt_done_ts( $b );
	if ( 'Completed' !== $b['status'] ) {
		$done = strtotime( ( $b['date'] ?? '' ) . ' 00:00:00 ' . wp_timezone_string() ) + DAY_IN_SECONDS - 1;
	}
	return max( 0, $done + WT_COMPLAINT_HOURS * HOUR_IN_SECONDS - time() );
}

add_filter(
	'wt_booking_for_client',
	function ( $b ) {
		$b['cmpLeft'] = wt_complaint_left( $b );
		return $b;
	}
);

function wt_complaint_client( $c ) {
	unset( $c['internal'] );
	return $c;
}

/* ---------- customer ---------- */

function wt_api_my_complaints() {
	$phone = wt_current_customer_phone();
	if ( ! $phone ) {
		return wt_err( 'Log in with your mobile number first.', 'wt_auth', 401 );
	}
	$list = array_map( 'wt_complaint_client', wt_rec_list( 'complaint', array( 'phone' => $phone ), 'id DESC', 50 ) );
	$bks  = array();
	foreach ( wt_rec_list( 'booking', array( 'phone' => $phone ), 'skey DESC', 30 ) as $b ) {
		if ( 'Pending payment' === $b['status'] || 'Cancelled' === $b['status'] ) {
			continue;
		}
		$bks[] = array(
			'id'           => $b['id'],
			'label'        => wt_booking_pkg_label( $b ) . ' · ' . wt_fmt_date( $b['date'] ) . ' · ' . ( $b['slot'] ?? '' ),
			'status'       => $b['status'],
			'left'         => wt_complaint_left( $b ),
			'complaintRef' => empty( $b['complaintClosed'] ) ? ( $b['complaintRef'] ?? '' ) : '',
		);
	}
	return array( 'complaints' => $list, 'bookings' => $bks, 'cats' => WT_COMPLAINT_CATS, 'hours' => WT_COMPLAINT_HOURS );
}

function wt_api_complaint_create( $in ) {
	$phone = wt_current_customer_phone();
	if ( ! $phone ) {
		return wt_err( 'Log in with your mobile number first.', 'wt_auth', 401 );
	}
	if ( ! wt_rate_ok( 'cmp_' . $phone, 5, DAY_IN_SECONDS ) ) {
		return wt_err( 'You have raised several complaints today. Please call us if it is urgent.' );
	}
	$cat  = in_array( $in['category'] ?? '', WT_COMPLAINT_CATS, true ) ? $in['category'] : 'Other';
	$text = trim( mb_substr( sanitize_textarea_field( (string) ( $in['text'] ?? '' ) ), 0, 1500 ) );
	if ( mb_strlen( $text ) < 10 ) {
		return wt_err( 'Tell us what went wrong (at least a sentence).' );
	}
	$ref = sanitize_text_field( $in['booking'] ?? '' );
	$b   = null;
	if ( $ref ) {
		$b = wt_rec_get( 'booking', $ref );
		if ( ! $b || wt_phone( $b['phone'] ?? '' ) !== $phone ) {
			return wt_err( 'Booking not found.' );
		}
		if ( ! empty( $b['complaintRef'] ) && empty( $b['complaintClosed'] ) ) {
			return wt_err( 'You already have an open complaint (' . $b['complaintRef'] . ') for this booking. We will contact you soon.' );
		}
		if ( ! wt_complaint_left( $b ) ) {
			return wt_err( 'Complaints about a groom can be raised within ' . WT_COMPLAINT_HOURS . ' hours of the service. Please call us and we will help.' );
		}
	}
	$photos = array();
	foreach ( array_slice( (array) ( $in['photos'] ?? array() ), 0, 3 ) as $u ) {
		$u = esc_url_raw( (string) $u );
		// App complaints carry photos stored by the apps' backend (https links); website ones must be our uploads.
		if ( $u && ( 0 === strpos( $u, wp_get_upload_dir()['baseurl'] ) || ( ! empty( $GLOBALS['wt_conn_phone'] ) && 0 === strpos( $u, 'https://' ) ) ) ) {
			$photos[] = $u;
		}
	}
	$prof = function_exists( 'wt_customer' ) ? wt_customer( $phone ) : array();
	$u    = wp_get_current_user();
	$c    = wt_rec_insert(
		'complaint',
		array(
			'phone'    => $phone,
			'name'     => $b['name'] ?? ( $prof['name'] ?? $u->display_name ),
			'email'    => $b['email'] ?? ( $prof['email'] ?? $u->user_email ),
			'city'     => $b['city'] ?? ( $prof['city'] ?? '' ),
			'booking'  => $b ? $b['id'] : '',
			'bkLabel'  => $b ? wt_booking_pkg_label( $b ) . ' · ' . wt_fmt_date( $b['date'] ) . ' · ' . ( $b['slot'] ?? '' ) : '',
			'groomer'  => $b['by'] ?? '',
			'category' => $cat,
			'text'     => $text,
			'photos'   => $photos,
			'status'   => 'Open',
			'ts'       => time(),
			'notes'    => array(),
		),
		'CM'
	);
	if ( $b ) {
		$b['complaintRef']    = $c['id'];
		$b['complaintClosed'] = false;
		wt_rec_save( 'booking', $b );
	}
	$first = wt_first( $c['name'] ) ? wt_first( $c['name'] ) : 'there';
	$about = $b ? 'booking ' . $b['id'] : $cat;
	wt_whatsapp(
		$phone,
		'complaint_registered',
		array( $first, $c['id'], $about ),
		sprintf( 'Hi %s, we have registered your complaint %s about %s. Our team will call you within 24 hours to sort it out.', $first, $c['id'], $about )
	);
	$s     = wt_config()['settings'];
	$alert = sprintf( 'New complaint %s from %s (%s), %s. %s: %s%s', $c['id'], $c['name'], $phone, wt_city_name( $c['city'] ), $cat, $text, $b ? ' [Booking ' . $b['id'] . ']' : '' );
	wt_email( $s['notifyEmail'], 'New complaint ' . $c['id'] . ' – ' . $cat, $alert );
	if ( $s['notifyWhatsApp'] && ! empty( $s['waTemplates']['complaint_admin'] ) ) {
		wt_whatsapp( $s['notifyWhatsApp'], 'complaint_admin', array( $c['name'], $phone, $c['id'], $cat, $b ? $b['id'] : '-' ), $alert );
	}
	return array( 'complaint' => wt_complaint_client( $c ) );
}

/** Customer photo upload for a complaint (images only, 5 MB). */
function wt_api_complaint_upload( WP_REST_Request $r ) {
	$phone = wt_current_customer_phone();
	if ( ! $phone ) {
		return wt_err( 'Log in first.', 'wt_auth', 401 );
	}
	if ( ! wt_rate_ok( 'cmpup_' . $phone, 15, DAY_IN_SECONDS ) ) {
		return wt_err( 'Too many photos today.' );
	}
	$files = $r->get_file_params();
	$f     = $files['file'] ?? null;
	if ( ! $f || ! empty( $f['error'] ) ) {
		return wt_err( 'Choose a photo.' );
	}
	if ( $f['size'] > 5 * MB_IN_BYTES ) {
		return wt_err( 'The photo is too large. Please use one under 5 MB.' );
	}
	$type = wp_check_filetype_and_ext( $f['tmp_name'], $f['name'], array( 'jpg|jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'heic' => 'image/heic' ) );
	if ( empty( $type['type'] ) ) {
		return wt_err( 'Only photos (JPG, PNG, WEBP) can be added.' );
	}
	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once ABSPATH . 'wp-admin/includes/media.php';
	require_once ABSPATH . 'wp-admin/includes/image.php';
	$f['name'] = 'complaint-' . $phone . '-' . time() . '.' . $type['ext'];
	$id        = media_handle_sideload( $f, 0 );
	if ( is_wp_error( $id ) ) {
		return wt_err( 'Could not save the photo. Please try again.' );
	}
	return array( 'url' => wp_get_attachment_image_url( $id, 'large' ) ? wp_get_attachment_image_url( $id, 'large' ) : wp_get_attachment_url( $id ) );
}

/* ---------- staff & admin ---------- */

function wt_api_desk_complaints( $in ) {
	$scope  = wt_desk_city();
	$status = sanitize_key( $in['status'] ?? 'open' );
	$where  = array();
	if ( 'open' === $status ) {
		$where['status'] = 'Open';
	} elseif ( 'resolved' === $status ) {
		$where['status'] = 'Resolved';
	}
	if ( 'all' !== $scope ) {
		$where['city'] = $scope;
	}
	$list = wt_rec_list( 'complaint', $where, 'id DESC', 300 );
	$bks  = array();
	foreach ( $list as $c ) {
		if ( $c['booking'] && ! isset( $bks[ $c['booking'] ] ) ) {
			$b = wt_rec_get( 'booking', $c['booking'] );
			if ( $b ) {
				$bks[ $b['id'] ] = function_exists( 'wt_booking_for_client' ) ? wt_booking_for_client( $b ) : $b;
			}
		}
	}
	$open = count( wt_rec_list( 'complaint', array_merge( array( 'status' => 'Open' ), 'all' !== $scope ? array( 'city' => $scope ) : array() ), 'id DESC', 1000 ) );
	return array( 'list' => $list, 'bookings' => array_values( $bks ), 'open' => $open );
}

function wt_api_desk_complaint_action( $in ) {
	$c = wt_rec_get( 'complaint', sanitize_text_field( $in['ref'] ?? '' ) );
	if ( ! $c ) {
		return wt_err( 'Complaint not found.', 'wt_404', 404 );
	}
	$scope = wt_desk_city();
	if ( 'all' !== $scope && $c['city'] && $c['city'] !== $scope ) {
		return wt_err( 'Complaint not found.', 'wt_404', 404 );
	}
	$who = wt_desk_name();
	$act = $in['action'] ?? '';
	if ( 'note' === $act ) {
		$n = trim( mb_substr( sanitize_textarea_field( (string) ( $in['note'] ?? '' ) ), 0, 500 ) );
		if ( '' === $n ) {
			return wt_err( 'Write a note.' );
		}
		$c['notes']   = (array) ( $c['notes'] ?? array() );
		$c['notes'][] = array( 'by' => $who, 'at' => wt_now_label(), 'text' => $n );
	} elseif ( 'resolve' === $act ) {
		$res = trim( mb_substr( sanitize_textarea_field( (string) ( $in['resolution'] ?? '' ) ), 0, 500 ) );
		if ( mb_strlen( $res ) < 5 ) {
			return wt_err( 'Write how the complaint was resolved. The customer sees this on WhatsApp.' );
		}
		$c['status']     = 'Resolved';
		$c['resolution'] = $res;
		$c['resolvedBy'] = $who;
		$c['resolvedAt'] = wt_now_label();
		if ( $c['booking'] ) {
			$b = wt_rec_get( 'booking', $c['booking'] );
			if ( $b ) {
				$b['complaintClosed'] = true;
				wt_rec_save( 'booking', $b );
				if ( ! empty( $b['redoRef'] ) ) {
					$c['redoRef'] = $b['redoRef'];
				}
			}
		}
		$first = wt_first( $c['name'] ) ? wt_first( $c['name'] ) : 'there';
		wt_whatsapp(
			$c['phone'],
			'complaint_resolved',
			array( $first, $c['id'], $res ),
			sprintf( 'Hi %s, your complaint %s has been resolved: %s. Thank you for your patience. – Team Wag & Tails', $first, $c['id'], $res )
		);
	} elseif ( 'reopen' === $act ) {
		$c['status'] = 'Open';
		if ( $c['booking'] ) {
			$b = wt_rec_get( 'booking', $c['booking'] );
			if ( $b ) {
				$b['complaintClosed'] = false;
				wt_rec_save( 'booking', $b );
			}
		}
	} else {
		return wt_err( 'Unknown action.' );
	}
	wt_rec_save( 'complaint', $c );
	return array( 'complaint' => $c );
}

add_action(
	'rest_api_init',
	function () {
		$routes = array(
			array( 'GET', 'me/complaints', 'is_user_logged_in', wt_rest( 'wt_api_my_complaints' ) ),
			array( 'POST', 'complaints', 'is_user_logged_in', wt_rest( 'wt_api_complaint_create' ) ),
			array( 'POST', 'complaints/upload', 'is_user_logged_in', 'wt_api_complaint_upload' ),
			array( 'GET', 'desk/complaints', 'wt_can_desk', wt_rest( 'wt_api_desk_complaints' ) ),
			array( 'POST', 'desk/complaints/(?P<ref>[A-Za-z0-9\-]+)', 'wt_can_desk', wt_rest( 'wt_api_desk_complaint_action' ) ),
		);
		foreach ( $routes as $rt ) {
			register_rest_route(
				'wt/v1',
				'/' . $rt[1],
				array(
					'methods'             => $rt[0],
					'permission_callback' => $rt[2],
					'callback'            => $rt[3],
				)
			);
		}
	}
);

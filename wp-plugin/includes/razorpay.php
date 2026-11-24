<?php
/**
 * Razorpay: the server creates the order and verifies the payment signature,
 * so a booking is only marked paid when Razorpay confirms it.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function wt_rzp_keys() {
	$s = wt_config()['settings'];
	return array( trim( (string) $s['razorpayKey'] ), trim( (string) $s['razorpaySecret'] ) );
}

function wt_rzp_ready() {
	list( $k, $sec ) = wt_rzp_keys();
	return '' !== $k && '' !== $sec;
}

/** @return array|WP_Error Razorpay order. */
function wt_rzp_create_order( $amount_rupees, $receipt, $notes = array() ) {
	list( $key, $secret ) = wt_rzp_keys();
	$res                  = wp_remote_post(
		'https://api.razorpay.com/v1/orders',
		array(
			'timeout' => 15,
			'headers' => array(
				'Authorization' => 'Basic ' . base64_encode( $key . ':' . $secret ), // phpcs:ignore
				'Content-Type'  => 'application/json',
			),
			'body'    => wp_json_encode(
				array(
					'amount'   => (int) round( $amount_rupees * 100 ),
					'currency' => 'INR',
					'receipt'  => substr( $receipt, 0, 40 ),
					'notes'    => $notes,
				)
			),
		)
	);
	if ( is_wp_error( $res ) ) {
		return new WP_Error( 'wt_rzp', 'Could not reach Razorpay. Please try again or choose Pay after service.' );
	}
	$body = json_decode( wp_remote_retrieve_body( $res ), true );
	if ( wp_remote_retrieve_response_code( $res ) >= 300 || empty( $body['id'] ) ) {
		$msg = isset( $body['error']['description'] ) ? $body['error']['description'] : 'Razorpay did not accept the request.';
		return new WP_Error( 'wt_rzp', 'Online payment is unavailable right now (' . $msg . '). Please choose Pay after service.' );
	}
	return $body;
}

function wt_rzp_verify( $order_id, $payment_id, $signature ) {
	list( , $secret ) = wt_rzp_keys();
	if ( ! $secret || ! $order_id || ! $payment_id || ! $signature ) {
		return false;
	}
	$expected = hash_hmac( 'sha256', $order_id . '|' . $payment_id, $secret );
	return hash_equals( $expected, (string) $signature );
}

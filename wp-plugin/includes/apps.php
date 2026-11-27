<?php
/**
 * Apps and partners: what the booking desk and the admin panel need from the apps' backend.
 *
 *  - Desk "Assign / change groomer": lists partners who can take a booking and assigns or removes one.
 *  - Live map: today's jobs and where the partners are.
 *  - Settings the apps follow (offer timeout, escalation, app cancel cut-off, live tracking), stored with the other
 *    settings and sent to the backend with connector/config.
 *
 * The browser only talks to this site (desk or admin login); this site calls the backend server-to-server, signed
 * with WT_CONNECTOR_SECRET, so the secret never reaches a browser.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Settings for the apps, with defaults and limits. */
function wt_apps_settings( $s = null ) {
	$s = $s ? $s : wt_config()['settings'];
	$n = function ( $k, $d, $min, $max ) use ( $s ) {
		$v = isset( $s[ $k ] ) && '' !== $s[ $k ] ? (float) $s[ $k ] : $d;
		return max( $min, min( $max, $v ) );
	};
	return array(
		'panelUrl'        => esc_url_raw( (string) ( $s['appsPanelUrl'] ?? '' ) ),
		'offerMins'       => (int) $n( 'appsOfferMins', 10, 2, 120 ),         // a customer's chosen groomer has this long to answer
		'escalateHours'   => (float) $n( 'appsEscalateHours', 2, 0.25, 24 ),  // no groomer by then → desk alert
		'sameDayMins'     => (int) $n( 'appsSameDayMins', 15, 5, 240 ),       // same-day jobs escalate sooner
		'dayBeforeHour'   => (int) $n( 'appsDayBeforeHour', 18, 8, 23 ),      // next-day jobs escalate by this hour the day before
		'cancelHours'     => (float) $n( 'appsCancelHours', 3, 0, 72 ),       // app customers cancel / move up to this many hours before
		'noShowMins'      => (int) $n( 'appsNoShowMins', 15, 5, 60 ),         // wait at the door before "customer not available"
		'reconfirmHours'  => (float) $n( 'appsReconfirmHours', 2, 0.25, 24 ), // after a reschedule the groomer must confirm within
		'liveTracking'    => ! isset( $s['appsLiveTracking'] ) || '' === $s['appsLiveTracking'] ? true : ! empty( $s['appsLiveTracking'] ) && 'false' !== $s['appsLiveTracking'],
	);
}

/** The backend's API base, e.g. https://api.example.com/api/v1 (from WT_APPS_API, or derived from WT_CONNECTOR_URL). */
function wt_apps_base() {
	if ( defined( 'WT_APPS_API' ) && WT_APPS_API ) {
		return rtrim( WT_APPS_API, '/' );
	}
	if ( defined( 'WT_CONNECTOR_URL' ) && WT_CONNECTOR_URL ) {
		return preg_replace( '#/connector/events/?$#', '', rtrim( WT_CONNECTOR_URL, '/' ) );
	}
	return '';
}

function wt_apps_on() {
	return '' !== wt_apps_base() && '' !== wt_conn_secret();
}

/** Signed call to the backend. $path like "connector/desk/partners", $query array, $body array|null. */
function wt_apps_call( $method, $path, $query = array(), $body = null ) {
	if ( ! wt_apps_on() ) {
		return wt_err( 'The apps are not connected yet (WT_CONNECTOR_URL / WT_CONNECTOR_SECRET in wp-config.php).', 'wt_apps_off', 503 );
	}
	$base  = wt_apps_base();
	$route = (string) wp_parse_url( $base, PHP_URL_PATH ) . '/' . ltrim( $path, '/' );
	if ( $query ) {
		ksort( $query );
		$route .= '?' . http_build_query( $query );
	}
	$raw   = null === $body ? '' : wp_json_encode( $body );
	$ts    = (string) time();
	$nonce = wp_generate_password( 24, false, false );
	$res   = wp_remote_request(
		preg_replace( '#^(https?://[^/]+).*$#', '$1', $base ) . $route,
		array(
			'method'  => $method,
			'timeout' => 15,
			'headers' => array_merge(
				array(
					'X-WT-Timestamp' => $ts,
					'X-WT-Nonce'     => $nonce,
					'X-WT-Signature' => wt_conn_sign( $ts, $nonce, $method, $route, $raw ),
				),
				'' === $raw ? array() : array( 'Content-Type' => 'application/json' )
			),
			'body'    => '' === $raw ? null : $raw,
		)
	);
	if ( is_wp_error( $res ) ) {
		return wt_err( 'The apps server could not be reached. Try again in a minute.', 'wt_apps_down', 502 );
	}
	$code = (int) wp_remote_retrieve_response_code( $res );
	$json = json_decode( (string) wp_remote_retrieve_body( $res ), true );
	if ( $code < 200 || $code >= 300 ) {
		$msg = is_array( $json ) && ! empty( $json['message'] ) ? ( is_array( $json['message'] ) ? implode( ' ', $json['message'] ) : $json['message'] ) : 'The apps server refused the request.';
		return wt_err( $msg, 'wt_apps_' . $code, $code >= 500 ? 502 : $code );
	}
	return is_array( $json ) ? $json : array();
}

/** The booking, if this desk user may act on it. */
function wt_apps_desk_booking( $ref ) {
	$b = wt_rec_get( 'booking', sanitize_text_field( (string) $ref ) );
	if ( ! $b || ! wt_desk_can_see( $b ) ) {
		return wt_err( 'Booking not found.', 'wt_404', 404 );
	}
	return $b;
}

function wt_api_apps_partners( $in ) {
	$b = wt_apps_desk_booking( $in['ref'] ?? '' );
	if ( is_wp_error( $b ) ) {
		return $b;
	}
	return wt_apps_call( 'GET', 'connector/desk/partners', array( 'ref' => $b['id'] ) );
}

function wt_api_apps_assign( $in ) {
	$b = wt_apps_desk_booking( $in['ref'] ?? '' );
	if ( is_wp_error( $b ) ) {
		return $b;
	}
	$partner = sanitize_text_field( (string) ( $in['partnerId'] ?? '' ) );
	if ( ! preg_match( '/^[0-9a-f\-]{36}$/i', $partner ) ) {
		return wt_err( 'Choose a groomer.' );
	}
	return wt_apps_call( 'POST', 'connector/desk/assign', array(), array( 'ref' => $b['id'], 'partnerId' => $partner, 'by' => wt_desk_name() ) );
}

function wt_api_apps_unassign( $in ) {
	$b = wt_apps_desk_booking( $in['ref'] ?? '' );
	if ( is_wp_error( $b ) ) {
		return $b;
	}
	return wt_apps_call( 'POST', 'connector/desk/unassign', array(), array( 'ref' => $b['id'], 'by' => wt_desk_name() ) );
}

/** Live map: staff see their own city only. */
function wt_api_apps_live( $in ) {
	$scope = wt_desk_city();
	$city  = 'all' !== $scope ? $scope : sanitize_text_field( (string) ( $in['city'] ?? '' ) );
	return wt_apps_call( 'GET', 'connector/desk/live', $city && 'all' !== $city ? array( 'city' => $city ) : array() );
}

/** Whether the apps are connected, and the panel link, for the desk and admin screens. */
function wt_api_apps_status() {
	$s = wt_apps_settings();
	return array( 'on' => wt_apps_on(), 'panelUrl' => $s['panelUrl'] );
}

add_action(
	'rest_api_init',
	function () {
		$routes = array(
			array( 'GET', 'desk/apps/status', 'wt_can_desk', 'wt_api_apps_status' ),
			array( 'GET', 'desk/apps/partners', 'wt_can_desk', 'wt_api_apps_partners' ),
			array( 'POST', 'desk/apps/assign', 'wt_can_desk', 'wt_api_apps_assign' ),
			array( 'POST', 'desk/apps/unassign', 'wt_can_desk', 'wt_api_apps_unassign' ),
			array( 'GET', 'desk/apps/live', 'wt_can_desk', 'wt_api_apps_live' ),
		);
		foreach ( $routes as $rt ) {
			register_rest_route( 'wt/v1', '/' . $rt[1], array( 'methods' => $rt[0], 'permission_callback' => $rt[2], 'callback' => wt_rest( $rt[3] ) ) );
		}
	}
);

/**
 * Desk filters for the apps (flows 5.3): bookings without a groomer, groomers running late, jobs in progress now.
 * Applied to the open bookings list.
 */
function wt_apps_desk_filter( $list, $filter ) {
	$job = function ( $b ) {
		return is_array( $b['job'] ?? null ) ? $b['job'] : array();
	};
	return array_values(
		array_filter(
			$list,
			function ( $b ) use ( $filter, $job ) {
				$j = $job( $b );
				$s = $j['status'] ?? '';
				$f = (string) ( $j['flag'] ?? '' );
				if ( 'nogroomer' === $filter ) {
					return in_array( $s, array( '', 'searching', 'offered', 'needs_staff', 'released' ), true );
				}
				if ( 'late' === $filter ) {
					return false !== stripos( $f, 'late' );
				}
				if ( 'inprogress' === $filter ) {
					return in_array( $s, array( 'on_the_way', 'arrived', 'in_progress' ), true );
				}
				if ( 'attention' === $filter ) {
					return '' !== $f;
				}
				return true;
			}
		)
	);
}

<?php
/**
 * Import customers and bookings from the BookingPress plugin.
 *
 * Works when the BookingPress tables are in this site's database: either BookingPress is
 * installed on this same WordPress site, or its tables were copied over with phpMyAdmin.
 * Column names are detected, not assumed, so different BookingPress versions work.
 * Imported records get IDs starting with "BP-" so the import can be repeated (no duplicates)
 * or undone.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action(
	'rest_api_init',
	function () {
		foreach ( array(
			'admin/bp/scan'   => 'wt_bp_scan',
			'admin/bp/import' => 'wt_bp_import',
			'admin/bp/undo'   => 'wt_bp_undo',
		) as $route => $fn ) {
			register_rest_route(
				'wt/v1',
				'/' . $route,
				array(
					'methods'             => 'POST',
					'permission_callback' => 'wt_can_admin',
					'callback'            => wt_rest( $fn ),
				)
			);
		}
	}
);

/** Targets an old form field can be mapped to. */
function wt_bp_targets() {
	return array(
		''           => 'Keep in notes',
		'address'    => 'Address',
		'pincode'    => 'Pincode',
		'city'       => 'City',
		'petType'    => 'Pet type (Dog/Cat)',
		'breed'      => 'Pet breed',
		'gender'     => 'Pet gender',
		'age'        => 'Pet age',
		'aggression' => 'Aggression level',
		'petName'    => 'Pet name',
		'mapLink'    => 'Location / map link',
		'phone'      => 'Phone (if missing)',
		'email'      => 'Email (if missing)',
		'skip'       => 'Ignore',
	);
}

function wt_bp_prefix( $in = array() ) {
	global $wpdb;
	$p = isset( $in['prefix'] ) && '' !== $in['prefix'] ? $in['prefix'] : $wpdb->prefix;
	return preg_replace( '/[^A-Za-z0-9_]/', '', (string) $p );
}

function wt_bp_table( $name, $prefix ) {
	global $wpdb;
	$t = $prefix . 'bookingpress_' . $name;
	return $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->esc_like( $t ) ) ) === $t ? $t : null; // phpcs:ignore
}

function wt_bp_cols( $table ) {
	global $wpdb;
	static $cache = array();
	if ( ! isset( $cache[ $table ] ) ) {
		$cache[ $table ] = $table ? (array) $wpdb->get_col( "SHOW COLUMNS FROM `$table`" ) : array(); // phpcs:ignore
	}
	return $cache[ $table ];
}

/** First column whose name contains all the given parts. */
function wt_bp_col( $table, $parts ) {
	foreach ( wt_bp_cols( $table ) as $c ) {
		$ok = true;
		foreach ( (array) $parts as $p ) {
			if ( false === strpos( $c, $p ) ) {
				$ok = false;
				break;
			}
		}
		if ( $ok ) {
			return $c;
		}
	}
	return null;
}

/** First non-empty value among the candidate column names. */
function wt_bp_v( $row, $keys ) {
	foreach ( (array) $keys as $k ) {
		if ( isset( $row[ $k ] ) && '' !== trim( (string) $row[ $k ] ) && '0000-00-00' !== $row[ $k ] ) {
			return trim( (string) $row[ $k ] );
		}
	}
	return '';
}

function wt_bp_tables( $prefix ) {
	return array(
		'appt'       => wt_bp_table( 'appointment_bookings', $prefix ),
		'appt_meta'  => wt_bp_table( 'appointment_meta', $prefix ),
		'customers'  => wt_bp_table( 'customers', $prefix ),
		'cust_meta'  => wt_bp_table( 'customers_meta', $prefix ),
		'entries'    => wt_bp_table( 'entries', $prefix ),
		'entry_meta' => wt_bp_table( 'entries_meta', $prefix ),
		'payments'   => wt_bp_table( 'payment_logs', $prefix ) ? wt_bp_table( 'payment_logs', $prefix ) : wt_bp_table( 'payment_transactions', $prefix ),
		'fields'     => wt_bp_table( 'form_fields', $prefix ),
	);
}

/** meta_key => label from the BookingPress form builder, when available. */
function wt_bp_field_labels( $t ) {
	global $wpdb;
	$labels = array();
	if ( ! $t['fields'] ) {
		return $labels;
	}
	$key_col   = wt_bp_col( $t['fields'], 'meta_key' );
	$label_col = wt_bp_col( $t['fields'], 'label' );
	$name_col  = wt_bp_col( $t['fields'], 'field_name' );
	if ( ! $label_col ) {
		return $labels;
	}
	$rows = $wpdb->get_results( "SELECT * FROM `{$t['fields']}`", ARRAY_A ); // phpcs:ignore
	foreach ( (array) $rows as $r ) {
		$label = wp_strip_all_tags( (string) $r[ $label_col ] );
		foreach ( array( $key_col, $name_col ) as $c ) {
			if ( $c && ! empty( $r[ $c ] ) ) {
				$labels[ $r[ $c ] ] = $label;
			}
		}
	}
	return $labels;
}

/** Flatten a meta value (often JSON with a "form_fields" object) into key => text. */
function wt_bp_flatten( $key, $value, &$out ) {
	$decoded = is_string( $value ) ? json_decode( $value, true ) : $value;
	if ( ! is_array( $decoded ) && is_string( $value ) && is_serialized( $value ) ) {
		$decoded = maybe_unserialize( $value );
	}
	if ( is_array( $decoded ) ) {
		$src = isset( $decoded['form_fields'] ) && is_array( $decoded['form_fields'] ) ? $decoded['form_fields'] : $decoded;
		foreach ( $src as $k => $v ) {
			if ( is_scalar( $v ) && '' !== trim( (string) $v ) && ! is_int( $k ) ) {
				$out[ (string) $k ] = trim( wp_strip_all_tags( (string) $v ) );
			} elseif ( is_array( $v ) && ! is_int( $k ) && $v && count( array_filter( $v, 'is_scalar' ) ) === count( $v ) ) {
				$out[ (string) $k ] = implode( ', ', array_map( 'strval', $v ) );
			}
		}
		return;
	}
	if ( is_scalar( $value ) && '' !== trim( (string) $value ) ) {
		$out[ (string) $key ] = trim( wp_strip_all_tags( (string) $value ) );
	}
}

/** Keys that BookingPress fills itself and that we read directly, so they are not offered for mapping. */
function wt_bp_core_key( $k ) {
	if ( preg_match( '/^(bookingpress_|appointment_|_bpa|send_whatsapp|term_and_conditions|terms?_|past_appointment|customer_avatar|is_|selected_|form_v3)/i', $k ) || preg_match( '/(_token|_expiry|_nonce)$/i', $k ) ) {
		return true;
	}
	return (bool) preg_match( '/^(bookingpress_)?(customer_(email|phone|firstname|lastname|name|fullname|full_name|username|country|phone_dial_code|timezone)|appointment_(date|time|timezone|note|internal_note)|service_|staff_|payment|total|coupon|form_fields|_wp|nonce|selected_|is_|card_|bookingpress_front)/i', $k );
}

/** All extra values for one appointment, from appointment meta, entry meta and customer meta. */
function wt_bp_extras( $t, $appt_id, $entry_id, $customer_id ) {
	global $wpdb;
	$out  = array();
	$sets = array(
		array( $t['appt_meta'], 'appointment_id', $appt_id ),
		array( $t['appt_meta'], 'entry_id', $entry_id ),
		array( $t['entry_meta'], 'entry_id', $entry_id ),
		array( $t['cust_meta'], 'customer_id', $customer_id ),
	);
	foreach ( $sets as $s ) {
		list( $table, $id_part, $id ) = $s;
		if ( ! $table || ! $id ) {
			continue;
		}
		$id_col  = wt_bp_col( $table, $id_part );
		$key_col = wt_bp_col( $table, 'meta_key' ) ? wt_bp_col( $table, 'meta_key' ) : wt_bp_col( $table, '_key' );
		$val_col = wt_bp_col( $table, 'meta_value' ) ? wt_bp_col( $table, 'meta_value' ) : wt_bp_col( $table, '_value' );
		if ( ! $id_col || ! $key_col || ! $val_col ) {
			continue;
		}
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT `$key_col` AS k, `$val_col` AS v FROM `$table` WHERE `$id_col` = %s", $id ), ARRAY_A ); // phpcs:ignore
		foreach ( (array) $rows as $r ) {
			if ( in_array( $r['k'], array( '_bpa_last_appointment_data', 'past_appointment_edit_data', 'customer_avatar_details' ), true ) ) {
				continue;
			}
			wt_bp_flatten( $r['k'], $r['v'], $out );
		}
	}
	foreach ( array_keys( $out ) as $k ) {
		if ( wt_bp_core_key( $k ) ) {
			unset( $out[ $k ] );
		}
	}
	// Ticked options are stored as checkbox_X_0 = true; turn them back into their labels.
	$opts   = wt_bp_field_options( $t );
	$picked = array();
	foreach ( $out as $k => $v ) {
		if ( preg_match( '/^(.+)_(\d+)$/', $k, $m ) && isset( $opts[ $m[1] ] ) ) {
			if ( in_array( strtolower( $v ), array( 'true', '1', 'yes', 'on' ), true ) && isset( $opts[ $m[1] ][ (int) $m[2] ] ) ) {
				$picked[ $m[1] ][] = $opts[ $m[1] ][ (int) $m[2] ];
			}
			unset( $out[ $k ] );
		}
	}
	foreach ( $picked as $base => $labels ) {
		$out[ $base ] = implode( ', ', array_unique( $labels ) );
	}
	foreach ( $out as $k => $v ) {
		if ( in_array( strtolower( $v ), array( 'true', 'false' ), true ) ) {
			unset( $out[ $k ] );
		}
	}
	return $out;
}

/** meta_key => list of option labels, for checkbox / radio / dropdown fields. */
function wt_bp_field_options( $t ) {
	global $wpdb;
	static $cache = null;
	if ( null !== $cache ) {
		return $cache;
	}
	$cache = array();
	if ( ! $t['fields'] ) {
		return $cache;
	}
	$key_col = wt_bp_col( $t['fields'], 'meta_key' );
	$val_col = wt_bp_col( $t['fields'], 'field_values' );
	if ( ! $key_col || ! $val_col ) {
		return $cache;
	}
	foreach ( (array) $wpdb->get_results( "SELECT `$key_col` AS k, `$val_col` AS v FROM `{$t['fields']}`", ARRAY_A ) as $r ) { // phpcs:ignore
		$raw = (string) $r['v'];
		if ( '' === trim( $raw ) || ! $r['k'] ) {
			continue;
		}
		$d = json_decode( $raw, true );
		if ( ! is_array( $d ) && is_serialized( $raw ) ) {
			$d = maybe_unserialize( $raw );
		}
		$labels = array();
		if ( is_array( $d ) ) {
			foreach ( $d as $o ) {
				if ( is_array( $o ) ) {
					$labels[] = (string) ( $o['label'] ?? $o['value'] ?? $o['text'] ?? reset( $o ) );
				} elseif ( is_scalar( $o ) ) {
					$labels[] = (string) $o;
				}
			}
		} else {
			$labels = array_map( 'trim', preg_split( '/[\r\n,]+/', $raw ) );
		}
		$cache[ $r['k'] ] = array_values( array_filter( array_map( 'wp_strip_all_tags', $labels ), 'strlen' ) );
	}
	return $cache;
}

/** Work out the city from an Indian pincode. */
function wt_bp_city_from_pin( $pin, $cities ) {
	$pin = preg_replace( '/\D/', '', (string) $pin );
	if ( strlen( $pin ) !== 6 ) {
		return '';
	}
	$ids = array_column( $cities, 'id' );
	$p3  = substr( $pin, 0, 3 );
	$n   = (int) $pin;
	$try = array();
	if ( '226' === $p3 || '227' === $p3 ) {
		$try[] = 'lucknow';
	} elseif ( '208' === $p3 || '209' === $p3 ) {
		$try[] = 'kanpur';
	} elseif ( '452' === $p3 || '453' === $p3 ) {
		$try[] = 'indore';
	} elseif ( '302' === $p3 || '303' === $p3 ) {
		$try[] = 'jaipur';
	} elseif ( '500' === $p3 || '501' === $p3 || '502' === $p3 ) {
		$try[] = 'hyderabad';
	} elseif ( '411' === $p3 || '412' === $p3 ) {
		if ( in_array( $n, array( 411017, 411018, 411019, 411026, 411027, 411033, 411034, 411035, 411039, 411044, 411057, 411061, 411062, 412101, 412105, 412114 ), true ) ) {
			$try[] = 'pcmc';
		}
		$try[] = 'pune';
	} elseif ( $n >= 400701 && $n <= 400710 || in_array( $n, array( 410206, 410208, 410209, 410210, 410218 ), true ) ) {
		$try[] = 'navi-mumbai';
	} elseif ( $n >= 400001 && $n <= 400050 ) {
		$try[] = 'south-mumbai';
	} elseif ( $n >= 400051 && $n <= 401107 ) {
		$try[] = 'north-mumbai';
	}
	foreach ( $try as $id ) {
		if ( in_array( $id, $ids, true ) ) {
			return $id;
		}
	}
	return '';
}

function wt_bp_guess_target( $key, $label ) {
	$s = strtolower( $key . ' ' . $label );
	$rules = array(
		'pincode'    => array( 'pin', 'zip', 'postal' ),
		'breed'      => array( 'breed' ),
		'aggression' => array( 'aggress', 'temperament', 'behaviou', 'behavio', 'bite' ),
		'petType'    => array( 'pet type', 'pet_type', 'pettype', 'type of pet', 'dog or cat', 'animal' ),
		'gender'     => array( 'gender', 'sex' ),
		'age'        => array( 'age' ),
		'petName'    => array( 'pet name', 'pet_name', 'petname', "pet's name", 'dog name', 'cat name' ),
		'mapLink'    => array( 'map', 'location', 'latitude', 'pinpoint' ),
		'city'       => array( 'city', 'area' ),
		'address'    => array( 'address', 'street', 'house', 'flat', 'landmark' ),
	);
	foreach ( $rules as $target => $words ) {
		foreach ( $words as $w ) {
			if ( false !== strpos( $s, $w ) ) {
				return $target;
			}
		}
	}
	return '';
}

function wt_bp_appt_cols( $t ) {
	$a = $t['appt'];
	return array(
		'id'       => wt_bp_col( $a, 'appointment_booking_id' ) ? wt_bp_col( $a, 'appointment_booking_id' ) : wt_bp_cols( $a )[0],
		'entry'    => wt_bp_col( $a, 'entry_id' ),
		'customer' => wt_bp_col( $a, 'customer_id' ),
		'payment'  => wt_bp_col( $a, 'payment_id' ),
	);
}

/* ---------- scan ---------- */

function wt_bp_scan( $in ) {
	global $wpdb;
	$prefix = wt_bp_prefix( $in );
	$t      = wt_bp_tables( $prefix );
	if ( ! $t['appt'] && ! $t['customers'] ) {
		return wt_err( 'No BookingPress data was found in this database (looked for tables starting with "' . $prefix . 'bookingpress_"). If your old site is a different WordPress install, copy its BookingPress tables here first, or check the table prefix.' );
	}
	update_option( 'wt_bp_prefix', $prefix, false );
	$out = array(
		'prefix'    => $prefix,
		'tables'    => array_keys( array_filter( $t ) ),
		'customers' => $t['customers'] ? (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$t['customers']}`" ) : 0, // phpcs:ignore
		'bookings'  => $t['appt'] ? (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$t['appt']}`" ) : 0, // phpcs:ignore
		'imported'  => (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . wt_table() . " WHERE type = 'booking' AND ref LIKE 'BP-%'" ), // phpcs:ignore
		'services'  => array(),
		'statuses'  => array(),
		'fields'    => array(),
		'dates'     => array( '', '' ),
		'targets'   => wt_bp_targets(),
		'saved'     => get_option( 'wt_bp_mapping', null ),
	);
	if ( ! $t['appt'] ) {
		return $out;
	}
	$a        = $t['appt'];
	$svc_col  = wt_bp_col( $a, 'service_name' );
	$st_col   = wt_bp_col( $a, 'appointment_status' ) ? wt_bp_col( $a, 'appointment_status' ) : wt_bp_col( $a, 'status' );
	$date_col = wt_bp_col( $a, 'appointment_date' );
	if ( $svc_col ) {
		$out['services'] = $wpdb->get_results( "SELECT `$svc_col` AS name, COUNT(*) AS n FROM `$a` GROUP BY `$svc_col` ORDER BY n DESC", ARRAY_A ); // phpcs:ignore
	}
	if ( $st_col ) {
		$out['statuses'] = $wpdb->get_results( "SELECT `$st_col` AS status, COUNT(*) AS n FROM `$a` GROUP BY `$st_col`", ARRAY_A ); // phpcs:ignore
		foreach ( $out['statuses'] as &$s ) {
			$s['label'] = wt_bp_status_label( $s['status'] );
		}
		unset( $s );
	}
	if ( $date_col ) {
		$out['dates'] = array( $wpdb->get_var( "SELECT MIN(`$date_col`) FROM `$a`" ), $wpdb->get_var( "SELECT MAX(`$date_col`) FROM `$a`" ) ); // phpcs:ignore
	}
	// Sample the extra fields from the latest 300 bookings.
	$c      = wt_bp_appt_cols( $t );
	$labels = wt_bp_field_labels( $t );
	$rows   = $wpdb->get_results( "SELECT * FROM `$a` ORDER BY `{$c['id']}` DESC LIMIT 300", ARRAY_A ); // phpcs:ignore
	$fields = array();
	foreach ( (array) $rows as $r ) {
		$ex = wt_bp_extras( $t, $r[ $c['id'] ], $c['entry'] ? $r[ $c['entry'] ] : '', $c['customer'] ? $r[ $c['customer'] ] : '' );
		foreach ( $ex as $k => $v ) {
			if ( ! isset( $fields[ $k ] ) ) {
				$label        = isset( $labels[ $k ] ) ? $labels[ $k ] : ucwords( trim( str_replace( array( 'bookingpress_', '_', '-' ), array( '', ' ', ' ' ), $k ) ) );
				$fields[ $k ] = array( 'key' => $k, 'label' => $label, 'count' => 0, 'samples' => array(), 'guess' => wt_bp_guess_target( $k, $label ) );
			}
			$fields[ $k ]['count']++;
			if ( count( $fields[ $k ]['samples'] ) < 3 && ! in_array( $v, $fields[ $k ]['samples'], true ) ) {
				$fields[ $k ]['samples'][] = mb_substr( $v, 0, 80 );
			}
		}
	}
	usort(
		$fields,
		function ( $x, $y ) {
			return $y['count'] <=> $x['count'];
		}
	);
	$out['fields'] = array_values( $fields );
	return $out;
}

/** BookingPress status codes: 1 approved, 2 pending, 3 cancelled, 4 rejected, 5 no-show, 6 completed. */
function wt_bp_status_label( $s ) {
	$map = array( '1' => 'Approved', '2' => 'Pending', '3' => 'Cancelled', '4' => 'Rejected', '5' => 'No-show', '6' => 'Completed' );
	$s   = trim( (string) $s );
	return isset( $map[ $s ] ) ? $map[ $s ] : ucfirst( strtolower( $s ) );
}

/* ---------- import ---------- */

function wt_bp_time_slot( $time ) {
	$ts = strtotime( '2000-01-01 ' . trim( (string) $time ) );
	return $ts ? gmdate( 'h:i A', $ts ) : '10:00 AM';
}

function wt_bp_match_city( $text, $cities ) {
	$text = strtolower( (string) $text );
	if ( '' === $text ) {
		return '';
	}
	// Longest names first so "Navi Mumbai" wins over "Mumbai".
	usort(
		$cities,
		function ( $a, $b ) {
			return strlen( $b['name'] ) <=> strlen( $a['name'] );
		}
	);
	foreach ( $cities as $c ) {
		$names = array( strtolower( $c['name'] ), strtolower( str_replace( '-', ' ', $c['id'] ) ) );
		if ( 'pcmc' === $c['id'] ) {
			$names[] = 'pimpri';
			$names[] = 'chinchwad';
			$names[] = 'pcmc';
		}
		foreach ( $names as $n ) {
			if ( $n && false !== strpos( $text, $n ) ) {
				return $c['id'];
			}
		}
	}
	return '';
}

function wt_bp_normalize_pet( $v ) {
	$v = strtolower( $v );
	if ( false !== strpos( $v, 'cat' ) || false !== strpos( $v, 'kitten' ) ) {
		return 'Cat';
	}
	return 'Dog';
}

function wt_bp_normalize_gender( $v ) {
	$v = strtolower( trim( $v ) );
	if ( '' === $v ) {
		return '';
	}
	return ( 0 === strpos( $v, 'f' ) || false !== strpos( $v, 'female' ) ) ? 'Female' : 'Male';
}

function wt_bp_import( $in ) {
	global $wpdb;
	$prefix = wt_bp_prefix( $in );
	$t      = wt_bp_tables( $prefix );
	$stage  = ( $in['stage'] ?? 'customers' ) === 'bookings' ? 'bookings' : 'customers';
	$offset = max( 0, (int) ( $in['offset'] ?? 0 ) );
	$batch  = 100;
	$map    = array(
		'fields'        => array_map(
			function ( $v ) {
				return array_key_exists( (string) $v, wt_bp_targets() ) ? (string) $v : '';
			},
			(array) ( $in['fields'] ?? array() )
		),
		'services'      => array_map( 'sanitize_text_field', (array) ( $in['services'] ?? array() ) ),
		'defaultCity'   => sanitize_text_field( $in['defaultCity'] ?? '' ),
		'pastCompleted' => ! empty( $in['pastCompleted'] ),
		'givePoints'    => ! empty( $in['givePoints'] ),
	);
	if ( 0 === $offset && 'customers' === $stage ) {
		update_option( 'wt_bp_mapping', $map, false );
	}
	$done = array( 'imported' => 0, 'skipped' => 0, 'linked' => 0, 'notes' => array() );

	if ( 'customers' === $stage ) {
		if ( ! $t['customers'] ) {
			return array( 'stage' => 'bookings', 'offset' => 0, 'total' => 0, 'result' => $done );
		}
		$tc    = $t['customers'];
		$idc   = wt_bp_col( $tc, 'customer_id' ) ? wt_bp_col( $tc, 'customer_id' ) : wt_bp_cols( $tc )[0];
		$total = (int) $wpdb->get_var( "SELECT COUNT(*) FROM `$tc`" ); // phpcs:ignore
		$rows  = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM `$tc` ORDER BY `$idc` ASC LIMIT %d OFFSET %d", $batch, $offset ), ARRAY_A ); // phpcs:ignore
		foreach ( (array) $rows as $r ) {
			wt_bp_import_customer( $r, $idc, $done );
		}
		$next = $offset + $batch;
		return $next < $total
			? array( 'stage' => 'customers', 'offset' => $next, 'total' => $total, 'result' => $done )
			: array( 'stage' => 'bookings', 'offset' => 0, 'total' => $total, 'result' => $done );
	}

	if ( ! $t['appt'] ) {
		return array( 'stage' => 'done', 'offset' => 0, 'total' => 0, 'result' => $done );
	}
	$a     = $t['appt'];
	$c     = wt_bp_appt_cols( $t );
	$total = (int) $wpdb->get_var( "SELECT COUNT(*) FROM `$a`" ); // phpcs:ignore
	$rows  = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM `$a` ORDER BY `{$c['id']}` ASC LIMIT %d OFFSET %d", $batch, $offset ), ARRAY_A ); // phpcs:ignore
	$cfg   = wt_config();
	foreach ( (array) $rows as $r ) {
		try {
			wt_bp_import_booking( $r, $t, $c, $map, $cfg, $done );
		} catch ( Throwable $e ) {
			$done['skipped']++;
			$done['notes'][] = 'Booking ' . $r[ $c['id'] ] . ': ' . $e->getMessage();
		}
	}
	$next = $offset + $batch;
	wt_flush_products();
	return $next < $total
		? array( 'stage' => 'bookings', 'offset' => $next, 'total' => $total, 'result' => $done )
		: array( 'stage' => 'done', 'offset' => $total, 'total' => $total, 'result' => $done );
}

function wt_bp_import_customer( $r, $idc, &$done ) {
	$id    = $r[ $idc ];
	$phone = wt_phone( wt_bp_v( $r, array( 'bookingpress_user_phone', 'bookingpress_customer_phone', 'bookingpress_phone' ) ) );
	$email = sanitize_email( wt_bp_v( $r, array( 'bookingpress_user_email', 'bookingpress_customer_email', 'bookingpress_email' ) ) );
	$name  = wt_bp_v( $r, array( 'bookingpress_customer_full_name', 'bookingpress_user_name', 'bookingpress_customer_name' ) );
	if ( ! $name ) {
		$name = trim( wt_bp_v( $r, array( 'bookingpress_user_firstname', 'bookingpress_customer_firstname' ) ) . ' ' . wt_bp_v( $r, array( 'bookingpress_user_lastname', 'bookingpress_customer_lastname' ) ) );
	}
	if ( ! wt_valid_mobile( $phone ) ) {
		$done['skipped']++;
		return;
	}
	// Existing WordPress login on this site? Link it so the customer signs in with the same password.
	$wpuid = (int) wt_bp_v( $r, array( 'bookingpress_wpuser_id', 'bookingpress_user_id' ) );
	$user  = $wpuid ? get_userdata( $wpuid ) : ( $email ? get_user_by( 'email', $email ) : false );
	if ( $user && ! user_can( $user, 'manage_options' ) && ! user_can( $user, 'wt_desk' ) && ! get_user_meta( $user->ID, 'wt_phone', true ) && ! wt_user_by_phone( $phone ) ) {
		update_user_meta( $user->ID, 'wt_phone', $phone );
		update_user_meta( $user->ID, 'wt_phone_imported', 1 );
		if ( ! get_user_meta( $user->ID, 'billing_phone', true ) ) {
			update_user_meta( $user->ID, 'billing_phone', $phone );
		}
		$done['linked']++;
	}
	if ( wt_rec_get( 'customer', 'BPC-' . $id ) ) {
		$done['skipped']++;
		return;
	}
	wt_rec_insert(
		'customer',
		array(
			'id'      => 'BPC-' . $id,
			'phone'   => $phone,
			'name'    => sanitize_text_field( $name ),
			'email'   => $email,
			'created' => wt_bp_v( $r, array( 'bookingpress_user_created', 'bookingpress_created_at', 'bookingpress_customer_created' ) ),
			'source'  => 'BookingPress import',
		),
		'BPC'
	);
	$done['imported']++;
}

function wt_bp_import_booking( $r, $t, $c, $map, $cfg, &$done ) {
	global $wpdb;
	$bp_id = $r[ $c['id'] ];
	$ref   = 'BP-' . $bp_id;
	if ( wt_rec_get( 'booking', $ref ) ) {
		$done['skipped']++;
		return;
	}
	$cust_id = $c['customer'] ? $r[ $c['customer'] ] : '';
	$entry   = $c['entry'] ? $r[ $c['entry'] ] : '';
	$extras  = wt_bp_extras( $t, $bp_id, $entry, $cust_id );

	// Customer details: from the booking row, falling back to the customers table.
	$cust = array();
	if ( $cust_id && $t['customers'] ) {
		$idc  = wt_bp_col( $t['customers'], 'customer_id' );
		$cust = $idc ? (array) $wpdb->get_row( $wpdb->prepare( "SELECT * FROM `{$t['customers']}` WHERE `$idc` = %s", $cust_id ), ARRAY_A ) : array(); // phpcs:ignore
	}
	$name = wt_bp_v( $r, array( 'bookingpress_customer_name', 'bookingpress_customer_full_name' ) );
	if ( ! $name ) {
		$name = trim( wt_bp_v( $r, 'bookingpress_customer_firstname' ) . ' ' . wt_bp_v( $r, 'bookingpress_customer_lastname' ) );
	}
	if ( ! $name ) {
		$name = wt_bp_v( $cust, array( 'bookingpress_customer_full_name', 'bookingpress_user_name' ) );
	}
	if ( ! $name ) {
		$name = trim( wt_bp_v( $cust, 'bookingpress_user_firstname' ) . ' ' . wt_bp_v( $cust, 'bookingpress_user_lastname' ) );
	}
	$phone = wt_phone( wt_bp_v( $r, 'bookingpress_customer_phone' ) );
	if ( ! $phone ) {
		$phone = wt_phone( wt_bp_v( $cust, 'bookingpress_user_phone' ) );
	}
	$email = sanitize_email( wt_bp_v( $r, 'bookingpress_customer_email' ) );
	if ( ! $email ) {
		$email = sanitize_email( wt_bp_v( $cust, 'bookingpress_user_email' ) );
	}

	// Mapped form fields.
	$f     = array();
	$notes = array();
	foreach ( $extras as $k => $v ) {
		$target = isset( $map['fields'][ $k ] ) ? $map['fields'][ $k ] : wt_bp_guess_target( $k, '' );
		if ( 'skip' === $target ) {
			continue;
		}
		if ( $target && preg_match( '/^(0|1|true|false|yes|no)$/i', trim( $v ) ) && in_array( $target, array( 'gender', 'petType', 'breed', 'age', 'address', 'pincode', 'city' ), true ) ) {
			continue;
		}
		if ( $target && ! isset( $f[ $target ] ) ) {
			$f[ $target ] = $v;
		} else {
			$notes[] = str_replace( array( 'bookingpress_', '_' ), array( '', ' ' ), $k ) . ': ' . $v;
		}
	}
	if ( ! $phone && ! empty( $f['phone'] ) ) {
		$phone = wt_phone( $f['phone'] );
	}
	if ( ! $email && ! empty( $f['email'] ) ) {
		$email = sanitize_email( $f['email'] );
	}

	// Service → package and city.
	$service = wt_bp_v( $r, 'bookingpress_service_name' );
	$pkg_id  = isset( $map['services'][ $service ] ) ? $map['services'][ $service ] : '';
	$pkg     = $pkg_id ? wt_find( $cfg['packages'], 'id', $pkg_id ) : null;
	$city    = '';
	foreach ( array( $f['city'] ?? '', $service, $f['address'] ?? '' ) as $txt ) {
		$city = wt_bp_match_city( $txt, $cfg['cities'] );
		if ( $city ) {
			break;
		}
	}
	if ( ! $city && ! empty( $f['pincode'] ) ) {
		$city = wt_bp_city_from_pin( $f['pincode'], $cfg['cities'] );
	}
	if ( ! $city ) {
		$city = $map['defaultCity'] ? $map['defaultCity'] : ( $cfg['cities'][0]['id'] ?? '' );
	}

	// Date, time and status.
	$date = substr( wt_bp_v( $r, 'bookingpress_appointment_date' ), 0, 10 );
	if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date ) ) {
		$done['skipped']++;
		$done['notes'][] = 'Booking ' . $bp_id . ' has no valid date, skipped.';
		return;
	}
	$slot  = wt_bp_time_slot( wt_bp_v( $r, 'bookingpress_appointment_time' ) );
	$code  = wt_bp_v( $r, array( 'bookingpress_appointment_status', 'bookingpress_status' ) );
	$label = wt_bp_status_label( $code );
	$past  = $date < wt_today();
	$cancel_reason = '';
	switch ( strtolower( $label ) ) {
		case 'completed':
			$status = 'Completed';
			break;
		case 'cancelled':
		case 'canceled':
			$status        = 'Cancelled';
			$cancel_reason = 'Cancelled in BookingPress';
			break;
		case 'rejected':
			$status        = 'Cancelled';
			$cancel_reason = 'Rejected in BookingPress';
			break;
		case 'no-show':
			$status        = 'Cancelled';
			$cancel_reason = 'No-show';
			break;
		default: // Approved, pending, anything else.
			$status = ( $past && $map['pastCompleted'] ) ? 'Completed' : 'Confirmed';
	}

	// Money.
	$price    = (float) wt_bp_v( $r, array( 'bookingpress_service_price' ) );
	$total    = (float) wt_bp_v( $r, array( 'bookingpress_total_amount', 'bookingpress_paid_amount', 'bookingpress_service_price' ) );
	$discount = (float) wt_bp_v( $r, array( 'bookingpress_coupon_discount_amount' ) );
	$paid     = (float) wt_bp_v( $r, array( 'bookingpress_paid_amount' ) );
	$due      = wt_bp_v( $r, array( 'bookingpress_due_amount' ) );
	$gateway  = strtolower( wt_bp_v( $r, array( 'bookingpress_payment_gateway', 'bookingpress_payment_method' ) ) );
	if ( $t['payments'] ) {
		$pay_appt = wt_bp_col( $t['payments'], 'appointment_booking_ref' ) ? wt_bp_col( $t['payments'], 'appointment_booking_ref' ) : wt_bp_col( $t['payments'], 'appointment' );
		$pay_gw   = wt_bp_col( $t['payments'], 'payment_gateway' );
		$pay_amt  = wt_bp_col( $t['payments'], 'paid_amount' ) ? wt_bp_col( $t['payments'], 'paid_amount' ) : wt_bp_col( $t['payments'], 'amount' );
		$pay_st   = wt_bp_col( $t['payments'], 'payment_status' );
		$pay_id   = wt_bp_col( $t['payments'], 'payment_log_id' );
		$lookups  = array();
		if ( $pay_appt ) {
			$lookups[] = array( $pay_appt, $bp_id );
		}
		if ( $c['payment'] && ! empty( $r[ $c['payment'] ] ) && $pay_id ) {
			$lookups[] = array( $pay_id, $r[ $c['payment'] ] );
		}
		foreach ( $lookups as $lk ) {
			$p = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM `{$t['payments']}` WHERE `{$lk[0]}` = %s LIMIT 1", $lk[1] ), ARRAY_A ); // phpcs:ignore
			if ( $p ) {
				if ( $pay_gw && ! $gateway ) {
					$gateway = strtolower( (string) $p[ $pay_gw ] );
				}
				if ( $pay_amt && ! $paid && ( ! $pay_st || in_array( strtolower( (string) $p[ $pay_st ] ), array( '1', 'success', 'paid', 'completed', 'approved' ), true ) ) ) {
					$paid = (float) $p[ $pay_amt ];
				}
				if ( ! $total && $pay_amt ) {
					$total = (float) $p[ $pay_amt ];
				}
				break;
			}
		}
	}
	if ( ! $total ) {
		$total = $price;
	}
	$is_cash = (bool) preg_match( '/on[\s_-]?site|cash|offline|manual|pay ?later|pay_later|after/', $gateway );
	$pay_mode = '';
	if ( 'Completed' === $status ) {
		$pay_mode = $is_cash || ! $gateway ? 'Cash' : 'Online';
	} elseif ( $paid > 0 && ( '' === $due || (float) $due <= 0 ) && ! $is_cash ) {
		$pay_mode = 'Online';
	}
	if ( 'Completed' === $status && ! $is_cash && $gateway && $paid <= 0 && '' !== $due && (float) $due > 0 ) {
		$pay_mode = 'Cash'; // Online gateway but nothing paid online: collected at the door.
	}

	$age = trim( (string) ( $f['age'] ?? '' ) );
	if ( preg_match( '/^\d+(\.\d+)?$/', $age ) ) {
		$age .= ' years';
	}
	$internal = wt_bp_v( $r, array( 'bookingpress_appointment_internal_note', 'bookingpress_appointment_note' ) );
	if ( $internal ) {
		array_unshift( $notes, 'Note: ' . $internal );
	}
	if ( ! empty( $f['petName'] ) ) {
		array_unshift( $notes, 'Pet name: ' . $f['petName'] );
	}
	$rec = array(
		'id'           => $ref,
		'bpId'         => $bp_id,
		'created'      => wt_bp_v( $r, array( 'bookingpress_created_at', 'bookingpress_appointment_created' ) ),
		'city'         => $city,
		'pkg'          => $pkg ? $pkg['id'] : '',
		'pkgName'      => $pkg ? $pkg['name'] : ( $service ? $service : 'Grooming' ),
		'name'         => sanitize_text_field( $name ? $name : 'Customer' ),
		'email'        => $email,
		'phone'        => $phone,
		'acct'         => $phone,
		'address'      => sanitize_textarea_field( (string) ( $f['address'] ?? '' ) ),
		'pincode'      => preg_replace( '/\D/', '', (string) ( $f['pincode'] ?? '' ) ),
		'mapLink'      => isset( $f['mapLink'] ) && preg_match( '#^https?://#', $f['mapLink'] ) ? esc_url_raw( $f['mapLink'] ) : '',
		'petType'      => isset( $f['petType'] ) ? wt_bp_normalize_pet( $f['petType'] ) : ( ( $pkg && 'Cat' === $pkg['pet'] ) || false !== stripos( $service, 'cat' ) ? 'Cat' : 'Dog' ),
		'breed'        => sanitize_text_field( (string) ( $f['breed'] ?? '' ) ),
		'gender'       => wt_bp_normalize_gender( (string) ( $f['gender'] ?? '' ) ),
		'age'          => sanitize_text_field( $age ),
		'aggression'   => sanitize_text_field( (string) ( $f['aggression'] ?? '' ) ),
		'lat'          => null,
		'lng'          => null,
		'date'         => $date,
		'slot'         => $slot,
		'addons'       => array(),
		'subtotal'     => $price ? $price : $total + $discount,
		'coupon'       => '',
		'discount'     => $discount,
		'pointsUsed'   => 0,
		'total'        => $total,
		'pay'          => 'later',
		'payStatus'    => $pay_mode ? 'Paid' : 'Due',
		'payMode'      => $pay_mode,
		'status'       => $status,
		'cancelReason' => $cancel_reason,
		'source'       => 'BookingPress',
		'by'           => 'Imported',
		'notes'        => sanitize_textarea_field( implode( "\n", $notes ) ),
		'imported'     => true,
	);
	if ( ! $rec['cancelReason'] ) {
		unset( $rec['cancelReason'] );
	}
	if ( 'Completed' === $status && $map['givePoints'] && wt_valid_mobile( $phone ) ) {
		wt_booking_credit_points( $rec, false );
	}
	wt_rec_insert( 'booking', $rec, 'BP' );
	$done['imported']++;
}

function wt_bp_undo() {
	global $wpdb;
	$t   = wt_table();
	$n   = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $t WHERE type = 'booking' AND ref LIKE 'BP-%'" ); // phpcs:ignore
	$wpdb->query( "DELETE FROM $t WHERE (type IN ('booking','customer') AND (ref LIKE 'BP-%' OR ref LIKE 'BPC-%'))" ); // phpcs:ignore
	// Remove points that were given for imported bookings.
	$rows = $wpdb->get_results( "SELECT ref, data FROM $t WHERE type = 'points'", ARRAY_A ); // phpcs:ignore
	foreach ( (array) $rows as $row ) {
		$d = json_decode( $row['data'], true );
		if ( isset( $d['ref'] ) && 0 === strpos( (string) $d['ref'], 'BP-' ) ) {
			$wpdb->delete( $t, array( 'type' => 'points', 'ref' => $row['ref'] ) ); // phpcs:ignore
		}
	}
	foreach ( get_users( array( 'meta_key' => 'wt_phone_imported', 'number' => 5000 ) ) as $u ) { // phpcs:ignore
		delete_user_meta( $u->ID, 'wt_phone' );
		delete_user_meta( $u->ID, 'wt_phone_imported' );
	}
	return array( 'ok' => true, 'removed' => $n );
}

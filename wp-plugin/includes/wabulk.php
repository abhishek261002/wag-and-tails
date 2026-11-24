<?php
/**
 * Bulk WhatsApp with any approved template: lists the templates Meta has approved for the account,
 * finds their {{variables}} (header, body, buttons) and fills each one from a field the admin picks
 * (first name, pet name, breed, city, days since last groom …) or a fixed text.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Fields that can go into a template variable. */
function wt_bulk_fields() {
	return array(
		'first'      => 'Customer first name',
		'name'       => 'Customer full name',
		'pet'        => 'Pet name (or breed if no name)',
		'petName'    => 'Pet name',
		'breed'      => 'Breed',
		'petType'    => 'Pet type (Dog / Cat)',
		'city'       => 'City',
		'lastDate'   => 'Last groom date',
		'days'       => 'Days since last groom',
		'lastPkg'    => 'Last package',
		'grooms'     => 'Number of grooms',
		'spent'      => 'Total spent (₹)',
		'points'     => 'Reward points balance',
		'phone'      => 'Customer phone',
		'bookLink'   => 'Booking link',
		'shopLink'   => 'Shop link',
		'siteLink'   => 'Website link',
		'eventTitle' => 'Event name',
		'eventWhen'  => 'Event date & time',
		'eventVenue' => 'Event venue',
		'eventPrice' => 'Event pass price from',
		'eventLink'  => 'Event link',
		'custom'     => 'Fixed text (type it)',
	);
}

/** One row per customer phone with everything the fields need (built once per request). */
function wt_bulk_profiles() {
	static $map = null;
	if ( null !== $map ) {
		return $map;
	}
	$map   = array();
	$today = wt_today();
	foreach ( wt_all_bookings() as $b ) {
		$p = wt_phone( $b['phone'] ?? '' );
		if ( strlen( $p ) !== 10 ) {
			continue;
		}
		if ( ! isset( $map[ $p ] ) ) {
			$map[ $p ] = array( 'phone' => $p, 'name' => '', 'city' => '', 'last' => '', 'lastPkg' => '', 'petName' => '', 'breed' => '', 'petType' => '', 'grooms' => 0, 'spent' => 0, 'seen' => '', 'ahead' => false );
		}
		$m  = &$map[ $p ];
		$d  = (string) ( $b['date'] ?? '' );
		$st = $b['status'] ?? '';
		if ( wt_is_sale( $b ) ) {
			++$m['grooms'];
			$m['spent'] += (float) ( $b['total'] ?? 0 );
		}
		if ( in_array( $st, array( 'Confirmed', 'Rescheduled' ), true ) && $d >= $today ) {
			$m['ahead'] = true;
		}
		if ( ( 'Completed' === $st || ( in_array( $st, array( 'Confirmed', 'Rescheduled' ), true ) && $d < $today ) ) && $d > $m['last'] ) {
			$m['last']    = $d;
			$m['lastPkg'] = wt_booking_pkg_label( $b );
		}
		if ( $d >= $m['seen'] ) {
			$m['seen'] = $d;
			foreach ( array( 'name', 'city', 'petName', 'breed', 'petType' ) as $k ) {
				if ( ! empty( $b[ $k ] ) ) {
					$m[ $k ] = trim( (string) $b[ $k ] );
				}
			}
		}
		unset( $m );
	}
	foreach ( wt_customer_index() as $p => $c ) {
		if ( ! isset( $map[ $p ] ) ) {
			$pet       = $c['pets'] ? reset( $c['pets'] ) : array();
			$map[ $p ] = array( 'phone' => $p, 'name' => $c['name'], 'city' => $c['city'], 'last' => '', 'lastPkg' => '', 'petName' => $pet['name'] ?? '', 'breed' => $pet['breed'] ?? '', 'petType' => $pet['type'] ?? '', 'grooms' => 0, 'spent' => 0, 'seen' => '', 'ahead' => false );
		}
	}
	return $map;
}

/** Value of one field for one customer. */
function wt_bulk_value( $field, $prof, $event = null, $custom = '' ) {
	$first = wt_first( $prof['name'] ?? '' );
	switch ( $field ) {
		case 'first':
			return $first ? $first : 'there';
		case 'name':
			return trim( (string) ( $prof['name'] ?? '' ) ) ? $prof['name'] : 'there';
		case 'pet':
			return $prof['petName'] ? $prof['petName'] : ( $prof['breed'] ? $prof['breed'] : 'your pet' );
		case 'petName':
			return $prof['petName'] ? $prof['petName'] : 'your pet';
		case 'breed':
			return $prof['breed'] ? $prof['breed'] : ( $prof['petType'] ? $prof['petType'] : 'your pet' );
		case 'petType':
			return $prof['petType'] ? $prof['petType'] : 'Dog';
		case 'city':
			return $prof['city'] ? wt_city_name( $prof['city'] ) : 'your city';
		case 'lastDate':
			return $prof['last'] ? wt_fmt_date( $prof['last'] ) : 'some time';
		case 'days':
			return $prof['last'] ? (string) (int) floor( ( strtotime( wt_today() ) - strtotime( $prof['last'] ) ) / DAY_IN_SECONDS ) : 'many';
		case 'lastPkg':
			return $prof['lastPkg'] ? $prof['lastPkg'] : 'grooming';
		case 'grooms':
			return (string) (int) $prof['grooms'];
		case 'spent':
			return wt_money( $prof['spent'] );
		case 'points':
			return (string) wt_points_balance( $prof['phone'] );
		case 'phone':
			return $prof['phone'];
		case 'bookLink':
			return wt_app_url( 'book' );
		case 'shopLink':
			return wt_app_url( 'shop' );
		case 'siteLink':
			return home_url( '/' );
		case 'custom':
			return $custom;
	}
	if ( 0 === strpos( $field, 'event' ) ) {
		if ( ! $event ) {
			return '-';
		}
		$paid = array_filter( array_map( 'floatval', wp_list_pluck( $event['passes'], 'price' ) ) );
		$from = $paid ? min( $paid ) : 0;
		$vals = array(
			'eventTitle' => $event['title'],
			'eventWhen'  => wt_event_when( $event ),
			'eventVenue' => $event['venue'],
			'eventPrice' => $from > 0 ? wt_money( $from ) : 'Free',
			'eventLink'  => wt_event_link( $event['id'] ),
		);
		return $vals[ $field ] ?? '-';
	}
	return '-';
}

/** Variables in a piece of template text, in order: positional "1","2"… or named. */
function wt_tpl_vars( $text ) {
	preg_match_all( '/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/', (string) $text, $m );
	$v = array_values( array_unique( $m[1] ) );
	if ( $v && ctype_digit( implode( '', $v ) ) ) {
		sort( $v, SORT_NUMERIC );
	}
	return $v;
}

/** Guess a sensible field for a variable from its name or the template's example value. */
function wt_tpl_guess( $name, $example, $where, $pos ) {
	if ( 'button' === $where ) {
		return 'custom';
	}
	$ex = strtolower( trim( (string) $example ) );
	$n  = strtolower( $name . ' ' . $ex );
	if ( preg_match( '/^\d{1,3}$/', $ex ) || preg_match( '/\bdays?\b/', $n ) ) {
		return 'days';
	}
	if ( preg_match( '/^https?:/', $ex ) || preg_match( '/link|url/', $n ) ) {
		return 'bookLink';
	}
	$breeds = '/breed|labrador|retriever|shih|pug|beagle|poodle|husky|spitz|german shepherd|rottweiler|dachshund|lhasa|pomeranian|maltese|doberman|indie|persian|cocker|bulldog|terrier/';
	$rules  = array(
		'eventTitle' => '/event/',
		'breed'      => $breeds,
		'petName'    => '/pet_?name|\bpet\b|bruno|max\b|coco|simba|tommy/',
		'city'       => '/city|kanpur|lucknow|delhi|pune|jaipur|noida|gurgaon/',
		'points'     => '/point/',
		'lastPkg'    => '/package|groom(ing)? type|full groom|bath/',
		'first'      => '/name|first|customer/',
	);
	foreach ( $rules as $f => $re ) {
		if ( preg_match( $re, $n ) ) {
			return $f;
		}
	}
	if ( 'body' === $where && 0 === $pos ) {
		return 'first';
	}
	return preg_match( '/^[a-z]+$/', $ex ) && 'body' === $where ? 'pet' : 'custom';
}

/** Approved templates of the account, with their variable slots. */
function wt_bulk_templates( $fresh = false ) {
	$cache = get_transient( 'wt_bulk_tpls' );
	if ( ! $fresh && is_array( $cache ) ) {
		return $cache;
	}
	$waba = wt_wa_waba_id();
	if ( ! $waba ) {
		return new WP_Error( 'wt_meta', 'Add your WhatsApp Business Account ID in Settings → WhatsApp templates first.' );
	}
	$r = wt_wa_graph( 'GET', $waba . '/message_templates?fields=name,status,category,language,components,parameter_format&limit=250' );
	if ( is_wp_error( $r ) ) {
		return $r;
	}
	$out = array();
	foreach ( (array) ( $r['data'] ?? array() ) as $t ) {
		if ( 'APPROVED' !== ( $t['status'] ?? '' ) || 'AUTHENTICATION' === strtoupper( $t['category'] ?? '' ) ) {
			continue;
		}
		$slots   = array();
		$ok      = true;
		$preview = array( 'header' => '', 'body' => '', 'footer' => '', 'buttons' => array() );
		foreach ( (array) ( $t['components'] ?? array() ) as $c ) {
			$type = strtoupper( $c['type'] ?? '' );
			if ( 'HEADER' === $type ) {
				$fmt = strtoupper( $c['format'] ?? 'TEXT' );
				if ( 'TEXT' === $fmt ) {
					$preview['header'] = (string) ( $c['text'] ?? '' );
					$ex                = (array) ( $c['example']['header_text'] ?? array() );
					foreach ( wt_tpl_vars( $c['text'] ?? '' ) as $i => $v ) {
						$slots[] = array( 'key' => 'header:' . $v, 'where' => 'header', 'name' => $v, 'label' => '{{' . $v . '}} in the heading', 'example' => (string) ( $ex[ $i ] ?? '' ), 'guess' => wt_tpl_guess( $v, (string) ( $ex[ $i ] ?? '' ), 'header', $i ) );
					}
				} elseif ( in_array( $fmt, array( 'IMAGE', 'VIDEO', 'DOCUMENT' ), true ) ) {
					$preview['header'] = '[' . ucfirst( strtolower( $fmt ) ) . ']';
					$slots[]           = array( 'key' => 'media', 'where' => 'media', 'name' => strtolower( $fmt ), 'label' => ucfirst( strtolower( $fmt ) ) . ' at the top (link to the file)', 'example' => (string) ( $c['example']['header_handle'][0] ?? '' ), 'guess' => 'custom' );
				} else {
					$ok = false; // location headers are not supported
				}
			} elseif ( 'BODY' === $type ) {
				$preview['body'] = (string) ( $c['text'] ?? '' );
				$ex              = (array) ( $c['example']['body_text'][0] ?? array() );
				$named           = array();
				foreach ( (array) ( $c['example']['body_text_named_params'] ?? array() ) as $np ) {
					$named[ $np['param_name'] ] = $np['example'] ?? '';
				}
				foreach ( wt_tpl_vars( $c['text'] ?? '' ) as $i => $v ) {
					$e       = isset( $named[ $v ] ) ? $named[ $v ] : (string) ( $ex[ $i ] ?? '' );
					$slots[] = array( 'key' => 'body:' . $v, 'where' => 'body', 'name' => $v, 'label' => '{{' . $v . '}} in the message', 'example' => $e, 'guess' => wt_tpl_guess( $v, $e, 'body', $i ) );
				}
			} elseif ( 'FOOTER' === $type ) {
				$preview['footer'] = (string) ( $c['text'] ?? '' );
			} elseif ( 'BUTTONS' === $type ) {
				foreach ( (array) ( $c['buttons'] ?? array() ) as $bi => $btn ) {
					$bt                   = strtoupper( $btn['type'] ?? '' );
					$preview['buttons'][] = (string) ( $btn['text'] ?? $bt );
					if ( 'URL' === $bt && false !== strpos( (string) ( $btn['url'] ?? '' ), '{{' ) ) {
						$slots[] = array( 'key' => 'url:' . $bi, 'where' => 'button', 'name' => (string) $bi, 'label' => 'End of the link on button "' . ( $btn['text'] ?? '' ) . '" (' . $btn['url'] . ')', 'example' => (string) ( $btn['example'][0] ?? '' ), 'guess' => 'custom' );
					} elseif ( 'COPY_CODE' === $bt ) {
						$slots[] = array( 'key' => 'code:' . $bi, 'where' => 'button', 'name' => (string) $bi, 'label' => 'Coupon code for the "Copy code" button', 'example' => (string) ( is_array( $btn['example'] ?? null ) ? ( $btn['example'][0] ?? '' ) : ( $btn['example'] ?? '' ) ), 'guess' => 'custom' );
					} elseif ( in_array( $bt, array( 'FLOW', 'CATALOG', 'MPM', 'OTP' ), true ) ) {
						$ok = false;
					}
				}
			}
		}
		if ( ! $ok ) {
			continue;
		}
		$out[] = array(
			'name'     => $t['name'],
			'lang'     => $t['language'],
			'category' => ucfirst( strtolower( $t['category'] ?? '' ) ),
			'named'    => 'NAMED' === strtoupper( $t['parameter_format'] ?? '' ),
			'slots'    => $slots,
			'preview'  => $preview,
		);
	}
	usort(
		$out,
		function ( $a, $b ) {
			return strcmp( $a['name'], $b['name'] );
		}
	);
	set_transient( 'wt_bulk_tpls', $out, 10 * MINUTE_IN_SECONDS );
	return $out;
}

function wt_bulk_find_tpl( $name, $lang ) {
	$all = wt_bulk_templates();
	if ( is_wp_error( $all ) ) {
		return $all;
	}
	foreach ( array( false, true ) as $fresh ) {
		if ( $fresh ) {
			$all = wt_bulk_templates( true );
			if ( is_wp_error( $all ) ) {
				return $all;
			}
		}
		foreach ( $all as $t ) {
			if ( $t['name'] === $name && ( ! $lang || $t['lang'] === $lang ) ) {
				return $t;
			}
		}
	}
	return new WP_Error( 'wt_tpl', 'That template is not approved (or was deleted) in Meta. Pick another one.', array( 'status' => 400 ) );
}

/** Clean a value so Meta accepts it as a template parameter. */
function wt_bulk_clean( $v ) {
	$v = trim( preg_replace( '/[\r\n\t]+/', ' ', (string) $v ) );
	$v = preg_replace( '/ {4,}/', '   ', $v );
	return '' === $v ? '-' : mb_substr( $v, 0, 1000 );
}

/**
 * Template components and the filled-in text for one customer.
 *
 * @return array [components, text]
 */
function wt_bulk_build( $tpl, $map, $prof, $event ) {
	$vals = array();
	foreach ( $tpl['slots'] as $s ) {
		$m                  = $map[ $s['key'] ] ?? array( 'field' => $s['guess'], 'text' => '' );
		$vals[ $s['key'] ] = wt_bulk_clean( wt_bulk_value( $m['field'] ?? 'custom', $prof, $event, (string) ( $m['text'] ?? '' ) ) );
	}
	$comp   = array();
	$header = array();
	$body   = array();
	$btns   = array();
	foreach ( $tpl['slots'] as $s ) {
		$v = $vals[ $s['key'] ];
		if ( 'media' === $s['where'] ) {
			$header[] = array( 'type' => $s['name'], $s['name'] => array( 'link' => $v ) );
		} elseif ( 'header' === $s['where'] || 'body' === $s['where'] ) {
			$p = array( 'type' => 'text', 'text' => $v );
			if ( $tpl['named'] ) {
				$p['parameter_name'] = $s['name'];
			}
			if ( 'header' === $s['where'] ) {
				$header[] = $p;
			} else {
				$body[] = $p;
			}
		} elseif ( 0 === strpos( $s['key'], 'url:' ) ) {
			$btns[] = array( 'type' => 'button', 'sub_type' => 'url', 'index' => (string) $s['name'], 'parameters' => array( array( 'type' => 'text', 'text' => $v ) ) );
		} elseif ( 0 === strpos( $s['key'], 'code:' ) ) {
			$btns[] = array( 'type' => 'button', 'sub_type' => 'copy_code', 'index' => (string) $s['name'], 'parameters' => array( array( 'type' => 'coupon_code', 'coupon_code' => mb_substr( $v, 0, 15 ) ) ) );
		}
	}
	if ( $header ) {
		$comp[] = array( 'type' => 'header', 'parameters' => $header );
	}
	if ( $body ) {
		$comp[] = array( 'type' => 'body', 'parameters' => $body );
	}
	$comp = array_merge( $comp, $btns );
	$fill = function ( $text, $where ) use ( $vals ) {
		return preg_replace_callback(
			'/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/',
			function ( $m ) use ( $vals, $where ) {
				return $vals[ $where . ':' . $m[1] ] ?? $m[0];
			},
			(string) $text
		);
	};
	$text = trim( ( $tpl['preview']['header'] ? $fill( $tpl['preview']['header'], 'header' ) . "\n" : '' ) . $fill( $tpl['preview']['body'], 'body' ) . ( $tpl['preview']['footer'] ? "\n" . $tpl['preview']['footer'] : '' ) );
	return array( $comp, $text );
}

/** Send one approved template with ready components; logged like every other WhatsApp message. */
function wt_wa_send_template( $to, $tpl, $components, $text ) {
	$s      = wt_config()['settings'];
	$digits = preg_replace( '/\D/', '', (string) $to );
	if ( strlen( $digits ) === 10 ) {
		$digits = '91' . $digits;
	}
	$result = 'Not sent (WhatsApp Cloud API is not connected)';
	$wamid  = '';
	if ( 'cloud' === $s['waMode'] && $s['waPhoneId'] && $s['waToken'] ) {
		$payload = array(
			'messaging_product' => 'whatsapp',
			'to'                => $digits,
			'type'              => 'template',
			'template'          => array(
				'name'     => $tpl['name'],
				'language' => array( 'code' => $tpl['lang'] ),
			),
		);
		if ( $components ) {
			$payload['template']['components'] = $components;
		}
		$res    = wp_remote_post(
			'https://graph.facebook.com/v23.0/' . rawurlencode( $s['waPhoneId'] ) . '/messages',
			array(
				'timeout' => 15,
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
	wt_log_notif( 'WhatsApp', $digits, 'Broadcast: ' . $tpl['name'], $text, $result, $wamid );
	return $result;
}

/** Clean the admin's variable choices against the template's slots. */
function wt_bulk_clean_map( $tpl, $raw ) {
	$fields = wt_bulk_fields();
	$map    = array();
	foreach ( $tpl['slots'] as $s ) {
		$r     = (array) ( $raw[ $s['key'] ] ?? array() );
		$field = isset( $fields[ $r['field'] ?? '' ] ) ? $r['field'] : $s['guess'];
		$text  = trim( sanitize_text_field( wp_unslash( (string) ( $r['text'] ?? '' ) ) ) );
		if ( 'media' === $s['where'] || 'button' === $s['where'] ) {
			$field = 'media' === $s['where'] ? 'custom' : $field;
		}
		if ( 'media' === $s['where'] ) {
			$text = esc_url_raw( $text );
			if ( ! $text ) {
				return new WP_Error( 'wt_tpl', 'Add the link to the ' . $s['name'] . ' that goes at the top of this template.', array( 'status' => 400 ) );
			}
		} elseif ( 'custom' === $field && '' === $text ) {
			return new WP_Error( 'wt_tpl', 'Type the text for ' . $s['label'] . '.', array( 'status' => 400 ) );
		}
		$map[ $s['key'] ] = array( 'field' => $field, 'text' => $text );
	}
	return $map;
}

function wt_api_bulk_templates( $in ) {
	$t = wt_bulk_templates( ! empty( $in['fresh'] ) );
	if ( is_wp_error( $t ) ) {
		return $t;
	}
	return array( 'templates' => $t, 'fields' => wt_bulk_fields() );
}

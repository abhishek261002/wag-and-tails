<?php
/**
 * Business settings: cities, packages, breeds, coupons, insurance form, rewards, etc.
 * Stored as one option so the admin panel can edit everything in one place.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function wt_default_config() {
	$cities = array(
		array( 'kanpur', 'Kanpur' ),
		array( 'lucknow', 'Lucknow' ),
		array( 'hyderabad', 'Hyderabad' ),
		array( 'north-mumbai', 'North Mumbai' ),
		array( 'south-mumbai', 'South Mumbai' ),
		array( 'navi-mumbai', 'Navi Mumbai' ),
		array( 'pune', 'Pune' ),
		array( 'pcmc', 'Pimpri Chinchwad (Pune)' ),
		array( 'indore', 'Indore' ),
		array( 'jaipur', 'Jaipur' ),
	);
	$bump  = array(
		'north-mumbai' => 200,
		'south-mumbai' => 250,
		'navi-mumbai'  => 150,
		'hyderabad'    => 100,
		'pune'         => 100,
		'pcmc'         => 100,
	);
	$city_rows = array();
	foreach ( $cities as $c ) {
		$city_rows[] = array(
			'id'         => $c[0],
			'name'       => $c[1],
			'service'    => true,
			'walking'    => false,
			'reviewLink' => '',
		);
	}
	$priced = function ( $base ) use ( $cities, $bump ) {
		$out = array();
		foreach ( $cities as $c ) {
			$out[ $c[0] ] = $base + ( isset( $bump[ $c[0] ] ) ? $bump[ $c[0] ] : 0 );
		}
		return $out;
	};

	return array(
		'cities'    => $city_rows,
		'packages'  => array(
			array( 'id' => 'basic', 'name' => 'Bath & Brush', 'pet' => 'Both', 'duration' => '60 min', 'items' => array( 'Shampoo bath & blow dry', 'Brushing & de-matting', 'Ear cleaning', 'Nail clipping' ), 'prices' => $priced( 799 ) ),
			array( 'id' => 'full', 'name' => 'Full Groom', 'pet' => 'Dog', 'duration' => '90 min', 'items' => array( 'Everything in Bath & Brush', 'Breed-style haircut', 'Paw & sanitary trim', 'Teeth brushing' ), 'prices' => $priced( 1299 ) ),
			array( 'id' => 'spa', 'name' => 'Spa Deluxe', 'pet' => 'Dog', 'duration' => '120 min', 'items' => array( 'Everything in Full Groom', 'Anti-tick treatment', 'Paw butter massage', 'Fragrance mist' ), 'prices' => $priced( 1899 ) ),
			array( 'id' => 'cat', 'name' => 'Cat Care', 'pet' => 'Cat', 'duration' => '75 min', 'items' => array( 'Gentle waterless or full bath', 'Comb-out & de-shedding', 'Nail & ear care', 'Sanitary trim' ), 'prices' => $priced( 1099 ) ),
		),
		'breeds'    => array(
			'Dog' => array( 'Indie / Desi', 'Labrador Retriever', 'Golden Retriever', 'German Shepherd', 'Beagle', 'Pug', 'Shih Tzu', 'Lhasa Apso', 'Pomeranian', 'Siberian Husky', 'Rottweiler', 'Doberman', 'Cocker Spaniel', 'Dachshund', 'French Bulldog', 'Maltese', 'Poodle', 'Chihuahua', 'Boxer', 'Great Dane', 'Saint Bernard', 'Yorkshire Terrier', 'Other / Mixed' ),
			'Cat' => array( 'Indian / Desi', 'Persian', 'Siamese', 'Maine Coon', 'British Shorthair', 'Bengal', 'Ragdoll', 'Himalayan', 'Other / Mixed' ),
		),
		'coupons'   => array(
			array( 'code' => 'FIRST15', 'type' => 'pct', 'value' => 15, 'min' => 0, 'active' => true, 'desc' => '15% off your first grooming' ),
			array( 'code' => 'WAG100', 'type' => 'flat', 'value' => 100, 'min' => 999, 'active' => true, 'desc' => '₹100 off bookings above ₹999' ),
		),
		'insFields' => array(
			array( 'id' => 'f1', 'label' => 'Pet parent name', 'type' => 'text', 'required' => true, 'options' => '' ),
			array( 'id' => 'f2', 'label' => 'Phone number', 'type' => 'tel', 'required' => true, 'options' => '' ),
			array( 'id' => 'f3', 'label' => 'Email', 'type' => 'email', 'required' => true, 'options' => '' ),
			array( 'id' => 'f4', 'label' => 'City', 'type' => 'text', 'required' => true, 'options' => '' ),
			array( 'id' => 'f5', 'label' => 'Pet name', 'type' => 'text', 'required' => true, 'options' => '' ),
			array( 'id' => 'f6', 'label' => 'Pet type', 'type' => 'select', 'required' => true, 'options' => 'Dog, Cat' ),
			array( 'id' => 'f7', 'label' => 'Breed', 'type' => 'text', 'required' => false, 'options' => '' ),
			array( 'id' => 'f8', 'label' => 'Pet age (years)', 'type' => 'number', 'required' => true, 'options' => '' ),
			array( 'id' => 'f9', 'label' => 'Existing medical conditions', 'type' => 'textarea', 'required' => false, 'options' => '' ),
			array( 'id' => 'f10', 'label' => 'Cover you are interested in', 'type' => 'select', 'required' => false, 'options' => 'Accident & illness, Comprehensive, Not sure yet' ),
		),
		'walkPlans' => array(
			array( 'id' => 'w30', 'name' => '30-minute walk', 'price' => 199 ),
			array( 'id' => 'w60', 'name' => '60-minute walk', 'price' => 349 ),
		),
		'banners'   => array(
			array( 'id' => 'B1', 'title' => 'Winter jackets are here', 'sub' => 'Quilted and fleece styles for chilly walks.', 'img' => '', 'color' => '#4B1D00', 'cta' => '' ),
		),
		'suggested' => array(),
		'rewards'   => array(
			'enabled'     => true,
			'bookingRate' => 5,
			'orderRate'   => 3,
			'pointValue'  => 1,
			'minRedeem'   => 100,
			'maxPct'      => 20,
			'signupBonus' => 50,
		),
		'settings'  => array(
			'notifyEmail'    => get_option( 'admin_email' ),
			'notifyWhatsApp' => '',
			'phone'          => '',
			'email'          => get_option( 'admin_email' ),
			'address'        => '',
			'slots'          => '',
			'dayStart'       => '09:00',
			'dayEnd'         => '19:00',
			'slotStep'       => 30,
			'bufferMins'     => 30,
			'leadMins'       => 60,
			'maxDaysAhead'   => 45,
			'reviewMsg'      => "Hi {name}! Thank you for choosing Wag & Tails for {pet}'s grooming. We would love to hear how it went. Please leave us a quick review here: {link}",
			'razorpayKey'    => '',
			'razorpaySecret' => '',
			'waMode'         => 'off',
			'waPhoneId'      => '',
			'waToken'        => '',
			'waLang'         => 'en',
			'waTemplates'    => array(),
			'waAppSecret'    => '',
			'webhookUrl'     => '',
			'shipPanel'      => 'https://app.shiprocket.in/',
			// Apps and partners (see includes/apps.php for limits). Blank = the default.
			'appsPanelUrl'       => '',
			'appsOfferMins'      => 10,
			'appsEscalateHours'  => 2,
			'appsSameDayMins'    => 15,
			'appsDayBeforeHour'  => 18,
			'appsCancelHours'    => 4,
			'appsNoShowMins'     => 15,
			'appsReconfirmHours' => 2,
			'appsLiveTracking'   => true,
		),
	);
}

function wt_config() {
	$c = get_option( 'wt_config' );
	$d = wt_default_config();
	if ( ! is_array( $c ) ) {
		return $d;
	}
	$c = wp_parse_args( $c, $d );
	$c['settings'] = wp_parse_args( is_array( $c['settings'] ) ? $c['settings'] : array(), $d['settings'] );
	$c['rewards']  = wp_parse_args( is_array( $c['rewards'] ) ? $c['rewards'] : array(), $d['rewards'] );
	return $c;
}

function wt_save_config( $c ) {
	update_option( 'wt_config', $c, false );
}

function wt_slots( $c = null ) {
	$c = $c ? $c : wt_config();
	return array_values( array_filter( array_map( 'trim', explode( ',', (string) $c['settings']['slots'] ) ) ) );
}

function wt_city( $id, $c = null ) {
	$c = $c ? $c : wt_config();
	foreach ( $c['cities'] as $city ) {
		if ( $city['id'] === $id ) {
			return $city;
		}
	}
	return null;
}

function wt_city_name( $id ) {
	$c = wt_city( $id );
	return $c ? $c['name'] : (string) $id;
}

function wt_find( $list, $key, $val ) {
	foreach ( (array) $list as $row ) {
		if ( isset( $row[ $key ] ) && (string) $row[ $key ] === (string) $val ) {
			return $row;
		}
	}
	return null;
}

/**
 * The part of the config that the browser may see, by role.
 */
function wt_client_config( $role ) {
	$c = wt_config();
	$s = $c['settings'];

	$pub_settings = array(
		'phone'          => $s['phone'],
		'email'          => $s['email'],
		'address'        => $s['address'],
		'notifyWhatsApp' => $s['notifyWhatsApp'],
		'maxDaysAhead'   => (int) $s['maxDaysAhead'],
		'razorpayOn'     => ( '' !== $s['razorpayKey'] && '' !== $s['razorpaySecret'] ),
	);
	if ( 'staff' === $role || 'admin' === $role ) {
		$pub_settings['reviewMsg'] = $s['reviewMsg'];
	}
	if ( 'admin' === $role ) {
		$admin_settings                   = $s;
		$admin_settings['razorpaySecret'] = '';
		$admin_settings['waToken']        = '';
		$admin_settings['waAppSecret']    = '';
		$admin_settings['secretSet']      = '' !== $s['razorpaySecret'];
		$admin_settings['waTokenSet']     = '' !== $s['waToken'];
		$admin_settings['razorpayOn']     = $pub_settings['razorpayOn'];
		$admin_settings['waHookUrl']      = rest_url( 'wt/v1/wa-webhook' );
		$admin_settings['waHookToken']    = function_exists( 'wt_wa_verify_token' ) ? wt_wa_verify_token() : '';
		$c['settings']                    = $admin_settings;
		return $c;
	}

	$c['settings'] = $pub_settings;
	$c['coupons']  = array_values(
		array_filter(
			$c['coupons'],
			function ( $cp ) use ( $role ) {
				$vis = $cp['visibility'] ?? 'listed';
				return ! empty( $cp['active'] ) && ( 'listed' === $vis || 'staff' === $role );
			}
		)
	);
	return $c;
}

/**
 * Clean a config object posted from the admin panel.
 */
function wt_clean_value( $v, $key = '' ) {
	if ( is_array( $v ) ) {
		$out = array();
		foreach ( $v as $k => $item ) {
			$ck         = is_int( $k ) ? $k : preg_replace( '/[^A-Za-z0-9_\-]/', '', (string) $k );
			$out[ $ck ] = wt_clean_value( $item, is_int( $k ) ? $key : (string) $k );
		}
		return $out;
	}
	if ( is_bool( $v ) || is_int( $v ) || is_float( $v ) || null === $v ) {
		return $v;
	}
	$v = (string) $v;
	if ( in_array( $key, array( 'img', 'reviewLink', 'webhookUrl', 'shipPanel' ), true ) ) {
		return esc_url_raw( $v );
	}
	if ( in_array( $key, array( 'reviewMsg', 'desc', 'sub', 'options', 'address' ), true ) ) {
		return sanitize_textarea_field( $v );
	}
	return sanitize_text_field( $v );
}

function wt_merge_admin_config( $in ) {
	$old  = wt_config();
	$keys = array( 'cities', 'packages', 'breeds', 'coupons', 'insFields', 'walkPlans', 'banners', 'suggested', 'rewards', 'settings' );
	$new  = $old;
	foreach ( $keys as $k ) {
		if ( isset( $in[ $k ] ) && is_array( $in[ $k ] ) ) {
			$new[ $k ] = wt_clean_value( $in[ $k ], $k );
		}
	}
	// Secrets are never sent to the browser; a blank value means "keep the saved one".
	foreach ( array( 'razorpaySecret', 'waToken', 'waAppSecret' ) as $secret ) {
		if ( empty( $new['settings'][ $secret ] ) ) {
			$new['settings'][ $secret ] = $old['settings'][ $secret ];
		}
	}
	unset( $new['settings']['secretSet'], $new['settings']['waTokenSet'], $new['settings']['razorpayOn'], $new['settings']['waHookUrl'], $new['settings']['waHookToken'] );
	$new['suggested'] = array_values( array_map( 'intval', (array) $new['suggested'] ) );
	$r                = &$new['rewards'];
	$r['enabled']     = ! empty( $r['enabled'] );
	foreach ( array( 'bookingRate', 'orderRate', 'pointValue', 'minRedeem', 'maxPct', 'signupBonus' ) as $n ) {
		$r[ $n ] = max( 0, (float) $r[ $n ] );
	}
	if ( $r['pointValue'] <= 0 ) {
		$r['pointValue'] = 1;
	}
	$r['maxPct'] = min( 100, max( 1, $r['maxPct'] ) );
	unset( $r );
	wt_save_config( $new );
	return $new;
}

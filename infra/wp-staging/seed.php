<?php
/**
 * Staging sample data for the wag-and-tails plugin. Run with: wp eval-file /staging/seed.php
 * Safe to repeat: sample customers/bookings are tagged "Sample:" and replaced each run.
 * Mirrors the live site's public config (cities, packages, city prices, walk plans) as seen on wagandtails.in.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$cities = array(
	array( 'kanpur', 'Kanpur', 0 ), array( 'lucknow', 'Lucknow', 0 ), array( 'hyderabad', 'Hyderabad', 0 ),
	array( 'north-mumbai', 'North Mumbai', 1 ), array( 'south-mumbai', 'South Mumbai', 1 ), array( 'navi-mumbai', 'Navi Mumbai', 1 ),
	array( 'pune', 'Pune', 0 ), array( 'pcmc', 'Pimpri Chinchwad (Pune)', 0 ), array( 'indore', 'Indore', 0 ), array( 'jaipur', 'Jaipur', 0 ),
);
$price = function ( $base, $mumbai ) use ( $cities ) {
	$o = array();
	foreach ( $cities as $c ) {
		$o[ $c[0] ] = $base + ( $c[2] ? $mumbai : 0 );
	}
	return $o;
};
$cfg = wt_config();
$cfg['cities'] = array();
foreach ( $cities as $c ) {
	$cfg['cities'][] = array( 'id' => $c[0], 'name' => $c[1], 'service' => true, 'walking' => in_array( $c[0], array( 'kanpur', 'lucknow' ), true ), 'reviewLink' => '', 'capacity' => 3 );
}
$cfg['packages'] = array(
	array( 'id' => 'pkbasic', 'name' => 'Basic Grooming', 'pet' => 'Both', 'duration' => '60 min', 'mins' => 60, 'mrp' => 1200, 'items' => array( 'Bath with shampoo', 'Blow Dry with dryer', 'Nail Clipping', 'Ear Clean', 'Eye Clean', 'Paw Massage', 'Paw Cream', 'Combing', 'Fragrances' ), 'prices' => $price( 999, 0 ) ),
	array( 'id' => 'pkbath', 'name' => 'Bath + Basic Package', 'pet' => 'Both', 'duration' => '60 min', 'mins' => 60, 'mrp' => 1800, 'items' => array( 'Everything in Basic Grooming', 'Conditioner', 'Tick and flea check' ), 'prices' => $price( 1299, 100 ) ),
	array( 'id' => 'pkstd', 'name' => 'Standard Package', 'pet' => 'Both', 'duration' => '60 min', 'mins' => 60, 'mrp' => 1800, 'items' => array( 'Everything in Bath + Basic', 'Hygiene trim', 'Face trim' ), 'prices' => $price( 1399, 100 ) ),
	array( 'id' => 'pkfull', 'name' => 'Full Grooming Package', 'pet' => 'Both', 'duration' => '90 min', 'mins' => 90, 'mrp' => 2499, 'items' => array( 'Everything in Standard', 'Full body haircut', 'Teeth cleaning' ), 'prices' => $price( 1699, 300 ) ),
	array( 'id' => 'pklux', 'name' => 'Luxury Package', 'pet' => 'Both', 'duration' => '120 min', 'mins' => 120, 'mrp' => 3000, 'items' => array( 'Everything in Full Grooming', 'De-shedding treatment', 'Spa mask' ), 'prices' => $price( 2199, 300 ) ),
);
$cfg['walkPlans'] = array( array( 'id' => 'w30', 'name' => '30-minute walk', 'price' => 199 ), array( 'id' => 'w60', 'name' => '60-minute walk', 'price' => 349 ) );
$cfg['coupons'] = array(
	array( 'code' => 'PAMPER', 'type' => 'pct', 'value' => 10, 'min' => 0, 'desc' => '10% OFF on your first booking', 'active' => true ),
	array( 'code' => 'FESTIVAL', 'type' => 'flat', 'value' => 200, 'min' => 1699, 'desc' => '₹200 OFF on Full Grooming', 'active' => true ),
);
$cfg['rewards'] = array( 'enabled' => true, 'bookingRate' => 10, 'orderRate' => 20, 'pointValue' => 1, 'minRedeem' => 100, 'maxPct' => 50, 'signupBonus' => 100 );
$cfg['settings']['maxDaysAhead'] = 10;
$cfg['settings']['notifyEmail']  = 'alerts@example.test';
wt_save_config( $cfg );
echo "Config saved: " . count( $cfg['cities'] ) . " cities, " . count( $cfg['packages'] ) . " packages\n";

// Booking desk staff (Lucknow) with attendance off for convenience.
if ( ! username_exists( 'desk.lucknow' ) ) {
	$uid = wp_insert_user( array( 'user_login' => 'desk.lucknow', 'user_pass' => 'desk12345', 'display_name' => 'Anshika (desk)', 'role' => 'wt_desk' ) );
	update_user_meta( $uid, 'wt_city', 'lucknow' );
}
$team = wt_team();
$team['attendanceOn'] = false;
wt_team_save( $team );

// Sample customers and bookings (replaced on every run).
global $wpdb;
$wpdb->query( $wpdb->prepare( 'DELETE FROM ' . wt_table() . " WHERE data LIKE %s", '%"name":"Sample: %' ) ); // phpcs:ignore
$people = array(
	array( '9876543210', 'Sample: Arjun Mehta', 'lucknow', 'Golden Retriever', 'Dog' ),
	array( '9876543211', 'Sample: Sahana K', 'kanpur', 'Shih Tzu', 'Dog' ),
	array( '9876543212', 'Sample: Rohan Verma', 'lucknow', 'Persian', 'Cat' ),
);
$made = 0;
foreach ( $people as $i => $p ) {
	list( $phone, $name, $city, $breed, $type ) = $p;
	wt_points_add( $phone, 150, 'Welcome bonus', '' );
	foreach ( array( array( -20, 'Completed', 'pkbasic' ), array( 2 + $i, 'Confirmed', 'pkfull' ) ) as $k => $spec ) {
		$date = wp_date( 'Y-m-d', time() + $spec[0] * DAY_IN_SECONDS );
		$pkg  = wt_find( $cfg['packages'], 'id', $spec[2] );
		$total = $pkg['prices'][ $city ];
		$start = sprintf( '%02d:00', 10 + $i + $k );
		$rec = array(
			'city' => $city, 'pkg' => $spec[2], 'petType' => $type, 'breed' => $breed, 'gender' => 'Male', 'age' => '3 years',
			'aggression' => WT_AGGRESSION[0], 'name' => $name, 'email' => '', 'phone' => $phone, 'acct' => $phone,
			'address' => 'House ' . ( 10 + $i ) . ', Sample Colony', 'pincode' => 'lucknow' === $city ? '226010' : '208001',
			'lat' => 'lucknow' === $city ? 26.8467 : 26.4499, 'lng' => 'lucknow' === $city ? 80.9462 : 80.3319,
			'date' => $date, 'start' => $start, 'slot' => wt_slot_label( wt_hm_to_min( $start ), $pkg['mins'] ), 'mins' => $pkg['mins'],
			'addons' => array(), 'subtotal' => $total, 'coupon' => '', 'discount' => 0, 'pointsUsed' => 0, 'total' => $total,
			'status' => $spec[1], 'pay' => 'later', 'payStatus' => 'Completed' === $spec[1] ? 'Paid' : 'Due', 'payMode' => 'Completed' === $spec[1] ? 'Cash' : '',
			'source' => 'Website', 'by' => 'Website', 'notes' => '', 'ts' => time(),
		);
		wt_rec_insert( 'booking', $rec, 'WT' );
		++$made;
	}
}
echo "Sample bookings: $made\n";

// Store products come from the client's product sheet: see import-products.php (run by setup.sh).

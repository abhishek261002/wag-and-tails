<?php
/**
 * Staging only: fill WooCommerce with the products that are live on wagandtails.in, from the client's product sheet
 * (apps/api/scripts/data/store-products.csv). Rows whose Status is "Live" are imported; sizes or products the sheet
 * marks as not live on the website are left out. Removes the placeholder products the staging seed created.
 *
 *   wp eval-file /staging/import-products.php /tmp/store-products.csv
 *
 * Safe to run again: products are matched by the website's product ID (or name), sizes by SKU, images by URL.
 */
if ( ! defined( 'ABSPATH' ) || ! function_exists( 'wc_get_product' ) ) {
	echo "WooCommerce is not active\n";
	return;
}
require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/media.php';
require_once ABSPATH . 'wp-admin/includes/image.php';

$file = $args[0] ?? '/tmp/store-products.csv';
$fh   = fopen( $file, 'r' );
if ( ! $fh ) {
	echo "Cannot open $file\n";
	return;
}
$head = fgetcsv( $fh );
$head[0] = preg_replace( '/^\xEF\xBB\xBF/', '', $head[0] );
$rows = array();
while ( ( $r = fgetcsv( $fh ) ) !== false ) {
	if ( count( $r ) < 5 ) {
		continue;
	}
	$rows[] = array_combine( array_slice( $head, 0, count( $r ) ), array_slice( $r, 0, count( $head ) ) );
}
fclose( $fh );

$money = function ( $v ) {
	return (float) str_replace( array( ',', '₹', ' ' ), '', (string) $v );
};

// Group the live rows into products.
$groups = array();
foreach ( $rows as $r ) {
	if ( 'Live' !== ( $r['Status'] ?? '' ) ) {
		continue;
	}
	$key = $r['Site Product ID'] ? 'site-' . $r['Site Product ID'] : 'name-' . md5( $r['Product Name'] );
	$groups[ $key ]['name']     = $r['Product Name'];
	$groups[ $key ]['category'] = $r['Category'];
	$groups[ $key ]['rows'][]   = $r;
}
echo count( $groups ) . " live products in the sheet\n";

// 1. Remove the placeholder products made by the staging seed (they are not on the real site).
foreach ( array( 'Calming Dog Bed (M)', 'Winter Jacket - Quilted', 'Oatmeal Dog Shampoo' ) as $title ) {
	foreach ( wc_get_products( array( 'name' => $title, 'limit' => -1 ) ) as $p ) {
		if ( ! $p->get_meta( '_wt_sheet_key' ) ) {
			$p->delete( true );
			echo "Removed placeholder: $title\n";
		}
	}
}

// Images: download once, keep a URL → attachment map. Skip extra thumbnail sizes to keep the import quick.
add_filter( 'intermediate_image_sizes_advanced', '__return_empty_array' );
$img_map = get_option( 'wt_sheet_img_map', array() );
$failed  = array();
$image   = function ( $url, $post_id ) use ( &$img_map, &$failed ) {
	$url = trim( (string) $url );
	if ( '' === $url ) {
		return 0;
	}
	if ( ! empty( $img_map[ $url ] ) && get_post( $img_map[ $url ] ) ) {
		return (int) $img_map[ $url ];
	}
	for ( $try = 1; $try <= 3; $try++ ) {
		$tmp = download_url( $url, 30 );
		if ( ! is_wp_error( $tmp ) ) {
			break;
		}
		sleep( 2 * $try ); // image hosts rate-limit bursts
	}
	if ( is_wp_error( $tmp ) ) {
		$failed[] = $url;
		return 0;
	}
	$name = sanitize_file_name( basename( wp_parse_url( $url, PHP_URL_PATH ) ) );
	if ( ! preg_match( '/\.(jpe?g|png|webp)$/i', $name ) ) {
		$name .= '.jpg';
	}
	$id = media_handle_sideload( array( 'name' => $name, 'tmp_name' => $tmp ), $post_id );
	if ( is_wp_error( $id ) ) {
		@unlink( $tmp );
		$failed[] = $url;
		return 0;
	}
	$img_map[ $url ] = $id;
	update_option( 'wt_sheet_img_map', $img_map, false );
	return (int) $id;
};

$cat_id = function ( $name ) {
	$t = term_exists( $name, 'product_cat' );
	if ( ! $t ) {
		$t = wp_insert_term( $name, 'product_cat' );
	}
	return is_array( $t ) ? (int) $t['term_id'] : (int) $t;
};
$is_size = function ( $v ) {
	return (bool) preg_match( '/^(x{0,2}-?small|medium|x{0,2}-?large|\d+\s?(ml|litre|l|kg|g))$/i', trim( $v ) );
};

$made = 0;
$updated = 0;
$variations = 0;
foreach ( $groups as $key => $g ) {
	$rows   = $g['rows'];
	$opts   = array_values( array_filter( array_map( function ( $r ) { return trim( $r['Size / Variant'] ); }, $rows ) ) );
	$simple = count( $rows ) === 1 && ( ! $opts || count( $opts ) === 1 && count( $rows ) === 1 && '' === trim( $rows[0]['Size / Variant'] ) );
	$found  = wc_get_products( array( 'limit' => 1, 'meta_key' => '_wt_sheet_key', 'meta_value' => $key, 'type' => array( 'simple', 'variable' ) ) );
	$p      = $found ? $found[0] : null;
	if ( $p && ( $simple xor $p->is_type( 'simple' ) ) ) {
		$p->delete( true );
		$p = null;
	}
	if ( ! $p ) {
		$p = $simple ? new WC_Product_Simple() : new WC_Product_Variable();
		$made++;
	} else {
		$updated++;
	}
	$p->set_name( $g['name'] );
	$p->set_status( 'publish' );
	$p->set_catalog_visibility( 'visible' );
	$p->set_category_ids( array( $cat_id( $g['category'] ) ) );
	$p->update_meta_data( '_wt_sheet_key', $key );
	if ( $simple ) {
		$r = $rows[0];
		$p->set_sku( $r['SKU'] );
		$p->set_regular_price( (string) $money( $r['Regular Price (INR)'] ) );
		$sell = $money( $r['Selling Price (INR)'] );
		$p->set_sale_price( $sell < $money( $r['Regular Price (INR)'] ) ? (string) $sell : '' );
		$p->set_stock_status( 'instock' );
	}
	$pid = $p->save();

	// Gallery: every image of the product, the first row's first image as the main one.
	$urls = array();
	foreach ( $rows as $r ) {
		for ( $k = 1; $k <= 7; $k++ ) {
			$u = trim( $r[ "Image $k" ] ?? '' );
			if ( $u && ! in_array( $u, $urls, true ) ) {
				$urls[] = $u;
			}
		}
	}
	$ids = array_values( array_filter( array_map( function ( $u ) use ( $image, $pid ) { return $image( $u, $pid ); }, array_slice( $urls, 0, 10 ) ) ) );
	if ( $ids ) {
		$p->set_image_id( $ids[0] );
		$p->set_gallery_image_ids( array_slice( $ids, 1 ) );
	}

	if ( ! $simple ) {
		$attr_name = count( array_filter( $opts, $is_size ) ) === count( $opts ) ? 'Size' : 'Option';
		$a         = new WC_Product_Attribute();
		$a->set_name( $attr_name );
		$a->set_options( $opts );
		$a->set_visible( true );
		$a->set_variation( true );
		$p->set_attributes( array( $a ) );
		$p->save();
		$slug  = sanitize_title( $attr_name );
		$known = array();
		foreach ( $p->get_children() as $cid ) {
			$v = wc_get_product( $cid );
			if ( $v ) {
				$known[ $v->get_sku() ] = $v;
			}
		}
		$keep = array();
		foreach ( $rows as $r ) {
			$v = $known[ $r['SKU'] ] ?? new WC_Product_Variation();
			$v->set_parent_id( $pid );
			try {
				$v->set_sku( $r['SKU'] );
			} catch ( Exception $e ) {
				echo "SKU {$r['SKU']} is used by another product: {$e->getMessage()}\n";
			}
			$v->set_attributes( array( $slug => trim( $r['Size / Variant'] ) ) );
			$reg  = $money( $r['Regular Price (INR)'] );
			$sell = $money( $r['Selling Price (INR)'] );
			$v->set_regular_price( (string) $reg );
			$v->set_sale_price( $sell < $reg ? (string) $sell : '' );
			$v->set_stock_status( 'instock' );
			$v->set_status( 'publish' );
			$img = $image( $r['Image 1'] ?? '', $pid );
			if ( $img ) {
				$v->set_image_id( $img );
			}
			$keep[] = $v->save();
			$variations++;
		}
		foreach ( $p->get_children() as $cid ) {
			if ( ! in_array( $cid, $keep, true ) ) {
				wp_delete_post( $cid, true ); // a size no longer live
			}
		}
		WC_Product_Variable::sync( $pid );
	}
	$p->save();
	echo '.';
}
wc_delete_product_transients();
echo "\nProducts created $made, updated $updated, sizes $variations\n";
echo count( $failed ) . " images could not be downloaded\n";
foreach ( $failed as $u ) {
	echo "  $u\n";
}

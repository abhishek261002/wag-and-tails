<?php
/**
 * Careers: the admin posts jobs, anyone can read open jobs and apply (with a CV), and the admin
 * reviews applications, moves them through a status and downloads them as a CSV.
 *
 * Jobs live in the option wt_jobs. Applications are records of type "jobapp" (IDs JA-…).
 * CVs are stored outside the media library in uploads/wt-private/cv with random names and are only
 * served to logged-in admins through the REST API.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const WT_JOB_TYPES   = array( 'Full-time', 'Part-time', 'Internship', 'Contract', 'Freelance' );
const WT_APP_STATUSES = array( 'New', 'Shortlisted', 'Interview', 'Hired', 'Rejected' );

function wt_jobs() {
	$j = get_option( 'wt_jobs', array() );
	return is_array( $j ) ? $j : array();
}

function wt_job( $id ) {
	foreach ( wt_jobs() as $j ) {
		if ( $j['id'] === $id ) {
			return $j;
		}
	}
	return null;
}

/** Text for a job's place: a city name, "All cities", or what the admin typed. */
function wt_job_place( $j ) {
	if ( 'any' === ( $j['city'] ?? '' ) ) {
		return 'Any city';
	}
	if ( wt_city( (string) ( $j['city'] ?? '' ) ) ) {
		return wt_city_name( $j['city'] );
	}
	return (string) ( $j['place'] ?? '' );
}

function wt_job_public( $j ) {
	return array(
		'id'         => $j['id'],
		'title'      => $j['title'],
		'city'       => $j['city'],
		'place'      => wt_job_place( $j ),
		'type'       => $j['type'],
		'salary'     => $j['salary'],
		'experience' => $j['experience'],
		'openings'   => (int) $j['openings'],
		'desc'       => $j['desc'],
		'reqs'       => $j['reqs'],
		'posted'     => $j['posted'],
		'cvRequired' => ! empty( $j['cvRequired'] ),
	);
}

/** Open jobs, newest first. */
function wt_jobs_open() {
	$out = array();
	foreach ( wt_jobs() as $j ) {
		if ( 'open' === ( $j['status'] ?? '' ) && ( empty( $j['until'] ) || $j['until'] >= wt_today() ) ) {
			$out[] = wt_job_public( $j );
		}
	}
	usort(
		$out,
		function ( $a, $b ) {
			return strcmp( $b['posted'], $a['posted'] );
		}
	);
	return $out;
}

function wt_api_jobs() {
	return array( 'jobs' => wt_jobs_open() );
}

/* ---------- private CV storage ---------- */

function wt_cv_dir() {
	$u   = wp_upload_dir();
	$dir = trailingslashit( $u['basedir'] ) . 'wt-private/cv';
	if ( ! is_dir( $dir ) ) {
		wp_mkdir_p( $dir );
	}
	$root = dirname( $dir );
	if ( ! file_exists( $root . '/.htaccess' ) ) {
		file_put_contents( $root . '/.htaccess', "Require all denied\nDeny from all\n" ); // phpcs:ignore
	}
	foreach ( array( $root, $dir ) as $d ) {
		if ( ! file_exists( $d . '/index.php' ) ) {
			file_put_contents( $d . '/index.php', '<?php // Silence.' ); // phpcs:ignore
		}
	}
	return $dir;
}

/** Save an uploaded CV; returns array(file, name, type) or WP_Error. */
function wt_cv_save( $f ) {
	if ( $f['size'] > 5 * MB_IN_BYTES ) {
		return new WP_Error( 'wt_cv', 'The CV is too large. Please use a file under 5 MB.', array( 'status' => 400 ) );
	}
	$ok   = array(
		'pdf'      => 'application/pdf',
		'doc'      => 'application/msword',
		'docx'     => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'jpg|jpeg' => 'image/jpeg',
		'png'      => 'image/png',
	);
	$type = wp_check_filetype_and_ext( $f['tmp_name'], $f['name'], $ok );
	if ( empty( $type['ext'] ) || empty( $type['type'] ) ) {
		return new WP_Error( 'wt_cv', 'The CV must be a PDF, Word file or photo (JPG/PNG).', array( 'status' => 400 ) );
	}
	$file = bin2hex( random_bytes( 16 ) ) . '.' . $type['ext'];
	$dest = wt_cv_dir() . '/' . $file;
	if ( ! @move_uploaded_file( $f['tmp_name'], $dest ) ) { // phpcs:ignore
		return new WP_Error( 'wt_cv', 'Could not save the CV. Please try again.', array( 'status' => 500 ) );
	}
	return array(
		'file' => $file,
		'name' => mb_substr( sanitize_file_name( $f['name'] ), 0, 120 ),
		'type' => $type['type'],
	);
}

/* ---------- apply ---------- */

function wt_api_job_apply( WP_REST_Request $r ) {
	$in = array_merge( (array) $r->get_body_params(), (array) $r->get_json_params() );
	if ( ! empty( $in['website'] ) ) { // honeypot
		return array( 'ok' => true, 'ref' => 'JA-OK' );
	}
	$job = wt_job( sanitize_key( $in['job'] ?? '' ) );
	if ( ! $job || 'open' !== $job['status'] || ( ! empty( $job['until'] ) && $job['until'] < wt_today() ) ) {
		return wt_err( 'This job is no longer open.' );
	}
	$name  = mb_substr( sanitize_text_field( (string) ( $in['name'] ?? '' ) ), 0, 80 );
	$phone = wt_phone( $in['phone'] ?? '' );
	$email = sanitize_email( $in['email'] ?? '' );
	if ( mb_strlen( $name ) < 2 ) {
		return wt_err( 'Enter your full name.' );
	}
	if ( ! wt_valid_mobile( $phone ) ) {
		return wt_err( 'Enter a valid 10-digit mobile number.' );
	}
	if ( '' !== (string) ( $in['email'] ?? '' ) && ! is_email( $email ) ) {
		return wt_err( 'The email address looks wrong.' );
	}
	$ip = function_exists( 'wt_otp_ip' ) ? wt_otp_ip() : '';
	if ( ! wt_rate_ok( 'jobapp_' . $ip, 8, HOUR_IN_SECONDS ) || ! wt_rate_ok( 'jobapp_p_' . $phone, 5, DAY_IN_SECONDS ) ) {
		return wt_err( 'Too many applications. Please try again later.' );
	}
	foreach ( wt_rec_list( 'jobapp', array( 'phone' => $phone ), 'id DESC', 20 ) as $old ) {
		if ( ( $old['job'] ?? '' ) === $job['id'] && 'Rejected' !== ( $old['status'] ?? '' ) ) {
			return wt_err( 'You have already applied for this job. We will contact you on ' . $phone . '.' );
		}
	}
	$cv    = null;
	$files = $r->get_file_params();
	if ( ! empty( $files['cv'] ) && empty( $files['cv']['error'] ) ) {
		$cv = wt_cv_save( $files['cv'] );
		if ( is_wp_error( $cv ) ) {
			return $cv;
		}
	} elseif ( ! empty( $job['cvRequired'] ) ) {
		return wt_err( 'Please attach your CV.' );
	}
	$s   = function ( $k, $n ) use ( $in ) {
		return mb_substr( sanitize_textarea_field( (string) ( $in[ $k ] ?? '' ) ), 0, $n );
	};
	$rec = wt_rec_insert(
		'jobapp',
		array(
			'job'        => $job['id'],
			'jobTitle'   => $job['title'],
			'jobCity'    => $job['city'],
			'name'       => $name,
			'phone'      => $phone,
			'email'      => $email,
			'city'       => mb_substr( sanitize_text_field( (string) ( $in['city'] ?? '' ) ), 0, 60 ),
			'experience' => $s( 'experience', 60 ),
			'current'    => $s( 'current', 120 ),
			'notice'     => $s( 'notice', 60 ),
			'expected'   => $s( 'expected', 60 ),
			'about'      => $s( 'about', 1500 ),
			'cv'         => $cv,
			'status'     => 'New',
			'note'       => '',
			'created'    => wt_now_label(),
		),
		'JA'
	);
	$ref = is_array( $rec ) ? ( $rec['id'] ?? '' ) : (string) $rec;
	// Tell the team.
	$text = sprintf( "New job application %s\nJob: %s (%s)\nName: %s\nPhone: %s\nExperience: %s%s", $ref, $job['title'], wt_job_place( $job ), $name, $phone, $s( 'experience', 60 ) ? $s( 'experience', 60 ) : '-', $cv ? "\nCV attached" : '' );
	$set = wt_config()['settings'];
	wt_email( $set['notifyEmail'] ? $set['notifyEmail'] : get_option( 'admin_email' ), 'New job application: ' . $job['title'] . ' – ' . $name, $text . "\n\nSee it in Admin panel → Careers → Applications." );
	if ( $set['notifyWhatsApp'] && ! empty( $set['waTemplates']['job_application_admin'] ) ) {
		wt_whatsapp( $set['notifyWhatsApp'], 'job_application_admin', array( $job['title'], $name, $phone ), $text );
	}
	if ( $email ) {
		wt_email( $email, 'We received your application – Wag & Tails', "Hi " . wt_first( $name ) . ",\n\nThank you for applying for " . $job['title'] . " at Wag & Tails. Your application ID is " . $ref . ".\n\nOur team will review it and contact you on " . $phone . " if your profile matches.\n\n– Team Wag & Tails" );
	}
	return array( 'ok' => true, 'ref' => $ref );
}

/* ---------- admin ---------- */

function wt_api_admin_jobs() {
	$counts = array();
	foreach ( wt_rec_list( 'jobapp', array(), 'id DESC', 5000 ) as $a ) {
		$k = $a['job'] ?? '';
		if ( ! isset( $counts[ $k ] ) ) {
			$counts[ $k ] = array( 'all' => 0, 'new' => 0 );
		}
		++$counts[ $k ]['all'];
		if ( 'New' === ( $a['status'] ?? '' ) ) {
			++$counts[ $k ]['new'];
		}
	}
	$jobs = wt_jobs();
	foreach ( $jobs as &$j ) {
		$j['place'] = wt_job_place( $j );
		$j['apps']  = $counts[ $j['id'] ]['all'] ?? 0;
		$j['new']   = $counts[ $j['id'] ]['new'] ?? 0;
	}
	unset( $j );
	return array( 'jobs' => $jobs, 'types' => WT_JOB_TYPES, 'statuses' => WT_APP_STATUSES );
}

/** Add, edit, open/close or delete one job. */
function wt_api_admin_job_save( $in ) {
	$jobs = wt_jobs();
	$id   = sanitize_key( $in['id'] ?? '' );
	if ( ! empty( $in['delete'] ) ) {
		$jobs = array_values( array_filter( $jobs, function ( $j ) use ( $id ) { return $j['id'] !== $id; } ) ); // phpcs:ignore
		update_option( 'wt_jobs', $jobs, false );
		return wt_api_admin_jobs();
	}
	$title = mb_substr( sanitize_text_field( (string) ( $in['title'] ?? '' ) ), 0, 100 );
	if ( mb_strlen( $title ) < 3 ) {
		return wt_err( 'Enter the job title.' );
	}
	$city = sanitize_text_field( (string) ( $in['city'] ?? 'any' ) );
	if ( 'any' !== $city && 'other' !== $city && ! wt_city( $city ) ) {
		$city = 'any';
	}
	$until = (string) ( $in['until'] ?? '' );
	$job   = array(
		'id'         => $id ? $id : 'job' . strtolower( wp_generate_password( 6, false ) ),
		'title'      => $title,
		'city'       => $city,
		'place'      => 'other' === $city ? mb_substr( sanitize_text_field( (string) ( $in['place'] ?? '' ) ), 0, 80 ) : '',
		'type'       => in_array( $in['type'] ?? '', WT_JOB_TYPES, true ) ? $in['type'] : 'Full-time',
		'salary'     => mb_substr( sanitize_text_field( (string) ( $in['salary'] ?? '' ) ), 0, 80 ),
		'experience' => mb_substr( sanitize_text_field( (string) ( $in['experience'] ?? '' ) ), 0, 80 ),
		'openings'   => max( 1, min( 500, (int) ( $in['openings'] ?? 1 ) ) ),
		'desc'       => mb_substr( sanitize_textarea_field( (string) ( $in['desc'] ?? '' ) ), 0, 5000 ),
		'reqs'       => mb_substr( sanitize_textarea_field( (string) ( $in['reqs'] ?? '' ) ), 0, 3000 ),
		'until'      => preg_match( '/^\d{4}-\d{2}-\d{2}$/', $until ) ? $until : '',
		'cvRequired' => ! empty( $in['cvRequired'] ),
		'status'     => 'closed' === ( $in['status'] ?? '' ) ? 'closed' : 'open',
	);
	if ( 'other' === $city && '' === $job['place'] ) {
		return wt_err( 'Type the job location.' );
	}
	$found = false;
	foreach ( $jobs as $i => $j ) {
		if ( $j['id'] === $job['id'] ) {
			$job['posted'] = $j['posted'];
			$jobs[ $i ]    = $job;
			$found         = true;
		}
	}
	if ( ! $found ) {
		$job['posted'] = wt_today();
		$jobs[]        = $job;
	}
	update_option( 'wt_jobs', $jobs, false );
	return wt_api_admin_jobs();
}

function wt_app_rows( $in ) {
	$where = array();
	$job   = sanitize_key( $in['job'] ?? '' );
	if ( $job && 'all' !== $job ) {
		$where['job'] = $job;
	}
	$status = sanitize_text_field( $in['status'] ?? 'all' );
	if ( in_array( $status, WT_APP_STATUSES, true ) ) {
		$where['status'] = $status;
	}
	$list = wt_rec_list( 'jobapp', $where, 'id DESC', 3000 );
	$q    = mb_strtolower( trim( sanitize_text_field( (string) ( $in['q'] ?? '' ) ) ) );
	if ( '' !== $q ) {
		$list = array_values(
			array_filter(
				$list,
				function ( $a ) use ( $q ) {
					return false !== mb_strpos( mb_strtolower( ( $a['name'] ?? '' ) . ' ' . ( $a['phone'] ?? '' ) . ' ' . ( $a['city'] ?? '' ) . ' ' . ( $a['id'] ?? '' ) ), $q );
				}
			)
		);
	}
	return $list;
}

function wt_api_admin_apps( $in ) {
	$list = wt_app_rows( $in );
	if ( 'csv' === ( $in['format'] ?? '' ) ) {
		$out = array_map(
			function ( $a ) {
				return array( $a['id'], $a['created'] ?? '', $a['jobTitle'] ?? '', wt_job_place( array( 'city' => $a['jobCity'] ?? '', 'place' => '' ) ), $a['name'] ?? '', $a['phone'] ?? '', $a['email'] ?? '', $a['city'] ?? '', $a['experience'] ?? '', $a['current'] ?? '', $a['notice'] ?? '', $a['expected'] ?? '', $a['about'] ?? '', ! empty( $a['cv'] ) ? 'Yes' : 'No', $a['status'] ?? '', $a['note'] ?? '', $a['updatedBy'] ?? '' );
			},
			$list
		);
		wt_csv_send( 'job-applications-' . wp_date( 'Y-m-d' ) . '.csv', array( 'Application ID', 'Applied on', 'Job', 'Job location', 'Name', 'Phone', 'Email', 'Lives in', 'Experience', 'Current / last job', 'Notice period', 'Expected salary', 'About', 'CV', 'Status', 'Team note', 'Updated by' ), $out );
	}
	foreach ( $list as &$a ) {
		$a['hasCv']  = ! empty( $a['cv'] );
		$a['cvName'] = $a['cv']['name'] ?? '';
		unset( $a['cv'] );
	}
	unset( $a );
	return array( 'list' => $list );
}

function wt_api_admin_app_update( $in ) {
	$a = wt_rec_get( 'jobapp', sanitize_text_field( $in['ref'] ?? '' ) );
	if ( ! $a ) {
		return wt_err( 'Application not found.', 'wt_404', 404 );
	}
	if ( ! empty( $in['delete'] ) ) {
		if ( ! empty( $a['cv']['file'] ) ) {
			@unlink( wt_cv_dir() . '/' . basename( $a['cv']['file'] ) ); // phpcs:ignore
		}
		wt_rec_delete( 'jobapp', $a['id'] );
		return array( 'ok' => true );
	}
	if ( isset( $in['status'] ) && in_array( $in['status'], WT_APP_STATUSES, true ) ) {
		$a['status'] = $in['status'];
	}
	if ( isset( $in['note'] ) ) {
		$a['note'] = mb_substr( sanitize_textarea_field( (string) $in['note'] ), 0, 1000 );
	}
	$a['updatedBy'] = wt_desk_name();
	$a['updatedAt'] = wt_now_label();
	wt_rec_save( 'jobapp', $a );
	return array( 'ok' => true, 'app' => $a );
}

/** Stream a CV to a logged-in admin. */
function wt_api_admin_app_cv( WP_REST_Request $r ) {
	$a = wt_rec_get( 'jobapp', sanitize_text_field( $r['ref'] ) );
	if ( ! $a || empty( $a['cv']['file'] ) ) {
		return wt_err( 'No CV for this application.', 'wt_404', 404 );
	}
	$path = wt_cv_dir() . '/' . basename( $a['cv']['file'] );
	if ( ! is_readable( $path ) ) {
		return wt_err( 'The CV file is missing.', 'wt_404', 404 );
	}
	$name = preg_replace( '/[^A-Za-z0-9._-]+/', '-', $a['name'] ) . '-CV.' . pathinfo( $path, PATHINFO_EXTENSION );
	nocache_headers();
	header( 'Content-Type: ' . ( $a['cv']['type'] ?? 'application/octet-stream' ) );
	header( 'Content-Disposition: ' . ( ! empty( $r['dl'] ) ? 'attachment' : 'inline' ) . '; filename="' . $name . '"' );
	header( 'Content-Length: ' . filesize( $path ) );
	header( 'X-Content-Type-Options: nosniff' );
	readfile( $path ); // phpcs:ignore
	exit;
}

add_action(
	'rest_api_init',
	function () {
		$routes = array(
			array( 'GET', '/careers', '__return_true', wt_rest( 'wt_api_jobs' ) ),
			array( 'POST', '/careers/apply', '__return_true', 'wt_api_job_apply' ),
			array( 'GET', '/admin/careers', 'wt_can_admin', wt_rest( 'wt_api_admin_jobs' ) ),
			array( 'POST', '/admin/careers', 'wt_can_admin', wt_rest( 'wt_api_admin_job_save' ) ),
			array( 'GET', '/admin/careers/apps', 'wt_can_admin', wt_rest( 'wt_api_admin_apps' ) ),
			array( 'POST', '/admin/careers/apps/(?P<ref>[A-Za-z0-9-]+)', 'wt_can_admin', wt_rest( 'wt_api_admin_app_update' ) ),
			array( 'GET', '/admin/careers/apps/(?P<ref>[A-Za-z0-9-]+)/cv', 'wt_can_admin', 'wt_api_admin_app_cv' ),
		);
		foreach ( $routes as $r ) {
			register_rest_route(
				'wt/v1',
				$r[1],
				array(
					'methods'             => $r[0],
					'permission_callback' => $r[2],
					'callback'            => $r[3],
				)
			);
		}
	}
);

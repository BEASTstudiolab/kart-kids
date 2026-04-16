import { CELL_RAW } from './TrackConstants.js';
import { STRAIGHT_EXIT_MASKS } from './TrackOrientation.js';

export const BOOST_LAYOUTS = Object.freeze( [ 'center', 'left', 'right', 'split' ] );
export const BOOST_LATERAL_OFFSET = CELL_RAW * 0.31;
export const BOOST_PAD_HALF_WIDTH = 1.35;
export const BOOST_PAD_HALF_LENGTH = 2.0;

const TRACK_INTEL_ACCEPT_DIST_SQ = Math.pow( CELL_RAW * 1.25, 2 );

function normalizeVector( x, z, fallback = { x: 1, z: 0 } ) {

	const length = Math.hypot( x, z );
	if ( length <= 1e-6 ) return { ...fallback };
	return { x: x / length, z: z / length };

}

export function getFallbackBoostForward( cellType, orient ) {

	if ( typeof cellType === 'string' && cellType.startsWith( 'trk-corner' ) ) return { x: 0, z: 1 };
	const exitMask = STRAIGHT_EXIT_MASKS[ orient ] ?? 12;
	return exitMask === 3 ? { x: 1, z: 0 } : { x: 0, z: 1 };

}

function resolveTrackIntelForward( trackIntel, centerX, centerZ ) {

	if ( ! trackIntel?.valid || trackIntel.count <= 0 ) return null;

	const waypointIndex = trackIntel.getNearestWaypoint( centerX, centerZ );
	const sample = trackIntel.getWaypointInfo( waypointIndex );
	if ( ! sample?.forward || ! sample?.position ) return null;

	const dx = sample.position.x - centerX;
	const dz = sample.position.z - centerZ;
	if ( dx * dx + dz * dz > TRACK_INTEL_ACCEPT_DIST_SQ ) return null;

	return normalizeVector( sample.forward.x, sample.forward.z );

}

function getLayoutOffsets( layout ) {

	if ( layout === 'left' ) return [ BOOST_LATERAL_OFFSET ];
	if ( layout === 'right' ) return [ - BOOST_LATERAL_OFFSET ];
	if ( layout === 'split' ) return [ BOOST_LATERAL_OFFSET, - BOOST_LATERAL_OFFSET ];
	return [ 0 ];

}

export function resolveBoostPadPlacement( {
	gx,
	gz,
	layout = BOOST_LAYOUTS[ 0 ],
	trackIntel = null,
	cellType = 'trk-straight',
	orient = 0,
} ) {

	const centerX = ( gx + 0.5 ) * CELL_RAW;
	const centerZ = ( gz + 0.5 ) * CELL_RAW;
	const fallback = getFallbackBoostForward( cellType, orient );
	const forward = resolveTrackIntelForward( trackIntel, centerX, centerZ ) ?? fallback;
	const normalizedForward = normalizeVector( forward.x, forward.z, fallback );
	const left = { x: normalizedForward.z, z: - normalizedForward.x };
	const rotationY = Math.atan2( normalizedForward.x, normalizedForward.z );
	const padCenters = getLayoutOffsets( layout ).map( ( offset ) => ( {
		x: centerX + left.x * offset,
		z: centerZ + left.z * offset,
	} ) );

	return {
		centerX,
		centerZ,
		forward: normalizedForward,
		left,
		layout,
		rotationY,
		padCenters,
	};

}

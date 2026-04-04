import * as THREE from 'three';
import { getTrackModelConfig } from './TrackModelConfig.js';
import { getCurveConfig, getCurveLR } from './TileMetadata.js';

export const ORIENT_DEG = { 0: 0, 10: 180, 16: 90, 22: 270 };

export const CELL_RAW = 10.0;
export const GRID_SCALE = 1.0; // was 0.75 — temporarily disabled for testing

const _dummy = new THREE.Object3D();
const _childMat = new THREE.Matrix4();
const _combinedMat = new THREE.Matrix4();

export const TRACK_CELLS = [
	[ -3, -3, 'track-corner-night',   16 ],
	[ -2, -3, 'track-straight-night', 22 ],
	[ -1, -3, 'track-straight-night', 22 ],
	[  0, -3, 'track-corner-night',    0 ],
	[ -3, -2, 'track-straight-night',  0 ],
	[  0, -2, 'track-straight-night',  0 ],
	[ -3, -1, 'track-corner-night',   10 ],
	[ -2, -1, 'track-corner-night',    0 ],
	[  0, -1, 'track-straight-night',  0 ],
	[ -2,  0, 'track-straight-night', 10 ],
	[  0,  0, 'track-finish',    0 ],
	[ -2,  1, 'track-straight-night', 10 ],
	[  0,  1, 'track-straight-night',  0 ],
	[ -2,  2, 'track-corner-night',   10 ],
	[ -1,  2, 'track-straight-night', 16 ],
	[  0,  2, 'track-corner-night',   22 ],
];

const DECO_CELLS = [
	[ -4, -2, 'decoration-tents', 10 ],
	[ -1, -4, 'decoration-tents', 22 ],
	[ -1,  1, 'decoration-tents', 22 ],
	[ -8, -9, 'decoration-buildings-1', 0 ], [ -7, -9, 'decoration-buildings-2', 0 ],
	[ -6, -9, 'decoration-buildings-1', 0 ], [ -5, -9, 'decoration-buildings-2', 0 ],
	[ -4, -9, 'decoration-buildings-1', 0 ], [ -3, -9, 'decoration-buildings-2', 0 ],
	[ -2, -9, 'decoration-buildings-1', 0 ], [ -1, -9, 'decoration-buildings-2', 0 ],
	[  0, -9, 'decoration-buildings-1', 0 ], [  1, -9, 'decoration-buildings-2', 0 ],
	[  2, -9, 'decoration-buildings-1', 0 ],
	[ -8, -8, 'decoration-buildings-2', 0 ], [ -7, -8, 'decoration-buildings-1', 0 ],
	[ -6, -8, 'decoration-buildings-2', 0 ], [ -5, -8, 'decoration-buildings-1', 0 ],
	[ -4, -8, 'decoration-buildings-2', 0 ], [ -3, -8, 'decoration-buildings-1', 0 ],
	[ -2, -8, 'decoration-buildings-2', 0 ], [ -1, -8, 'decoration-buildings-1', 0 ],
	[  0, -8, 'decoration-buildings-2', 0 ], [  1, -8, 'decoration-buildings-1', 0 ],
	[  2, -8, 'decoration-buildings-2', 0 ],
	[ -8, -7, 'decoration-buildings-1', 0 ], [ -7, -7, 'decoration-buildings-2', 0 ],
	[ -6, -7, 'decoration-buildings-1', 0 ], [ -5, -7, 'decoration-buildings-2', 0 ],
	[ -4, -7, 'decoration-buildings-1', 0 ], [ -3, -7, 'decoration-buildings-2', 0 ],
	[ -2, -7, 'decoration-buildings-1', 0 ], [ -1, -7, 'decoration-buildings-2', 0 ],
	[  0, -7, 'decoration-buildings-1', 0 ], [  1, -7, 'decoration-buildings-2', 0 ],
	[  2, -7, 'decoration-buildings-1', 0 ],
	[ -8, -6, 'decoration-buildings-2', 0 ], [ -7, -6, 'decoration-buildings-1', 0 ],
	[ -6, -6, 'decoration-buildings-2', 0 ], [ -5, -6, 'decoration-buildings-1', 0 ],
	[ -4, -6, 'decoration-buildings-2', 0 ], [ -3, -6, 'decoration-empty-night', 0 ],
	[ -2, -6, 'decoration-empty-night', 0 ],  [ -1, -6, 'decoration-empty-night', 0 ],
	[  0, -6, 'decoration-empty-night', 0 ],  [  1, -6, 'decoration-buildings-1', 0 ],
	[  2, -6, 'decoration-buildings-2', 0 ],
	[ -8, -5, 'decoration-buildings-1', 0 ], [ -7, -5, 'decoration-buildings-2', 0 ],
	[ -6, -5, 'decoration-buildings-1', 0 ], [ -5, -5, 'decoration-buildings-2', 0 ],
	[ -4, -5, 'decoration-empty-night', 0 ],  [ -3, -5, 'decoration-empty-night', 0 ],
	[ -2, -5, 'decoration-empty-night', 0 ],  [ -1, -5, 'decoration-empty-night', 0 ],
	[  0, -5, 'decoration-empty-night', 0 ],  [  1, -5, 'decoration-buildings-1', 0 ],
	[  2, -5, 'decoration-buildings-2', 0 ],
	[ -8, -4, 'decoration-buildings-1', 0 ], [ -7, -4, 'decoration-buildings-2', 0 ],
	[ -6, -4, 'decoration-buildings-1', 0 ], [ -5, -4, 'decoration-buildings-2', 0 ],
	[ -4, -4, 'decoration-empty-night', 0 ],
	[  1, -4, 'decoration-buildings-1', 0 ],
	[  2, -4, 'decoration-buildings-2', 0 ],
	[ -8, -3, 'decoration-buildings-2', 0 ], [ -7, -3, 'decoration-buildings-1', 0 ],
	[ -6, -3, 'decoration-buildings-2', 0 ], [ -5, -3, 'decoration-buildings-1', 0 ],
	[ -4, -3, 'decoration-empty-night', 0 ],
	[  1, -3, 'decoration-buildings-2', 0 ],
	[  2, -3, 'decoration-buildings-1', 0 ],
	[ -8, -2, 'decoration-buildings-1', 0 ], [ -7, -2, 'decoration-buildings-2', 0 ],
	[ -6, -2, 'decoration-buildings-1', 0 ], [ -5, -2, 'decoration-buildings-2', 0 ],
	[  1, -2, 'decoration-buildings-1', 0 ],
	[  2, -2, 'decoration-buildings-2', 0 ],
	[ -8, -1, 'decoration-buildings-2', 0 ], [ -7, -1, 'decoration-buildings-1', 0 ],
	[ -6, -1, 'decoration-buildings-2', 0 ], [ -5, -1, 'decoration-buildings-1', 0 ],
	[ -4, -1, 'decoration-empty-night', 0 ],  [ -1, -1, 'decoration-empty-night', 0 ],
	[  1, -1, 'decoration-buildings-2', 0 ],
	[  2, -1, 'decoration-buildings-1', 0 ],
	[ -8,  0, 'decoration-buildings-1', 0 ], [ -7,  0, 'decoration-buildings-2', 0 ],
	[ -6,  0, 'decoration-buildings-1', 0 ], [ -5,  0, 'decoration-buildings-2', 0 ],
	[ -4,  0, 'decoration-empty-night', 0 ],  [ -3,  0, 'decoration-empty-night', 0 ],
	[ -1,  0, 'decoration-empty-night', 0 ],
	[  1,  0, 'decoration-buildings-1', 0 ],
	[  2,  0, 'decoration-buildings-2', 0 ],
	[ -8,  1, 'decoration-buildings-2', 0 ], [ -7,  1, 'decoration-buildings-1', 0 ],
	[ -6,  1, 'decoration-buildings-2', 0 ], [ -5,  1, 'decoration-buildings-1', 0 ],
	[ -4,  1, 'decoration-empty-night', 0 ],  [ -3,  1, 'decoration-empty-night', 0 ],
	[  1,  1, 'decoration-buildings-2', 0 ],
	[  2,  1, 'decoration-buildings-1', 0 ],
	[ -8,  2, 'decoration-buildings-1', 0 ], [ -7,  2, 'decoration-buildings-2', 0 ],
	[ -6,  2, 'decoration-buildings-1', 0 ], [ -5,  2, 'decoration-buildings-2', 0 ],
	[ -4,  2, 'decoration-empty-night', 0 ],  [ -3,  2, 'decoration-empty-night', 0 ],
	[  1,  2, 'decoration-buildings-1', 0 ],
	[  2,  2, 'decoration-buildings-2', 0 ],
	[ -8,  3, 'decoration-buildings-2', 0 ], [ -7,  3, 'decoration-buildings-1', 0 ],
	[ -6,  3, 'decoration-buildings-2', 0 ], [ -5,  3, 'decoration-buildings-1', 0 ],
	[ -4,  3, 'decoration-buildings-2', 0 ], [ -3,  3, 'decoration-buildings-1', 0 ],
	[ -2,  3, 'decoration-buildings-2', 0 ], [ -1,  3, 'decoration-buildings-1', 0 ],
	[  0,  3, 'decoration-buildings-2', 0 ], [  1,  3, 'decoration-buildings-1', 0 ],
	[  2,  3, 'decoration-buildings-2', 0 ],
	[ -8,  4, 'decoration-buildings-1', 0 ], [ -7,  4, 'decoration-buildings-2', 0 ],
	[ -6,  4, 'decoration-buildings-1', 0 ], [ -5,  4, 'decoration-buildings-2', 0 ],
	[ -4,  4, 'decoration-buildings-1', 0 ], [ -3,  4, 'decoration-buildings-2', 0 ],
	[ -2,  4, 'decoration-buildings-1', 0 ], [ -1,  4, 'decoration-buildings-2', 0 ],
	[  0,  4, 'decoration-buildings-1', 0 ], [  1,  4, 'decoration-buildings-2', 0 ],
	[  2,  4, 'decoration-buildings-1', 0 ],
];


export function buildTrack( scene, models, customCells ) {

	const trackGroup = new THREE.Group();
	trackGroup.position.y = -0.5;

	const trackPieceGroup = new THREE.Group();
	const decoGroup = new THREE.Group();

	const cells = customCells || TRACK_CELLS;

	// Group track cells by tile type for instancing
	const cellsByType = {};

	for ( const [ gx, gz, key, orient, flags ] of cells ) {

		if ( ! cellsByType[ key ] ) cellsByType[ key ] = [];
		cellsByType[ key ].push( [ gx, gz, orient, flags ] );

	}

	// Separate multi-tile curves from instanced tiles
	const curveEntries = []; // [ { key, gx, gz, orient, flags } ]

	for ( const key in cellsByType ) {

		if ( key.startsWith( 'track-curve-' ) ) {

			// Multi-tile curves use individual meshes (too few per track for instancing)
			for ( const [ gx, gz, orient, flags ] of cellsByType[ key ] ) {

				const curveSize = parseInt( key.match( /(\d+)x\d+/ )?.[ 1 ] ) || 3;
				curveEntries.push( { key, gx, gz, orient, flags, curveSize } );

			}

			continue;

		}

		const src = models[ key ];
		if ( ! src ) continue;

		const entries = cellsByType[ key ];
		const count = entries.length;

		// Update world matrices so child.matrixWorld includes wrapper corrections
		src.updateMatrixWorld( true );
		const srcInverse = src.matrixWorld.clone().invert();

		src.traverse( ( child ) => {

			if ( ! child.isMesh ) return;

			// Full relative matrix: includes wrapper correction rotation + mesh local position
			_childMat.copy( child.matrixWorld ).premultiply( srcInverse );

			const inst = new THREE.InstancedMesh( child.geometry, child.material, count );
			inst.castShadow = false;
			inst.receiveShadow = true;

			for ( let i = 0; i < count; i ++ ) {

				const [ gx, gz, orient, flags ] = entries[ i ];
				const deg = ORIENT_DEG[ orient ] ?? 0;

				// Elevation Y is baked into GLB geometry (elev models at z2p5/z5, ramps slope from 0)
				// No manual Y offset needed
				_dummy.position.set( ( gx + 0.5 ) * CELL_RAW, 0.5, ( gz + 0.5 ) * CELL_RAW );
				_dummy.rotation.set( 0, THREE.MathUtils.degToRad( deg ), 0 );
				_dummy.updateMatrix();

				// Compose: placement × child correction
				_combinedMat.multiplyMatrices( _dummy.matrix, _childMat );
				inst.setMatrixAt( i, _combinedMat );

			}

			trackPieceGroup.add( inst );

		} );

	}

	// Place multi-tile curve meshes individually
	for ( const entry of curveEntries ) {

		const src = models[ entry.key ];
		if ( ! src ) continue;

		const curveMesh = src.clone();

		// Use verified tile metadata for position + rotation
		const lr = entry.key.includes( '-l' ) ? 'l' : 'r';
		const curveConfig = getCurveConfig( entry.orient, lr, entry.curveSize || 3 );

		curveMesh.position.set(
			( entry.gx + 0.5 ) * CELL_RAW + curveConfig.offset.x,
			0.5,
			( entry.gz + 0.5 ) * CELL_RAW + curveConfig.offset.z
		);
		curveMesh.rotation.y = curveConfig.rotation;

		curveMesh.traverse( ( c ) => {

			if ( c.isMesh ) {

				c.castShadow = false;
				c.receiveShadow = true;

			}

		} );

		trackPieceGroup.add( curveMesh );

	}

	if ( ! customCells ) {

		// Place hand-authored decorations for the default track
		for ( const [ gx, gz, key, orient ] of DECO_CELLS ) {

			const piece = placePiece( models, key, gx, gz, orient );
			if ( piece ) decoGroup.add( piece );

		}

	}

	{

		// Auto-generate decorations to fill any gaps
		const occupied = new Set();
		let minX = Infinity, maxX = - Infinity;
		let minZ = Infinity, maxZ = - Infinity;

		for ( const [ gx, gz ] of cells ) {

			occupied.add( gx + ',' + gz );
			minX = Math.min( minX, gx );
			maxX = Math.max( maxX, gx );
			minZ = Math.min( minZ, gz );
			maxZ = Math.max( maxZ, gz );

		}

		// Also mark existing decoration cells as occupied
		if ( ! customCells ) {

			for ( const [ gx, gz ] of DECO_CELLS ) {

				occupied.add( gx + ',' + gz );
				minX = Math.min( minX, gx );
				maxX = Math.max( maxX, gx );
				minZ = Math.min( minZ, gz );
				maxZ = Math.max( maxZ, gz );

			}

		}

		const pad = 3;
		const emptyPositions = [];
		const buildingPositions1 = [];
		const buildingPositions2 = [];
		const tentPositions = [];

		// Simple hash for deterministic pseudo-random placement
		function hash( gx, gz ) {

			let h = gx * 374761393 + gz * 668265263;
			h = ( h ^ ( h >> 13 ) ) * 1274126177;
			return ( h ^ ( h >> 16 ) ) >>> 0;

		}

		for ( let gz = minZ - pad; gz <= maxZ + pad; gz ++ ) {

			for ( let gx = minX - pad; gx <= maxX + pad; gx ++ ) {

				if ( occupied.has( gx + ',' + gz ) ) continue;

				const distX = gx < minX ? minX - gx : gx > maxX ? gx - maxX : 0;
				const distZ = gz < minZ ? minZ - gz : gz > maxZ ? gz - maxZ : 0;
				const dist = Math.max( distX, distZ );

				const x = ( gx + 0.5 ) * CELL_RAW;
				const z = ( gz + 0.5 ) * CELL_RAW;

				if ( dist <= 1 ) {

					// ~15% chance of tents in the empty ring
					if ( hash( gx, gz ) % 7 === 0 ) {

						tentPositions.push( x, z, hash( gx, gz ) % 4 );

					} else {

						emptyPositions.push( x, z );

					}

				} else {

					if ( hash( gx, gz ) % 2 === 0 ) {

						buildingPositions1.push( x, z );

					} else {

						buildingPositions2.push( x, z );

					}

				}

			}

		}

		function createInstances( src, positions ) {

			if ( positions.length === 0 || ! src ) return;

			const count = positions.length / 2;

			src.traverse( ( child ) => {

				if ( ! child.isMesh ) return;

				const inst = new THREE.InstancedMesh( child.geometry, child.material, count );
				inst.castShadow = false;
				inst.receiveShadow = true;

				for ( let i = 0; i < count; i ++ ) {

					_dummy.position.set( positions[ i * 2 ], 0.5, positions[ i * 2 + 1 ] );
					_dummy.rotation.set( 0, 0, 0 );
					_dummy.updateMatrix();
					inst.setMatrixAt( i, _dummy.matrix );

				}

				decoGroup.add( inst );

			} );

		}

		createInstances( models[ 'decoration-empty-night' ], emptyPositions );
		createInstances( models[ 'decoration-buildings-1' ], buildingPositions1 );
		createInstances( models[ 'decoration-buildings-2' ], buildingPositions2 );

		// Place tents with random rotations
		const tentSrc = models[ 'decoration-tents' ];

		if ( tentSrc && tentPositions.length > 0 ) {

			const tentCount = tentPositions.length / 3;

			tentSrc.traverse( ( child ) => {

				if ( ! child.isMesh ) return;

				const inst = new THREE.InstancedMesh( child.geometry, child.material, tentCount );
				inst.castShadow = false;
				inst.receiveShadow = true;

				for ( let i = 0; i < tentCount; i ++ ) {

					_dummy.position.set( tentPositions[ i * 3 ], 0.5, tentPositions[ i * 3 + 1 ] );
					_dummy.rotation.y = tentPositions[ i * 3 + 2 ] * Math.PI / 2;
					_dummy.updateMatrix();
					inst.setMatrixAt( i, _dummy.matrix );

				}

				decoGroup.add( inst );

			} );

		}

	}

	trackGroup.add( trackPieceGroup );
	trackGroup.add( decoGroup );

	trackGroup.scale.setScalar( 1.0 ); // was 0.75 — temporarily disabled for testing
	scene.add( trackGroup );

	trackGroup.updateMatrixWorld( true );

	trackGroup.traverse( ( child ) => {

		if ( child.isMesh ) {

			child.castShadow = false;
			child.receiveShadow = true;

		}

	} );


}

export function placePiece( models, key, gx, gz, orient ) {

	const src = models[ key ];
	if ( ! src ) return null;

	const piece = src.clone();
	piece.position.set( ( gx + 0.5 ) * CELL_RAW, 0.5, ( gz + 0.5 ) * CELL_RAW );

	const deg = ORIENT_DEG[ orient ] ?? 0;
	piece.rotation.y = THREE.MathUtils.degToRad( deg );

	return piece;

}

// ─── Track Codec ──────────────────────────────────────────

const TYPE_NAMES = [ 'track-straight-night', 'track-corner-night', 'track-bump', 'track-finish' ];
const TYPE_INDEX = {};
for ( let i = 0; i < TYPE_NAMES.length; i ++ ) TYPE_INDEX[ TYPE_NAMES[ i ] ] = i;

const ORIENT_TO_GODOT = [ 0, 16, 10, 22 ];
const GODOT_TO_ORIENT = { 0: 0, 16: 1, 10: 2, 22: 3 };

export { TYPE_NAMES };

export function encodeCells( cells ) {

	// Filter out autoRamp cells — they are derived from elevated cells at load time
	const filtered = cells.filter( c => ! c[ 4 ]?.autoRamp );

	const bytes = new Uint8Array( filtered.length * 3 );

	for ( let i = 0; i < filtered.length; i ++ ) {

		const [ gx, gz, name, godotOrient, flags ] = filtered[ i ];
		const ti = TYPE_INDEX[ name ] ?? 0;
		const oi = GODOT_TO_ORIENT[ godotOrient ] ?? 0;

		// Pack flags into upper 4 bits of byte 2:
		// bits 4-5: elevLevel (2 bits: 0=ground, 1=2.5m, 2=5m)
		// bit 6: curveOverride (1=force hard corner)
		// bit 7: rotationOverride (1=manual rotation)
		let flagBits = 0;
		if ( flags ) {

			const elev = flags.elevation ?? 0;
			const curve = flags.curveOverride ? 1 : 0;
			const rot = flags.rotationOverride ? 1 : 0;
			flagBits = ( elev & 0x03 ) | ( curve << 2 ) | ( rot << 3 );

		}

		bytes[ i * 3 ] = gx + 128;
		bytes[ i * 3 + 1 ] = gz + 128;
		bytes[ i * 3 + 2 ] = ( flagBits << 4 ) | ( ti << 2 ) | oi;

	}

	return bytesToBase64url( bytes );

}

export function decodeCells( str ) {

	const bytes = base64urlToBytes( str );
	const cells = [];

	for ( let i = 0; i + 2 < bytes.length; i += 3 ) {

		const gx = bytes[ i ] - 128;
		const gz = bytes[ i + 1 ] - 128;
		const packed = bytes[ i + 2 ];
		const ti = ( packed >> 2 ) & 0x03;
		const oi = packed & 0x03;

		// Unpack flags from upper 4 bits
		const flagBits = ( packed >> 4 ) & 0x0F;
		const elevation = flagBits & 0x03;
		const curveOverride = !! ( flagBits & 0x04 );
		const rotationOverride = !! ( flagBits & 0x08 );

		const flags = { elevation, curveOverride, rotationOverride };
		cells.push( [ gx, gz, TYPE_NAMES[ ti ], ORIENT_TO_GODOT[ oi ], flags ] );

	}

	return cells;

}

export function computeSpawnPosition( cells ) {

	let cell = cells[ 0 ];

	for ( const c of cells ) {

		if ( c[ 2 ] === 'track-finish' ) {

			cell = c;
			break;

		}

	}

	if ( ! cell ) return { position: [ 3.5, 0.5, 5 ], angle: 0 };

	const gx = cell[ 0 ];
	const gz = cell[ 1 ];
	const x = ( gx + 0.5 ) * CELL_RAW * GRID_SCALE;
	const z = ( gz + 0.5 ) * CELL_RAW * GRID_SCALE;

	const orient = cell[ 3 ];
	const trackAngle = THREE.MathUtils.degToRad( ORIENT_DEG[ orient ] || 0 );

	// spawnAngle: rotated 180° so the vehicle model (forward = +Z) faces the racing direction
	// finishAngle: the raw track orientation for finish line normal computation
	return { position: [ x, 0.5, z ], angle: trackAngle + Math.PI, finishAngle: trackAngle };

}

export function computeTrackBounds( cells ) {

	if ( ! cells || cells.length === 0 ) return { centerX: 0, centerZ: 0, halfWidth: 30, halfDepth: 30 };

	let minX = Infinity, maxX = - Infinity;
	let minZ = Infinity, maxZ = - Infinity;

	for ( const [ gx, gz ] of cells ) {

		minX = Math.min( minX, gx );
		maxX = Math.max( maxX, gx );
		minZ = Math.min( minZ, gz );
		maxZ = Math.max( maxZ, gz );

	}

	const S = CELL_RAW * GRID_SCALE;
	const centerX = ( minX + maxX + 1 ) / 2 * S;
	const centerZ = ( minZ + maxZ + 1 ) / 2 * S;
	const halfWidth = ( maxX - minX + 1 ) / 2 * S + S;
	const halfDepth = ( maxZ - minZ + 1 ) / 2 * S + S;

	return { centerX, centerZ, halfWidth, halfDepth };

}

// ─── Transform Cells (derive elevation/ramps/curves for rendering) ───

// Orient → exit direction bits (N=8, S=4, E=2, W=1)
const CORNER_EXITS = {
	0: 5,    // S+W
	16: 6,   // S+E
	10: 10,  // N+E
	22: 9,   // N+W
};

const DIR_DELTA = {
	8: [ 0, - 1 ],  // N
	4: [ 0, 1 ],    // S
	2: [ 1, 0 ],    // E
	1: [ - 1, 0 ],  // W
};

// L/R selection now via getCurveLR() from TileMetadata.js

function getRampNeighborKeys( gx, gz, orient ) {

	// After PI/2 base rotation: ramp-up HIGH at -Z/north, ramp-down HIGH at +Z/south.
	// Place ramp-down NORTH (HIGH south edge meets elevated), ramp-up SOUTH (HIGH north edge meets elevated).
	if ( orient === 0 || orient === 10 ) {

		return [
			{ gx, gz: gz - 1, role: 'ramp-down' },
			{ gx, gz: gz + 1, role: 'ramp-up' },
		];

	}

	return [
		{ gx: gx - 1, gz, role: 'ramp-down' },
		{ gx: gx + 1, gz, role: 'ramp-up' },
	];

}

function getElevationModelName( elevation, role ) {

	const suffix = elevation === 1 ? '2p5' : '5';
	if ( role === 'flat' ) return 'track-elev-' + suffix;
	if ( role === 'ramp-up' ) return 'track-ramp-up-' + suffix;
	if ( role === 'ramp-down' ) return 'track-ramp-down-' + suffix;
	return 'track-straight-night';

}

/**
 * Transforms decoded cells into a render-ready array:
 * 1. Derives elevation: replaces elevated cells with visual model names, inserts ramp cells
 * 2. Derives curves: detects multi-tile corners, replaces with curve types, removes consumed cells
 *
 * Returns a new array — does not mutate the input.
 * Each entry: [ gx, gz, visualTypeName, orient, flags ]
 * Multi-tile curves add a `_curveSize` property on the flags object.
 */
export function transformCells( decodedCells ) {

	// Build a mutable working map: key → { gx, gz, type, orient, flags }
	const grid = new Map();

	for ( const cell of decodedCells ) {

		const [ gx, gz, type, orient, flags ] = cell;
		grid.set( gx + ',' + gz, {
			gx, gz,
			type,
			orient,
			flags: flags ? { ...flags } : { elevation: 0, curveOverride: false, rotationOverride: false },
		} );

	}

	// ── Pass 1: Derive elevation & ramps ──────────────────────

	for ( const [ key, cell ] of grid ) {

		const elev = cell.flags.elevation;
		if ( ! elev || elev === 0 ) continue;
		if ( cell.type === 'track-corner-night' || cell.type === 'track-finish' ) continue;

		// Replace elevated cell with visual model
		cell.type = getElevationModelName( elev, 'flat' );

		// Insert ramp neighbors
		const ramps = getRampNeighborKeys( cell.gx, cell.gz, cell.orient );

		for ( const rn of ramps ) {

			const rKey = rn.gx + ',' + rn.gz;
			const rCell = grid.get( rKey );
			if ( ! rCell ) continue;
			if ( rCell.flags.autoRamp ) continue;
			if ( rCell.type !== 'track-straight-night' ) continue;

			rCell.type = getElevationModelName( elev, rn.role );
			// Both ramp GLBs have identical geometry (slope upward). Ramp-down needs 180° flip.
			
			rCell.orient = cell.orient;
			rCell.flags.autoRamp = true;

		}

	}

	// ── Pass 2: Derive curves ─────────────────────────────────

	// Collect all corner candidates
	const candidates = [];

	for ( const [ key, cell ] of grid ) {

		if ( cell.type !== 'track-corner-night' ) continue;
		if ( cell.flags.curveOverride || cell.flags.rotationOverride ) continue;

		const exits = CORNER_EXITS[ cell.orient ];
		if ( exits === undefined ) continue;

		// Extract exit direction bits
		const dirBits = [];
		for ( const bit of [ 8, 4, 2, 1 ] ) {

			if ( exits & bit ) dirBits.push( bit );

		}

		if ( dirBits.length !== 2 ) continue;

		// Walk each exit direction counting consecutive straights
		const walks = [];
		for ( const bit of dirBits ) {

			const [ ddx, ddz ] = DIR_DELTA[ bit ];
			const keys = [];
			let nx = cell.gx + ddx;
			let nz = cell.gz + ddz;

			while ( true ) {

				const nk = nx + ',' + nz;
				const nc = grid.get( nk );
				if ( ! nc ) break;
				if ( nc.type !== 'track-straight-night' ) break;
				keys.push( nk );
				nx += ddx;
				nz += ddz;

			}

			walks.push( { count: keys.length, keys } );

		}

		const curveSize = Math.min( walks[ 0 ].count, walks[ 1 ].count, 3 ); // Cap at 3 — 4x4 GLBs are undersized
		if ( curveSize < 2 ) continue;

		// Collect consumed cell keys (curveSize - 1 straights per arm)
		const consumed = new Set();
		for ( const walk of walks ) {

			for ( let i = 0; i < curveSize - 1; i ++ ) {

				consumed.add( walk.keys[ i ] );

			}

		}

		// Footprint check: verify NxN area is clear
		let fpDx, fpDz;
		if ( cell.orient === 0 ) { fpDx = - 1; fpDz = 1; }
		else if ( cell.orient === 16 ) { fpDx = 1; fpDz = 1; }
		else if ( cell.orient === 10 ) { fpDx = 1; fpDz = - 1; }
		else if ( cell.orient === 22 ) { fpDx = - 1; fpDz = - 1; }
		else continue;

		let footprintClear = true;
		for ( let fx = 0; fx < curveSize && footprintClear; fx ++ ) {

			for ( let fz = 0; fz < curveSize && footprintClear; fz ++ ) {

				if ( fx === 0 && fz === 0 ) continue;
				const fpKey = ( cell.gx + fx * fpDx ) + ',' + ( cell.gz + fz * fpDz );
				if ( grid.has( fpKey ) && ! consumed.has( fpKey ) ) footprintClear = false;

			}

		}

		if ( ! footprintClear ) continue;

		candidates.push( { gx: cell.gx, gz: cell.gz, key, orient: cell.orient, curveSize, consumed } );

	}

	// Sort: largest first, ties by key string
	candidates.sort( ( a, b ) => {

		if ( b.curveSize !== a.curveSize ) return b.curveSize - a.curveSize;
		return a.key < b.key ? - 1 : a.key > b.key ? 1 : 0;

	} );

	// Assign curves, preventing overlap
	const claimed = new Set();
	const curveCorners = new Map(); // key → { curveSize, consumed }

	for ( const cand of candidates ) {

		if ( claimed.has( cand.key ) ) continue;

		let blocked = false;
		for ( const ck of cand.consumed ) {

			if ( claimed.has( ck ) ) { blocked = true; break; }

		}

		if ( blocked ) continue;

		claimed.add( cand.key );
		for ( const ck of cand.consumed ) claimed.add( ck );

		curveCorners.set( cand.key, { curveSize: cand.curveSize, consumed: cand.consumed } );

	}

	// ── Build output array ────────────────────────────────────

	const result = [];
	const consumedKeys = new Set();

	// Gather all consumed keys
	for ( const [ , info ] of curveCorners ) {

		for ( const ck of info.consumed ) consumedKeys.add( ck );

	}

	for ( const [ key, cell ] of grid ) {

		// Skip consumed cells — they're part of a multi-tile curve
		if ( consumedKeys.has( key ) ) continue;

		const curveInfo = curveCorners.get( key );

		if ( curveInfo ) {

			// Replace corner with curve visual type — use lr from getCurveConfig
			const curveConf = getCurveConfig( cell.orient, null, curveInfo.curveSize );
			const lr = curveConf.lr || getCurveLR( cell.orient );
			const visualType = `track-curve-${ curveInfo.curveSize }x${ curveInfo.curveSize }-${ lr }`;
			const flags = { ...cell.flags, _curveSize: curveInfo.curveSize };
			result.push( [ cell.gx, cell.gz, visualType, cell.orient, flags ] );

		} else {

			result.push( [ cell.gx, cell.gz, cell.type, cell.orient, cell.flags ] );

		}

	}

	return result;

}

function bytesToBase64url( bytes ) {

	let binary = '';
	for ( let i = 0; i < bytes.length; i ++ ) binary += String.fromCharCode( bytes[ i ] );

	return btoa( binary ).replace( /\+/g, '-' ).replace( /\//g, '_' ).replace( /=+$/, '' );

}

function base64urlToBytes( str ) {

	const base64 = str.replace( /-/g, '+' ).replace( /_/g, '/' );
	const binary = atob( base64 );
	const bytes = new Uint8Array( binary.length );
	for ( let i = 0; i < binary.length; i ++ ) bytes[ i ] = binary.charCodeAt( i );

	return bytes;

}


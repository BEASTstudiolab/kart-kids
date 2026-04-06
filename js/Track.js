import * as THREE from 'three';
import { getTrackModelConfig } from './TrackModelConfig.js';
import { getCurveConfig, getCurveLR } from './TileMetadata.js';
import { getElevationModelName, scanElevatedRun } from './ElevationUtils.js';

export const ORIENT_DEG = { 0: 0, 10: 180, 16: 90, 22: 270 };

export const CELL_RAW = 10.0;
export const GRID_SCALE = 1.0; // was 0.75 — temporarily disabled for testing

const _dummy = new THREE.Object3D();
const _childMat = new THREE.Matrix4();
const _combinedMat = new THREE.Matrix4();

export const TRACK_CELLS = [
	[ -3, -3, 'trk-corner-1x1',   16 ],
	[ -2, -3, 'trk-straight',     22 ],
	[ -1, -3, 'trk-straight',     22 ],
	[  0, -3, 'trk-corner-1x1',    0 ],
	[ -3, -2, 'trk-straight',      0 ],
	[  0, -2, 'trk-straight',      0 ],
	[ -3, -1, 'trk-corner-1x1',   10 ],
	[ -2, -1, 'trk-corner-1x1',    0 ],
	[  0, -1, 'trk-straight',      0 ],
	[ -2,  0, 'trk-straight',     10 ],
	[  0,  0, 'trk-finish',        0 ],
	[ -2,  1, 'trk-straight',     10 ],
	[  0,  1, 'trk-straight',      0 ],
	[ -2,  2, 'trk-corner-1x1',   10 ],
	[ -1,  2, 'trk-straight',     16 ],
	[  0,  2, 'trk-corner-1x1',   22 ],
];

const DECO_CELLS = [
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
	trackGroup.name = 'trackGroup';
	trackGroup.position.y = 0;

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

		if ( key.startsWith( 'trk-curve-' ) ) {

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

				// Elevated tiles use the straight model with a Y offset
				const elev = flags?.elevation || 0;
				const elevY = elev === 1 ? 2.416 : elev === 2 ? 4.832 : 0;
				_dummy.position.set( ( gx + 0.5 ) * CELL_RAW, elevY, ( gz + 0.5 ) * CELL_RAW );
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

		const curveElev = entry.flags?.elevation || 0;
		const curveElevY = curveElev === 1 ? 2.416 : curveElev === 2 ? 4.832 : 0;

		curveMesh.position.set(
			( entry.gx + 0.5 ) * CELL_RAW + curveConfig.offset.x,
			curveElevY,
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
		const buildingPositions1 = [];
		const buildingRotations1 = [];
		const buildingPositions2 = [];
		const buildingRotations2 = [];
		const emptyPositions = [];
		const emptyRotations = [];

		// Simple hash for deterministic pseudo-random placement
		function hash( gx, gz ) {

			let h = gx * 374761393 + gz * 668265263;
			h = ( h ^ ( h >> 13 ) ) * 1274126177;
			return ( h ^ ( h >> 16 ) ) >>> 0;

		}

		const ROTATIONS = [ 0, Math.PI * 0.5, Math.PI, Math.PI * 1.5 ];

		for ( let gz = minZ - pad; gz <= maxZ + pad; gz ++ ) {

			for ( let gx = minX - pad; gx <= maxX + pad; gx ++ ) {

				if ( occupied.has( gx + ',' + gz ) ) continue;

				const x = ( gx + 0.5 ) * CELL_RAW;
				const z = ( gz + 0.5 ) * CELL_RAW;
				const typeHash = hash( gx, gz ) % 3;
				const rotHash = hash( gx, gz + 7919 ) % 4;
				const rot = ROTATIONS[ rotHash ];

				if ( typeHash === 0 ) {

					buildingPositions1.push( x, z );
					buildingRotations1.push( rot );

				} else if ( typeHash === 1 ) {

					buildingPositions2.push( x, z );
					buildingRotations2.push( rot );

				} else {

					emptyPositions.push( x, z );
					emptyRotations.push( rot );

				}

			}

		}

		const _color = new THREE.Color();
		const decoLayers = {};

		function createInstances( src, positions, rotations, baseHue, label ) {

			if ( positions.length === 0 || ! src ) return;

			const count = positions.length / 2;
			const layerGroup = new THREE.Group();
			layerGroup.name = label;

			src.traverse( ( child ) => {

				if ( ! child.isMesh ) return;

				const inst = new THREE.InstancedMesh( child.geometry, child.material, count );
				inst.castShadow = false;
				inst.receiveShadow = true;
				inst.instanceColor = new THREE.InstancedBufferAttribute(
					new Float32Array( count * 3 ), 3
				);

				for ( let i = 0; i < count; i ++ ) {

					_dummy.position.set( positions[ i * 2 ], 0, positions[ i * 2 + 1 ] );
					_dummy.rotation.set( 0, rotations[ i ], 0 );
					_dummy.updateMatrix();
					inst.setMatrixAt( i, _dummy.matrix );

					const hueShift = ( ( positions[ i * 2 ] * 0.013 + positions[ i * 2 + 1 ] * 0.017 ) % 1 + 1 ) % 1;
					_color.setHSL( ( baseHue + hueShift * 0.08 ) % 1, 0.9, 0.5 );
					inst.setColorAt( i, _color );

				}

				layerGroup.add( inst );

			} );

			decoGroup.add( layerGroup );
			decoLayers[ label ] = layerGroup;

		}

		createInstances( models[ 'decoration-buildings-1' ], buildingPositions1, buildingRotations1, 0.0, 'buildings-1' );
		createInstances( models[ 'decoration-buildings-2' ], buildingPositions2, buildingRotations2, 0.33, 'buildings-2' );
		createInstances( models[ 'decoration-empty-night' ], emptyPositions, emptyRotations, 0.66, 'empty-night' );

		// Expose for debug toggling
		trackGroup.userData.decoLayers = decoLayers;


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
	piece.position.set( ( gx + 0.5 ) * CELL_RAW, 0, ( gz + 0.5 ) * CELL_RAW );

	const deg = ORIENT_DEG[ orient ] ?? 0;
	piece.rotation.y = THREE.MathUtils.degToRad( deg );

	return piece;

}

// ─── Track Codec ──────────────────────────────────────────

// track-bump kept at index 2 for backwards compatibility with saved tracks —
// decoded as trk-straight since the bump tile was removed.
const TYPE_NAMES = [ 'trk-straight', 'trk-corner-1x1', 'trk-straight', 'trk-finish' ];
const TYPE_INDEX = {};
for ( let i = 0; i < TYPE_NAMES.length; i ++ ) TYPE_INDEX[ TYPE_NAMES[ i ] ] = i;

const ORIENT_ENCODE = [ 0, 16, 10, 22 ];
const ORIENT_DECODE = { 0: 0, 16: 1, 10: 2, 22: 3 };

export function encodeCells( cells ) {

	// Filter out autoRamp cells — they are derived from elevated cells at load time
	const filtered = cells.filter( c => ! c[ 4 ]?.autoRamp );

	// v2 format: 4 bytes per cell (adds flags2 byte for rampStyle + future flags)
	const bytes = new Uint8Array( filtered.length * 4 );

	for ( let i = 0; i < filtered.length; i ++ ) {

		const [ gx, gz, name, cellOrient, flags ] = filtered[ i ];
		const ti = TYPE_INDEX[ name ] ?? 0;
		const oi = ORIENT_DECODE[ cellOrient ] ?? 0;

		// Byte 2: pack type + orient + legacy flags (bits 4-7)
		// bits 4-5: elevLevel (2 bits: 0=ground, 1=2.5m, 2=5m)
		// bit 6: curveOverride (1=force hard corner)
		// bit 7: rotationOverride (1=manual rotation)
		let flagBits = 0;
		// Byte 3 (flags2): bit 0 = rampStyle (0=steep, 1=smooth)
		let flags2 = 0;
		if ( flags ) {

			const elev = flags.elevation ?? 0;
			const curve = flags.curveOverride ? 1 : 0;
			const rot = flags.rotationOverride ? 1 : 0;
			flagBits = ( elev & 0x03 ) | ( curve << 2 ) | ( rot << 3 );

			if ( flags.rampStyle === 'smooth' ) flags2 |= 1;

		}

		bytes[ i * 4 ] = gx + 128;
		bytes[ i * 4 + 1 ] = gz + 128;
		bytes[ i * 4 + 2 ] = ( flagBits << 4 ) | ( ti << 2 ) | oi;
		bytes[ i * 4 + 3 ] = flags2;

	}

	return 'v2:' + bytesToBase64url( bytes );

}

export function decodeCells( str ) {

	// v2 format: 4 bytes per cell, prefixed with "v2:"
	if ( str.startsWith( 'v2:' ) ) {

		const bytes = base64urlToBytes( str.slice( 3 ) );
		const cells = [];

		for ( let i = 0; i + 3 < bytes.length; i += 4 ) {

			const gx = bytes[ i ] - 128;
			const gz = bytes[ i + 1 ] - 128;
			const packed = bytes[ i + 2 ];
			const flags2 = bytes[ i + 3 ];

			const ti = ( packed >> 2 ) & 0x03;
			const oi = packed & 0x03;

			const flagBits = ( packed >> 4 ) & 0x0F;
			const elevation = flagBits & 0x03;
			const curveOverride = !! ( flagBits & 0x04 );
			const rotationOverride = !! ( flagBits & 0x08 );

			const rampStyle = ( flags2 & 1 ) ? 'smooth' : null;

			const flags = { elevation, curveOverride, rotationOverride, rampStyle };
			cells.push( [ gx, gz, TYPE_NAMES[ ti ], ORIENT_ENCODE[ oi ], flags ] );

		}

		return cells;

	}

	// Legacy v1 format: 3 bytes per cell, no prefix
	const bytes = base64urlToBytes( str );
	const cells = [];

	for ( let i = 0; i + 2 < bytes.length; i += 3 ) {

		const gx = bytes[ i ] - 128;
		const gz = bytes[ i + 1 ] - 128;
		const packed = bytes[ i + 2 ];
		const ti = ( packed >> 2 ) & 0x03;
		const oi = packed & 0x03;

		const flagBits = ( packed >> 4 ) & 0x0F;
		const elevation = flagBits & 0x03;
		const curveOverride = !! ( flagBits & 0x04 );
		const rotationOverride = !! ( flagBits & 0x08 );

		const flags = { elevation, curveOverride, rotationOverride, rampStyle: null };
		cells.push( [ gx, gz, TYPE_NAMES[ ti ], ORIENT_ENCODE[ oi ], flags ] );

	}

	return cells;

}

export function computeSpawnPosition( cells ) {

	let cell = cells[ 0 ];

	for ( const c of cells ) {

		if ( c[ 2 ] === 'trk-finish' ) {

			cell = c;
			break;

		}

	}

	if ( ! cell ) return { position: [ 3.5, 0, 5 ], angle: 0 };

	const gx = cell[ 0 ];
	const gz = cell[ 1 ];
	const x = ( gx + 0.5 ) * CELL_RAW * GRID_SCALE;
	const z = ( gz + 0.5 ) * CELL_RAW * GRID_SCALE;

	const orient = cell[ 3 ];
	const trackAngle = THREE.MathUtils.degToRad( ORIENT_DEG[ orient ] || 0 );

	// spawnAngle: rotated 180° so the vehicle model (forward = +Z) faces the racing direction
	// finishAngle: the raw track orientation for finish line normal computation
	return { position: [ x, 0, z ], angle: trackAngle + Math.PI, finishAngle: trackAngle };

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

// getElevationModelName + scanElevatedRun imported from ElevationUtils.js

/**
 * Derives ramp cells from elevation flags without modifying curves.
 * Returns all original cells (base types) plus ramp type changes.
 * Used by TrackIntel for connectivity walking — keeps all cells intact.
 */
export function deriveRampCells( decodedCells ) {

	const grid = new Map();
	const ORIENT_FLIP = { 0: 10, 10: 0, 16: 22, 22: 16 };
	const cellKeyFn = ( gx, gz ) => gx + ',' + gz;

	for ( const cell of decodedCells ) {

		const [ gx, gz, type, orient, flags ] = cell;
		grid.set( gx + ',' + gz, {
			gx, gz, type, orient,
			flags: flags ? { ...flags } : { elevation: 0, curveOverride: false, rotationOverride: false },
		} );

	}

	// Copy flags.elevation → cell.elevation for scanElevatedRun compatibility
	for ( const [ , cell ] of grid ) {

		if ( cell.flags && cell.flags.elevation ) cell.elevation = cell.flags.elevation;

	}

	const processed = new Set();

	for ( const [ key, cell ] of grid ) {

		const elev = cell.flags.elevation;
		if ( ! elev || elev === 0 ) continue;
		if ( cell.type === 'trk-corner-1x1' || cell.type === 'trk-finish' ) continue;
		if ( processed.has( key ) ) continue;

		// Scan the full elevated run
		const run = scanElevatedRun( grid, cell.gx, cell.gz, cellKeyFn );
		if ( run.length === 0 ) continue;

		// Mark all run tiles as processed and replace with visual model
		for ( const tile of run ) {

			processed.add( tile.key );
			const runCell = grid.get( tile.key );
			if ( runCell ) runCell.type = getElevationModelName( runCell.flags.elevation, 'flat' );

		}

		// Determine axis
		const firstCell = grid.get( run[ 0 ].key );
		const orient = firstCell.orient;
		const isNS = orient === 0 || orient === 10;
		const dx = isNS ? 0 : 1;
		const dz = isNS ? 1 : 0;

		// Place ramps at run edges
		const first = run[ 0 ];
		const last = run[ run.length - 1 ];

		const edges = [
			{ edge: first, dir: - 1, parentIdx: 0 },
			{ edge: last, dir: 1, parentIdx: run.length - 1 },
		];

		for ( const { edge, dir, parentIdx } of edges ) {

			const parentTile = run[ parentIdx ];
			const parentCell = grid.get( parentTile.key );

			const nx = edge.gx + dx * dir;
			const nz = edge.gz + dz * dir;
			const nKey = cellKeyFn( nx, nz );
			let nCell = grid.get( nKey );

			// Ramp cells are filtered out during save — create them if missing
			if ( ! nCell ) {

				nCell = { gx: nx, gz: nz, type: 'trk-straight', orient, flags: { elevation: 0 } };
				grid.set( nKey, nCell );

			}

			if ( nCell.flags.elevation && nCell.flags.elevation > 0 ) continue;
			if ( nCell.flags.autoRamp ) continue;

			// Beyond-cell check: ensure a cell exists one tile further
			const bKey = cellKeyFn( nx + dx * dir, nz + dz * dir );
			const bCell = grid.get( bKey );
			if ( ! bCell ) continue;

			const role = dir === 1 ? 'ramp-up' : 'ramp-down';
			const style = parentCell.flags.rampStyle || 'steep';

			nCell.type = getElevationModelName( parentCell.flags.elevation, role, style );
			nCell.orient = orient;

			if ( role === 'ramp-up' ) {

				nCell.orient = ORIENT_FLIP[ orient ] ?? orient;

			}

			nCell.flags.autoRamp = true;

		}

	}

	return Array.from( grid.values() ).map( c => [ c.gx, c.gz, c.type, c.orient, c.flags ] );

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

	// ── Pre-pass: Identify explicit curve-consumed cells ─────────
	// Must run BEFORE Pass 1 so elevation doesn't corrupt cells that curves need.

	const cellKeyFn = ( gx, gz ) => gx + ',' + gz;
	const VARIANT_SIZE = { '2x2-wide': 2, '2x2-tight': 2, '3x3': 3, '3x3-wide': 3 };
	const explicitCurves = new Map(); // key → { curveSize, consumed }
	const explicitClaimed = new Set();

	for ( const [ key, cell ] of grid ) {

		if ( cell.type !== 'trk-corner-1x1' ) continue;
		if ( ! cell.flags.curveVariant ) continue;

		const curveSize = VARIANT_SIZE[ cell.flags.curveVariant ];
		if ( ! curveSize ) continue;

		const exits = CORNER_EXITS[ cell.orient ];
		if ( exits === undefined ) continue;

		const dirBits = [];
		for ( const bit of [ 8, 4, 2, 1 ] ) {

			if ( exits & bit ) dirBits.push( bit );

		}

		if ( dirBits.length !== 2 ) continue;

		const consumed = new Set();
		for ( const bit of dirBits ) {

			const [ ddx, ddz ] = DIR_DELTA[ bit ];
			let nx = cell.gx + ddx;
			let nz = cell.gz + ddz;

			for ( let i = 0; i < curveSize - 1; i ++ ) {

				consumed.add( nx + ',' + nz );
				nx += ddx;
				nz += ddz;

			}

		}

		explicitCurves.set( key, { curveSize, consumed } );

	}

	// Auto-detect curves for corners without explicit variant
	// Must run BEFORE elevation pass so we walk original trk-straight types
	const candidates = [];

	for ( const [ key, cell ] of grid ) {

		if ( cell.type !== 'trk-corner-1x1' ) continue;
		if ( cell.flags.curveVariant || cell.flags.rotationOverride ) continue;
		if ( explicitCurves.has( key ) ) continue;

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
				if ( nc.type !== 'trk-straight' ) break;
				keys.push( nk );
				nx += ddx;
				nz += ddz;

			}

			walks.push( { count: keys.length, keys } );

		}

		const curveSize = Math.min( walks[ 0 ].count, walks[ 1 ].count, 4 );
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

	// Merge explicit curves into curveCorners
	for ( const [ key, info ] of explicitCurves ) {

		curveCorners.set( key, info );

	}

	// Build explicitClaimed from ALL curve corners (both explicit and auto-detected)
	for ( const [ key, info ] of curveCorners ) {

		explicitClaimed.add( key );
		for ( const ck of info.consumed ) explicitClaimed.add( ck );

	}

	// ── Pass 1: Derive elevation & ramps (run-aware) ────────────

	const ORIENT_FLIP = { 0: 10, 10: 0, 16: 22, 22: 16 };

	// Copy flags.elevation → cell.elevation for scanElevatedRun compatibility
	for ( const [ , cell ] of grid ) {

		if ( cell.flags && cell.flags.elevation ) cell.elevation = cell.flags.elevation;

	}

	const processed = new Set();

	for ( const [ key, cell ] of grid ) {

		const elev = cell.flags.elevation;
		if ( ! elev || elev === 0 ) continue;
		if ( cell.type === 'trk-corner-1x1' || cell.type === 'trk-finish' ) continue;
		if ( processed.has( key ) ) continue;
		if ( explicitClaimed.has( key ) ) continue; // curve-consumed — skip elevation conversion

		// Scan the full elevated run from this cell
		const run = scanElevatedRun( grid, cell.gx, cell.gz, cellKeyFn );
		if ( run.length === 0 ) continue;

		// Mark all run tiles as processed and replace with visual model
		for ( const tile of run ) {

			processed.add( tile.key );
			const runCell = grid.get( tile.key );
			if ( runCell ) runCell.type = getElevationModelName( runCell.flags.elevation, 'flat' );

		}

		// Determine axis from run orientation
		const firstCell = grid.get( run[ 0 ].key );
		const orient = firstCell.orient;
		const isNS = orient === 0 || orient === 10;
		const dx = isNS ? 0 : 1;
		const dz = isNS ? 1 : 0;

		// Place ramps at run edges
		const first = run[ 0 ];
		const last = run[ run.length - 1 ];

		const edges = [
			{ edge: first, dir: - 1, parentIdx: 0 },
			{ edge: last, dir: 1, parentIdx: run.length - 1 },
		];

		for ( const { edge, dir, parentIdx } of edges ) {

			const parentTile = run[ parentIdx ];
			const parentCell = grid.get( parentTile.key );

			// Neighbor beyond the run edge
			const nx = edge.gx + dx * dir;
			const nz = edge.gz + dz * dir;
			const nKey = cellKeyFn( nx, nz );
			let nCell = grid.get( nKey );

			// Ramp cells are filtered out during save — create them if missing
			if ( ! nCell ) {

				nCell = { gx: nx, gz: nz, type: 'trk-straight', orient, flags: { elevation: 0 } };
				grid.set( nKey, nCell );

			}

			if ( nCell.flags.elevation && nCell.flags.elevation > 0 ) continue;
			if ( nCell.flags.autoRamp ) continue;
			if ( explicitClaimed.has( nKey ) ) continue; // don't place ramp on curve-consumed cell

			// Beyond-cell check: ensure a cell exists one tile further
			const bKey = cellKeyFn( nx + dx * dir, nz + dz * dir );
			const bCell = grid.get( bKey );
			if ( ! bCell ) continue;

			const role = dir === 1 ? 'ramp-up' : 'ramp-down';
			const style = parentCell.flags.rampStyle || 'steep';

			nCell.type = getElevationModelName( parentCell.flags.elevation, role, style );
			nCell.orient = orient;

			if ( role === 'ramp-up' ) {

				nCell.orient = ORIENT_FLIP[ orient ] ?? orient;

			}

			nCell.flags.autoRamp = true;

		}

	}

	// Corner elevation pass: derive elevation for corners adjacent to elevated tiles
	// Only check neighbors in the corner's actual exit directions
	const CORNER_EXIT_BITS = { 0: [ 4, 1 ], 16: [ 4, 2 ], 10: [ 8, 2 ], 22: [ 8, 1 ] };
	for ( const [ key, cell ] of grid ) {

		if ( cell.type !== 'trk-corner-1x1' ) continue;

		const exitBits = CORNER_EXIT_BITS[ cell.orient ];
		if ( ! exitBits ) continue;

		let maxElev = 0;
		for ( const bit of exitBits ) {

			const [ ddx, ddz ] = DIR_DELTA[ bit ];
			const nKey = cellKeyFn( cell.gx + ddx, cell.gz + ddz );
			const nCell = grid.get( nKey );
			if ( nCell ) {

				const ne = nCell.flags.elevation || 0;
				if ( ne > maxElev ) maxElev = ne;

			}

		}

		if ( maxElev > 0 ) {

			cell.flags.elevation = maxElev;
			cell.flags._derivedElevation = maxElev;

		}

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

			// Replace corner with curve visual type
			// If editor saved a curveVariant, use the variant-specific model name
			const VARIANT_MODEL = {
				'2x2-wide': 'trk-curve-2x2-l',
				'2x2-tight': 'trk-curve-2x2-tight-l',
				'3x3': 'trk-curve-3x3-l',
				'3x3-wide': 'trk-curve-3x3-wide-l',
			};
			const variant = cell.flags.curveVariant;
			let visualType;
			if ( variant && VARIANT_MODEL[ variant ] ) {

				visualType = VARIANT_MODEL[ variant ];

			} else {

				const curveConf = getCurveConfig( cell.orient, null, curveInfo.curveSize );
				const lr = curveConf.lr || getCurveLR( cell.orient );
				visualType = `trk-curve-${ curveInfo.curveSize }x${ curveInfo.curveSize }-${ lr }`;

			}
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


import * as THREE from 'three';
import { getTrackModelConfig } from './TrackModelConfig.js';
import { getFinishRoadCells } from './TrackOrientation.js';

// Re-export from focused modules
export { ORIENT_DEG, CELL_RAW, GRID_SCALE } from './TrackConstants.js';
export { TRACK_CELLS } from './TrackData.js';

import { ORIENT_DEG, CELL_RAW, GRID_SCALE } from './TrackConstants.js';
import { TRACK_CELLS } from './TrackData.js';
import { DECO_CELLS } from './TrackData.js';

const _dummy = new THREE.Object3D();
const _childMat = new THREE.Matrix4();
const _combinedMat = new THREE.Matrix4();

// Elevation step → world Y offset
// Editor uses steps 0-24 (12=ground), each step = 2.5m (matches model geometry)
// Legacy v3 elevation: 0=ground, 1=2.5m, 2=5.0m
const ELEV_GROUND = 12;
const ELEV_STEP_Y = 2.5;

function elevToY( flags ) {

	// Use fullElevation (v4) if available, fall back to legacy v3 elevation
	if ( flags?.fullElevation != null && flags.fullElevation !== ELEV_GROUND ) {

		return ( flags.fullElevation - ELEV_GROUND ) * ELEV_STEP_Y;

	}

	const elev = flags?.elevation || 0;
	return elev * ELEV_STEP_Y;

}



export function buildTrack( scene, models, customCells, props, terrainTiles = [] ) {

	const trackGroup = new THREE.Group();
	trackGroup.name = 'trackGroup';
	trackGroup.position.y = 0;

	const trackPieceGroup = new THREE.Group();
	const decoGroup = new THREE.Group();
	const terrainGroup = new THREE.Group();
	terrainGroup.name = 'editor-terrain';

	const cells = customCells || TRACK_CELLS;

	// Group track cells by tile type for instancing
	const cellsByType = {};

	for ( const [ gx, gz, key, orient, flags ] of cells ) {

		if ( flags?._collisionOnly ) continue;
		if ( ! cellsByType[ key ] ) cellsByType[ key ] = [];
		cellsByType[ key ].push( [ gx, gz, orient, flags ] );

	}

	// Separate multi-tile pieces from instanced tiles
	const curveEntries = []; // [ { key, gx, gz, orient, flags } ]
	const multiTileEntries = []; // junctions, chicanes — individual placement

	for ( const key in cellsByType ) {

		if ( key.startsWith( 'trk-curve-' ) ) {

			// Multi-tile curves use individual meshes (too few per track for instancing)
			for ( const [ gx, gz, orient, flags ] of cellsByType[ key ] ) {

				const curveSize = parseInt( key.match( /(\d+)x\d+/ )?.[ 1 ] ) || 3;
				curveEntries.push( { key, gx, gz, orient, flags, curveSize } );

			}

			continue;

		}

		if ( key.startsWith( 'trk-junction-' ) || key.startsWith( 'trk-chicane-' ) ) {

			// 3x3 junctions and chicanes use individual meshes
			for ( const [ gx, gz, orient, flags ] of cellsByType[ key ] ) {

				multiTileEntries.push( { key, gx, gz, orient, flags } );

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
				const elevY = elevToY( flags );
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
	// Uses the same rotation formula as the editor: degToRad(ORIENT_DEG) on the wrapper,
	// with the model's base rotation (PI) already baked into the inner scene.
	for ( const entry of curveEntries ) {

		const src = models[ entry.key ];
		if ( ! src ) continue;

		const curveMesh = src.clone();

		const curveElevY = elevToY( entry.flags );
		const deg = ORIENT_DEG[ entry.orient ] ?? 0;

		curveMesh.position.set(
			( entry.gx + 0.5 ) * CELL_RAW,
			curveElevY,
			( entry.gz + 0.5 ) * CELL_RAW
		);
		curveMesh.rotation.y = THREE.MathUtils.degToRad( deg );

		curveMesh.traverse( ( c ) => {

			if ( c.isMesh ) {

				c.castShadow = false;
				c.receiveShadow = true;

			}

		} );

		trackPieceGroup.add( curveMesh );

	}

	// Place 3x3 junctions and chicanes individually
	for ( const entry of multiTileEntries ) {

		const src = models[ entry.key ];
		if ( ! src ) continue;

		const mesh = src.clone();

		const deg = ORIENT_DEG[ entry.orient ] ?? 0;
		const elevY = elevToY( entry.flags );

		const worldX = ( entry.gx + 0.5 ) * CELL_RAW;
		const worldZ = ( entry.gz + 0.5 ) * CELL_RAW;
		mesh.position.set( worldX, elevY, worldZ );
		mesh.rotation.y = THREE.MathUtils.degToRad( deg );

		mesh.traverse( ( c ) => {

			if ( c.isMesh ) {

				c.castShadow = false;
				c.receiveShadow = true;

			}

		} );

		trackPieceGroup.add( mesh );

	}

	// Decorations disabled for debugging track tile colliders
	// if ( ! customCells ) {
	//
	// 	for ( const [ gx, gz, key, orient ] of DECO_CELLS ) {
	//
	// 		const piece = placePiece( models, key, gx, gz, orient );
	// 		if ( piece ) decoGroup.add( piece );
	//
	// 	}
	//
	// }

	if ( false ) { // Auto-generated decorations DISABLED — placed via track editor only
		const occupied = new Set();
		let minX = Infinity, maxX = - Infinity;
		let minZ = Infinity, maxZ = - Infinity;

		for ( const [ gx, gz, type, orient ] of cells ) {

			occupied.add( gx + ',' + gz );
			minX = Math.min( minX, gx );
			maxX = Math.max( maxX, gx );
			minZ = Math.min( minZ, gz );
			maxZ = Math.max( maxZ, gz );

			// 3x3 tiles (junctions, chicanes) — mark 5x5 area around anchor
			// to prevent buildings from overlapping the model geometry
			if ( type && ( type.startsWith( 'trk-junction-' ) || type.startsWith( 'trk-chicane-' ) ) ) {

				for ( let fx = - 2; fx <= 2; fx ++ ) {

					for ( let fz = - 2; fz <= 2; fz ++ ) {

						occupied.add( ( gx + fx ) + ',' + ( gz + fz ) );

					}

				}

			}

			// 3x1 finish arch — mark flanking cells
			if ( type === 'trk-finish' ) {

				for ( const roadCell of getFinishRoadCells( gx, gz, orient ) ) {

					occupied.add( roadCell.gx + ',' + roadCell.gz );

				}

			}

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

	if ( terrainTiles.length > 0 ) {

		for ( const tile of terrainTiles ) {

			const src = models[ tile.type ];
			if ( ! src ) continue;

			const clone = src.clone( true );
			const orient = tile.o ?? 0;
			const elevY = elevToY( { fullElevation: tile.e ?? ELEV_GROUND } );

			clone.position.set(
				( tile.gx + 0.5 ) * CELL_RAW,
				elevY,
				( tile.gz + 0.5 ) * CELL_RAW
			);
			clone.rotation.y = THREE.MathUtils.degToRad( ORIENT_DEG[ orient ] ?? 0 );

			clone.traverse( ( child ) => {

				if ( child.isMesh ) {

					child.castShadow = false;
					child.receiveShadow = true;

				}

			} );

			terrainGroup.add( clone );

		}

	}

	trackGroup.add( terrainGroup );

	// ── Editor-placed props/decor ────────────────────────────────────────
	if ( props && props.length > 0 ) {

		const propsGroup = new THREE.Group();
		propsGroup.name = 'editor-props';

		for ( const p of props ) {

			const src = models[ p.type ];
			if ( ! src ) continue;

			const clone = src.clone( true );
			clone.position.set( p.pos[ 0 ], p.pos[ 1 ], p.pos[ 2 ] );
			clone.rotation.y = Number.isFinite( p.rotY ) ? p.rotY : ( Array.isArray( p.rot ) && Number.isFinite( p.rot[ 1 ] ) ? p.rot[ 1 ] : 0 );

			clone.traverse( ( c ) => {

				if ( c.isMesh ) {

					c.castShadow = true;
					c.receiveShadow = true;

				}

			} );

			propsGroup.add( clone );

		}

		trackGroup.add( propsGroup );
		console.log( `[buildTrack] Placed ${ propsGroup.children.length } editor props` );

	}

	trackGroup.scale.setScalar( 1.0 ); // was 0.75 — temporarily disabled for testing
	scene.add( trackGroup );

	trackGroup.updateMatrixWorld( true );

	trackGroup.traverse( ( child ) => {

		if ( child.isMesh ) {

			child.castShadow = false;
			child.receiveShadow = true;

		}

		// Freeze static scene graph — track never moves
		child.matrixAutoUpdate = false;

		if ( child.isInstancedMesh ) {

			child.computeBoundingSphere();
			child.computeBoundingBox();

		}

	} );

	return trackGroup;

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

	// spawnAngle follows the finish-tile arrow direction used by the overlay.
	// finishAngle points the finish-line normal opposite travel so forward
	// crossings still register as laps.
	return { position: [ x, 0, z ], angle: trackAngle, finishAngle: trackAngle + Math.PI };

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


/**
 * Returns decoded cells as-is — no ramp derivation needed.
 * All tiles (including ramps) are saved directly from the editor.
 * Used by TrackIntel for connectivity walking.
 */
export function deriveRampCells( decodedCells ) {

	// Direct pass-through — the editor saves all tiles including ramps
	return decodedCells;

}

/**
 * Transforms decoded cells into a render-ready array.
 * Direct pass-through — the editor is the source of truth.
 * Only handles finish-tile flanking consumption (z-fighting prevention).
 *
 * Returns a new array — does not mutate the input.
 * Each entry: [ gx, gz, typeName, orient, flags ]
 */
export function transformCells( decodedCells ) {

	const cellKeyFn = ( gx, gz ) => gx + ',' + gz;

	// ── Finish tile 3x1 flanking consumption ─────────────────
	// The 3x1 finish arch model covers 3 cells of road surface.
	// Mark the two flanking cells as consumed so they don't render
	// overlapping straights (which causes z-fighting).
	const finishConsumed = new Set();

	for ( const cell of decodedCells ) {

		const [ gx, gz, type, orient ] = cell;
		if ( type !== 'trk-finish' ) continue;

		for ( const roadCell of getFinishRoadCells( gx, gz, orient ) ) {

			finishConsumed.add( cellKeyFn( roadCell.gx, roadCell.gz ) );

		}

	}

	// ── Build output array ────────────────────────────────────
	const result = [];

	for ( const cell of decodedCells ) {

		const [ gx, gz, type, orient, flags ] = cell;
		const f = flags ? { ...flags } : {};

		if ( finishConsumed.has( cellKeyFn( gx, gz ) ) ) {

			f._collisionOnly = true;

		}

		result.push( [ gx, gz, type, orient, f ] );

	}

	return result;

}


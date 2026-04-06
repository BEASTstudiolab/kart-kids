import * as THREE from 'three';
import { rigidBody, box, triangleMesh, MotionType, MotionQuality } from 'crashcat';
import { TRACK_CELLS, CELL_RAW, ORIENT_DEG, GRID_SCALE } from './Track.js';
import { getTrackModelConfig } from './TrackModelConfig.js';

const _debugMat = new THREE.MeshBasicMaterial( { color: 0x00ff00, wireframe: true } );

function addDebugBox( group, halfExtents, position, quaternion ) {

	const geo = new THREE.BoxGeometry( halfExtents[ 0 ] * 2, halfExtents[ 1 ] * 2, halfExtents[ 2 ] * 2 );
	const mesh = new THREE.Mesh( geo, _debugMat );
	mesh.position.set( position[ 0 ], position[ 1 ], position[ 2 ] );
	if ( quaternion ) mesh.quaternion.set( quaternion[ 0 ], quaternion[ 1 ], quaternion[ 2 ], quaternion[ 3 ] );
	group.add( mesh );

}

export function buildWallColliders( world, debugGroup, customCells ) {

	const S = GRID_SCALE;
	const CELL_HALF = CELL_RAW / 2;

	const WALL_HALF_THICK = 0.25;
	const WALL_X = 4.75;
	const WALL_HALF_H = 1.5;

	const wallY = ( 0.5 + WALL_HALF_H ) * S - 0.5;
	const hThick = WALL_HALF_THICK * S;
	const hHeight = WALL_HALF_H * S;
	const hLen = CELL_HALF * S;

	const ARC_SPAN = - Math.PI / 2;
	const ARC_CENTER_X = - CELL_HALF;
	const ARC_CENTER_Z = CELL_HALF;
	const OUTER_R = 2 * CELL_HALF - WALL_HALF_THICK;
	const OUTER_SEG = 8;
	const OUTER_SEG_HALF_LEN = ( OUTER_R * ( Math.PI / 2 ) / OUTER_SEG / 2 ) * S;
	const INNER_R = WALL_HALF_THICK;
	const INNER_SEG = 3;
	const INNER_SEG_HALF_LEN = ( INNER_R * ( Math.PI / 2 ) / INNER_SEG / 2 ) * S;

	function addArcWall( wcx, wcz, arcStart, radius, numSeg, segHalfLen, arcElevY ) {

		const arcWallY = wallY + ( arcElevY || 0 );

		for ( let i = 0; i < numSeg; i ++ ) {

			const aMid = arcStart + ( ( i + 0.5 ) / numSeg ) * ARC_SPAN;
			const halfExtents = [ hThick, hHeight, segHalfLen ];
			const position = [
				wcx + radius * Math.cos( aMid ) * S,
				arcWallY,
				wcz + radius * Math.sin( aMid ) * S
			];
			const quaternion = [ 0, Math.sin( - aMid / 2 ), 0, Math.cos( - aMid / 2 ) ];

			rigidBody.create( world, {
				shape: box.create( { halfExtents } ),
				motionType: MotionType.STATIC,
				objectLayer: world._OL_STATIC,
				position,
				quaternion,
				friction: 0.0,
				restitution: 0.1,
			} );

			if ( debugGroup ) addDebugBox( debugGroup, halfExtents, position, quaternion );

		}

	}

	const cells = customCells || TRACK_CELLS;

	for ( const cell of cells ) {

		const [ gx, gz, key, orient ] = cell;
		const flags = cell[ 4 ] || {};
		const elev = flags.elevation || 0;
		const elevY = elev === 1 ? 2.416 : elev === 2 ? 4.832 : 0;

		if ( key === 'track-bump' ) continue;

		const cx = ( gx + 0.5 ) * CELL_RAW * S;
		const cz = ( gz + 0.5 ) * CELL_RAW * S;

		const deg = ORIENT_DEG[ orient ] ?? 0;
		const rad = deg * Math.PI / 180;
		const cr = Math.cos( rad ), sr = Math.sin( rad );

		if ( key === 'track-straight-night' || key === 'track-straight' || key === 'trk-straight' || key === 'track-finish' || key === 'trk-finish'
			|| key.startsWith( 'track-elev-' ) || key.startsWith( 'track-ramp-' )
			|| key.startsWith( 'trk-elev-' ) || key.startsWith( 'trk-ramp-' ) ) {

			for ( const side of [ - 1, 1 ] ) {

				const lx = side * WALL_X;
				const wx = cx + ( lx * cr ) * S;
				const wz = cz + ( - lx * sr ) * S;
				const halfExtents = [ hThick, hHeight, hLen ];
				const position = [ wx, wallY + elevY, wz ];
				const quaternion = [ 0, Math.sin( rad / 2 ), 0, Math.cos( rad / 2 ) ];

				rigidBody.create( world, {
					shape: box.create( { halfExtents } ),
					motionType: MotionType.STATIC,
					objectLayer: world._OL_STATIC,
					position,
					quaternion,
					friction: 0.0,
					restitution: 0.1,
				} );

				if ( debugGroup ) addDebugBox( debugGroup, halfExtents, position, quaternion );

			}

		} else if ( key === 'track-corner-night' || key === 'trk-corner-1x1' ) {

			const wcx = cx + ( ARC_CENTER_X * cr + ARC_CENTER_Z * sr ) * S;
			const wcz = cz + ( - ARC_CENTER_X * sr + ARC_CENTER_Z * cr ) * S;
			const arcStart = - rad;

			addArcWall( wcx, wcz, arcStart, OUTER_R, OUTER_SEG, OUTER_SEG_HALF_LEN, elevY );
			addArcWall( wcx, wcz, arcStart, INNER_R, INNER_SEG, INNER_SEG_HALF_LEN, elevY );

		} else if ( key.startsWith( 'track-curve-' ) || key.startsWith( 'trk-curve-' ) ) {

			// Multi-tile curves: generate arc walls with scaled radii
			// Extract curve size from key (e.g., 'track-curve-3x3-l' → 3)
			const sizeMatch = key.match( /(\d+)x\d+/ );
			const curveSize = sizeMatch ? parseInt( sizeMatch[ 1 ] ) : 2;

			// Outer arc radius scales with curve size
			const curveOuterR = curveSize * CELL_HALF - WALL_HALF_THICK;
			const curveOuterSeg = OUTER_SEG * curveSize;
			const curveOuterSegHalfLen = ( curveOuterR * ( Math.PI / 2 ) / curveOuterSeg / 2 ) * S;

			// Inner arc — scales with curve size
			const curveInnerR = ( curveSize - 1 ) * CELL_HALF + WALL_HALF_THICK;
			const curveInnerSeg = INNER_SEG * curveSize;
			const curveInnerSegHalfLen = ( curveInnerR * ( Math.PI / 2 ) / ( curveInnerSeg ) / 2 ) * S;

			// Arc center scales with curve size
			const arcCX = - curveSize * CELL_HALF;
			const arcCZ = curveSize * CELL_HALF;
			const wcx = cx + ( arcCX * cr + arcCZ * sr ) * S;
			const wcz = cz + ( - arcCX * sr + arcCZ * cr ) * S;
			const arcStart = - rad;

			addArcWall( wcx, wcz, arcStart, curveOuterR, curveOuterSeg, curveOuterSegHalfLen, elevY );
			addArcWall( wcx, wcz, arcStart, curveInnerR, curveInnerSeg, curveInnerSegHalfLen, elevY );

		}

	}

}

const _vec3 = new THREE.Vector3();

export function buildTrackColliders( world, models, customCells ) {

	const cells = customCells || TRACK_CELLS;

	// Merge ALL tile triangles into one continuous collision mesh to eliminate
	// seam gaps between adjacent tiles that cause vehicle jitter
	const dummy = new THREE.Object3D();
	const childMat = new THREE.Matrix4();
	const combinedMat = new THREE.Matrix4();
	const GROUP_Y_OFFSET = - 0.5;

	// Collect all positions and indices across all tiles
	const allPositions = [];
	const allIndices = [];
	let vertexOffset = 0;

	for ( const cell of cells ) {

		const [ gx, gz, key, orient ] = cell;
		const flags = cell[ 4 ] || {};

		// Collision-only cells (elevated curve-consumed): flat road quad, no model walls
		if ( flags._collisionOnly ) {

			const elev = flags.elevation || 0;
			const elevY = elev === 1 ? 2.416 : elev === 2 ? 4.832 : 0;
			const cx = ( gx + 0.5 ) * CELL_RAW;
			const cz = ( gz + 0.5 ) * CELL_RAW;
			const half = CELL_RAW / 2;
			const y = elevY + 0.5; // road surface height (model road surface is ~0.5 in model space)

			// Two triangles forming a flat quad at road height
			const vi = allPositions.length / 3;
			allPositions.push(
				cx - half, y, cz - half,
				cx + half, y, cz - half,
				cx + half, y, cz + half,
				cx - half, y, cz + half
			);
			allIndices.push(
				vi, vi + 1, vi + 2,
				vi, vi + 2, vi + 3
			);
			vertexOffset += 4;
			continue;

		}

		const src = models[ key ];
		if ( ! src ) continue;

		const deg = ORIENT_DEG[ orient ] ?? 0;

		// Apply position offset for multi-tile curves
		let posX = ( gx + 0.5 ) * CELL_RAW;
		let posZ = ( gz + 0.5 ) * CELL_RAW;

		if ( key.startsWith( 'track-curve-' ) || key.startsWith( 'trk-curve-' ) ) {

			const modelConfig = getTrackModelConfig( key );
			if ( modelConfig.offset ) {

				posX += modelConfig.offset.x;
				posZ += modelConfig.offset.z;

			}

		}

		// Elevated tiles use straight model with Y offset
		const elev = flags.elevation || 0;
		const elevY = elev === 1 ? 2.416 : elev === 2 ? 4.832 : 0;

		dummy.position.set( posX, 0.5 + elevY, posZ );
		dummy.rotation.set( 0, THREE.MathUtils.degToRad( deg ), 0 );
		dummy.updateMatrix();

		src.updateMatrixWorld( true );
		const srcInverse = src.matrixWorld.clone().invert();

		src.traverse( ( child ) => {

			if ( ! child.isMesh ) return;

			const geo = child.geometry;
			const posAttr = geo.getAttribute( 'position' );
			const index = geo.index;

			childMat.copy( child.matrixWorld ).premultiply( srcInverse );
			combinedMat.multiplyMatrices( dummy.matrix, childMat );

			// Transform and collect positions
			for ( let i = 0; i < posAttr.count; i ++ ) {

				_vec3.fromBufferAttribute( posAttr, i );
				_vec3.applyMatrix4( combinedMat );
				allPositions.push( _vec3.x, _vec3.y + GROUP_Y_OFFSET, _vec3.z );

			}

			// Collect indices with offset
			if ( index ) {

				for ( let i = 0; i < index.count; i ++ ) {

					allIndices.push( index.array[ i ] + vertexOffset );

				}

			} else {

				for ( let i = 0; i < posAttr.count; i ++ ) {

					allIndices.push( i + vertexOffset );

				}

			}

			vertexOffset += posAttr.count;

		} );

	}

	// Create single merged collider from all tile geometry
	const positions = new Float32Array( allPositions );
	const indices = new Uint32Array( allIndices );

	rigidBody.create( world, {
		shape: triangleMesh.create( { positions, indices } ),
		motionType: MotionType.STATIC,
		objectLayer: world._OL_STATIC,
		friction: 5.0,
		restitution: 0.0,
	} );

	// Return geometry data for debug visualization
	return { positions, indices };

}

export function buildSingleTileCollider( world, glbScene ) {

	glbScene.traverse( ( child ) => {

		if ( ! child.isMesh ) return;

		const geo = child.geometry;
		const posAttr = geo.getAttribute( 'position' );
		const index = geo.index;

		// Build mesh-to-world matrix from the node's world transform
		child.updateWorldMatrix( true, false );
		const meshWorld = child.matrixWorld;

		const positions = new Float32Array( posAttr.count * 3 );

		for ( let i = 0; i < posAttr.count; i ++ ) {

			_vec3.fromBufferAttribute( posAttr, i );
			_vec3.applyMatrix4( meshWorld );
			positions[ i * 3 ] = _vec3.x;
			positions[ i * 3 + 1 ] = _vec3.y;
			positions[ i * 3 + 2 ] = _vec3.z;

		}

		let indices;

		if ( index ) {

			indices = new Uint32Array( index.count );
			for ( let i = 0; i < index.count; i ++ ) indices[ i ] = index.array[ i ];

		} else {

			indices = new Uint32Array( posAttr.count );
			for ( let i = 0; i < posAttr.count; i ++ ) indices[ i ] = i;

		}

		rigidBody.create( world, {
			shape: triangleMesh.create( { positions, indices } ),
			motionType: MotionType.STATIC,
			objectLayer: world._OL_STATIC,
			friction: 5.0,
			restitution: 0.0,
		} );

	} );

}

export function removeVehicleBody( world, body ) {

	// crashcat may not expose destroy — teleport out of play and zero velocity
	rigidBody.setPosition( world, body, [ 0, - 1000, 0 ], false );
	rigidBody.setLinearVelocity( world, body, [ 0, 0, 0 ] );
	rigidBody.setAngularVelocity( world, body, [ 0, 0, 0 ] );

}

export function createVehicleBody( world, spawnPos ) {

	// Box collider for wall/barrier collisions only — gravity is zero
	// because ground contact is handled by raycasts in Vehicle.js
	const body = rigidBody.create( world, {
		shape: box.create( { halfExtents: [ 0.4, 0.3, 0.7 ] } ),
		motionType: MotionType.DYNAMIC,
		objectLayer: world._OL_MOVING,
		position: spawnPos || [ 3.5, 0.8, 5 ],
		mass: 800.0,
		friction: 1.5,
		restitution: 0.3,
		linearDamping: 0.5,
		angularDamping: 100.0,
		gravityFactor: 0,
		motionQuality: MotionQuality.LINEAR_CAST,
	} );

	return body;

}

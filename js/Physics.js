import * as THREE from 'three';
import { rigidBody, box, triangleMesh, MotionType, MotionQuality } from 'crashcat';
import { TRACK_CELLS, CELL_RAW, ORIENT_DEG, GRID_SCALE } from './Track.js';

const _debugMat = new THREE.MeshBasicMaterial( { color: 0x00ff00, wireframe: true } );

function addDebugBox( group, halfExtents, position, quaternion ) {

	const geo = new THREE.BoxGeometry( halfExtents[ 0 ] * 2, halfExtents[ 1 ] * 2, halfExtents[ 2 ] * 2 );
	const mesh = new THREE.Mesh( geo, _debugMat );
	mesh.position.set( position[ 0 ], position[ 1 ], position[ 2 ] );
	if ( quaternion ) mesh.quaternion.set( quaternion[ 0 ], quaternion[ 1 ], quaternion[ 2 ], quaternion[ 3 ] );
	group.add( mesh );

}

export function buildWallColliders( world, debugGroup, customCells, { skipPhysics = false } = {} ) {

	const S = GRID_SCALE;
	const CELL_HALF = CELL_RAW / 2;

	// Constants aligned to kartkids_base_trk_* model geometry:
	// - Road surface: X ±4.0 from cell center (8-unit-wide road)
	// - Visual curbs: X ±4.0 to ±5.0
	// - Wall collider inner face should sit at ±4.0 (road edge)
	const WALL_HALF_THICK = 0.5;
	const WALL_X = 4.5;          // center of wall box: inner face at 4.0 (road edge)
	const WALL_HALF_H = 2.5;

	const wallY = ( 0.5 + WALL_HALF_H ) * S - 0.5;
	const hThick = WALL_HALF_THICK * S;
	const hHeight = WALL_HALF_H * S;
	const hLen = CELL_HALF * S;

	const ARC_SPAN = - Math.PI / 2;
	const ARC_CENTER_X = - CELL_HALF;
	const ARC_CENTER_Z = CELL_HALF;
	// Corner outer wall: road surface extends 9.0 units from arc center (-5,+5)
	// (cell edge at +4.0 from center = 9.0 from arc corner)
	const OUTER_R = 9.0;
	const OUTER_SEG = 10;
	const OUTER_SEG_HALF_LEN = ( OUTER_R * ( Math.PI / 2 ) / OUTER_SEG / 2 ) * S;
	// Corner inner wall: inner road surface at ~1.45 from arc center
	// (model shows inner curb starting at 1.45 units from corner)
	const INNER_R = 1.5;
	const INNER_SEG = 4;
	const INNER_SEG_HALF_LEN = ( INNER_R * ( Math.PI / 2 ) / INNER_SEG / 2 ) * S;

	function addArcWall( wcx, wcz, arcStart, radius, numSeg, segHalfLen ) {

		for ( let i = 0; i < numSeg; i ++ ) {

			const aMid = arcStart + ( ( i + 0.5 ) / numSeg ) * ARC_SPAN;
			const halfExtents = [ hThick, hHeight, segHalfLen ];
			const position = [
				wcx + radius * Math.cos( aMid ) * S,
				wallY,
				wcz + radius * Math.sin( aMid ) * S
			];
			const quaternion = [ 0, Math.sin( - aMid / 2 ), 0, Math.cos( - aMid / 2 ) ];

			if ( ! skipPhysics ) {

				rigidBody.create( world, {
					shape: box.create( { halfExtents } ),
					motionType: MotionType.STATIC,
					objectLayer: world._OL_STATIC,
					position,
					quaternion,
					friction: 0.0,
					restitution: 0.3,
				} );

			}

			if ( debugGroup ) addDebugBox( debugGroup, halfExtents, position, quaternion );

		}

	}

	const cells = customCells || TRACK_CELLS;

	for ( const [ gx, gz, key, orient ] of cells ) {

		if ( ! key ) continue;

		const cx = ( gx + 0.5 ) * CELL_RAW * S;
		const cz = ( gz + 0.5 ) * CELL_RAW * S;

		const deg = ORIENT_DEG[ orient ] ?? 0;
		const rad = deg * Math.PI / 180;
		const cr = Math.cos( rad ), sr = Math.sin( rad );

<<<<<<< Updated upstream
		if ( key === 'track-straight-night' || key === 'track-straight' || key === 'track-finish' ) {
=======
		if ( key === 'trk-straight' || key === 'trk-finish'
			|| key.startsWith( 'trk-elev-' ) || key.startsWith( 'trk-ramp-' ) ) {
>>>>>>> Stashed changes

			for ( const side of [ - 1, 1 ] ) {

				const lx = side * WALL_X;
				const wx = cx + ( lx * cr ) * S;
				const wz = cz + ( - lx * sr ) * S;
				const halfExtents = [ hThick, hHeight, hLen ];
				const position = [ wx, wallY, wz ];
				const quaternion = [ 0, Math.sin( rad / 2 ), 0, Math.cos( rad / 2 ) ];

				if ( ! skipPhysics ) {

					rigidBody.create( world, {
						shape: box.create( { halfExtents } ),
						motionType: MotionType.STATIC,
						objectLayer: world._OL_STATIC,
						position,
						quaternion,
						friction: 0.0,
						restitution: 0.3,
					} );

				}

				if ( debugGroup ) addDebugBox( debugGroup, halfExtents, position, quaternion );

			}

		} else if ( key === 'trk-corner-1x1' ) {

			const wcx = cx + ( ARC_CENTER_X * cr + ARC_CENTER_Z * sr ) * S;
			const wcz = cz + ( - ARC_CENTER_X * sr + ARC_CENTER_Z * cr ) * S;
			const arcStart = - rad;

			addArcWall( wcx, wcz, arcStart, OUTER_R, OUTER_SEG, OUTER_SEG_HALF_LEN );
			addArcWall( wcx, wcz, arcStart, INNER_R, INNER_SEG, INNER_SEG_HALF_LEN );

<<<<<<< Updated upstream
=======
		} else if ( key.startsWith( 'trk-curve-' ) ) {

			// Multi-tile curves: generate arc walls matching model geometry.
			// Model road edge is 1.0 unit inset from bounding box edge, road width ~7.5 units.
			// Formula: outerR = curveSize * CELL_RAW - 1.0, innerR = outerR - 7.5
			const sizeMatch = key.match( /(\d+)x\d+/ );
			const curveSize = sizeMatch ? parseInt( sizeMatch[ 1 ] ) : 2;

			const curveOuterR = curveSize * CELL_RAW - 1.0;
			const curveOuterSeg = OUTER_SEG + ( curveSize - 1 ) * 4;
			const curveOuterSegHalfLen = ( curveOuterR * ( Math.PI / 2 ) / curveOuterSeg / 2 ) * S;

			const curveInnerR = curveOuterR - 7.5;
			const curveInnerSeg = INNER_SEG + ( curveSize - 1 ) * 2;
			const curveInnerSegHalfLen = ( curveInnerR * ( Math.PI / 2 ) / curveInnerSeg / 2 ) * S;

			// Arc center scales with curve size
			const arcCX = - curveSize * CELL_HALF;
			const arcCZ = curveSize * CELL_HALF;
			const wcx = cx + ( arcCX * cr + arcCZ * sr ) * S;
			const wcz = cz + ( - arcCX * sr + arcCZ * cr ) * S;
			const arcStart = - rad;

			addArcWall( wcx, wcz, arcStart, curveOuterR, curveOuterSeg, curveOuterSegHalfLen );
			addArcWall( wcx, wcz, arcStart, curveInnerR, curveInnerSeg, curveInnerSegHalfLen );

>>>>>>> Stashed changes
		}

	}

}

const _vec3 = new THREE.Vector3();

export function buildTrackColliders( world, models, customCells ) {

	const cells = customCells || TRACK_CELLS;
	const S = GRID_SCALE;

<<<<<<< Updated upstream
	// trackGroup has position.y = -0.5, scale = S
	const groupMatrix = new THREE.Matrix4()
		.makeTranslation( 0, - 0.5, 0 )
		.scale( new THREE.Vector3( S, S, S ) );
=======
	// Merge ALL tile triangles into one continuous collision mesh to eliminate
	// seam gaps between adjacent tiles that cause vehicle jitter
	const dummy = new THREE.Object3D();
	const childMat = new THREE.Matrix4();
	const combinedMat = new THREE.Matrix4();
	const GROUP_Y_OFFSET = 0;
>>>>>>> Stashed changes

	for ( const [ gx, gz, key, orient ] of cells ) {

		const src = models[ key ];
		if ( ! src ) continue;

		const deg = ORIENT_DEG[ orient ] ?? 0;
		const rad = deg * Math.PI / 180;

		// Tile local transform (matches placePiece)
		const tileMatrix = new THREE.Matrix4().compose(
			new THREE.Vector3( ( gx + 0.5 ) * CELL_RAW, 0.5, ( gz + 0.5 ) * CELL_RAW ),
			new THREE.Quaternion().setFromAxisAngle( new THREE.Vector3( 0, 1, 0 ), rad ),
			new THREE.Vector3( 1, 1, 1 )
		);

<<<<<<< Updated upstream
		// Full transform: group * tile
		const worldMatrix = new THREE.Matrix4().multiplyMatrices( groupMatrix, tileMatrix );
=======
		if ( key.startsWith( 'trk-curve-' ) ) {

			const modelConfig = getTrackModelConfig( key );
			if ( modelConfig.offset ) {

				posX += modelConfig.offset.x;
				posZ += modelConfig.offset.z;

			}

		}

		// Elevated tiles use straight model with Y offset
		const elev = flags.elevation || 0;
		const elevY = elev === 1 ? 2.416 : elev === 2 ? 4.832 : 0;

		dummy.position.set( posX, elevY, posZ );
		dummy.rotation.set( 0, THREE.MathUtils.degToRad( deg ), 0 );
		dummy.updateMatrix();

		src.updateMatrixWorld( true );
		const srcInverse = src.matrixWorld.clone().invert();
>>>>>>> Stashed changes

		src.traverse( ( child ) => {

			if ( ! child.isMesh ) return;

			const geo = child.geometry;
			const posAttr = geo.getAttribute( 'position' );
			const index = geo.index;

			// Build the mesh-to-world matrix (include any local transforms on the mesh node)
			const meshWorld = new THREE.Matrix4().multiplyMatrices( worldMatrix, child.matrix );

			// Extract transformed positions
			const positions = new Float32Array( posAttr.count * 3 );

			for ( let i = 0; i < posAttr.count; i ++ ) {

				_vec3.fromBufferAttribute( posAttr, i );
				_vec3.applyMatrix4( meshWorld );
				positions[ i * 3 ] = _vec3.x;
				positions[ i * 3 + 1 ] = _vec3.y;
				positions[ i * 3 + 2 ] = _vec3.z;

			}

			// Build indices — use existing index buffer or generate sequential
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

<<<<<<< Updated upstream
=======
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

>>>>>>> Stashed changes
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
		position: spawnPos || [ 3.5, 0.3, 5 ],
		mass: 800.0,
		friction: 1.5,
		restitution: 0.05,
		linearDamping: 0.5,
		angularDamping: 100.0,
		gravityFactor: 0,
		motionQuality: MotionQuality.LINEAR_CAST,
	} );

	return body;

}

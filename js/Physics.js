import * as THREE from 'three';
import { rigidBody, box, triangleMesh, MotionType, MotionQuality } from 'crashcat';
import { TRACK_CELLS, CELL_RAW, ORIENT_DEG } from './Track.js';
import { getCurveConfig } from './TileMetadata.js';

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

		// Collision-only cells (consumed by multi-tile piece): flat road quad, no model
		if ( flags._collisionOnly ) {

			const elev = flags.elevation || 0;
			const elevY = elev === 1 ? 2.416 : elev === 2 ? 4.832 : 0;
			const cx = ( gx + 0.5 ) * CELL_RAW;
			const cz = ( gz + 0.5 ) * CELL_RAW;
			const half = CELL_RAW / 2;
			// Match model road surface: dummy Y=0.5 + GROUP_Y_OFFSET=-0.5 = net 0
			const y = elevY;

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
		if ( ! src ) {

			console.warn( '[collider] missing model for tile:', key, 'at', gx, gz );
			continue;

		}

		// Elevated tiles use straight model with Y offset
		const elev = flags.elevation || 0;
		const elevY = elev === 1 ? 2.416 : elev === 2 ? 4.832 : 0;

		let posX = ( gx + 0.5 ) * CELL_RAW;
		let posZ = ( gz + 0.5 ) * CELL_RAW;
		let rotY;

		if ( key.startsWith( 'track-curve-' ) || key.startsWith( 'trk-curve-' ) ) {

			// Curves use getCurveConfig for position + rotation (must match buildTrack)
			const curveSize = parseInt( key.match( /(\d+)x\d+/ )?.[ 1 ] ) || 3;
			const lr = key.includes( '-l' ) ? 'l' : 'r';
			const curveConfig = getCurveConfig( orient, lr, curveSize );
			posX += curveConfig.offset.x;
			posZ += curveConfig.offset.z;
			rotY = curveConfig.rotation;
			// Curves in buildTrack use Y = curveElevY (no +0.5), but
			// GROUP_Y_OFFSET (-0.5) is applied to all vertices, so add +0.5 to compensate
			dummy.position.set( posX, 0.5 + elevY, posZ );

		} else {

			const deg = ORIENT_DEG[ orient ] ?? 0;
			rotY = THREE.MathUtils.degToRad( deg );
			dummy.position.set( posX, 0.5 + elevY, posZ );

		}

		dummy.rotation.set( 0, rotY, 0 );
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

	console.log( '[collider] track mesh:', positions.length / 3, 'verts,', indices.length / 3, 'tris from', cells.length, 'cells' );

	if ( positions.length === 0 ) {

		console.error( '[collider] NO TRACK COLLIDER GEOMETRY — vehicle will fall through!' );
		return { positions, indices };

	}

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

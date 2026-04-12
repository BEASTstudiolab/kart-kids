import * as THREE from 'three';
import { rigidBody, box, triangleMesh, MotionType, MotionQuality } from 'crashcat';
import { TRACK_CELLS, CELL_RAW, ORIENT_DEG } from './Track.js';

const _vec3 = new THREE.Vector3();

const ELEV_GROUND = 12;
const ELEV_STEP_Y = 2.5;

const GROUP_Y_OFFSET = - 0.5;
const SUPPORT_NORMAL_MIN_Y = 0.5;
const BLOCKER_NORMAL_MAX_ABS_Y = 0.5;
const CLOSED_SHELL_MIN_LOCAL_Y = 0.05;

const WALL_EXTEND_UP = 3.0;
const WALL_THICKNESS = 1.0;
const WALL_MIN_HEIGHT = 0.25;

function elevToY( flags ) {

	if ( flags?.fullElevation != null && flags.fullElevation !== ELEV_GROUND ) {

		return ( flags.fullElevation - ELEV_GROUND ) * ELEV_STEP_Y;

	}

	const elev = flags?.elevation || 0;
	return elev * ELEV_STEP_Y;

}

function createSequentialIndexArray( count, start = 0 ) {

	const indices = new Uint32Array( count );

	for ( let i = 0; i < count; i ++ ) {

		indices[ i ] = start + i;

	}

	return indices;

}

function getPrimitiveIndexSlices( geometry ) {

	const index = geometry.index;
	const groups = geometry.groups && geometry.groups.length > 0
		? geometry.groups.filter( ( group ) => group.count > 0 )
		: [];

	if ( index ) {

		if ( groups.length === 0 ) {

			return [ index.array ];

		}

		return groups.map( ( group ) => index.array.slice( group.start, group.start + group.count ) );

	}

	const posAttr = geometry.getAttribute( 'position' );

	if ( groups.length === 0 ) {

		return [ createSequentialIndexArray( posAttr.count ) ];

	}

	return groups.map( ( group ) => createSequentialIndexArray( group.count, group.start ) );

}

export function classifyTrackPrimitiveTriangles( positions, indices, options = {} ) {

	const supportIndices = [];
	const blockerIndices = [];
	const baseThreshold = options.baseThreshold ?? CLOSED_SHELL_MIN_LOCAL_Y;

	let minY = Infinity;
	let maxY = - Infinity;
	let upwardTriangleCount = 0;
	let downwardTriangleCount = 0;
	let sideTriangleCount = 0;

	for ( let i = 0; i < indices.length; i += 3 ) {

		const ia = indices[ i ] * 3;
		const ib = indices[ i + 1 ] * 3;
		const ic = indices[ i + 2 ] * 3;

		const ax = positions[ ia ];
		const ay = positions[ ia + 1 ];
		const az = positions[ ia + 2 ];
		const bx = positions[ ib ];
		const by = positions[ ib + 1 ];
		const bz = positions[ ib + 2 ];
		const cx = positions[ ic ];
		const cy = positions[ ic + 1 ];
		const cz = positions[ ic + 2 ];

		minY = Math.min( minY, ay, by, cy );
		maxY = Math.max( maxY, ay, by, cy );

		const abx = bx - ax;
		const aby = by - ay;
		const abz = bz - az;
		const acx = cx - ax;
		const acy = cy - ay;
		const acz = cz - az;

		const nx = aby * acz - abz * acy;
		const ny = abz * acx - abx * acz;
		const nz = abx * acy - aby * acx;
		const length = Math.hypot( nx, ny, nz );

		if ( length <= 0.000001 ) {

			continue;

		}

		const normalY = ny / length;

		if ( normalY > SUPPORT_NORMAL_MIN_Y ) {

			upwardTriangleCount ++;
			supportIndices.push( indices[ i ], indices[ i + 1 ], indices[ i + 2 ] );
			continue;

		}

		if ( normalY < - SUPPORT_NORMAL_MIN_Y ) {

			downwardTriangleCount ++;
			continue;

		}

		if ( Math.abs( normalY ) <= BLOCKER_NORMAL_MAX_ABS_Y ) {

			sideTriangleCount ++;
			blockerIndices.push( indices[ i ], indices[ i + 1 ], indices[ i + 2 ] );

		}

	}

	const isElevatedClosedShell = downwardTriangleCount > 0 && minY > baseThreshold;

	return {
		minY: Number.isFinite( minY ) ? minY : 0,
		maxY: Number.isFinite( maxY ) ? maxY : 0,
		upwardTriangleCount,
		downwardTriangleCount,
		sideTriangleCount,
		isElevatedClosedShell,
		supportIndices: isElevatedClosedShell ? [] : supportIndices,
		blockerIndices,
	};

}

function appendTransformedPrimitiveGeometry( targetPositions, targetIndices, posAttr, indices, matrix ) {

	if ( ! indices || indices.length === 0 ) return;

	const vertexOffset = targetPositions.length / 3;

	for ( let i = 0; i < posAttr.count; i ++ ) {

		_vec3.fromBufferAttribute( posAttr, i );
		_vec3.applyMatrix4( matrix );
		targetPositions.push( _vec3.x, _vec3.y + GROUP_Y_OFFSET, _vec3.z );

	}

	for ( let i = 0; i < indices.length; i ++ ) {

		targetIndices.push( indices[ i ] + vertexOffset );

	}

}

function appendCollisionOnlySupportQuad( targetPositions, targetIndices, gx, gz, elevY ) {

	const cx = ( gx + 0.5 ) * CELL_RAW;
	const cz = ( gz + 0.5 ) * CELL_RAW;
	const half = CELL_RAW / 2;
	const y = elevY;
	const vertexOffset = targetPositions.length / 3;

	targetPositions.push(
		cx - half, y, cz - half,
		cx + half, y, cz - half,
		cx + half, y, cz + half,
		cx - half, y, cz + half,
	);

	targetIndices.push(
		vertexOffset, vertexOffset + 1, vertexOffset + 2,
		vertexOffset, vertexOffset + 2, vertexOffset + 3,
	);

}

function buildBarrierGeometryFromBlockers( blockerPositions, blockerIndices, roadHeightHints = [ 0 ] ) {

	const barrierPositions = [];
	const barrierIndices = [];
	let barrierVertOffset = 0;
	let blockerVertOffset = blockerPositions.length / 3;

	const triCount = Math.floor( blockerIndices.length / 3 );
	const _a = new THREE.Vector3();
	const _b = new THREE.Vector3();
	const _c = new THREE.Vector3();
	const _ab = new THREE.Vector3();
	const _ac = new THREE.Vector3();
	const _n = new THREE.Vector3();

	const elevYValues = [ ...new Set( roadHeightHints ) ].sort( ( a, b ) => a - b );

	function nearestRoadY( y ) {

		let best = 0;
		let bestDist = Infinity;

		for ( const elevY of elevYValues ) {

			const distance = Math.abs( y - elevY );

			if ( distance < bestDist ) {

				best = elevY;
				bestDist = distance;

			}

		}

		return best;

	}

	function addBarrierQuad( ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz ) {

		const blockerOffset = blockerVertOffset;

		blockerPositions.push( ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz );
		blockerIndices.push(
			blockerOffset, blockerOffset + 1, blockerOffset + 2,
			blockerOffset, blockerOffset + 2, blockerOffset + 3,
			blockerOffset + 2, blockerOffset + 1, blockerOffset,
			blockerOffset + 3, blockerOffset + 2, blockerOffset,
		);
		blockerVertOffset += 4;

		const barrierOffset = barrierVertOffset;

		barrierPositions.push( ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz );
		barrierIndices.push(
			barrierOffset, barrierOffset + 1, barrierOffset + 2,
			barrierOffset, barrierOffset + 2, barrierOffset + 3,
		);
		barrierVertOffset += 4;

	}

	for ( let triIndex = 0; triIndex < triCount; triIndex ++ ) {

		const i0 = blockerIndices[ triIndex * 3 ];
		const i1 = blockerIndices[ triIndex * 3 + 1 ];
		const i2 = blockerIndices[ triIndex * 3 + 2 ];

		_a.set(
			blockerPositions[ i0 * 3 ],
			blockerPositions[ i0 * 3 + 1 ],
			blockerPositions[ i0 * 3 + 2 ],
		);
		_b.set(
			blockerPositions[ i1 * 3 ],
			blockerPositions[ i1 * 3 + 1 ],
			blockerPositions[ i1 * 3 + 2 ],
		);
		_c.set(
			blockerPositions[ i2 * 3 ],
			blockerPositions[ i2 * 3 + 1 ],
			blockerPositions[ i2 * 3 + 2 ],
		);

		_ab.subVectors( _b, _a );
		_ac.subVectors( _c, _a );
		_n.crossVectors( _ab, _ac );

		if ( _n.lengthSq() < 0.0001 ) continue;

		_n.normalize();

		if ( Math.abs( _n.y ) >= 0.3 ) continue;

		const centroidX = ( _a.x + _b.x + _c.x ) / 3;
		const centroidY = ( _a.y + _b.y + _c.y ) / 3;
		const centroidZ = ( _a.z + _b.z + _c.z ) / 3;
		const maxY = Math.max( _a.y, _b.y, _c.y );
		const roadY = nearestRoadY( centroidY );

		if ( maxY - roadY < WALL_MIN_HEIGHT ) continue;

		const cellCX = ( Math.floor( centroidX / CELL_RAW ) + 0.5 ) * CELL_RAW;
		const cellCZ = ( Math.floor( centroidZ / CELL_RAW ) + 0.5 ) * CELL_RAW;
		const toCenterX = cellCX - centroidX;
		const toCenterZ = cellCZ - centroidZ;
		const inwardDot = _n.x * toCenterX + _n.z * toCenterZ;

		if ( inwardDot < 0.5 ) continue;

		const verts = [ _a, _b, _c ];

		for ( let edgeIndex = 0; edgeIndex < 3; edgeIndex ++ ) {

			const va = verts[ edgeIndex ];
			const vb = verts[ ( edgeIndex + 1 ) % 3 ];

			if ( va.y < maxY - 0.15 || vb.y < maxY - 0.15 ) continue;

			const ox = - _n.x * WALL_THICKNESS;
			const oz = - _n.z * WALL_THICKNESS;
			const topY = maxY + WALL_EXTEND_UP;

			addBarrierQuad(
				va.x, maxY, va.z,
				vb.x, maxY, vb.z,
				vb.x, topY, vb.z,
				va.x, topY, va.z,
			);

			addBarrierQuad(
				vb.x + ox, maxY, vb.z + oz,
				va.x + ox, maxY, va.z + oz,
				va.x + ox, topY, va.z + oz,
				vb.x + ox, topY, vb.z + oz,
			);

			addBarrierQuad(
				va.x, topY, va.z,
				vb.x, topY, vb.z,
				vb.x + ox, topY, vb.z + oz,
				va.x + ox, topY, va.z + oz,
			);

			const blockerOffset = blockerVertOffset;

			blockerPositions.push(
				_a.x + ox, _a.y, _a.z + oz,
				_b.x + ox, _b.y, _b.z + oz,
				_c.x + ox, _c.y, _c.z + oz,
			);
			blockerIndices.push(
				blockerOffset, blockerOffset + 1, blockerOffset + 2,
				blockerOffset + 2, blockerOffset + 1, blockerOffset,
			);
			blockerVertOffset += 3;

		}

	}

	return {
		barrierPositions: new Float32Array( barrierPositions ),
		barrierIndices: new Uint32Array( barrierIndices ),
	};

}

function buildSceneCollisionGeometry( sceneRoot, roadHeightHints = [ 0 ] ) {

	const supportPositions = [];
	const supportIndices = [];
	const blockerPositions = [];
	const blockerIndices = [];

	sceneRoot.updateMatrixWorld( true );

	sceneRoot.traverse( ( child ) => {

		if ( ! child.isMesh ) return;

		const geometry = child.geometry;
		const posAttr = geometry.getAttribute( 'position' );

		if ( ! posAttr ) return;

		const primitiveIndices = getPrimitiveIndexSlices( geometry );

		for ( const primitiveIndexArray of primitiveIndices ) {

			const classification = classifyTrackPrimitiveTriangles( posAttr.array, primitiveIndexArray );

			appendTransformedPrimitiveGeometry(
				supportPositions,
				supportIndices,
				posAttr,
				classification.supportIndices,
				child.matrixWorld,
			);

			appendTransformedPrimitiveGeometry(
				blockerPositions,
				blockerIndices,
				posAttr,
				classification.blockerIndices,
				child.matrixWorld,
			);

		}

	} );

	const barrierGeometry = buildBarrierGeometryFromBlockers( blockerPositions, blockerIndices, roadHeightHints );

	return {
		supportPositions: new Float32Array( supportPositions ),
		supportIndices: new Uint32Array( supportIndices ),
		blockerPositions: new Float32Array( blockerPositions ),
		blockerIndices: new Uint32Array( blockerIndices ),
		barrierPositions: barrierGeometry.barrierPositions,
		barrierIndices: barrierGeometry.barrierIndices,
	};

}

export function buildTrackCollisionGeometry( models, customCells ) {

	const cells = customCells || TRACK_CELLS;
	const dummy = new THREE.Object3D();
	const childMat = new THREE.Matrix4();
	const combinedMat = new THREE.Matrix4();
	const supportPositions = [];
	const supportIndices = [];
	const blockerPositions = [];
	const blockerIndices = [];
	const roadHeightHints = [];

	for ( const cell of cells ) {

		const [ gx, gz, key, orient ] = cell;
		const flags = cell[ 4 ] || {};

		if ( flags._collisionOnly ) {

			const elevY = elevToY( flags );
			appendCollisionOnlySupportQuad( supportPositions, supportIndices, gx, gz, elevY );
			roadHeightHints.push( elevY );
			continue;

		}

		const src = models[ key ];

		if ( ! src ) {

			console.warn( '[collider] missing model for tile:', key, 'at', gx, gz );
			continue;

		}

		const elevY = elevToY( flags );
		const deg = ORIENT_DEG[ orient ] ?? 0;
		roadHeightHints.push( elevY );

		dummy.position.set( ( gx + 0.5 ) * CELL_RAW, 0.5 + elevY, ( gz + 0.5 ) * CELL_RAW );
		dummy.rotation.set( 0, THREE.MathUtils.degToRad( deg ), 0 );
		dummy.updateMatrix();

		src.updateMatrixWorld( true );
		const srcInverse = src.matrixWorld.clone().invert();

		src.traverse( ( child ) => {

			if ( ! child.isMesh ) return;

			const geometry = child.geometry;
			const posAttr = geometry.getAttribute( 'position' );

			if ( ! posAttr ) return;

			childMat.copy( child.matrixWorld ).premultiply( srcInverse );
			combinedMat.multiplyMatrices( dummy.matrix, childMat );

			const primitiveIndices = getPrimitiveIndexSlices( geometry );

			for ( const primitiveIndexArray of primitiveIndices ) {

				const classification = classifyTrackPrimitiveTriangles( posAttr.array, primitiveIndexArray );

				appendTransformedPrimitiveGeometry(
					supportPositions,
					supportIndices,
					posAttr,
					classification.supportIndices,
					combinedMat,
				);

				appendTransformedPrimitiveGeometry(
					blockerPositions,
					blockerIndices,
					posAttr,
					classification.blockerIndices,
					combinedMat,
				);

			}

		} );

	}

	const barrierGeometry = buildBarrierGeometryFromBlockers( blockerPositions, blockerIndices, roadHeightHints );

	return {
		supportPositions: new Float32Array( supportPositions ),
		supportIndices: new Uint32Array( supportIndices ),
		blockerPositions: new Float32Array( blockerPositions ),
		blockerIndices: new Uint32Array( blockerIndices ),
		barrierPositions: barrierGeometry.barrierPositions,
		barrierIndices: barrierGeometry.barrierIndices,
	};

}

export function buildTrackColliders( world, models, customCells ) {

	const geometry = buildTrackCollisionGeometry( models, customCells );

	console.log(
		'[collider] support mesh:',
		geometry.supportPositions.length / 3,
		'verts,',
		geometry.supportIndices.length / 3,
		'tris'
	);
	console.log(
		'[collider] blocker mesh:',
		geometry.blockerPositions.length / 3,
		'verts,',
		geometry.blockerIndices.length / 3,
		'tris'
	);

	if ( geometry.supportPositions.length === 0 ) {

		console.error( '[collider] NO SUPPORT COLLIDER GEOMETRY — vehicle will fall through!' );
		return geometry;

	}

	const supportLayer = world._OL_TRACK_SUPPORT ?? world._OL_STATIC;
	const blockerLayer = world._OL_TRACK_BLOCKER ?? world._OL_STATIC;

	const supportBody = rigidBody.create( world, {
		shape: triangleMesh.create( {
			positions: geometry.supportPositions,
			indices: geometry.supportIndices,
		} ),
		motionType: MotionType.STATIC,
		objectLayer: supportLayer,
		friction: 5.0,
		restitution: 0.0,
	} );

	let blockerBody = null;

	if ( geometry.blockerPositions.length > 0 && geometry.blockerIndices.length > 0 ) {

		blockerBody = rigidBody.create( world, {
			shape: triangleMesh.create( {
				positions: geometry.blockerPositions,
				indices: geometry.blockerIndices,
			} ),
			motionType: MotionType.STATIC,
			objectLayer: blockerLayer,
			friction: 5.0,
			restitution: 0.0,
		} );

	}

	return {
		...geometry,
		supportBody,
		blockerBody,
	};

}

export function buildSingleTileCollider( world, glbScene ) {

	const roadHeightHints = [ glbScene.position?.y || 0 ];
	const geometry = buildSceneCollisionGeometry( glbScene, roadHeightHints );
	const supportLayer = world._OL_TRACK_SUPPORT ?? world._OL_STATIC;
	const blockerLayer = world._OL_TRACK_BLOCKER ?? world._OL_STATIC;

	rigidBody.create( world, {
		shape: triangleMesh.create( {
			positions: geometry.supportPositions,
			indices: geometry.supportIndices,
		} ),
		motionType: MotionType.STATIC,
		objectLayer: supportLayer,
		friction: 5.0,
		restitution: 0.0,
	} );

	if ( geometry.blockerPositions.length > 0 && geometry.blockerIndices.length > 0 ) {

		rigidBody.create( world, {
			shape: triangleMesh.create( {
				positions: geometry.blockerPositions,
				indices: geometry.blockerIndices,
			} ),
			motionType: MotionType.STATIC,
			objectLayer: blockerLayer,
			friction: 5.0,
			restitution: 0.0,
		} );

	}

}

export function removeVehicleBody( world, body ) {

	rigidBody.setPosition( world, body, [ 0, - 1000, 0 ], false );
	rigidBody.setLinearVelocity( world, body, [ 0, 0, 0 ] );
	rigidBody.setAngularVelocity( world, body, [ 0, 0, 0 ] );

}

export function resetPhysicsWorld( world, bodies ) {

	for ( const body of bodies ) {

		rigidBody.setPosition( world, body, [ 0, - 10000, 0 ], false );
		rigidBody.setLinearVelocity( world, body, [ 0, 0, 0 ] );
		rigidBody.setAngularVelocity( world, body, [ 0, 0, 0 ] );

	}

}

export function createVehicleBody( world, spawnPos ) {

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

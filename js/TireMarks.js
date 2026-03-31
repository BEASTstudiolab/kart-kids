import * as THREE from 'three';

const MAX_SEGMENTS = 4000;
const VERTS_PER_SEGMENT = 6; // 2 triangles
const BASE_WIDTH = 0.04;

const _posL = new THREE.Vector3();
const _posR = new THREE.Vector3();
const _right = new THREE.Vector3();

export class TireMarks {

	constructor( scene ) {

		this._scene = scene;
		this._writeIndex = 0;
		this._segmentCount = 0;

		// Previous wheel world positions (set on first sample)
		this._prevBL = null;
		this._prevBR = null;

		const geometry = new THREE.BufferGeometry();
		const positions = new Float32Array( MAX_SEGMENTS * VERTS_PER_SEGMENT * 3 );
		geometry.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
		geometry.setDrawRange( 0, 0 );

		const material = new THREE.MeshBasicMaterial( {
			color: 0x222222,
			transparent: true,
			opacity: 0.5,
			depthWrite: false,
			side: THREE.DoubleSide,
		} );

		this._mesh = new THREE.Mesh( geometry, material );
		this._mesh.renderOrder = 1; // Render above track surface
		this._mesh.frustumCulled = false;
		scene.add( this._mesh );

		this._positions = positions;
		this._geometry = geometry;

	}

	update( dt, vehicle ) {

		// Only emit during drift
		if ( vehicle.driftStage <= 0 || ! vehicle.wheelBL || ! vehicle.wheelBR ) {

			this._prevBL = null;
			this._prevBR = null;
			return;

		}

		// Get current rear wheel world positions at ground level
		vehicle.wheelBL.getWorldPosition( _posL );
		vehicle.wheelBR.getWorldPosition( _posR );

		const groundY = vehicle.container.position.y + 0.01;
		_posL.y = groundY;
		_posR.y = groundY;

		if ( this._prevBL === null ) {

			this._prevBL = _posL.clone();
			this._prevBR = _posR.clone();
			return;

		}

		// Width scales with drift intensity
		const width = BASE_WIDTH * THREE.MathUtils.clamp( vehicle.driftIntensity, 0.5, 2.0 );

		// Compute right vector from vehicle orientation for ribbon width
		_right.set( 1, 0, 0 ).applyQuaternion( vehicle.container.quaternion );
		_right.y = 0;
		_right.normalize();

		// Emit a segment for each rear wheel
		this._emitSegment( this._prevBL, _posL, _right, width );
		this._emitSegment( this._prevBR, _posR, _right, width );

		this._prevBL.copy( _posL );
		this._prevBR.copy( _posR );

	}

	_emitSegment( prev, curr, right, width ) {

		const i = this._writeIndex * VERTS_PER_SEGMENT * 3;
		this._writeIndex = ( this._writeIndex + 1 ) % MAX_SEGMENTS;

		// Quad: prev-left, prev-right, curr-left, curr-right
		const plx = prev.x - right.x * width;
		const plz = prev.z - right.z * width;
		const prx = prev.x + right.x * width;
		const prz = prev.z + right.z * width;
		const clx = curr.x - right.x * width;
		const clz = curr.z - right.z * width;
		const crx = curr.x + right.x * width;
		const crz = curr.z + right.z * width;
		const y = curr.y;

		// Triangle 1: prev-left, curr-left, prev-right
		this._positions[ i ] = plx;
		this._positions[ i + 1 ] = y;
		this._positions[ i + 2 ] = plz;
		this._positions[ i + 3 ] = clx;
		this._positions[ i + 4 ] = y;
		this._positions[ i + 5 ] = clz;
		this._positions[ i + 6 ] = prx;
		this._positions[ i + 7 ] = y;
		this._positions[ i + 8 ] = prz;

		// Triangle 2: prev-right, curr-left, curr-right
		this._positions[ i + 9 ] = prx;
		this._positions[ i + 10 ] = y;
		this._positions[ i + 11 ] = prz;
		this._positions[ i + 12 ] = clx;
		this._positions[ i + 13 ] = y;
		this._positions[ i + 14 ] = clz;
		this._positions[ i + 15 ] = crx;
		this._positions[ i + 16 ] = y;
		this._positions[ i + 17 ] = crz;

		if ( this._segmentCount < MAX_SEGMENTS ) this._segmentCount ++;

		this._geometry.attributes.position.needsUpdate = true;
		this._geometry.setDrawRange( 0, this._segmentCount * VERTS_PER_SEGMENT );

	}

	clear() {

		this._writeIndex = 0;
		this._segmentCount = 0;
		this._prevBL = null;
		this._prevBR = null;
		this._geometry.setDrawRange( 0, 0 );

	}

	dispose() {

		this._mesh.removeFromParent();
		this._geometry.dispose();
		this._mesh.material.dispose();

	}

}

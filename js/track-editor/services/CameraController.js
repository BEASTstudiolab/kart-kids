// ─── CameraController ────────────────────────────────────────────────────────
// Manages the orthographic camera for the editor viewport.
// Supports orbit, pan, zoom, view presets, and grid raycasting.

import * as THREE from 'three';
import { CELL_RAW } from '../../TrackConstants.js';

// View presets: { orbitAngle (rad), tiltAngle (rad) }
const VIEW_PRESETS = {
	top:   { orbit: 0,               tilt: Math.PI / 2 },
	iso:   { orbit: Math.PI / 4,     tilt: Math.PI / 5 },   // 35deg
	front: { orbit: 0,               tilt: Math.PI / 12.5 }, // 14deg
};

const DEFAULT_ZOOM = 1.5;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;
const CAMERA_DISTANCE = 200;


export class CameraController {

	/**
	 * @param {HTMLCanvasElement} canvas
	 * @param {import('three').Scene} scene
	 * @param {import('../core/EventBus.js').EventBus} eventBus
	 */
	constructor( canvas, scene, eventBus ) {

		this._canvas = canvas;
		this._scene = scene;
		this._eventBus = eventBus;

		// Camera target (world point the camera looks at)
		this._target = new THREE.Vector3( 0, 0, 0 );

		// Orbit angle (around Y axis) and tilt angle (from ground)
		this._orbitAngle = VIEW_PRESETS.iso.orbit;
		this._tiltAngle = VIEW_PRESETS.iso.tilt;

		// Zoom
		this._zoom = DEFAULT_ZOOM;

		// Create camera
		const aspect = canvas.clientWidth / canvas.clientHeight;
		const frustumSize = 60;
		this.camera = new THREE.OrthographicCamera(
			- frustumSize * aspect / 2,
			frustumSize * aspect / 2,
			frustumSize / 2,
			- frustumSize / 2,
			0.1,
			5000
		);

		// Raycaster for grid picking
		this._raycaster = new THREE.Raycaster();
		this._groundPlane = new THREE.Plane( new THREE.Vector3( 0, 1, 0 ), 0 );

		// Chase preview state
		this._chaseAnimating = false;
		this._chaseSequence = [];
		this._chaseStartTime = 0;
		this._chaseSpeed = 300;

		this._updateCameraPosition();

	}

	// ── View presets ──

	/**
	 * @param {'top'|'iso'|'front'} name
	 */
	setView( name ) {

		const preset = VIEW_PRESETS[ name ];
		if ( ! preset ) return;

		this._orbitAngle = preset.orbit;
		this._tiltAngle = preset.tilt;
		this._updateCameraPosition();
		this._emitMoved();

	}

	/** @returns {string} Current view name (closest preset), or 'custom'. */
	get currentView() {

		for ( const [ name, preset ] of Object.entries( VIEW_PRESETS ) ) {

			if ( Math.abs( this._tiltAngle - preset.tilt ) < 0.01 &&
				Math.abs( this._orbitAngle - preset.orbit ) < 0.01 ) {

				return name;

			}

		}

		return 'custom';

	}

	// ── Controls ──

	/**
	 * Pan the camera target along screen-space axes.
	 * @param {number} dx  Screen-space X delta
	 * @param {number} dy  Screen-space Y delta
	 */
	pan( dx, dy ) {

		const { right, forward } = this._getCameraPanAxes();

		// Scale by zoom: less zoom = more pan per pixel
		const scale = 0.5 / this._zoom;

		this._target.addScaledVector( right, - dx * scale );
		this._target.addScaledVector( forward, dy * scale );

		this._updateCameraPosition();
		this._emitMoved();

	}

	/**
	 * Orbit the camera around the target.
	 * @param {number} dx  Horizontal delta (orbit angle)
	 * @param {number} dy  Vertical delta (tilt angle)
	 */
	orbit( dx, dy ) {

		this._orbitAngle += dx * 0.005;
		this._tiltAngle = Math.max( 0.05, Math.min( Math.PI / 2, this._tiltAngle + dy * 0.005 ) );

		this._updateCameraPosition();
		this._emitMoved();

	}

	/**
	 * Zoom in/out.
	 * @param {number} delta  Positive = zoom in, negative = zoom out
	 */
	zoom( delta ) {

		this._zoom *= 1 + delta * 0.001;
		this._zoom = Math.max( MIN_ZOOM, Math.min( MAX_ZOOM, this._zoom ) );

		this.camera.zoom = this._zoom;
		this.camera.updateProjectionMatrix();

		this._emitMoved();

	}

	/**
	 * Center camera on a grid cell.
	 * @param {number} gx
	 * @param {number} gz
	 */
	focusCell( gx, gz ) {

		this._target.set(
			( gx + 0.5 ) * CELL_RAW,
			0,
			( gz + 0.5 ) * CELL_RAW
		);

		this._updateCameraPosition();
		this._emitMoved();

	}

	/** Fit the camera to frame the entire track. */
	frameTrack() {

		// Default: center on origin
		this._target.set( 0, 0, 0 );
		this._zoom = DEFAULT_ZOOM;
		this.camera.zoom = this._zoom;
		this.camera.updateProjectionMatrix();

		this._updateCameraPosition();
		this._emitMoved();

	}

	/**
	 * Focus the next validation issue. Cycles through issues with locus data.
	 * @param {Array} issues  Array of { locus: { gx, gz } | null }
	 * @returns {{ gx: number, gz: number }|null} The focused cell, or null if no issues.
	 */
	focusNextIssue( issues ) {

		const withLocus = issues.filter( i => i.locus && i.locus.gx != null );
		if ( withLocus.length === 0 ) return null;

		this._issueIndex = ( ( this._issueIndex ?? - 1 ) + 1 ) % withLocus.length;
		const issue = withLocus[ this._issueIndex ];

		this.focusCell( issue.locus.gx, issue.locus.gz );
		return { gx: issue.locus.gx, gz: issue.locus.gz };

	}

	// ── Chase Preview ──

	/**
	 * Start chase preview: animate camera along a route sequence.
	 * @param {Array<{ gx: number, gz: number }>} sequence
	 * @param {number} [speed=300]  Milliseconds per cell
	 */
	chaseRoute( sequence, speed = 300 ) {

		if ( ! sequence || sequence.length < 2 ) return;
		this._chaseSequence = sequence;
		this._chaseStartTime = Date.now();
		this._chaseSpeed = speed;
		this._chaseAnimating = true;

		// Lower tilt for chase view
		this._tiltAngle = Math.PI / 6;
		this._zoom = 2.5;

	}

	/** Stop chase preview. */
	stopChase() {

		this._chaseAnimating = false;

	}

	/** @returns {boolean} */
	get isChasing() { return this._chaseAnimating; }

	/**
	 * Update chase animation. Call this in the render loop.
	 */
	updateChase() {

		if ( ! this._chaseAnimating ) return;

		const elapsed = Date.now() - this._chaseStartTime;
		const progress = elapsed / this._chaseSpeed;
		const idx = Math.floor( progress );

		if ( idx >= this._chaseSequence.length ) {

			// Loop back to start
			this._chaseStartTime = Date.now();
			return;

		}

		const cell = this._chaseSequence[ idx ];
		const nextIdx = Math.min( idx + 1, this._chaseSequence.length - 1 );
		const nextCell = this._chaseSequence[ nextIdx ];

		// Smooth interpolation between cells
		const t = progress - idx;
		const x = ( cell.gx + 0.5 + ( nextCell.gx - cell.gx ) * t ) * CELL_RAW;
		const z = ( cell.gz + 0.5 + ( nextCell.gz - cell.gz ) * t ) * CELL_RAW;

		this._target.set( x, 0, z );

		// Slowly orbit as we move
		this._orbitAngle += 0.002;

		this._updateCameraPosition();

	}

	// ── Raycasting ──

	/**
	 * Convert screen coordinates to grid cell.
	 * @param {number} clientX
	 * @param {number} clientY
	 * @returns {{ gx: number, gz: number }|null}
	 */
	screenToGrid( clientX, clientY ) {

		const rect = this._canvas.getBoundingClientRect();
		const ndc = new THREE.Vector2(
			( ( clientX - rect.left ) / rect.width ) * 2 - 1,
			- ( ( clientY - rect.top ) / rect.height ) * 2 + 1
		);

		this._raycaster.setFromCamera( ndc, this.camera );

		const intersection = new THREE.Vector3();
		const hit = this._raycaster.ray.intersectPlane( this._groundPlane, intersection );
		if ( ! hit ) return null;

		const gx = Math.floor( intersection.x / CELL_RAW );
		const gz = Math.floor( intersection.z / CELL_RAW );

		return { gx, gz, worldX: intersection.x, worldZ: intersection.z };

	}

	// ── Resize ──

	/**
	 * Call when the canvas container resizes.
	 * @param {number} width
	 * @param {number} height
	 */
	resize( width, height ) {

		const aspect = width / height;
		const frustumSize = 60;

		this.camera.left = - frustumSize * aspect / 2;
		this.camera.right = frustumSize * aspect / 2;
		this.camera.top = frustumSize / 2;
		this.camera.bottom = - frustumSize / 2;
		this.camera.updateProjectionMatrix();

	}

	// ── Private ──

	/** @private Recompute camera position from orbit/tilt/target. */
	_updateCameraPosition() {

		const x = Math.sin( this._orbitAngle ) * Math.cos( this._tiltAngle ) * CAMERA_DISTANCE;
		const y = Math.sin( this._tiltAngle ) * CAMERA_DISTANCE;
		const z = Math.cos( this._orbitAngle ) * Math.cos( this._tiltAngle ) * CAMERA_DISTANCE;

		this.camera.position.set(
			this._target.x + x,
			this._target.y + y,
			this._target.z + z
		);

		this.camera.lookAt( this._target );
		this.camera.zoom = this._zoom;
		this.camera.updateProjectionMatrix();

	}

	/**
	 * @private Get camera-relative pan axes projected onto ground plane.
	 * @returns {{ right: THREE.Vector3, forward: THREE.Vector3 }}
	 */
	_getCameraPanAxes() {

		const right = new THREE.Vector3(
			Math.cos( this._orbitAngle ),
			0,
			- Math.sin( this._orbitAngle )
		);

		const forward = new THREE.Vector3(
			- Math.sin( this._orbitAngle ),
			0,
			- Math.cos( this._orbitAngle )
		);

		return { right, forward };

	}

	/** @private */
	_emitMoved() {

		this._eventBus.emit( 'camera:moved', {
			target: this._target.clone(),
			orbitAngle: this._orbitAngle,
			tiltAngle: this._tiltAngle,
			zoom: this._zoom,
		} );

	}

}

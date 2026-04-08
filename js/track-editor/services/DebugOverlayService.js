// ─── DebugOverlayService ─────────────────────────────────────────────────────
// Debug drawer with individual toggle checkboxes for each overlay type.
// Shows tile labels, sequence numbers, elevations, and more.

import * as THREE from 'three';
import { CELL_RAW } from '../../TrackConstants.js';
import { ELEV_GROUND } from '../models/TrackProject.js';

const Y_PER_STEP = 2.416;

// Debug toggle options
const DEBUG_TOGGLES = [
	{ id: 'tileNames',       label: 'Tile Names',         default: true },
	{ id: 'tileIds',         label: 'Tile IDs (cell)',     default: false },
	{ id: 'sequenceNumbers', label: 'Sequence Numbers',    default: true },
	{ id: 'footprintBounds', label: 'Footprint Bounds',    default: false },
	{ id: 'elevations',      label: 'Elevations',          default: true },
	{ id: 'routePath',       label: 'Route Path',          default: false },
	{ id: 'clearanceChecks', label: 'Clearance Checks',    default: false },
	{ id: 'occupiedCells',   label: 'Occupied Cells',      default: false },
	{ id: 'invalidPlacements', label: 'Invalid Placements', default: false },
	{ id: 'markerNames',     label: 'Marker Names',        default: true },
];

export class DebugOverlayService {

	constructor( project, camera, eventBus ) {

		this._project = project;
		this._camera = camera;
		this._eventBus = eventBus;

		this._enabled = false;
		this._toggles = {};
		for ( const t of DEBUG_TOGGLES ) this._toggles[ t.id ] = t.default;

		this._tooltipEl = null;
		this._drawerEl = null;

		/** Three.js group for persistent debug labels. */
		this.labelGroup = new THREE.Group();
		this.labelGroup.name = 'debug-labels';
		this.labelGroup.visible = false;

		this._createTooltip();
		this._createDrawer();

		// Rebuild labels when tiles change
		const rebuild = () => { if ( this._enabled ) this._rebuildLabels(); };
		eventBus.on( 'tile:placed', rebuild );
		eventBus.on( 'tile:erased', rebuild );
		eventBus.on( 'tile:changed', rebuild );
		eventBus.on( 'elevation:changed', rebuild );
		eventBus.on( 'project:loaded', rebuild );

	}

	get enabled() { return this._enabled; }

	setEnabled( enabled ) {

		this._enabled = enabled;
		this.labelGroup.visible = enabled;

		if ( this._drawerEl ) this._drawerEl.style.display = enabled ? 'block' : 'none';

		if ( enabled ) {

			this._rebuildLabels();

		} else {

			this.hideTooltip();

		}

	}

	/** Get current toggle state. */
	getToggle( id ) { return this._toggles[ id ] ?? false; }

	/** Set a toggle and rebuild. */
	setToggle( id, value ) {

		this._toggles[ id ] = value;
		if ( this._enabled ) this._rebuildLabels();

	}

	updateTooltip( gx, gz, clientX, clientY ) {

		if ( ! this._enabled ) return;

		const tile = this._project.getTile( gx, gz );
		if ( ! tile ) { this.hideTooltip(); return; }

		const elevStep = tile._derivedElevation || tile.elevation || ELEV_GROUND;
		const elevM = ( ( elevStep - ELEV_GROUND ) * 2.5 ).toFixed( 1 );

		const parts = [
			`${ gx },${ gz }`,
			tile.type.replace( 'trk-', '' ),
			`orient:${ tile.orient }`,
			`${ elevM }m`,
		];

		if ( tile.curveVariant ) parts.push( `curve:${ tile.curveVariant }` );
		if ( tile.autoRamp ) parts.push( 'auto-ramp' );
		if ( tile.isFinish ) parts.push( 'FINISH' );
		if ( tile._consumed ) parts.push( 'consumed' );

		this._tooltipEl.textContent = parts.join( ' | ' );
		this._tooltipEl.style.display = 'block';

	}

	hideTooltip() {

		if ( this._tooltipEl ) this._tooltipEl.style.display = 'none';

	}

	// ── Private: Labels ──

	_rebuildLabels() {

		while ( this.labelGroup.children.length > 0 ) {

			this.labelGroup.remove( this.labelGroup.children[ 0 ] );

		}

		const show = this._toggles;
		let seqIndex = 0;

		for ( const [ key, tile ] of this._project.getGrid() ) {

			if ( tile._consumed || tile.finishFlank ) continue;

			const [ gx, gz ] = key.split( ',' ).map( Number );
			const elevStep = tile._derivedElevation || tile.elevation || ELEV_GROUND;
			const worldX = ( gx + 0.5 ) * CELL_RAW;
			const worldZ = ( gz + 0.5 ) * CELL_RAW;
			const worldY = ( elevStep - ELEV_GROUND ) * Y_PER_STEP + 2.5;

			seqIndex ++;

			// Build label lines
			const lines = [];
			if ( show.sequenceNumbers ) lines.push( `#${ seqIndex }` );
			if ( show.tileNames ) lines.push( tile.type.replace( 'trk-', '' ) );
			if ( show.tileIds ) lines.push( `[${ gx },${ gz }]` );
			if ( show.elevations ) {

				const m = ( ( elevStep - ELEV_GROUND ) * 2.5 ).toFixed( 1 );
				if ( elevStep !== ELEV_GROUND ) lines.push( `${ m }m` );

			}

			if ( lines.length === 0 ) continue;

			const sprite = this._createLabelSprite( lines.join( ' ' ), tile );
			sprite.position.set( worldX, worldY, worldZ );
			this.labelGroup.add( sprite );

			// Footprint bounds overlay
			if ( show.footprintBounds ) {

				const boxGeo = new THREE.PlaneGeometry( CELL_RAW * 0.98, CELL_RAW * 0.98 );
				const boxMat = new THREE.MeshBasicMaterial( {
					color: 0xffd600, transparent: true, opacity: 0.08,
					depthWrite: false, side: THREE.DoubleSide,
				} );
				const box = new THREE.Mesh( boxGeo, boxMat );
				box.rotation.x = - Math.PI / 2;
				box.position.set( worldX, ( elevStep - ELEV_GROUND ) * Y_PER_STEP + 0.04, worldZ );
				this.labelGroup.add( box );

			}

			// Occupied cell highlight
			if ( show.occupiedCells ) {

				const geo = new THREE.PlaneGeometry( CELL_RAW * 0.9, CELL_RAW * 0.9 );
				const mat = new THREE.MeshBasicMaterial( {
					color: 0x3b82f6, transparent: true, opacity: 0.1,
					depthWrite: false, side: THREE.DoubleSide,
				} );
				const plane = new THREE.Mesh( geo, mat );
				plane.rotation.x = - Math.PI / 2;
				plane.position.set( worldX, 0.03, worldZ );
				this.labelGroup.add( plane );

			}

		}

	}

	_createLabelSprite( text, tile ) {

		const canvas = document.createElement( 'canvas' );
		canvas.width = 256;
		canvas.height = 40;
		const ctx = canvas.getContext( '2d' );

		ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
		ctx.roundRect( 0, 0, 256, 40, 4 );
		ctx.fill();

		let color = '#ffd600';
		if ( tile.isFinish ) color = '#ff3a8c';
		else if ( tile.autoRamp ) color = '#f59e0b';
		else if ( tile.type === 'trk-corner-1x1' ) color = '#00d4e8';
		else if ( tile.type.startsWith( 'trk-elev-' ) ) color = '#22c55e';
		else if ( tile.type.startsWith( 'trk-junction-' ) ) color = '#a855f7';
		else if ( tile.type.startsWith( 'trk-bridge-' ) ) color = '#3b82f6';

		ctx.fillStyle = color;
		ctx.font = 'bold 18px monospace';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText( text, 128, 20 );

		ctx.fillStyle = color;
		ctx.fillRect( 0, 0, 3, 40 );

		const texture = new THREE.CanvasTexture( canvas );
		texture.minFilter = THREE.LinearFilter;

		const mat = new THREE.SpriteMaterial( { map: texture, transparent: true, depthTest: false } );
		const sprite = new THREE.Sprite( mat );
		sprite.scale.set( 4, 0.7, 1 );
		return sprite;

	}

	// ── Private: UI ──

	_createTooltip() {

		this._tooltipEl = document.createElement( 'div' );
		this._tooltipEl.style.cssText = `
			position: fixed;
			top: 56px;
			left: 50%;
			transform: translateX(-50%);
			background: rgba(10,10,20,0.92);
			backdrop-filter: blur(4px);
			color: #e5e5e5;
			font-family: monospace;
			font-size: 11px;
			padding: 6px 14px;
			border-radius: 6px;
			border: 1px solid rgba(255,255,255,0.15);
			pointer-events: none;
			z-index: 200;
			display: none;
			text-align: center;
		`;
		document.body.appendChild( this._tooltipEl );

	}

	/** Create the debug drawer panel with toggle checkboxes. */
	_createDrawer() {

		this._drawerEl = document.createElement( 'div' );
		this._drawerEl.style.cssText = `
			position: fixed;
			top: 56px;
			right: 292px;
			background: rgba(10,10,20,0.92);
			backdrop-filter: blur(6px);
			border: 1px solid rgba(255,255,255,0.12);
			border-radius: 8px;
			padding: 10px 14px;
			z-index: 150;
			display: none;
			font-family: monospace;
			font-size: 11px;
			color: #ccc;
			min-width: 180px;
		`;

		const title = document.createElement( 'div' );
		title.textContent = 'DEBUG OVERLAYS';
		title.style.cssText = 'font-weight:bold;color:#ffd600;margin-bottom:8px;font-size:10px;letter-spacing:0.08em';
		this._drawerEl.appendChild( title );

		for ( const t of DEBUG_TOGGLES ) {

			const row = document.createElement( 'label' );
			row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:2px 0;cursor:pointer';

			const cb = document.createElement( 'input' );
			cb.type = 'checkbox';
			cb.checked = this._toggles[ t.id ];
			cb.style.cssText = 'accent-color:#00d4e8;cursor:pointer';
			cb.addEventListener( 'change', () => this.setToggle( t.id, cb.checked ) );

			const label = document.createTextNode( t.label );
			row.appendChild( cb );
			row.appendChild( label );
			this._drawerEl.appendChild( row );

		}

		document.body.appendChild( this._drawerEl );

	}

}

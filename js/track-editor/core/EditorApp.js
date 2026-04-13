// ─── EditorApp ───────────────────────────────────────────────────────────────
// Top-level coordinator for the Track Editor v2.
// Bootstraps Three.js, creates all services, wires event subscriptions,
// and starts the render loop.

import * as THREE from 'three';
import { CELL_RAW } from '../../TrackConstants.js';

// Core
import { EventBus } from './EventBus.js';
import { EditorState } from './EditorState.js';
import { CommandHistory } from './CommandHistory.js';

// Models
import { TrackProject } from '../models/TrackProject.js';

// Services
import { TileLibrary } from '../services/TileLibrary.js';
import { MeshFactory } from '../services/MeshFactory.js';
import { AutoTileService } from '../services/AutoTileService.js';
import { CurveService } from '../services/CurveService.js';
import { ElevationController } from '../services/ElevationController.js';
import { CameraController } from '../services/CameraController.js';
import { InputController } from '../services/InputController.js';
import { PlacementController } from '../services/PlacementController.js';
import { SelectionController } from '../services/SelectionController.js';
import { TransformController } from '../services/TransformController.js';
import { ValidationService } from '../services/ValidationService.js';
import { PublishValidationService } from '../services/PublishValidationService.js';
import { DebugOverlayService } from '../services/DebugOverlayService.js';
import { ShareLinkService } from '../services/ShareLinkService.js';
import { TestDriveController } from '../services/TestDriveController.js';
import { ThemeService } from '../services/ThemeService.js';
import { OccupancyGrid } from '../services/OccupancyGrid.js';
import { LightingService } from '../services/LightingService.js';
import { ProjectStorageService } from '../services/ProjectStorageService.js';
import { RouteTraceController } from '../services/RouteTraceController.js';

// Modes
import { BuildMode } from '../modes/BuildMode.js';
import { SculptMode } from '../modes/SculptMode.js';
import { GameplayMode } from '../modes/GameplayMode.js';
import { PropsMode } from '../modes/PropsMode.js';
import { ThemeMode } from '../modes/ThemeMode.js';
import { DebugMode } from '../modes/DebugMode.js';

// UI
import { MinimapRenderer } from '../ui/MinimapRenderer.js';
import { StatsPanel } from '../ui/StatsPanel.js';
import { TileThumbnailRenderer } from '../ui/TileThumbnailRenderer.js';
import { RadialMenu } from '../ui/RadialMenu.js';
import { CompassOverlay } from '../ui/CompassOverlay.js';
import { RouteAnalysisService } from '../services/RouteAnalysisService.js';
import { PublishedTrackApi } from '../../track-library/PublishedTrackApi.js';
import { TrackLibraryStore } from '../../track-library/TrackLibraryStore.js';
import { Settings } from '../../Settings.js';

// ── Grid helper settings ──
const GRID_LINES = 40;
const GRID_SIZE = GRID_LINES * CELL_RAW;


class EditorApp {

	constructor() {

		this._running = false;
		this._animFrameId = null;
		this._manageToken = null;
		this._managedTrack = null;

	}

	async init() {

		// ── Desktop gate ──
		this._checkDesktop();

		// ── Three.js setup ──
		const canvas = document.getElementById( 'editor-canvas' );
		const viewport = document.getElementById( 'editor-viewport' );

		this._renderer = new THREE.WebGLRenderer( { canvas, antialias: true } );
		this._renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
		this._renderer.setClearColor( 0x0a0a0a );
		this._renderer.shadowMap.enabled = true;
		this._renderer.shadowMap.type = THREE.PCFShadowMap;

		this._scene = new THREE.Scene();

		// ── Lighting ──
		this._ambientLight = new THREE.AmbientLight( 0x404060, 0.6 );
		this._scene.add( this._ambientLight );

		this._dirLight = new THREE.DirectionalLight( 0xffffff, 1.2 );
		const dirLight = this._dirLight;
		dirLight.position.set( 50, 80, 30 );
		dirLight.castShadow = true;
		dirLight.shadow.mapSize.set( 2048, 2048 );
		dirLight.shadow.camera.near = 0.5;
		dirLight.shadow.camera.far = 200;
		dirLight.shadow.camera.left = - 100;
		dirLight.shadow.camera.right = 100;
		dirLight.shadow.camera.top = 100;
		dirLight.shadow.camera.bottom = - 100;
		this._scene.add( dirLight );

		// ── Ground plane ──
		const groundGeo = new THREE.PlaneGeometry( GRID_SIZE * 8, GRID_SIZE * 8 );
		const groundMat = new THREE.MeshStandardMaterial( {
			color: 0x111118,
			roughness: 0.9,
			transparent: true,
			opacity: 0.4,
			depthWrite: false,
		} );
		const ground = new THREE.Mesh( groundGeo, groundMat );
		ground.rotation.x = - Math.PI / 2;
		ground.receiveShadow = true;
		ground.renderOrder = - 1; // Render first so underground tiles show through
		this._scene.add( ground );

		// ── Grid helper ──
		this._gridHelper = new THREE.GridHelper( GRID_SIZE, GRID_LINES, 0x222233, 0x1a1a2a );
		const gridHelper = this._gridHelper;
		gridHelper.position.set( 0, 0.01, 0 );
		this._scene.add( gridHelper );

		// ── Cell indicator ──
		const indicatorGeo = new THREE.PlaneGeometry( CELL_RAW, CELL_RAW );
		const indicatorMat = new THREE.MeshBasicMaterial( {
			color: 0x00d4e8,
			transparent: true,
			opacity: 0.15,
			depthWrite: false,
			side: THREE.DoubleSide,
		} );
		this._cellIndicator = new THREE.Mesh( indicatorGeo, indicatorMat );
		this._cellIndicator.rotation.x = - Math.PI / 2;
		this._cellIndicator.position.y = 0.02;
		this._cellIndicator.visible = false;
		this._scene.add( this._cellIndicator );

		// ── Core systems ──
		this._eventBus = new EventBus();
		this._state = new EditorState( this._eventBus );
		this._commandHistory = new CommandHistory( this._eventBus );
		this._project = new TrackProject();

		this._scene.add( this._project.trackGroup );

		// ── Tile Library (load models) ──
		this._tileLibrary = new TileLibrary();

		console.log( '[EditorApp] Loading models...' );
		await this._tileLibrary.preloadAll( ( loaded, total ) => {

			const pct = Math.round( ( loaded / total ) * 100 );
			console.log( `[EditorApp] Models: ${ loaded }/${ total } (${ pct }%)` );

		} );

		console.log( '[EditorApp] Models loaded.' );

		// ── Services ──
		this._meshFactory = new MeshFactory( this._tileLibrary, this._project );
		this._autoTile = new AutoTileService( this._project, this._meshFactory, this._eventBus );
		this._curveService = new CurveService( this._project, this._tileLibrary, this._eventBus );
		this._elevController = new ElevationController( this._project, this._meshFactory, this._eventBus );

		this._camera = new CameraController( canvas, this._scene, this._eventBus );
		this._camera.setView( 'iso' );

		this._occupancy = new OccupancyGrid();

		this._placement = new PlacementController(
			this._project, this._meshFactory, this._autoTile,
			this._commandHistory, this._eventBus, this._state, this._occupancy
		);
		this._scene.add( this._placement.ghostGroup );

		this._selection = new SelectionController( this._project, this._state, this._eventBus );
		this._scene.add( this._selection.indicatorGroup );

		this._transform = new TransformController(
			this._project, this._meshFactory, this._autoTile,
			this._commandHistory, this._eventBus
		);

		this._validation = new ValidationService( this._project, this._eventBus );
		this._publishValidation = new PublishValidationService( this._validation, this._project );
		this._debugOverlay = new DebugOverlayService( this._project, this._camera, this._eventBus );
		this._scene.add( this._debugOverlay.labelGroup );
		this._shareLink = new ShareLinkService( this._project );
		this._testDrive = new TestDriveController( this._shareLink, this._validation );
		this._publishedTrackApi = new PublishedTrackApi();
		this._trackLibrary = new TrackLibraryStore();
		this._themeService = new ThemeService( this._project );
		this._routeAnalysis = new RouteAnalysisService( this._project );
		this._routeTrace = new RouteTraceController( {
			state: this._state,
			debugOverlay: this._debugOverlay,
			eventBus: this._eventBus,
			validation: this._validation,
			routeAnalysis: this._routeAnalysis,
			camera: this._camera,
			controls: {
				root: document.getElementById( 'editor-route-trace-controls' ),
				play: document.getElementById( 'route-trace-play' ),
				pause: document.getElementById( 'route-trace-pause' ),
			},
		} );
		this._radialMenu = new RadialMenu( this._eventBus );
		this._compassOverlay = new CompassOverlay( {
			eventBus: this._eventBus,
			roseEl: document.querySelector( '[data-role="compass-rose"]' ),
		} );
		this._lighting = new LightingService(
			this._scene, this._ambientLight, this._dirLight,
			this._gridHelper, this._eventBus
		);

		this._storage = new ProjectStorageService(
			this._project, this._meshFactory, this._autoTile, this._eventBus
		);

		// ── Input ──
		this._input = new InputController(
			canvas, this._state, this._eventBus,
			this._camera, this._commandHistory, this._transform
		);

		// ── Modes ──
		const buildMode = new BuildMode(
			this._state, this._eventBus,
			this._placement, this._commandHistory
		);
		buildMode.setElevationController( this._elevController );
		this._input.registerMode( 'build', buildMode );

		const sculptMode = new SculptMode(
			this._state, this._eventBus,
			this._selection, this._transform, this._elevController,
			this._curveService, this._commandHistory,
			this._project, this._meshFactory
		);
		this._input.registerMode( 'sculpt', sculptMode );

		const gameplayMode = new GameplayMode( this._state, this._eventBus, this._project );
		this._scene.add( gameplayMode.markerGroup );
		this._input.registerMode( 'gameplay', gameplayMode );

		const propsMode = new PropsMode(
			this._state, this._eventBus, this._project,
			this._tileLibrary, this._occupancy, this._camera
		);
		this._scene.add( propsMode.propsGroup );
		this._scene.add( propsMode.ghostGroup );
		this._input.registerMode( 'props', propsMode );

		this._input.registerMode( 'theme', new ThemeMode( this._state, this._eventBus ) );
		this._input.registerMode( 'debug', new DebugMode( this._state, this._eventBus, this._debugOverlay ) );

		// ── Wire events ──
		this._wireEvents();

		// ── Build UI ──
		this._buildTopBar();
		this._buildToolRail();
		this._buildCarousel();
		this._buildStatusBar();
		this._buildInspector();

		// ── Minimap + Stats ──
		const minimapCanvas = document.getElementById( 'minimap-canvas' );
		this._minimap = new MinimapRenderer( minimapCanvas, this._project, this._eventBus );

		const statsEl = document.getElementById( 'editor-stats' );
		this._stats = new StatsPanel( statsEl, this._project, this._eventBus );

		// ── Load saved project ──
		const loaded = await this._loadInitialProject();
		if ( ! loaded ) {

			console.log( '[EditorApp] No saved track. Starting empty.' );

		}

		// Derive elevation ramps, curves, occupancy, and markers after load
		if ( loaded ) {

			this._elevController.deriveRampsFromElevation();
			this._curveService.deriveAllCurves();
			this._occupancy.rebuildFromProject( this._project );

			// Restore gameplay markers
			if ( this._project._pendingMarkers ) {

				const gm = this._input._modes.get( 'gameplay' );
				if ( gm && gm.loadFromJSON ) gm.loadFromJSON( this._project._pendingMarkers );
				this._project._pendingMarkers = null;

			}

			// Restore props
			if ( this._project._pendingProps ) {

				const pm = this._input._modes.get( 'props' );
				if ( pm && pm.loadFromJSON ) pm.loadFromJSON( this._project._pendingProps );
				this._project._pendingProps = null;

			}

		}

		this._syncTopbarProjectState();
		this._syncPublishUi();

		// ── Resize handling ──
		this._onResize();
		window.addEventListener( 'resize', () => this._onResize() );

		// ── Start render loop ──
		this._running = true;
		this._animate();

		console.log( '[EditorApp] Ready.' );

	}

	// ── Render loop ──

	/** @private */
	_animate() {

		if ( ! this._running ) return;

		this._animFrameId = requestAnimationFrame( () => this._animate() );

		// Update chase camera if active
		this._camera.updateChase();

		this._renderer.render( this._scene, this._camera.camera );

	}

	// ── Resize ──

	/** @private */
	_onResize() {

		const viewport = document.getElementById( 'editor-viewport' );
		const w = viewport.clientWidth;
		const h = viewport.clientHeight;

		this._renderer.setSize( w, h );
		this._camera.resize( w, h );

	}

	// ── Desktop gate ──

	/** @private */
	_checkDesktop() {

		if ( window.innerWidth < 1024 || window.innerHeight < 600 ) {

			console.warn( '[EditorApp] Viewport is small (%dx%d). Editor works best at 1280x720+.', window.innerWidth, window.innerHeight );

		}

	}


	// ── Event wiring ──

	/** @private */
	_wireEvents() {

		// Cell hover → cell indicator + store on state
		this._eventBus.on( 'hover:cell', ( cell ) => {

			this._state.hoveredCell = cell;

			if ( cell ) {

				this._cellIndicator.position.x = ( cell.gx + 0.5 ) * CELL_RAW;
				this._cellIndicator.position.z = ( cell.gz + 0.5 ) * CELL_RAW;
				this._cellIndicator.visible = true;

			} else {

				this._cellIndicator.visible = false;

			}

		} );

		// Autosave + rebuild occupancy on tile changes
		const onTileChange = () => {

			// Include markers and props in the save payload
			const gm = this._input._modes.get( 'gameplay' );
			if ( gm && gm.toJSON ) this._project._pendingMarkers = gm.toJSON();

			const pm = this._input._modes.get( 'props' );
			if ( pm && pm.toJSON ) this._project._pendingProps = pm.toJSON();

			this._storage.save();
			this._occupancy.rebuildFromProject( this._project );

		};

		this._eventBus.on( 'tile:placed', onTileChange );
		this._eventBus.on( 'tile:erased', onTileChange );
		this._eventBus.on( 'tile:changed', onTileChange );
		this._eventBus.on( 'elevation:changed', onTileChange );
		this._eventBus.on( 'prop:placed', onTileChange );
		this._eventBus.on( 'prop:erased', onTileChange );
		this._eventBus.on( 'prop:rotated', onTileChange );
		this._eventBus.on( 'marker:placed', onTileChange );
		this._eventBus.on( 'marker:removed', onTileChange );
		this._eventBus.on( 'project:loaded', () => this._occupancy.rebuildFromProject( this._project ) );
		this._eventBus.on( 'project:cleared', () => this._occupancy.rebuildFromProject( this._project ) );

		// Undo/redo → update UI
		this._eventBus.on( 'undo:stateChanged', ( data ) => {

			const undoBtn = document.getElementById( 'topbar-undo' );
			const redoBtn = document.getElementById( 'topbar-redo' );
			if ( undoBtn ) undoBtn.disabled = ! data.canUndo;
			if ( redoBtn ) redoBtn.disabled = ! data.canRedo;

		} );

		// Radial menu actions
		this._eventBus.on( 'radial-menu:action', ( data ) => {

			const { action, gx, gz } = data;

			if ( action === 'rotate' ) this._transform.rotateTile( gx, gz );
			else if ( action === 'elevate-up' ) this._elevController.raiseElevation( gx, gz );
			else if ( action === 'elevate-down' ) this._elevController.lowerElevation( gx, gz );
			else if ( action === 'duplicate' ) {

				const sm = this._input._modes.get( 'sculpt' );
				if ( sm && sm._duplicateTile ) sm._duplicateTile( gx, gz );

			}
			else if ( action === 'delete' ) {

				this._transform.deleteSelected( new Set( [ this._project.cellKey( gx, gz ) ] ) );

			}

		} );

		// Radial menu show
		this._eventBus.on( 'radial-menu:show', ( data ) => {

			this._radialMenu.show( data.clientX, data.clientY, data.gx, data.gz );

		} );

		// Track recent tile for carousel
		this._eventBus.on( 'tile:placed', ( data ) => {

			if ( data && data.tile && data.tile.type ) {

				this._addRecentTile( data.tile.type );

			}

		} );

		// Mode/tool changed → update tool rail
		this._eventBus.on( 'mode:changed', () => this._updateToolRailActive() );
		this._eventBus.on( 'tool:changed', () => this._updateToolRailActive() );

		// Debug toggle → update overlay service
		this._eventBus.on( 'debug:toggled', ( data ) => {

			this._debugOverlay.setEnabled( data.enabled );

		} );

		// Hover cell → debug tooltip
		this._eventBus.on( 'hover:cell', ( cell ) => {

			if ( cell && this._state.debugEnabled ) {

				this._debugOverlay.updateTooltip( cell.gx, cell.gz, 0, 0 );

			} else {

				this._debugOverlay.hideTooltip();

			}

		} );

	}

	// ── UI builders ──

	/** @private */
	_buildTopBar() {

		const topbar = document.getElementById( 'editor-topbar' );
		topbar.innerHTML = `
			<div class="kk-editor-topbar__section">
				<input type="text" class="kk-editor-topbar__track-name" id="topbar-name"
					value="${ this._project.meta.name }" maxlength="40"
					aria-label="Track name">
				<span class="kk-editor-topbar__save-status" id="topbar-save-status">DRAFT</span>
			</div>
			<div class="kk-editor-topbar__separator"></div>
			<div class="kk-editor-topbar__section">
				<button class="kk-editor-btn kk-editor-btn--ghost kk-editor-btn--small" id="topbar-save">Save</button>
				<button class="kk-editor-btn kk-editor-btn--ghost kk-editor-btn--small" id="topbar-load">Load</button>
				<button class="kk-editor-btn kk-editor-btn--ghost kk-editor-btn--small" id="topbar-undo" disabled>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>
				</button>
				<button class="kk-editor-btn kk-editor-btn--ghost kk-editor-btn--small" id="topbar-redo" disabled>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg>
				</button>
			</div>
			<div class="kk-editor-topbar__separator"></div>
			<div class="kk-editor-topbar__section">
				<button class="kk-editor-btn kk-editor-btn--success kk-editor-btn--small" id="topbar-test">Test Drive</button>
				<button class="kk-editor-btn kk-editor-btn--warning kk-editor-btn--small" id="topbar-validate">Validate</button>
				<button class="kk-editor-btn kk-editor-btn--ghost kk-editor-btn--small" id="topbar-publish">Publish</button>
				<button class="kk-editor-btn kk-editor-btn--ghost kk-editor-btn--small" id="topbar-clear">Clear</button>
				<button class="kk-editor-btn kk-editor-btn--ghost kk-editor-btn--small" id="topbar-new">New</button>
			</div>
			<div class="kk-editor-topbar__spacer"></div>
			<div class="kk-editor-topbar__section">
				<select class="kk-editor-select" id="topbar-tod">
					<option value="night" selected>Night</option>
					<option value="day">Day</option>
					<option value="sunset">Sunset</option>
					<option value="dawn">Dawn</option>
					<option value="overcast">Overcast</option>
				</select>
				<select class="kk-editor-select" id="topbar-view">
					<option value="iso" selected>Iso</option>
					<option value="top">Top</option>
					<option value="front">Front</option>
				</select>
				<button class="kk-editor-btn kk-editor-btn--ghost kk-editor-btn--small" id="topbar-exit"
					title="Exit to menu">Exit</button>
			</div>
		`;

		// Event handlers
		topbar.querySelector( '#topbar-save' ).addEventListener( 'click', () => {

			const name = topbar.querySelector( '#topbar-name' ).value || 'Untitled';
			this._storage.saveNamed( name );
			topbar.querySelector( '#topbar-save-status' ).textContent = 'SAVED';

		} );

		topbar.querySelector( '#topbar-load' ).addEventListener( 'click', () => this._showLoadDialog() );

		topbar.querySelector( '#topbar-undo' ).addEventListener( 'click', () => this._commandHistory.undo() );
		topbar.querySelector( '#topbar-redo' ).addEventListener( 'click', () => this._commandHistory.redo() );

		topbar.querySelector( '#topbar-test' ).addEventListener( 'click', () => {

			this._testDrive.launch();

		} );

		topbar.querySelector( '#topbar-validate' ).addEventListener( 'click', () => {

			const gm = this._input._modes.get( 'gameplay' );
			const result = this._validation.validate( gm );
			const errors = result.issues.filter( i => i.severity === 'error' ).length;
			const warnings = result.issues.filter( i => i.severity === 'warning' ).length;
			const msg = result.valid ? 'Track valid!' : `${ errors } error(s), ${ warnings } warning(s)`;
			console.log( '[Validate]', msg, result.issues );

			// Show the validation panel if there are issues
			if ( this._validationPanel && result.issues.length > 0 ) {

				this._validationPanel.classList.remove( 'kk-validation-panel--hidden' );

			}

			// Focus first issue with location
			if ( ! result.valid ) {

				this._camera.focusNextIssue( result.issues );

			}

		} );

		topbar.querySelector( '#topbar-publish' ).addEventListener( 'click', () => {

			this._handlePublish();

		} );

		topbar.querySelector( '#topbar-exit' ).addEventListener( 'click', () => {

			if ( this._project.tileCount > 0 ) {

				if ( ! confirm( 'Exit editor? Unsaved changes will be lost.' ) ) return;

			}

			window.location.href = 'menu.html';

		} );

		topbar.querySelector( '#topbar-tod' ).addEventListener( 'change', ( e ) => {

			this._lighting.apply( e.target.value );
			this._project.meta.timeOfDay = e.target.value;

		} );

		topbar.querySelector( '#topbar-view' ).addEventListener( 'change', ( e ) => {

			this._camera.setView( e.target.value );

		} );

		topbar.querySelector( '#topbar-name' ).addEventListener( 'change', ( e ) => {

			this._project.meta.name = e.target.value;

		} );

		// Clear button — confirm then clear all tiles
		topbar.querySelector( '#topbar-clear' ).addEventListener( 'click', () => {

			if ( ! confirm( 'Clear all tiles? This cannot be undone.' ) ) return;

			this._project.clear();
			this._commandHistory.clear();
			this._occupancy.rebuildFromProject( this._project );
			this._eventBus.emit( 'project:cleared' );
			topbar.querySelector( '#topbar-save-status' ).textContent = 'CLEARED';

		} );

		// New button — ask to save, then start fresh
		topbar.querySelector( '#topbar-new' ).addEventListener( 'click', () => {

			const name = topbar.querySelector( '#topbar-name' ).value || 'Untitled';

			if ( this._project.tileCount > 0 ) {

				const save = confirm( `Save current track "${ name }" before starting new?` );
				if ( save ) {

					this._storage.saveNamed( name );

				}

			}

			// Clear and create new project
			this._project.clear();
			this._project.meta = {
				id: crypto.randomUUID(),
				name: 'Untitled Track',
				description: '',
				themeId: 'city-night',
				timeOfDay: 'night',
				laps: 3,
				racerCount: 4,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				version: 1,
			};

			topbar.querySelector( '#topbar-name' ).value = 'Untitled Track';
			topbar.querySelector( '#topbar-save-status' ).textContent = 'NEW';
			this._commandHistory.clear();
			this._occupancy.rebuildFromProject( this._project );
			this._eventBus.emit( 'project:cleared' );

		} );

	}

	async _loadInitialProject() {

		const params = new URLSearchParams( window.location.search );
		const manageToken = params.get( 'manage' );

		if ( manageToken ) {

			try {

				const track = await this._publishedTrackApi.getManagedTrack( manageToken );
				if ( track?.trackData ) {

					this._manageToken = manageToken;
					this._managedTrack = track;
					this._project.loadFromV4JSON( track.trackData );
					this._trackLibrary.saveOwnedPublishedTrack( track, manageToken );
					console.log( '[EditorApp] Loaded published track from manage link.' );
					return true;

				}

			} catch ( err ) {

				console.warn( '[EditorApp] Failed to load manage track:', err );
				alert( 'Manage link could not be loaded. Opening local draft instead.' );

			}

		}

		return this._storage.loadSaved();

	}

	_syncTopbarProjectState() {

		const nameInput = document.getElementById( 'topbar-name' );
		if ( nameInput ) {

			nameInput.value = this._project.meta.name || '';

		}

	}

	_syncPublishUi() {

		const publishBtn = document.getElementById( 'topbar-publish' );
		if ( publishBtn ) {

			publishBtn.textContent = this._manageToken ? 'Update' : 'Publish';

		}

	}

	async _handlePublish() {

		const topbar = document.getElementById( 'editor-topbar' );
		if ( ! topbar ) return;

		const nameInput = topbar.querySelector( '#topbar-name' );
		const statusEl = topbar.querySelector( '#topbar-save-status' );
		const publishBtn = topbar.querySelector( '#topbar-publish' );
		const title = ( nameInput?.value ?? this._project.meta.name ?? '' ).trim();
		const creatorName = ( new Settings() ).getDisplayName() || '';
		const gameplayMode = this._input._modes.get( 'gameplay' );
		const readiness = this._publishValidation.evaluate( gameplayMode, { title, creatorName } );

		this._project.meta.name = title;
		if ( nameInput ) nameInput.value = title;

		if ( ! readiness.ok ) {

			statusEl.textContent = 'FIX ISSUES';
			alert( `Publish blocked:\n\n- ${ readiness.blockers.join( '\n- ' ) }` );
			if ( this._validationPanel && readiness.result.issues.length > 0 ) {

				this._validationPanel.classList.remove( 'kk-validation-panel--hidden' );

			}
			return;

		}

		const wasUpdate = !! this._manageToken;
		const trackData = this._project.toV4JSON();

		publishBtn.disabled = true;
		statusEl.textContent = wasUpdate ? 'UPDATING...' : 'PUBLISHING...';

		try {

			let published;
			if ( this._manageToken ) {

				published = await this._publishedTrackApi.updateManagedTrack( this._manageToken, {
					title,
					trackData,
				} );

			} else {

				published = await this._publishedTrackApi.publishTrack( {
					title,
					creatorName,
					trackData,
				} );

				this._manageToken = published.manageToken;

			}

			if ( ! this._manageToken ) {

				throw new Error( 'Missing manage link token from publish response.' );

			}

			this._managedTrack = published;
			this._trackLibrary.saveOwnedPublishedTrack( published, this._manageToken );
			history.replaceState( {}, '', `/track-editor.html?manage=${ encodeURIComponent( this._manageToken ) }` );
			this._syncPublishUi();

			const publicUrl = `${ window.location.origin }${ published.publicUrl }`;
			const manageUrl = `${ window.location.origin }${ published.manageUrl || `/m/${ this._manageToken }` }`;
			statusEl.textContent = wasUpdate ? 'UPDATED' : 'PUBLISHED';

			try {

				await navigator.clipboard.writeText( publicUrl );

			} catch { /* clipboard unavailable */ }

			alert( `${ wasUpdate ? 'Track updated.' : 'Track published.' }\n\nPublic link:\n${ publicUrl }\n\nManage link:\n${ manageUrl }` );

		} catch ( err ) {

			console.error( '[EditorApp] Publish failed:', err );
			statusEl.textContent = 'PUBLISH FAILED';
			alert( err.message || 'Unable to publish track right now.' );

		} finally {

			publishBtn.disabled = false;

		}

	}

	/** @private Show load-track dialog overlay. */
	_showLoadDialog() {

		const saved = this._storage.getSavedTracks();

		if ( saved.length === 0 ) {

			alert( 'No saved tracks found. Use Save to store a track first.' );
			return;

		}

		// Build dialog overlay
		const overlay = document.createElement( 'div' );
		overlay.className = 'kk-load-dialog__overlay';
		overlay.innerHTML = `
			<div class="kk-load-dialog">
				<div class="kk-load-dialog__header">
					<span>Load Track</span>
					<button class="kk-load-dialog__close">&times;</button>
				</div>
				<div class="kk-load-dialog__list">
					${ saved.map( t => `
						<div class="kk-load-dialog__item" data-track-id="${ t.id }">
							<div class="kk-load-dialog__item-info">
								<span class="kk-load-dialog__item-name">${ t.name }</span>
								<span class="kk-load-dialog__item-meta">${ t.pieces } pieces &middot; ${ new Date( t.date ).toLocaleDateString() }</span>
							</div>
							<div class="kk-load-dialog__item-actions">
								<button class="kk-editor-btn kk-editor-btn--primary kk-editor-btn--small kk-load-dialog__load-btn">Load</button>
								<button class="kk-editor-btn kk-editor-btn--ghost kk-editor-btn--small kk-load-dialog__delete-btn">Delete</button>
							</div>
						</div>
					` ).join( '' ) }
				</div>
			</div>
		`;

		document.body.appendChild( overlay );

		const close = () => overlay.remove();

		overlay.querySelector( '.kk-load-dialog__close' ).addEventListener( 'click', close );
		overlay.addEventListener( 'click', ( e ) => {

			if ( e.target === overlay ) close();

		} );

		// Load button clicks
		overlay.addEventListener( 'click', ( e ) => {

			const loadBtn = e.target.closest( '.kk-load-dialog__load-btn' );
			if ( loadBtn ) {

				const item = loadBtn.closest( '[data-track-id]' );
				const id = item.dataset.trackId;
				this._loadProject( id );
				close();
				return;

			}

			const deleteBtn = e.target.closest( '.kk-load-dialog__delete-btn' );
			if ( deleteBtn ) {

				const item = deleteBtn.closest( '[data-track-id]' );
				const name = item.querySelector( '.kk-load-dialog__item-name' ).textContent;
				if ( ! confirm( `Delete "${ name }"?` ) ) return;

				this._storage.deleteNamedTrack( item.dataset.trackId );
				item.remove();

				// Close if no items left
				if ( ! overlay.querySelector( '.kk-load-dialog__item' ) ) close();

			}

		} );

	}

	/** @private Load a saved project by id, restoring tiles, props, and markers. */
	_loadProject( id ) {

		// Prompt to save current work
		if ( this._project.tileCount > 0 ) {

			const name = document.getElementById( 'topbar-name' ).value || 'Untitled';
			const save = confirm( `Save current track "${ name }" before loading?` );
			if ( save ) this._storage.saveNamed( name );

		}

		// Clear current state
		this._project.clear();
		this._commandHistory.clear();

		// Clear props and markers visuals
		const pm = this._input._modes.get( 'props' );
		if ( pm && pm.loadFromJSON ) pm.loadFromJSON( [] );

		const gm = this._input._modes.get( 'gameplay' );
		if ( gm && gm.loadFromJSON ) gm.loadFromJSON( [] );

		// Load the project
		const ok = this._storage.loadNamedTrack( id );
		if ( ! ok ) {

			alert( 'Failed to load track. The save data may be missing.' );
			return;

		}

		// Derive elevation, curves
		this._elevController.deriveRampsFromElevation();
		this._curveService.deriveAllCurves();
		this._occupancy.rebuildFromProject( this._project );

		// Restore markers
		if ( this._project._pendingMarkers ) {

			if ( gm && gm.loadFromJSON ) gm.loadFromJSON( this._project._pendingMarkers );
			this._project._pendingMarkers = null;

		}

		// Restore props
		if ( this._project._pendingProps ) {

			if ( pm && pm.loadFromJSON ) pm.loadFromJSON( this._project._pendingProps );
			this._project._pendingProps = null;

		}

		// Update UI
		document.getElementById( 'topbar-name' ).value = this._project.meta.name || 'Untitled Track';
		document.getElementById( 'topbar-save-status' ).textContent = 'LOADED';
		this._eventBus.emit( 'project:loaded', { project: this._project } );

	}

	/** @private */
	_buildToolRail() {

		const rail = document.getElementById( 'editor-toolrail' );

		// Create a single floating tooltip element in <body> (escapes grid overflow)
		const floatTip = document.createElement( 'div' );
		floatTip.className = 'kk-toolrail__tooltip-float';
		document.body.appendChild( floatTip );
		let tipTimer = null;

		// SVG icons (16x16, stroke-based)
		const icons = {
			draw: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>',
			erase: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>',
			rotate: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>',
			elevate: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/></svg>',
			eyedropper: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9"/></svg>',
			finish: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>',
			route: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M12 19h4.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H12"/></svg>',
			gameplay: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>',
			decor: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 17 3.5s1.5 2.5-.8 6.5c-.7 1.2-.5 2.5.2 3.5L17 14"/><path d="M12 20h-2l2-6"/><path d="M14 20h-4"/></svg>',
			debug: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m18 7 4 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9l4-2"/><path d="M14 22v-4a2 2 0 0 0-4 0v4"/><path d="M18 22V5l-6-3-6 3v17"/></svg>',
		};

		const tools = [
			{ id: 'build',      icon: icons.draw,       label: 'Draw Road',      tip: 'Click to place track tiles, drag to paint',  key: 'B', group: 'draw',    action: 'mode' },
			{ id: 'erase',      icon: icons.erase,      label: 'Erase',          tip: 'Click tiles to delete them',                 key: 'X', group: 'draw',    action: 'build-tool', tool: 'erase' },
			{ id: 'finish',     icon: icons.finish,     label: 'Start / Finish', tip: 'Place the start/finish line',                key: 'F', group: 'draw',    action: 'build-tool', tool: 'finish' },
			{ id: 'eyedropper', icon: icons.eyedropper, label: 'Eyedropper',     tip: 'Pick a tile from the grid into your brush',  key: 'I', group: 'draw',    action: 'build-tool', tool: 'eyedropper' },
			{ id: 'sculpt',     icon: icons.rotate,     label: 'Rotate',         tip: 'Click tile to rotate 90deg, Shift=reverse',  key: 'R', group: 'edit',    action: 'mode' },
			{ id: 'move',       icon: icons.route,      label: 'Move',           tip: 'Click tile then drop at new position',       key: 'M', group: 'edit',    action: 'sculpt-tool', tool: 'move' },
			{ id: 'elevate',    icon: icons.elevate,    label: 'Elevate',        tip: 'Drag up/down to raise/lower, +/- keys',      key: 'V', group: 'edit',    action: 'build-tool', tool: 'elevate' },
			{ id: 'smart-fill', icon: icons.draw,       label: 'Smart Fill',     tip: 'Drag to fill area with tiles',               key: 'S', group: 'edit',    action: 'build-tool', tool: 'smart-fill' },
			{ id: 'replace',    icon: icons.eyedropper, label: 'Replace',        tip: 'Click tile to swap its type',                key: 'Q', group: 'edit',    action: 'build-tool', tool: 'replace' },
			{ id: 'route',      icon: icons.route,      label: 'Route Trace',    tip: 'Fly along the race loop + validate',         key: 'T', group: 'edit',    action: 'toggle-route' },
			{ id: 'gameplay',   icon: icons.gameplay,   label: 'Gameplay',       tip: 'Checkpoints, spawns, boost pads',            key: 'G', group: 'content', action: 'mode' },
			{ id: 'props',      icon: icons.decor,      label: 'Props',          tip: 'Place decorative props freely',              key: 'D', group: 'content', action: 'mode' },
			{ id: 'erase-prop', icon: icons.erase,      label: 'Erase Prop',     tip: 'Click to remove placed props/decor',        key: 'E', group: 'content', action: 'props-tool', tool: 'erase-prop' },
			{ id: 'debug',      icon: icons.debug,      label: 'Debug',          tip: 'Toggle tile info overlay',                   key: '`', group: 'meta',    action: 'toggle-debug' },
		];

		let lastGroup = null;

		for ( const t of tools ) {

			if ( lastGroup && lastGroup !== t.group ) {

				const sep = document.createElement( 'div' );
				sep.className = 'kk-toolrail__separator';
				rail.appendChild( sep );

			}

			lastGroup = t.group;

			const btn = document.createElement( 'button' );
			btn.className = 'kk-toolrail__btn';
			btn.setAttribute( 'aria-pressed', t.id === 'build' ? 'true' : 'false' );
			btn.setAttribute( 'aria-label', t.label );
			btn.dataset.toolId = t.id;
			btn.innerHTML = t.icon;

			// Tooltip on hover — uses fixed-position element in <body>
			btn.addEventListener( 'mouseenter', () => {

				clearTimeout( tipTimer );
				tipTimer = setTimeout( () => {

					const rect = btn.getBoundingClientRect();
					floatTip.textContent = '';
					const strong = document.createElement( 'strong' );
					strong.textContent = t.label;
					floatTip.appendChild( strong );

					const desc = document.createElement( 'span' );
					desc.style.cssText = 'color:#999;margin-left:6px';
					desc.textContent = t.tip;
					floatTip.appendChild( desc );

					const kbd = document.createElement( 'span' );
					kbd.style.cssText = 'color:#00d4e8;margin-left:8px;font-size:11px';
					kbd.textContent = t.key;
					floatTip.appendChild( kbd );

					floatTip.style.left = ( rect.right + 8 ) + 'px';
					floatTip.style.top = ( rect.top + rect.height / 2 ) + 'px';
					floatTip.style.transform = 'translateY(-50%)';
					floatTip.classList.add( 'visible' );

				}, 400 );

			} );

			btn.addEventListener( 'mouseleave', () => {

				clearTimeout( tipTimer );
				floatTip.classList.remove( 'visible' );

			} );

			btn.addEventListener( 'click', () => {

				// Hide tooltip on click
				clearTimeout( tipTimer );
				floatTip.classList.remove( 'visible' );

				if ( t.action === 'mode' ) {

					this._state.mode = t.id;

					// If clicking the mode button we're already in, reset to default tool
					// e.g. clicking Draw Road while erase is active → switch back to road
					if ( t.id === 'build' ) this._state.tool = 'road';
					else if ( t.id === 'sculpt' ) this._state.tool = 'rotate';

				} else if ( t.action === 'build-tool' ) {

					if ( this._state.mode === 'build' && this._state.tool === t.tool ) {

						this._state.tool = 'road';

					} else {

						this._state.mode = 'build';
						this._state.tool = t.tool;

					}

				} else if ( t.action === 'sculpt-tool' ) {

					if ( this._state.mode === 'sculpt' && this._state.tool === t.tool ) {

						this._state.tool = 'rotate';

					} else {

						this._state.mode = 'sculpt';
						this._state.tool = t.tool;

					}

				} else if ( t.action === 'props-tool' ) {

					if ( this._state.mode === 'props' && this._state.tool === t.tool ) {

						this._state.tool = 'place-prop';

					} else {

						this._state.mode = 'props';
						this._state.tool = t.tool;

					}

				} else if ( t.action === 'toggle-debug' ) {

					this._state.debugEnabled = ! this._state.debugEnabled;

				} else if ( t.action === 'toggle-route' ) {

					this._toggleRouteTrace();

				}

				this._updateToolRailActive();

			} );

			rail.appendChild( btn );

		}

	}

	/** @private */
	_updateToolRailActive() {

		const rail = document.getElementById( 'editor-toolrail' );
		const mode = this._state.mode;
		const tool = this._state.tool;

		const buildSubTools = [ 'erase', 'finish', 'elevate', 'eyedropper', 'smart-fill', 'replace' ];
		const sculptSubTools = [ 'move' ];
		const hasBuildSubTool = mode === 'build' && buildSubTools.includes( tool );
		const hasSculptSubTool = mode === 'sculpt' && sculptSubTools.includes( tool );

		for ( const btn of rail.querySelectorAll( '.kk-toolrail__btn' ) ) {

			const id = btn.dataset.toolId;

			let isActive = false;

			if ( id === 'debug' ) {

				isActive = this._state.debugEnabled;

			} else if ( id === 'route' ) {

				isActive = this._routeTrace?.isActive ?? false;

			} else if ( id === 'build' ) {

				isActive = mode === 'build' && ! hasBuildSubTool;

			} else if ( buildSubTools.includes( id ) ) {

				isActive = mode === 'build' && tool === id;

			} else if ( id === 'sculpt' ) {

				isActive = mode === 'sculpt' && ! hasSculptSubTool;

			} else if ( sculptSubTools.includes( id ) ) {

				isActive = mode === 'sculpt' && tool === id;

			} else {

				isActive = id === mode;

			}

			btn.setAttribute( 'aria-pressed', isActive ? 'true' : 'false' );

		}

	}

	/** @private */
	_buildCarousel() {

		const carousel = document.getElementById( 'editor-carousel' );

		// Pre-render thumbnails for all tiles
		const thumbRenderer = new TileThumbnailRenderer();
		this._thumbCache = {};

		const allTiles = [ ...this._tileLibrary.getTrackTiles(), ...this._tileLibrary.getDecorTiles() ];
		for ( const def of allTiles ) {

			const model = this._tileLibrary.getModel( def.id );
			this._thumbCache[ def.id ] = model ? thumbRenderer.render( model ) : '';

		}

		thumbRenderer.dispose();

		// Load favorites/recent from localStorage
		try {

			const f = localStorage.getItem( 'kk-editor-favorites' );
			this._favorites = f ? new Set( JSON.parse( f ) ) : new Set();

		} catch { this._favorites = new Set(); }

		try {

			const r = localStorage.getItem( 'kk-editor-recent' );
			this._recentTiles = r ? JSON.parse( r ) : [];

		} catch { this._recentTiles = []; }

		// Initial render
		this._activeCategory = 'all';
		this._renderCarousel();

		// Re-render carousel when mode changes (show decor items in decor mode)
		this._eventBus.on( 'mode:changed', () => this._renderCarousel() );

	}

	/** @private Render carousel content based on current mode and category filter. */
	_renderCarousel() {

		const carousel = document.getElementById( 'editor-carousel' );
		if ( ! this._thumbCache ) return; // Not ready yet

		const mode = this._state.mode;

		// ── Gameplay mode: show marker type cards instead of tiles ──
		if ( mode === 'gameplay' ) {

			const gm = this._input._modes.get( 'gameplay' );
			const tools = gm ? gm.getTools() : [];
			const activeTool = this._state.tool;

			let cardsHtml = '';
			for ( const t of tools ) {

				const selected = activeTool === t.id ? ' kk-carousel__card--selected' : '';
				cardsHtml += `
					<div class="kk-carousel__card${ selected }" data-gameplay-tool="${ t.id }" title="${ t.desc }" style="cursor:pointer">
						<div class="kk-carousel__card-thumb" style="display:flex;align-items:center;justify-content:center;font-size:32px;background:none;border:2px solid ${ t.color };border-radius:6px">${ t.icon }</div>
						<div class="kk-carousel__card-name" style="color:${ t.color }">${ t.name }</div>
						<div class="kk-carousel__card-meta">${ t.desc }</div>
					</div>
				`;

			}

			carousel.innerHTML = `
				<div class="kk-carousel__resize-handle" id="carousel-resize-handle"></div>
				<div class="kk-carousel__header">
					<span class="kk-carousel__category">GAMEPLAY</span>
				</div>
				<div class="kk-carousel__strip">${ cardsHtml }</div>
			`;

			carousel.addEventListener( 'click', ( e ) => {

				const card = e.target.closest( '[data-gameplay-tool]' );
				if ( ! card ) return;

				for ( const c of carousel.querySelectorAll( '.kk-carousel__card' ) ) {

					c.classList.remove( 'kk-carousel__card--selected' );

				}

				card.classList.add( 'kk-carousel__card--selected' );
				this._state.tool = card.dataset.gameplayTool;

			} );

			// Drag-to-resize carousel
			const handle = carousel.querySelector( '#carousel-resize-handle' );
			if ( handle ) {

				let startY = 0, startH = 0;
				handle.addEventListener( 'pointerdown', ( e ) => {

					startY = e.clientY;
					startH = carousel.offsetHeight;
					const onMove = ( ev ) => {

						const delta = startY - ev.clientY;
						carousel.style.height = Math.max( 80, Math.min( window.innerHeight * 0.5, startH + delta ) ) + 'px';

					};

					const onUp = () => {

						document.removeEventListener( 'pointermove', onMove );
						document.removeEventListener( 'pointerup', onUp );

					};

					document.addEventListener( 'pointermove', onMove );
					document.addEventListener( 'pointerup', onUp );

				} );

			}

			return;

		}

		// Determine which tiles to show
		const isPropsMode = mode === 'props';
		const tiles = isPropsMode
			? this._tileLibrary.getDecorTiles()
			: this._tileLibrary.getTrackTiles();

		const categories = [
			{ id: 'favorites', name: '★' },
			{ id: 'recent', name: 'Recent' },
			{ id: 'all', name: 'All' },
			...( isPropsMode
				? [ { id: 'decor', name: 'Props' } ]
				: this._tileLibrary.getCategories().filter( c => c.id !== 'decor' )
			),
		];

		// Category tabs
		let tabsHtml = '';
		for ( const cat of categories ) {

			const active = this._activeCategory === cat.id ? ' kk-carousel__tab--active' : '';
			tabsHtml += `<button class="kk-carousel__tab${ active }" data-cat="${ cat.id }">${ cat.name }</button>`;

		}

		// Filter tiles by category
		let filtered;
		if ( this._activeCategory === 'all' ) {

			filtered = tiles;

		} else if ( this._activeCategory === 'favorites' ) {

			filtered = tiles.filter( t => this._favorites && this._favorites.has( t.id ) );

		} else if ( this._activeCategory === 'recent' ) {

			const recentIds = this._recentTiles || [];
			filtered = recentIds.map( id => tiles.find( t => t.id === id ) ).filter( Boolean );

		} else {

			filtered = tiles.filter( t => t.category === this._activeCategory );

		}

		// Build cards
		let cardsHtml = '';
		for ( const def of filtered ) {

			const thumbSrc = this._thumbCache[ def.id ];
			const thumbContent = thumbSrc
				? `<img src="${ thumbSrc }" alt="${ def.name }" style="width:100%;height:100%;object-fit:contain">`
				: def.name.charAt( 0 );

			const elevBadge = def.canElevate ? '<span class="kk-carousel__elev-badge" title="Can elevate">&#x2B06;</span>' : '';
			const isFav = this._favorites && this._favorites.has( def.id );

			cardsHtml += `
				<div class="kk-carousel__card${ isFav ? ' kk-carousel__card--favorite' : '' }" data-tile-id="${ def.id }" title="${ def.name } (${ def.footprint.w }x${ def.footprint.h })">
					<div class="kk-carousel__card-thumb">${ thumbContent }</div>
					<div class="kk-carousel__card-name">${ def.name }${ elevBadge }</div>
					<div class="kk-carousel__card-meta">${ def.footprint.w }x${ def.footprint.h } &middot; ${ def.category }</div>
				</div>
			`;

		}

		const modeLabel = isPropsMode ? 'PROPS' : 'TRACK TILES';

		carousel.innerHTML = `
			<div class="kk-carousel__resize-handle" id="carousel-resize-handle"></div>
			<div class="kk-carousel__header">
				<span class="kk-carousel__category">${ modeLabel }</span>
				<div class="kk-carousel__tabs">${ tabsHtml }</div>
				<input type="text" class="kk-carousel__search" placeholder="Search..." aria-label="Search tiles" id="carousel-search">
			</div>
			<div class="kk-carousel__strip">${ cardsHtml }</div>
		`;

		// Card click — select tile
		carousel.addEventListener( 'click', ( e ) => {

			// Tab click
			const tab = e.target.closest( '.kk-carousel__tab' );
			if ( tab ) {

				this._activeCategory = tab.dataset.cat;
				this._renderCarousel();
				return;

			}

			// Card click
			const card = e.target.closest( '.kk-carousel__card' );
			if ( ! card ) return;

			for ( const c of carousel.querySelectorAll( '.kk-carousel__card' ) ) {

				c.classList.remove( 'kk-carousel__card--selected' );

			}

			card.classList.add( 'kk-carousel__card--selected' );

			const tileId = card.dataset.tileId;
			this._state.selectedTileType = tileId;

			const def = this._tileLibrary.getDefinition( tileId );
			if ( ! def ) return;

			// In props mode, stay in props mode
			if ( this._state.mode === 'props' ) return;

			// Manual placement: all tiles use the same road tool
			// The selected tile type is what gets placed
			this._state.mode = 'build';
			if ( tileId === 'trk-finish' ) {

				this._state.tool = 'finish';

			} else {

				this._state.tool = 'road';

			}

			this._updateToolRailActive();

		} );

		// Search filter
		const searchInput = carousel.querySelector( '#carousel-search' );
		if ( searchInput ) {

			searchInput.addEventListener( 'input', ( e ) => {

				const query = e.target.value.toLowerCase();
				for ( const card of carousel.querySelectorAll( '.kk-carousel__card' ) ) {

					const name = ( card.dataset.tileId || '' ).toLowerCase();
					const title = ( card.getAttribute( 'title' ) || '' ).toLowerCase();
					card.style.display = ( name.includes( query ) || title.includes( query ) ) ? '' : 'none';

				}

			} );

		}

		// Right-click on carousel card → toggle favorite
		carousel.addEventListener( 'contextmenu', ( e ) => {

			e.preventDefault();
			const card = e.target.closest( '.kk-carousel__card' );
			if ( ! card ) return;

			const tileId = card.dataset.tileId;
			this._toggleFavorite( tileId );
			card.classList.toggle( 'kk-carousel__card--favorite' );

		} );

		// Drag-to-resize carousel via handle
		const handle = carousel.querySelector( '#carousel-resize-handle' );
		if ( handle ) {

			let startY = 0;
			let startH = 0;

			const onMove = ( e ) => {

				const delta = startY - e.clientY;
				carousel.style.height = Math.max( 80, Math.min( window.innerHeight * 0.5, startH + delta ) ) + 'px';

			};

			const onUp = () => {

				document.removeEventListener( 'pointermove', onMove );
				document.removeEventListener( 'pointerup', onUp );

			};

			handle.addEventListener( 'pointerdown', ( e ) => {

				startY = e.clientY;
				startH = carousel.offsetHeight;
				document.addEventListener( 'pointermove', onMove );
				document.addEventListener( 'pointerup', onUp );

			} );

		}

	}

	/** @private */
	_buildStatusBar() {

		const bar = document.getElementById( 'editor-statusbar' );
		bar.innerHTML = `
			<div class="kk-statusbar__segment" id="status-mode">Build</div>
			<div class="kk-statusbar__segment" id="status-tool">Road</div>
			<div class="kk-statusbar__segment" id="status-snap">Snap: ON</div>
			<div class="kk-statusbar__segment" id="status-orient">Orient: 0°</div>
			<div class="kk-statusbar__segment" id="status-elev">Plane: 0m</div>
			<div class="kk-statusbar__segment" id="status-view">Iso</div>
			<div class="kk-statusbar__segment" id="status-pieces">0 pieces</div>
			<div class="kk-statusbar__segment" id="status-selection">0 selected</div>
			<div class="kk-statusbar__segment kk-statusbar__segment--ok" id="status-valid">OK</div>
			<div class="kk-statusbar__segment" id="status-save">Draft</div>
		`;

		// Update status on events
		this._eventBus.on( 'mode:changed', ( d ) => {

			document.getElementById( 'status-mode' ).textContent = d.mode.charAt( 0 ).toUpperCase() + d.mode.slice( 1 );

		} );

		this._eventBus.on( 'tool:changed', ( d ) => {

			document.getElementById( 'status-tool' ).textContent = d.tool.charAt( 0 ).toUpperCase() + d.tool.slice( 1 );

			// Update orient display when tool changes (reset to show current orient)
			const ORIENT_DEGS = { 0: '0°', 16: '90°', 10: '180°', 22: '270°' };
			document.getElementById( 'status-orient' ).textContent = 'Orient: ' + ( ORIENT_DEGS[ this._state.selectedOrient ] ?? '0°' );

		} );

		// Also update orient on R key press (via a polling check isn't great, so we use tool:changed as proxy)
		// Better: listen for any key that might change orient
		const orientEl = document.getElementById( 'status-orient' );
		document.addEventListener( 'keyup', () => {

			const ORIENT_DEGS = { 0: '0°', 16: '90°', 10: '180°', 22: '270°' };
			const newText = 'Orient: ' + ( ORIENT_DEGS[ this._state.selectedOrient ] ?? '0°' );
			if ( orientEl.textContent !== newText ) orientEl.textContent = newText;

		} );

		this._eventBus.on( 'tile:placed', () => {

			document.getElementById( 'status-pieces' ).textContent = this._project.tileCount + ' pieces';

		} );

		this._eventBus.on( 'tile:erased', () => {

			document.getElementById( 'status-pieces' ).textContent = this._project.tileCount + ' pieces';

		} );

		this._eventBus.on( 'camera:moved', ( d ) => {

			const view = this._camera.currentView;
			document.getElementById( 'status-view' ).textContent = view.charAt( 0 ).toUpperCase() + view.slice( 1 );

		} );

		this._eventBus.on( 'activeElevation:changed', ( d ) => {

			const el = document.getElementById( 'status-elev' );
			const sign = d.meters >= 0 ? '+' : '';
			el.textContent = `Plane: ${ sign }${ d.meters }m`;

			// Color: ground=default, above=green, below=orange
			el.className = 'kk-statusbar__segment';
			if ( d.meters > 0 ) el.classList.add( 'kk-statusbar__segment--ok' );
			else if ( d.meters < 0 ) el.classList.add( 'kk-statusbar__segment--warn' );

		} );

		// Selection count
		this._eventBus.on( 'selection:changed', ( d ) => {

			const el = document.getElementById( 'status-selection' );
			const count = d.selected ? d.selected.size : 0;
			el.textContent = count > 0 ? `${ count } selected` : '0 selected';

		} );

		// ── Validation panel ──
		this._buildValidationPanel();

		// Validation summary update
		this._eventBus.on( 'validation:result', ( result ) => {

			const el = document.getElementById( 'status-valid' );
			const errors = result.issues.filter( i => i.severity === 'error' ).length;
			const warnings = result.issues.filter( i => i.severity === 'warning' ).length;

			el.className = 'kk-statusbar__segment kk-statusbar__segment--clickable';

			if ( errors > 0 ) {

				el.textContent = `${ errors } error${ errors > 1 ? 's' : '' }`;
				el.classList.add( 'kk-statusbar__segment--error' );

			} else if ( warnings > 0 ) {

				el.textContent = `${ warnings } warn`;
				el.classList.add( 'kk-statusbar__segment--warn' );

			} else {

				el.textContent = 'Valid';
				el.classList.add( 'kk-statusbar__segment--ok' );

			}

			this._renderValidationPanel( result.issues );

		} );

		// Save status
		this._eventBus.on( 'project:saved', () => {

			document.getElementById( 'status-save' ).textContent = 'Saved';

		} );

		this._eventBus.on( 'tile:placed', () => {

			document.getElementById( 'status-save' ).textContent = 'Unsaved';

		} );

		this._eventBus.on( 'tile:erased', () => {

			document.getElementById( 'status-save' ).textContent = 'Unsaved';

		} );

	}

	/** @private Create the validation issues flyout panel. */
	_buildValidationPanel() {

		const panel = document.createElement( 'div' );
		panel.id = 'validation-panel';
		panel.className = 'kk-validation-panel kk-validation-panel--hidden';
		panel.innerHTML = `
			<div class="kk-validation-panel__header">
				<span class="kk-validation-panel__title">Validation Issues</span>
				<button class="kk-validation-panel__close" aria-label="Close">&times;</button>
			</div>
			<div class="kk-validation-panel__list">
				<div class="kk-validation-panel__empty">No issues found</div>
			</div>
		`;

		document.querySelector( '.kk-editor-shell__viewport' ).appendChild( panel );

		// Close button
		panel.querySelector( '.kk-validation-panel__close' ).addEventListener( 'click', () => {

			panel.classList.add( 'kk-validation-panel--hidden' );

		} );

		// Click an issue → focus camera on that cell
		panel.querySelector( '.kk-validation-panel__list' ).addEventListener( 'click', ( e ) => {

			const item = e.target.closest( '.kk-validation-panel__item' );
			if ( ! item || item.dataset.gx == null ) return;
			this._camera.focusCell( Number( item.dataset.gx ), Number( item.dataset.gz ) );

		} );

		// Toggle panel when clicking the status bar validation segment
		document.getElementById( 'status-valid' ).addEventListener( 'click', () => {

			panel.classList.toggle( 'kk-validation-panel--hidden' );

		} );

		this._validationPanel = panel;

	}

	/** @private Render validation issues into the flyout panel. */
	_renderValidationPanel( issues ) {

		const list = this._validationPanel.querySelector( '.kk-validation-panel__list' );

		if ( ! issues || issues.length === 0 ) {

			list.innerHTML = '<div class="kk-validation-panel__empty">No issues — track is valid!</div>';
			return;

		}

		const errors = issues.filter( i => i.severity === 'error' );
		const warnings = issues.filter( i => i.severity === 'warning' );

		let html = '';

		if ( errors.length > 0 ) {

			html += `<div class="kk-validation-panel__group-label kk-validation-panel__group-label--error">Errors (${ errors.length })</div>`;
			for ( const issue of errors ) {

				const hasLocus = issue.locus && issue.locus.gx != null;
				const coords = hasLocus ? `(${ issue.locus.gx }, ${ issue.locus.gz })` : '';
				const dataAttrs = hasLocus ? ` data-gx="${ issue.locus.gx }" data-gz="${ issue.locus.gz }"` : '';
				html += `<div class="kk-validation-panel__item kk-validation-panel__item--error"${ dataAttrs }>
					<span class="kk-validation-panel__severity">&#x2716;</span>
					<span class="kk-validation-panel__message">${ issue.message }</span>
					<span class="kk-validation-panel__coords">${ coords }</span>
				</div>`;

			}

		}

		if ( warnings.length > 0 ) {

			html += `<div class="kk-validation-panel__group-label kk-validation-panel__group-label--warn">Warnings (${ warnings.length })</div>`;
			for ( const issue of warnings ) {

				const hasLocus = issue.locus && issue.locus.gx != null;
				const coords = hasLocus ? `(${ issue.locus.gx }, ${ issue.locus.gz })` : '';
				const dataAttrs = hasLocus ? ` data-gx="${ issue.locus.gx }" data-gz="${ issue.locus.gz }"` : '';
				html += `<div class="kk-validation-panel__item kk-validation-panel__item--warn"${ dataAttrs }>
					<span class="kk-validation-panel__severity">&#x26A0;</span>
					<span class="kk-validation-panel__message">${ issue.message }</span>
					<span class="kk-validation-panel__coords">${ coords }</span>
				</div>`;

			}

		}

		list.innerHTML = html;

	}

	/** @private Build the right-side inspector panel with track settings. */
	_buildInspector() {

		// Remove previous event listeners to prevent leak
		if ( this._inspectorUnsubs ) {

			for ( const unsub of this._inspectorUnsubs ) unsub();
			this._inspectorUnsubs = null;

		}

		const inspector = document.getElementById( 'editor-inspector' );
		const meta = this._project.meta;
		const raceTypes = this._themeService.getRaceTypes();
		const themes = this._themeService.getAvailableThemes();

		let raceOpts = '';
		for ( const rt of raceTypes ) {

			const sel = rt.id === meta.raceType ? ' selected' : '';
			raceOpts += `<option value="${ rt.id }"${ sel }>${ rt.name }</option>`;

		}

		let themeOpts = '';
		for ( const t of themes ) {

			const sel = t.id === meta.themeId ? ' selected' : '';
			const dis = t.available ? '' : ' disabled';
			themeOpts += `<option value="${ t.id }"${ sel }${ dis }>${ t.name }${ t.available ? '' : ' (coming soon)' }</option>`;

		}

		let racerOpts = '';
		for ( const n of [ 2, 4, 6, 8, 10, 12 ] ) {

			const sel = n === meta.racerCount ? ' selected' : '';
			racerOpts += `<option value="${ n }"${ sel }>${ n } Racers</option>`;

		}

		inspector.innerHTML = `
			<h3 class="kk-inspector__heading">TRACK SETTINGS</h3>

			<div class="kk-inspector__field">
				<span class="kk-inspector__field-label">Race Type</span>
				<select class="kk-editor-select" id="inspector-race-type">${ raceOpts }</select>
			</div>

			<div class="kk-inspector__field">
				<span class="kk-inspector__field-label">Racers</span>
				<select class="kk-editor-select" id="inspector-racer-count">${ racerOpts }</select>
			</div>

			<div class="kk-inspector__field">
				<span class="kk-inspector__field-label">Laps</span>
				<input type="number" class="kk-editor-select" id="inspector-laps"
					value="${ meta.laps }" min="1" max="99" style="width:60px">
			</div>

			<div class="kk-inspector__field">
				<span class="kk-inspector__field-label">Theme</span>
				<select class="kk-editor-select" id="inspector-theme">${ themeOpts }</select>
			</div>

			<h3 class="kk-inspector__heading" style="margin-top:16px">MARKERS</h3>
			<div id="inspector-marker-counts" style="font-size:12px;color:var(--color-ink-400)">
				No markers placed
			</div>

			<h3 class="kk-inspector__heading" style="margin-top:16px">SHARE</h3>
			<button class="kk-editor-btn kk-editor-btn--primary kk-editor-btn--small" id="inspector-share"
				style="width:100%">Copy Share Link</button>
			<input type="text" id="inspector-share-url" readonly
				style="width:100%;margin-top:6px;padding:6px 8px;font-size:10px;font-family:monospace;
				background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);
				border-radius:4px;color:var(--color-ink-300);cursor:text;outline:none;"
				value="" placeholder="Click 'Copy Share Link' to generate">
		`;

		// Event handlers
		inspector.querySelector( '#inspector-race-type' ).addEventListener( 'change', ( e ) => {

			this._project.meta.raceType = e.target.value;

		} );

		inspector.querySelector( '#inspector-racer-count' ).addEventListener( 'change', ( e ) => {

			this._project.meta.racerCount = parseInt( e.target.value, 10 );

		} );

		inspector.querySelector( '#inspector-laps' ).addEventListener( 'change', ( e ) => {

			this._project.meta.laps = Math.max( 1, parseInt( e.target.value, 10 ) || 3 );

		} );

		inspector.querySelector( '#inspector-theme' ).addEventListener( 'change', ( e ) => {

			this._themeService.setTheme( e.target.value );

		} );

		inspector.querySelector( '#inspector-share' ).addEventListener( 'click', () => {

			const url = this._shareLink.generatePlayUrl();
			const urlField = inspector.querySelector( '#inspector-share-url' );
			urlField.value = url;
			urlField.select();

			navigator.clipboard.writeText( url ).then( () => {

				inspector.querySelector( '#inspector-share' ).textContent = 'Copied!';
				setTimeout( () => {

					inspector.querySelector( '#inspector-share' ).textContent = 'Copy Share Link';

				}, 2000 );

			} );

		} );

		// Update marker counts when markers change
		const updateMarkerCounts = () => {

			const gm = this._input._modes.get( 'gameplay' );
			if ( ! gm ) return;

			const markers = gm.getMarkers();
			const el = inspector.querySelector( '#inspector-marker-counts' );
			if ( ! el ) return;

			if ( markers.length === 0 ) {

				el.textContent = 'No markers placed';
				return;

			}

			const counts = {};
			for ( const m of markers ) counts[ m.type ] = ( counts[ m.type ] || 0 ) + 1;

			el.innerHTML = Object.entries( counts )
				.map( ( [ type, count ] ) => `<div style="padding:2px 0">${ type }: <strong>${ count }</strong></div>` )
				.join( '' );

		};

		const unsubMarkerPlaced = this._eventBus.on( 'marker:placed', updateMarkerCounts );
		const unsubMarkerRemoved = this._eventBus.on( 'marker:removed', updateMarkerCounts );

		// Store all unsubs for cleanup when inspector is rebuilt
		this._inspectorUnsubs = [ unsubMarkerPlaced, unsubMarkerRemoved ];

		// Context-sensitive: show tile details when selected
		const selUnsub = this._eventBus.on( 'selection:changed', ( data ) => {

			const selected = data.selected;
			if ( ! selected || selected.size === 0 ) {

				// No selection — restore track settings (but don't re-enter if already showing)
				if ( inspector.querySelector( '#inspector-race-type' ) ) return;
				this._buildInspector();
				return;

			}

			// Show details for first selected tile
			const [ firstKey ] = selected;
			const [ gx, gz ] = firstKey.split( ',' ).map( Number );
			const tile = this._project.getTile( gx, gz );
			if ( ! tile ) return;

			const elevStep = tile._derivedElevation || tile.elevation || 12;
			const elevM = ( ( elevStep - 12 ) * 2.5 ).toFixed( 1 );

			inspector.innerHTML = `
				<h3 class="kk-inspector__heading">TILE PROPERTIES</h3>
				<div class="kk-inspector__field">
					<span class="kk-inspector__field-label">Type</span>
					<span class="kk-inspector__field-value">${ tile.type }</span>
				</div>
				<div class="kk-inspector__field">
					<span class="kk-inspector__field-label">Cell</span>
					<span class="kk-inspector__field-value">${ gx }, ${ gz }</span>
				</div>
				<div class="kk-inspector__field">
					<span class="kk-inspector__field-label">Footprint</span>
					<span class="kk-inspector__field-value">1x1</span>
				</div>
				<div class="kk-inspector__field">
					<span class="kk-inspector__field-label">Rotation</span>
					<span class="kk-inspector__field-value">${ tile.orient }${ tile.rotationOverride ? ' (manual)' : '' }</span>
				</div>
				<div class="kk-inspector__field">
					<span class="kk-inspector__field-label">Elevation</span>
					<span class="kk-inspector__field-value">${ elevM }m (step ${ elevStep })</span>
				</div>
				${ tile.curveVariant ? `<div class="kk-inspector__field"><span class="kk-inspector__field-label">Curve</span><span class="kk-inspector__field-value">${ tile.curveVariant }</span></div>` : '' }
				${ tile.isFinish ? '<div class="kk-inspector__field"><span class="kk-inspector__field-value" style="color:var(--color-accent-pink)">START / FINISH</span></div>' : '' }

				<div class="kk-inspector__actions" style="margin-top:12px">
					<button class="kk-editor-btn kk-editor-btn--ghost kk-editor-btn--small" id="inspector-rotate">Rotate</button>
					<button class="kk-editor-btn kk-editor-btn--ghost kk-editor-btn--small" id="inspector-duplicate">Duplicate</button>
					<button class="kk-editor-btn kk-editor-btn--ghost kk-editor-btn--small" style="color:var(--color-error)" id="inspector-delete">Delete</button>
				</div>
			`;

			inspector.querySelector( '#inspector-rotate' )?.addEventListener( 'click', () => {

				this._transform.rotateTile( gx, gz );
				this._selection.selectCell( gx, gz );

			} );

			inspector.querySelector( '#inspector-duplicate' )?.addEventListener( 'click', () => {

				const sm = this._input._modes.get( 'sculpt' );
				if ( sm && sm._duplicateTile ) sm._duplicateTile( gx, gz );

			} );

			inspector.querySelector( '#inspector-delete' )?.addEventListener( 'click', () => {

				this._transform.deleteSelected( selected );
				this._selection.clearSelection();

			} );

		} );

		this._inspectorUnsubs.push( selUnsub );

	}

	// ── Route Trace ──

	/** @private Toggle route trace visualization. */
	_toggleRouteTrace() {

		const gm = this._input._modes.get( 'gameplay' );
		if ( ! this._routeTrace?.isActive ) {

			const result = this._validation.validate( gm );
			console.log( '[RouteTrace]', result.valid ? 'Loop valid' : 'Loop broken', result.issues );
			const route = this._routeAnalysis.analyzeRoute();
			this._routeTrace?.toggle( gm, { validationResult: result, route } );

		} else {

			this._routeTrace?.toggle( gm );

		}

	}

	// ── Favorites / Recent ──

	/** @private Add a tile to the recent list (max 10). */
	_addRecentTile( tileId ) {

		if ( ! this._recentTiles ) this._recentTiles = [];
		this._recentTiles = this._recentTiles.filter( id => id !== tileId );
		this._recentTiles.unshift( tileId );
		if ( this._recentTiles.length > 10 ) this._recentTiles.pop();

		try { localStorage.setItem( 'kk-editor-recent', JSON.stringify( this._recentTiles ) ); } catch {}

	}

	/** @private Toggle favorite for a tile ID. */
	_toggleFavorite( tileId ) {

		if ( ! this._favorites ) this._favorites = new Set();

		if ( this._favorites.has( tileId ) ) {

			this._favorites.delete( tileId );

		} else {

			this._favorites.add( tileId );

		}

		try { localStorage.setItem( 'kk-editor-favorites', JSON.stringify( [ ...this._favorites ] ) ); } catch {}

	}

	/** Teardown for navigation away. */
	dispose() {

		this._running = false;
		if ( this._animFrameId ) cancelAnimationFrame( this._animFrameId );
		this._routeTrace?.dispose();
		this._compassOverlay?.dispose();
		this._eventBus.dispose();
		this._renderer.dispose();

	}

}

// ── Bootstrap ──
const app = new EditorApp();
app.init().catch( err => {

	console.error( '[EditorApp] Init failed:', err );

	// Show error visually on the page
	const shell = document.getElementById( 'editor-shell' );
	if ( shell ) {

		shell.innerHTML = `
			<div style="padding:40px;color:#ef4444;font-family:monospace;grid-column:1/-1;grid-row:1/-1">
				<h2 style="color:#fff;margin-bottom:12px">Editor Init Failed</h2>
				<pre style="white-space:pre-wrap;font-size:13px">${ err.message }\n\n${ err.stack || '' }</pre>
			</div>
		`;

	}

} );

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ORIENT_DEG, CELL_RAW, GRID_SCALE, encodeCells } from '../Track.js';
import { getTrackModelConfig, getTrackTileSet } from '../TrackModelConfig.js';
import { getTrackAsphaltMode, applyTrackAsphaltMode } from '../TrackAsphaltMode.js';
import { ORIENT_FLIP, cellKey } from './EditorState.js';
import {
	getCellExits,
	getConnectivityMask as _getConnectivityMask,
	resolveNewTile as _resolveNewTile,
	resolveTile as _resolveTile,
} from './AutoTile.js';
import {
	placeMesh as _placeMesh,
	resolveCell as _resolveCell,
	resolveCellAndNeighbors as _resolveCellAndNeighbors,
	snapshotGrid as _snapshotGrid,
	restoreSnapshot as _restoreSnapshot,
} from './Grid.js';
import {
	getAvailableCurveOptions as _getAvailableCurveOptions,
	renderCurves as _renderCurves,
	deriveAllCurves as _deriveAllCurves,
} from './Curves.js';
import {
	deriveCornerElevation as _deriveCornerElevation,
	deriveRampsFromElevation as _deriveRampsFromElevation,
	recalculateRunRamps as _recalculateRunRamps,
	cycleElevation as _cycleElevation,
} from './Elevation.js';
import {
	getCellsArray as _getCellsArray,
	save as _save,
	loadSaved as _loadSaved,
	getSavedTracks,
	saveNamedTrack as _saveNamedTrack,
	deleteNamedTrack,
	loadNamedTrack as _loadNamedTrack,
} from './Persistence.js';
import {
	initDebugMode,
	updateDebugTooltip as _updateDebugTooltip,
	hideDebugTooltip,
} from './Debug.js';

// ─── State ────────────────────────────────────────────────

const grid = new Map(); // "gx,gz" → { type, orient, isFinish, mesh }
let tool = 'road'; // 'road', 'erase', 'elevate', 'place-special'
let selectedSpecialTile = ''; // e.g. 'trk-bridge-entry'

// ─── Auto-tile wrappers (bind grid) ──────────────────────
const getConnectivityMask = ( gx, gz ) => _getConnectivityMask( grid, gx, gz );
const resolveNewTile = ( gx, gz ) => _resolveNewTile( grid, gx, gz );
const resolveTile = ( gx, gz ) => _resolveTile( grid, gx, gz );

// ─── Grid wrappers (bind grid, models, trackGroup) ───────
const placeMesh = ( gx, gz, cell ) => _placeMesh( grid, models, trackGroup, gx, gz, cell );
const resolveCell = ( gx, gz ) => _resolveCell( grid, models, trackGroup, gx, gz );
const renderCurves = () => _renderCurves( grid, models, trackGroup );
const getAvailableCurveOptions = ( gx, gz ) => _getAvailableCurveOptions( grid, gx, gz );
const deriveAllCurves = () => _deriveAllCurves( grid, models, trackGroup );
const deriveCornerElevation = ( gx, gz ) => _deriveCornerElevation( grid, gx, gz );
const deriveRampsFromElevation = () => _deriveRampsFromElevation( grid, placeMesh );
const recalculateRunRamps = ( gx, gz ) => _recalculateRunRamps( grid, placeMesh, gx, gz );
const cycleElevation = ( gx, gz ) => _cycleElevation( { grid, placeMesh, pushUndo, save, showToast }, gx, gz );
const getCellsArray = () => _getCellsArray( grid );
const save = () => _save( grid );
const loadSaved = () => _loadSaved( { grid, placeMesh, deriveRampsFromElevation, deriveAllCurves } );
const saveNamedTrack = ( name ) => _saveNamedTrack( grid, name );
const loadNamedTrack = ( encoded ) => _loadNamedTrack( { grid, trackGroup, placeMesh, pushUndo, save, updateStats, updateFinishCar, deriveRampsFromElevation, deriveAllCurves }, encoded );
const updateDebugTooltip = ( gx, gz, clientX, clientY ) => _updateDebugTooltip( grid, trackTileSet, gx, gz, clientX, clientY );
const resolveCellAndNeighbors = ( gx, gz ) => _resolveCellAndNeighbors( grid, models, trackGroup, gx, gz, renderCurves );
const snapshotGrid = () => _snapshotGrid( grid );
const restoreSnapshot = ( snap ) => _restoreSnapshot( grid, models, trackGroup, snap, { renderCurves, save, updateStats, updateFinishCar, deriveElevation: deriveRampsFromElevation } );

// ─── Undo / Redo ─────────────────────────────────────────

const undoStack = [];
const redoStack = [];
const MAX_UNDO = 100;

function pushUndo() {

	undoStack.push( snapshotGrid() );
	if ( undoStack.length > MAX_UNDO ) undoStack.shift();
	redoStack.length = 0;
	updateUndoButtons();

}

function undo() {

	if ( undoStack.length === 0 ) return;
	redoStack.push( snapshotGrid() );
	restoreSnapshot( undoStack.pop() );
	updateUndoButtons();

}

function redo() {

	if ( redoStack.length === 0 ) return;
	undoStack.push( snapshotGrid() );
	restoreSnapshot( redoStack.pop() );
	updateUndoButtons();

}

function updateUndoButtons() {

	document.getElementById( 'btn-undo' ).disabled = undoStack.length === 0;
	document.getElementById( 'btn-redo' ).disabled = redoStack.length === 0;

}

// ─── Renderer ─────────────────────────────────────────────

const renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setPixelRatio( window.devicePixelRatio );
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild( renderer.domElement );

// ─── Scene ────────────────────────────────────────────────

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0xadb2ba );
scene.fog = new THREE.Fog( 0xadb2ba, 80, 160 );

const dirLight = new THREE.DirectionalLight( 0xffffff, 5 );
dirLight.position.set( 11.4, 15, - 5.3 );
dirLight.castShadow = true;
dirLight.shadow.mapSize.setScalar( 4096 );
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 100;
dirLight.shadow.camera.left = - 60;
dirLight.shadow.camera.right = 60;
dirLight.shadow.camera.top = 60;
dirLight.shadow.camera.bottom = - 60;
scene.add( dirLight );

const hemiLight = new THREE.HemisphereLight( 0xc8d8e8, 0x7a8a5a, 1.5 );
scene.add( hemiLight );

// Ground
const groundMat = new THREE.MeshStandardMaterial( { color: 0x369069, metalness: 0 } );
const ground = new THREE.Mesh( new THREE.PlaneGeometry( 200, 200 ), groundMat );
ground.rotation.x = - Math.PI / 2;
ground.position.y = - 0.14;
ground.receiveShadow = true;
scene.add( ground );

// Grid helper
const gridSize = 30;
const cellWorld = CELL_RAW * GRID_SCALE;
const gridHelper = new THREE.GridHelper( gridSize * cellWorld, gridSize, 0x4a7a2a, 0x4a7a2a );
gridHelper.position.y = - 0.49;
gridHelper.material.opacity = 0.3;
gridHelper.material.transparent = true;
scene.add( gridHelper );

// Track group (mirrors game structure)
const trackGroup = new THREE.Group();
trackGroup.position.y = - 0.5;
trackGroup.scale.setScalar( GRID_SCALE );
scene.add( trackGroup );

// Ghost preview group
const ghostGroup = new THREE.Group();
ghostGroup.position.y = - 0.5;
ghostGroup.scale.setScalar( GRID_SCALE );
scene.add( ghostGroup );
let ghostMesh = null;

// ─── Grid snap indicator ──────────────────────────────────

const indicatorGeo = new THREE.PlaneGeometry( cellWorld, cellWorld );
const indicatorMat = new THREE.MeshBasicMaterial( {
	color: 0xffffff,
	opacity: 0.15,
	transparent: true,
	depthTest: false
} );
const cellIndicator = new THREE.Mesh( indicatorGeo, indicatorMat );
cellIndicator.rotation.x = - Math.PI / 2;
cellIndicator.position.y = - 0.1;
cellIndicator.visible = false;
scene.add( cellIndicator );

// Outline ring for the indicator
const outlineGeo = new THREE.EdgesGeometry( new THREE.PlaneGeometry( cellWorld, cellWorld ) );
const outlineMat = new THREE.LineBasicMaterial( { color: 0xffffff, opacity: 0.5, transparent: true, depthTest: false } );
const cellOutline = new THREE.LineSegments( outlineGeo, outlineMat );
cellOutline.rotation.x = - Math.PI / 2;
cellOutline.position.y = - 0.09;
cellOutline.visible = false;
scene.add( cellOutline );

// ─── Camera (orthographic) ────────────────────────────────

const frustum = 30;
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera(
	- frustum * aspect, frustum * aspect,
	frustum, - frustum,
	0.1, 200
);
const cellCenter = 0.5 * CELL_RAW * GRID_SCALE;
const camTarget = new THREE.Vector3( cellCenter, 0, cellCenter );

// ─── Orbit / tilt / height state ──────────────────────────

let orbitAngle = 0;
let tiltAngle = Math.PI / 2;
let isOrbiting = false;
let orbitStartMouse = { x: 0, y: 0 };
let orbitAngleStart = 0;
let tiltAngleStart = 0;
let camHeightStart = 0;
let camPanStart = { x: 0, z: 0 };

function updateCamera() {

	const dist = 50;
	camera.position.x = camTarget.x + dist * Math.cos( tiltAngle ) * Math.sin( orbitAngle );
	camera.position.y = camTarget.y + dist * Math.sin( tiltAngle );
	camera.position.z = camTarget.z + dist * Math.cos( tiltAngle ) * Math.cos( orbitAngle );
	camera.lookAt( camTarget );

}

function getCameraPanAxes() {

	const right = new THREE.Vector3( Math.cos( orbitAngle ), 0, - Math.sin( orbitAngle ) );
	const fwd = new THREE.Vector3( - Math.sin( orbitAngle ), 0, - Math.cos( orbitAngle ) );
	return { right, fwd };

}

updateCamera();

// ─── View presets ─────────────────────────────────────────

const viewBtnTop = document.getElementById( 'btn-view-top' );
const viewBtnIso = document.getElementById( 'btn-view-iso' );
const viewBtnFront = document.getElementById( 'btn-view-front' );

function setView( name ) {

	if ( name === 'top' ) {

		orbitAngle = 0;
		tiltAngle = Math.PI / 2;

	} else if ( name === 'iso' ) {

		orbitAngle = Math.PI / 4;
		tiltAngle = Math.PI / 5.1; // ~35°

	} else if ( name === 'front' ) {

		orbitAngle = 0;
		tiltAngle = 0.25; // ~14°

	}

	camTarget.y = 0;
	updateCamera();

	viewBtnTop.classList.toggle( 'active', name === 'top' );
	viewBtnIso.classList.toggle( 'active', name === 'iso' );
	viewBtnFront.classList.toggle( 'active', name === 'front' );

}

viewBtnTop.addEventListener( 'click', () => setView( 'top' ) );
viewBtnIso.addEventListener( 'click', () => setView( 'iso' ) );
viewBtnFront.addEventListener( 'click', () => setView( 'front' ) );

// ─── Time of day ──────────────────────────────────────────

const TOD_PRESETS = {
	day: {
		bg: 0xadb2ba,
		fog: 0xadb2ba,
		dirColor: 0xffffff,
		dirIntensity: 5,
		dirPos: [ 11.4, 15, - 5.3 ],
		hemiSky: 0xc8d8e8,
		hemiGround: 0x7a8a5a,
		hemiIntensity: 1.5,
		groundColor: 0x369069,
		exposure: 1.0,
		label: 'Day'
	},
	sunset: {
		bg: 0x8a6050,
		fog: 0x8a6050,
		dirColor: 0xffaa66,
		dirIntensity: 4,
		dirPos: [ 3, 5, - 12 ],
		hemiSky: 0xffccaa,
		hemiGround: 0x553322,
		hemiIntensity: 1.0,
		groundColor: 0x2d6648,
		exposure: 0.85,
		label: 'Sunset'
	},
	night: {
		bg: 0x1a1a2e,
		fog: 0x1a1a2e,
		dirColor: 0x8888cc,
		dirIntensity: 2,
		dirPos: [ - 5, 12, 8 ],
		hemiSky: 0x334466,
		hemiGround: 0x111122,
		hemiIntensity: 0.6,
		groundColor: 0x1a4a35,
		exposure: 0.6,
		label: 'Night'
	}
};

const todOrder = [ 'day', 'sunset', 'night' ];
let todIndex = 0;
const btnTod = document.getElementById( 'btn-tod' );

function applyTod( name ) {

	const p = TOD_PRESETS[ name ];
	scene.background.setHex( p.bg );
	scene.fog.color.setHex( p.fog );
	dirLight.color.setHex( p.dirColor );
	dirLight.intensity = p.dirIntensity;
	dirLight.position.set( ...p.dirPos );
	hemiLight.color.setHex( p.hemiSky );
	hemiLight.groundColor.setHex( p.hemiGround );
	hemiLight.intensity = p.hemiIntensity;
	groundMat.color.setHex( p.groundColor );
	renderer.toneMappingExposure = p.exposure;
	btnTod.textContent = p.label;

}

btnTod.addEventListener( 'click', () => {

	todIndex = ( todIndex + 1 ) % todOrder.length;
	applyTod( todOrder[ todIndex ] );

} );

// ─── Minimap ──────────────────────────────────────────────

const minimapSize = 180;
const minimapCanvas = document.createElement( 'canvas' );
minimapCanvas.width = minimapSize;
minimapCanvas.height = minimapSize;
document.getElementById( 'minimap' ).appendChild( minimapCanvas );
const mmCtx = minimapCanvas.getContext( '2d' );

function updateMinimap() {

	mmCtx.clearRect( 0, 0, minimapSize, minimapSize );
	mmCtx.fillStyle = 'rgba(20, 50, 35, 0.6)';
	mmCtx.fillRect( 0, 0, minimapSize, minimapSize );

	if ( grid.size === 0 ) return;

	// Find bounds
	let minGx = Infinity, maxGx = - Infinity;
	let minGz = Infinity, maxGz = - Infinity;

	for ( const key of grid.keys() ) {

		const [ gx, gz ] = key.split( ',' ).map( Number );
		minGx = Math.min( minGx, gx );
		maxGx = Math.max( maxGx, gx );
		minGz = Math.min( minGz, gz );
		maxGz = Math.max( maxGz, gz );

	}

	const rangeX = maxGx - minGx + 1;
	const rangeZ = maxGz - minGz + 1;
	const padding = 20;
	const usable = minimapSize - padding * 2;
	const cellSize = Math.min( usable / Math.max( rangeX, 1 ), usable / Math.max( rangeZ, 1 ), 14 );
	const ox = ( minimapSize - rangeX * cellSize ) / 2;
	const oz = ( minimapSize - rangeZ * cellSize ) / 2;

	for ( const [ key, cell ] of grid ) {

		const [ gx, gz ] = key.split( ',' ).map( Number );
		const px = ox + ( gx - minGx ) * cellSize;
		const py = oz + ( gz - minGz ) * cellSize;

		if ( cell.isFinish ) {

			mmCtx.fillStyle = '#ffcc44';

		} else if ( cell.type === 'trk-corner-1x1' ) {

			mmCtx.fillStyle = '#66aaff';

		} else {

			mmCtx.fillStyle = '#aaccaa';

		}

		mmCtx.fillRect( px + 1, py + 1, cellSize - 2, cellSize - 2 );

	}

	// Camera viewport indicator
	const camGx = camTarget.x / cellWorld;
	const camGz = camTarget.z / cellWorld;
	const viewRadius = frustum / cellWorld / camera.zoom;

	const cx = ox + ( camGx - minGx ) * cellSize;
	const cy = oz + ( camGz - minGz ) * cellSize;
	const rw = viewRadius * cellSize * aspect;
	const rh = viewRadius * cellSize;

	mmCtx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
	mmCtx.lineWidth = 1;
	mmCtx.strokeRect( cx - rw, cy - rh, rw * 2, rh * 2 );

}

window.addEventListener( 'resize', () => {

	const a = window.innerWidth / window.innerHeight;
	camera.left = - frustum * a;
	camera.right = frustum * a;
	camera.updateProjectionMatrix();
	renderer.setSize( window.innerWidth, window.innerHeight );
	updateCamera();

} );

// ─── Load models ──────────────────────────────────────────

const loader = new GLTFLoader();
const modelNames = [
	'trk-straight', 'trk-corner-1x1', 'trk-finish',
	'trk-curve-2x2-l',
	'trk-curve-3x3-l',
	'trk-curve-3x3-wide-l',
	'trk-elev-2p5', 'trk-elev-5',
	'trk-ramp-up-2p5', 'trk-ramp-up-5',
	'trk-ramp-up-2p5-smooth', 'trk-ramp-up-5-smooth',
	'trk-ramp-down-2p5', 'trk-ramp-down-5',
	'trk-ramp-down-2p5-smooth', 'trk-ramp-down-5-smooth',
	'trk-junction-y', 'trk-junction-t', 'trk-junction-4way',
	'trk-bridge-entry', 'trk-bridge-mid',
	'trk-tunnel-entry', 'trk-tunnel-mid', 'trk-tunnel-exit', 'trk-tunnel-open',
	'trk-jump-short', 'trk-jump-long',
	'trk-chicane-3x3-l',
	'vehicle-truck-red'
];
const trackTileSet = getTrackTileSet( globalThis.location?.search ?? '' );
const asphaltMode = getTrackAsphaltMode( globalThis.location?.search ?? '' );
const models = {};

async function loadModels() {

	const promises = modelNames.map( ( name ) =>
		new Promise( ( resolve, reject ) => {

			const modelConfig = getTrackModelConfig( name, trackTileSet );
                loader.load( `models/${ modelConfig.path }`, ( gltf ) => {

				gltf.scene.traverse( ( child ) => {

					if ( child.isMesh ) {
						child.material.side = THREE.FrontSide;
						applyTrackAsphaltMode( child.material, { asphaltMode } );
					}

				} );

				if ( name.startsWith( 'vehicle-' ) ) {

					gltf.scene.scale.setScalar( 0.5 );

				}

				if ( modelConfig.rotationY !== 0 ) {

					const wrapper = new THREE.Group();
					gltf.scene.rotation.y = modelConfig.rotationY;
					wrapper.add( gltf.scene );
					models[ name ] = wrapper;

				} else {

					models[ name ] = gltf.scene;

				}
				resolve();

			}, undefined, reject );

		} )
	);

	await Promise.all( promises );

}

// ─── Finish line car preview ──────────────────────────────

let finishCarMesh = null;

function updateFinishCar() {

	// Remove old car
	if ( finishCarMesh ) {

		trackGroup.remove( finishCarMesh );
		finishCarMesh = null;

	}

	const carModel = models[ 'vehicle-truck-red' ];
	if ( ! carModel ) return;

	// Find finish cell
	let finishGx = null, finishGz = null, finishCell = null;

	for ( const [ key, cell ] of grid ) {

		if ( cell.isFinish ) {

			[ finishGx, finishGz ] = key.split( ',' ).map( Number );
			finishCell = cell;
			break;

		}

	}

	if ( ! finishCell ) return;

	finishCarMesh = carModel.clone();
	// Position on the finish cell in track-group local space
	finishCarMesh.position.set(
		( finishGx + 0.5 ) * CELL_RAW,
		0.5,
		( finishGz + 0.5 ) * CELL_RAW
	);

	// Orient car to match finish line direction
	const deg = ORIENT_DEG[ finishCell.orient ] || 0;
	finishCarMesh.rotation.y = THREE.MathUtils.degToRad( deg );

	// Scale relative to track group (which is already at GRID_SCALE)
	// Vehicle is already at 0.5 from loading; scale down a tiny bit for preview look
	finishCarMesh.traverse( ( c ) => {

		if ( c.isMesh ) {

			c.castShadow = true;
			c.receiveShadow = true;

		}

	} );

	trackGroup.add( finishCarMesh );

}

// ─── Special tile placement ──────────────────────────────

const MULTI_TILE_KEYS = new Set( [
	'trk-junction-y', 'trk-junction-t', 'trk-junction-4way', 'trk-chicane-3x3-l'
] );

function placeSpecialTile( gx, gz, tileType ) {

	const key = cellKey( gx, gz );
	if ( grid.has( key ) ) {

		showToast( 'Cell already occupied' );
		return;

	}

	pushUndo();

	const isMultiTile = MULTI_TILE_KEYS.has( tileType );

	if ( isMultiTile ) {

		// 3x3 footprint: anchor at (gx,gz), fill 3x3 area
		// For now place all footprint cells as the multi-tile type at anchor
		// and mark footprint cells as consumed straights
		for ( let fx = 0; fx < 3; fx ++ ) {

			for ( let fz = 0; fz < 3; fz ++ ) {

				const fKey = cellKey( gx + fx, gz + fz );
				if ( fx === 0 && fz === 0 ) continue;

				if ( grid.has( fKey ) ) {

					showToast( '3x3 footprint blocked at (' + ( gx + fx ) + ',' + ( gz + fz ) + ')' );
					popUndo();
					return;

				}

			}

		}

		// Place anchor cell
		const cell = { type: tileType, orient: 0, isFinish: false, mesh: null };
		grid.set( key, cell );
		placeMesh( gx, gz, cell );

		// Fill footprint with consumed marker cells (invisible, just grid reservations)
		for ( let fx = 0; fx < 3; fx ++ ) {

			for ( let fz = 0; fz < 3; fz ++ ) {

				if ( fx === 0 && fz === 0 ) continue;
				const fKey = cellKey( gx + fx, gz + fz );
				const fCell = { type: 'trk-straight', orient: 0, isFinish: false, mesh: null, _consumed: true };
				grid.set( fKey, fCell );

			}

		}

	} else {

		// 1x1 special tile — place directly
		const cell = { type: tileType, orient: 0, isFinish: false, mesh: null };
		grid.set( key, cell );
		placeMesh( gx, gz, cell );

	}

	save();
	updateStats();

}

// ─── Cell operations ──────────────────────────────────────

function placeRoad( gx, gz ) {

	const key = cellKey( gx, gz );

	// Elevation tool mode: delegate to cycleElevation
	if ( tool === 'elevate' ) {

		cycleElevation( gx, gz );
		return;

	}

	// Special tile placement mode
	if ( tool === 'place-special' && selectedSpecialTile ) {

		placeSpecialTile( gx, gz, selectedSpecialTile );
		return;

	}

	// Finish tile placement mode
	if ( tool === 'place-finish' ) {

		const existing = grid.get( key );

		// Click on finish center cell → rotate
		if ( existing && existing.isFinish && ! existing.finishFlank ) {

			pushUndo();
			const newOrient = ORIENT_FLIP[ existing.orient ] ?? existing.orient;
			removeFinish();
			placeFinishAt( gx, gz, newOrient );
			save();
			updateFinishCar();
			showToast( 'Finish rotated' );
			return;

		}

		// Click on finish flank cell → rotate the center
		if ( existing && existing.isFinish && existing.finishFlank ) {

			for ( const [ ck, cc ] of grid ) {

				if ( cc.isFinish && ! cc.finishFlank ) {

					const [ cx, cz ] = ck.split( ',' ).map( Number );
					pushUndo();
					const newOrient = ORIENT_FLIP[ cc.orient ] ?? cc.orient;
					removeFinish();
					placeFinishAt( cx, cz, newOrient );
					save();
					updateFinishCar();
					showToast( 'Finish rotated' );
					return;

				}

			}

			return;

		}

		// Click on occupied non-finish cell → block
		if ( existing ) {

			showToast( 'Cell already occupied' );
			return;

		}

		// Check flanking cells are free (default orient 0 = N/S, flanks along Z)
		for ( const dir of [ - 1, 1 ] ) {

			const fk = cellKey( gx, gz + dir );
			const fc = grid.get( fk );
			if ( fc && ! fc.isFinish ) {

				showToast( 'Not enough space for 3×1 finish tile' );
				return;

			}

		}

		pushUndo();
		removeFinish();
		placeFinishAt( gx, gz, 0 );
		save();
		updateStats();
		updateFinishCar();
		showToast( 'Finish placed' );
		return;

	}

	if ( grid.has( key ) ) {

		const cell = grid.get( key );

		// Reject clicks on auto-managed ramp tiles
		if ( cell.autoRamp ) {

			showToast( 'Ramp is auto-managed' );
			return;

		}

		// Click on finish tile → flip direction (rotate 180°)
		if ( cell.isFinish ) {

			pushUndo();
			cell.orient = ORIENT_FLIP[ cell.orient ] ?? cell.orient;
			placeMesh( gx, gz, cell );
			save();
			updateFinishCar();
			return;

		}

		// Curve toggle handled by radial menu — no click action on curves
		return;

	}

	pushUndo();
	grid.set( key, { type: 'trk-straight', orient: 0, isFinish: false, mesh: null } );
	resolveCellAndNeighbors( gx, gz );

	// Derive elevation for any corners in the neighborhood
	const cornerOffsets = [ [ 0, 0 ], [ 0, - 1 ], [ 0, 1 ], [ 1, 0 ], [ - 1, 0 ] ];
	for ( const [ cdx, cdz ] of cornerOffsets ) {

		const ck = cellKey( gx + cdx, gz + cdz );
		const cc = grid.get( ck );
		if ( cc && cc.type === 'trk-corner-1x1' ) {

			deriveCornerElevation( gx + cdx, gz + cdz );
			placeMesh( gx + cdx, gz + cdz, cc );

		}

	}

	save();
	updateStats();

}

function removeFinish() {

	const toRemove = [];
	for ( const [ key, cell ] of grid ) {

		if ( cell.isFinish ) toRemove.push( key );

	}

	for ( const key of toRemove ) {

		const cell = grid.get( key );
		if ( cell.mesh ) trackGroup.remove( cell.mesh );
		grid.delete( key );

	}

}

function placeFinishAt( gx, gz, orient = 0 ) {

	const center = { type: 'trk-finish', orient, isFinish: true, mesh: null };
	grid.set( cellKey( gx, gz ), center );
	placeMesh( gx, gz, center );

	// Flanking cells along the perpendicular axis
	const isNS = orient === 0 || orient === 10;
	const fdx = isNS ? 0 : 1;
	const fdz = isNS ? 1 : 0;
	for ( const dir of [ - 1, 1 ] ) {

		grid.set(
			cellKey( gx + fdx * dir, gz + fdz * dir ),
			{ type: 'trk-finish', orient, isFinish: true, mesh: null, finishFlank: true }
		);

	}

}

function placeFinish() {

	placeFinishAt( 0, 0, 0 );

}

function eraseRoad( gx, gz ) {

	const key = cellKey( gx, gz );
	if ( ! grid.has( key ) ) return;

	// Erasing a finish tile removes the entire 3x1 finish
	const cell = grid.get( key );
	if ( cell.isFinish ) {

		pushUndo();
		removeFinish();
		save();
		updateStats();
		updateFinishCar();
		return;

	}

	// Consumed cells (3x3 footprint) — block erasing; erase the anchor instead
	if ( cell._consumed ) {

		showToast( 'Erase the anchor tile to remove this piece' );
		return;

	}

	pushUndo();

	// If erasing a multi-tile anchor, remove all footprint cells
	if ( MULTI_TILE_KEYS.has( cell.type ) ) {

		for ( let fx = 0; fx < 3; fx ++ ) {

			for ( let fz = 0; fz < 3; fz ++ ) {

				if ( fx === 0 && fz === 0 ) continue;
				const fKey = cellKey( gx + fx, gz + fz );
				grid.delete( fKey );

			}

		}

	}

	// If erasing an auto-ramp cell, resolve to the ramp parent for orphan cleanup
	const erasedKey = ( cell.autoRamp && cell.rampParent ) ? cell.rampParent : key;

	// If this cell was elevated, reset its elevation before removal
	if ( cell.elevation && cell.elevation > 0 ) {

		cell.elevation = 0;
		cell.type = 'trk-straight';

	}

	// If this cell is a curve corner, clean up the curve
	if ( cell.curveMesh ) {

		trackGroup.remove( cell.curveMesh );
		cell.curveMesh = null;

	}

	if ( cell.curveConsumed ) {

		for ( const ck of cell.curveConsumed ) {

			const cc = grid.get( ck );
			if ( cc && cc.mesh ) cc.mesh.visible = true;

		}

		cell.curveSize = undefined;
		cell.curveConsumed = undefined;
		cell.curveVariant = undefined;
		cell._prevConsumed = null;

	}

	// If this cell is consumed by another corner's curve, dissolve that curve
	for ( const [ ck, cc ] of grid ) {

		if ( cc.curveConsumed && cc.curveConsumed.has( key ) ) {

			// Restore all consumed cells' visibility
			for ( const consumedKey of cc.curveConsumed ) {

				const consumedCell = grid.get( consumedKey );
				if ( consumedCell && consumedCell.mesh ) consumedCell.mesh.visible = true;

			}

			// Restore corner cell's own mesh visibility
			if ( cc.mesh ) cc.mesh.visible = true;

			// Remove the curve mesh
			if ( cc.curveMesh ) {

				trackGroup.remove( cc.curveMesh );
				cc.curveMesh = null;

			}

			cc.curveSize = undefined;
			cc.curveConsumed = undefined;
			cc.curveVariant = undefined;
			cc._prevConsumed = null;
			break; // a cell can only be consumed by one curve

		}

	}

	if ( cell.mesh ) trackGroup.remove( cell.mesh );
	grid.delete( key );

	// Re-resolve neighbors (also re-detects curves)
	resolveCell( gx, gz - 1 );
	resolveCell( gx, gz + 1 );
	resolveCell( gx + 1, gz );
	resolveCell( gx - 1, gz );

	renderCurves();

	// Clean up orphaned autoRamp cells whose rampParent was the erased cell
	for ( const [ oKey, oCell ] of grid ) {

		if ( oCell.autoRamp && oCell.rampParent === erasedKey ) {

			oCell.autoRamp = false;
			delete oCell.rampParent;
			oCell.type = 'trk-straight';

			const [ ox, oz ] = oKey.split( ',' ).map( Number );
			placeMesh( ox, oz, oCell );

		}

	}

	// Recalculate ramps for any elevated neighbors of the erased cell
	const neighborOffsets = [ [ 0, - 1 ], [ 0, 1 ], [ 1, 0 ], [ - 1, 0 ] ];
	for ( const [ ndx, ndz ] of neighborOffsets ) {

		const nKey = cellKey( gx + ndx, gz + ndz );
		const nCell = grid.get( nKey );
		if ( nCell && nCell.elevation && nCell.elevation > 0 ) {

			recalculateRunRamps( gx + ndx, gz + ndz );

		}

	}

	save();
	updateStats();

}

function clearAll() {

	pushUndo();

	for ( const [ , cell ] of grid ) {

		if ( cell.mesh ) trackGroup.remove( cell.mesh );
		if ( cell.curveMesh ) trackGroup.remove( cell.curveMesh );

	}

	grid.clear();
	placeFinish();
	save();
	updateStats();
	updateFinishCar();

}

// ─── Ghost preview ────────────────────────────────────────

// Neighbor cells whose meshes are temporarily swapped during ghost preview
const ghostNeighborBackups = []; // { cell, originalMesh }

function addGhostPiece( type, orient, gx, gz, opacity ) {

	const src = models[ type ];
	if ( ! src ) return;

	const mesh = src.clone();
	mesh.position.set( ( gx + 0.5 ) * CELL_RAW, 0.5, ( gz + 0.5 ) * CELL_RAW );

	const deg = ORIENT_DEG[ orient ] || 0;
	mesh.rotation.y = THREE.MathUtils.degToRad( deg );

	mesh.traverse( ( c ) => {

		if ( c.isMesh ) {

			c.material = c.material.clone();
			c.material.transparent = true;
			c.material.opacity = opacity;

		}

	} );

	ghostGroup.add( mesh );

}

function updateGhost( gx, gz ) {

	clearGhost();

	if ( tool === 'erase' || tool === 'elevate' ) return;

	const key = cellKey( gx, gz );
	if ( grid.has( key ) ) return; // already occupied

	// Finish tile ghost preview
	if ( tool === 'place-finish' ) {

		addGhostPiece( 'trk-finish', 0, gx, gz, 0.4 );
		return;

	}

	// Special tile ghost preview
	if ( tool === 'place-special' && selectedSpecialTile ) {

		addGhostPiece( selectedSpecialTile, 0, gx, gz, 0.4 );
		return;

	}

	// Temporarily insert ghost cell into grid
	const ghostCell = { type: 'trk-straight', orient: 0, isFinish: false, mesh: null };
	grid.set( key, ghostCell );

	// Resolve ghost: connect to neighbors, pick best pair if 3+
	const [ type, orient ] = resolveNewTile( gx, gz );

	// Update ghost cell in grid so neighbors see its correct exits
	ghostCell.type = type;
	ghostCell.orient = orient;

	// Show ghost piece
	addGhostPiece( type, orient, gx, gz, 0.4 );

	// Check how neighbors would change and preview those changes
	const neighbors = [ [ gx, gz - 1 ], [ gx, gz + 1 ], [ gx + 1, gz ], [ gx - 1, gz ] ];

	for ( const [ nx, nz ] of neighbors ) {

		const nKey = cellKey( nx, nz );
		const nCell = grid.get( nKey );
		if ( ! nCell ) continue;

		// Re-resolve neighbor, but skip if it would break existing connections
		const nExits = getCellExits( nCell );
		const nConn = getConnectivityMask( nx, nz );
		const nConnected = nExits & nConn;

		const [ newType, newOrient ] = resolveTile( nx, nz );
		const proposedExits = getCellExits( { type: newType, orient: newOrient } );
		if ( ( proposedExits & nConnected ) !== nConnected ) continue;

		const finalType = ( nCell.isFinish && newType === 'trk-straight' ) ? 'trk-finish' : newType;

		if ( finalType !== nCell.type || newOrient !== nCell.orient ) {

			// Hide the real mesh temporarily
			if ( nCell.mesh ) {

				nCell.mesh.visible = false;
				ghostNeighborBackups.push( { cell: nCell } );

			}

			// Show preview of what the neighbor would become
			addGhostPiece( finalType, newOrient, nx, nz, 0.7 );

		}

	}

	// Remove the temporary ghost cell from the grid
	grid.delete( key );

}

function clearGhost() {

	// Restore hidden neighbor meshes
	for ( const { cell } of ghostNeighborBackups ) {

		if ( cell.mesh ) cell.mesh.visible = true;

	}

	ghostNeighborBackups.length = 0;

	// Remove all ghost preview meshes
	while ( ghostGroup.children.length > 0 ) {

		ghostGroup.remove( ghostGroup.children[ 0 ] );

	}

}

// ─── Raycasting ───────────────────────────────────────────

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredCell = null;

function screenToGrid( clientX, clientY ) {

	mouse.x = ( clientX / window.innerWidth ) * 2 - 1;
	mouse.y = - ( clientY / window.innerHeight ) * 2 + 1;

	raycaster.setFromCamera( mouse, camera );

	const plane = new THREE.Plane( new THREE.Vector3( 0, 1, 0 ), 0.51 );
	const hit = new THREE.Vector3();
	raycaster.ray.intersectPlane( plane, hit );

	if ( ! hit ) return null;

	const gx = Math.floor( hit.x / cellWorld );
	const gz = Math.floor( hit.z / cellWorld );

	return { gx, gz };

}

function updateCellIndicator( gx, gz ) {

	cellIndicator.position.x = ( gx + 0.5 ) * cellWorld;
	cellIndicator.position.z = ( gz + 0.5 ) * cellWorld;
	cellIndicator.visible = true;

	cellOutline.position.x = cellIndicator.position.x;
	cellOutline.position.z = cellIndicator.position.z;
	cellOutline.visible = true;

	// Color: green if empty (can place), red if occupied, yellow if finish
	const key = cellKey( gx, gz );
	const existing = grid.get( key );

	if ( existing && existing.isFinish ) {

		indicatorMat.color.setHex( 0xffcc44 );
		outlineMat.color.setHex( 0xffcc44 );

	} else if ( existing ) {

		const color = tool === 'erase' ? 0xff4444 : tool === 'elevate' ? 0x44ccff : 0x888888;
		indicatorMat.color.setHex( color );
		outlineMat.color.setHex( color );

	} else {

		const emptyColor = tool === 'elevate' ? 0x44ccff : tool === 'place-finish' ? 0xffcc44 : 0x44ff88;
		indicatorMat.color.setHex( emptyColor );
		outlineMat.color.setHex( emptyColor );

	}

}

function hideCellIndicator() {

	cellIndicator.visible = false;
	cellOutline.visible = false;

}

// ─── Radial context menu ──────────────────────────────────

const radialMenu = document.getElementById( 'radial-menu' );
const radialRotate = document.getElementById( 'radial-rotate' );
const radialCurve = document.getElementById( 'radial-curve' );
const radialElevate = document.getElementById( 'radial-elevate' );
let radialGx = null, radialGz = null;

function gridToScreen( gx, gz ) {

	const pos = new THREE.Vector3(
		( gx + 0.5 ) * cellWorld,
		0.5,
		( gz + 0.5 ) * cellWorld
	);
	pos.project( camera );

	return {
		x: ( pos.x * 0.5 + 0.5 ) * window.innerWidth,
		y: ( - pos.y * 0.5 + 0.5 ) * window.innerHeight
	};

}

function getRadialActions( gx, gz ) {

	const key = cellKey( gx, gz );
	const cell = grid.get( key );
	if ( ! cell ) return [];

	const actions = [];

	// Finish tile → rotate
	if ( cell.isFinish ) {

		actions.push( 'rotate' );

	}

	// Corner with available curves → cycle curve variants
	if ( cell.type === 'trk-corner-1x1' ) {

		const opts = getAvailableCurveOptions( gx, gz );
		if ( opts.length > 0 || cell.curveVariant ) actions.push( 'curve' );

	} else {

		// If hovering a consumed straight, show curve action to allow reverting
		for ( const [ , cc ] of grid ) {

			if ( cc.curveConsumed && cc.curveConsumed.has( key ) ) {

				actions.push( 'curve' );
				break;

			}

		}

	}

	// Straight (non-finish, non-curve, non-ramp) → elevate
	if ( ! cell.isFinish && ! cell.autoRamp && cell.curveSize == null &&
		( cell.type === 'trk-straight' || cell.type === 'trk-elev-2p5' || cell.type === 'trk-elev-5' ) ) {

		// Also check not consumed by a curve
		let consumedByCurve = false;
		for ( const [ , cc ] of grid ) {

			if ( cc.curveConsumed && cc.curveConsumed.has( key ) ) {

				consumedByCurve = true;
				break;

			}

		}

		if ( ! consumedByCurve ) actions.push( 'elevate' );

	}

	// Auto-ramp cells → cycle ramp style (reuses elevate button)
	if ( cell.autoRamp ) {

		actions.push( 'rampStyle' );

	}

	return actions;

}

function showRadialMenu( gx, gz ) {

	const actions = getRadialActions( gx, gz );
	if ( actions.length === 0 ) {

		hideRadialMenu();
		return;

	}

	radialGx = gx;
	radialGz = gz;

	const screen = gridToScreen( gx, gz );

	radialMenu.style.left = screen.x + 'px';
	radialMenu.style.top = screen.y + 'px';
	radialMenu.classList.add( 'visible' );

	// Hide all first
	radialRotate.classList.remove( 'shown' );
	radialCurve.classList.remove( 'shown' );
	radialElevate.classList.remove( 'shown' );

	// Position buttons radially around center
	const radius = 36;
	const buttons = [];
	if ( actions.includes( 'rotate' ) ) buttons.push( radialRotate );
	if ( actions.includes( 'curve' ) ) buttons.push( radialCurve );
	if ( actions.includes( 'elevate' ) || actions.includes( 'rampStyle' ) ) buttons.push( radialElevate );

	// Update curve button state — show current variant
	if ( actions.includes( 'curve' ) ) {

		const key = cellKey( gx, gz );
		const cell = grid.get( key );
		let variant = cell ? cell.curveVariant : null;

		// If hovering a consumed straight, get variant from parent corner
		if ( ! variant && cell ) {

			for ( const [ , cc ] of grid ) {

				if ( cc.curveConsumed && cc.curveConsumed.has( key ) ) {

					variant = cc.curveVariant;
					break;

				}

			}

		}

		const curveIcon = document.getElementById( 'radial-curve-icon' );
		if ( variant ) {

			curveIcon.innerHTML = '<path d="M21 20c-2 0-4-.5-6-2s-4-4-6-4-4 .5-6 2"/>';

		} else {

			curveIcon.innerHTML = '<polyline points="9 17 9 5"/><polyline points="15 17 15 13"/><path d="M5 21h14"/>';

		}

		radialCurve.dataset.tip = variant || '1x1 corner';
		radialCurve.classList.toggle( 'radial-active', !! variant );

	}

	// Update elevate button state
	if ( actions.includes( 'rampStyle' ) ) {

		const cell = grid.get( cellKey( gx, gz ) );
		const parentCell = cell && cell.rampParent ? grid.get( cell.rampParent ) : null;
		const style = parentCell ? ( parentCell.rampStyle || 'steep' ) : 'steep';
		radialElevate.classList.toggle( 'radial-active', style === 'smooth' );
		radialElevate.dataset.tip = 'Ramp: ' + style;

	} else if ( actions.includes( 'elevate' ) ) {

		const cell = grid.get( cellKey( gx, gz ) );
		const elev = cell ? ( cell.elevation || 0 ) : 0;
		radialElevate.classList.toggle( 'radial-active', elev > 0 );
		radialElevate.dataset.tip = elev === 0 ? 'Elevate' : elev === 1 ? 'Half height' : 'Full height';

	}

	// Distribute around the cell center
	if ( buttons.length === 1 ) {

		// Single: above
		buttons[ 0 ].style.left = '-16px';
		buttons[ 0 ].style.top = ( - radius - 16 ) + 'px';
		buttons[ 0 ].classList.add( 'shown' );

	} else if ( buttons.length === 2 ) {

		// Two: left and right
		buttons[ 0 ].style.left = ( - radius - 16 ) + 'px';
		buttons[ 0 ].style.top = '-16px';
		buttons[ 0 ].classList.add( 'shown' );

		buttons[ 1 ].style.left = ( radius - 16 ) + 'px';
		buttons[ 1 ].style.top = '-16px';
		buttons[ 1 ].classList.add( 'shown' );

	} else {

		// Three: top, bottom-left, bottom-right
		buttons[ 0 ].style.left = '-16px';
		buttons[ 0 ].style.top = ( - radius - 16 ) + 'px';
		buttons[ 0 ].classList.add( 'shown' );

		buttons[ 1 ].style.left = ( - radius * 0.87 - 16 ) + 'px';
		buttons[ 1 ].style.top = ( radius * 0.5 - 16 ) + 'px';
		buttons[ 1 ].classList.add( 'shown' );

		buttons[ 2 ].style.left = ( radius * 0.87 - 16 ) + 'px';
		buttons[ 2 ].style.top = ( radius * 0.5 - 16 ) + 'px';
		buttons[ 2 ].classList.add( 'shown' );

	}

}

function hideRadialMenu() {

	radialMenu.classList.remove( 'visible' );
	radialRotate.classList.remove( 'shown' );
	radialCurve.classList.remove( 'shown' );
	radialElevate.classList.remove( 'shown' );
	radialGx = null;
	radialGz = null;

}

// ─── Radial button click handlers ─────────────────────────

radialRotate.addEventListener( 'click', ( e ) => {

	e.stopPropagation();
	if ( radialGx == null ) return;

	const key = cellKey( radialGx, radialGz );
	const cell = grid.get( key );
	if ( ! cell || ! cell.isFinish ) return;

	pushUndo();
	cell.orient = ORIENT_FLIP[ cell.orient ] ?? cell.orient;
	placeMesh( radialGx, radialGz, cell );
	save();
	updateFinishCar();
	showToast( 'Finish rotated' );

} );

radialCurve.addEventListener( 'click', ( e ) => {

	e.stopPropagation();
	if ( radialGx == null ) return;

	const key = cellKey( radialGx, radialGz );
	const cell = grid.get( key );
	if ( ! cell ) return;

	// Find the curve corner cell (might be this cell or a consumed straight's parent)
	let cornerCell = null, cornerGx, cornerGz;

	if ( cell.type === 'trk-corner-1x1' ) {

		cornerCell = cell;
		cornerGx = radialGx;
		cornerGz = radialGz;

	} else {

		for ( const [ ck, cc ] of grid ) {

			if ( cc.curveConsumed && cc.curveConsumed.has( key ) ) {

				cornerCell = cc;
				const parts = ck.split( ',' ).map( Number );
				cornerGx = parts[ 0 ];
				cornerGz = parts[ 1 ];
				break;

			}

		}

	}

	if ( ! cornerCell ) return;

	pushUndo();

	// Cycle through available curve variants
	const options = getAvailableCurveOptions( cornerGx, cornerGz );
	const cycleOrder = [ null, '2x2-wide', '3x3', '3x3-wide' ];
	const currentVariant = cornerCell.curveVariant || null;
	const rawIdx = cycleOrder.indexOf( currentVariant );
	const currentIdx = rawIdx === - 1 ? 0 : rawIdx; // unknown variant → start from beginning

	// Find next available variant in cycle order
	let nextVariant = null;
	for ( let i = 1; i <= cycleOrder.length; i ++ ) {

		const candidate = cycleOrder[ ( currentIdx + i ) % cycleOrder.length ];
		if ( candidate === null ) { nextVariant = null; break; }
		const opt = options.find( o => o.variant === candidate );
		if ( opt ) { nextVariant = candidate; break; }

	}

	// Apply the selected variant
	if ( nextVariant === null ) {

		// Revert to 1x1 corner
		cornerCell.curveVariant = undefined;
		cornerCell.curveSize = undefined;
		cornerCell.curveConsumed = undefined;
		showToast( '1x1 corner' );

	} else {

		const opt = options.find( o => o.variant === nextVariant );
		cornerCell.curveVariant = nextVariant;
		cornerCell.curveSize = opt.curveSize;
		cornerCell.curveConsumed = opt.consumed;
		showToast( nextVariant );

	}

	renderCurves();
	save();

	// Refresh menu state
	showRadialMenu( radialGx, radialGz );

} );

radialElevate.addEventListener( 'click', ( e ) => {

	e.stopPropagation();
	if ( radialGx == null ) return;

	const cell = grid.get( cellKey( radialGx, radialGz ) );

	// Auto-ramp cell: cycle ramp style on the parent elevated tile
	if ( cell && cell.autoRamp && cell.rampParent ) {

		const parentCell = grid.get( cell.rampParent );
		if ( parentCell ) {

			pushUndo();
			const currentStyle = parentCell.rampStyle || 'steep';
			parentCell.rampStyle = currentStyle === 'steep' ? 'smooth' : 'steep';
			const [ px, pz ] = cell.rampParent.split( ',' ).map( Number );
			recalculateRunRamps( px, pz );
			save();
			showToast( 'Ramp: ' + parentCell.rampStyle );

		}

	} else {

		cycleElevation( radialGx, radialGz );

	}

	// Refresh menu state
	showRadialMenu( radialGx, radialGz );

} );

// Prevent radial clicks from reaching the canvas
radialMenu.addEventListener( 'pointerdown', ( e ) => e.stopPropagation() );

// Save modal
const modalSave = document.getElementById( 'modal-save' );
const saveNameInput = document.getElementById( 'save-name' );

document.getElementById( 'btn-save' ).addEventListener( 'click', () => {

	if ( grid.size === 0 ) { showToast( 'Draw some road first!' ); return; }
	saveNameInput.value = '';
	modalSave.classList.remove( 'hidden' );
	saveNameInput.focus();

} );

document.getElementById( 'save-confirm' ).addEventListener( 'click', () => {

	const name = saveNameInput.value.trim();
	if ( ! name ) { showToast( 'Enter a name' ); return; }
	saveNamedTrack( name );
	modalSave.classList.add( 'hidden' );
	showToast( `Track "${ name }" saved!` );

} );

saveNameInput.addEventListener( 'keydown', ( e ) => {

	if ( e.key === 'Enter' ) document.getElementById( 'save-confirm' ).click();
	if ( e.key === 'Escape' ) modalSave.classList.add( 'hidden' );
	e.stopPropagation();

} );

document.getElementById( 'save-cancel' ).addEventListener( 'click', () => {

	modalSave.classList.add( 'hidden' );

} );

// Load modal
const modalLoad = document.getElementById( 'modal-load' );
const loadList = document.getElementById( 'load-list' );

document.getElementById( 'btn-load' ).addEventListener( 'click', () => {

	const tracks = getSavedTracks();
	loadList.innerHTML = '';

	if ( tracks.length === 0 ) {

		loadList.innerHTML = '<li class="empty-msg">No saved tracks yet</li>';

	} else {

		for ( const t of tracks ) {

			const li = document.createElement( 'li' );

			const info = document.createElement( 'div' );
			info.innerHTML = `<div class="track-name">${ t.name }</div><div class="track-meta">${ t.pieces } pieces &middot; ${ t.date }</div>`;
			info.style.cursor = 'pointer';
			info.style.flex = '1';
			info.addEventListener( 'click', () => {

				loadNamedTrack( t.cells );
				modalLoad.classList.add( 'hidden' );
				showToast( `Loaded "${ t.name }"` );

			} );

			const del = document.createElement( 'button' );
			del.className = 'delete-btn';
			del.textContent = '\u00d7';
			del.title = 'Delete';
			del.addEventListener( 'click', ( ev ) => {

				ev.stopPropagation();
				deleteNamedTrack( t.name );
				li.remove();
				if ( loadList.children.length === 0 ) {

					loadList.innerHTML = '<li class="empty-msg">No saved tracks yet</li>';

				}

				showToast( `Deleted "${ t.name }"` );

			} );

			li.appendChild( info );
			li.appendChild( del );
			loadList.appendChild( li );

		}

	}

	modalLoad.classList.remove( 'hidden' );

} );

document.getElementById( 'load-cancel' ).addEventListener( 'click', () => {

	modalLoad.classList.add( 'hidden' );

} );

// Close modals on overlay click
modalSave.addEventListener( 'click', ( e ) => {

	if ( e.target === modalSave ) modalSave.classList.add( 'hidden' );

} );

modalLoad.addEventListener( 'click', ( e ) => {

	if ( e.target === modalLoad ) modalLoad.classList.add( 'hidden' );

} );

// ─── Track validation ─────────────────────────────────────

function validateTrack() {

	// Find finish cell
	let startKey = null;

	for ( const [ key, cell ] of grid ) {

		if ( cell.isFinish ) { startKey = key; break; }

	}

	if ( ! startKey ) return { valid: false, message: 'No finish line found' };
	if ( grid.size < 4 ) return { valid: false, message: 'Track too short (need at least 4 pieces)' };

	// Walk the track from finish, following exits
	const [ sx, sz ] = startKey.split( ',' ).map( Number );
	const startCell = grid.get( startKey );
	const startExits = getCellExits( startCell );

	// Pick one exit direction to start walking
	const exitDirs = [
		{ bit: 8, dx: 0, dz: - 1 },
		{ bit: 4, dx: 0, dz: 1 },
		{ bit: 2, dx: 1, dz: 0 },
		{ bit: 1, dx: - 1, dz: 0 },
	];

	let walkDir = null;

	for ( const d of exitDirs ) {

		if ( ! ( startExits & d.bit ) ) continue;
		const nKey = cellKey( sx + d.dx, sz + d.dz );
		if ( grid.has( nKey ) ) { walkDir = d; break; }

	}

	if ( ! walkDir ) return { valid: false, message: 'Finish line has no connected road' };

	// Walk
	const visited = new Set();
	visited.add( startKey );
	let cx = sx + walkDir.dx;
	let cz = sz + walkDir.dz;
	let prevX = sx;
	let prevZ = sz;

	for ( let steps = 0; steps < 1000; steps ++ ) {

		const key = cellKey( cx, cz );

		// Did we loop back to start?
		if ( key === startKey ) {

			if ( visited.size === grid.size ) {

				return { valid: true, message: `Valid loop! (${ visited.size } pieces)` };

			}

			return {
				valid: false,
				message: `Loop found but ${ grid.size - visited.size } pieces are disconnected`
			};

		}

		const cell = grid.get( key );
		if ( ! cell ) return { valid: false, message: 'Track has a dead end' };

		if ( visited.has( key ) ) return { valid: false, message: 'Track crosses itself' };

		visited.add( key );

		// Find next cell: follow exits that aren't back where we came from
		const exits = getCellExits( cell );
		let moved = false;

		for ( const d of exitDirs ) {

			if ( ! ( exits & d.bit ) ) continue;
			const nx = cx + d.dx;
			const nz = cz + d.dz;
			if ( nx === prevX && nz === prevZ ) continue;

			prevX = cx;
			prevZ = cz;
			cx = nx;
			cz = nz;
			moved = true;
			break;

		}

		if ( ! moved ) return { valid: false, message: 'Track has a dead end' };

	}

	return { valid: false, message: 'Track is too long or has an issue' };

}

document.getElementById( 'btn-validate' ).addEventListener( 'click', () => {

	const result = validateTrack();

	if ( result.valid ) {

		showToast( '\u2705 ' + result.message );

	} else {

		showToast( '\u274c ' + result.message );

	}

} );

// ─── Track stats ──────────────────────────────────────────

function updateStats() {

	let pieces = 0, straights = 0, corners = 0;

	for ( const [ , cell ] of grid ) {

		pieces ++;
		if ( cell.type === 'trk-corner-1x1' ) corners ++;
		else straights ++;

	}

	const length = ( pieces * cellWorld ).toFixed( 0 );

	document.getElementById( 'stat-pieces' ).textContent = pieces;
	document.getElementById( 'stat-straights' ).textContent = straights;
	document.getElementById( 'stat-corners' ).textContent = corners;
	document.getElementById( 'stat-length' ).textContent = length + 'm';

	// Quick loop check
	const result = validateTrack();
	const loopEl = document.getElementById( 'stat-loop' );
	loopEl.textContent = result.valid ? 'Yes' : 'No';
	loopEl.className = result.valid ? 'ok' : 'warn';

}

// ─── Toast ────────────────────────────────────────────────

let toastTimer = 0;

function showToast( msg ) {

	const el = document.getElementById( 'toast' );
	el.textContent = msg;
	el.classList.add( 'show' );
	clearTimeout( toastTimer );
	toastTimer = setTimeout( () => el.classList.remove( 'show' ), 2000 );

}

// ─── Toolbar ──────────────────────────────────────────────

const btnRoad = document.getElementById( 'btn-road' );
const btnErase = document.getElementById( 'btn-erase' );
const btnElevate = document.getElementById( 'btn-elevate' );
const btnFinish = document.getElementById( 'btn-finish' );

const specialSelect = document.getElementById( 'special-tile-select' );

function selectTool( t ) {

	tool = t;
	btnRoad.classList.toggle( 'active', t === 'road' );
	btnErase.classList.toggle( 'active', t === 'erase' );
	btnElevate.classList.toggle( 'active', t === 'elevate' );
	btnFinish.classList.toggle( 'active', t === 'place-finish' );

	// Clear special tile selection when switching to a standard tool
	if ( t !== 'place-special' ) {

		selectedSpecialTile = '';
		specialSelect.value = '';

	}

}

btnRoad.addEventListener( 'click', () => selectTool( 'road' ) );
btnErase.addEventListener( 'click', () => selectTool( 'erase' ) );
btnElevate.addEventListener( 'click', () => selectTool( 'elevate' ) );
btnFinish.addEventListener( 'click', () => selectTool( 'place-finish' ) );

specialSelect.addEventListener( 'change', () => {

	const val = specialSelect.value;
	if ( val ) {

		selectedSpecialTile = val;
		tool = 'place-special';
		btnRoad.classList.remove( 'active' );
		btnErase.classList.remove( 'active' );
		btnElevate.classList.remove( 'active' );
		btnFinish.classList.remove( 'active' );

	} else {

		selectTool( 'road' );

	}

} );

document.getElementById( 'btn-undo' ).addEventListener( 'click', undo );
document.getElementById( 'btn-redo' ).addEventListener( 'click', redo );

document.getElementById( 'btn-play' ).addEventListener( 'click', () => {

	if ( grid.size === 0 ) {

		showToast( 'Draw some road first!' );
		return;

	}

	const encoded = encodeCells( getCellsArray() );
	window.open( 'index.html?map=' + encoded, '_blank' );

} );

document.getElementById( 'btn-share' ).addEventListener( 'click', () => {

	if ( grid.size === 0 ) {

		showToast( 'Draw some road first!' );
		return;

	}

	const encoded = encodeCells( getCellsArray() );
	const base = window.location.href.replace( /editor\.html.*/, '' );
	const url = base + 'index.html#map=' + encoded;

	navigator.clipboard.writeText( url ).then( () => {

		showToast( 'Link copied to clipboard!' );

	} ).catch( () => {

		showToast( url );

	} );

} );

document.getElementById( 'btn-clear' ).addEventListener( 'click', () => {

	clearAll();
	showToast( 'Track cleared' );

} );

// ─── Input (pointer events) ───────────────────────────────

let isPanning = false;
let isDrawing = false;
let isErasing = false;
let panStart = { x: 0, y: 0 };
let camStart = { x: 0, z: 0 };
let lastDrawCell = null;
let spaceDown = false;

// Track active pointers for multi-touch (pinch/pan)
const pointers = new Map();
let pinchStartDist = 0;
let pinchStartZoom = 1;

const el = renderer.domElement;

el.addEventListener( 'contextmenu', ( e ) => e.preventDefault() );

function handleDraw( clientX, clientY ) {

	const cell = screenToGrid( clientX, clientY );
	if ( ! cell ) return;

	if ( lastDrawCell && lastDrawCell.gx === cell.gx && lastDrawCell.gz === cell.gz ) return;
	lastDrawCell = cell;

	if ( isErasing ) {

		eraseRoad( cell.gx, cell.gz );

	} else if ( isDrawing ) {

		placeRoad( cell.gx, cell.gz );

	}

}

function getPinchDist() {

	const pts = [ ...pointers.values() ];
	const dx = pts[ 1 ].x - pts[ 0 ].x;
	const dy = pts[ 1 ].y - pts[ 0 ].y;
	return Math.sqrt( dx * dx + dy * dy );

}

function getPinchMid() {

	const pts = [ ...pointers.values() ];
	return {
		x: ( pts[ 0 ].x + pts[ 1 ].x ) / 2,
		y: ( pts[ 0 ].y + pts[ 1 ].y ) / 2
	};

}

el.addEventListener( 'pointerdown', ( e ) => {

	el.setPointerCapture( e.pointerId );
	pointers.set( e.pointerId, { x: e.clientX, y: e.clientY } );
	hideRadialMenu();

	// Two pointers → switch to pan/pinch
	if ( pointers.size === 2 ) {

		isDrawing = false;
		isErasing = false;
		isPanning = true;

		const mid = getPinchMid();
		panStart.x = mid.x;
		panStart.y = mid.y;
		camStart.x = camTarget.x;
		camStart.z = camTarget.z;
		pinchStartDist = getPinchDist();
		pinchStartZoom = camera.zoom;
		return;

	}

	if ( pointers.size > 2 ) return;

	// Single pointer
	// Middle mouse, ctrl+click, or space+click → pan
	if ( e.button === 1 || ( e.button === 0 && ( e.ctrlKey || e.metaKey || spaceDown ) ) ) {

		isPanning = true;
		panStart.x = e.clientX;
		panStart.y = e.clientY;
		camStart.x = camTarget.x;
		camStart.z = camTarget.z;
		el.style.cursor = 'grabbing';
		return;

	}

	if ( e.button === 0 ) {

		if ( tool === 'erase' ) {

			isErasing = true;

		} else {

			isDrawing = true;

		}

		lastDrawCell = null;

		// On touch, defer draw until pointermove confirms single-finger gesture
		if ( e.pointerType !== 'touch' ) handleDraw( e.clientX, e.clientY );

	} else if ( e.button === 2 ) {

		isOrbiting = true;
		orbitStartMouse = { x: e.clientX, y: e.clientY };
		orbitAngleStart = orbitAngle;
		tiltAngleStart = tiltAngle;
		camHeightStart = camTarget.y;
		camPanStart = { x: camTarget.x, z: camTarget.z };

	}

} );

el.addEventListener( 'pointermove', ( e ) => {

	pointers.set( e.pointerId, { x: e.clientX, y: e.clientY } );

	// Two-pointer pan + pinch
	if ( pointers.size === 2 && isPanning ) {

		const mid = getPinchMid();
		const scale = frustum * 2 / window.innerHeight / camera.zoom;
		const sdx = ( mid.x - panStart.x ) * scale;
		const sdy = ( mid.y - panStart.y ) * scale;
		const { right, fwd } = getCameraPanAxes();
		camTarget.x = camStart.x - right.x * sdx - fwd.x * sdy;
		camTarget.z = camStart.z - right.z * sdx - fwd.z * sdy;
		updateCamera();

		const dist = getPinchDist();
		camera.zoom = Math.max( 0.1, Math.min( 10, pinchStartZoom * ( dist / pinchStartDist ) ) );
		camera.updateProjectionMatrix();
		return;

	}

	// Orbit / tilt / height (right-click drag)
	if ( isOrbiting ) {

		const dx = e.clientX - orbitStartMouse.x;
		const dy = e.clientY - orbitStartMouse.y;

		if ( e.shiftKey ) {

			// Shift+RMB: height (up/down) and pan (left/right)
			camTarget.y = Math.max( - 20, Math.min( 20, camHeightStart - dy * 0.1 ) );
			const scale = frustum * 2 / window.innerHeight / camera.zoom;
			const { right } = getCameraPanAxes();
			camTarget.x = camPanStart.x + right.x * dx * scale;
			camTarget.z = camPanStart.z + right.z * dx * scale;

		} else {

			// RMB: orbit (left/right) and tilt (up/down)
			orbitAngle = orbitAngleStart + dx * 0.005;
			tiltAngle = Math.max( 0.17, Math.min( Math.PI / 2, tiltAngleStart - dy * 0.005 ) );

		}

		updateCamera();

		// Clear view preset active states when user manually orbits
		viewBtnTop.classList.remove( 'active' );
		viewBtnIso.classList.remove( 'active' );
		viewBtnFront.classList.remove( 'active' );
		return;

	}

	// Single-pointer pan
	if ( isPanning ) {

		const scale = frustum * 2 / window.innerHeight / camera.zoom;
		const sdx = ( e.clientX - panStart.x ) * scale * ( window.innerWidth / window.innerHeight );
		const sdy = ( e.clientY - panStart.y ) * scale;
		const { right, fwd } = getCameraPanAxes();
		camTarget.x = camStart.x - right.x * sdx - fwd.x * sdy;
		camTarget.z = camStart.z - right.z * sdx - fwd.z * sdy;
		updateCamera();
		return;

	}

	if ( isDrawing || isErasing ) {

		handleDraw( e.clientX, e.clientY );
		return;

	}

	// Hover ghost + cell indicator (mouse only)
	if ( e.pointerType === 'mouse' ) {

		const cell = screenToGrid( e.clientX, e.clientY );
		if ( cell ) {

			hoveredCell = cell;
			updateGhost( cell.gx, cell.gz );
			updateCellIndicator( cell.gx, cell.gz );
			showRadialMenu( cell.gx, cell.gz );
			updateDebugTooltip( cell.gx, cell.gz, e.clientX, e.clientY );

		} else {

			hoveredCell = null;
			clearGhost();
			hideCellIndicator();
			hideRadialMenu();
			hideDebugTooltip();

		}

	}

} );

window.addEventListener( 'pointerup', ( e ) => {

	pointers.delete( e.pointerId );

	if ( pointers.size === 0 ) {

		// Touch tap: if we deferred draw and never moved, draw now
		if ( ( isDrawing || isErasing ) && lastDrawCell === null && ! isPanning ) {

			handleDraw( e.clientX, e.clientY );

		}

		isPanning = false;
		isOrbiting = false;
		isDrawing = false;
		isErasing = false;
		lastDrawCell = null;
		el.style.cursor = spaceDown ? 'grab' : '';

	}

} );

window.addEventListener( 'pointercancel', ( e ) => {

	pointers.delete( e.pointerId );

} );

function zoomCamera( delta ) {

	const zoomSpeed = 1.08;
	camera.zoom *= delta > 0 ? 1 / zoomSpeed : zoomSpeed;
	camera.zoom = Math.max( 0.1, Math.min( 10, camera.zoom ) );
	camera.updateProjectionMatrix();

}

el.addEventListener( 'wheel', ( e ) => {

	e.preventDefault();
	zoomCamera( e.deltaY );

}, { passive: false } );

window.addEventListener( 'keydown', ( e ) => {

	// Don't capture keys when typing in an input
	if ( e.target.tagName === 'INPUT' ) return;

	if ( e.key === ' ' ) {

		if ( ! spaceDown ) {

			spaceDown = true;
			el.style.cursor = 'grab';

		}

		e.preventDefault();

	} else if ( e.key === '1' ) {

		selectTool( 'road' );

	} else if ( e.key === '2' ) {

		selectTool( 'erase' );

	} else if ( e.key === '3' ) {

		selectTool( 'elevate' );

	} else if ( e.key === '4' ) {

		selectTool( 'place-finish' );

	} else if ( e.key === '0' ) {

		setView( 'top' );

	} else if ( e.key === 'z' && ( e.ctrlKey || e.metaKey ) && e.shiftKey ) {

		e.preventDefault();
		redo();

	} else if ( e.key === 'z' && ( e.ctrlKey || e.metaKey ) ) {

		e.preventDefault();
		undo();

	} else if ( e.key === 'r' || e.key === 'R' ) {

		// Manual rotation: cycle orient 90° clockwise
		if ( hoveredCell ) {

			const key = cellKey( hoveredCell.gx, hoveredCell.gz );
			const cell = grid.get( key );
			if ( cell ) {

				pushUndo();

				// Clockwise cycle: 0 (0°) → 16 (90°) → 10 (180°) → 22 (270°) → 0
				const ORIENT_CYCLE = { 0: 16, 16: 10, 10: 22, 22: 0 };
				cell.orient = ORIENT_CYCLE[ cell.orient ] ?? 0;
				cell.rotationOverride = true;

				placeMesh( hoveredCell.gx, hoveredCell.gz, cell );
				renderCurves();
				save();

			}

		}

	} else if ( e.key === '+' || e.key === '=' ) {

		zoomCamera( - 1 );

	} else if ( e.key === '-' || e.key === '_' ) {

		zoomCamera( 1 );

	}

} );

window.addEventListener( 'keyup', ( e ) => {

	if ( e.key === ' ' ) {

		spaceDown = false;
		if ( ! isPanning ) el.style.cursor = '';

	}

} );

// ─── Init & render loop ───────────────────────────────────

try {
await loadModels();
console.log('[editor] models loaded');
initDebugMode();
console.log('[editor] debug mode initialized');
loadSaved();
console.log('[editor] save loaded');
} catch(e) { console.error('[editor] INIT FAILED:', e); }

// Start with a finish cell if the grid is empty
if ( grid.size === 0 ) {

	placeFinish();

}

updateStats();
updateFinishCar();

function animate() {

	requestAnimationFrame( animate );
	renderer.render( scene, camera );
	updateMinimap();

}

animate();


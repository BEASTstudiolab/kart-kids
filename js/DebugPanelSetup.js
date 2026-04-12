import * as THREE from 'three';
import { DebugMenu } from './DebugMenu.js';
import { CELL_RAW, GRID_SCALE, ORIENT_DEG } from './Track.js';
import { setBarrierEmissive, getBarrierEmissiveColor, getBarrierEmissiveIntensity } from './Lighting.js';


// ── Helper: text sprite for debug labels ────────────────────────────────────

function makeTextSprite( text, color = '#ffffff', fontSize = 48, scale = 2.5 ) {

	const canvas = document.createElement( 'canvas' );
	const ctx = canvas.getContext( '2d' );
	ctx.font = `bold ${fontSize}px monospace`;
	const metrics = ctx.measureText( text );
	const w = Math.ceil( metrics.width ) + 12;
	const h = fontSize + 12;
	canvas.width = w;
	canvas.height = h;
	ctx.font = `bold ${fontSize}px monospace`;
	ctx.fillStyle = 'rgba(0,0,0,0.6)';
	ctx.fillRect( 0, 0, w, h );
	ctx.fillStyle = color;
	ctx.textBaseline = 'middle';
	ctx.fillText( text, 6, h / 2 );
	const tex = new THREE.CanvasTexture( canvas );
	tex.minFilter = THREE.LinearFilter;
	const mat = new THREE.SpriteMaterial( { map: tex, depthTest: false, transparent: true } );
	const sprite = new THREE.Sprite( mat );
	sprite.scale.set( scale * ( w / h ), scale, 1 );
	return sprite;

}

// ── Helper: sprite label for axis ends ──────────────────────────────────────

function makeAxisLabel( text, color ) {

	const canvas = document.createElement( 'canvas' );
	canvas.width = 64; canvas.height = 32;
	const ctx = canvas.getContext( '2d' );
	ctx.font = 'bold 20px Arial';
	ctx.fillStyle = color;
	ctx.fillText( text, 14, 22 );
	const tex = new THREE.CanvasTexture( canvas );
	const mat = new THREE.SpriteMaterial( { map: tex, depthTest: false } );
	const sprite = new THREE.Sprite( mat );
	sprite.scale.set( 0.3, 0.15, 1 );
	return sprite;

}


/**
 * Sets up all debug visualization + the 4-tab debug menu.
 *
 * @param {object} ctx - Shared references from init()
 * @returns {{ debugMenu: DebugMenu, debugCollider: THREE.Mesh, wheelDebug: Array }}
 */
export function setupDebugPanel( ctx ) {

	const {
		scene, renderer, bloomPass, postFX,
		vehicle, cam, aiManager, controls,
		dirLight, dirLightOffset, hemiLight,
		meshDebugGroup, colliderDebugGroup, barrierDebugGroup,
		tileLabelsGroup, heightLabelsGroup,
		renderCells, models,
		groundIndicator, jitterDisplay, draftIndicator,
		applyLighting, LIGHTING_DAY, LIGHTING_NIGHT,
		fpsCapMs, draftIndicatorEnabled,
	} = ctx;

	// ── Debug label builders ─────────────────────────────────────────────────

	function rebuildMeshOutlines() {

		meshDebugGroup.clear();
		const S = GRID_SCALE;

		for ( const cell of renderCells ) {

			const [ gx, gz, key, , flags ] = cell;
			if ( ! key ) continue;

			const x = ( gx + 0.5 ) * CELL_RAW * S;
			const z = ( gz + 0.5 ) * CELL_RAW * S;
			const elev = flags?.elevation || 0;
			const elevY = elev === 1 ? 2.416 : elev === 2 ? 4.832 : 0;
			const cubeH = 1.5;
			const y = elevY - 0.5 + cubeH / 2;

			const mesh = new THREE.Mesh( new THREE.BoxGeometry( CELL_RAW * S, cubeH, CELL_RAW * S ) );
			mesh.position.set( x, y, z );
			const helper = new THREE.BoxHelper( mesh, 0x00ffff );
			helper.material.depthTest = false;
			helper.material.transparent = true;
			helper.material.opacity = 0.6;
			meshDebugGroup.add( helper );

		}

	}

	function buildTileLabels() {

		const S = GRID_SCALE;
		for ( const cell of renderCells ) {

			const [ gx, gz, key, orient, flags ] = cell;
			if ( ! key ) continue;
			const x = ( gx + 0.5 ) * CELL_RAW * S;
			const z = ( gz + 0.5 ) * CELL_RAW * S;
			const elev = flags?.elevation || 0;
			const elevY = elev === 1 ? 2.416 : elev === 2 ? 4.832 : 0;
			const y = elevY + 2.5;
			const label = `${key} [${orient}]`;
			const sprite = makeTextSprite( label, '#00ffcc', 24, 0.25 );
			sprite.position.set( x, y, z );
			tileLabelsGroup.add( sprite );

		}

	}

	function buildHeightLabels() {

		const S = GRID_SCALE;
		// Known model-space heights (from GLTF accessor measurements)
		const ROAD_Y = 0.185;   // top of road surface
		const WALL_Y = 0.935;   // top of barrier/curb
		const BASE_Y = 0.085;   // bottom of road

		const samples = [
			{ label: 'L wall top', lx: - 4.8, modelY: WALL_Y },
			{ label: 'R wall top', lx: 4.8, modelY: WALL_Y },
			{ label: 'L curb', lx: - 4.0, modelY: ROAD_Y },
			{ label: 'R curb', lx: 4.0, modelY: ROAD_Y },
			{ label: 'road', lx: 0, modelY: ROAD_Y },
			{ label: 'base', lx: 0, modelY: BASE_Y },
		];

		for ( const cell of renderCells ) {

			const [ gx, gz, key, orient, flags ] = cell;
			if ( ! key ) continue;

			const cx = ( gx + 0.5 ) * CELL_RAW * S;
			const cz = ( gz + 0.5 ) * CELL_RAW * S;
			const elev = flags?.elevation || 0;
			const elevY = elev === 1 ? 2.416 : elev === 2 ? 4.832 : 0;
			const deg = ORIENT_DEG[ orient ] ?? 0;
			const rad = deg * Math.PI / 180;
			const cr = Math.cos( rad ), sr = Math.sin( rad );

			for ( const sample of samples ) {

				const wx = cx + ( sample.lx * cr ) * S;
				const wz = cz + ( - sample.lx * sr ) * S;
				const worldY = sample.modelY + elevY;
				const yText = `${sample.label}: ${worldY.toFixed( 2 )}m`;
				const sprite = makeTextSprite( yText, '#ffaa00', 24, 0.25 );
				sprite.position.set( wx, worldY + 0.3, wz );
				heightLabelsGroup.add( sprite );

			}

		}

	}

	// ── Debug collider visualisation ─────────────────────────────────────────

	// Vehicle physics collider: box with halfExtents [0.4, 0.3, 0.7] (from Physics.js)
	const debugCollider = new THREE.Mesh(
		new THREE.BoxGeometry( 0.8, 0.6, 1.4 ),
		new THREE.MeshBasicMaterial( { color: 0x00ff00, wireframe: true } )
	);
	debugCollider.visible = false;
	scene.add( debugCollider );

	// Per-wheel: yellow box + local axes (Red=X roll, Green=Y steer, Blue=Z) + labels
	const wheelDebug = vehicle.wheels.map( ( w ) => {

		const boxH = new THREE.BoxHelper( w, 0xffff00 );
		boxH.visible = false;
		scene.add( boxH );

		const axes = new THREE.AxesHelper( 0.5 );
		axes.visible = false;
		w.add( axes );

		const xLabel = makeAxisLabel( 'X', '#ff4444' );
		xLabel.position.set( 0.65, 0, 0 );
		xLabel.visible = false;
		w.add( xLabel );

		const yLabel = makeAxisLabel( 'Y', '#44ff44' );
		yLabel.position.set( 0, 0.65, 0 );
		yLabel.visible = false;
		w.add( yLabel );

		const zLabel = makeAxisLabel( 'Z', '#4488ff' );
		zLabel.position.set( 0, 0, 0.65 );
		zLabel.visible = false;
		w.add( zLabel );

		return { boxH, axes, labels: [ xLabel, yLabel, zLabel ] };

	} );

	// ── HUD PANEL (toggle with H key) ────────────────────────────────────────

	const debugHud = document.createElement( 'div' );
	debugHud.style.cssText = [
		'position:fixed', 'top:12px', 'right:12px',
		'background:rgba(0,0,0,0.72)', 'color:#0f0', 'font:13px/1.6 monospace',
		'padding:10px 14px', 'border-radius:6px', 'pointer-events:none',
		'min-width:260px', 'white-space:pre', 'z-index:999',
	].join( ';' );
	document.body.appendChild( debugHud );

	debugHud.style.display = 'none';
	window.addEventListener( 'keydown', ( e ) => {

		if ( e.key === 'h' || e.key === 'H' ) {

			debugHud.style.display = debugHud.style.display === 'none' ? 'block' : 'none';

		}

	} );

	// ── DEBUG CONTROLS PANEL (tabbed, toggle with M) ─────────────────────────

	const debugMenu = new DebugMenu();

	// ── Tab: General ─────────────────────────────────────────────────────────
	const generalTab = debugMenu.addTab( 'general', 'General' );

	debugMenu.addHeader( generalTab, 'Environment' );

	debugMenu.addCheckbox( generalTab, 'Night mode', false, ( v ) => {

		applyLighting( v ? LIGHTING_NIGHT : LIGHTING_DAY );
		for ( const hl of vehicle.headlights ) hl.visible = v;

	} );

	{

		const row = document.createElement( 'div' );
		row.style.cssText = 'margin:4px 0;display:flex;align-items:center;gap:6px';

		const lbl = document.createElement( 'span' );
		lbl.style.cssText = 'min-width:100px';
		lbl.textContent = 'Vehicle';

		const select = document.createElement( 'select' );
		select.style.cssText = 'flex:1;background:#222;color:#0f0;border:1px solid #0f0;font:12px monospace;padding:2px';

		const truckNames = [
			'vehicle-truck-yellow', 'vehicle-truck-green',
			'vehicle-truck-purple', 'vehicle-truck-red',
		];

		for ( const name of truckNames ) {

			const opt = document.createElement( 'option' );
			opt.value = name;
			opt.textContent = name.replace( 'vehicle-truck-', '' );
			select.appendChild( opt );

		}

		let playerModelIndex = 0;

		select.addEventListener( 'change', () => {

			const newModel = models[ select.value ];
			if ( ! newModel ) return;

			playerModelIndex = truckNames.indexOf( select.value );
			aiManager.playerModelIndex = playerModelIndex;

			const oldLights = [ vehicle.underglowLight, ...vehicle.headlights ];
			const oldTargets = vehicle.headlights.map( ( hl ) => hl.target );

			vehicle.container.clear();
			vehicle.wheels = [];
			vehicle.wheelFL = vehicle.wheelFR = vehicle.wheelBL = vehicle.wheelBR = null;
			vehicle.bodyNode = null;

			const vehicleModel = newModel.clone();
			vehicle.container.add( vehicleModel );

			vehicleModel.traverse( ( child ) => {

				const name = child.name.toLowerCase();

				if ( name === 'body' ) {

					child.rotation.order = 'YXZ';
					vehicle.bodyNode = child;

				} else if ( name.includes( 'wheel' ) && ! name.includes( 'steering' ) ) {

					child.rotation.order = 'YXZ';
					vehicle.wheels.push( child );

					if ( name.includes( 'front' ) && name.includes( 'left' ) ) vehicle.wheelFL = child;
					if ( name.includes( 'front' ) && name.includes( 'right' ) ) vehicle.wheelFR = child;
					if ( name.includes( 'back' ) && name.includes( 'left' ) ) vehicle.wheelBL = child;
					if ( name.includes( 'back' ) && name.includes( 'right' ) ) vehicle.wheelBR = child;

				}

				if ( child.isMesh ) {

					child.castShadow = true;
					child.receiveShadow = true;

				}

			} );

			vehicle.container.add( oldLights[ 0 ] );
			for ( let i = 0; i < vehicle.headlights.length; i ++ ) {

				vehicle.container.add( oldTargets[ i ] );
				vehicle.container.add( vehicle.headlights[ i ] );

			}

		} );

		row.appendChild( lbl );
		row.appendChild( select );
		generalTab.appendChild( row );

	}

	debugMenu.addHeader( generalTab, 'Debug visuals' );

	debugMenu.addCheckbox( generalTab, 'Top-down camera', false, ( v ) => {

		cam.mode = v ? 'topdown' : 'chase';

	} );

	debugMenu.addCheckbox( generalTab, 'Show Vehicle Physics Collider', false, ( v ) => {

		debugCollider.visible = v;

	} );

	debugMenu.addCheckbox( generalTab, 'Show mesh outlines (cyan)', false, ( v ) => {

		if ( v && meshDebugGroup.children.length === 0 ) rebuildMeshOutlines();
		meshDebugGroup.visible = v;

	} );

	debugMenu.addCheckbox( generalTab, 'Show collider geometry (pink)', false, ( v ) => {

		colliderDebugGroup.visible = v;

	} );

	debugMenu.addCheckbox( generalTab, 'Show barrier extensions (cyan)', false, ( v ) => {

		if ( barrierDebugGroup ) barrierDebugGroup.visible = v;

	} );

	debugMenu.addCheckbox( generalTab, 'Show tile names', false, ( v ) => {

		if ( v && tileLabelsGroup.children.length === 0 ) buildTileLabels();
		tileLabelsGroup.visible = v;

	} );

	debugMenu.addCheckbox( generalTab, 'Show Y heights', false, ( v ) => {

		if ( v && heightLabelsGroup.children.length === 0 ) buildHeightLabels();
		heightLabelsGroup.visible = v;

	} );

	debugMenu.addCheckbox( generalTab, 'Jitter diagnostic overlay', false, ( v ) => {

		jitterDisplay.style.display = v ? 'block' : 'none';

	} );

	// Decoration layer toggles
	const tg = scene.getObjectByName( 'trackGroup' );
	const decoLayers = tg && tg.userData.decoLayers;
	if ( decoLayers ) {

		debugMenu.addHeader( generalTab, 'Decoration layers' );

		debugMenu.addCheckbox( generalTab, 'buildings-1', true, ( v ) => { decoLayers[ 'buildings-1' ].visible = v; } );
		debugMenu.addCheckbox( generalTab, 'buildings-2', true, ( v ) => { decoLayers[ 'buildings-2' ].visible = v; } );
		debugMenu.addCheckbox( generalTab, 'empty-night', true, ( v ) => { decoLayers[ 'empty-night' ].visible = v; } );

	}

	debugMenu.addCheckbox( generalTab, 'Show ground plane indicator', false, ( v ) => {

		groundIndicator.visible = v;

	} );

	debugMenu.addSlider( generalTab, 'FPS cap', 0, 240, 1, 0, ( v ) => {

		fpsCapMs.value = v > 0 ? 1000 / v : 0;

	} );

	debugMenu.addCheckbox( generalTab, 'Show wheel debug', false, ( v ) => {

		for ( const wd of wheelDebug ) {

			wd.boxH.visible = v;
			wd.axes.visible = v;
			for ( const l of wd.labels ) l.visible = v;

		}

	} );

	debugMenu.addCheckbox( generalTab, 'Show draft debug', false, ( v ) => {

		draftIndicatorEnabled.value = v;
		if ( ! v ) draftIndicator.style.display = 'none';

	} );

	debugMenu.addHeader( generalTab, 'Height offsets (Y axis)' );

	debugMenu.addSlider( generalTab, 'Wheel height', - 1.0, 1.0, 0.01, 0, ( v ) => { vehicle.debug.wheelHeight = v; } );
	debugMenu.addSlider( generalTab, 'Body height', - 1.0, 1.0, 0.01, 0.2, ( v ) => { vehicle.debug.bodyHeight = v; } );
	debugMenu.addSlider( generalTab, 'Underbody', - 2.0, 1.0, 0.01, - 0.5, ( v ) => { vehicle.debug.underbodyOffset = v; } );
	debugMenu.addSlider( generalTab, 'Ride height', 0, 0.5, 0.01, 0, ( v ) => { vehicle.debug.rideHeight = v; } );
	debugMenu.addSlider( generalTab, 'Chase cam height', 0, 10.0, 0.1, 2, ( v ) => { cam.chaseHeight = v; } );
	debugMenu.addSlider( generalTab, 'Zoom', 0.5, 3.0, 0.05, 1.0, ( v ) => { cam.zoom = v; } );
	debugMenu.addSlider( generalTab, 'Acceleration', 1, 20, 0.5, 1, ( v ) => { vehicle.debug.accelerationRate = v; } );
	debugMenu.addSlider( generalTab, 'Top speed', 10, 300, 5, 250, ( v ) => { vehicle.debug.topSpeed = v; } );

	debugMenu.addHeader( generalTab, 'Camera G-Force' );

	debugMenu.addCheckbox( generalTab, 'G-Force Effects', true, ( v ) => { cam.gforceEnabled = v; } );
	debugMenu.addSlider( generalTab, 'Roll intensity', 0, 1.0, 0.01, 0.35, ( v ) => { cam.rollIntensity = v; } );
	debugMenu.addSlider( generalTab, 'FOV narrow', 0, 16, 0.5, 8, ( v ) => { cam.fovNarrowMax = v; } );
	debugMenu.addSlider( generalTab, 'Boost punch', 0, 20, 0.5, 8, ( v ) => { cam.boostPunchAmount = v; } );

	debugMenu.addHeader( generalTab, 'AI Racers' );

	debugMenu.addSlider( generalTab, 'AI count', 0, 8, 1, 0, ( v ) => { aiManager.setCount( v ); } );
	debugMenu.addSlider( generalTab, 'Rubber band %', 0, 100, 1, 50, ( v ) => { aiManager.rubberBandIntensity = v / 100; } );

	const aiPersonalityLabel = document.createElement( 'div' );
	aiPersonalityLabel.style.cssText = 'margin:4px 0;font-size:11px;color:#0f08';
	aiPersonalityLabel.textContent = '';
	generalTab.appendChild( aiPersonalityLabel );

	// Update personality display when AI count changes
	const updatePersonalityLabel = () => {

		const data = aiManager.getAIRaceData();
		if ( data.length === 0 ) {

			aiPersonalityLabel.textContent = '';

		} else {

			aiPersonalityLabel.textContent = 'Personalities: ' + data.map( ( d ) => d.profileName ).join( ', ' );

		}

	};

	// Poll every 500ms (lightweight, only when debug visible)
	setInterval( () => { if ( debugMenu.visible ) updatePersonalityLabel(); }, 500 );

	// ── Tab: Post FX ─────────────────────────────────────────────────────────
	const postFXTab = debugMenu.addTab( 'postprocessing', 'Post FX' );

	// Active preset label
	const presetLabel = document.createElement( 'div' );
	presetLabel.style.cssText = 'margin:4px 0 8px;padding:4px 8px;background:#0f02;border:1px solid #0f044;border-radius:3px;text-align:center';
	presetLabel.textContent = 'Active preset: detecting...';
	postFXTab.appendChild( presetLabel );
	window.addEventListener( 'settings-changed', ( e ) => {

		if ( e.detail.key === 'quality' ) presetLabel.textContent = 'Active preset: ' + e.detail.value;

	} );

	debugMenu.addHeader( postFXTab, 'Bloom / Glow' );

	let _savedBloomStrength = bloomPass.strength;
	debugMenu.addCheckbox( postFXTab, 'Bloom enabled', true, ( v ) => {

		if ( v ) {

			bloomPass.strength = _savedBloomStrength;

		} else {

			_savedBloomStrength = bloomPass.strength;
			bloomPass.strength = 0;

		}

	} );

	debugMenu.addCheckbox( postFXTab, 'Glow (underglow light)', true, ( v ) => {

		if ( vehicle.underglowLight ) vehicle.underglowLight.visible = v;
		vehicle._glowEnabled = v;

	} );

	debugMenu.addCheckbox( postFXTab, 'Emissive materials', true, ( v ) => {

		scene.traverse( ( child ) => {

			if ( child.isMesh && child.material && child.material.emissiveIntensity !== undefined ) {

				child.material.emissiveIntensity = v ? child.material.userData._origEmissive || 0.8 : 0;
				if ( v && ! child.material.userData._origEmissive ) {

					child.material.userData._origEmissive = child.material.emissiveIntensity;

				}

			}

		} );

	} );

	debugMenu.addSlider( postFXTab, 'Bloom strength', 0, 3.0, 0.01, bloomPass.strength, ( v ) => { bloomPass.strength = v; } );
	debugMenu.addSlider( postFXTab, 'Bloom radius', 0, 1.0, 0.01, bloomPass.radius, ( v ) => { bloomPass.radius = v; } );
	debugMenu.addSlider( postFXTab, 'Bloom threshold', 0, 1.0, 0.01, bloomPass.threshold, ( v ) => { bloomPass.threshold = v; } );

	debugMenu.addHeader( postFXTab, 'Motion Blur' );

	debugMenu.addCheckbox( postFXTab, 'Motion Blur', false, ( v ) => { postFX.setEnabled( 'motionBlur', v ); } );
	debugMenu.addSlider( postFXTab, 'MB Intensity', 0, 1.0, 0.01, 0.5, ( v ) => { postFX.getPass( 'motionBlur' ).uniforms.intensity.value = v; } );
	debugMenu.addSlider( postFXTab, 'MB Samples', 1, 16, 1, 8, ( v ) => { postFX.getPass( 'motionBlur' ).uniforms.samples.value = v; } );

	debugMenu.addHeader( postFXTab, 'Chromatic Aberration' );

	debugMenu.addCheckbox( postFXTab, 'Chromatic Aberration', false, ( v ) => { postFX.setEnabled( 'chromaticAberration', v ); } );
	debugMenu.addSlider( postFXTab, 'CA Offset', 0, 0.02, 0.001, 0.005, ( v ) => { postFX.getPass( 'chromaticAberration' ).uniforms.offset.value = v; } );

	debugMenu.addHeader( postFXTab, 'Radial Zoom Blur' );

	debugMenu.addCheckbox( postFXTab, 'Radial Zoom', false, ( v ) => { postFX.setEnabled( 'radialZoom', v ); } );
	debugMenu.addSlider( postFXTab, 'RZ Intensity', 0, 1.0, 0.01, 0.3, ( v ) => { postFX.getPass( 'radialZoom' ).uniforms.intensity.value = v; } );

	debugMenu.addHeader( postFXTab, 'Vignette' );

	debugMenu.addCheckbox( postFXTab, 'Vignette', false, ( v ) => { postFX.setEnabled( 'vignette', v ); } );
	debugMenu.addSlider( postFXTab, 'Vignette intensity', 0, 1.5, 0.01, 0.5, ( v ) => { postFX.getPass( 'vignette' ).uniforms.intensity.value = v; } );
	debugMenu.addSlider( postFXTab, 'Vignette softness', 0, 1.0, 0.01, 0.5, ( v ) => { postFX.getPass( 'vignette' ).uniforms.softness.value = v; } );

	debugMenu.addHeader( postFXTab, 'Color Grading' );

	debugMenu.addCheckbox( postFXTab, 'Color Grading', false, ( v ) => { postFX.setEnabled( 'colorGrading', v ); } );
	debugMenu.addSlider( postFXTab, 'Brightness', - 1, 1, 0.01, 0, ( v ) => { postFX.getPass( 'colorGrading' ).uniforms.brightness.value = v; } );
	debugMenu.addSlider( postFXTab, 'Contrast', 0, 2, 0.01, 1, ( v ) => { postFX.getPass( 'colorGrading' ).uniforms.contrast.value = v; } );
	debugMenu.addSlider( postFXTab, 'Saturation', 0, 2, 0.01, 1, ( v ) => { postFX.getPass( 'colorGrading' ).uniforms.saturation.value = v; } );

	debugMenu.addHeader( postFXTab, 'Screen Shake' );

	debugMenu.addCheckbox( postFXTab, 'Screen Shake', false, ( v ) => { postFX.setEnabled( 'screenShake', v ); } );
	debugMenu.addSlider( postFXTab, 'Shake Intensity', 0, 0.05, 0.001, 0.02, ( v ) => { postFX.shakeIntensity = v; } );
	debugMenu.addSlider( postFXTab, 'Shake Decay', 1, 20, 0.5, 10, ( v ) => { postFX.shakeDecay = v; } );
	debugMenu.addButton( postFXTab, 'Test Shake', () => { postFX.triggerScreenShake( 0.03 ); } );

	debugMenu.addHeader( postFXTab, 'SSAO' );

	debugMenu.addCheckbox( postFXTab, 'SSAO', false, ( v ) => { postFX.setEnabled( 'ssao', v ); } );
	debugMenu.addSlider( postFXTab, 'SSAO Radius', 0, 4, 0.1, 1, ( v ) => { postFX.setSSAOParam( 'kernelRadius', v ); } );
	debugMenu.addSlider( postFXTab, 'SSAO Min Dist', 0, 0.01, 0.001, 0.001, ( v ) => { postFX.setSSAOParam( 'minDistance', v ); } );
	debugMenu.addSlider( postFXTab, 'SSAO Max Dist', 0, 0.1, 0.005, 0.05, ( v ) => { postFX.setSSAOParam( 'maxDistance', v ); } );

	debugMenu.addHeader( postFXTab, 'God Rays' );

	debugMenu.addCheckbox( postFXTab, 'God Rays', false, ( v ) => { postFX.setEnabled( 'godRays', v ); } );
	debugMenu.addSlider( postFXTab, 'GR Intensity', 0, 2, 0.01, 1.0, ( v ) => { postFX.getPass( 'godRays' ).uniforms.intensity.value = v; } );
	debugMenu.addSlider( postFXTab, 'GR Decay', 0.9, 1.0, 0.005, 0.96, ( v ) => { postFX.getPass( 'godRays' ).uniforms.decay.value = v; } );
	debugMenu.addSlider( postFXTab, 'GR Density', 0, 1, 0.01, 0.5, ( v ) => { postFX.getPass( 'godRays' ).uniforms.density.value = v; } );
	debugMenu.addSlider( postFXTab, 'GR Weight', 0, 1, 0.01, 0.1, ( v ) => { postFX.getPass( 'godRays' ).uniforms.weight.value = v; } );

	// ── Tab: Physics ─────────────────────────────────────────────────────────
	const physicsTab = debugMenu.addTab( 'physics', 'Physics' );

	debugMenu.addHeader( physicsTab, 'Wheel rotation locks' );

	debugMenu.addCheckbox( physicsTab, 'Lock X', false, ( v ) => { vehicle.debug.lockX = v; } );
	debugMenu.addCheckbox( physicsTab, 'Lock Y (roll)', false, ( v ) => { vehicle.debug.lockY = v; } );
	debugMenu.addCheckbox( physicsTab, 'Lock Z (steer)', false, ( v ) => { vehicle.debug.lockZ = v; } );

	debugMenu.addHeader( physicsTab, 'Vehicle Physics' );

	debugMenu.addSlider( physicsTab, 'Steering multiplier', 0.5, 10, 0.1, vehicle.debug.steeringMultiplier, ( v ) => { vehicle.debug.steeringMultiplier = v; } );
	debugMenu.addSlider( physicsTab, 'Steering lerp', 0.5, 15, 0.1, vehicle.debug.steeringLerp, ( v ) => { vehicle.debug.steeringLerp = v; } );
	debugMenu.addSlider( physicsTab, 'Steering grip min', 0.0, 1.0, 0.01, vehicle.debug.steeringGripMin, ( v ) => { vehicle.debug.steeringGripMin = v; } );
	debugMenu.addSlider( physicsTab, 'Steering grip max', 0.2, 2.0, 0.01, vehicle.debug.steeringGripMax, ( v ) => { vehicle.debug.steeringGripMax = v; } );
	debugMenu.addSlider( physicsTab, 'Brake rate', 1, 20, 0.5, vehicle.debug.brakeRate, ( v ) => { vehicle.debug.brakeRate = v; } );
	debugMenu.addSlider( physicsTab, 'Reverse speed factor', 0.1, 1.0, 0.05, vehicle.debug.reverseSpeedFactor, ( v ) => { vehicle.debug.reverseSpeedFactor = v; } );
	debugMenu.addSlider( physicsTab, 'Reverse accel rate', 0.5, 10, 0.5, vehicle.debug.reverseAccelRate, ( v ) => { vehicle.debug.reverseAccelRate = v; } );
	debugMenu.addSlider( physicsTab, 'Linear damp', 0.0, 1.0, 0.01, vehicle.debug.linearDamp, ( v ) => { vehicle.debug.linearDamp = v; } );
	debugMenu.addSlider( physicsTab, 'Speed scale', 1, 30, 0.5, vehicle.debug.speedScale, ( v ) => { vehicle.debug.speedScale = v; } );
	debugMenu.addSlider( physicsTab, 'Velocity blend rate', 1, 20, 0.5, vehicle.debug.velocityBlendRate, ( v ) => { vehicle.debug.velocityBlendRate = v; } );

	debugMenu.addHeader( physicsTab, 'Drift & Boost' );

	debugMenu.addSlider( physicsTab, 'Drift threshold', 0.1, 5.0, 0.1, vehicle.debug.driftThreshold, ( v ) => { vehicle.debug.driftThreshold = v; } );
	debugMenu.addSlider( physicsTab, 'Boost fill time', 5, 60, 1, vehicle.debug.boostFillTime, ( v ) => { vehicle.debug.boostFillTime = v; } );
	debugMenu.addSlider( physicsTab, 'Boost drift multiplier', 1, 15, 0.5, vehicle.debug.boostDriftMultiplier, ( v ) => { vehicle.debug.boostDriftMultiplier = v; } );
	debugMenu.addSlider( physicsTab, 'Boost duration', 1, 15, 0.5, vehicle.debug.boostDuration, ( v ) => { vehicle.debug.boostDuration = v; } );
	debugMenu.addSlider( physicsTab, 'Boost top speed', 100, 500, 10, vehicle.debug.boostTopSpeed, ( v ) => { vehicle.debug.boostTopSpeed = v; } );

	debugMenu.addHeader( physicsTab, 'Body Lean' );

	debugMenu.addSlider( physicsTab, 'Body lean pitch', 1, 20, 0.5, vehicle.debug.bodyLeanPitch, ( v ) => { vehicle.debug.bodyLeanPitch = v; } );
	debugMenu.addSlider( physicsTab, 'Body lean roll', 1, 20, 0.5, vehicle.debug.bodyLeanRoll, ( v ) => { vehicle.debug.bodyLeanRoll = v; } );

	debugMenu.addHeader( physicsTab, 'Suspension' );

	debugMenu.addSlider( physicsTab, 'Susp stiffness', 50, 500, 5, vehicle.debug.suspStiffness, ( v ) => { vehicle.debug.suspStiffness = v; } );
	debugMenu.addSlider( physicsTab, 'Susp damping', 5, 50, 1, vehicle.debug.suspDamping, ( v ) => { vehicle.debug.suspDamping = v; } );
	debugMenu.addSlider( physicsTab, 'Max compress', 0.05, 0.4, 0.01, vehicle.debug.suspMaxCompress, ( v ) => { vehicle.debug.suspMaxCompress = v; } );
	debugMenu.addSlider( physicsTab, 'Max extend', 0.05, 0.5, 0.01, vehicle.debug.suspMaxExtend, ( v ) => { vehicle.debug.suspMaxExtend = v; } );

	debugMenu.addHeader( physicsTab, 'Bump Physics' );

	debugMenu.addSlider( physicsTab, 'Weight', 1, 10, 1, vehicle.weight, ( v ) => { vehicle.weight = v; } );
	debugMenu.addSlider( physicsTab, 'Bump force scale', 0, 3, 0.1, vehicle.debug.bumpForceScale, ( v ) => { vehicle.debug.bumpForceScale = v; } );
	debugMenu.addSlider( physicsTab, 'Bump max force', 0, 30, 0.5, vehicle.debug.bumpMaxForce, ( v ) => { vehicle.debug.bumpMaxForce = v; } );
	debugMenu.addSlider( physicsTab, 'Bump lateral bias', 0, 1, 0.05, vehicle.debug.bumpLateralBias, ( v ) => { vehicle.debug.bumpLateralBias = v; } );
	debugMenu.addSlider( physicsTab, 'Bump cooldown', 0, 2, 0.05, vehicle.debug.bumpCooldown, ( v ) => { vehicle.debug.bumpCooldown = v; } );

	// ── Tab: Lighting ────────────────────────────────────────────────────────
	const lightingTab = debugMenu.addTab( 'lighting', 'Lighting' );

	debugMenu.addHeader( lightingTab, 'Exposure' );

	debugMenu.addSlider( lightingTab, 'Exposure', 0, 3.0, 0.01, renderer.toneMappingExposure, ( v ) => { renderer.toneMappingExposure = v; } );

	debugMenu.addHeader( lightingTab, 'Directional light' );

	debugMenu.addSlider( lightingTab, 'Dir X', - 30, 30, 0.1, dirLightOffset.x, ( v ) => { dirLightOffset.x = v; } );
	debugMenu.addSlider( lightingTab, 'Dir Y', 0, 40, 0.1, dirLightOffset.y, ( v ) => { dirLightOffset.y = v; } );
	debugMenu.addSlider( lightingTab, 'Dir Z', - 30, 30, 0.1, dirLightOffset.z, ( v ) => { dirLightOffset.z = v; } );
	debugMenu.addSlider( lightingTab, 'Dir intensity', 0, 10, 0.1, dirLight.intensity, ( v ) => { dirLight.intensity = v; } );
	debugMenu.addColorPicker( lightingTab, 'Dir color', dirLight.color.getHex(), ( v ) => { dirLight.color.setHex( v ); } );

	debugMenu.addHeader( lightingTab, 'Hemisphere light' );

	debugMenu.addSlider( lightingTab, 'Hemi intensity', 0, 5, 0.05, hemiLight.intensity, ( v ) => { hemiLight.intensity = v; } );
	debugMenu.addColorPicker( lightingTab, 'Sky color', hemiLight.color.getHex(), ( v ) => { hemiLight.color.setHex( v ); } );
	debugMenu.addColorPicker( lightingTab, 'Ground color', hemiLight.groundColor.getHex(), ( v ) => { hemiLight.groundColor.setHex( v ); } );

	debugMenu.addHeader( lightingTab, 'Fog' );

	debugMenu.addSlider( lightingTab, 'Fog near', 0, 200, 1, scene.fog ? scene.fog.near : 30, ( v ) => { if ( scene.fog ) scene.fog.near = v; } );
	debugMenu.addSlider( lightingTab, 'Fog far', 0, 400, 1, scene.fog ? scene.fog.far : 55, ( v ) => { if ( scene.fog ) scene.fog.far = v; } );
	debugMenu.addColorPicker( lightingTab, 'Fog color', scene.fog ? scene.fog.color.getHex() : 0xadb2ba, ( v ) => { if ( scene.fog ) scene.fog.color.setHex( v ); } );

	debugMenu.addHeader( lightingTab, 'Skybox' );

	debugMenu.addSlider( lightingTab, 'Sky intensity', 0, 3.0, 0.05, scene.backgroundIntensity ?? 1.0, ( v ) => { scene.backgroundIntensity = v; } );
	debugMenu.addSlider( lightingTab, 'Sky blurriness', 0, 1.0, 0.01, scene.backgroundBlurriness ?? 0.0, ( v ) => { scene.backgroundBlurriness = v; } );

	debugMenu.addHeader( lightingTab, 'Shadows' );

	debugMenu.addCheckbox( lightingTab, 'Shadows enabled', true, ( v ) => { renderer.shadowMap.enabled = v; dirLight.castShadow = v; } );
	debugMenu.addSlider( lightingTab, 'Shadow bias', - 0.01, 0.01, 0.0001, dirLight.shadow.bias, ( v ) => { dirLight.shadow.bias = v; } );
	debugMenu.addSlider( lightingTab, 'Shadow near', 0, 10, 0.1, dirLight.shadow.camera.near, ( v ) => { dirLight.shadow.camera.near = v; dirLight.shadow.camera.updateProjectionMatrix(); } );
	debugMenu.addSlider( lightingTab, 'Shadow far', 10, 200, 1, dirLight.shadow.camera.far, ( v ) => { dirLight.shadow.camera.far = v; dirLight.shadow.camera.updateProjectionMatrix(); } );
	debugMenu.addSlider( lightingTab, 'Shadow darkness', 0, 1.0, 0.01, dirLight.shadow.intensity ?? 1, ( v ) => { dirLight.shadow.intensity = v; } );

	debugMenu.addHeader( lightingTab, 'Headlights' );

	debugMenu.addSlider( lightingTab, 'HL intensity', 0, 20, 0.5, vehicle.headlights[ 0 ] ? vehicle.headlights[ 0 ].intensity : 8, ( v ) => { for ( const hl of vehicle.headlights ) hl.intensity = v; } );
	debugMenu.addSlider( lightingTab, 'HL distance', 1, 100, 1, vehicle.headlights[ 0 ] ? vehicle.headlights[ 0 ].distance : 54, ( v ) => { for ( const hl of vehicle.headlights ) hl.distance = v; } );
	debugMenu.addSlider( lightingTab, 'HL angle', 0.05, 1.57, 0.01, vehicle.headlights[ 0 ] ? vehicle.headlights[ 0 ].angle : Math.PI / 8, ( v ) => { for ( const hl of vehicle.headlights ) hl.angle = v; } );
	debugMenu.addSlider( lightingTab, 'HL penumbra', 0, 1.0, 0.01, vehicle.headlights[ 0 ] ? vehicle.headlights[ 0 ].penumbra : 0.3, ( v ) => { for ( const hl of vehicle.headlights ) hl.penumbra = v; } );
	debugMenu.addColorPicker( lightingTab, 'HL color', vehicle.headlights[ 0 ] ? vehicle.headlights[ 0 ].color.getHex() : 0xffe0b0, ( v ) => { for ( const hl of vehicle.headlights ) hl.color.setHex( v ); } );

	debugMenu.addHeader( lightingTab, 'Barrier glow' );

	debugMenu.addSlider( lightingTab, 'Barrier intensity', 0, 5.0, 0.05, getBarrierEmissiveIntensity(), ( v ) => { setBarrierEmissive( v, undefined ); } );
	debugMenu.addColorPicker( lightingTab, 'Barrier color', getBarrierEmissiveColor(), ( v ) => { setBarrierEmissive( undefined, v ); } );

	// ── Tab: Character ───────────────────────────────────────────────────────
	const charTab = debugMenu.addTab( 'character', 'Character' );

	debugMenu.addHeader( charTab, 'Position (relative to seat anchor)' );

	// Current vehicle offset label
	const offsetLabel = document.createElement( 'div' );
	offsetLabel.style.cssText = 'font-size:11px;color:#0f08;margin:2px 0 6px';
	charTab.appendChild( offsetLabel );

	const updateOffsetLabel = () => {

		const off = vehicle._characterOffset || { x: 0, y: 0, z: 0 };
		const id = vehicle._vehicleId || '?';
		offsetLabel.textContent = `Vehicle: ${ id } | offset: (${ off.x.toFixed( 2 ) }, ${ off.y.toFixed( 2 ) }, ${ off.z.toFixed( 2 ) })`;

	};

	debugMenu.addSlider( charTab, 'X', - 2.0, 2.0, 0.01, 0, ( v ) => {

		if ( vehicle.characterModel ) vehicle.characterModel.position.x = v;
		if ( vehicle._characterOffset ) vehicle._characterOffset.x = v;
		updateOffsetLabel();

	} );
	debugMenu.addSlider( charTab, 'Y', - 2.0, 2.0, 0.01, - 0.55, ( v ) => {

		if ( vehicle.characterModel ) vehicle.characterModel.position.y = v;
		if ( vehicle._characterOffset ) vehicle._characterOffset.y = v;
		updateOffsetLabel();

	} );
	debugMenu.addSlider( charTab, 'Z', - 2.0, 2.0, 0.01, 0.31, ( v ) => {

		if ( vehicle.characterModel ) vehicle.characterModel.position.z = v;
		if ( vehicle._characterOffset ) vehicle._characterOffset.z = v;
		updateOffsetLabel();

	} );

	// Update label periodically (catches vehicle swaps)
	setInterval( () => { if ( debugMenu.visible ) updateOffsetLabel(); }, 500 );

	debugMenu.addHeader( charTab, 'Scale' );

	debugMenu.addSlider( charTab, 'Scale', 0.1, 3.0, 0.01, 1.0, ( v ) => {

		if ( vehicle.characterModel ) vehicle.characterModel.scale.setScalar( v );

	} );

	debugMenu.addHeader( charTab, 'Rotation (degrees)' );

	debugMenu.addSlider( charTab, 'Rot Y', - 180, 180, 1, 0, ( v ) => {

		if ( vehicle.characterModel ) vehicle.characterModel.rotation.y = v * Math.PI / 180;

	} );

	// ── Animation debug ──────────────────────────────────────────────────────
	debugMenu.addHeader( charTab, 'Animations' );

	// Status display — updated on interval
	const animStatus = document.createElement( 'div' );
	animStatus.style.cssText = 'font-size:11px;line-height:1.5;margin:4px 0 8px;white-space:pre';
	charTab.appendChild( animStatus );

	// Log bone mapping button
	const boneBtn = document.createElement( 'button' );
	boneBtn.textContent = 'Log bone mapping to console';
	boneBtn.style.cssText = 'background:#0f02;color:#0f0;border:1px solid #0f044;padding:4px 10px;cursor:pointer;font:12px monospace;border-radius:3px;margin:4px 0;width:100%';
	boneBtn.addEventListener( 'click', () => {

		if ( vehicle.characterAnimator ) vehicle.characterAnimator.debugLogBoneMapping();

	} );
	charTab.appendChild( boneBtn );

	// Solo play buttons for each animation
	debugMenu.addHeader( charTab, 'Solo play (test each clip)' );

	const animKeys = [ 'driving', 'turnLeft', 'turnRight', 'transLeftIdle', 'transRightIdle', 'impact' ];
	for ( const key of animKeys ) {

		const btn = document.createElement( 'button' );
		btn.textContent = key;
		btn.style.cssText = 'background:#0f02;color:#0f0;border:1px solid #0f044;padding:3px 8px;cursor:pointer;font:11px monospace;border-radius:3px;margin:2px 4px 2px 0;display:inline-block';
		btn.addEventListener( 'click', () => {

			if ( vehicle.characterAnimator ) vehicle.characterAnimator.debugPlaySolo( key );

		} );
		charTab.appendChild( btn );

	}

	// Manual steering test slider
	debugMenu.addHeader( charTab, 'Test steering input' );

	let manualSteerOverride = false;
	debugMenu.addCheckbox( charTab, 'Override steering', false, ( v ) => { manualSteerOverride = v; } );
	debugMenu.addSlider( charTab, 'Steer', - 1.0, 1.0, 0.01, 0, ( v ) => {

		if ( manualSteerOverride && vehicle.characterAnimator ) {

			vehicle.characterAnimator.update( 0.016, v );

		}

	} );

	// Update animation status display
	setInterval( () => {

		if ( ! debugMenu.visible || debugMenu.activeTab !== 'character' ) return;
		const anim = vehicle.characterAnimator;
		if ( ! anim ) { animStatus.textContent = 'No animator'; return; }

		const info = anim.getDebugInfo();
		let text = `STATE: ${ info._state }\n\n`;
		for ( const [ key, data ] of Object.entries( info ) ) {

			if ( key === '_state' ) continue;
			const status = ! data.loaded ? '✗ NOT LOADED'
				: data.playing ? `▶ w=${ data.weight.toFixed( 2 ) }`
				: `■ w=${ data.weight.toFixed( 2 ) }`;
			text += `${ key }: ${ status } (${ data.trackCount } tracks)\n`;

		}

		text += `\ninputX: ${ vehicle.inputX.toFixed( 2 ) }`;
		animStatus.textContent = text;

	}, 200 );

	// Export vehicle + character as GLB
	debugMenu.addHeader( charTab, 'Export' );

	const exportBtn = document.createElement( 'button' );
	exportBtn.textContent = 'Export vehicle + character as GLB';
	exportBtn.style.cssText = 'background:#0f02;color:#0f0;border:1px solid #0f044;padding:6px 10px;cursor:pointer;font:12px monospace;border-radius:3px;margin:4px 0;width:100%';
	exportBtn.addEventListener( 'click', async () => {

		const { GLTFExporter } = await import( 'three/addons/exporters/GLTFExporter.js' );
		const exporter = new GLTFExporter();

		exportBtn.textContent = 'Exporting...';

		// Export the vehicle container directly — avoids breaking SkinnedMesh skeleton bindings
		exporter.parse( vehicle.container, ( glb ) => {

			const blob = new Blob( [ glb ], { type: 'application/octet-stream' } );
			const url = URL.createObjectURL( blob );
			const a = document.createElement( 'a' );
			a.href = url;
			a.download = ( vehicle._vehicleId || 'vehicle' ) + '-with-character.glb';
			a.click();
			URL.revokeObjectURL( url );
			exportBtn.textContent = 'Export vehicle + character as GLB';

		}, ( err ) => {

			console.error( '[Export] Failed:', err );
			exportBtn.textContent = 'Export failed — see console';

		}, { binary: true } );

	} );
	charTab.appendChild( exportBtn );

	// ── Controller tab ───────────────────────────────────────────────────────

	const ctrlTab = debugMenu.addTab( 'controller', 'Controller' );

	// Gamepad selector dropdown
	debugMenu.addHeader( ctrlTab, 'Gamepad' );

	const selectRow = document.createElement( 'div' );
	selectRow.style.cssText = 'margin:4px 0';

	const gpSelect = document.createElement( 'select' );
	gpSelect.style.cssText = [
		'width:100%', 'background:#111', 'color:#0f0',
		'border:1px solid #0f044', 'padding:4px 6px',
		'font:12px monospace', 'border-radius:3px',
	].join( ';' );

	const refreshSelect = () => {

		const prev = gpSelect.value;
		gpSelect.innerHTML = '';

		const none = document.createElement( 'option' );
		none.value = '-1';
		none.textContent = '(auto — first found)';
		gpSelect.appendChild( none );

		const gamepads = navigator.getGamepads();

		for ( let i = 0; i < gamepads.length; i ++ ) {

			const gp = gamepads[ i ];
			if ( ! gp ) continue;

			const opt = document.createElement( 'option' );
			opt.value = String( i );
			opt.textContent = `[${i}] ${gp.id}`;
			gpSelect.appendChild( opt );

		}

		gpSelect.value = prev;
		if ( ! gpSelect.value ) gpSelect.value = '-1';

	};

	gpSelect.addEventListener( 'change', () => {

		controls.gamepadIndex = parseInt( gpSelect.value, 10 );

	} );

	// Refresh on connection changes
	window.addEventListener( 'gamepadconnected', refreshSelect );
	window.addEventListener( 'gamepaddisconnected', refreshSelect );

	selectRow.appendChild( gpSelect );
	ctrlTab.appendChild( selectRow );

	// Event log — shows gamepadconnected/disconnected as they fire
	const eventLog = document.createElement( 'div' );
	eventLog.style.cssText = 'margin:4px 0; padding:4px; background:#0f011; border:1px solid #0f022; border-radius:3px; max-height:80px; overflow-y:auto; font:10px monospace; color:#0f0; white-space:pre-wrap';
	eventLog.textContent = 'Waiting for gamepad events...\n';
	ctrlTab.appendChild( eventLog );

	const logEvent = ( prefix, gp ) => {

		const ts = new Date().toLocaleTimeString();
		const line = `${ts} ${prefix}: [${gp.index}] "${gp.id}" (${gp.buttons.length}btn, ${gp.axes.length}ax, mapping="${gp.mapping}")\n`;
		eventLog.textContent += line;
		eventLog.scrollTop = eventLog.scrollHeight;

	};

	window.addEventListener( 'gamepadconnected', ( e ) => logEvent( 'CONNECTED', e.gamepad ) );
	window.addEventListener( 'gamepaddisconnected', ( e ) => logEvent( 'DISCONNECTED', e.gamepad ) );

	const gpCount = document.createElement( 'div' );
	gpCount.style.cssText = 'margin:2px 0; font:11px monospace; color:#0f0';
	ctrlTab.appendChild( gpCount );

	const gpHint = document.createElement( 'div' );
	gpHint.style.cssText = 'margin:2px 0 4px; color:#0f066; font:10px monospace';
	ctrlTab.appendChild( gpHint );

	const ctrlStatus = document.createElement( 'div' );
	ctrlStatus.style.cssText = 'margin:2px 0 4px; color:#ff0; font:11px monospace; word-break:break-all';
	ctrlStatus.textContent = 'No controller selected';
	ctrlTab.appendChild( ctrlStatus );

	// Xbox standard button labels
	const XBOX_BUTTONS = [
		'A', 'B', 'X', 'Y',
		'LB', 'RB', 'LT', 'RT',
		'Back', 'Start',
		'L-Stick', 'R-Stick',
		'D-Up', 'D-Down', 'D-Left', 'D-Right',
	];

	const XBOX_AXES = [ 'L-Stick X', 'L-Stick Y', 'R-Stick X', 'R-Stick Y' ];

	// Build button rows
	debugMenu.addHeader( ctrlTab, 'Buttons' );
	const buttonRows = [];

	for ( let i = 0; i < XBOX_BUTTONS.length; i ++ ) {

		const row = document.createElement( 'div' );
		row.style.cssText = 'display:flex; justify-content:space-between; margin:1px 0; font:12px monospace';

		const label = document.createElement( 'span' );
		label.textContent = `[${i}] ${XBOX_BUTTONS[ i ]}`;
		label.style.minWidth = '120px';

		const val = document.createElement( 'span' );
		val.style.cssText = 'min-width:60px; text-align:right';
		val.textContent = '—';

		row.appendChild( label );
		row.appendChild( val );
		ctrlTab.appendChild( row );
		buttonRows.push( { row, val } );

	}

	// Build axis rows
	debugMenu.addHeader( ctrlTab, 'Axes' );
	const axisRows = [];

	for ( let i = 0; i < XBOX_AXES.length; i ++ ) {

		const row = document.createElement( 'div' );
		row.style.cssText = 'display:flex; justify-content:space-between; margin:1px 0; font:12px monospace';

		const label = document.createElement( 'span' );
		label.textContent = `[${i}] ${XBOX_AXES[ i ]}`;
		label.style.minWidth = '120px';

		const bar = document.createElement( 'div' );
		bar.style.cssText = 'flex:1; margin:0 8px; position:relative; height:14px; background:#0f011; border:1px solid #0f044; border-radius:2px';

		const fill = document.createElement( 'div' );
		fill.style.cssText = 'position:absolute; top:0; height:100%; background:#0f0; border-radius:1px; transition:left 0.05s, width 0.05s';
		bar.appendChild( fill );

		const val = document.createElement( 'span' );
		val.style.cssText = 'min-width:55px; text-align:right';
		val.textContent = '0.000';

		row.appendChild( label );
		row.appendChild( bar );
		row.appendChild( val );
		ctrlTab.appendChild( row );
		axisRows.push( { val, fill } );

	}

	// Live-update loop
	setInterval( () => {

		if ( debugMenu.activeTab !== 'controller' || ! debugMenu.visible ) return;

		// Refresh dropdown options periodically
		refreshSelect();

		// Show raw gamepad slots
		const allGp = navigator.getGamepads();
		let detected = 0;
		const slotInfo = [];

		for ( let i = 0; i < allGp.length; i ++ ) {

			const g = allGp[ i ];

			if ( g ) {

				detected ++;
				slotInfo.push( `[${i}] "${g.id}" (${g.buttons.length}btn, ${g.axes.length}ax, ${g.mapping || 'no-mapping'}, ${g.connected ? 'connected' : 'disconnected'})` );

			} else {

				slotInfo.push( `[${i}] null` );

			}

		}

		gpCount.textContent = `Slots: ${allGp.length} | Detected: ${detected} | Idx: ${controls.gamepadIndex}`;
		gpHint.textContent = slotInfo.join( '\n' );
		gpHint.style.whiteSpace = 'pre-wrap';
		gpHint.style.color = '#0f066';

		const gp = controls._getGamepad();

		if ( ! gp ) {

			ctrlStatus.textContent = 'No controller selected — pick one from dropdown or press a button';
			ctrlStatus.style.color = '#ff0';
			return;

		}

		ctrlStatus.textContent = gp.id;
		ctrlStatus.style.color = '#0f0';

		// Update buttons
		for ( let i = 0; i < buttonRows.length; i ++ ) {

			const btn = gp.buttons[ i ];

			if ( ! btn ) {

				buttonRows[ i ].val.textContent = '—';
				buttonRows[ i ].val.style.color = '#0f044';
				continue;

			}

			const v = btn.value;
			const pressed = btn.pressed;
			buttonRows[ i ].val.textContent = pressed ? v.toFixed( 2 ) + ' ON' : v.toFixed( 2 );
			buttonRows[ i ].val.style.color = pressed ? '#ff0' : '#0f0';

		}

		// Update axes
		for ( let i = 0; i < axisRows.length; i ++ ) {

			const v = gp.axes[ i ] || 0;
			axisRows[ i ].val.textContent = v.toFixed( 3 );

			// Visual bar: center = 50%, left at -1, right at +1
			const pct = ( v + 1 ) / 2 * 100;
			const center = 50;
			const left = Math.min( pct, center );
			const width = Math.abs( pct - center );
			axisRows[ i ].fill.style.left = left + '%';
			axisRows[ i ].fill.style.width = width + '%';
			axisRows[ i ].fill.style.background = Math.abs( v ) > 0.15 ? '#0f0' : '#0f044';

		}

	}, 50 );

	// ── Tab: Cameras ─────────────────────────────────────────────────────────

	const cameraTab = debugMenu.addTab( 'cameras', 'Cameras' );

	// — Chase camera —
	debugMenu.addHeader( cameraTab, 'Chase Camera' );
	debugMenu.addSlider( cameraTab, 'Chase distance', 1, 20, 0.1, cam.chaseDistance, ( v ) => { cam.chaseDistance = v; cam.baseChaseDistance = v; } );
	debugMenu.addSlider( cameraTab, 'Chase height', 0, 10, 0.1, cam.chaseHeight, ( v ) => { cam.chaseHeight = v; } );
	debugMenu.addSlider( cameraTab, 'Chase look-ahead', 0, 10, 0.1, cam.chaseLookAhead, ( v ) => { cam.chaseLookAhead = v; } );
	debugMenu.addSlider( cameraTab, 'Chase FOV', 20, 120, 1, cam.baseFOV, ( v ) => { cam.baseFOV = v; cam._currentFOV = v; } );
	debugMenu.addSlider( cameraTab, 'Chase near clip', 0, 3, 0.01, cam.chaseNear, ( v ) => { cam.chaseNear = v; } );

	// — Cockpit camera —
	debugMenu.addHeader( cameraTab, 'Cockpit Camera' );
	debugMenu.addSlider( cameraTab, 'Cockpit X', - 2, 2, 0.01, cam.cockpitOffset.x, ( v ) => { cam.cockpitOffset.x = v; } );
	debugMenu.addSlider( cameraTab, 'Cockpit Y', - 2, 3, 0.01, cam.cockpitOffset.y, ( v ) => { cam.cockpitOffset.y = v; } );
	debugMenu.addSlider( cameraTab, 'Cockpit Z', - 2, 2, 0.01, cam.cockpitOffset.z, ( v ) => { cam.cockpitOffset.z = v; } );
	debugMenu.addSlider( cameraTab, 'Cockpit FOV', 30, 120, 1, cam.cockpitFOV, ( v ) => { cam.cockpitFOV = v; } );
	debugMenu.addSlider( cameraTab, 'Cockpit near clip', 0, 1, 0.005, cam.cockpitNear, ( v ) => { cam.cockpitNear = v; } );

	// — Dashboard camera —
	debugMenu.addHeader( cameraTab, 'Dashboard Camera' );
	debugMenu.addSlider( cameraTab, 'Dashboard X', - 2, 2, 0.01, cam.dashboardOffset.x, ( v ) => { cam.dashboardOffset.x = v; } );
	debugMenu.addSlider( cameraTab, 'Dashboard Y', - 2, 3, 0.01, cam.dashboardOffset.y, ( v ) => { cam.dashboardOffset.y = v; } );
	debugMenu.addSlider( cameraTab, 'Dashboard Z', - 2, 2, 0.01, cam.dashboardOffset.z, ( v ) => { cam.dashboardOffset.z = v; } );
	debugMenu.addSlider( cameraTab, 'Dashboard FOV', 30, 120, 1, cam.dashboardFOV, ( v ) => { cam.dashboardFOV = v; } );
	debugMenu.addSlider( cameraTab, 'Dashboard near clip', 0, 1, 0.005, cam.dashboardNear, ( v ) => { cam.dashboardNear = v; } );

	// — G-force effects —
	debugMenu.addHeader( cameraTab, 'G-Force Effects' );
	debugMenu.addSlider( cameraTab, 'Roll intensity', 0, 1.0, 0.01, cam.rollIntensity, ( v ) => { cam.rollIntensity = v; } );
	debugMenu.addSlider( cameraTab, 'FOV narrow max', 0, 16, 0.5, cam.fovNarrowMax, ( v ) => { cam.fovNarrowMax = v; } );
	debugMenu.addSlider( cameraTab, 'Boost punch', 0, 20, 0.5, cam.boostPunchAmount, ( v ) => { cam.boostPunchAmount = v; } );
	debugMenu.addSlider( cameraTab, 'Speed FOV max', 0, 20, 0.5, cam.speedFOVMax, ( v ) => { cam.speedFOVMax = v; } );

	// ── Tab: Body Damage ────────────────────────────────────────────────────

	const damageTab = debugMenu.addTab( 'bodyDamage', 'Body Damage' );

	debugMenu.addHeader( damageTab, 'Morph Target Override' );

	const quadrantLabels = [ 'Front-Left', 'Front-Right', 'Rear-Left', 'Rear-Right' ];

	for ( let i = 0; i < 4; i ++ ) {

		debugMenu.addSlider( damageTab, quadrantLabels[ i ], 0, 1.0, 0.01, 0, ( ( qi ) => ( v ) => {

			vehicle.damageDeform.setDebugOverride( true );
			vehicle.damageDeform.setDebugValue( qi, v );

		} )( i ) );

	}

	debugMenu.addButton( damageTab, 'Reset to Health', () => {

		vehicle.damageDeform.setDebugOverride( false );

	} );

	debugMenu.addHeader( damageTab, 'Damage Tuning' );

	debugMenu.addSlider( damageTab, 'Damage multiplier', 0.1, 20, 0.1, vehicle.health.damageMultiplier, ( v ) => {

		vehicle.health.damageMultiplier = v;

	} );

	// ── M key toggle ─────────────────────────────────────────────────────────
	window.addEventListener( 'keydown', ( e ) => {

		if ( e.key === 'm' || e.key === 'M' ) {

			e.preventDefault();
			debugMenu.toggle();

		}

	} );

	// ── Tab: Aerial/Impact ──────────────────────────────────────────────────
	const aerialTab = debugMenu.addTab( 'aerial', 'Aerial/Impact' );
	const airCfg = vehicle._airborne ? vehicle._airborne.config : {};
	const trickCfg = vehicle._trick ? vehicle._trick.config : {};

	debugMenu.addHeader( aerialTab, 'Gravity Curve' );
	debugMenu.addSlider( aerialTab, 'Apex gravity scale', 0.1, 1.0, 0.05, airCfg.apexGravityScale ?? 0.7, ( v ) => { airCfg.apexGravityScale = v; } );
	debugMenu.addSlider( aerialTab, 'Descent gravity scale', 1.0, 3.0, 0.1, airCfg.descentGravityScale ?? 1.3, ( v ) => { airCfg.descentGravityScale = v; } );
	debugMenu.addSlider( aerialTab, 'Descent auto-level', 0.0, 12.0, 0.5, airCfg.descentAutoLevel ?? 7.0, ( v ) => { airCfg.descentAutoLevel = v; } );

	debugMenu.addHeader( aerialTab, 'Air Control' );
	debugMenu.addSlider( aerialTab, 'Air yaw rate', 0.0, 1.0, 0.05, airCfg.airYawRate ?? 0.3, ( v ) => { airCfg.airYawRate = v; } );
	debugMenu.addSlider( aerialTab, 'Air pitch control', 0.0, 2.0, 0.1, airCfg.airPitchControlRate ?? 0.8, ( v ) => { airCfg.airPitchControlRate = v; } );
	debugMenu.addSlider( aerialTab, 'Air roll control', 0.0, 2.0, 0.1, airCfg.airRollControlRate ?? 0.5, ( v ) => { airCfg.airRollControlRate = v; } );

	debugMenu.addHeader( aerialTab, 'Takeoff' );
	debugMenu.addSlider( aerialTab, 'Launch impulse scale', 0.1, 2.0, 0.05, airCfg.launchImpulseScale ?? 0.85, ( v ) => { airCfg.launchImpulseScale = v; } );
	debugMenu.addSlider( aerialTab, 'Launch cap', 1.0, 12.0, 0.5, airCfg.launchCap ?? 6.0, ( v ) => { airCfg.launchCap = v; } );
	debugMenu.addSlider( aerialTab, 'Ramp launch boost', 0.8, 1.6, 0.05, airCfg.rampLaunchBoost ?? 1.1, ( v ) => { airCfg.rampLaunchBoost = v; } );
	debugMenu.addSlider( aerialTab, 'Jump launch boost', 0.8, 1.8, 0.05, airCfg.jumpLaunchBoost ?? 1.2, ( v ) => { airCfg.jumpLaunchBoost = v; } );
	debugMenu.addSlider( aerialTab, 'Launch commit window', 0.05, 0.5, 0.01, airCfg.launchCommitWindow ?? 0.18, ( v ) => { airCfg.launchCommitWindow = v; } );
	debugMenu.addSlider( aerialTab, 'Jump commit window', 0.05, 0.5, 0.01, airCfg.jumpCommitWindow ?? 0.3, ( v ) => { airCfg.jumpCommitWindow = v; } );
	debugMenu.addSlider( aerialTab, 'Drop commit window', 0.05, 0.35, 0.01, airCfg.dropCommitWindow ?? 0.15, ( v ) => { airCfg.dropCommitWindow = v; } );
	debugMenu.addSlider( aerialTab, 'Impact commit window', 0.05, 0.4, 0.01, airCfg.impactCommitWindow ?? 0.22, ( v ) => { airCfg.impactCommitWindow = v; } );
	debugMenu.addSlider( aerialTab, 'Min airtime latch', 0.0, 0.4, 0.01, airCfg.minAirTime ?? 0.12, ( v ) => { airCfg.minAirTime = v; } );
	debugMenu.addSlider( aerialTab, 'Re-ground distance', 0.1, 1.0, 0.05, airCfg.regroundDistance ?? 0.5, ( v ) => { airCfg.regroundDistance = v; } );

	debugMenu.addHeader( aerialTab, 'Landing' );
	debugMenu.addSlider( aerialTab, 'Clean max impact', 1.0, 8.0, 0.5, airCfg.landingCleanMaxImpact ?? 3.0, ( v ) => { airCfg.landingCleanMaxImpact = v; } );
	debugMenu.addSlider( aerialTab, 'Hard max impact', 3.0, 12.0, 0.5, airCfg.landingHardMaxImpact ?? 6.0, ( v ) => { airCfg.landingHardMaxImpact = v; } );
	debugMenu.addSlider( aerialTab, 'Clean recovery', 0.0, 0.5, 0.02, airCfg.landingCleanRecovery ?? 0.1, ( v ) => { airCfg.landingCleanRecovery = v; } );
	debugMenu.addSlider( aerialTab, 'Hard recovery', 0.0, 1.0, 0.02, airCfg.landingHardRecovery ?? 0.3, ( v ) => { airCfg.landingHardRecovery = v; } );
	debugMenu.addSlider( aerialTab, 'Bad recovery', 0.0, 1.5, 0.05, airCfg.landingBadRecovery ?? 0.5, ( v ) => { airCfg.landingBadRecovery = v; } );
	debugMenu.addSlider( aerialTab, 'Hard speed mult', 0.3, 1.0, 0.05, airCfg.landingHardSpeedMult ?? 0.9, ( v ) => { airCfg.landingHardSpeedMult = v; } );
	debugMenu.addSlider( aerialTab, 'Bad speed mult', 0.1, 1.0, 0.05, airCfg.landingBadSpeedMult ?? 0.7, ( v ) => { airCfg.landingBadSpeedMult = v; } );

	debugMenu.addHeader( aerialTab, 'Suspension Bounce' );
	debugMenu.addSlider( aerialTab, 'Bounce kick', 0.0, 2.0, 0.05, airCfg.landingBounceRestitution ?? 0.5, ( v ) => { airCfg.landingBounceRestitution = v; } );
	debugMenu.addSlider( aerialTab, 'Bounce min impact', 0.0, 3.0, 0.1, airCfg.landingBounceMinImpact ?? 0.5, ( v ) => { airCfg.landingBounceMinImpact = v; } );

	debugMenu.addHeader( aerialTab, 'Tricks' );
	debugMenu.addSlider( aerialTab, 'Trick duration', 0.25, 1.5, 0.05, trickCfg.trickDuration ?? 0.65, ( v ) => { trickCfg.trickDuration = v; } );
	debugMenu.addSlider( aerialTab, 'Trick complete pct', 0.5, 1.0, 0.05, trickCfg.completionWindow ?? 0.85, ( v ) => { trickCfg.completionWindow = v; } );
	debugMenu.addSlider( aerialTab, 'Hint duration', 0.2, 1.5, 0.05, trickCfg.hintDuration ?? 0.85, ( v ) => { trickCfg.hintDuration = v; } );
	debugMenu.addSlider( aerialTab, 'Trick reward duration', 0.3, 2.0, 0.05, trickCfg.rewardBoostDuration ?? 1.1, ( v ) => { trickCfg.rewardBoostDuration = v; } );
	debugMenu.addSlider( aerialTab, 'Trick reward top speed', 200, 420, 5, trickCfg.rewardBoostTopSpeed ?? 320, ( v ) => { trickCfg.rewardBoostTopSpeed = v; } );

	debugMenu.addHeader( aerialTab, 'Impact Launch' );
	debugMenu.addSlider( aerialTab, 'Bump min speed', 0.5, 5.0, 0.5, vehicle.debug.bumpMinSpeed ?? 2.0, ( v ) => { vehicle.debug.bumpMinSpeed = v; } );
	debugMenu.addSlider( aerialTab, 'Impact launch threshold', 0, 20, 1, vehicle.debug.impactLaunchThreshold ?? vehicle.debug.bumpVerticalThreshold ?? 8.0, ( v ) => {

		vehicle.debug.impactLaunchThreshold = v;
		vehicle.debug.bumpVerticalThreshold = v;

	} );
	debugMenu.addSlider( aerialTab, 'Impact launch scale', 0, 1, 0.05, vehicle.debug.impactLaunchScale ?? vehicle.debug.bumpVerticalScale ?? 0.3, ( v ) => {

		vehicle.debug.impactLaunchScale = v;
		vehicle.debug.bumpVerticalScale = v;

	} );
	debugMenu.addSlider( aerialTab, 'Impact launch cap', 0, 6, 0.5, vehicle.debug.impactLaunchCap ?? vehicle.debug.bumpVerticalCap ?? 3.0, ( v ) => {

		vehicle.debug.impactLaunchCap = v;
		vehicle.debug.bumpVerticalCap = v;

	} );
	debugMenu.addHeader( aerialTab, 'Bump Combat' );
	debugMenu.addSlider( aerialTab, 'Bump spin threshold', 0, 20, 1, vehicle.debug.bumpSpinThreshold ?? 10.0, ( v ) => { vehicle.debug.bumpSpinThreshold = v; } );
	debugMenu.addSlider( aerialTab, 'Bump spin rate', 0, 0.5, 0.01, vehicle.debug.bumpSpinRate ?? 0.15, ( v ) => { vehicle.debug.bumpSpinRate = v; } );
	debugMenu.addSlider( aerialTab, 'Bump speed transfer', 0, 0.1, 0.005, vehicle.debug.bumpSpeedTransferRate ?? 0.02, ( v ) => { vehicle.debug.bumpSpeedTransferRate = v; } );
	debugMenu.addSlider( aerialTab, 'Hit-stop threshold', 0, 20, 1, vehicle.debug.bumpHitStopThreshold ?? 12.0, ( v ) => { vehicle.debug.bumpHitStopThreshold = v; } );

	debugMenu.addHeader( aerialTab, 'Acceleration' );
	debugMenu.addSlider( aerialTab, 'Launch accel rate', 0.5, 10, 0.5, vehicle.debug.launchAccelRate ?? 3.0, ( v ) => { vehicle.debug.launchAccelRate = v; } );
	debugMenu.addSlider( aerialTab, 'Mid accel rate', 0.5, 5, 0.5, vehicle.debug.midAccelRate ?? 1.5, ( v ) => { vehicle.debug.midAccelRate = v; } );
	debugMenu.addSlider( aerialTab, 'Top-end accel rate', 0.1, 2, 0.1, vehicle.debug.topEndAccelRate ?? 0.4, ( v ) => { vehicle.debug.topEndAccelRate = v; } );
	debugMenu.addSlider( aerialTab, 'Slope gravity uphill', 0.1, 1.5, 0.1, vehicle.debug.slopeGravityUphill ?? 0.7, ( v ) => { vehicle.debug.slopeGravityUphill = v; } );
	debugMenu.addSlider( aerialTab, 'Slope gravity downhill', 0.1, 1.5, 0.1, vehicle.debug.slopeGravityDownhill ?? 0.5, ( v ) => { vehicle.debug.slopeGravityDownhill = v; } );

	return { debugMenu, debugCollider, wheelDebug };

}

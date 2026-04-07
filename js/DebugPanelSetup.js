import * as THREE from 'three';
import { DebugMenu } from './DebugMenu.js';
import { CELL_RAW, GRID_SCALE, ORIENT_DEG } from './Track.js';


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
		vehicle, cam, aiManager,
		dirLight, dirLightOffset, hemiLight,
		meshDebugGroup, colliderDebugGroup,
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

	// ── M key toggle ─────────────────────────────────────────────────────────
	window.addEventListener( 'keydown', ( e ) => {

		if ( e.key === 'm' || e.key === 'M' ) {

			e.preventDefault();
			debugMenu.toggle();

		}

	} );

	return { debugMenu, debugCollider, wheelDebug };

}

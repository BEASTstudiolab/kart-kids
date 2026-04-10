/**
 * LobbyScene — 3D environment rendered behind all menu tabs.
 *
 * Shares the WebGLRenderer from GameEngine — AppShell calls update(dt) from its
 * coordinator rAF loop; this class does NOT run its own requestAnimationFrame.
 *
 * Public API:
 *   constructor(renderer)       — set up scene, camera, lights
 *   setKart(kartId)             — load kart + character model, place in scene
 *   clearKart()                 — remove kart + character from scene
 *   update(dt)                  — render frame (static camera, no orbit)
 *   dispose()                   — clean up
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { getVehicleById } from '../VehicleRegistry.js';

// Camera parameters — tuned from the lobby debug panel.
const CAM_POS  = new THREE.Vector3( 0.00, 0.80, 7.90 );
const LOOK_AT  = new THREE.Vector3( 0.00, 2.10, -0.30 );
const CAM_FOV  = 65;

// Kart placement
const KART_POS   = new THREE.Vector3( 0.00, 0.40, 1.30 );
const KART_SCALE = 1.15;

// Character model — rest armature has meshes, driving has the seated animation.
const CHARACTER_MESH_PATH = 'characters/Kart_Beast_Rest-Armature.glb';
const CHARACTER_ANIM_PATH = 'characters/Kart_Beast_Driving.glb';

export class LobbyScene {

	/**
	 * @param {THREE.WebGLRenderer} renderer  Shared renderer from GameEngine.
	 */
	constructor( renderer ) {

		/** @type {THREE.WebGLRenderer} */
		this._renderer = renderer;

		/** @type {boolean} */
		this.ready = true;

		// ── Scene ────────────────────────────────────────────────────────
		this._scene = new THREE.Scene();
		this._scene.background = new THREE.Color( 0x1a1a2e );

		// Fog for depth
		this._scene.fog = new THREE.FogExp2( 0x1a1a2e, 0.0 );

		// ── Lights ───────────────────────────────────────────────────────
		const ambient = new THREE.AmbientLight( 0xffffff, 4.3 );
		this._scene.add( ambient );

		const dir = new THREE.DirectionalLight( 0xffffff, 5.6 );
		dir.position.set( 0.1, -2.8, 5.3 );
		this._scene.add( dir );

		const rim = new THREE.DirectionalLight( 0x4488ff, 3.4 );
		rim.position.set( -0.0, 3.5, -0.5 );
		this._scene.add( rim );

		// ── Camera (static — no orbit) ───────────────────────────────────
		this._camera = new THREE.PerspectiveCamera(
			CAM_FOV,
			window.innerWidth / window.innerHeight,
			0.1,
			100
		);
		this._camera.position.copy( CAM_POS );
		this._camera.lookAt( LOOK_AT );

		// ── Bloom post-processing ────────────────────────────────────────
		this._composer = new EffectComposer( renderer );
		this._composer.addPass( new RenderPass( this._scene, this._camera ) );

		this._bloomPass = new UnrealBloomPass(
			new THREE.Vector2( window.innerWidth, window.innerHeight ),
			0.03,  // strength
			0.22,  // radius
			1.04   // threshold
		);
		this._composer.addPass( this._bloomPass );

		// ── Lobby materials (populated on load) ─────────────────────────
		/** @type {THREE.MeshStandardMaterial[]} */
		this._lobbyMaterials = [];

		// ── Lobby environment ────────────────────────────────────────────
		this._loader = new GLTFLoader();
		this._loader.load( 'models/environments/Lobby.gltf', ( gltf ) => {

			const lobbyModel = gltf.scene;

			// Remove placeholder objects (e.g. "Mirror" / Cube.006)
			const toRemove = [];
			lobbyModel.traverse( ( child ) => {

				const name = ( child.name || '' ).toLowerCase();
				if ( name === 'mirror' || name.includes( 'cube' ) || name.includes( 'placeholder' ) ) {

					toRemove.push( child );

				}

				// Capture materials with emissive maps and apply per-material defaults
				if ( child.isMesh && child.material ) {

					const mats = Array.isArray( child.material ) ? child.material : [ child.material ];
					for ( const mat of mats ) {

						if ( mat.emissiveMap && ! this._lobbyMaterials.includes( mat ) ) {

							const idx = this._lobbyMaterials.length;
							this._lobbyMaterials.push( mat );

							if ( idx === 0 ) {

								// Lobby Props (Lobby2)
								mat.emissiveIntensity = 6.1;
								mat.emissive.setRGB( 0.00, 0.14, 1.00 );
								mat.normalScale.set( - 0.45, - 1.85 );
								mat.aoMapIntensity = 0.65;
								mat.roughness = 0.92;
								mat.metalness = 0.94;
								mat.envMapIntensity = 1.80;

							} else if ( idx === 1 ) {

								// LobbyRoom Atlas (Lobby1)
								mat.emissiveIntensity = 4.2;
								mat.emissive.setRGB( 0.00, 0.14, 1.00 );
								mat.normalScale.set( 0.75, - 1.00 );
								mat.aoMapIntensity = 1.45;
								mat.roughness = 0.85;
								mat.metalness = 0.99;
								mat.envMapIntensity = 1.10;

							}

						}

					}

				}

			} );

			for ( const obj of toRemove ) {

				obj.removeFromParent();

			}

			this._scene.add( lobbyModel );

		} );

		// ── Kart + character container ───────────────────────────────────
		this._kartGroup = new THREE.Group();
		this._kartGroup.position.copy( KART_POS );
		this._scene.add( this._kartGroup );

		/** @type {string | null} */
		this._currentKartId = null;

		/** @type {number} generation counter to detect stale async loads */
		this._loadGen = 0;

		/** @type {THREE.AnimationMixer | null} */
		this._mixer = null;

		// Handle resize
		this._onResize = () => {

			this._camera.aspect = window.innerWidth / window.innerHeight;
			this._camera.updateProjectionMatrix();
			this._composer.setSize( window.innerWidth, window.innerHeight );

		};
		window.addEventListener( 'resize', this._onResize );

		// ── Debug helpers (toggled from panel) ───────────────────────────
		this._helpers = [];

		this._camHelper = new THREE.CameraHelper( this._camera );
		this._camHelper.visible = false;
		this._scene.add( this._camHelper );
		this._helpers.push( this._camHelper );

		this._dirHelper = new THREE.DirectionalLightHelper( dir, 1, 0xffff00 );
		this._dirHelper.visible = false;
		this._scene.add( this._dirHelper );
		this._helpers.push( this._dirHelper );

		this._rimHelper = new THREE.DirectionalLightHelper( rim, 1, 0x4488ff );
		this._rimHelper.visible = false;
		this._scene.add( this._rimHelper );
		this._helpers.push( this._rimHelper );

		// Axes helper at world origin
		this._axesHelper = new THREE.AxesHelper( 5 );
		this._axesHelper.visible = false;
		this._scene.add( this._axesHelper );
		this._helpers.push( this._axesHelper );

		// Grid helper on the floor
		this._gridHelper = new THREE.GridHelper( 20, 20, 0x444444, 0x222222 );
		this._gridHelper.visible = false;
		this._scene.add( this._gridHelper );
		this._helpers.push( this._gridHelper );

		// ── Debug panel ─────────────────────────────────────────────────
		this._debugPanel = this._createDebugPanel( ambient, dir, rim );

	}

	/**
	 * Load and display a kart model with the character seated on it.
	 * @param {string} kartId
	 */
	setKart( kartId ) {

		if ( kartId === this._currentKartId ) return;
		this._currentKartId = kartId;
		const gen = ++ this._loadGen;

		// Clear previous kart + character
		while ( this._kartGroup.children.length > 0 ) {

			this._kartGroup.remove( this._kartGroup.children[ 0 ] );

		}

		const entry = getVehicleById( kartId );
		if ( ! entry ) return;

		// Load kart model, then attach character to the seat_anchor node
		// (same approach as Vehicle.js _attachCharacter).
		this._loader.load( `models/${ entry.path }`, ( kartGltf ) => {

			if ( gen !== this._loadGen ) return;

			const kartModel = kartGltf.scene;
			kartModel.scale.setScalar( KART_SCALE );
			this._kartGroup.add( kartModel );

			// Find seat_anchor node inside the kart model
			let seatAnchor = null;
			kartModel.traverse( ( child ) => {

				const name = ( child.name || '' ).toLowerCase();
				if ( name === 'seat_anchor' || name.startsWith( 'seat_anchor.' ) ) {

					seatAnchor = child;

				}

			} );

			// Load character mesh and attach to seat anchor
			this._loader.load( `models/${ CHARACTER_MESH_PATH }`, ( meshGltf ) => {

				if ( gen !== this._loadGen ) return;

				const character = meshGltf.scene;
				character.scale.setScalar( 1.0 );

				// Position: use seat_anchor if found, otherwise use characterOffset
				if ( seatAnchor ) {

					const offset = entry.characterOffset || { x: 0, y: 0, z: 0 };
					character.position.set( offset.x, offset.y, offset.z );
					seatAnchor.add( character );

				} else {

					const offset = entry.characterOffset || { x: 0, y: - 0.5, z: 0.3 };
					character.position.set( offset.x, offset.y, offset.z );
					kartModel.add( character );

				}

				// Apply driving pose animation
				this._loader.load( `models/${ CHARACTER_ANIM_PATH }`, ( animGltf ) => {

					if ( gen !== this._loadGen ) return;

					if ( animGltf.animations && animGltf.animations.length > 0 ) {

						this._mixer = new THREE.AnimationMixer( character );
						const clip = animGltf.animations[ 0 ];
						const action = this._mixer.clipAction( clip );
						action.play();

						// Snap to first frame to hold seated pose
						this._mixer.update( 0 );
						action.paused = true;

					}

				} );

			} );

		} );

	}

	/**
	 * Remove the kart and character from the scene.
	 */
	clearKart() {

		this._currentKartId = null;
		this._mixer = null;

		while ( this._kartGroup.children.length > 0 ) {

			this._kartGroup.remove( this._kartGroup.children[ 0 ] );

		}

	}

	/**
	 * Per-frame update — rotate kart on turntable, render.
	 * @param {number} dt  Delta time in seconds.
	 */
	update( dt ) {

		// Slow turntable rotation on the kart group
		this._kartGroup.rotation.y += 0.15 * dt;

		// Keep debug helpers in sync with slider changes
		if ( this._dirHelper.visible ) this._dirHelper.update();
		if ( this._rimHelper.visible ) this._rimHelper.update();
		if ( this._camHelper.visible ) this._camHelper.update();

		this._composer.render( dt );

	}

	/**
	 * Build a debug slider panel for camera + lighting.
	 */
	_createDebugPanel( ambient, dir, rim ) {

		const panel = document.createElement( 'div' );
		panel.style.cssText = 'position:fixed;top:10px;left:10px;background:rgba(0,0,0,0.85);color:#fff;padding:0;border-radius:8px;font:12px monospace;z-index:99999;max-height:90vh;overflow:hidden;min-width:280px;display:flex;flex-direction:column;';

		const cam = this._camera;
		const self = this;

		// ── Tab bar ──────────────────────────────────────────────────────
		const tabBar = document.createElement( 'div' );
		tabBar.style.cssText = 'display:flex;border-bottom:1px solid #555;flex-shrink:0;';
		panel.appendChild( tabBar );

		const tabContents = [];
		const tabBtns = [];

		const createTab = ( label ) => {

			const btn = document.createElement( 'button' );
			btn.textContent = label;
			btn.style.cssText = 'flex:1;padding:8px 4px;border:none;cursor:pointer;font:12px monospace;font-weight:bold;background:transparent;color:#888;border-bottom:2px solid transparent;';
			tabBar.appendChild( btn );
			tabBtns.push( btn );

			const content = document.createElement( 'div' );
			content.style.cssText = 'display:none;padding:12px;overflow-y:auto;flex:1;';
			panel.appendChild( content );
			tabContents.push( content );

			btn.addEventListener( 'click', () => {

				for ( let i = 0; i < tabBtns.length; i ++ ) {

					tabBtns[ i ].style.color = '#888';
					tabBtns[ i ].style.borderBottomColor = 'transparent';
					tabContents[ i ].style.display = 'none';

				}
				btn.style.color = '#fff';
				btn.style.borderBottomColor = '#4488ff';
				content.style.display = 'block';

			} );

			return content;

		};

		const sceneTab = createTab( 'SCENE' );
		const texturesTab = createTab( 'TEXTURES' );

		// Activate scene tab by default
		tabBtns[ 0 ].style.color = '#fff';
		tabBtns[ 0 ].style.borderBottomColor = '#4488ff';
		sceneTab.style.display = 'block';

		// ── Shared helpers ───────────────────────────────────────────────
		const addSection = ( container, label ) => {

			const s = document.createElement( 'div' );
			s.textContent = label;
			s.style.cssText = 'font-weight:bold;margin-top:10px;margin-bottom:4px;color:#8af;font-size:11px;';
			container.appendChild( s );

		};

		const addSlider = ( container, label, min, max, step, value, onChange ) => {

			const row = document.createElement( 'div' );
			row.style.cssText = 'display:flex;align-items:center;gap:6px;margin:3px 0;';

			const lbl = document.createElement( 'span' );
			lbl.textContent = label;
			lbl.style.cssText = 'width:70px;font-size:11px;';

			const input = document.createElement( 'input' );
			input.type = 'range';
			input.min = min;
			input.max = max;
			input.step = step;
			input.value = value;
			input.style.cssText = 'flex:1;height:14px;';

			const val = document.createElement( 'span' );
			val.textContent = Number( value ).toFixed( 2 );
			val.style.cssText = 'width:45px;text-align:right;font-size:11px;';

			input.addEventListener( 'input', () => {

				const v = parseFloat( input.value );
				val.textContent = v.toFixed( 2 );
				onChange( v );

			} );

			row.appendChild( lbl );
			row.appendChild( input );
			row.appendChild( val );
			container.appendChild( row );

		};

		const addToggle = ( container, label, icon, initiallyOn, onChange ) => {

			const row = document.createElement( 'div' );
			row.style.cssText = 'display:flex;align-items:center;gap:6px;margin:3px 0;';

			const btn = document.createElement( 'button' );
			let on = initiallyOn;
			const update = () => {

				btn.textContent = `${ icon } ${ label }: ${ on ? 'ON' : 'OFF' }`;
				btn.style.cssText = `flex:1;padding:4px 8px;border:1px solid ${ on ? '#4f8' : '#555' };border-radius:4px;cursor:pointer;font:11px monospace;color:${ on ? '#4f8' : '#888' };background:${ on ? 'rgba(68,255,136,0.1)' : 'rgba(0,0,0,0.3)' };text-align:left;`;

			};
			update();

			btn.addEventListener( 'click', () => {

				on = ! on;
				update();
				onChange( on );

			} );

			row.appendChild( btn );
			container.appendChild( row );

		};

		// ══════════════════════════════════════════════════════════════════
		// SCENE TAB
		// ══════════════════════════════════════════════════════════════════

		// ── Gizmo Toggles ──
		addSection( sceneTab, 'HELPERS / GIZMOS' );
		addToggle( sceneTab, 'Camera Helper', '\u{1F3A5}', false, ( on ) => { self._camHelper.visible = on; } );
		addToggle( sceneTab, 'Dir Light Helper', '\u{2600}', false, ( on ) => { self._dirHelper.visible = on; } );
		addToggle( sceneTab, 'Rim Light Helper', '\u{1F535}', false, ( on ) => { self._rimHelper.visible = on; } );
		addToggle( sceneTab, 'World Axes', '\u{1F9ED}', false, ( on ) => { self._axesHelper.visible = on; } );
		addToggle( sceneTab, 'Floor Grid', '\u{1F4D0}', false, ( on ) => { self._gridHelper.visible = on; } );

		// ── Kart Position ──
		addSection( sceneTab, 'KART' );
		const kg = self._kartGroup;
		addSlider( sceneTab, 'Pos X', - 10, 10, 0.1, kg.position.x, ( v ) => { kg.position.x = v; } );
		addSlider( sceneTab, 'Pos Y', - 2, 5, 0.1, kg.position.y, ( v ) => { kg.position.y = v; } );
		addSlider( sceneTab, 'Pos Z', - 10, 10, 0.1, kg.position.z, ( v ) => { kg.position.z = v; } );
		addSlider( sceneTab, 'Scale', 0.1, 3, 0.05, KART_SCALE, ( v ) => {

			kg.children.forEach( ( c ) => c.scale.setScalar( v ) );

		} );
		addSlider( sceneTab, 'Rotate Y', - 180, 180, 1, THREE.MathUtils.radToDeg( kg.rotation.y ), ( v ) => { kg.rotation.y = THREE.MathUtils.degToRad( v ); } );

		// ── Camera Position ──
		addSection( sceneTab, 'CAMERA POSITION' );
		addSlider( sceneTab, 'Pos X', - 20, 20, 0.1, cam.position.x, ( v ) => { cam.position.x = v; } );
		addSlider( sceneTab, 'Pos Y', - 5, 20, 0.1, cam.position.y, ( v ) => { cam.position.y = v; } );
		addSlider( sceneTab, 'Pos Z', - 20, 20, 0.1, cam.position.z, ( v ) => { cam.position.z = v; } );

		// ── Camera LookAt ──
		addSection( sceneTab, 'CAMERA LOOK-AT' );
		const lookAt = LOOK_AT.clone();
		const updateLookAt = () => { cam.lookAt( lookAt ); };
		addSlider( sceneTab, 'Look X', - 20, 20, 0.1, lookAt.x, ( v ) => { lookAt.x = v; updateLookAt(); } );
		addSlider( sceneTab, 'Look Y', - 5, 20, 0.1, lookAt.y, ( v ) => { lookAt.y = v; updateLookAt(); } );
		addSlider( sceneTab, 'Look Z', - 20, 20, 0.1, lookAt.z, ( v ) => { lookAt.z = v; updateLookAt(); } );

		// ── Camera Rotation (direct euler control — overrides lookAt) ──
		addSection( sceneTab, 'CAMERA ROTATION' );
		let rotMode = false;
		addToggle( sceneTab, 'Free Rotate', '\u{1F504}', false, ( on ) => {

			rotMode = on;
			if ( ! on ) { cam.lookAt( lookAt ); }

		} );
		addSlider( sceneTab, 'Pitch (X)', - 180, 180, 1, THREE.MathUtils.radToDeg( cam.rotation.x ), ( v ) => { if ( rotMode ) { cam.rotation.x = THREE.MathUtils.degToRad( v ); } } );
		addSlider( sceneTab, 'Yaw (Y)', - 180, 180, 1, THREE.MathUtils.radToDeg( cam.rotation.y ), ( v ) => { if ( rotMode ) { cam.rotation.y = THREE.MathUtils.degToRad( v ); } } );
		addSlider( sceneTab, 'Roll (Z)', - 180, 180, 1, THREE.MathUtils.radToDeg( cam.rotation.z ), ( v ) => { if ( rotMode ) { cam.rotation.z = THREE.MathUtils.degToRad( v ); } } );

		// ── Camera FOV ──
		addSection( sceneTab, 'CAMERA FOV' );
		addSlider( sceneTab, 'FOV', 10, 120, 1, cam.fov, ( v ) => { cam.fov = v; cam.updateProjectionMatrix(); } );

		// ── Fog ──
		addSection( sceneTab, 'FOG' );
		addSlider( sceneTab, 'Density', 0, 0.2, 0.001, this._scene.fog.density, ( v ) => { self._scene.fog.density = v; } );

		// ── Ambient Light ──
		addSection( sceneTab, 'AMBIENT LIGHT' );
		addSlider( sceneTab, 'Intensity', 0, 5, 0.1, ambient.intensity, ( v ) => { ambient.intensity = v; } );

		// Helper: convert cartesian to spherical (returns { angle, elev, dist } in degrees)
		const toSpherical = ( pos ) => {

			const dist = Math.sqrt( pos.x * pos.x + pos.y * pos.y + pos.z * pos.z );
			const angle = THREE.MathUtils.radToDeg( Math.atan2( pos.x, pos.z ) );
			const elev = THREE.MathUtils.radToDeg( Math.asin( pos.y / ( dist || 1 ) ) );
			return { angle, elev, dist };

		};

		// Helper: apply spherical values to a light position
		const applySpherical = ( light, s ) => {

			const elevRad = THREE.MathUtils.degToRad( s.elev );
			const angleRad = THREE.MathUtils.degToRad( s.angle );
			light.position.set(
				s.dist * Math.cos( elevRad ) * Math.sin( angleRad ),
				s.dist * Math.sin( elevRad ),
				s.dist * Math.cos( elevRad ) * Math.cos( angleRad )
			);

		};

		// ── Directional Light ──
		addSection( sceneTab, 'DIR LIGHT (main)' );
		addSlider( sceneTab, 'Intensity', 0, 10, 0.1, dir.intensity, ( v ) => { dir.intensity = v; } );
		const dirS = toSpherical( dir.position );
		addSlider( sceneTab, 'Orbit', - 180, 180, 1, dirS.angle, ( v ) => { dirS.angle = v; applySpherical( dir, dirS ); } );
		addSlider( sceneTab, 'Elevation', - 90, 90, 1, dirS.elev, ( v ) => { dirS.elev = v; applySpherical( dir, dirS ); } );
		addSlider( sceneTab, 'Distance', 0.5, 30, 0.5, dirS.dist, ( v ) => { dirS.dist = v; applySpherical( dir, dirS ); } );

		// ── Rim Light ──
		addSection( sceneTab, 'RIM LIGHT' );
		addSlider( sceneTab, 'Intensity', 0, 10, 0.1, rim.intensity, ( v ) => { rim.intensity = v; } );
		const rimS = toSpherical( rim.position );
		addSlider( sceneTab, 'Orbit', - 180, 180, 1, rimS.angle, ( v ) => { rimS.angle = v; applySpherical( rim, rimS ); } );
		addSlider( sceneTab, 'Elevation', - 90, 90, 1, rimS.elev, ( v ) => { rimS.elev = v; applySpherical( rim, rimS ); } );
		addSlider( sceneTab, 'Distance', 0.5, 30, 0.5, rimS.dist, ( v ) => { rimS.dist = v; applySpherical( rim, rimS ); } );

		// ── Bloom ──
		addSection( sceneTab, 'BLOOM' );
		addSlider( sceneTab, 'Strength', 0, 3, 0.01, self._bloomPass.strength, ( v ) => { self._bloomPass.strength = v; } );
		addSlider( sceneTab, 'Radius', 0, 2, 0.01, self._bloomPass.radius, ( v ) => { self._bloomPass.radius = v; } );
		addSlider( sceneTab, 'Threshold', 0, 2, 0.01, self._bloomPass.threshold, ( v ) => { self._bloomPass.threshold = v; } );

		// ── Copy button (Scene tab) ──
		const copyBtn = document.createElement( 'button' );
		copyBtn.textContent = 'COPY VALUES';
		copyBtn.style.cssText = 'margin-top:12px;width:100%;padding:6px;background:#4488ff;color:#fff;border:none;border-radius:4px;cursor:pointer;font:12px monospace;';
		copyBtn.addEventListener( 'click', () => {

			const emI = self._lobbyMaterials.length > 0 ? self._lobbyMaterials[ 0 ].emissiveIntensity : 1;
			const emC = self._lobbyMaterials.length > 0 ? self._lobbyMaterials[ 0 ].emissive : { r: 1, g: 1, b: 1 };
			const text = [
				`KART_POS = new THREE.Vector3( ${ kg.position.x.toFixed( 2 ) }, ${ kg.position.y.toFixed( 2 ) }, ${ kg.position.z.toFixed( 2 ) } );`,
				`KART_SCALE = ${ kg.children[ 0 ] ? kg.children[ 0 ].scale.x.toFixed( 2 ) : KART_SCALE };`,
				`Kart rotation Y = ${ THREE.MathUtils.radToDeg( kg.rotation.y ).toFixed( 0 ) }`,
				`CAM_POS  = new THREE.Vector3( ${ cam.position.x.toFixed( 2 ) }, ${ cam.position.y.toFixed( 2 ) }, ${ cam.position.z.toFixed( 2 ) } );`,
				`LOOK_AT  = new THREE.Vector3( ${ lookAt.x.toFixed( 2 ) }, ${ lookAt.y.toFixed( 2 ) }, ${ lookAt.z.toFixed( 2 ) } );`,
				`CAM_FOV  = ${ cam.fov };`,
				`Fog density = ${ self._scene.fog.density.toFixed( 4 ) }`,
				`Ambient intensity = ${ ambient.intensity.toFixed( 2 ) }`,
				`Dir light: intensity=${ dir.intensity.toFixed( 2 ) } orbit=${ dirS.angle.toFixed( 0 ) } elev=${ dirS.elev.toFixed( 0 ) } dist=${ dirS.dist.toFixed( 1 ) } pos=(${ dir.position.x.toFixed( 1 ) }, ${ dir.position.y.toFixed( 1 ) }, ${ dir.position.z.toFixed( 1 ) })`,
				`Rim light: intensity=${ rim.intensity.toFixed( 2 ) } orbit=${ rimS.angle.toFixed( 0 ) } elev=${ rimS.elev.toFixed( 0 ) } dist=${ rimS.dist.toFixed( 1 ) } pos=(${ rim.position.x.toFixed( 1 ) }, ${ rim.position.y.toFixed( 1 ) }, ${ rim.position.z.toFixed( 1 ) })`,
				`Bloom: strength=${ self._bloomPass.strength.toFixed( 2 ) } radius=${ self._bloomPass.radius.toFixed( 2 ) } threshold=${ self._bloomPass.threshold.toFixed( 2 ) }`,
				`Emissive: intensity=${ emI.toFixed( 2 ) } color=(${ emC.r.toFixed( 2 ) }, ${ emC.g.toFixed( 2 ) }, ${ emC.b.toFixed( 2 ) })`,
			].join( '\n' );
			navigator.clipboard.writeText( text );
			copyBtn.textContent = 'COPIED!';
			setTimeout( () => { copyBtn.textContent = 'COPY VALUES'; }, 1500 );

		} );
		sceneTab.appendChild( copyBtn );

		// ══════════════════════════════════════════════════════════════════
		// TEXTURES TAB
		// ══════════════════════════════════════════════════════════════════

		// Material names from the GLTF — maps[0] = "Lobby Props", maps[1] = "LobbyRoom_Atlas"
		const matNames = [ 'Lobby Props (Lobby2)', 'LobbyRoom Atlas (Lobby1)' ];

		// Build per-material texture controls once materials are loaded.
		// We poll briefly since the GLTF loads async.
		const buildTextureControls = () => {

			if ( self._lobbyMaterials.length === 0 ) {

				const waiting = document.createElement( 'div' );
				waiting.textContent = 'Waiting for model to load...';
				waiting.style.cssText = 'color:#888;padding:12px;';
				texturesTab.appendChild( waiting );
				const poll = setInterval( () => {

					if ( self._lobbyMaterials.length > 0 ) {

						clearInterval( poll );
						waiting.remove();
						populateTextureSliders();

					}

				}, 200 );
				return;

			}
			populateTextureSliders();

		};

		const populateTextureSliders = () => {

			for ( let i = 0; i < self._lobbyMaterials.length; i ++ ) {

				const mat = self._lobbyMaterials[ i ];
				const name = matNames[ i ] || `Material ${ i }`;

				// ── Material header ──
				const header = document.createElement( 'div' );
				header.textContent = name;
				header.style.cssText = 'font-weight:bold;margin-top:12px;margin-bottom:6px;color:#ff8;font-size:12px;border-bottom:1px solid #444;padding-bottom:4px;';
				texturesTab.appendChild( header );

				// ── Emissive ──
				addSection( texturesTab, 'EMISSIVE' );
				addSlider( texturesTab, 'Intensity', 0, 10, 0.1, mat.emissiveIntensity, ( v ) => { mat.emissiveIntensity = v; } );
				addSlider( texturesTab, 'Color R', 0, 1, 0.01, mat.emissive.r, ( v ) => { mat.emissive.r = v; } );
				addSlider( texturesTab, 'Color G', 0, 1, 0.01, mat.emissive.g, ( v ) => { mat.emissive.g = v; } );
				addSlider( texturesTab, 'Color B', 0, 1, 0.01, mat.emissive.b, ( v ) => { mat.emissive.b = v; } );
				addToggle( texturesTab, 'Emissive Map', '\u{1F4A1}', !! mat.emissiveMap, ( on ) => {

					if ( on && mat.userData._emissiveMap ) { mat.emissiveMap = mat.userData._emissiveMap; }
					else { mat.userData._emissiveMap = mat.emissiveMap; mat.emissiveMap = null; }
					mat.needsUpdate = true;

				} );

				// ── Normal ──
				addSection( texturesTab, 'NORMAL MAP' );
				const nScale = mat.normalScale ? mat.normalScale.x : 1;
				addSlider( texturesTab, 'Scale X', - 3, 3, 0.05, nScale, ( v ) => { if ( mat.normalScale ) mat.normalScale.x = v; } );
				addSlider( texturesTab, 'Scale Y', - 3, 3, 0.05, mat.normalScale ? mat.normalScale.y : 1, ( v ) => { if ( mat.normalScale ) mat.normalScale.y = v; } );
				addToggle( texturesTab, 'Normal Map', '\u{1F5FA}', !! mat.normalMap, ( on ) => {

					if ( on && mat.userData._normalMap ) { mat.normalMap = mat.userData._normalMap; }
					else { mat.userData._normalMap = mat.normalMap; mat.normalMap = null; }
					mat.needsUpdate = true;

				} );

				// ── Ambient Occlusion ──
				addSection( texturesTab, 'AMBIENT OCCLUSION' );
				addSlider( texturesTab, 'AO Intensity', 0, 3, 0.05, mat.aoMapIntensity !== undefined ? mat.aoMapIntensity : 1, ( v ) => { mat.aoMapIntensity = v; } );
				addToggle( texturesTab, 'AO Map', '\u{1F311}', !! mat.aoMap, ( on ) => {

					if ( on && mat.userData._aoMap ) { mat.aoMap = mat.userData._aoMap; }
					else { mat.userData._aoMap = mat.aoMap; mat.aoMap = null; }
					mat.needsUpdate = true;

				} );

				// ── Roughness ──
				addSection( texturesTab, 'ROUGHNESS' );
				addSlider( texturesTab, 'Factor', 0, 1, 0.01, mat.roughness !== undefined ? mat.roughness : 1, ( v ) => { mat.roughness = v; } );
				addToggle( texturesTab, 'Rough Map', '\u{1F4CE}', !! mat.roughnessMap, ( on ) => {

					if ( on && mat.userData._roughnessMap ) { mat.roughnessMap = mat.userData._roughnessMap; }
					else { mat.userData._roughnessMap = mat.roughnessMap; mat.roughnessMap = null; }
					mat.needsUpdate = true;

				} );

				// ── Metalness ──
				addSection( texturesTab, 'METALNESS' );
				addSlider( texturesTab, 'Factor', 0, 1, 0.01, mat.metalness !== undefined ? mat.metalness : 1, ( v ) => { mat.metalness = v; } );
				addToggle( texturesTab, 'Metal Map', '\u{1F529}', !! mat.metalnessMap, ( on ) => {

					if ( on && mat.userData._metalnessMap ) { mat.metalnessMap = mat.userData._metalnessMap; }
					else { mat.userData._metalnessMap = mat.metalnessMap; mat.metalnessMap = null; }
					mat.needsUpdate = true;

				} );

				// ── Base Color ──
				addSection( texturesTab, 'BASE COLOR / ALBEDO' );
				addSlider( texturesTab, 'Color R', 0, 1, 0.01, mat.color.r, ( v ) => { mat.color.r = v; } );
				addSlider( texturesTab, 'Color G', 0, 1, 0.01, mat.color.g, ( v ) => { mat.color.g = v; } );
				addSlider( texturesTab, 'Color B', 0, 1, 0.01, mat.color.b, ( v ) => { mat.color.b = v; } );
				addToggle( texturesTab, 'Base Map', '\u{1F3A8}', !! mat.map, ( on ) => {

					if ( on && mat.userData._map ) { mat.map = mat.userData._map; }
					else { mat.userData._map = mat.map; mat.map = null; }
					mat.needsUpdate = true;

				} );

				// ── General material ──
				addSection( texturesTab, 'MATERIAL' );
				addToggle( texturesTab, 'Double Sided', '\u{1F500}', mat.side === THREE.DoubleSide, ( on ) => {

					mat.side = on ? THREE.DoubleSide : THREE.FrontSide;
					mat.needsUpdate = true;

				} );
				addToggle( texturesTab, 'Wireframe', '\u{1F4D0}', mat.wireframe, ( on ) => {

					mat.wireframe = on;

				} );
				addSlider( texturesTab, 'Opacity', 0, 1, 0.01, mat.opacity, ( v ) => {

					mat.opacity = v;
					mat.transparent = v < 1;

				} );
				addSlider( texturesTab, 'Env Intens.', 0, 5, 0.1, mat.envMapIntensity !== undefined ? mat.envMapIntensity : 1, ( v ) => { mat.envMapIntensity = v; } );

			}

			// ── Copy button (Textures tab) ──
			const copyBtn2 = document.createElement( 'button' );
			copyBtn2.textContent = 'COPY TEXTURE VALUES';
			copyBtn2.style.cssText = 'margin-top:12px;width:100%;padding:6px;background:#4488ff;color:#fff;border:none;border-radius:4px;cursor:pointer;font:12px monospace;';
			copyBtn2.addEventListener( 'click', () => {

				const lines = [];
				for ( let i = 0; i < self._lobbyMaterials.length; i ++ ) {

					const mat = self._lobbyMaterials[ i ];
					const name = matNames[ i ] || `Material ${ i }`;
					lines.push( `--- ${ name } ---` );
					lines.push( `Emissive: intensity=${ mat.emissiveIntensity.toFixed( 2 ) } color=(${ mat.emissive.r.toFixed( 2 ) }, ${ mat.emissive.g.toFixed( 2 ) }, ${ mat.emissive.b.toFixed( 2 ) })` );
					lines.push( `Normal: scale=(${ mat.normalScale ? mat.normalScale.x.toFixed( 2 ) : 'n/a' }, ${ mat.normalScale ? mat.normalScale.y.toFixed( 2 ) : 'n/a' })` );
					lines.push( `AO: intensity=${ mat.aoMapIntensity !== undefined ? mat.aoMapIntensity.toFixed( 2 ) : 'n/a' }` );
					lines.push( `Roughness: factor=${ mat.roughness !== undefined ? mat.roughness.toFixed( 2 ) : 'n/a' }` );
					lines.push( `Metalness: factor=${ mat.metalness !== undefined ? mat.metalness.toFixed( 2 ) : 'n/a' }` );
					lines.push( `Base color: (${ mat.color.r.toFixed( 2 ) }, ${ mat.color.g.toFixed( 2 ) }, ${ mat.color.b.toFixed( 2 ) })` );
					lines.push( `Opacity: ${ mat.opacity.toFixed( 2 ) }` );
					lines.push( `Env map intensity: ${ mat.envMapIntensity !== undefined ? mat.envMapIntensity.toFixed( 2 ) : 'n/a' }` );
					lines.push( '' );

				}
				navigator.clipboard.writeText( lines.join( '\n' ) );
				copyBtn2.textContent = 'COPIED!';
				setTimeout( () => { copyBtn2.textContent = 'COPY TEXTURE VALUES'; }, 1500 );

			} );
			texturesTab.appendChild( copyBtn2 );

		};

		buildTextureControls();

		document.body.appendChild( panel );
		return panel;

	}

	/**
	 * Clean up.
	 */
	dispose() {

		window.removeEventListener( 'resize', this._onResize );
		for ( const h of this._helpers ) {

			h.removeFromParent();
			if ( h.dispose ) h.dispose();

		}
		this._helpers.length = 0;
		if ( this._composer ) {

			this._composer.dispose();
			this._composer = null;

		}
		if ( this._debugPanel ) {

			this._debugPanel.remove();
			this._debugPanel = null;

		}

	}

}

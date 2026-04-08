// ─── LightingService ─────────────────────────────────────────────────────────
// Day / Night / Sunset / Dawn lighting presets for the track editor.
// Applies hemisphere light, directional light, background color, and
// material adjustments to match the game's Lighting.js presets.

import * as THREE from 'three';

const PRESETS = {

	night: {
		name: 'Night',
		background: 0x0a0a14,
		ambient: { color: 0x404060, intensity: 0.4 },
		dir: { color: 0xe8d0f8, intensity: 2.0, pos: [ 50, 80, 30 ] },
		materialTweak: { metalness: 0.3, roughness: 0.4 },
		gridColor: 0x1a1a2a,
		gridCenterColor: 0x222233,
	},

	day: {
		name: 'Day',
		background: 0x87CEEB,
		ambient: { color: 0x8899aa, intensity: 1.2 },
		dir: { color: 0xffffff, intensity: 4.0, pos: [ 60, 100, 40 ] },
		materialTweak: null,
		gridColor: 0x445566,
		gridCenterColor: 0x556677,
	},

	sunset: {
		name: 'Sunset',
		background: 0x2a1520,
		ambient: { color: 0x806040, intensity: 0.7 },
		dir: { color: 0xff9944, intensity: 3.0, pos: [ - 40, 30, 60 ] },
		materialTweak: { metalness: 0.25, roughness: 0.45 },
		gridColor: 0x2a1a1a,
		gridCenterColor: 0x3a2222,
	},

	dawn: {
		name: 'Dawn',
		background: 0x1a2035,
		ambient: { color: 0x506080, intensity: 0.8 },
		dir: { color: 0xffd4a0, intensity: 2.5, pos: [ 40, 40, - 50 ] },
		materialTweak: { metalness: 0.2, roughness: 0.5 },
		gridColor: 0x1a1a2a,
		gridCenterColor: 0x222244,
	},

	overcast: {
		name: 'Overcast',
		background: 0x3a3a44,
		ambient: { color: 0x888899, intensity: 1.0 },
		dir: { color: 0xccccdd, intensity: 1.5, pos: [ 30, 90, 20 ] },
		materialTweak: null,
		gridColor: 0x333340,
		gridCenterColor: 0x444455,
	},

};

export class LightingService {

	/**
	 * @param {THREE.Scene} scene
	 * @param {THREE.AmbientLight} ambientLight
	 * @param {THREE.DirectionalLight} dirLight
	 * @param {THREE.GridHelper} gridHelper
	 * @param {import('../core/EventBus.js').EventBus} eventBus
	 */
	constructor( scene, ambientLight, dirLight, gridHelper, eventBus ) {

		this._scene = scene;
		this._ambient = ambientLight;
		this._dir = dirLight;
		this._grid = gridHelper;
		this._eventBus = eventBus;

		this._currentPreset = 'night';
		this._originalMaterials = new WeakMap();

	}

	/** @returns {Array<{ id: string, name: string }>} */
	getPresets() {

		return Object.entries( PRESETS ).map( ( [ id, p ] ) => ( { id, name: p.name } ) );

	}

	/** @returns {string} Current preset ID. */
	get current() { return this._currentPreset; }

	/**
	 * Apply a lighting preset.
	 * @param {string} presetId
	 */
	apply( presetId ) {

		const preset = PRESETS[ presetId ];
		if ( ! preset ) return;

		this._currentPreset = presetId;

		// Background
		this._scene.background = new THREE.Color( preset.background );

		// Ambient light
		this._ambient.color.setHex( preset.ambient.color );
		this._ambient.intensity = preset.ambient.intensity;

		// Directional light
		this._dir.color.setHex( preset.dir.color );
		this._dir.intensity = preset.dir.intensity;
		this._dir.position.set( ...preset.dir.pos );

		// Grid colors
		if ( this._grid ) {

			this._grid.material.color.setHex( preset.gridCenterColor );
			if ( this._grid.material.length > 1 ) {

				this._grid.material[ 0 ].color.setHex( preset.gridCenterColor );
				this._grid.material[ 1 ].color.setHex( preset.gridColor );

			}

		}

		// Material tweaks
		this._scene.traverse( ( child ) => {

			if ( child.isMesh && child.material && child.material.isMeshStandardMaterial ) {

				if ( ! this._originalMaterials.has( child.material ) ) {

					this._originalMaterials.set( child.material, {
						metalness: child.material.metalness,
						roughness: child.material.roughness,
					} );

				}

				if ( preset.materialTweak ) {

					child.material.metalness = preset.materialTweak.metalness;
					child.material.roughness = preset.materialTweak.roughness;

				} else {

					const orig = this._originalMaterials.get( child.material );
					if ( orig ) {

						child.material.metalness = orig.metalness;
						child.material.roughness = orig.roughness;

					}

				}

			}

		} );

		this._eventBus.emit( 'lighting:changed', { preset: presetId, name: preset.name } );

	}

}

export { PRESETS as LIGHTING_PRESETS };

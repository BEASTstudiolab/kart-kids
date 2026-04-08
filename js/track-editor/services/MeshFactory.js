// ─── MeshFactory ─────────────────────────────────────────────────────────────
// Creates, positions, and rotates Three.js meshes for placed tiles.
// Centralizes the grid→world coordinate conversion and orientation logic.

import * as THREE from 'three';
import { CELL_RAW, ORIENT_DEG } from '../../TrackConstants.js';
import { ELEV_GROUND } from '../models/TrackProject.js';

// World Y per elevation step (from existing code: 2.416 per 2.5m)
const Y_PER_STEP = 2.416;

export class MeshFactory {

	/**
	 * @param {import('./TileLibrary.js').TileLibrary} tileLibrary
	 * @param {import('../models/TrackProject.js').TrackProject} project
	 */
	constructor( tileLibrary, project ) {

		this._lib = tileLibrary;
		this._project = project;

	}

	/**
	 * Create a tile mesh and add it to the project's trackGroup.
	 * Sets position, rotation, and shadow properties.
	 * @param {number} gx
	 * @param {number} gz
	 * @param {import('../models/TrackTile.js').TrackTile} tile
	 * @returns {import('three').Object3D|null}
	 */
	createTileMesh( gx, gz, tile ) {

		// Remove existing mesh if present
		if ( tile.mesh ) {

			this._project.trackGroup.remove( tile.mesh );
			tile.mesh = null;

		}

		const modelName = tile.type;
		const clone = this._lib.cloneModel( modelName );
		if ( ! clone ) return null;

		// Position: center of cell
		const worldX = ( gx + 0.5 ) * CELL_RAW;
		const worldZ = ( gz + 0.5 ) * CELL_RAW;
		const worldY = this.getElevationY( tile );

		clone.position.set( worldX, worldY, worldZ );

		// Rotation: orient code + model base rotation
		const orientDeg = ORIENT_DEG[ tile.orient ] ?? 0;
		const baseRotY = clone.userData.rotationY ?? 0;
		clone.rotation.y = THREE.MathUtils.degToRad( orientDeg ) + baseRotY;

		// Shadows
		clone.traverse( child => {

			if ( child.isMesh ) {

				child.castShadow = true;
				child.receiveShadow = true;

			}

		} );

		// Attach
		tile.mesh = clone;
		this._project.trackGroup.add( clone );

		return clone;

	}

	/**
	 * Create a transparent ghost preview mesh (not added to project).
	 * @param {string} modelName
	 * @param {number} orient
	 * @param {number} gx
	 * @param {number} gz
	 * @param {number} [elevationStep=12]
	 * @param {number} [opacity=0.4]
	 * @returns {import('three').Object3D|null}
	 */
	createGhostMesh( modelName, orient, gx, gz, elevationStep = 12, opacity = 0.4 ) {

		const clone = this._lib.cloneModel( modelName );
		if ( ! clone ) return null;

		const worldX = ( gx + 0.5 ) * CELL_RAW;
		const worldZ = ( gz + 0.5 ) * CELL_RAW;
		const worldY = ( elevationStep - ELEV_GROUND ) * Y_PER_STEP;

		clone.position.set( worldX, worldY, worldZ );

		const orientDeg = ORIENT_DEG[ orient ] ?? 0;
		const baseRotY = clone.userData.rotationY ?? 0;
		clone.rotation.y = THREE.MathUtils.degToRad( orientDeg ) + baseRotY;

		// Make transparent
		clone.traverse( child => {

			if ( child.isMesh ) {

				child.material = child.material.clone();
				child.material.transparent = true;
				child.material.opacity = opacity;
				child.material.depthWrite = false;

			}

		} );

		return clone;

	}

	/**
	 * Update mesh position/rotation for an existing tile (after transform).
	 * @param {number} gx
	 * @param {number} gz
	 * @param {import('../models/TrackTile.js').TrackTile} tile
	 */
	updateTileMesh( gx, gz, tile ) {

		if ( ! tile.mesh ) return;

		const worldX = ( gx + 0.5 ) * CELL_RAW;
		const worldZ = ( gz + 0.5 ) * CELL_RAW;
		const worldY = this.getElevationY( tile );

		tile.mesh.position.set( worldX, worldY, worldZ );

		const orientDeg = ORIENT_DEG[ tile.orient ] ?? 0;
		const baseRotY = tile.mesh.userData.rotationY ?? 0;
		tile.mesh.rotation.y = THREE.MathUtils.degToRad( orientDeg ) + baseRotY;

	}

	/**
	 * Calculate world Y for a tile based on its elevation step.
	 * @param {import('../models/TrackTile.js').TrackTile} tile
	 * @returns {number}
	 */
	getElevationY( tile ) {

		const step = tile._derivedElevation || tile.elevation;
		return ( step - ELEV_GROUND ) * Y_PER_STEP;

	}

	/**
	 * Grid cell coordinates to world position (center of cell, ground level).
	 * @param {number} gx
	 * @param {number} gz
	 * @returns {{ x: number, y: number, z: number }}
	 */
	gridToWorld( gx, gz ) {

		return {
			x: ( gx + 0.5 ) * CELL_RAW,
			y: 0,
			z: ( gz + 0.5 ) * CELL_RAW,
		};

	}

}

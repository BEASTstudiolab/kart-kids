// ─── PlaceFinishCommand ──────────────────────────────────────────────────────
// Places or moves the start/finish line (3x1 tile).
// The finish model is a single 3x1 mesh. Flanking cells are invisible grid
// reservations that block other tiles from being placed there.

import * as THREE from 'three';
import { Command } from '../core/Command.js';
import { TrackTile } from '../models/TrackTile.js';
import { CELL_RAW, ORIENT_DEG } from '../../TrackConstants.js';

export class PlaceFinishCommand {

	constructor( project, gx, gz, orient, meshFactory, autoTile, eventBus ) {

		this._project = project;
		this._gx = gx;
		this._gz = gz;
		this._orient = orient;
		this._meshFactory = meshFactory;
		this._autoTile = autoTile;
		this._eventBus = eventBus;

		/** @type {Map<string, import('../models/TrackTile.js').TrackTile|null>} */
		this._beforeSnapshot = new Map();

	}

	execute() {

		const { _project: project, _gx: gx, _gz: gz, _orient: orient } = this;

		// Snapshot old finish + new finish area
		this._snapshotOldFinish();
		this._snapshotArea( gx, gz );

		// Remove existing finish (if any)
		this._removeOldFinish();

		// Place the finish tile (single 3x1 mesh)
		const finishTile = new TrackTile( 'trk-finish', orient );
		finishTile.isFinish = true;
		project.setTile( gx, gz, finishTile );
		this._meshFactory.createTileMesh( gx, gz, finishTile );

		// Place invisible flanking cells (grid reservations, NO mesh)
		const isNS = orient === 0 || orient === 10;
		const flanks = isNS
			? [ { gx: gx - 1, gz }, { gx: gx + 1, gz } ]
			: [ { gx, gz: gz - 1 }, { gx, gz: gz + 1 } ];

		for ( const f of flanks ) {

			// Remove any existing tile at the flank position
			const existing = project.getTile( f.gx, f.gz );
			if ( existing && existing.mesh ) {

				project.trackGroup.remove( existing.mesh );

			}

			// Create invisible reservation tile
			const flank = new TrackTile( 'trk-straight', orient );
			flank.finishFlank = true;
			flank.mesh = null; // No mesh — the finish model covers this area
			project.setTile( f.gx, f.gz, flank );

		}

		// Add direction arrow indicator
		this._addDirectionArrow( gx, gz, orient );

		this._eventBus.emit( 'finish:placed', { gx, gz, orient } );

	}

	undo() {

		const trackGroup = this._project.trackGroup;

		// First: remove all meshes for affected cells
		for ( const [ key ] of this._beforeSnapshot ) {

			const [ gx, gz ] = key.split( ',' ).map( Number );
			const current = this._project.getTile( gx, gz );
			if ( ! current ) continue;

			if ( current.mesh ) {

				trackGroup.remove( current.mesh );
				current.mesh = null;

			}

			if ( current.curveMesh ) {

				trackGroup.remove( current.curveMesh );
				current.curveMesh = null;

			}

		}

		// Second: restore from snapshot
		for ( const [ key, snapshot ] of this._beforeSnapshot ) {

			const [ gx, gz ] = key.split( ',' ).map( Number );
			this._project.getGrid().delete( key );

			if ( snapshot ) {

				this._project.setTile( gx, gz, snapshot );
				this._meshFactory.createTileMesh( gx, gz, snapshot );

			}

		}

		this._eventBus.emit( 'finish:placed', { gx: this._gx, gz: this._gz } );

	}

	get description() { return `Place finish at ${ this._gx },${ this._gz }`; }

	/** @private Snapshot any existing finish + its flanks. */
	_snapshotOldFinish() {

		for ( const [ key, tile ] of this._project.getGrid() ) {

			if ( tile.isFinish || tile.finishFlank ) {

				const [ gx, gz ] = key.split( ',' ).map( Number );
				this._beforeSnapshot.set( key, tile.clone() );

				const deltas = [ [ 0, - 1 ], [ 0, 1 ], [ 1, 0 ], [ - 1, 0 ] ];
				for ( const [ dx, dz ] of deltas ) {

					const nk = this._project.cellKey( gx + dx, gz + dz );
					if ( ! this._beforeSnapshot.has( nk ) ) {

						const nt = this._project.getTile( gx + dx, gz + dz );
						this._beforeSnapshot.set( nk, nt ? nt.clone() : null );

					}

				}

			}

		}

	}

	/** @private Snapshot the new finish area. */
	_snapshotArea( gx, gz ) {

		for ( let dx = - 2; dx <= 2; dx ++ ) {

			for ( let dz = - 2; dz <= 2; dz ++ ) {

				const key = this._project.cellKey( gx + dx, gz + dz );
				if ( ! this._beforeSnapshot.has( key ) ) {

					const tile = this._project.getTile( gx + dx, gz + dz );
					this._beforeSnapshot.set( key, tile ? tile.clone() : null );

				}

			}

		}

	}

	/**
	 * Add a 3D direction arrow in front of the finish tile showing race direction.
	 * @private
	 */
	_addDirectionArrow( gx, gz, orient ) {

		const worldX = ( gx + 0.5 ) * CELL_RAW;
		const worldZ = ( gz + 0.5 ) * CELL_RAW;

		const shape = new THREE.Shape();
		shape.moveTo( 0, 1.5 );
		shape.lineTo( - 0.8, - 0.5 );
		shape.lineTo( 0, 0.1 );
		shape.lineTo( 0.8, - 0.5 );
		shape.closePath();

		const geo = new THREE.ShapeGeometry( shape );
		const mat = new THREE.MeshBasicMaterial( {
			color: 0x22c55e,
			transparent: true,
			opacity: 0.85,
			side: THREE.DoubleSide,
			depthWrite: false,
		} );

		const orientDeg = ORIENT_DEG[ orient ] ?? 0;
		const orientRad = THREE.MathUtils.degToRad( orientDeg );

		// Place arrows on BOTH ends pointing in the race direction
		const distances = [ CELL_RAW * 1.2, - CELL_RAW * 1.2 ];

		for ( const dist of distances ) {

			const arrow = new THREE.Mesh( geo, mat );
			arrow.rotation.x = - Math.PI / 2;
			arrow.rotation.z = - orientRad;
			arrow.position.set(
				worldX + Math.sin( orientRad ) * dist,
				0.12,
				worldZ - Math.cos( orientRad ) * dist
			);
			arrow.userData._isFinishArrow = true;
			this._project.trackGroup.add( arrow );

		}

	}

	/** @private Remove existing finish tile + flanks from the grid. */
	_removeOldFinish() {

		// Also remove any existing direction arrows
		const arrowsToRemove = [];
		this._project.trackGroup.traverse( child => {

			if ( child.userData._isFinishArrow ) arrowsToRemove.push( child );

		} );

		for ( const arrow of arrowsToRemove ) this._project.trackGroup.remove( arrow );

		const toRemove = [];

		for ( const [ key, tile ] of this._project.getGrid() ) {

			if ( tile.isFinish || tile.finishFlank ) {

				toRemove.push( key );

			}

		}

		for ( const key of toRemove ) {

			const [ gx, gz ] = key.split( ',' ).map( Number );
			this._project.deleteTile( gx, gz );

		}

	}

}

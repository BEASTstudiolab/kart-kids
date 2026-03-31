import * as THREE from 'three';
import { Vehicle } from './Vehicle.js';
import { createVehicleBody, removeVehicleBody } from './Physics.js';
import { SmokeTrails } from './Particles.js';

const VEHICLE_MODEL_NAMES = [
	'vehicle-truck-yellow',
	'vehicle-truck-green',
	'vehicle-truck-purple',
	'vehicle-truck-red',
];

export class PlayerManager {

	constructor( scene, world, models, spawnPosition, spawnAngle ) {

		this.scene = scene;
		this.world = world;
		this.models = models;
		this.spawnPosition = spawnPosition || [ 3.5, 0.5, 5 ];
		this.spawnAngle = spawnAngle || 0;

		this.localId = null;
		this.localVehicle = null;
		this.players = new Map(); // id → { vehicle, smokeTrails, spectating }

	}

	// ── Single-player fallback ───────────────────────────────────────────────

	initSinglePlayer() {

		const vehicle = this._createVehicle( 0, null, this.spawnPosition, this.spawnAngle );
		this.localVehicle = vehicle;
		this.localId = '_local';
		this.players.set( this.localId, { vehicle, smokeTrails: new SmokeTrails( this.scene ), spectating: false } );

	}

	// ── Multiplayer: local player ────────────────────────────────────────────

	initLocalPlayer( welcomeData ) {

		this.localId = welcomeData.id;
		const vehicle = this._createVehicle( welcomeData.vehicleIndex, welcomeData.tint, this.spawnPosition, this.spawnAngle );
		this.localVehicle = vehicle;
		this.players.set( this.localId, { vehicle, smokeTrails: new SmokeTrails( this.scene ), spectating: false } );

		// Add existing players
		if ( welcomeData.existingPlayers ) {

			for ( const p of welcomeData.existingPlayers ) {

				this.addRemotePlayer( p );

			}

		}

	}

	// ── Remote players ───────────────────────────────────────────────────────

	addRemotePlayer( joinData ) {

		if ( this.players.has( joinData.id ) ) return;

		const offset = this._computeSpawnOffset( this.players.size );
		const spawnPos = [
			this.spawnPosition[ 0 ] + offset[ 0 ],
			this.spawnPosition[ 1 ],
			this.spawnPosition[ 2 ] + offset[ 1 ],
		];

		const vehicle = this._createVehicle( joinData.vehicleIndex, joinData.tint, spawnPos, this.spawnAngle );
		vehicle.remote = true;

		if ( joinData.spectating ) {

			vehicle.container.visible = false;

		}

		this.players.set( joinData.id, {
			vehicle,
			smokeTrails: new SmokeTrails( this.scene ),
			spectating: joinData.spectating || false,
		} );

	}

	removeRemotePlayer( id ) {

		const entry = this.players.get( id );
		if ( ! entry ) return;

		this.scene.remove( entry.vehicle.container );

		if ( entry.vehicle.rigidBody ) {

			removeVehicleBody( this.world, entry.vehicle.rigidBody );

		}

		this.players.delete( id );

	}

	// ── World update from server ─────────────────────────────────────────────

	applyWorldUpdate( worldData ) {

		for ( const pState of worldData.players ) {

			const entry = this.players.get( pState.id );
			if ( ! entry ) continue;

			if ( pState.spectating && ! entry.spectating ) {

				this.setSpectating( pState.id, true );

			} else if ( ! pState.spectating && entry.spectating ) {

				this.setSpectating( pState.id, false );

			}

			if ( ! entry.spectating ) {

				entry.vehicle.setTargetState(
					pState.pos, pState.rot, pState.vel, pState.angVel,
					pState.speed, pState.drift
				);

			}

		}

	}

	// ── Spectating ───────────────────────────────────────────────────────────

	setSpectating( id, active ) {

		const entry = this.players.get( id );
		if ( ! entry ) return;

		entry.spectating = active;

		if ( active ) {

			entry.vehicle.container.visible = false;

			if ( entry.vehicle.rigidBody ) {

				removeVehicleBody( this.world, entry.vehicle.rigidBody );

			}

		} else {

			entry.vehicle.container.visible = true;

			// Restore physics body at spawn position
			const pos = this.spawnPosition;
			entry.vehicle.rigidBody = createVehicleBody( this.world, pos );
			entry.vehicle.physicsWorld = this.world;
			entry.vehicle.initRaycast( this.world );

			const [ sx, sy, sz ] = pos;
			entry.vehicle.spherePos.set( sx, sy, sz );
			entry.vehicle.groundHeight = sy;
			entry.vehicle.linearSpeed = 0;
			entry.vehicle.angularSpeed = 0;

		}

	}

	// ── Per-frame update ─────────────────────────────────────────────────────

	update( dt, controlsInput ) {

		for ( const [ id, entry ] of this.players ) {

			if ( entry.spectating ) continue;

			if ( id === this.localId ) {

				entry.vehicle.update( dt, controlsInput );

			} else {

				entry.vehicle.update( dt, { x: 0, z: 0, touchActive: false } );

			}

			entry.smokeTrails.update( dt, entry.vehicle );

		}

	}

	// ── State for network send ───────────────────────────────────────────────

	getLocalState() {

		if ( ! this.localVehicle ) return null;
		return this.localVehicle.getState();

	}

	// ── Helpers ──────────────────────────────────────────────────────────────

	getFirstActiveVehicle() {

		for ( const [ id, entry ] of this.players ) {

			if ( id !== this.localId && ! entry.spectating ) {

				return entry.vehicle;

			}

		}

		return this.localVehicle;

	}

	getActiveVehicles() {

		const result = [];
		for ( const [ id, entry ] of this.players ) {

			if ( ! entry.spectating ) result.push( { id, vehicle: entry.vehicle } );

		}

		return result;

	}

	_createVehicle( vehicleIndex, tint, position, angle ) {

		const modelName = VEHICLE_MODEL_NAMES[ vehicleIndex % 4 ];
		const model = this.models[ modelName ];

		const sphereBody = createVehicleBody( this.world, position );

		const vehicle = new Vehicle();
		vehicle.rigidBody = sphereBody;
		vehicle.physicsWorld = this.world;
		vehicle.forceWheelCorrection = true;

		const [ sx, sy, sz ] = position;
		vehicle.spherePos.set( sx, sy, sz );
		vehicle.groundHeight = sy;
		vehicle.prevModelPos.set( sx, sy, sz );
		vehicle.container.rotation.y = angle;

		const group = vehicle.init( model );
		vehicle.initRaycast( this.world );

		// Apply tint to body mesh for players 5+
		if ( tint ) {

			const tintColor = new THREE.Color( tint );
			vehicle.container.traverse( ( child ) => {

				if ( child.isMesh && child.name.toLowerCase() === 'body' ) {

					child.material = child.material.clone();
					child.material.color.multiply( tintColor );

				}

			} );

		}

		// Enable headlights (night mode is default)
		for ( const hl of vehicle.headlights ) hl.visible = true;

		this.scene.add( group );

		return vehicle;

	}

	_computeSpawnOffset( playerIndex ) {

		// Offset laterally perpendicular to the spawn direction
		const laneOffset = ( playerIndex % 4 ) * 2.5 - 3.75;
		const perpX = - Math.sin( this.spawnAngle ) * laneOffset;
		const perpZ = Math.cos( this.spawnAngle ) * laneOffset;
		return [ perpX, perpZ ];

	}

}

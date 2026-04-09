import * as THREE from 'three';
import { Vehicle } from './Vehicle.js';
import { createVehicleBody, removeVehicleBody } from './Physics.js';
import { SmokeTrails } from './Particles.js';
import { DriftSparks } from './DriftSparks.js';
import { BoostFlame } from './BoostFlame.js';
import { TireMarks } from './TireMarks.js';
import { PLAYER_VEHICLES, PLAYER_CHARACTER_ID, getVehicleById } from './VehicleRegistry.js';

const REMOTE_ZERO_INPUT = { x: 0, z: 0, touchActive: false };

const VEHICLE_MODEL_NAMES = [
	'vehicle-truck-yellow',
	'vehicle-truck-green',
	'vehicle-truck-purple',
	'vehicle-truck-red',
];

const CHARACTER_MODEL_NAMES = [
	'character-default',
];

export class PlayerManager {

	constructor( scene, world, models, spawnPosition, spawnAngle ) {

		this.scene = scene;
		this.world = world;
		this.models = models;
		this.spawnPosition = spawnPosition || [ 3.5, 0, 5 ];
		this.spawnAngle = spawnAngle || 0;

		this.localId = null;
		this.localVehicle = null;
		this.players = new Map(); // id → { vehicle, smokeTrails, spectating }
		this._activeVehiclesCache = [];

	}

	// ── Single-player fallback ───────────────────────────────────────────────

	initSinglePlayer( vehicleId ) {

		const vehicle = this._createVehicle( 0, 0, null, this.spawnPosition, this.spawnAngle, false, vehicleId );
		this.localVehicle = vehicle;
		this.localId = '_local';
		this.players.set( this.localId, {
			vehicle,
			smokeTrails: new SmokeTrails( this.scene ),
			driftSparks: new DriftSparks( this.scene ),
			boostFlame: new BoostFlame( this.scene ),
			tireMarks: new TireMarks( this.scene ),
			spectating: false,
		} );

	}

	// ── Runtime vehicle swap ─────────────────────────────────────────────────

	swapLocalVehicle( vehicleId ) {

		if ( ! this.localVehicle ) return;

		const config = getVehicleById( vehicleId );
		const newModel = this.models[ config.id ];
		if ( ! newModel ) return;

		const characterModel = this.models[ PLAYER_CHARACTER_ID ] || null;

		// Swap only the visual model — keeps physics, position, camera target intact
		this.localVehicle.swapModel( newModel, characterModel, config.characterOffset, config.bodyHeight );
		this.localVehicle._vehicleId = config.id;

	}

	// ── Multiplayer: local player ────────────────────────────────────────────

	initLocalPlayer( welcomeData ) {

		this.localId = welcomeData.id;
		const vehicle = this._createVehicle( welcomeData.vehicleIndex, welcomeData.characterIndex, welcomeData.tint, this.spawnPosition, this.spawnAngle );
		this.localVehicle = vehicle;
		this.players.set( this.localId, {
			vehicle,
			smokeTrails: new SmokeTrails( this.scene ),
			driftSparks: new DriftSparks( this.scene ),
			boostFlame: new BoostFlame( this.scene ),
			tireMarks: new TireMarks( this.scene ),
			spectating: false,
		} );

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

		const vehicle = this._createVehicle( joinData.vehicleIndex, joinData.characterIndex, joinData.tint, spawnPos, this.spawnAngle, true );
		vehicle.remote = true;

		// Remove SpotLights/PointLight to avoid Three.js shader recompilation
		for ( const hl of vehicle.headlights ) {

			if ( hl.target ) vehicle.container.remove( hl.target );
			vehicle.container.remove( hl );

		}

		vehicle.headlights.length = 0;
		if ( vehicle.underglowLight ) vehicle.underglowLight.visible = false;

		if ( joinData.spectating ) {

			vehicle.container.visible = false;

		}

		this.players.set( joinData.id, {
			vehicle,
			smokeTrails: new SmokeTrails( this.scene ),
			driftSparks: new DriftSparks( this.scene ),
			boostFlame: new BoostFlame( this.scene ),
			tireMarks: new TireMarks( this.scene ),
			spectating: joinData.spectating || false,
		} );

	}

	removeRemotePlayer( id ) {

		const entry = this.players.get( id );
		if ( ! entry ) return;

		entry.smokeTrails.dispose();
		entry.driftSparks.dispose();
		entry.boostFlame.dispose();
		entry.tireMarks.dispose();

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
					pState.speed, pState.drift, pState.boost,
					pState.shield, pState.star
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
			if ( ! entry.vehicle.remote ) entry.vehicle.initRaycast( this.world );

			const [ sx, sy, sz ] = pos;
			entry.vehicle.vehPos.set( sx, sy, sz );
			entry.vehicle.groundHeight = sy;
			entry.vehicle.linearSpeed = 0;
			entry.vehicle.angularSpeed = 0;
			entry.vehicle.shieldActive = false;
			entry.vehicle.shieldTimer = 0;
			entry.vehicle.starActive = false;
			entry.vehicle.starTimer = 0;
			entry.tireMarks.clear();

		}

	}

	// ── Per-frame update ─────────────────────────────────────────────────────

	update( dt, controlsInput ) {

		for ( const [ id, entry ] of this.players ) {

			if ( entry.spectating ) continue;

			if ( id === this.localId ) {

				entry.vehicle.update( dt, controlsInput );

			} else {

				entry.vehicle.update( dt, REMOTE_ZERO_INPUT );

			}

			entry.smokeTrails.update( dt, entry.vehicle );
			entry.driftSparks.update( dt, entry.vehicle );
			entry.boostFlame.update( dt, entry.vehicle );
			entry.tireMarks.update( dt, entry.vehicle );

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

		this._activeVehiclesCache.length = 0;
		for ( const [ id, entry ] of this.players ) {

			if ( ! entry.spectating ) this._activeVehiclesCache.push( { id, vehicle: entry.vehicle } );

		}

		return this._activeVehiclesCache;

	}

	_createVehicle( vehicleIndex, characterIndex, tint, position, angle, isRemote, vehicleId ) {

		// Local player gets a kart from the registry; AI/remote get trucks
		let modelName, charName, characterOffset, bodyHeight;
		if ( ! isRemote && vehicleId ) {

			const config = getVehicleById( vehicleId );
			modelName = config.id;
			charName = PLAYER_CHARACTER_ID;
			characterOffset = config.characterOffset;
			bodyHeight = config.bodyHeight;

		} else if ( ! isRemote && vehicleIndex === 0 && this.models[ PLAYER_VEHICLES[ 0 ].id ] ) {

			const config = PLAYER_VEHICLES[ 0 ];
			modelName = config.id;
			charName = PLAYER_CHARACTER_ID;
			characterOffset = config.characterOffset;
			bodyHeight = config.bodyHeight;

		} else {

			modelName = VEHICLE_MODEL_NAMES[ vehicleIndex % VEHICLE_MODEL_NAMES.length ];
			charName = CHARACTER_MODEL_NAMES[ ( characterIndex || 0 ) % CHARACTER_MODEL_NAMES.length ];
			characterOffset = null;
			bodyHeight = undefined;

		}

		const model = this.models[ modelName ];
		const characterModel = this.models[ charName ] || null;

		const vehCollider = createVehicleBody( this.world, position );

		const vehicle = new Vehicle();
		vehicle.rigidBody = vehCollider;
		vehicle.physicsWorld = this.world;
		vehicle.forceWheelCorrection = true;
		vehicle._vehicleId = modelName;

		const [ sx, sy, sz ] = position;
		vehicle.vehPos.set( sx, sy, sz );
		vehicle.groundHeight = sy;
		vehicle.prevModelPos.set( sx, sy, sz );
		vehicle.container.rotation.y = angle;

		const group = vehicle.init( model, characterModel, characterOffset, bodyHeight );
		if ( ! isRemote ) vehicle.initRaycast( this.world );

		// Apply tint to body mesh for players 5+
		if ( tint && vehicle.bodyNode ) {

			const tintColor = new THREE.Color( tint );
			vehicle.bodyNode.traverse( ( child ) => {

				if ( ! child.isMesh ) return;
				child.material = child.material.clone();
				child.material.color.multiply( tintColor );

			} );

		}

		// Enable headlights (night mode is default)
		for ( const hl of vehicle.headlights ) hl.visible = true;

		this.scene.add( group );

		return vehicle;

	}

	_computeSpawnOffset( playerIndex ) {

		// Offset laterally perpendicular to the spawn direction
		const laneOffset = ( playerIndex % 4 ) * 3.0 - 4.5;
		const perpX = - Math.sin( this.spawnAngle ) * laneOffset;
		const perpZ = Math.cos( this.spawnAngle ) * laneOffset;
		return [ perpX, perpZ ];

	}

}

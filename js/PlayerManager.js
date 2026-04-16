import { Vehicle } from './Vehicle.js';
import { createVehicleBody, removeVehicleBody } from './Physics.js';
import { SmokeTrails } from './Particles.js';
import { DriftSparks } from './DriftSparks.js';
import { BoostFlame } from './BoostFlame.js';
import { TireMarks } from './TireMarks.js';
import { PLAYER_VEHICLES, PLAYER_CHARACTER_ID, getVehicleById } from './VehicleRegistry.js';
import { applyPlayerAppearanceToVehicle, createDefaultPlayerAppearance, normalizeAppearanceColor, normalizePlayerAppearance } from './PlayerAppearance.js';

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
const LOCAL_FALLBACK_LABEL = 'YOU';
const REMOTE_FALLBACK_LABEL_PREFIX = 'PLAYER ';
const START_GRID_COLUMNS = 3;
const START_GRID_LANE_OFFSETS = [ 0, - 3.0, 3.0 ];
const START_GRID_LANE_SPACING = 3.0;
const START_GRID_ROW_SPACING = 4.0;

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
		this._humanRaceDataCache = [];
		this._nextFallbackLabelNumber = 2;

	}

	// ── Single-player fallback ───────────────────────────────────────────────

	initSinglePlayer( vehicleId, displayName = '', appearance = null ) {

		const spawnPose = this._computeSpawnPose( 0 );
		const vehicle = this._createVehicle( 0, 0, null, spawnPose.position, spawnPose.angle, false, vehicleId, appearance );
		this.localVehicle = vehicle;
		this.localId = '_local';
		this.players.set( this.localId, this._createPlayerEntry( {
			vehicle,
			smokeTrails: new SmokeTrails( this.scene ),
			driftSparks: new DriftSparks( this.scene ),
			boostFlame: new BoostFlame( this.scene ),
			tireMarks: new TireMarks( this.scene ),
			spectating: false,
			displayName,
			fallbackLabel: LOCAL_FALLBACK_LABEL,
			spawnSlot: spawnPose.slot,
			appearance,
		} ) );

	}

	// ── Runtime vehicle swap ─────────────────────────────────────────────────

	swapLocalVehicle( vehicleId ) {

		if ( ! this.localVehicle ) return;

		const config = getVehicleById( vehicleId );
		const newModel = this.models[ config.id ];
		if ( ! newModel ) return;

		const characterModel = this.models[ PLAYER_CHARACTER_ID ] || null;

		// Swap only the visual model — keeps physics, position, camera target intact
		this.localVehicle._vehicleId = config.id;
		this.localVehicle.swapModel( newModel, characterModel, config.characterOffset, config.bodyHeight );

	}

	// ── Multiplayer: local player ────────────────────────────────────────────

	initLocalPlayer( welcomeData ) {

		this.localId = welcomeData.id;
		const spawnPose = this._computeSpawnPose( welcomeData.spawnSlot );
		const localAppearance = this._composeAppearancePayload( welcomeData.appearance, welcomeData.selectedBalaclavaId );
		const vehicle = this._createVehicle( welcomeData.vehicleIndex, welcomeData.characterIndex, welcomeData.tint, spawnPose.position, spawnPose.angle, false, welcomeData.vehicleId, localAppearance );
		this.localVehicle = vehicle;
		this.players.set( this.localId, this._createPlayerEntry( {
			vehicle,
			smokeTrails: new SmokeTrails( this.scene ),
			driftSparks: new DriftSparks( this.scene ),
			boostFlame: new BoostFlame( this.scene ),
			tireMarks: new TireMarks( this.scene ),
			spectating: false,
			displayName: welcomeData.displayName || welcomeData.name || '',
			fallbackLabel: LOCAL_FALLBACK_LABEL,
			spawnSlot: spawnPose.slot,
			appearance: localAppearance,
		} ) );

		// Add existing players
		if ( welcomeData.existingPlayers ) {

			for ( const p of welcomeData.existingPlayers ) {

				this.addRemotePlayer( p );

			}

		}

	}

	// ── Remote players ───────────────────────────────────────────────────────

	addRemotePlayer( joinData ) {

		const remoteAppearance = this._composeAppearancePayload( joinData.appearance, joinData.selectedBalaclavaId );
		const existing = this.players.get( joinData.id );
		if ( existing ) {

			this._updatePlayerDisplayName( existing, joinData.name );
			this._updatePlayerAppearance( existing, remoteAppearance, joinData.tint );
			if ( typeof joinData.spectating === 'boolean' ) existing.spectating = joinData.spectating;
			return;

		}

		const spawnPose = this._computeSpawnPose( joinData.spawnSlot );
		const vehicle = this._createVehicle( joinData.vehicleIndex, joinData.characterIndex, joinData.tint, spawnPose.position, spawnPose.angle, true, joinData.vehicleId, remoteAppearance );
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

		this.players.set( joinData.id, this._createPlayerEntry( {
			vehicle,
			smokeTrails: new SmokeTrails( this.scene ),
			driftSparks: new DriftSparks( this.scene ),
			boostFlame: new BoostFlame( this.scene ),
			tireMarks: new TireMarks( this.scene ),
			spectating: joinData.spectating || false,
			displayName: joinData.name || '',
			fallbackLabel: this._allocateRemoteFallbackLabel(),
			spawnSlot: spawnPose.slot,
			appearance: remoteAppearance,
		} ) );

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
					pState.shield, pState.star, pState.damage, pState.trick
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
			const pos = this._computeSpawnPose( entry.spawnSlot ).position;
			entry.vehicle.rigidBody = createVehicleBody( this.world, pos );
			entry.vehicle.physicsWorld = this.world;
			if ( ! entry.vehicle.remote ) entry.vehicle.initRaycast( this.world );

			const [ sx, sy, sz ] = pos;
			entry.vehicle.vehPos.set( sx, sy, sz );
			entry.vehicle.groundHeight = sy;
			entry.vehicle.prevModelPos.set( sx, sy, sz );
			entry.vehicle.container.position.set( sx, sy, sz );
			entry.vehicle.container.rotation.y = this.spawnAngle;
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

	getHumanRaceData() {

		this._humanRaceDataCache.length = 0;

		for ( const [ id, entry ] of this.players ) {

			if ( entry.spectating ) continue;

			this._humanRaceDataCache.push( {
				id,
				vehicle: entry.vehicle,
				displayLabel: this._getPlayerDisplayLabel( entry ),
				isLocal: id === this.localId,
			} );

		}

		return this._humanRaceDataCache;

	}

	_createPlayerEntry( { vehicle, smokeTrails, driftSparks, boostFlame, tireMarks, spectating, displayName, fallbackLabel, spawnSlot = 0, appearance = null } ) {

		return {
			vehicle,
			smokeTrails,
			driftSparks,
			boostFlame,
			tireMarks,
			spectating,
			displayName: this._normalizeRaceLabel( displayName ),
			fallbackLabel,
			spawnSlot: this._normalizeSpawnSlot( spawnSlot ),
			appearance: normalizePlayerAppearance( appearance || createDefaultPlayerAppearance() ),
		};

	}

	_updatePlayerDisplayName( entry, displayName ) {

		const normalized = this._normalizeRaceLabel( displayName );
		if ( normalized ) entry.displayName = normalized;

	}

	_updatePlayerAppearance( entry, appearance, tint = null ) {

		entry.appearance = normalizePlayerAppearance( appearance || entry.appearance || createDefaultPlayerAppearance() );

		if ( ! entry.appearance.vehicleColor && tint ) {

			entry.appearance.vehicleColor = normalizeAppearanceColor( tint );

		}

		applyPlayerAppearanceToVehicle( entry.vehicle, entry.appearance );

	}

	_composeAppearancePayload( appearance, selectedBalaclavaId ) {

		return {
			...( appearance && typeof appearance === 'object' ? appearance : {} ),
			...( selectedBalaclavaId !== undefined ? { selectedBalaclavaId } : {} ),
		};

	}

	_getPlayerDisplayLabel( entry ) {

		return entry.displayName || entry.fallbackLabel || LOCAL_FALLBACK_LABEL;

	}

	_allocateRemoteFallbackLabel() {

		return REMOTE_FALLBACK_LABEL_PREFIX + this._nextFallbackLabelNumber ++;

	}

	_normalizeRaceLabel( displayName ) {

		if ( typeof displayName !== 'string' ) return '';
		return displayName.trim().slice( 0, 20 );

	}

	_createVehicle( vehicleIndex, characterIndex, tint, position, angle, isRemote, vehicleId, appearance = null ) {

		// Local player gets a kart from the registry; AI/remote get trucks
		let modelName, charName, characterOffset, bodyHeight;
		if ( vehicleId ) {

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
			charName = PLAYER_CHARACTER_ID;
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
		vehicle._trackBaseY = this.spawnPosition[ 1 ] || 0;
		vehicle.prevModelPos.set( sx, sy, sz );
		vehicle.container.rotation.y = angle;

		const group = vehicle.init( model, characterModel, characterOffset, bodyHeight );
		if ( ! isRemote ) vehicle.initRaycast( this.world );
		const normalizedAppearance = normalizePlayerAppearance( appearance || createDefaultPlayerAppearance() );
		if ( ! normalizedAppearance.vehicleColor && tint ) {

			normalizedAppearance.vehicleColor = normalizeAppearanceColor( tint );

		}
		applyPlayerAppearanceToVehicle( vehicle, normalizedAppearance );

		// Enable headlights (night mode is default)
		for ( const hl of vehicle.headlights ) hl.visible = true;

		this.scene.add( group );

		return vehicle;

	}

	_normalizeSpawnSlot( spawnSlot ) {

		if ( typeof spawnSlot !== 'number' || ! Number.isFinite( spawnSlot ) ) return 0;
		return Math.max( 0, Math.floor( spawnSlot ) );

	}

	_computeSpawnPose( spawnSlot = 0 ) {

		const slot = this._normalizeSpawnSlot( spawnSlot );
		const column = slot % START_GRID_COLUMNS;
		const row = Math.floor( slot / START_GRID_COLUMNS );
		const lateral = START_GRID_LANE_OFFSETS[ column ] ?? ( column * START_GRID_LANE_SPACING );
		const longitudinal = - row * START_GRID_ROW_SPACING;

		const fwdX = Math.sin( this.spawnAngle );
		const fwdZ = Math.cos( this.spawnAngle );
		const rightX = - fwdZ;
		const rightZ = fwdX;

		return {
			slot,
			angle: this.spawnAngle,
			position: [
				this.spawnPosition[ 0 ] + rightX * lateral + fwdX * longitudinal,
				this.spawnPosition[ 1 ],
				this.spawnPosition[ 2 ] + rightZ * lateral + fwdZ * longitudinal,
			],
		};

	}

}

import * as THREE from 'three';
import { Vehicle } from './Vehicle.js';
import { createVehicleBody, removeVehicleBody } from './Physics.js';
import { SmokeTrails } from './Particles.js';
import { DriftSparks } from './DriftSparks.js';
import { BoostFlame } from './BoostFlame.js';
import { TireMarks } from './TireMarks.js';
import { FinishLine } from './FinishLine.js';
import { AIController } from './AIController.js';
import { AI_PROFILES } from './AIProfiles.js';
import { rigidBody } from 'crashcat';

const VEHICLE_BASE_MODEL = 'vehicle-truck-yellow';

// Golden-angle hue distribution — ensures no two adjacent AIs share similar colors
function generateAIColors( count ) {

	const colors = [];
	const hueStart = Math.random() * 360;
	for ( let i = 0; i < count; i ++ ) {

		const hue = ( hueStart + i * 137.508 ) % 360; // golden angle
		colors.push( new THREE.Color().setHSL( hue / 360, 0.75, 0.55 ) );

	}

	return colors;

}

const CHARACTER_MODEL_NAMES = [
	'character-default',
];

const ZERO_INPUT = { x: 0, z: 0, touchActive: false, boost: false, drift: false, gas: false, brake: false };

const COL_OFFSETS = [ - 2.5, 0, 2.5 ];
const ROW_OFFSETS = [ 0, - 3.0, - 6.0 ];

const { clamp, lerp } = THREE.MathUtils;

export class AIManager {

	constructor( scene, world, models, trackIntel, spawnPosition, spawnAngle, finishAngle ) {

		this.scene = scene;
		this.world = world;
		this.models = models;
		this.trackIntel = trackIntel;
		this.spawnPosition = spawnPosition;
		this.spawnAngle = spawnAngle;
		this.finishAngle = finishAngle;

		this.totalLaps = 3;
		this.playerModelIndex = 0;
		this.rubberBandIntensity = 0.5;

		this._racers = [];
		this._activeVehiclesCache = [];
		this._raceDataCache = [];
		this._aiColors = generateAIColors( 8 );

	}

	// ── Spawn / despawn ──────────────────────────────────────────────────────

	setCount( count ) {

		count = clamp( Math.round( count ), 0, 8 );

		// Spawn new
		while ( this._racers.length < count ) {

			this._spawnAI( this._racers.length );

		}

		// Despawn excess (from end)
		while ( this._racers.length > count ) {

			this._despawnAI();

		}

	}

	_spawnAI( index ) {

		const model = this.models[ VEHICLE_BASE_MODEL ];

		const charName = CHARACTER_MODEL_NAMES[ index % CHARACTER_MODEL_NAMES.length ];
		const characterModel = this.models[ charName ] || null;

		const vehicle = Vehicle.spawn( {
			world: this.world,
			createBody: createVehicleBody,
			model,
			characterModel,
			position: this.spawnPosition,
			angle: this.spawnAngle,
			options: { forceWheelCorrection: true },
		} );

		// Disable headlights on AI vehicles to save GPU
		for ( const hl of vehicle.headlights ) hl.visible = false;

		// Apply unique color tint to this AI's body
		const aiColor = this._aiColors[ index % this._aiColors.length ];
		if ( vehicle.bodyNode ) {

			vehicle.bodyNode.traverse( ( child ) => {

				if ( ! child.isMesh ) return;
				child.material = child.material.clone();
				child.material.color.copy( aiColor );

			} );

		}

		this.scene.add( vehicle.container );

		const profile = AI_PROFILES[ index % AI_PROFILES.length ];
		vehicle.weight = profile.weight || 5;
		const controller = new AIController( this.trackIntel, index, profile );

		const finishLine = new FinishLine( {
			position: this.spawnPosition,
			angle: this.finishAngle
		} );

		this._racers.push( {
			id: 'ai_' + index,
			vehicle,
			controller,
			profile,
			smokeTrails: new SmokeTrails( this.scene ),
			driftSparks: new DriftSparks( this.scene ),
			boostFlame: new BoostFlame( this.scene ),
			tireMarks: new TireMarks( this.scene ),
			finishLine,
			lap: 0,
			prevPos: null,
			finished: false,
			segmentHint: null,
		} );

	}

	_despawnAI() {

		const ai = this._racers.pop();
		if ( ! ai ) return;

		removeVehicleBody( this.world, ai.vehicle.rigidBody );
		this.scene.remove( ai.vehicle.container );

		ai.driftSparks.dispose();
		ai.boostFlame.dispose();
		ai.tireMarks.dispose();

	}

	// ── Per-frame update ─────────────────────────────────────────────────────

	update( dt, playerVehicle, raceState, playerLap ) {

		// Cache player progress once per frame (used by all AI rubber-band calcs)
		this._cachedPlayerProgress = null;
		if ( this.rubberBandIntensity !== 0 && playerVehicle ) {

			const pl = playerLap || 0;
			this._cachedPlayerProgress = pl + this.trackIntel.getProgress(
				playerVehicle.vehPos.x, playerVehicle.vehPos.z
			);

		}

		for ( let i = 0; i < this._racers.length; i ++ ) {

			const ai = this._racers[ i ];

			if ( ai.finished ) continue;

			// Rubber-banding
			const rbFactor = this._computeRubberBand( ai );
			ai.vehicle.externalTopSpeedMultiplier = rbFactor;

			// AI controller input
			const aiInput = ai.controller.update( dt, ai.vehicle );

			// Freeze during countdown
			const input = ( raceState === 'countdown' ) ? ZERO_INPUT : aiInput;

			// Update vehicle physics
			ai.vehicle.update( dt, input );

			// VFX
			ai.smokeTrails.update( dt, ai.vehicle );
			ai.driftSparks.update( dt, ai.vehicle );
			ai.boostFlame.update( dt, ai.vehicle );
			ai.tireMarks.update( dt, ai.vehicle );

			// Finish line check during racing
			if ( raceState === 'racing' ) {

				this._checkFinishLine( ai );

			}

		}

	}

	// ── Rubber-banding ───────────────────────────────────────────────────────

	_computeRubberBand( ai ) {

		if ( this._cachedPlayerProgress === null ) return 1.0;

		const ti = this.trackIntel;
		const playerProgress = this._cachedPlayerProgress;
		ai.segmentHint = ti.getNearestWaypoint( ai.vehicle.vehPos.x, ai.vehicle.vehPos.z, ai.segmentHint );
		const aiProgress = ai.lap + ti.getProgress( ai.vehicle.vehPos.x, ai.vehicle.vehPos.z, ai.segmentHint );

		// Positive diff = AI is behind player
		const diff = playerProgress - aiProgress;

		// Map: 0.5 laps behind → full boost, 0.5 laps ahead → full slow
		const t = clamp( diff / 0.5, - 1, 1 );

		let multiplier;
		if ( t >= 0 ) {

			multiplier = lerp( 1.0, 1.3, t ); // behind: speed up

		} else {

			multiplier = lerp( 1.0, 0.75, - t ); // ahead: slow down

		}

		return lerp( 1.0, multiplier, this.rubberBandIntensity );

	}

	// ── Finish line detection ────────────────────────────────────────────────

	_checkFinishLine( ai ) {

		const currPos = ai.vehicle.vehPos;

		if ( ! ai.prevPos ) {

			ai.prevPos = new THREE.Vector3().copy( currPos );
			return;

		}

		const result = ai.finishLine.check( ai.prevPos, currPos );
		ai.prevPos.copy( currPos );

		if ( result.crossed && result.direction === 'forward' ) {

			ai.lap ++;

			if ( ai.lap >= this.totalLaps ) {

				ai.finished = true;

			}

		}

	}

	// ── Grid positioning ─────────────────────────────────────────────────────

	computeGridPositions() {

		const positions = [];

		const fwdX = - Math.sin( this.spawnAngle );
		const fwdZ = - Math.cos( this.spawnAngle );
		const rightX = - fwdZ;
		const rightZ = fwdX;

		for ( let row = 0; row < 3; row ++ ) {

			for ( let col = 0; col < 3; col ++ ) {

				const lateral = COL_OFFSETS[ col ];
				const longitudinal = ROW_OFFSETS[ row ];

				positions.push( {
					x: this.spawnPosition[ 0 ] + rightX * lateral + fwdX * longitudinal,
					y: this.spawnPosition[ 1 ],
					z: this.spawnPosition[ 2 ] + rightZ * lateral + fwdZ * longitudinal,
				} );

			}

		}

		return positions;

	}

	teleportToGrid( playerVehicle ) {

		const totalRacers = 1 + this._racers.length;
		const gridPositions = this.computeGridPositions();

		// Player gets a random slot
		const playerSlot = Math.floor( Math.random() * totalRacers );

		// Teleport player
		this._teleportVehicle( playerVehicle, gridPositions[ playerSlot ] );

		// Teleport AI racers into remaining slots
		let aiIdx = 0;
		for ( let slot = 0; slot < totalRacers; slot ++ ) {

			if ( slot === playerSlot ) continue;

			if ( aiIdx < this._racers.length ) {

				this._teleportVehicle( this._racers[ aiIdx ].vehicle, gridPositions[ slot ] );
				aiIdx ++;

			}

		}

	}

	_teleportVehicle( vehicle, gridPos ) {

		vehicle.vehPos.set( gridPos.x, gridPos.y, gridPos.z );
		vehicle.groundHeight = gridPos.y;
		vehicle.prevModelPos.set( gridPos.x, gridPos.y, gridPos.z );
		vehicle.container.position.set( gridPos.x, gridPos.y, gridPos.z );
		vehicle.container.rotation.y = this.spawnAngle;
		vehicle.linearSpeed = 0;
		vehicle.angularSpeed = 0;
		vehicle.acceleration = 0;

		if ( vehicle.rigidBody && vehicle.physicsWorld ) {

			rigidBody.setPosition( vehicle.physicsWorld, vehicle.rigidBody, [ gridPos.x, gridPos.y + 0.5, gridPos.z ], false );
			rigidBody.setLinearVelocity( vehicle.physicsWorld, vehicle.rigidBody, [ 0, 0, 0 ] );
			rigidBody.setAngularVelocity( vehicle.physicsWorld, vehicle.rigidBody, [ 0, 0, 0 ] );

		}

	}

	// ── Race lifecycle ───────────────────────────────────────────────────────

	startRace() {

		for ( const ai of this._racers ) {

			ai.lap = 0;
			ai.finished = false;
			ai.prevPos = null;
			ai.finishLine.resetCooldown();

		}

	}

	resetRace() {

		for ( const ai of this._racers ) {

			ai.lap = 0;
			ai.finished = false;
			ai.prevPos = null;
			ai.segmentHint = null;
			ai.finishLine.resetCooldown();
			ai.vehicle.externalTopSpeedMultiplier = 1.0;
			ai.tireMarks.clear();

		}

	}

	// ── Queries ──────────────────────────────────────────────────────────────

	getActiveVehicles() {

		this._activeVehiclesCache.length = 0;

		for ( const ai of this._racers ) {

			this._activeVehiclesCache.push( { id: ai.id, vehicle: ai.vehicle } );

		}

		return this._activeVehiclesCache;

	}

	getAIRaceData() {

		this._raceDataCache.length = 0;

		for ( const ai of this._racers ) {

			this._raceDataCache.push( { vehicle: ai.vehicle, lap: ai.lap, profileName: ai.profile.name } );

		}

		return this._raceDataCache;

	}

	get count() { return this._racers.length; }

}

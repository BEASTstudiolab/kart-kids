import * as THREE from 'three';
import { PhysicsState } from './vehicle/VehicleStateMachine.js';
import { LaunchSource } from './vehicle/VehicleAirborne.js';


// Reusable vectors for bump calculations (avoid per-contact allocation)
const _bumpFwd = new THREE.Vector3();
const _bumpRight = new THREE.Vector3();
const _bumpNormalXZ = new THREE.Vector3();
const _bumpLateral = new THREE.Vector3();
const _bumpPushDir = new THREE.Vector3();


/**
 * Creates the physics contact listener for vehicle-vs-vehicle and vehicle-vs-wall collisions.
 *
 * @param {object} ctx
 * @param {object} ctx.vehicle - Local player vehicle
 * @param {object} ctx.audio - GameAudio instance
 * @param {object} ctx.cam - Camera instance
 * @param {object} ctx.wallSparks - WallSparks VFX
 * @param {object} ctx.haptics - Haptics instance
 * @param {Map} ctx.bodyToVehicle - Map of rigid body → vehicle
 * @returns {{ onContactAdded: Function, checkVehicleBumps: Function }}
 */
export function createContactListener( ctx ) {

	const { vehicle, audio, cam, wallSparks, haptics, bodyToVehicle, combatManager } = ctx;

	let lastImpactTime = 0;

	function _cancelAirTrick( targetVehicle ) {

		if ( ! targetVehicle ) return;
		const state = targetVehicle._stateMachine?.currentState;
		const airborne = ! targetVehicle._grounded ||
			state === PhysicsState.AIRBORNE ||
			state === PhysicsState.TAKEOFF;

		if ( ! airborne ) return;

		if ( targetVehicle._airborne ) targetVehicle._airborne.markWallContact( targetVehicle );
		if ( targetVehicle._trick ) targetVehicle._trick.cancel( targetVehicle );

	}

	function _applyBump( vehicleA, vehicleB ) {

		const now = performance.now() / 1000;
		const cd = vehicle.debug.bumpCooldown;
		if ( now - vehicleA.lastBumpTime < cd && now - vehicleB.lastBumpTime < cd ) return;

		const svA = vehicleA.vehVel;
		const svB = vehicleB.vehVel;
		const speedA = Math.sqrt( svA.x * svA.x + svA.z * svA.z );
		const speedB = Math.sqrt( svB.x * svB.x + svB.z * svB.z );

		if ( Math.max( speedA, speedB ) < vehicle.debug.bumpMinSpeed ) return;

		// Aggressor = faster vehicle
		const attacker = speedA >= speedB ? vehicleA : vehicleB;
		const defender = speedA >= speedB ? vehicleB : vehicleA;
		const attackSpeed = Math.max( speedA, speedB );

		// Star: defender is immune
		if ( defender.starActive ) return;

		// Shield: absorb one bump
		if ( defender.shieldActive ) {

			defender.shieldActive = false;
			defender.shieldTimer = 0;
			if ( defender === vehicle ) audio.playShieldBreak();
			vehicleA.lastBumpTime = now;
			vehicleB.lastBumpTime = now;
			return;

		}

		// Push magnitude: (attackerSpeed * attackerWeight) / defenderWeight
		let pushMag = ( attackSpeed * attacker.weight ) / defender.weight;
		pushMag *= vehicle.debug.bumpForceScale;

		// Speed ramp: weaker bumps at low speed
		pushMag *= Math.min( attackSpeed / 15, 1.0 );

		// Star attacker gets 2x force
		if ( attacker.starActive ) pushMag *= 2.0;

		// Clamp
		pushMag = Math.min( pushMag, vehicle.debug.bumpMaxForce );

		// Direction: push from attacker toward defender in XZ
		_bumpFwd.set( 0, 0, 1 ).applyQuaternion( defender.container.quaternion );
		_bumpFwd.y = 0;
		_bumpFwd.normalize();
		_bumpRight.set( - _bumpFwd.z, 0, _bumpFwd.x );

		// Normal from attacker to defender (XZ only)
		_bumpNormalXZ.set(
			defender.vehPos.x - attacker.vehPos.x,
			0,
			defender.vehPos.z - attacker.vehPos.z
		);
		if ( _bumpNormalXZ.lengthSq() > 0 ) _bumpNormalXZ.normalize();
		else _bumpNormalXZ.copy( _bumpFwd );

		// Modulate lateral bias by hit angle: side hits = more lateral
		const headOnDot = Math.abs( _bumpNormalXZ.dot( _bumpFwd ) );
		const lateralBias = vehicle.debug.bumpLateralBias * ( 1 - headOnDot * 0.5 );

		_bumpLateral.copy( _bumpRight ).multiplyScalar( Math.sign( _bumpRight.dot( _bumpNormalXZ ) ) );
		_bumpPushDir.copy( _bumpNormalXZ ).lerp( _bumpLateral, lateralBias ).normalize();

		// Inject bump as a smooth velocity overlay (decays over ~0.15s in Vehicle.update)
		defender._bumpVel.x += _bumpPushDir.x * pushMag;
		defender._bumpVel.z += _bumpPushDir.z * pushMag;

		// Counter-push on attacker (Newton's 3rd, scaled by weight ratio)
		const counterScale = defender.weight / attacker.weight * 0.3;
		attacker._bumpVel.x -= _bumpPushDir.x * pushMag * counterScale;
		attacker._bumpVel.z -= _bumpPushDir.z * pushMag * counterScale;

		// Route damage through combat system
		if ( combatManager ) combatManager.processVehicleBump( attacker, defender, pushMag );

		// Trigger character impact animation
		if ( defender.triggerCharacterImpact ) defender.triggerCharacterImpact();

		vehicleA.lastBumpTime = now;
		vehicleB.lastBumpTime = now;
		_cancelAirTrick( attacker );
		_cancelAirTrick( defender );

		// Burnout-style vertical launch on strong hits, but make it explicit so
		// the landing path can distinguish combat airtime from authored jumps.
		const impactLaunchThreshold = vehicle.debug.impactLaunchThreshold ?? vehicle.debug.bumpVerticalThreshold;
		const impactLaunchScale = vehicle.debug.impactLaunchScale ?? vehicle.debug.bumpVerticalScale;
		const impactLaunchCap = vehicle.debug.impactLaunchCap ?? vehicle.debug.bumpVerticalCap;
		if ( pushMag > impactLaunchThreshold ) {

			const verticalLaunch = Math.min(
				( pushMag - impactLaunchThreshold ) * impactLaunchScale,
				impactLaunchCap
			);
			if ( defender._airborne?.beginLaunch ) {

				defender._airborne.beginLaunch( defender, {
					source: LaunchSource.IMPACT,
					verticalVelocity: verticalLaunch,
					verticalCap: impactLaunchCap,
				} );

			} else {

				defender._verticalVelocity = verticalLaunch;
				defender._grounded = false;
				defender._launchCooldown = 0.3;

			}
			if ( defender._stateMachine ) {

				defender._stateMachine.forceState( PhysicsState.AIRBORNE );

			}

		} else {

			// Suppress vertical launch after bump for weak/medium hits
			defender._wallHitTime = now;
			defender._verticalVelocity = 0;

		}

		// Spin-out on strong side impacts
		const sideHitStrength = Math.abs( _bumpRight.dot( _bumpNormalXZ ) );
		if ( sideHitStrength > 0.5 && pushMag > vehicle.debug.bumpSpinThreshold ) {

			const spinDirection = Math.sign( _bumpRight.dot( _bumpNormalXZ ) );
			defender.angularSpeed += spinDirection * pushMag * vehicle.debug.bumpSpinRate;

		}

		// Speed transfer: attacker steals speed from defender
		const transferRate = vehicle.debug.bumpSpeedTransferRate;
		if ( transferRate > 0 ) {

			const speedTransfer = Math.min( pushMag * transferRate, Math.abs( defender.linearSpeed ) * 0.2 );
			attacker.linearSpeed += speedTransfer * 0.3;
			defender.linearSpeed -= speedTransfer;

		}

		// Hit-stop micro-freeze on heavy impacts
		if ( pushMag > vehicle.debug.bumpHitStopThreshold ) {

			defender._hitStopFrames = ( defender._hitStopFrames || 0 ) + 2;
			attacker._hitStopFrames = ( attacker._hitStopFrames || 0 ) + 1;

		}

		// VFX/audio for local player
		if ( vehicleA === vehicle || vehicleB === vehicle ) {

			const isDefender = ( defender === vehicle );
			const severity = pushMag / vehicle.debug.bumpMaxForce;

			audio.playImpact( pushMag );
			cam.applyShake(
				_bumpPushDir.x, _bumpPushDir.z,
				pushMag * ( isDefender ? 1.0 : 0.4 )
			);

			const posA = vehicleA.container.position;
			const posB = vehicleB.container.position;
			wallSparks.emit(
				{ x: ( posA.x + posB.x ) / 2, y: posA.y, z: ( posA.z + posB.z ) / 2 },
				_bumpPushDir.x, _bumpPushDir.z, pushMag
			);
			haptics.impulse( severity * 0.6 );

		}

	}

	return {

		/**
		 * Game-level vehicle bump check — runs each frame using vehPos distance.
		 * More reliable than physics contacts for teleported remote bodies.
		 */
		checkVehicleBumps( activeVehicles ) {

			if ( ! vehicle ) return;

			const BUMP_RADIUS = 1.4; // sum of two vehicle half-lengths
			const BUMP_RADIUS_SQ = BUMP_RADIUS * BUMP_RADIUS;

			for ( let i = 0; i < activeVehicles.length; i ++ ) {

				const vA = activeVehicles[ i ].vehicle;
				if ( vA === vehicle ) continue;
				if ( ! vA ) continue;

				const dx = vehicle.vehPos.x - vA.vehPos.x;
				const dz = vehicle.vehPos.z - vA.vehPos.z;
				const distSq = dx * dx + dz * dz;

				if ( distSq < BUMP_RADIUS_SQ && distSq > 0 ) {

					_applyBump( vehicle, vA );

				}

			}

		},

		onContactAdded( bodyA, bodyB, manifold ) {

			const wn = manifold && manifold.worldSpaceNormal;
			if ( ! wn ) return;

			// Skip ground-like contacts (normal mostly vertical)
			if ( Math.abs( wn[ 1 ] ) > 0.5 ) return;

			// ── Vehicle-vs-Wall (local player only) ─────────────────────────
			if ( ! vehicle.rigidBody ) return;
			if ( bodyA !== vehicle.rigidBody && bodyB !== vehicle.rigidBody ) return;

			// Star: ignore all wall impacts
			if ( vehicle.starActive ) return;

			// Shield: absorb one wall hit
			if ( vehicle.shieldActive ) {

				vehicle.shieldActive = false;
				vehicle.shieldTimer = 0;
				audio.playShieldBreak();
				return;

			}

			const sv = vehicle.vehVel;
			const speed = Math.sqrt( sv.x * sv.x + sv.z * sv.z );
			if ( speed < 1.5 ) return;

			// Cooldown
			const now = performance.now() / 1000;
			if ( now - lastImpactTime < 0.3 ) return;
			lastImpactTime = now;

			// ── Wall normal ──────────────────────────────────────────────────
			const normalSign = ( bodyA === vehicle.rigidBody ) ? - 1 : 1;
			const nx = wn[ 0 ] * normalSign;
			const nz = wn[ 2 ] * normalSign;

			// Wall-slide projection: remove velocity component going into the wall,
			// then apply a speed penalty based on impact angle.
			const intoWall = sv.x * nx + sv.z * nz;
			if ( intoWall < 0 ) {

				// Project velocity onto wall plane (slide along wall)
				sv.x -= nx * intoWall;
				sv.z -= nz * intoWall;

			}

			// Additional speed penalty scaled by impact angle
			// Head-on (dot~1): lose 65%. Glancing (dot~0): lose 8%.
			const dot = Math.abs( intoWall ) / ( speed || 1 );
			const dampFactor = THREE.MathUtils.lerp( 0.92, 0.35, dot );
			vehicle.linearSpeed *= dampFactor;

			// Always suppress upward velocity on wall contact — hitting a wall
			// should never launch the vehicle upward regardless of surface slope.
			// Ramp launches go through the TAKEOFF state path, not wall contacts.
			vehicle._wallHitTime = now;
			if ( vehicle._airborne ) vehicle._airborne.markWallContact( vehicle );
			if ( vehicle._trick ) vehicle._trick.cancel( vehicle );
			if ( vehicle._verticalVelocity > 0 ) vehicle._verticalVelocity = 0;
			audio.playImpact( speed );

			// Route wall damage through combat system
			if ( combatManager ) combatManager.processWallHit( vehicle, speed, { x: nx, z: nz } );

			// Trigger character impact animation
			if ( vehicle.triggerCharacterImpact ) vehicle.triggerCharacterImpact();

			// ── Feedback ─────────────────────────────────────────────────────
			cam.applyShake( nx, nz, speed );
			wallSparks.emit( vehicle.container.position, nx, nz, speed );
			haptics.impulse( speed / 10 );

		}
	};

}

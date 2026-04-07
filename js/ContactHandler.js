import * as THREE from 'three';


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
 * @returns {{ onContactAdded: Function }}
 */
export function createContactListener( ctx ) {

	const { vehicle, audio, cam, wallSparks, haptics, bodyToVehicle } = ctx;

	let lastImpactTime = 0;

	return {
		onContactAdded( bodyA, bodyB, manifold ) {

			const wn = manifold && manifold.worldSpaceNormal;
			if ( ! wn ) return;

			// Skip ground-like contacts (normal mostly vertical)
			if ( Math.abs( wn[ 1 ] ) > 0.5 ) return;

			const vehicleA = bodyToVehicle.get( bodyA );
			const vehicleB = bodyToVehicle.get( bodyB );
			const bothVehicles = !! vehicleA && !! vehicleB;

			// ── Vehicle-vs-Vehicle bump ──────────────────────────────────────
			if ( bothVehicles ) {

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

				// Direction: blend contact normal with defender's lateral axis
				_bumpFwd.set( 0, 0, 1 ).applyQuaternion( defender.container.quaternion );
				_bumpFwd.y = 0;
				_bumpFwd.normalize();
				_bumpRight.set( - _bumpFwd.z, 0, _bumpFwd.x );

				// Contact normal in XZ, pointing from attacker toward defender
				const nSign = ( attacker === vehicleA ) ? 1 : - 1;
				_bumpNormalXZ.set( wn[ 0 ] * nSign, 0, wn[ 2 ] * nSign ).normalize();

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

				vehicleA.lastBumpTime = now;
				vehicleB.lastBumpTime = now;

				// Suppress vertical launch after bump — keep both karts grounded
				defender._wallHitTime = now;
				defender._verticalVelocity = 0;

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

				return;

			}

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

			// Let crashcat's collision solver handle the wall bounce naturally.
			// Scale damping by impact angle: glancing ~15% loss, head-on ~55% loss.
			const dot = Math.abs( nx * sv.x + nz * sv.z ) / ( speed || 1 );
			const dampFactor = THREE.MathUtils.lerp( 0.85, 0.45, dot );
			vehicle.linearSpeed *= dampFactor;
			vehicle._wallHitTime = now;
			vehicle._verticalVelocity = 0;
			audio.playImpact( speed );

			// ── Feedback ─────────────────────────────────────────────────────
			cam.applyShake( nx, nz, speed );
			wallSparks.emit( vehicle.container.position, nx, nz, speed );
			haptics.impulse( speed / 10 );

		}
	};

}

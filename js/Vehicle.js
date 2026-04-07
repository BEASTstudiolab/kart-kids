import * as THREE from 'three';
import { rigidBody } from 'crashcat';
import { VehicleGroundRaycast } from './vehicle/VehicleGroundRaycast.js';
import { VehicleRemoteSync } from './vehicle/VehicleRemoteSync.js';

const _tmpVec = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _zAxis = new THREE.Vector3();
const _newZ = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();

export const DrivingState = { NORMAL: 0, DRIFTING: 1, AIRBORNE: 2 };

function lerpAngle( a, b, t ) {

	let diff = b - a;
	while ( diff > Math.PI ) diff -= Math.PI * 2;
	while ( diff < -Math.PI ) diff += Math.PI * 2;
	return a + diff * t;

}

export class Vehicle {

	constructor() {

		this.linearSpeed = 0;
		this.angularSpeed = 0;
		this.acceleration = 0;

		// Momentum: builds when sustaining high speed, adds bonus toward 150 km/h display
		this.momentum = 0; // 0–1, builds slowly at high speed

		// Bump physics
		this.weight = 5; // 1-10 scale: heavier vehicles push lighter ones more
		this.lastBumpTime = 0;
		this._bumpVel = new THREE.Vector3(); // smoothly decaying bump/bounce velocity overlay

		this.vehPos = new THREE.Vector3( 3.5, 0, 5 );
		this.vehVel = new THREE.Vector3();

		this.rigidBody = null;
		this.physicsWorld = null;

		this.modelVelocity = new THREE.Vector3();
		this.prevModelPos = new THREE.Vector3( 3.5, 0, 5 );

		this.container = new THREE.Group();
		this.bodyNode = null;
		this.wheels = [];
		this.wheelFL = null;
		this.wheelFR = null;
		this.wheelBL = null;
		this.wheelBR = null;
		this.steeringWheel = null;
		this.seatAnchor = null;
		this.characterModel = null;

		this.inputX = 0;
		this.inputZ = 0;

		// Steering assist
		this._steeringAssistEnabled = false;
		this._trackIntel = null;
		this._assistWaypointHint = 0;

		this.driftIntensity = 0;

		// External speed multiplier (used by AI rubber-banding)
		this.externalTopSpeedMultiplier = 1.0;
		this.draftSpeedMultiplier = 1.0;

		// Set true before init() to force wheel orientation correction regardless of bounding box
		this.forceWheelCorrection = false;

		this.underglowLight = null;
		this.headlights = [];

		// Remote player state (delegated to VehicleRemoteSync)
		this.remote = false;
		this._remoteSync = new VehicleRemoteSync();

		this.debug = {
			lockX: false,
			lockY: false,
			lockZ: false,
			wheelHeight: 0,
			bodyHeight: 0.35,
			underbodyOffset: - 0.5,
			accelerationRate: 1,
			topSpeed: 250,
			// Steering
			steeringMultiplier: 4,
			steeringLerp: 4,
			steeringGripMin: 0.2,
			steeringGripMax: 1.0,
			// Braking / reverse
			brakeRate: 8,
			reverseSpeedFactor: 0.5,
			reverseAccelRate: 2,
			// Physics
			linearDamp: 0.1,
			speedScale: 12.5,
			velocityBlendRate: 5,
			// Boost / nitro
			boostFillTime: 20,
			boostDriftMultiplier: 5,
			boostDuration: 4,
			boostTopSpeed: 350,
			driftThreshold: 1.0,
			// Arcade drift
			driftArcSpeed: 3.5,
			driftMinSpeed: 0.2,
			// JDM drift tuning
			driftInitSlipAngle: 0.5,
			driftSlipAngleMax: 1.2,
			driftSlipAngleMin: 0.15,
			driftCounterSteerRate: 4.5,
			driftWithSteerRate: 2.0,
			driftSlipDamping: 1.5,
			driftSlipRestAngle: 0.5,
			driftYawRateSmoothing: 8.0,
			driftMoveAngleInertia: 5.0,
			driftSpeedArcFactor: 0.6,
			driftLateralFraction: 0.15,
			driftEntryRampTime: 0.15,
			driftExitSnapDuration: 0.3,
			driftExitSnapSharpness: 6.0,
			driftSpeedRetention: 0.95,
			driftBlueTier: 1.5,
			driftOrangeTier: 3.0,
			driftPurpleTier: 5.0,
			driftBlueBoostMult: 1.2,
			driftBlueBoostDuration: 1.0,
			driftOrangeBoostMult: 1.5,
			driftOrangeBoostDuration: 1.5,
			driftPurpleBoostMult: 2.0,
			driftPurpleBoostDuration: 2.0,
			// Body lean
			bodyLeanPitch: 6,
			bodyLeanRoll: 5,
			// Suspension
			rideHeight: 0,
			suspStiffness: 200,
			suspDamping: 25,
			suspMaxCompress: 0.05,
			suspMaxExtend: 0.05,
			// Bump physics (vehicle-vs-vehicle)
			bumpForceScale: 0.8,
			bumpMaxForce: 15,
			bumpMinSpeed: 2.0,
			bumpLateralBias: 0.7,
			bumpCooldown: 0.4,
			// Curb drag (edge-of-road slowdown)
			curbDragZone: 2.0,          // distance from wall where drag begins
			curbDragMax: 8.0,           // max drag multiplier (at wall face)
			curbDragClampDist: 0.5,     // below this distance, hard-clamp speed
			curbDragClampSpeed: 0.3,    // max linearSpeed when within clamp distance
			wallRepulsionForce: 3.0,    // outward push velocity when touching/near wall
		};

		// Raycast ground detection (delegated to VehicleGroundRaycast)
		this._groundRaycast = new VehicleGroundRaycast();
		// Proxy refs for updateBody/updateWheels (they read per-wheel data)
		this._wheelOffsets = this._groundRaycast._wheelOffsets;
		this._wheelRawHitY = this._groundRaycast._wheelRawHitY;
		this._wheelOnSurface = this._groundRaycast._wheelOnSurface;
		this._wheelContactY = this._groundRaycast._wheelContactY;
		this._targetNormal = this._groundRaycast._targetNormal;
		this.groundHeight = 0;
		this.groundNormal = new THREE.Vector3( 0, 1, 0 );
		this._prevGroundHeight = 0;
		this._verticalVelocity = 0;
		this._vehicleY = 0;
		this._airborneTimer = 0;
		this._launchCooldown = 0;
		this._wallHitTime = 0; // set by contact listener to suppress launches after wall bounce

		// Curb drag — wall proximity detection
		this._wallProximityLeft = 0;   // 0 = far, 1 = touching wall
		this._wallProximityRight = 0;
		this._grounded = false;

		// Boost / nitro state
		this.boostMeter = 0;
		this.boostActive = false;
		this.boostTimer = 0;

		// Drift state machine (legacy fields kept for DriftSparks, BoostFlame, Audio, Network compat)
		this.driftStage = 0;
		this.driftStageTimer = 0;
		this.miniBoostTimer = 0;
		this.miniBoostTopSpeed = 0;
		this.effectiveTopSpeed = 250;

		// Arcade drift state
		this.drivingState = DrivingState.NORMAL;
		this.driftActive = false;
		this.driftDirection = 0;
		this.driftTimer = 0;
		this.driftSparkTier = 0;
		this.driftArcAngle = 0;
		this.driftForwardDir = new THREE.Vector3();
		this.driftBoostTimer = 0;
		this.driftBoostMultiplier = 1.0;

		// JDM drift physics
		this.driftSlipAngle = 0;
		this.driftTargetSlipAngle = 0;
		this.driftYawRate = 0;
		this.driftMoveAngle = 0;
		this.driftEntrySpeed = 0;
		this.driftExitBlend = 0;
		this.driftExiting = false;
		this.driftExitTimer = 0;

		// Powerup state
		this.shieldActive = false;
		this.shieldTimer = 0;
		this.starActive = false;
		this.starTimer = 0;

	}

	init( vehicleModel, characterModel ) {

		const clonedVehicle = vehicleModel.clone();

		this.container.add( clonedVehicle );

		const allNodeNames = [];

		// Find body and wheel nodes — only assign named wheels once (top-level group)
		clonedVehicle.traverse( ( child ) => {

			const name = child.name.toLowerCase();

			allNodeNames.push( child.name );

			if ( name === 'body' ) {

				child.rotation.order = 'YXZ';
				this.bodyNode = child;

			} else if ( name === 'seat_anchor' ) {

				this.seatAnchor = child;

			} else if ( name.includes( 'steering' ) ) {

				this.steeringWheel = child;

			} else if ( name.includes( 'wheel' ) ) {

				// Only assign named wheel refs to the first (top-level) match
				if ( ! this.wheelFL && name.includes( 'front' ) && name.includes( 'left' ) ) {

					child.rotation.order = 'YXZ';
					this.wheelFL = child;

				} else if ( ! this.wheelFR && name.includes( 'front' ) && name.includes( 'right' ) ) {

					child.rotation.order = 'YXZ';
					this.wheelFR = child;

				} else if ( ! this.wheelBL && name.includes( 'back' ) && name.includes( 'left' ) ) {

					child.rotation.order = 'YXZ';
					this.wheelBL = child;

				} else if ( ! this.wheelBR && name.includes( 'back' ) && name.includes( 'right' ) ) {

					child.rotation.order = 'YXZ';
					this.wheelBR = child;

				}

			}

			if ( child.isMesh ) {

				child.castShadow = true;
				child.receiveShadow = true;

			}

		} );

		// Attach character model to seat anchor (if both exist)
		if ( characterModel && this.seatAnchor ) {

			this._attachCharacter( characterModel );

		}

		if ( ! this.bodyNode ) {

			console.warn(
				'Vehicle.init: no node named "body" found — body animations disabled. ' +
				'Nodes found: ' + allNodeNames.filter( n => n !== '' ).join( ', ' )
			);

		}

		// Store original Y for the 4 named wheel nodes (used for suspension)
		this._namedWheelOrigY = [
			this.wheelFL ? this.wheelFL.position.y : 0,
			this.wheelFR ? this.wheelFR.position.y : 0,
			this.wheelBL ? this.wheelBL.position.y : 0,
			this.wheelBR ? this.wheelBR.position.y : 0,
		];

		// ─── Underglow ────────────────────────────────────────────────────────
		this.underglowLight = new THREE.PointLight( 0x00ffff, 1, 3 );
		this.underglowLight.position.set( 0, - 0.1, 0 );
		this.underglowLight.castShadow = false;
		this.underglowLight.visible = false;
		this.container.add( this.underglowLight );

		// ─── Headlights ──────────────────────────────────────────────────────
		const hlOffsets = [ - 0.25, 0.25 ];

		for ( const xOff of hlOffsets ) {

			const spot = new THREE.SpotLight( 0xffe0b0, 8, 54, Math.PI / 8, 0.3 );
			spot.position.set( xOff, 0.25, 0.5 );
			spot.castShadow = false;
			spot.visible = false;

			const target = new THREE.Object3D();
			target.position.set( xOff, - 0.2, 2.5 );
			this.container.add( target );
			spot.target = target;

			this.container.add( spot );
			this.headlights.push( spot );

		}

		return this.container;

	}

	_attachCharacter( characterModel ) {

		this.characterModel = characterModel.clone();
		this.characterModel.traverse( ( child ) => {

			if ( child.isMesh ) {

				child.castShadow = true;
				child.receiveShadow = true;

			}

		} );
		this.seatAnchor.add( this.characterModel );

	}

	swapCharacter( newCharacterModel ) {

		if ( this.characterModel && this.seatAnchor ) {

			this.seatAnchor.remove( this.characterModel );
			this.characterModel = null;

		}

		if ( newCharacterModel && this.seatAnchor ) {

			this._attachCharacter( newCharacterModel );

		}

	}

	initRaycast( world ) {

		this._groundRaycast.init( this, world );

	}

	raycastGround( dt ) {

		this._groundRaycast.updateGround( dt, this );

	}

	raycastWallProximity() {

		this._groundRaycast.updateWallProximity( this );

	}

	// ─── Steering assist ─────────────────────────────────────────────────

	setTrackIntel( trackIntel ) {

		this._trackIntel = trackIntel;

	}

	setSteeringAssist( enabled ) {

		this._steeringAssistEnabled = enabled;

	}

	_computeSteeringAssist() {

		if ( ! this._steeringAssistEnabled || ! this._trackIntel ) return 0;
		if ( this.remote ) return 0;

		const ti = this._trackIntel;
		const pos = this.vehPos;
		const n = ti.count;
		if ( n < 3 ) return 0;

		// 1. Windowed search for nearest waypoint (hint ±2)
		let bestIdx = this._assistWaypointHint;
		let bestDist = Infinity;

		for ( let offset = - 2; offset <= 2; offset ++ ) {

			const i = ( ( bestIdx + offset ) % n + n ) % n;
			const w = ti.waypoints[ i ];
			const dx = w.x - pos.x;
			const dz = w.z - pos.z;
			const d = dx * dx + dz * dz;

			if ( d < bestDist ) {

				bestDist = d;
				bestIdx = i;

			}

		}

		this._assistWaypointHint = bestIdx;

		// 2. Look-ahead target: next waypoint only
		const wp1 = ti.waypoints[ ( bestIdx + 1 ) % n ];
		const targetX = wp1.x;
		const targetZ = wp1.z;

		// 3. Vehicle forward direction (yaw-only, XZ plane)
		// Match AI convention: forward = +Z local, rotated by container quaternion
		const q = this.container.quaternion;
		const sinY = 2 * ( q.w * q.y );
		const cosY = 1 - 2 * ( q.y * q.y );
		const fwdX = sinY;
		const fwdZ = cosY;

		const toX = targetX - pos.x;
		const toZ = targetZ - pos.z;
		const toLen = Math.sqrt( toX * toX + toZ * toZ );

		if ( toLen < 0.001 ) return 0;

		const ntX = toX / toLen;
		const ntZ = toZ / toLen;

		// 4. Cross product → positive = target is to the right
		const cross = fwdX * ntZ - fwdZ * ntX;

		// 5. Lateral distance from track center line
		const nearWp = ti.waypoints[ bestIdx ];
		const nextWp = ti.waypoints[ ( bestIdx + 1 ) % n ];
		const segDx = nextWp.x - nearWp.x;
		const segDz = nextWp.z - nearWp.z;
		const segLen = Math.sqrt( segDx * segDx + segDz * segDz );

		let lateralDist = 0;

		if ( segLen > 0.001 ) {

			const apx = pos.x - nearWp.x;
			const apz = pos.z - nearWp.z;
			lateralDist = Math.abs( apx * segDz - apz * segDx ) / segLen;

		}

		// 6. Scale by off-center distance (dead zone + quadratic ramp)
		const ROAD_HALF_WIDTH = 4.0;
		const DEAD_ZONE = 1.5;
		const MAX_ASSIST_STRENGTH = 0.3;
		const SENSITIVITY = 2.5;

		let offCenterFactor = 0;

		if ( lateralDist > DEAD_ZONE ) {

			offCenterFactor = Math.min( 1.0,
				( lateralDist - DEAD_ZONE ) / ( ROAD_HALF_WIDTH - DEAD_ZONE )
			);
			offCenterFactor *= offCenterFactor; // quadratic ramp

		}

		// 7. Final correction
		const rawCorrection = cross * SENSITIVITY;
		return Math.max( - 1, Math.min( 1, rawCorrection ) )
			* offCenterFactor
			* MAX_ASSIST_STRENGTH;

	}

	setTargetState( pos, rot, vel, angVel, speed, drift, boostActive, shield, star ) {

		this._remoteSync.setTargetState( pos, rot, vel, angVel, speed, drift, boostActive, shield, star );

	}

	getState() {

		return this._remoteSync.getState( this );

	}

	updateRemote( dt ) {

		this._remoteSync.update( dt, this );

	}

	update( dt, controlsInput ) {

		if ( this.remote ) {

			this.updateRemote( dt );
			return;

		}

		this.inputX = controlsInput.x;
		this.inputZ = controlsInput.z;

		{

			// Unified steering + throttle (keyboard, gamepad, and touch all use same model)
			let direction = Math.sign( this.linearSpeed );
			if ( direction === 0 ) direction = Math.abs( this.inputZ ) > 0.1 ? Math.sign( this.inputZ ) : 1;

			if ( this.drivingState === DrivingState.DRIFTING ) {

				// JDM drift: slip-angle-based steering with counter-steer control
				const d = this.debug;

				// Counter-steer = input OPPOSITE to drift direction (positive value)
				const counterSteerAmount = - this.inputX * this.driftDirection;

				// Entry ramp: slip angle builds quickly (weight transfer feel)
				const entryRamp = Math.min( this.driftTimer / d.driftEntryRampTime, 1.0 );

				// Adjust target slip angle based on steering input
				if ( counterSteerAmount > 0 ) {

					// Counter-steering: tighten the arc (reduce slip angle)
					this.driftTargetSlipAngle -= counterSteerAmount * d.driftCounterSteerRate * dt;

				} else {

					// With-steering or neutral: widen the arc (increase slip angle)
					this.driftTargetSlipAngle -= counterSteerAmount * d.driftWithSteerRate * dt;

				}

				// Clamp target slip angle
				this.driftTargetSlipAngle = THREE.MathUtils.clamp(
					this.driftTargetSlipAngle, d.driftSlipAngleMin, d.driftSlipAngleMax
				);

				// Natural damping: pull toward rest angle when input is weak
				const inputStrength = Math.abs( this.inputX );
				if ( inputStrength < 0.3 ) {

					const dampLerp = ( 1 - inputStrength / 0.3 ) * d.driftSlipDamping * dt;
					this.driftTargetSlipAngle = THREE.MathUtils.lerp(
						this.driftTargetSlipAngle, d.driftSlipRestAngle, dampLerp
					);

				}

				// Smooth actual slip angle toward target (modulated by entry ramp)
				// Fast lerp so the initial kick-out is punchy, not sluggish
				this.driftSlipAngle = THREE.MathUtils.lerp(
					this.driftSlipAngle,
					this.driftTargetSlipAngle * entryRamp,
					1 - Math.exp( - d.driftYawRateSmoothing * dt )
				);

				// Yaw rate: base drift ~1.0 rad/s, player input ~1.5 rad/s, total ~2.5
				const baseKick = this.driftDirection * d.driftArcSpeed * 0.22;
				const slipYaw = this.driftDirection * this.driftSlipAngle * d.driftArcSpeed * 0.12;
				const targetYawRate = baseKick + slipYaw;

				this.driftYawRate = THREE.MathUtils.lerp(
					this.driftYawRate, targetYawRate,
					1 - Math.exp( - d.driftYawRateSmoothing * dt )
				);

				// Player steering ~1.5 rad/s — tilt the arc mid-drift
				this.angularSpeed = this.driftYawRate - this.inputX * 1.5;

				// Movement direction curves with inertia (faster = wider arcs)
				const moveInertia = d.driftMoveAngleInertia / ( 1 + this.linearSpeed * d.driftSpeedArcFactor );
				const facingAngle = this._getYaw();
				const targetMoveAngle = facingAngle - this.driftDirection * this.driftSlipAngle;

				// Lerp angle with wrapping
				let angleDiff = targetMoveAngle - this.driftMoveAngle;
				angleDiff = Math.atan2( Math.sin( angleDiff ), Math.cos( angleDiff ) );
				this.driftMoveAngle += angleDiff * moveInertia * dt;

				// Sync legacy field for any external readers
				this.driftArcAngle = this.driftSlipAngle * this.driftDirection;

			} else {

				// Normal: snappy arcade steering with fast lerp (no speed-dependent grip reduction)
				let effectiveInputX = this.inputX;
				const assistCorrection = this._computeSteeringAssist();
				effectiveInputX = Math.max( - 1, Math.min( 1, effectiveInputX + assistCorrection ) );
				const targetAngular = - effectiveInputX * this.debug.steeringMultiplier * direction;
				this.angularSpeed = THREE.MathUtils.lerp( this.angularSpeed, targetAngular, dt * this.debug.steeringLerp );

			}

			this.container.rotateY( this.angularSpeed * dt );

			const targetSpeed = this.inputZ;

			if ( targetSpeed < 0 && this.linearSpeed > 0.01 ) {

				this.linearSpeed = THREE.MathUtils.lerp( this.linearSpeed, 0.0, dt * this.debug.brakeRate );
				if ( this.linearSpeed < 0.001 ) this.linearSpeed = 0;

			} else if ( targetSpeed < 0 ) {

				this.linearSpeed = THREE.MathUtils.lerp( this.linearSpeed, targetSpeed * this.debug.reverseSpeedFactor, dt * this.debug.reverseAccelRate );

			} else {

				this.linearSpeed = THREE.MathUtils.lerp( this.linearSpeed, targetSpeed, dt * this.debug.accelerationRate );

			}

		}

		this.linearSpeed *= Math.max( 0, 1 - this.debug.linearDamp * dt );

		// Momentum: builds when holding high speed (above 60%), decays otherwise
		// Full momentum takes ~25-30 seconds of sustained high speed
		if ( this.linearSpeed > 0.6 ) {

			const buildRate = 0.035 * ( 1 - this.momentum * 0.6 );
			this.momentum = Math.min( 1, this.momentum + buildRate * dt );

		} else {

			// Decay quickly when not at speed
			this.momentum = Math.max( 0, this.momentum - 0.5 * dt );

		}

		// Curb drag — progressive slowdown near walls
		this.raycastWallProximity();
		const maxProximity = Math.max( this._wallProximityLeft, this._wallProximityRight );

		if ( maxProximity > 0 ) {

			// Quadratic curve: gentle onset, harsh near wall
			const drag = maxProximity * maxProximity * this.debug.curbDragMax;
			this.linearSpeed *= Math.max( 0, 1 - drag * dt );

			// Hard speed clamp when very close to wall
			if ( maxProximity > 1 - this.debug.curbDragClampDist / this.debug.curbDragZone ) {

				this.linearSpeed = Math.min( this.linearSpeed, this.debug.curbDragClampSpeed );

			}

		}

		// Raycast ground detection
		this.raycastGround( dt );

		// Align vehicle orientation to surface normal — adaptive rate matches normal blend
		const targetQuat = this.alignWithY( this.container.quaternion, this.groundNormal );
		const quatRate = THREE.MathUtils.lerp( 5, 15, Math.min( ( 1 - this.groundNormal.y ) * 5, 1 ) );
		this.container.quaternion.slerp( targetQuat, 1 - Math.exp( - quatRate * dt ) );

		if ( this.rigidBody ) {

			// Read XZ position from physics (walls may have pushed it), but keep Y from our system
			const pos = this.rigidBody.position;
			this.vehPos.set( pos[ 0 ], this._vehicleY, pos[ 2 ] );

			const vel = this.rigidBody.motionProperties.linearVelocity;
			this.vehVel.set( vel[ 0 ], vel[ 1 ], vel[ 2 ] );

			// Use yaw-only quaternion for the collider — pitch/roll tilt would let
			// the box wedge upward against walls and ride over them.
			const yaw = Math.atan2(
				2 * ( this.container.quaternion.w * this.container.quaternion.y ),
				1 - 2 * ( this.container.quaternion.y * this.container.quaternion.y )
			);

			// Nudge away from wall when dangerously close — prevents
			// next frame's velocity blend from pushing vehicle back through
			if ( this._wallProximityLeft > 0.5 || this._wallProximityRight > 0.5 ) {

				const cosY = Math.cos( yaw );
				const sinY = Math.sin( yaw );
				const wallP = Math.max( this._wallProximityLeft, this._wallProximityRight );
				const nudge = THREE.MathUtils.lerp( 0.02, 0.05, ( wallP - 0.5 ) / 0.5 );

				if ( this._wallProximityLeft > this._wallProximityRight ) {

					// Push right (away from left wall)
					this.vehPos.x += cosY * nudge;
					this.vehPos.z -= sinY * nudge;

				} else {

					// Push left (away from right wall)
					this.vehPos.x -= cosY * nudge;
					this.vehPos.z += sinY * nudge;

				}

			}

			// Position collider above track surface geometry (curbs top out at ~0.5 world space).
			// halfHeight=0.3, so center at +0.8 keeps bottom at +0.5 (clears curbs).
			const colliderY = this._vehicleY + 0.8;
			rigidBody.setPosition( this.physicsWorld, this.rigidBody,
				[ this.vehPos.x, colliderY, this.vehPos.z ], false );

			rigidBody.setQuaternion( this.physicsWorld, this.rigidBody,
				[ 0, Math.sin( yaw / 2 ), 0, Math.cos( yaw / 2 ) ], false );

		}

		this.acceleration = THREE.MathUtils.lerp(
			this.acceleration,
			this.linearSpeed + ( 0.25 * this.linearSpeed * Math.abs( this.linearSpeed ) ),
			dt
		);

		if ( this.groundHeight < - 10 ) {

			if ( this.rigidBody ) {

				rigidBody.setPosition( this.physicsWorld, this.rigidBody, [ 3.5, 0, 5 ], false );
				rigidBody.setLinearVelocity( this.physicsWorld, this.rigidBody, [ 0, 0, 0 ] );
				rigidBody.setAngularVelocity( this.physicsWorld, this.rigidBody, [ 0, 0, 0 ] );

			}

			this.vehPos.set( 3.5, 0, 5 );
			this.vehVel.set( 0, 0, 0 );
			this._bumpVel.set( 0, 0, 0 );
			this.groundHeight = 0.5;
			this._vehicleY = 0.5;
			this._groundVelocity = 0;
			this.linearSpeed = 0;
			this.angularSpeed = 0;
			this.acceleration = 0;
			this.shieldActive = false;
			this.shieldTimer = 0;
			this.starActive = false;
			this.starTimer = 0;
			this.drivingState = DrivingState.NORMAL;
			this.driftActive = false;
			this.driftTimer = 0;
			this.driftSparkTier = 0;
			this.driftBoostTimer = 0;
			this.driftBoostMultiplier = 1.0;
			this.container.rotation.set( 0, 0, 0 );
			this.container.quaternion.identity();

		}

		// Vertical positioning: grounded spring when wheels touch, gravity when airborne
		const GRAVITY = 9.81;
		const targetY = this.groundHeight + this.debug.rideHeight;
		const recentWallHit = ( performance.now() / 1000 - this._wallHitTime ) < 0.5;

		// Wall/bump contacts force vehicle back to grounded — barriers must
		// never cause vertical lift, only ramps should launch players.
		if ( recentWallHit && ! this._grounded ) {

			this._grounded = true;
			this._verticalVelocity = 0;
			this._vehicleY = targetY;
			this._airborneTimer = 0;

		}

		// ── Surface classification from ground normal ──────────────────
		// Ramp surfaces have tilted normals (normal.y < 0.95).
		// Flat surfaces (normal.y >= 0.95) should NEVER launch the vehicle.
		const onRamp = this.groundNormal.y < 0.96;

		if ( this._grounded ) {

			// Grounded: track surface directly (median filter on groundHeight handles jitter)
			this._vehicleY = targetY;
			this._airborneTimer = 0;

			// Compute upward velocity from slope + speed for launch momentum
			_forward.set( 0, 0, 1 ).applyQuaternion( this.container.quaternion );

			if ( onRamp ) {

				// On ramp: compute launch velocity from slope angle
				this._verticalVelocity = _forward.y * Math.abs( this.linearSpeed ) *
					this.effectiveTopSpeed / this.debug.speedScale;

				// Cap so the vehicle can't fly absurdly high
				this._verticalVelocity = Math.min( this._verticalVelocity, 5.0 );

			} else {

				// On flat ground: no vertical velocity buildup
				this._verticalVelocity = 0;

			}

			// Wall contacts suppress all vertical velocity — no launches near barriers
			if ( recentWallHit ) this._verticalVelocity = 0;

			// Launch ONLY from ramp edges, never on flat ground or near walls
			const frontOffEdge = ! this._wheelOnSurface[ 0 ] && ! this._wheelOnSurface[ 1 ];
			if ( onRamp && this._verticalVelocity > 0.5 && frontOffEdge && ! recentWallHit ) {

				this._grounded = false;
				this._airborneTimer = 0;
				this._launchCooldown = 0.3;

			}

		} else {

			// Airborne: real gravity
			this._airborneTimer = ( this._airborneTimer || 0 ) + dt;
			this._verticalVelocity -= GRAVITY * dt;
			this._vehicleY += this._verticalVelocity * dt;

			// Hard ceiling: never fly more than 4 units above ground
			const MAX_AIR_HEIGHT = 4.0;
			if ( this._vehicleY > this.groundHeight + MAX_AIR_HEIGHT ) {

				this._vehicleY = this.groundHeight + MAX_AIR_HEIGHT;
				if ( this._verticalVelocity > 0 ) this._verticalVelocity = 0;

			}

			// Landing detection: hit the ground while falling
			if ( this._vehicleY <= targetY && this._verticalVelocity < 0 ) {

				this._vehicleY = targetY;
				this._verticalVelocity = 0;

			}

		}

		this.container.position.set(
			this.vehPos.x,
			this._vehicleY,
			this.vehPos.z
		);

		// ── Always-on jitter tracker — stores recent spikes for diagnosis ──
		{

			const yDelta = this._vehicleY - ( this._prevDebugY || this._vehicleY );
			const rawY = this._wheelRawHitY;
			const rawAvg = ( rawY[ 0 ] + rawY[ 1 ] + rawY[ 2 ] + rawY[ 3 ] ) / 4;

			if ( ! this._jitterLog ) this._jitterLog = [];

			// Track every frame's key values
			if ( Math.abs( yDelta ) > 0.005 ) {

				this._jitterLog.push( {
					t: performance.now(),
					vehY: this._vehicleY,
					gndH: this.groundHeight,
					rawAvg,
					delta: yDelta,
					grounded: this._grounded,
					speed: this.linearSpeed,
				} );

				// Keep last 20 spikes
				if ( this._jitterLog.length > 20 ) this._jitterLog.shift();

			}

			this._prevDebugY = this._vehicleY;

			// Expose for debug overlay
			this.debugJitterInfo = {
				lastDelta: yDelta,
				rawAvg,
				spikeCount: this._jitterLog ? this._jitterLog.length : 0,
				lastSpike: this._jitterLog && this._jitterLog.length > 0
					? this._jitterLog[ this._jitterLog.length - 1 ] : null,
			};

		}

		if ( dt > 0 ) {

			this.modelVelocity.subVectors( this.container.position, this.prevModelPos ).divideScalar( dt );
			this.prevModelPos.copy( this.container.position );

		}

		this.updateBody( dt );
		this.updateWheels( dt );

		// ── Arcade drift state machine ──���───────────────────────────────────
		switch ( this.drivingState ) {

			case DrivingState.NORMAL:
				if ( controlsInput.drift && Math.abs( this.inputX ) > 0.1
					&& Math.abs( this.linearSpeed ) > this.debug.driftMinSpeed && this._grounded ) {

					this.drivingState = DrivingState.DRIFTING;
					this.driftActive = true;
					this.driftDirection = - Math.sign( this.inputX );
					this.driftTimer = 0;
					this.driftSparkTier = 0;
					this.driftEntrySpeed = this.linearSpeed;
					this.driftExiting = false;
					this.driftExitBlend = 0;
					this.driftExitTimer = 0;

					// Capture current movement angle in world space
					this.driftMoveAngle = this._getYaw();

					// Slip angle ramps up from zero during entry
					this.driftSlipAngle = 0;
					this.driftTargetSlipAngle = this.debug.driftInitSlipAngle;
					this.driftYawRate = 0;

					// Legacy fields (keep for external systems)
					this.driftArcAngle = 0;
					this.driftForwardDir.set( 0, 0, 1 ).applyQuaternion( this.container.quaternion );
					this.driftForwardDir.y = 0;
					this.driftForwardDir.normalize();

				}
				break;

			case DrivingState.DRIFTING:
				if ( ! controlsInput.drift || Math.abs( this.linearSpeed ) < 0.01 ) {

					this._applyDriftBoost();
					this.drivingState = DrivingState.NORMAL;
					this.driftActive = false;
					this.driftSparkTier = 0;
					this.driftTimer = 0;

					// Start snap-back exit
					this.driftExiting = true;
					this.driftExitBlend = 0;
					this.driftExitTimer = 0;

				} else {

					this.driftTimer += dt;
					if ( this.driftTimer >= this.debug.driftPurpleTier ) this.driftSparkTier = 3;
					else if ( this.driftTimer >= this.debug.driftOrangeTier ) this.driftSparkTier = 2;
					else if ( this.driftTimer >= this.debug.driftBlueTier ) this.driftSparkTier = 1;

				}
				break;

		}

		// Drift exit snap-back
		if ( this.driftExiting ) {

			this.driftExitTimer += dt;
			this.driftExitBlend = 1 - Math.exp( - this.debug.driftExitSnapSharpness * this.driftExitTimer );

			// Decay slip angle and yaw rate
			this.driftSlipAngle *= Math.exp( - 8 * dt );
			this.driftYawRate *= Math.exp( - 8 * dt );

			if ( this.driftExitTimer >= this.debug.driftExitSnapDuration || this.driftExitBlend > 0.95 ) {

				this.driftExiting = false;
				this.driftExitBlend = 0;
				this.driftSlipAngle = 0;
				this.driftYawRate = 0;

			}

		}

		// Airborne state tracking (supplements above, doesn't override drift)
		if ( ! this._grounded && this.drivingState === DrivingState.NORMAL ) {

			this.drivingState = DrivingState.AIRBORNE;

		} else if ( this._grounded && this.drivingState === DrivingState.AIRBORNE ) {

			this.drivingState = DrivingState.NORMAL;

		}

		// Legacy field sync (keeps DriftSparks, BoostFlame, Audio, Network working)
		this.driftStage = this.driftSparkTier;
		// Intensity scales with slip angle for richer sparks/audio/tire marks
		if ( this.driftActive ) {

			this.driftIntensity = 0.5 + ( this.driftSlipAngle / this.debug.driftSlipAngleMax ) * 0.5 + this.driftSparkTier * 0.25;

		} else {

			this.driftIntensity = 0;

		}

		// Drift boost timer
		if ( this.driftBoostTimer > 0 ) {

			this.driftBoostTimer -= dt;

			if ( this.driftBoostTimer <= 0 ) {

				this.driftBoostTimer = 0;
				this.driftBoostMultiplier = 1.0;

			}

		}

		// Mini-boost timer (used by item box speed powerup)
		if ( this.miniBoostTimer > 0 ) {

			this.miniBoostTimer -= dt;

			if ( this.miniBoostTimer <= 0 ) {

				this.miniBoostTimer = 0;
				this.miniBoostTopSpeed = 0;

			}

		}

		// ── Powerup timers ───────────────────────────────────────────────────
		if ( this.shieldTimer > 0 ) {

			this.shieldTimer -= dt;

			if ( this.shieldTimer <= 0 ) {

				this.shieldActive = false;
				this.shieldTimer = 0;

			}

		}

		if ( this.starTimer > 0 ) {

			this.starTimer -= dt;

			if ( this.starTimer <= 0 ) {

				this.starActive = false;
				this.starTimer = 0;

			}

		}

		// ── Boost / nitro ────────────────────────────────────────────────────
		if ( this.boostActive ) {

			this.boostTimer -= dt;

			if ( this.boostTimer <= 0 ) {

				this.boostActive = false;
				this.boostTimer = 0;
				// effectiveTopSpeed handles top speed restoration — do not mutate debug.topSpeed

			}

		} else {

			// Fill meter
			let fillRate = dt / this.debug.boostFillTime;

			if ( this.driftActive ) {

				fillRate *= this.debug.boostDriftMultiplier;

			}

			// Faster nitro fill at higher drift tiers
			const stageFillMultiplier = [ 1.0, 1.0, 1.5, 2.0 ];
			fillRate *= stageFillMultiplier[ this.driftSparkTier ];

			this.boostMeter = Math.min( 1, this.boostMeter + fillRate );

			// Activate on boost input when full
			if ( controlsInput.boost && this.boostMeter >= 1.0 ) {

				this.boostActive = true;
				this.boostTimer = this.debug.boostDuration;
				this.boostMeter = 0;
				// effectiveTopSpeed handles the speed increase — do not mutate debug.topSpeed

			}

		}

		// ── Effective top speed (R13) — max of base, nitro, mini-boost ────────
		this.effectiveTopSpeed = Math.max(
			this.debug.topSpeed * ( this.externalTopSpeedMultiplier || 1 ) * ( this.draftSpeedMultiplier || 1 ),
			this.boostActive ? this.debug.boostTopSpeed : 0,
			this.driftBoostTimer > 0 ? this.debug.topSpeed * this.driftBoostMultiplier : 0,
			this.miniBoostTimer > 0 ? this.miniBoostTopSpeed : 0,
			this.starActive ? this.debug.boostTopSpeed : 0
		);

		// ── Drive force — apply velocity toward desired speed ─────────────────
		if ( this.rigidBody ) {

			// Horizontal drive direction (Y handled by raycast ground system, not drive force)
			if ( this.drivingState === DrivingState.DRIFTING || this.driftExiting ) {

				// JDM drift: movement follows smoothly curved driftMoveAngle
				_forward.set( Math.sin( this.driftMoveAngle ), 0, Math.cos( this.driftMoveAngle ) );

				// Add lateral velocity: push sideways based on slip angle
				const lateralAngle = this.driftMoveAngle + this.driftDirection * Math.PI * 0.5;
				const lateralAmount = Math.sin( this.driftSlipAngle ) * this.debug.driftLateralFraction;
				_forward.x += Math.sin( lateralAngle ) * lateralAmount;
				_forward.z += Math.cos( lateralAngle ) * lateralAmount;
				_forward.normalize();

				// During exit snap-back, blend toward vehicle facing direction
				if ( this.driftExiting ) {

					_tmpVec.set( 0, 0, 1 ).applyQuaternion( this.container.quaternion );
					_tmpVec.y = 0;
					_tmpVec.normalize();
					_forward.lerp( _tmpVec, this.driftExitBlend );
					_forward.normalize();

				}

			} else {

				_forward.set( 0, 0, 1 ).applyQuaternion( this.container.quaternion );

			}

			// Slope gravity affects speed: slows uphill, accelerates downhill
			const slopeGravity = - 9.81 * _forward.y * 0.5;

			// Project drive to horizontal plane
			_forward.y = 0;
			_forward.normalize();

			const desiredSpeed = this.linearSpeed * this.effectiveTopSpeed / this.debug.speedScale;
			const slopeAdjustedSpeed = desiredSpeed + slopeGravity;

			// Drain _bumpVel as a consumed impulse spread over several frames.
			// Each frame we apply a fraction and subtract it — no accumulation.
			const bumpApply = 1 - Math.exp( - 12 * dt );
			const bumpDeltaX = this._bumpVel.x * bumpApply;
			const bumpDeltaZ = this._bumpVel.z * bumpApply;
			this._bumpVel.x -= bumpDeltaX;
			this._bumpVel.z -= bumpDeltaZ;

			// Kill tiny residual
			if ( this._bumpVel.x * this._bumpVel.x + this._bumpVel.z * this._bumpVel.z < 0.0001 ) {

				this._bumpVel.x = 0;
				this._bumpVel.z = 0;

			}

			// Blend desired velocity with physics velocity to preserve wall collision response.
			// After wall hits, slow the blend so crashcat's deflection persists as a clean arc
			// instead of being instantly absorbed back into the forward direction.
			const recentWallContact = ( performance.now() / 1000 - this._wallHitTime ) < 0.3;
			const wallProx = Math.max( this._wallProximityLeft, this._wallProximityRight );
			let effectiveBlendRate;

			if ( recentWallContact && wallProx > 0.8 ) {

				// Very close to wall after contact — crawl blend so deflection has time to clear
				effectiveBlendRate = this.debug.velocityBlendRate * 0.1;

			} else if ( recentWallContact ) {

				effectiveBlendRate = this.debug.velocityBlendRate * 0.3;

			} else {

				effectiveBlendRate = this.debug.velocityBlendRate;

			}
			const blendRate = 1 - Math.exp( - effectiveBlendRate * dt );
			const driveX = _forward.x * slopeAdjustedSpeed;
			const driveZ = _forward.z * slopeAdjustedSpeed;

			// Wall repulsion — push vehicle away from wall when very close (not curb zone)
			let repelX = 0, repelZ = 0;
			if ( wallProx > 0.7 ) {

				const yawR = Math.atan2(
					2 * ( this.container.quaternion.w * this.container.quaternion.y ),
					1 - 2 * ( this.container.quaternion.y * this.container.quaternion.y )
				);
				const cY = Math.cos( yawR );
				const sY = Math.sin( yawR );
				// Ramps from 0 at 0.7 to full at 1.0
				const t = ( wallProx - 0.7 ) / 0.3;
				const repelStrength = t * t * this.debug.wallRepulsionForce;

				if ( this._wallProximityLeft > this._wallProximityRight ) {

					// Push right (away from left wall)
					repelX = cY * repelStrength;
					repelZ = - sY * repelStrength;

				} else {

					// Push left (away from right wall)
					repelX = - cY * repelStrength;
					repelZ = sY * repelStrength;

				}

			}

			const newVelX = this.vehVel.x + ( driveX - this.vehVel.x ) * blendRate + bumpDeltaX + repelX;
			const newVelZ = this.vehVel.z + ( driveZ - this.vehVel.z ) * blendRate + bumpDeltaZ + repelZ;

			// Always zero Y velocity — vertical position is managed entirely by raycasts,
			// never by the physics body (gravityFactor=0).
			rigidBody.setLinearVelocity( this.physicsWorld, this.rigidBody, [ newVelX, 0, newVelZ ] );
			rigidBody.setAngularVelocity( this.physicsWorld, this.rigidBody, [ 0, 0, 0 ] );

		}

	}

	_getYaw() {

		const q = this.container.quaternion;
		return Math.atan2( 2 * ( q.w * q.y + q.x * q.z ), 1 - 2 * ( q.y * q.y + q.z * q.z ) );

	}

	_applyDriftBoost() {

		const tier = this.driftSparkTier;
		if ( tier === 0 ) return;
		const d = this.debug;
		const map = [
			null,
			[ d.driftBlueBoostMult, d.driftBlueBoostDuration ],
			[ d.driftOrangeBoostMult, d.driftOrangeBoostDuration ],
			[ d.driftPurpleBoostMult, d.driftPurpleBoostDuration ],
		];
		const [ mult, dur ] = map[ tier ];
		this.driftBoostTimer = dur;
		this.driftBoostMultiplier = mult;

	}

	alignWithY( quaternion, newY ) {

		_zAxis.set( 0, 0, 1 ).applyQuaternion( quaternion );
		const xAxis = _tmpVec.crossVectors( _zAxis, newY ).negate().normalize();
		_newZ.crossVectors( xAxis, newY ).normalize();

		_mat4.makeBasis( xAxis, newY, _newZ );
		return _quat.setFromRotationMatrix( _mat4 );

	}

	updateBody( dt ) {

		if ( ! this.bodyNode ) return;

		// Suspension-driven body tilt from plane-relative deviations only
		// (absolute slope is already handled by alignWithY on the container)
		let suspPitch = 0;
		let suspRoll = 0;

		if ( this._grounded ) {

			const n = this._targetNormal;
			const rawCentroidY = ( this._wheelRawHitY[ 0 ] + this._wheelRawHitY[ 1 ] +
				this._wheelRawHitY[ 2 ] + this._wheelRawHitY[ 3 ] ) / 4;
			const devs = [ 0, 0, 0, 0 ];

			for ( let i = 0; i < 4; i ++ ) {

				const localOff = this._wheelOffsets[ i ];
				_forward.copy( localOff ).applyQuaternion( this.container.quaternion );
				const expectedY = rawCentroidY - ( n.x * _forward.x + n.z * _forward.z ) / ( n.y || 1 );
				devs[ i ] = this._wheelRawHitY[ i ] - expectedY;

			}

			// Pitch from deviation: front deviated up vs back = nose up
			suspPitch = ( ( devs[ 0 ] + devs[ 1 ] ) / 2 - ( devs[ 2 ] + devs[ 3 ] ) / 2 ) * 3.0;

			// Roll from deviation: right deviated up vs left = roll left
			suspRoll = ( ( devs[ 1 ] + devs[ 3 ] ) / 2 - ( devs[ 0 ] + devs[ 2 ] ) / 2 ) * 3.0;

		}

		// Combine acceleration lean + suspension-driven tilt
		const accelPitch = - ( this.linearSpeed - this.acceleration ) / this.debug.bodyLeanPitch;
		this.bodyNode.rotation.x = lerpAngle(
			this.bodyNode.rotation.x,
			accelPitch + suspPitch,
			dt * 10
		);

		// Combine steering lean + suspension-driven roll
		let steerRoll;
		if ( this.driftActive ) {

			// During drift: lean INTO the drift direction, modulated by slip angle
			const driftLean = this.driftDirection * ( this.driftSlipAngle / this.debug.driftSlipAngleMax );
			const inputLean = - ( this.inputX / ( this.debug.bodyLeanRoll / ( 1 + this.driftStage * 0.3 ) ) ) * this.linearSpeed;
			steerRoll = driftLean * 0.6 + inputLean * 0.4;

		} else {

			steerRoll = - ( this.inputX / ( this.debug.bodyLeanRoll / ( 1 + this.driftStage * 0.3 ) ) ) * this.linearSpeed;

		}
		this.bodyNode.rotation.z = lerpAngle(
			this.bodyNode.rotation.z,
			steerRoll + suspRoll,
			dt * 5
		);

		this.bodyNode.position.y = THREE.MathUtils.lerp( this.bodyNode.position.y, 0.2 + this.debug.bodyHeight, dt * 3 );

	}

	updateWheels( dt ) {

		// Use the 4 named wheel nodes — these are the top-level groups
		// (this.wheels from traverse may include sub-meshes, so don't use it for suspension)
		const wheelNodes = [ this.wheelFL, this.wheelFR, this.wheelBL, this.wheelBR ];

		for ( let i = 0; i < 4; i ++ ) {

			if ( ! wheelNodes[ i ] ) continue;

			// Rolling animation
			wheelNodes[ i ].rotation.x += this.acceleration;

			// Suspension offset: only for wheels still on the surface.
			// Off-edge wheels get zero offset (neutral position).
			let suspOffset = 0;

			if ( this._wheelOnSurface[ i ] ) {

				const localOff = this._wheelOffsets[ i ];
				_forward.copy( localOff ).applyQuaternion( this.container.quaternion );

				// Compute centroid from on-surface wheels only
				let onSurfaceCentroidY = 0, onSurfaceCount = 0;
				for ( let j = 0; j < 4; j ++ ) {

					if ( this._wheelOnSurface[ j ] ) {

						onSurfaceCentroidY += this._wheelRawHitY[ j ];
						onSurfaceCount ++;

					}

				}

				onSurfaceCentroidY /= ( onSurfaceCount || 1 );

				const n = this._targetNormal;
				const expectedY = onSurfaceCentroidY - ( n.x * _forward.x + n.z * _forward.z ) / ( n.y || 1 );

				suspOffset = this._wheelRawHitY[ i ] - expectedY;
				suspOffset = Math.max( - this.debug.suspMaxExtend,
					Math.min( this.debug.suspMaxCompress, suspOffset ) );

			}

			wheelNodes[ i ].position.y = this._namedWheelOrigY[ i ] + this.debug.wheelHeight + suspOffset;

		}

		// Front wheel steering — rotates the entire wheel group (tire + rim together)
		// During drift, front wheels show counter-steer angle for the JDM look
		let wheelSteerAngle;
		if ( this.driftActive ) {

			wheelSteerAngle = - this.inputX / 1.5 + this.driftDirection * this.driftSlipAngle * 0.5;
			wheelSteerAngle = THREE.MathUtils.clamp( wheelSteerAngle, - 0.8, 0.8 );

		} else {

			wheelSteerAngle = - this.inputX / 1.5;

		}

		if ( this.wheelFL ) {

			this.wheelFL.rotation.y = lerpAngle( this.wheelFL.rotation.y, wheelSteerAngle, dt * 10 );

		}

		if ( this.wheelFR ) {

			this.wheelFR.rotation.y = lerpAngle( this.wheelFR.rotation.y, wheelSteerAngle, dt * 10 );

		}

		if ( this.steeringWheel ) {

			this.steeringWheel.rotation.z = lerpAngle( this.steeringWheel.rotation.z, - wheelSteerAngle, dt * 10 );

		}

	}

	/**
	 * Factory: create a fully initialized vehicle with physics body and model.
	 * @param {object} opts
	 * @param {object} opts.world - crashcat physics world
	 * @param {Function} opts.createBody - (world, position) => rigidBody
	 * @param {object} opts.model - cloneable GLTF model
	 * @param {number[]} opts.position - [x, y, z] spawn position
	 * @param {number} opts.angle - spawn rotation Y
	 * @param {object} [opts.options] - { forceWheelCorrection }
	 * @returns {Vehicle}
	 */
	static spawn( { world, createBody, model, characterModel, position, angle, options = {} } ) {

		const vehicle = new Vehicle();
		if ( options.forceWheelCorrection ) vehicle.forceWheelCorrection = true;

		const body = createBody( world, position );
		vehicle.rigidBody = body;
		vehicle.physicsWorld = world;

		const [ sx, sy, sz ] = position;
		vehicle.vehPos.set( sx, sy, sz );
		vehicle.groundHeight = sy;
		vehicle.prevModelPos.set( sx, sy, sz );
		vehicle.container.rotation.y = angle;

		vehicle.init( model, characterModel );
		vehicle.initRaycast( world );

		return vehicle;

	}

}

import * as THREE from 'three';
import { rigidBody, castRay, createClosestCastRayCollector, createDefaultCastRaySettings, CastRayStatus, filter } from 'crashcat';

const _tmpVec = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _zAxis = new THREE.Vector3();
const _newZ = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _up = new THREE.Vector3( 0, 1, 0 );


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

		this.spherePos = new THREE.Vector3( 3.5, 0.5, 5 );
		this.sphereVel = new THREE.Vector3();

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

		this.inputX = 0;
		this.inputZ = 0;

		this.driftIntensity = 0;

		// External speed multiplier (used by AI rubber-banding)
		this.externalTopSpeedMultiplier = 1.0;
		this.draftSpeedMultiplier = 1.0;

		// Set true before init() to force wheel orientation correction regardless of bounding box
		this.forceWheelCorrection = false;

		this.underglowLight = null;
		this.headlights = [];

		// Remote player state
		this.remote = false;
		this._targetPos = null;
		this._targetQuat = new THREE.Quaternion();
		this._targetVel = [ 0, 0, 0 ];
		this._targetAngVel = [ 0, 0, 0 ];
		this._targetSpeed = 0;
		this._targetDrift = 0;
		this._renderPos = new THREE.Vector3();
		this._renderQuat = new THREE.Quaternion();
		this._remoteInitialized = false;

		this.debug = {
			lockX: false,
			lockY: false,
			lockZ: false,
			wheelHeight: 0,
			bodyHeight: 0.2,
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
			// Drift state machine (implements R10-R15 from gameplay-juice-pass-plan)
			driftStageThreshold: 0.3,
			stage0Duration: 0.15,
			stage1Duration: 1.0,
			stage2Duration: 1.5,
			miniBoostStage2Speed: 300,
			miniBoostStage3Speed: 325,
			miniBoostStage2Duration: 1.5,
			miniBoostStage3Duration: 2.0,
			// Body lean
			bodyLeanPitch: 6,
			bodyLeanRoll: 5,
			// Suspension
			rideHeight: 0,
		};
		this.wheelOrigY = [];

		// Raycast ground detection
		this.groundHeight = 0;
		this.groundNormal = new THREE.Vector3( 0, 1, 0 );
		this._targetNormal = new THREE.Vector3( 0, 1, 0 );
		this._prevGroundHeight = 0;
		this._rayCollector = null;
		this._raySettings = null;
		this._rayFilter = null;
		this._grounded = false;

		// Wheel ray offsets in local space (read from model in init, fallback defaults)
		this._wheelOffsets = [
			new THREE.Vector3( - 0.35, 0, 0.55 ),  // FL
			new THREE.Vector3( 0.35, 0, 0.55 ),     // FR
			new THREE.Vector3( - 0.35, 0, - 0.55 ), // BL
			new THREE.Vector3( 0.35, 0, - 0.55 ),   // BR
		];
		this._wheelGroundHeights = [ 0, 0, 0, 0 ];

		// Boost / nitro state
		this.boostMeter = 0;
		this.boostActive = false;
		this.boostTimer = 0;

		// Drift state machine (implements R10-R15 from gameplay-juice-pass-plan)
		this.driftStage = 0;
		this.driftStageTimer = 0;
		this.miniBoostTimer = 0;
		this.miniBoostTopSpeed = 0;
		this.effectiveTopSpeed = 250;

		// Powerup state
		this.shieldActive = false;
		this.shieldTimer = 0;
		this.starActive = false;
		this.starTimer = 0;

	}

	init( model ) {

		const vehicleModel = model.clone();

		this.container.add( vehicleModel );

		const allNodeNames = [];

		// Find body and wheel nodes
		vehicleModel.traverse( ( child ) => {

			const name = child.name.toLowerCase();

			allNodeNames.push( child.name );

			if ( name === 'body' ) {

				child.rotation.order = 'YXZ';
				this.bodyNode = child;

			} else if ( name.includes( 'wheel' ) && ! name.includes( 'steering' ) ) {

				child.rotation.order = 'YXZ';
				this.wheels.push( child );

				if ( name.includes( 'front' ) && name.includes( 'left' ) ) this.wheelFL = child;
				if ( name.includes( 'front' ) && name.includes( 'right' ) ) this.wheelFR = child;
				if ( name.includes( 'back' ) && name.includes( 'left' ) ) this.wheelBL = child;
				if ( name.includes( 'back' ) && name.includes( 'right' ) ) this.wheelBR = child;

			}

			if ( child.isMesh ) {

				child.castShadow = true;
				child.receiveShadow = true;

			}

		} );

		if ( ! this.bodyNode ) {

			console.warn(
				'Vehicle.init: no node named "body" found — body animations disabled. ' +
				'Nodes found: ' + allNodeNames.filter( n => n !== '' ).join( ', ' )
			);

		}

		this.wheelOrigY = this.wheels.map( ( w ) => w.position.y );

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

	initRaycast( world ) {

		this._rayCollector = createClosestCastRayCollector();
		this._raySettings = createDefaultCastRaySettings();

		// Only ray against static bodies (track surface, walls, ground plane)
		// Exclude OL_MOVING so the ray doesn't hit the vehicle's own sphere
		this._rayFilter = filter.forWorld( world );
		filter.disableObjectLayer( this._rayFilter, world.settings.layers, world._OL_MOVING );

		this._prevGroundHeight = this.groundHeight;

		// Read actual wheel X/Z offsets from model nodes if available
		const wheelNodes = [ this.wheelFL, this.wheelFR, this.wheelBL, this.wheelBR ];

		for ( let i = 0; i < 4; i ++ ) {

			if ( wheelNodes[ i ] ) {

				this._wheelOffsets[ i ].x = wheelNodes[ i ].position.x;
				this._wheelOffsets[ i ].z = wheelNodes[ i ].position.z;

			}

		}

	}

	raycastGround( dt ) {

		if ( ! this._rayCollector || ! this.physicsWorld ) return;

		const RAY_LENGTH = 5.0;
		const origin = [ 0, 0, 0 ];
		const direction = [ 0, - 1, 0 ];

		let totalHeight = 0;
		let hitCount = 0;

		for ( let i = 0; i < 4; i ++ ) {

			// Transform wheel offset to world space
			const localOff = this._wheelOffsets[ i ];
			_forward.copy( localOff ).applyQuaternion( this.container.quaternion );

			origin[ 0 ] = this.spherePos.x + _forward.x;
			// Cast from above the current ground height — adapts to elevation changes
			origin[ 1 ] = Math.max( this.spherePos.y, this.groundHeight ) + 3.0;
			origin[ 2 ] = this.spherePos.z + _forward.z;

			// Reset collector fully for reuse
			this._rayCollector.hit.status = CastRayStatus.NOT_COLLIDING;
			this._rayCollector.hit.fraction = 1;
			this._rayCollector.earlyOutFraction = 1;

			castRay( this.physicsWorld, this._rayCollector, this._raySettings, origin, direction, RAY_LENGTH, this._rayFilter );

			if ( this._rayCollector.hit.status === CastRayStatus.COLLIDING ) {

				const hitDist = this._rayCollector.hit.fraction * RAY_LENGTH;
				const hitY = origin[ 1 ] - hitDist;

				this._wheelGroundHeights[ i ] = hitY;
				totalHeight += hitY;
				hitCount ++;

			} else {

				// No ground hit — use previous height
				this._wheelGroundHeights[ i ] = this.groundHeight;

			}

		}

		if ( hitCount > 0 ) {

			this._grounded = true;
			this._missedFrames = 0;

			const targetHeight = totalHeight / hitCount;

			// Simple lerp — stable, no oscillation
			this.groundHeight = THREE.MathUtils.lerp( this.groundHeight, targetHeight, 1 - Math.exp( - 15 * dt ) );

			// Compute surface normal from wheel contact points
			const fl = this._wheelGroundHeights[ 0 ];
			const fr = this._wheelGroundHeights[ 1 ];
			const bl = this._wheelGroundHeights[ 2 ];
			const br = this._wheelGroundHeights[ 3 ];

			const frontAvg = ( fl + fr ) / 2;
			const backAvg = ( bl + br ) / 2;
			const wheelbase = Math.abs( this._wheelOffsets[ 0 ].z - this._wheelOffsets[ 2 ].z ) || 1;

			const leftAvg = ( fl + bl ) / 2;
			const rightAvg = ( fr + br ) / 2;
			const track = Math.abs( this._wheelOffsets[ 0 ].x - this._wheelOffsets[ 1 ].x ) || 1;

			const slopeForward = ( frontAvg - backAvg ) / wheelbase;
			const slopeLateral = ( rightAvg - leftAvg ) / track;

			this._targetNormal.set( - slopeLateral, 1, - slopeForward ).normalize();

		} else {

			// Hold ground height for a few frames before entering airborne
			// This prevents single-frame ray misses from causing stuttering
			this._missedFrames = ( this._missedFrames || 0 ) + 1;

			if ( this._missedFrames > 5 ) {

				this._grounded = false;
				this._targetNormal.set( 0, 1, 0 );
				this.groundHeight -= 5.0 * dt;

			}
			// Otherwise keep _grounded true and hold last groundHeight

		}

		// Smooth normal blending
		this.groundNormal.lerp( this._targetNormal, 1 - Math.exp( - 8 * dt ) );
		this.groundNormal.normalize();

	}

	setTargetState( pos, rot, vel, angVel, speed, drift, boostActive, shield, star ) {

		this._targetPos = pos;
		this._targetQuat.set( rot[ 0 ], rot[ 1 ], rot[ 2 ], rot[ 3 ] );
		this._targetVel = vel;
		this._targetAngVel = angVel;
		this._targetSpeed = speed;
		this._targetDrift = drift;
		this._targetBoostActive = boostActive;
		this._targetShieldActive = shield;
		this._targetStarActive = star;

	}

	getState() {

		const angVel = this.rigidBody ? [ ...this.rigidBody.motionProperties.angularVelocity ] : [ 0, 0, 0 ];

		return {
			pos: [ this.spherePos.x, this.spherePos.y, this.spherePos.z ],
			rot: [ this.container.quaternion.x, this.container.quaternion.y, this.container.quaternion.z, this.container.quaternion.w ],
			vel: [ this.sphereVel.x, this.sphereVel.y, this.sphereVel.z ],
			angVel,
			speed: this.linearSpeed,
			drift: this.driftIntensity,
			boost: this.boostActive,
			shield: this.shieldActive,
			star: this.starActive,
		};

	}

	updateRemote( dt ) {

		if ( ! this._targetPos || ! this.rigidBody ) return;

		// On first target, snap to position instead of interpolating
		if ( ! this._remoteInitialized ) {

			this._renderPos.set( this._targetPos[ 0 ], this._targetPos[ 1 ], this._targetPos[ 2 ] );
			this._renderQuat.copy( this._targetQuat );
			this._remoteInitialized = true;

		}

		// Dead-reckon: advance render position using target velocity
		this._renderPos.x += this._targetVel[ 0 ] * dt;
		this._renderPos.y += this._targetVel[ 1 ] * dt;
		this._renderPos.z += this._targetVel[ 2 ] * dt;

		// Smooth correction toward latest server position (dt-independent)
		const correctionSpeed = 8; // higher = snappier, lower = smoother
		const t = 1 - Math.exp( - correctionSpeed * dt );

		this._renderPos.x += ( this._targetPos[ 0 ] - this._renderPos.x ) * t;
		this._renderPos.y += ( this._targetPos[ 1 ] - this._renderPos.y ) * t;
		this._renderPos.z += ( this._targetPos[ 2 ] - this._renderPos.z ) * t;

		this._renderQuat.slerp( this._targetQuat, t );

		// Update physics body for collisions (snap, don't fight the sim)
		rigidBody.setPosition( this.physicsWorld, this.rigidBody,
			[ this._renderPos.x, this._renderPos.y, this._renderPos.z ], false );
		rigidBody.setLinearVelocity( this.physicsWorld, this.rigidBody, this._targetVel );
		rigidBody.setAngularVelocity( this.physicsWorld, this.rigidBody, [ 0, 0, 0 ] );

		// Update visual position (decouple from physics readback)
		this.spherePos.copy( this._renderPos );
		this.sphereVel.set( this._targetVel[ 0 ], this._targetVel[ 1 ], this._targetVel[ 2 ] );

		this.container.position.set(
			this._renderPos.x,
			this._renderPos.y + this.debug.underbodyOffset,
			this._renderPos.z
		);
		this.container.quaternion.copy( this._renderQuat );

		// Drive animations from received state
		this.linearSpeed = THREE.MathUtils.lerp( this.linearSpeed, this._targetSpeed, t );
		this.driftIntensity = THREE.MathUtils.lerp( this.driftIntensity, this._targetDrift, t );
		this.acceleration = this.linearSpeed;

		// Derive synthetic drift stage from interpolated driftIntensity for remote visuals
		if ( this.driftIntensity >= 2.5 ) this.driftStage = 3;
		else if ( this.driftIntensity >= 1.5 ) this.driftStage = 2;
		else if ( this.driftIntensity >= ( this.debug.driftStageThreshold || 0.5 ) ) this.driftStage = 1;
		else this.driftStage = 0;

		// Sync remote boost and powerup state
		this.boostActive = this._targetBoostActive || false;
		this.shieldActive = this._targetShieldActive || false;
		this.starActive = this._targetStarActive || false;

		this.updateBody( dt );
		this.updateWheels( dt );

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

			const steeringGrip = THREE.MathUtils.clamp( Math.abs( this.linearSpeed ), this.debug.steeringGripMin, this.debug.steeringGripMax );

			const targetAngular = - this.inputX * steeringGrip * this.debug.steeringMultiplier * direction;
			this.angularSpeed = THREE.MathUtils.lerp( this.angularSpeed, targetAngular, dt * this.debug.steeringLerp );

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

		// Raycast ground detection
		this.raycastGround( dt );

		// Align vehicle orientation to surface normal
		const targetQuat = this.alignWithY( this.container.quaternion, this.groundNormal );
		this.container.quaternion.slerp( targetQuat, 1 - Math.exp( - 8 * dt ) );

		if ( this.rigidBody ) {

			// Read position after last physics step (walls may have pushed it)
			const pos = this.rigidBody.position;
			this.spherePos.set( pos[ 0 ], pos[ 1 ], pos[ 2 ] );

			const vel = this.rigidBody.motionProperties.linearVelocity;
			this.sphereVel.set( vel[ 0 ], vel[ 1 ], vel[ 2 ] );

			// Keep collider tracking vehicle — Y above ground, rotation matching heading
			rigidBody.setPosition( this.physicsWorld, this.rigidBody,
				[ this.spherePos.x, this.groundHeight + this.debug.rideHeight + 0.5, this.spherePos.z ], false );
			const q = this.container.quaternion;
			rigidBody.setQuaternion( this.physicsWorld, this.rigidBody,
				[ q.x, q.y, q.z, q.w ], false );

		}

		this.acceleration = THREE.MathUtils.lerp(
			this.acceleration,
			this.linearSpeed + ( 0.25 * this.linearSpeed * Math.abs( this.linearSpeed ) ),
			dt
		);

		if ( this.groundHeight < - 10 ) {

			if ( this.rigidBody ) {

				rigidBody.setPosition( this.physicsWorld, this.rigidBody, [ 3.5, 0.5, 5 ], false );
				rigidBody.setLinearVelocity( this.physicsWorld, this.rigidBody, [ 0, 0, 0 ] );
				rigidBody.setAngularVelocity( this.physicsWorld, this.rigidBody, [ 0, 0, 0 ] );

			}

			this.spherePos.set( 3.5, 0.5, 5 );
			this.sphereVel.set( 0, 0, 0 );
			this.groundHeight = 0.5;
			this._groundVelocity = 0;
			this.linearSpeed = 0;
			this.angularSpeed = 0;
			this.acceleration = 0;
			this.shieldActive = false;
			this.shieldTimer = 0;
			this.starActive = false;
			this.starTimer = 0;
			this.container.rotation.set( 0, 0, 0 );
			this.container.quaternion.identity();

		}

		this.container.position.set(
			this.spherePos.x,
			this.groundHeight + this.debug.rideHeight,
			this.spherePos.z
		);

		if ( dt > 0 ) {

			this.modelVelocity.subVectors( this.container.position, this.prevModelPos ).divideScalar( dt );
			this.prevModelPos.copy( this.container.position );

		}

		this.updateBody( dt );
		this.updateWheels( dt );

		this.driftIntensity = Math.abs( this.linearSpeed - this.acceleration ) +
			( this.bodyNode ? Math.abs( this.bodyNode.rotation.z ) * 2 : 0 );

		// ── Drift state machine (R10-R13 from gameplay-juice-pass-plan) ────────
		const stageDurations = [
			this.debug.stage0Duration,
			this.debug.stage1Duration,
			this.debug.stage2Duration,
			Infinity,
		];

		if ( this.driftIntensity >= this.debug.driftStageThreshold ) {

			this.driftStageTimer += dt;

			if ( this.driftStage < 3 && this.driftStageTimer >= stageDurations[ this.driftStage ] ) {

				this.driftStage ++;
				this.driftStageTimer = 0;

			}

		} else if ( this.driftStage > 0 ) {

			// Drift release — grant mini-boost if Stage 2+
			if ( this.driftStage >= 2 ) {

				this.miniBoostTopSpeed = this.driftStage === 3
					? this.debug.miniBoostStage3Speed
					: this.debug.miniBoostStage2Speed;
				this.miniBoostTimer = this.driftStage === 3
					? this.debug.miniBoostStage3Duration
					: this.debug.miniBoostStage2Duration;

			}

			this.driftStage = 0;
			this.driftStageTimer = 0;

		}

		// Mini-boost timer
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

			if ( this.driftIntensity > this.debug.driftThreshold ) {

				fillRate *= this.debug.boostDriftMultiplier;

			}

			// R14: faster nitro fill at higher drift stages
			const stageFillMultiplier = [ 1.0, 1.0, 1.5, 2.0 ];
			fillRate *= stageFillMultiplier[ this.driftStage ];

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
			this.miniBoostTimer > 0 ? this.miniBoostTopSpeed : 0,
			this.starActive ? this.debug.boostTopSpeed : 0
		);

		// ── Drive force — apply velocity toward desired speed ─────────────────
		if ( this.rigidBody ) {

			// Compute desired forward velocity using effectiveTopSpeed
			_forward.set( 0, 0, 1 ).applyQuaternion( this.container.quaternion );
			_forward.y = 0;
			_forward.normalize();

			// topSpeed was an angular accumulation rate in the old system;
			// divide by speedScale to get a sensible linear velocity (~12 units/sec max)
			const desiredSpeed = this.linearSpeed * this.effectiveTopSpeed / this.debug.speedScale;

			// Blend desired velocity with physics velocity to preserve wall collision response
			const blendRate = 1 - Math.exp( - this.debug.velocityBlendRate * dt );
			const newVelX = this.sphereVel.x + ( _forward.x * desiredSpeed - this.sphereVel.x ) * blendRate;
			const newVelZ = this.sphereVel.z + ( _forward.z * desiredSpeed - this.sphereVel.z ) * blendRate;

			rigidBody.setLinearVelocity( this.physicsWorld, this.rigidBody, [ newVelX, this.sphereVel.y, newVelZ ] );
			rigidBody.setAngularVelocity( this.physicsWorld, this.rigidBody, [ 0, 0, 0 ] );

		}

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

		this.bodyNode.rotation.x = lerpAngle(
			this.bodyNode.rotation.x,
			-( this.linearSpeed - this.acceleration ) / this.debug.bodyLeanPitch,
			dt * 10
		);

		// R15: body lean roll scales with drift stage for more aggressive cornering feel
		this.bodyNode.rotation.z = lerpAngle(
			this.bodyNode.rotation.z,
			-( this.inputX / ( this.debug.bodyLeanRoll / ( 1 + this.driftStage * 0.3 ) ) ) * this.linearSpeed,
			dt * 5
		);

		this.bodyNode.position.y = THREE.MathUtils.lerp( this.bodyNode.position.y, 0.2 + this.debug.bodyHeight, dt * 5 );

	}

	updateWheels( dt ) {

		for ( let i = 0; i < this.wheels.length; i ++ ) {

			const wheel = this.wheels[ i ];

			wheel.rotation.x += this.acceleration;

			wheel.position.y = ( this.wheelOrigY[ i ] || 0 ) + this.debug.wheelHeight;

		}

		if ( this.wheelFL ) {

			this.wheelFL.rotation.y = lerpAngle( this.wheelFL.rotation.y, - this.inputX / 1.5, dt * 10 );

		}

		if ( this.wheelFR ) {

			this.wheelFR.rotation.y = lerpAngle( this.wheelFR.rotation.y, - this.inputX / 1.5, dt * 10 );

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
	static spawn( { world, createBody, model, position, angle, options = {} } ) {

		const vehicle = new Vehicle();
		if ( options.forceWheelCorrection ) vehicle.forceWheelCorrection = true;

		const body = createBody( world, position );
		vehicle.rigidBody = body;
		vehicle.physicsWorld = world;

		const [ sx, sy, sz ] = position;
		vehicle.spherePos.set( sx, sy, sz );
		vehicle.groundHeight = sy;
		vehicle.prevModelPos.set( sx, sy, sz );
		vehicle.container.rotation.y = angle;

		vehicle.init( model );
		vehicle.initRaycast( world );

		return vehicle;

	}

}

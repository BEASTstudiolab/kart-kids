import * as THREE from 'three';
import { rigidBody, castRay, createClosestCastRayCollector, createDefaultCastRaySettings, CastRayStatus, filter } from 'crashcat';
import { SpringAnimator } from './SpringAnimator.js';

const _tmpVec = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _zAxis = new THREE.Vector3();
const _newZ = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _edge1 = new THREE.Vector3();
const _edge2 = new THREE.Vector3();


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
			suspStiffness: 200,
			suspDamping: 25,
			suspMaxCompress: 0.05,
			suspMaxExtend: 0.05,
		};
		this.wheelOrigY = [];

		// Raycast ground detection
		this.groundHeight = 0;
		this.groundNormal = new THREE.Vector3( 0, 1, 0 );
		this._targetNormal = new THREE.Vector3( 0, 1, 0 );
		this._prevGroundHeight = 0;
		this._verticalVelocity = 0;
		this._vehicleY = 0;
		this._airborneTimer = 0;
		this._launchCooldown = 0;
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
		this._wheelOnSurface = [ true, true, true, true ];

		// Per-wheel spring suspension
		this._wheelSprings = [
			new SpringAnimator( 200, 25 ),  // FL
			new SpringAnimator( 200, 25 ),  // FR
			new SpringAnimator( 200, 25 ),  // BL
			new SpringAnimator( 200, 25 ),  // BR
		];
		this._wheelContactY = [ 0, 0, 0, 0 ];
		this._wheelRawHitY = [ 0, 0, 0, 0 ];
		this._wheelMissedFrames = [ 0, 0, 0, 0 ];

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

		// Find body and wheel nodes — only assign named wheels once (top-level group)
		vehicleModel.traverse( ( child ) => {

			const name = child.name.toLowerCase();

			allNodeNames.push( child.name );

			if ( name === 'body' ) {

				child.rotation.order = 'YXZ';
				this.bodyNode = child;

			} else if ( name.includes( 'wheel' ) && ! name.includes( 'steering' ) ) {

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

		if ( ! this.bodyNode ) {

			console.warn(
				'Vehicle.init: no node named "body" found — body animations disabled. ' +
				'Nodes found: ' + allNodeNames.filter( n => n !== '' ).join( ', ' )
			);

		}

		this.wheelOrigY = this.wheels.map( ( w ) => w.position.y );

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

	initRaycast( world ) {

		this._rayCollector = createClosestCastRayCollector();
		this._raySettings = createDefaultCastRaySettings();

		// Only ray against static bodies (track surface, walls, ground plane)
		// Exclude OL_MOVING so the ray doesn't hit the vehicle's own sphere
		this._rayFilter = filter.forWorld( world );
		filter.disableObjectLayer( this._rayFilter, world.settings.layers, world._OL_MOVING );

		this._prevGroundHeight = this.groundHeight;
		this._vehicleY = this.groundHeight;
		this._verticalVelocity = 0;

		// Initialize springs to current ground height so they don't start at 0
		for ( let i = 0; i < 4; i ++ ) {

			this._wheelSprings[ i ].reset( this.groundHeight );
			this._wheelContactY[ i ] = this.groundHeight;

		}

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

		const RAY_LENGTH = 10.0;
		const origin = [ 0, 0, 0 ];
		const direction = [ 0, - 1, 0 ];

		// Sync spring params from debug (allows real-time tuning)
		for ( let i = 0; i < 4; i ++ ) {

			this._wheelSprings[ i ].k = this.debug.suspStiffness;
			this._wheelSprings[ i ].d = this.debug.suspDamping;

		}

		let anyHit = false;

		// Store world XZ per wheel for proper normal computation
		const wheelWorldX = [ 0, 0, 0, 0 ];
		const wheelWorldZ = [ 0, 0, 0, 0 ];

		for ( let i = 0; i < 4; i ++ ) {

			// Transform wheel offset to world space
			const localOff = this._wheelOffsets[ i ];
			_forward.copy( localOff ).applyQuaternion( this.container.quaternion );

			origin[ 0 ] = this.spherePos.x + _forward.x;
			// Cast from above the highest known position — prevents sinking cascade
			// when wheels go off tile edges, but stays low enough to avoid ceiling hits
			origin[ 1 ] = Math.max( this._vehicleY, this.groundHeight ) + 2.0;
			origin[ 2 ] = this.spherePos.z + _forward.z;

			wheelWorldX[ i ] = origin[ 0 ];
			wheelWorldZ[ i ] = origin[ 2 ];

			// Reset collector fully for reuse
			this._rayCollector.hit.status = CastRayStatus.NOT_COLLIDING;
			this._rayCollector.hit.fraction = 1;
			this._rayCollector.earlyOutFraction = 1;

			castRay( this.physicsWorld, this._rayCollector, this._raySettings, origin, direction, RAY_LENGTH, this._rayFilter );

			if ( this._rayCollector.hit.status === CastRayStatus.COLLIDING ) {

				const hitDist = this._rayCollector.hit.fraction * RAY_LENGTH;
				const hitY = origin[ 1 ] - hitDist;

				// Reject ceiling hits — accept any surface below the ray origin
				// (previous threshold of _vehicleY+1.0 rejected steep ramps at speed)
				if ( hitY <= origin[ 1 ] ) {

					this._wheelGroundHeights[ i ] = hitY;
					this._wheelRawHitY[ i ] = hitY;
					this._wheelSprings[ i ].setTarget( hitY );
					this._wheelMissedFrames[ i ] = 0;
					anyHit = true;

				} else {

					// Ceiling hit — treat as miss
					this._wheelMissedFrames[ i ] ++;
					if ( this._wheelMissedFrames[ i ] > 3 ) {

						this._wheelSprings[ i ].setTarget( this._wheelSprings[ i ].target - 9.81 * dt );

					}

				}

			} else {

				// Per-wheel miss handling: hold for 3 frames, then descend
				this._wheelMissedFrames[ i ] ++;

				if ( this._wheelMissedFrames[ i ] > 3 ) {

					// Wheel is airborne — descend target with gravity
					this._wheelSprings[ i ].setTarget( this._wheelSprings[ i ].target - 9.81 * dt );

				}
				// Otherwise hold last target (covers tile-boundary seams)

			}

			// Update spring to get damped contact Y
			this._wheelContactY[ i ] = this._wheelSprings[ i ].update( dt );

		}

		if ( anyHit ) {

			// Only re-ground when falling and near the surface — prevents mid-air snap
			if ( this._launchCooldown > 0 ) {

				const aboveSurface = this._vehicleY - this.groundHeight;
				const frontBackOnSurface = this._wheelOnSurface[ 0 ] || this._wheelOnSurface[ 1 ];
				if ( aboveSurface < 0 || ( frontBackOnSurface && aboveSurface < 0.5 ) || ( this._verticalVelocity < 0 && aboveSurface < 0.5 ) ) {

					this._grounded = true;
					this._launchCooldown = 0;

				} else {

					this._grounded = false;

				}

			} else {

				this._grounded = true;

			}

			// Compute centroid, excluding wheels that went off-edge.
			// Use the current ground plane to predict where each wheel SHOULD be.
			// Wheels that deviate below the prediction are off the surface.
			const EDGE_THRESHOLD = 0.4;
			const n = this.groundNormal;
			let cx = 0, cy = 0, cz = 0, hitWheelCount = 0;

			for ( let i = 0; i < 4; i ++ ) {

				this._wheelOnSurface[ i ] = false;

				if ( this._wheelMissedFrames[ i ] !== 0 ) continue;

				// Predicted height at this wheel from the previous frame's ground plane
				const localOff = this._wheelOffsets[ i ];
				_forward.copy( localOff ).applyQuaternion( this.container.quaternion );
				const predictedY = this.groundHeight - ( n.x * _forward.x + n.z * _forward.z ) / ( n.y || 1 );

				// Accept if hit is near the prediction (on the same surface)
				if ( this._wheelRawHitY[ i ] > predictedY - EDGE_THRESHOLD ) {

					cx += wheelWorldX[ i ];
					cy += this._wheelRawHitY[ i ];
					cz += wheelWorldZ[ i ];
					hitWheelCount ++;
					this._wheelOnSurface[ i ] = true;

				}

			}

			// Fallback: if all hits were rejected, use the highest pair
			if ( hitWheelCount === 0 ) {

				let maxY = - Infinity;
				for ( let i = 0; i < 4; i ++ ) {

					if ( this._wheelMissedFrames[ i ] === 0 && this._wheelRawHitY[ i ] > maxY ) {

						maxY = this._wheelRawHitY[ i ];

					}

				}

				for ( let i = 0; i < 4; i ++ ) {

					if ( this._wheelMissedFrames[ i ] === 0 && this._wheelRawHitY[ i ] > maxY - 0.5 ) {

						cx += wheelWorldX[ i ];
						cy += this._wheelRawHitY[ i ];
						cz += wheelWorldZ[ i ];
						hitWheelCount ++;

					}

				}

			}

			cx /= hitWheelCount;
			cy /= hitWheelCount;
			cz /= hitWheelCount;

			// Project body center onto the plane defined by included-wheel centroid + normal.
			// This correctly positions the body even when only back (or front) wheels are on surface.
			const dx = this.spherePos.x - cx;
			const dz = this.spherePos.z - cz;
			const rawGround = cy - ( n.x * dx + n.z * dz ) / ( n.y || 1 );

			// Direct tracking — dirLight target fix eliminates the bounce root cause
			this.groundHeight = rawGround;

			// Fit plane using 2 triangles (FL-FR-BL + FR-BR-BL) for all-4-wheel normal
			_edge1.set(
				wheelWorldX[ 1 ] - wheelWorldX[ 0 ],
				this._wheelRawHitY[ 1 ] - this._wheelRawHitY[ 0 ],
				wheelWorldZ[ 1 ] - wheelWorldZ[ 0 ]
			);
			_edge2.set(
				wheelWorldX[ 2 ] - wheelWorldX[ 0 ],
				this._wheelRawHitY[ 2 ] - this._wheelRawHitY[ 0 ],
				wheelWorldZ[ 2 ] - wheelWorldZ[ 0 ]
			);

			// First triangle normal (FL-FR-BL)
			const n1x = _edge1.y * _edge2.z - _edge1.z * _edge2.y;
			const n1y = _edge1.z * _edge2.x - _edge1.x * _edge2.z;
			const n1z = _edge1.x * _edge2.y - _edge1.y * _edge2.x;

			// Second triangle (FR-BR-BL)
			_edge1.set(
				wheelWorldX[ 3 ] - wheelWorldX[ 1 ],
				this._wheelRawHitY[ 3 ] - this._wheelRawHitY[ 1 ],
				wheelWorldZ[ 3 ] - wheelWorldZ[ 1 ]
			);
			_edge2.set(
				wheelWorldX[ 2 ] - wheelWorldX[ 1 ],
				this._wheelRawHitY[ 2 ] - this._wheelRawHitY[ 1 ],
				wheelWorldZ[ 2 ] - wheelWorldZ[ 1 ]
			);

			// Average both triangle normals for all-4-wheel fit
			this._targetNormal.set(
				n1x + _edge1.y * _edge2.z - _edge1.z * _edge2.y,
				n1y + _edge1.z * _edge2.x - _edge1.x * _edge2.z,
				n1z + _edge1.x * _edge2.y - _edge1.y * _edge2.x
			).normalize();

			// Ensure normal points upward
			if ( this._targetNormal.y < 0 ) this._targetNormal.negate();

		} else {

			// All 4 wheels missed — check if fully airborne
			const allMissed = this._wheelMissedFrames[ 0 ] > 3 &&
				this._wheelMissedFrames[ 1 ] > 3 &&
				this._wheelMissedFrames[ 2 ] > 3 &&
				this._wheelMissedFrames[ 3 ] > 3;

			if ( allMissed ) {

				this._grounded = false;

				// Gradual nose-down pitch while airborne — mimics real kart weight distribution
				const airTime = this._airborneTimer || 0;
				const pitchAmount = Math.min( airTime * 0.3, 0.4 );  // ramps up over time, caps at ~22°
				_forward.set( 0, 0, 1 ).applyQuaternion( this.container.quaternion );
				_forward.y = 0;
				_forward.normalize();
				this._targetNormal.set( _forward.x * pitchAmount, 1, _forward.z * pitchAmount ).normalize();

				this.groundHeight -= 9.81 * dt;

			}

		}

		// Adaptive normal blend: slow on flat ground (suppresses triangle noise),
		// fast on slopes (responsive to ramps)
		const slopeAmount = 1 - this._targetNormal.y;  // 0 on flat, ~0.3 on ramp
		const normalRate = THREE.MathUtils.lerp( 5, 15, Math.min( slopeAmount * 5, 1 ) );
		this.groundNormal.lerp( this._targetNormal, 1 - Math.exp( - normalRate * dt ) );
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

		// Align vehicle orientation to surface normal — adaptive rate matches normal blend
		const targetQuat = this.alignWithY( this.container.quaternion, this.groundNormal );
		const quatRate = THREE.MathUtils.lerp( 5, 15, Math.min( ( 1 - this.groundNormal.y ) * 5, 1 ) );
		this.container.quaternion.slerp( targetQuat, 1 - Math.exp( - quatRate * dt ) );

		if ( this.rigidBody ) {

			// Read XZ position from physics (walls may have pushed it), but keep Y from our system
			const pos = this.rigidBody.position;
			this.spherePos.set( pos[ 0 ], this._vehicleY, pos[ 2 ] );

			const vel = this.rigidBody.motionProperties.linearVelocity;
			this.sphereVel.set( vel[ 0 ], vel[ 1 ], vel[ 2 ] );

			// Keep collider above surface — high enough to avoid ramp mesh collisions
			// (physics body only handles wall/barrier collisions, not ground contact)
			rigidBody.setPosition( this.physicsWorld, this.rigidBody,
				[ this.spherePos.x, this._vehicleY + 1.0, this.spherePos.z ], false );
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
			this._vehicleY = 0.5;
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

		// Vertical positioning: grounded spring when wheels touch, gravity when airborne
		const GRAVITY = 9.81;
		const targetY = this.groundHeight + this.debug.rideHeight;

		if ( this._grounded ) {

			// Grounded: track surface directly (median filter on groundHeight handles jitter)
			this._vehicleY = targetY;
			this._airborneTimer = 0;

			// Compute upward velocity from slope + speed for launch momentum
			_forward.set( 0, 0, 1 ).applyQuaternion( this.container.quaternion );
			this._verticalVelocity = _forward.y * Math.abs( this.linearSpeed ) *
				this.effectiveTopSpeed / this.debug.speedScale;

			// Launch when front wheels go off the ramp edge and vehicle has upward momentum.
			// Uses wheel edge-detection instead of groundDelta (which was noise-sensitive).
			const frontOffEdge = ! this._wheelOnSurface[ 0 ] && ! this._wheelOnSurface[ 1 ];
			if ( this._verticalVelocity > 0.5 && frontOffEdge ) {

				this._grounded = false;
				this._airborneTimer = 0;
				this._launchCooldown = 0.3;

			}

		} else {

			// Airborne: real gravity
			this._airborneTimer = ( this._airborneTimer || 0 ) + dt;
			this._verticalVelocity -= GRAVITY * dt;
			this._vehicleY += this._verticalVelocity * dt;

			// Landing detection: hit the ground while falling
			if ( this._vehicleY <= targetY && this._verticalVelocity < 0 ) {

				this._vehicleY = targetY;
				this._verticalVelocity = 0;

			}

		}

		this.container.position.set(
			this.spherePos.x,
			this._vehicleY,
			this.spherePos.z
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

			// Horizontal drive direction (Y handled by raycast ground system, not drive force)
			_forward.set( 0, 0, 1 ).applyQuaternion( this.container.quaternion );

			// Slope gravity affects speed: slows uphill, accelerates downhill
			const slopeGravity = - 9.81 * _forward.y * 0.5;

			// Project drive to horizontal plane
			_forward.y = 0;
			_forward.normalize();

			const desiredSpeed = this.linearSpeed * this.effectiveTopSpeed / this.debug.speedScale;
			const slopeAdjustedSpeed = desiredSpeed + slopeGravity;

			// Blend desired velocity with physics velocity to preserve wall collision response
			const blendRate = 1 - Math.exp( - this.debug.velocityBlendRate * dt );
			const newVelX = this.sphereVel.x + ( _forward.x * slopeAdjustedSpeed - this.sphereVel.x ) * blendRate;
			const newVelZ = this.sphereVel.z + ( _forward.z * slopeAdjustedSpeed - this.sphereVel.z ) * blendRate;

			// Zero Y velocity when grounded — vertical position is managed by raycasts, not physics
			rigidBody.setLinearVelocity( this.physicsWorld, this.rigidBody, [ newVelX, this._grounded ? 0 : this.sphereVel.y, newVelZ ] );
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
		const steerRoll = - ( this.inputX / ( this.debug.bodyLeanRoll / ( 1 + this.driftStage * 0.3 ) ) ) * this.linearSpeed;
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

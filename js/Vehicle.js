import * as THREE from 'three';
import { rigidBody } from 'crashcat';

const _tmpVec = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _zAxis = new THREE.Vector3();
const _newZ = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _up = new THREE.Vector3( 0, 1, 0 );

const SPEED_SCALE = 12.5;
const LINEAR_DAMP = 0.1;

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
			topSpeed: 150,
		};
		this.wheelOrigY = [];

		// Boost / nitro state
		this.boostMeter = 0;
		this.boostActive = false;
		this.boostTimer = 0;
		this.boostFillTime = 20;       // seconds to fill passively
		this.boostDriftMultiplier = 5;  // 5x fill rate while drifting
		this.boostDuration = 4;        // seconds boost lasts
		this.boostTopSpeed = 300;      // top speed during boost
		this.driftThreshold = 1.0;     // driftIntensity threshold for "drifting"
		this._normalTopSpeed = 150;

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
		this.underglowLight.visible = false;
		this.container.add( this.underglowLight );

		// ─── Headlights ──────────────────────────────────────────────────────
		const hlOffsets = [ - 0.25, 0.25 ];

		for ( const xOff of hlOffsets ) {

			const spot = new THREE.SpotLight( 0xffe0b0, 8, 54, Math.PI / 8, 0.3 );
			spot.position.set( xOff, 0.25, 0.5 );
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

	setTargetState( pos, rot, vel, angVel, speed, drift ) {

		this._targetPos = pos;
		this._targetQuat.set( rot[ 0 ], rot[ 1 ], rot[ 2 ], rot[ 3 ] );
		this._targetVel = vel;
		this._targetAngVel = angVel;
		this._targetSpeed = speed;
		this._targetDrift = drift;

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

		if ( controlsInput.touchActive && ( this.inputX !== 0 || this.inputZ !== 0 ) ) {

			// Touch: joystick defines world-space direction, auto-gas
			const targetAngle = Math.atan2( this.inputX, this.inputZ );
			_quat.setFromAxisAngle( _up, targetAngle );
			this.container.quaternion.slerp( _quat, 1 - Math.exp( - 3 * dt ) );

			_forward.set( 0, 0, 1 ).applyQuaternion( this.container.quaternion );
			const cross = _forward.x * this.inputZ - _forward.z * this.inputX;
			this.inputX = - cross * 2;

			this.linearSpeed = THREE.MathUtils.lerp( this.linearSpeed, 1, dt * 6 );

		} else {

			// Keyboard / gamepad: standard steering + throttle
			let direction = Math.sign( this.linearSpeed );
			if ( direction === 0 ) direction = Math.abs( this.inputZ ) > 0.1 ? Math.sign( this.inputZ ) : 1;

			const steeringGrip = THREE.MathUtils.clamp( Math.abs( this.linearSpeed ), 0.2, 1.0 );

			const targetAngular = - this.inputX * steeringGrip * 4 * direction;
			this.angularSpeed = THREE.MathUtils.lerp( this.angularSpeed, targetAngular, dt * 4 );

			this.container.rotateY( this.angularSpeed * dt );

			const targetSpeed = this.inputZ;

			if ( targetSpeed < 0 && this.linearSpeed > 0.01 ) {

				this.linearSpeed = THREE.MathUtils.lerp( this.linearSpeed, 0.0, dt * 8 );

			} else if ( targetSpeed < 0 ) {

				this.linearSpeed = THREE.MathUtils.lerp( this.linearSpeed, targetSpeed / 2, dt * 2 );

			} else {

				this.linearSpeed = THREE.MathUtils.lerp( this.linearSpeed, targetSpeed, dt * this.debug.accelerationRate );

			}

		}

		_tmpVec.set( 0, 1, 0 ).applyQuaternion( this.container.quaternion );

		if ( _tmpVec.y > 0.5 ) {

			const targetQuat = this.alignWithY( this.container.quaternion, _up );
			this.container.quaternion.slerp( targetQuat, 0.2 );

		}

		this.linearSpeed *= Math.max( 0, 1 - LINEAR_DAMP * dt );

		if ( this.rigidBody ) {

			_forward.set( 0, 0, 1 ).applyQuaternion( this.container.quaternion );
			_forward.y = 0;
			_forward.normalize();

			_right.set( 1, 0, 0 ).applyQuaternion( this.container.quaternion );
			_right.y = 0;
			_right.normalize();

			const angvel = this.rigidBody.motionProperties.angularVelocity;
			const drive = this.linearSpeed * this.debug.topSpeed * dt;

			rigidBody.setAngularVelocity( this.physicsWorld, this.rigidBody, [
				angvel[ 0 ] + _right.x * drive,
				angvel[ 1 ],
				angvel[ 2 ] + _right.z * drive
			] );

			const pos = this.rigidBody.position;
			this.spherePos.set( pos[ 0 ], pos[ 1 ], pos[ 2 ] );

			const vel = this.rigidBody.motionProperties.linearVelocity;
			this.sphereVel.set( vel[ 0 ], vel[ 1 ], vel[ 2 ] );

		}

		this.acceleration = THREE.MathUtils.lerp(
			this.acceleration,
			this.linearSpeed + ( 0.25 * this.linearSpeed * Math.abs( this.linearSpeed ) ),
			dt
		);

		if ( this.spherePos.y < - 10 ) {

			if ( this.rigidBody ) {

				rigidBody.setPosition( this.physicsWorld, this.rigidBody, [ 3.5, 0.5, 5 ], false );
				rigidBody.setLinearVelocity( this.physicsWorld, this.rigidBody, [ 0, 0, 0 ] );
				rigidBody.setAngularVelocity( this.physicsWorld, this.rigidBody, [ 0, 0, 0 ] );

			}

			this.spherePos.set( 3.5, 0.5, 5 );
			this.sphereVel.set( 0, 0, 0 );
			this.linearSpeed = 0;
			this.angularSpeed = 0;
			this.acceleration = 0;
			this.container.rotation.set( 0, 0, 0 );
			this.container.quaternion.identity();

		}

		this.container.position.set(
			this.spherePos.x,
			this.spherePos.y + this.debug.underbodyOffset,
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

		// ── Boost / nitro ────────────────────────────────────────────────────
		if ( this.boostActive ) {

			this.boostTimer -= dt;
			this.debug.topSpeed = this.boostTopSpeed;

			if ( this.boostTimer <= 0 ) {

				this.boostActive = false;
				this.boostTimer = 0;
				this.debug.topSpeed = this._normalTopSpeed;

			}

		} else {

			// Fill meter
			let fillRate = dt / this.boostFillTime;

			if ( this.driftIntensity > this.driftThreshold ) {

				fillRate *= this.boostDriftMultiplier;

			}

			this.boostMeter = Math.min( 1, this.boostMeter + fillRate );

			// Activate on boost input when full
			if ( controlsInput.boost && this.boostMeter >= 1.0 ) {

				this.boostActive = true;
				this.boostTimer = this.boostDuration;
				this.boostMeter = 0;
				this.debug.topSpeed = this.boostTopSpeed;

			}

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
			-( this.linearSpeed - this.acceleration ) / 6,
			dt * 10
		);

		this.bodyNode.rotation.z = lerpAngle(
			this.bodyNode.rotation.z,
			-( this.inputX / 5 ) * this.linearSpeed,
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

}

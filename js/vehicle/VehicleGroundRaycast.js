import * as THREE from 'three';
import { castRay, createClosestCastRayCollector, createDefaultCastRaySettings, CastRayStatus, filter } from 'crashcat';
import { SpringAnimator } from '../SpringAnimator.js';


// Reusable temp vectors (avoid per-frame allocation)
const _forward = new THREE.Vector3();
const _edge1 = new THREE.Vector3();
const _edge2 = new THREE.Vector3();

// Surface classification enum
export const SurfaceType = {
	FLAT: 0,
	RAMP_UP: 1,
	RAMP_DOWN: 2,
	RAMP_EXIT: 3,
};

export function createSingleLayerRayFilter( world, objectLayer ) {

	const rayFilter = filter.forWorld( world );
	const layerCount = world?.settings?.layers?.objectLayers ?? 0;

	for ( let layer = 0; layer < layerCount; layer ++ ) {

		if ( layer === objectLayer ) continue;
		filter.disableObjectLayer( rayFilter, world.settings.layers, layer );

	}

	return rayFilter;

}


export class VehicleGroundRaycast {

	constructor() {

		this._rayCollector = null;
		this._raySettings = null;
		this._groundRayFilter = null;
		this._wallRayFilter = null;

		// Wheel ray offsets in local space (read from model in init, fallback defaults)
		this._wheelOffsets = [
			new THREE.Vector3( - 0.35, 0, 0.55 ),  // FL
			new THREE.Vector3( 0.35, 0, 0.55 ),     // FR
			new THREE.Vector3( - 0.35, 0, - 0.55 ), // BL
			new THREE.Vector3( 0.35, 0, - 0.55 ),   // BR
		];
		this._wheelGroundHeights = [ 0, 0, 0, 0 ];
		this._wheelOnSurface = [ true, true, true, true ];
		this._wheelWorldX = [ 0, 0, 0, 0 ];
		this._wheelWorldZ = [ 0, 0, 0, 0 ];

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

		this._targetNormal = new THREE.Vector3( 0, 1, 0 );

		// Surface classification
		this.surfaceType = SurfaceType.FLAT;
		this._prevNormalY = 1.0;   // previous frame's ground normal Y
		this._prevFrontOnSurface = true; // previous frame's front-wheel contact

	}

	/**
	 * Initialise raycast state. Call after vehicle.init().
	 * @param {object} v - The Vehicle instance
	 * @param {object} world - crashcat physics world
	 */
	init( v, world ) {

		this._rayCollector = createClosestCastRayCollector();
		this._raySettings = createDefaultCastRaySettings();

		const supportLayer = world._OL_TRACK_SUPPORT ?? world._OL_STATIC;
		const blockerLayer = world._OL_TRACK_BLOCKER ?? world._OL_STATIC;

		this._groundRayFilter = createSingleLayerRayFilter( world, supportLayer );

		this._wallRayFilter = createSingleLayerRayFilter( world, blockerLayer );

		v._prevGroundHeight = v.groundHeight;
		v._vehicleY = v.groundHeight;
		v._verticalVelocity = 0;

		// Initialize springs to current ground height so they don't start at 0
		for ( let i = 0; i < 4; i ++ ) {

			this._wheelSprings[ i ].reset( v.groundHeight );
			this._wheelContactY[ i ] = v.groundHeight;

		}

		// Read actual wheel X/Z offsets from model nodes if available
		const wheelNodes = [ v.wheelFL, v.wheelFR, v.wheelBL, v.wheelBR ];

		for ( let i = 0; i < 4; i ++ ) {

			if ( wheelNodes[ i ] ) {

				this._wheelOffsets[ i ].x = wheelNodes[ i ].position.x;
				this._wheelOffsets[ i ].z = wheelNodes[ i ].position.z;

			}

		}

	}

	/**
	 * Per-frame 4-wheel ground raycast.
	 * Writes: v.groundHeight, v.groundNormal
	 * @param {number} dt
	 * @param {object} v - The Vehicle instance
	 */
	updateGround( dt, v ) {

		if ( ! this._rayCollector || ! v.physicsWorld ) return;

		const RAY_LENGTH = 10.0;
		const origin = [ 0, 0, 0 ];
		const direction = [ 0, - 1, 0 ];

		// Sync spring params from debug (allows real-time tuning)
		for ( let i = 0; i < 4; i ++ ) {

			this._wheelSprings[ i ].k = v.debug.suspStiffness;
			this._wheelSprings[ i ].d = v.debug.suspDamping;

		}

		let anyHit = false;

		// Store world XZ per wheel for proper normal computation
		const wheelWorldX = this._wheelWorldX;
		const wheelWorldZ = this._wheelWorldZ;

		for ( let i = 0; i < 4; i ++ ) {

			// Transform wheel offset to world space
			const localOff = this._wheelOffsets[ i ];
			_forward.copy( localOff ).applyQuaternion( v.container.quaternion );

			origin[ 0 ] = v.vehPos.x + _forward.x;
			// Cast from above the highest known position — prevents sinking cascade
			// when wheels go off tile edges, but stays low enough to avoid ceiling hits
			origin[ 1 ] = Math.max( v._vehicleY, v.groundHeight ) + 2.0;
			origin[ 2 ] = v.vehPos.z + _forward.z;

			wheelWorldX[ i ] = origin[ 0 ];
			wheelWorldZ[ i ] = origin[ 2 ];

			// Reset collector fully for reuse
			this._rayCollector.hit.status = CastRayStatus.NOT_COLLIDING;
			this._rayCollector.hit.fraction = 1;
			this._rayCollector.earlyOutFraction = 1;

			castRay( v.physicsWorld, this._rayCollector, this._raySettings, origin, direction, RAY_LENGTH, this._groundRayFilter );

			if ( this._rayCollector.hit.status === CastRayStatus.COLLIDING ) {

				const hitDist = this._rayCollector.hit.fraction * RAY_LENGTH;
				const hitY = origin[ 1 ] - hitDist;

				// Reject ceiling hits — accept any surface below the ray origin
				const isAboveOrigin = hitY > origin[ 1 ];

				// Reject wall-top hits: when near a wall, discard hits that are
				// significantly above the known ground — those are wall collider tops,
				// not road surface.
				const nearWall = Math.max( v._wallProximityLeft, v._wallProximityRight ) > 0.3;
				const isWallTop = nearWall && ( hitY > v.groundHeight + 0.3 );

				if ( ! isAboveOrigin && ! isWallTop ) {

					this._wheelGroundHeights[ i ] = hitY;
					this._wheelRawHitY[ i ] = hitY;
					this._wheelSprings[ i ].setTarget( hitY );
					this._wheelMissedFrames[ i ] = 0;
					anyHit = true;

				} else {

					// Ceiling or wall-top hit — treat as miss
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

			// Compute centroid, excluding wheels that went off-edge.
			const EDGE_THRESHOLD = 0.4;
			const n = v.groundNormal;
			let cx = 0, cy = 0, cz = 0, hitWheelCount = 0;

			for ( let i = 0; i < 4; i ++ ) {

				this._wheelOnSurface[ i ] = false;

				if ( this._wheelMissedFrames[ i ] !== 0 ) continue;

				// Predicted height at this wheel from the previous frame's ground plane
				const localOff = this._wheelOffsets[ i ];
				_forward.copy( localOff ).applyQuaternion( v.container.quaternion );
				const predictedY = v.groundHeight - ( n.x * _forward.x + n.z * _forward.z ) / ( n.y || 1 );

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
			const dx = v.vehPos.x - cx;
			const dz = v.vehPos.z - cz;
			const rawGround = cy - ( n.x * dx + n.z * dz ) / ( n.y || 1 );

			// Direct tracking
			v.groundHeight = rawGround;

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

				// Gradual nose-down pitch while airborne
				const airTime = v._airborneTimer || 0;
				const pitchAmount = Math.min( airTime * 0.3, 0.4 );
				_forward.set( 0, 0, 1 ).applyQuaternion( v.container.quaternion );
				_forward.y = 0;
				_forward.normalize();
				this._targetNormal.set( _forward.x * pitchAmount, 1, _forward.z * pitchAmount ).normalize();

				v.groundHeight -= 9.81 * dt;

			}

		}

		const frontOnSurface = this._wheelOnSurface[ 0 ] || this._wheelOnSurface[ 1 ];
		const rearOnSurface = this._wheelOnSurface[ 2 ] || this._wheelOnSurface[ 3 ];
		const allMissed = this._wheelMissedFrames[ 0 ] > 3 &&
			this._wheelMissedFrames[ 1 ] > 3 &&
			this._wheelMissedFrames[ 2 ] > 3 &&
			this._wheelMissedFrames[ 3 ] > 3;

		// Adaptive normal blend: snappier entering banks, slower leaving
		const slopeAmount = 1 - this._targetNormal.y;
		const prevSlopeAmount = 1 - v.groundNormal.y;
		const enteringBank = slopeAmount > prevSlopeAmount;
		const normalRate = enteringBank
			? THREE.MathUtils.lerp( 8, 20, Math.min( slopeAmount * 5, 1 ) )
			: THREE.MathUtils.lerp( 4, 10, Math.min( slopeAmount * 5, 1 ) );
		v.groundNormal.lerp( this._targetNormal, 1 - Math.exp( - normalRate * dt ) );
		v.groundNormal.normalize();

		// ── Surface classification ────────────────────────────────
		const ny = v.groundNormal.y;
		const isRamp = ny < 0.96;
		const wasRamp = this._prevNormalY < 0.96;
		const frontOn = this._wheelOnSurface[ 0 ] || this._wheelOnSurface[ 1 ];
		const rearOn = this._wheelOnSurface[ 2 ] || this._wheelOnSurface[ 3 ];

		if ( ! isRamp ) {

			// Check for ramp exit: was on ramp last frame, now on flat,
			// AND front wheels have left surface while rear wheels still on
			if ( wasRamp && rearOn && ! frontOn ) {

				this.surfaceType = SurfaceType.RAMP_EXIT;

			} else {

				this.surfaceType = SurfaceType.FLAT;

			}

		} else {

			// On a ramp — determine direction from forward dot product with normal
			_forward.set( 0, 0, 1 ).applyQuaternion( v.container.quaternion );

			if ( _forward.y > 0.05 ) {

				this.surfaceType = SurfaceType.RAMP_UP;

			} else if ( _forward.y < - 0.05 ) {

				this.surfaceType = SurfaceType.RAMP_DOWN;

			} else {

				// Very shallow ramp — treat as ramp up (conservative)
				this.surfaceType = SurfaceType.RAMP_UP;

			}

		}

		this._prevNormalY = ny;
		this._prevFrontOnSurface = frontOn;

		return {
			hasSupport: anyHit,
			allMissed,
			frontOnSurface,
			rearOnSurface,
			aboveSurface: v._vehicleY - v.groundHeight,
		};

	}

	/**
	 * Wall-proximity rays for curb drag and wall-top rejection.
	 * Writes: v._wallProximityLeft, v._wallProximityRight
	 * @param {object} v - The Vehicle instance
	 */
	updateWallProximity( v ) {

		if ( ! this._rayCollector || ! v.physicsWorld ) return;

		const ZONE = v.debug.curbDragZone;
		const origin = [ v.vehPos.x, v._vehicleY + 0.8, v.vehPos.z ];

		// Yaw-only directions (match collider frame, not tilted container)
		const yaw = Math.atan2(
			2 * ( v.container.quaternion.w * v.container.quaternion.y ),
			1 - 2 * ( v.container.quaternion.y * v.container.quaternion.y )
		);
		const cosY = Math.cos( yaw );
		const sinY = Math.sin( yaw );

		// Local axes in world space (yaw-only)
		const leftX = - cosY, leftZ = sinY;
		const rightX = cosY, rightZ = - sinY;
		const fwdX = sinY, fwdZ = cosY;

		// Diagonal normalization factor
		const D = 0.7071; // 1/sqrt(2)

		// 6 directions: left, right, forward, backward, front-left, front-right
		const dirs = [
			[ leftX, 0, leftZ ],                                          // 0: left
			[ rightX, 0, rightZ ],                                        // 1: right
			[ fwdX, 0, fwdZ ],                                            // 2: forward
			[ - fwdX, 0, - fwdZ ],                                        // 3: backward
			[ ( leftX + fwdX ) * D, 0, ( leftZ + fwdZ ) * D ],            // 4: front-left
			[ ( rightX + fwdX ) * D, 0, ( rightZ + fwdZ ) * D ],          // 5: front-right
		];

		for ( let i = 0; i < dirs.length; i ++ ) {

			this._rayCollector.hit.status = CastRayStatus.NOT_COLLIDING;
			this._rayCollector.hit.fraction = 1;
			this._rayCollector.earlyOutFraction = 1;

			castRay( v.physicsWorld, this._rayCollector, this._raySettings,
				origin, dirs[ i ], ZONE, this._wallRayFilter );

			let proximity = 0;

			if ( this._rayCollector.hit.status === CastRayStatus.COLLIDING ) {

				const dist = this._rayCollector.hit.fraction * ZONE;
				proximity = 1 - ( dist / ZONE );

			}

			// Store directional values for curb drag (left/right only)
			if ( i === 0 ) v._wallProximityLeft = proximity;
			else if ( i === 1 ) v._wallProximityRight = proximity;

		}

	}

}

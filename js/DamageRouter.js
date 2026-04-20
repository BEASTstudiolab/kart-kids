/**
 * DamageRouter — Maps impact direction vectors to vehicle quadrants.
 *
 * Uses the angle between the impact direction and the defender's local space
 * to determine which quadrant (FL, FR, RL, RR) takes primary damage.
 */

import * as THREE from 'three';
import { QUADRANT } from './vehicle/VehicleHealth.js';

const _dir = new THREE.Vector3();
const _localDir = new THREE.Vector3();
const _invQuat = new THREE.Quaternion();

/**
 * Determine which quadrant of the defender was hit.
 *
 * @param {THREE.Vector3} attackerPos - world position of attacker/impact source
 * @param {object} defenderVehicle - Vehicle instance (needs vehPos, container.quaternion)
 * @returns {number} QUADRANT enum value
 */
export function resolveQuadrant( attackerPos, defenderVehicle ) {

	// Direction from defender to attacker (where the hit came FROM)
	_dir.set(
		attackerPos.x - defenderVehicle.vehPos.x,
		0,
		attackerPos.z - defenderVehicle.vehPos.z
	);

	if ( _dir.lengthSq() < 0.0001 ) return QUADRANT.FL; // fallback

	_dir.normalize();

	// Transform to defender's local space
	_invQuat.copy( defenderVehicle.container.quaternion ).invert();
	_localDir.copy( _dir ).applyQuaternion( _invQuat );

	return resolveQuadrantFromLocal( _localDir );

}

/**
 * Determine quadrant from a direction already in vehicle local space.
 *
 * Local space: +Z = forward, +X = right
 *   Front-Left:  Z > 0, X < 0  (angle 0 to PI/2)
 *   Front-Right: Z > 0, X >= 0  (angle -PI/2 to 0)
 *   Rear-Left:   Z <= 0, X < 0  (angle PI/2 to PI)
 *   Rear-Right:  Z <= 0, X >= 0  (angle -PI to -PI/2)
 *
 * @param {THREE.Vector3} localDir - normalized direction in vehicle local space
 * @returns {number} QUADRANT enum value
 */
function resolveQuadrantFromLocal( localDir ) {

	const isFront = localDir.z > 0;
	const isLeft = localDir.x < 0;

	if ( isFront ) return isLeft ? QUADRANT.FL : QUADRANT.FR;
	return isLeft ? QUADRANT.RL : QUADRANT.RR;

}

/**
 * Classify impact type for frontal/rear distribution.
 *
 * @param {THREE.Vector3} attackerPos
 * @param {object} defenderVehicle
 * @returns {'direct'|'frontal'|'rear'} damage distribution type
 */
export function classifyImpactType( attackerPos, defenderVehicle ) {

	_dir.set(
		attackerPos.x - defenderVehicle.vehPos.x,
		0,
		attackerPos.z - defenderVehicle.vehPos.z
	);

	if ( _dir.lengthSq() < 0.0001 ) return 'direct';

	_dir.normalize();
	_invQuat.copy( defenderVehicle.container.quaternion ).invert();
	_localDir.copy( _dir ).applyQuaternion( _invQuat );

	// Head-on or rear hit: if the hit is mostly along the Z axis
	const absX = Math.abs( _localDir.x );
	const absZ = Math.abs( _localDir.z );

	// If clearly from front or rear (more Z than X), use frontal/rear distribution
	if ( absZ > absX * 1.5 ) {

		return _localDir.z > 0 ? 'frontal' : 'rear';

	}

	return 'direct';

}

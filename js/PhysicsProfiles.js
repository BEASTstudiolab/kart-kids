// PhysicsProfiles.js — per-track physics parameter overrides
//
// Each profile is a set of multipliers applied to Vehicle.debug defaults.
// Values are multipliers: 1.0 = no change, 0.5 = halved, 2.0 = doubled.

export const PHYSICS_PROFILES = {

	arcade: {
		name: 'Arcade',
		description: 'Default handling',
	},

	ice: {
		name: 'Ice',
		description: 'Low grip, extreme sliding',
		topSpeed: 0.85,
		accelerationRate: 0.7,
		steeringMultiplier: 0.5,
		steeringGripMin: 0.05,
		steeringGripMax: 0.4,
		linearDamp: 0.03,
		brakeRate: 0.4,
		driftThreshold: 0.3,
	},

	moon: {
		name: 'Moon',
		description: 'Low gravity, floaty jumps',
		topSpeed: 0.75,
		accelerationRate: 0.6,
		linearDamp: 0.04,
		steeringMultiplier: 0.8,
	},

	turbo: {
		name: 'Turbo',
		description: 'High speed, twitchy controls',
		topSpeed: 1.5,
		accelerationRate: 1.8,
		steeringMultiplier: 1.3,
		brakeRate: 1.5,
		boostTopSpeed: 1.3,
	},

};

export const DEFAULT_PROFILE = 'arcade';

/**
 * Apply a physics profile to a vehicle's debug parameters.
 * Multipliers are applied to the vehicle's current values.
 * @param {object} vehicle - Vehicle instance
 * @param {string} profileName - Key from PHYSICS_PROFILES
 */
export function applyPhysicsProfile( vehicle, profileName ) {

	const profile = PHYSICS_PROFILES[ profileName ];
	if ( ! profile || profileName === 'arcade' ) return;

	const d = vehicle.debug;

	if ( profile.topSpeed ) d.topSpeed *= profile.topSpeed;
	if ( profile.accelerationRate ) d.accelerationRate *= profile.accelerationRate;
	if ( profile.steeringMultiplier ) d.steeringMultiplier *= profile.steeringMultiplier;
	if ( profile.steeringGripMin ) d.steeringGripMin = profile.steeringGripMin;
	if ( profile.steeringGripMax ) d.steeringGripMax = profile.steeringGripMax;
	if ( profile.linearDamp ) d.linearDamp = profile.linearDamp;
	if ( profile.brakeRate ) d.brakeRate *= profile.brakeRate;
	if ( profile.driftThreshold ) d.driftThreshold = profile.driftThreshold;
	if ( profile.boostTopSpeed ) d.boostTopSpeed *= profile.boostTopSpeed;

}

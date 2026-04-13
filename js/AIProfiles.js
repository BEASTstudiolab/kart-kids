// AIProfiles.js — AI personality profile definitions

// Default profile matches the current AIController constant values
export const DEFAULT_PROFILE = {
	name: 'Default',
	steerSensitivity: 3.5,
	noiseAmplitude: 0.03,
	turnThrottleDot: 0.7,
	turnThrottleMin: 0.3,
	lookAheadBlend: 0.7,     // weight toward far wp. 0.7 = 30% near / 70% far
	lookAheadNear: 3,        // near look-ahead waypoint offset (sub-tile dense waypoints)
	lookAheadFar: 5,         // far look-ahead waypoint offset
	lateralOffset: 0.0,      // world units, positive = right of center
	straightLaneOffset: 0.0,
	cornerEntryWidth: 0.85,
	cornerApexTightness: 0.5,
	cornerSpeedFactor: 0.95,
	boostEagerness: true,    // true = fire immediately when full, false = hold for straights
	stuckTime: 2.0,
	reverseTime: 1.5,
	weight: 5,               // bump physics weight (1-10)
};

export const AI_PROFILES = [

	{
		name: 'Aggressive',
		steerSensitivity: 4.5,
		noiseAmplitude: 0.05,
		turnThrottleDot: 0.85,
		turnThrottleMin: 0.5,
		lookAheadBlend: 0.5,
		lookAheadNear: 2,       // reacts quickly — closer look-ahead
		lookAheadFar: 4,
		lateralOffset: - 0.8,   // cuts inside
		straightLaneOffset: 0.0,
		cornerEntryWidth: 0.75,
		cornerApexTightness: 0.70,
		cornerSpeedFactor: 1.05,
		boostEagerness: true,
		stuckTime: 1.5,
		reverseTime: 1.0,
		weight: 7,
	},

	{
		name: 'Cautious',
		steerSensitivity: 2.8,
		noiseAmplitude: 0.02,
		turnThrottleDot: 0.5,
		turnThrottleMin: 0.2,
		lookAheadBlend: 0.85,
		lookAheadNear: 4,       // plans ahead — further look-ahead
		lookAheadFar: 7,
		lateralOffset: 0.6,     // stays wide
		straightLaneOffset: 0.2,
		cornerEntryWidth: 0.95,
		cornerApexTightness: 0.35,
		cornerSpeedFactor: 0.88,
		boostEagerness: true,
		stuckTime: 2.5,
		reverseTime: 2.0,
		weight: 4,
	},

	{
		name: 'Drifter',
		steerSensitivity: 3.2,
		noiseAmplitude: 0.08,
		turnThrottleDot: 0.8,
		turnThrottleMin: 0.55,
		lookAheadBlend: 0.6,
		lateralOffset: 1.0,     // wide entry for drift
		straightLaneOffset: 0.35,
		cornerEntryWidth: 1.00,
		cornerApexTightness: 0.55,
		cornerSpeedFactor: 0.92,
		boostEagerness: true,
		stuckTime: 2.0,
		reverseTime: 1.5,
		weight: 5,
	},

	{
		name: 'Strategist',
		steerSensitivity: 3.8,
		noiseAmplitude: 0.01,
		turnThrottleDot: 0.65,
		turnThrottleMin: 0.25,
		lookAheadBlend: 0.75,
		lateralOffset: 0.0,
		straightLaneOffset: 0.0,
		cornerEntryWidth: 0.85,
		cornerApexTightness: 0.45,
		cornerSpeedFactor: 0.98,
		boostEagerness: false,  // holds boost for straights (dot > 0.9)
		stuckTime: 2.0,
		reverseTime: 1.5,
		weight: 6,
	},

];

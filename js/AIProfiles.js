// AIProfiles.js — AI personality profile definitions

// Default profile matches the current AIController constant values
export const DEFAULT_PROFILE = {
	name: 'Default',
	steerSensitivity: 3.5,
	noiseAmplitude: 0.03,
	turnThrottleDot: 0.7,
	turnThrottleMin: 0.3,
	lookAheadBlend: 0.7,     // weight toward wp+2 (far-ahead). 0.7 = 30% wp+1 / 70% wp+2
	lateralOffset: 0.0,      // world units, positive = right of center
	boostEagerness: true,    // true = fire immediately when full, false = hold for straights
	stuckTime: 2.0,
	reverseTime: 1.5,
};

export const AI_PROFILES = [

	{
		name: 'Aggressive',
		steerSensitivity: 4.5,
		noiseAmplitude: 0.05,
		turnThrottleDot: 0.85,
		turnThrottleMin: 0.5,
		lookAheadBlend: 0.5,
		lateralOffset: - 0.8,   // cuts inside
		boostEagerness: true,
		stuckTime: 1.5,
		reverseTime: 1.0,
	},

	{
		name: 'Cautious',
		steerSensitivity: 2.8,
		noiseAmplitude: 0.02,
		turnThrottleDot: 0.5,
		turnThrottleMin: 0.2,
		lookAheadBlend: 0.85,
		lateralOffset: 0.6,     // stays wide
		boostEagerness: true,
		stuckTime: 2.5,
		reverseTime: 2.0,
	},

	{
		name: 'Drifter',
		steerSensitivity: 3.2,
		noiseAmplitude: 0.08,
		turnThrottleDot: 0.8,
		turnThrottleMin: 0.55,
		lookAheadBlend: 0.6,
		lateralOffset: 1.0,     // wide entry for drift
		boostEagerness: true,
		stuckTime: 2.0,
		reverseTime: 1.5,
	},

	{
		name: 'Strategist',
		steerSensitivity: 3.8,
		noiseAmplitude: 0.01,
		turnThrottleDot: 0.65,
		turnThrottleMin: 0.25,
		lookAheadBlend: 0.75,
		lateralOffset: 0.0,
		boostEagerness: false,  // holds boost for straights (dot > 0.9)
		stuckTime: 2.0,
		reverseTime: 1.5,
	},

];

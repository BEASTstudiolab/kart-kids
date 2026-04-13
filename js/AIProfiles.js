// AIProfiles.js — shared baseline CPU tuning

export const AI_LABEL = 'CPU';

export const DEFAULT_PROFILE = Object.freeze( {
	name: AI_LABEL,
	steerSensitivity: 3.9,
	noiseAmplitude: 0,
	turnThrottleDot: 0.8,
	turnThrottleMin: 0.24,
	lookAheadBlend: 0.35,
	lookAheadNear: 3,
	lookAheadFar: 5,
	lookAheadNearDistance: 10,
	lookAheadFarDistance: 18,
	turnLookAheadDistance: 24,
	turnLookAheadStepDistance: 6,
	lateralOffset: 0.0,
	trafficLookAheadDistance: 16,
	trafficThrottleMin: 0.3,
	trafficLateralBias: 0.75,
	boostEagerness: false,
	stuckTime: 2.0,
	reverseTime: 1.5,
	weight: 5,
} );

export const CPU_AI_PROFILE = DEFAULT_PROFILE;

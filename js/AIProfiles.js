// AIProfiles.js — shared baseline CPU tuning

export const AI_LABEL = 'CPU';

function clamp( value, min, max ) {

	return Math.min( Math.max( value, min ), max );

}

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
	straightLaneOffset: 0.0,
	cornerEntryWidth: 0.85,
	cornerApexTightness: 0.5,
	cornerSpeedFactor: 0.95,
	trafficLookAheadDistance: 16,
	trafficThrottleMin: 0.3,
	trafficLateralBias: 0.75,
	aggression: 0.55,
	overtakeCommitment: 0.58,
	trafficPatience: 0.5,
	mistakeRate: 0.3,
	mistakeSeverity: 0.18,
	startReactionDelay: 0.08,
	openingLaneCommit: 0.66,
	launchAssertiveness: 0.72,
	boostEagerness: false,
	boostCommitDot: 0.93,
	stuckTime: 2.0,
	reverseTime: 1.5,
	weight: 5,
} );

export const CPU_AI_PROFILE = DEFAULT_PROFILE;

function seededUnit( seed, channel = 0 ) {

	const raw = Math.sin( ( seed + 1 ) * 12.9898 + channel * 78.233 ) * 43758.5453;
	return raw - Math.floor( raw );

}

function seededRange( seed, channel, min, max ) {

	return min + ( max - min ) * seededUnit( seed, channel );

}

function clampProfileValue( value, min, max ) {

	return clamp( value, min, max );

}

export function createSeededCPUProfile( seed = 0, overrides = {} ) {

	const base = {
		...CPU_AI_PROFILE,
		...overrides,
	};

	const aggression = clampProfileValue(
		base.aggression + seededRange( seed, 10, - 0.2, 0.2 ),
		0.3,
		0.82
	);
	const overtakeCommitment = clampProfileValue(
		base.overtakeCommitment + seededRange( seed, 11, - 0.18, 0.2 ),
		0.32,
		0.86
	);
	const trafficPatience = clampProfileValue(
		base.trafficPatience + seededRange( seed, 12, - 0.18, 0.16 ),
		0.24,
		0.74
	);
	const mistakeRate = clampProfileValue(
		base.mistakeRate + seededRange( seed, 13, - 0.1, 0.12 ),
		0.14,
		0.52
	);
	const mistakeSeverity = clampProfileValue(
		base.mistakeSeverity + seededRange( seed, 14, - 0.06, 0.08 ),
		0.08,
		0.28
	);
	const startReactionDelay = clampProfileValue(
		base.startReactionDelay + seededRange( seed, 15, - 0.05, 0.14 ) - ( aggression - DEFAULT_PROFILE.aggression ) * 0.1,
		0.0,
		0.34
	);
	const openingLaneCommit = clampProfileValue(
		base.openingLaneCommit + seededRange( seed, 16, - 0.12, 0.16 ) + ( overtakeCommitment - DEFAULT_PROFILE.overtakeCommitment ) * 0.28,
		0.28,
		0.95
	);
	const launchAssertiveness = clampProfileValue(
		base.launchAssertiveness + seededRange( seed, 17, - 0.12, 0.12 ) + ( aggression - DEFAULT_PROFILE.aggression ) * 0.38,
		0.42,
		0.96
	);

	return {
		...base,
		steerSensitivity: clampProfileValue(
			base.steerSensitivity + seededRange( seed, 1, - 0.18, 0.18 ),
			3.6,
			4.2
		),
		turnThrottleDot: clampProfileValue(
			base.turnThrottleDot + seededRange( seed, 2, - 0.05, 0.05 ),
			0.72,
			0.88
		),
		lookAheadBlend: clampProfileValue(
			base.lookAheadBlend + seededRange( seed, 3, - 0.06, 0.06 ),
			0.24,
			0.46
		),
		straightLaneOffset: clampProfileValue(
			base.straightLaneOffset + seededRange( seed, 4, - 0.35, 0.35 ),
			- 0.45,
			0.45
		),
		cornerEntryWidth: clampProfileValue(
			base.cornerEntryWidth + seededRange( seed, 5, - 0.1, 0.08 ),
			0.68,
			0.98
		),
		cornerApexTightness: clampProfileValue(
			base.cornerApexTightness + seededRange( seed, 6, - 0.08, 0.1 ),
			0.35,
			0.72
		),
		cornerSpeedFactor: clampProfileValue(
			base.cornerSpeedFactor + seededRange( seed, 7, - 0.04, 0.03 ),
			0.88,
			1.0
		),
		trafficThrottleMin: clampProfileValue(
			base.trafficThrottleMin + seededRange( seed, 8, - 0.05, 0.06 ),
			0.24,
			0.42
		),
		aggression,
		overtakeCommitment,
		trafficPatience,
		mistakeRate,
		mistakeSeverity,
		startReactionDelay,
		openingLaneCommit,
		launchAssertiveness,
		boostCommitDot: clampProfileValue(
			base.boostCommitDot + seededRange( seed, 9, - 0.035, 0.03 ),
			0.88,
			0.97
		),
	};

}

export function getCPUProfileStyleSummary( profile = {} ) {

	return {
		steerSensitivity: Number( ( profile.steerSensitivity ?? DEFAULT_PROFILE.steerSensitivity ).toFixed( 3 ) ),
		lookAheadBlend: Number( ( profile.lookAheadBlend ?? DEFAULT_PROFILE.lookAheadBlend ).toFixed( 3 ) ),
		straightLaneOffset: Number( ( profile.straightLaneOffset ?? DEFAULT_PROFILE.straightLaneOffset ).toFixed( 3 ) ),
		cornerEntryWidth: Number( ( profile.cornerEntryWidth ?? DEFAULT_PROFILE.cornerEntryWidth ).toFixed( 3 ) ),
		cornerApexTightness: Number( ( profile.cornerApexTightness ?? DEFAULT_PROFILE.cornerApexTightness ).toFixed( 3 ) ),
		cornerSpeedFactor: Number( ( profile.cornerSpeedFactor ?? DEFAULT_PROFILE.cornerSpeedFactor ).toFixed( 3 ) ),
		trafficThrottleMin: Number( ( profile.trafficThrottleMin ?? DEFAULT_PROFILE.trafficThrottleMin ).toFixed( 3 ) ),
		aggression: Number( ( profile.aggression ?? DEFAULT_PROFILE.aggression ).toFixed( 3 ) ),
		overtakeCommitment: Number( ( profile.overtakeCommitment ?? DEFAULT_PROFILE.overtakeCommitment ).toFixed( 3 ) ),
		trafficPatience: Number( ( profile.trafficPatience ?? DEFAULT_PROFILE.trafficPatience ).toFixed( 3 ) ),
		mistakeRate: Number( ( profile.mistakeRate ?? DEFAULT_PROFILE.mistakeRate ).toFixed( 3 ) ),
		mistakeSeverity: Number( ( profile.mistakeSeverity ?? DEFAULT_PROFILE.mistakeSeverity ).toFixed( 3 ) ),
		startReactionDelay: Number( ( profile.startReactionDelay ?? DEFAULT_PROFILE.startReactionDelay ).toFixed( 3 ) ),
		openingLaneCommit: Number( ( profile.openingLaneCommit ?? DEFAULT_PROFILE.openingLaneCommit ).toFixed( 3 ) ),
		launchAssertiveness: Number( ( profile.launchAssertiveness ?? DEFAULT_PROFILE.launchAssertiveness ).toFixed( 3 ) ),
		boostCommitDot: Number( ( profile.boostCommitDot ?? DEFAULT_PROFILE.boostCommitDot ).toFixed( 3 ) ),
	};

}

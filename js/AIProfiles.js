// AIProfiles.js — shared baseline CPU tuning

export const AI_LABEL = 'CPU';

function clamp( value, min, max ) {

	return Math.min( Math.max( value, min ), max );

}

function lerp( a, b, t ) {

	return a + ( b - a ) * t;

}

export const DEFAULT_PROFILE = Object.freeze( {
	name: AI_LABEL,
	skill: 0.6,
	tier: 'B',
	steerSensitivity: 3.9,
	noiseAmplitude: 0,
	turnThrottleDot: 0.74,
	turnThrottleMin: 0.38,
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
	cornerSpeedFactor: 0.99,
	trafficLookAheadDistance: 16,
	trafficThrottleMin: 0.3,
	trafficLateralBias: 0.75,
	aggression: 0.55,
	overtakeCommitment: 0.58,
	trafficPatience: 0.5,
	mistakeRate: 0.22,
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

// Skill tiers drive corner aggression, mistake frequency, and top-speed pursuit.
// `skill` [0..1] is the single knob; other fields are starting points the
// seeded jitter then varies around. See createTieredCPUProfile below.
export const AI_SKILL_TIERS = Object.freeze( {
	A: { tier: 'A', skill: 0.92, mistakeRate: 0.10, mistakeSeverity: 0.08, aggression: 0.78 },
	B: { tier: 'B', skill: 0.62, mistakeRate: 0.26, mistakeSeverity: 0.18, aggression: 0.55 },
	C: { tier: 'C', skill: 0.35, mistakeRate: 0.46, mistakeSeverity: 0.26, aggression: 0.38 },
} );

// Recommended tier layout for a given AI field size. Index in the returned
// array lines up with AI spawn index. Callers typically shuffle this so grid
// position ≠ tier.
const AI_TIER_LAYOUTS = Object.freeze( {
	1: [ 'B' ],
	2: [ 'A', 'C' ],
	3: [ 'A', 'B', 'C' ],
	4: [ 'A', 'B', 'B', 'C' ],
	5: [ 'A', 'B', 'B', 'B', 'C' ],
	6: [ 'A', 'A', 'B', 'B', 'C', 'C' ],
	7: [ 'A', 'A', 'B', 'B', 'B', 'C', 'C' ],
	8: [ 'A', 'A', 'B', 'B', 'B', 'B', 'C', 'C' ],
} );

export function getAITierLayout( count ) {

	const n = clamp( Math.round( count ), 0, 8 );
	return AI_TIER_LAYOUTS[ n ] ? [ ...AI_TIER_LAYOUTS[ n ] ] : [];

}

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

export function createTieredCPUProfile( seed = 0, tier = 'B', overrides = {} ) {

	const tierConfig = AI_SKILL_TIERS[ tier ] || AI_SKILL_TIERS.B;

	const base = {
		...CPU_AI_PROFILE,
		...tierConfig,
		...overrides,
	};

	const skill = clampProfileValue(
		base.skill + seededRange( seed, 20, - 0.06, 0.06 ),
		0,
		1
	);

	const aggression = clampProfileValue(
		base.aggression + seededRange( seed, 10, - 0.15, 0.15 ),
		0.25,
		0.95
	);
	const overtakeCommitment = clampProfileValue(
		base.overtakeCommitment + seededRange( seed, 11, - 0.18, 0.2 ) + ( skill - 0.6 ) * 0.25,
		0.3,
		0.95
	);
	const trafficPatience = clampProfileValue(
		base.trafficPatience + seededRange( seed, 12, - 0.18, 0.16 ),
		0.2,
		0.78
	);
	const mistakeRate = clampProfileValue(
		base.mistakeRate + seededRange( seed, 13, - 0.08, 0.08 ),
		0.05,
		0.6
	);
	const mistakeSeverity = clampProfileValue(
		base.mistakeSeverity + seededRange( seed, 14, - 0.05, 0.06 ),
		0.05,
		0.32
	);
	const startReactionDelay = clampProfileValue(
		base.startReactionDelay + seededRange( seed, 15, - 0.04, 0.12 ) - ( skill - 0.6 ) * 0.18,
		0.0,
		0.38
	);
	const openingLaneCommit = clampProfileValue(
		base.openingLaneCommit + seededRange( seed, 16, - 0.12, 0.16 ) + ( overtakeCommitment - DEFAULT_PROFILE.overtakeCommitment ) * 0.28,
		0.28,
		0.98
	);
	const launchAssertiveness = clampProfileValue(
		base.launchAssertiveness + seededRange( seed, 17, - 0.1, 0.1 ) + ( skill - 0.6 ) * 0.4,
		0.42,
		0.99
	);

	// Skill-coupled corner aggression: top tier holds ~102% of target speed
	// through corners (ignores the reduction); bottom tier drops to ~90%.
	const cornerSpeedFactor = clampProfileValue(
		lerp( 0.93, 1.02, skill ) + seededRange( seed, 7, - 0.025, 0.025 ),
		0.88,
		1.04
	);

	const turnThrottleDot = clampProfileValue(
		lerp( 0.86, 0.68, skill ) + seededRange( seed, 2, - 0.04, 0.04 ),
		0.6,
		0.9
	);

	const turnThrottleMin = clampProfileValue(
		lerp( 0.28, 0.52, skill ) + seededRange( seed, 21, - 0.04, 0.04 ),
		0.22,
		0.58
	);

	const boostCommitDot = clampProfileValue(
		lerp( 0.96, 0.86, skill ) + seededRange( seed, 9, - 0.02, 0.02 ),
		0.82,
		0.98
	);

	const boostEagerness = skill > 0.85;

	// Per-driver line variance is independent of skill — any driver can prefer
	// wide entries or tight apexes. Widened ranges produce visible differences
	// between racers running the same corner.
	const cornerEntryWidth = clampProfileValue(
		base.cornerEntryWidth + seededRange( seed, 5, - 0.22, 0.22 ),
		0.45,
		1.1
	);
	const cornerApexTightness = clampProfileValue(
		base.cornerApexTightness + seededRange( seed, 6, - 0.22, 0.22 ),
		0.22,
		0.85
	);

	return {
		...base,
		skill,
		tier: base.tier || tier,
		steerSensitivity: clampProfileValue(
			base.steerSensitivity + seededRange( seed, 1, - 0.18, 0.18 ) + ( skill - 0.6 ) * 0.2,
			3.5,
			4.3
		),
		turnThrottleDot,
		turnThrottleMin,
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
		cornerEntryWidth,
		cornerApexTightness,
		cornerSpeedFactor,
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
		boostEagerness,
		boostCommitDot,
	};

}

// Backwards-compat shim for any callers still using the pre-tier API.
export function createSeededCPUProfile( seed = 0, overrides = {} ) {

	return createTieredCPUProfile( seed, 'B', overrides );

}

export function getCPUProfileStyleSummary( profile = {} ) {

	return {
		tier: profile.tier ?? DEFAULT_PROFILE.tier,
		skill: Number( ( profile.skill ?? DEFAULT_PROFILE.skill ).toFixed( 3 ) ),
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
		boostEagerness: !! profile.boostEagerness,
		boostCommitDot: Number( ( profile.boostCommitDot ?? DEFAULT_PROFILE.boostCommitDot ).toFixed( 3 ) ),
	};

}

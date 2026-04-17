import test from 'node:test';
import assert from 'node:assert/strict';

import {
	AI_SKILL_TIERS,
	CPU_AI_PROFILE,
	createSeededCPUProfile,
	createTieredCPUProfile,
	getAITierLayout,
	getCPUProfileStyleSummary,
} from '../js/AIProfiles.js';

test( 'createTieredCPUProfile is deterministic per (seed, tier) and preserves the shared baseline name', () => {

	const profileA1 = createTieredCPUProfile( 2, 'B' );
	const profileA2 = createTieredCPUProfile( 2, 'B' );
	const profileB = createTieredCPUProfile( 5, 'B' );
	const profileCrossTier = createTieredCPUProfile( 2, 'A' );

	assert.deepEqual( profileA1, profileA2 );
	assert.equal( profileA1.name, CPU_AI_PROFILE.name );
	assert.notDeepEqual( profileA1, profileB );
	assert.notDeepEqual( profileA1, profileCrossTier );

} );

test( 'createTieredCPUProfile keeps humanization inside the widened safe tuning bands', () => {

	for ( const tier of [ 'A', 'B', 'C' ] ) {

		for ( let seed = 0; seed < 12; seed ++ ) {

			const profile = createTieredCPUProfile( seed, tier );

			assert.equal( profile.tier, tier );
			assert.ok( profile.skill >= 0 && profile.skill <= 1 );
			assert.ok( profile.steerSensitivity >= 3.5 && profile.steerSensitivity <= 4.3 );
			assert.ok( profile.turnThrottleDot >= 0.6 && profile.turnThrottleDot <= 0.9 );
			assert.ok( profile.turnThrottleMin >= 0.22 && profile.turnThrottleMin <= 0.58 );
			assert.ok( profile.lookAheadBlend >= 0.24 && profile.lookAheadBlend <= 0.46 );
			assert.ok( profile.straightLaneOffset >= - 0.45 && profile.straightLaneOffset <= 0.45 );
			assert.ok( profile.cornerEntryWidth >= 0.45 && profile.cornerEntryWidth <= 1.1 );
			assert.ok( profile.cornerApexTightness >= 0.22 && profile.cornerApexTightness <= 0.85 );
			assert.ok( profile.cornerSpeedFactor >= 0.88 && profile.cornerSpeedFactor <= 1.04 );
			assert.ok( profile.trafficThrottleMin >= 0.24 && profile.trafficThrottleMin <= 0.42 );
			assert.ok( profile.aggression >= 0.25 && profile.aggression <= 0.95 );
			assert.ok( profile.overtakeCommitment >= 0.3 && profile.overtakeCommitment <= 0.95 );
			assert.ok( profile.trafficPatience >= 0.2 && profile.trafficPatience <= 0.78 );
			assert.ok( profile.mistakeRate >= 0.05 && profile.mistakeRate <= 0.6 );
			assert.ok( profile.mistakeSeverity >= 0.05 && profile.mistakeSeverity <= 0.32 );
			assert.ok( profile.startReactionDelay >= 0.0 && profile.startReactionDelay <= 0.38 );
			assert.ok( profile.openingLaneCommit >= 0.28 && profile.openingLaneCommit <= 0.98 );
			assert.ok( profile.launchAssertiveness >= 0.42 && profile.launchAssertiveness <= 0.99 );
			assert.ok( profile.boostCommitDot >= 0.82 && profile.boostCommitDot <= 0.98 );

		}

	}

} );

test( 'createTieredCPUProfile tier A averages faster corner speed and lower mistake rate than tier C', () => {

	let aSpeed = 0;
	let cSpeed = 0;
	let aMistakes = 0;
	let cMistakes = 0;
	const samples = 16;

	for ( let seed = 0; seed < samples; seed ++ ) {

		const a = createTieredCPUProfile( seed, 'A' );
		const c = createTieredCPUProfile( seed, 'C' );
		aSpeed += a.cornerSpeedFactor;
		cSpeed += c.cornerSpeedFactor;
		aMistakes += a.mistakeRate;
		cMistakes += c.mistakeRate;

	}

	assert.ok( aSpeed / samples > cSpeed / samples + 0.05, 'tier A should carry ~5%+ more corner speed on average' );
	assert.ok( aMistakes / samples < cMistakes / samples - 0.15, 'tier A should make substantially fewer mistakes on average' );

} );

test( 'createTieredCPUProfile applies seeded variation on top of caller-provided baseline overrides', () => {

	const profile = createTieredCPUProfile( 3, 'B', {
		noiseAmplitude: 0,
		boostCommitDot: 0.91,
		straightLaneOffset: 0,
	} );

	assert.equal( profile.noiseAmplitude, 0 );
	assert.notEqual( profile.straightLaneOffset, 0, 'seeded humanization should still add bounded line bias around the override base' );
	assert.notEqual( profile.boostCommitDot, 0.91, 'seeded humanization should derive the final runtime boost threshold from the baseline' );

} );

test( 'createSeededCPUProfile remains a B-tier shim for legacy callers', () => {

	const legacy = createSeededCPUProfile( 4 );
	const tiered = createTieredCPUProfile( 4, 'B' );

	assert.deepEqual( legacy, tiered );

} );

test( 'getAITierLayout produces the expected distribution shapes', () => {

	assert.deepEqual( getAITierLayout( 0 ), [] );
	assert.deepEqual( getAITierLayout( 1 ), [ 'B' ] );
	assert.deepEqual( getAITierLayout( 8 ), [ 'A', 'A', 'B', 'B', 'B', 'B', 'C', 'C' ] );

	for ( let n = 1; n <= 8; n ++ ) {

		const layout = getAITierLayout( n );
		assert.equal( layout.length, n );
		for ( const tier of layout ) {

			assert.ok( AI_SKILL_TIERS[ tier ], `layout contains unknown tier: ${tier}` );

		}

	}

} );

test( 'getCPUProfileStyleSummary returns a compact rounded runtime debug payload with tier metadata', () => {

	const profile = createTieredCPUProfile( 4, 'A' );
	const summary = getCPUProfileStyleSummary( profile );

	assert.deepEqual( Object.keys( summary ), [
		'tier',
		'skill',
		'steerSensitivity',
		'lookAheadBlend',
		'straightLaneOffset',
		'cornerEntryWidth',
		'cornerApexTightness',
		'cornerSpeedFactor',
		'trafficThrottleMin',
		'aggression',
		'overtakeCommitment',
		'trafficPatience',
		'mistakeRate',
		'mistakeSeverity',
		'startReactionDelay',
		'openingLaneCommit',
		'launchAssertiveness',
		'boostEagerness',
		'boostCommitDot',
	] );
	assert.equal( summary.tier, 'A' );
	assert.equal( typeof summary.skill, 'number' );
	assert.equal( typeof summary.lookAheadBlend, 'number' );
	assert.equal( typeof summary.boostCommitDot, 'number' );
	assert.equal( typeof summary.boostEagerness, 'boolean' );
	assert.ok( summary.cornerSpeedFactor >= 0.88 && summary.cornerSpeedFactor <= 1.04 );

} );

import test from 'node:test';
import assert from 'node:assert/strict';

import { CPU_AI_PROFILE, createSeededCPUProfile, getCPUProfileStyleSummary } from '../js/AIProfiles.js';

test( 'createSeededCPUProfile is deterministic per seed and preserves the shared baseline center', () => {

	const profileA1 = createSeededCPUProfile( 2 );
	const profileA2 = createSeededCPUProfile( 2 );
	const profileB = createSeededCPUProfile( 5 );

	assert.deepEqual( profileA1, profileA2 );
	assert.equal( profileA1.name, CPU_AI_PROFILE.name );
	assert.notDeepEqual( profileA1, profileB );

} );

test( 'createSeededCPUProfile keeps humanization inside the safe tuning bands', () => {

	for ( let seed = 0; seed < 12; seed ++ ) {

		const profile = createSeededCPUProfile( seed );

		assert.ok( profile.steerSensitivity >= 3.6 && profile.steerSensitivity <= 4.2 );
		assert.ok( profile.turnThrottleDot >= 0.72 && profile.turnThrottleDot <= 0.88 );
		assert.ok( profile.lookAheadBlend >= 0.24 && profile.lookAheadBlend <= 0.46 );
		assert.ok( profile.straightLaneOffset >= - 0.45 && profile.straightLaneOffset <= 0.45 );
		assert.ok( profile.cornerEntryWidth >= 0.68 && profile.cornerEntryWidth <= 0.98 );
		assert.ok( profile.cornerApexTightness >= 0.35 && profile.cornerApexTightness <= 0.72 );
		assert.ok( profile.cornerSpeedFactor >= 0.88 && profile.cornerSpeedFactor <= 1.0 );
		assert.ok( profile.trafficThrottleMin >= 0.24 && profile.trafficThrottleMin <= 0.42 );
		assert.ok( profile.aggression >= 0.3 && profile.aggression <= 0.82 );
		assert.ok( profile.overtakeCommitment >= 0.32 && profile.overtakeCommitment <= 0.86 );
		assert.ok( profile.trafficPatience >= 0.24 && profile.trafficPatience <= 0.74 );
		assert.ok( profile.mistakeRate >= 0.14 && profile.mistakeRate <= 0.52 );
		assert.ok( profile.mistakeSeverity >= 0.08 && profile.mistakeSeverity <= 0.28 );
		assert.ok( profile.startReactionDelay >= 0.0 && profile.startReactionDelay <= 0.34 );
		assert.ok( profile.openingLaneCommit >= 0.28 && profile.openingLaneCommit <= 0.95 );
		assert.ok( profile.launchAssertiveness >= 0.42 && profile.launchAssertiveness <= 0.96 );
		assert.ok( profile.boostCommitDot >= 0.88 && profile.boostCommitDot <= 0.97 );

	}

} );

test( 'createSeededCPUProfile applies seeded variation on top of caller-provided baseline overrides', () => {

	const profile = createSeededCPUProfile( 3, {
		noiseAmplitude: 0,
		boostCommitDot: 0.91,
		straightLaneOffset: 0,
	} );

	assert.equal( profile.noiseAmplitude, 0 );
	assert.notEqual( profile.straightLaneOffset, 0, 'seeded humanization should still add bounded line bias around the override base' );
	assert.notEqual( profile.boostCommitDot, 0.91, 'seeded humanization should derive the final runtime boost threshold from the baseline' );

} );

test( 'getCPUProfileStyleSummary returns a compact rounded runtime debug payload', () => {

	const profile = createSeededCPUProfile( 4 );
	const summary = getCPUProfileStyleSummary( profile );

	assert.deepEqual( Object.keys( summary ), [
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
		'boostCommitDot',
	] );
	assert.equal( typeof summary.lookAheadBlend, 'number' );
	assert.equal( typeof summary.boostCommitDot, 'number' );
	assert.ok( summary.cornerSpeedFactor >= 0.88 && summary.cornerSpeedFactor <= 1.0 );

} );

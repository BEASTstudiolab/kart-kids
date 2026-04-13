export const EXPLOSION_PRESET_IDS = [
	'mine',
	'bomb',
	'missileStrike',
	'pulseShockwave',
];

Object.freeze( EXPLOSION_PRESET_IDS );

export const EXPLOSION_PRESETS = {
	mine: {
		id: 'mine',
		label: 'Mine Burst',
		styleFamily: 'hybridArcadeCombat',
		heroWeight: 'minor',
		budgets: {
			mesh: 1,
			particles: 16,
		},
		layerDropOrder: [ 'smoke' ],
		layers: [
			{
				id: 'flash',
				kind: 'flash',
				weight: 1,
			},
			{
				id: 'core',
				kind: 'mesh',
				meshKind: 'groundPop',
				materialKind: 'blastCore',
				weight: 2,
			},
			{
				id: 'ring',
				kind: 'mesh',
				meshKind: 'groundRing',
				materialKind: 'blastRing',
				weight: 3,
			},
			{
				id: 'sparks',
				kind: 'particles',
				particleFamily: 'sparks',
				count: 10,
				weight: 4,
			},
			{
				id: 'smoke',
				kind: 'particles',
				particleFamily: 'smoke',
				count: 6,
				weight: 5,
			},
		],
		feedbackStrengths: {
			cameraShake: 0.15,
			audio: 0.28,
			haptics: 0.1,
		},
	},
	bomb: {
		id: 'bomb',
		label: 'Bomb Blast',
		styleFamily: 'hybridArcadeCombat',
		heroWeight: 'standard',
		budgets: {
			mesh: 2,
			particles: 24,
		},
		layerDropOrder: [ 'smoke', 'debris' ],
		layers: [
			{
				id: 'flash',
				kind: 'flash',
				weight: 1,
			},
			{
				id: 'core',
				kind: 'mesh',
				meshKind: 'sphereBloom',
				materialKind: 'blastCore',
				weight: 2,
			},
			{
				id: 'ring',
				kind: 'mesh',
				meshKind: 'wideRing',
				materialKind: 'blastRing',
				weight: 3,
			},
			{
				id: 'debris',
				kind: 'particles',
				particleFamily: 'debris',
				count: 10,
				weight: 4,
			},
			{
				id: 'smoke',
				kind: 'particles',
				particleFamily: 'smoke',
				count: 14,
				weight: 5,
			},
		],
		feedbackStrengths: {
			cameraShake: 0.28,
			audio: 0.45,
			haptics: 0.22,
		},
	},
	missileStrike: {
		id: 'missileStrike',
		label: 'Missile Strike',
		styleFamily: 'hybridArcadeCombat',
		heroWeight: 'hero',
		budgets: {
			mesh: 3,
			particles: 34,
		},
		layerDropOrder: [ 'smoke', 'debris', 'streak' ],
		layers: [
			{
				id: 'flash',
				kind: 'flash',
				weight: 1,
			},
			{
				id: 'streak',
				kind: 'particles',
				particleFamily: 'ingressStreak',
				count: 8,
				weight: 2,
			},
			{
				id: 'core',
				kind: 'mesh',
				meshKind: 'heroBloom',
				materialKind: 'blastCore',
				weight: 3,
			},
			{
				id: 'ring',
				kind: 'mesh',
				meshKind: 'heroRing',
				materialKind: 'blastRing',
				weight: 4,
			},
			{
				id: 'debris',
				kind: 'particles',
				particleFamily: 'directionalDebris',
				count: 12,
				weight: 5,
			},
			{
				id: 'smoke',
				kind: 'particles',
				particleFamily: 'smoke',
				count: 14,
				weight: 6,
			},
		],
		feedbackStrengths: {
			cameraShake: 0.45,
			audio: 0.68,
			haptics: 0.38,
		},
	},
	pulseShockwave: {
		id: 'pulseShockwave',
		label: 'Pulse Shockwave',
		styleFamily: 'energy',
		heroWeight: 'special',
		budgets: {
			mesh: 2,
			particles: 20,
		},
		layerDropOrder: [ 'afterglow', 'motes' ],
		layers: [
			{
				id: 'pulse',
				kind: 'mesh',
				meshKind: 'energyRing',
				materialKind: 'energyPulse',
				weight: 1,
			},
			{
				id: 'core',
				kind: 'mesh',
				meshKind: 'energyCore',
				materialKind: 'energyPulse',
				weight: 2,
			},
			{
				id: 'motes',
				kind: 'particles',
				particleFamily: 'energyMotes',
				count: 12,
				weight: 3,
			},
			{
				id: 'afterglow',
				kind: 'particles',
				particleFamily: 'energyAfterglow',
				count: 8,
				weight: 4,
			},
		],
		feedbackStrengths: {
			cameraShake: 0.2,
			audio: 0.34,
			haptics: 0.14,
		},
	},
};

deepFreeze( EXPLOSION_PRESETS );

export function getExplosionPreset( id ) {

	return EXPLOSION_PRESETS[ id ] || null;

}

function deepFreeze( value ) {

	if ( ! value || typeof value !== 'object' || Object.isFrozen( value ) ) return value;

	Object.freeze( value );

	for ( const key of Object.keys( value ) ) {

		deepFreeze( value[ key ] );

	}

	return value;

}

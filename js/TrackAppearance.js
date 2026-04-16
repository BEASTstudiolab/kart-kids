export const TRACK_APPEARANCE_TARGETS = Object.freeze( {
	track: {
		id: 'track',
		label: 'Track Surface',
		description: 'Primary road and track tile emissive styling.',
	},
	terrain: {
		id: 'terrain',
		label: 'Terrain Surface',
		description: 'Blank terrain tile emissive styling.',
	},
	boost: {
		id: 'boost',
		label: 'Turbo Tiles',
		description: 'Gameplay turbo tile emissive styling.',
	},
} );

const DEFAULT_GLOW = Object.freeze( {
	strength: 0.02,
	radius: 0.02,
	threshold: 0.5,
} );

const DEFAULT_TARGET = Object.freeze( {
	color: '#ffffff',
	intensity: 1,
	hueShiftEnabled: false,
	hueShiftSpeed: 0.6,
} );

export function getTrackAppearanceTargetList() {

	return Object.values( TRACK_APPEARANCE_TARGETS );

}

function clampNumber( value, fallback, min, max ) {

	const num = Number( value );
	if ( ! Number.isFinite( num ) ) return fallback;
	return Math.min( max, Math.max( min, num ) );

}

function normalizeHexColor( value, fallback = DEFAULT_TARGET.color ) {

	if ( typeof value !== 'string' ) return fallback;
	const trimmed = value.trim();
	if ( /^#[0-9a-f]{6}$/i.test( trimmed ) ) return trimmed.toLowerCase();
	return fallback;

}

function normalizeTargetAppearance( value ) {

	return {
		color: normalizeHexColor( value?.color, DEFAULT_TARGET.color ),
		intensity: clampNumber( value?.intensity, DEFAULT_TARGET.intensity, 0, 8 ),
		hueShiftEnabled: value?.hueShiftEnabled === true,
		hueShiftSpeed: clampNumber( value?.hueShiftSpeed, DEFAULT_TARGET.hueShiftSpeed, 0.05, 4 ),
	};

}

export function normalizeTrackAppearance( value ) {

	const input = value && typeof value === 'object' ? value : {};
	const glow = input.glow && typeof input.glow === 'object' ? input.glow : {};
	const targets = input.targets && typeof input.targets === 'object' ? input.targets : {};

	const normalized = {
		glow: {
			strength: clampNumber( glow.strength, DEFAULT_GLOW.strength, 0, 4 ),
			radius: clampNumber( glow.radius, DEFAULT_GLOW.radius, 0, 2 ),
			threshold: clampNumber( glow.threshold, DEFAULT_GLOW.threshold, 0, 2 ),
		},
		targets: {},
	};

	for ( const target of getTrackAppearanceTargetList() ) {

		normalized.targets[ target.id ] = normalizeTargetAppearance( targets[ target.id ] );

	}

	return normalized;

}

export function hasAnimatedTrackAppearance( value ) {

	const appearance = normalizeTrackAppearance( value );
	return getTrackAppearanceTargetList().some( ( target ) => appearance.targets[ target.id ]?.hueShiftEnabled );

}

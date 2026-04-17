const TRACK_THEMES = [
	{
		id: 'classic-asphalt',
		name: 'Classic Asphalt',
		available: true,
		description: 'Original AtlasAsphalt track textures',
		slots: {
			1: { folder: null, prefix: 'AtlasAsphalt1', extension: 'webp' },
			2: { folder: null, prefix: 'AtlasAsphalt2', extension: 'webp' },
		},
	},
	{
		id: '80s-synth-wave',
		name: '80s Synth Wave',
		available: true,
		description: 'Retro neon synthwave track textures',
		slots: {
			1: { folder: '80s Synth Wave Atlas 1', prefix: '80ssynthwaveAtlas1', extension: 'webp' },
			2: { folder: '80s Synth Wave Atlas 2', prefix: '80ssynthwaveAtlas2', extension: 'webp' },
		},
	},
	{
		id: 'canyon',
		name: 'Canyon',
		available: true,
		description: 'Warm sandstone canyon track textures',
		slots: {
			1: { folder: 'Canyon Atlas 1', prefix: 'CanyonAtlas1', extension: 'webp' },
			2: { folder: 'Canyon Atlas 2', prefix: 'CanyonAtlas2', extension: 'webp' },
		},
	},
	{
		id: 'concrete',
		name: 'Concrete',
		available: true,
		description: 'Industrial concrete track textures',
		slots: {
			1: { folder: 'Concrete Atlas 1', prefix: 'ConcreteAtlas1', extension: 'webp' },
			2: { folder: 'Concrete Atlas 2', prefix: 'ConcreteAtlas2', extension: 'webp' },
		},
	},
	{
		id: 'dirt',
		name: 'Dirt',
		available: true,
		description: 'Packed dirt track textures',
		slots: {
			1: { folder: 'Dirt Atlas 1', prefix: 'DirtAtlas1', extension: 'webp' },
			2: { folder: 'Dirt Atlas 2', prefix: 'DirtAtlas2', extension: 'webp' },
		},
	},
	{
		id: 'forest',
		name: 'Forest',
		available: true,
		description: 'Forest-floor track textures',
		slots: {
			1: { folder: 'Forest Atlas 1', prefix: 'ForestAtlas1', extension: 'webp' },
			2: { folder: 'Forest Atlas 2', prefix: 'ForestAtlas2', extension: 'webp' },
		},
	},
	{
		id: 'ice',
		name: 'Ice',
		available: true,
		description: 'Frozen ice track textures',
		slots: {
			1: { folder: 'Ice Atlas 1', prefix: 'IceAtlas1', extension: 'webp' },
			2: { folder: 'Ice Atlas 2', prefix: 'IceAtlas2', extension: 'webp' },
		},
	},
	{
		id: 'lava',
		name: 'Lava',
		available: true,
		description: 'Volcanic lava track textures',
		slots: {
			1: { folder: 'Lava Atlas 1', prefix: 'LavaAtlas1', extension: 'webp' },
			2: { folder: 'Lava Atlas 2', prefix: 'LavaAtlas2', extension: 'webp' },
		},
	},
	{
		id: 'moon',
		name: 'Moon',
		available: true,
		description: 'Dusty lunar track textures',
		slots: {
			1: { folder: 'Moon Atlas 1', prefix: 'MoonAtlas1', extension: 'webp' },
			2: { folder: 'Moon Atlas 2', prefix: 'MoonAtlas2', extension: 'webp' },
		},
	},
	{
		id: 'sand',
		name: 'Sand',
		available: true,
		description: 'Loose desert sand track textures',
		slots: {
			1: { folder: 'Sand Atlas 1', prefix: 'SandAtlas1', extension: 'webp' },
			2: { folder: 'Sand Atlas 2', prefix: 'SandAtlas2', extension: 'webp' },
		},
	},
	{
		id: 'snow',
		name: 'Snow',
		available: true,
		description: 'Snow-packed winter track textures',
		slots: {
			1: { folder: 'Snow Atlas 1', prefix: 'SnowAtlas1', extension: 'webp' },
			2: { folder: 'Snow Atlas 2', prefix: 'SnowAtlas2', extension: 'webp' },
		},
	},
];

const TRACK_THEME_BY_ID = new Map( TRACK_THEMES.map( ( theme ) => [ theme.id, theme ] ) );
const LEGACY_THEME_IDS = new Set( [
	'city-night',
	'city-day',
	'beach',
	'jungle',
	'space',
	'volcano',
	'frozen',
	'underwater',
	'retro-neon',
] );

const REQUIRED_TRACK_THEME_TEXTURE_KINDS = [ 'BaseColor', 'Normal', 'OcclusionRoughnessMetallic' ];
const OPTIONAL_TRACK_THEME_TEXTURE_KINDS = [ 'Emissive' ];
const DEFAULT_TRACK_THEME_ID = 'classic-asphalt';

function normalizeTrackThemeId( themeId ) {

	if ( typeof themeId !== 'string' || ! themeId.trim() ) return DEFAULT_TRACK_THEME_ID;

	const trimmed = themeId.trim();
	if ( TRACK_THEME_BY_ID.has( trimmed ) ) return trimmed;
	if ( LEGACY_THEME_IDS.has( trimmed ) ) return DEFAULT_TRACK_THEME_ID;

	return DEFAULT_TRACK_THEME_ID;

}

function getTrackThemeById( themeId ) {

	return TRACK_THEME_BY_ID.get( normalizeTrackThemeId( themeId ) ) ?? TRACK_THEME_BY_ID.get( DEFAULT_TRACK_THEME_ID );

}

function getAvailableTrackThemes() {

	return TRACK_THEMES;

}

function resolveTrackThemeTexturePath( themeId, atlasSlot, textureKind ) {

	const theme = getTrackThemeById( themeId );
	const slot = theme?.slots?.[ atlasSlot ];
	if ( ! slot ) throw new Error( `Unknown track theme atlas slot "${ atlasSlot }" for theme "${ themeId }".` );

	if ( ! slot.folder ) {

		return `models/standard-map/textures/${ slot.prefix }_${ textureKind }.${ slot.extension }`;

	}

	return `models/standard-map/textures/${ slot.folder }/${ slot.prefix }_${ textureKind }.${ slot.extension }`;

}

export {
	DEFAULT_TRACK_THEME_ID,
	TRACK_THEMES,
	REQUIRED_TRACK_THEME_TEXTURE_KINDS,
	OPTIONAL_TRACK_THEME_TEXTURE_KINDS,
	getAvailableTrackThemes,
	getTrackThemeById,
	normalizeTrackThemeId,
	resolveTrackThemeTexturePath,
};

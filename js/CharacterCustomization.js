export const CHARACTER_MODEL_PATH = 'characters/Kart_Beast_Rest-Armature.gltf';
export const CHARACTER_GARAGE_IDLE_ANIMATION_PATH = 'animations/Kart_Beast_Garage_idle.glb';
export const MASK_TINT_TEXTURE_PATH = 'characters/textures/TintMaskRGBA.png';

export const BALACLAVA_OPTIONS = Object.freeze( [
	Object.freeze( { id: 'balaclava-basic', label: 'Balaclava Basic', meshName: 'Balaclava Basic' } ),
	Object.freeze( { id: 'balaclava-alien', label: 'Balaclava Alien', meshName: 'Balaclava Alien' } ),
	Object.freeze( { id: 'balaclava-baghead', label: 'Balaclava Baghead', meshName: 'Balaclava Baghead' } ),
	Object.freeze( { id: 'balaclava-blank', label: 'Balaclava Blank', meshName: 'Balaclava Blank' } ),
	Object.freeze( { id: 'balaclava-bull', label: 'Balaclava Bull', meshName: 'Balaclava Bull' } ),
	Object.freeze( { id: 'balaclava-cat', label: 'Balaclava Cat', meshName: 'Balaclava Cat' } ),
	Object.freeze( { id: 'balaclava-clown', label: 'Balaclava Clown', meshName: 'Balaclava Clown' } ),
	Object.freeze( { id: 'balaclava-cyclope', label: 'Balaclava Cyclope', meshName: 'Balaclava Cyclope' } ),
	Object.freeze( { id: 'balaclava-deer', label: 'Balaclava Deer', meshName: 'Balaclava Deer' } ),
	Object.freeze( { id: 'balaclava-dummy', label: 'Balaclava Dummy', meshName: 'Balaclava Dummy' } ),
	Object.freeze( { id: 'balaclava-hare', label: 'Balaclava Hare', meshName: 'Balaclava Hare' } ),
	Object.freeze( { id: 'balaclava-medievil', label: 'Balaclava Medievil', meshName: 'Balaclava Medievil' } ),
	Object.freeze( { id: 'balaclava-monkey', label: 'Balaclava Monkey', meshName: 'Balaclava Monkey' } ),
	Object.freeze( { id: 'balaclava-no-ears', label: 'Balaclava No Ears', meshName: 'Balaclava No Ears' } ),
	Object.freeze( { id: 'balaclava-panda', label: 'Balaclava Panda', meshName: 'Balaclava Panda' } ),
	Object.freeze( { id: 'balaclava-pig', label: 'Balaclava Pig', meshName: 'Balaclava Pig' } ),
	Object.freeze( { id: 'balaclava-pooch', label: 'Balaclava Pooch', meshName: 'Balaclava Pooch' } ),
	Object.freeze( { id: 'balaclava-rabbit', label: 'Balaclava Rabbit', meshName: 'Balaclava Rabbit' } ),
	Object.freeze( { id: 'balaclava-racoon', label: 'Balaclava Racoon', meshName: 'Balaclava Racoon' } ),
	Object.freeze( { id: 'balaclava-robot', label: 'Balaclava Robot', meshName: 'Balaclava Robot' } ),
	Object.freeze( { id: 'balaclava-sheep', label: 'Balaclava Sheep', meshName: 'Balaclava Sheep' } ),
	Object.freeze( { id: 'balaclava-skull', label: 'Balaclava Skull', meshName: 'Balaclava Skull' } ),
	Object.freeze( { id: 'balaclava-spaniel', label: 'Balaclava Spaniel', meshName: 'Balaclava Spaniel' } ),
	Object.freeze( { id: 'balaclava-spartan-mask', label: 'Balaclava Spartan Mask', meshName: 'Balaclava Spartan Mask' } ),
	Object.freeze( { id: 'balaclava-squirrel', label: 'Balaclava Squirrel', meshName: 'Balaclava Squirrel' } ),
	Object.freeze( { id: 'balaclava-unicorn', label: 'Balaclava Unicorn', meshName: 'Balaclava Unicorn' } ),
	Object.freeze( { id: 'balaclava-wolf', label: 'Balaclava Wolf', meshName: 'Balaclava Wolf' } ),
] );

export const CHARACTER_ACCESSORY_DEFS = Object.freeze( [
	Object.freeze( { key: 'Baseball_Hat', label: 'Baseball Hat', meshes: Object.freeze( [ 'Baseball Hat' ] ) } ),
	Object.freeze( { key: 'Gold_Chain', label: 'Gold Chain', meshes: Object.freeze( [ 'Balaclava Gold Chain', 'Gold Chain' ] ) } ),
	Object.freeze( { key: 'Jeans', label: 'Jeans', meshes: Object.freeze( [ 'Jeans' ] ) } ),
	Object.freeze( { key: 'Tshirt', label: 'T-Shirt', meshes: Object.freeze( [ 'Tshirt' ] ) } ),
] );

const BALACLAVA_BY_ID = new Map( BALACLAVA_OPTIONS.map( ( option ) => [ option.id, option ] ) );
const BALACLAVA_MESH_NAME_BY_ID = new Map( BALACLAVA_OPTIONS.map( ( option ) => [ option.id, normalizeCharacterMeshName( option.meshName ) ] ) );

export const DEFAULT_BALACLAVA_ID = BALACLAVA_OPTIONS[ 0 ].id;

export function getBalaclavaOptionById( balaclavaId ) {

	return BALACLAVA_BY_ID.get( normalizeSelectedBalaclavaId( balaclavaId ) ) || BALACLAVA_OPTIONS[ 0 ];

}

export function getRandomBalaclavaId( randomFn = Math.random ) {

	const raw = typeof randomFn === 'function' ? Number( randomFn() ) : Number.NaN;
	if ( ! Number.isFinite( raw ) ) return DEFAULT_BALACLAVA_ID;

	const index = Math.min(
		BALACLAVA_OPTIONS.length - 1,
		Math.max( 0, Math.floor( raw * BALACLAVA_OPTIONS.length ) )
	);

	return BALACLAVA_OPTIONS[ index ]?.id || DEFAULT_BALACLAVA_ID;

}

export function normalizeSelectedBalaclavaId( balaclavaId ) {

	if ( typeof balaclavaId !== 'string' ) return DEFAULT_BALACLAVA_ID;

	const normalized = balaclavaId.trim().toLowerCase();
	return BALACLAVA_BY_ID.has( normalized ) ? normalized : DEFAULT_BALACLAVA_ID;

}

export function isBalaclavaMeshName( meshName ) {

	return !! resolveBalaclavaOptionByMeshName( meshName );

}

export function normalizeCharacterMeshName( meshName ) {

	if ( typeof meshName !== 'string' ) return '';

	return meshName
		.trim()
		.replace( /\s+\(clone\)$/i, '' )
		.replace( /(?:[._ ]\d+)+$/, '' )
		.replace( /_/g, ' ' )
		.replace( /\s+/g, ' ' );

}

export function resolveBalaclavaOptionByMeshName( meshName ) {

	const normalizedMeshName = normalizeCharacterMeshName( meshName );
	if ( ! normalizedMeshName || ! normalizedMeshName.startsWith( 'Balaclava ' ) ) return null;

	for ( const option of BALACLAVA_OPTIONS ) {

		const normalizedOptionName = BALACLAVA_MESH_NAME_BY_ID.get( option.id ) || option.meshName;
		if ( normalizedMeshName === normalizedOptionName ) return option;
		if ( normalizedMeshName.startsWith( `${ normalizedOptionName } ` ) ) return option;
		if ( normalizedMeshName.startsWith( `${ normalizedOptionName }_` ) ) return option;
		if ( normalizedMeshName.startsWith( `${ normalizedOptionName }.` ) ) return option;

	}

	return null;

}

export function applyBalaclavaSelection( characterRoot, balaclavaId ) {

	if ( ! characterRoot || typeof characterRoot.traverse !== 'function' ) return;

	const selectedOption = getBalaclavaOptionById( balaclavaId );

	characterRoot.traverse( ( child ) => {

		if ( ! child ) return;

		const option = resolveBalaclavaOptionByMeshName( child.name );
		if ( ! option ) return;

		child.visible = option.id === selectedOption.id;

	} );

}

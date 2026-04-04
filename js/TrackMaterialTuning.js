const FLAT_MATERIAL_COLORS = {
	asphalt: 0x303030,
	concrete: 0x7a7a7a,
	rubber: 0xff8f8f,
};

export function getTrackSurfaceMode( search = '' ) {

	const params = new URLSearchParams( search.startsWith( '?' ) ? search.slice( 1 ) : search );
	return params.get( 'surface' ) === 'flat-materials' ? 'flat-materials' : 'default';

}

export function tuneTrackMaterial( material, options = {} ) {

	if ( ! material ) return material;

	// The standard-map asphalt normal map is not tileable at the texture edges,
	// so repeating it per tile creates visible dark seams between track pieces.
	if ( material.name === 'asphalt' && material.normalMap ) {

		material.normalMap = null;
		material.needsUpdate = true;

	}

	if ( options.surfaceMode === 'flat-materials' ) {

		applyFlatTrackMaterial( material );

	}

	return material;

}

function applyFlatTrackMaterial( material ) {

	const color = FLAT_MATERIAL_COLORS[ material.name ];
	if ( color === undefined ) return;

	material.map = null;
	material.normalMap = null;
	material.roughnessMap = null;
	material.metalnessMap = null;
	material.emissiveMap = null;
	material.alphaMap = null;
	material.aoMap = null;
	material.lightMap = null;
	material.transparent = false;
	material.opacity = 1;
	material.alphaTest = 0;
	material.depthWrite = true;

	if ( material.color?.setHex ) material.color.setHex( color );
	if ( material.emissive?.setHex ) material.emissive.setHex( 0x000000 );
	if ( 'roughness' in material ) material.roughness = 1;
	if ( 'metalness' in material ) material.metalness = 0;

	material.needsUpdate = true;

}

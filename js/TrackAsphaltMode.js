export function getTrackAsphaltMode( search = '' ) {

	const params = new URLSearchParams( search.startsWith( '?' ) ? search.slice( 1 ) : search );
	return params.get( 'surface' ) === 'opaque-asphalt' ? 'opaque-asphalt' : 'default';

}

export function applyTrackAsphaltMode( material, options = {} ) {

	if ( ! material ) return material;
	if ( options.asphaltMode !== 'opaque-asphalt' ) return material;
	if ( material.name !== 'asphalt' ) return material;

	material.transparent = false;
	material.opacity = 1;
	material.alphaTest = 0;
	material.depthWrite = true;
	material.needsUpdate = true;
	return material;

}

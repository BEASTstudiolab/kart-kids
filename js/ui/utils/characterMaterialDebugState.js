function isFiniteNumber( value ) {

	return Number.isFinite( Number( value ) );

}

function numbersEqual( left, right, epsilon = 1e-6 ) {

	if ( ! isFiniteNumber( left ) && ! isFiniteNumber( right ) ) return true;
	return Math.abs( Number( left ) - Number( right ) ) <= epsilon;

}

function colorsEqual( left, right ) {

	if ( ! left && ! right ) return true;
	if ( ! left || ! right ) return false;
	return numbersEqual( left.r, right.r ) &&
		numbersEqual( left.g, right.g ) &&
		numbersEqual( left.b, right.b );

}

function vectorsEqual( left, right ) {

	if ( ! left && ! right ) return true;
	if ( ! left || ! right ) return false;
	return numbersEqual( left.x, right.x ) &&
		numbersEqual( left.y, right.y );

}

export function areCharacterMaterialDebugStatesEquivalent( left, right ) {

	if ( left === right ) return true;
	if ( ! left || ! right ) return false;

	return numbersEqual( left.textureFidelity, right.textureFidelity ) &&
		colorsEqual( left.color, right.color ) &&
		colorsEqual( left.emissive, right.emissive ) &&
		numbersEqual( left.emissiveIntensity, right.emissiveIntensity ) &&
		vectorsEqual( left.normalScale, right.normalScale ) &&
		numbersEqual( left.aoMapIntensity, right.aoMapIntensity ) &&
		numbersEqual( left.roughness, right.roughness ) &&
		numbersEqual( left.metalness, right.metalness ) &&
		numbersEqual( left.envMapIntensity, right.envMapIntensity ) &&
		numbersEqual( left.opacity, right.opacity ) &&
		numbersEqual( left.alphaTest, right.alphaTest ) &&
		( left.doubleSided !== false ) === ( right.doubleSided !== false ) &&
		!! left.wireframe === !! right.wireframe &&
		!! left.flatShading === !! right.flatShading &&
		( left.depthWrite !== false ) === ( right.depthWrite !== false ) &&
		!! left.transparent === !! right.transparent &&
		!! left.mapEnabled === !! right.mapEnabled &&
		!! left.normalMapEnabled === !! right.normalMapEnabled &&
		!! left.aoMapEnabled === !! right.aoMapEnabled &&
		!! left.roughnessMapEnabled === !! right.roughnessMapEnabled &&
		!! left.metalnessMapEnabled === !! right.metalnessMapEnabled &&
		!! left.emissiveMapEnabled === !! right.emissiveMapEnabled &&
		!! left.alphaMapEnabled === !! right.alphaMapEnabled;

}

export function shouldAdoptCharacterMaterialDebugBaseline( currentState, previousBaseline ) {

	if ( ! currentState ) return true;
	if ( ! previousBaseline ) return false;
	return areCharacterMaterialDebugStatesEquivalent( currentState, previousBaseline );

}

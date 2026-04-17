function normalizeMeshName( value ) {

	return typeof value === 'string' ? value.trim().toLowerCase() : '';

}

function normalizeMaterialName( value ) {

	return typeof value === 'string' ? value.trim() : '';

}

function normalizeImageUri( value ) {

	return typeof value === 'string' ? value : '';

}

function isMeshNode( node ) {

	return !! ( node?.isMesh || node?.isSkinnedMesh );

}

function asMaterialList( material ) {

	if ( Array.isArray( material ) ) return material.filter( Boolean );
	return material ? [ material ] : [];

}

function resolveRuntimeTextureUri( texture ) {

	if ( ! texture ) return '';

	const candidates = [
		texture?.source?.data?.currentSrc,
		texture?.source?.data?.src,
		texture?.image?.currentSrc,
		texture?.image?.src,
		texture?.userData?.src,
		texture?.name,
	];

	for ( const candidate of candidates ) {

		if ( typeof candidate === 'string' && candidate ) return candidate;

	}

	return '';

}

function getBaseColorTextureIndex( materialDef ) {

	const index = materialDef?.pbrMetallicRoughness?.baseColorTexture?.index;
	return Number.isInteger( index ) ? index : null;

}

export function isVehicleBodyMeshName( value ) {

	const normalized = normalizeMeshName( value );
	return normalized === 'body' || normalized.startsWith( 'body.' );

}

export function inspectRuntimeVehiclePaintMaterial( material ) {

	const baseColorTexture = material?.map || null;
	return {
		materialName: normalizeMaterialName( material?.name ),
		hasBaseColorTexture: !! baseColorTexture,
		baseColorTextureUri: resolveRuntimeTextureUri( baseColorTexture ),
		tintMode: baseColorTexture ? 'texture-multiply' : 'flat-color',
	};

}

export function collectVehiclePaintTargetsFromObject3D( root ) {

	const bodyMeshes = [];
	root?.traverse?.( ( child ) => {

		if ( ! isMeshNode( child ) ) return;
		if ( ! isVehicleBodyMeshName( child?.name ) ) return;

		const materials = asMaterialList( child.material ).map( inspectRuntimeVehiclePaintMaterial );
		bodyMeshes.push( {
			meshName: typeof child?.name === 'string' ? child.name : '',
			materialCount: materials.length,
			materials,
		} );

	} );

	return bodyMeshes;

}

export function inspectVehiclePaintMaterialDefinition( materialDef, { textures = [], images = [] } = {} ) {

	const baseColorTextureIndex = getBaseColorTextureIndex( materialDef );
	const textureDef = baseColorTextureIndex !== null ? textures[ baseColorTextureIndex ] || null : null;
	const imageDef = Number.isInteger( textureDef?.source ) ? images[ textureDef.source ] || null : null;
	const baseColorFactor = Array.isArray( materialDef?.pbrMetallicRoughness?.baseColorFactor )
		? materialDef.pbrMetallicRoughness.baseColorFactor.slice( 0, 4 )
		: null;

	return {
		materialName: normalizeMaterialName( materialDef?.name ),
		baseColorTextureIndex,
		hasBaseColorTexture: baseColorTextureIndex !== null,
		baseColorImageUri: normalizeImageUri( imageDef?.uri ),
		baseColorFactor,
		tintMode: baseColorTextureIndex !== null ? 'texture-multiply' : 'flat-color',
	};

}

export function describeVehiclePaintTargetsFromGltf( gltfJson = {} ) {

	const meshes = Array.isArray( gltfJson?.meshes ) ? gltfJson.meshes : [];
	const materials = Array.isArray( gltfJson?.materials ) ? gltfJson.materials : [];
	const textures = Array.isArray( gltfJson?.textures ) ? gltfJson.textures : [];
	const images = Array.isArray( gltfJson?.images ) ? gltfJson.images : [];
	const bodyMeshes = [];

	for ( const meshDef of meshes ) {

		if ( ! isVehicleBodyMeshName( meshDef?.name ) ) continue;

		const primitives = Array.isArray( meshDef?.primitives ) ? meshDef.primitives : [];
		const materialReports = primitives.map( ( primitiveDef ) => {

			const materialIndex = Number.isInteger( primitiveDef?.material ) ? primitiveDef.material : null;
			const materialDef = materialIndex !== null ? materials[ materialIndex ] || null : null;
			return {
				materialIndex,
				...inspectVehiclePaintMaterialDefinition( materialDef, { textures, images } ),
			};

		} );

		bodyMeshes.push( {
			meshName: typeof meshDef?.name === 'string' ? meshDef.name : '',
			primitiveCount: primitives.length,
			materials: materialReports,
		} );

	}

	return bodyMeshes;

}

export function summarizeVehiclePaintabilityFromGltf( gltfJson = {} ) {

	const bodyMeshes = describeVehiclePaintTargetsFromGltf( gltfJson );
	const usesTexturedBaseColor = bodyMeshes.some( ( meshReport ) =>
		meshReport.materials.some( ( materialReport ) => materialReport.tintMode === 'texture-multiply' )
	);

	return {
		bodyMeshCount: bodyMeshes.length,
		bodyMeshes,
		usesTexturedBaseColor,
		supportsFlatTintWithoutTexture: bodyMeshes.length > 0 && ! usesTexturedBaseColor,
	};

}

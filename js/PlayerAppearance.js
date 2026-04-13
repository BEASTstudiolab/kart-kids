const COLOR_HEX_RE = /^#[0-9a-f]{6}$/i;
const SKIN_MATERIAL_NAME = 'Test Skin';
const ORIGINAL_MATERIAL_KEY = '_kkOriginalMaterial';

export const ACCESSORY_DEFS = Object.freeze( [
	Object.freeze( { key: 'Balaclava_No_Ears', label: 'Balaclava', meshes: Object.freeze( [ 'Balaclava_No_Ears' ] ) } ),
	Object.freeze( { key: 'Baseball_Hat', label: 'Baseball Hat', meshes: Object.freeze( [ 'Baseball_Hat_1', 'Baseball_Hat_2' ] ) } ),
	Object.freeze( { key: 'Gold_Chain', label: 'Gold Chain', meshes: Object.freeze( [ 'Gold_Chain' ] ) } ),
	Object.freeze( { key: 'Jeans', label: 'Jeans', meshes: Object.freeze( [ 'Jeans' ] ) } ),
	Object.freeze( { key: 'Tshirt', label: 'T-Shirt', meshes: Object.freeze( [ 'Tshirt' ] ) } ),
	Object.freeze( { key: 'Mask_Basic', label: 'Mask', meshes: Object.freeze( [ 'Mask_Basic' ] ) } ),
] );

const ACCESSORY_BY_MESH = new Map();
for ( const def of ACCESSORY_DEFS ) {

	for ( const meshName of def.meshes ) {

		ACCESSORY_BY_MESH.set( meshName, def );

	}

}

export function normalizeAppearanceColor( value ) {

	if ( typeof value !== 'string' ) return '';

	const trimmed = value.trim();
	return COLOR_HEX_RE.test( trimmed ) ? trimmed.toLowerCase() : '';

}

export function createDefaultCharacterAccessories() {

	const accessories = {};

	for ( const def of ACCESSORY_DEFS ) {

		accessories[ def.key ] = { visible: true, color: '' };

	}

	return accessories;

}

export function createDefaultPlayerAppearance() {

	return {
		vehicleColor: '',
		characterColor: '',
		charSkinColor: '',
		charAccessories: createDefaultCharacterAccessories(),
	};

}

export function normalizePlayerAppearance( rawAppearance = {} ) {

	const defaults = createDefaultPlayerAppearance();
	const sourceAppearance = rawAppearance && typeof rawAppearance === 'object'
		? rawAppearance
		: {};
	const sourceAccessories = sourceAppearance.charAccessories && typeof sourceAppearance.charAccessories === 'object'
		? sourceAppearance.charAccessories
		: sourceAppearance.accessories && typeof sourceAppearance.accessories === 'object'
			? sourceAppearance.accessories
			: {};
	const normalizedAccessories = createDefaultCharacterAccessories();

	for ( const def of ACCESSORY_DEFS ) {

		const source = sourceAccessories[ def.key ] || {};
		normalizedAccessories[ def.key ] = {
			visible: source.visible !== false,
			color: normalizeAppearanceColor( source.color ),
		};

	}

	return {
		...defaults,
		vehicleColor: normalizeAppearanceColor( sourceAppearance.vehicleColor ),
		characterColor: normalizeAppearanceColor( sourceAppearance.characterColor ),
		charSkinColor: normalizeAppearanceColor( sourceAppearance.charSkinColor ),
		charAccessories: normalizedAccessories,
	};

}

export function getPlayerAppearanceFromSettings( settings ) {

	return normalizePlayerAppearance( {
		vehicleColor: settings.get( 'vehicleColor' ),
		characterColor: settings.get( 'characterColor' ),
		charSkinColor: settings.get( 'charSkinColor' ),
		charAccessories: settings.get( 'charAccessories' ),
	} );

}

export function getVisibleAccessoryLabels( appearance ) {

	const normalized = normalizePlayerAppearance( appearance );

	return ACCESSORY_DEFS
		.filter( ( def ) => normalized.charAccessories[ def.key ]?.visible !== false )
		.map( ( def ) => def.label );

}

function _isMeshNode( child ) {

	return child?.isMesh || child?.isSkinnedMesh;

}

function _getOriginalMaterials( child ) {

	if ( ! Object.prototype.hasOwnProperty.call( child, ORIGINAL_MATERIAL_KEY ) ) {

		child[ ORIGINAL_MATERIAL_KEY ] = child.material;

	}

	return child[ ORIGINAL_MATERIAL_KEY ];

}

function _asMaterialList( material ) {

	if ( Array.isArray( material ) ) return material;
	return material ? [ material ] : [];

}

function _disposeDetachedMaterials( child, nextMaterial ) {

	const originalList = _asMaterialList( _getOriginalMaterials( child ) );
	const currentList = _asMaterialList( child.material );
	const nextList = _asMaterialList( nextMaterial );

	for ( const material of currentList ) {

		if ( ! material ) continue;
		if ( originalList.includes( material ) ) continue;
		if ( nextList.includes( material ) ) continue;
		if ( typeof material.dispose === 'function' ) material.dispose();

	}

}

function _setMaterialFromOriginal( child, buildMaterial ) {

	const originalMaterial = _getOriginalMaterials( child );
	const originalList = _asMaterialList( originalMaterial );
	let nextList = originalList;
	let changed = false;

	for ( let i = 0; i < originalList.length; i ++ ) {

		const nextMaterial = buildMaterial( originalList[ i ], i );
		if ( nextMaterial !== originalList[ i ] ) {

			if ( ! changed ) {

				nextList = originalList.slice();
				changed = true;

			}

			nextList[ i ] = nextMaterial;

		}

	}

	const nextMaterial = Array.isArray( originalMaterial ) ? nextList : nextList[ 0 ];
	_disposeDetachedMaterials( child, nextMaterial );
	child.material = nextMaterial;

}

function _cloneMaterialWithColor( material, color ) {

	if ( ! material?.clone ) return material;

	const cloned = material.clone();
	if ( cloned.color ) cloned.color.set( color );
	return cloned;

}

export function applyVehicleAppearance( bodyRoot, appearance ) {

	if ( ! bodyRoot ) return;

	const normalized = normalizePlayerAppearance( appearance );
	const vehicleColor = normalized.vehicleColor;

	bodyRoot.traverse( ( child ) => {

		if ( ! _isMeshNode( child ) ) return;

		_setMaterialFromOriginal( child, ( originalMaterial ) => {

			if ( ! vehicleColor || ! originalMaterial?.color ) return originalMaterial;
			return _cloneMaterialWithColor( originalMaterial, vehicleColor );

		} );

	} );

}

export function applyCharacterAppearance( characterRoot, appearance ) {

	if ( ! characterRoot ) return;

	const normalized = normalizePlayerAppearance( appearance );

	characterRoot.traverse( ( child ) => {

		if ( ! _isMeshNode( child ) ) return;

		const accessoryDef = ACCESSORY_BY_MESH.get( child.name );
		const accessoryState = accessoryDef ? normalized.charAccessories[ accessoryDef.key ] : null;
		if ( accessoryState ) {

			child.visible = accessoryState.visible !== false;

		}

		_setMaterialFromOriginal( child, ( originalMaterial ) => {

			const materialName = originalMaterial?.name || '';
			const isSkin = materialName === SKIN_MATERIAL_NAME;

			if ( isSkin ) {

				if ( ! normalized.charSkinColor || ! originalMaterial?.color ) return originalMaterial;
				return _cloneMaterialWithColor( originalMaterial, normalized.charSkinColor );

			}

			let tintColor = '';

			if ( accessoryState?.color ) {

				tintColor = accessoryState.color;

			} else if ( normalized.characterColor ) {

				tintColor = normalized.characterColor;

			}

			if ( ! tintColor || ! originalMaterial?.color ) return originalMaterial;
			return _cloneMaterialWithColor( originalMaterial, tintColor );

		} );

	} );

}

export function applyPlayerAppearanceToNodes( { bodyRoot = null, characterRoot = null } = {}, appearance ) {

	const normalized = normalizePlayerAppearance( appearance );
	applyVehicleAppearance( bodyRoot, normalized );
	applyCharacterAppearance( characterRoot, normalized );
	return normalized;

}

export function applyPlayerAppearanceToVehicle( vehicle, appearance ) {

	if ( ! vehicle ) return normalizePlayerAppearance( appearance );

	return applyPlayerAppearanceToNodes( {
		bodyRoot: vehicle.bodyNode || null,
		characterRoot: vehicle.characterModel || null,
	}, appearance );

}

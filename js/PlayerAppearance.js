import {
	CHARACTER_ACCESSORY_DEFS,
	DEFAULT_BALACLAVA_ID,
	applyBalaclavaSelection,
	getBalaclavaOptionById,
	normalizeCharacterMeshName,
	normalizeSelectedBalaclavaId,
	resolveBalaclavaOptionByMeshName,
} from './CharacterCustomization.js';

const COLOR_HEX_RE = /^#[0-9a-f]{6}$/i;
const SKIN_MATERIAL_NAME = 'Test Skin';
const ORIGINAL_MATERIAL_KEY = '_kkOriginalMaterial';
export const DEFAULT_MASK_TINT_COLOR = '#ffffff';
const NON_HIDEABLE_ACCESSORY_KEYS = new Set( [ 'Jeans', 'Boots' ] );

export const ACCESSORY_DEFS = CHARACTER_ACCESSORY_DEFS;

const ACCESSORY_BY_MESH = new Map();
const ACCESSORY_BY_MATERIAL = new Map();
for ( const def of ACCESSORY_DEFS ) {

	for ( const meshName of def.meshes || [] ) {

		ACCESSORY_BY_MESH.set( normalizeCharacterMeshName( meshName ), def );

	}

	for ( const materialName of def.materials || [] ) {

		ACCESSORY_BY_MATERIAL.set( normalizeCharacterMeshName( materialName ), def );

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
		maskTintMainColor: '',
		maskTintSecondaryColor: '',
		selectedBalaclavaId: DEFAULT_BALACLAVA_ID,
		charAccessories: createDefaultCharacterAccessories(),
	};

}

export function createDefaultAIAppearance( selectedBalaclavaId = DEFAULT_BALACLAVA_ID ) {

	const appearance = createDefaultPlayerAppearance();
	appearance.selectedBalaclavaId = normalizeSelectedBalaclavaId( selectedBalaclavaId );

	if ( appearance.charAccessories.Baseball_Hat ) {

		appearance.charAccessories.Baseball_Hat.visible = false;

	}

	return appearance;

}

export function normalizeMaskTintColor( value ) {

	return normalizeAppearanceColor( value );

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
			visible: NON_HIDEABLE_ACCESSORY_KEYS.has( def.key ) ? true : source.visible !== false,
			color: normalizeAppearanceColor( source.color ),
		};

	}

	return {
		...defaults,
		vehicleColor: normalizeAppearanceColor( sourceAppearance.vehicleColor ),
		characterColor: normalizeAppearanceColor( sourceAppearance.characterColor ),
		charSkinColor: normalizeAppearanceColor( sourceAppearance.charSkinColor ),
		maskTintMainColor: normalizeMaskTintColor( sourceAppearance.maskTintMainColor ),
		maskTintSecondaryColor: normalizeMaskTintColor( sourceAppearance.maskTintSecondaryColor ),
		selectedBalaclavaId: normalizeSelectedBalaclavaId( sourceAppearance.selectedBalaclavaId ),
		charAccessories: normalizedAccessories,
	};

}

export function getPlayerAppearanceFromSettings( settings ) {

	return normalizePlayerAppearance( {
		vehicleColor: settings.get( 'vehicleColor' ),
		characterColor: settings.get( 'characterColor' ),
		charSkinColor: settings.get( 'charSkinColor' ),
		maskTintMainColor: settings.get( 'maskTintMainColor' ),
		maskTintSecondaryColor: settings.get( 'maskTintSecondaryColor' ),
		selectedBalaclavaId: settings.get( 'selectedBalaclavaId' ),
		charAccessories: settings.get( 'charAccessories' ),
	} );

}

export function getVisibleAccessoryLabels( appearance ) {

	const normalized = normalizePlayerAppearance( appearance );
	const selectedBalaclava = getBalaclavaOptionById( normalized.selectedBalaclavaId );
	const visibleLabels = [];

	if ( selectedBalaclava ) {

		visibleLabels.push( selectedBalaclava.label );

	}

	visibleLabels.push( ...ACCESSORY_DEFS
		.filter( ( def ) => normalized.charAccessories[ def.key ]?.visible !== false )
		.map( ( def ) => def.label ) );

	return visibleLabels;

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
	applyBalaclavaSelection( characterRoot, normalized.selectedBalaclavaId );

	characterRoot.traverse( ( child ) => {

		if ( ! _isMeshNode( child ) ) return;

		const meshAccessoryDef = ACCESSORY_BY_MESH.get( normalizeCharacterMeshName( child.name ) );
		const meshAccessoryState = meshAccessoryDef ? normalized.charAccessories[ meshAccessoryDef.key ] : null;
		const balaclavaOption = resolveBalaclavaOptionByMeshName( child.name );
		if ( meshAccessoryState ) {

			child.visible = meshAccessoryState.visible !== false;

		}

		_setMaterialFromOriginal( child, ( originalMaterial ) => {

			const materialName = originalMaterial?.name || '';
			const isSkin = materialName === SKIN_MATERIAL_NAME;

			if ( isSkin ) {

				if ( ! normalized.charSkinColor || ! originalMaterial?.color ) return originalMaterial;
				return _cloneMaterialWithColor( originalMaterial, normalized.charSkinColor );

			}

			if ( balaclavaOption ) {

				if ( ! normalized.maskTintMainColor || ! originalMaterial?.color ) return originalMaterial;
				return _cloneMaterialWithColor( originalMaterial, normalized.maskTintMainColor );

			}

			const materialAccessoryDef = ACCESSORY_BY_MATERIAL.get( normalizeCharacterMeshName( originalMaterial?.name || '' ) );
			const materialAccessoryState = materialAccessoryDef ? normalized.charAccessories[ materialAccessoryDef.key ] : null;
			const tintColor = meshAccessoryState?.color || materialAccessoryState?.color || '';

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

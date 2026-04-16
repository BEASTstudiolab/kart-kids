const NORMAL_INTENSITY_MIN = 0;
const NORMAL_INTENSITY_MAX = 3;
const ORIGINAL_NORMAL_SCALE_KEY = '_kkMenuOriginalNormalScale';

export const MENU_CHARACTER_MATERIAL_DEBUG_DEFAULTS = Object.freeze( {
	maskNormalIntensity: 0.20,
	jeansNormalIntensity: 1.0,
	shirtNormalIntensity: 1.0,
} );

const _sharedMaterialDebugTuning = {
	...MENU_CHARACTER_MATERIAL_DEBUG_DEFAULTS,
};

let _materialDebugVersion = 0;

const MATERIAL_TARGETS = Object.freeze( {
	maskNormalIntensity: Object.freeze( new Set( [ 'masks batch' ] ) ),
	jeansNormalIntensity: Object.freeze( new Set( [ 'washed_denim.002' ] ) ),
	shirtNormalIntensity: Object.freeze( new Set( [ 'charcoal.002' ] ) ),
} );

function clampNumber( value, min, max, fallback ) {

	const numericValue = Number( value );
	if ( ! Number.isFinite( numericValue ) ) return fallback;

	return Math.min( max, Math.max( min, numericValue ) );

}

function normalizeMaterialName( materialName ) {

	if ( typeof materialName !== 'string' ) return '';

	return materialName.trim().toLowerCase();

}

function asMaterialList( material ) {

	if ( Array.isArray( material ) ) return material;
	return material ? [ material ] : [];

}

function ensureNormalScale( material ) {

	if ( material?.normalScale ) return material.normalScale;

	if ( ! material ) return null;

	material.normalScale = { x: 1, y: 1 };
	return material.normalScale;

}

function setNormalScale( normalScale, x, y ) {

	if ( ! normalScale ) return;

	if ( typeof normalScale.set === 'function' ) {

		normalScale.set( x, y );
		return;

	}

	normalScale.x = x;
	normalScale.y = y;

}

function getMaterialDebugKey( materialName ) {

	const normalizedName = normalizeMaterialName( materialName );

	for ( const [ tuningKey, materialNames ] of Object.entries( MATERIAL_TARGETS ) ) {

		if ( materialNames.has( normalizedName ) ) return tuningKey;

	}

	return '';

}

export function getMenuCharacterMaterialDebugTuning() {

	return {
		..._sharedMaterialDebugTuning,
	};

}

export function getMenuCharacterMaterialDebugVersion() {

	return _materialDebugVersion;

}

export function setMenuCharacterMaterialDebugTuning( partialTuning = {} ) {

	let changed = false;

	for ( const [ key, defaultValue ] of Object.entries( MENU_CHARACTER_MATERIAL_DEBUG_DEFAULTS ) ) {

		if ( ! Object.prototype.hasOwnProperty.call( partialTuning, key ) ) continue;

		const nextValue = clampNumber(
			partialTuning[ key ],
			NORMAL_INTENSITY_MIN,
			NORMAL_INTENSITY_MAX,
			defaultValue
		);

		if ( _sharedMaterialDebugTuning[ key ] === nextValue ) continue;

		_sharedMaterialDebugTuning[ key ] = nextValue;
		changed = true;

	}

	if ( changed ) {

		_materialDebugVersion += 1;

	}

	return getMenuCharacterMaterialDebugTuning();

}

export function applyMenuCharacterMaterialDebugTuning( characterRoot ) {

	if ( ! characterRoot || typeof characterRoot.traverse !== 'function' ) return 0;

	const tuning = getMenuCharacterMaterialDebugTuning();
	let appliedMaterialCount = 0;

	characterRoot.traverse( ( child ) => {

		if ( ! child?.isMesh && ! child?.isSkinnedMesh ) return;

		for ( const material of asMaterialList( child.material ) ) {

			const tuningKey = getMaterialDebugKey( material?.name );
			if ( ! tuningKey ) continue;

			const normalScale = ensureNormalScale( material );
			if ( ! normalScale ) continue;

			const originalNormalScale = material.userData?.[ ORIGINAL_NORMAL_SCALE_KEY ] || {
				x: Number( normalScale.x ) || 1,
				y: Number( normalScale.y ) || 1,
			};

			if ( ! material.userData ) material.userData = {};
			material.userData[ ORIGINAL_NORMAL_SCALE_KEY ] = originalNormalScale;

			const intensity = tuning[ tuningKey ] ?? 1;
			setNormalScale(
				normalScale,
				originalNormalScale.x * intensity,
				originalNormalScale.y * intensity
			);
			appliedMaterialCount += 1;

		}

	} );

	return appliedMaterialCount;

}

import * as THREE from 'three';
import {
	DEFAULT_TRACK_THEME_ID,
	normalizeTrackThemeId,
	resolveTrackThemeTexturePath,
} from './TrackThemeRegistry.js';

const materialThemeState = new WeakMap();
const texturePromiseCache = new Map();

let textureLoader = null;

function getTextureLoader() {

	if ( ! textureLoader ) textureLoader = new THREE.TextureLoader();
	return textureLoader;

}

function getAtlasSlotForMaterial( material ) {

	const name = String( material?.name || '' ).trim().toLowerCase();
	if ( name === 'asphalt 2' ) return 2;
	if ( name === 'asphalt' || name === 'asphalt 1' ) return 1;
	return null;

}

function isThemedTrackMaterial( material ) {

	return getAtlasSlotForMaterial( material ) !== null;

}

function captureMaterialState( material ) {

	let state = materialThemeState.get( material );
	if ( state ) return state;

	state = {
		atlasSlot: getAtlasSlotForMaterial( material ),
		original: {
			map: material.map ?? null,
			normalMap: material.normalMap ?? null,
			aoMap: material.aoMap ?? null,
			roughnessMap: material.roughnessMap ?? null,
			metalnessMap: material.metalnessMap ?? null,
			emissiveMap: material.emissiveMap ?? null,
			emissive: material.emissive?.clone?.() ?? new THREE.Color( 0x000000 ),
			emissiveIntensity: material.emissiveIntensity ?? 1,
		},
		appliedThemeId: null,
	};

	materialThemeState.set( material, state );
	return state;

}

function copyTextureSettings( texture, referenceTexture, textureKind ) {

	if ( referenceTexture ) {

		texture.wrapS = referenceTexture.wrapS;
		texture.wrapT = referenceTexture.wrapT;
		texture.magFilter = referenceTexture.magFilter;
		texture.minFilter = referenceTexture.minFilter;
		texture.anisotropy = referenceTexture.anisotropy;
		texture.rotation = referenceTexture.rotation;
		texture.center.copy( referenceTexture.center );
		texture.offset.copy( referenceTexture.offset );
		texture.repeat.copy( referenceTexture.repeat );

	}

	texture.flipY = false;
	texture.colorSpace = textureKind === 'BaseColor' || textureKind === 'Emissive'
		? THREE.SRGBColorSpace
		: THREE.NoColorSpace;
	texture.needsUpdate = true;

	return texture;

}

function loadTextureCached( path, textureKind, referenceTexture, { optional = false } = {} ) {

	let promise = texturePromiseCache.get( path );
	if ( ! promise ) {

		promise = getTextureLoader().loadAsync( encodeURI( path ) )
			.then( ( texture ) => {

				texture.name = path.split( '/' ).pop() || path;
				return copyTextureSettings( texture, referenceTexture, textureKind );

			} )
			.catch( ( err ) => {

				texturePromiseCache.delete( path );
				if ( optional ) return null;
				throw err;

			} );

		texturePromiseCache.set( path, promise );

	}

	return promise.then( ( texture ) => {

		if ( texture ) copyTextureSettings( texture, referenceTexture, textureKind );
		return texture;

	} );

}

function restoreOriginalThemeTextures( material, state ) {

	material.map = state.original.map;
	material.normalMap = state.original.normalMap;
	material.aoMap = state.original.aoMap;
	material.roughnessMap = state.original.roughnessMap;
	material.metalnessMap = state.original.metalnessMap;
	material.emissiveMap = state.original.emissiveMap;

	if ( material.emissive ) material.emissive.copy( state.original.emissive );
	material.emissiveIntensity = state.original.emissiveIntensity;
	material.needsUpdate = true;
	state.appliedThemeId = DEFAULT_TRACK_THEME_ID;

}

async function applyTrackThemeToMaterial( material, themeId = DEFAULT_TRACK_THEME_ID ) {

	if ( ! material || ! isThemedTrackMaterial( material ) ) return false;

	const resolvedThemeId = normalizeTrackThemeId( themeId );
	const state = captureMaterialState( material );
	if ( ! state.atlasSlot ) return false;
	if ( state.appliedThemeId === resolvedThemeId ) return false;

	if ( resolvedThemeId === DEFAULT_TRACK_THEME_ID ) {

		restoreOriginalThemeTextures( material, state );
		return true;

	}

	const atlasSlot = state.atlasSlot;
	const baseColorPath = resolveTrackThemeTexturePath( resolvedThemeId, atlasSlot, 'BaseColor' );
	const normalPath = resolveTrackThemeTexturePath( resolvedThemeId, atlasSlot, 'Normal' );
	const ormPath = resolveTrackThemeTexturePath( resolvedThemeId, atlasSlot, 'OcclusionRoughnessMetallic' );
	const emissivePath = resolveTrackThemeTexturePath( resolvedThemeId, atlasSlot, 'Emissive' );

	const [ baseColor, normal, orm, emissive ] = await Promise.all( [
		loadTextureCached( baseColorPath, 'BaseColor', state.original.map ),
		loadTextureCached( normalPath, 'Normal', state.original.normalMap ),
		loadTextureCached( ormPath, 'OcclusionRoughnessMetallic', state.original.aoMap || state.original.roughnessMap || state.original.metalnessMap ),
		loadTextureCached( emissivePath, 'Emissive', state.original.emissiveMap, { optional: true } ),
	] );

	material.map = baseColor;
	material.normalMap = normal;
	material.aoMap = orm;
	material.roughnessMap = orm;
	material.metalnessMap = orm;

	if ( emissive ) {

		material.emissiveMap = emissive;
		if ( material.emissive ) material.emissive.setScalar( 1 );
		material.emissiveIntensity = 1;

	} else {

		material.emissiveMap = state.original.emissiveMap;
		if ( material.emissive ) material.emissive.copy( state.original.emissive );
		material.emissiveIntensity = state.original.emissiveIntensity;

	}

	material.needsUpdate = true;
	state.appliedThemeId = resolvedThemeId;
	return true;

}

async function applyTrackThemeToObject3D( root, themeId = DEFAULT_TRACK_THEME_ID ) {

	if ( ! root ) return false;

	const materials = new Set();
	root.traverse( ( child ) => {

		if ( ! child.isMesh ) return;

		if ( Array.isArray( child.material ) ) {

			for ( const material of child.material ) {

				if ( material ) materials.add( material );

			}

		} else if ( child.material ) {

			materials.add( child.material );

		}

	} );

	let changed = false;
	await Promise.all( [ ...materials ].map( async ( material ) => {

		changed = ( await applyTrackThemeToMaterial( material, themeId ) ) || changed;

	} ) );
	return changed;

}

export {
	applyTrackThemeToMaterial,
	applyTrackThemeToObject3D,
	isThemedTrackMaterial,
};

import * as THREE from 'three';
import { BOOST_MARKER_MODEL_ID, TERRAIN_TILE_ID } from './track-editor/constants/EditorAssetIds.js';
import { getTrackAppearanceTargetList, normalizeTrackAppearance } from './TrackAppearance.js';

const _tintColor = new THREE.Color();
const _hsl = { h: 0, s: 0, l: 0 };

export function getAppearanceTargetForModel( modelName ) {

	if ( modelName === TERRAIN_TILE_ID ) return 'terrain';
	if ( modelName === BOOST_MARKER_MODEL_ID ) return 'boost';
	if ( typeof modelName === 'string' && modelName.startsWith( 'trk-' ) ) return 'track';
	return null;

}

export function tagObject3DAppearanceTarget( root, targetId ) {

	if ( ! root || ! targetId ) return root;

	root.userData.appearanceTarget = targetId;
	root.traverse( ( child ) => {

		if ( child.isMesh || child.isGroup || child.isObject3D ) child.userData.appearanceTarget = targetId;

	} );

	return root;

}

function getTargetIdForObject3D( object ) {

	let cursor = object;
	while ( cursor ) {

		if ( cursor.userData?.appearanceTarget ) return cursor.userData.appearanceTarget;
		cursor = cursor.parent ?? null;

	}

	return null;

}

function isAppearanceEligibleMaterial( material, targetId ) {

	if ( ! material?.isMeshStandardMaterial || ! material.emissive ) return false;
	if ( targetId === 'boost' ) return true;
	if ( material.emissiveMap ) return true;

	const name = String( material.name || '' ).trim().toLowerCase();
	return name === 'asphalt' || name === 'asphalt 1' || name === 'asphalt 2';

}

function resolveTargetTintColor( targetSettings, timeSeconds ) {

	_tintColor.set( targetSettings.color );
	if ( ! targetSettings?.hueShiftEnabled ) return _tintColor;

	_tintColor.getHSL( _hsl );
	const baseHue = Number.isFinite( _hsl.h ) ? _hsl.h : 0;
	const hueOffset = ( Number( timeSeconds ) || 0 ) * ( targetSettings.hueShiftSpeed || 0 );
	const shiftedHue = ( ( baseHue + hueOffset ) % 1 + 1 ) % 1;
	const saturation = _hsl.s > 0.05 ? _hsl.s : 1.0;
	const lightness = _hsl.s > 0.05 ? _hsl.l : 0.5;
	return _tintColor.setHSL( shiftedHue, saturation, lightness );

}

export function applyTrackAppearanceToObject3D( root, appearance, timeSeconds = 0 ) {

	if ( ! root ) return [];

	const normalized = normalizeTrackAppearance( appearance );
	const appliedTargets = new Set();

	root.traverse( ( child ) => {

		if ( ! child.isMesh || ! child.material ) return;

		const targetId = getTargetIdForObject3D( child );
		if ( ! targetId ) return;

		const targetSettings = normalized.targets[ targetId ];
		if ( ! targetSettings ) return;

		const materials = Array.isArray( child.material ) ? child.material : [ child.material ];
		for ( const material of materials ) {

			if ( ! isAppearanceEligibleMaterial( material, targetId ) ) continue;
			material.emissive.copy( resolveTargetTintColor( targetSettings, timeSeconds ) );
			material.emissiveIntensity = targetSettings.intensity;
			appliedTargets.add( targetId );

		}

	} );

	return [ ...appliedTargets ];

}

export function applyTrackAppearanceToModelMap( models, appearance, timeSeconds = 0 ) {

	if ( ! models || typeof models !== 'object' ) return [];

	const appliedTargets = new Set();
	for ( const model of Object.values( models ) ) {

		for ( const targetId of applyTrackAppearanceToObject3D( model, appearance, timeSeconds ) ) {

			appliedTargets.add( targetId );

		}

	}

	return [ ...appliedTargets ];

}

export function applyTrackGlowSettings( bloomPass, appearance ) {

	const normalized = normalizeTrackAppearance( appearance );
	if ( bloomPass ) {

		bloomPass.strength = normalized.glow.strength;
		bloomPass.radius = normalized.glow.radius;
		bloomPass.threshold = normalized.glow.threshold;

	}

	return normalized.glow;

}

export function getAvailableAppearanceTargets() {

	return getTrackAppearanceTargetList();

}

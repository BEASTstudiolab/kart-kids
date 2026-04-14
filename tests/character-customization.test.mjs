import test from 'node:test';
import assert from 'node:assert/strict';

import {
	BALACLAVA_OPTIONS,
	DEFAULT_BALACLAVA_ID,
	applyBalaclavaSelection,
	getRandomBalaclavaId,
	normalizeSelectedBalaclavaId,
	resolveBalaclavaOptionByMeshName,
} from '../js/CharacterCustomization.js';

test( 'normalizeSelectedBalaclavaId falls back to the default balaclava', () => {

	assert.equal( normalizeSelectedBalaclavaId( 'BALACLAVA-WOLF' ), 'balaclava-wolf' );
	assert.equal( normalizeSelectedBalaclavaId( 'unknown-mask' ), DEFAULT_BALACLAVA_ID );
	assert.equal( normalizeSelectedBalaclavaId( null ), DEFAULT_BALACLAVA_ID );

} );

test( 'getRandomBalaclavaId maps deterministic random values to configured options', () => {

	assert.equal( getRandomBalaclavaId( () => 0 ), BALACLAVA_OPTIONS[ 0 ].id );
	assert.equal(
		getRandomBalaclavaId( () => 0.999999 ),
		BALACLAVA_OPTIONS[ BALACLAVA_OPTIONS.length - 1 ].id
	);

} );

test( 'applyBalaclavaSelection keeps only the selected balaclava visible', () => {

	const nodes = BALACLAVA_OPTIONS.slice( 0, 4 ).map( ( option ) => ( {
		name: option.meshName,
		visible: true,
	} ) );
	const accessoryMesh = { name: 'Baseball Hat', visible: false };
	const root = {
		traverse( callback ) {

			for ( const node of [ ...nodes, accessoryMesh ] ) {

				callback( node );

			}

		},
	};

	applyBalaclavaSelection( root, 'balaclava-blank' );

	assert.equal( nodes[ 0 ].visible, false );
	assert.equal( nodes[ 1 ].visible, false );
	assert.equal( nodes[ 2 ].visible, false );
	assert.equal( nodes[ 3 ].visible, true );
	assert.equal( accessoryMesh.visible, false );

} );

test( 'applyBalaclavaSelection matches suffixed balaclava mesh names', () => {

	const nodes = [
		{ name: 'Balaclava_Basic.001', visible: true },
		{ name: 'Balaclava_Alien_2', visible: true },
		{ name: 'Balaclava Wolf 1', visible: true },
	];
	const root = {
		traverse( callback ) {

			for ( const node of nodes ) callback( node );

		},
	};

	applyBalaclavaSelection( root, 'balaclava-alien' );

	assert.equal( nodes[ 0 ].visible, false );
	assert.equal( nodes[ 1 ].visible, true );
	assert.equal( nodes[ 2 ].visible, false );

} );

test( 'resolveBalaclavaOptionByMeshName identifies balaclava variants and ignores unrelated meshes', () => {

	assert.equal( resolveBalaclavaOptionByMeshName( 'Balaclava_Basic.001' )?.id, 'balaclava-basic' );
	assert.equal( resolveBalaclavaOptionByMeshName( 'Balaclava Wolf_3' )?.id, 'balaclava-wolf' );
	assert.equal( resolveBalaclavaOptionByMeshName( 'Balaclava_Gold_Chain' ), null );
	assert.equal( resolveBalaclavaOptionByMeshName( 'Baseball Hat' ), null );

} );

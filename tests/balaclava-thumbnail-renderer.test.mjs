import test from 'node:test';
import assert from 'node:assert/strict';

import { BalaclavaThumbnailRenderer } from '../js/ui/character/BalaclavaThumbnailRenderer.js';

test( 'balaclava thumbnail renderer reuses cached results for repeated requests', async () => {

	let calls = 0;
	const renderer = new BalaclavaThumbnailRenderer( {
		renderThumbnailForId: async ( balaclavaId ) => {

			calls ++;
			return {
				src: `data:image/png;base64,${ balaclavaId }`,
				state: 'ready',
			};

		},
	} );

	const first = await renderer.getThumbnail( 'balaclava-pig' );
	const second = await renderer.getThumbnail( 'BALACLAVA-PIG' );

	assert.equal( calls, 1 );
	assert.deepEqual( first, second );

} );

test( 'balaclava thumbnail renderer deduplicates concurrent thumbnail requests', async () => {

	let calls = 0;
	const renderer = new BalaclavaThumbnailRenderer( {
		renderThumbnailForId: async ( balaclavaId ) => {

			calls ++;
			await new Promise( ( resolve ) => setTimeout( resolve, 5 ) );
			return {
				src: `data:image/png;base64,${ balaclavaId }`,
				state: 'ready',
			};

		},
	} );

	const [ first, second ] = await Promise.all( [
		renderer.getThumbnail( 'balaclava-robot' ),
		renderer.getThumbnail( 'balaclava-robot' ),
	] );

	assert.equal( calls, 1 );
	assert.deepEqual( first, second );

} );

test( 'balaclava thumbnail renderer normalizes thumbnail map entries', async () => {

	const renderer = new BalaclavaThumbnailRenderer( {
		renderThumbnailForId: async ( balaclavaId ) => {

			if ( balaclavaId === 'balaclava-basic' ) return 'data:image/png;base64,basic';
			return {
				src: '',
				state: 'fallback',
			};

		},
	} );

	const thumbnails = await renderer.getThumbnailMap( [ 'balaclava-basic', 'balaclava-pig' ] );

	assert.deepEqual( thumbnails.get( 'balaclava-basic' ), {
		src: 'data:image/png;base64,basic',
		state: 'ready',
	} );
	assert.deepEqual( thumbnails.get( 'balaclava-pig' ), {
		src: '',
		state: 'fallback',
	} );

} );

test( 'balaclava thumbnail renderer also supports accessory and clothing thumbnail keys', async () => {

	const renderer = new BalaclavaThumbnailRenderer( {
		renderThumbnailForId: async ( itemId ) => ( {
			src: `data:image/png;base64,${ itemId }`,
			state: 'ready',
		} ),
	} );

	const thumbnails = await renderer.getThumbnailMap( [ 'Baseball_Hat', 'Tshirt', 'Jeans' ] );

	assert.deepEqual( thumbnails.get( 'Baseball_Hat' ), {
		src: 'data:image/png;base64,Baseball_Hat',
		state: 'ready',
	} );
	assert.deepEqual( thumbnails.get( 'Tshirt' ), {
		src: 'data:image/png;base64,Tshirt',
		state: 'ready',
	} );
	assert.deepEqual( thumbnails.get( 'Jeans' ), {
		src: 'data:image/png;base64,Jeans',
		state: 'ready',
	} );

} );

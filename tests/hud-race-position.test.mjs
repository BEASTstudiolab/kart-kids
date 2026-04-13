import test from 'node:test';
import assert from 'node:assert/strict';

import { HUD } from '../js/HUD.js';

class MockElement {

	constructor( tagName ) {

		this.tagName = tagName;
		this.children = [];
		this.parentNode = null;
		this.style = { cssText: '' };
		this.textContent = '';
		this.className = '';
		this.listeners = new Map();

	}

	appendChild( child ) {

		this.children.push( child );
		child.parentNode = this;
		return child;

	}

	addEventListener( type, handler ) {

		this.listeners.set( type, handler );

	}

	remove() {

		if ( ! this.parentNode ) return;
		this.parentNode.children = this.parentNode.children.filter( ( child ) => child !== this );
		this.parentNode = null;

	}

}

function installMockDom( width = 1280 ) {

	const body = new MockElement( 'body' );
	const head = new MockElement( 'head' );

	globalThis.document = {
		body,
		head,
		createElement( tagName ) {

			return new MockElement( tagName );

		},
	};

	globalThis.window = {
		innerWidth: width,
	};

}

function cleanupMockDom() {

	delete globalThis.document;
	delete globalThis.window;

}

test( 'HUD shows the player badge and leaderboard rows during racing', () => {

	installMockDom();
	const hud = new HUD( null, null );

	hud.update( 1 / 60, {
		state: 'racing',
		lap: 0,
		totalLaps: 3,
		elapsedTime: 12.345,
		positionLabel: '5TH',
		leaders: [
			{ position: 1, name: 'Alex', isLocal: false },
			{ position: 2, name: 'Blaze', isLocal: false },
			{ position: 3, name: 'Caleb', isLocal: true },
		],
	}, null );

	assert.equal( hud._playerPlaceBadge.style.display, 'block' );
	assert.equal( hud._playerPlaceValue.textContent, '5TH' );
	assert.equal( hud._leaderboardEl.style.display, 'block' );
	assert.equal( hud._leaderboardRows[ 0 ].root.style.display, 'flex' );
	assert.equal( hud._leaderboardRows[ 0 ].placeEl.textContent, '#1' );
	assert.equal( hud._leaderboardRows[ 0 ].nameEl.textContent, 'Alex' );
	assert.equal( hud._leaderboardRows[ 2 ].nameEl.textContent, 'Caleb' );

	cleanupMockDom();

} );

test( 'HUD hides race-position UI outside the racing state', () => {

	installMockDom();
	const hud = new HUD( null, null );

	hud.update( 1 / 60, { state: 'idle', leaders: [] }, null );
	assert.equal( hud._playerPlaceBadge.style.display, 'none' );
	assert.equal( hud._leaderboardEl.style.display, 'none' );

	hud.update( 1 / 60, { state: 'countdown', countdown: 3, leaders: [] }, null );
	assert.equal( hud._playerPlaceBadge.style.display, 'none' );
	assert.equal( hud._leaderboardEl.style.display, 'none' );

	hud.update( 1 / 60, { state: 'finished', totalTime: 1, bestLap: 1, leaders: [] }, null );
	assert.equal( hud._playerPlaceBadge.style.display, 'none' );
	assert.equal( hud._leaderboardEl.style.display, 'none' );

	cleanupMockDom();

} );

test( 'HUD clamps long racer names and hides unused leaderboard rows on narrow layouts', () => {

	installMockDom( 820 );
	const hud = new HUD( null, null );

	hud.update( 1 / 60, {
		state: 'racing',
		lap: 0,
		totalLaps: 3,
		elapsedTime: 3,
		positionLabel: '1ST',
		leaders: [
			{ position: 1, name: 'An Extremely Long Racer Name That Should Clamp', isLocal: true },
		],
	}, null );

	assert.equal( hud._leaderboardRows[ 0 ].nameEl.style.textOverflow, 'ellipsis' );
	assert.equal( hud._leaderboardRows[ 0 ].nameEl.style.maxWidth, '112px' );
	assert.equal( hud._leaderboardRows[ 1 ].root.style.display, 'none' );
	assert.equal( hud._leaderboardRows[ 2 ].root.style.display, 'none' );

	cleanupMockDom();

} );

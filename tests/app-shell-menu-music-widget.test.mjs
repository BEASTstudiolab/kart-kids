import test from 'node:test';
import assert from 'node:assert/strict';

class FakeElement {

	constructor( tagName ) {

		this.tagName = tagName;
		this.children = [];
		this.parentNode = null;
		this.textContent = '';
		this.className = '';
		this.style = {};
		this.attributes = new Map();
		this.dataset = {};
		this.disabled = false;
		this.id = '';
		this._listeners = new Map();
		this._classNames = new Set();
		this.classList = {
			add: ( ...tokens ) => {

				for ( const token of tokens ) this._classNames.add( token );

			},
			remove: ( ...tokens ) => {

				for ( const token of tokens ) this._classNames.delete( token );

			},
			toggle: ( token, force ) => {

				if ( force === undefined ) {

					if ( this._classNames.has( token ) ) this._classNames.delete( token );
					else this._classNames.add( token );
					return;

				}

				if ( force ) this._classNames.add( token );
				else this._classNames.delete( token );

			},
			contains: ( token ) => this._classNames.has( token ),
		};

	}

	appendChild( child ) {

		child.parentNode = this;
		this.children.push( child );
		return child;

	}

	removeChild( child ) {

		const index = this.children.indexOf( child );
		if ( index >= 0 ) this.children.splice( index, 1 );
		child.parentNode = null;
		return child;

	}

	setAttribute( name, value ) {

		this.attributes.set( name, String( value ) );

	}

	addEventListener( type, handler ) {

		if ( ! this._listeners.has( type ) ) this._listeners.set( type, [] );
		this._listeners.get( type ).push( handler );

	}

	dispatchEvent( event ) {

		const handlers = this._listeners.get( event.type ) || [];
		for ( const handler of [ ...handlers ] ) handler( event );

	}

	querySelectorAll() {

		return [];

	}

}

function createFakeDocument() {

	return {
		head: new FakeElement( 'head' ),
		body: new FakeElement( 'body' ),
		createElement: ( tagName ) => new FakeElement( tagName ),
		getElementById: () => null,
		addEventListener: () => {},
		removeEventListener: () => {},
	};

}

const fakeDocument = createFakeDocument();

globalThis.window = {
	location: {
		hostname: 'localhost',
		search: '',
		hash: '',
	},
	addEventListener: () => {},
	removeEventListener: () => {},
	dispatchEvent: () => {},
};
globalThis.document = fakeDocument;
globalThis.navigator = { maxTouchPoints: 0 };
globalThis.localStorage = {
	getItem: () => null,
	setItem: () => {},
	removeItem: () => {},
	clear: () => {},
};
globalThis.performance = { now: () => 0 };
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};

if ( typeof globalThis.CustomEvent === 'undefined' ) {

	globalThis.CustomEvent = class CustomEvent {

		constructor( type, init ) {

			this.type = type;
			this.detail = init?.detail ?? null;

		}

	};

}

const { AppShell } = await import( '../js/ui/core/AppShell.js' );

test( 'AppShell renders persistent menu music widget state and routes controls to the shared player', () => {

	const mount = new FakeElement( 'div' );
	const shell = new AppShell( mount );
	shell._buildShell();

	let toggleCalls = 0;
	let nextCalls = 0;
	shell._menuMusic = {
		subscribe( listener ) {

			listener( {
				canPlay: true,
				isPlaying: true,
				currentTrack: {
					id: 'track-one',
					title: 'Electro Breakbeat Nitro',
				},
				playlistLength: 3,
				error: '',
			} );
			return () => {};

		},
		toggle: async () => {

			toggleCalls ++;

		},
		next: async () => {

			nextCalls ++;

		},
	};

	shell._bindMenuMusic();

	assert.equal( shell._menuMusicTrackEl.textContent, 'Electro Breakbeat Nitro' );
	assert.equal( shell._menuMusicStatusEl.textContent, 'Now Playing' );
	assert.equal( shell._menuMusicToggleBtn.textContent, 'Pause' );
	assert.equal( shell._menuMusicNextBtn.disabled, false );
	assert.equal( shell._menuMusicDockEl.classList.contains( 'kk-menu-music--playing' ), true );

	shell._menuMusicToggleBtn.dispatchEvent( { type: 'click' } );
	shell._menuMusicNextBtn.dispatchEvent( { type: 'click' } );

	assert.equal( toggleCalls, 1 );
	assert.equal( nextCalls, 1 );
	assert.equal( mount.children.length, 1 );

} );

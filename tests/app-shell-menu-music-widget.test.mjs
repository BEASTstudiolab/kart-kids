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

	getAttribute( name ) {

		return this.attributes.has( name ) ? this.attributes.get( name ) : null;

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

const { MarginalMusicCard } = await import( '../js/ui/components/MarginalMusicCard.js' );

test( 'MarginalMusicCard renders shared player state and routes controls to the shared player', () => {

	let toggleCalls = 0;
	let nextCalls = 0;
	const player = {
		subscribe( listener ) {

			listener( {
				canPlay: true,
				isPlaying: true,
				active: true,
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

	const card = new MarginalMusicCard( { player } );

	assert.equal( card._trackEl.textContent, 'Electro Breakbeat Nitro' );
	assert.equal( card._headerLeftEl.textContent, 'Menu music · Now playing' );
	assert.equal( card._headerRightEl.textContent, '' );
	assert.equal( card._statusEl.textContent, '' );
	assert.equal( card._toggleBtn.attributes.get( 'aria-label' ), 'Pause menu music' );
	assert.equal( card._nextBtn.disabled, false );
	assert.equal( card.el.classList.contains( 'kk-mv-music-card--playing' ), true );

	card._toggleBtn.dispatchEvent( { type: 'click' } );
	card._nextBtn.dispatchEvent( { type: 'click' } );

	assert.equal( toggleCalls, 1 );
	assert.equal( nextCalls, 1 );

} );

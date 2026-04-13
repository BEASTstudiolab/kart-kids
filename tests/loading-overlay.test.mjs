import test from 'node:test';
import assert from 'node:assert/strict';
import { LoadingOverlay } from '../js/ui/components/LoadingOverlay.js';

class FakeElement {

	constructor( tagName ) {

		this.tagName = tagName;
		this.children = [];
		this.parentNode = null;
		this.hidden = false;
		this.textContent = '';
		this.className = '';
		this.style = {};
		this.attributes = new Map();
		this._listeners = new Map();
		this._classNames = new Set();
		this.classList = {
			add: ( ...tokens ) => {

				for ( const token of tokens ) this._classNames.add( token );

			},
			remove: ( ...tokens ) => {

				for ( const token of tokens ) this._classNames.delete( token );

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

	removeEventListener( type, handler ) {

		const handlers = this._listeners.get( type );
		if ( ! handlers ) return;
		const index = handlers.indexOf( handler );
		if ( index >= 0 ) handlers.splice( index, 1 );

	}

	dispatchEvent( event ) {

		const handlers = this._listeners.get( event.type ) || [];
		for ( const handler of [ ...handlers ] ) handler( event );

	}

	focus() {}

}

function createFakeDocument() {

	return {
		head: new FakeElement( 'head' ),
		body: new FakeElement( 'body' ),
		createElement: ( tagName ) => new FakeElement( tagName ),
	};

}

test( 'LoadingOverlay.hide remains safe if dispose runs before the fallback timeout', async ( t ) => {

	const originalDocument = global.document;
	const originalRAF = global.requestAnimationFrame;
	const originalSetTimeout = global.setTimeout;
	const originalClearTimeout = global.clearTimeout;
	const originalCssInjected = LoadingOverlay._cssInjected;

	const fakeDocument = createFakeDocument();
	const scheduled = [];

	global.document = fakeDocument;
	global.requestAnimationFrame = ( callback ) => {

		callback();
		return 1;

	};
	global.setTimeout = ( callback ) => {

		scheduled.push( callback );
		return scheduled.length - 1;

	};
	global.clearTimeout = ( id ) => {

		if ( id >= 0 && id < scheduled.length ) scheduled[ id ] = null;

	};
	LoadingOverlay._cssInjected = false;

	t.after( () => {

		global.document = originalDocument;
		global.requestAnimationFrame = originalRAF;
		global.setTimeout = originalSetTimeout;
		global.clearTimeout = originalClearTimeout;
		LoadingOverlay._cssInjected = originalCssInjected;

	} );

	const overlay = new LoadingOverlay();
	overlay.show();
	overlay.hide();
	overlay.dispose();

	for ( const callback of scheduled ) {

		if ( ! callback ) continue;
		assert.doesNotThrow( () => callback() );

	}

} );

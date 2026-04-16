import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
			toggle: ( token, force ) => {

				if ( force === undefined ) {

					if ( this._classNames.has( token ) ) {

						this._classNames.delete( token );
						return false;

					}

					this._classNames.add( token );
					return true;

				}

				if ( force ) this._classNames.add( token );
				else this._classNames.delete( token );
				return !! force;

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

	removeAttribute( name ) {

		this.attributes.delete( name );

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

function readRootFile( relPath ) {

	return readFileSync( new URL( `../${ relPath }`, import.meta.url ), 'utf8' );

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

test( 'LoadingOverlay can switch between indeterminate and determinate progress states', () => {

	const originalDocument = global.document;
	const originalRAF = global.requestAnimationFrame;
	const originalCssInjected = LoadingOverlay._cssInjected;

	const fakeDocument = createFakeDocument();
	global.document = fakeDocument;
	global.requestAnimationFrame = ( callback ) => {

		callback();
		return 1;

	};
	LoadingOverlay._cssInjected = false;

	try {

		const overlay = new LoadingOverlay( {
			message: 'Preparing race',
			detail: 'Staging grid',
			phase: 'Initializing',
		} );
		overlay.show();

		overlay.setState( {
			phase: 'Loading Assets',
			message: 'Loading race assets',
			detail: 'Models 2/8',
			progress: 0.25,
			determinate: true,
			progressText: '25%',
		} );

		assert.equal( overlay._el.classList.contains( 'kk-loading-overlay--brand-bar' ), true );
		assert.equal( overlay._brandEl.textContent, 'KART KIDS' );
		assert.equal( overlay._messageEl.textContent, 'Loading race assets' );
		assert.equal( overlay._phaseEl.textContent, 'Loading Assets' );
		assert.equal( overlay._detailEl.textContent, 'Models 2/8' );
		assert.equal( overlay._progressFillEl.style.width, '25%' );
		assert.equal( overlay._progressValueEl.textContent, '25%' );
		assert.equal( overlay._progressEl.attributes.get( 'aria-valuenow' ), '25' );

		overlay.setState( {
			determinate: false,
			progress: null,
			progressText: '...',
		} );

		assert.equal(
			overlay._progressFillEl.classList.contains( 'kk-loading-overlay__progress-fill--indeterminate' ),
			true
		);
		assert.equal( overlay._progressValueEl.textContent, '...' );

	} finally {

		global.document = originalDocument;
		global.requestAnimationFrame = originalRAF;
		LoadingOverlay._cssInjected = originalCssInjected;

	}

} );

test( 'LoadingOverlay supports verbose mode for contextual flows like matchmaking', () => {

	const originalDocument = global.document;
	const originalRAF = global.requestAnimationFrame;
	const originalCssInjected = LoadingOverlay._cssInjected;

	const fakeDocument = createFakeDocument();
	global.document = fakeDocument;
	global.requestAnimationFrame = ( callback ) => {

		callback();
		return 1;

	};
	LoadingOverlay._cssInjected = false;

	try {

		const overlay = new LoadingOverlay( {
			variant: 'verbose',
			message: 'Finding match...',
			onCancel: () => {},
		} );
		overlay.show();

		assert.equal( overlay._el.classList.contains( 'kk-loading-overlay--verbose' ), true );
		assert.equal( overlay._cancelBtn.hidden, false );
		assert.equal( overlay._spinnerEl.hidden, false );

		overlay.showError( 'Matchmaking failed' );

		assert.equal( overlay._el.classList.contains( 'kk-loading-overlay--error' ), true );
		assert.equal( overlay._errorEl.hidden, false );
		assert.equal( overlay._returnBtn.hidden, false );

	} finally {

		global.document = originalDocument;
		global.requestAnimationFrame = originalRAF;
		LoadingOverlay._cssInjected = originalCssInjected;

	}

} );

test( 'bootstrap page uses the shared LoadingOverlay instead of the legacy splash DOM', () => {

	const source = readRootFile( 'index.html' );

	assert.match( source, /import \{ LoadingOverlay \} from '\.\/js\/ui\/components\/LoadingOverlay\.js';/ );
	assert.match( source, /const bootstrapOverlay = new LoadingOverlay\(\s*\{/ );
	assert.match( source, /await app\.bootstrap\(\s*\{\s*onProgress: \( nextState \) => bootstrapOverlay\.setState\( nextState \),\s*\}\s*\);/s );
	assert.match( source, /bootstrapOverlay\.show\(\);/ );
	assert.doesNotMatch( source, /id="loading-overlay"/ );
	assert.doesNotMatch( source, /id="loading-bar"/ );
	assert.doesNotMatch( source, /id="loading-text"/ );

} );

test( 'online matchmaking keeps the verbose loading overlay variant for cancellation and status copy', () => {

	const source = readRootFile( 'js/ui/panels/RacePanel.js' );

	assert.match( source, /variant: 'verbose',/ );

} );

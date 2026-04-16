import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMinimap } from '../js/ui/components/TrackMinimap.js';
import { TRACK_CELLS } from '../js/TrackData.js';
import { normalizeLegacyTrackIntelCells } from '../js/TrackOrientation.js';

class FakeStyle {

	constructor() {

		this._values = new Map();

	}

	setProperty( name, value ) {

		this._values.set( name, String( value ) );

	}

	getPropertyValue( name ) {

		return this._values.get( name ) ?? '';

	}

}

class FakeElement {

	constructor( tagName ) {

		this.tagName = tagName;
		this.children = [];
		this.parentNode = null;
		this.attributes = new Map();
		this.style = new FakeStyle();

	}

	appendChild( child ) {

		child.parentNode = this;
		this.children.push( child );
		return child;

	}

	setAttribute( name, value ) {

		this.attributes.set( name, String( value ) );

	}

	getAttribute( name ) {

		return this.attributes.get( name ) ?? null;

	}

}

function createFakeDocument() {

	return {
		createElementNS: ( namespace, tagName ) => {

			assert.equal( namespace, 'http://www.w3.org/2000/svg' );
			return new FakeElement( tagName );

		},
	};

}

function collectByTagName( root, tagName, acc = [] ) {

	if ( root.tagName === tagName ) acc.push( root );
	for ( const child of root.children ) collectByTagName( child, tagName, acc );
	return acc;

}

function circleSnapshot( svg ) {

	return collectByTagName( svg, 'circle' ).map( ( circle ) => ( {
		cx: circle.getAttribute( 'cx' ),
		cy: circle.getAttribute( 'cy' ),
		r: circle.getAttribute( 'r' ),
	} ) );

}

test( 'renderMinimap returns a transparent SVG preview with configurable track color', () => {

	const originalDocument = global.document;
	global.document = createFakeDocument();

	try {

		const svg = renderMinimap( [], 200, 80, {
			palette: {
				track: '#cc2233',
			},
		} );

		assert.equal( svg.tagName, 'svg' );
		assert.equal( svg.getAttribute( 'width' ), '200' );
		assert.equal( svg.getAttribute( 'height' ), '80' );
		assert.equal( svg.getAttribute( 'viewBox' ), '0 0 200 80' );
		assert.equal( svg.getAttribute( 'data-track-render-mode' ), 'empty' );
		assert.equal( svg.style.getPropertyValue( '--track-minimap-track' ), '#cc2233' );
		assert.equal( collectByTagName( svg, 'rect' ).length, 0 );

	} finally {

		global.document = originalDocument;

	}

} );

test( 'renderMinimap samples SVG dots from track geometry instead of one mark per cell', () => {

	const originalDocument = global.document;
	global.document = createFakeDocument();

	try {

		const svg = renderMinimap( TRACK_CELLS, 320, 160 );
		const circles = collectByTagName( svg, 'circle' );

		assert.equal( svg.getAttribute( 'data-track-render-mode' ), 'intel' );
		assert.ok( circles.length > TRACK_CELLS.length );

	} finally {

		global.document = originalDocument;

	}

} );

test( 'legacy 3x3 curve cells render the same minimap geometry as normalized cells', () => {

	const originalDocument = global.document;
	global.document = createFakeDocument();

	try {

		const normalizedCells = normalizeLegacyTrackIntelCells( TRACK_CELLS );
		const legacySvg = renderMinimap( TRACK_CELLS, 320, 160 );
		const normalizedSvg = renderMinimap( normalizedCells, 320, 160 );

		assert.deepEqual( circleSnapshot( legacySvg ), circleSnapshot( normalizedSvg ) );

	} finally {

		global.document = originalDocument;

	}

} );

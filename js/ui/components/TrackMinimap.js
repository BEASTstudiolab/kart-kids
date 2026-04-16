import { TrackIntel } from '../../TrackIntel.js';
import { normalizeLegacyTrackIntelCells } from '../../TrackOrientation.js';
import { CELL_RAW, GRID_SCALE } from '../../TrackConstants.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFAULT_TRACK_COLOR = '#d6402b';
const DEFAULT_PADDING = 6;
const DEFAULT_WORLD_HALF_WIDTH = CELL_RAW * GRID_SCALE * 0.28;

/**
 * TrackMinimap — pure helper that renders a top-down minimap as SVG.
 *
 * The preview is built from track waypoints when possible so larger pieces
 * such as 2x2/3x3 curves read like the real route rather than a single tile.
 * The SVG stays transparent so the UI surface owns the background treatment.
 */

/**
 * Render a top-down minimap of the given track cells.
 *
 * @param {Array<Array>} cells  Array of cell tuples: [gx, gz, tileKey, orient, flags?]
 * @param {number} width
 * @param {number} height
 * @param {{ palette?: { track?: string } }} [options]
 * @returns {SVGSVGElement}
 */
export function renderMinimap( cells, width, height, options = {} ) {

	const svg = _createSvgRoot( width, height, options.palette );

	if ( ! Array.isArray( cells ) || cells.length === 0 ) {

		svg.setAttribute( 'data-track-render-mode', 'empty' );
		svg.setAttribute( 'data-track-point-count', '0' );
		return svg;

	}

	const geometry = _buildRenderGeometry( cells );
	const points = _projectPoints( geometry.points, width, height, geometry.closed );

	svg.setAttribute( 'data-track-render-mode', geometry.mode );
	svg.setAttribute( 'data-track-point-count', String( points.length ) );

	if ( points.length === 0 ) return svg;

	const dots = _createSvgElement( 'g' );
	dots.setAttribute( 'fill', `var(--track-minimap-track, ${DEFAULT_TRACK_COLOR})` );
	dots.setAttribute( 'stroke', 'none' );
	svg.appendChild( dots );

	for ( const point of points ) {

		const circle = _createSvgElement( 'circle' );
		circle.setAttribute( 'cx', _formatNumber( point.x ) );
		circle.setAttribute( 'cy', _formatNumber( point.y ) );
		circle.setAttribute( 'r', _formatNumber( point.r ) );
		dots.appendChild( circle );

	}

	return svg;

}

function _createSvgRoot( width, height, paletteOverride ) {

	const svg = _createSvgElement( 'svg' );
	svg.setAttribute( 'xmlns', SVG_NS );
	svg.setAttribute( 'width', String( width ) );
	svg.setAttribute( 'height', String( height ) );
	svg.setAttribute( 'viewBox', `0 0 ${width} ${height}` );
	svg.setAttribute( 'preserveAspectRatio', 'xMidYMid meet' );
	svg.setAttribute( 'aria-hidden', 'true' );
	svg.setAttribute( 'focusable', 'false' );
	svg.setAttribute( 'class', 'kk-track-minimap' );
	svg.setAttribute( 'shape-rendering', 'geometricPrecision' );

	if ( paletteOverride?.track ) {

		svg.style.setProperty( '--track-minimap-track', paletteOverride.track );

	}

	return svg;

}

function _buildRenderGeometry( cells ) {

	try {

		const intel = new TrackIntel( cells );
		if ( intel.valid && Array.isArray( intel.waypoints ) && intel.waypoints.length > 1 ) {

			return {
				mode: 'intel',
				closed: true,
				points: intel.waypoints.map( ( point ) => ( { x: point.x, y: point.z } ) ),
			};

		}

	} catch ( error ) {

		console.warn( 'TrackMinimap: TrackIntel fallback triggered:', error );

	}

	const fallbackCells = normalizeLegacyTrackIntelCells( cells );
	return {
		mode: 'fallback',
		closed: false,
		points: fallbackCells.map( ( cell ) => _cellToWorldPoint( cell ) ),
	};

}

function _cellToWorldPoint( cell ) {

	return {
		x: ( cell[ 0 ] + 0.5 ) * CELL_RAW * GRID_SCALE,
		y: ( cell[ 1 ] + 0.5 ) * CELL_RAW * GRID_SCALE,
	};

}

function _projectPoints( worldPoints, width, height, closed ) {

	if ( ! Array.isArray( worldPoints ) || worldPoints.length === 0 ) return [];

	let minX = Infinity;
	let maxX = - Infinity;
	let minY = Infinity;
	let maxY = - Infinity;

	for ( const point of worldPoints ) {

		if ( point.x < minX ) minX = point.x;
		if ( point.x > maxX ) maxX = point.x;
		if ( point.y < minY ) minY = point.y;
		if ( point.y > maxY ) maxY = point.y;

	}

	const padding = Math.max( DEFAULT_PADDING, Math.min( width, height ) * 0.08 );
	const contentWidth = Math.max( maxX - minX, 1 ) + DEFAULT_WORLD_HALF_WIDTH * 2;
	const contentHeight = Math.max( maxY - minY, 1 ) + DEFAULT_WORLD_HALF_WIDTH * 2;
	const scale = Math.min(
		( width - padding * 2 ) / contentWidth,
		( height - padding * 2 ) / contentHeight
	);

	const offsetX = ( width - contentWidth * scale ) / 2;
	const offsetY = ( height - contentHeight * scale ) / 2;
	const projected = worldPoints.map( ( point ) => ( {
		x: offsetX + ( point.x - minX + DEFAULT_WORLD_HALF_WIDTH ) * scale,
		y: offsetY + ( point.y - minY + DEFAULT_WORLD_HALF_WIDTH ) * scale,
	} ) );

	if ( projected.length === 1 ) {

		return [ {
			x: projected[ 0 ].x,
			y: projected[ 0 ].y,
			r: _computeDotRadius( width, height ),
		} ];

	}

	if ( ! closed ) {

		const radius = _computeDotRadius( width, height );
		return projected.map( ( point ) => ( { ...point, r: radius } ) );

	}

	const spacing = _computeDotSpacing( width, height );
	const sampled = _sampleClosedPolyline( projected, spacing );
	const radius = Math.max( 1.4, Math.min( spacing * 0.72, Math.min( width, height ) * 0.11 ) );

	return sampled.map( ( point ) => ( { ...point, r: radius } ) );

}

function _sampleClosedPolyline( points, spacing ) {

	if ( points.length <= 1 ) return points.slice();

	const closedPoints = points.slice();
	const first = points[ 0 ];
	const last = points[ points.length - 1 ];
	if ( _distance( first, last ) > 0.001 ) closedPoints.push( first );

	const segmentLengths = [];
	let totalLength = 0;

	for ( let i = 0; i < closedPoints.length - 1; i ++ ) {

		const start = closedPoints[ i ];
		const end = closedPoints[ i + 1 ];
		const length = _distance( start, end );
		segmentLengths.push( length );
		totalLength += length;

	}

	if ( totalLength === 0 ) return [ first ];

	const sampled = [];
	for ( let distanceAlong = 0; distanceAlong < totalLength; distanceAlong += spacing ) {

		sampled.push( _pointAtDistance( closedPoints, segmentLengths, distanceAlong ) );

	}

	return sampled.length > 0 ? sampled : [ first ];

}

function _pointAtDistance( points, segmentLengths, targetDistance ) {

	let consumed = 0;

	for ( let i = 0; i < segmentLengths.length; i ++ ) {

		const segmentLength = segmentLengths[ i ];
		if ( segmentLength === 0 ) continue;

		const nextConsumed = consumed + segmentLength;
		if ( targetDistance <= nextConsumed ) {

			const ratio = ( targetDistance - consumed ) / segmentLength;
			return _lerpPoint( points[ i ], points[ i + 1 ], ratio );

		}

		consumed = nextConsumed;

	}

	return { ...points[ points.length - 1 ] };

}

function _lerpPoint( start, end, t ) {

	return {
		x: start.x + ( end.x - start.x ) * t,
		y: start.y + ( end.y - start.y ) * t,
	};

}

function _distance( a, b ) {

	const dx = b.x - a.x;
	const dy = b.y - a.y;
	return Math.hypot( dx, dy );

}

function _computeDotSpacing( width, height ) {

	return Math.max( 2.25, Math.min( Math.min( width, height ) / 24, 5 ) );

}

function _computeDotRadius( width, height ) {

	return Math.max( 1.6, Math.min( Math.min( width, height ) * 0.05, 4.25 ) );

}

function _createSvgElement( tagName ) {

	return document.createElementNS( SVG_NS, tagName );

}

function _formatNumber( value ) {

	return Number( value ).toFixed( 2 ).replace( /\.00$/, '' );

}

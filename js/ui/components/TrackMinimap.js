/**
 * TrackMinimap — Pure function that renders a top-down track minimap onto a canvas.
 *
 * Each track cell is drawn as a colored rounded rectangle, with colors
 * determined by tile type (track, finish, elevation, bridge, junction, etc.).
 */

/**
 * Render a top-down minimap of the given track cells.
 *
 * @param {Array<Array>} cells  Array of cell tuples: [gx, gz, tileKey, orient, ...]
 * @param {number}       width  Canvas width in pixels.
 * @param {number}       height Canvas height in pixels.
 * @returns {HTMLCanvasElement} A canvas element with the rendered minimap.
 */
export function renderMinimap( cells, width, height ) {

	const canvas = document.createElement( 'canvas' );
	canvas.width = width;
	canvas.height = height;

	const ctx = canvas.getContext( '2d' );

	// Background fill

	ctx.fillStyle = '#0a0a0a';
	ctx.fillRect( 0, 0, width, height );

	// Early out for empty or null cells

	if ( ! cells || cells.length === 0 ) return canvas;

	// Compute bounding box

	let minGx = Infinity;
	let maxGx = - Infinity;
	let minGz = Infinity;
	let maxGz = - Infinity;

	for ( let i = 0; i < cells.length; i ++ ) {

		const cell = cells[ i ];
		const gx = cell[ 0 ];
		const gz = cell[ 1 ];

		if ( gx < minGx ) minGx = gx;
		if ( gx > maxGx ) maxGx = gx;
		if ( gz < minGz ) minGz = gz;
		if ( gz > maxGz ) maxGz = gz;

	}

	const rangeX = maxGx - minGx + 1;
	const rangeZ = maxGz - minGz + 1;

	// Cell render size with padding margin

	const padding = 2;
	const cellSize = Math.min(
		( width - padding * 2 ) / rangeX,
		( height - padding * 2 ) / rangeZ
	);

	// Center the map within the canvas

	const offsetX = ( width - rangeX * cellSize ) / 2;
	const offsetZ = ( height - rangeZ * cellSize ) / 2;

	// Corner radius for rounded rects

	const cornerRadius = Math.max( 1, cellSize * 0.15 );
	const inset = Math.max( 0.5, cellSize * 0.05 );

	// Draw each cell

	for ( let i = 0; i < cells.length; i ++ ) {

		const cell = cells[ i ];
		const gx = cell[ 0 ];
		const gz = cell[ 1 ];
		const tileKey = cell[ 2 ] || '';

		const x = offsetX + ( gx - minGx ) * cellSize + inset;
		const y = offsetZ + ( gz - minGz ) * cellSize + inset;
		const size = cellSize - inset * 2;

		ctx.fillStyle = getTileColor( tileKey );

		drawRoundedRect( ctx, x, y, size, size, cornerRadius );
		ctx.fill();

	}

	return canvas;

}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return a hex color string for the given tile key based on its prefix.
 *
 * @param {string} tileKey
 * @returns {string}
 */
function getTileColor( tileKey ) {

	if ( tileKey.startsWith( 'trk-finish' ) ) return '#22c55e';
	if ( tileKey.startsWith( 'trk-ramp' ) ) return '#ffd600';
	if ( tileKey.startsWith( 'trk-elev' ) ) return '#ffd600';
	if ( tileKey.startsWith( 'trk-bridge' ) ) return '#00d4e8';
	if ( tileKey.startsWith( 'trk-tunnel' ) ) return '#00d4e8';
	if ( tileKey.startsWith( 'trk-junction' ) ) return '#ff3a8c';
	if ( tileKey.startsWith( 'trk-straight' ) ) return '#ff6b00';
	if ( tileKey.startsWith( 'trk-corner' ) ) return '#ff6b00';
	if ( tileKey.startsWith( 'trk-jump' ) ) return '#ff6b00';
	if ( tileKey.startsWith( 'trk-chicane' ) ) return '#ff6b00';

	return '#555555';

}

/**
 * Trace a rounded-rectangle path on the given 2D context.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r  Corner radius.
 */
function drawRoundedRect( ctx, x, y, w, h, r ) {

	const radius = Math.min( r, w / 2, h / 2 );

	ctx.beginPath();
	ctx.moveTo( x + radius, y );
	ctx.lineTo( x + w - radius, y );
	ctx.arcTo( x + w, y, x + w, y + radius, radius );
	ctx.lineTo( x + w, y + h - radius );
	ctx.arcTo( x + w, y + h, x + w - radius, y + h, radius );
	ctx.lineTo( x + radius, y + h );
	ctx.arcTo( x, y + h, x, y + h - radius, radius );
	ctx.lineTo( x, y + radius );
	ctx.arcTo( x, y, x + radius, y, radius );
	ctx.closePath();

}

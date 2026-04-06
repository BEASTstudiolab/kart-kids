// ─── Debug Mode ──────────────────────────────────────────────────────
// Debug tooltip showing cell info on hover.

import { ORIENT_DEG } from '../Track.js';
import { cellKey } from './EditorState.js';
import { getTrackModelConfig } from '../TrackModelConfig.js';

let debugMode = false;
let debugTooltip = null;

export function initDebugMode() {

	debugTooltip = document.getElementById( 'debug-tooltip' );

	window.addEventListener( 'keydown', ( e ) => {

		if ( e.code === 'KeyD' ) {

			debugMode = ! debugMode;
			if ( ! debugMode ) debugTooltip.style.display = 'none';

		}

	} );

}

export function updateDebugTooltip( grid, trackTileSet, gx, gz, clientX, clientY ) {

	if ( ! debugTooltip ) return;

	if ( ! debugMode ) {

		debugTooltip.style.display = 'none';
		return;

	}

	const key = cellKey( gx, gz );
	const cell = grid.get( key );

	if ( ! cell ) {

		debugTooltip.style.display = 'block';
		debugTooltip.innerHTML = `<span class="dt-dim">(${ gx }, ${ gz }) empty</span>`;
		debugTooltip.style.left = ( clientX + 16 ) + 'px';
		debugTooltip.style.top = ( clientY + 16 ) + 'px';
		return;

	}

	const orientDeg = ORIENT_DEG[ cell.orient ] || 0;
	const modelConfig = getTrackModelConfig( cell.type, trackTileSet );
	const elev = cell.elevation || 0;
	const flags = [];
	if ( cell.isFinish ) flags.push( 'finish' );
	if ( cell.rotationOverride ) flags.push( 'rot-override' );
	if ( cell.curveVariant ) flags.push( cell.curveVariant );
	if ( cell.curveSize ) flags.push( 'curve-' + cell.curveSize + 'x' + cell.curveSize );
	if ( cell.autoRamp ) flags.push( 'auto-ramp' );

	debugTooltip.innerHTML =
		`<div class="dt-title">${ cell.type }</div>` +
		`grid:    (${ gx }, ${ gz })\n` +
		`orient:  ${ cell.orient } → ${ orientDeg }°\n` +
		`model:   ${ modelConfig.path }\n` +
		`elev:    ${ elev }\n` +
		( flags.length ? `flags:   ${ flags.join( ', ' ) }\n` : '' );

	debugTooltip.style.display = 'block';
	debugTooltip.style.left = ( clientX + 16 ) + 'px';
	debugTooltip.style.top = ( clientY + 16 ) + 'px';

}

export function hideDebugTooltip() {

	if ( debugTooltip ) debugTooltip.style.display = 'none';

}

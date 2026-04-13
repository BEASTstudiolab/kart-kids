/**
 * Thin standalone wrapper around GameEngine.
 *
 * Creates the engine, starts a race from URL params or defaults, and drives
 * its own requestAnimationFrame loop calling engine.update(dt).
 *
 * In production, AppShell's coordinator loop calls engine.update(dt) instead
 * and this file is not used.
 */

import { createGameEngine } from './GameEngine.js';

const engine = createGameEngine( document.body );
window.__kartDebug = engine;

engine.start( { mode: 'solo' } ).then( () => {

	function animate() {

		if ( ! engine.isRunning() ) return;
		requestAnimationFrame( animate );
		engine.update();

	}

	requestAnimationFrame( animate );

} ).catch( ( e ) => console.error( 'Init failed:', e ) );

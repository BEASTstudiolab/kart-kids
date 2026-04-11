import test from 'node:test';
import assert from 'node:assert/strict';

import { EventBus } from '../js/track-editor/core/EventBus.js';
import { CompassOverlay } from '../js/track-editor/ui/CompassOverlay.js';

test( 'CompassOverlay rotates the rose to match camera orbit heading', () => {
	const bus = new EventBus();
	const rose = { style: { transform: '' } };
	const compass = new CompassOverlay( { eventBus: bus, roseEl: rose } );

	bus.emit( 'camera:moved', { orbitAngle: Math.PI / 4 } );
	assert.equal( rose.style.transform, 'rotate(-45deg)' );

	bus.emit( 'camera:moved', { orbitAngle: 0 } );
	assert.equal( rose.style.transform, 'rotate(0deg)' );

	compass.dispose();
} );

test( 'CompassOverlay stops changing the rose after dispose', () => {
	const bus = new EventBus();
	const rose = { style: { transform: '' } };
	const compass = new CompassOverlay( { eventBus: bus, roseEl: rose } );

	bus.emit( 'camera:moved', { orbitAngle: Math.PI / 2 } );
	assert.equal( rose.style.transform, 'rotate(-90deg)' );

	compass.dispose();
	bus.emit( 'camera:moved', { orbitAngle: 0 } );
	assert.equal( rose.style.transform, 'rotate(-90deg)' );
} );

test( 'CompassOverlay tolerates a missing rose element', () => {
	const bus = new EventBus();
	const compass = new CompassOverlay( { eventBus: bus, roseEl: null } );

	assert.doesNotThrow( () => bus.emit( 'camera:moved', { orbitAngle: Math.PI / 2 } ) );
	assert.doesNotThrow( () => compass.dispose() );
} );

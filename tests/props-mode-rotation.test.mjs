import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { EventBus } from '../js/track-editor/core/EventBus.js';
import { EditorState } from '../js/track-editor/core/EditorState.js';
import { PropsMode } from '../js/track-editor/modes/PropsMode.js';

function createPropModel() {

	const root = new THREE.Group();
	root.add( new THREE.Mesh( new THREE.BoxGeometry( 1, 1, 1 ), new THREE.MeshBasicMaterial() ) );
	return root;

}

test( 'PropsMode rotates props via the rotate tool and the R shortcut, and preserves rotY in JSON', () => {

	const eventBus = new EventBus();
	const state = new EditorState( eventBus );
	const tileLibrary = {
		getModel() {

			return createPropModel();

		},
	};
	const mode = new PropsMode( state, eventBus, {
		getTile() {

			return null;

		},
	}, tileLibrary, null, null );

	const propMesh = createPropModel();
	propMesh.position.set( 15, 0, 15 );
	mode._placedProps.push( {
		id: 'prop-1',
		type: 'decor-test',
		mesh: propMesh,
		pos: new THREE.Vector3( 15, 0, 15 ),
	} );
	mode.propsGroup.add( propMesh );

	state.tool = 'rotate-prop';
	state.hoveredCell = { gx: 1, gz: 1, worldX: 15, worldZ: 15 };
	mode._screenToWorld = () => new THREE.Vector3( 15, 0, 15 );

	mode.handlePointerDown( 1, 1, { clientX: 0, clientY: 0 } );
	assert.ok( Math.abs( propMesh.rotation.y - Math.PI / 2 ) < 1e-6 );

	assert.equal( mode.handleKeyDown( 'KeyR' ), true );
	assert.ok( Math.abs( propMesh.rotation.y - Math.PI ) < 1e-6 );

	const json = mode.toJSON();
	assert.equal( json.length, 1 );
	assert.ok( Math.abs( json[ 0 ].rotY - Math.PI ) < 1e-6 );

	const reloadedMode = new PropsMode( state, eventBus, {
		getTile() {

			return null;

		},
	}, tileLibrary, null, null );
	reloadedMode.loadFromJSON( json );

	assert.equal( reloadedMode.getPlacedProps().length, 1 );
	assert.ok( Math.abs( reloadedMode.getPlacedProps()[ 0 ].mesh.rotation.y - Math.PI ) < 1e-6 );

} );

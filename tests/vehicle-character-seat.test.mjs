import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Vehicle } from '../js/Vehicle.js';

function createCharacterModel() {

	const root = new THREE.Group();
	root.add( new THREE.Mesh( new THREE.BoxGeometry( 1, 1, 1 ), new THREE.MeshBasicMaterial() ) );
	return root;

}

function createVehicleModel() {

	const root = new THREE.Group();
	const body = new THREE.Mesh( new THREE.BoxGeometry( 2, 1, 3 ), new THREE.MeshBasicMaterial() );
	body.name = 'body';
	const seatAnchor = new THREE.Group();
	seatAnchor.name = 'seat_anchor';
	root.add( body );
	root.add( seatAnchor );
	return root;

}

test( 'Vehicle seats riders without a local flip so they inherit the kart heading', () => {

	const previousWindow = globalThis.window;
	const previousEvent = globalThis.Event;

	try {

		globalThis.window = { dispatchEvent() {} };
		if ( typeof globalThis.Event !== 'function' ) {

			globalThis.Event = class Event {

				constructor( type ) {

					this.type = type;

				}

			};

		}

		const vehicle = new Vehicle();
		vehicle.seatAnchor = new THREE.Group();

		vehicle._attachCharacter( createCharacterModel(), { x: 0.25, y: 1.5, z: - 0.2 } );

		assert.ok( vehicle.characterModel );
		assert.equal( vehicle.characterModel.position.x, 0.25 );
		assert.equal( vehicle.characterModel.position.y, 1.5 );
		assert.equal( vehicle.characterModel.position.z, - 0.2 );
		assert.ok( Math.abs( vehicle.characterModel.rotation.y ) < 1e-6 );
		assert.equal( vehicle.seatAnchor.children.includes( vehicle.characterModel ), true );

	} finally {

		if ( previousWindow === undefined ) delete globalThis.window;
		else globalThis.window = previousWindow;

		if ( previousEvent === undefined ) delete globalThis.Event;
		else globalThis.Event = previousEvent;

	}

} );

test( 'Vehicle keeps the kart visual unflipped while the rider stays unflipped', () => {

	const previousWindow = globalThis.window;
	const previousEvent = globalThis.Event;

	try {

		globalThis.window = { dispatchEvent() {} };
		if ( typeof globalThis.Event !== 'function' ) {

			globalThis.Event = class Event {

				constructor( type ) {

					this.type = type;

				}

			};

		}

		const vehicle = new Vehicle();
		vehicle.init( createVehicleModel(), createCharacterModel(), { x: 0, y: 1, z: 0 }, 0.35 );

		assert.ok( Math.abs( vehicle.visualRoot.rotation.y ) < 1e-6 );
		assert.ok( vehicle.characterModel );
		assert.ok( Math.abs( vehicle.characterModel.rotation.y ) < 1e-6 );

	} finally {

		if ( previousWindow === undefined ) delete globalThis.window;
		else globalThis.window = previousWindow;

		if ( previousEvent === undefined ) delete globalThis.Event;
		else globalThis.Event = previousEvent;

	}

} );

import test from 'node:test';
import assert from 'node:assert/strict';

import { RaceMode } from '../js/RaceMode.js';

function createTrackIntel() {

	return {
		getProgress( x ) {

			return x;

		},
		getNearestWaypoint( x ) {

			return Math.round( x * 10 );

		},
	};

}

function createVehicle( progress ) {

	return {
		vehPos: {
			x: progress,
			z: 0,
			clone() {

				return {
					x: this.x,
					z: this.z,
					copy( other ) {

						this.x = other.x;
						this.z = other.z;

					},
				};

			},
		},
		boostMeter: 0,
		boostActive: false,
		shieldActive: false,
		starActive: false,
		driftActive: false,
		driftSparkTier: 0,
		_aerialHintTimer: 0,
		_aerialHintText: '',
	};

}

test( 'RaceMode exposes a shared leaderboard model for local place and top three', () => {

	const mode = new RaceMode( { totalLaps: 3 } );
	mode.trackIntel = createTrackIntel();
	mode._transitionToRacing();
	mode._lap = 1;

	const localVehicle = createVehicle( 0.4 );
	const remoteVehicle = createVehicle( 0.1 );
	const aiVehicle = createVehicle( 0.8 );

	mode.update( 0, localVehicle, [
		{ id: '_local', vehicle: localVehicle, displayLabel: 'Caleb', isLocal: true },
		{ id: 'remote-1', vehicle: remoteVehicle, displayLabel: 'Alex', isLocal: false },
	], [
		{ id: 'ai-1', vehicle: aiVehicle, lap: 1, displayLabel: 'CPU' },
	] );

	const displayState = mode.getDisplayState();

	assert.equal( displayState.position, 2 );
	assert.equal( displayState.positionLabel, '2ND' );
	assert.deepEqual( displayState.leaders, [
		{ position: 1, name: 'CPU', isLocal: false },
		{ position: 2, name: 'Caleb', isLocal: true },
		{ position: 3, name: 'Alex', isLocal: false },
	] );

} );

test( 'RaceMode ranks remote humans by remote lap state and ignores stale lap updates', () => {

	const mode = new RaceMode( { totalLaps: 3 } );
	mode.trackIntel = createTrackIntel();
	mode._transitionToRacing();
	mode._lap = 1;

	const localVehicle = createVehicle( 0.95 );
	const remoteVehicle = createVehicle( 0.1 );

	mode.setRemoteLap( 'remote-1', 2 );
	mode.setRemoteLap( 'remote-1', 1 );
	mode.update( 0, localVehicle, [
		{ id: '_local', vehicle: localVehicle, displayLabel: 'Caleb', isLocal: true },
		{ id: 'remote-1', vehicle: remoteVehicle, displayLabel: 'River', isLocal: false },
	], [] );

	const displayState = mode.getDisplayState();

	assert.equal( displayState.position, 2 );
	assert.equal( displayState.leaders[ 0 ].name, 'River' );
	assert.equal( displayState.leaders[ 0 ].position, 1 );

} );

test( 'RaceMode renders only the leaderboard rows that exist for small fields', () => {

	const mode = new RaceMode( { totalLaps: 3 } );
	mode.trackIntel = createTrackIntel();
	mode._transitionToRacing();

	const localVehicle = createVehicle( 0.2 );

	mode.update( 0, localVehicle, [
		{ id: '_local', vehicle: localVehicle, displayLabel: 'YOU', isLocal: true },
	], [] );

	const displayState = mode.getDisplayState();

	assert.equal( displayState.position, 1 );
	assert.equal( displayState.leaders.length, 1 );
	assert.deepEqual( displayState.leaders[ 0 ], { position: 1, name: 'YOU', isLocal: true } );

} );

test( 'RaceMode ignores remote lap updates outside the active racing state', () => {

	const mode = new RaceMode( { totalLaps: 3 } );

	mode.setRemoteLap( 'remote-1', 2 );
	assert.equal( mode._remoteLapById.has( 'remote-1' ), false );

	mode._transitionToRacing();
	mode.setRemoteLap( 'remote-1', 2 );
	assert.equal( mode._remoteLapById.get( 'remote-1' ), 2 );

	mode.reset();
	mode.setRemoteLap( 'remote-1', 3 );
	assert.equal( mode._remoteLapById.has( 'remote-1' ), false );

} );

import test from 'node:test';
import assert from 'node:assert/strict';

import { PlayerManager } from '../js/PlayerManager.js';

function createBarePlayerManager() {

	const manager = Object.create( PlayerManager.prototype );
	manager.spawnPosition = [ 10, 0, 20 ];
	manager.spawnAngle = 0;
	manager.players = new Map();
	manager.localId = null;
	manager.localVehicle = null;
	manager._humanRaceDataCache = [];
	manager._nextFallbackLabelNumber = 2;
	return manager;

}

function createEntry( manager, {
	vehicle,
	displayName = '',
	fallbackLabel = 'PLAYER 2',
	spectating = false,
	spawnSlot = 0,
} ) {

	return manager._createPlayerEntry( {
		vehicle,
		smokeTrails: null,
		driftSparks: null,
		boostFlame: null,
		tireMarks: null,
		spectating,
		displayName,
		fallbackLabel,
		spawnSlot,
	} );

}

test( 'PlayerManager computes deterministic multi-row spawn poses from spawn slots', () => {

	const manager = createBarePlayerManager();

	assert.deepEqual( manager._computeSpawnPose( 0 ), {
		slot: 0,
		angle: 0,
		position: [ 10, 0, 20 ],
	} );
	assert.deepEqual( manager._computeSpawnPose( 1 ).position, [ 7, 0, 20 ] );
	assert.deepEqual( manager._computeSpawnPose( 2 ).position, [ 13, 0, 20 ] );
	assert.deepEqual( manager._computeSpawnPose( 4 ).position, [ 7, 0, 24 ] );

} );

test( 'PlayerManager falls back to spawn slot 0 when slot metadata is missing', () => {

	const manager = createBarePlayerManager();

	assert.equal( manager._normalizeSpawnSlot( undefined ), 0 );
	assert.deepEqual( manager._computeSpawnPose( undefined ).position, [ 10, 0, 20 ] );

} );

test( 'PlayerManager.getHumanRaceData returns stable labels for active human racers', () => {

	const manager = createBarePlayerManager();
	const localVehicle = { id: 'local-kart' };
	const remoteVehicle = { id: 'remote-kart' };

	manager.localId = '_local';
	manager.localVehicle = localVehicle;
	manager.players.set( '_local', createEntry( manager, {
		vehicle: localVehicle,
		displayName: 'Caleb',
		fallbackLabel: 'YOU',
	} ) );
	manager.players.set( 'remote-1', createEntry( manager, {
		vehicle: remoteVehicle,
		displayName: 'Alex',
		fallbackLabel: 'PLAYER 2',
	} ) );
	manager.players.set( 'spectator', createEntry( manager, {
		vehicle: { id: 'spectator-kart' },
		displayName: 'Hidden',
		fallbackLabel: 'PLAYER 3',
		spectating: true,
	} ) );

	const humanRaceData = manager.getHumanRaceData();

	assert.deepEqual( humanRaceData, [
		{ id: '_local', vehicle: localVehicle, displayLabel: 'Caleb', isLocal: true },
		{ id: 'remote-1', vehicle: remoteVehicle, displayLabel: 'Alex', isLocal: false },
	] );

} );

test( 'PlayerManager keeps remote fallback labels stable across roster changes', () => {

	const manager = createBarePlayerManager();
	const remoteA = createEntry( manager, {
		vehicle: { id: 'kart-a' },
		fallbackLabel: manager._allocateRemoteFallbackLabel(),
	} );
	const remoteB = createEntry( manager, {
		vehicle: { id: 'kart-b' },
		fallbackLabel: manager._allocateRemoteFallbackLabel(),
	} );

	manager.players.set( 'remote-a', remoteA );
	manager.players.set( 'remote-b', remoteB );
	manager.players.delete( 'remote-a' );

	const humanRaceData = manager.getHumanRaceData();

	assert.equal( humanRaceData.length, 1 );
	assert.equal( humanRaceData[ 0 ].displayLabel, 'PLAYER 3' );

} );

test( 'PlayerManager updates a fallback label when a real remote name arrives later', () => {

	const manager = createBarePlayerManager();
	const remoteEntry = createEntry( manager, {
		vehicle: { id: 'kart-b' },
		fallbackLabel: 'PLAYER 2',
	} );

	manager._updatePlayerDisplayName( remoteEntry, 'River' );
	manager.players.set( 'remote-b', remoteEntry );

	const humanRaceData = manager.getHumanRaceData();

	assert.equal( humanRaceData[ 0 ].displayLabel, 'River' );

} );

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const TEST_PORT = 9876;
const WS_URL = `ws://localhost:${ TEST_PORT }`;
const TIMEOUT = 5000;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Connect a WebSocket client and resolve once the connection is open. */
function connectClient( port = TEST_PORT ) {

	return new Promise( ( resolve, reject ) => {

		const ws = new WebSocket( `ws://localhost:${ port }` );
		const timer = setTimeout( () => {

			ws.terminate();
			reject( new Error( 'WebSocket connection timed out' ) );

		}, TIMEOUT );

		ws.on( 'open', () => {

			clearTimeout( timer );
			resolve( ws );

		} );

		ws.on( 'error', ( err ) => {

			clearTimeout( timer );
			reject( err );

		} );

	} );

}

/**
 * Send a JSON message and wait for a response of the expected type.
 * Returns the parsed message.
 */
function sendAndWait( ws, msg, expectedType ) {

	return new Promise( ( resolve, reject ) => {

		const timer = setTimeout( () => {

			ws.removeListener( 'message', handler );
			reject( new Error( `Timed out waiting for message type "${ expectedType }"` ) );

		}, TIMEOUT );

		function handler( raw ) {

			const data = JSON.parse( raw.toString() );
			if ( data.type === expectedType ) {

				clearTimeout( timer );
				ws.removeListener( 'message', handler );
				resolve( data );

			}

		}

		ws.on( 'message', handler );
		ws.send( JSON.stringify( msg ) );

	} );

}

/** Wait for the next message of a given type (without sending anything). */
function waitForMessage( ws, expectedType ) {

	return new Promise( ( resolve, reject ) => {

		const timer = setTimeout( () => {

			ws.removeListener( 'message', handler );
			reject( new Error( `Timed out waiting for message type "${ expectedType }"` ) );

		}, TIMEOUT );

		function handler( raw ) {

			const data = JSON.parse( raw.toString() );
			if ( data.type === expectedType ) {

				clearTimeout( timer );
				ws.removeListener( 'message', handler );
				resolve( data );

			}

		}

		ws.on( 'message', handler );

	} );

}

/** Safely close a WebSocket if it's still open. */
function safeClose( ws ) {

	if ( ws && ws.readyState <= WebSocket.OPEN ) {

		ws.close();

	}

}

/** Collect all clients created during a test for cleanup. */
let activeClients = [];

function trackClient( ws ) {

	activeClients.push( ws );
	return ws;

}

// ── Server lifecycle ───────────────────────────────────────────────────────

let serverProcess;

before( async () => {

	await new Promise( ( resolve, reject ) => {

		serverProcess = spawn( 'node', [ 'server.js' ], {
			cwd: '/Users/calebsmiler/Desktop/OS/kart-kids',
			env: { ...process.env, PORT: String( TEST_PORT ) },
			stdio: [ 'ignore', 'pipe', 'pipe' ],
		} );

		const timer = setTimeout( () => {

			reject( new Error( 'Server failed to start within 10s' ) );

		}, 10000 );

		serverProcess.stdout.on( 'data', ( chunk ) => {

			if ( chunk.toString().includes( 'running at' ) ) {

				clearTimeout( timer );
				resolve();

			}

		} );

		serverProcess.stderr.on( 'data', ( chunk ) => {

			// Some Node warnings go to stderr; only reject on actual errors
			const text = chunk.toString();
			if ( text.includes( 'Error' ) || text.includes( 'EADDRINUSE' ) ) {

				clearTimeout( timer );
				reject( new Error( `Server error: ${ text }` ) );

			}

		} );

		serverProcess.on( 'exit', ( code ) => {

			if ( code !== null && code !== 0 ) {

				clearTimeout( timer );
				reject( new Error( `Server exited with code ${ code }` ) );

			}

		} );

	} );

} );

after( () => {

	if ( serverProcess ) {

		serverProcess.kill( 'SIGTERM' );

	}

} );

afterEach( () => {

	for ( const ws of activeClients ) {

		safeClose( ws );

	}

	activeClients = [];

} );

// ── 1. Room creation ───────────────────────────────────────────────────────

describe( 'Room creation', () => {

	it( 'should return welcome with a 6-char alphanumeric room code', async () => {

		const ws = trackClient( await connectClient() );
		const welcome = await sendAndWait( ws, { type: 'createRoom' }, 'welcome' );

		assert.strictEqual( welcome.type, 'welcome' );
		assert.ok( welcome.roomCode, 'welcome should include roomCode' );
		assert.strictEqual( welcome.roomCode.length, 6 );
		assert.match( welcome.roomCode, /^[A-Z0-9]{6}$/ );
		assert.ok( welcome.id, 'welcome should include player id' );
		assert.ok( welcome.sessionToken, 'welcome should include sessionToken' );
		assert.strictEqual( welcome.spawnSlot, 0, 'host should receive the first spawn slot' );

	} );

	it( 'should produce unique room codes across multiple creates', async () => {

		const codes = new Set();

		for ( let i = 0; i < 5; i ++ ) {

			const ws = trackClient( await connectClient() );
			const welcome = await sendAndWait( ws, { type: 'createRoom' }, 'welcome' );
			codes.add( welcome.roomCode );

		}

		assert.strictEqual( codes.size, 5, 'all 5 room codes should be unique' );

	} );

} );

// ── 2. Room joining ────────────────────────────────────────────────────────

describe( 'Room joining', () => {

	it( 'should allow Client B to join a room created by Client A', async () => {

		const wsA = trackClient( await connectClient() );
		const welcomeA = await sendAndWait( wsA, { type: 'createRoom' }, 'welcome' );
		const roomCode = welcomeA.roomCode;

		// Set up listener on A for playerJoin BEFORE B joins
		const joinPromise = waitForMessage( wsA, 'playerJoin' );

		const wsB = trackClient( await connectClient() );
		const welcomeB = await sendAndWait( wsB, { type: 'joinRoom', roomCode }, 'welcome' );

		assert.strictEqual( welcomeB.roomCode, roomCode );
		assert.ok( welcomeB.existingPlayers.length >= 1, 'joiner should see existing players' );
		assert.strictEqual( welcomeA.spawnSlot, 0 );
		assert.strictEqual( welcomeB.spawnSlot, 1 );
		assert.strictEqual( welcomeB.existingPlayers[ 0 ].spawnSlot, 0 );

		const joinMsg = await joinPromise;
		assert.strictEqual( joinMsg.type, 'playerJoin' );
		assert.strictEqual( joinMsg.id, welcomeB.id );
		assert.strictEqual( joinMsg.spawnSlot, 1 );

	} );

	it( 'should round-trip normalized appearance data through welcome and playerJoin payloads', async () => {

		const hostAppearance = {
			vehicleColor: '#FFAA00',
			characterColor: '#11AAFF',
			charSkinColor: '#CC9966',
			charAccessories: {
				Balaclava_No_Ears: { visible: false, color: '#00FF11' },
			},
		};
		const guestAppearance = {
			vehicleColor: '#00FF88',
			charAccessories: {
				Baseball_Hat: { visible: true, color: '#1122FF' },
			},
		};

		const wsA = trackClient( await connectClient() );
		const welcomeA = await sendAndWait( wsA, {
			type: 'createRoom',
			appearance: hostAppearance,
		}, 'welcome' );
		const joinPromise = waitForMessage( wsA, 'playerJoin' );

		assert.strictEqual( welcomeA.appearance.vehicleColor, '#ffaa00' );
		assert.strictEqual( welcomeA.appearance.characterColor, '#11aaff' );
		assert.strictEqual( welcomeA.appearance.charSkinColor, '#cc9966' );
		assert.deepStrictEqual( welcomeA.appearance.charAccessories.Balaclava_No_Ears, {
			visible: false,
			color: '#00ff11',
		} );

		const wsB = trackClient( await connectClient() );
		const welcomeB = await sendAndWait( wsB, {
			type: 'joinRoom',
			roomCode: welcomeA.roomCode,
			appearance: guestAppearance,
		}, 'welcome' );
		const joinMsg = await joinPromise;

		assert.strictEqual( welcomeB.appearance.vehicleColor, '#00ff88' );
		assert.strictEqual( joinMsg.appearance.vehicleColor, '#00ff88' );
		assert.deepStrictEqual( joinMsg.appearance.charAccessories.Baseball_Hat, {
			visible: true,
			color: '#1122ff',
		} );
		assert.strictEqual( welcomeB.existingPlayers.length, 1 );
		assert.strictEqual( welcomeB.existingPlayers[ 0 ].appearance.vehicleColor, '#ffaa00' );
		assert.deepStrictEqual( welcomeB.existingPlayers[ 0 ].appearance.charAccessories.Balaclava_No_Ears, {
			visible: false,
			color: '#00ff11',
		} );

	} );

	it( 'should return error with code roomNotFound for invalid room code', async () => {

		const ws = trackClient( await connectClient() );
		const err = await sendAndWait( ws, { type: 'joinRoom', roomCode: 'ZZZZZZ' }, 'error' );

		assert.strictEqual( err.code, 'roomNotFound' );

	} );

	it( 'should return error with code roomFull when room has 8 players', async () => {

		// Create room
		const host = trackClient( await connectClient() );
		const welcome = await sendAndWait( host, { type: 'createRoom' }, 'welcome' );
		const roomCode = welcome.roomCode;

		// Fill room to 8 (host + 7 more)
		for ( let i = 0; i < 7; i ++ ) {

			const ws = trackClient( await connectClient() );
			await sendAndWait( ws, { type: 'joinRoom', roomCode }, 'welcome' );

		}

		// 9th player should be rejected
		const ws9 = trackClient( await connectClient() );
		const err = await sendAndWait( ws9, { type: 'joinRoom', roomCode }, 'error' );

		assert.strictEqual( err.code, 'roomFull' );

	} );

} );

// ── 3. Matchmaking ─────────────────────────────────────────────────────────

describe( 'Matchmaking', () => {

	it( 'should place a findRoom client into a room', async () => {

		const ws = trackClient( await connectClient() );
		const welcome = await sendAndWait( ws, { type: 'findRoom' }, 'welcome' );

		assert.ok( welcome.roomCode, 'should receive a room code' );
		assert.notStrictEqual( welcome.roomCode, '__default__', 'should not be default room' );

	} );

	it( 'should place two findRoom clients in the same room', async () => {

		const ws1 = trackClient( await connectClient() );
		const welcome1 = await sendAndWait( ws1, { type: 'findRoom' }, 'welcome' );

		const ws2 = trackClient( await connectClient() );
		const welcome2 = await sendAndWait( ws2, { type: 'findRoom' }, 'welcome' );

		assert.strictEqual( welcome1.roomCode, welcome2.roomCode,
			'both findRoom clients should end up in the same room' );

	} );

} );

// ── 4. Host authority ──────────────────────────────────────────────────────

describe( 'Host authority', () => {

	it( 'should make the room creator the host', async () => {

		const ws = trackClient( await connectClient() );
		const welcome = await sendAndWait( ws, { type: 'createRoom' }, 'welcome' );

		assert.strictEqual( welcome.host, welcome.id );

	} );

	it( 'should reject startRace from non-host', async () => {

		const wsA = trackClient( await connectClient() );
		const welcomeA = await sendAndWait( wsA, { type: 'createRoom' }, 'welcome' );

		const wsB = trackClient( await connectClient() );
		await sendAndWait( wsB, { type: 'joinRoom', roomCode: welcomeA.roomCode }, 'welcome' );

		const err = await sendAndWait( wsB, { type: 'startRace' }, 'error' );
		assert.strictEqual( err.code, 'notHost' );

	} );

	it( 'should broadcast raceCountdown when host sends startRace', async () => {

		const wsA = trackClient( await connectClient() );
		const welcomeA = await sendAndWait( wsA, { type: 'createRoom' }, 'welcome' );

		const wsB = trackClient( await connectClient() );
		await sendAndWait( wsB, { type: 'joinRoom', roomCode: welcomeA.roomCode }, 'welcome' );

		const loadingA = waitForMessage( wsA, 'raceLoading' );
		const loadingB = waitForMessage( wsB, 'raceLoading' );

		wsA.send( JSON.stringify( { type: 'startRace' } ) );

		const [ loadingMsgA, loadingMsgB ] = await Promise.all( [ loadingA, loadingB ] );

		assert.strictEqual( loadingMsgA.type, 'raceLoading' );
		assert.strictEqual( loadingMsgB.type, 'raceLoading' );
		assert.strictEqual( loadingMsgA.players.length, 1 );
		assert.strictEqual( loadingMsgA.players[ 0 ].spawnSlot, 1 );
		assert.strictEqual( loadingMsgB.players.length, 1 );
		assert.strictEqual( loadingMsgB.players[ 0 ].spawnSlot, 0 );

		const countdownA = waitForMessage( wsA, 'raceCountdown' );
		const countdownB = waitForMessage( wsB, 'raceCountdown' );

		wsA.send( JSON.stringify( { type: 'raceLoaded' } ) );
		wsB.send( JSON.stringify( { type: 'raceLoaded' } ) );

		const [ msgA, msgB ] = await Promise.all( [ countdownA, countdownB ] );

		assert.strictEqual( msgA.type, 'raceCountdown' );
		assert.strictEqual( msgA.count, 3 );
		assert.strictEqual( msgB.type, 'raceCountdown' );
		assert.strictEqual( msgB.count, 3 );

	} );

} );

// ── 5. Player lifecycle ────────────────────────────────────────────────────

describe( 'Player lifecycle', () => {

	it( 'should broadcast playerLeave when a player disconnects', async () => {

		const wsA = trackClient( await connectClient() );
		const welcomeA = await sendAndWait( wsA, { type: 'createRoom' }, 'welcome' );

		const wsB = trackClient( await connectClient() );
		const welcomeB = await sendAndWait( wsB, { type: 'joinRoom', roomCode: welcomeA.roomCode }, 'welcome' );

		// Listen for playerLeave on A
		const leavePromise = waitForMessage( wsA, 'playerLeave' );

		// B disconnects — server starts grace period, then removes after RECONNECT_GRACE_MS
		// But playerLeave is sent after grace period expires.
		// For test purposes we can force a clean leave by sending leaveRoom first.
		// Actually, on close the server starts a 30s grace period.
		// Let's use leaveRoom for immediate leave.
		wsB.send( JSON.stringify( { type: 'leaveRoom' } ) );

		// Wait for A to see the playerLeave
		const leaveMsg = await leavePromise;
		assert.strictEqual( leaveMsg.type, 'playerLeave' );
		assert.strictEqual( leaveMsg.id, welcomeB.id );

	} );

	it( 'should assign new host and broadcast hostChange when host leaves', async () => {

		const wsA = trackClient( await connectClient() );
		const welcomeA = await sendAndWait( wsA, { type: 'createRoom' }, 'welcome' );
		const roomCode = welcomeA.roomCode;

		const wsB = trackClient( await connectClient() );
		const welcomeB = await sendAndWait( wsB, { type: 'joinRoom', roomCode }, 'welcome' );

		// Listen for hostChange on B
		const hostChangePromise = waitForMessage( wsB, 'hostChange' );

		// Host A leaves
		wsA.send( JSON.stringify( { type: 'leaveRoom' } ) );

		const hostMsg = await hostChangePromise;
		assert.strictEqual( hostMsg.type, 'hostChange' );
		assert.strictEqual( hostMsg.id, welcomeB.id, 'B should become the new host' );

	} );

	it( 'should destroy room when all players leave (join attempt fails)', async () => {

		const wsA = trackClient( await connectClient() );
		const welcomeA = await sendAndWait( wsA, { type: 'createRoom' }, 'welcome' );
		const roomCode = welcomeA.roomCode;

		// Leave the room
		wsA.send( JSON.stringify( { type: 'leaveRoom' } ) );

		// Wait a beat for server to process the leave and destroy the room
		await new Promise( ( r ) => setTimeout( r, 100 ) );

		// Try to join the now-destroyed room
		const wsB = trackClient( await connectClient() );
		const err = await sendAndWait( wsB, { type: 'joinRoom', roomCode }, 'error' );

		assert.strictEqual( err.code, 'roomNotFound' );

	} );

} );

// ── 6. Reconnect ───────────────────────────────────────────────────────────

describe( 'Reconnect', () => {

	it( 'should include sessionToken in welcome message', async () => {

		const ws = trackClient( await connectClient() );
		const welcome = await sendAndWait( ws, { type: 'createRoom' }, 'welcome' );

		assert.ok( welcome.sessionToken, 'welcome must include a sessionToken' );
		assert.strictEqual( typeof welcome.sessionToken, 'string' );

	} );

	it( 'should restore player to room on reconnect with valid token', async () => {

		// Create room with two players so room survives host disconnect
		const wsA = trackClient( await connectClient() );
		const welcomeA = await sendAndWait( wsA, { type: 'createRoom' }, 'welcome' );
		const roomCode = welcomeA.roomCode;

		const wsB = trackClient( await connectClient() );
		await sendAndWait( wsB, { type: 'joinRoom', roomCode }, 'welcome' );

		const sessionToken = welcomeA.sessionToken;
		const playerId = welcomeA.id;

		// Listen for playerReconnect on B
		const reconnectPromise = waitForMessage( wsB, 'playerReconnect' );

		// Disconnect A (raw close, not leaveRoom — triggers grace period)
		wsA.close();

		// Wait a moment for server to register disconnect
		await new Promise( ( r ) => setTimeout( r, 200 ) );

		// Reconnect with token
		const wsA2 = trackClient( await connectClient() );
		const welcome2 = await sendAndWait( wsA2, { type: 'reconnect', sessionToken }, 'welcome' );

		assert.strictEqual( welcome2.id, playerId, 'should get same player id' );
		assert.strictEqual( welcome2.roomCode, roomCode, 'should be in same room' );
		assert.strictEqual( welcome2.reconnected, true );
		assert.strictEqual( welcome2.spawnSlot, welcomeA.spawnSlot );

		// B should get playerReconnect
		const reconnMsg = await reconnectPromise;
		assert.strictEqual( reconnMsg.id, playerId );

	} );

	it( 'should return error for invalid/expired session token', async () => {

		const ws = trackClient( await connectClient() );
		const err = await sendAndWait(
			ws,
			{ type: 'reconnect', sessionToken: 'invalid-token-12345' },
			'error'
		);

		assert.strictEqual( err.code, 'sessionExpired' );

	} );

} );

// ── 7. Backward compatibility ──────────────────────────────────────────────

describe( 'Backward compatibility', () => {

	it( 'should auto-place client in default room if no room message sent', async () => {

		const ws = trackClient( await connectClient() );

		// Server auto-joins after 200ms timeout
		const welcome = await waitForMessage( ws, 'welcome' );

		assert.strictEqual( welcome.type, 'welcome' );
		assert.strictEqual( welcome.roomCode, '__default__' );
		assert.ok( welcome.id );

	} );

	it( 'should allow legacy client to send state and receive world updates', async () => {

		// Connect two legacy clients (no room messages — auto-join default)
		const ws1 = trackClient( await connectClient() );
		const welcome1 = await waitForMessage( ws1, 'welcome' );

		const ws2 = trackClient( await connectClient() );
		const welcome2 = await waitForMessage( ws2, 'welcome' );

		// Both in default room — send state from ws1
		ws1.send( JSON.stringify( {
			type: 'state',
			pos: [ 0, 0, 0 ],
			rot: [ 0, 0, 0, 1 ],
			vel: [ 0, 0, 0 ],
			angVel: [ 0, 0, 0 ],
			speed: 0,
			drift: false,
			boost: false,
			shield: false,
			star: false,
		} ) );

		// ws2 should eventually get a world message containing ws1's state
		const world = await waitForMessage( ws2, 'world' );

		assert.strictEqual( world.type, 'world' );
		assert.ok( Array.isArray( world.players ), 'world should have players array' );
		assert.ok( world.players.length >= 1 );

		const other = world.players.find( ( p ) => p.id === welcome1.id );
		assert.ok( other, 'world update should include the other player' );

	} );

} );

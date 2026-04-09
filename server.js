import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { join, extname } from 'path';
import { gzipSync } from 'zlib';
import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';

const PORT = process.env.PORT || 3000;
const TICK_RATE = 20;
const ROOT = decodeURIComponent( new URL( '.', import.meta.url ).pathname ).replace( /^\/([A-Z]:)/, '$1' );

const MIME = {
	'.html': 'text/html',
	'.js': 'application/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.glb': 'model/gltf-binary',
	'.gltf': 'model/gltf+json',
	'.bin': 'application/octet-stream',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.mp3': 'audio/mpeg',
	'.ogg': 'audio/ogg',
	'.wav': 'audio/wav',
	'.svg': 'image/svg+xml',
	'.webp': 'image/webp',
	'.ktx2': 'image/ktx2',
};

const COMPRESSIBLE = new Set( [ '.html', '.js', '.css', '.json', '.gltf', '.svg' ] );
const LONG_CACHE = new Set( [ '.glb', '.gltf', '.bin', '.png', '.jpg', '.ktx2', '.mp3', '.ogg', '.wav' ] );

// ── Static file server ───────────────────────────────────────────────────────

const httpServer = createServer( async ( req, res ) => {

	let urlPath = decodeURIComponent( new URL( req.url, 'http://localhost' ).pathname );
	if ( urlPath === '/' ) urlPath = '/index.html';

	const filePath = join( ROOT, urlPath );
	const ext = extname( filePath ).toLowerCase();

	try {

		const data = await readFile( filePath );
		const headers = { 'Content-Type': MIME[ ext ] || 'application/octet-stream' };

		// Cache headers — dev mode: no-cache for JS/HTML/CSS so edits are instant
		if ( ext === '.js' || ext === '.html' || ext === '.css' ) {

			headers[ 'Cache-Control' ] = 'no-cache, must-revalidate';

		} else if ( LONG_CACHE.has( ext ) ) {

			headers[ 'Cache-Control' ] = 'public, max-age=604800, immutable';

		} else {

			headers[ 'Cache-Control' ] = 'public, max-age=3600';

		}

		// ETag
		const fileStat = await stat( filePath );
		headers[ 'ETag' ] = `"${ fileStat.mtimeMs.toString( 36 ) }-${ fileStat.size.toString( 36 ) }"`;

		// 304 Not Modified
		if ( req.headers[ 'if-none-match' ] === headers[ 'ETag' ] ) {

			res.writeHead( 304 );
			res.end();
			return;

		}

		// Gzip for compressible types
		const acceptGzip = ( req.headers[ 'accept-encoding' ] || '' ).includes( 'gzip' );
		if ( acceptGzip && COMPRESSIBLE.has( ext ) ) {

			headers[ 'Content-Encoding' ] = 'gzip';
			res.writeHead( 200, headers );
			res.end( gzipSync( data ) );

		} else {

			res.writeHead( 200, headers );
			res.end( data );

		}

	} catch {

		res.writeHead( 404 );
		res.end( 'Not found' );

	}

} );

// ── Room system ─────────────────────────────────────────────────────────────

const MAX_PLAYERS_PER_ROOM = 8;
const RECONNECT_GRACE_MS = 30000;
const DEFAULT_ROOM_CODE = '__default__';

const rooms = new Map();
// Map<sessionToken, { playerId, roomCode, timestamp, timeout }>
const disconnectedSessions = new Map();
// Map<ws, { playerId, roomCode, sessionToken }>
const connectedClients = new Map();

let joinCounter = 0;

function generateRoomCode() {

	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let code = '';
	for ( let i = 0; i < 4; i ++ ) {

		code += chars[ Math.floor( Math.random() * chars.length ) ];

	}

	// Avoid collisions
	if ( rooms.has( code ) ) return generateRoomCode();
	return code;

}

function createRoom( code ) {

	const room = {
		code,
		players: new Map(),
		host: null,
		raceState: 'idle',
		trackId: null,
		tickInterval: null,
		countdownTimer: null,
		countdownCount: 0,
		pendingCountdownTimeout: null,
		joinCounter: 0,
	};

	rooms.set( code, room );
	startRoomTick( room );
	return room;

}

function destroyRoom( room ) {

	if ( room.tickInterval ) {

		clearInterval( room.tickInterval );
		room.tickInterval = null;

	}

	resetRoomRace( room );
	rooms.delete( room.code );
	console.log( `Room destroyed: ${ room.code }` );

}

function getOrCreateDefaultRoom() {

	if ( ! rooms.has( DEFAULT_ROOM_CODE ) ) {

		createRoom( DEFAULT_ROOM_CODE );

	}

	return rooms.get( DEFAULT_ROOM_CODE );

}

// ── Per-room broadcast ──────────────────────────────────────────────────────

function roomBroadcast( room, msg, excludeId ) {

	const data = JSON.stringify( msg );
	for ( const [ id, player ] of room.players ) {

		if ( id !== excludeId && player.ws && player.ws.readyState === 1 ) {

			player.ws.send( data );

		}

	}

}

// ── Per-room race state ─────────────────────────────────────────────────────

function startRoomRaceCountdown( room ) {

	room.pendingCountdownTimeout = null;

	if ( room.raceState !== 'idle' ) return;
	if ( room.players.size < 2 ) return;

	room.raceState = 'countdown';
	room.countdownCount = 3;

	roomBroadcast( room, { type: 'raceCountdown', count: room.countdownCount } );

	room.countdownTimer = setInterval( () => {

		room.countdownCount --;

		if ( room.countdownCount > 0 ) {

			roomBroadcast( room, { type: 'raceCountdown', count: room.countdownCount } );

		} else {

			clearInterval( room.countdownTimer );
			room.countdownTimer = null;
			room.raceState = 'racing';
			roomBroadcast( room, { type: 'raceStart' } );

		}

	}, 1000 );

}

function resetRoomRace( room ) {

	if ( room.countdownTimer ) {

		clearInterval( room.countdownTimer );
		room.countdownTimer = null;

	}

	if ( room.pendingCountdownTimeout ) {

		clearTimeout( room.pendingCountdownTimeout );
		room.pendingCountdownTimeout = null;

	}

	room.raceState = 'idle';
	room.countdownCount = 0;

}

// ── Per-room 20Hz tick ──────────────────────────────────────────────────────

function startRoomTick( room ) {

	if ( room.tickInterval ) return;

	room.tickInterval = setInterval( () => {

		if ( room.players.size < 2 ) return;

		for ( const [ id, player ] of room.players ) {

			if ( ! player.ws || player.ws.readyState !== 1 ) continue;

			const others = [];
			for ( const [ pid, p ] of room.players ) {

				if ( pid === id ) continue;
				if ( ! p.lastState ) continue;

				others.push( {
					id: pid,
					pos: p.lastState.pos,
					rot: p.lastState.rot,
					vel: p.lastState.vel,
					angVel: p.lastState.angVel,
					speed: p.lastState.speed,
					drift: p.lastState.drift,
					boost: p.lastState.boost,
					shield: p.lastState.shield,
					star: p.lastState.star,
					spectating: p.spectating,
				} );

			}

			if ( others.length > 0 ) {

				player.ws.send( JSON.stringify( { type: 'world', players: others } ) );

			}

		}

	}, 1000 / TICK_RATE );

}

// ── Vehicle helpers ─────────────────────────────────────────────────────────

function computeTint( index ) {

	if ( index < 4 ) return null;
	const hue = ( index * 137.5 ) % 360;
	return hslToHex( hue, 70, 50 );

}

function hslToHex( h, s, l ) {

	s /= 100;
	l /= 100;
	const a = s * Math.min( l, 1 - l );
	const f = ( n ) => {

		const k = ( n + h / 30 ) % 12;
		const color = l - a * Math.max( Math.min( k - 3, 9 - k, 1 ), - 1 );
		return Math.round( 255 * color ).toString( 16 ).padStart( 2, '0' );

	};
	return '#' + f( 0 ) + f( 8 ) + f( 4 );

}

// ── Room join/leave helpers ─────────────────────────────────────────────────

function addPlayerToRoom( room, playerId, ws, vehicleId ) {

	const index = room.joinCounter ++;
	const vehicleIndex = vehicleId != null ? vehicleId : ( index % 4 );
	const characterIndex = 0;
	const tint = computeTint( joinCounter ++ );

	const player = {
		ws,
		vehicleIndex,
		vehicleId: vehicleId != null ? vehicleId : null,
		characterIndex,
		tint,
		lastState: null,
		spectating: false,
	};

	// If this is the first player, they become host
	if ( room.players.size === 0 ) {

		room.host = playerId;

	}

	// Gather existing players for the new client
	const existingPlayers = [];
	for ( const [ pid, p ] of room.players ) {

		existingPlayers.push( {
			id: pid,
			vehicleIndex: p.vehicleIndex,
			vehicleId: p.vehicleId,
			characterIndex: p.characterIndex,
			tint: p.tint,
			spectating: p.spectating,
		} );

	}

	room.players.set( playerId, player );

	// Track which room this connection belongs to
	const sessionToken = randomUUID();
	connectedClients.set( ws, { playerId, roomCode: room.code, sessionToken } );

	// Send welcome to the new player
	ws.send( JSON.stringify( {
		type: 'welcome',
		id: playerId,
		vehicleIndex,
		vehicleId: player.vehicleId,
		characterIndex,
		tint,
		sessionToken,
		roomCode: room.code,
		host: room.host,
		existingPlayers,
	} ) );

	// Notify others in room
	roomBroadcast( room, {
		type: 'playerJoin',
		id: playerId,
		vehicleIndex,
		vehicleId: player.vehicleId,
		characterIndex,
		tint,
	}, playerId );

	console.log( `Player ${ playerId } joined room ${ room.code } (vehicle ${ vehicleIndex }, tint ${ tint || 'none' })` );

	return { player, sessionToken };

}

function removePlayerFromRoom( room, playerId ) {

	room.players.delete( playerId );
	roomBroadcast( room, { type: 'playerLeave', id: playerId } );

	// Reassign host if host left
	if ( room.host === playerId ) {

		const nextPlayer = room.players.keys().next();
		room.host = nextPlayer.done ? null : nextPlayer.value;

		if ( room.host ) {

			roomBroadcast( room, { type: 'hostChange', id: room.host } );

		}

	}

	// Reset race if not enough players
	if ( room.players.size < 2 && room.raceState !== 'idle' ) {

		resetRoomRace( room );

	}

	// Auto-destroy room when empty (except default room)
	if ( room.players.size === 0 && room.code !== DEFAULT_ROOM_CODE ) {

		// Check if any disconnected sessions reference this room
		let hasDisconnected = false;
		for ( const [ , session ] of disconnectedSessions ) {

			if ( session.roomCode === room.code ) {

				hasDisconnected = true;
				break;

			}

		}

		if ( ! hasDisconnected ) {

			destroyRoom( room );

		}

	}

}

// ── WebSocket server ─────────────────────────────────────────────────────────

const wss = new WebSocketServer( { server: httpServer } );

wss.on( 'connection', ( ws ) => {

	const playerId = randomUUID();
	let hasJoinedRoom = false;

	// Auto-join default room after a brief delay if client doesn't send
	// createRoom/joinRoom/findRoom (backward compatibility)
	const autoJoinTimeout = setTimeout( () => {

		if ( ! hasJoinedRoom ) {

			hasJoinedRoom = true;
			const room = getOrCreateDefaultRoom();

			if ( room.players.size >= MAX_PLAYERS_PER_ROOM ) {

				ws.send( JSON.stringify( { type: 'error', code: 'roomFull', message: 'Default room is full' } ) );
				return;

			}

			addPlayerToRoom( room, playerId, ws );

			// Auto-start countdown for default room (legacy behavior)
			if ( room.players.size >= 2 && room.raceState === 'idle' && ! room.pendingCountdownTimeout ) {

				room.pendingCountdownTimeout = setTimeout( () => startRoomRaceCountdown( room ), 500 );

			}

		}

	}, 200 );

	ws.on( 'message', ( raw ) => {

		let msg;
		try {

			msg = JSON.parse( raw.toString() );

		} catch {

			return;

		}

		const clientInfo = connectedClients.get( ws );

		switch ( msg.type ) {

			// ── Room management ──────────────────────────────────────────

			case 'createRoom': {

				if ( hasJoinedRoom ) {

					ws.send( JSON.stringify( { type: 'error', code: 'alreadyInRoom', message: 'Already in a room' } ) );
					break;

				}

				clearTimeout( autoJoinTimeout );
				hasJoinedRoom = true;

				const code = generateRoomCode();
				const room = createRoom( code );
				addPlayerToRoom( room, playerId, ws, msg.vehicleId );

				console.log( `Room created: ${ code } by ${ playerId }` );
				break;

			}

			case 'joinRoom': {

				if ( hasJoinedRoom ) {

					ws.send( JSON.stringify( { type: 'error', code: 'alreadyInRoom', message: 'Already in a room' } ) );
					break;

				}

				clearTimeout( autoJoinTimeout );
				hasJoinedRoom = true;

				const roomCode = ( msg.roomCode || '' ).toUpperCase().trim();
				const room = rooms.get( roomCode );

				if ( ! room ) {

					ws.send( JSON.stringify( { type: 'error', code: 'roomNotFound', message: 'Room not found' } ) );
					break;

				}

				if ( room.players.size >= MAX_PLAYERS_PER_ROOM ) {

					ws.send( JSON.stringify( { type: 'error', code: 'roomFull', message: 'Room is full' } ) );
					break;

				}

				addPlayerToRoom( room, playerId, ws, msg.vehicleId );
				break;

			}

			case 'findRoom': {

				if ( hasJoinedRoom ) {

					ws.send( JSON.stringify( { type: 'error', code: 'alreadyInRoom', message: 'Already in a room' } ) );
					break;

				}

				clearTimeout( autoJoinTimeout );
				hasJoinedRoom = true;

				// Find an available room (not default, idle, has slots)
				let foundRoom = null;
				for ( const [ code, room ] of rooms ) {

					if ( code === DEFAULT_ROOM_CODE ) continue;
					if ( room.raceState !== 'idle' ) continue;
					if ( room.players.size >= MAX_PLAYERS_PER_ROOM ) continue;
					foundRoom = room;
					break;

				}

				// Create new room if none available
				if ( ! foundRoom ) {

					const code = generateRoomCode();
					foundRoom = createRoom( code );
					console.log( `Matchmaking created room: ${ code }` );

				}

				addPlayerToRoom( foundRoom, playerId, ws, msg.vehicleId );
				break;

			}

			case 'leaveRoom': {

				if ( ! clientInfo ) break;

				const room = rooms.get( clientInfo.roomCode );
				if ( ! room ) break;

				connectedClients.delete( ws );
				removePlayerFromRoom( room, clientInfo.playerId );
				hasJoinedRoom = false;

				ws.send( JSON.stringify( { type: 'leftRoom' } ) );
				break;

			}

			case 'reconnect': {

				if ( hasJoinedRoom ) {

					ws.send( JSON.stringify( { type: 'error', code: 'alreadyInRoom', message: 'Already in a room' } ) );
					break;

				}

				clearTimeout( autoJoinTimeout );

				const session = disconnectedSessions.get( msg.sessionToken );

				if ( ! session ) {

					ws.send( JSON.stringify( { type: 'error', code: 'sessionExpired', message: 'Session expired or invalid' } ) );
					break;

				}

				// Clear the disconnect timeout
				clearTimeout( session.timeout );
				disconnectedSessions.delete( msg.sessionToken );

				const room = rooms.get( session.roomCode );
				if ( ! room ) {

					ws.send( JSON.stringify( { type: 'error', code: 'roomNotFound', message: 'Room no longer exists' } ) );
					break;

				}

				// Restore player to room
				hasJoinedRoom = true;
				const existingPlayer = room.players.get( session.playerId );

				if ( existingPlayer ) {

					// Player record still exists (within grace period)
					existingPlayer.ws = ws;
					connectedClients.set( ws, {
						playerId: session.playerId,
						roomCode: session.roomCode,
						sessionToken: msg.sessionToken,
					} );

					// Gather existing players
					const existingPlayers = [];
					for ( const [ pid, p ] of room.players ) {

						if ( pid === session.playerId ) continue;
						existingPlayers.push( {
							id: pid,
							vehicleIndex: p.vehicleIndex,
							vehicleId: p.vehicleId,
							characterIndex: p.characterIndex,
							tint: p.tint,
							spectating: p.spectating,
						} );

					}

					ws.send( JSON.stringify( {
						type: 'welcome',
						id: session.playerId,
						vehicleIndex: existingPlayer.vehicleIndex,
						vehicleId: existingPlayer.vehicleId,
						characterIndex: existingPlayer.characterIndex,
						tint: existingPlayer.tint,
						sessionToken: msg.sessionToken,
						roomCode: room.code,
						host: room.host,
						existingPlayers,
						reconnected: true,
					} ) );

					// Notify others of reconnection
					roomBroadcast( room, {
						type: 'playerReconnect',
						id: session.playerId,
					}, session.playerId );

					console.log( `Player ${ session.playerId } reconnected to room ${ room.code }` );

				} else {

					ws.send( JSON.stringify( { type: 'error', code: 'sessionExpired', message: 'Player no longer in room' } ) );

				}

				break;

			}

			// ── Race management ──────────────────────────────────────────

			case 'startRace': {

				if ( ! clientInfo ) break;

				const room = rooms.get( clientInfo.roomCode );
				if ( ! room ) break;

				// Only host can start race (except in default room for backward compat)
				if ( room.code !== DEFAULT_ROOM_CODE && room.host !== clientInfo.playerId ) {

					ws.send( JSON.stringify( { type: 'error', code: 'notHost', message: 'Only the host can start the race' } ) );
					break;

				}

				if ( room.raceState !== 'idle' ) break;

				if ( msg.trackId != null ) {

					room.trackId = msg.trackId;

				}

				startRoomRaceCountdown( room );
				break;

			}

			// ── Game state (room-scoped) ─────────────────────────────────

			case 'state': {

				if ( ! clientInfo ) break;
				const room = rooms.get( clientInfo.roomCode );
				if ( ! room ) break;
				const player = room.players.get( clientInfo.playerId );
				if ( player ) player.lastState = msg;
				break;

			}

			case 'spectate': {

				if ( ! clientInfo ) break;
				const room = rooms.get( clientInfo.roomCode );
				if ( ! room ) break;
				const player = room.players.get( clientInfo.playerId );
				if ( player ) {

					player.spectating = msg.active;
					roomBroadcast( room, {
						type: 'playerSpectate',
						id: clientInfo.playerId,
						active: msg.active,
					} );

				}

				break;

			}

			case 'lapComplete': {

				if ( ! clientInfo ) break;
				const room = rooms.get( clientInfo.roomCode );
				if ( ! room ) break;

				roomBroadcast( room, {
					type: 'playerLap',
					id: clientInfo.playerId,
					lap: msg.lap,
					time: msg.time,
				} );

				break;

			}

		}

	} );

	ws.on( 'close', () => {

		clearTimeout( autoJoinTimeout );

		const clientInfo = connectedClients.get( ws );
		if ( ! clientInfo ) return;

		connectedClients.delete( ws );

		const room = rooms.get( clientInfo.roomCode );
		if ( ! room ) return;

		const player = room.players.get( clientInfo.playerId );

		// Start reconnect grace period
		if ( player ) {

			player.ws = null; // Mark as disconnected but keep in room

			const timeout = setTimeout( () => {

				disconnectedSessions.delete( clientInfo.sessionToken );

				const room = rooms.get( clientInfo.roomCode );
				if ( room ) {

					removePlayerFromRoom( room, clientInfo.playerId );

				}

				console.log( `Reconnect grace expired for ${ clientInfo.playerId }` );

			}, RECONNECT_GRACE_MS );

			disconnectedSessions.set( clientInfo.sessionToken, {
				playerId: clientInfo.playerId,
				roomCode: clientInfo.roomCode,
				timestamp: Date.now(),
				timeout,
			} );

			console.log( `Player ${ clientInfo.playerId } disconnected from room ${ clientInfo.roomCode } — ${ RECONNECT_GRACE_MS / 1000 }s grace period` );

		}

	} );

} );

// ── Start ────────────────────────────────────────────────────────────────────

httpServer.listen( PORT, () => {

	console.log( `Kart Kids server running at http://localhost:${ PORT }` );

} );

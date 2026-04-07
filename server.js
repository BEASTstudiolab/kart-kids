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

		// Cache headers
		if ( LONG_CACHE.has( ext ) ) {

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

// ── Player tracking ──────────────────────────────────────────────────────────

const players = new Map();
let joinCounter = 0;

// ── Race state ──────────────────────────────────────────────────────────────

let raceState = 'idle'; // idle | countdown | racing
let countdownTimer = null;
let countdownCount = 0;

let pendingCountdownTimeout = null;

function startRaceCountdown() {

	pendingCountdownTimeout = null;

	if ( raceState !== 'idle' ) return;
	if ( players.size < 2 ) return;

	raceState = 'countdown';
	countdownCount = 3;

	broadcast( { type: 'raceCountdown', count: countdownCount } );

	countdownTimer = setInterval( () => {

		countdownCount --;

		if ( countdownCount > 0 ) {

			broadcast( { type: 'raceCountdown', count: countdownCount } );

		} else {

			clearInterval( countdownTimer );
			countdownTimer = null;
			raceState = 'racing';
			broadcast( { type: 'raceStart' } );

		}

	}, 1000 );

}

function resetRace() {

	if ( countdownTimer ) {

		clearInterval( countdownTimer );
		countdownTimer = null;

	}

	if ( pendingCountdownTimeout ) {

		clearTimeout( pendingCountdownTimeout );
		pendingCountdownTimeout = null;

	}

	raceState = 'idle';
	countdownCount = 0;

}

const VEHICLE_NAMES = [
	'vehicle-truck-yellow',
	'vehicle-truck-green',
	'vehicle-truck-purple',
	'vehicle-truck-red',
];

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

function broadcast( msg, excludeId ) {

	const data = JSON.stringify( msg );
	for ( const [ id, player ] of players ) {

		if ( id !== excludeId && player.ws.readyState === 1 ) {

			player.ws.send( data );

		}

	}

}

// ── WebSocket server ─────────────────────────────────────────────────────────

const wss = new WebSocketServer( { server: httpServer } );

wss.on( 'connection', ( ws ) => {

	const id = randomUUID();
	const index = joinCounter ++;
	const vehicleIndex = index % 4;
	const characterIndex = 0;
	const tint = computeTint( index );

	const player = {
		ws,
		vehicleIndex,
		characterIndex,
		tint,
		lastState: null,
		spectating: false,
	};

	// Send existing players to the new client
	const existingPlayers = [];
	for ( const [ pid, p ] of players ) {

		existingPlayers.push( {
			id: pid,
			vehicleIndex: p.vehicleIndex,
			characterIndex: p.characterIndex,
			tint: p.tint,
			spectating: p.spectating,
		} );

	}

	players.set( id, player );

	ws.send( JSON.stringify( {
		type: 'welcome',
		id,
		vehicleIndex,
		characterIndex,
		tint,
		existingPlayers,
	} ) );

	// Notify others
	broadcast( {
		type: 'playerJoin',
		id,
		vehicleIndex,
		characterIndex,
		tint,
	}, id );

	ws.on( 'message', ( raw ) => {

		let msg;
		try {

			msg = JSON.parse( raw.toString() );

		} catch {

			return;

		}

		if ( msg.type === 'state' ) {

			player.lastState = msg;

		} else if ( msg.type === 'spectate' ) {

			player.spectating = msg.active;
			broadcast( {
				type: 'playerSpectate',
				id,
				active: msg.active,
			} );

		} else if ( msg.type === 'lapComplete' ) {

			broadcast( {
				type: 'playerLap',
				id,
				lap: msg.lap,
				time: msg.time,
			} );

		}

	} );

	ws.on( 'close', () => {

		players.delete( id );
		broadcast( { type: 'playerLeave', id } );

		// Reset race if not enough players
		if ( players.size < 2 && raceState !== 'idle' ) {

			resetRace();

		}

	} );

	console.log( `Player joined: ${ id } (vehicle ${ vehicleIndex }, tint ${ tint || 'none' })` );

	// Start race countdown when 2+ players are connected and race is idle
	if ( players.size >= 2 && raceState === 'idle' && ! pendingCountdownTimeout ) {

		pendingCountdownTimeout = setTimeout( () => startRaceCountdown(), 500 );

	}

} );

// ── World state broadcast at TICK_RATE Hz ────────────────────────────────────

setInterval( () => {

	if ( players.size < 2 ) return;

	for ( const [ id, player ] of players ) {

		const others = [];
		for ( const [ pid, p ] of players ) {

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

		if ( others.length > 0 && player.ws.readyState === 1 ) {

			player.ws.send( JSON.stringify( { type: 'world', players: others } ) );

		}

	}

}, 1000 / TICK_RATE );

// ── Start ────────────────────────────────────────────────────────────────────

httpServer.listen( PORT, () => {

	console.log( `Kart Kids server running at http://localhost:${ PORT }` );

} );

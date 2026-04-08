// ── Transport abstraction ─────────────────────────────────────────────────────

class WebSocketTransport {

	constructor() {

		this._ws = null;
		this._onMessage = null;
		this._onClose = null;

	}

	connect( url ) {

		return new Promise( ( resolve, reject ) => {

			const ws = new WebSocket( url );

			const timeout = setTimeout( () => {

				ws.close();
				reject( new Error( 'Connection timeout' ) );

			}, 3000 );

			ws.addEventListener( 'open', () => {

				clearTimeout( timeout );
				this._ws = ws;
				resolve();

			} );

			ws.addEventListener( 'error', () => {

				clearTimeout( timeout );
				reject( new Error( 'WebSocket connection failed' ) );

			} );

			ws.addEventListener( 'message', ( e ) => {

				if ( ! this._onMessage ) return;

				let msg;
				try {

					msg = JSON.parse( e.data );

				} catch ( err ) {

					console.warn( '[net] Failed to parse server message:', err.message );
					return;

				}

				this._onMessage( msg );

			} );

			ws.addEventListener( 'close', () => {

				if ( this._onClose ) this._onClose();

			} );

		} );

	}

	send( obj ) {

		if ( this._ws && this._ws.readyState === WebSocket.OPEN ) {

			this._ws.send( JSON.stringify( obj ) );

		}

	}

	onMessage( cb ) { this._onMessage = cb; }
	onClose( cb ) { this._onClose = cb; }

	close() {

		if ( this._ws ) this._ws.close();

	}

}

// ── Network client ───────────────────────────────────────────────────────────

// ── Delta compression ────────────────────────────────────────────────────────

const FULL_SYNC_INTERVAL = 10; // full state every N sends (~500ms at 20Hz)
const POS_THRESHOLD = 0.01;
const ROT_THRESHOLD = 0.001;
const VEL_THRESHOLD = 0.05;

function arrChanged( a, b, threshold ) {

	if ( ! a || ! b || a.length !== b.length ) return true;
	for ( let i = 0; i < a.length; i ++ ) {

		if ( Math.abs( a[ i ] - b[ i ] ) > threshold ) return true;

	}

	return false;

}

function cloneArr( src ) {

	return src ? Array.from( src ) : null;

}

function buildDelta( current, previous ) {

	const delta = {};
	let changed = false;

	if ( arrChanged( current.pos, previous.pos, POS_THRESHOLD ) ) {

		delta.pos = current.pos;
		changed = true;

	}

	if ( arrChanged( current.rot, previous.rot, ROT_THRESHOLD ) ) {

		delta.rot = current.rot;
		changed = true;

	}

	if ( arrChanged( current.vel, previous.vel, VEL_THRESHOLD ) ) {

		delta.vel = current.vel;
		changed = true;

	}

	if ( arrChanged( current.angVel, previous.angVel, VEL_THRESHOLD ) ) {

		delta.angVel = current.angVel;
		changed = true;

	}

	if ( current.speed !== previous.speed ) { delta.speed = current.speed; changed = true; }
	if ( current.drift !== previous.drift ) { delta.drift = current.drift; changed = true; }
	if ( current.boost !== previous.boost ) { delta.boost = current.boost; changed = true; }
	if ( current.shield !== previous.shield ) { delta.shield = current.shield; changed = true; }
	if ( current.star !== previous.star ) { delta.star = current.star; changed = true; }

	return changed ? delta : null;

}

// ── Network client ───────────────────────────────────────────────────────────

export class NetworkClient {

	constructor( transport ) {

		this._transport = transport || new WebSocketTransport();
		this._connected = false;
		this._sendInterval = null;
		this._pendingState = null;
		this._lastSentState = null;
		this._sendCounter = 0;

		// Event callbacks — set by consumer
		this.onWelcome = null;
		this.onPlayerJoin = null;
		this.onPlayerLeave = null;
		this.onWorldUpdate = null;
		this.onPlayerSpectate = null;
		this.onDisconnect = null;

		// Race sync callbacks
		this.onRaceCountdown = null;
		this.onRaceStart = null;
		this.onPlayerLap = null;

	}

	get connected() { return this._connected; }

	async connect( url ) {

		this._stopSendLoop();

		if ( ! url ) {

			const params = new URLSearchParams( location.search );
			const override = params.get( 'server' );
			const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
			url = override || `${ protocol }//${ location.host }`;

		}

		await this._transport.connect( url );
		this._connected = true;

		this._transport.onMessage( ( msg ) => {

			switch ( msg.type ) {

				case 'welcome': if ( this.onWelcome ) this.onWelcome( msg ); break;
				case 'playerJoin': if ( this.onPlayerJoin ) this.onPlayerJoin( msg ); break;
				case 'playerLeave': if ( this.onPlayerLeave ) this.onPlayerLeave( msg ); break;
				case 'world': if ( this.onWorldUpdate ) this.onWorldUpdate( msg ); break;
				case 'playerSpectate': if ( this.onPlayerSpectate ) this.onPlayerSpectate( msg ); break;
				case 'raceCountdown': if ( this.onRaceCountdown ) this.onRaceCountdown( msg ); break;
				case 'raceStart': if ( this.onRaceStart ) this.onRaceStart( msg ); break;
				case 'playerLap': if ( this.onPlayerLap ) this.onPlayerLap( msg ); break;

			}

		} );

		this._transport.onClose( () => {

			this._connected = false;
			this._stopSendLoop();
			if ( this.onDisconnect ) this.onDisconnect();

		} );

		// 20Hz send loop with delta compression
		this._sendInterval = setInterval( () => {

			if ( ! this._pendingState ) return;

			this._sendCounter ++;
			const forceFullSync = this._sendCounter >= FULL_SYNC_INTERVAL || ! this._lastSentState;

			if ( forceFullSync ) {

				this._transport.send( { type: 'state', full: true, ...this._pendingState } );
				this._lastSentState = {
					pos: cloneArr( this._pendingState.pos ),
					rot: cloneArr( this._pendingState.rot ),
					vel: cloneArr( this._pendingState.vel ),
					angVel: cloneArr( this._pendingState.angVel ),
					speed: this._pendingState.speed,
					drift: this._pendingState.drift,
					boost: this._pendingState.boost,
					shield: this._pendingState.shield,
					star: this._pendingState.star,
				};
				this._sendCounter = 0;

			} else {

				const delta = buildDelta( this._pendingState, this._lastSentState );

				if ( delta ) {

					this._transport.send( { type: 'state', ...delta } );

					// Update last-sent with changed fields
					if ( delta.pos ) this._lastSentState.pos = cloneArr( delta.pos );
					if ( delta.rot ) this._lastSentState.rot = cloneArr( delta.rot );
					if ( delta.vel ) this._lastSentState.vel = cloneArr( delta.vel );
					if ( delta.angVel ) this._lastSentState.angVel = cloneArr( delta.angVel );
					if ( 'speed' in delta ) this._lastSentState.speed = delta.speed;
					if ( 'drift' in delta ) this._lastSentState.drift = delta.drift;
					if ( 'boost' in delta ) this._lastSentState.boost = delta.boost;
					if ( 'shield' in delta ) this._lastSentState.shield = delta.shield;
					if ( 'star' in delta ) this._lastSentState.star = delta.star;

				}

			}

			this._pendingState = null;

		}, 1000 / 20 );

	}

	sendState( stateObj ) {

		this._pendingState = stateObj;

	}

	sendSpectate( active ) {

		this._transport.send( { type: 'spectate', active } );

	}

	sendLapComplete( lap, time ) {

		this._transport.send( { type: 'lapComplete', lap, time } );

	}

	disconnect() {

		this._stopSendLoop();
		this._transport.close();
		this._connected = false;

	}

	_stopSendLoop() {

		if ( this._sendInterval ) {

			clearInterval( this._sendInterval );
			this._sendInterval = null;

		}

	}

}

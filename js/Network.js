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

// ── Reconnect constants ──────────────────────────────────────────────────────

const RECONNECT_TTL_MS = 30000;
const RECONNECT_STORAGE_KEY = 'kart-kids-session';
const RECONNECT_MAX_RETRIES = 3;

// ── Network client ───────────────────────────────────────────────────────────

export class NetworkClient {

	constructor( transport ) {

		this._transport = transport || new WebSocketTransport();
		this._connected = false;
		this._sendInterval = null;
		this._pendingState = null;
		this._localPlayerId = null;
		this._lastWelcome = null;
		this._sessionToken = null;
		this._serverUrl = null;

		this._reconnectAttempts = 0;
		this._displayName = '';

		// Pending promise resolvers for room operations
		this._pendingCreateRoom = null;
		this._pendingJoinRoom = null;
		this._pendingFindRoom = null;

		// Event callbacks — set by consumer
		this.onWelcome = null;
		this.onPlayerJoin = null;
		this.onPlayerLeave = null;
		this.onWorldUpdate = null;
		this.onPlayerSpectate = null;
		this.onDisconnect = null;

		// Race sync callbacks
		this.onRaceLoading = null;
		this.onRaceCountdown = null;
		this.onRaceStart = null;
		this.onPlayerLap = null;

		// Room callbacks — set by consumer
		this.onRoomCreated = null;
		this.onRoomJoined = null;
		this.onRoomFull = null;
		this.onRoomError = null;
		this.onHostChange = null;

	}

	get connected() { return this._connected; }

	/** @returns {string|null} Local player ID assigned by the server. */
	get localPlayerId() { return this._localPlayerId; }
	get lastWelcome() { return this._lastWelcome; }

	async connect( url ) {

		this._stopSendLoop();

		if ( ! url ) {

			const params = new URLSearchParams( location.search );
			const override = params.get( 'server' );
			const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
			url = override || `${ protocol }//${ location.host }`;

		}

		this._serverUrl = url;

		await this._transport.connect( url );
		this._connected = true;
		this._reconnectAttempts = 0;

		this._transport.onMessage( ( msg ) => {

			switch ( msg.type ) {

				case 'welcome':
					this._localPlayerId = msg.id ?? msg.playerId ?? null;
					this._lastWelcome = msg;
					this._storeSession( msg.sessionToken ?? null );
					if ( this.onWelcome ) this.onWelcome( msg );
					// Resolve pending room operations — welcome is the server's join confirmation.
					// Skip auto-join default room welcomes — they arrive before explicit
					// createRoom/joinRoom/findRoom and would incorrectly resolve those promises.
					if ( msg.roomCode && msg.roomCode !== '__default__' ) {

						if ( this._pendingCreateRoom ) {

							this._pendingCreateRoom.resolve( msg.roomCode );
							this._pendingCreateRoom = null;

						}
						if ( this._pendingJoinRoom ) {

							this._pendingJoinRoom.resolve( msg );
							this._pendingJoinRoom = null;

						}
						if ( this._pendingFindRoom ) {

							this._pendingFindRoom.resolve( msg );
							this._pendingFindRoom = null;

						}

					}
					break;

				case 'roomCreated':
					if ( this._pendingCreateRoom ) {

						this._pendingCreateRoom.resolve( msg.roomCode );
						this._pendingCreateRoom = null;

					}
					if ( this.onRoomCreated ) this.onRoomCreated( msg );
					break;

				case 'roomJoined':
					if ( this._pendingJoinRoom ) {

						this._pendingJoinRoom.resolve( msg );
						this._pendingJoinRoom = null;

					}
					if ( this._pendingFindRoom ) {

						this._pendingFindRoom.resolve( msg );
						this._pendingFindRoom = null;

					}
					if ( this.onRoomJoined ) this.onRoomJoined( msg );
					break;

				case 'error': {

					const errorMsg = msg.message ?? 'Server error';

					if ( msg.code === 'roomFull' ) {

						if ( this._pendingJoinRoom ) {

							this._pendingJoinRoom.reject( new Error( 'Room is full' ) );
							this._pendingJoinRoom = null;

						}
						if ( this._pendingFindRoom ) {

							this._pendingFindRoom.reject( new Error( 'Room is full' ) );
							this._pendingFindRoom = null;

						}
						if ( this.onRoomFull ) this.onRoomFull( msg );

					} else {

						if ( this._pendingJoinRoom ) {

							this._pendingJoinRoom.reject( new Error( errorMsg ) );
							this._pendingJoinRoom = null;

						}
						if ( this._pendingFindRoom ) {

							this._pendingFindRoom.reject( new Error( errorMsg ) );
							this._pendingFindRoom = null;

						}
						if ( this._pendingCreateRoom ) {

							this._pendingCreateRoom.reject( new Error( errorMsg ) );
							this._pendingCreateRoom = null;

						}
						if ( this.onRoomError ) this.onRoomError( msg );

					}

					break;

				}

				case 'hostChange':
					if ( this.onHostChange ) this.onHostChange( msg );
					break;

				case 'playerJoin': if ( this.onPlayerJoin ) this.onPlayerJoin( msg ); break;
				case 'playerLeave': if ( this.onPlayerLeave ) this.onPlayerLeave( msg ); break;
				case 'world': if ( this.onWorldUpdate ) this.onWorldUpdate( msg ); break;
				case 'playerSpectate': if ( this.onPlayerSpectate ) this.onPlayerSpectate( msg ); break;
				case 'raceLoading': if ( this.onRaceLoading ) this.onRaceLoading( msg ); break;
				case 'raceCountdown': if ( this.onRaceCountdown ) this.onRaceCountdown( msg ); break;
				case 'raceStart': if ( this.onRaceStart ) this.onRaceStart( msg ); break;
				case 'playerLap': if ( this.onPlayerLap ) this.onPlayerLap( msg ); break;

			}

		} );

		this._transport.onClose( () => {

			this._connected = false;
			this._stopSendLoop();

			// Attempt reconnect if session is still valid
			if ( this._shouldReconnect() ) {

				this._attemptReconnect();
				return;

			}

			if ( this.onDisconnect ) this.onDisconnect();

		} );

		// 20Hz send loop
		this._sendInterval = setInterval( () => {

			if ( this._pendingState ) {

				this._transport.send( { type: 'state', ...this._pendingState } );
				this._pendingState = null;

			}

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

	/**
	 * Set the local player's display name (included in room join messages).
	 * @param {string} name
	 */
	setDisplayName( name ) {

		this._displayName = name || '';

	}

	// ---------------------------------------------------------------------------
	// Room operations
	// ---------------------------------------------------------------------------

	/**
	 * Create a new room. Resolves with the room code string.
	 * @returns {Promise<string>}
	 */
	createRoom( vehicleId, appearance = null ) {

		return new Promise( ( resolve, reject ) => {

			this._pendingCreateRoom = { resolve, reject };
			this._transport.send( { type: 'createRoom', name: this._displayName, vehicleId, appearance } );

			// Timeout after 5s
			setTimeout( () => {

				if ( this._pendingCreateRoom ) {

					this._pendingCreateRoom.reject( new Error( 'Create room timeout' ) );
					this._pendingCreateRoom = null;

				}

			}, 5000 );

		} );

	}

	/**
	 * Join an existing room by code.
	 * @param {string} code
	 * @param {string} vehicleId
	 * @returns {Promise<object>}  Resolves with roomJoined message.
	 */
	joinRoom( code, vehicleId, appearance = null ) {

		return new Promise( ( resolve, reject ) => {

			this._pendingJoinRoom = { resolve, reject };
			this._transport.send( { type: 'joinRoom', roomCode: code, vehicleId, name: this._displayName, appearance } );

			setTimeout( () => {

				if ( this._pendingJoinRoom ) {

					this._pendingJoinRoom.reject( new Error( 'Join room timeout' ) );
					this._pendingJoinRoom = null;

				}

			}, 5000 );

		} );

	}

	/**
	 * Auto-matchmaking: find an available room or create one.
	 * @param {string} vehicleId
	 * @returns {Promise<object>}  Resolves with roomJoined message.
	 */
	findRoom( vehicleId, appearance = null ) {

		return new Promise( ( resolve, reject ) => {

			this._pendingFindRoom = { resolve, reject };
			this._transport.send( { type: 'findRoom', vehicleId, name: this._displayName, appearance } );

			setTimeout( () => {

				if ( this._pendingFindRoom ) {

					this._pendingFindRoom.reject( new Error( 'Find room timeout' ) );
					this._pendingFindRoom = null;

				}

			}, 10000 );

		} );

	}

	/**
	 * Host-only: start the race with the given track data.
	 * @param {object|null} trackData  Track cell data (cells array + metadata). Sent as trackData field so guests can load the same track.
	 */
	startRace( trackData ) {

		this._transport.send( { type: 'startRace', trackData } );

	}

	/**
	 * Tell the server this client has finished loading the race.
	 */
	sendRaceLoaded() {

		this._transport.send( { type: 'raceLoaded' } );

	}

	/**
	 * Leave the current room.
	 */
	leaveRoom() {

		this._transport.send( { type: 'leaveRoom' } );

	}

	// ---------------------------------------------------------------------------
	// Reconnect
	// ---------------------------------------------------------------------------

	/**
	 * Store session token with timestamp for reconnect.
	 * @param {string|null} token
	 */
	_storeSession( token ) {

		this._sessionToken = token;

		if ( token ) {

			try {

				localStorage.setItem( RECONNECT_STORAGE_KEY, JSON.stringify( {
					token,
					timestamp: Date.now(),
				} ) );

			} catch ( e ) { /* quota exceeded — ignore */ }

		}

	}

	/**
	 * Check whether a reconnect attempt should be made.
	 * @returns {boolean}
	 */
	_shouldReconnect() {

		try {

			const raw = localStorage.getItem( RECONNECT_STORAGE_KEY );
			if ( ! raw ) return false;

			const data = JSON.parse( raw );
			return ( Date.now() - data.timestamp ) < RECONNECT_TTL_MS;

		} catch ( e ) {

			return false;

		}

	}

	/**
	 * Attempt to reconnect to the server with the stored session token.
	 */
	async _attemptReconnect() {

		this._reconnectAttempts ++;

		if ( this._reconnectAttempts > RECONNECT_MAX_RETRIES ) {

			localStorage.removeItem( RECONNECT_STORAGE_KEY );
			this._reconnectAttempts = 0;
			if ( this.onDisconnect ) this.onDisconnect();
			return;

		}

		let data;

		try {

			const raw = localStorage.getItem( RECONNECT_STORAGE_KEY );
			data = raw ? JSON.parse( raw ) : null;

		} catch ( e ) {

			localStorage.removeItem( RECONNECT_STORAGE_KEY );
			if ( this.onDisconnect ) this.onDisconnect();
			return;

		}

		if ( ! data || ! data.token || ! this._serverUrl ) {

			localStorage.removeItem( RECONNECT_STORAGE_KEY );
			if ( this.onDisconnect ) this.onDisconnect();
			return;

		}

		// Exponential backoff: 1s, 2s, 4s
		const delay = Math.pow( 2, this._reconnectAttempts - 1 ) * 1000;

		await new Promise( ( resolve ) => setTimeout( resolve, delay ) );

		try {

			this._transport = new WebSocketTransport();
			await this.connect( this._serverUrl );
			// Send reconnect token so server can restore session
			this._transport.send( { type: 'reconnect', sessionToken: data.token } );

		} catch ( e ) {

			// connect() failed — onClose will fire and call _attemptReconnect again
			// (guarded by the retry counter above)

		}

	}

	// ---------------------------------------------------------------------------
	// Teardown
	// ---------------------------------------------------------------------------

	disconnect() {

		this._stopSendLoop();
		this._transport.close();
		this._connected = false;
		localStorage.removeItem( RECONNECT_STORAGE_KEY );

	}

	_stopSendLoop() {

		if ( this._sendInterval ) {

			clearInterval( this._sendInterval );
			this._sendInterval = null;

		}

	}

}

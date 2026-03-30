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

				if ( this._onMessage ) {

					try {

						this._onMessage( JSON.parse( e.data ) );

					} catch { /* ignore parse errors */ }

				}

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

export class NetworkClient {

	constructor( transport ) {

		this._transport = transport || new WebSocketTransport();
		this._connected = false;
		this._sendInterval = null;
		this._pendingState = null;

		// Event callbacks — set by consumer
		this.onWelcome = null;
		this.onPlayerJoin = null;
		this.onPlayerLeave = null;
		this.onWorldUpdate = null;
		this.onPlayerSpectate = null;
		this.onDisconnect = null;

	}

	get connected() { return this._connected; }

	async connect( url ) {

		if ( ! url ) {

			const params = new URLSearchParams( location.search );
			const override = params.get( 'server' );
			url = override || `ws://${ location.host }`;

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

			}

		} );

		this._transport.onClose( () => {

			this._connected = false;
			this._stopSendLoop();
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

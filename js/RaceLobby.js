/**
 * RaceLobby — zone-based race start system.
 *
 * Detects when players sit within the finish tile for a dwell period,
 * shows a ready-up prompt, and triggers race start when all are ready.
 */

const STATE_OUTSIDE = 0;
const STATE_DWELLING = 1;
const STATE_ELIGIBLE = 2;
const STATE_READY = 3;

export class RaceLobby {

	constructor( { zoneCenter, zoneHalfExtent, dwellTime = 5, onAllReady } ) {

		this._zoneCenterX = zoneCenter[ 0 ];
		this._zoneCenterZ = zoneCenter[ 1 ];
		this._zoneHalfExtent = zoneHalfExtent;
		this._dwellTime = dwellTime;
		this._onAllReady = onAllReady || null;

		// Per-player lobby state: id → { state, dwellTimer }
		this._playerStates = new Map();

		// Cached display values for the local player
		this._localId = null;

	}

	/**
	 * Called every frame while race is idle.
	 * @param {number} dt — delta time in seconds
	 * @param {Map} players — PlayerManager.players map (id → { vehicle, spectating })
	 * @param {string} localId — the local player's id
	 */
	update( dt, players, localId ) {

		this._localId = localId;

		for ( const [ id, entry ] of players ) {

			// Skip spectating players
			if ( entry.spectating ) {

				this._playerStates.delete( id );
				continue;

			}

			const inZone = this._isInZone( entry.vehicle );
			let ps = this._playerStates.get( id );

			if ( ! ps ) {

				ps = { state: STATE_OUTSIDE, dwellTimer: 0 };
				this._playerStates.set( id, ps );

			}

			if ( inZone ) {

				if ( ps.state === STATE_OUTSIDE ) {

					// Just entered zone — start dwell timer
					ps.state = STATE_DWELLING;
					ps.dwellTimer = 0;

				}

				if ( ps.state === STATE_DWELLING ) {

					ps.dwellTimer += dt;

					if ( ps.dwellTimer >= this._dwellTime ) {

						ps.state = STATE_ELIGIBLE;

					}

				}

				// READY and ELIGIBLE states persist while in zone

			} else {

				// Left the zone — reset everything for this player
				ps.state = STATE_OUTSIDE;
				ps.dwellTimer = 0;

			}

		}

		// Clean up players that left the game
		for ( const id of this._playerStates.keys() ) {

			if ( ! players.has( id ) ) {

				this._playerStates.delete( id );

			}

		}

		// Check if all eligible/ready players are ready
		this._checkAllReady();

	}

	/**
	 * Mark a player as ready.
	 */
	setReady( playerId ) {

		const ps = this._playerStates.get( playerId );
		if ( ! ps ) return;

		// Only eligible (dwell complete) players can ready up
		if ( ps.state === STATE_ELIGIBLE ) {

			ps.state = STATE_READY;
			this._checkAllReady();

		}

	}

	/**
	 * Returns display state for HUD rendering.
	 */
	getDisplayState() {

		let readyCount = 0;
		let zoneCount = 0;
		let localState = STATE_OUTSIDE;

		for ( const [ id, ps ] of this._playerStates ) {

			if ( ps.state === STATE_ELIGIBLE || ps.state === STATE_READY ) {

				zoneCount ++;
				if ( ps.state === STATE_READY ) readyCount ++;

			}

			if ( id === this._localId ) {

				localState = ps.state;

			}

		}

		return {
			inZone: localState !== STATE_OUTSIDE,
			dwelling: localState === STATE_DWELLING,
			dwellComplete: localState === STATE_ELIGIBLE || localState === STATE_READY,
			isReady: localState === STATE_READY,
			readyCount,
			zoneCount,
			lobbyActive: zoneCount > 0,
		};

	}

	/**
	 * Clear all lobby state (called when race starts or resets).
	 */
	reset() {

		this._playerStates.clear();

	}

	// ── Internal ─────────────────────────────────────────────────────────────

	_isInZone( vehicle ) {

		const pos = vehicle.spherePos;
		const dx = Math.abs( pos.x - this._zoneCenterX );
		const dz = Math.abs( pos.z - this._zoneCenterZ );
		return dx < this._zoneHalfExtent && dz < this._zoneHalfExtent;

	}

	_checkAllReady() {

		let zoneCount = 0;
		let readyCount = 0;

		for ( const ps of this._playerStates.values() ) {

			if ( ps.state === STATE_ELIGIBLE || ps.state === STATE_READY ) {

				zoneCount ++;
				if ( ps.state === STATE_READY ) readyCount ++;

			}

		}

		if ( zoneCount >= 1 && readyCount === zoneCount ) {

			if ( this._onAllReady ) this._onAllReady();

		}

	}

}

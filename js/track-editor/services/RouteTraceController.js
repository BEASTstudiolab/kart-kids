// ─── RouteTraceController ────────────────────────────────────────────────────
// Owns the temporary route-trace session state for the editor.
// Manages the debug overlay snapshot, chase playback availability, and
// play/pause controls.

export class RouteTraceController {

	constructor( { state, debugOverlay, validation, routeAnalysis, camera, controls, eventBus } ) {

		this._state = state;
		this._debugOverlay = debugOverlay;
		this._validation = validation;
		this._routeAnalysis = routeAnalysis;
		this._camera = camera;
		this._controls = controls ?? {};
		this._eventBus = eventBus;

		this._active = false;
		this._playbackAvailable = false;
		this._snapshot = null;
		this._rawSetToggle = null;

		this._onPlayClick = null;
		this._onPauseClick = null;
		this._offDebugToggled = null;

		this._wrapRoutePathToggle();
		this._bindEvents();
		this._bindControls();
		this._syncControls();

	}

	get isActive() {

		return this._active;

	}

	get playbackAvailable() {

		return this._playbackAvailable;

	}

	start( gameplayModeOrOptions = null, maybeOptions = {} ) {

		const { gameplayMode, validationResult, route } = this._normalizeStartArgs( gameplayModeOrOptions, maybeOptions );

		if ( this._active ) return this._buildSessionState( validationResult, route );

		this._snapshot = {
			debugEnabled: this._state.debugEnabled,
			routePath: this._debugOverlay?.getToggle?.( 'routePath' ),
		};

		try {

			this._state.debugEnabled = true;
			this._setRoutePathPinned( true );

			const result = validationResult ?? this._validation?.validate?.( gameplayMode );
			const analyzedRoute = route ?? this._routeAnalysis?.analyzeRoute?.( gameplayMode );
			const sequence = analyzedRoute?.sequence ?? [];
			const tileCount = result?.stats?.tileCount ?? 0;
			const playbackAvailable = Boolean( ( result?.valid || tileCount >= 4 ) && sequence.length >= 4 );

			this._active = true;
			this._playbackAvailable = playbackAvailable;

			if ( playbackAvailable ) {

				this._camera?.chaseRoute?.( sequence, 400 );

			}

			this._syncControls();
			return this._buildSessionState( result, analyzedRoute );

		} catch ( error ) {

			this._camera?.stopChase?.();
			this._active = false;
			this._playbackAvailable = false;

			if ( this._snapshot ) {

				this._state.debugEnabled = this._snapshot.debugEnabled;
				this._setRoutePathPinned( this._snapshot.routePath, { allowFalse: true } );

			}

			this._snapshot = null;
			this._syncControls();
			throw error;

		}

	}

	stop() {

		if ( ! this._active && ! this._snapshot ) {

			this._syncControls();
			return this._buildSessionState();

		}

		this._camera?.stopChase?.();
		this._active = false;
		this._playbackAvailable = false;

		if ( this._snapshot ) {

			this._state.debugEnabled = this._snapshot.debugEnabled;
			this._setRoutePathPinned( this._snapshot.routePath, { allowFalse: true } );

		}

		this._snapshot = null;
		this._syncControls();
		return this._buildSessionState();

	}

	toggle( gameplayModeOrOptions = null, maybeOptions = {} ) {

		return this._active ? this.stop() : this.start( gameplayModeOrOptions, maybeOptions );

	}

	play() {

		if ( ! this._active || ! this._playbackAvailable ) {

			this._syncControls();
			return this._buildSessionState();

		}

		this._camera?.resumeChase?.();
		this._syncControls();
		return this._buildSessionState();

	}

	pause() {

		if ( ! this._active || ! this._playbackAvailable ) {

			this._syncControls();
			return this._buildSessionState();

		}

		this._camera?.pauseChase?.();
		this._syncControls();
		return this._buildSessionState();

	}

	dispose() {

		this.stop();
		this._unbindControls();
		this._unbindEvents();
		this._unwrapRoutePathToggle();

	}

	_normalizeStartArgs( gameplayModeOrOptions, maybeOptions ) {

		if ( gameplayModeOrOptions && typeof gameplayModeOrOptions === 'object' &&
			Object.prototype.hasOwnProperty.call( gameplayModeOrOptions, 'gameplayMode' ) &&
			! maybeOptions?.validationResult && ! maybeOptions?.route ) {

			return {
				gameplayMode: gameplayModeOrOptions.gameplayMode ?? null,
				validationResult: gameplayModeOrOptions.validationResult ?? null,
				route: gameplayModeOrOptions.route ?? null,
			};

		}

		return {
			gameplayMode: gameplayModeOrOptions ?? null,
			validationResult: maybeOptions?.validationResult ?? null,
			route: maybeOptions?.route ?? null,
		};

	}

	_buildSessionState( validationResult = null, route = null ) {

		return {
			active: this._active,
			playbackAvailable: this._playbackAvailable,
			validationResult,
			route,
		};

	}

	_bindControls() {

		const playBtn = this._controls?.play;
		const pauseBtn = this._controls?.pause;

		if ( playBtn?.addEventListener ) {

			this._onPlayClick = () => this.play();
			playBtn.addEventListener( 'click', this._onPlayClick );

		}

		if ( pauseBtn?.addEventListener ) {

			this._onPauseClick = () => this.pause();
			pauseBtn.addEventListener( 'click', this._onPauseClick );

		}

	}

	_bindEvents() {

		if ( ! this._eventBus?.on ) return;

		this._offDebugToggled = this._eventBus.on( 'debug:toggled', () => {

			if ( ! this._active ) return;
			this._state.debugEnabled = true;
			this._setRoutePathPinned( true );
			this._syncControls();

		} );

	}

	_unbindEvents() {

		this._offDebugToggled?.();
		this._offDebugToggled = null;

	}

	_wrapRoutePathToggle() {

		if ( ! this._debugOverlay?.setToggle ) return;

		this._rawSetToggle = this._debugOverlay.setToggle.bind( this._debugOverlay );
		this._debugOverlay.setToggle = ( id, value ) => {

			if ( id === 'routePath' && this._active && value === false ) value = true;
			return this._rawSetToggle( id, value );

		};

	}

	_unwrapRoutePathToggle() {

		if ( this._debugOverlay && this._rawSetToggle ) {

			this._debugOverlay.setToggle = this._rawSetToggle;

		}

		this._rawSetToggle = null;

	}

	_setRoutePathPinned( value, { allowFalse = false } = {} ) {

		const setToggle = this._rawSetToggle ?? this._debugOverlay?.setToggle?.bind( this._debugOverlay );
		if ( ! setToggle ) return;

		const nextValue = this._active && value === false && ! allowFalse ? true : value;
		setToggle( 'routePath', nextValue );

	}

	_unbindControls() {

		const playBtn = this._controls?.play;
		const pauseBtn = this._controls?.pause;

		if ( playBtn?.removeEventListener && this._onPlayClick ) {

			playBtn.removeEventListener( 'click', this._onPlayClick );

		}

		if ( pauseBtn?.removeEventListener && this._onPauseClick ) {

			pauseBtn.removeEventListener( 'click', this._onPauseClick );

		}

		this._onPlayClick = null;
		this._onPauseClick = null;

	}

	_syncControls() {

		const root = this._controls?.root;
		const playBtn = this._controls?.play;
		const pauseBtn = this._controls?.pause;

		if ( root && 'hidden' in root ) root.hidden = ! this._active;

		const chasePaused = Boolean( this._camera?.isChasePaused );
		const inactive = ! this._active;
		const disabled = inactive || ! this._playbackAvailable;

		if ( playBtn ) {

			playBtn.disabled = disabled ? true : ! chasePaused;

		}

		if ( pauseBtn ) {

			pauseBtn.disabled = disabled ? true : chasePaused;

		}

	}

}

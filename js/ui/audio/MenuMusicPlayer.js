import { MENU_MUSIC_PLAYLIST } from './MenuMusicPlaylist.js';

function clamp01( value ) {

	const numeric = Number( value );
	if ( ! Number.isFinite( numeric ) ) return 0;
	return Math.min( 1, Math.max( 0, numeric ) );

}

function isAutoplayBlockedError( err ) {

	if ( ! err ) return false;
	if ( err.name === 'NotAllowedError' ) return true;
	if ( typeof err.message !== 'string' ) return false;
	return err.message.toLowerCase().includes( 'not allowed' );

}

function defaultCreateAudio() {

	if ( typeof Audio === 'function' ) {

		const audio = new Audio();
		audio.preload = 'auto';
		return audio;

	}

	return {
		src: '',
		volume: 1,
		currentTime: 0,
		play: async () => {},
		pause: () => {},
		load: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
	};

}

export class MenuMusicPlayer {

	constructor( { playlist = MENU_MUSIC_PLAYLIST, createAudio = defaultCreateAudio } = {} ) {

		this._playlist = Array.isArray( playlist ) ? playlist.filter( ( track ) => track?.id && track?.src ) : [];
		this._audio = createAudio();
		this._listeners = new Set();
		this._failedTrackIds = new Set();
		this._currentIndex = 0;
		this._active = false;
		this._playRequested = false;
		this._isPlaying = false;
		this._volume = 1;
		this._error = '';
		this._currentSrc = '';

		this._onEndedBound = () => this._handleEnded();
		this._onErrorBound = ( event ) => this._handleAudioError( event );

		this._audio?.addEventListener?.( 'ended', this._onEndedBound );
		this._audio?.addEventListener?.( 'error', this._onErrorBound );
		this._applyTrack( this._currentIndex, { resetPosition: true } );

	}

	subscribe( listener ) {

		if ( typeof listener !== 'function' ) return () => {};
		this._listeners.add( listener );
		listener( this.getState() );
		return () => this._listeners.delete( listener );

	}

	getState() {

		const currentTrack = this._playlist[ this._currentIndex ] || null;
		return {
			active: this._active,
			isPlaying: this._isPlaying,
			canPlay: this._playlist.length > 0,
			currentTrack,
			playlistLength: this._playlist.length,
			volume: this._volume,
			error: this._error,
		};

	}

	setVolume( value ) {

		this._volume = clamp01( value );
		if ( this._audio ) this._audio.volume = this._volume;
		this._emit();

	}

	async activate() {

		this._active = true;
		return this.play();

	}

	async play() {

		if ( this._playlist.length === 0 ) {

			this._setError( 'No menu music is available.' );
			return false;

		}

		this._active = true;
		this._playRequested = true;
		this._clearError();
		this._ensureTrackLoaded();

		try {

			const result = this._audio?.play?.();
			if ( result && typeof result.then === 'function' ) await result;
			this._isPlaying = true;
			this._emit();
			return true;

		} catch ( err ) {

			return this._handlePlaybackFailure( err );

		}

	}

	pause() {

		this._playRequested = false;
		this._isPlaying = false;
		this._audio?.pause?.();
		this._emit();

	}

	deactivate() {

		this._active = false;
		this._playRequested = false;
		this._isPlaying = false;
		this._audio?.pause?.();
		this._emit();

	}

	stop() {

		this.deactivate();

	}

	async toggle() {

		if ( this._isPlaying ) {

			this.pause();
			return false;

		}

		return this.play();

	}

	async next( { autoplay = this._playRequested || this._isPlaying } = {} ) {

		if ( this._playlist.length === 0 ) {

			this._setError( 'No menu music is available.' );
			return false;

		}

		const nextIndex = this._findNextPlayableIndex( 1 );
		if ( nextIndex === - 1 ) {

			this._playRequested = false;
			this._isPlaying = false;
			this._setError( 'Menu music is unavailable right now.' );
			return false;

		}

		this._applyTrack( nextIndex, { resetPosition: true } );
		if ( autoplay ) return this.play();
		this._emit();
		return true;

	}

	destroy() {

		this.deactivate();
		this._audio?.removeEventListener?.( 'ended', this._onEndedBound );
		this._audio?.removeEventListener?.( 'error', this._onErrorBound );
		this._listeners.clear();

	}

	_findNextPlayableIndex( direction = 1 ) {

		if ( this._playlist.length === 0 ) return - 1;

		const len = this._playlist.length;
		for ( let offset = 1; offset <= len; offset ++ ) {

			const nextIndex = ( this._currentIndex + direction * offset + len * 4 ) % len;
			const nextTrack = this._playlist[ nextIndex ];
			if ( ! this._failedTrackIds.has( nextTrack.id ) ) return nextIndex;

		}

		return - 1;

	}

	_applyTrack( index, { resetPosition = false } = {} ) {

		if ( this._playlist.length === 0 ) return;

		this._currentIndex = ( index + this._playlist.length ) % this._playlist.length;
		const track = this._playlist[ this._currentIndex ];
		const encodedSrc = encodeURI( track.src );

		if ( this._currentSrc !== encodedSrc ) {

			this._currentSrc = encodedSrc;
			this._audio.src = encodedSrc;
			this._audio.load?.();

		}

		if ( resetPosition ) {

			try {

				this._audio.currentTime = 0;

			} catch {

				// Ignore unsupported currentTime writes.

			}

		}

		this._audio.volume = this._volume;

	}

	_ensureTrackLoaded() {

		if ( ! this._playlist.length ) return;
		if ( ! this._audio?.src ) this._applyTrack( this._currentIndex, { resetPosition: true } );

	}

	_emit() {

		const state = this.getState();
		for ( const listener of this._listeners ) listener( state );

	}

	_setError( message ) {

		this._error = message || '';
		this._emit();

	}

	_clearError() {

		if ( ! this._error ) return;
		this._error = '';

	}

	_handleEnded() {

		this._isPlaying = false;
		if ( ! this._active && ! this._playRequested ) {

			this._emit();
			return;

		}

		void this.next( { autoplay: true } );

	}

	_handleAudioError( event ) {

		if ( ! this._playRequested ) {

			this._setError( 'Unable to play the selected menu track.' );
			return;

		}

		void this._handlePlaybackFailure( event?.error || new Error( 'Audio playback failed.' ) );

	}

	async _handlePlaybackFailure( err ) {

		if ( isAutoplayBlockedError( err ) ) {

			this._playRequested = false;
			this._isPlaying = false;
			this._setError( 'Press Play to start music.' );
			return false;

		}

		const failedTrack = this._playlist[ this._currentIndex ];
		if ( failedTrack?.id ) this._failedTrackIds.add( failedTrack.id );

		this._isPlaying = false;
		const nextIndex = this._findNextPlayableIndex( 1 );
		if ( nextIndex === - 1 ) {

			this._playRequested = false;
			this._setError( err?.message || 'Menu music is unavailable right now.' );
			return false;

		}

		this._error = `Skipping unavailable track: ${ failedTrack?.title || 'Unknown track' }`;
		this._applyTrack( nextIndex, { resetPosition: true } );
		return this.play();

	}

}

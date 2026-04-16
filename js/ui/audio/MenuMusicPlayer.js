import { MENU_MUSIC_PLAYLIST } from './MenuMusicPlaylist.js';

const VISUALIZER_SAMPLE_COUNT = 12;
const VISUALIZER_IDLE_LEVEL = 0.08;

function clamp01( value ) {

	const numeric = Number( value );
	if ( ! Number.isFinite( numeric ) ) return 0;
	return Math.min( 1, Math.max( 0, numeric ) );

}

function createIdleVisualizerSamples( count = VISUALIZER_SAMPLE_COUNT ) {

	return Array.from( { length: count }, () => VISUALIZER_IDLE_LEVEL );

}

function normalizeVisualizerSamples( byteData, sampleCount = VISUALIZER_SAMPLE_COUNT ) {

	if ( ! byteData?.length ) return createIdleVisualizerSamples( sampleCount );

	const samples = [];
	const bucketSize = byteData.length / sampleCount;
	for ( let index = 0; index < sampleCount; index ++ ) {

		const start = Math.floor( index * bucketSize );
		const end = Math.max( start + 1, Math.floor( ( index + 1 ) * bucketSize ) );
		let total = 0;
		let count = 0;

		for ( let cursor = start; cursor < end && cursor < byteData.length; cursor ++ ) {

			total += byteData[ cursor ];
			count ++;

		}

		const average = count > 0 ? ( total / count / 255 ) : 0;
		samples.push( Number( clamp01( Math.pow( average, 0.82 ) ).toFixed( 3 ) ) );

	}

	return samples;

}

function visualizerSamplesDiffer( nextSamples, prevSamples, threshold = 0.03 ) {

	if ( nextSamples.length !== prevSamples.length ) return true;

	for ( let index = 0; index < nextSamples.length; index ++ ) {

		if ( Math.abs( nextSamples[ index ] - prevSamples[ index ] ) >= threshold ) return true;

	}

	return false;

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

function defaultCreateAudioContext() {

	const AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
	if ( typeof AudioContextCtor !== 'function' ) return null;
	return new AudioContextCtor();

}

function defaultRequestFrame( callback ) {

	if ( typeof globalThis.requestAnimationFrame === 'function' ) {

		return globalThis.requestAnimationFrame( callback );

	}

	return 0;

}

function defaultCancelFrame( frameId ) {

	if ( typeof globalThis.cancelAnimationFrame === 'function' ) {

		globalThis.cancelAnimationFrame( frameId );

	}

}

export class MenuMusicPlayer {

	constructor( {
		playlist = MENU_MUSIC_PLAYLIST,
		createAudio = defaultCreateAudio,
		createAudioContext = defaultCreateAudioContext,
		requestFrame = defaultRequestFrame,
		cancelFrame = defaultCancelFrame,
	} = {} ) {

		this._playlist = Array.isArray( playlist ) ? playlist.filter( ( track ) => track?.id && track?.src ) : [];
		this._audio = createAudio();
		this._createAudioContext = createAudioContext;
		this._requestFrame = requestFrame;
		this._cancelFrame = cancelFrame;
		this._listeners = new Set();
		this._failedTrackIds = new Set();
		this._currentIndex = 0;
		this._active = false;
		this._playRequested = false;
		this._isPlaying = false;
		this._volume = 1;
		this._error = '';
		this._currentSrc = '';
		this._visualizerSamples = createIdleVisualizerSamples();
		this._visualizerAvailable = false;
		this._visualizerInitAttempted = false;
		this._visualizerFrameId = 0;
		this._visualizerTickBound = () => this._handleVisualizerFrame();
		this._audioContext = null;
		this._audioSourceNode = null;
		this._analyser = null;
		this._visualizerByteData = null;

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
			visualizerSamples: [ ...this._visualizerSamples ],
			visualizerAvailable: this._visualizerAvailable,
			visualizerActive: this._visualizerAvailable && this._isPlaying,
		};

	}

	setVolume( value ) {

		this._volume = clamp01( value );
		if ( this._audio ) this._audio.volume = this._volume;
		this._emit();

	}

	async activate() {

		this._active = true;
		this._emit();
		return true;

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
		await this._prepareVisualizerForPlayback();

		try {

			const result = this._audio?.play?.();
			if ( result && typeof result.then === 'function' ) await result;
			this._isPlaying = true;
			this._refreshVisualizerSamples( { force: true, emit: false } );
			this._scheduleVisualizerFrame();
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
		this._stopVisualizerLoop();
		this._resetVisualizerSamples();
		this._emit();

	}

	deactivate() {

		this._active = false;
		this._playRequested = false;
		this._isPlaying = false;
		this._audio?.pause?.();
		this._stopVisualizerLoop();
		this._resetVisualizerSamples();
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
		const audioContext = this._audioContext;
		this._audioContext = null;
		this._audioSourceNode = null;
		this._analyser = null;
		this._visualizerByteData = null;
		this._visualizerAvailable = false;
		void audioContext?.close?.();
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

	async _prepareVisualizerForPlayback() {

		if ( ! this._ensureVisualizerGraph() ) return false;

		if ( this._audioContext?.state === 'suspended' && typeof this._audioContext.resume === 'function' ) {

			try {

				await this._audioContext.resume();

			} catch {

				return false;

			}

		}

		return true;

	}

	_ensureVisualizerGraph() {

		if ( this._analyser ) return true;
		if ( this._visualizerInitAttempted ) return false;
		this._visualizerInitAttempted = true;

		let audioContext = null;
		try {

			audioContext = this._createAudioContext?.() ?? null;

		} catch {

			audioContext = null;

		}

		if ( ! audioContext ) return false;

		try {

			const sourceNode = audioContext.createMediaElementSource?.( this._audio );
			const analyser = audioContext.createAnalyser?.();
			if ( ! sourceNode || ! analyser ) {

				void audioContext.close?.();
				return false;

			}

			analyser.fftSize = 128;
			if ( 'smoothingTimeConstant' in analyser ) analyser.smoothingTimeConstant = 0.72;

			sourceNode.connect?.( analyser );
			analyser.connect?.( audioContext.destination );

			this._audioContext = audioContext;
			this._audioSourceNode = sourceNode;
			this._analyser = analyser;
			this._visualizerByteData = new Uint8Array( Math.max( 1, analyser.frequencyBinCount || 0 ) );
			this._visualizerAvailable = true;
			return true;

		} catch {

			void audioContext.close?.();
			return false;

		}

	}

	_scheduleVisualizerFrame() {

		if ( ! this._isPlaying || ! this._analyser || this._visualizerFrameId ) return;
		const nextFrameId = this._requestFrame?.( this._visualizerTickBound ) ?? 0;
		this._visualizerFrameId = Number.isFinite( nextFrameId ) ? nextFrameId : 0;

	}

	_stopVisualizerLoop() {

		if ( ! this._visualizerFrameId ) return;
		this._cancelFrame?.( this._visualizerFrameId );
		this._visualizerFrameId = 0;

	}

	_handleVisualizerFrame() {

		this._visualizerFrameId = 0;
		if ( ! this._isPlaying || ! this._analyser ) return;
		this._refreshVisualizerSamples();
		this._scheduleVisualizerFrame();

	}

	_resetVisualizerSamples() {

		this._visualizerSamples = createIdleVisualizerSamples( this._visualizerSamples.length || VISUALIZER_SAMPLE_COUNT );

	}

	_refreshVisualizerSamples( { force = false, emit = true } = {} ) {

		if ( ! this._analyser || ! this._visualizerByteData ) {

			if ( force ) this._resetVisualizerSamples();
			return false;

		}

		try {

			this._analyser.getByteFrequencyData?.( this._visualizerByteData );

		} catch {

			if ( force ) this._resetVisualizerSamples();
			return false;

		}

		const nextSamples = normalizeVisualizerSamples( this._visualizerByteData );
		const didChange = force || visualizerSamplesDiffer( nextSamples, this._visualizerSamples );
		if ( ! didChange ) return false;

		this._visualizerSamples = nextSamples;
		if ( emit ) this._emit();
		return true;

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
		this._stopVisualizerLoop();
		if ( ! this._active && ! this._playRequested ) {

			this._resetVisualizerSamples();
			this._emit();
			return;

		}

		void this.next( { autoplay: true } );

	}

	_handleAudioError( event ) {

		if ( ! this._playRequested ) {

			this._stopVisualizerLoop();
			this._resetVisualizerSamples();
			this._setError( 'Unable to play the selected menu track.' );
			return;

		}

		void this._handlePlaybackFailure( event?.error || new Error( 'Audio playback failed.' ) );

	}

	async _handlePlaybackFailure( err ) {

		this._stopVisualizerLoop();
		this._resetVisualizerSamples();

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

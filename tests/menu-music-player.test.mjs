import test from 'node:test';
import assert from 'node:assert/strict';
import { MenuMusicPlayer } from '../js/ui/audio/MenuMusicPlayer.js';

class FakeAudio {

	constructor( { failSrcs = [] } = {} ) {

		this.src = '';
		this.volume = 1;
		this.currentTime = 0;
		this.preload = '';
		this.playCalls = 0;
		this.pauseCalls = 0;
		this.loadCalls = 0;
		this._listeners = new Map();
		this._failSrcs = new Set( failSrcs );
		this._playError = null;

	}

	addEventListener( type, handler ) {

		if ( ! this._listeners.has( type ) ) this._listeners.set( type, [] );
		this._listeners.get( type ).push( handler );

	}

	removeEventListener( type, handler ) {

		const handlers = this._listeners.get( type );
		if ( ! handlers ) return;
		const index = handlers.indexOf( handler );
		if ( index >= 0 ) handlers.splice( index, 1 );

	}

	load() {

		this.loadCalls ++;

	}

	async play() {

		this.playCalls ++;
		if ( typeof this._playError === 'function' ) {

			const err = this._playError( this );
			if ( err ) throw err;

		}
		if ( this._failSrcs.has( this.src ) ) throw new Error( `failed:${ this.src }` );

	}

	pause() {

		this.pauseCalls ++;

	}

	dispatch( type, detail = {} ) {

		const handlers = this._listeners.get( type ) || [];
		for ( const handler of [ ...handlers ] ) handler( { type, ...detail } );

	}

}

class FakeAudioNode {

	constructor() {

		this.connections = [];

	}

	connect( target ) {

		this.connections.push( target );
		return target;

	}

}

class FakeAnalyser extends FakeAudioNode {

	constructor( frames = [] ) {

		super();
		this.frames = frames.map( ( frame ) => Uint8Array.from( frame ) );
		this.frameIndex = 0;
		this.frequencyBinCount = this.frames[ 0 ]?.length || 24;
		this.fftSize = 0;
		this.smoothingTimeConstant = 0;

	}

	getByteFrequencyData( target ) {

		const frame = this.frames[ Math.min( this.frameIndex, this.frames.length - 1 ) ] || new Uint8Array( target.length );
		target.fill( 0 );
		for ( let index = 0; index < target.length && index < frame.length; index ++ ) {

			target[ index ] = frame[ index ];

		}
		this.frameIndex ++;

	}

}

class FakeAudioContext {

	constructor( { analyserFrames = [] } = {} ) {

		this.state = 'suspended';
		this.resumeCalls = 0;
		this.closeCalls = 0;
		this.destination = new FakeAudioNode();
		this._sourceNode = new FakeAudioNode();
		this._analyser = new FakeAnalyser( analyserFrames );

	}

	createMediaElementSource() {

		return this._sourceNode;

	}

	createAnalyser() {

		return this._analyser;

	}

	async resume() {

		this.resumeCalls ++;
		this.state = 'running';

	}

	async close() {

		this.closeCalls ++;
		this.state = 'closed';

	}

}

function createFrameScheduler() {

	const queue = [];
	const cancelled = [];

	return {
		queue,
		cancelled,
		requestFrame: ( callback ) => {

			queue.push( callback );
			return queue.length;

		},
		cancelFrame: ( frameId ) => {

			cancelled.push( frameId );

		},
		runNextFrame: () => {

			const callback = queue.shift();
			if ( callback ) callback();

		},
	};

}

const PLAYLIST = [
	{ id: 'one', title: 'Track One', src: 'audio/music/Track One.ogg' },
	{ id: 'two', title: 'Track Two', src: 'audio/music/Track Two.ogg' },
];

test( 'MenuMusicPlayer activates without autoplay, toggles playback, and advances tracks cleanly', async () => {

	const fakeAudio = new FakeAudio();
	const player = new MenuMusicPlayer( {
		playlist: PLAYLIST,
		createAudio: () => fakeAudio,
	} );

	const states = [];
	const unsubscribe = player.subscribe( ( state ) => states.push( state ) );

	assert.equal( player.getState().currentTrack.title, 'Track One' );

	const activated = await player.activate();
	assert.equal( activated, true );
	assert.equal( fakeAudio.playCalls, 0 );
	assert.equal( player.getState().active, true );
	assert.equal( player.getState().isPlaying, false );

	await player.toggle();
	assert.equal( fakeAudio.playCalls, 1 );
	assert.equal( player.getState().isPlaying, true );

	await player.toggle();
	assert.equal( fakeAudio.pauseCalls, 1 );
	assert.equal( player.getState().isPlaying, false );

	await player.next();
	assert.equal( player.getState().currentTrack.title, 'Track Two' );
	assert.equal( player.getState().isPlaying, false );

	unsubscribe();
	player.destroy();
	assert.ok( states.length >= 3 );

} );

test( 'MenuMusicPlayer exposes visualizer samples when Web Audio analysis is available', async () => {

	const fakeAudio = new FakeAudio();
	const fakeAudioContext = new FakeAudioContext( {
		analyserFrames: [
			[ 12, 24, 36, 48, 72, 96, 120, 144, 168, 192, 216, 240, 255, 232, 208, 184, 160, 136, 112, 88, 64, 40, 20, 8 ],
			[ 8, 20, 40, 64, 88, 112, 136, 160, 184, 208, 232, 255, 240, 216, 192, 168, 144, 120, 96, 72, 48, 36, 24, 12 ],
		],
	} );
	const frameScheduler = createFrameScheduler();
	const player = new MenuMusicPlayer( {
		playlist: PLAYLIST,
		createAudio: () => fakeAudio,
		createAudioContext: () => fakeAudioContext,
		requestFrame: frameScheduler.requestFrame,
		cancelFrame: frameScheduler.cancelFrame,
	} );

	const played = await player.play();
	assert.equal( played, true );
	assert.equal( fakeAudioContext.resumeCalls, 1 );

	const initialState = player.getState();
	assert.equal( initialState.visualizerAvailable, true );
	assert.equal( initialState.visualizerActive, true );
	assert.equal( initialState.visualizerSamples.length, 12 );
	assert.equal( initialState.visualizerSamples.some( ( level ) => level > 0.3 ), true );
	assert.equal( frameScheduler.queue.length > 0, true );

	const firstFrameSamples = [ ...initialState.visualizerSamples ];
	frameScheduler.runNextFrame();

	const refreshedState = player.getState();
	assert.equal( refreshedState.visualizerSamples.every( ( level, index ) => level === firstFrameSamples[ index ] ), false );

	player.pause();
	const pausedState = player.getState();
	assert.equal( pausedState.visualizerActive, false );
	assert.equal( pausedState.visualizerSamples.every( ( level ) => level === 0.08 ), true );
	assert.equal( frameScheduler.cancelled.length > 0, true );

	player.destroy();

} );

test( 'MenuMusicPlayer falls back to safe idle samples when audio analysis is unavailable', async () => {

	const fakeAudio = new FakeAudio();
	const player = new MenuMusicPlayer( {
		playlist: PLAYLIST,
		createAudio: () => fakeAudio,
		createAudioContext: () => null,
	} );

	const played = await player.play();

	assert.equal( played, true );
	assert.equal( player.getState().visualizerAvailable, false );
	assert.equal( player.getState().visualizerActive, false );
	assert.equal( player.getState().visualizerSamples.every( ( level ) => level === 0.08 ), true );

	player.destroy();

} );

test( 'MenuMusicPlayer applies clamped volume updates to the underlying audio node', () => {

	const fakeAudio = new FakeAudio();
	const player = new MenuMusicPlayer( {
		playlist: PLAYLIST,
		createAudio: () => fakeAudio,
	} );

	player.setVolume( 1.5 );
	assert.equal( fakeAudio.volume, 1 );

	player.setVolume( - 4 );
	assert.equal( fakeAudio.volume, 0 );

	player.setVolume( 0.35 );
	assert.equal( fakeAudio.volume, 0.35 );

	player.destroy();

} );

test( 'MenuMusicPlayer skips failed tracks and recovers to the next playable entry', async () => {

	const failingSrc = encodeURI( PLAYLIST[ 0 ].src );
	const fakeAudio = new FakeAudio( { failSrcs: [ failingSrc ] } );
	const player = new MenuMusicPlayer( {
		playlist: PLAYLIST,
		createAudio: () => fakeAudio,
	} );

	const success = await player.play();

	assert.equal( success, true );
	assert.equal( player.getState().currentTrack.title, 'Track Two' );
	assert.equal( player.getState().isPlaying, true );
	assert.ok( fakeAudio.playCalls >= 2 );

	player.destroy();

} );

test( 'MenuMusicPlayer keeps autoplay blocks recoverable instead of blacklisting the track', async () => {

	let blocked = true;
	const fakeAudio = new FakeAudio();
	fakeAudio._playError = () => {

		if ( ! blocked ) return null;
		return Object.assign( new Error( 'play() failed because the user did not interact with the document first.' ), {
			name: 'NotAllowedError',
		} );

	};

	const player = new MenuMusicPlayer( {
		playlist: PLAYLIST,
		createAudio: () => fakeAudio,
	} );

	const blockedPlay = await player.play();

	assert.equal( blockedPlay, false );
	assert.equal( player.getState().currentTrack.title, 'Track One' );
	assert.equal( player.getState().isPlaying, false );
	assert.equal( player.getState().error, 'Press Play to start music.' );

	blocked = false;
	const played = await player.play();

	assert.equal( played, true );
	assert.equal( fakeAudio.playCalls, 2 );
	assert.equal( player.getState().currentTrack.title, 'Track One' );
	assert.equal( player.getState().isPlaying, true );

	player.destroy();

} );

test( 'MenuMusicPlayer auto-advances on ended while active', async () => {

	const fakeAudio = new FakeAudio();
	const player = new MenuMusicPlayer( {
		playlist: PLAYLIST,
		createAudio: () => fakeAudio,
	} );

	await player.play();
	assert.equal( player.getState().currentTrack.title, 'Track One' );

	fakeAudio.dispatch( 'ended' );
	await Promise.resolve();
	await Promise.resolve();

	assert.equal( player.getState().currentTrack.title, 'Track Two' );
	assert.equal( player.getState().isPlaying, true );

	player.destroy();

} );

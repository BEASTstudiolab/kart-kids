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

const PLAYLIST = [
	{ id: 'one', title: 'Track One', src: 'audio/music/Track One.ogg' },
	{ id: 'two', title: 'Track Two', src: 'audio/music/Track Two.ogg' },
];

test( 'MenuMusicPlayer activates, toggles, and advances without creating duplicate playback state', async () => {

	const fakeAudio = new FakeAudio();
	const player = new MenuMusicPlayer( {
		playlist: PLAYLIST,
		createAudio: () => fakeAudio,
	} );

	const states = [];
	const unsubscribe = player.subscribe( ( state ) => states.push( state ) );

	assert.equal( player.getState().currentTrack.title, 'Track One' );

	await player.activate();
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

	const activated = await player.activate();

	assert.equal( activated, false );
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

	await player.activate();
	assert.equal( player.getState().currentTrack.title, 'Track One' );

	fakeAudio.dispatch( 'ended' );
	await Promise.resolve();

	assert.equal( player.getState().currentTrack.title, 'Track Two' );
	assert.equal( player.getState().isPlaying, true );

	player.destroy();

} );

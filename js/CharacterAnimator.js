import * as THREE from 'three';
import { ANIMATION_CLIPS } from './ModelLoader.js';

const CLIP_MAP = {
	driving: 'Kart_Beast_Driving',
	turnLeft: 'Kart_Beast_Turn_Left',
	turnRight: 'Kart_Beast_Turn_Right',
	transLeftIdle: 'Kart_Beast_Turn_Left_To_Idle',
	transRightIdle: 'Kart_Beast_Turn_Right_To_Idle',
	impact: 'Kart_Beast_Impact_React',
};

const STEER_THRESHOLD = 0.15;
const CROSSFADE = 0.1;

// States
const ST_DRIVING = 'DRIVING';
const ST_TURN_LEFT = 'TURN_LEFT';
const ST_TURN_RIGHT = 'TURN_RIGHT';
const ST_TRANS_LEFT = 'TRANS_LEFT_IDLE';
const ST_TRANS_RIGHT = 'TRANS_RIGHT_IDLE';
const ST_IMPACT = 'IMPACT';

export class CharacterAnimator {

	constructor( characterModel ) {

		this.mixer = new THREE.AnimationMixer( characterModel );
		this.actions = {};
		this._state = ST_DRIVING;
		this._activeAction = null; // currently playing action
		this._initialized = false;

	}

	init() {

		for ( const [ key, clipName ] of Object.entries( CLIP_MAP ) ) {

			const clip = ANIMATION_CLIPS[ clipName ];
			if ( ! clip ) {

				console.warn( '[CharacterAnimator] Missing clip:', clipName );
				continue;

			}

			const action = this.mixer.clipAction( clip );
			this.actions[ key ] = action;

		}

		const { driving, turnLeft, turnRight, transLeftIdle, transRightIdle, impact } = this.actions;

		// Driving: loop forever
		if ( driving ) {

			driving.setLoop( THREE.LoopRepeat );

		}

		// Turn animations: play once, hold final frame
		for ( const action of [ turnLeft, turnRight ] ) {

			if ( ! action ) continue;
			action.setLoop( THREE.LoopOnce );
			action.clampWhenFinished = true;

		}

		// Transition clips: play once, hold final frame (finished event returns to driving)
		for ( const action of [ transLeftIdle, transRightIdle ] ) {

			if ( ! action ) continue;
			action.setLoop( THREE.LoopOnce );
			action.clampWhenFinished = true;

		}

		// Impact: play once
		if ( impact ) {

			impact.setLoop( THREE.LoopOnce );
			impact.clampWhenFinished = true;

		}

		// When transition-to-idle or impact finishes → return to driving
		this.mixer.addEventListener( 'finished', ( e ) => {

			const action = e.action;
			const a = this.actions;

			if ( action === a.transLeftIdle || action === a.transRightIdle || action === a.impact ) {

				console.log( '[Anim] Finished →', action === a.impact ? 'impact' : 'transition', '→ back to DRIVING' );
				this._fadeTo( 'driving', CROSSFADE );
				this._state = ST_DRIVING;

			}

		} );

		// Start with driving
		if ( driving ) {

			driving.play();
			this._activeAction = driving;

		}

		this._state = ST_DRIVING;
		this._initialized = true;

		// Auto-run bone mapping diagnostic
		this.debugLogBoneMapping();

	}

	/**
	 * Clean crossfade: stop all actions except prev, then crossfade prev → next.
	 */
	_fadeTo( key, duration ) {

		const next = this.actions[ key ];
		if ( ! next ) return;

		const prev = this._activeAction;

		// Stop every action that isn't the outgoing or incoming — prevents
		// lingering near-zero-weight actions from causing jitter
		for ( const [ k, action ] of Object.entries( this.actions ) ) {

			if ( action === prev || action === next ) continue;
			if ( action.isRunning() ) action.stop();

		}

		next.reset();
		next.setEffectiveWeight( 1 );
		next.setEffectiveTimeScale( 1 );
		next.play();

		if ( prev && prev !== next ) {

			prev.crossFadeTo( next, duration );

		}

		this._activeAction = next;

	}

	update( dt, steeringInput ) {

		if ( ! this._initialized ) return;

		this.mixer.update( dt );

		// Don't change state during impact
		if ( this._state === ST_IMPACT ) return;

		const steerDir = Math.abs( steeringInput ) > STEER_THRESHOLD
			? Math.sign( steeringInput ) : 0;

		// ── State transitions ───────────────────────────────────────────────
		// Turn inputs can interrupt any non-impact state (including transitions)

		if ( steerDir < 0 && this._state !== ST_TURN_LEFT ) {

			// Start turning left (from any state: driving, turn_right, or either transition)
			console.log( '[Anim]', this._state, '→ TURN_LEFT (inputX:', steeringInput.toFixed( 2 ), ')' );
			this._fadeTo( 'turnLeft', CROSSFADE );
			this._state = ST_TURN_LEFT;

		} else if ( steerDir > 0 && this._state !== ST_TURN_RIGHT ) {

			// Start turning right (from any state: driving, turn_left, or either transition)
			console.log( '[Anim]', this._state, '→ TURN_RIGHT (inputX:', steeringInput.toFixed( 2 ), ')' );
			this._fadeTo( 'turnRight', CROSSFADE );
			this._state = ST_TURN_RIGHT;

		} else if ( steerDir === 0 ) {

			if ( this._state === ST_TURN_LEFT ) {

				// Released left steering → transition back
				console.log( '[Anim] TURN_LEFT → TRANS_LEFT_IDLE (released)' );
				if ( this.actions.transLeftIdle ) {

					this._fadeTo( 'transLeftIdle', CROSSFADE );
					this._state = ST_TRANS_LEFT;

				} else {

					this._fadeTo( 'driving', CROSSFADE );
					this._state = ST_DRIVING;

				}

			} else if ( this._state === ST_TURN_RIGHT ) {

				// Released right steering → transition back
				console.log( '[Anim] TURN_RIGHT → TRANS_RIGHT_IDLE (released)' );
				if ( this.actions.transRightIdle ) {

					this._fadeTo( 'transRightIdle', CROSSFADE );
					this._state = ST_TRANS_RIGHT;

				} else {

					this._fadeTo( 'driving', CROSSFADE );
					this._state = ST_DRIVING;

				}

			}

		}

	}

	triggerImpact() {

		if ( ! this._initialized ) return;
		if ( ! this.actions.impact ) return;
		if ( this._state === ST_IMPACT ) return;

		console.log( '[Anim]', this._state, '→ IMPACT' );
		this._fadeTo( 'impact', 0.1 );
		this._state = ST_IMPACT;

	}

	/** Return debug snapshot */
	getDebugInfo() {

		const info = { _state: this._state };
		for ( const [ key, clipName ] of Object.entries( CLIP_MAP ) ) {

			const clip = ANIMATION_CLIPS[ clipName ];
			const action = this.actions[ key ];
			info[ key ] = {
				clipName,
				loaded: !! clip,
				trackCount: clip ? clip.tracks.length : 0,
				hasAction: !! action,
				playing: action ? action.isRunning() : false,
				weight: action ? action.getEffectiveWeight() : 0,
			};

		}

		return info;

	}

	/** Force-solo a single animation for testing */
	debugPlaySolo( key ) {

		// Stop all
		for ( const action of Object.values( this.actions ) ) {

			action.stop();

		}

		const action = this.actions[ key ];
		if ( ! action ) return;

		action.reset();
		action.setEffectiveWeight( 1 );
		action.setLoop( THREE.LoopOnce );
		action.clampWhenFinished = true;
		action.play();
		this._activeAction = action;

	}

	/** Log bone names from clips vs character skeleton */
	debugLogBoneMapping() {

		const root = this.mixer.getRoot();

		const modelBones = new Set();
		root.traverse( ( child ) => {

			if ( child.isBone ) modelBones.add( child.name );

		} );

		console.log( '[CharacterAnimator] Character bones (' + modelBones.size + '):', [ ...modelBones ] );

		for ( const [ key, clipName ] of Object.entries( CLIP_MAP ) ) {

			const clip = ANIMATION_CLIPS[ clipName ];
			if ( ! clip ) { console.warn( `[CharacterAnimator] Clip "${ key }": NOT LOADED` ); continue; }

			const trackTargets = new Set();
			const unmapped = [];
			for ( const track of clip.tracks ) {

				const boneName = track.name.split( '.' )[ 0 ];
				trackTargets.add( boneName );
				if ( ! modelBones.has( boneName ) ) unmapped.push( boneName );

			}

			const status = unmapped.length > 0
				? `⚠ ${ unmapped.length } UNMAPPED: ${ [ ...new Set( unmapped ) ].join( ', ' ) }`
				: '✓ all bones matched';
			console.log( `[CharacterAnimator] Clip "${ key }" (${ clip.tracks.length } tracks): ${ status }` );

		}

	}

	dispose() {

		this.mixer.stopAllAction();
		this.mixer.uncacheRoot( this.mixer.getRoot() );

	}

}

const BLINK_TARGET_NAME = 'Blink';
const FREQUENCY_MIN_SECONDS = 0;
const FREQUENCY_MAX_SECONDS = 12;
const SPEED_MIN_SECONDS = 0.05;
const SPEED_MAX_SECONDS = 0.40;
const MIN_DELAY_SECONDS = 0.01;

export const MENU_CHARACTER_BLINK_DEFAULTS = Object.freeze( {
	frequencySeconds: 6.0,
	speedSeconds: 0.30,
} );

const _sharedBlinkTuning = {
	...MENU_CHARACTER_BLINK_DEFAULTS,
};

function clampNumber( value, min, max, fallback ) {

	const numericValue = Number( value );
	if ( ! Number.isFinite( numericValue ) ) return fallback;

	return Math.min( max, Math.max( min, numericValue ) );

}

function traverseNodes( root, visitor ) {

	if ( ! root || typeof visitor !== 'function' ) return;

	if ( typeof root.traverse === 'function' ) {

		root.traverse( visitor );
		return;

	}

	const stack = [ root ];
	while ( stack.length > 0 ) {

		const node = stack.pop();
		if ( ! node ) continue;

		visitor( node );

		if ( Array.isArray( node.children ) ) {

			for ( let i = node.children.length - 1; i >= 0; i -- ) {

				stack.push( node.children[ i ] );

			}

		}

	}

}

function getRandomUnitValue( randomFn ) {

	const rawValue = Number( typeof randomFn === 'function' ? randomFn() : Math.random() );
	if ( ! Number.isFinite( rawValue ) ) return 0.5;

	return Math.min( 1, Math.max( 0, rawValue ) );

}

function computeBlinkDelaySeconds( frequencySeconds, randomFn ) {

	const jitter = 0.75 + ( getRandomUnitValue( randomFn ) * 0.5 );
	return Math.max( MIN_DELAY_SECONDS, frequencySeconds * jitter );

}

export function getMenuCharacterBlinkTuning() {

	return {
		..._sharedBlinkTuning,
	};

}

export function setMenuCharacterBlinkTuning( partialTuning = {} ) {

	if ( Object.prototype.hasOwnProperty.call( partialTuning, 'frequencySeconds' ) ) {

		_sharedBlinkTuning.frequencySeconds = clampNumber(
			partialTuning.frequencySeconds,
			FREQUENCY_MIN_SECONDS,
			FREQUENCY_MAX_SECONDS,
			MENU_CHARACTER_BLINK_DEFAULTS.frequencySeconds
		);

	}

	if ( Object.prototype.hasOwnProperty.call( partialTuning, 'speedSeconds' ) ) {

		_sharedBlinkTuning.speedSeconds = clampNumber(
			partialTuning.speedSeconds,
			SPEED_MIN_SECONDS,
			SPEED_MAX_SECONDS,
			MENU_CHARACTER_BLINK_DEFAULTS.speedSeconds
		);

	}

	return getMenuCharacterBlinkTuning();

}

export class MenuCharacterBlinkController {

	constructor( { random = Math.random } = {} ) {

		this._random = typeof random === 'function' ? random : Math.random;
		this._targets = [];
		this._blinkElapsed = 0;
		this._timeUntilBlink = 0;
		this._isBlinking = false;
		this._hasScheduledBlink = false;
		this._blinkValue = 0;

	}

	bind( characterRoot ) {

		this._forceEyesOpen();
		this._targets.length = 0;

		traverseNodes( characterRoot, ( node ) => {

			const influences = node?.morphTargetInfluences;
			const dict = node?.morphTargetDictionary;
			if ( ! dict || ! Array.isArray( influences ) ) return;

			const blinkIndex = Number( dict[ BLINK_TARGET_NAME ] );
			if ( ! Number.isInteger( blinkIndex ) ) return;
			if ( blinkIndex < 0 || blinkIndex >= influences.length ) return;

			this._targets.push( {
				influences,
				index: blinkIndex,
			} );

		} );

		if ( this._targets.length > 0 ) {

			this._scheduleNextBlink();

		}

		return this._targets.length;

	}

	reset() {

		this._forceEyesOpen();
		this._targets.length = 0;

	}

	update( dt ) {

		if ( this._targets.length === 0 ) return 0;

		const tuning = getMenuCharacterBlinkTuning();
		if ( tuning.frequencySeconds <= 0 ) {

			this._forceEyesOpen();
			return this._blinkValue;

		}

		const safeDt = Number.isFinite( dt ) && dt > 0 ? dt : 0;

		if ( ! this._isBlinking ) {

			if ( ! this._hasScheduledBlink ) {

				this._scheduleNextBlink();

			}

			this._timeUntilBlink -= safeDt;
			if ( this._timeUntilBlink > 0 ) {

				this._setBlinkValue( 0 );
				return this._blinkValue;

			}

			const carryDt = Math.max( 0, - this._timeUntilBlink );
			this._isBlinking = true;
			this._blinkElapsed = 0;
			this._timeUntilBlink = 0;
			this._hasScheduledBlink = false;

			return this._advanceBlink( carryDt, tuning.speedSeconds );

		}

		return this._advanceBlink( safeDt, tuning.speedSeconds );

	}

	_advanceBlink( dt, speedSeconds ) {

		const safeSpeed = clampNumber(
			speedSeconds,
			SPEED_MIN_SECONDS,
			SPEED_MAX_SECONDS,
			MENU_CHARACTER_BLINK_DEFAULTS.speedSeconds
		);

		this._blinkElapsed += dt;
		const progress = safeSpeed > 0
			? Math.min( this._blinkElapsed / safeSpeed, 1 )
			: 1;

		this._setBlinkValue( Math.sin( progress * Math.PI ) );

		if ( progress >= 1 ) {

			this._forceEyesOpen( { clearTargets: false } );
			this._scheduleNextBlink();

		}

		return this._blinkValue;

	}

	_scheduleNextBlink() {

		const tuning = getMenuCharacterBlinkTuning();
		if ( tuning.frequencySeconds <= 0 ) {

			this._hasScheduledBlink = false;
			this._timeUntilBlink = 0;
			return;

		}

		this._timeUntilBlink = computeBlinkDelaySeconds( tuning.frequencySeconds, this._random );
		this._hasScheduledBlink = true;

	}

	_forceEyesOpen( { clearTargets = false } = {} ) {

		this._isBlinking = false;
		this._blinkElapsed = 0;
		this._timeUntilBlink = 0;
		this._hasScheduledBlink = false;
		this._setBlinkValue( 0 );

		if ( clearTargets ) {

			this._targets.length = 0;

		}

	}

	_setBlinkValue( value ) {

		const blinkValue = clampNumber( value, 0, 1, 0 );
		this._blinkValue = blinkValue;

		for ( const target of this._targets ) {

			target.influences[ target.index ] = blinkValue;

		}

	}

}

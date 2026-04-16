import { MarginalPanelCard } from './MarginalPanelCard.js';
import { mvMusic } from './marginalVelocityIcons.js';

const VISUALIZER_BAR_COUNT = 12;
const VISUALIZER_IDLE_LEVEL = 0.08;

function clampVisualizerLevel( value ) {

	const numeric = Number( value );
	if ( ! Number.isFinite( numeric ) ) return 0;
	return Math.min( 1, Math.max( 0, numeric ) );

}

function createIdleVisualizerSamples( count = VISUALIZER_BAR_COUNT ) {

	return Array.from( { length: count }, () => VISUALIZER_IDLE_LEVEL );

}

export class MarginalMusicCard {

	static _cssInjected = false;

	constructor( { player = null } = {} ) {

		this._player = null;
		this._unsubscribe = null;
		this._el = null;
		this._trackEl = null;
		this._statusEl = null;
		this._headerLeftEl = null;
		this._headerRightEl = null;
		this._visualizerEl = null;
		this._visualizerBarEls = [];
		this._toggleBtn = null;
		this._nextBtn = null;

		this._injectCSS();
		this._build();
		this.setPlayer( player );

	}

	_injectCSS() {

		if ( MarginalMusicCard._cssInjected ) return;
		MarginalMusicCard._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.kk-mv-music-card {
				padding: 12px;
			}

			.kk-mv-music-card .kk-mv-card__body {
				gap: 0.55rem;
			}

			.kk-mv-music-card .kk-mv-card__header {
				font-family: var(--font-editorial-mono, var(--font-mono, monospace));
			}

			.kk-mv-music-card__track {
				margin: 0;
				font-family: var(--font-editorial-display, var(--font-display, sans-serif));
				font-size: clamp(1.15rem, 2vw, 1.55rem);
				font-weight: var(--weight-black, 900);
				line-height: 0.95;
				letter-spacing: -0.04em;
				text-transform: uppercase;
				color: rgba(15, 17, 21, 1);
				display: -webkit-box;
				-webkit-box-orient: vertical;
				-webkit-line-clamp: 2;
				overflow: hidden;
			}

			.kk-mv-music-card__status-row {
				display: flex;
				align-items: center;
				gap: 0.45rem;
			}

			.kk-mv-music-card__visualizer {
				position: relative;
				display: grid;
				grid-template-columns: repeat(12, minmax(0, 1fr));
				align-items: end;
				gap: 0.22rem;
				min-height: 3.2rem;
				padding: 0.5rem;
				border: 1px solid rgba(15, 17, 21, 0.14);
				background:
					linear-gradient(180deg, rgba(15, 17, 21, 0.08) 0%, rgba(15, 17, 21, 0.02) 100%),
					repeating-linear-gradient(
						90deg,
						rgba(15, 17, 21, 0.03) 0,
						rgba(15, 17, 21, 0.03) 1px,
						transparent 1px,
						transparent calc(100% / 12)
					);
				clip-path: polygon(0 0, 100% 0, 100% 90%, 97% 100%, 0 100%);
				overflow: hidden;
			}

			.kk-mv-music-card__visualizer::after {
				content: '';
				position: absolute;
				inset: 0;
				background: linear-gradient(180deg, rgba(247, 243, 233, 0.32) 0%, transparent 60%);
				pointer-events: none;
			}

			.kk-mv-music-card__visualizer--active {
				border-color: rgba(216, 44, 44, 0.28);
				box-shadow: inset 0 0 0 1px rgba(216, 44, 44, 0.08);
			}

			.kk-mv-music-card__visualizer--inactive {
				opacity: 0.78;
			}

			.kk-mv-music-card__visualizer-bar {
				position: relative;
				z-index: 1;
				align-self: end;
				width: 100%;
				min-height: 0.32rem;
				height: 18%;
				border-radius: 999px 999px 0 0;
				background: rgba(15, 17, 21, 0.24);
				opacity: 0.44;
				transition:
					height 140ms var(--ease-standard, ease),
					background 180ms var(--ease-standard, ease),
					opacity 180ms var(--ease-standard, ease),
					box-shadow 180ms var(--ease-standard, ease);
			}

			.kk-mv-music-card__visualizer--available .kk-mv-music-card__visualizer-bar {
				background: linear-gradient(180deg, rgba(216, 44, 44, 0.85) 0%, rgba(15, 17, 21, 0.95) 100%);
				opacity: 0.68;
			}

			.kk-mv-music-card__visualizer--active .kk-mv-music-card__visualizer-bar {
				opacity: 1;
				box-shadow: 0 0 0.8rem rgba(216, 44, 44, 0.16);
			}

			.kk-mv-music-card__status-dot {
				width: 0.55rem;
				height: 0.55rem;
				border-radius: 999px;
				background: rgba(247, 243, 233, 0.28);
				flex-shrink: 0;
				transition:
					background var(--duration-normal, 200ms) var(--ease-standard, ease),
					box-shadow var(--duration-normal, 200ms) var(--ease-standard, ease),
					transform var(--duration-normal, 200ms) var(--ease-standard, ease);
			}

			.kk-mv-music-card__status {
				margin: 0;
				color: rgba(15, 17, 21, 1);
			}

			.kk-mv-music-card__controls {
				display: flex;
				gap: 0.4rem;
			}

			.kk-mv-music-card__btn {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				flex: 1 1 0;
				min-height: 2rem;
				padding: 0.5rem 0.65rem;
				border: 1px solid currentColor;
				background: transparent;
				color: inherit;
				font-family: var(--font-editorial-mono, var(--font-mono, monospace));
				font-size: 0;
				font-weight: var(--weight-bold, 700);
				letter-spacing: 0;
				text-transform: none;
				cursor: pointer;
				clip-path: polygon(0 0, 100% 0, 100% 88%, 95% 100%, 0 100%);
				transition:
					background var(--duration-fast, 100ms) var(--ease-standard, ease),
					border-color var(--duration-fast, 100ms) var(--ease-standard, ease),
					transform var(--duration-fast, 100ms) var(--ease-standard, ease);
			}

			.kk-mv-music-card__btn .kk-mv-svg {
				display: block;
			}

			.kk-mv-music-card__btn:hover:not(:disabled),
			.kk-mv-music-card__btn:focus-visible:not(:disabled) {
				transform: translateY(-1px);
				background: rgba(15, 17, 21, 0.08);
			}

			.kk-mv-card--outline .kk-mv-music-card__btn:hover:not(:disabled),
			.kk-mv-card--outline .kk-mv-music-card__btn:focus-visible:not(:disabled) {
				background: rgba(247, 243, 233, 0.12);
			}

			.kk-mv-music-card__btn--primary {
				background: rgba(216, 44, 44, 0.1);
			}

			.kk-mv-music-card__btn:disabled {
				opacity: 0.5;
				cursor: default;
			}


			.kk-mv-music-card--playing .kk-mv-music-card__status-dot {
				background: var(--color-editorial-red, #d82c2c);
				box-shadow: 0 0 0.7rem rgba(216, 44, 44, 0.34);
				animation: kk-mv-music-card-pulse 1.8s ease-in-out infinite;
			}

			.kk-mv-music-card--error .kk-mv-music-card__status-dot {
				background: var(--color-error, #ef4444);
				box-shadow: 0 0 0.7rem rgba(239, 68, 68, 0.3);
			}

			@keyframes kk-mv-music-card-pulse {
				0%, 100% {
					transform: scale(1);
					opacity: 0.8;
				}

				50% {
					transform: scale(1.18);
					opacity: 1;
				}
			}
		`;
		document.head.appendChild( style );

	}

	_build() {

		const card = new MarginalPanelCard( {
			variant: 'cream',
			headerLeft: 'Loading',
			headerRight: '',
		} );
		card.el.classList.add( 'kk-mv-music-card' );
		this._headerLeftEl = card.headerLeftEl;
		this._headerRightEl = card.headerRightEl;

		const track = document.createElement( 'p' );
		track.className = 'kk-mv-music-card__track';
		track.textContent = 'Loading music';
		card.bodyEl.appendChild( track );
		this._trackEl = track;

		const statusRow = document.createElement( 'div' );
		statusRow.className = 'kk-mv-music-card__status-row';

		const dot = document.createElement( 'span' );
		dot.className = 'kk-mv-music-card__status-dot';
		dot.setAttribute( 'aria-hidden', 'true' );
		statusRow.appendChild( dot );

		const status = document.createElement( 'p' );
		status.className = 'kk-mv-copy kk-mv-music-card__status';
		status.textContent = 'Preparing player';
		statusRow.appendChild( status );
		card.bodyEl.appendChild( statusRow );
		this._statusEl = status;

		const visualizer = document.createElement( 'div' );
		visualizer.className = 'kk-mv-music-card__visualizer kk-mv-music-card__visualizer--inactive';
		visualizer.setAttribute( 'aria-hidden', 'true' );
		card.bodyEl.appendChild( visualizer );
		this._visualizerEl = visualizer;
		this._ensureVisualizerBars( VISUALIZER_BAR_COUNT );

		const controls = document.createElement( 'div' );
		controls.className = 'kk-mv-music-card__controls';

		const toggleBtn = document.createElement( 'button' );
		toggleBtn.type = 'button';
		toggleBtn.className = 'kk-mv-music-card__btn kk-mv-music-card__btn--primary';
		toggleBtn.innerHTML = mvMusic.play;
		toggleBtn.setAttribute( 'aria-label', 'Play menu music' );
		toggleBtn.addEventListener( 'click', () => {

			void this._player?.toggle?.();

		} );
		controls.appendChild( toggleBtn );
		this._toggleBtn = toggleBtn;

		const nextBtn = document.createElement( 'button' );
		nextBtn.type = 'button';
		nextBtn.className = 'kk-mv-music-card__btn';
		nextBtn.innerHTML = mvMusic.next;
		nextBtn.setAttribute( 'aria-label', 'Next track' );
		nextBtn.addEventListener( 'click', () => {

			void this._player?.next?.();

		} );
		controls.appendChild( nextBtn );
		this._nextBtn = nextBtn;

		card.bodyEl.appendChild( controls );
		this._el = card.el;

	}

	setPlayer( player ) {

		if ( this._unsubscribe ) {

			this._unsubscribe();
			this._unsubscribe = null;

		}

		this._player = player || null;

		if ( ! this._player?.subscribe ) {

			this._render( {
				canPlay: false,
				isPlaying: false,
				active: false,
				currentTrack: null,
				playlistLength: 0,
				error: 'Menu music unavailable.',
			} );
			return;

		}

		this._unsubscribe = this._player.subscribe( ( state ) => {

			this._render( state );

		} );

	}

	_ensureVisualizerBars( count ) {

		if ( ! this._visualizerEl ) return;
		const targetCount = Math.max( 1, count || VISUALIZER_BAR_COUNT );
		this._visualizerEl.style.gridTemplateColumns = `repeat(${ targetCount }, minmax(0, 1fr))`;

		while ( this._visualizerBarEls.length < targetCount ) {

			const bar = document.createElement( 'span' );
			bar.className = 'kk-mv-music-card__visualizer-bar';
			bar.setAttribute( 'aria-hidden', 'true' );
			this._visualizerEl.appendChild( bar );
			this._visualizerBarEls.push( bar );

		}

		while ( this._visualizerBarEls.length > targetCount ) {

			const bar = this._visualizerBarEls.pop();
			this._visualizerEl.removeChild( bar );

		}

	}

	_renderVisualizer( state ) {

		const samples = Array.isArray( state?.visualizerSamples ) && state.visualizerSamples.length > 0
			? state.visualizerSamples
			: createIdleVisualizerSamples();
		const visualizerActive = !! state?.visualizerActive;
		const visualizerAvailable = !! state?.visualizerAvailable;
		this._ensureVisualizerBars( samples.length );

		if ( this._visualizerEl ) {

			this._visualizerEl.classList.toggle( 'kk-mv-music-card__visualizer--active', visualizerActive );
			this._visualizerEl.classList.toggle( 'kk-mv-music-card__visualizer--inactive', ! visualizerActive );
			this._visualizerEl.classList.toggle( 'kk-mv-music-card__visualizer--available', visualizerAvailable );
			this._visualizerEl.dataset.mode = visualizerAvailable ? 'reactive' : 'fallback';

		}

		for ( let index = 0; index < this._visualizerBarEls.length; index ++ ) {

			const bar = this._visualizerBarEls[ index ];
			const level = clampVisualizerLevel( samples[ index ] );
			const heightPercent = Math.round( 16 + level * 84 );
			bar.style.height = `${ heightPercent }%`;
			bar.dataset.level = level.toFixed( 2 );

		}

	}

	_render( state ) {

		const currentTrack = state?.currentTrack || null;
		const canPlay = !! state?.canPlay;
		const isPlaying = !! state?.isPlaying;
		const isActive = !! state?.active;
		const hasError = !! state?.error;

		this._trackEl.textContent = currentTrack?.title || 'Menu music unavailable';

		const headerLeft = ( () => {

			if ( hasError ) return 'Error';
			if ( ! canPlay ) return 'Unavailable';
			if ( isPlaying ) return 'Now playing';
			if ( isActive ) return 'Paused';
			return 'Ready';

		} )();

		if ( this._headerLeftEl ) this._headerLeftEl.textContent = headerLeft;
		if ( this._headerRightEl ) this._headerRightEl.textContent = '';

		if ( hasError ) {

			this._statusEl.textContent = state.error;

		} else {

			this._statusEl.textContent = '';

		}

		this._renderVisualizer( state );

		this._el.classList.toggle( 'kk-mv-music-card--playing', isPlaying );
		this._el.classList.toggle( 'kk-mv-music-card--error', hasError );
		this._toggleBtn.disabled = ! canPlay;
		this._toggleBtn.innerHTML = isPlaying ? mvMusic.pause : mvMusic.play;
		this._toggleBtn.setAttribute( 'aria-label', isPlaying ? 'Pause menu music' : 'Play menu music' );
		this._nextBtn.disabled = ! canPlay || ( state?.playlistLength ?? 0 ) < 2;

	}

	destroy() {

		if ( this._unsubscribe ) {

			this._unsubscribe();
			this._unsubscribe = null;

		}

	}

	get el() {

		return this._el;

	}

}

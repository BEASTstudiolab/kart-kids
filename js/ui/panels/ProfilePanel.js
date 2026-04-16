import { Settings } from '../../Settings.js';
import { MarginalPanelCard } from '../components/MarginalPanelCard.js';
import { MarginalPanelHeader } from '../components/MarginalPanelHeader.js';
import { sanitizePlayerName } from '../utils/sanitize.js';

function _formatTime( seconds ) {

	if ( typeof seconds !== 'number' || Number.isNaN( seconds ) ) return '--:--.---';

	const mins = Math.floor( seconds / 60 );
	const secs = seconds % 60;
	const wholeSecs = Math.floor( secs );
	const ms = Math.round( ( secs - wholeSecs ) * 1000 );

	return `${ String( mins ).padStart( 2, '0' ) }:${ String( wholeSecs ).padStart( 2, '0' ) }.${ String( ms ).padStart( 3, '0' ) }`;

}

export class ProfilePanel {

	static _cssInjected = false;

	constructor( container, services ) {

		this._container = container;
		this._services = services;
		this._nameEl = null;
		this._metaEls = [];
		this._statusValueEl = null;
		this._bestTimesListEl = null;
		this._settingsBtn = null;
		this._nameInputEl = null;
		this._nameSaveBtn = null;

		this._injectCSS();
		this._build();
		this._container.appendChild( this._root );

	}

	_injectCSS() {

		if ( ProfilePanel._cssInjected ) return;
		ProfilePanel._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.kk-profile {
				--mv-cream: #F7F3E9;
				--mv-red: #D82C2C;
				--mv-dark: #0F1115;
				--mv-font-display: var(--font-editorial-display, var(--font-display, sans-serif));
				--mv-font-mono: var(--font-editorial-mono, var(--font-mono, monospace));
				position: relative;
				width: 100%;
				height: 100%;
				overflow: hidden;
				color: var(--mv-cream);
				font-family: var(--mv-font-mono);
				text-transform: uppercase;
				background: unset;
				background-color: unset;
				background-image: none;
			}

			.kk-profile,
			.kk-profile * {
				cursor: crosshair;
			}

			.kk-profile__scanlines,
			.kk-profile__vignette {
				display: none;
				position: absolute;
				inset: 0;
				pointer-events: none;
			}

			.kk-profile__scanlines {
				z-index: 1;
				opacity: 0.24;
				background:
					linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.08) 50%),
					linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.008), rgba(0, 0, 255, 0.03));
				background-size: 100% 3px, 3px 100%;
			}

			.kk-profile__vignette {
				z-index: 2;
				box-shadow: inset 0 0 150px rgba(0, 0, 0, 0.62);
			}

			.kk-profile__interface {
				position: relative;
				z-index: 3;
				display: grid;
				grid-template-rows: auto auto minmax(0, 1fr);
				width: 100%;
				height: 100%;
				padding: 24px 24px calc(24px + var(--kk-shell-nav-clearance, 6.75rem));
				gap: 20px;
			}

			.kk-profile__top {
				display: grid;
				grid-template-columns: minmax(0, 1fr) minmax(280px, 320px);
				gap: 20px;
			}

			.kk-profile__settings-btn {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				padding: 10px 16px;
				border: 1px solid rgba(247, 243, 233, 0.82);
				background: transparent;
				color: var(--mv-cream);
				font-family: var(--font-editorial-mono, var(--font-mono, monospace));
				font-size: var(--text-editorial-label, 0.625rem);
				font-weight: 700;
				letter-spacing: var(--tracking-widest, 0.14em);
				text-transform: uppercase;
				transition: background 0.2s ease, transform 0.2s ease;
			}

			.kk-profile__settings-btn:hover {
				background: rgba(247, 243, 233, 0.12);
				transform: translateY(-1px);
			}

			.kk-profile__times .kk-mv-card__body {
				min-height: 0;
			}

			.kk-profile__times-list {
				display: flex;
				flex-direction: column;
				gap: 8px;
			}

			.kk-profile__time-item {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 12px;
				padding: 10px 0;
				border-bottom: 1px solid rgba(247, 243, 233, 0.14);
				font-size: var(--text-editorial-data, 0.625rem);
				letter-spacing: 0.12em;
			}

			.kk-profile__time-item:last-child {
				border-bottom: none;
			}

			.kk-profile__time-value {
				font-family: var(--font-editorial-display, var(--font-display, sans-serif));
				font-size: 1.1rem;
				font-weight: 900;
				letter-spacing: -0.02em;
			}

			.kk-profile__times-empty {
				font-size: var(--text-editorial-data, 0.625rem);
				letter-spacing: 0.12em;
				opacity: 0.72;
			}

			.kk-profile__name-editor {
				display: grid;
				grid-template-columns: minmax(0, 1fr) auto;
				gap: 10px;
				margin-top: 14px;
			}

			.kk-profile__name-input {
				min-height: 44px;
				border: 1px solid rgba(15, 17, 21, 0.22);
				background: rgba(15, 17, 21, 0.06);
				color: var(--mv-dark);
				padding: 10px 12px;
				font: inherit;
				font-size: var(--text-editorial-label, 0.625rem);
				font-weight: 700;
				letter-spacing: 0.14em;
				text-transform: uppercase;
			}

			.kk-profile__name-input::placeholder {
				color: rgba(15, 17, 21, 0.35);
			}

			.kk-profile__name-save {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				min-width: 132px;
				padding: 10px 14px;
				border: 1px solid var(--mv-red);
				background: var(--mv-red);
				color: var(--mv-cream);
				font-family: var(--font-editorial-mono, var(--font-mono, monospace));
				font-size: var(--text-editorial-label, 0.625rem);
				font-weight: 700;
				letter-spacing: var(--tracking-widest, 0.14em);
				text-transform: uppercase;
				transition: background 0.2s ease, transform 0.2s ease;
			}

			.kk-profile__name-save:hover {
				background: #b91f1f;
				transform: translateY(-1px);
			}

			@media (max-width: 980px) {
				.kk-profile {
					overflow-y: auto;
				}

				.kk-profile__interface {
					height: auto;
					min-height: 100%;
					padding: 20px 16px calc(20px + var(--kk-shell-nav-clearance, 6.75rem));
				}

				.kk-profile__top {
					grid-template-columns: 1fr;
				}

				.kk-profile__name-editor {
					grid-template-columns: 1fr;
				}
			}
		`;
		document.head.appendChild( style );

	}

	_build() {

		this._root = document.createElement( 'div' );
		this._root.className = 'kk-profile';

		const scanlines = document.createElement( 'div' );
		scanlines.className = 'kk-profile__scanlines';
		this._root.appendChild( scanlines );

		const vignette = document.createElement( 'div' );
		vignette.className = 'kk-profile__vignette';
		this._root.appendChild( vignette );

		const frame = document.createElement( 'div' );
		frame.className = 'kk-profile__interface';
		this._root.appendChild( frame );

		frame.appendChild( new MarginalPanelHeader( {
			title: 'Profile',
			subtitle: 'Pilot Dossier // Stats, Records, Systems',
			badge: '',
		} ).el );

		const top = document.createElement( 'div' );
		top.className = 'kk-profile__top';
		top.appendChild( this._buildIdentityCard() );
		top.appendChild( this._buildStatusCard() );
		frame.appendChild( top );

		frame.appendChild( this._buildTimesCard() );

	}

	_buildIdentityCard() {

		const card = new MarginalPanelCard( {
			headerLeft: 'Pilot Data',
			headerRight: 'Live',
		} );

		const label = document.createElement( 'div' );
		label.className = 'kk-mv-label';
		label.textContent = 'Display Name';
		card.bodyEl.appendChild( label );

		const value = document.createElement( 'div' );
		value.className = 'kk-mv-value';
		card.bodyEl.appendChild( value );
		this._nameEl = value;

		const editor = document.createElement( 'div' );
		editor.className = 'kk-profile__name-editor';

		const input = document.createElement( 'input' );
		input.type = 'text';
		input.maxLength = 20;
		input.className = 'kk-profile__name-input';
		input.placeholder = 'Pilot tag';
		editor.appendChild( input );
		this._nameInputEl = input;

		const saveBtn = document.createElement( 'button' );
		saveBtn.type = 'button';
		saveBtn.className = 'kk-profile__name-save';
		saveBtn.textContent = 'Update Tag';
		saveBtn.addEventListener( 'click', () => this._saveDisplayName() );
		editor.appendChild( saveBtn );
		this._nameSaveBtn = saveBtn;

		input.addEventListener( 'keydown', ( e ) => {

			if ( e.key === 'Enter' ) {

				e.preventDefault();
				this._saveDisplayName();

			}

		} );

		card.bodyEl.appendChild( editor );

		const grid = document.createElement( 'div' );
		grid.className = 'kk-mv-data-grid';
		for ( let i = 0; i < 4; i ++ ) {

			const item = document.createElement( 'div' );
			item.className = 'kk-mv-data-item';
			grid.appendChild( item );
			this._metaEls.push( item );

		}
		card.bodyEl.appendChild( grid );

		return card.el;

	}

	_buildStatusCard() {

		const card = new MarginalPanelCard( {
			variant: 'red',
			headerLeft: 'System Control',
			headerRight: '[SETUP]',
			sticker: 'Menu: Live',
		} );

		const label = document.createElement( 'div' );
		label.className = 'kk-mv-label';
		label.textContent = 'Settings Access';
		card.bodyEl.appendChild( label );

		const value = document.createElement( 'div' );
		value.className = 'kk-mv-value';
		value.textContent = 'Ready';
		card.bodyEl.appendChild( value );
		this._statusValueEl = value;

		const copy = document.createElement( 'p' );
		copy.className = 'kk-mv-copy';
		copy.textContent = 'Open settings, tune accessibility and controls, then return straight to the grid with your current profile.';
		card.bodyEl.appendChild( copy );

		const btn = document.createElement( 'button' );
		btn.type = 'button';
		btn.className = 'kk-profile__settings-btn';
		btn.textContent = 'Open Settings';
		btn.addEventListener( 'click', () => this._services.openSettings?.() );
		card.bodyEl.appendChild( btn );
		this._settingsBtn = btn;

		return card.el;

	}

	_buildTimesCard() {

		const card = new MarginalPanelCard( {
			variant: 'outline',
			headerLeft: 'Best Times',
		} );
		card.el.classList.add( 'kk-profile__times' );

		const list = document.createElement( 'div' );
		list.className = 'kk-profile__times-list';
		card.bodyEl.appendChild( list );
		this._bestTimesListEl = list;

		return card.el;

	}

	_refresh() {

		const settings = new Settings();
		const displayName = settings.getDisplayName() || 'Pilot';
		const stats = settings.getStats() || {};
		const totalRaces = Number( stats.totalRaces || 0 );
		const wins = Number( stats.wins || 0 );
		const winRate = totalRaces > 0 ? Math.round( ( wins / totalRaces ) * 100 ) : 0;

		if ( this._nameEl ) this._nameEl.textContent = displayName;
		if ( this._nameInputEl ) this._nameInputEl.value = displayName;

		const lines = [
			`Races: ${ totalRaces }`,
			`Wins: ${ wins }`,
			`Rate: ${ winRate }%`,
			`Mode: Active`,
		];
		this._metaEls.forEach( ( el, index ) => {

			el.textContent = lines[ index ] || '';

		} );

		if ( this._statusValueEl ) this._statusValueEl.textContent = totalRaces > 0 ? 'Tracked' : 'Ready';

		this._bestTimesListEl.innerHTML = '';
		const bestTimes = Object.entries( stats.bestTimes || {} )
			.sort( ( a, b ) => a[ 1 ] - b[ 1 ] );

		if ( bestTimes.length === 0 ) {

			const empty = document.createElement( 'div' );
			empty.className = 'kk-profile__times-empty';
			empty.textContent = 'No course records logged yet.';
			this._bestTimesListEl.appendChild( empty );
			return;

		}

		bestTimes.slice( 0, 6 ).forEach( ( [ trackId, time ] ) => {

			const row = document.createElement( 'div' );
			row.className = 'kk-profile__time-item';

			const label = document.createElement( 'span' );
			label.textContent = String( trackId ).replace( /[-_]+/g, ' ' );
			row.appendChild( label );

			const value = document.createElement( 'span' );
			value.className = 'kk-profile__time-value';
			value.textContent = _formatTime( Number( time ) );
			row.appendChild( value );

			this._bestTimesListEl.appendChild( row );

		} );

	}

	_saveDisplayName() {

		if ( ! this._nameInputEl ) return;

		const nextValue = sanitizePlayerName( this._nameInputEl.value || '' ).trim();
		if ( ! nextValue ) return;

		const settings = new Settings();
		settings.setDisplayName( nextValue );
		this._refresh();

	}

	show() {

		this._refresh();

	}

	hide() {}

	dispose() {

		if ( this._root?.parentNode ) this._root.parentNode.removeChild( this._root );
		this._root = null;

	}

}

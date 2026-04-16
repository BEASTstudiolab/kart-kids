import { renderMinimap } from './TrackMinimap.js';

export class TrackLibraryBrowser {

	static _cssInjected = false;

	constructor( container, opts = {} ) {

		this._container = container;
		this._opts = opts;
		this._sections = [];
		this._selectedTrackId = opts.selectedTrackId || null;
		this._detailTrack = null;
		this._root = null;
		this._detailName = null;
		this._detailMeta = null;
		this._detailDesc = null;
		this._detailMinimap = null;
		this._detailActions = null;

		TrackLibraryBrowser._injectCSS();
		this._build();
		this._container.appendChild( this._root );

	}

	static _injectCSS() {

		if ( TrackLibraryBrowser._cssInjected ) return;
		TrackLibraryBrowser._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.kk-track-library {
				display: grid;
				grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
				gap: 24px;
				height: 100%;
			}
			.kk-track-library__detail {
				padding: 18px;
				border-radius: 24px;
				background: rgba(16,18,28,0.92);
				border: 1px solid rgba(255,255,255,0.08);
				display: flex;
				flex-direction: column;
				gap: 14px;
				align-self: start;
				position: sticky;
				top: 0;
			}
			.kk-track-library__detail-name {
				font-family: var(--font-display, sans-serif);
				font-size: clamp(1.5rem, 3vw, 2.25rem);
				font-weight: 900;
				text-transform: uppercase;
				letter-spacing: 0.08em;
				line-height: 1.02;
				color: #fff;
			}
			.kk-track-library__detail-meta {
				display: flex;
				flex-wrap: wrap;
				gap: 8px;
			}
			.kk-track-library__detail-desc {
				color: rgba(255,255,255,0.72);
				line-height: 1.45;
				font-size: 0.95rem;
			}
			.kk-track-library__detail-minimap {
				border-radius: 18px;
				overflow: hidden;
				border: 1px solid rgba(255,255,255,0.08);
				background: transparent;
				--track-minimap-track: rgba(247, 243, 233, 0.94);
			}
			.kk-track-library__detail-minimap canvas,
			.kk-track-library__detail-minimap svg {
				display: block;
				width: 100%;
				height: auto;
			}
			.kk-track-library__detail-actions {
				display: flex;
				flex-wrap: wrap;
				gap: 10px;
			}
			.kk-track-library__action {
				border: 1px solid rgba(255,255,255,0.12);
				background: rgba(255,255,255,0.06);
				color: #fff;
				border-radius: 999px;
				padding: 12px 16px;
				font-weight: 800;
				font-size: 0.78rem;
				letter-spacing: 0.08em;
				text-transform: uppercase;
				cursor: pointer;
				text-decoration: none;
			}
			.kk-track-library__action--primary {
				background: linear-gradient(180deg, #ff9a3d 0%, #ff6b00 100%);
				color: #060606;
			}
			.kk-track-library__content {
				display: flex;
				flex-direction: column;
				gap: 22px;
				overflow-y: auto;
				padding-right: 6px;
			}
			.kk-track-library__section {
				display: flex;
				flex-direction: column;
				gap: 10px;
			}
			.kk-track-library__heading {
				margin: 0;
				padding: 0 14px;
				font-family: var(--font-display, sans-serif);
				font-size: 1rem;
				font-weight: 900;
				text-transform: uppercase;
				letter-spacing: 0.16em;
				color: rgba(255,255,255,0.62);
			}
			.kk-track-library__carousel-wrap {
				position: relative;
			}
			.kk-track-library__carousel {
				display: flex;
				gap: 14px;
				padding: 10px 14px;
				overflow-x: auto;
				scrollbar-width: none;
				-webkit-overflow-scrolling: touch;
			}
			.kk-track-library__carousel::-webkit-scrollbar {
				display: none;
			}
			.kk-track-library__arrow {
				position: absolute;
				top: 50%;
				transform: translateY(-50%);
				width: 36px;
				height: 36px;
				border-radius: 999px;
				border: 1px solid rgba(255,255,255,0.12);
				background: rgba(0,0,0,0.68);
				color: #fff;
				cursor: pointer;
				z-index: 2;
			}
			.kk-track-library__arrow--left { left: 0; }
			.kk-track-library__arrow--right { right: 0; }
			.kk-track-library__card {
				min-width: 220px;
				max-width: 220px;
				border-radius: 22px;
				padding: 14px;
				background: rgba(17,20,30,0.9);
				border: 1px solid rgba(255,255,255,0.08);
				box-sizing: border-box;
				cursor: pointer;
				display: flex;
				flex-direction: column;
				gap: 12px;
			}
			.kk-track-library__card--selected {
				border-color: rgba(255,154,61,0.9);
				box-shadow: 0 0 0 1px rgba(255,154,61,0.5), 0 12px 24px rgba(255,107,0,0.2);
			}
			.kk-track-library__card-name {
				font-family: var(--font-display, sans-serif);
				font-size: 1rem;
				font-weight: 800;
				text-transform: uppercase;
				letter-spacing: 0.08em;
				line-height: 1.05;
				color: #fff;
			}
			.kk-track-library__card-meta {
				color: rgba(255,255,255,0.68);
				font-size: 0.82rem;
				line-height: 1.35;
			}
			.kk-track-library__card-minimap {
				border-radius: 14px;
				overflow: hidden;
				border: 1px solid rgba(255,255,255,0.08);
				background: transparent;
				--track-minimap-track: rgba(247, 243, 233, 0.94);
			}
			.kk-track-library__card-minimap canvas,
			.kk-track-library__card-minimap svg {
				display: block;
				width: 100%;
				height: auto;
			}
			.kk-track-library__badges {
				display: flex;
				flex-wrap: wrap;
				gap: 8px;
			}
			.kk-track-library__badge {
				display: inline-flex;
				align-items: center;
				border-radius: 999px;
				padding: 6px 10px;
				font-size: 0.68rem;
				font-weight: 800;
				letter-spacing: 0.08em;
				text-transform: uppercase;
				background: rgba(255,255,255,0.08);
				color: #fff;
			}
			.kk-track-library__badge--easy { background: rgba(34,197,94,0.18); color: #9ef2b7; }
			.kk-track-library__badge--medium { background: rgba(250,204,21,0.18); color: #ffe58a; }
			.kk-track-library__badge--hard { background: rgba(239,68,68,0.18); color: #ffb3b3; }
			.kk-track-library__badge--selected { background: rgba(255,154,61,0.18); color: #ffc58f; }
			.kk-track-library__empty {
				padding: 16px 18px;
				border-radius: 18px;
				background: rgba(255,255,255,0.04);
				border: 1px dashed rgba(255,255,255,0.12);
				color: rgba(255,255,255,0.6);
				margin: 0 14px;
			}
			@media (max-width: 980px) {
				.kk-track-library {
					grid-template-columns: 1fr;
				}
				.kk-track-library__detail {
					position: static;
				}
			}
		`;
		document.head.appendChild( style );

	}

	_build() {

		this._root = document.createElement( 'div' );
		this._root.className = 'kk-track-library';

		const detail = document.createElement( 'aside' );
		detail.className = 'kk-track-library__detail';
		this._detailName = document.createElement( 'div' );
		this._detailName.className = 'kk-track-library__detail-name';
		this._detailMeta = document.createElement( 'div' );
		this._detailMeta.className = 'kk-track-library__detail-meta';
		this._detailDesc = document.createElement( 'div' );
		this._detailDesc.className = 'kk-track-library__detail-desc';
		this._detailMinimap = document.createElement( 'div' );
		this._detailMinimap.className = 'kk-track-library__detail-minimap';
		this._detailActions = document.createElement( 'div' );
		this._detailActions.className = 'kk-track-library__detail-actions';
		detail.appendChild( this._detailName );
		detail.appendChild( this._detailMeta );
		detail.appendChild( this._detailDesc );
		detail.appendChild( this._detailMinimap );
		detail.appendChild( this._detailActions );

		this._content = document.createElement( 'div' );
		this._content.className = 'kk-track-library__content';

		this._root.appendChild( detail );
		this._root.appendChild( this._content );

	}

	setSections( sections, selectedTrackId = null ) {

		this._sections = sections;
		if ( selectedTrackId !== null ) this._selectedTrackId = selectedTrackId;
		this._renderSections();

		const firstTrack = this._findTrackById( this._selectedTrackId ) || this._sections.flatMap( ( section ) => section.items || [] )[ 0 ] || null;
		this._setDetailTrack( firstTrack );

	}

	setSelectedTrackId( trackId ) {

		this._selectedTrackId = trackId;
		this._renderSections();
		this._setDetailTrack( this._findTrackById( trackId ) || this._detailTrack );

	}

	getSelectedTrack() {

		return this._findTrackById( this._selectedTrackId );

	}

	refresh() {

		this._renderSections();
		this._setDetailTrack( this._findTrackById( this._selectedTrackId ) || this._detailTrack );

	}

	_renderSections() {

		this._content.innerHTML = '';

		for ( const section of this._sections ) {

			const sectionEl = document.createElement( 'section' );
			sectionEl.className = 'kk-track-library__section';
			sectionEl.setAttribute( 'aria-label', section.label );

			const heading = document.createElement( 'h2' );
			heading.className = 'kk-track-library__heading';
			heading.textContent = section.label;
			sectionEl.appendChild( heading );

			const wrap = document.createElement( 'div' );
			wrap.className = 'kk-track-library__carousel-wrap';

			const row = document.createElement( 'div' );
			row.className = 'kk-track-library__carousel';
			wrap.appendChild( row );

			if ( section.items && section.items.length > 0 ) {

				for ( const item of section.items ) {

					row.appendChild( this._buildCard( item ) );

				}

			} else {

				const empty = document.createElement( 'div' );
				empty.className = 'kk-track-library__empty';
				empty.textContent = section.emptyText || 'Nothing here yet.';
				row.appendChild( empty );

			}

			this._attachArrows( wrap, row );
			sectionEl.appendChild( wrap );
			this._content.appendChild( sectionEl );

		}

	}

	_attachArrows( wrap, row ) {

		const left = document.createElement( 'button' );
		left.type = 'button';
		left.className = 'kk-track-library__arrow kk-track-library__arrow--left';
		left.setAttribute( 'aria-label', 'Scroll left' );
		left.textContent = '<';
		left.addEventListener( 'click', () => row.scrollBy( { left: -240, behavior: 'smooth' } ) );

		const right = document.createElement( 'button' );
		right.type = 'button';
		right.className = 'kk-track-library__arrow kk-track-library__arrow--right';
		right.setAttribute( 'aria-label', 'Scroll right' );
		right.textContent = '>';
		right.addEventListener( 'click', () => row.scrollBy( { left: 240, behavior: 'smooth' } ) );

		wrap.appendChild( left );
		wrap.appendChild( right );

	}

	_buildCard( track ) {

		const card = document.createElement( 'article' );
		card.className = 'kk-track-library__card';
		if ( track.trackId && track.trackId === this._selectedTrackId ) {

			card.classList.add( 'kk-track-library__card--selected' );

		}

		card.addEventListener( 'click', () => {

			this._setDetailTrack( track );

			if ( track.selectable === false ) return;

			this._selectedTrackId = track.trackId;
			this._opts.onTrackSelected?.( track.trackId, track );
			this._renderSections();

		} );

		const name = document.createElement( 'div' );
		name.className = 'kk-track-library__card-name';
		name.textContent = track.title || track.name || 'Untitled';
		card.appendChild( name );

		const meta = document.createElement( 'div' );
		meta.className = 'kk-track-library__card-meta';
		meta.textContent = this._describeTrack( track );
		card.appendChild( meta );

		if ( Array.isArray( track.cells ) && track.cells.length > 0 ) {

			const minimap = document.createElement( 'div' );
			minimap.className = 'kk-track-library__card-minimap';
			minimap.appendChild( renderMinimap( track.cells, 200, 84 ) );
			card.appendChild( minimap );

		}

		const badges = document.createElement( 'div' );
		badges.className = 'kk-track-library__badges';

		for ( const badge of this._buildBadges( track ) ) {

			badges.appendChild( badge );

		}

		if ( badges.childNodes.length > 0 ) card.appendChild( badges );
		return card;

	}

	_setDetailTrack( track ) {

		this._detailTrack = track;

		if ( ! track ) {

			this._detailName.textContent = 'No track selected';
			this._detailMeta.innerHTML = '';
			this._detailDesc.textContent = '';
			this._detailMinimap.innerHTML = '';
			this._detailActions.innerHTML = '';
			return;

		}

		this._detailName.textContent = track.title || track.name || 'Untitled';
		this._detailMeta.innerHTML = '';
		for ( const badge of this._buildBadges( track ) ) {

			this._detailMeta.appendChild( badge );

		}

		this._detailDesc.textContent = this._describeDetail( track );
		this._detailMinimap.innerHTML = '';
		if ( Array.isArray( track.cells ) && track.cells.length > 0 ) {

			this._detailMinimap.appendChild( renderMinimap( track.cells, 520, 220 ) );

		}

		this._detailActions.innerHTML = '';
		for ( const action of this._getActionsForTrack( track ) ) {

			this._detailActions.appendChild( action );

		}

	}

	_getActionsForTrack( track ) {

		const actions = [];

		if ( track.selectable !== false ) {

			const select = document.createElement( 'button' );
			select.type = 'button';
			select.className = 'kk-track-library__action kk-track-library__action--primary';
			select.textContent = track.trackId === this._selectedTrackId ? 'Selected' : 'Select Track';
			select.disabled = track.trackId === this._selectedTrackId;
			select.addEventListener( 'click', () => {

				this._selectedTrackId = track.trackId;
				this._opts.onTrackSelected?.( track.trackId, track );
				this.refresh();

			} );
			actions.push( select );

		}

		for ( const actionDef of ( track.actions || [] ) ) {

			const control = actionDef.href ? document.createElement( 'a' ) : document.createElement( 'button' );
			control.className = `kk-track-library__action${ actionDef.primary ? ' kk-track-library__action--primary' : '' }`;
			control.textContent = actionDef.label;
			if ( actionDef.href ) {

				control.href = actionDef.href;
				if ( actionDef.target ) control.target = actionDef.target;

			} else {

				control.type = 'button';
				control.addEventListener( 'click', () => actionDef.onClick?.( track ) );

			}
			actions.push( control );

		}

		return actions;

	}

	_buildBadges( track ) {

		const badges = [];

		if ( track.difficulty ) badges.push( this._badge( track.difficulty.toUpperCase(), `kk-track-library__badge--${ track.difficulty }` ) );
		if ( track.trackId === this._selectedTrackId ) badges.push( this._badge( 'SELECTED', 'kk-track-library__badge--selected' ) );
		if ( track.source === 'spotlight' ) badges.push( this._badge( 'SPOTLIGHT' ) );
		if ( track.source === 'published' ) badges.push( this._badge( 'LIVE' ) );
		if ( track.source === 'published' && track.status ) badges.push( this._badge( track.status.toUpperCase() ) );

		return badges;

	}

	_badge( text, extraClass = '' ) {

		const badge = document.createElement( 'span' );
		badge.className = `kk-track-library__badge ${ extraClass }`.trim();
		badge.textContent = text;
		return badge;

	}

	_describeTrack( track ) {

		if ( track.creatorName ) return `by ${ track.creatorName }`;
		if ( track.pieces != null ) return `${ track.pieces } pcs`;
		if ( track.source === 'official' ) return 'Built-in track';
		if ( track.source === 'spotlight' ) return 'Staff spotlight';
		return 'Saved track';

	}

	_describeDetail( track ) {

		if ( track.source === 'published' ) {

			return 'Your live published track. Use the actions here to manage the public link or reopen it in the editor.';

		}

		if ( track.source === 'spotlight' ) {

			return 'A staff-curated snapshot from the public publishing system.';

		}

		if ( track.source === 'official' ) {

			return 'An official Kart Kids track available to every player.';

		}

		return 'A playable track snapshot from your library. Save public tracks here before using them in party flow.';

	}

	_findTrackById( trackId ) {

		for ( const section of this._sections ) {

			const found = ( section.items || [] ).find( ( item ) => item.trackId === trackId );
			if ( found ) return found;

		}

		return null;

	}

	show() {}
	hide() {}

	dispose() {

		if ( this._root?.parentNode ) this._root.parentNode.removeChild( this._root );
		this._root = null;

	}

}

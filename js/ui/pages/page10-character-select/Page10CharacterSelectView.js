import { PageViewBase } from '../../core/PageViewBase.js';
import { CTAButton } from '../../components/CTAButton.js';
import { HeroPreviewPanel } from '../../components/HeroPreviewPanel.js';
import { ButtonIds } from '../../enums/ButtonIds.js';

const CAMERA_DEBUG_SLIDER_DEFS = Object.freeze( [
	Object.freeze( { id: 'lookTargetX', label: 'Look X', min: - 1.5, max: 1.5, step: 0.01 } ),
	Object.freeze( { id: 'lookTargetY', label: 'Look Y', min: - 1.5, max: 1.5, step: 0.01 } ),
	Object.freeze( { id: 'cameraOffsetX', label: 'Cam X', min: - 1.5, max: 1.5, step: 0.01 } ),
	Object.freeze( { id: 'cameraOffsetY', label: 'Cam Y', min: - 1.5, max: 1.5, step: 0.01 } ),
	Object.freeze( { id: 'cameraOffsetZ', label: 'Cam Z', min: - 3, max: 3, step: 0.01 } ),
] );

export class Page10CharacterSelectView extends PageViewBase {

	constructor( config = {} ) {

		super( 'page-character-select' );
		this._config = {
			showBackButton: true,
			showBrandHeader: true,
			showCameraDebugControls: false,
			rootAriaLabel: 'Character Page',
			eyebrowText: 'Garage Overlay',
			titleText: 'Character Page',
			sidebarCopy: 'Open one drawer at a time, swipe through the carousel items, dial in colors, and save when the draft looks right.',
			secondaryActionLabel: 'Cancel',
			secondaryActionAriaLabel: 'Discard character draft',
			secondaryActionMode: 'close',
			...config,
		};

		this._backBtn = null;
		this._categoryStack = null;
		this._previewPanel = null;
		this._cancelBtn = null;
		this._saveBtn = null;
		this._carouselScrollLeftByCategory = new Map();
		this._carouselInteractionCleanups = [];
		this._cameraDebugInputs = new Map();
		this._cameraDebugValueEls = new Map();
		this._cameraDebugReadoutEl = null;
		this._cameraDebugResetBtn = null;

		this._injectCSS();
		this._build();

	}

	_injectCSS() {

		if ( Page10CharacterSelectView._cssInjected ) return;
		Page10CharacterSelectView._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.page-character-select {
				display: grid;
				grid-template-rows: auto minmax( 0, 1fr ) auto;
				height: 100%;
				min-height: 100%;
				padding: 1.5rem;
				box-sizing: border-box;
				color: #f8fbff;
				gap: 1rem;
				overflow: hidden;
			}

			.page-character-select--no-header {
				grid-template-rows: minmax( 0, 1fr ) auto;
			}

			.page-character-select__header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 1rem;
			}

			.page-character-select__header--centered {
				justify-content: center;
			}

			.page-character-select__back-btn {
				display: inline-flex;
				align-items: center;
				gap: 0.55rem;
				border: 1px solid rgba( 255, 255, 255, 0.16 );
				border-radius: 999px;
				background: rgba( 255, 255, 255, 0.04 );
				color: #f8fbff;
				font: 700 0.8rem/1 var( --font-ui, sans-serif );
				letter-spacing: 0.12em;
				text-transform: uppercase;
				padding: 0.9rem 1.1rem;
				cursor: pointer;
			}

			.page-character-select__back-btn:hover {

				border-color: rgba( 255, 255, 255, 0.28 );
				background: rgba( 255, 255, 255, 0.08 );

			}

			.page-character-select__brand {
				display: flex;
				flex-direction: column;
				gap: 0.35rem;
				text-align: center;
				margin: 0 auto;
			}

			.page-character-select__eyebrow {
				font: 700 0.75rem/1 var( --font-ui, sans-serif );
				letter-spacing: 0.18em;
				text-transform: uppercase;
				color: #85efff;
			}

			.page-character-select__title {
				margin: 0;
				font: 900 clamp( 2rem, 4vw, 3.2rem )/0.95 var( --font-display, sans-serif );
				letter-spacing: 0.08em;
				text-transform: uppercase;
				color: #ffffff;
			}

			.page-character-select__content {
				display: grid;
				grid-template-columns: minmax( 18rem, 24rem ) minmax( 0, 1fr ) minmax( 16rem, 22rem );
				gap: 1.5rem;
				min-height: 0;
				align-items: stretch;
			}

			.page-character-select__panel {
				background: rgba( 10, 18, 28, 0.78 );
				border: 1px solid rgba( 255, 255, 255, 0.1 );
				border-radius: 1.4rem;
				box-shadow: 0 24px 60px rgba( 0, 0, 0, 0.28 );
				backdrop-filter: blur( 16px );
				min-height: 0;
				overflow: hidden;
			}

			.page-character-select__sidebar,
			.page-character-select__details {
				display: flex;
				flex-direction: column;
				gap: 1rem;
				padding: 1.25rem;
				min-height: 0;
				overflow: hidden;
			}

			.page-character-select__panel-label {
				font: 700 0.72rem/1 var( --font-ui, sans-serif );
				letter-spacing: 0.16em;
				text-transform: uppercase;
				color: #9bb4c9;
			}

			.page-character-select__panel-copy {
				margin: 0;
				font: 500 0.94rem/1.5 var( --font-ui, sans-serif );
				color: rgba( 248, 251, 255, 0.8 );
			}

			.page-character-select__category-stack {
				display: flex;
				flex-direction: column;
				gap: 0.75rem;
				overflow-y: auto;
				padding-right: 0.2rem;
			}

			.page-character-select__category {
				border-radius: 1rem;
				border: 1px solid rgba( 255, 255, 255, 0.08 );
				background:
					linear-gradient( 180deg, rgba( 255, 255, 255, 0.06 ), rgba( 255, 255, 255, 0.02 ) ),
					rgba( 255, 255, 255, 0.03 );
				overflow: hidden;
			}

			.page-character-select__category-toggle {
				width: 100%;
				border: none;
				background: transparent;
				color: inherit;
				display: grid;
				grid-template-columns: minmax( 0, 1fr ) auto;
				gap: 0.6rem;
				padding: 0.95rem 1rem;
				cursor: pointer;
				text-align: left;
				align-items: center;
			}

			.page-character-select__category-toggle:hover {
				background: rgba( 255, 255, 255, 0.04 );
			}

			.page-character-select__category-toggle[aria-expanded="true"] {
				background: rgba( 255, 255, 255, 0.04 );
			}

			.page-character-select__category-title {
				display: flex;
				flex-direction: column;
				gap: 0.22rem;
			}

			.page-character-select__category-name {
				font: 900 0.9rem/1 var( --font-display, sans-serif );
				letter-spacing: 0.08em;
				text-transform: uppercase;
			}

			.page-character-select__category-summary {
				font: 500 0.82rem/1.45 var( --font-ui, sans-serif );
				color: rgba( 248, 251, 255, 0.7 );
			}

			.page-character-select__category-chevron {
				font: 900 0.88rem/1 var( --font-display, sans-serif );
				letter-spacing: 0.08em;
				text-transform: uppercase;
				color: #85efff;
			}

			.page-character-select__category-drawer {
				display: grid;
				gap: 0.55rem;
				padding: 0 1rem 1rem;
				border-top: 1px solid rgba( 255, 255, 255, 0.06 );
			}

			.page-character-select__drawer-copy {
				font: 600 0.72rem/1.4 var( --font-ui, sans-serif );
				letter-spacing: 0.12em;
				text-transform: uppercase;
				color: rgba( 133, 239, 255, 0.72 );
				padding-top: 0.8rem;
			}

			.page-character-select__drawer-controls {
				display: grid;
				gap: 0.65rem;
			}

			.page-character-select__color-row {
				display: grid;
				grid-template-columns: minmax( 0, 1fr ) auto auto;
				gap: 0.65rem;
				align-items: center;
				padding: 0.8rem 0.9rem;
				border-radius: 0.9rem;
				border: 1px solid rgba( 255, 255, 255, 0.08 );
				background: rgba( 255, 255, 255, 0.03 );
			}

			.page-character-select__color-copy {
				display: flex;
				flex-direction: column;
				gap: 0.18rem;
				min-width: 0;
			}

			.page-character-select__color-label {
				font: 800 0.8rem/1 var( --font-ui, sans-serif );
				letter-spacing: 0.08em;
				text-transform: uppercase;
				color: #f8fbff;
			}

			.page-character-select__color-meta {
				font: 600 0.72rem/1.3 var( --font-ui, sans-serif );
				letter-spacing: 0.08em;
				text-transform: uppercase;
				color: rgba( 248, 251, 255, 0.58 );
			}

			.page-character-select__color-input {
				width: 2.8rem;
				height: 2.8rem;
				padding: 0;
				border: none;
				border-radius: 0.7rem;
				background: transparent;
				cursor: pointer;
			}

			.page-character-select__color-reset {
				border: 1px solid rgba( 255, 255, 255, 0.12 );
				border-radius: 999px;
				background: rgba( 255, 255, 255, 0.04 );
				color: #f8fbff;
				font: 700 0.7rem/1 var( --font-ui, sans-serif );
				letter-spacing: 0.12em;
				text-transform: uppercase;
				padding: 0.75rem 0.95rem;
				cursor: pointer;
			}

			.page-character-select__color-reset:hover {
				border-color: rgba( 255, 255, 255, 0.24 );
				background: rgba( 255, 255, 255, 0.08 );
			}

			.page-character-select__carousel {
				display: grid;
				grid-auto-flow: column;
				grid-auto-columns: minmax( 8.8rem, 9.6rem );
				gap: 0.7rem;
				overflow-x: auto;
				scroll-snap-type: x proximity;
				padding-bottom: 0.2rem;
				touch-action: none;
				user-select: none;
				cursor: grab;
				overscroll-behavior-x: contain;
				scrollbar-width: thin;
				scrollbar-color: rgba( 133, 239, 255, 0.45 ) rgba( 255, 255, 255, 0.06 );
			}

			.page-character-select__carousel::-webkit-scrollbar {
				height: 0.42rem;
			}

			.page-character-select__carousel::-webkit-scrollbar-track {
				background: rgba( 255, 255, 255, 0.06 );
				border-radius: 999px;
			}

			.page-character-select__carousel::-webkit-scrollbar-thumb {
				background: rgba( 133, 239, 255, 0.42 );
				border-radius: 999px;
			}

			.page-character-select__carousel--dragging {
				cursor: grabbing;
				scroll-snap-type: none;
			}

			.page-character-select__item {
				scroll-snap-align: start;
				display: flex;
				flex-direction: column;
				align-items: flex-start;
				justify-content: flex-end;
				gap: 0.35rem;
				min-height: 6.4rem;
				padding: 0.95rem;
				border: 1px solid rgba( 255, 255, 255, 0.12 );
				border-radius: 1rem;
				background:
					linear-gradient( 180deg, rgba( 255, 255, 255, 0.07 ), rgba( 255, 255, 255, 0.02 ) ),
					rgba( 255, 255, 255, 0.03 );
				color: #f8fbff;
				text-align: left;
				cursor: pointer;
				transition: transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
			}

			.page-character-select__item:hover {
				transform: translateY( - 2px );
				border-color: rgba( 255, 255, 255, 0.28 );
			}

			.page-character-select__item--active {
				border-color: rgba( 0, 212, 232, 0.85 );
				box-shadow: 0 0 0 1px rgba( 0, 212, 232, 0.2 ), 0 14px 30px rgba( 0, 212, 232, 0.14 );
				background:
					linear-gradient( 160deg, rgba( 0, 212, 232, 0.22 ), rgba( 255, 122, 61, 0.12 ) ),
					rgba( 255, 255, 255, 0.04 );
			}

			.page-character-select__item--saved {
				border-style: solid;
			}

			.page-character-select__item-name {
				font: 900 0.92rem/1.15 var( --font-display, sans-serif );
				letter-spacing: 0.04em;
				text-transform: uppercase;
			}

			.page-character-select__item-meta {
				font: 600 0.74rem/1.35 var( --font-ui, sans-serif );
				letter-spacing: 0.1em;
				text-transform: uppercase;
				color: rgba( 248, 251, 255, 0.62 );
			}

			.page-character-select__preview {
				display: grid;
				grid-template-rows: auto 1fr;
				padding: 1.25rem;
				gap: 1rem;
				min-height: 0;
			}

			.page-character-select__preview-card {
				display: flex;
				flex-direction: column;
				gap: 0.85rem;
				padding: 0.9rem;
				border-radius: 1.2rem;
				background: linear-gradient( 180deg, rgba( 255, 255, 255, 0.08 ), rgba( 255, 255, 255, 0.03 ) );
				border: 1px solid rgba( 255, 255, 255, 0.08 );
				min-height: 0;
			}

			.page-character-select__preview-title {
				display: flex;
				flex-direction: column;
				gap: 0.3rem;
			}

			.page-character-select__preview-selected {
				font: 900 clamp( 1.2rem, 2vw, 1.9rem )/1 var( --font-display, sans-serif );
				letter-spacing: 0.06em;
				text-transform: uppercase;
			}

			.page-character-select__preview-copy {
				margin: 0;
				font: 500 0.95rem/1.5 var( --font-ui, sans-serif );
				color: rgba( 248, 251, 255, 0.76 );
			}

			.page-character-select__hero-wrap {
				display: flex;
				min-height: 0;
			}

			.page-character-select__details-grid {
				display: grid;
				gap: 0.9rem;
				min-height: 0;
				overflow-y: auto;
				padding-right: 0.2rem;
			}

			.page-character-select__detail-card {
				padding: 0.95rem 1rem;
				border-radius: 1rem;
				background: rgba( 255, 255, 255, 0.04 );
				border: 1px solid rgba( 255, 255, 255, 0.08 );
			}

			.page-character-select__detail-label {
				display: block;
				margin-bottom: 0.35rem;
				font: 700 0.72rem/1 var( --font-ui, sans-serif );
				letter-spacing: 0.15em;
				text-transform: uppercase;
				color: #9bb4c9;
			}

			.page-character-select__detail-value {
				font: 800 0.95rem/1.35 var( --font-display, sans-serif );
				letter-spacing: 0.05em;
				text-transform: uppercase;
				color: #ffffff;
			}

			.page-character-select__detail-copy {
				font: 500 0.92rem/1.55 var( --font-ui, sans-serif );
				color: rgba( 248, 251, 255, 0.78 );
			}

			.page-character-select__camera-debug-copy {
				margin-bottom: 0.85rem;
			}

			.page-character-select__camera-debug-grid {
				display: grid;
				gap: 0.7rem;
			}

			.page-character-select__camera-debug-row {
				display: grid;
				grid-template-columns: 4.4rem minmax( 0, 1fr ) 3.7rem;
				gap: 0.65rem;
				align-items: center;
			}

			.page-character-select__camera-debug-name {
				font: 700 0.75rem/1 var( --font-ui, sans-serif );
				letter-spacing: 0.12em;
				text-transform: uppercase;
				color: rgba( 248, 251, 255, 0.72 );
			}

			.page-character-select__camera-debug-slider {
				width: 100%;
				accent-color: #85efff;
			}

			.page-character-select__camera-debug-value {
				font: 700 0.74rem/1 var( --font-ui, sans-serif );
				letter-spacing: 0.06em;
				text-align: right;
				color: #f8fbff;
			}

			.page-character-select__camera-debug-actions {
				display: flex;
				justify-content: flex-end;
				margin-top: 0.85rem;
			}

			.page-character-select__camera-debug-reset {
				border: 1px solid rgba( 255, 255, 255, 0.12 );
				border-radius: 999px;
				background: rgba( 255, 255, 255, 0.04 );
				color: #f8fbff;
				font: 700 0.7rem/1 var( --font-ui, sans-serif );
				letter-spacing: 0.12em;
				text-transform: uppercase;
				padding: 0.72rem 0.95rem;
				cursor: pointer;
			}

			.page-character-select__camera-debug-reset:hover {
				border-color: rgba( 255, 255, 255, 0.24 );
				background: rgba( 255, 255, 255, 0.08 );
			}

			.page-character-select__camera-debug-readout {
				margin-top: 0.9rem;
				font: 600 0.74rem/1.5 var( --font-ui, sans-serif );
				letter-spacing: 0.04em;
				color: rgba( 133, 239, 255, 0.82 );
				word-break: break-word;
			}

			.page-character-select__footer {
				display: flex;
				justify-content: flex-end;
				gap: 0.9rem;
				align-items: center;
				padding: 0.9rem 1rem;
				border: 1px solid rgba( 255, 255, 255, 0.1 );
				border-radius: 1.2rem;
				background: rgba( 10, 18, 28, 0.78 );
				box-shadow: 0 18px 40px rgba( 0, 0, 0, 0.22 );
				backdrop-filter: blur( 16px );
			}

			.page-character-select__footer .kk-cta-button {
				min-width: 11rem;
			}

			@media ( max-width: 1180px ) {
				.page-character-select__content {
					grid-template-columns: 1fr;
				}
			}

			@media ( max-width: 640px ) {
				.page-character-select {
					padding: 1rem;
				}

				.page-character-select__header {
					flex-wrap: wrap;
					justify-content: center;
				}

				.page-character-select__footer {
					flex-direction: column-reverse;
				}

				.page-character-select__footer .kk-cta-button {
					width: 100%;
				}
			}
		`;
		document.head.appendChild( style );

	}

	_build() {

		const root = this._root;
		root.setAttribute( 'role', 'main' );
		root.setAttribute( 'aria-label', this._config.rootAriaLabel );

		const shouldRenderHeader = this._config.showBackButton || this._config.showBrandHeader;
		root.classList.toggle( 'page-character-select--no-header', ! shouldRenderHeader );
		if ( shouldRenderHeader ) {

			const header = document.createElement( 'div' );
			header.className = 'page-character-select__header';
			if ( ! this._config.showBackButton ) {

				header.classList.add( 'page-character-select__header--centered' );

			}

			if ( this._config.showBackButton ) {

				this._backBtn = document.createElement( 'button' );
				this._backBtn.type = 'button';
				this._backBtn.className = 'page-character-select__back-btn';
				this._backBtn.setAttribute( 'data-action', ButtonIds.GLOBAL_BACK );
				this._backBtn.innerHTML = `
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"
						stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<polyline points="15 18 9 12 15 6"/>
					</svg>
					<span>Back</span>
				`;
				header.appendChild( this._backBtn );

			}

			if ( this._config.showBrandHeader ) {

				const brand = document.createElement( 'div' );
				brand.className = 'page-character-select__brand';

				const eyebrow = document.createElement( 'div' );
				eyebrow.className = 'page-character-select__eyebrow';
				eyebrow.textContent = this._config.eyebrowText;
				brand.appendChild( eyebrow );

				const title = document.createElement( 'h1' );
				title.className = 'page-character-select__title';
				title.textContent = this._config.titleText;
				brand.appendChild( title );

				header.appendChild( brand );

			}

			root.appendChild( header );

		}

		const content = document.createElement( 'div' );
		content.className = 'page-character-select__content';

		const sidebar = document.createElement( 'section' );
		sidebar.className = 'page-character-select__panel page-character-select__sidebar';

		const sidebarLabel = document.createElement( 'div' );
		sidebarLabel.className = 'page-character-select__panel-label';
		sidebarLabel.textContent = 'Customizer';
		sidebar.appendChild( sidebarLabel );

		const sidebarCopy = document.createElement( 'p' );
		sidebarCopy.className = 'page-character-select__panel-copy';
		sidebarCopy.textContent = this._config.sidebarCopy;
		sidebar.appendChild( sidebarCopy );

		this._categoryStack = document.createElement( 'div' );
		this._categoryStack.className = 'page-character-select__category-stack';
		sidebar.appendChild( this._categoryStack );
		content.appendChild( sidebar );

		const previewPanel = document.createElement( 'section' );
		previewPanel.className = 'page-character-select__panel page-character-select__preview';

		const previewTitle = document.createElement( 'div' );
		previewTitle.className = 'page-character-select__preview-title';

		const previewLabel = document.createElement( 'div' );
		previewLabel.className = 'page-character-select__panel-label';
		previewLabel.textContent = 'Live Preview';
		previewTitle.appendChild( previewLabel );

		const selectedValue = document.createElement( 'div' );
		selectedValue.className = 'page-character-select__preview-selected';
		previewTitle.appendChild( selectedValue );
		this._registerSection( 'selectedValue', selectedValue );

		const previewCopy = document.createElement( 'p' );
		previewCopy.className = 'page-character-select__preview-copy';
		previewTitle.appendChild( previewCopy );
		this._registerSection( 'previewCopy', previewCopy );

		previewPanel.appendChild( previewTitle );

		const heroWrap = document.createElement( 'div' );
		heroWrap.className = 'page-character-select__hero-wrap page-character-select__preview-card';

		this._previewPanel = new HeroPreviewPanel( {
			sceneId: 'character_page_preview',
			ariaLabel: 'Character preview',
			aspectRatio: '4/5',
			loading: true,
		} );
		heroWrap.appendChild( this._previewPanel.el );
		previewPanel.appendChild( heroWrap );
		content.appendChild( previewPanel );

		const detailsPanel = document.createElement( 'section' );
		detailsPanel.className = 'page-character-select__panel page-character-select__details';

		const detailsLabel = document.createElement( 'div' );
		detailsLabel.className = 'page-character-select__panel-label';
		detailsLabel.textContent = 'Save State';
		detailsPanel.appendChild( detailsLabel );

		const detailsGrid = document.createElement( 'div' );
		detailsGrid.className = 'page-character-select__details-grid';

		detailsGrid.appendChild( this._buildDetailCard( 'Saved', 'savedValue' ) );
		detailsGrid.appendChild( this._buildDetailCard( 'Draft', 'draftValue' ) );
		detailsGrid.appendChild( this._buildDetailCard( 'Status', 'statusValue' ) );

		const summaryCard = document.createElement( 'div' );
		summaryCard.className = 'page-character-select__detail-card';

		const summaryLabel = document.createElement( 'span' );
		summaryLabel.className = 'page-character-select__detail-label';
		summaryLabel.textContent = 'Current Style';
		summaryCard.appendChild( summaryLabel );

		const summaryCopy = document.createElement( 'div' );
		summaryCopy.className = 'page-character-select__detail-copy';
		summaryCard.appendChild( summaryCopy );
		this._registerSection( 'summaryCopy', summaryCopy );

		detailsGrid.appendChild( summaryCard );

		if ( this._config.showCameraDebugControls ) {

			detailsGrid.appendChild( this._buildCameraDebugCard() );

		}

		detailsPanel.appendChild( detailsGrid );
		content.appendChild( detailsPanel );

		root.appendChild( content );

		const footer = document.createElement( 'div' );
		footer.className = 'page-character-select__footer';

		this._cancelBtn = new CTAButton( {
			label: this._config.secondaryActionLabel,
			variant: 'ghost',
			ariaLabel: this._config.secondaryActionAriaLabel,
		} );
		footer.appendChild( this._cancelBtn.el );

		this._saveBtn = new CTAButton( {
			label: 'Save',
			variant: 'primary',
			actionId: ButtonIds.CHARACTER_SELECT_CONFIRM,
			ariaLabel: 'Save character draft',
		} );
		footer.appendChild( this._saveBtn.el );

		root.appendChild( footer );

	}

	_buildDetailCard( label, sectionName ) {

		const card = document.createElement( 'div' );
		card.className = 'page-character-select__detail-card';

		const cardLabel = document.createElement( 'span' );
		cardLabel.className = 'page-character-select__detail-label';
		cardLabel.textContent = label;
		card.appendChild( cardLabel );

		const cardValue = document.createElement( 'div' );
		cardValue.className = 'page-character-select__detail-value';
		card.appendChild( cardValue );
		this._registerSection( sectionName, cardValue );

		return card;

	}

	_buildCameraDebugCard() {

		const card = document.createElement( 'div' );
		card.className = 'page-character-select__detail-card';

		const label = document.createElement( 'span' );
		label.className = 'page-character-select__detail-label';
		label.textContent = 'Camera Debug';
		card.appendChild( label );

		const copy = document.createElement( 'div' );
		copy.className = 'page-character-select__detail-copy page-character-select__camera-debug-copy';
		copy.textContent = 'Use these live offsets to center the character preview, then send the values back.';
		card.appendChild( copy );

		const grid = document.createElement( 'div' );
		grid.className = 'page-character-select__camera-debug-grid';

		for ( const sliderDef of CAMERA_DEBUG_SLIDER_DEFS ) {

			const row = document.createElement( 'label' );
			row.className = 'page-character-select__camera-debug-row';

			const name = document.createElement( 'span' );
			name.className = 'page-character-select__camera-debug-name';
			name.textContent = sliderDef.label;
			row.appendChild( name );

			const input = document.createElement( 'input' );
			input.type = 'range';
			input.className = 'page-character-select__camera-debug-slider';
			input.min = String( sliderDef.min );
			input.max = String( sliderDef.max );
			input.step = String( sliderDef.step );
			input.value = '0';
			input.setAttribute( 'aria-label', `${ sliderDef.label } camera debug slider` );
			input.addEventListener( 'input', () => {

				this._root.dispatchEvent( new CustomEvent( 'kk:character:camera-debug', {
					bubbles: true,
					composed: true,
					detail: {
						controlId: sliderDef.id,
						value: Number( input.value ),
					},
				} ) );

			} );
			row.appendChild( input );
			this._cameraDebugInputs.set( sliderDef.id, input );

			const value = document.createElement( 'span' );
			value.className = 'page-character-select__camera-debug-value';
			value.textContent = '0.00';
			row.appendChild( value );
			this._cameraDebugValueEls.set( sliderDef.id, value );

			grid.appendChild( row );

		}

		card.appendChild( grid );

		const actions = document.createElement( 'div' );
		actions.className = 'page-character-select__camera-debug-actions';

		this._cameraDebugResetBtn = document.createElement( 'button' );
		this._cameraDebugResetBtn.type = 'button';
		this._cameraDebugResetBtn.className = 'page-character-select__camera-debug-reset';
		this._cameraDebugResetBtn.textContent = 'Reset Camera';
		this._cameraDebugResetBtn.addEventListener( 'click', () => {

			this._root.dispatchEvent( new CustomEvent( 'kk:character:camera-debug-reset', {
				bubbles: true,
				composed: true,
			} ) );

		} );
		actions.appendChild( this._cameraDebugResetBtn );
		card.appendChild( actions );

		this._cameraDebugReadoutEl = document.createElement( 'div' );
		this._cameraDebugReadoutEl.className = 'page-character-select__camera-debug-readout';
		card.appendChild( this._cameraDebugReadoutEl );

		this.setCameraDebugState( {} );

		return card;

	}

	_onMounted() {

		( this._categoryStack?.querySelector( '.page-character-select__category-toggle' ) || this._backBtn )?.focus( { preventScroll: true } );

	}

	renderCategories( categories ) {

		if ( ! this._categoryStack ) return;
		this._rememberCarouselScrollPositions();
		this._teardownCarouselInteractions();
		this._categoryStack.innerHTML = '';

		for ( const category of categories ) {

			const section = document.createElement( 'section' );
			section.className = 'page-character-select__category';

			const toggle = document.createElement( 'button' );
			toggle.type = 'button';
			toggle.className = 'page-character-select__category-toggle';
			toggle.setAttribute( 'aria-expanded', String( category.isOpen ) );
			toggle.setAttribute( 'aria-label', `${ category.label } category` );
			toggle.addEventListener( 'click', () => {

				this._root.dispatchEvent( new CustomEvent( 'kk:character:category', {
					bubbles: true,
					composed: true,
					detail: { categoryId: category.id },
				} ) );

			} );

			const titleWrap = document.createElement( 'span' );
			titleWrap.className = 'page-character-select__category-title';

			const title = document.createElement( 'span' );
			title.className = 'page-character-select__category-name';
			title.textContent = category.label;
			titleWrap.appendChild( title );

			const summary = document.createElement( 'span' );
			summary.className = 'page-character-select__category-summary';
			summary.textContent = category.summary;
			titleWrap.appendChild( summary );
			toggle.appendChild( titleWrap );

			const chevron = document.createElement( 'span' );
			chevron.className = 'page-character-select__category-chevron';
			chevron.textContent = category.isOpen ? 'Close' : 'Open';
			toggle.appendChild( chevron );

			section.appendChild( toggle );

			if ( category.isOpen ) {

				const drawer = document.createElement( 'div' );
				drawer.className = 'page-character-select__category-drawer';

				let carousel = null;
				if ( Array.isArray( category.items ) && category.items.length > 0 ) {

					const drawerCopy = document.createElement( 'div' );
					drawerCopy.className = 'page-character-select__drawer-copy';
					drawerCopy.textContent = 'Swipe, drag, or mouse-wheel to browse this category.';
					drawer.appendChild( drawerCopy );

					carousel = document.createElement( 'div' );
					carousel.className = 'page-character-select__carousel';
					carousel.dataset.categoryId = category.id;

					for ( const item of category.items ) {

						const dispatchItemActivate = () => {

							this._rememberCarouselScrollPositions();
							this._root.dispatchEvent( new CustomEvent( 'kk:character:item', {
								bubbles: true,
								composed: true,
								detail: {
									categoryId: category.id,
									itemId: item.id,
								},
							} ) );

						};

						const button = document.createElement( 'button' );
						button.type = 'button';
						button.className = 'page-character-select__item';
						button.classList.toggle( 'page-character-select__item--active', !! item.active );
						button.classList.toggle( 'page-character-select__item--saved', !! item.savedActive );
						button.setAttribute( 'aria-pressed', String( !! item.active ) );
						button.setAttribute( 'aria-label', `${ item.label } ${ item.metaText }` );
						button.addEventListener( 'pointerup', ( event ) => {

							if ( event.button !== undefined && event.button !== 0 ) return;

							const interactionState = carousel._kkInteractionState;
							if ( interactionState?.dragged ) return;
							if ( performance.now() < ( interactionState?.suppressClickUntil || 0 ) ) return;

							event.preventDefault();
							dispatchItemActivate();

						} );
						button.addEventListener( 'click', ( event ) => {

							if ( event.detail !== 0 ) return;
							dispatchItemActivate();

						} );

						const itemName = document.createElement( 'div' );
						itemName.className = 'page-character-select__item-name';
						itemName.textContent = item.label;
						button.appendChild( itemName );

						const itemMeta = document.createElement( 'div' );
						itemMeta.className = 'page-character-select__item-meta';
						itemMeta.textContent = item.metaText;
						button.appendChild( itemMeta );

						carousel.appendChild( button );

					}

					drawer.appendChild( carousel );

				}

				if ( Array.isArray( category.colorControls ) && category.colorControls.length > 0 ) {

					const controls = document.createElement( 'div' );
					controls.className = 'page-character-select__drawer-controls';

					for ( const control of category.colorControls ) {

						const row = document.createElement( 'div' );
						row.className = 'page-character-select__color-row';

						const copy = document.createElement( 'div' );
						copy.className = 'page-character-select__color-copy';

						const label = document.createElement( 'div' );
						label.className = 'page-character-select__color-label';
						label.textContent = control.label;
						copy.appendChild( label );

						const meta = document.createElement( 'div' );
						meta.className = 'page-character-select__color-meta';
						meta.textContent = control.isCustom ? 'Custom Color' : 'Default Color';
						copy.appendChild( meta );
						row.appendChild( copy );

						const input = document.createElement( 'input' );
						input.type = 'color';
						input.className = 'page-character-select__color-input';
						input.value = control.value;
						input.setAttribute( 'aria-label', `${ control.label } picker` );
						input.addEventListener( 'input', () => {

							this._rememberCarouselScrollPositions();
							this._root.dispatchEvent( new CustomEvent( 'kk:character:color', {
								bubbles: true,
								composed: true,
								detail: {
									categoryId: category.id,
									controlId: control.id,
									value: input.value,
								},
							} ) );

						} );
						row.appendChild( input );

						const reset = document.createElement( 'button' );
						reset.type = 'button';
						reset.className = 'page-character-select__color-reset';
						reset.textContent = 'Reset';
						reset.addEventListener( 'click', () => {

							this._rememberCarouselScrollPositions();
							this._root.dispatchEvent( new CustomEvent( 'kk:character:color', {
								bubbles: true,
								composed: true,
								detail: {
									categoryId: category.id,
									controlId: control.id,
									value: control.resetValue ?? '',
								},
							} ) );

						} );
						row.appendChild( reset );
						controls.appendChild( row );

					}

					drawer.appendChild( controls );

				}

				section.appendChild( drawer );
				if ( carousel ) {

					this._setupCarouselInteractions( category.id, carousel );
					this._restoreCarouselScrollPosition( category.id, carousel );

				}

			}

			this._categoryStack.appendChild( section );

		}

	}

	setSelectionState( { selectedLabel, savedLabel, dirty, summaryText } ) {

		this._previewPanel?.setCaption( selectedLabel.toUpperCase() );
		this._previewPanel?.setAriaLabel( `${ selectedLabel } preview` );

		const selectedValue = this.getSection( 'selectedValue' );
		if ( selectedValue ) selectedValue.textContent = selectedLabel;

		const previewCopy = this.getSection( 'previewCopy' );
		if ( previewCopy ) {

			previewCopy.textContent = dirty
				? 'Drag the preview to rotate, pinch or mouse-wheel to zoom, and only the selected gear should remain visible.'
				: 'This draft matches the version already saved on your driver. Drag to rotate and use pinch or mouse-wheel to zoom.';

		}

		const savedValue = this.getSection( 'savedValue' );
		if ( savedValue ) savedValue.textContent = savedLabel;

		const draftValue = this.getSection( 'draftValue' );
		if ( draftValue ) draftValue.textContent = selectedLabel;

		const statusValue = this.getSection( 'statusValue' );
		if ( statusValue ) statusValue.textContent = dirty ? 'Unsaved Changes' : 'Ready To Race';

		const summaryCopy = this.getSection( 'summaryCopy' );
		if ( summaryCopy ) summaryCopy.textContent = summaryText;

		this._saveBtn?.setLabel( dirty ? 'Save' : 'Saved' );
		this._saveBtn?.setDisabled( ! dirty );

		if ( this._config.secondaryActionMode === 'reset' ) {

			this._cancelBtn?.setDisabled( ! dirty );

		}

	}

	setPreviewLoading( loading ) {

		this._previewPanel?.setLoading( loading );

	}

	setCameraDebugState( cameraDebugState = {} ) {

		if ( this._cameraDebugInputs.size === 0 ) return;

		for ( const sliderDef of CAMERA_DEBUG_SLIDER_DEFS ) {

			const value = Number( cameraDebugState?.[ sliderDef.id ] );
			const nextValue = Number.isFinite( value ) ? value : 0;
			const input = this._cameraDebugInputs.get( sliderDef.id );
			const valueEl = this._cameraDebugValueEls.get( sliderDef.id );

			if ( input ) input.value = String( nextValue );
			if ( valueEl ) valueEl.textContent = nextValue.toFixed( 2 );

		}

		if ( this._cameraDebugReadoutEl ) {

			this._cameraDebugReadoutEl.textContent = CAMERA_DEBUG_SLIDER_DEFS
				.map( ( sliderDef ) => {

					const rawValue = Number( cameraDebugState?.[ sliderDef.id ] );
					const nextValue = Number.isFinite( rawValue ) ? rawValue : 0;
					return `${ sliderDef.label }: ${ nextValue.toFixed( 2 ) }`;

				} )
				.join( ' | ' );

		}

	}

	get backBtn() {

		return this._backBtn;

	}

	get categoryStack() {

		return this._categoryStack;

	}

	get cancelBtn() {

		return this._cancelBtn;

	}

	get saveBtn() {

		return this._saveBtn;

	}

	get previewPanel() {

		return this._previewPanel;

	}

	_rememberCarouselScrollPositions() {

		for ( const carousel of this._categoryStack?.querySelectorAll( '.page-character-select__carousel[data-category-id]' ) || [] ) {

			this._carouselScrollLeftByCategory.set( carousel.dataset.categoryId, carousel.scrollLeft || 0 );

		}

	}

	_restoreCarouselScrollPosition( categoryId, carousel ) {

		if ( ! carousel ) return;

		const applySavedScroll = () => {

			if ( ! carousel.isConnected ) return;

			const scrollLeft = this._carouselScrollLeftByCategory.get( categoryId ) || 0;
			carousel.scrollLeft = scrollLeft;
			this._carouselScrollLeftByCategory.set( categoryId, carousel.scrollLeft || scrollLeft );

		};

		applySavedScroll();
		requestAnimationFrame( applySavedScroll );

	}

	_teardownCarouselInteractions() {

		for ( const cleanup of this._carouselInteractionCleanups ) {

			cleanup();

		}

		this._carouselInteractionCleanups = [];

	}

	_setupCarouselInteractions( categoryId, carousel ) {

		let activePointerId = null;
		let dragStartX = 0;
		let dragStartScrollLeft = 0;
		let lastX = 0;
		let lastTime = 0;
		let velocity = 0;
		let suppressClickUntil = 0;
		let inertiaFrameId = 0;
		let dragged = false;
		const interactionState = {
			dragged: false,
			suppressClickUntil: 0,
		};
		carousel._kkInteractionState = interactionState;

		const stopInertia = () => {

			if ( ! inertiaFrameId ) return;
			cancelAnimationFrame( inertiaFrameId );
			inertiaFrameId = 0;

		};

		const rememberScroll = () => {

			this._carouselScrollLeftByCategory.set( categoryId, carousel.scrollLeft || 0 );

		};

		const runInertia = () => {

			stopInertia();

			const tick = () => {

				velocity *= 0.94;
				if ( Math.abs( velocity ) < 0.18 ) {

					inertiaFrameId = 0;
					rememberScroll();
					return;

				}

				carousel.scrollLeft += velocity;
				rememberScroll();
				inertiaFrameId = requestAnimationFrame( tick );

			};

			inertiaFrameId = requestAnimationFrame( tick );

		};

		const endDrag = ( pointerId ) => {

			if ( activePointerId !== pointerId ) return;

			activePointerId = null;
			carousel.classList.remove( 'page-character-select__carousel--dragging' );
			if ( dragged ) {

				suppressClickUntil = performance.now() + 180;
				interactionState.suppressClickUntil = suppressClickUntil;
				runInertia();

			} else {

				suppressClickUntil = 0;
				interactionState.suppressClickUntil = 0;

			}

			dragged = false;
			interactionState.dragged = false;

		};

		const handlePointerDown = ( event ) => {

			if ( event.button !== undefined && event.button !== 0 ) return;

			stopInertia();
			activePointerId = event.pointerId;
			dragStartX = event.clientX;
			dragStartScrollLeft = carousel.scrollLeft;
			lastX = event.clientX;
			lastTime = performance.now();
			velocity = 0;
			dragged = false;
			suppressClickUntil = 0;
			interactionState.dragged = false;
			interactionState.suppressClickUntil = 0;

		};

		const handlePointerMove = ( event ) => {

			if ( activePointerId !== event.pointerId ) return;

			const now = performance.now();
			const dx = event.clientX - dragStartX;
			const stepDx = event.clientX - lastX;
			const dt = Math.max( now - lastTime, 8 );

			if ( ! dragged ) {

				if ( Math.abs( dx ) <= 6 ) return;
				dragged = true;
				interactionState.dragged = true;
				carousel.classList.add( 'page-character-select__carousel--dragging' );
				carousel.setPointerCapture?.( event.pointerId );

			}

			carousel.scrollLeft = dragStartScrollLeft - dx * 1.35;
			velocity = - stepDx * 0.92;
			lastX = event.clientX;
			lastTime = now;
			rememberScroll();
			event.preventDefault();

		};

		const handlePointerUp = ( event ) => {

			if ( activePointerId !== event.pointerId ) return;
			if ( dragged ) carousel.releasePointerCapture?.( event.pointerId );
			endDrag( event.pointerId );

		};

		const handlePointerCancel = ( event ) => {

			if ( activePointerId !== event.pointerId ) return;
			endDrag( event.pointerId );

		};

		const handleWheel = ( event ) => {

			const delta = Math.abs( event.deltaX ) > Math.abs( event.deltaY ) ? event.deltaX : event.deltaY;
			if ( delta === 0 ) return;

			event.preventDefault();
			stopInertia();
			carousel.scrollLeft += delta * 1.08;
			rememberScroll();

		};

		const handleClickCapture = ( event ) => {

			if ( performance.now() >= suppressClickUntil ) return;
			event.preventDefault();
			event.stopPropagation();

		};

		const handleScroll = () => rememberScroll();

		carousel.addEventListener( 'pointerdown', handlePointerDown );
		carousel.addEventListener( 'pointermove', handlePointerMove );
		carousel.addEventListener( 'pointerup', handlePointerUp );
		carousel.addEventListener( 'pointercancel', handlePointerCancel );
		carousel.addEventListener( 'wheel', handleWheel, { passive: false } );
		carousel.addEventListener( 'click', handleClickCapture, true );
		carousel.addEventListener( 'scroll', handleScroll, { passive: true } );

		this._carouselInteractionCleanups.push( () => {

			stopInertia();
			carousel.removeEventListener( 'pointerdown', handlePointerDown );
			carousel.removeEventListener( 'pointermove', handlePointerMove );
			carousel.removeEventListener( 'pointerup', handlePointerUp );
			carousel.removeEventListener( 'pointercancel', handlePointerCancel );
			carousel.removeEventListener( 'wheel', handleWheel );
			carousel.removeEventListener( 'click', handleClickCapture, true );
			carousel.removeEventListener( 'scroll', handleScroll );
			delete carousel._kkInteractionState;

		} );

	}

	dispose() {

		this._rememberCarouselScrollPositions();
		this._teardownCarouselInteractions();
		this._previewPanel?.dispose();
		this._previewPanel = null;
		this._cancelBtn?.dispose();
		this._saveBtn?.dispose();
		this._cancelBtn = null;
		this._saveBtn = null;
		this._backBtn = null;
		this._categoryStack = null;
		this._carouselScrollLeftByCategory.clear();
		this._cameraDebugInputs.clear();
		this._cameraDebugValueEls.clear();
		this._cameraDebugReadoutEl = null;
		this._cameraDebugResetBtn = null;

		super.dispose();

	}

}

Page10CharacterSelectView._cssInjected = false;

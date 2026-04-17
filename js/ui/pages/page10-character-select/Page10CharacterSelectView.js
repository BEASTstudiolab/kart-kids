import { PageViewBase } from '../../core/PageViewBase.js';
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
			showEmbeddedPreview: false,
			surfaceVariant: 'default',
			rootAriaLabel: 'Character Page',
			eyebrowText: 'Garage Overlay',
			titleText: 'Character Page',
			sidebarLabelText: 'Customizer',
			sidebarTitleText: '',
			sidebarCopy: 'Tune suit, skin, masks, and gear here. Selections apply instantly to your driver.',
			...config,
		};

		this._backBtn = null;
		this._categoryTabStrip = null;
		this._categoryStack = null;
		this._previewPanel = null;
		this._cameraDebugInputs = new Map();
		this._cameraDebugValueEls = new Map();
		this._cameraDebugReadoutEl = null;
		this._cameraDebugPoseEl = null;
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
				grid-template-rows: auto minmax( 0, 1fr );
				height: 100%;
				min-height: 100%;
				padding: 1.5rem;
				box-sizing: border-box;
				color: #f8fbff;
				gap: 1rem;
				overflow: hidden;
			}

			.page-character-select--no-header {
				grid-template-rows: minmax( 0, 1fr );
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
				grid-template-columns: minmax( 20rem, 30rem ) minmax( 0, 1fr );
				gap: 1.5rem;
				min-height: 0;
				align-items: start;
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

			.page-character-select__sidebar {
				display: flex;
				flex-direction: column;
				gap: 1rem;
				padding: 1.25rem;
				min-height: min( 42rem, 100% );
				max-height: 100%;
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

			.page-character-select__panel-title {
				margin: 0;
				font: 900 1.45rem/1 var( --font-display, sans-serif );
				letter-spacing: 0.08em;
				text-transform: uppercase;
				color: #ffffff;
			}

			.page-character-select__category-tabs {
				display: grid;
				grid-template-columns: repeat( 3, minmax( 0, 1fr ) );
				gap: 0.55rem;
			}

			.page-character-select__category-tab {
				border: 1px solid rgba( 255, 255, 255, 0.1 );
				border-radius: 0.95rem;
				background: rgba( 255, 255, 255, 0.04 );
				color: #f8fbff;
				font: 800 0.76rem/1.2 var( --font-ui, sans-serif );
				letter-spacing: 0.08em;
				text-transform: uppercase;
				padding: 0.78rem 0.7rem;
				cursor: pointer;
				transition: border-color 150ms ease, background 150ms ease, transform 150ms ease;
			}

			.page-character-select__category-tab:hover {
				border-color: rgba( 255, 255, 255, 0.24 );
				background: rgba( 255, 255, 255, 0.08 );
				transform: translateY( - 1px );
			}

			.page-character-select__category-tab--active {
				border-color: rgba( 0, 212, 232, 0.85 );
				background:
					linear-gradient( 160deg, rgba( 0, 212, 232, 0.24 ), rgba( 255, 122, 61, 0.1 ) ),
					rgba( 255, 255, 255, 0.06 );
				box-shadow: 0 0 0 1px rgba( 0, 212, 232, 0.18 );
			}

			.page-character-select__category-stack {
				display: flex;
				flex-direction: column;
				flex: 1 1 auto;
				gap: 0.9rem;
				min-height: 0;
				overflow-y: auto;
				padding-right: 0.15rem;
			}

			.page-character-select__category-panel {
				display: grid;
				gap: 0.9rem;
			}

			.page-character-select__category-panel-head {
				display: grid;
				gap: 0.3rem;
			}

			.page-character-select__category-panel-title {
				font: 900 1.05rem/1 var( --font-display, sans-serif );
				letter-spacing: 0.08em;
				text-transform: uppercase;
				color: #ffffff;
			}

			.page-character-select__category-panel-copy {
				font: 500 0.86rem/1.45 var( --font-ui, sans-serif );
				color: rgba( 248, 251, 255, 0.72 );
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
				box-sizing: content-box;
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

			.page-character-select__option-grid {
				display: grid;
				grid-template-columns: repeat( 3, minmax( 0, 1fr ) );
				gap: 0.7rem;
			}

			.page-character-select__item {
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

			.page-character-select__item--thumbnail {
				align-items: stretch;
				justify-content: stretch;
				min-height: 0;
				padding: 0.55rem;
				aspect-ratio: 1 / 1;
			}

			.page-character-select__item--thumbnail-hero {
				grid-column: span 2;
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

			.page-character-select__item-name {
				font: 900 0.92rem/1.15 var( --font-display, sans-serif );
				letter-spacing: 0.04em;
				text-transform: uppercase;
			}

			.page-character-select__item-thumb {
				display: grid;
				place-items: center;
				width: 100%;
				height: 100%;
				aspect-ratio: 1 / 1;
				border-radius: 0.9rem;
				border: 1px solid rgba( 255, 255, 255, 0.08 );
				background: linear-gradient( 180deg, rgba( 8, 13, 20, 0.92 ), rgba( 16, 24, 36, 0.78 ) );
				overflow: hidden;
			}

			.page-character-select__item-thumb-image {
				display: block;
				width: 112%;
				height: 112%;
				object-fit: contain;
				object-position: center center;
				transform: translateY( - 1% );
				filter: drop-shadow( 0 10px 18px rgba( 0, 0, 0, 0.32 ) );
			}

			.page-character-select__item-thumb-fallback {
				display: grid;
				place-items: center;
				width: 100%;
				height: 100%;
				padding: 0.65rem;
				background: linear-gradient( 180deg, rgba( 255, 255, 255, 0.04 ), rgba( 255, 255, 255, 0.01 ) );
			}

			.page-character-select__item-thumb-fallback--loading::after {
				content: '';
				display: block;
				width: 1.4rem;
				height: 1.4rem;
				margin-top: 0.45rem;
				border-radius: 999px;
				border: 2px solid rgba( 255, 255, 255, 0.16 );
				border-top-color: rgba( 0, 212, 232, 0.88 );
				animation: page-character-select-thumb-spin 0.8s linear infinite;
			}

			.page-character-select__item-copy {
				display: grid;
				gap: 0.28rem;
				width: 100%;
			}

			.page-character-select__item-meta {
				font: 600 0.74rem/1.35 var( --font-ui, sans-serif );
				letter-spacing: 0.1em;
				text-transform: uppercase;
				color: rgba( 248, 251, 255, 0.62 );
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

			.page-character-select__detail-copy {
				font: 500 0.92rem/1.55 var( --font-ui, sans-serif );
				color: rgba( 248, 251, 255, 0.78 );
			}

			.page-character-select__camera-card {
				margin-top: auto;
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

			.page-character-select__camera-debug-pose {
				margin-top: 0.7rem;
				padding: 0.75rem 0.85rem;
				border-radius: 0.85rem;
				background: rgba( 255, 255, 255, 0.03 );
				border: 1px solid rgba( 255, 255, 255, 0.08 );
				font: 600 0.74rem/1.55 var( --font-mono, monospace );
				letter-spacing: 0.02em;
				color: rgba( 248, 251, 255, 0.78 );
				white-space: pre-wrap;
				word-break: break-word;
			}

			.page-character-select--customizer .page-character-select__sidebar {
				gap: 0.72rem;
				padding: 0.9rem;
				height: fit-content;
				min-height: 0;
			}

			.page-character-select--customizer .page-character-select__panel-label,
			.page-character-select--customizer .page-character-select__color-meta,
			.page-character-select--customizer .page-character-select__item-meta,
			.page-character-select--customizer .page-character-select__detail-label {
				font-family: var( --font-editorial-mono, var( --font-mono, monospace ) );
				font-size: var( --text-customizer-meta, 0.625rem );
				font-weight: 700;
				letter-spacing: 0.12em;
				text-transform: uppercase;
				color: rgba( 15, 17, 21, 0.58 );
			}

			.page-character-select--customizer .page-character-select__panel-title {
				font-family: var( --font-editorial-display, var( --font-display, sans-serif ) );
				font-size: var( --text-customizer-title, clamp( 2.35rem, 4.2vw, 3.4rem ) );
				font-weight: 900;
				line-height: 0.92;
				letter-spacing: -0.04em;
				color: var( --color-editorial-ink, #0f1115 );
			}

			.page-character-select--customizer .page-character-select__panel-copy,
			.page-character-select--customizer .page-character-select__category-panel-copy,
			.page-character-select--customizer .page-character-select__detail-copy {
				font-family: var( --font-editorial-mono, var( --font-mono, monospace ) );
				font-size: var( --text-customizer-copy, 0.78rem );
				line-height: 1.55;
				letter-spacing: 0.02em;
				text-transform: uppercase;
				color: rgba( 15, 17, 21, 0.78 );
			}

			.page-character-select--customizer .page-character-select__category-tabs {
				grid-template-columns: repeat( 2, minmax( 0, 1fr ) );
			}

			.page-character-select--customizer .page-character-select__category-tab {
				border-radius: 0;
				border: 1px solid rgba( 15, 17, 21, 0.16 );
				background: rgba( 15, 17, 21, 0.04 );
				color: var( --color-editorial-ink, #0f1115 );
				font-family: var( --font-editorial-mono, var( --font-mono, monospace ) );
				font-size: var( --text-customizer-action, 0.64rem );
				font-weight: 700;
				letter-spacing: 0.16em;
				padding: 0.78rem 0.72rem;
			}

			.page-character-select--customizer .page-character-select__category-tab:hover {
				background: rgba( 15, 17, 21, 0.08 );
				border-color: rgba( 15, 17, 21, 0.24 );
				transform: translateY( -1px );
			}

			.page-character-select--customizer .page-character-select__category-tab--active {
				background: var( --color-editorial-ink, #0f1115 );
				color: var( --color-editorial-cream, #f7f3e9 );
				border-color: var( --color-editorial-ink, #0f1115 );
				box-shadow: none;
			}

			.page-character-select--customizer .page-character-select__category-panel-title,
			.page-character-select--customizer .page-character-select__item-name,
			.page-character-select--customizer .page-character-select__detail-label {
				font-family: var( --font-editorial-display, var( --font-display, sans-serif ) );
				font-size: var( --text-customizer-section, 1.05rem );
				font-weight: 900;
				line-height: 1;
				letter-spacing: -0.02em;
				color: var( --color-editorial-ink, #0f1115 );
			}

			.page-character-select--customizer .page-character-select__category-stack {
				height: fit-content;
				flex: 0 1 auto;
				padding-right: 0;
			}

			.page-character-select--customizer .page-character-select__color-row,
			.page-character-select--customizer .page-character-select__detail-card {
				border-radius: 0;
				border: 1px solid rgba( 15, 17, 21, 0.12 );
				background: rgba( 15, 17, 21, 0.03 );
			}

			.page-character-select--customizer .page-character-select__color-label {
				font-size: var( --text-customizer-control, 0.875rem );
				color: var( --color-cta-secondary-text );
			}

			.page-character-select--customizer .page-character-select__color-meta {
				color: var( --color-cta-secondary-text );
			}

			.page-character-select--customizer .page-character-select__item-meta {
				color: rgba( 15, 17, 21, 0.62 );
			}

			.page-character-select--customizer .page-character-select__color-input {
				box-sizing: content-box;
				border-radius: 0;
			}

			.page-character-select--customizer .page-character-select__color-reset {
				border-radius: 0;
				border-color: rgba( 15, 17, 21, 0.18 );
				background: transparent;
				color: var( --color-editorial-ink, #0f1115 );
				font-family: var( --font-editorial-mono, var( --font-mono, monospace ) );
				font-size: var( --text-customizer-action, 0.64rem );
				font-weight: 700;
				letter-spacing: 0.16em;
				padding: 0.75rem 0.9rem;
			}

			.page-character-select--customizer .page-character-select__color-reset:hover {
				border-color: rgba( 15, 17, 21, 0.24 );
				background: rgba( 15, 17, 21, 0.08 );
			}

			.page-character-select--customizer .page-character-select__option-grid {
				grid-template-columns: repeat( 3, minmax( 0, 1fr ) );
				gap: 0.55rem;
			}

			.page-character-select--customizer .page-character-select__item {
				min-height: 5.35rem;
				border-radius: 0;
				border: 1px solid rgba( 15, 17, 21, 0.12 );
				background: rgba( 255, 255, 255, 0.58 );
				color: var( --color-editorial-ink, #0f1115 );
				box-shadow: none;
			}

			.page-character-select--customizer .page-character-select__item:hover {
				border-color: rgba( 15, 17, 21, 0.26 );
				box-shadow: 0 14px 24px rgba( 15, 17, 21, 0.08 );
			}

			.page-character-select--customizer .page-character-select__item--active {
				background: rgba( 216, 44, 44, 0.08 );
				border-color: rgba( 216, 44, 44, 0.58 );
				box-shadow: none;
			}

			.page-character-select--customizer .page-character-select__item-name {
				font-size: var( --text-customizer-control, 0.875rem );
			}

			.page-character-select--customizer .page-character-select__item-thumb,
			.page-character-select--customizer .page-character-select__item-thumb-fallback {
				border-radius: 0;
			}

			.page-character-select--customizer .page-character-select__item-thumb {
				border: 1px solid rgba( 15, 17, 21, 0.08 );
				background: rgba( 15, 17, 21, 0.04 );
			}

			.page-character-select--customizer .page-character-select__item-thumb-fallback {
				background: linear-gradient( 180deg, rgba( 15, 17, 21, 0.04 ), rgba( 15, 17, 21, 0.01 ) );
			}

			@media ( max-width: 1180px ) {
				.page-character-select__content {
					grid-template-columns: 1fr;
				}
			}

			@media ( max-width: 900px ) {
				.page-character-select__option-grid {
					grid-template-columns: repeat( 3, minmax( 0, 1fr ) );
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

				.page-character-select__category-tabs {
					grid-template-columns: repeat( 2, minmax( 0, 1fr ) );
				}

				.page-character-select__option-grid {
					grid-template-columns: repeat( 3, minmax( 0, 1fr ) );
				}
			}

			@keyframes page-character-select-thumb-spin {
				from { transform: rotate( 0deg ); }
				to { transform: rotate( 360deg ); }
			}
		`;
		document.head.appendChild( style );

	}

	_build() {

		const root = this._root;
		root.setAttribute( 'role', 'main' );
		root.setAttribute( 'aria-label', this._config.rootAriaLabel );
		root.classList.toggle( 'page-character-select--shared-stage', ! this._config.showEmbeddedPreview );
		root.classList.toggle( 'page-character-select--customizer', this._config.surfaceVariant === 'customizer' );

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
		sidebarLabel.textContent = this._config.sidebarLabelText;
		sidebar.appendChild( sidebarLabel );

		if ( this._config.sidebarTitleText ) {

			const sidebarTitle = document.createElement( 'h2' );
			sidebarTitle.className = 'page-character-select__panel-title';
			sidebarTitle.textContent = this._config.sidebarTitleText;
			sidebar.appendChild( sidebarTitle );

		}

		const sidebarCopy = document.createElement( 'p' );
		sidebarCopy.className = 'page-character-select__panel-copy';
		sidebarCopy.textContent = this._config.sidebarCopy;
		sidebar.appendChild( sidebarCopy );

		this._categoryTabStrip = document.createElement( 'div' );
		this._categoryTabStrip.className = 'page-character-select__category-tabs';
		sidebar.appendChild( this._categoryTabStrip );

		this._categoryStack = document.createElement( 'div' );
		this._categoryStack.className = 'page-character-select__category-stack';
		sidebar.appendChild( this._categoryStack );

		if ( this._config.showCameraDebugControls ) {

			const cameraCard = this._buildCameraDebugCard();
			cameraCard.classList.add( 'page-character-select__camera-card' );
			sidebar.appendChild( cameraCard );

		}

		content.appendChild( sidebar );
		root.appendChild( content );

	}

	_buildCameraDebugCard() {

		const card = document.createElement( 'div' );
		card.className = 'page-character-select__detail-card';

		const label = document.createElement( 'span' );
		label.className = 'page-character-select__detail-label';
		label.textContent = 'Camera Tuning';
		card.appendChild( label );

		const copy = document.createElement( 'div' );
		copy.className = 'page-character-select__detail-copy page-character-select__camera-debug-copy';
		copy.textContent = 'Slide these controls to nudge the live menu framing while you tune the driver.';
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
			input.setAttribute( 'aria-label', `${ sliderDef.label } camera tuning slider` );
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

		this._cameraDebugPoseEl = document.createElement( 'div' );
		this._cameraDebugPoseEl.className = 'page-character-select__camera-debug-pose';
		card.appendChild( this._cameraDebugPoseEl );

		this.setCameraDebugState( {} );

		return card;

	}

	_onMounted() {

		( this._categoryTabStrip?.querySelector( '.page-character-select__category-tab--active' ) || this._backBtn )?.focus( { preventScroll: true } );

	}

	renderCategories( categories ) {

		if ( ! this._categoryStack || ! this._categoryTabStrip ) return;
		this._categoryTabStrip.innerHTML = '';
		this._categoryStack.innerHTML = '';

		const activeCategory = categories.find( ( category ) => category.isOpen ) || categories[ 0 ];
		for ( const category of categories ) {

			const tab = document.createElement( 'button' );
			tab.type = 'button';
			tab.className = 'page-character-select__category-tab';
			tab.classList.toggle( 'page-character-select__category-tab--active', category.id === activeCategory?.id );
			tab.setAttribute( 'aria-pressed', String( category.id === activeCategory?.id ) );
			tab.setAttribute( 'aria-label', `${ category.label } tab` );
			tab.textContent = category.label;
			tab.addEventListener( 'click', () => {

				this._root.dispatchEvent( new CustomEvent( 'kk:character:category', {
					bubbles: true,
					composed: true,
					detail: { categoryId: category.id },
				} ) );

			} );
			this._categoryTabStrip.appendChild( tab );

		}

		if ( ! activeCategory ) return;

		const panel = document.createElement( 'section' );
		panel.className = 'page-character-select__category-panel';

		const panelHead = document.createElement( 'div' );
		panelHead.className = 'page-character-select__category-panel-head';

		const panelTitle = document.createElement( 'div' );
		panelTitle.className = 'page-character-select__category-panel-title';
		panelTitle.textContent = activeCategory.label;
		panelHead.appendChild( panelTitle );

		const panelCopy = document.createElement( 'div' );
		panelCopy.className = 'page-character-select__category-panel-copy';
		panelCopy.textContent = activeCategory.summary;
		panelHead.appendChild( panelCopy );
		panel.appendChild( panelHead );

		if ( Array.isArray( activeCategory.colorControls ) && activeCategory.colorControls.length > 0 ) {

			const controls = document.createElement( 'div' );
			controls.className = 'page-character-select__drawer-controls';

			for ( const control of activeCategory.colorControls ) {

				const row = document.createElement( 'div' );
				row.className = 'page-character-select__color-row';
				const dispatchColorChange = ( updateMode, nextValue ) => {

					this._root.dispatchEvent( new CustomEvent( 'kk:character:color', {
						bubbles: true,
						composed: true,
						detail: {
							categoryId: activeCategory.id,
							controlId: control.id,
							value: nextValue,
							updateMode,
						},
					} ) );

				};

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

					dispatchColorChange( 'live', input.value );

				} );
				input.addEventListener( 'change', () => {

					dispatchColorChange( 'commit', input.value );

				} );
				row.appendChild( input );

				const reset = document.createElement( 'button' );
				reset.type = 'button';
				reset.className = 'page-character-select__color-reset';
				reset.textContent = 'Reset';
				reset.addEventListener( 'click', () => {

					dispatchColorChange( 'commit', control.resetValue ?? '' );

				} );
				row.appendChild( reset );
				controls.appendChild( row );

			}

			panel.appendChild( controls );

		}

		if ( Array.isArray( activeCategory.items ) && activeCategory.items.length > 0 ) {

			const grid = document.createElement( 'div' );
			grid.className = 'page-character-select__option-grid';

			for ( const item of activeCategory.items ) {

				const button = document.createElement( 'button' );
				button.type = 'button';
				button.className = 'page-character-select__item';
				button.classList.toggle( 'page-character-select__item--active', !! item.active );
				const hasThumbnail = typeof item.thumbnailState === 'string';
				button.classList.toggle( 'page-character-select__item--thumbnail', hasThumbnail );
				button.classList.toggle( 'page-character-select__item--thumbnail-hero', hasThumbnail && activeCategory.items.length <= 2 );
				button.setAttribute( 'aria-pressed', String( !! item.active ) );
				button.setAttribute( 'aria-label', `${ item.label }, ${ item.metaText }` );
				button.addEventListener( 'click', () => {

					this._root.dispatchEvent( new CustomEvent( 'kk:character:item', {
						bubbles: true,
						composed: true,
						detail: {
							categoryId: activeCategory.id,
							itemId: item.id,
						},
					} ) );

				} );

				if ( hasThumbnail ) {

					const thumb = document.createElement( 'div' );
					thumb.className = 'page-character-select__item-thumb';
					thumb.setAttribute( 'aria-hidden', 'true' );

					if ( typeof item.thumbnailSrc === 'string' && item.thumbnailSrc ) {

						const image = document.createElement( 'img' );
						image.className = 'page-character-select__item-thumb-image';
						image.alt = '';
						image.decoding = 'async';
						image.loading = 'lazy';
						image.src = item.thumbnailSrc;
						thumb.appendChild( image );

					} else {

						const fallback = document.createElement( 'div' );
						fallback.className = 'page-character-select__item-thumb-fallback';
						if ( item.thumbnailState === 'loading' ) {

							fallback.classList.add( 'page-character-select__item-thumb-fallback--loading' );

						}
						thumb.appendChild( fallback );

					}

					button.appendChild( thumb );

				} else {

					const copy = document.createElement( 'div' );
					copy.className = 'page-character-select__item-copy';

					const itemName = document.createElement( 'div' );
					itemName.className = 'page-character-select__item-name';
					itemName.textContent = item.label;
					copy.appendChild( itemName );

					const itemMeta = document.createElement( 'div' );
					itemMeta.className = 'page-character-select__item-meta';
					itemMeta.textContent = item.metaText;
					copy.appendChild( itemMeta );
					button.appendChild( copy );

				}

				grid.appendChild( button );

			}

			panel.appendChild( grid );

		}

		this._categoryStack.appendChild( panel );

	}

	setSelectionState( { selectedLabel, activeCategoryId, activeCategoryLabel, activeCategorySummary } ) {

		this._root.dataset.selectedLabel = selectedLabel || '';
		this._root.dataset.activeCategoryId = activeCategoryId || '';
		this._root.dataset.activeCategoryLabel = activeCategoryLabel || '';
		this._root.dataset.activeCategorySummary = activeCategorySummary || '';

	}

	setPreviewLoading() {}

	setCameraDebugState( cameraDebugState = {}, previewPose = null ) {

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

		if ( this._cameraDebugPoseEl ) {

			const formatScalar = ( value ) => {

				const nextValue = Number( value );
				return Number.isFinite( nextValue ) ? nextValue.toFixed( 2 ) : '0.00';

			};

			const formatVector = ( vector ) => {

				const x = formatScalar( vector?.x );
				const y = formatScalar( vector?.y );
				const z = formatScalar( vector?.z );
				return `( ${ x }, ${ y }, ${ z } )`;

			};

			const presetId = typeof previewPose?.presetId === 'string' && previewPose.presetId ? previewPose.presetId : 'play';
			const fov = formatScalar( previewPose?.fov );
			const kartRotYDeg = formatScalar( previewPose?.kartRotYDeg );
			this._cameraDebugPoseEl.textContent = [
				`Preset: ${ presetId }`,
				`Cam: ${ formatVector( previewPose?.cameraPos ) }`,
				`Look: ${ formatVector( previewPose?.lookAt ) }`,
				`FOV: ${ fov } | Kart Y: ${ kartRotYDeg }`,
			].join( '\n' );

		}

	}

	get backBtn() {

		return this._backBtn;

	}

	get categoryStack() {

		return this._categoryStack;

	}

	get cancelBtn() {

		return null;

	}

	get saveBtn() {

		return null;

	}

	get previewPanel() {

		return this._previewPanel;

	}

	dispose() {

		this._previewPanel = null;
		this._backBtn = null;
		this._categoryTabStrip = null;
		this._categoryStack = null;
		this._cameraDebugInputs.clear();
		this._cameraDebugValueEls.clear();
		this._cameraDebugReadoutEl = null;
		this._cameraDebugPoseEl = null;
		this._cameraDebugResetBtn = null;

		super.dispose();

	}

}

Page10CharacterSelectView._cssInjected = false;

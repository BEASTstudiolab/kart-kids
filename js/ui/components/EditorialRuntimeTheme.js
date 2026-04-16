let _cssInjected = false;

export function ensureEditorialRuntimeTheme() {

	if ( _cssInjected ) return;
	_cssInjected = true;

	const style = document.createElement( 'style' );
	style.textContent = `
		:root {
			--kk-rt-cream: var(--color-editorial-cream, #f7f3e9);
			--kk-rt-red: var(--color-editorial-red, #d82c2c);
			--kk-rt-ink: var(--color-editorial-ink, #0f1115);
			--kk-rt-font-display: var(--font-editorial-display, var(--font-display, sans-serif));
			--kk-rt-font-mono: var(--font-editorial-mono, var(--font-mono, monospace));
		}

		.kk-rt-card,
		.kk-rt-pill,
		.kk-rt-btn {
			font-family: var(--kk-rt-font-mono);
			text-transform: uppercase;
		}

		.kk-rt-card {
			position: relative;
			display: flex;
			flex-direction: column;
			gap: 0.7rem;
			padding: 0.95rem 1rem;
			color: var(--kk-rt-cream);
			background: rgba(15, 17, 21, 0.84);
			border: 1px solid rgba(247, 243, 233, 0.72);
			clip-path: polygon(0 0, 100% 0, 100% 90%, 95% 100%, 0 100%);
			box-shadow: 0 20px 36px rgba(0, 0, 0, 0.28);
			backdrop-filter: blur(10px);
			-webkit-backdrop-filter: blur(10px);
		}

		.kk-rt-card--cream {
			background: rgba(247, 243, 233, 0.96);
			color: var(--kk-rt-ink);
			border-color: rgba(247, 243, 233, 0.96);
		}

		.kk-rt-card--red {
			background: rgba(216, 44, 44, 0.96);
			color: var(--kk-rt-cream);
			border-color: rgba(216, 44, 44, 0.96);
		}

		.kk-rt-card--outline {
			background: rgba(15, 17, 21, 0.44);
			color: var(--kk-rt-cream);
			border-color: rgba(247, 243, 233, 0.56);
		}

		.kk-rt-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 0.75rem;
			padding-bottom: 0.35rem;
			border-bottom: 1px solid currentColor;
			font-size: var(--text-editorial-label, 0.625rem);
			font-weight: 700;
			letter-spacing: var(--tracking-widest, 0.14em);
		}

		.kk-rt-header__right:empty {
			display: none;
		}

		.kk-rt-label {
			font-size: var(--text-editorial-label, 0.625rem);
			font-weight: 700;
			letter-spacing: var(--tracking-widest, 0.14em);
			opacity: 0.75;
		}

		.kk-rt-value {
			font-family: var(--kk-rt-font-display);
			font-size: var(--text-editorial-card-value, clamp(1.9rem, 4vw, 3rem));
			font-weight: 900;
			line-height: 0.92;
			letter-spacing: -0.06em;
		}

		.kk-rt-copy {
			margin: 0;
			font-size: var(--text-editorial-copy, 0.625rem);
			line-height: var(--leading-relaxed, 1.6);
			letter-spacing: 0.12em;
			opacity: 0.88;
		}

		.kk-rt-grid {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 0.55rem 1rem;
		}

		.kk-rt-grid__item {
			padding-left: 0.45rem;
			border-left: 2px solid var(--kk-rt-red);
			font-size: var(--text-editorial-data, 0.625rem);
			letter-spacing: 0.1em;
		}

		.kk-rt-pill {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-height: 2rem;
			padding: 0.4rem 0.75rem;
			border: 1px solid rgba(247, 243, 233, 0.72);
			background: rgba(15, 17, 21, 0.78);
			color: var(--kk-rt-cream);
			font-size: var(--text-editorial-label, 0.625rem);
			font-weight: 700;
			letter-spacing: var(--tracking-widest, 0.14em);
			clip-path: polygon(0 0, 100% 0, 100% 88%, 95% 100%, 0 100%);
		}

		.kk-rt-pill--cream {
			background: rgba(247, 243, 233, 0.94);
			color: var(--kk-rt-ink);
			border-color: rgba(247, 243, 233, 0.94);
		}

		.kk-rt-pill--red {
			background: rgba(216, 44, 44, 0.94);
			color: var(--kk-rt-cream);
			border-color: rgba(216, 44, 44, 0.94);
		}

		.kk-rt-btn {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			gap: 0.45rem;
			min-height: 2.55rem;
			padding: 0.7rem 1rem;
			border: 1px solid rgba(247, 243, 233, 0.78);
			background: rgba(15, 17, 21, 0.84);
			color: var(--kk-rt-cream);
			font-size: var(--text-editorial-label, 0.625rem);
			font-weight: 700;
			letter-spacing: var(--tracking-widest, 0.14em);
			clip-path: polygon(0 0, 100% 0, 100% 88%, 95% 100%, 0 100%);
			cursor: pointer;
			transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
		}

		.kk-rt-btn:hover:not(:disabled),
		.kk-rt-btn:focus-visible:not(:disabled) {
			background: rgba(216, 44, 44, 0.18);
			border-color: rgba(247, 243, 233, 1);
			transform: translateY(-1px);
		}

		.kk-rt-btn:disabled {
			opacity: 0.58;
			cursor: default;
		}

		.kk-rt-btn--cream {
			background: rgba(247, 243, 233, 0.96);
			color: var(--kk-rt-ink);
			border-color: rgba(247, 243, 233, 0.96);
		}

		.kk-rt-btn--red {
			background: rgba(216, 44, 44, 0.96);
			color: var(--kk-rt-cream);
			border-color: rgba(216, 44, 44, 0.96);
		}

		.kk-rt-btn--ghost {
			background: transparent;
		}

		.kk-rt-meter {
			position: relative;
			width: 100%;
			height: 0.5rem;
			border: 1px solid rgba(247, 243, 233, 0.2);
			background: rgba(247, 243, 233, 0.08);
			overflow: hidden;
		}

		.kk-rt-meter__fill {
			position: absolute;
			inset: 0 auto 0 0;
			width: 0;
			background: linear-gradient(90deg, #ffe184 0%, #ff9f43 52%, #d82c2c 100%);
			transition: width 0.18s ease, background 0.18s ease;
		}

		.kk-rt-scanlines {
			position: absolute;
			inset: 0;
			pointer-events: none;
			opacity: 0.16;
			background:
				linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.08) 50%),
				linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.008), rgba(0, 0, 255, 0.03));
			background-size: 100% 3px, 3px 100%;
		}
	`;
	document.head.appendChild( style );

}

export function createEditorialRuntimeHeader( leftText, rightText = '' ) {

	const header = document.createElement( 'div' );
	header.className = 'kk-rt-header';

	const left = document.createElement( 'span' );
	left.className = 'kk-rt-header__left';
	left.textContent = leftText;
	header.appendChild( left );

	const right = document.createElement( 'span' );
	right.className = 'kk-rt-header__right';
	right.textContent = rightText;
	header.appendChild( right );

	return header;

}

export function createEditorialRuntimeButton( label, variant = 'ghost' ) {

	const button = document.createElement( 'button' );
	button.type = 'button';
	button.className = `kk-rt-btn kk-rt-btn--${ variant }`;
	button.textContent = label;
	return button;

}

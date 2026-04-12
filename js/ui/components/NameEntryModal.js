/**
 * NameEntryModal — First-run onboarding splash page.
 *
 * Shown once on first app launch when Settings.isFirstRun() returns true.
 * Renders a full-screen branded splash with a name input.
 * Collects a display name (max 20 chars, HTML-sanitized via textContent pattern).
 *
 * Saves result to Settings.setDisplayName().
 *
 * DOM structure (appended to document.body):
 *
 *   div.kk-onboarding
 *     div.kk-onboarding__card
 *       h1.kk-onboarding__title  "KART KIDS"
 *       div.kk-onboarding__field
 *         label.kk-onboarding__label
 *         input.kk-onboarding__input
 *         span.kk-onboarding__error (hidden by default)
 *       button.kk-onboarding__btn  "LET'S RACE!"
 */

const MAX_NAME_LENGTH = 20;

let _cssInjected = false;

/**
 * Show the onboarding splash page.
 *
 * @param {object} _modalService  Unused — kept for API compat with AppShell call.
 * @param {import('../../Settings.js').Settings} settings
 * @returns {Promise<void>}  Resolves when the user completes onboarding.
 */
export function showNameEntryModal( _modalService, settings ) {

	return new Promise( ( resolve ) => {

		_injectCSS();

		const page = document.createElement( 'div' );
		page.className = 'kk-onboarding';

		const card = document.createElement( 'div' );
		card.className = 'kk-onboarding__card';

		// ----- Branding -----
		const title = document.createElement( 'h1' );
		title.className = 'kk-onboarding__title';
		title.textContent = 'KART KIDS';
		card.appendChild( title );

		// ----- Subtitle -----
		const subtitle = document.createElement( 'p' );
		subtitle.className = 'kk-onboarding__subtitle';
		subtitle.textContent = 'Enter your name';
		card.appendChild( subtitle );

		// ----- Name field -----
		const field = document.createElement( 'div' );
		field.className = 'kk-onboarding__field';

		const input = document.createElement( 'input' );
		input.type = 'text';
		input.id = 'kk-onboarding-input';
		input.className = 'kk-onboarding__input';
		input.placeholder = 'Your name...';
		input.maxLength = MAX_NAME_LENGTH;
		input.autocomplete = 'off';
		input.setAttribute( 'aria-required', 'true' );
		input.setAttribute( 'aria-label', 'Display name' );
		input.setAttribute( 'aria-describedby', 'kk-onboarding-error' );
		field.appendChild( input );

		const errorEl = document.createElement( 'span' );
		errorEl.id = 'kk-onboarding-error';
		errorEl.className = 'kk-onboarding__error';
		errorEl.setAttribute( 'role', 'alert' );
		errorEl.hidden = true;
		field.appendChild( errorEl );

		card.appendChild( field );

		// ----- Confirm button -----
		const btn = document.createElement( 'button' );
		btn.type = 'button';
		btn.className = 'kk-onboarding__btn';

		const btnLabel = document.createElement( 'span' );
		btnLabel.textContent = "LET'S RACE!";
		btn.appendChild( btnLabel );

		card.appendChild( btn );

		page.appendChild( card );
		document.body.appendChild( page );

		// Focus the input after it's in the DOM.
		requestAnimationFrame( () => input.focus() );

		// ----- Handlers -----

		function confirm() {

			const sanitized = _sanitizeName( input.value );

			if ( ! sanitized || sanitized.length === 0 ) {

				errorEl.textContent = 'Please enter a display name.';
				errorEl.hidden = false;
				input.setAttribute( 'aria-invalid', 'true' );
				input.focus();
				return;

			}

			settings.setDisplayName( sanitized );

			// Fade out then remove.
			page.classList.add( 'kk-onboarding--leaving' );
			page.addEventListener( 'transitionend', () => {

				page.remove();
				resolve();

			}, { once: true } );

			// Fallback if transitionend doesn't fire.
			setTimeout( () => {

				if ( page.parentNode ) {

					page.remove();
					resolve();

				}

			}, 600 );

		}

		btn.addEventListener( 'click', confirm );

		input.addEventListener( 'keydown', ( e ) => {

			if ( e.key === 'Enter' ) {

				e.preventDefault();
				confirm();

			}

		} );

	} );

}

// ---------------------------------------------------------------------------
// Sanitization
// ---------------------------------------------------------------------------

function _sanitizeName( raw ) {

	const temp = document.createElement( 'div' );
	temp.textContent = raw;
	const stripped = temp.textContent.trim();
	return stripped.slice( 0, MAX_NAME_LENGTH );

}

// ---------------------------------------------------------------------------
// CSS injection
// ---------------------------------------------------------------------------

function _injectCSS() {

	if ( _cssInjected ) return;
	_cssInjected = true;

	const style = document.createElement( 'style' );
	style.textContent = `
		/* ------------------------------------------------------------------ */
		/* Onboarding splash page                                              */
		/* ------------------------------------------------------------------ */

		.kk-onboarding {
			position: fixed;
			inset: 0;
			z-index: 9999;
			display: flex;
			align-items: center;
			justify-content: center;
			background: radial-gradient(ellipse at 50% 40%, #1a1a2e 0%, #0a0a14 100%);
			opacity: 1;
			transition: opacity 0.4s ease;
		}

		.kk-onboarding--leaving {
			opacity: 0;
		}

		.kk-onboarding__card {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 1.5rem;
			padding: 3rem 2.5rem;
			width: min(400px, 90vw);
		}

		/* ----- Title / branding ----- */

		.kk-onboarding__title {
			font-family: var(--font-display, 'Arial Black', sans-serif);
			font-size: clamp(2.5rem, 8vw, 4rem);
			font-weight: 900;
			color: #ffffff;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			text-align: center;
			margin: 0;
			text-shadow:
				0 0 20px rgba(255, 165, 0, 0.6),
				0 0 40px rgba(255, 165, 0, 0.3),
				0 2px 4px rgba(0, 0, 0, 0.5);
		}

		.kk-onboarding__subtitle {
			font-family: var(--font-ui, sans-serif);
			font-size: var(--text-base, 1rem);
			color: rgba(255, 255, 255, 0.5);
			text-transform: uppercase;
			letter-spacing: 0.12em;
			margin: 0;
		}

		/* ----- Name field ----- */

		.kk-onboarding__field {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			width: 100%;
		}

		.kk-onboarding__input {
			font-family: var(--font-ui, sans-serif);
			font-size: 1.125rem;
			color: #ffffff;
			background: rgba(255, 255, 255, 0.08);
			border: 2px solid rgba(255, 255, 255, 0.15);
			border-radius: 0.625rem;
			padding: 0.875rem 1rem;
			outline: none;
			text-align: center;
			transition: border-color 0.2s ease, background 0.2s ease;
		}

		.kk-onboarding__input::placeholder {
			color: rgba(255, 255, 255, 0.3);
		}

		.kk-onboarding__input:focus {
			border-color: rgba(255, 165, 0, 0.6);
			background: rgba(255, 255, 255, 0.12);
		}

		.kk-onboarding__input[aria-invalid="true"] {
			border-color: #e74c3c;
		}

		.kk-onboarding__error {
			font-family: var(--font-ui, sans-serif);
			font-size: 0.75rem;
			color: #e74c3c;
			text-align: center;
		}

		/* ----- Confirm button ----- */

		.kk-onboarding__btn {
			font-family: var(--font-ui, sans-serif);
			font-size: 1.125rem;
			font-weight: 700;
			color: #ffffff;
			background: linear-gradient(135deg, #e67e22 0%, #d35400 100%);
			border: none;
			border-radius: 0.625rem;
			padding: 0.875rem 2.5rem;
			cursor: pointer;
			text-transform: uppercase;
			letter-spacing: 0.06em;
			transition: transform 0.15s ease, box-shadow 0.15s ease;
			box-shadow: 0 4px 15px rgba(230, 126, 34, 0.4);
			width: 100%;
		}

		.kk-onboarding__btn:hover {
			transform: translateY(-2px);
			box-shadow: 0 6px 20px rgba(230, 126, 34, 0.6);
		}

		.kk-onboarding__btn:active {
			transform: translateY(0);
			box-shadow: 0 2px 10px rgba(230, 126, 34, 0.4);
		}

		.kk-onboarding__btn:focus-visible {
			outline: 2px solid #ffffff;
			outline-offset: 2px;
		}
	`;
	document.head.appendChild( style );

}

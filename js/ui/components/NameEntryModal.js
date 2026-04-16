import {
	ensureEditorialRuntimeTheme,
	createEditorialRuntimeButton,
	createEditorialRuntimeHeader,
} from './EditorialRuntimeTheme.js';

const MAX_NAME_LENGTH = 20;

let _cssInjected = false;

export function showNameEntryModal( _modalService, settings ) {

	return new Promise( ( resolve ) => {

		ensureEditorialRuntimeTheme();
		_injectCSS();

		const page = document.createElement( 'div' );
		page.className = 'kk-onboarding';

		const card = document.createElement( 'div' );
		card.className = 'kk-onboarding__card';
		card.appendChild( createEditorialRuntimeHeader( 'Pilot Registry', 'Live' ) );

		const title = document.createElement( 'h1' );
		title.className = 'kk-onboarding__title';
		title.textContent = 'Kart Kids';
		card.appendChild( title );

		const subtitle = document.createElement( 'p' );
		subtitle.className = 'kk-onboarding__subtitle';
		subtitle.textContent = 'Register your pilot tag before entering the grid.';
		card.appendChild( subtitle );

		const field = document.createElement( 'div' );
		field.className = 'kk-onboarding__field';

		const input = document.createElement( 'input' );
		input.type = 'text';
		input.id = 'kk-onboarding-input';
		input.className = 'kk-onboarding__input';
		input.placeholder = 'Enter name';
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

		const btn = createEditorialRuntimeButton( 'Launch Profile', 'red' );
		btn.classList.add( 'kk-onboarding__btn' );
		card.appendChild( btn );

		page.appendChild( card );
		document.body.appendChild( page );

		requestAnimationFrame( () => input.focus() );

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
			page.classList.add( 'kk-onboarding--leaving' );
			page.addEventListener( 'transitionend', () => {

				page.remove();
				resolve();

			}, { once: true } );

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

function _sanitizeName( raw ) {

	const temp = document.createElement( 'div' );
	temp.textContent = raw;
	const stripped = temp.textContent.trim();
	return stripped.slice( 0, MAX_NAME_LENGTH );

}

function _injectCSS() {

	if ( _cssInjected ) return;
	_cssInjected = true;

	const style = document.createElement( 'style' );
	style.textContent = `
		.kk-onboarding {
			position: fixed;
			inset: 0;
			z-index: 9999;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 24px;
			background:
				radial-gradient(circle at 20% 20%, rgba(216,44,44,0.18) 0%, rgba(216,44,44,0) 36%),
				radial-gradient(circle at 78% 18%, rgba(247,243,233,0.12) 0%, rgba(247,243,233,0) 34%),
				linear-gradient(180deg, #0f1115 0%, #090b0f 100%);
			opacity: 1;
			transition: opacity 0.4s ease;
		}

		.kk-onboarding::before {
			content: '';
			position: absolute;
			inset: 0;
			background:
				linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.08) 50%),
				linear-gradient(90deg, rgba(255,0,0,0.02), rgba(0,255,0,0.008), rgba(0,0,255,0.02));
			background-size: 100% 3px, 3px 100%;
			opacity: 0.3;
			pointer-events: none;
		}

		.kk-onboarding--leaving {
			opacity: 0;
		}

		.kk-onboarding__card {
			position: relative;
			display: flex;
			flex-direction: column;
			align-items: stretch;
			gap: 1rem;
			padding: 1rem;
			width: min(520px, 100%);
			background: rgba(247,243,233,0.96);
			color: #0f1115;
			border: 1px solid rgba(247,243,233,0.96);
			box-shadow: 0 24px 80px rgba(0,0,0,0.45);
			clip-path: polygon(0 0, 100% 0, 100% 92%, 96% 100%, 0 100%);
		}

		.kk-onboarding__title {
			margin: 0;
			font-family: var(--kk-rt-font-display);
			font-size: clamp(3rem, 10vw, 5.2rem);
			font-weight: 900;
			line-height: 0.9;
			letter-spacing: -0.08em;
			text-transform: uppercase;
			color: #0f1115;
		}

		.kk-onboarding__title::after {
			content: 'Pilot Archive';
			display: block;
			margin-top: 0.55rem;
			font-family: var(--kk-rt-font-mono);
			font-size: 0.68rem;
			font-weight: 700;
			letter-spacing: 0.22em;
			color: rgba(15,17,21,0.54);
			text-transform: uppercase;
		}

		.kk-onboarding__subtitle {
			margin: 0;
			font-family: var(--kk-rt-font-mono);
			font-size: 0.68rem;
			line-height: 1.7;
			letter-spacing: 0.14em;
			text-transform: uppercase;
			color: rgba(15,17,21,0.74);
		}

		.kk-onboarding__field {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			width: 100%;
		}

		.kk-onboarding__input {
			font-family: var(--kk-rt-font-display);
			font-size: clamp(2rem, 8vw, 3.75rem);
			font-weight: 900;
			color: #0f1115;
			background: rgba(15,17,21,0.06);
			border: 1px solid rgba(15,17,21,0.22);
			padding: 1rem 1.1rem;
			outline: none;
			text-align: left;
			text-transform: uppercase;
			letter-spacing: -0.06em;
			transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
		}

		.kk-onboarding__input::placeholder {
			color: rgba(15,17,21,0.22);
		}

		.kk-onboarding__input:focus {
			border-color: rgba(216,44,44,0.88);
			background: rgba(15,17,21,0.02);
			box-shadow: 0 0 0 4px rgba(216,44,44,0.08);
		}

		.kk-onboarding__input[aria-invalid='true'] {
			border-color: #d82c2c;
		}

		.kk-onboarding__error {
			font-family: var(--kk-rt-font-mono);
			font-size: 0.6rem;
			color: #d82c2c;
			text-align: left;
			text-transform: uppercase;
			letter-spacing: 0.14em;
		}

		.kk-onboarding__btn {
			width: 100%;
			margin-top: 0.25rem;
		}

		@media (max-width: 480px) {
			.kk-onboarding {
				padding: 12px;
			}

			.kk-onboarding__card {
				padding: 0.85rem;
			}
		}
	`;
	document.head.appendChild( style );

}

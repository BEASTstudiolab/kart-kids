/**
 * NameEntryModal — First-run name entry and avatar picker.
 *
 * Shown once on first app launch when Settings.isFirstRun() returns true.
 * Collects a display name (max 20 chars, HTML-sanitized via textContent pattern)
 * and an avatar color choice from predefined options.
 *
 * Uses ModalService for focus trapping and overlay management.
 * Saves results to Settings.setDisplayName() and Settings.setAvatarChoice().
 *
 * DOM structure (rendered as modal body):
 *
 *   div.kk-name-entry
 *     div.kk-name-entry__field
 *       label.kk-name-entry__label
 *       input.kk-name-entry__input
 *       span.kk-name-entry__error (hidden by default)
 *     div.kk-name-entry__avatars
 *       label.kk-name-entry__avatar-label
 *       div.kk-name-entry__avatar-options[role="radiogroup"]
 *         button.kk-name-entry__avatar-option[role="radio"]  x3
 *
 * Events:
 *   Calls onComplete() callback when the user confirms.
 */

const AVATAR_CHOICES = Object.freeze( [
	{ id: 'red',    label: 'Red',    color: '#e74c3c' },
	{ id: 'blue',   label: 'Blue',   color: '#3498db' },
	{ id: 'green',  label: 'Green',  color: '#2ecc71' },
] );

const MAX_NAME_LENGTH = 20;

let _cssInjected = false;

/**
 * Show the name entry modal via ModalService.
 *
 * @param {import('../core/ModalService.js').ModalService} modalService
 * @param {import('../../Settings.js').Settings} settings
 * @returns {Promise<void>}  Resolves when the user completes the modal.
 */
export function showNameEntryModal( modalService, settings ) {

	return new Promise( ( resolve ) => {

		_injectCSS();

		// Build the modal body content
		const { bodyEl, getValues, setError, inputEl } = _buildBody();

		// Build the footer with the confirm button
		const footerEl = _buildFooter();
		const confirmBtn = footerEl.querySelector( '[data-action="name-entry-confirm"]' );

		const handle = modalService.open( {
			uid:         'name-entry',
			title:       'Welcome to Kart Kids!',
			body:        bodyEl,
			footer:      footerEl,
			dismissible: false,
			loading:     false,
			onClose:     () => resolve(),
		} );

		// Wire confirm button
		confirmBtn.addEventListener( 'click', () => {

			const { name, avatarId } = getValues();

			// Sanitize: strip HTML by using textContent round-trip
			const sanitized = _sanitizeName( name );

			if ( ! sanitized || sanitized.length === 0 ) {

				setError( 'Please enter a display name.' );
				inputEl.focus();
				return;

			}

			settings.setDisplayName( sanitized );
			settings.setAvatarChoice( avatarId );
			handle.close();

		} );

		// Allow Enter key on input to submit
		inputEl.addEventListener( 'keydown', ( e ) => {

			if ( e.key === 'Enter' ) {

				e.preventDefault();
				confirmBtn.click();

			}

		} );

	} );

}

// ---------------------------------------------------------------------------
// Build helpers
// ---------------------------------------------------------------------------

/**
 * Build the modal body DOM.
 *
 * @returns {{ bodyEl: HTMLElement, getValues: Function, setError: Function, inputEl: HTMLInputElement }}
 */
function _buildBody() {

	const bodyEl = document.createElement( 'div' );
	bodyEl.className = 'kk-name-entry';

	// ----- Name field -----
	const field = document.createElement( 'div' );
	field.className = 'kk-name-entry__field';

	const label = document.createElement( 'label' );
	label.className = 'kk-name-entry__label';
	label.setAttribute( 'for', 'kk-name-entry-input' );
	label.textContent = 'Display Name';
	field.appendChild( label );

	const input = document.createElement( 'input' );
	input.type = 'text';
	input.id = 'kk-name-entry-input';
	input.className = 'kk-name-entry__input';
	input.placeholder = 'Enter your name...';
	input.maxLength = MAX_NAME_LENGTH;
	input.autocomplete = 'off';
	input.setAttribute( 'aria-required', 'true' );
	input.setAttribute( 'aria-describedby', 'kk-name-entry-error' );
	field.appendChild( input );

	const errorEl = document.createElement( 'span' );
	errorEl.id = 'kk-name-entry-error';
	errorEl.className = 'kk-name-entry__error';
	errorEl.setAttribute( 'role', 'alert' );
	errorEl.hidden = true;
	field.appendChild( errorEl );

	bodyEl.appendChild( field );

	// ----- Avatar picker -----
	const avatarSection = document.createElement( 'div' );
	avatarSection.className = 'kk-name-entry__avatars';

	const avatarLabel = document.createElement( 'span' );
	avatarLabel.className = 'kk-name-entry__avatar-label';
	avatarLabel.id = 'kk-name-entry-avatar-label';
	avatarLabel.textContent = 'Choose Your Color';
	avatarSection.appendChild( avatarLabel );

	const avatarGroup = document.createElement( 'div' );
	avatarGroup.className = 'kk-name-entry__avatar-options';
	avatarGroup.setAttribute( 'role', 'radiogroup' );
	avatarGroup.setAttribute( 'aria-labelledby', 'kk-name-entry-avatar-label' );

	let selectedAvatarId = AVATAR_CHOICES[ 0 ].id;

	for ( const choice of AVATAR_CHOICES ) {

		const btn = document.createElement( 'button' );
		btn.type = 'button';
		btn.className = 'kk-name-entry__avatar-option';
		btn.setAttribute( 'role', 'radio' );
		btn.setAttribute( 'aria-checked', choice.id === selectedAvatarId ? 'true' : 'false' );
		btn.setAttribute( 'aria-label', choice.label );
		btn.dataset.avatarId = choice.id;
		btn.style.setProperty( '--avatar-color', choice.color );

		const swatch = document.createElement( 'span' );
		swatch.className = 'kk-name-entry__avatar-swatch';
		btn.appendChild( swatch );

		const choiceLabel = document.createElement( 'span' );
		choiceLabel.className = 'kk-name-entry__avatar-choice-label';
		choiceLabel.textContent = choice.label;
		btn.appendChild( choiceLabel );

		btn.addEventListener( 'click', () => {

			selectedAvatarId = choice.id;

			// Update all radio states
			avatarGroup.querySelectorAll( '[role="radio"]' ).forEach( ( r ) => {

				const isSelected = r.dataset.avatarId === selectedAvatarId;
				r.setAttribute( 'aria-checked', String( isSelected ) );
				r.classList.toggle( 'kk-name-entry__avatar-option--selected', isSelected );

			} );

		} );

		// Set initial selected class
		if ( choice.id === selectedAvatarId ) {

			btn.classList.add( 'kk-name-entry__avatar-option--selected' );

		}

		avatarGroup.appendChild( btn );

	}

	// Arrow key navigation within avatar group
	avatarGroup.addEventListener( 'keydown', ( e ) => {

		if ( e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' ) return;
		e.preventDefault();

		const btns = Array.from( avatarGroup.querySelectorAll( '[role="radio"]' ) );
		const idx = btns.indexOf( document.activeElement );
		if ( idx === - 1 ) return;

		const next = e.key === 'ArrowRight'
			? btns[ ( idx + 1 ) % btns.length ]
			: btns[ ( idx - 1 + btns.length ) % btns.length ];

		next.focus();
		next.click();

	} );

	avatarSection.appendChild( avatarGroup );
	bodyEl.appendChild( avatarSection );

	// ----- Return API -----
	return {
		bodyEl,
		inputEl: input,
		getValues: () => ( { name: input.value, avatarId: selectedAvatarId } ),
		setError: ( msg ) => {

			errorEl.textContent = msg;
			errorEl.hidden = false;
			input.setAttribute( 'aria-invalid', 'true' );

		},
	};

}

/**
 * Build the modal footer with a confirm button.
 *
 * @returns {HTMLElement}
 */
function _buildFooter() {

	const footer = document.createElement( 'div' );
	footer.className = 'kk-name-entry__footer';

	const btn = document.createElement( 'button' );
	btn.type = 'button';
	btn.className = 'kk-cta-button kk-cta-button--primary';
	btn.setAttribute( 'data-action', 'name-entry-confirm' );

	const label = document.createElement( 'span' );
	label.className = 'kk-cta-button__label';
	label.textContent = "LET'S RACE!";
	btn.appendChild( label );

	footer.appendChild( btn );

	return footer;

}

// ---------------------------------------------------------------------------
// Sanitization
// ---------------------------------------------------------------------------

/**
 * Strip HTML tags from a string using the textContent pattern.
 * Trims whitespace and enforces max length.
 *
 * @param {string} raw
 * @returns {string}
 */
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
		/* NameEntryModal                                                      */
		/* ------------------------------------------------------------------ */

		.kk-name-entry {
			display: flex;
			flex-direction: column;
			gap: var(--space-5, 1.25rem);
			padding: var(--space-2, 0.5rem) 0;
		}

		/* ----- Name field ----- */

		.kk-name-entry__field {
			display: flex;
			flex-direction: column;
			gap: var(--space-2, 0.5rem);
		}

		.kk-name-entry__label {
			font-family: var(--font-ui, sans-serif);
			font-size: var(--text-sm, 0.875rem);
			font-weight: var(--weight-bold, 700);
			color: var(--color-ink-300, #a0a0a0);
			text-transform: uppercase;
			letter-spacing: var(--tracking-wide, 0.05em);
		}

		.kk-name-entry__input {
			font-family: var(--font-ui, sans-serif);
			font-size: var(--text-base, 1rem);
			color: var(--color-white, #ffffff);
			background: var(--color-ink-800, #1a1a1a);
			border: 2px solid var(--color-ink-600, #404040);
			border-radius: var(--radius-md, 0.5rem);
			padding: var(--space-3, 0.75rem);
			outline: none;
			transition: border-color 0.15s ease;
		}

		.kk-name-entry__input:focus {
			border-color: var(--color-accent-blue, #3498db);
		}

		.kk-name-entry__input[aria-invalid="true"] {
			border-color: var(--color-danger, #e74c3c);
		}

		.kk-name-entry__error {
			font-family: var(--font-ui, sans-serif);
			font-size: var(--text-xs, 0.75rem);
			color: var(--color-danger, #e74c3c);
		}

		/* ----- Avatar picker ----- */

		.kk-name-entry__avatars {
			display: flex;
			flex-direction: column;
			gap: var(--space-3, 0.75rem);
		}

		.kk-name-entry__avatar-label {
			font-family: var(--font-ui, sans-serif);
			font-size: var(--text-sm, 0.875rem);
			font-weight: var(--weight-bold, 700);
			color: var(--color-ink-300, #a0a0a0);
			text-transform: uppercase;
			letter-spacing: var(--tracking-wide, 0.05em);
		}

		.kk-name-entry__avatar-options {
			display: flex;
			gap: var(--space-3, 0.75rem);
		}

		.kk-name-entry__avatar-option {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: var(--space-2, 0.5rem);
			padding: var(--space-3, 0.75rem);
			border: 2px solid var(--color-ink-600, #404040);
			border-radius: var(--radius-md, 0.5rem);
			background: var(--color-ink-800, #1a1a1a);
			cursor: pointer;
			transition: border-color 0.15s ease, transform 0.1s ease;
			flex: 1;
			min-width: 0;
		}

		.kk-name-entry__avatar-option:hover {
			border-color: var(--color-ink-400, #666);
		}

		.kk-name-entry__avatar-option:focus-visible {
			outline: 2px solid var(--color-accent-blue, #3498db);
			outline-offset: 2px;
		}

		.kk-name-entry__avatar-option--selected {
			border-color: var(--color-accent-blue, #3498db);
			transform: scale(1.02);
		}

		.kk-name-entry__avatar-swatch {
			display: block;
			width: 40px;
			height: 40px;
			border-radius: 50%;
			background: var(--avatar-color);
		}

		.kk-name-entry__avatar-choice-label {
			font-family: var(--font-ui, sans-serif);
			font-size: var(--text-xs, 0.75rem);
			color: var(--color-ink-300, #a0a0a0);
			text-transform: uppercase;
			letter-spacing: var(--tracking-wide, 0.05em);
		}

		/* ----- Footer ----- */

		.kk-name-entry__footer {
			display: flex;
			justify-content: flex-end;
		}

		.kk-name-entry__footer .kk-cta-button {
			min-width: 140px;
		}
	`;
	document.head.appendChild( style );

}

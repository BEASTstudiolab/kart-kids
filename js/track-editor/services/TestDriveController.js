// ─── TestDriveController ─────────────────────────────────────────────────────
// Launches the game in a new tab with the current track loaded.

export class TestDriveController {

	/**
	 * @param {import('./ShareLinkService.js').ShareLinkService} shareLink
	 * @param {import('./ValidationService.js').ValidationService} validation
	 */
	constructor( shareLink, validation ) {

		this._shareLink = shareLink;
		this._validation = validation;

	}

	/**
	 * Launch the game with the current track.
	 * Validates first and warns if there are errors.
	 * @returns {boolean} true if test drive was launched
	 */
	launch() {

		const result = this._validation.validate();

		if ( !result.valid ) {

			const errorCount = result.issues.filter( i => i.severity === 'error' ).length;
			const proceed = confirm(
				`Track has ${errorCount} error(s). Launch anyway?`
			);

			if ( !proceed ) return false;

		}

		const url = this._shareLink.generatePlayUrl();
		window.open( url, '_blank' );
		return true;

	}

}

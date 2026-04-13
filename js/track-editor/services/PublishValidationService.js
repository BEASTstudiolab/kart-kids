export class PublishValidationService {

	constructor( validationService, project ) {

		this._validationService = validationService;
		this._project = project;

	}

	evaluate( gameplayMode, { title, creatorName } ) {

		const result = this._validationService.validate( gameplayMode );
		const blockers = [];
		const warnings = [];

		if ( ! String( title || '' ).trim() ) blockers.push( 'Track title is required.' );
		if ( ! String( creatorName || '' ).trim() ) blockers.push( 'Set a profile display name before publishing.' );
		if ( ! this._project || this._project.tileCount < 4 ) blockers.push( 'Track needs at least 4 placed tiles.' );

		for ( const issue of result.issues ) {

			if ( issue.severity === 'error' ) {

				blockers.push( issue.message );
				continue;

			}

			if ( issue.code === 'W_NO_SPAWNS' || issue.code === 'W_FEW_SPAWNS' ) {

				blockers.push( 'Published tracks need at least 2 spawn points for party play.' );
				continue;

			}

			warnings.push( issue.message );

		}

		return {
			ok: blockers.length === 0,
			blockers: [ ...new Set( blockers ) ],
			warnings: [ ...new Set( warnings ) ],
			result,
		};

	}

}

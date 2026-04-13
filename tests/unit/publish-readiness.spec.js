import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PublishValidationService } from '../../js/track-editor/services/PublishValidationService.js';

describe( 'PublishValidationService', () => {

	it( 'blocks publish when title or creator name is missing', () => {

		const service = new PublishValidationService( {
			validate() {

				return { valid: true, issues: [] };

			},
		}, { tileCount: 10 } );

		const result = service.evaluate( {}, { title: '', creatorName: '' } );

		assert.equal( result.ok, false );
		assert.ok( result.blockers.some( ( item ) => item.includes( 'Track title' ) ) );
		assert.ok( result.blockers.some( ( item ) => item.includes( 'profile display name' ) ) );

	} );

	it( 'treats spawn warnings as publish blockers while leaving soft warnings alone', () => {

		const service = new PublishValidationService( {
			validate() {

				return {
					valid: true,
					issues: [
						{ severity: 'warning', code: 'W_FEW_SPAWNS', message: '1 spawns for 4 racers' },
						{ severity: 'warning', code: 'W_NO_POWERUPS', message: 'No powerup spawns' },
					],
				};

			},
		}, { tileCount: 12 } );

		const result = service.evaluate( {}, { title: 'Test Track', creatorName: 'Caleb' } );

		assert.equal( result.ok, false );
		assert.ok( result.blockers.some( ( item ) => item.includes( '2 spawn points' ) ) );
		assert.ok( result.warnings.includes( 'No powerup spawns' ) );

	} );

	it( 'passes when the base validator is clean and publish blockers are satisfied', () => {

		const service = new PublishValidationService( {
			validate() {

				return { valid: true, issues: [] };

			},
		}, { tileCount: 18 } );

		const result = service.evaluate( {}, { title: 'Grand Loop', creatorName: 'Caleb' } );

		assert.equal( result.ok, true );
		assert.deepEqual( result.blockers, [] );

	} );

} );

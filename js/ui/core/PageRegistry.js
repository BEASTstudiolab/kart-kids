/**
 * PageRegistry.js
 * Registers all page controller factories with the RouterService.
 * Called by AppShell during bootstrap.
 */

import { RouteIds } from '../enums/RouteIds.js';

/**
 * Register all M2 page routes with the router.
 * Each factory returns a new controller instance.
 *
 * @param {import('./RouterService.js').RouterService} router
 * @param {object} services  — service bag from AppShell
 */
export function registerAllPages( router, services ) {

	// ── M2: Race Flow Pages ──────────────────────────────────────────────────

	router.register( RouteIds.TITLE, async () => {

		const { Page01TitleController } = await import( '../pages/page01-title/Page01TitleController.js' );
		return new Page01TitleController( services );

	} );

	router.register( RouteIds.HOME, async () => {

		const { Page02HomeController } = await import( '../pages/page02-home/Page02HomeController.js' );
		return new Page02HomeController( services );

	} );

	router.register( RouteIds.QUICK_PLAY, async () => {

		const { Page03QuickPlayController } = await import( '../pages/page03-quick-play/Page03QuickPlayController.js' );
		return new Page03QuickPlayController( services );

	} );

	router.register( RouteIds.PLAY, async () => {

		const { Page04PlayModesController } = await import( '../pages/page04-play-modes/Page04PlayModesController.js' );
		return new Page04PlayModesController( services );

	} );

	router.register( RouteIds.LOBBY, async () => {

		const { Page05LobbyController } = await import( '../pages/page05-lobby/Page05LobbyController.js' );
		return new Page05LobbyController( services );

	} );

	router.register( RouteIds.RESULTS, async () => {

		const { Page19ResultsController } = await import( '../pages/page19-results/Page19ResultsController.js' );
		return new Page19ResultsController( services );

	} );

	router.register( RouteIds.PAUSE, async () => {

		const { Page22PauseController } = await import( '../pages/page22-pause/Page22PauseController.js' );
		return new Page22PauseController( services );

	} );

	// ── M3: Garage / Character / Kart Select ────────────────────────────────

	router.register( RouteIds.GARAGE, async () => {

		const { Page09GarageController } = await import( '../pages/page09-garage/Page09GarageController.js' );
		return new Page09GarageController( {}, services );

	} );

	router.register( RouteIds.CHARACTERS, async () => {

		const { Page10CharacterSelectController } = await import( '../pages/page10-character-select/Page10CharacterSelectController.js' );
		return new Page10CharacterSelectController( {}, services );

	} );

	router.register( RouteIds.KARTS, async () => {

		const { Page11KartSelectController } = await import( '../pages/page11-kart-select/Page11KartSelectController.js' );
		return new Page11KartSelectController( {}, services );

	} );

	// ── Placeholder routes for pages not yet built ────────────────────────

	const placeholderRoutes = [
		RouteIds.PARTY, RouteIds.EVENTS, RouteIds.RANKED,
		RouteIds.PROFILE, RouteIds.CHALLENGES, RouteIds.SEASON,
		RouteIds.SHOP, RouteIds.CREATE, RouteIds.EDITOR,
		RouteIds.DISCOVER, RouteIds.INBOX, RouteIds.SETTINGS,
		RouteIds.TUTORIAL,
	];

	for ( const route of placeholderRoutes ) {

		router.register( route, async () => {

			// Lazy-load a generic placeholder controller
			const { PlaceholderController } = await import( './PlaceholderController.js' );
			return new PlaceholderController( services, route );

		} );

	}

}

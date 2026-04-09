/**
 * RouteIds — canonical route path constants.
 *
 * Every navigation call must reference these constants, never raw strings.
 * Matches the route table in KART_KIDS_UI_PRD_Codex.md §2.
 */

export const RouteIds = Object.freeze( {

	TITLE:      '/',
	HOME:       '/home',
	QUICK_PLAY: '/quick-play',
	PLAY:       '/play',
	LOBBY:      '/lobby',
	GARAGE:     '/garage',
	KARTS:      '/karts',
	PROFILE:    '/profile',
	CREATE:     '/create',
	RESULTS:    '/results',
	SETTINGS:   '/settings',
	PAUSE:      '/pause',

	// ── CUT v1 — Routes exist for backward compat but are NOT registered ──
	PARTY:      '/party',       // Replaced by Lobby room system
	EVENTS:     '/events',      // Needs backend scheduling
	RANKED:     '/ranked',      // Needs ranked infrastructure
	CHARACTERS: '/characters',  // Only 1 character exists
	CHALLENGES: '/challenges',  // Needs backend scheduling
	SEASON:     '/season',      // Needs season pass infrastructure
	SHOP:       '/shop',        // Needs shop infrastructure
	EDITOR:     '/editor',      // Track editor stays separate
	DISCOVER:   '/discover',    // Needs UGC platform
	INBOX:      '/inbox',       // Needs messaging infrastructure
	TUTORIAL:   '/tutorial',    // Deferred

} );

/**
 * PageIds.js
 * Kart Kids — Page identifier constants for all 23 PRD screens.
 *
 * Used by:
 *   - Page controllers (self-identify)
 *   - AnalyticsService (page_view events)
 *   - QA instrumentation (assert correct page mounted)
 *   - RouterService (map routes to page factories)
 *
 * Naming: SCREAMING_SNAKE_CASE key, lowercase snake_case string value.
 * Prefix convention: page number is embedded so IDs sort and scan in PRD order.
 *
 * Usage:
 *   import { PageIds } from '../enums/PageIds.js';
 *   analyticsService.trackPageView(PageIds.TITLE);
 */

export const PageIds = Object.freeze( {

	/** 01 — Title Screen / Start Screen */
	TITLE:        'page_01_title',

	/** 02 — Home / Main Menu */
	HOME:         'page_02_home',

	/** 03 — Quick Play */
	QUICK_PLAY:   'page_03_quick_play',

	/** 04 — Play Modes */
	PLAY_MODES:   'page_04_play_modes',

	/** 05 — Lobby / Pre-Race Room */
	LOBBY:        'page_05_lobby',

	/** 06 — Party / Friends */
	PARTY:        'page_06_party',

	/** 07 — Tournaments / Events */
	EVENTS:       'page_07_events',

	/** 08 — Ranked / Competitive */
	RANKED:       'page_08_ranked',

	/** 09 — Garage */
	GARAGE:       'page_09_garage',

	/** 10 — Character Select */
	CHARACTERS:   'page_10_characters',

	/** 11 — Kart Select */
	KARTS:        'page_11_karts',

	/** 12 — Player Profile / Career */
	PROFILE:      'page_12_profile',

	/** 13 — Challenges / Quests */
	CHALLENGES:   'page_13_challenges',

	/** 14 — Rewards / Season Pass */
	SEASON:       'page_14_season',

	/** 15 — Shop / Store */
	SHOP:         'page_15_shop',

	/** 16 — Track Builder / Create Hub */
	CREATE_HUB:   'page_16_create_hub',

	/** 17 — Track Editor */
	TRACK_EDITOR: 'page_17_track_editor',

	/** 18 — Community Tracks / Discover */
	DISCOVER:     'page_18_discover',

	/** 19 — Results / Post-Race */
	RESULTS:      'page_19_results',

	/** 20 — Notifications / Inbox */
	INBOX:        'page_20_inbox',

	/** 21 — Settings */
	SETTINGS:     'page_21_settings',

	/** 22 — Pause Menu */
	PAUSE:        'page_22_pause',

	/** 23 — Onboarding / Tutorial */
	TUTORIAL:     'page_23_tutorial',

} );

/**
 * ButtonIds.js
 * Kart Kids — Button and interactive-element identifier constants.
 *
 * Covers every named CTA, tab selector, toggle, and action control across all
 * 23 PRD screens. Written to data-action attributes on DOM elements and used by
 * page controllers to bind handlers without anonymous inline logic.
 *
 * Used by:
 *   - CTAButton.actionId prop (written to data-action)
 *   - ButtonBar button entries
 *   - Tab selectors (written to data-tab-id)
 *   - Page controller bindEvents() switch statements
 *   - AnalyticsService (button_clicked events)
 *   - QA instrumentation (assert button is present and wired)
 *
 * Naming: SCREAMING_SNAKE_CASE key, snake_case string value.
 * Grouped by page. Tab selectors are included (PRD §4 specifies full QA coverage).
 *
 * Usage:
 *   import { ButtonIds } from '../enums/ButtonIds.js';
 *   new CTAButton({ label: 'QUICK PLAY', actionId: ButtonIds.HOME_QUICK_PLAY, ... });
 */

export const ButtonIds = Object.freeze( {

	// ================================================================
	// 01 — Title Screen
	// ================================================================

	TITLE_PRESS_START:    'title_press_start',
	TITLE_SIGN_IN:        'title_sign_in',
	TITLE_SETTINGS:       'title_settings',
	TITLE_ACCESSIBILITY:  'title_accessibility',
	TITLE_LANGUAGE:       'title_language',
	TITLE_FEATURED_EVENT: 'title_featured_event',

	// ================================================================
	// 02 — Home / Main Menu
	// ================================================================

	HOME_QUICK_PLAY:       'home_quick_play',
	HOME_PLAY_MODES:       'home_play_modes',
	HOME_PARTY:            'home_party',
	HOME_GARAGE:           'home_garage',
	HOME_CREATE:           'home_create',
	HOME_PROFILE:          'home_profile',
	HOME_SHOP:             'home_shop',
	HOME_SETTINGS:         'home_settings',
	HOME_FEATURED_EVENT:   'home_featured_event',
	HOME_DAILY_CHALLENGES: 'home_daily_challenges',
	HOME_CURRENT_LOADOUT:  'home_current_loadout',

	// ================================================================
	// 03 — Quick Play
	// ================================================================

	QUICK_PLAY_SELECTED_CHARACTER: 'quick_play_selected_character',
	QUICK_PLAY_SELECTED_KART:      'quick_play_selected_kart',
	QUICK_PLAY_TRACK_SELECT:       'quick_play_track_select',
	QUICK_PLAY_MATCH_TYPE:         'quick_play_match_type',
	QUICK_PLAY_RACE_RULES:         'quick_play_race_rules',
	QUICK_PLAY_BOT_FILL:           'quick_play_bot_fill',
	QUICK_PLAY_START_RACE:         'quick_play_start_race',

	// ================================================================
	// 04 — Play Modes
	// ================================================================

	PLAY_MODES_GRAND_PRIX:   'play_modes_grand_prix',
	PLAY_MODES_SINGLE_RACE:  'play_modes_single_race',
	PLAY_MODES_TIME_TRIAL:   'play_modes_time_trial',
	PLAY_MODES_BATTLE_MODE:  'play_modes_battle_mode',
	PLAY_MODES_TEAM_RACE:    'play_modes_team_race',
	PLAY_MODES_ELIMINATION:  'play_modes_elimination',
	PLAY_MODES_TOURNAMENTS:  'play_modes_tournaments',
	PLAY_MODES_RANKED:       'play_modes_ranked',
	PLAY_MODES_CUSTOM_GAME:  'play_modes_custom_game',

	// ================================================================
	// 05 — Lobby / Pre-Race Room
	// ================================================================

	LOBBY_INVITE_FRIENDS:  'lobby_invite_friends',
	LOBBY_PLAYER_LOADOUT:  'lobby_player_loadout',
	LOBBY_TRACK_VOTE:      'lobby_track_vote',
	LOBBY_READY_STATUS:    'lobby_ready_status',
	LOBBY_START_MATCH:     'lobby_start_match',

	// ================================================================
	// 06 — Party / Friends
	// ================================================================

	PARTY_INVITE:          'party_invite',
	PARTY_JOIN_SESSION:    'party_join_session',
	PARTY_MEMBER_ACTIONS:  'party_member_actions',
	PARTY_PRIVACY:         'party_privacy',

	// ================================================================
	// 07 — Tournaments / Events
	// Tab selectors included per QA instrumentation requirements.
	// ================================================================

	EVENTS_TAB_LIVE:       'events_tab_live',
	EVENTS_TAB_DAILY:      'events_tab_daily',
	EVENTS_TAB_WEEKLY:     'events_tab_weekly',
	EVENTS_SEASON_TOUR:    'events_season_tour',
	EVENTS_REWARDS:        'events_rewards',
	EVENTS_LEADERBOARD:    'events_leaderboard',
	EVENTS_ENTER_EVENT:    'events_enter_event',

	// ================================================================
	// 08 — Ranked / Competitive
	// ================================================================

	RANKED_QUEUE:          'ranked_queue',
	RANKED_MATCH_HISTORY:  'ranked_match_history',
	RANKED_TIER_REWARDS:   'ranked_tier_rewards',
	RANKED_LEADERBOARD:    'ranked_leaderboard',
	RANKED_RULES:          'ranked_rules',

	// ================================================================
	// 09 — Garage
	// Tab selectors included per QA instrumentation requirements.
	// ================================================================

	GARAGE_TAB_CHARACTERS:  'garage_tab_characters',
	GARAGE_TAB_KARTS:       'garage_tab_karts',
	GARAGE_TAB_PAINT:       'garage_tab_paint',
	GARAGE_TAB_WHEELS:      'garage_tab_wheels',
	GARAGE_TAB_ACCESSORIES: 'garage_tab_accessories',
	GARAGE_TAB_EMOTES:      'garage_tab_emotes',
	GARAGE_SAVE_PRESET:     'garage_save_preset',
	GARAGE_VIEW_ROTATE:     'garage_view_rotate',
	GARAGE_VIEW_INSPECT:    'garage_view_inspect',
	GARAGE_LOADOUT:         'garage_loadout',

	// ================================================================
	// 10 — Character Select
	// ================================================================

	CHARACTER_SELECT_SKINS:  'character_select_skins',
	CHARACTER_SELECT_CONFIRM: 'character_select_confirm',
	CHARACTER_SELECT_LOCKED: 'character_select_locked',

	// ================================================================
	// 11 — Kart Select
	// ================================================================

	KART_SELECT_TEST_DRIVE: 'kart_select_test_drive',
	KART_SELECT_CONFIRM:    'kart_select_confirm',

	// ================================================================
	// 12 — Player Profile / Career
	// Tab selectors included per QA instrumentation requirements.
	// ================================================================

	PROFILE_TAB_ACHIEVEMENTS: 'profile_tab_achievements',
	PROFILE_TAB_BADGES:       'profile_tab_badges',
	PROFILE_TAB_HISTORY:      'profile_tab_history',
	PROFILE_EDIT:             'profile_edit',
	PROFILE_FAVORITE_LOADOUT: 'profile_favorite_loadout',

	// ================================================================
	// 13 — Challenges / Quests
	// Tab selectors included per QA instrumentation requirements.
	// ================================================================

	CHALLENGES_TAB_DAILY:    'challenges_tab_daily',
	CHALLENGES_TAB_WEEKLY:   'challenges_tab_weekly',
	CHALLENGES_TAB_SEASONAL: 'challenges_tab_seasonal',
	CHALLENGES_TAB_MILESTONES: 'challenges_tab_milestones',
	CHALLENGES_CLAIM:        'challenges_claim',
	CHALLENGES_REWARDS:      'challenges_rewards',

	// ================================================================
	// 14 — Rewards / Season Pass
	// Tab selectors included per QA instrumentation requirements.
	// ================================================================

	SEASON_TAB_FREE:       'season_tab_free',
	SEASON_TAB_PREMIUM:    'season_tab_premium',
	SEASON_CLAIM_REWARD:   'season_claim_reward',
	SEASON_MISSIONS:       'season_missions',

	// ================================================================
	// 15 — Shop / Store
	// Tab selectors included per QA instrumentation requirements.
	// ================================================================

	SHOP_TAB_FEATURED:    'shop_tab_featured',
	SHOP_TAB_CHARACTERS:  'shop_tab_characters',
	SHOP_TAB_KARTS:       'shop_tab_karts',
	SHOP_TAB_COSMETICS:   'shop_tab_cosmetics',
	SHOP_TAB_BUNDLES:     'shop_tab_bundles',
	SHOP_TAB_CURRENCY:    'shop_tab_currency',
	SHOP_PURCHASE:        'shop_purchase',

	// ================================================================
	// 16 — Track Builder / Create Hub
	// Tab selectors included per QA instrumentation requirements.
	// ================================================================

	CREATE_NEW_TRACK:           'create_new_track',
	CREATE_TAB_MY_TRACKS:       'create_tab_my_tracks',
	CREATE_TAB_DRAFTS:          'create_tab_drafts',
	CREATE_TAB_PUBLISHED:       'create_tab_published',
	CREATE_FEATURED_TRACKS:     'create_featured_tracks',
	CREATE_STARTER_TEMPLATES:   'create_starter_templates',
	CREATE_EDIT_TRACK:          'create_edit_track',

	// ================================================================
	// 17 — Track Editor
	// Palette tab selectors + toolbar actions included.
	// ================================================================

	EDITOR_TAB_ROAD_PIECES: 'editor_tab_road_pieces',
	EDITOR_TAB_TURNS:       'editor_tab_turns',
	EDITOR_TAB_RAMPS:       'editor_tab_ramps',
	EDITOR_TAB_BRIDGES:     'editor_tab_bridges',
	EDITOR_TAB_TUNNELS:     'editor_tab_tunnels',
	EDITOR_TAB_JUMPS:       'editor_tab_jumps',
	EDITOR_TAB_PROPS:       'editor_tab_props',
	EDITOR_UNDO:            'editor_undo',
	EDITOR_REDO:            'editor_redo',
	EDITOR_SAVE:            'editor_save',
	EDITOR_TEST_DRIVE:      'editor_test_drive',
	EDITOR_PUBLISH:         'editor_publish',
	EDITOR_VALIDATION:      'editor_validation',

	// ================================================================
	// 18 — Community Tracks / Discover
	// Filter tab selectors included.
	// ================================================================

	DISCOVER_TAB_FEATURED:  'discover_tab_featured',
	DISCOVER_TAB_POPULAR:   'discover_tab_popular',
	DISCOVER_TAB_NEWEST:    'discover_tab_newest',
	DISCOVER_TAB_FRIENDS:   'discover_tab_friends',
	DISCOVER_TAB_FAVORITES: 'discover_tab_favorites',
	DISCOVER_SEARCH:        'discover_search',
	DISCOVER_CREATOR:       'discover_creator',
	DISCOVER_PLAY_NOW:      'discover_play_now',

	// ================================================================
	// 19 — Results / Post-Race
	// ================================================================

	RESULTS_REMATCH:          'results_rematch',
	RESULTS_NEXT_RACE:        'results_next_race',
	RESULTS_RETURN_TO_LOBBY:  'results_return_to_lobby',
	RESULTS_REWARDS_EARNED:   'results_rewards_earned',
	RESULTS_CHALLENGE_PROGRESS: 'results_challenge_progress',

	// ================================================================
	// 20 — Notifications / Inbox
	// Tab selectors included.
	// ================================================================

	INBOX_TAB_MESSAGES:       'inbox_tab_messages',
	INBOX_TAB_REWARDS:        'inbox_tab_rewards',
	INBOX_TAB_EVENT_NOTICES:  'inbox_tab_event_notices',
	INBOX_TAB_SYSTEM:         'inbox_tab_system',
	INBOX_CLAIM:              'inbox_claim',
	INBOX_CLAIM_ALL:          'inbox_claim_all',

	// ================================================================
	// 21 — Settings
	// Tab selectors included.
	// ================================================================

	SETTINGS_TAB_GAMEPLAY:     'settings_tab_gameplay',
	SETTINGS_TAB_CONTROLS:     'settings_tab_controls',
	SETTINGS_TAB_AUDIO:        'settings_tab_audio',
	SETTINGS_TAB_VIDEO:        'settings_tab_video',
	SETTINGS_TAB_ACCESSIBILITY: 'settings_tab_accessibility',
	SETTINGS_TAB_ACCOUNT:      'settings_tab_account',
	SETTINGS_TAB_PRIVACY:      'settings_tab_privacy',
	SETTINGS_TAB_CREDITS:      'settings_tab_credits',
	SETTINGS_APPLY:            'settings_apply',
	SETTINGS_RESET:            'settings_reset',

	// ================================================================
	// 22 — Pause Menu
	// ================================================================

	PAUSE_RESUME:     'pause_resume',
	PAUSE_RESTART:    'pause_restart',
	PAUSE_SETTINGS:   'pause_settings',
	PAUSE_CONTROLS:   'pause_controls',
	PAUSE_LEAVE_RACE: 'pause_leave_race',

	// ================================================================
	// 23 — Onboarding / Tutorial
	// Step tab selectors included.
	// ================================================================

	TUTORIAL_TAB_BASIC_CONTROLS: 'tutorial_tab_basic_controls',
	TUTORIAL_TAB_DRIFT:          'tutorial_tab_drift',
	TUTORIAL_TAB_BOOST:          'tutorial_tab_boost',
	TUTORIAL_TAB_ITEM_USE:       'tutorial_tab_item_use',
	TUTORIAL_PRACTICE:           'tutorial_practice',
	TUTORIAL_SKIP:               'tutorial_skip',

	// ================================================================
	// Global / Shared
	// Buttons that appear across multiple pages (TopNav, global chrome).
	// ================================================================

	/** TopNav primary nav links (mirror RouteIds for binding convenience) */
	NAV_QUICK_PLAY:  'nav_quick_play',
	NAV_PLAY:        'nav_play',
	NAV_PARTY:       'nav_party',
	NAV_GARAGE:      'nav_garage',
	NAV_CREATE:      'nav_create',
	NAV_PROFILE:     'nav_profile',
	NAV_SHOP:        'nav_shop',
	NAV_SETTINGS:    'nav_settings',

	/** PageHeader back button */
	GLOBAL_BACK:     'global_back',

	/** ConfirmationDialog shared actions */
	CONFIRM_PROCEED: 'confirm_proceed',
	CONFIRM_CANCEL:  'confirm_cancel',

	/** Shared claim action used in modals across Challenges/Inbox/Season */
	MODAL_CLAIM_REWARD: 'modal_claim_reward',

	/** Purchase confirmation modal */
	MODAL_PURCHASE_CONFIRM: 'modal_purchase_confirm',
	MODAL_PURCHASE_CANCEL:  'modal_purchase_cancel',

} );

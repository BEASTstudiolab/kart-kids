/**
 * EventIds.js
 * Kart Kids — Analytics event identifier constants.
 *
 * Every AnalyticsService.track() call must reference these constants, never
 * raw strings. Provides a single source of truth for the full event taxonomy.
 *
 * Used by:
 *   - AnalyticsService.track( EventIds.PAGE_VIEWED, { page } )
 *   - Page controllers and component handlers
 *   - ModalService (MODAL_OPENED / MODAL_CLOSED)
 *   - QA coverage maps (assert all defined events fire at least once per session)
 *
 * Naming: SCREAMING_SNAKE_CASE key, snake_case string value.
 * Grouped by screen / feature area matching PRD section order.
 */

export const EventIds = Object.freeze( {

	// ================================================================
	// Title
	// ================================================================

	START_GAME_CLICKED: 'start_game_clicked',
	SIGN_IN_CLICKED:    'sign_in_clicked',

	// ================================================================
	// Navigation
	// ================================================================

	NAV_ITEM_CLICKED: 'nav_item_clicked',
	PAGE_VIEWED:      'page_viewed',
	BACK_CLICKED:     'back_clicked',

	// ================================================================
	// Quick Play
	// ================================================================

	QUICK_PLAY_STARTED: 'quick_play_started',
	CHARACTER_SELECTED: 'character_selected',
	KART_SELECTED:      'kart_selected',
	TRACK_SELECTED:     'track_selected',

	// ================================================================
	// Play Modes
	// ================================================================

	MODE_SELECTED: 'mode_selected',

	// ================================================================
	// Lobby
	// ================================================================

	LOBBY_READY_TOGGLED: 'lobby_ready_toggled',
	LOBBY_INVITE_SENT:   'lobby_invite_sent',
	MATCH_STARTED:       'match_started',
	TRACK_VOTED:         'track_voted',

	// ================================================================
	// Party
	// ================================================================

	FRIEND_INVITED:        'friend_invited',
	SESSION_JOINED:        'session_joined',
	PARTY_PRIVACY_CHANGED: 'party_privacy_changed',

	// ================================================================
	// Events
	// ================================================================

	EVENT_OPENED:  'event_opened',
	EVENT_ENTERED: 'event_entered',

	// ================================================================
	// Ranked
	// ================================================================

	RANKED_QUEUE_STARTED: 'ranked_queue_started',
	LEADERBOARD_VIEWED:   'leaderboard_viewed',

	// ================================================================
	// Garage
	// ================================================================

	GARAGE_ITEM_EQUIPPED: 'garage_item_equipped',
	GARAGE_PRESET_SAVED:  'garage_preset_saved',
	GARAGE_TAB_CHANGED:   'garage_tab_changed',

	// ================================================================
	// Characters
	// ================================================================

	CHARACTER_EQUIPPED:      'character_equipped',
	CHARACTER_SKIN_VIEWED:   'character_skin_viewed',

	// ================================================================
	// Karts
	// ================================================================

	KART_EQUIPPED:      'kart_equipped',
	TEST_DRIVE_STARTED: 'test_drive_started',

	// ================================================================
	// Profile
	// ================================================================

	PROFILE_EDITED:      'profile_edited',
	ACHIEVEMENT_VIEWED:  'achievement_viewed',

	// ================================================================
	// Challenges
	// ================================================================

	CHALLENGE_CLAIMED:      'challenge_claimed',
	CHALLENGE_TAB_CHANGED:  'challenge_tab_changed',

	// ================================================================
	// Season
	// ================================================================

	SEASON_REWARD_CLAIMED: 'season_reward_claimed',
	PREMIUM_PASS_VIEWED:   'premium_pass_viewed',

	// ================================================================
	// Shop
	// ================================================================

	SHOP_ITEM_VIEWED:        'shop_item_viewed',
	SHOP_PURCHASE_STARTED:   'shop_purchase_started',
	SHOP_PURCHASE_COMPLETED: 'shop_purchase_completed',
	SHOP_TAB_CHANGED:        'shop_tab_changed',

	// ================================================================
	// Create
	// ================================================================

	NEW_TRACK_STARTED: 'new_track_started',
	TRACK_PUBLISHED:   'track_published',
	TRACK_SAVED:       'track_saved',
	TRACK_TESTED:      'track_tested',

	// ================================================================
	// Discover
	// ================================================================

	COMMUNITY_TRACK_PLAYED:    'community_track_played',
	COMMUNITY_TRACK_SEARCHED:  'community_track_searched',

	// ================================================================
	// Results
	// ================================================================

	REMATCH_CLICKED:    'rematch_clicked',
	NEXT_RACE_CLICKED:  'next_race_clicked',
	REWARD_CLAIMED:     'reward_claimed',

	// ================================================================
	// Inbox
	// ================================================================

	INBOX_CLAIMED:     'inbox_claimed',
	INBOX_CLAIMED_ALL: 'inbox_claimed_all',

	// ================================================================
	// Settings
	// ================================================================

	SETTINGS_CHANGED: 'settings_changed',
	SETTINGS_RESET:   'settings_reset',

	// ================================================================
	// Tutorial
	// ================================================================

	TUTORIAL_STEP_COMPLETED:    'tutorial_step_completed',
	TUTORIAL_SKIPPED:           'tutorial_skipped',
	TUTORIAL_PRACTICE_STARTED:  'tutorial_practice_started',

	// ================================================================
	// Pause
	// ================================================================

	GAME_PAUSED:    'game_paused',
	GAME_RESUMED:   'game_resumed',
	GAME_RESTARTED: 'game_restarted',
	GAME_LEFT:      'game_left',

	// ================================================================
	// Modal
	// ================================================================

	MODAL_OPENED:               'modal_opened',
	MODAL_CLOSED:               'modal_closed',
	CONFIRM_DIALOG_CONFIRMED:   'confirm_dialog_confirmed',
	CONFIRM_DIALOG_CANCELLED:   'confirm_dialog_cancelled',

} );

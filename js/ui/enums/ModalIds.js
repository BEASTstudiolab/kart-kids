/**
 * ModalIds.js
 * Kart Kids — Modal dialog identifier constants.
 *
 * Every modal open/close call must reference these constants, never raw strings.
 * Passed to ModalService.open() and used as keys in the modal registry.
 *
 * Used by:
 *   - ModalService.open( ModalIds.TRACK_PICKER, payload )
 *   - Page controllers triggering confirmation dialogs
 *   - AnalyticsService (MODAL_OPENED / MODAL_CLOSED events via EventIds)
 *   - QA instrumentation (assert modal mounts and unmounts cleanly)
 *
 * Naming: SCREAMING_SNAKE_CASE key, snake_case string value.
 * Grouped by functional category.
 */

export const ModalIds = Object.freeze( {

	// ================================================================
	// Auth
	// ================================================================

	SIGN_IN: 'sign_in',

	// ================================================================
	// Race Flow
	// ================================================================

	TRACK_PICKER: 'track_picker',
	MATCH_TYPE:   'match_type',
	RACE_RULES:   'race_rules',

	// ================================================================
	// Confirmations
	// ================================================================

	LEAVE_CONFIRM:    'leave_confirm',
	RESTART_CONFIRM:  'restart_confirm',
	PURCHASE_CONFIRM: 'purchase_confirm',
	RESET_CONFIRM:    'reset_confirm',
	UNSAVED_WARNING:  'unsaved_warning',

	// ================================================================
	// Rewards
	// ================================================================

	CLAIM_REWARD: 'claim_reward',
	BATCH_CLAIM:  'batch_claim',

	// ================================================================
	// Creation
	// ================================================================

	PUBLISH_TRACK:   'publish_track',
	TEMPLATE_PICKER: 'template_picker',

	// ================================================================
	// Social
	// ================================================================

	MEMBER_ACTIONS: 'member_actions',
	PARTY_PRIVACY:  'party_privacy',

	// ================================================================
	// Profile
	// ================================================================

	EDIT_PROFILE: 'edit_profile',

	// ================================================================
	// Ranked
	// ================================================================

	RANK_RULES:  'rank_rules',
	LEADERBOARD: 'leaderboard',

	// ================================================================
	// Garage
	// ================================================================

	SAVE_PRESET: 'save_preset',

	// ================================================================
	// Creator
	// ================================================================

	CREATOR_PROFILE: 'creator_profile',

} );

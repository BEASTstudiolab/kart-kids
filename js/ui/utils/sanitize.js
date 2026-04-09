/**
 * sanitize.js — XSS sanitization utilities for player-sourced strings.
 *
 * Used wherever WebSocket data (player names, chat, etc.) is rendered in the DOM.
 * These functions strip dangerous content and enforce length limits.
 */

/**
 * Sanitize a player name for safe DOM rendering.
 *
 * - Trims leading/trailing whitespace
 * - Strips all HTML tags (including script, style, event handlers)
 * - Truncates to maxLength characters
 * - Returns a fallback if the result is empty
 *
 * @param {string} str           Raw player name from network
 * @param {number} [maxLength]   Maximum allowed characters (default 20)
 * @param {string} [fallback]    Fallback if result is empty (default 'Player')
 * @returns {string}             Safe string for use with textContent or setAttribute
 */
export function sanitizePlayerName( str, maxLength = 20, fallback = 'Player' ) {

	if ( typeof str !== 'string' ) return fallback;

	// Strip HTML tags
	const stripped = str.replace( /<[^>]*>/g, '' );

	// Trim and truncate
	const trimmed = stripped.trim().slice( 0, maxLength );

	return trimmed.length > 0 ? trimmed : fallback;

}

/**
 * Sanitize an arbitrary string for safe DOM text rendering.
 *
 * Strips HTML tags and trims whitespace. No length limit by default.
 *
 * @param {string} str           Raw string from untrusted source
 * @param {number} [maxLength]   Optional max length (0 = unlimited)
 * @returns {string}             Safe string
 */
export function sanitizeText( str, maxLength = 0 ) {

	if ( typeof str !== 'string' ) return '';

	const stripped = str.replace( /<[^>]*>/g, '' ).trim();

	if ( maxLength > 0 ) return stripped.slice( 0, maxLength );

	return stripped;

}

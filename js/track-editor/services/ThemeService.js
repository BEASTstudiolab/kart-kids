// ─── ThemeService ────────────────────────────────────────────────────────────
// Theme registry + project metadata normalization for the track editor.

import {
	getAvailableTrackThemes,
	normalizeTrackThemeId,
} from '../../TrackThemeRegistry.js';

const RACE_TYPES = [
	{ id: 'circuit',        name: 'Circuit Race',     description: 'Multiple laps around a closed loop' },
	{ id: 'sprint',         name: 'Sprint',            description: 'Point A to point B, no loop needed' },
	{ id: 'time-trial',     name: 'Time Trial',        description: 'Solo lap against the clock' },
	{ id: 'battle-arena',   name: 'Battle Arena',      description: 'Open arena, no track loop required' },
	{ id: 'elimination',    name: 'Elimination',       description: 'Last place eliminated each lap' },
	{ id: 'team-race',      name: 'Team Race',         description: 'Teams compete for combined score' },
	{ id: 'drift-trial',    name: 'Drift Trial',       description: 'Score points for drifting' },
	{ id: 'stunt-challenge', name: 'Stunt / Challenge', description: 'Trick jumps and stunts for points' },
];

export class ThemeService {

	constructor( project, options = {} ) {

		this._project = project;
		this._onThemeChanged = typeof options.onThemeChanged === 'function' ? options.onThemeChanged : null;

	}

	/**
	 * Get all themes (including unavailable ones).
	 * @returns {Array<{ id: string, name: string, available: boolean, description: string }>}
	 */
	getAvailableThemes() {

		return getAvailableTrackThemes();

	}

	/**
	 * Set the active theme.
	 * @param {string} themeId
	 */
	async setTheme( themeId ) {

		const resolvedThemeId = normalizeTrackThemeId( themeId );
		this._project.meta.themeId = resolvedThemeId;

		if ( this._onThemeChanged ) {

			await this._onThemeChanged( resolvedThemeId );

		}

		return resolvedThemeId;

	}

	/**
	 * Normalize and re-apply the current theme.
	 * @returns {Promise<string>}
	 */
	async applyCurrentTheme() {

		return this.setTheme( this._project.meta.themeId );

	}

	/**
	 * Get all race types.
	 * @returns {Array<{ id: string, name: string, description: string }>}
	 */
	getRaceTypes() {

		return RACE_TYPES;

	}

	/**
	 * Get time-of-day presets (delegates to LightingService for actual application).
	 * @returns {Array<{ id: string, name: string }>}
	 */
	getTimeOfDayPresets() {

		return [
			{ id: 'night', name: 'Night' },
			{ id: 'day', name: 'Day' },
			{ id: 'sunset', name: 'Sunset' },
			{ id: 'dawn', name: 'Dawn' },
			{ id: 'overcast', name: 'Overcast' },
		];

	}

}

export { RACE_TYPES };

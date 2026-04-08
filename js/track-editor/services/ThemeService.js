// ─── ThemeService ────────────────────────────────────────────────────────────
// Theme registry and material swapping. Currently only city-night has assets.
// Other themes are registered as unavailable (grayed out in UI) — ready for
// when art assets are produced.

const THEMES = [
	{ id: 'city-night',    name: 'City Night',     available: true,  description: 'Urban night racing with neon accents' },
	{ id: 'city-day',      name: 'City Day',        available: false, description: 'Bright urban daytime circuit' },
	{ id: 'beach',         name: 'Beach',            available: false, description: 'Coastal track with sand and palms' },
	{ id: 'jungle',        name: 'Jungle',           available: false, description: 'Dense tropical jungle course' },
	{ id: 'space',         name: 'Space',            available: false, description: 'Zero-gravity space station track' },
	{ id: 'volcano',       name: 'Volcano',          available: false, description: 'Volcanic terrain with lava hazards' },
	{ id: 'frozen',        name: 'Frozen',           available: false, description: 'Ice and snow winter circuit' },
	{ id: 'underwater',    name: 'Underwater',       available: false, description: 'Deep sea tube racing' },
	{ id: 'retro-neon',    name: 'Retro / Neon',     available: false, description: 'Synthwave neon grid aesthetic' },
];

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

	constructor( project ) {

		this._project = project;

	}

	/**
	 * Get all themes (including unavailable ones).
	 * @returns {Array<{ id: string, name: string, available: boolean, description: string }>}
	 */
	getAvailableThemes() {

		return THEMES;

	}

	/**
	 * Set the active theme.
	 * @param {string} themeId
	 */
	setTheme( themeId ) {

		const theme = THEMES.find( t => t.id === themeId );
		if ( ! theme || ! theme.available ) return;

		this._project.meta.themeId = themeId;
		// Future: swap materials on all tile meshes based on theme texture atlas

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

export { THEMES, RACE_TYPES };

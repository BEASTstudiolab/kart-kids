/**
 * Central registry of all player-selectable vehicles and characters.
 * To add a new vehicle: add an entry to PLAYER_VEHICLES and its GLTF to models/vehicles/.
 * To add a new character: add an entry to PLAYER_CHARACTERS and its GLB to models/characters/.
 */

/**
 * @typedef {Object} VehicleStats
 * @property {number} speed - Top speed rating (1-10)
 * @property {number} handling - Cornering responsiveness (1-10)
 * @property {number} acceleration - 0-to-max ramp-up (1-10)
 * @property {number} weight - Mass / knockback resistance (1-10)
 * @property {number} boost - Boost power and duration (1-10)
 */

export const PLAYER_VEHICLES = Object.freeze( [
	Object.freeze( {
		id: 'kart-1',
		label: 'Kart 1',
		path: 'vehicles/BaseRaceKart1.gltf',
		bodyHeight: 0.35,
		characterOffset: { x: 0, y: - 0.55, z: 0.31 },
		stats: Object.freeze( { speed: 6, handling: 7, acceleration: 7, weight: 5, boost: 6 } ),
	} ),
	Object.freeze( {
		id: 'kart-2',
		label: 'Kart 2',
		path: 'vehicles/BaseRaceKart2.gltf',
		bodyHeight: 0.35,
		characterOffset: { x: 0, y: - 0.60, z: 0.24 },
		stats: Object.freeze( { speed: 7, handling: 5, acceleration: 6, weight: 7, boost: 7 } ),
	} ),
	Object.freeze( {
		id: 'kart-3',
		label: 'Kart 3',
		path: 'vehicles/BaseRaceKart3.gltf',
		bodyHeight: 0.6,
		characterOffset: { x: 0, y: - 0.34, z: 0.31 },
		stats: Object.freeze( { speed: 8, handling: 4, acceleration: 5, weight: 8, boost: 8 } ),
	} ),
	Object.freeze( {
		id: 'kart-4',
		label: 'Kart 4',
		path: 'vehicles/BaseRaceKart4.gltf',
		bodyHeight: 0.35,
		characterOffset: { x: 0, y: - 0.55, z: 0.37 },
		stats: Object.freeze( { speed: 5, handling: 8, acceleration: 8, weight: 4, boost: 5 } ),
	} ),
	Object.freeze( {
		id: 'kart-5',
		label: 'Kart 5',
		path: 'vehicles/BaseRaceKart5.gltf',
		bodyHeight: - 0.22,
		characterOffset: { x: 0, y: - 0.55, z: 0.40 },
		stats: Object.freeze( { speed: 9, handling: 3, acceleration: 4, weight: 9, boost: 9 } ),
	} ),
	Object.freeze( {
		id: 'kart-6',
		label: 'Kart 6',
		path: 'vehicles/BaseRaceKart6.gltf',
		bodyHeight: 0,
		characterOffset: { x: 0, y: - 0.40, z: 0.36 },
		stats: Object.freeze( { speed: 6, handling: 6, acceleration: 6, weight: 6, boost: 6 } ),
	} ),
	Object.freeze( {
		id: 'kart-7',
		label: 'Kart 7',
		path: 'vehicles/BaseRaceKart7.gltf',
		bodyHeight: 0.90,
		characterOffset: { x: 0, y: - 0.4, z: 0.33 },
		stats: Object.freeze( { speed: 4, handling: 9, acceleration: 9, weight: 3, boost: 4 } ),
	} ),
	Object.freeze( {
		id: 'kart-8',
		label: 'Kart 8',
		path: 'vehicles/BaseRaceKart8.gltf',
		bodyHeight: 0.70,
		characterOffset: { x: 0, y: - 0.38, z: 0.32 },
		stats: Object.freeze( { speed: 7, handling: 6, acceleration: 5, weight: 8, boost: 7 } ),
	} ),
] );

export const PLAYER_CHARACTERS = Object.freeze( [
	Object.freeze( {
		id: 'kart-beast',
		label: 'The Beast',
		path: 'characters/Kart_Beast_Rest-Armature.glb',
	} ),
] );

export const PLAYER_CHARACTER_ID = 'kart-beast';
export const PLAYER_CHARACTER_PATH = 'characters/Kart_Beast_Rest-Armature.glb';

/**
 * Look up a vehicle entry by id. Falls back to the first vehicle if not found.
 * @param {string} id
 * @returns {Object}
 */
export function getVehicleById( id ) {

	return PLAYER_VEHICLES.find( ( v ) => v.id === id ) || PLAYER_VEHICLES[ 0 ];

}

/**
 * Return the full list of selectable vehicles.
 * @returns {ReadonlyArray<Object>}
 */
export function getAllVehicles() {

	return PLAYER_VEHICLES;

}

/**
 * Return stats for a vehicle by id, or null if not found.
 * @param {string} id
 * @returns {VehicleStats|null}
 */
export function getVehicleStats( id ) {

	const vehicle = PLAYER_VEHICLES.find( ( v ) => v.id === id );
	return vehicle ? vehicle.stats : null;

}

/**
 * Return the full list of selectable characters.
 * @returns {ReadonlyArray<Object>}
 */
export function getAllCharacters() {

	return PLAYER_CHARACTERS;

}

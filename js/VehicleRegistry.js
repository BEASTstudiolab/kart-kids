/**
 * Central registry of all player-selectable vehicles.
 * To add a new vehicle: add an entry to PLAYER_VEHICLES and its GLTF to models/vehicles/.
 */

export const PLAYER_VEHICLES = [
	{
		id: 'kart-1',
		label: 'Kart 1',
		path: 'vehicles/BaseRaceKart1.gltf',
		characterOffset: { x: 0, y: - 0.55, z: 0.31 },
	},
	{
		id: 'kart-2',
		label: 'Kart 2',
		path: 'vehicles/BaseRaceKart2.gltf',
		characterOffset: { x: 0, y: - 0.60, z: 0.24 },
	},
];

export const PLAYER_CHARACTER_ID = 'kart-beast';
export const PLAYER_CHARACTER_PATH = 'characters/Kart_Beast_Rest-Armature.glb';

export function getVehicleById( id ) {

	return PLAYER_VEHICLES.find( ( v ) => v.id === id ) || PLAYER_VEHICLES[ 0 ];

}

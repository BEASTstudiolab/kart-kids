/**
 * Central registry of all player-selectable vehicles.
 * To add a new vehicle: add an entry to PLAYER_VEHICLES and its GLTF to models/vehicles/.
 */

export const PLAYER_VEHICLES = [
	{
		id: 'kart-1',
		label: 'Kart 1',
		path: 'vehicles/BaseRaceKart1.gltf',
		bodyHeight: 0.35,
		characterOffset: { x: 0, y: - 0.55, z: 0.31 },
	},
	{
		id: 'kart-2',
		label: 'Kart 2',
		path: 'vehicles/BaseRaceKart2.gltf',
		bodyHeight: 0.35,
		characterOffset: { x: 0, y: - 0.60, z: 0.24 },
	},
	{
		id: 'kart-3',
		label: 'Kart 3',
		path: 'vehicles/BaseRaceKart3.gltf',
		bodyHeight: 0.6,
		characterOffset: { x: 0, y: - 0.34, z: 0.31 },
	},
	{
		id: 'kart-4',
		label: 'Kart 4',
		path: 'vehicles/BaseRaceKart4.gltf',
		bodyHeight: 0.35,
		characterOffset: { x: 0, y: - 0.55, z: 0.37 },
	},
	{
		id: 'kart-5',
		label: 'Kart 5',
		path: 'vehicles/BaseRaceKart5.gltf',
		bodyHeight: - 0.22,
		characterOffset: { x: 0, y: - 0.55, z: 0.40 },
	},
	{
		id: 'kart-6',
		label: 'Kart 6',
		path: 'vehicles/BaseRaceKart6.gltf',
		bodyHeight: 0,
		characterOffset: { x: 0, y: - 0.40, z: 0.36 },
	},
	{
		id: 'kart-7',
		label: 'Kart 7',
		path: 'vehicles/BaseRaceKart7.gltf',
		bodyHeight: 0.90,
		characterOffset: { x: 0, y: - 0.4, z: 0.33 },
	},
	{
		id: 'kart-8',
		label: 'Kart 8',
		path: 'vehicles/BaseRaceKart8.gltf',
		bodyHeight: 0.70,
		characterOffset: { x: 0, y: - 0.38, z: 0.32 },
	},
];

export const PLAYER_CHARACTER_ID = 'kart-beast';
export const PLAYER_CHARACTER_PATH = 'characters/Kart_Beast_Rest-Armature.glb';

export function getVehicleById( id ) {

	return PLAYER_VEHICLES.find( ( v ) => v.id === id ) || PLAYER_VEHICLES[ 0 ];

}

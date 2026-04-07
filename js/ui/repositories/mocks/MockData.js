/**
 * MockData.js
 * Shared mock data constants used across all pages during scaffold phase.
 * Will be replaced by real API data when backend integration happens.
 */

export const MockData = Object.freeze( {

	// Current player
	player: {
		id: 'player_001',
		name: 'BeastKid',
		rank: 14,
		level: 24,
		xp: 2500,
		xpToNext: 3000,
		totalWins: 88,
		totalRaces: 126,
		avatar: null,
		title: 'Drift Master',
	},

	// Currency
	wallet: {
		coins: 14300,
		gems: 250,
	},

	// Current loadout
	loadout: {
		characterId: 'char_balaclava',
		characterName: 'Balaclava Biker',
		kartId: 'kart_void_striker',
		kartName: 'Void Striker',
		paintId: 'paint_midnight',
		wheelsId: 'wheels_carbon',
	},

	// Characters
	characters: [
		{ id: 'char_balaclava', name: 'Balaclava Biker', owned: true, speed: 90, drift: 85, handling: 70, accel: 95, ability: 'Drift Booster', abilityDesc: 'Small speed burst after every perfect drift.' },
		{ id: 'char_speedyg', name: 'SpeedyG', owned: true, speed: 95, drift: 70, handling: 80, accel: 85, ability: 'Nitro Surge', abilityDesc: 'Boost duration extended by 25%.' },
		{ id: 'char_gearhead', name: 'GearHead', owned: true, speed: 80, drift: 90, handling: 85, accel: 75, ability: 'Precision Turn', abilityDesc: 'Tighter cornering at high speed.' },
		{ id: 'char_nitromax', name: 'NitroMax', owned: false, speed: 88, drift: 82, handling: 78, accel: 92, ability: 'Turbo Start', abilityDesc: 'Perfect start boost is 2x stronger.' },
		{ id: 'char_driftkid', name: 'Drift Kid', owned: false, speed: 75, drift: 95, handling: 88, accel: 70, ability: 'Chain Drift', abilityDesc: 'Consecutive drifts build bonus speed.' },
		{ id: 'char_streetracer', name: 'Street Racer', owned: false, speed: 92, drift: 78, handling: 72, accel: 88, ability: 'Slipstream', abilityDesc: 'Drafting bonus increased by 50%.' },
	],

	// Karts
	karts: [
		{ id: 'kart_void_striker', name: 'Void Striker', owned: true, speed: 7.0, accel: 9.0, handling: 6.0, traction: 8.0, boost: 8.5 },
		{ id: 'kart_super_drift', name: 'Super Drift Kart', owned: true, speed: 6.5, accel: 8.0, handling: 9.0, traction: 7.5, boost: 7.0 },
		{ id: 'kart_beastside_buggy', name: 'Beastside Buggy', owned: true, speed: 8.0, accel: 7.0, handling: 7.5, traction: 8.5, boost: 6.0 },
		{ id: 'kart_neon_racer', name: 'Neon Racer', owned: false, speed: 9.0, accel: 6.5, handling: 5.5, traction: 7.0, boost: 9.5 },
	],

	// Race modes
	modes: [
		{ id: 'grand_prix', name: 'Grand Prix', desc: 'Multiple Races, Series Win', icon: 'trophy', playerCount: '2-12', online: true },
		{ id: 'time_trial', name: 'Time Trial', desc: 'Beat Your Best Time', icon: 'clock', playerCount: '1', online: false },
		{ id: 'single_race', name: 'Single Race', desc: 'One Race, Instant Fun', icon: 'flag', playerCount: '2-12', online: true },
		{ id: 'battle_mode', name: 'Battle Mode', desc: 'Arena Combat, Items Galore', icon: 'swords', playerCount: '2-8', online: true },
		{ id: 'team_race', name: 'Team Race', desc: 'Team Victory, Shared Points', icon: 'users', playerCount: '4-12', online: true },
		{ id: 'elimination', name: 'Elimination', desc: 'Multiple Races, Shrinking', icon: 'skull', playerCount: '4-12', online: true },
		{ id: 'tournaments', name: 'Tournaments', desc: 'Compete for Glory', icon: 'medal', playerCount: '8-64', online: true },
		{ id: 'ranked', name: 'Ranked', desc: 'Climb the Ladder', icon: 'ladder', playerCount: '2-12', online: true },
		{ id: 'custom_game', name: 'Custom Game', desc: 'Your Rules', icon: 'wrench', playerCount: '2-12', online: true },
	],

	// Tracks
	tracks: [
		{ id: 'track_neon_tokyo', name: 'Neon Tokyo', creator: 'KartKids', difficulty: 'Medium', rating: 4.5, plays: 12500 },
		{ id: 'track_beastside_arena', name: 'Beastside Arena', creator: 'KartKids', difficulty: 'Hard', rating: 4.8, plays: 8900 },
		{ id: 'track_mega_mall', name: 'Mega Mall Grand Prix', creator: 'User_42', difficulty: 'Easy', rating: 4.2, plays: 6300 },
	],

	// Featured event
	featuredEvent: {
		id: 'event_tokyo_drift',
		name: 'Super Drift Tokyo',
		season: 1,
		timeRemaining: '14D : 06H',
		description: 'Season 1: Tokyo Drift',
	},

	// Daily challenges
	challenges: [
		{ id: 'ch_1', title: '15/25 Drifts', desc: 'Perform a countless brainy deviled drifts.', progress: 15, target: 25, reward: '10 XP', category: 'daily', claimed: false },
		{ id: 'ch_2', title: 'Proud Drifts', desc: 'Treble your goal atrocities next lever arrives.', progress: 10, target: 10, reward: '10 GOLDS', category: 'daily', claimed: true },
		{ id: 'ch_3', title: 'Drivinock Challenge', desc: 'Track your roam and playing near your driftiest blaze.', progress: 8, target: 10, reward: '10 GOLDS', category: 'daily', claimed: false },
		{ id: 'ch_4', title: 'Bake Roat Drifts', desc: 'Select a beast new font over a lot of aur drifts.', progress: 3, target: 25, reward: 'TIRE ICON', category: 'weekly', claimed: false },
	],

	// Lobby members
	lobbyMembers: [
		{ id: 'p1', name: '@BEASTKID', role: 'HOST', ready: true, online: true },
		{ id: 'p2', name: '@KARTMASTER', role: 'MEMBER', ready: true, online: true },
		{ id: 'p3', name: '@DRIFTDEVIL', role: 'MEMBER', ready: true, online: true },
		{ id: 'p4', name: '@SPEEDTEAR', role: 'MEMBER', ready: false, online: true },
	],

	// Friends
	friends: [
		{ id: 'f1', name: 'Street Racer', status: 'online' },
		{ id: 'f2', name: 'Kid Karter', status: 'offline' },
		{ id: 'f3', name: 'Rally Kid', status: 'online' },
		{ id: 'f4', name: 'Sparkyzz', status: 'online' },
		{ id: 'f5', name: 'Doarting', status: 'online' },
		{ id: 'f6', name: 'NitroMax', status: 'online' },
	],

	// Season pass
	season: {
		name: 'Season 1: Tokyo Drift',
		currentTier: 3,
		maxTier: 10,
		progress: 70,
		timeRemaining: '21 Days 14 Hrs',
		hasPremium: false,
		premiumPrice: '$9.99',
	},

	// Inbox
	inbox: [
		{ id: 'msg1', type: 'message', from: 'ADMIN', subject: 'Super Drift Tokyo event update', time: '4 months ago', read: false },
		{ id: 'msg2', type: 'message', from: 'DRIFTSTER', subject: 'Race challenge from Driftster', time: '3 months ago', read: true },
		{ id: 'msg3', type: 'reward', from: 'SYSTEM', subject: 'Season reward unclaimed', time: '1 month ago', claimed: false },
	],

	// Ranked
	ranked: {
		tier: 'ACE',
		division: 'I',
		points: 5076,
		pointsMax: 6000,
		seasonName: 'Season 3: Ace Ascension',
		seasonProgress: 70,
	},

	// App version
	version: 'KART KIDS_ALPHA_v1.0.0',

} );

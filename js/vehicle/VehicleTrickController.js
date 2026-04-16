import * as THREE from 'three';

import { LaunchSource } from './VehicleAirborne.js';

export const TrickType = {
	FRONTFLIP: 'frontflip',
	BACKFLIP: 'backflip',
	BARREL_LEFT: 'barrelLeft',
	BARREL_RIGHT: 'barrelRight',
};

const TRICK_ROTATIONS = {
	[ TrickType.FRONTFLIP ]: { x: - Math.PI * 2 },
	[ TrickType.BACKFLIP ]: { x: Math.PI * 2 },
	[ TrickType.BARREL_LEFT ]: { z: Math.PI * 2, y: - 0.18, loopAtCompletion: true },
	[ TrickType.BARREL_RIGHT ]: { z: - Math.PI * 2, y: 0.18, loopAtCompletion: true },
};

export class VehicleTrickController {

	constructor() {

		this.config = {
			trickDuration: 0.65,
			completionWindow: 0.85,
			rewardBoostDuration: 1.1,
			rewardBoostTopSpeed: 320,
			hintDuration: 0.85,
		};

		this.launchSource = LaunchSource.NONE;
		this.trickEligible = false;
		this.currentTrick = null;
		this.completedTrick = null;
		this.lastCompletedTrick = null;
		this.progress = 0;
		this.rewardGranted = false;

	}

	onLaunch( vehicle, launchSource ) {

		this.launchSource = launchSource || LaunchSource.NONE;
		this.trickEligible = this.launchSource === LaunchSource.RAMP || this.launchSource === LaunchSource.JUMP;
		this.currentTrick = null;
		this.completedTrick = null;
		this.lastCompletedTrick = null;
		this.progress = 0;
		this.rewardGranted = false;
		if ( vehicle ) {

			vehicle._trickEvent = null;
			vehicle._lastTrickResult = null;
			if ( this.trickEligible ) {

				vehicle._aerialHintTimer = this.config.hintDuration;
				vehicle._aerialHintText = 'HOLD DRIFT + TAP A DIRECTION';

			} else {

				vehicle._aerialHintTimer = 0;

			}

		}
		this._applyVisualState( vehicle, null, 0 );

	}

	tryStartTrick( vehicle, trickType ) {

		if ( ! this.trickEligible || ! TRICK_ROTATIONS[ trickType ] ) return false;
		if ( this.currentTrick || this.completedTrick ) return false;

		this.currentTrick = trickType;
		this.completedTrick = null;
		this.progress = 0;
		this.rewardGranted = false;
		if ( vehicle ) vehicle._aerialHintTimer = 0;
		this._applyVisualState( vehicle, this.currentTrick, 0 );
		return true;

	}

	update( dt, vehicle ) {

		if ( ! this.currentTrick ) {

			this._applyVisualState( vehicle, null, 0 );
			return;

		}

		const duration = Math.max( this.config.trickDuration, 0.01 );
		const completionWindow = THREE.MathUtils.clamp( this.config.completionWindow ?? 0.85, 0.5, 1.0 );
		this.progress = Math.min( this.progress + dt / duration, 1 );
		if ( this.progress >= completionWindow ) this.completedTrick = this.currentTrick;
		this._applyVisualState( vehicle, this.currentTrick, this.progress );

	}

	onLanding( vehicle, severity ) {

		const stableLanding = severity === 'clean' || severity === 'hard';
		this.lastCompletedTrick = this.completedTrick;
		const rewardAllowed = stableLanding &&
			!! this.completedTrick &&
			this.trickEligible &&
			this.launchSource !== LaunchSource.IMPACT &&
			this.launchSource !== LaunchSource.DROP &&
			! vehicle?._airborneWallContact;

		if ( rewardAllowed ) {

			vehicle.miniBoostTimer = Math.max( vehicle.miniBoostTimer || 0, this.config.rewardBoostDuration );
			vehicle.miniBoostTopSpeed = Math.max( vehicle.miniBoostTopSpeed || 0, this.config.rewardBoostTopSpeed );
			this.rewardGranted = true;

			if ( vehicle ) {

				vehicle._trickEvent = {
					type: this.completedTrick,
					rewardGranted: true,
					launchSource: this.launchSource,
				};

			}

		} else {

			this.rewardGranted = false;

		}

		if ( vehicle ) {

			vehicle._lastTrickResult = {
				type: this.lastCompletedTrick,
				rewardGranted: this.rewardGranted,
				launchSource: this.launchSource,
			};

		}

		this.cancel( vehicle );
		return this.rewardGranted;

	}

	cancel( vehicle ) {

		this.currentTrick = null;
		this.completedTrick = null;
		this.progress = 0;
		this.trickEligible = false;
		this.launchSource = LaunchSource.NONE;
		if ( vehicle ) vehicle._aerialHintTimer = 0;
		this._applyVisualState( vehicle, null, 0 );

	}

	getRemoteState() {

		if ( this.launchSource === LaunchSource.NONE && ! this.currentTrick && ! this.completedTrick ) return null;

		return {
			source: this.launchSource,
			currentTrick: this.currentTrick,
			completedTrick: this.completedTrick,
			progress: this.progress,
			rewardGranted: this.rewardGranted,
		};

	}

	syncRemoteState( vehicle, remoteState ) {

		if ( ! remoteState ) {

			this.currentTrick = null;
			this.completedTrick = null;
			this.progress = 0;
			this.launchSource = LaunchSource.NONE;
			this.trickEligible = false;
			this.rewardGranted = false;
			this._applyVisualState( vehicle, null, 0 );
			return;

		}

		this.launchSource = remoteState.source || LaunchSource.NONE;
		this.currentTrick = remoteState.currentTrick || null;
		this.completedTrick = remoteState.completedTrick || null;
		this.progress = THREE.MathUtils.clamp( remoteState.progress || 0, 0, 1 );
		this.rewardGranted = !! remoteState.rewardGranted;
		this.trickEligible = this.launchSource === LaunchSource.RAMP || this.launchSource === LaunchSource.JUMP;
		this._applyVisualState( vehicle, this.currentTrick, this.progress );

	}

	getStateSnapshot() {

		return {
			source: this.launchSource,
			currentTrick: this.currentTrick,
			completedTrick: this.completedTrick,
			progress: this.progress,
			rewardGranted: this.rewardGranted,
		};

	}

	_applyVisualState( vehicle, trickType, progress ) {

		if ( ! vehicle?.visualRoot ) return;

		const baseYaw = vehicle.visualYawOffset ?? 0;
		vehicle.visualRoot.rotation.set( 0, baseYaw, 0 );

		if ( ! trickType ) return;

		const def = TRICK_ROTATIONS[ trickType ];
		if ( ! def ) return;
		const eased = THREE.MathUtils.smootherstep( progress, 0, 1 );

		if ( def.loopAtCompletion ) {

			const completionWindow = THREE.MathUtils.clamp( this.config.completionWindow ?? 0.85, 0.5, 1.0 );
			const phase = THREE.MathUtils.clamp( progress / completionWindow, 0, 1 );
			const loopEased = THREE.MathUtils.smootherstep( phase, 0, 1 );
			vehicle.visualRoot.rotation.z = ( def.z || 0 ) * loopEased;
			vehicle.visualRoot.rotation.y = baseYaw + ( def.y || 0 ) * Math.sin( loopEased * Math.PI );
			return;

		}

		vehicle.visualRoot.rotation.x = ( def.x || 0 ) * eased;
		vehicle.visualRoot.rotation.z = ( def.z || 0 ) * eased;
		vehicle.visualRoot.rotation.y = baseYaw + ( def.y || 0 ) * Math.sin( eased * Math.PI );

	}

}

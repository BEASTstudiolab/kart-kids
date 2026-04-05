import * as THREE from 'three';

const _leadForward = new THREE.Vector3();
const _trailerForward = new THREE.Vector3();
const _leadToTrailer = new THREE.Vector3();

const DRAFT_DISTANCE = 5.0;
const DRAFT_DISTANCE_SQ = DRAFT_DISTANCE * DRAFT_DISTANCE;
const BEHIND_DOT_THRESHOLD = - 0.4;
const ALIGNMENT_DOT_THRESHOLD = 0.7;
const RAMP_TIME = 0.6;
const DECAY_TIME = 0.5;
const MAX_DRAFT_BOOST = 0.14;

// Proximity range for cone indicator (~4 vehicle lengths)
const CONE_PROXIMITY = 8.0;
const CONE_PROXIMITY_SQ = CONE_PROXIMITY * CONE_PROXIMITY;
const CONE_BEHIND_DOT = - 0.3;
const CONE_ALIGNMENT_DOT = 0.5;

export class DraftingSystem {

	constructor() {

		// ── Draft State ──────────────────────────────────────────────────────
		this._drafts = new Map();
		this._activeVehicles = new Set();
		this._detectedLeads = new Map();
		this._detectedLeadDistanceSq = new Map();
		this._staleVehicles = [];

		// ── Proximity State (for cone display) ──────────────────────────────
		this._proximityLeads = new Map();       // trailer → { leadVehicle, distanceSq }
		this._proximityDistanceSq = new Map();

	}

	update( dt, activeVehicles ) {

		// ── Frame Setup ──────────────────────────────────────────────────────
		this._activeVehicles.clear();
		this._detectedLeads.clear();
		this._detectedLeadDistanceSq.clear();
		this._proximityLeads.clear();
		this._proximityDistanceSq.clear();

		if ( ! Array.isArray( activeVehicles ) || activeVehicles.length === 0 ) {

			this._drafts.clear();
			return;

		}

		for ( let i = 0; i < activeVehicles.length; i ++ ) {

			const vehicle = activeVehicles[ i ].vehicle;
			if ( ! vehicle ) continue;

			this._activeVehicles.add( vehicle );
			vehicle.draftSpeedMultiplier = 1.0;

		}

		// ── Draft + Proximity Detection ─────────────────────────────────────
		for ( let leadIndex = 0; leadIndex < activeVehicles.length; leadIndex ++ ) {

			const leadVehicle = activeVehicles[ leadIndex ].vehicle;
			if ( ! leadVehicle ) continue;

			for ( let trailerIndex = 0; trailerIndex < activeVehicles.length; trailerIndex ++ ) {

				if ( leadIndex === trailerIndex ) continue;

				const trailerVehicle = activeVehicles[ trailerIndex ].vehicle;
				if ( ! trailerVehicle ) continue;

				// Check proximity first (wider range for cone)
				const proxResult = this._getProximityDistanceSq( leadVehicle, trailerVehicle );

				if ( proxResult !== null ) {

					const bestProx = this._proximityDistanceSq.get( trailerVehicle );

					if ( bestProx === undefined || proxResult < bestProx ) {

						this._proximityLeads.set( trailerVehicle, leadVehicle );
						this._proximityDistanceSq.set( trailerVehicle, proxResult );

					}

				}

				// Check actual draft (tighter range)
				const distanceSq = this._getDraftDistanceSq( leadVehicle, trailerVehicle );

				if ( distanceSq === null ) continue;

				const bestDistanceSq = this._detectedLeadDistanceSq.get( trailerVehicle );

				if ( bestDistanceSq === undefined || distanceSq < bestDistanceSq ) {

					this._detectedLeads.set( trailerVehicle, leadVehicle );
					this._detectedLeadDistanceSq.set( trailerVehicle, distanceSq );

				}

			}

		}

		// ── Intensity Update ─────────────────────────────────────────────────
		for ( let i = 0; i < activeVehicles.length; i ++ ) {

			const vehicle = activeVehicles[ i ].vehicle;
			if ( ! vehicle ) continue;

			const detectedLead = this._detectedLeads.get( vehicle ) || null;
			let state = this._drafts.get( vehicle );

			if ( ! detectedLead && ! state ) continue;

			if ( ! state ) {

				state = { intensity: 0, leadVehicle: detectedLead };
				this._drafts.set( vehicle, state );

			}

			if ( detectedLead ) {

				state.intensity = Math.min( 1, state.intensity + dt / RAMP_TIME );
				state.leadVehicle = detectedLead;

			} else {

				state.intensity = Math.max( 0, state.intensity - dt / DECAY_TIME );

			}

			if ( state.intensity > 0 ) {

				vehicle.draftSpeedMultiplier = 1.0 + MAX_DRAFT_BOOST * state.intensity;

			} else {

				this._drafts.delete( vehicle );

			}

		}

		// ── Cleanup ──────────────────────────────────────────────────────────
		this._staleVehicles.length = 0;

		for ( const draftedVehicle of this._drafts.keys() ) {

			if ( ! this._activeVehicles.has( draftedVehicle ) ) {

				this._staleVehicles.push( draftedVehicle );

			}

		}

		for ( let i = 0; i < this._staleVehicles.length; i ++ ) {

			this._drafts.delete( this._staleVehicles[ i ] );

		}

	}

	getActiveDrafts() {

		return this._drafts;

	}

	/** Returns Map<trailerVehicle, leadVehicle> for vehicles within cone proximity range */
	getProximityLeads() {

		return this._proximityLeads;

	}

	_getDraftDistanceSq( leadVehicle, trailerVehicle ) {

		_leadForward.set( 0, 0, 1 ).applyQuaternion( leadVehicle.container.quaternion );
		_leadForward.y = 0;

		if ( _leadForward.lengthSq() === 0 ) return null;

		_leadForward.normalize();

		_trailerForward.set( 0, 0, 1 ).applyQuaternion( trailerVehicle.container.quaternion );
		_trailerForward.y = 0;

		if ( _trailerForward.lengthSq() === 0 ) return null;

		_trailerForward.normalize();

		_leadToTrailer.subVectors( trailerVehicle.vehPos, leadVehicle.vehPos );
		_leadToTrailer.y = 0;

		const distanceSq = _leadToTrailer.lengthSq();

		if ( distanceSq >= DRAFT_DISTANCE_SQ ) return null;
		if ( distanceSq === 0 ) return null;

		_leadToTrailer.normalize();

		const behindDot = _leadForward.dot( _leadToTrailer );

		if ( behindDot >= BEHIND_DOT_THRESHOLD ) return null;

		const alignmentDot = _leadForward.dot( _trailerForward );

		if ( alignmentDot <= ALIGNMENT_DOT_THRESHOLD ) return null;

		return distanceSq;

	}

	_getProximityDistanceSq( leadVehicle, trailerVehicle ) {

		_leadForward.set( 0, 0, 1 ).applyQuaternion( leadVehicle.container.quaternion );
		_leadForward.y = 0;

		if ( _leadForward.lengthSq() === 0 ) return null;

		_leadForward.normalize();

		_trailerForward.set( 0, 0, 1 ).applyQuaternion( trailerVehicle.container.quaternion );
		_trailerForward.y = 0;

		if ( _trailerForward.lengthSq() === 0 ) return null;

		_trailerForward.normalize();

		_leadToTrailer.subVectors( trailerVehicle.vehPos, leadVehicle.vehPos );
		_leadToTrailer.y = 0;

		const distanceSq = _leadToTrailer.lengthSq();

		if ( distanceSq >= CONE_PROXIMITY_SQ ) return null;
		if ( distanceSq === 0 ) return null;

		_leadToTrailer.normalize();

		const behindDot = _leadForward.dot( _leadToTrailer );

		if ( behindDot >= CONE_BEHIND_DOT ) return null;

		const alignmentDot = _leadForward.dot( _trailerForward );

		if ( alignmentDot <= CONE_ALIGNMENT_DOT ) return null;

		return distanceSq;

	}

}

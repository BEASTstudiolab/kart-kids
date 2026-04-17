const TWO_PI = Math.PI * 2;

export const DEFAULT_PREVIEW_POSE_TRANSITION_DURATION = 0.32;
export const MIN_PREVIEW_POSE_TRANSITION_DURATION = 0.32;
export const MAX_PREVIEW_POSE_TRANSITION_DURATION = 0.72;

function clamp01( value ) {

	return Math.min( 1, Math.max( 0, Number( value ) || 0 ) );

}

function clamp( value, min, max ) {

	return Math.min( max, Math.max( min, value ) );

}

function cloneVector3State( value = {} ) {

	return {
		x: Number( value?.x ) || 0,
		y: Number( value?.y ) || 0,
		z: Number( value?.z ) || 0,
	};

}

function copyVector3State( target, source ) {

	target.x = Number( source?.x ) || 0;
	target.y = Number( source?.y ) || 0;
	target.z = Number( source?.z ) || 0;
	return target;

}

function normalizeDurationSeconds( value ) {

	const nextValue = Number( value );
	return Number.isFinite( nextValue ) && nextValue > 0
		? nextValue
		: DEFAULT_PREVIEW_POSE_TRANSITION_DURATION;

}

function interpolateScalar( start, target, progress ) {

	return start + ( ( target - start ) * progress );

}

function distance3D( left, right ) {

	const dx = ( Number( right?.x ) || 0 ) - ( Number( left?.x ) || 0 );
	const dy = ( Number( right?.y ) || 0 ) - ( Number( left?.y ) || 0 );
	const dz = ( Number( right?.z ) || 0 ) - ( Number( left?.z ) || 0 );
	return Math.sqrt( ( dx * dx ) + ( dy * dy ) + ( dz * dz ) );

}

function shortestAngleDelta( start, target ) {

	return ( ( ( target - start ) + Math.PI ) % TWO_PI + TWO_PI ) % TWO_PI - Math.PI;

}

export function normalizeRotationRadians( radians ) {

	return ( ( Number( radians ) || 0 ) % TWO_PI + TWO_PI ) % TWO_PI;

}

export function easeInOutCubic( progress ) {

	const clamped = clamp01( progress );
	if ( clamped < 0.5 ) return 4 * clamped * clamped * clamped;
	return 1 - ( Math.pow( - 2 * clamped + 2, 3 ) / 2 );

}

export function createPreviewPoseSnapshot( pose = {} ) {

	return {
		cameraPos: cloneVector3State( pose.cameraPos ),
		lookAt: cloneVector3State( pose.lookAt ),
		fov: Number( pose.fov ) || 0,
		kartRotationY: normalizeRotationRadians( pose.kartRotationY ),
	};

}

export function computePreviewPoseTransitionDuration( startPose, targetPose ) {

	const start = createPreviewPoseSnapshot( startPose );
	const target = createPreviewPoseSnapshot( targetPose );
	const cameraDistance = distance3D( start.cameraPos, target.cameraPos );
	const lookDistance = distance3D( start.lookAt, target.lookAt );
	const fovDelta = Math.abs( target.fov - start.fov );
	const rotationDelta = Math.abs( shortestAngleDelta( start.kartRotationY, target.kartRotationY ) );
	const weightedDuration = MIN_PREVIEW_POSE_TRANSITION_DURATION +
		( cameraDistance * 0.12 ) +
		( lookDistance * 0.06 ) +
		( ( fovDelta / 90 ) * 0.18 ) +
		( ( rotationDelta / Math.PI ) * 0.16 );

	return clamp(
		weightedDuration,
		MIN_PREVIEW_POSE_TRANSITION_DURATION,
		MAX_PREVIEW_POSE_TRANSITION_DURATION
	);

}

function copyPreviewPoseSnapshot( target, source ) {

	copyVector3State( target.cameraPos, source.cameraPos );
	copyVector3State( target.lookAt, source.lookAt );
	target.fov = Number( source.fov ) || 0;
	target.kartRotationY = normalizeRotationRadians( source.kartRotationY );
	return target;

}

function interpolatePose( startPose, targetPose, progress, outPose ) {

	const easedProgress = easeInOutCubic( progress );
	outPose.cameraPos.x = interpolateScalar( startPose.cameraPos.x, targetPose.cameraPos.x, easedProgress );
	outPose.cameraPos.y = interpolateScalar( startPose.cameraPos.y, targetPose.cameraPos.y, easedProgress );
	outPose.cameraPos.z = interpolateScalar( startPose.cameraPos.z, targetPose.cameraPos.z, easedProgress );
	outPose.lookAt.x = interpolateScalar( startPose.lookAt.x, targetPose.lookAt.x, easedProgress );
	outPose.lookAt.y = interpolateScalar( startPose.lookAt.y, targetPose.lookAt.y, easedProgress );
	outPose.lookAt.z = interpolateScalar( startPose.lookAt.z, targetPose.lookAt.z, easedProgress );
	outPose.fov = interpolateScalar( startPose.fov, targetPose.fov, easedProgress );
	outPose.kartRotationY = normalizeRotationRadians(
		startPose.kartRotationY + ( shortestAngleDelta( startPose.kartRotationY, targetPose.kartRotationY ) * easedProgress )
	);
	return outPose;

}

export function createPreviewPoseTransition( initialPose, { duration = DEFAULT_PREVIEW_POSE_TRANSITION_DURATION } = {} ) {

	const pose = createPreviewPoseSnapshot( initialPose );
	return {
		duration: normalizeDurationSeconds( duration ),
		elapsed: normalizeDurationSeconds( duration ),
		active: false,
		startPose: createPreviewPoseSnapshot( pose ),
		currentPose: createPreviewPoseSnapshot( pose ),
		targetPose: createPreviewPoseSnapshot( pose ),
	};

}

export function retargetPreviewPoseTransition( transition, nextTargetPose, { immediate = false, duration } = {} ) {

	const resolvedTargetPose = createPreviewPoseSnapshot( nextTargetPose );
	const state = transition || createPreviewPoseTransition( resolvedTargetPose );
	const basePose = createPreviewPoseSnapshot( state.currentPose );
	const nextDuration = normalizeDurationSeconds( duration ?? computePreviewPoseTransitionDuration( basePose, resolvedTargetPose ) );

	state.duration = nextDuration;
	copyPreviewPoseSnapshot( state.startPose, basePose );
	copyPreviewPoseSnapshot( state.targetPose, resolvedTargetPose );

	if ( immediate ) {

		state.active = false;
		state.elapsed = state.duration;
		copyPreviewPoseSnapshot( state.currentPose, resolvedTargetPose );
		copyPreviewPoseSnapshot( state.startPose, resolvedTargetPose );
		return state.currentPose;

	}

	state.active = true;
	state.elapsed = 0;
	copyPreviewPoseSnapshot( state.currentPose, basePose );
	return state.currentPose;

}

export function advancePreviewPoseTransition( transition, dt ) {

	if ( ! transition ) return null;

	if ( ! transition.active ) {

		copyPreviewPoseSnapshot( transition.currentPose, transition.targetPose );
		return transition.currentPose;

	}

	const safeDt = Math.max( 0, Number( dt ) || 0 );
	transition.elapsed = Math.min( transition.duration, transition.elapsed + safeDt );
	const progress = transition.duration > 0 ? clamp01( transition.elapsed / transition.duration ) : 1;

	if ( progress >= 1 ) {

		transition.active = false;
		copyPreviewPoseSnapshot( transition.currentPose, transition.targetPose );
		copyPreviewPoseSnapshot( transition.startPose, transition.targetPose );
		return transition.currentPose;

	}

	return interpolatePose( transition.startPose, transition.targetPose, progress, transition.currentPose );

}

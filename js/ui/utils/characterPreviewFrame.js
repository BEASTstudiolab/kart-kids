const DEFAULT_PADDING = 1.15;
const MIN_DIMENSION = 0.01;
const DEFAULT_LOOK_TARGET_X_BIAS = 0.08;
const DEFAULT_CAMERA_Y_OFFSET = - 0.06;

export const CHARACTER_PREVIEW_CAMERA_DEFAULTS = Object.freeze( {
	lookTargetX: - 0.20,
	lookTargetY: - 1.37,
	cameraOffsetX: 0.40,
	cameraOffsetY: 1.50,
	cameraOffsetZ: 3.00,
} );

function toRadians( degrees ) {

	return ( degrees * Math.PI ) / 180;

}

/**
 * Compute a camera fit for the character preview panel.
 *
 * The fit uses full model height for vertical framing and a rotation-safe
 * horizontal footprint (`hypot(x, z)`) so manual yaw rotation does not clip.
 */
export function computeCharacterPreviewFrame( {
	size,
	aspect = 1,
	fovDegrees = 26,
	padding = DEFAULT_PADDING,
} = {} ) {

	const safeHeight = Math.max( Number( size?.y ) || 0, MIN_DIMENSION );
	const safeWidth = Math.max(
		Math.hypot( Number( size?.x ) || 0, Number( size?.z ) || 0 ),
		MIN_DIMENSION
	);
	const safeAspect = Math.max( Number( aspect ) || 0, MIN_DIMENSION );
	const safePadding = Math.max( Number( padding ) || 0, 1 );
	const verticalFov = toRadians( Math.max( Number( fovDegrees ) || 0, 1 ) );
	const horizontalFov = 2 * Math.atan( Math.tan( verticalFov / 2 ) * safeAspect );

	const distanceForHeight = ( safeHeight * safePadding * 0.5 ) / Math.tan( verticalFov / 2 );
	const distanceForWidth = ( safeWidth * safePadding * 0.5 ) / Math.tan( horizontalFov / 2 );
	const lookTargetX = safeWidth * DEFAULT_LOOK_TARGET_X_BIAS;
	const lookTargetY = safeHeight * 0.5;
	const cameraY = lookTargetY + safeHeight * DEFAULT_CAMERA_Y_OFFSET;
	const cameraZ = Math.max( distanceForHeight, distanceForWidth, 1 );

	return {
		lookTargetX,
		lookTargetY,
		cameraY,
		cameraZ,
	};

}

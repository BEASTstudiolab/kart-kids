import { CELL_RAW, GRID_SCALE } from './Track.js';

const CELL_SIZE = CELL_RAW * GRID_SCALE;

const VEHICLE_COLORS = [
	'#f5c542', // yellow
	'#4caf50', // green
	'#9c27b0', // purple
	'#f44336', // red
];

const _canvasCoord = [ 0, 0 ];

export class Minimap {

	constructor( cells, bounds ) {

		this._cells = cells;
		this._bounds = bounds;

		// Canvas setup
		this._size = 140;
		this._padding = 10;
		this._canvas = document.createElement( 'canvas' );
		this._canvas.width = this._size;
		this._canvas.height = this._size;
		this._canvas.style.cssText = [
			'position:fixed', 'top:16px', 'left:16px',
			'width:140px', 'height:140px',
			'background:rgba(0,0,0,0.5)', 'border-radius:8px',
			'z-index:1000', 'pointer-events:none', 'display:none',
		].join( ';' );
		document.body.appendChild( this._canvas );

		this._ctx = this._canvas.getContext( '2d' );

		// Compute mapping from world space to canvas space
		const mapWidth = ( bounds.halfWidth * 2 );
		const mapHeight = ( bounds.halfDepth * 2 );
		const maxExtent = Math.max( mapWidth, mapHeight );
		this._scale = ( this._size - this._padding * 2 ) / maxExtent;
		this._offsetX = this._size / 2 - bounds.centerX * this._scale;
		this._offsetZ = this._size / 2 - bounds.centerZ * this._scale;

		// Pre-render the static track
		this._trackImage = document.createElement( 'canvas' );
		this._trackImage.width = this._size;
		this._trackImage.height = this._size;
		this._renderTrack();

	}

	_worldToCanvas( wx, wz ) {

		_canvasCoord[ 0 ] = wx * this._scale + this._offsetX;
		_canvasCoord[ 1 ] = wz * this._scale + this._offsetZ;
		return _canvasCoord;

	}

	_renderTrack() {

		const ctx = this._trackImage.getContext( '2d' );
		ctx.clearRect( 0, 0, this._size, this._size );

		// Draw each cell as a filled rectangle
		for ( const cell of this._cells ) {

			const gx = cell[ 0 ];
			const gz = cell[ 1 ];

			const worldX = ( gx + 0.5 ) * CELL_SIZE;
			const worldZ = ( gz + 0.5 ) * CELL_SIZE;
			const [ cx, cz ] = this._worldToCanvas( worldX, worldZ );

			const cellPx = CELL_SIZE * this._scale;

			ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
			ctx.fillRect( cx - cellPx / 2, cz - cellPx / 2, cellPx, cellPx );

			ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
			ctx.lineWidth = 1;
			ctx.strokeRect( cx - cellPx / 2, cz - cellPx / 2, cellPx, cellPx );

		}


	}

	update( activeVehicles, raceState ) {

		// Visibility: only show during racing
		if ( raceState !== 'racing' ) {

			this._canvas.style.display = 'none';
			return;

		}

		this._canvas.style.display = 'block';

		const ctx = this._ctx;
		ctx.clearRect( 0, 0, this._size, this._size );

		// Draw static track
		ctx.drawImage( this._trackImage, 0, 0 );

		// Draw player dots
		for ( let i = 0; i < activeVehicles.length; i ++ ) {

			const { vehicle } = activeVehicles[ i ];
			const pos = vehicle.vehPos;
			const [ cx, cz ] = this._worldToCanvas( pos.x, pos.z );

			const colorIndex = i % VEHICLE_COLORS.length;
			ctx.beginPath();
			ctx.arc( cx, cz, 4, 0, Math.PI * 2 );
			ctx.fillStyle = VEHICLE_COLORS[ colorIndex ];
			ctx.fill();

			// White outline for visibility
			ctx.strokeStyle = '#fff';
			ctx.lineWidth = 1.5;
			ctx.stroke();

		}

	}

}

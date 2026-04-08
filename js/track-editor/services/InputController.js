// ─── InputController ─────────────────────────────────────────────────────────
// Routes pointer, keyboard, and wheel events from the canvas to the appropriate
// editor mode, camera controller, and services.

import { CELL_RAW } from '../../TrackConstants.js';

export class InputController {

	/**
	 * @param {HTMLCanvasElement} canvas
	 * @param {import('../core/EditorState.js').EditorState} state
	 * @param {import('../core/EventBus.js').EventBus} eventBus
	 * @param {import('./CameraController.js').CameraController} camera
	 * @param {import('../core/CommandHistory.js').CommandHistory} commandHistory
	 */
	/**
	 * @param {import('./TransformController.js').TransformController} [transform]
	 */
	constructor( canvas, state, eventBus, camera, commandHistory, transform ) {

		this._canvas = canvas;
		this._state = state;
		this._eventBus = eventBus;
		this._camera = camera;
		this._commandHistory = commandHistory;
		this._transform = transform ?? null;

		/** @type {Map<string, import('../modes/EditorMode.js').EditorMode>} */
		this._modes = new Map();

		// Interaction state
		this._isPanning = false;
		this._isOrbiting = false;
		this._isDrawing = false;
		this._spaceDown = false;
		this._lastPointer = { x: 0, y: 0 };
		this._lastGridCell = null;

		// Cell indicator mesh (set externally)
		this._cellIndicator = null;

		this._bindEvents();

		// Mode lifecycle: call enter/exit when mode changes
		this._eventBus.on( 'mode:changed', ( data ) => {

			// Wrap each call separately so one failing doesn't block the other
			const oldMode = this._modes.get( data.prevMode );
			const newMode = this._modes.get( data.mode );

			if ( oldMode ) {

				try { oldMode.exit(); }
				catch ( err ) { console.error( '[InputController] Mode exit error:', err ); }

			}

			if ( newMode ) {

				try { newMode.enter(); }
				catch ( err ) { console.error( '[InputController] Mode enter error:', err ); }

			}

		} );

	}

	/**
	 * Register an editor mode.
	 * @param {string} name
	 * @param {import('../modes/EditorMode.js').EditorMode} mode
	 */
	registerMode( name, mode ) {

		this._modes.set( name, mode );

	}

	/** @returns {import('../modes/EditorMode.js').EditorMode|null} */
	get activeMode() {

		return this._modes.get( this._state.mode ) ?? null;

	}

	// ── Event binding ──

	/** @private */
	_bindEvents() {

		const c = this._canvas;

		// Pointer events
		c.addEventListener( 'pointerdown', e => this._onPointerDown( e ) );
		c.addEventListener( 'pointermove', e => this._onPointerMove( e ) );
		c.addEventListener( 'pointerup', e => this._onPointerUp( e ) );
		c.addEventListener( 'pointerleave', e => this._onPointerUp( e ) );

		// Context menu → show radial menu if over a tile
		c.addEventListener( 'contextmenu', e => {

			e.preventDefault();
			const cell = this._camera.screenToGrid( e.clientX, e.clientY );
			if ( cell ) {

				const tile = this._state.hoveredCell ? this._state.hoveredCell : cell;
				const project = this._modes.get( 'build' )?._placement?._project;
				if ( project && project.getTile( tile.gx, tile.gz ) ) {

					this._eventBus.emit( 'radial-menu:show', {
						clientX: e.clientX, clientY: e.clientY,
						gx: tile.gx, gz: tile.gz,
					} );
					return;

				}

			}

		} );

		// Wheel → zoom
		c.addEventListener( 'wheel', e => {

			e.preventDefault();
			this._camera.zoom( - e.deltaY );

		}, { passive: false } );

		// Keyboard
		document.addEventListener( 'keydown', e => this._onKeyDown( e ) );
		document.addEventListener( 'keyup', e => this._onKeyUp( e ) );

	}

	// ── Pointer handlers ──

	/** @private */
	_onPointerDown( e ) {

		this._lastPointer = { x: e.clientX, y: e.clientY };

		// Middle mouse or Space+Left → pan
		if ( e.button === 1 || ( e.button === 0 && this._spaceDown ) ) {

			this._isPanning = true;
			this._canvas.setPointerCapture( e.pointerId );
			return;

		}

		// Right mouse → orbit
		if ( e.button === 2 ) {

			this._isOrbiting = true;
			this._canvas.setPointerCapture( e.pointerId );
			return;

		}

		// Left mouse → delegate to active mode
		if ( e.button === 0 ) {

			const cell = this._camera.screenToGrid( e.clientX, e.clientY );
			if ( ! cell ) return;

			this._isDrawing = true;
			this._lastGridCell = cell;
			this._canvas.setPointerCapture( e.pointerId );

			const mode = this.activeMode;
			if ( mode ) {

				try { mode.handlePointerDown( cell.gx, cell.gz, e ); }
				catch ( err ) { console.error( '[InputController] handlePointerDown error:', err ); }

			}

		}

	}

	/** @private */
	_onPointerMove( e ) {

		const dx = e.clientX - this._lastPointer.x;
		const dy = e.clientY - this._lastPointer.y;
		this._lastPointer = { x: e.clientX, y: e.clientY };

		// Pan
		if ( this._isPanning ) {

			this._camera.pan( dx, dy );
			return;

		}

		// Orbit
		if ( this._isOrbiting ) {

			if ( e.shiftKey ) {

				// Shift+RMB drag: height/pan
				this._camera.pan( dx, dy );

			} else {

				this._camera.orbit( dx, dy );

			}

			return;

		}

		// Grid hover
		const cell = this._camera.screenToGrid( e.clientX, e.clientY );

		if ( cell ) {

			// Emit hover event (for ghost preview, debug tooltip, etc.)
			this._eventBus.emit( 'hover:cell', cell );

			// Drawing (drag-place / drag-erase)
			if ( this._isDrawing ) {

				const prev = this._lastGridCell;
				if ( ! prev || cell.gx !== prev.gx || cell.gz !== prev.gz ) {

					this._lastGridCell = cell;
					const mode = this.activeMode;
					if ( mode ) {

						try { mode.handlePointerMove( cell.gx, cell.gz, e ); }
						catch ( err ) { console.error( '[Input] handlePointerMove error:', err ); }

					}

				}

			} else {

				// Hover only
				const mode = this.activeMode;
				if ( mode ) {

					try { mode.handlePointerMove( cell.gx, cell.gz, e ); }
					catch ( err ) { console.error( '[Input] handlePointerMove error:', err ); }

				}

			}

		} else {

			this._eventBus.emit( 'hover:cell', null );

		}

	}

	/** @private */
	_onPointerUp( e ) {

		if ( this._isPanning ) {

			this._isPanning = false;

		}

		if ( this._isOrbiting ) {

			this._isOrbiting = false;

		}

		if ( this._isDrawing ) {

			this._isDrawing = false;
			const mode = this.activeMode;
			if ( mode ) mode.handlePointerUp( e );

		}

		this._lastGridCell = null;

	}

	// ── Keyboard handlers ──

	/** @private */
	_onKeyDown( e ) {

		// Don't handle if focus is in an input/textarea
		if ( e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' ) return;

		// Space key tracking
		if ( e.code === 'Space' ) {

			this._spaceDown = true;
			e.preventDefault();
			return;

		}

		// Global shortcuts
		const ctrl = e.ctrlKey || e.metaKey;

		// Undo: Ctrl+Z
		if ( ctrl && ! e.shiftKey && e.code === 'KeyZ' ) {

			e.preventDefault();
			this._commandHistory.undo();
			return;

		}

		// Redo: Ctrl+Shift+Z or Ctrl+Y
		if ( ctrl && e.shiftKey && e.code === 'KeyZ' ) {

			e.preventDefault();
			this._commandHistory.redo();
			return;

		}

		if ( ctrl && e.code === 'KeyY' ) {

			e.preventDefault();
			this._commandHistory.redo();
			return;

		}

		// View presets
		if ( e.code === 'Digit1' ) { this._camera.setView( 'top' ); return; }
		if ( e.code === 'Digit2' ) { this._camera.setView( 'iso' ); return; }
		if ( e.code === 'Digit3' ) { this._camera.setView( 'front' ); return; }

		// Mode shortcuts
		if ( e.code === 'KeyB' ) { this._state.mode = 'build'; return; }
		if ( e.code === 'KeyE' ) { this._state.mode = 'sculpt'; return; }
		if ( e.code === 'KeyG' ) { this._state.mode = 'gameplay'; return; }
		if ( e.code === 'KeyD' && ! ctrl ) { this._state.mode = 'props'; return; }
		if ( e.code === 'KeyP' ) { this._state.mode = 'prop'; return; }

		// Debug toggle
		if ( e.code === 'Backquote' ) {

			this._state.debugEnabled = ! this._state.debugEnabled;
			return;

		}

		// Escape: deselect / cancel
		if ( e.code === 'Escape' ) {

			this._state.selection.clear();
			this._eventBus.emit( 'selection:changed', { selected: this._state.selection } );
			return;

		}

		// Delegate to active mode FIRST (mode may consume R for orient cycling, +/- for elevation)
		const mode = this.activeMode;
		if ( mode && mode.handleKeyDown( e.code, e ) ) {

			e.preventDefault();
			return;

		}

		// Fallback R key: rotate hovered tile (for non-build modes like sculpt)
		if ( e.code === 'KeyR' && ! ctrl && this._transform && this._state.hoveredCell ) {

			const { gx, gz } = this._state.hoveredCell;
			this._transform.rotateTile( gx, gz );
			e.preventDefault();
			return;

		}

		// Zoom (only if mode didn't consume the key)
		if ( e.code === 'Equal' || e.code === 'NumpadAdd' ) { this._camera.zoom( 100 ); return; }
		if ( e.code === 'Minus' || e.code === 'NumpadSubtract' ) { this._camera.zoom( - 100 ); return; }

	}

	/** @private */
	_onKeyUp( e ) {

		if ( e.code === 'Space' ) {

			this._spaceDown = false;

		}

	}

}

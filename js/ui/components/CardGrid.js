/**
 * CardGrid — Responsive grid of selectable cards with roving tabindex keyboard nav.
 * Component #4 per COMPONENT_SPEC.md
 */

export class CardGrid {

  static _cssInjected = false;

  static _injectCSS() {
    if (CardGrid._cssInjected) return;
    CardGrid._cssInjected = true;
    const s = document.createElement('style');
    s.textContent = `
      .kk-card-grid {
        display: grid;
        grid-template-columns: repeat(var(--kk-card-grid-cols, 3), 1fr);
        gap: var(--space-4, 16px);
        position: relative;
      }
      .kk-card-grid--loading { opacity: 0.5; pointer-events: none; }
      .kk-card-grid__row { display: contents; }
      .kk-card-grid__cell {
        background: var(--color-panel-raised, rgba(20,20,20,0.92));
        border: 1px solid var(--color-panel-border, rgba(255,255,255,0.12));
        border-radius: var(--radius-md, 4px);
        cursor: pointer;
        transition: all var(--duration-normal, 200ms) ease;
        position: relative;
        overflow: hidden;
      }
      .kk-card-grid__cell:hover {
        border-color: var(--color-panel-border-strong, rgba(255,255,255,0.18));
        background: rgba(30,30,40,0.95);
      }
      .kk-card-grid__cell:focus-visible {
        outline: 2px solid var(--color-accent-orange, #ff6b00);
        outline-offset: 2px;
      }
      .kk-card-grid__cell--selected {
        border-color: var(--color-accent-cyan, #00d4e8);
        box-shadow: 0 0 12px rgba(0,212,232,0.3);
      }
      .kk-card-grid__cell--disabled {
        opacity: 0.4;
        pointer-events: none;
      }
      .kk-card-grid__cell--locked {
        opacity: 0.6;
      }
      .kk-card-grid__cell--pressed {
        transform: scale(0.97);
      }
    `;
    document.head.appendChild(s);
  }

  /**
   * @param {object} config
   * @param {Array<{id: string, data: object, disabled?: boolean, locked?: boolean}>} config.items
   * @param {number} [config.columns]
   * @param {string|null} [config.selectedId]
   * @param {function(item): HTMLElement} config.renderCard
   * @param {'single'|'none'} [config.selectionMode]
   * @param {boolean} [config.loading]
   * @param {string} config.ariaLabel
   */
  constructor(config = {}) {
    this._config = {
      items: [],
      columns: 3,
      selectedId: null,
      renderCard: () => document.createElement('div'),
      selectionMode: 'single',
      loading: false,
      ariaLabel: 'Items',
      ...config,
    };

    this._el = null;
    this._cells = []; // flat array of { el, item } in DOM order
    this._roverIndex = 0;
    this._selectedId = this._config.selectedId;

    CardGrid._injectCSS();
    this._build();
    this._bindEvents();
  }

  _build() {
    const { items, columns, loading, ariaLabel } = this._config;

    const grid = document.createElement('div');
    grid.className = 'kk-card-grid';
    grid.setAttribute('role', 'grid');
    grid.setAttribute('aria-label', ariaLabel);
    grid.style.setProperty('--kk-card-grid-cols', String(columns));

    const numRows = Math.ceil(items.length / columns);
    grid.setAttribute('aria-rowcount', String(numRows));
    grid.setAttribute('aria-colcount', String(columns));

    if (loading) {
      grid.classList.add('kk-card-grid--loading');
      grid.setAttribute('aria-busy', 'true');
    }

    this._cells = [];
    let cellIdx = 0;

    for (let row = 0; row < numRows; row++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'kk-card-grid__row';
      rowEl.setAttribute('role', 'row');

      for (let col = 0; col < columns; col++) {
        const itemIndex = row * columns + col;
        if (itemIndex >= items.length) break;

        const item = items[itemIndex];
        const cell = document.createElement('div');
        cell.className = 'kk-card-grid__cell';
        cell.setAttribute('role', 'gridcell');
        cell.dataset.id = item.id;

        const isSelected = item.id === this._selectedId;
        cell.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        if (isSelected) cell.classList.add('kk-card-grid__cell--selected');

        if (item.disabled) {
          cell.setAttribute('aria-disabled', 'true');
          cell.classList.add('kk-card-grid__cell--disabled');
        }
        if (item.locked) {
          cell.setAttribute('aria-disabled', 'true');
          cell.classList.add('kk-card-grid__cell--locked');
        }

        // Roving tabindex: first non-disabled, non-locked cell gets 0
        const isNavigable = !item.disabled && !item.locked;
        cell.setAttribute('tabindex', '-1');

        const cardEl = this._config.renderCard(item);
        cell.appendChild(cardEl);

        rowEl.appendChild(cell);
        this._cells.push({ el: cell, item, row, col: cellIdx % columns });
        cellIdx++;
      }

      grid.appendChild(rowEl);
    }

    // Set initial rover
    this._setRover(this._findFirstNavigable());

    this._el = grid;
  }

  _findFirstNavigable() {
    for (let i = 0; i < this._cells.length; i++) {
      const { item } = this._cells[i];
      if (!item.disabled && !item.locked) return i;
    }
    return 0;
  }

  _setRover(index) {
    this._cells.forEach(({ el }, i) => {
      el.setAttribute('tabindex', i === index ? '0' : '-1');
    });
    this._roverIndex = index;
  }

  _selectCell(index) {
    if (this._config.selectionMode === 'none') return;
    const { item } = this._cells[index];
    if (item.disabled || item.locked) return;

    const prevId = this._selectedId;
    this._selectedId = item.id;

    this._cells.forEach(({ el, item: ci }) => {
      const sel = ci.id === this._selectedId;
      el.setAttribute('aria-selected', sel ? 'true' : 'false');
      el.classList.toggle('kk-card-grid__cell--selected', sel);
    });

    if (item.id !== prevId) {
      this._el.dispatchEvent(
        new CustomEvent('kk:cardgrid:select', {
          bubbles: true,
          composed: true,
          detail: { id: item.id, data: item.data },
        })
      );
    }
  }

  _activateCell(index) {
    const { item } = this._cells[index];
    if (item.disabled || item.locked) return;
    this._selectCell(index);
    this._el.dispatchEvent(
      new CustomEvent('kk:cardgrid:activate', {
        bubbles: true,
        composed: true,
        detail: { id: item.id, data: item.data },
      })
    );
  }

  _bindEvents() {
    const grid = this._el;
    const cols = this._config.columns;

    // Click
    grid.addEventListener('click', (e) => {
      const cellEl = e.target.closest('.kk-card-grid__cell');
      if (!cellEl) return;
      const idx = this._cells.findIndex(({ el }) => el === cellEl);
      if (idx === -1) return;
      this._setRover(idx);
      this._activateCell(idx);
    });

    // Pointer pressed state
    grid.addEventListener('pointerdown', (e) => {
      const cellEl = e.target.closest('.kk-card-grid__cell');
      if (cellEl) cellEl.classList.add('kk-card-grid__cell--pressed');
    });
    const clearPressed = (e) => {
      const cellEl = e.target.closest?.('.kk-card-grid__cell');
      if (cellEl) cellEl.classList.remove('kk-card-grid__cell--pressed');
      // Clear all pressed states on cancel
      grid.querySelectorAll('.kk-card-grid__cell--pressed').forEach((el) =>
        el.classList.remove('kk-card-grid__cell--pressed')
      );
    };
    grid.addEventListener('pointerup', clearPressed);
    grid.addEventListener('pointercancel', clearPressed);

    // Keyboard
    grid.addEventListener('keydown', (e) => {
      let idx = this._roverIndex;
      const total = this._cells.length;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          idx = (idx + 1) % total;
          break;
        case 'ArrowLeft':
          e.preventDefault();
          idx = (idx - 1 + total) % total;
          break;
        case 'ArrowDown':
          e.preventDefault();
          idx = Math.min(idx + cols, total - 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          idx = Math.max(idx - cols, 0);
          break;
        case 'Home':
          e.preventDefault();
          idx = Math.floor(this._roverIndex / cols) * cols;
          break;
        case 'End': {
          e.preventDefault();
          const rowStart = Math.floor(this._roverIndex / cols) * cols;
          idx = Math.min(rowStart + cols - 1, total - 1);
          break;
        }
        case 'Enter':
        case ' ':
          e.preventDefault();
          this._activateCell(idx);
          return;
        case 'Escape':
          e.preventDefault();
          if (this._selectedId !== null) {
            this._selectedId = null;
            this._cells.forEach(({ el }) => {
              el.setAttribute('aria-selected', 'false');
              el.classList.remove('kk-card-grid__cell--selected');
            });
          }
          return;
        default:
          if (e.ctrlKey || e.metaKey) {
            if (e.key === 'Home') { e.preventDefault(); idx = 0; }
            else if (e.key === 'End') { e.preventDefault(); idx = total - 1; }
            else return;
          } else return;
      }

      this._setRover(idx);
      this._cells[idx].el.focus();
    });
  }

  /** @returns {HTMLElement} */
  get el() {
    return this._el;
  }

  setLoading(loading) {
    if (loading) {
      this._el.classList.add('kk-card-grid--loading');
      this._el.setAttribute('aria-busy', 'true');
    } else {
      this._el.classList.remove('kk-card-grid--loading');
      this._el.removeAttribute('aria-busy');
    }
  }

  setSelectedId(id) {
    this._selectedId = id;
    this._cells.forEach(({ el, item }, i) => {
      const sel = item.id === id;
      el.setAttribute('aria-selected', sel ? 'true' : 'false');
      el.classList.toggle('kk-card-grid__cell--selected', sel);
      if (sel) this._setRover(i);
    });
  }

  dispose() {
    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }
    this._el = null;
    this._cells = [];
  }
}

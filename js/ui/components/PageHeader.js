/**
 * PageHeader — Page title + back-chevron button.
 * Component #2 per COMPONENT_SPEC.md
 */

const CHEVRON_LEFT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;

export class PageHeader {

  static _cssInjected = false;

  static _injectCSS() {
    if (PageHeader._cssInjected) return;
    PageHeader._cssInjected = true;
    const s = document.createElement('style');
    s.textContent = `
      .kk-page-header {
        display: flex;
        align-items: center;
        gap: var(--space-3, 12px);
        padding: var(--space-4, 16px) 0;
      }
      .kk-page-header__back {
        display: flex;
        align-items: center;
        justify-content: center;
        width: var(--hit-target-min, 48px);
        height: var(--hit-target-min, 48px);
        background: none;
        border: 1px solid var(--color-panel-border, rgba(255,255,255,0.12));
        border-radius: var(--radius-md, 4px);
        color: var(--color-white, #fff);
        cursor: pointer;
        transition: all var(--duration-fast, 100ms) ease;
        flex-shrink: 0;
      }
      .kk-page-header__back:hover {
        background: rgba(255,255,255,0.05);
        border-color: var(--color-panel-border-strong, rgba(255,255,255,0.18));
      }
      .kk-page-header__back--pressed { transform: scale(0.92); }
      .kk-page-header__back--disabled { opacity: 0.3; pointer-events: none; }
      .kk-page-header__back:focus-visible {
        outline: 2px solid var(--color-accent-orange, #ff6b00);
        outline-offset: 2px;
      }
      .kk-page-header__back-icon { width: 20px; height: 20px; }
      .kk-page-header__back-icon svg { width: 100%; height: 100%; }
      .kk-page-header__title {
        font-family: var(--font-display, 'Impact', sans-serif);
        font-weight: var(--weight-black, 900);
        font-size: var(--text-2xl, 1.75rem);
        color: var(--color-white, #fff);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide, 0.04em);
        margin: 0;
        line-height: var(--leading-tight, 1.1);
      }
    `;
    document.head.appendChild(s);
  }

  /**
   * @param {object} config
   * @param {string} config.title
   * @param {boolean} [config.showBack]
   * @param {Function} [config.onBack]
   */
  constructor(config = {}) {
    this._config = {
      title: '',
      showBack: true,
      onBack: null,
      ...config,
    };

    this._el = null;
    this._backBtn = null;
    this._titleEl = null;

    PageHeader._injectCSS();
    this._build();
    this._bindEvents();
  }

  _build() {
    const { title, showBack } = this._config;

    const header = document.createElement('header');
    header.className = 'kk-page-header';
    header.setAttribute('role', 'banner');

    // Back button — always in DOM; hidden when showBack is false
    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'kk-page-header__back';
    backBtn.setAttribute('aria-label', 'Go back');

    const backIcon = document.createElement('span');
    backIcon.className = 'kk-page-header__back-icon';
    backIcon.setAttribute('aria-hidden', 'true');
    backIcon.innerHTML = CHEVRON_LEFT_SVG;
    backBtn.appendChild(backIcon);

    if (!showBack) {
      backBtn.hidden = true;
    }

    header.appendChild(backBtn);
    this._backBtn = backBtn;

    // Title
    const h1 = document.createElement('h1');
    h1.className = 'kk-page-header__title';
    h1.textContent = title;
    header.appendChild(h1);
    this._titleEl = h1;

    this._el = header;
  }

  _bindEvents() {
    const btn = this._backBtn;

    btn.addEventListener('pointerdown', () => btn.classList.add('kk-page-header__back--pressed'));
    const clearPressed = () => btn.classList.remove('kk-page-header__back--pressed');
    btn.addEventListener('pointerup', clearPressed);
    btn.addEventListener('pointercancel', clearPressed);

    btn.addEventListener('click', () => {
      if (btn.getAttribute('aria-disabled') === 'true') return;

      // Emit event regardless — page controller may listen
      this._el.dispatchEvent(
        new CustomEvent('kk:pageheader:back', {
          bubbles: true,
          composed: true,
          detail: {},
        })
      );

      // Invoke callback if provided
      if (typeof this._config.onBack === 'function') {
        this._config.onBack();
      }
    });
  }

  /** @returns {HTMLElement} */
  get el() {
    return this._el;
  }

  setTitle(title) {
    this._titleEl.textContent = title;
  }

  setShowBack(show) {
    this._config.showBack = show;
    this._backBtn.hidden = !show;
  }

  setDisabled(disabled) {
    if (disabled) {
      this._backBtn.setAttribute('aria-disabled', 'true');
      this._backBtn.classList.add('kk-page-header__back--disabled');
    } else {
      this._backBtn.removeAttribute('aria-disabled');
      this._backBtn.classList.remove('kk-page-header__back--disabled');
    }
  }

  dispose() {
    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }
    this._el = null;
    this._backBtn = null;
    this._titleEl = null;
  }
}

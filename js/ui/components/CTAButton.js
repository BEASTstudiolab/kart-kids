/**
 * CTAButton — Primary or secondary action button.
 * Component #8 per COMPONENT_SPEC.md
 */

let _ctaBtnUid = 0;

export class CTAButton {
  static _cssInjected = false;
  /**
   * @param {object} config
   * @param {string} config.label
   * @param {string|null} [config.sublabel]
   * @param {SVGElement|null} [config.icon]
   * @param {'primary'|'secondary'|'danger'|'ghost'} [config.variant]
   * @param {string} [config.actionId]
   * @param {boolean} [config.disabled]
   * @param {boolean} [config.loading]
   * @param {string|null} [config.ariaLabel]
   * @param {boolean|null} [config.ariaPressed]
   * @param {Function} [config.onClick]
   */
  constructor(config = {}) {
    this._id = ++_ctaBtnUid;
    this._config = {
      label: '',
      sublabel: null,
      icon: null,
      variant: 'primary',
      actionId: '',
      disabled: false,
      loading: false,
      ariaLabel: null,
      ariaPressed: null,
      onClick: null,
      ...config,
    };

    this._el = null;
    this._injectCSS();
    this._build();
    this._bindEvents();
  }

  _injectCSS() {
    if (CTAButton._cssInjected) return;
    CTAButton._cssInjected = true;

    const style = document.createElement('style');
    style.textContent = `
      .kk-cta-button {
        position: relative;
        display: inline-flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        gap: var(--space-2);
        padding: 0 var(--space-6);
        min-height: var(--hit-target-min);
        min-width: var(--hit-target-min);
        border: none;
        border-radius: var(--radius-md);
        font-family: var(--font-display);
        font-size: var(--text-md);
        font-weight: var(--weight-bold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wider);
        cursor: pointer;
        transition:
          background var(--duration-fast) var(--ease-standard),
          box-shadow var(--duration-fast) var(--ease-standard),
          opacity var(--duration-fast) var(--ease-standard);
        overflow: hidden;
        white-space: nowrap;
        user-select: none;
      }

      .kk-cta-button--hero {
        font-size: clamp(3rem, 5vw, var(--text-5xl));
        font-weight: var(--weight-black);
        line-height: 1;
        padding: var(--space-6) var(--space-10);
      }

      /* --- Variants --- */

      .kk-cta-button--primary {
        background: var(--color-cta-primary);
        color: var(--color-cta-primary-text);
      }
      .kk-cta-button--primary:hover:not([aria-disabled="true"]):not([aria-busy="true"]) {
        background: var(--color-cta-primary-hover);
        box-shadow: var(--shadow-accent-orange);
      }

      .kk-cta-button--secondary {
        background: var(--color-cta-secondary);
        color: var(--color-cta-secondary-text);
        border: var(--border-base) solid var(--color-cta-secondary-border);
      }
      .kk-cta-button--secondary:hover:not([aria-disabled="true"]):not([aria-busy="true"]) {
        border-color: var(--color-ink-200);
        background: rgba(255, 255, 255, 0.06);
      }

      .kk-cta-button--danger {
        background: var(--color-cta-danger);
        color: var(--color-cta-danger-text);
      }
      .kk-cta-button--danger:hover:not([aria-disabled="true"]):not([aria-busy="true"]) {
        background: var(--color-error);
        filter: brightness(1.15);
      }

      .kk-cta-button--ghost {
        background: transparent;
        color: var(--color-cta-ghost-text);
        border: var(--border-thin) solid transparent;
      }
      .kk-cta-button--ghost:hover:not([aria-disabled="true"]):not([aria-busy="true"]) {
        color: var(--color-white);
        border-color: var(--color-panel-border-strong);
        background: rgba(255, 255, 255, 0.04);
      }

      /* --- Pressed state --- */
      .kk-cta-button--pressed {
        transform: scale(0.97);
      }

      /* --- Disabled state --- */
      .kk-cta-button--disabled,
      .kk-cta-button[aria-disabled="true"] {
        opacity: 0.38;
        cursor: not-allowed;
        pointer-events: none;
      }

      /* --- Loading state --- */
      .kk-cta-button--loading .kk-cta-button__label,
      .kk-cta-button--loading .kk-cta-button__sublabel,
      .kk-cta-button--loading .kk-cta-button__icon {
        opacity: 0;
      }
      .kk-cta-button--loading .kk-cta-button__spinner {
        opacity: 1;
      }

      /* --- Inner elements --- */

      .kk-cta-button__icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 1.25em;
        height: 1.25em;
        flex-shrink: 0;
      }

      .kk-cta-button__label {
        flex: 0 1 auto;
      }

      .kk-cta-button__sublabel {
        font-size: var(--text-xs);
        font-weight: var(--weight-regular);
        opacity: 0.7;
        letter-spacing: var(--tracking-normal);
        text-transform: none;
      }

      .kk-cta-button__spinner {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        pointer-events: none;
      }
      .kk-cta-button__spinner::after {
        content: '';
        width: 1.25em;
        height: 1.25em;
        border: var(--border-base) solid currentColor;
        border-top-color: transparent;
        border-radius: 50%;
        animation: kk-cta-spin var(--duration-slow) linear infinite;
      }

      @keyframes kk-cta-spin {
        to { transform: rotate(360deg); }
      }

      @media (prefers-reduced-motion: reduce) {
        .kk-cta-button__spinner::after {
          animation: none;
          border-top-color: currentColor;
          opacity: 0.5;
        }
      }
    `;
    document.head.appendChild(style);
  }

  _build() {
    const { label, sublabel, icon, variant, actionId, disabled, loading, ariaLabel, ariaPressed } =
      this._config;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `kk-cta-button kk-cta-button--${variant}`;
    btn.dataset.action = actionId;

    if (ariaLabel) btn.setAttribute('aria-label', ariaLabel);
    if (ariaPressed !== null) btn.setAttribute('aria-pressed', String(ariaPressed));

    if (disabled) {
      btn.setAttribute('aria-disabled', 'true');
      btn.classList.add('kk-cta-button--disabled');
    }
    if (loading) {
      btn.setAttribute('aria-busy', 'true');
      btn.classList.add('kk-cta-button--loading');
    }

    // Icon slot
    if (icon) {
      const iconWrap = document.createElement('span');
      iconWrap.className = 'kk-cta-button__icon';
      iconWrap.setAttribute('aria-hidden', 'true');
      iconWrap.appendChild(icon);
      btn.appendChild(iconWrap);
    }

    // Label
    const labelEl = document.createElement('span');
    labelEl.className = 'kk-cta-button__label';
    labelEl.textContent = label;
    btn.appendChild(labelEl);

    // Sublabel
    if (sublabel) {
      const sub = document.createElement('span');
      sub.className = 'kk-cta-button__sublabel';
      sub.setAttribute('aria-hidden', 'true');
      sub.textContent = sublabel;
      btn.appendChild(sub);
    }

    // Spinner — always in DOM, shown via CSS --loading modifier
    const spinner = document.createElement('span');
    spinner.className = 'kk-cta-button__spinner';
    spinner.setAttribute('aria-hidden', 'true');
    btn.appendChild(spinner);

    this._el = btn;
    this._labelEl = labelEl;
  }

  _bindEvents() {
    const btn = this._el;

    // Pressed state
    btn.addEventListener('pointerdown', () => {
      if (!this._isDisabled()) btn.classList.add('kk-cta-button--pressed');
    });
    const clearPressed = () => btn.classList.remove('kk-cta-button--pressed');
    btn.addEventListener('pointerup', clearPressed);
    btn.addEventListener('pointercancel', clearPressed);

    // Click / activation
    btn.addEventListener('click', (e) => {
      if (this._isDisabled() || this._isLoading()) {
        e.preventDefault();
        return;
      }
      btn.dispatchEvent(
        new CustomEvent('kk:cta-button:click', {
          bubbles: true,
          composed: true,
          detail: { actionId: this._config.actionId },
        })
      );
      if (typeof this._config.onClick === 'function') {
        this._config.onClick(e);
      }
    });

    // Keyboard: Space fires click natively for button; Enter also fires natively.
    // Aria-disabled buttons must block activation manually.
    btn.addEventListener('keydown', (e) => {
      if (this._isDisabled() && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
      }
    });
  }

  _isDisabled() {
    return this._el.getAttribute('aria-disabled') === 'true';
  }

  _isLoading() {
    return this._el.getAttribute('aria-busy') === 'true';
  }

  /** @returns {HTMLButtonElement} */
  get el() {
    return this._el;
  }

  setDisabled(disabled) {
    if (disabled) {
      this._el.setAttribute('aria-disabled', 'true');
      this._el.classList.add('kk-cta-button--disabled');
    } else {
      this._el.removeAttribute('aria-disabled');
      this._el.classList.remove('kk-cta-button--disabled');
    }
  }

  setLoading(loading) {
    if (loading) {
      this._el.setAttribute('aria-busy', 'true');
      this._el.classList.add('kk-cta-button--loading');
    } else {
      this._el.removeAttribute('aria-busy');
      this._el.classList.remove('kk-cta-button--loading');
    }
  }

  setPressed(pressed) {
    if (this._config.ariaPressed !== null) {
      this._el.setAttribute('aria-pressed', String(pressed));
    }
  }

  setLabel(label) {
    this._labelEl.textContent = label;
  }

  dispose() {
    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }
    this._el = null;
  }
}

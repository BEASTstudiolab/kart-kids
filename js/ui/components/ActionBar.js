/**
 * ActionBar — Bottom-anchored page action bar with primary and secondary CTA slots.
 * Component #5 per COMPONENT_SPEC.md
 */

import { CTAButton } from './CTAButton.js';

export class ActionBar {

  static _cssInjected = false;

  static _injectCSS() {
    if (ActionBar._cssInjected) return;
    ActionBar._cssInjected = true;
    const s = document.createElement('style');
    s.textContent = `
      .kk-action-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-4, 16px) var(--space-6, 24px);
        background: var(--color-panel-base, rgba(10,10,10,0.88));
        border-top: 1px solid var(--color-panel-border, rgba(255,255,255,0.12));
        min-height: var(--actionbar-height, 80px);
        position: relative;
        z-index: var(--z-panel, 10);
      }
      .kk-action-bar--hidden { display: none; }
      .kk-action-bar__secondary {
        display: flex;
        align-items: center;
        gap: var(--space-3, 12px);
      }
      .kk-action-bar__primary {
        display: flex;
        align-items: center;
        margin-left: auto;
      }
    `;
    document.head.appendChild(s);
  }

  /**
   * @param {object} config
   * @param {object} config.primary              CTAButtonConfig object
   * @param {object[]|null} [config.secondary]   Array of CTAButtonConfig objects (max 3)
   * @param {boolean} [config.hidden]
   */
  constructor(config = {}) {
    this._config = {
      primary: null,
      secondary: null,
      hidden: false,
      ...config,
    };

    this._el = null;
    this._primaryBtn = null;
    this._secondaryBtns = [];

    ActionBar._injectCSS();
    this._build();
  }

  _build() {
    const { primary, secondary, hidden } = this._config;

    const bar = document.createElement('div');
    bar.className = 'kk-action-bar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Page actions');

    if (hidden) bar.classList.add('kk-action-bar--hidden');

    // Secondary section — only rendered when secondary actions provided
    if (secondary && secondary.length > 0) {
      const secondarySection = document.createElement('div');
      secondarySection.className = 'kk-action-bar__secondary';

      const capped = secondary.slice(0, 3);
      capped.forEach((cfg) => {
        const btn = new CTAButton(cfg);
        secondarySection.appendChild(btn.el);
        this._secondaryBtns.push(btn);
      });

      bar.appendChild(secondarySection);
      this._secondaryEl = secondarySection;
    }

    // Primary section — required
    const primarySection = document.createElement('div');
    primarySection.className = 'kk-action-bar__primary';

    if (primary) {
      const btn = new CTAButton(primary);
      primarySection.appendChild(btn.el);
      this._primaryBtn = btn;
    }

    bar.appendChild(primarySection);
    this._primaryEl = primarySection;

    this._el = bar;
  }

  /** @returns {HTMLElement} */
  get el() {
    return this._el;
  }

  /** @returns {CTAButton|null} */
  get primaryButton() {
    return this._primaryBtn;
  }

  /** @returns {CTAButton[]} */
  get secondaryButtons() {
    return this._secondaryBtns;
  }

  setHidden(hidden) {
    this._el.classList.toggle('kk-action-bar--hidden', hidden);
  }

  setPrimaryLoading(loading) {
    this._primaryBtn?.setLoading(loading);
  }

  setPrimaryDisabled(disabled) {
    this._primaryBtn?.setDisabled(disabled);
  }

  dispose() {
    this._primaryBtn?.dispose();
    this._secondaryBtns.forEach((b) => b.dispose());
    this._secondaryBtns = [];

    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }
    this._el = null;
    this._primaryBtn = null;
  }
}

/**
 * SectionPanel — Dark translucent content grouping container.
 * Component #3 per COMPONENT_SPEC.md
 */

let _spUid = 0;

export class SectionPanel {
  static _cssInjected = false;
  /**
   * @param {object} config
   * @param {string|null} [config.title]
   * @param {2|3|4} [config.headingLevel]
   * @param {HTMLElement[]} [config.headerActions]
   * @param {boolean} [config.loading]
   * @param {string} [config.uid]
   */
  constructor(config = {}) {
    this._config = {
      title: null,
      headingLevel: 2,
      headerActions: [],
      loading: false,
      uid: null,
      ...config,
    };

    this._uid = this._config.uid ?? String(++_spUid);
    this._el = null;
    this._bodyEl = null;
    this._headerEl = null;

    this._build();
  }

  _build() {
    const { title, headingLevel, headerActions, loading } = this._config;
    const uid = this._uid;

    const section = document.createElement('section');
    section.className = 'kk-section-panel';
    section.setAttribute('aria-labelledby', `sp-${uid}-title`);

    if (loading) {
      section.classList.add('kk-section-panel--loading');
    }

    // Header — only render when title or headerActions are present
    const hasHeader = title !== null || (headerActions && headerActions.length > 0);
    if (hasHeader) {
      const header = document.createElement('div');
      header.className = 'kk-section-panel__header';

      if (title !== null) {
        const level = Math.min(Math.max(headingLevel, 2), 4);
        const heading = document.createElement(`h${level}`);
        heading.className = 'kk-section-panel__title';
        heading.id = `sp-${uid}-title`;
        heading.textContent = title;
        header.appendChild(heading);
      }

      if (headerActions && headerActions.length > 0) {
        const actionsSlot = document.createElement('div');
        actionsSlot.className = 'kk-section-panel__header-actions';
        headerActions.forEach((el) => actionsSlot.appendChild(el));
        header.appendChild(actionsSlot);
      }

      section.appendChild(header);
      this._headerEl = header;
    }

    // Body
    const body = document.createElement('div');
    body.className = 'kk-section-panel__body';
    if (loading) body.setAttribute('aria-busy', 'true');
    section.appendChild(body);
    this._bodyEl = body;

    this._el = section;
  }

  /** @returns {HTMLElement} */
  get el() {
    return this._el;
  }

  /** @returns {HTMLElement} The body container for slot content. */
  get body() {
    return this._bodyEl;
  }

  /** Append content into the body slot. */
  append(...nodes) {
    nodes.forEach((n) => this._bodyEl.appendChild(n));
  }

  setLoading(loading) {
    if (loading) {
      this._el.classList.add('kk-section-panel--loading');
      this._bodyEl.setAttribute('aria-busy', 'true');
    } else {
      this._el.classList.remove('kk-section-panel--loading');
      this._bodyEl.removeAttribute('aria-busy');
    }
  }

  dispose() {
    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }
    this._el = null;
    this._bodyEl = null;
    this._headerEl = null;
  }
}

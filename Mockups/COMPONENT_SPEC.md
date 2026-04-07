# Kart Kids — Foundation Component Interaction Specification

**Version:** 1.0  
**Author:** UX Designer  
**Status:** Approved for implementation  
**For:** UI Programmer  

All class names use the `kk-` prefix. All CustomEvents bubble and are composed.
All interactive components are keyboard-navigable and gamepad-navigable.
All text meets WCAG AA contrast against dark translucent panel backgrounds.

---

## Global conventions

### State modifier classes
Applied to the root element of the component. Multiple states may coexist.

| State | Class suffix |
|---|---|
| hover | `--hover` (CSS :hover; do not set via JS) |
| focus | `--focus` (CSS :focus-visible; do not set via JS) |
| selected | `--selected` |
| pressed | `--pressed` (transient; add on pointerdown, remove on pointerup/pointercancel) |
| disabled | `--disabled` + `aria-disabled="true"` |
| loading | `--loading` + `aria-busy="true"` |
| locked | `--locked` + `aria-disabled="true"` |
| error | `--error` |
| success | `--success` |

### Focus ring
All focusable elements must show a 2px solid accent-color outline with 2px offset on `:focus-visible`. No custom outline suppression without replacement.

### Hit target minimum
48x48 CSS px on all interactive elements.

### Z-index layers
```
--z-base:    0
--z-panel:   10
--z-topnav:  100
--z-modal:   500
--z-toast:   600
```

---

## Navigation

---

### 1. TopNav

**Purpose:** Persistent compact horizontal navigation bar displayed on all inner pages (all pages except Title Screen `/` and Pause Menu `/pause`).

#### DOM structure

```html
<nav class="kk-top-nav" role="navigation" aria-label="Main navigation">
  <div class="kk-top-nav__brand">
    <img class="kk-top-nav__logo" src="..." alt="Kart Kids" />
    <span class="kk-top-nav__wordmark" aria-hidden="true">KART KIDS</span>
  </div>
  <ul class="kk-top-nav__list" role="list">
    <li class="kk-top-nav__item" role="listitem">
      <button
        class="kk-top-nav__link"
        type="button"
        data-route="/play"
        aria-current="false"
      >
        <span class="kk-top-nav__link-label">PLAY MODES</span>
      </button>
    </li>
    <!-- repeated per nav item -->
  </ul>
  <div class="kk-top-nav__utility">
    <!-- notification badge, currency strip, avatar -->
  </div>
</nav>
```

Nesting: `nav.kk-top-nav` > `div.kk-top-nav__brand` + `ul.kk-top-nav__list` + `div.kk-top-nav__utility`.  
Each list item contains exactly one `button.kk-top-nav__link`.

#### Interaction states

| State | Applies to |
|---|---|
| default | all links |
| hover | all links |
| focus | all links |
| selected | the link whose route matches the current page (`aria-current="page"`) |
| pressed | transient on click |
| disabled | optional; individual links may be disabled (e.g., when a feature is locked) |

#### Keyboard behavior

| Key | Action |
|---|---|
| `Tab` | Moves focus forward through brand, then each nav link left-to-right, then utility items |
| `Shift+Tab` | Reverse |
| `ArrowRight` | Within `kk-top-nav__list`: moves focus to next list item, wraps |
| `ArrowLeft` | Within `kk-top-nav__list`: moves focus to previous list item, wraps |
| `Enter` / `Space` | Activates the focused nav link |
| `Escape` | No action (TopNav has no open sub-panels) |

#### Focus management

- On page mount: TopNav does not steal focus; the page content region receives initial focus.
- No focus trap; TopNav participates in natural document tab order.
- Arrow key navigation is scoped to `kk-top-nav__list` only; `Tab` exits the list.

#### ARIA

```
nav[role="navigation"][aria-label="Main navigation"]
ul[role="list"]
li[role="listitem"]
button[aria-current="page"] on the active route item
button[aria-current="false"] on inactive items
button[aria-disabled="true"] when disabled
```

No live regions on TopNav itself; route changes announce via a separate `aria-live` region in AppShell.

#### Config props

```js
new TopNav({
  items: [
    { label: string, route: string, disabled?: boolean }
  ],
  activeRoute: string,        // current page route; sets aria-current
  showBrand: boolean,         // default true
  showUtility: boolean,       // default true
})
```

#### Events emitted

```js
// User activates a nav link
'kk:topnav:navigate'  →  detail: { route: string, label: string }
```

#### CSS class naming

`kk-top-nav`, `kk-top-nav__brand`, `kk-top-nav__logo`, `kk-top-nav__wordmark`,  
`kk-top-nav__list`, `kk-top-nav__item`, `kk-top-nav__link`, `kk-top-nav__link-label`,  
`kk-top-nav__utility`

State modifiers on `kk-top-nav__link`: `--selected`, `--disabled`, `--pressed`

---

### 2. PageHeader

**Purpose:** Displays the current page title and a single back-chevron button for inner-page navigation; console-style, no breadcrumb trail.

#### DOM structure

```html
<header class="kk-page-header" role="banner">
  <button
    class="kk-page-header__back"
    type="button"
    aria-label="Go back"
  >
    <svg class="kk-page-header__back-icon" aria-hidden="true"><!-- chevron-left --></svg>
  </button>
  <h1 class="kk-page-header__title">GARAGE</h1>
</header>
```

When `showBack` is false (e.g., Home page where TopNav is the nav layer), the back button is hidden via `hidden` attribute, not removed from DOM.

#### Interaction states

| State | Applies to |
|---|---|
| default | back button |
| hover | back button |
| focus | back button |
| pressed | back button |
| disabled | back button (when at root of stack) |

#### Keyboard behavior

| Key | Action |
|---|---|
| `Tab` | Enters back button from TopNav; exits to page content |
| `Enter` / `Space` | Fires back navigation |
| `Backspace` (page level, not in input) | May optionally be wired by the page controller to trigger back; PageHeader itself does not bind this |

#### Focus management

- Back button participates in natural tab order after TopNav and before page content.
- No focus trap.

#### ARIA

```
header[role="banner"]
button[aria-label="Go back"]
h1 — page title (screen readers read this as level-1 heading)
```

#### Config props

```js
new PageHeader({
  title: string,
  showBack: boolean,     // default true
  onBack: Function,      // callback; if omitted, defaults to NavigationService.back()
})
```

#### Events emitted

```js
'kk:pageheader:back'  →  detail: {}
```

#### CSS class naming

`kk-page-header`, `kk-page-header__back`, `kk-page-header__back-icon`, `kk-page-header__title`

State modifiers on `kk-page-header__back`: `--disabled`

---

## Layout

---

### 3. SectionPanel

**Purpose:** Dark translucent rectangular container that groups related content within a page; the primary surface for all inner-page modules.

#### DOM structure

```html
<section class="kk-section-panel" aria-labelledby="sp-[uid]-title">
  <div class="kk-section-panel__header">
    <h2 class="kk-section-panel__title" id="sp-[uid]-title">KART STATS</h2>
    <div class="kk-section-panel__header-actions">
      <!-- optional: badge, action button slot -->
    </div>
  </div>
  <div class="kk-section-panel__body">
    <!-- slotted content -->
  </div>
</section>
```

`[uid]` is a stable, auto-incrementing integer assigned at construction.  
`kk-section-panel__header` and `kk-section-panel__header-actions` are omitted from DOM when `title` is null and `headerActions` is empty.

#### Interaction states

SectionPanel is a layout container; it does not have interactive states itself.  
Child components carry their own states.  
The panel supports a `--loading` modifier which overlays a skeleton shimmer over `kk-section-panel__body`.

#### Keyboard behavior

SectionPanel is not itself focusable. Focus moves naturally through child elements.

#### Focus management

No focus management at the panel level. Child components own their focus behavior.

#### ARIA

```
section[aria-labelledby="sp-[uid]-title"]
h2[id="sp-[uid]-title"]   (level may be overridden via headingLevel prop)
div[aria-busy="true"]      when --loading modifier is active
```

#### Config props

```js
new SectionPanel({
  title: string | null,          // null = no header rendered
  headingLevel: 2 | 3 | 4,      // default 2; controls h-tag level
  headerActions: HTMLElement[],  // injected into header-actions slot
  loading: boolean,              // default false
  uid: string,                   // auto-generated if omitted
})
```

#### Events emitted

None. SectionPanel is a passive container.

#### CSS class naming

`kk-section-panel`, `kk-section-panel__header`, `kk-section-panel__title`,  
`kk-section-panel__header-actions`, `kk-section-panel__body`

State modifiers on root: `--loading`

---

### 4. CardGrid

**Purpose:** Responsive grid of selectable or navigable cards with unified keyboard navigation.

#### DOM structure

```html
<div
  class="kk-card-grid"
  role="grid"
  aria-label="[context label e.g. 'Karts']"
  aria-rowcount="[N]"
  aria-colcount="[cols]"
>
  <div class="kk-card-grid__row" role="row">
    <div
      class="kk-card-grid__cell"
      role="gridcell"
      aria-selected="false"
      tabindex="-1"
    >
      <!-- card content; any component -->
    </div>
    <!-- repeated -->
  </div>
  <!-- repeated rows -->
</div>
```

Grid columns are defined by CSS `--kk-card-grid-cols` custom property (default 3).  
The first cell in the grid receives `tabindex="0"` on mount; all others are `-1` (roving tabindex pattern).

#### Interaction states

| State | Applies to |
|---|---|
| default | each cell |
| hover | each cell |
| focus | the currently focused cell (roving tabindex) |
| selected | the chosen cell (`aria-selected="true"`) |
| pressed | transient on activation |
| disabled | individual cells may be disabled |
| locked | individual cells may be locked |
| loading | root grid receives `--loading` while data loads |

#### Keyboard behavior

| Key | Action |
|---|---|
| `Tab` | Enters grid on the rover cell; a second Tab exits grid entirely |
| `ArrowRight` | Focus next cell in row; wraps to first cell of next row |
| `ArrowLeft` | Focus previous cell in row; wraps to last cell of previous row |
| `ArrowDown` | Focus cell directly below (same column index, next row) |
| `ArrowUp` | Focus cell directly above (same column index, previous row) |
| `Home` | Focus first cell in current row |
| `End` | Focus last cell in current row |
| `Ctrl+Home` | Focus first cell in grid |
| `Ctrl+End` | Focus last cell in grid |
| `Enter` / `Space` | Activates focused cell (selects or navigates) |
| `Escape` | Deselects current selection if one exists; otherwise no action |

#### Focus management

- Roving tabindex: exactly one cell holds `tabindex="0"` at all times.
- On grid mount: first non-disabled, non-locked cell gets `tabindex="0"`.
- On re-entry via Tab: focus returns to the cell that last held `tabindex="0"`.
- When selected item changes programmatically, roving focus follows the selection.

#### ARIA

```
div[role="grid"][aria-label][aria-rowcount][aria-colcount]
div[role="row"]
div[role="gridcell"][aria-selected][tabindex]
div[aria-busy="true"]  on root when loading
div[aria-disabled="true"]  on disabled cells
```

Live region: selection change announces via the AppShell `aria-live="polite"` region.

#### Config props

```js
new CardGrid({
  items: Array<{ id: string, data: object }>,
  columns: number,                // default 3; overridable via CSS var
  selectedId: string | null,
  renderCard: (item) => HTMLElement,  // factory function
  selectionMode: 'single' | 'none',   // default 'single'
  loading: boolean,
  ariaLabel: string,
})
```

#### Events emitted

```js
'kk:cardgrid:select'   →  detail: { id: string, data: object }
'kk:cardgrid:activate' →  detail: { id: string, data: object }
// 'select' fires on selection change; 'activate' fires on Enter/click confirm
```

#### CSS class naming

`kk-card-grid`, `kk-card-grid__row`, `kk-card-grid__cell`

State modifiers on `kk-card-grid__cell`: `--selected`, `--disabled`, `--locked`, `--pressed`  
State modifiers on root: `--loading`

---

### 5. ActionBar

**Purpose:** Bottom-anchored horizontal bar that holds the primary CTA and secondary action buttons for the current page; fixed to viewport bottom inside the page shell.

#### DOM structure

```html
<div class="kk-action-bar" role="toolbar" aria-label="Page actions">
  <div class="kk-action-bar__secondary">
    <!-- 0–3 secondary CTAButton or ButtonBar components -->
  </div>
  <div class="kk-action-bar__primary">
    <!-- 1 primary CTAButton -->
  </div>
</div>
```

`kk-action-bar__secondary` is omitted from the DOM when no secondary actions are provided.  
Toast components stack immediately above `kk-action-bar` using the Toast's bottom offset.

#### Interaction states

ActionBar is a layout container; states live on child CTAButton / ButtonBar components.

The bar itself supports `--hidden` modifier (used during gameplay HUD, applied by the page controller).

#### Keyboard behavior

| Key | Action |
|---|---|
| `Tab` | Cycles through secondary then primary buttons |
| `Shift+Tab` | Reverse |
| `ArrowLeft` / `ArrowRight` | Within `kk-action-bar__secondary` ButtonBar: moves between buttons (see ButtonBar §9) |
| `Enter` / `Space` | Activates focused button |

#### Focus management

- ActionBar does not steal initial focus on mount; focus starts in page content.
- On modal dismiss that originated from an ActionBar button, focus returns to the triggering button.

#### ARIA

```
div[role="toolbar"][aria-label="Page actions"]
```

Child buttons carry their own ARIA.

#### Config props

```js
new ActionBar({
  primary: CTAButtonConfig,              // required
  secondary: CTAButtonConfig[] | null,   // optional; max 3
  hidden: boolean,                       // default false
})
```

#### Events emitted

None directly. Child buttons emit their own events.

#### CSS class naming

`kk-action-bar`, `kk-action-bar__primary`, `kk-action-bar__secondary`

State modifiers on root: `--hidden`

---

### 6. HeroPreviewPanel

**Purpose:** A sized DOM placeholder container that defines the layout footprint for an injected Three.js canvas or image; the component owns only position and dimensions.

#### DOM structure

```html
<div
  class="kk-hero-preview-panel"
  data-preview-target="[scene-id]"
  aria-label="[descriptive label e.g. 'Super Drift Kart preview']"
  role="img"
>
  <div class="kk-hero-preview-panel__inner">
    <!-- Three.js canvas or <img> injected here by external system -->
  </div>
  <div class="kk-hero-preview-panel__caption" aria-live="polite">
    <!-- optional: item name label below preview -->
  </div>
</div>
```

`data-preview-target` is the hook the external Three.js injector uses to locate this container.  
The component does not import or initialize Three.js.

#### Interaction states

| State | Applies to |
|---|---|
| loading | root; shows placeholder shimmer over `__inner` until external content signals ready |
| default | after content injection |

HeroPreviewPanel is not interactive by itself; it does not receive focus.  
If it is placed inside a selectable card, the card's focus and selection handling applies.

#### Keyboard behavior

Not focusable. No keyboard behavior on the container.

#### Focus management

None. Injected canvas content may manage its own focus if interactive (e.g., rotation controls); that is out of scope for this component.

#### ARIA

```
div[role="img"][aria-label="[description]"]
div[aria-live="polite"]  on __caption (updates when item name changes)
div[aria-busy="true"]    on root when --loading
```

#### Config props

```js
new HeroPreviewPanel({
  sceneId: string,        // value written to data-preview-target
  ariaLabel: string,      // description of what is being previewed
  caption: string | null, // visible text label below preview; null = no caption
  aspectRatio: string,    // CSS aspect-ratio value, e.g. '16/9'; default '4/3'
  loading: boolean,       // default true until external system calls setReady()
})

// Public API
heroPreviewPanel.setReady()            // removes --loading, removes aria-busy
heroPreviewPanel.setCaption(text)      // updates caption and aria-live
heroPreviewPanel.setAriaLabel(text)    // updates accessible label
```

#### Events emitted

```js
'kk:hero-preview:ready'  →  detail: { sceneId: string }
// Fired by external injector after mounting content; HeroPreviewPanel listens and calls setReady()
```

#### CSS class naming

`kk-hero-preview-panel`, `kk-hero-preview-panel__inner`, `kk-hero-preview-panel__caption`

State modifiers on root: `--loading`

---

## Interactive

---

### 7. Tabs

**Purpose:** Horizontal category tab bar that switches between content sections within a single page.

#### DOM structure

```html
<div class="kk-tabs" role="tablist" aria-label="[context label e.g. 'Garage categories']">
  <button
    class="kk-tabs__tab"
    role="tab"
    id="tab-[uid]-[index]"
    aria-selected="true"
    aria-controls="tabpanel-[uid]-[index]"
    tabindex="0"
  >
    <span class="kk-tabs__tab-label">CHARACTERS</span>
    <span class="kk-tabs__tab-badge" aria-label="3 new">3</span>
    <!-- badge is optional; omit element when count is 0 -->
  </button>
  <!-- repeated per tab -->
</div>

<!-- Tab panel; lives outside kk-tabs, in the page body -->
<div
  class="kk-tabs__panel"
  role="tabpanel"
  id="tabpanel-[uid]-[index]"
  aria-labelledby="tab-[uid]-[index]"
  tabindex="0"
>
  <!-- panel content -->
</div>
```

Only the selected tab has `aria-selected="true"` and `tabindex="0"`. All others have `aria-selected="false"` and `tabindex="-1"` (roving tabindex within the tablist).

#### Interaction states

| State | Applies to |
|---|---|
| default | all tabs |
| hover | all tabs |
| focus | focused tab (roving tabindex) |
| selected | active tab |
| pressed | transient on click |
| disabled | individual tabs |
| loading | root tablist `--loading` while tab content loads |

#### Keyboard behavior

| Key | Action |
|---|---|
| `Tab` | Moves focus into tablist on the selected tab; a second Tab moves to the associated tabpanel |
| `ArrowRight` | Moves focus to next tab, wraps; activates tab immediately (automatic activation) |
| `ArrowLeft` | Moves focus to previous tab, wraps; activates immediately |
| `Home` | Focus and activate first tab |
| `End` | Focus and activate last tab |
| `Enter` / `Space` | Redundant with automatic activation; re-activates focused tab (no-op if already selected) |
| `Escape` | No action |

#### Focus management

- On Tabs mount: selected tab holds `tabindex="0"`; all others `-1`.
- Automatic activation model: focus change via arrow keys also switches the active tab and its panel immediately.
- Tabpanel receives `tabindex="0"` so users can Tab into it after selecting a tab.

#### ARIA

```
div[role="tablist"][aria-label]
button[role="tab"][aria-selected][aria-controls][tabindex]
span.kk-tabs__tab-badge[aria-label="N new"]  (hidden visually when 0; removed from DOM)
div[role="tabpanel"][aria-labelledby][tabindex="0"]
div[aria-busy="true"]  on tablist when loading
```

#### Config props

```js
new Tabs({
  uid: string,                 // auto-generated if omitted
  tabs: [
    {
      id: string,
      label: string,
      badge: number | null,    // null = no badge
      disabled: boolean,
    }
  ],
  activeId: string,            // id of initially selected tab
  ariaLabel: string,
  loading: boolean,
})
```

#### Events emitted

```js
'kk:tabs:change'  →  detail: { tabId: string, previousTabId: string }
```

#### CSS class naming

`kk-tabs`, `kk-tabs__tab`, `kk-tabs__tab-label`, `kk-tabs__tab-badge`, `kk-tabs__panel`

State modifiers on `kk-tabs__tab`: `--selected`, `--disabled`, `--pressed`  
State modifiers on root: `--loading`

---

### 8. CTAButton

**Purpose:** Primary or secondary action button; the single interactive unit for all named page actions.

#### DOM structure

```html
<button
  class="kk-cta-button kk-cta-button--primary"
  type="button"
  aria-label="[label if icon-only]"
  data-action="[action-id]"
>
  <span class="kk-cta-button__icon" aria-hidden="true">
    <!-- optional SVG icon -->
  </span>
  <span class="kk-cta-button__label">QUICK PLAY</span>
  <span class="kk-cta-button__sublabel" aria-hidden="true">
    <!-- optional: small descriptor text below label -->
  </span>
  <span class="kk-cta-button__spinner" aria-hidden="true">
    <!-- shown only in --loading state -->
  </span>
</button>
```

`kk-cta-button__icon` and `kk-cta-button__sublabel` are omitted from DOM when not configured.  
`kk-cta-button__spinner` is always present in DOM but hidden via CSS; shown via `--loading` modifier.

Variant modifiers on root: `--primary`, `--secondary`, `--danger`, `--ghost`

#### Interaction states

| State | Applies to |
|---|---|
| default | all |
| hover | all |
| focus | all |
| pressed | transient |
| disabled | `aria-disabled="true"`; pointer-events:none |
| loading | spinner shown; label still visible; `aria-busy="true"` |

#### Keyboard behavior

| Key | Action |
|---|---|
| `Tab` / `Shift+Tab` | Natural document order |
| `Enter` | Activates button |
| `Space` | Activates button |

#### Focus management

- Participates in natural tab order.
- When button opens a modal: focus moves to modal. On modal close, focus returns to this button.
- When button triggers navigation: focus is managed by the incoming page.

#### ARIA

```
button[type="button"]
button[aria-disabled="true"]   when disabled (not the HTML disabled attr, so it remains focusable)
button[aria-busy="true"]       when loading
button[aria-label]             when icon-only (no label text)
button[aria-pressed]           when used as a toggle (e.g., READY UP button)
```

#### Config props

```js
new CTAButton({
  label: string,
  sublabel: string | null,
  icon: SVGElement | null,
  variant: 'primary' | 'secondary' | 'danger' | 'ghost',
  actionId: string,               // written to data-action attribute
  disabled: boolean,
  loading: boolean,
  ariaLabel: string | null,       // required when icon-only
  ariaPressed: boolean | null,    // null = not a toggle
  onClick: Function,
})
```

#### Events emitted

```js
'kk:cta-button:click'  →  detail: { actionId: string }
```

#### CSS class naming

`kk-cta-button`

Variant modifiers: `--primary`, `--secondary`, `--danger`, `--ghost`  
State modifiers: `--disabled`, `--loading`, `--pressed`

---

### 9. ButtonBar

**Purpose:** Horizontal group of related secondary buttons (e.g., ROTATE / INSPECT / LOADOUT in Garage ActionBar); treated as a single toolbar widget for keyboard navigation.

#### DOM structure

```html
<div
  class="kk-button-bar"
  role="toolbar"
  aria-label="[context label e.g. 'View controls']"
>
  <button
    class="kk-button-bar__btn"
    type="button"
    tabindex="0"
    data-action="[action-id]"
    aria-pressed="false"
  >
    <span class="kk-button-bar__btn-icon" aria-hidden="true"><!-- icon --></span>
    <span class="kk-button-bar__btn-label">ROTATE</span>
  </button>
  <!-- repeated per button; max recommended 4 -->
</div>
```

Roving tabindex within the toolbar: exactly one button holds `tabindex="0"`.

#### Interaction states

| State | Applies to |
|---|---|
| default | all buttons |
| hover | all buttons |
| focus | focused button (roving tabindex) |
| selected | toggle buttons in selected state (`aria-pressed="true"`) |
| pressed | transient on click |
| disabled | individual buttons |

#### Keyboard behavior

| Key | Action |
|---|---|
| `Tab` | Enters toolbar on the rover button; exits toolbar on next Tab |
| `ArrowRight` | Focus next button, wraps |
| `ArrowLeft` | Focus previous button, wraps |
| `Enter` / `Space` | Activates focused button |
| `Home` | Focus first button |
| `End` | Focus last button |

#### Focus management

- Roving tabindex within toolbar.
- On toolbar entry via Tab: focus goes to the button that last held `tabindex="0"` (or first button on first entry).

#### ARIA

```
div[role="toolbar"][aria-label]
button[tabindex][data-action]
button[aria-pressed]   for toggle-mode buttons (e.g., INSPECT toggle)
button[aria-disabled="true"]  for disabled buttons
```

#### Config props

```js
new ButtonBar({
  ariaLabel: string,
  buttons: [
    {
      id: string,
      label: string,
      icon: SVGElement | null,
      actionId: string,
      disabled: boolean,
      toggle: boolean,           // if true, button is aria-pressed toggle
      pressed: boolean,          // initial pressed state; only meaningful when toggle:true
    }
  ],
})

// Public API
buttonBar.setPressed(id, pressed)   // update toggle state programmatically
buttonBar.setDisabled(id, disabled)
```

#### Events emitted

```js
'kk:button-bar:click'   →  detail: { id: string, actionId: string }
'kk:button-bar:toggle'  →  detail: { id: string, actionId: string, pressed: boolean }
// toggle fires only for buttons with toggle:true
```

#### CSS class naming

`kk-button-bar`, `kk-button-bar__btn`, `kk-button-bar__btn-icon`, `kk-button-bar__btn-label`

State modifiers on `kk-button-bar__btn`: `--selected`, `--pressed`, `--disabled`

---

## Feedback

---

### 10. ModalDialog

**Purpose:** Centered overlay modal for confirmations, sub-flows, and detail views; base class extended by ConfirmationDialog.

#### DOM structure

```html
<div class="kk-modal-overlay" aria-hidden="true">
  <div
    class="kk-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-[uid]-title"
    aria-describedby="modal-[uid]-desc"
    tabindex="-1"
  >
    <div class="kk-modal__header">
      <h2 class="kk-modal__title" id="modal-[uid]-title">MODAL TITLE</h2>
      <button
        class="kk-modal__close"
        type="button"
        aria-label="Close dialog"
      >
        <svg aria-hidden="true"><!-- X icon --></svg>
      </button>
    </div>
    <div class="kk-modal__body" id="modal-[uid]-desc">
      <!-- slotted content -->
    </div>
    <div class="kk-modal__footer">
      <!-- CTAButton or ButtonBar; injected by caller -->
    </div>
  </div>
</div>
```

`kk-modal__close` is omitted from DOM when `dismissible` is false.  
`kk-modal__footer` is omitted from DOM when no footer actions are provided.  
`kk-modal-overlay` receives `aria-hidden="false"` when open.

#### Interaction states

| State | Applies to |
|---|---|
| default | modal when open |
| loading | `--loading` on `kk-modal__body`; shows shimmer; `aria-busy="true"` |

Open/closed is managed by adding/removing `kk-modal-overlay--open` on the overlay, not by DOM insertion/removal (keeps transition support simple).

#### Keyboard behavior

| Key | Action |
|---|---|
| `Tab` | Cycles through focusable elements inside modal only (trapped) |
| `Shift+Tab` | Reverse cycle, trapped inside modal |
| `Escape` | Closes modal if `dismissible` is true; fires `kk:modal:close` |
| `Enter` | Activates focused element inside modal |

#### Focus management

- On open: focus moves to `div.kk-modal` (`tabindex="-1"`); first focusable child receives focus after a `requestAnimationFrame` defer.
- Focus trap: Tab and Shift+Tab cycle only within the modal's focusable descendants. Uses sentinel elements at top and bottom of modal.
- On close: focus returns to the element that triggered the modal open.
- Scroll lock: `body` receives `overflow:hidden` while modal is open.

#### ARIA

```
div.kk-modal-overlay[aria-hidden="true|false"]
div[role="dialog"][aria-modal="true"][aria-labelledby][aria-describedby][tabindex="-1"]
h2[id="modal-[uid]-title"]
div[id="modal-[uid]-desc"]
button[aria-label="Close dialog"]
div[aria-busy="true"]   on __body when loading
```

Live region: none on modal itself; announcements happen via the dialog role.

#### Config props

```js
new ModalDialog({
  uid: string,               // auto-generated if omitted
  title: string,
  body: HTMLElement | string,
  footer: HTMLElement | null,
  dismissible: boolean,      // default true; enables Escape + X button
  loading: boolean,          // default false
  onClose: Function,         // called after close animation
})

// Public API
modal.open()
modal.close()
modal.setLoading(bool)
modal.setBody(content)
```

#### Events emitted

```js
'kk:modal:open'   →  detail: { uid: string }
'kk:modal:close'  →  detail: { uid: string, reason: 'escape' | 'close-button' | 'programmatic' }
```

#### CSS class naming

`kk-modal-overlay`, `kk-modal-overlay--open`  
`kk-modal`, `kk-modal__header`, `kk-modal__title`, `kk-modal__close`,  
`kk-modal__body`, `kk-modal__footer`

State modifiers on `kk-modal__body`: `--loading`

---

### 11. ConfirmationDialog

**Purpose:** Specialized two-button Yes/No modal for destructive or high-stakes actions; extends ModalDialog.

#### DOM structure

Inherits ModalDialog DOM. Footer is always rendered with exactly two CTAButtons.

```html
<!-- kk-modal__footer content (injected by ConfirmationDialog) -->
<div class="kk-confirm-dialog__actions">
  <button class="kk-cta-button kk-cta-button--ghost" data-action="confirm-cancel">
    <span class="kk-cta-button__label">CANCEL</span>
  </button>
  <button class="kk-cta-button kk-cta-button--danger" data-action="confirm-proceed">
    <span class="kk-cta-button__label">LEAVE RACE</span>
  </button>
</div>
```

Confirm button variant is `--danger` for destructive actions, `--primary` for non-destructive.

#### Interaction states

Inherits all ModalDialog states.  
Confirm button supports `--loading` while async operation is in flight.

#### Keyboard behavior

Inherits ModalDialog keyboard behavior.

Additional:

| Key | Action |
|---|---|
| `ArrowLeft` / `ArrowRight` | Moves focus between Cancel and Confirm buttons |
| `Enter` | Activates focused button |

Default focused button on open: Cancel (safer default, preventing accidental confirmation).

#### Focus management

Inherits ModalDialog focus trap.  
Initial focus on open: Cancel button.

#### ARIA

Inherits ModalDialog ARIA.

```
div.kk-confirm-dialog__actions[role="group"][aria-label="Confirm or cancel"]
```

#### Config props

```js
new ConfirmationDialog({
  uid: string,
  title: string,
  body: string,                    // plain text or HTML string
  confirmLabel: string,            // default 'CONFIRM'
  cancelLabel: string,             // default 'CANCEL'
  confirmVariant: 'primary' | 'danger',  // default 'danger'
  confirmActionId: string,
  cancelActionId: string,
  onConfirm: Function,
  onCancel: Function,
  dismissible: boolean,            // default true
})
```

#### Events emitted

```js
'kk:confirm-dialog:confirm'  →  detail: { uid: string, confirmActionId: string }
'kk:confirm-dialog:cancel'   →  detail: { uid: string, cancelActionId: string }
// Also inherits kk:modal:open and kk:modal:close
```

#### CSS class naming

Inherits all `kk-modal-*` classes.  
`kk-confirm-dialog__actions`

---

### 12. Toast

**Purpose:** Auto-dismissing notification that appears at bottom-center of the viewport, stacking vertically above the ActionBar; used for success confirmations, errors, and info messages.

#### DOM structure

```html
<!-- Toast container: lives in AppShell, above ActionBar, below modal layer -->
<div
  class="kk-toast-region"
  role="region"
  aria-label="Notifications"
  aria-live="polite"
  aria-atomic="false"
  aria-relevant="additions"
>
  <div
    class="kk-toast kk-toast--success"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    <span class="kk-toast__icon" aria-hidden="true"><!-- icon --></span>
    <span class="kk-toast__message">Reward claimed!</span>
    <button
      class="kk-toast__dismiss"
      type="button"
      aria-label="Dismiss notification"
    >
      <svg aria-hidden="true"><!-- X --></svg>
    </button>
  </div>
  <!-- additional toasts stack above, newest on top -->
</div>
```

`kk-toast-region` is a singleton in AppShell. Individual `kk-toast` elements are appended and removed by `NotificationService`.

Variant modifiers on `kk-toast`: `--success`, `--error`, `--warning`, `--info`

#### Interaction states

| State | Applies to |
|---|---|
| default | visible toast |
| pressed | dismiss button |
| focus | dismiss button (when user tabs into the toast region) |

Toasts are not hoverable in the traditional sense; they remain visible. Hover may pause auto-dismiss timer (see config).

#### Keyboard behavior

| Key | Action |
|---|---|
| `Tab` | Toast region participates in tab order; focus enters the dismiss button |
| `Enter` / `Space` | Dismisses the focused toast |
| `Escape` | Dismisses the topmost (most recent) toast |

#### Focus management

- Toast is non-modal; focus is NOT moved to the toast on appear.
- Screen readers announce via `aria-live="polite"`.
- Dismiss button is reachable via Tab for keyboard users.
- On dismiss: if focus was on the toast dismiss button, focus moves to the next toast's dismiss button, or returns to previously focused element.

#### ARIA

```
div[role="region"][aria-label="Notifications"][aria-live="polite"][aria-atomic="false"][aria-relevant="additions"]
div[role="status"][aria-live="polite"][aria-atomic="true"]   per toast
button[aria-label="Dismiss notification"]
```

#### Config props (via NotificationService.show())

```js
NotificationService.show({
  message: string,
  variant: 'success' | 'error' | 'warning' | 'info',
  duration: number,         // ms before auto-dismiss; default 4000; 0 = no auto-dismiss
  dismissible: boolean,     // shows X button; default true
  pauseOnHover: boolean,    // pauses timer on hover; default true
  id: string,               // optional; for programmatic dismissal
})

// Public API
NotificationService.dismiss(id)
NotificationService.dismissAll()
```

#### Events emitted

```js
'kk:toast:shown'     →  detail: { id: string, message: string, variant: string }
'kk:toast:dismissed' →  detail: { id: string, reason: 'auto' | 'user' | 'programmatic' }
```

#### CSS class naming

`kk-toast-region`  
`kk-toast`, `kk-toast__icon`, `kk-toast__message`, `kk-toast__dismiss`

Variant modifiers on `kk-toast`: `--success`, `--error`, `--warning`, `--info`  
Animation modifiers: `--entering`, `--exiting` (applied during transitions; remove after animation end)

---

### 13. ProgressBar

**Purpose:** Horizontal fill bar that communicates numeric progress toward a goal; used in StatsPanel (stat bars), challenge rows, XP gain, and season pass.

#### DOM structure

```html
<div
  class="kk-progress-bar"
  role="meter"
  aria-label="[e.g. 'Speed']"
  aria-valuenow="85"
  aria-valuemin="0"
  aria-valuemax="100"
  aria-valuetext="85 out of 100"
>
  <div class="kk-progress-bar__track">
    <div
      class="kk-progress-bar__fill"
      style="--kk-progress: 85%;"
    ></div>
  </div>
  <span class="kk-progress-bar__label-end" aria-hidden="true">85/100</span>
  <!-- __label-end is optional; omit when labels are handled externally -->
</div>
```

The fill width is driven by CSS custom property `--kk-progress` set inline on `__fill`. Transitions on `width` are handled in CSS.

#### Interaction states

ProgressBar is not interactive. No keyboard behavior. No states beyond its current value.

The bar supports a `--animated` modifier for entrance animation (fill grows from 0 to value on mount).  
The bar supports a `--striped` modifier for in-progress indeterminate appearance.

#### Keyboard behavior

None. ProgressBar is not focusable.

#### Focus management

None.

#### ARIA

```
div[role="meter"][aria-label][aria-valuenow][aria-valuemin][aria-valuemax][aria-valuetext]
```

`role="meter"` is appropriate for values within a known range (stats, XP, challenges).  
Use `role="progressbar"` instead for loading/indeterminate states.

#### Config props

```js
new ProgressBar({
  label: string,              // aria-label; also used as visible label if rendered externally
  value: number,              // 0–max
  min: number,                // default 0
  max: number,                // default 100
  valueText: string | null,   // human-readable aria-valuetext; auto-generated if null
  showEndLabel: boolean,      // renders __label-end; default false
  animated: boolean,          // entrance fill animation; default true
  variant: 'default' | 'xp' | 'challenge' | 'stat',  // visual accent variant
})

// Public API
progressBar.setValue(value)   // updates aria attrs and CSS var; triggers transition
```

#### Events emitted

None.

#### CSS class naming

`kk-progress-bar`, `kk-progress-bar__track`, `kk-progress-bar__fill`, `kk-progress-bar__label-end`

Variant modifiers on root: `--xp`, `--challenge`, `--stat`  
Behavior modifiers on root: `--animated`, `--striped`

---

## State

---

### 14. EmptyStateBlock

**Purpose:** Placeholder displayed inside a SectionPanel or CardGrid when a collection has zero items; communicates absence and offers a primary recovery action.

#### DOM structure

```html
<div class="kk-empty-state" role="status" aria-label="[e.g. 'No tracks found']">
  <div class="kk-empty-state__icon" aria-hidden="true">
    <!-- illustration or icon; context-specific -->
  </div>
  <p class="kk-empty-state__heading">NO TRACKS YET</p>
  <p class="kk-empty-state__subtext">Create your first track to see it here.</p>
  <div class="kk-empty-state__action">
    <!-- optional CTAButton; e.g. 'CREATE TRACK' -->
  </div>
</div>
```

`kk-empty-state__action` and its child are omitted from DOM when no action is provided.

#### Interaction states

The block itself is not interactive. If `action` is provided, the CTAButton inside carries its own states.

#### Keyboard behavior

CTAButton inside `__action` participates in natural tab order if present.

#### Focus management

None on the block itself. On mount, focus is not moved to EmptyStateBlock.

#### ARIA

```
div[role="status"][aria-label="[empty context description]"]
```

`role="status"` announces the empty state to screen readers when it appears. `aria-live="polite"` is implicit for `role="status"`.

#### Config props

```js
new EmptyStateBlock({
  icon: SVGElement | HTMLElement | null,
  heading: string,
  subtext: string,
  action: CTAButtonConfig | null,     // null = no recovery action
  ariaLabel: string,                  // defaults to heading if omitted
})
```

#### Events emitted

None directly. CTAButton inside emits `kk:cta-button:click`.

#### CSS class naming

`kk-empty-state`, `kk-empty-state__icon`, `kk-empty-state__heading`,  
`kk-empty-state__subtext`, `kk-empty-state__action`

---

### 15. LockedStateBlock

**Purpose:** Placeholder displayed in place of locked content (locked cards, locked tabs, locked features); communicates the unlock condition clearly.

#### DOM structure

```html
<div
  class="kk-locked-state"
  role="status"
  aria-label="[e.g. 'Content locked']"
>
  <div class="kk-locked-state__icon" aria-hidden="true">
    <!-- padlock icon -->
  </div>
  <p class="kk-locked-state__heading">LOCKED</p>
  <p class="kk-locked-state__condition">Reach Rank 10 to unlock</p>
  <div class="kk-locked-state__action">
    <!-- optional CTAButton; e.g. 'VIEW SEASON PASS' -->
  </div>
</div>
```

`kk-locked-state__action` is omitted from DOM when no action is provided.

When used inline within a `kk-card-grid__cell`, the card cell receives `--locked` modifier and `aria-disabled="true"`. The LockedStateBlock is rendered inside the cell body.

#### Interaction states

The block itself is not interactive. The optional CTAButton inside carries its own states.

#### Keyboard behavior

If placed inside a CardGrid cell marked `--locked`: the cell is still focusable (so users can read why it is locked), but activation (Enter/Space) does nothing or opens the lock condition info.  
CTAButton inside `__action` participates in natural tab order.

#### Focus management

CardGrid cells that are locked remain in the roving tabindex rotation so users encounter them and their accessible label explains the lock.

#### ARIA

```
div[role="status"][aria-label="Content locked: [condition text]"]
```

When used inside a CardGrid cell:
```
div[role="gridcell"][aria-disabled="true"][aria-label="[item name] — Locked: [condition]"]
```

#### Config props

```js
new LockedStateBlock({
  heading: string,              // default 'LOCKED'
  condition: string,            // human-readable unlock condition
  icon: SVGElement | null,      // default: padlock icon
  action: CTAButtonConfig | null,
  ariaLabel: string,            // auto-composed from heading + condition if omitted
})
```

#### Events emitted

None directly. CTAButton inside emits `kk:cta-button:click`.

#### CSS class naming

`kk-locked-state`, `kk-locked-state__icon`, `kk-locked-state__heading`,  
`kk-locked-state__condition`, `kk-locked-state__action`

---

## Data Display

---

### 16. StatsPanel

**Purpose:** Vertically stacked list of labeled stat bars (e.g., Speed, Acceleration, Handling); used in Garage, Kart Select, and Player Profile.

#### DOM structure

```html
<div class="kk-stats-panel" aria-label="[e.g. 'Kart statistics']">
  <h3 class="kk-stats-panel__title">KART STATS</h3>
  <ul class="kk-stats-panel__list" role="list">
    <li class="kk-stats-panel__row" role="listitem">
      <span class="kk-stats-panel__row-icon" aria-hidden="true"><!-- icon --></span>
      <span class="kk-stats-panel__row-label">Speed</span>
      <!-- ProgressBar component instance -->
      <div class="kk-progress-bar kk-progress-bar--stat" role="meter"
        aria-label="Speed"
        aria-valuenow="85"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuetext="85 out of 100"
      >
        <div class="kk-progress-bar__track">
          <div class="kk-progress-bar__fill" style="--kk-progress: 85%;"></div>
        </div>
      </div>
      <span class="kk-stats-panel__row-value" aria-hidden="true">85</span>
    </li>
    <!-- repeated per stat -->
  </ul>
</div>
```

`kk-stats-panel__row-value` numeric label is `aria-hidden="true"` because the value is already communicated by the ProgressBar's `aria-valuetext`.

#### Interaction states

StatsPanel is not interactive. No interactive states.  
Supports `--loading` on root: replaces rows with skeleton shimmer rows.  
Supports `--compact` on root: reduces row height and label size.

#### Keyboard behavior

None. StatsPanel is not focusable.

#### Focus management

None.

#### ARIA

```
div[aria-label="[panel context]"]
h3  (heading level configurable)
ul[role="list"]
li[role="listitem"]
span[aria-hidden="true"]   on icons and numeric value labels
ProgressBar instances carry their own meter role and aria attrs
```

#### Config props

```js
new StatsPanel({
  title: string | null,
  headingLevel: 2 | 3 | 4,       // default 3
  ariaLabel: string,
  stats: [
    {
      label: string,
      value: number,
      max: number,                // default 100
      icon: SVGElement | null,
    }
  ],
  loading: boolean,
  compact: boolean,
})

// Public API
statsPanel.updateStat(label, value)   // animates fill transition
statsPanel.setLoading(bool)
```

#### Events emitted

None.

#### CSS class naming

`kk-stats-panel`, `kk-stats-panel__title`, `kk-stats-panel__list`,  
`kk-stats-panel__row`, `kk-stats-panel__row-icon`, `kk-stats-panel__row-label`,  
`kk-stats-panel__row-value`

State modifiers on root: `--loading`, `--compact`

---

### 17. PlayerSummaryStrip

**Purpose:** Compact horizontal strip showing the current player's rank, win count, total XP, and current loadout (character + kart); appears at the bottom-left of the Home page and optionally in page headers.

#### DOM structure

```html
<div class="kk-player-summary-strip" aria-label="Player summary">
  <div class="kk-player-summary-strip__avatar" aria-hidden="true">
    <!-- character thumbnail img -->
  </div>
  <dl class="kk-player-summary-strip__stats">
    <div class="kk-player-summary-strip__stat">
      <dt class="kk-player-summary-strip__stat-label">Rank</dt>
      <dd class="kk-player-summary-strip__stat-value">14</dd>
    </div>
    <div class="kk-player-summary-strip__stat">
      <dt class="kk-player-summary-strip__stat-label">Total wins</dt>
      <dd class="kk-player-summary-strip__stat-value">26</dd>
    </div>
    <div class="kk-player-summary-strip__stat">
      <dt class="kk-player-summary-strip__stat-label">Total XP</dt>
      <dd class="kk-player-summary-strip__stat-value">88</dd>
    </div>
  </dl>
  <div class="kk-player-summary-strip__loadout">
    <span class="kk-player-summary-strip__loadout-label">CURRENT LOADOUT</span>
    <span class="kk-player-summary-strip__loadout-value">Balaclava Biker</span>
    <span class="kk-player-summary-strip__loadout-value">Void Striker</span>
  </div>
  <button
    class="kk-player-summary-strip__edit"
    type="button"
    aria-label="Edit loadout"
    data-action="open-garage"
  >
    <!-- optional edit/chevron icon -->
  </button>
</div>
```

`kk-player-summary-strip__edit` is omitted from DOM when `editable` is false.  
The strip is entirely read-only when `editable` is false; no interactive elements.

#### Interaction states

| State | Applies to |
|---|---|
| default | strip |
| hover | edit button |
| focus | edit button |
| pressed | edit button |
| loading | root `--loading`; stats replaced with skeleton text |

#### Keyboard behavior

| Key | Action |
|---|---|
| `Tab` | Focus lands on edit button if present |
| `Enter` / `Space` | Activates edit button (navigates to `/garage`) |

#### Focus management

- Edit button participates in natural tab order.
- No focus trap.

#### ARIA

```
div[aria-label="Player summary"]
dl  — description list for stat key/value pairs
dt  — stat label
dd  — stat value
button[aria-label="Edit loadout"][data-action]
div[aria-busy="true"]  on root when loading
```

Live region: not needed; strip is static data, not real-time.

#### Config props

```js
new PlayerSummaryStrip({
  avatarSrc: string,
  avatarAlt: string,            // e.g. 'Balaclava Biker'
  stats: [
    { label: string, value: string | number }
  ],
  loadout: {
    characterName: string,
    kartName: string,
  },
  editable: boolean,            // default true; shows edit button
  onEdit: Function,             // callback when edit button activated; default: navigate to /garage
  loading: boolean,
})
```

#### Events emitted

```js
'kk:player-summary:edit'  →  detail: {}
```

#### CSS class naming

`kk-player-summary-strip`, `kk-player-summary-strip__avatar`, `kk-player-summary-strip__stats`,  
`kk-player-summary-strip__stat`, `kk-player-summary-strip__stat-label`,  
`kk-player-summary-strip__stat-value`, `kk-player-summary-strip__loadout`,  
`kk-player-summary-strip__loadout-label`, `kk-player-summary-strip__loadout-value`,  
`kk-player-summary-strip__edit`

State modifiers on root: `--loading`

---

## Appendix A — Accessibility checklist (all 17 components)

| Component | Keyboard only | Gamepad | Min font readable | No color-only | No flash | Subtitles N/A | Scales at all res |
|---|---|---|---|---|---|---|---|
| TopNav | Pass | Pass | Pass | Pass | Pass | — | Pass |
| PageHeader | Pass | Pass | Pass | Pass | Pass | — | Pass |
| SectionPanel | Pass | Pass | Pass | Pass | Pass | — | Pass |
| CardGrid | Pass | Pass | Pass | Pass | Pass | — | Pass |
| ActionBar | Pass | Pass | Pass | Pass | Pass | — | Pass |
| HeroPreviewPanel | Pass | Pass | Pass | Pass | Pass | — | Pass |
| Tabs | Pass | Pass | Pass | Pass | Pass | — | Pass |
| CTAButton | Pass | Pass | Pass | Pass | Pass | — | Pass |
| ButtonBar | Pass | Pass | Pass | Pass | Pass | — | Pass |
| ModalDialog | Pass | Pass | Pass | Pass | Pass | — | Pass |
| ConfirmationDialog | Pass | Pass | Pass | Pass | Pass | — | Pass |
| Toast | Pass | Pass | Pass | Pass | Pass | — | Pass |
| ProgressBar | N/A | N/A | Pass | Pass* | Pass | — | Pass |
| EmptyStateBlock | Pass | Pass | Pass | Pass | Pass | — | Pass |
| LockedStateBlock | Pass | Pass | Pass | Pass | Pass | — | Pass |
| StatsPanel | N/A | N/A | Pass | Pass* | Pass | — | Pass |
| PlayerSummaryStrip | Pass | Pass | Pass | Pass | Pass | — | Pass |

*ProgressBar and StatsPanel use color to accent stat bars but also communicate value numerically and via aria-valuetext. Color is supplemental, not sole indicator.

---

## Appendix B — Event name registry

| Event | Emitter | Key payload fields |
|---|---|---|
| `kk:topnav:navigate` | TopNav | `route`, `label` |
| `kk:pageheader:back` | PageHeader | — |
| `kk:tabs:change` | Tabs | `tabId`, `previousTabId` |
| `kk:cta-button:click` | CTAButton | `actionId` |
| `kk:button-bar:click` | ButtonBar | `id`, `actionId` |
| `kk:button-bar:toggle` | ButtonBar | `id`, `actionId`, `pressed` |
| `kk:cardgrid:select` | CardGrid | `id`, `data` |
| `kk:cardgrid:activate` | CardGrid | `id`, `data` |
| `kk:modal:open` | ModalDialog | `uid` |
| `kk:modal:close` | ModalDialog | `uid`, `reason` |
| `kk:confirm-dialog:confirm` | ConfirmationDialog | `uid`, `confirmActionId` |
| `kk:confirm-dialog:cancel` | ConfirmationDialog | `uid`, `cancelActionId` |
| `kk:toast:shown` | Toast (via NotificationService) | `id`, `message`, `variant` |
| `kk:toast:dismissed` | Toast (via NotificationService) | `id`, `reason` |
| `kk:hero-preview:ready` | External injector | `sceneId` |
| `kk:player-summary:edit` | PlayerSummaryStrip | — |

All events bubble. All events are composed (cross shadow DOM). Listen at `document` level for cross-component coordination.

---

## Appendix C — Z-index and stacking context

```
gameplay canvas         z-index: 0        (Three.js renderer)
page shell / panels     z-index: 10       (--z-panel)
TopNav                  z-index: 100      (--z-topnav)
ActionBar               z-index: 100      (same layer as TopNav)
kk-modal-overlay        z-index: 500      (--z-modal)
kk-toast-region         z-index: 600      (--z-toast; above modal so toasts remain visible)
```

Toast region sits above modal layer so that NotificationService can fire toasts triggered by modal actions (e.g., "Reward claimed!") without the toast being obscured.

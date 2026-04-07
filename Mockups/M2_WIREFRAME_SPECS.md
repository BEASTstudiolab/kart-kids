# Kart Kids — Milestone 2 Wireframe Specs
# Pages 01, 02, 03, 04, 05, 19, 22

**Author:** UX Designer  
**Status:** Ready for implementation  
**References:** KART_KIDS_UI_PRD_Codex.md, MockData.js, companion mockup PNGs  
**Stack:** Vanilla JS ES6, HTML/CSS DOM overlays, hash-based routing

---

## Reading guide

Each spec section follows this structure:

1. **Layout** — grid/flex skeleton with named zones
2. **Components used** — M1 component class + config object
3. **Data bindings** — MockData keys that populate each zone
4. **Navigation** — every interactive element and its route target
5. **States** — loading / empty / locked / error variants
6. **Keyboard flow** — tab order, roving focus, escape chains

**Custom components** (not yet in M1) are called out with a "(NEW)" marker so the
programmer knows to create them. All other components are existing M1 classes.

---

---

# Page 01 — Title Screen

**Route:** `RouteIds.TITLE` (`/`)  
**Controller:** `Page01TitleController`  
**View:** `Page01TitleView`  
**Mockup:** `01-Title-Screen-Start-Screen.png`

---

## 1. Layout

Full-viewport single layer. No scroll. No TopNav. No PageHeader.

```
┌─────────────────────────────────────────────────────────────┐
│  HERO_BG                                                    │
│  (full-bleed cinematic image or HeroPreviewPanel)           │
│                                                             │
│                  ┌──────────────┐                           │
│                  │  LOGO ZONE   │  (center-top, ~20% from   │
│                  │  KART KIDS   │   top edge)               │
│                  └──────────────┘                           │
│                                                             │
│                                                             │
│                  ┌──────────────┐                           │
│                  │ [PRESS START]│  (center, pulsing)        │
│                  └──────────────┘                           │
│                                                             │
│                                           ┌──────────────┐  │
│                                           │ PLAYER SIGN-IN│  │
│                                           │ SETTINGS      │  │
│                                           │ ACCESSIBILITY │  │
│                                           │ LANGUAGE      │  │
│                                           │ FEATURED EVENT│  │
│                                           └──────────────┘  │
│  ┌────────────┐                                             │
│  │ VERSION    │                                             │
│  └────────────┘                                             │
└─────────────────────────────────────────────────────────────┘
```

**CSS skeleton:**

```
.page-title {
  position: fixed; inset: 0;
  display: grid;
  grid-template-rows: 1fr auto 1fr auto;  /* spacer / logo / cta / spacer */
  grid-template-columns: 1fr auto;
  isolation: isolate;
}
```

**Zones:**

| Zone | Position | Content |
|------|----------|---------|
| `hero-bg` | fixed, full-bleed, z-0 | HeroPreviewPanel (cinematic) |
| `logo-zone` | grid row 2, col 1, centered | KART KIDS wordmark at `--text-hero-xl: 8rem` |
| `cta-zone` | grid row 3, col 1, centered | [PRESS START] CTAButton |
| `utility-rail` | absolute, right edge, vertically centered | vertical ButtonBar of 5 ghost CTAButtons |
| `version-badge` | absolute, bottom-left, `--space-4` inset | plain text span |

---

## 2. Components used

### HeroPreviewPanel (background)

```js
new HeroPreviewPanel({
  sceneId:     'title-bg',
  ariaLabel:   'Kart Kids cinematic background',
  caption:     null,
  aspectRatio: 'auto',   // overridden by position:fixed / inset:0
  loading:     true,
})
```

Override `.kk-hero-preview-panel` to: `position: fixed; inset: 0; border: none; border-radius: 0; z-index: 0`.

### Logo

Plain `<h1>` (NOT PageHeader). Text: "KART KIDS".  
Font: `--font-display`, size: `--text-hero-xl` (8rem), color: `--color-white`.  
`aria-label`: "Kart Kids — Title Screen".

### [PRESS START] button

```js
new CTAButton({
  label:    '[PRESS START]',
  variant:  'primary',
  actionId: ButtonIds.TITLE_START,
  onClick:  () => NavigationService.navigate(RouteIds.HOME),
})
```

Apply CSS class `.pulse-anim`:

```css
@keyframes kk-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.65; transform: scale(0.97); }
}
.pulse-anim { animation: kk-pulse 1.8s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .pulse-anim { animation: none; } }
```

### Utility rail

```js
new ButtonBar({
  orientation: 'vertical',
  items: [
    { label: 'PLAYER SIGN-IN', actionId: ButtonIds.TITLE_SIGN_IN },
    { label: 'SETTINGS',       actionId: ButtonIds.TITLE_SETTINGS,     route: RouteIds.SETTINGS },
    { label: 'ACCESSIBILITY',  actionId: ButtonIds.TITLE_ACCESSIBILITY, route: RouteIds.SETTINGS + '#accessibility' },
    { label: 'LANGUAGE',       actionId: ButtonIds.TITLE_LANGUAGE,      route: RouteIds.SETTINGS + '#language' },
    { label: 'FEATURED EVENT', actionId: ButtonIds.TITLE_EVENT,         route: RouteIds.EVENTS },
  ],
  variant: 'ghost',
})
```

### Version badge

```html
<span class="kk-version-badge" aria-label="App version">
  VERSION: [KART KIDS_ALPHA_v1.0.0]
</span>
```

Populated from `MockData.version`.

---

## 3. Data bindings

| Zone | Source |
|------|--------|
| Background scene | Static asset (no mock data) |
| Version badge text | `MockData.version` |
| Featured Event label in utility rail | `MockData.featuredEvent.name` appended to button sublabel |

---

## 4. Navigation

| Element | Action | Target |
|---------|--------|--------|
| [PRESS START] | click / Enter / Space | `RouteIds.HOME` |
| PLAYER SIGN-IN | click | `ModalService.open(ModalIds.SIGN_IN)` |
| SETTINGS | click | `RouteIds.SETTINGS` |
| ACCESSIBILITY | click | `RouteIds.SETTINGS + '#accessibility'` |
| LANGUAGE | click | `RouteIds.SETTINGS + '#language'` |
| FEATURED EVENT | click | `RouteIds.EVENTS` |

---

## 5. States

| State | Behavior |
|-------|----------|
| Loading | HeroPreviewPanel shimmer until asset ready |
| Sign-in pending | PLAYER SIGN-IN shows loading spinner; all other utility buttons remain interactive |
| Sign-in complete | PLAYER SIGN-IN label changes to player display name |

No empty or locked states applicable.

---

## 6. Keyboard flow

Initial focus: [PRESS START] button on mount.

```
Tab order:
  1. [PRESS START]
  2. PLAYER SIGN-IN   (utility rail — roving via ArrowUp/ArrowDown within ButtonBar)
  3. SETTINGS
  4. ACCESSIBILITY
  5. LANGUAGE
  6. FEATURED EVENT

Escape: no action (top of nav stack)
Enter / Space on [PRESS START]: navigate to /home
```

The utility rail uses `role="list"` with ArrowUp/ArrowDown roving focus internally.
Tab leaves the rail after item 6 (wraps back to [PRESS START]).

---

---

# Page 02 — Home / Main Menu

**Route:** `RouteIds.HOME` (`/home`)  
**Controller:** `Page02HomeController`  
**View:** `Page02HomeView`  
**Mockup:** `02-Home-Main-Menu.png`

---

## 1. Layout

Fixed-height viewport with no scroll. TopNav at top. Content fills remaining height.

```
┌────────────────────────────────────────────────────────────────┐
│  TOP_NAV  (sticky, --topnav-height)                            │
├───────────────────┬────────────────────┬───────────────────────┤
│  HERO_LEFT        │  CENTER_CTA        │  NAV_RAIL (right)     │
│  HeroPreviewPanel │                    │  PLAY MODES           │
│  (character+kart) │  ┌──────────────┐  │  PARTY                │
│  aspect 16/9      │  │  QUICK PLAY  │  │  GARAGE               │
│                   │  │  (hero CTA)  │  │  CREATE               │
│                   │  └──────────────┘  │  PROFILE              │
│                   │                    │  SHOP                  │
│                   │                    │  SETTINGS              │
├──────────┬────────┴──┬────────────────┴──────────────────────┤
│ PLAYER   │ CURRENT   │  FEATURED EVENT   │  DAILY CHALLENGES   │
│ SUMMARY  │ LOADOUT   │  card             │  list (3 items)     │
│ STRIP    │ info      │                   │                     │
└──────────┴───────────┴───────────────────┴─────────────────────┘
```

**CSS skeleton:**

```
.page-home {
  display: grid;
  grid-template-rows: var(--topnav-height) 1fr auto;
  grid-template-columns: 1fr;
  height: 100vh;
  overflow: hidden;
}

.page-home__body {
  display: grid;
  grid-template-columns: 3fr 2fr 220px;  /* hero / cta / nav-rail */
  overflow: hidden;
}

.page-home__bottom {
  display: grid;
  grid-template-columns: auto auto 1fr auto;  /* summary / loadout / event / challenges */
  gap: var(--space-4);
  padding: var(--space-3) var(--space-6);
  background: var(--color-panel-base);
  border-top: 1px solid var(--color-panel-border);
}
```

---

## 2. Components used

### TopNav

```js
new TopNav({
  items: [
    { label: 'QUICK PLAY', route: RouteIds.QUICK_PLAY },
    { label: 'PLAY',       route: RouteIds.PLAY },
    { label: 'PARTY',      route: RouteIds.PARTY },
    { label: 'GARAGE',     route: RouteIds.GARAGE },
    { label: 'CREATE',     route: RouteIds.CREATE },
    { label: 'PROFILE',    route: RouteIds.PROFILE },
    { label: 'SHOP',       route: RouteIds.SHOP },
  ],
  activeRoute:  RouteIds.HOME,
  showBrand:    true,
  showUtility:  true,
})
```

Utility slot: wallet display (coins + gems from `MockData.wallet`) + inbox bell icon.

### PageHeader

```js
new PageHeader({
  title:    'HOME / MAIN MENU',
  showBack: false,
})
```

Placed inside `.page-home__body` center column above the QUICK PLAY CTA, or omitted in
favor of the TopNav brand wordmark (defer to art-director). **Recommendation:** omit
PageHeader here — TopNav brand + mockup layout treat "HOME / MAIN MENU" as a small
eyebrow label, not a large header.

### HeroPreviewPanel (left column)

```js
new HeroPreviewPanel({
  sceneId:     'home-hero',
  ariaLabel:   `${MockData.loadout.characterName} on ${MockData.loadout.kartName}`,
  caption:     MockData.player.name,
  aspectRatio: '16/9',
  loading:     true,
})
```

### QUICK PLAY CTA (center)

```js
new CTAButton({
  label:    'QUICK PLAY',
  variant:  'primary',
  actionId: ButtonIds.HOME_QUICK_PLAY,
  onClick:  () => NavigationService.navigate(RouteIds.QUICK_PLAY),
})
```

Override sizing: `font-size: var(--text-5xl)`, `padding: var(--space-6) var(--space-10)`.
This is the dominant element on the screen — art-director to style the splash treatment.

### Navigation rail (right column)

```js
new ButtonBar({
  orientation: 'vertical',
  items: [
    { label: 'PLAY MODES', actionId: ButtonIds.HOME_PLAY_MODES, route: RouteIds.PLAY },
    { label: 'PARTY',      actionId: ButtonIds.HOME_PARTY,      route: RouteIds.PARTY },
    { label: 'GARAGE',     actionId: ButtonIds.HOME_GARAGE,     route: RouteIds.GARAGE },
    { label: 'CREATE',     actionId: ButtonIds.HOME_CREATE,     route: RouteIds.CREATE },
    { label: 'PROFILE',    actionId: ButtonIds.HOME_PROFILE,    route: RouteIds.PROFILE },
    { label: 'SHOP',       actionId: ButtonIds.HOME_SHOP,       route: RouteIds.SHOP },
    { label: 'SETTINGS',   actionId: ButtonIds.HOME_SETTINGS,   route: RouteIds.SETTINGS },
  ],
  variant: 'secondary',
})
```

Each button fills full rail width. Icon slot left of label (icon set from PRD §4).

### PlayerSummaryStrip (NEW — bottom-left)

A read-only strip. No existing M1 component — create `PlayerSummaryStrip`.

**DOM structure:**
```html
<div class="kk-player-summary-strip" role="region" aria-label="Player summary">
  <span class="kk-player-summary-strip__rank">Rank: 14</span>
  <span class="kk-player-summary-strip__wins">Total wins: 88</span>
  <span class="kk-player-summary-strip__races">Total races: 126</span>
</div>
```

**Data:** `MockData.player.rank`, `.totalWins`, `.totalRaces`.

### Current Loadout info (bottom, second column)

```html
<div class="kk-loadout-summary" role="region" aria-label="Current loadout">
  <button class="kk-loadout-summary__link" data-route="/garage">
    <span>Character: Balaclava Biker</span>
    <span>Kart: Void Striker</span>
  </button>
</div>
```

Clicking navigates to `RouteIds.GARAGE`.  
**Data:** `MockData.loadout.characterName`, `MockData.loadout.kartName`.

### Featured Event card (bottom, third column) (NEW)

Simple `EventCard` component (not in M1 — create it):

```html
<div class="kk-event-card" role="button" tabindex="0" aria-label="Featured event: Super Drift Tokyo">
  <span class="kk-event-card__label">FEATURED EVENT</span>
  <span class="kk-event-card__name">Super Drift Tokyo</span>
  <span class="kk-event-card__meta">Tokyo Neon Drift – Week 3</span>
</div>
```

Click: `RouteIds.EVENTS`.  
**Data:** `MockData.featuredEvent.name`, `.description`.

### Daily Challenges list (bottom, fourth column)

Render up to 3 challenge rows from `MockData.challenges` where `category === 'daily'`.

Each row:
```html
<div class="kk-challenge-row">
  <span class="kk-challenge-row__title">15/25 Drifts</span>
</div>
```

Click on "DAILY CHALLENGES" heading: `RouteIds.CHALLENGES`.

---

## 3. Data bindings

| Zone | Source |
|------|--------|
| HeroPreviewPanel ariaLabel | `MockData.loadout.characterName + MockData.loadout.kartName` |
| HeroPreviewPanel caption | `MockData.player.name` |
| PlayerSummaryStrip rank | `MockData.player.rank` |
| PlayerSummaryStrip wins | `MockData.player.totalWins` |
| PlayerSummaryStrip total | `MockData.player.totalRaces` |
| Loadout summary character | `MockData.loadout.characterName` |
| Loadout summary kart | `MockData.loadout.kartName` |
| Featured Event name | `MockData.featuredEvent.name` |
| Featured Event meta | `MockData.featuredEvent.description` |
| Daily challenges list | `MockData.challenges.filter(c => c.category === 'daily').slice(0, 3)` |
| Wallet display (TopNav utility) | `MockData.wallet.coins`, `MockData.wallet.gems` |

---

## 4. Navigation

| Element | Target |
|---------|--------|
| TopNav items | per item route |
| QUICK PLAY CTA | `RouteIds.QUICK_PLAY` |
| PLAY MODES rail button | `RouteIds.PLAY` |
| PARTY rail button | `RouteIds.PARTY` |
| GARAGE rail button | `RouteIds.GARAGE` |
| CREATE rail button | `RouteIds.CREATE` |
| PROFILE rail button | `RouteIds.PROFILE` |
| SHOP rail button | `RouteIds.SHOP` |
| SETTINGS rail button | `RouteIds.SETTINGS` |
| Current Loadout | `RouteIds.GARAGE` |
| Featured Event card | `RouteIds.EVENTS` |
| DAILY CHALLENGES heading | `RouteIds.CHALLENGES` |

---

## 5. States

| State | Behavior |
|-------|----------|
| HeroPreviewPanel loading | shimmer until scene injected |
| Offline | PARTY button shows disabled state; online player count shows "Offline" |
| No challenges | Daily Challenges zone renders `EmptyStateBlock` with label "No active challenges" |

---

## 6. Keyboard flow

```
Tab order:
  1. TopNav items (ArrowLeft/ArrowRight within nav — existing TopNav behavior)
  2. TopNav utility (wallet / inbox)
  3. QUICK PLAY CTA (main content)
  4. Nav rail buttons (ArrowUp/ArrowDown within ButtonBar)
  5. Current Loadout link
  6. Featured Event card
  7. Daily challenge rows

Escape: no action (top of post-title nav stack)
```

---

---

# Page 03 — Quick Play

**Route:** `RouteIds.QUICK_PLAY` (`/quick-play`)  
**Controller:** `Page03QuickPlayController`  
**View:** `Page03QuickPlayView`  
**Mockup:** `03-Quick-Play.png`

---

## 1. Layout

TopNav visible. No scroll. Three-column body with four option panels below.

```
┌─────────────────────────────────────────────────────────────┐
│  TOP_NAV                                                     │
├────────────────────────────────────────────────────────────┤
│  PageHeader: "QUICK PLAY"  [back → /home]                  │
├──────────────┬───────────────────────┬─────────────────────┤
│ LEFT_CARD    │   CENTER_HERO         │  RIGHT_CARD          │
│ "SELECTED    │   HeroPreviewPanel    │  "SELECTED KART"     │
│  CHARACTER"  │   (character on kart) │                      │
│  (clickable) │                       │  (clickable)         │
│              │                       │                      │
├──────────────┴──────┬────────────────┴──────────────────────┤
│  TRACK SELECT       │  MATCH TYPE  │  RACE RULES  │ BOT FILL│
│  (2 track thumbs)   │  (tab strip) │  (icon row)  │ (slider)│
├─────────────────────┴──────────────────────────────────────┤
│  ActionBar:  [secondary: BACK]  [primary: START RACE]       │
└────────────────────────────────────────────────────────────┘
```

**CSS skeleton:**

```
.page-quick-play {
  display: grid;
  grid-template-rows: var(--topnav-height) auto 1fr auto auto;
  height: 100vh;
  overflow: hidden;
}

.page-quick-play__body {
  display: grid;
  grid-template-columns: 220px 1fr 220px;
  gap: var(--space-4);
  padding: 0 var(--page-padding-x);
}

.page-quick-play__options {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: var(--space-4);
  padding: var(--space-3) var(--page-padding-x);
}
```

---

## 2. Components used

### TopNav

Same config as Page 02. `activeRoute: RouteIds.QUICK_PLAY`.

### PageHeader

```js
new PageHeader({
  title:    'QUICK PLAY',
  showBack: true,
  onBack:   () => NavigationService.navigate(RouteIds.HOME),
})
```

### HeroPreviewPanel (center)

```js
new HeroPreviewPanel({
  sceneId:     'quick-play-hero',
  ariaLabel:   `${characterName} on ${kartName}`,
  caption:     null,
  aspectRatio: '4/3',
  loading:     true,
})
```

Updates `ariaLabel` and re-triggers injector whenever character or kart selection changes.

### Selected Character card (left)

```js
new SectionPanel({
  title:    'SELECTED CHARACTER',
  role:     'button',
  ariaLabel:'Change character — currently ' + characterName,
  onClick:  () => NavigationService.navigate(RouteIds.CHARACTERS),
})
```

Inner content: character name, faction tag (e.g. "BEASTSIDE"), small stat bars (speed/drift/handling/accel).  
**Data:** `MockData.loadout.characterId` → resolved character from `MockData.characters`.

### Selected Kart card (right)

Same pattern as character card.

```js
new SectionPanel({
  title:    'SELECTED KART',
  role:     'button',
  ariaLabel:'Change kart — currently ' + kartName,
  onClick:  () => NavigationService.navigate(RouteIds.KARTS),
})
```

Inner content: kart name, faction, small stat bars (speed/accel/handling/traction/boost).  
**Data:** `MockData.loadout.kartId` → resolved kart from `MockData.karts`.

### Track Select panel (options row, column 1)

```js
new SectionPanel({ title: 'TRACK SELECT' })
```

Inner: 2 track thumbnail buttons arranged in 2 rows. Each shows track name + difficulty badge.  
Click on a thumb: open `ModalDialog` with full track list.  
**Data:** `MockData.tracks.slice(0, 2)` as default visible options.

### Match Type panel (options row, column 2)

```js
new Tabs({
  items: [
    { id: 'race',       label: 'Race' },
    { id: 'time_trial', label: 'Time Trial' },
    { id: 'battle',     label: 'Battle' },
  ],
  activeId: 'race',
})
```

Selected tab feeds into match configuration state.

### Race Rules panel (options row, column 3)

```js
new SectionPanel({ title: 'RACE RULES' })
```

Inner: three icon-badges rendered inline:
- Laps icon + value ("Laps: 3")
- Items icon + value ("Items: All")
- Speed icon + value ("Speed: Fast")

Click on panel: open `ModalDialog` with full rules configuration.

### Bot Fill panel (options row, column 4)

```js
new SectionPanel({ title: 'BOT FILL' })
```

Inner: range slider (0 = no bots, max = fill to 12 players).  
Use `<input type="range" min="0" max="11" aria-label="Bot fill count">`.  
Display current value as numeric label beside slider.

### ActionBar

```js
new ActionBar({
  primary: {
    label:    'START RACE',
    variant:  'primary',
    actionId: ButtonIds.QUICK_PLAY_START,
    onClick:  () => NavigationService.navigate(RouteIds.LOBBY),
  },
  secondary: [
    {
      label:    'BACK',
      variant:  'ghost',
      actionId: ButtonIds.QUICK_PLAY_BACK,
      onClick:  () => NavigationService.back(),
    },
  ],
})
```

---

## 3. Data bindings

| Zone | Source |
|------|--------|
| Character card name | `MockData.loadout.characterId` → `MockData.characters.find(c => c.id === id)` |
| Character stat bars | resolved character `.speed`, `.drift`, `.handling`, `.accel` |
| Kart card name | `MockData.loadout.kartId` → `MockData.karts.find(k => k.id === id)` |
| Kart stat bars | resolved kart `.speed`, `.accel`, `.handling`, `.traction`, `.boost` |
| Track thumbs | `MockData.tracks[0]`, `MockData.tracks[1]` |

---

## 4. Navigation

| Element | Target |
|---------|--------|
| Back button (PageHeader) | `RouteIds.HOME` |
| SELECTED CHARACTER card | `RouteIds.CHARACTERS` |
| SELECTED KART card | `RouteIds.KARTS` |
| TRACK SELECT thumbs | `ModalDialog` (track picker) |
| RACE RULES panel | `ModalDialog` (rules config) |
| START RACE (ActionBar primary) | `RouteIds.LOBBY` |
| BACK (ActionBar secondary) | `NavigationService.back()` |

---

## 5. States

| State | Behavior |
|-------|----------|
| No character selected | Character card renders `EmptyStateBlock` label "Choose Character"; START RACE disabled |
| No kart selected | Kart card renders `EmptyStateBlock` label "Choose Kart"; START RACE disabled |
| Track loading | Track thumb shows ProgressBar shimmer |
| START RACE clicked | Button enters loading state while lobby spins up |

---

## 6. Keyboard flow

```
Tab order:
  1. TopNav items
  2. PageHeader back button
  3. SELECTED CHARACTER card (Enter → navigate to /characters)
  4. HeroPreviewPanel (aria-label, not focusable for interaction)
  5. SELECTED KART card (Enter → navigate to /karts)
  6. TRACK SELECT first thumb
  7. TRACK SELECT second thumb
  8. Match Type tabs (ArrowLeft/ArrowRight within Tabs component)
  9. Race Rules panel (Enter → open modal)
  10. Bot Fill slider (ArrowLeft/ArrowRight adjust value)
  11. ActionBar BACK button
  12. ActionBar START RACE button

Escape: close any open modal; return focus to triggering element
```

---

---

# Page 04 — Play Modes

**Route:** `RouteIds.PLAY` (`/play`)  
**Controller:** `Page04PlayModesController`  
**View:** `Page04PlayModesView`  
**Mockup:** `04-Play-Modes.png`

---

## 1. Layout

TopNav visible. Page content scrolls if viewport is short (target: no scroll on 1080p+).
CardGrid dominates the content zone. Character preview floats right.

```
┌─────────────────────────────────────────────────────────────┐
│  TOP_NAV                                                     │
├────────────────────────────────────────────────────────────┤
│  PageHeader: "PLAY MODES"  [back → /home]                  │
├─────────────────────────────────────────┬──────────────────┤
│  MODE_GRID (9 cards, 5 cols top + 4     │  CHARACTER       │
│  cols bottom — 5/4 split per mockup,    │  PREVIEW         │
│  or 5+4 in two grid rows)               │  (static image   │
│                                         │  or HeroPreview) │
│  ┌────┐┌────┐┌────┐┌────┐┌────┐        │                  │
│  │ GP ││ TT ││ SR ││ BM ││ TR │        │  [character      │
│  └────┘└────┘└────┘└────┘└────┘        │   silhouette]    │
│  ┌────┐┌────┐┌────┐┌────┐              │                  │
│  │ EL ││TRN ││ RK ││ CG │             │                  │
│  └────┘└────┘└────┘└────┘             │                  │
├─────────────────────────────────────────┴──────────────────┤
│  ActionBar: [secondary: BACK]  [primary: SELECT]            │
└────────────────────────────────────────────────────────────┘
```

**CSS skeleton:**

```
.page-play-modes {
  display: grid;
  grid-template-rows: var(--topnav-height) auto 1fr auto;
  height: 100vh;
}

.page-play-modes__body {
  display: grid;
  grid-template-columns: 1fr 200px;
  gap: var(--space-6);
  padding: 0 var(--page-padding-x);
  overflow: hidden;
}
```

The CardGrid itself handles the 5-column (top row) + 4-column (bottom row) layout via
CSS subgrid or two separate CardGrid instances (see note below).

**Implementation note:** The mockup shows 5 cards on top and 4 on the bottom with the
character occupying the 5th slot of the second row. The simplest approach is a single
CardGrid with `columns: 5` and 9 items — the 10th slot is naturally empty, which is
where the character preview sits using CSS absolute positioning over the grid. Programmer
should implement whichever approach is cleaner; the character preview must not be a grid
cell (it is not selectable).

---

## 2. Components used

### TopNav

Same config as other pages. `activeRoute: RouteIds.PLAY`.

### PageHeader

```js
new PageHeader({
  title:    'PLAY MODES',
  showBack: true,
  onBack:   () => NavigationService.navigate(RouteIds.HOME),
})
```

### CardGrid (mode cards)

```js
new CardGrid({
  items: MockData.modes.map(m => ({
    id:   m.id,
    data: m,
  })),
  columns:       5,
  selectedId:    null,
  selectionMode: 'single',
  ariaLabel:     'Play modes',
  renderCard:    (item) => buildModeCard(item.data),
})
```

**Mode card inner structure** (built by `buildModeCard` helper, NOT a separate component
class for M2 — inline render function is sufficient):

```html
<div class="kk-mode-card">
  <div class="kk-mode-card__image" aria-hidden="true">
    <!-- 16/9 image area, static placeholder or mode illustration -->
  </div>
  <div class="kk-mode-card__body">
    <span class="kk-mode-card__name">Grand Prix</span>
    <span class="kk-mode-card__desc">Multiple Races, Series Win</span>
    <span class="kk-mode-card__meta">
      <span class="kk-mode-card__icon" aria-hidden="true"><!-- icon --></span>
      <span class="kk-mode-card__players" aria-label="2 to 12 players">2-12</span>
    </span>
  </div>
</div>
```

Locked modes (future): apply `locked: true` to CardGrid item — `LockedStateBlock`
renders inside automatically via CardGrid's existing `--locked` modifier.

### Character preview (right column)

```js
new HeroPreviewPanel({
  sceneId:     'play-modes-char',
  ariaLabel:   'Selected character preview',
  caption:     null,
  aspectRatio: '3/4',
  loading:     true,
})
```

This updates to reflect the player's current loadout character but is non-interactive on
this page.

### ActionBar

```js
new ActionBar({
  primary: {
    label:    'SELECT',
    variant:  'primary',
    actionId: ButtonIds.PLAY_SELECT,
    disabled: true,   // enabled when a card is selected
  },
  secondary: [
    {
      label:    'BACK',
      variant:  'ghost',
      actionId: ButtonIds.PLAY_BACK,
      onClick:  () => NavigationService.back(),
    },
  ],
})
```

When a mode card is selected, the controller enables the SELECT button and wires its
onClick to the correct destination (see Navigation below).

---

## 3. Data bindings

| Zone | Source |
|------|--------|
| CardGrid items | `MockData.modes` (all 9 entries) |
| Mode card name | `mode.name` |
| Mode card desc | `mode.desc` |
| Mode card player count | `mode.playerCount` |
| Character preview | current loadout character (same as Page 02/03) |

---

## 4. Navigation

Card selection fires `kk:cardgrid:activate`. The controller maps `item.id` to route:

| Mode ID | SELECT target |
|---------|---------------|
| `grand_prix` | `RouteIds.LOBBY` (with state: mode='grand_prix') |
| `time_trial` | `RouteIds.LOBBY` (mode='time_trial') |
| `single_race` | `RouteIds.LOBBY` (mode='single_race') |
| `battle_mode` | `RouteIds.LOBBY` (mode='battle_mode') |
| `team_race` | `RouteIds.LOBBY` (mode='team_race') |
| `elimination` | `RouteIds.LOBBY` (mode='elimination') |
| `tournaments` | `RouteIds.EVENTS` |
| `ranked` | `RouteIds.RANKED` |
| `custom_game` | `RouteIds.LOBBY` (mode='custom_game') |

Double-click / double-Enter on a card activates immediately (same as SELECT button).

| Element | Target |
|---------|--------|
| Back button (PageHeader) | `RouteIds.HOME` |
| BACK (ActionBar secondary) | `NavigationService.back()` |
| SELECT (ActionBar primary) | per mode map above |

---

## 5. States

| State | Behavior |
|-------|----------|
| No selection | SELECT button disabled; sublabel "Choose a mode" |
| Mode selected | SELECT button enabled; sublabel shows mode name |
| `tournaments` card selected | SELECT button label changes to "VIEW EVENTS" |
| `ranked` card selected | SELECT button label changes to "VIEW RANKED" |
| Locked mode | Card renders LockedStateBlock overlay; not selectable |
| Loading | CardGrid `loading: true` → `aria-busy`, opacity 0.5 |

---

## 6. Keyboard flow

```
Tab order:
  1. TopNav items
  2. PageHeader back button
  3. CardGrid (enters roving focus — Arrow keys navigate grid cells)
     - ArrowRight: next column
     - ArrowLeft: prev column
     - ArrowDown: next row
     - ArrowUp: prev row
     - Enter / Space: activate (select + navigate)
     - Escape: deselect
  4. ActionBar BACK
  5. ActionBar SELECT

Focus returns to last focused card after modal close.
```

---

---

# Page 05 — Lobby / Pre-Race Room

**Route:** `RouteIds.LOBBY` (`/lobby`)  
**Controller:** `Page05LobbyController`  
**View:** `Page05LobbyView`  
**Mockup:** `05-Lobby-Pre-Race-Room.png`

---

## 1. Layout

TopNav visible. Three-column body. Countdown in top-right corner. No vertical scroll
(target 1080p). All content fits within the viewport.

```
┌───────────────────────────────────────────────────────────────┐
│  TOP_NAV                                              COUNTDOWN│
│                                                       ┌──────┐│
│                                                       │ 3:00 ││
├──────────────────┬──────────────────────┬─────────────┤──────┘│
│ LEFT COLUMN      │ CENTER COLUMN        │ RIGHT COLUMN        │
│                  │                      │                     │
│ "PARTY MEMBERS"  │ "TRACK VOTE"         │ "PLAYER LOADOUT"    │
│                  │  [Track 1] [Track 2] │  Kart name          │
│ @BEASTKID  HOST  │  [VOTE]    [VOTE]    │  Kart thumbnail     │
│ @KARTMASTER      │                      │  Stat row           │
│ @DRIFTDEVIL      │ ─────────────────── │                     │
│ @SPEEDTEAR  !RDY │                      │  Character avatar   │
│                  │ "RACE RULES"         │  Character name     │
│                  │  Karts Only          │                     │
│                  │  3 Laps              │  Brand badge        │
│                  │  No Boost Items      │                     │
│                  │  Team Drift Off      │ "READY STATUS"      │
│ [INVITE FRIENDS] │                      │  [READY UP] toggle  │
│                  │                      │  [START MATCH]*     │
└──────────────────┴──────────────────────┴─────────────────────┘
│  ActionBar: [secondary: LEAVE LOBBY]  [primary: START MATCH]  │
└───────────────────────────────────────────────────────────────┘
```

*START MATCH only visible to HOST; for non-host it shows disabled with label
"WAITING FOR HOST".

**CSS skeleton:**

```
.page-lobby {
  display: grid;
  grid-template-rows: var(--topnav-height) 1fr auto;
  height: 100vh;
  position: relative;  /* countdown is absolute within this */
}

.page-lobby__body {
  display: grid;
  grid-template-columns: 260px 1fr 280px;
  gap: var(--space-4);
  padding: var(--space-4) var(--page-padding-x);
  overflow: hidden;
}
```

---

## 2. Components used

### TopNav

Same config. `activeRoute: RouteIds.LOBBY` (no matching nav item — no item highlighted).

### Countdown timer (NEW)

```html
<div class="kk-countdown" role="timer" aria-live="off" aria-label="Lobby countdown">
  <span class="kk-countdown__label">COUNTDOWN</span>
  <span class="kk-countdown__value">3:00</span>
  <span class="kk-countdown__sublabel">WAITING FOR PLAYERS</span>
</div>
```

Position: `absolute; top: var(--topnav-height); right: var(--page-padding-x)`.  
Controller drives countdown via `setInterval`. When zero: auto-trigger START MATCH if
host, else show "STARTING..." state.  
`aria-live="off"` — do not announce every second; announce only at 0:30 and 0:10 via
a separate `aria-live="assertive"` region.

### Party roster (left column)

Using `SectionPanel` wrapper + inner roster list:

```js
new SectionPanel({ title: 'PARTY MEMBERS' })
```

Inner: render `MockData.lobbyMembers` as a list of rows.

Each row (PartyMemberRow — new inline component, not a separate class for M2):

```html
<div class="kk-party-row" role="listitem">
  <div class="kk-party-row__avatar" aria-hidden="true"><!-- avatar placeholder --></div>
  <span class="kk-party-row__name">@BEASTKID</span>
  <span class="kk-party-row__role kk-party-row__role--host">HOST</span>
  <span class="kk-party-row__status kk-party-row__status--ready"
        aria-label="Ready">READY</span>
</div>
```

For NOT READY: `kk-party-row__status--not-ready`.  
Role badge only renders for host (`role === 'HOST'`).

**Data:** `MockData.lobbyMembers` — each `{ name, role, ready }`.

Below roster: INVITE FRIENDS button.

```js
new CTAButton({
  label:    'INVITE FRIENDS',
  variant:  'secondary',
  actionId: ButtonIds.LOBBY_INVITE,
  onClick:  () => NavigationService.navigate(RouteIds.PARTY),
})
```

### Track vote (center column, top half)

```js
new SectionPanel({ title: 'TRACK VOTE' })
```

Inner: two track vote cards side by side.

```html
<div class="kk-track-vote">
  <div class="kk-track-vote__card">
    <div class="kk-track-vote__image" aria-hidden="true"><!-- thumb --></div>
    <span class="kk-track-vote__name">Neon Tokyo</span>
    <span class="kk-track-vote__count">Votes 3</span>
    <button class="kk-track-vote__btn" aria-label="Vote for Neon Tokyo">VOTE</button>
  </div>
  <div class="kk-track-vote__card">
    <!-- Beastside Arena -->
  </div>
</div>
```

Vote button fires controller action, not a navigation event. After voting: button shows
"VOTED" disabled state with checkmark.

**Data:** `MockData.tracks[0]`, `MockData.tracks[1]`.

### Race rules (center column, bottom half)

```js
new SectionPanel({ title: 'RACE RULES' })
```

Inner: a definition list of active rules.

```html
<dl class="kk-rules-list">
  <dt class="sr-only">Rule</dt><dd>Karts Only</dd>
  <dt class="sr-only">Rule</dt><dd>3 Laps</dd>
  <dt class="sr-only">Rule</dt><dd>No Boost Items (Ranked Mode)</dd>
  <dt class="sr-only">Rule</dt><dd>Team Drift Off</dd>
</dl>
```

Rules are static mock data for M2. No interaction on this panel.

### Player loadout (right column)

```js
new SectionPanel({ title: 'PLAYER LOADOUT' })
```

Inner (top to bottom):
1. Kart name: `MockData.karts.find(k => k.id === loadout.kartId).name`
2. Kart thumbnail: `HeroPreviewPanel` at `aspectRatio: '4/3'`, `sceneId: 'lobby-kart'`
3. Stat row: three inline stats — Top Speed, Accel, Handling (from kart data).
4. Divider
5. Character accessory icons (3 small icon badges — placeholder circles for M2)
6. Brand badge (faction name from character data)

Click on the section: `NavigationService.navigate(RouteIds.GARAGE)`.

### Ready Status + Start Match (right column, bottom)

```html
<div class="kk-ready-status">
  <button class="kk-ready-btn" aria-pressed="false"
          aria-label="Toggle ready status"
          data-action="LOBBY_READY">
    READY UP
  </button>
</div>
```

Toggle state: `aria-pressed="true"` + label "READY" when toggled on.

Start Match button (HOST only):

```js
new CTAButton({
  label:    'START MATCH',
  sublabel: 'WAITING FOR READY',
  variant:  'primary',
  actionId: ButtonIds.LOBBY_START,
  disabled: !allPlayersReady,
})
```

`disabled` state until all `lobbyMembers.every(m => m.ready)`.

### ActionBar

```js
new ActionBar({
  primary: {
    label:    'START MATCH',
    variant:  'primary',
    actionId: ButtonIds.LOBBY_START_PRIMARY,
    disabled: !isHost || !allReady,
  },
  secondary: [
    {
      label:    'LEAVE LOBBY',
      variant:  'danger',
      actionId: ButtonIds.LOBBY_LEAVE,
      onClick:  () => ModalService.open(ModalIds.CONFIRM_LEAVE),
    },
  ],
})
```

LEAVE LOBBY triggers a `ConfirmationDialog`:

```js
new ConfirmationDialog({
  title:      'Leave Race?',
  body:       'You will lose your lobby slot.',
  confirmLabel: 'LEAVE',
  cancelLabel:  'STAY',
  onConfirm:  () => NavigationService.navigate(RouteIds.HOME),
})
```

---

## 3. Data bindings

| Zone | Source |
|------|--------|
| Party member list | `MockData.lobbyMembers` |
| Track vote cards | `MockData.tracks[0]`, `MockData.tracks[1]` |
| Player kart name | `MockData.karts.find(k => k.id === MockData.loadout.kartId)` |
| Player kart stats | resolved kart `.speed`, `.accel`, `.handling` |
| Player character brand | resolved character faction (hardcoded "BEASTSIDE" in M2) |
| START MATCH disabled state | `!MockData.lobbyMembers.every(m => m.ready)` |

---

## 4. Navigation

| Element | Target |
|---------|--------|
| INVITE FRIENDS | `RouteIds.PARTY` |
| PLAYER LOADOUT section | `RouteIds.GARAGE` |
| LEAVE LOBBY | `ConfirmationDialog` → `RouteIds.HOME` on confirm |
| START MATCH (host) | gameplay state (outside UI scope for M2 — emit event `EventIds.LOBBY_START_MATCH`) |
| VOTE buttons | controller action only (no route) |
| READY UP | controller action only (no route) |

---

## 5. States

| State | Behavior |
|-------|----------|
| Not all ready | START MATCH disabled; sublabel "WAITING FOR READY" |
| All ready | START MATCH enabled; sublabel clears |
| Non-host player | START MATCH hidden in right column; ActionBar primary disabled with label "WAITING FOR HOST" |
| Vote cast | VOTE button disabled + "VOTED" label + checkmark |
| Countdown at 0 | "STARTING..." label replaces countdown; START MATCH auto-triggers (host) |
| Player disconnects | their row shows offline indicator; ready count recalculates |

---

## 6. Keyboard flow

```
Tab order:
  1. TopNav items
  2. Countdown (non-interactive; aria-live announces changes)
  3. Party member list (read-only region; no focus stops per row)
  4. INVITE FRIENDS button
  5. VOTE button (track 1)
  6. VOTE button (track 2)
  7. Race Rules (read-only; no focus stop)
  8. PLAYER LOADOUT section (Enter → navigate to /garage)
  9. READY UP toggle button
  10. START MATCH button (right column, host only)
  11. ActionBar LEAVE LOBBY button
  12. ActionBar START MATCH button

Escape: open ConfirmationDialog for leaving lobby
```

---

---

# Page 19 — Results / Post-Race

**Route:** `RouteIds.RESULTS` (`/results`)  
**Controller:** `Page19ResultsController`  
**View:** `Page19ResultsView`  
**Mockup:** `19-Results-Post-Race.png`

---

## 1. Layout

No TopNav. No PageHeader. Full cinematic results screen. Animated entrance preferred
(defer to art-director for animation timing).

```
┌──────────────────────────────────────────────────────────────┐
│  HERO_BG (blurred city backdrop — static image or canvas)    │
├──────────────────────────────────────────────────────────────┤
│                    RESULTS_HEADER                            │
│              "RACE RESULTS"  🏆                              │
│          "FINAL POSITION: 1st PLACE!"                        │
├──────────────────────────────────────────────────────────────┤
│                    PODIUM_ZONE                               │
│         [2nd silhouette]  [1st podium]  [3rd silhouette]    │
│                      XP GAIN strip                          │
│                   REWARDS EARNED panel                      │
├──────────────────┬───────────────────┬─────────────────────┤
│  LEFT            │  CENTER           │  RIGHT               │
│  "RACE STATS"    │  XP bar +         │  "CHALLENGE          │
│  Total Time      │  Level up flash   │   PROGRESS"          │
│  Best Lap        │  Rewards list     │  3 progress bars     │
│  Top Speed       │                   │                      │
│  Drifts          │                   │                      │
├──────────────────┴───────────────────┴─────────────────────┤
│  ActionBar: [REMATCH] [NEXT RACE]  [primary: RETURN TO LOBBY]│
└──────────────────────────────────────────────────────────────┘
```

**CSS skeleton:**

```
.page-results {
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  min-height: 100vh;
  position: relative;
  isolation: isolate;
}

.page-results__bottom {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--space-6);
  padding: var(--space-4) var(--page-padding-x);
}
```

---

## 2. Components used

### Results header

```html
<header class="kk-results-header" role="banner">
  <h1 class="kk-results-header__title">RACE RESULTS</h1>
  <span class="kk-results-header__trophy" aria-hidden="true"><!-- trophy icon/image --></span>
  <p class="kk-results-header__position" aria-label="Final position: 1st place">
    FINAL POSITION: 1<sup>ST</sup> PLACE!
  </p>
</header>
```

`--text-hero-xl` for title. `--text-3xl` for position line.  
For screen readers, the `<p>` should be the announced text without superscript markup.

### Podium zone

Three character silhouettes arranged by place:

```html
<section class="kk-podium" aria-label="Race podium">
  <div class="kk-podium__place kk-podium__place--2nd" aria-label="2nd place">
    <!-- character silhouette image, greyscale -->
    <span class="kk-podium__rank">2</span>
  </div>
  <div class="kk-podium__place kk-podium__place--1st" aria-label="1st place — you">
    <!-- player character, full color, raised -->
    <span class="kk-podium__rank">1</span>
    <div class="kk-podium__xp-gain" aria-label="XP earned: 2500">
      XP GAIN<br>Total XP: +2500<br>Level 24 → Level 25
    </div>
  </div>
  <div class="kk-podium__place kk-podium__place--3rd" aria-label="3rd place">
    <span class="kk-podium__rank">3</span>
  </div>
</section>
```

The XP GAIN callout is centered below/around the 1st place podium. It includes the
level-up animation trigger point (controlled by CSS class toggle after entrance delay).

### XP ProgressBar (within podium zone)

```js
new ProgressBar({
  label:        'XP to next level',
  value:        MockData.player.xp,
  min:          0,
  max:          MockData.player.xpToNext,
  valueText:    `${MockData.player.xp} / ${MockData.player.xpToNext} XP`,
  showEndLabel: true,
  animated:     true,
  variant:      'xp',
})
```

### Race Stats panel (left column)

```js
new SectionPanel({ title: 'RACE STATS' })
```

Inner: definition list.

```html
<dl class="kk-stats-list">
  <div class="kk-stats-list__row">
    <dt>Total Time</dt><dd>2:45.12</dd>
  </div>
  <div class="kk-stats-list__row">
    <dt>Best Lap</dt><dd>0:51.34</dd>
  </div>
  <div class="kk-stats-list__row">
    <dt>Top Speed</dt><dd>188 KM/H</dd>
  </div>
  <div class="kk-stats-list__row">
    <dt>Drifts</dt><dd>11</dd>
  </div>
</dl>
```

All values are static mock data in M2. Real race session data will replace these in
backend integration phase.

### Rewards Earned panel (center column)

```js
new SectionPanel({ title: 'REWARDS EARNED' })
```

Inner: list of reward rows.

```html
<ul class="kk-rewards-list" aria-label="Rewards earned">
  <li class="kk-rewards-list__item">
    <span class="kk-rewards-list__icon" aria-hidden="true"><!-- icon --></span>
    <span class="kk-rewards-list__desc">A new special gold-rimmed wheel set 3D icon</span>
  </li>
  <li class="kk-rewards-list__item">
    <span class="kk-rewards-list__icon" aria-hidden="true"><!-- coins --></span>
    <span class="kk-rewards-list__desc">+500 Coins</span>
  </li>
  <li class="kk-rewards-list__item">
    <span class="kk-rewards-list__icon" aria-hidden="true"><!-- rare --></span>
    <span class="kk-rewards-list__desc">1 rare "Drift Boost" consumable item</span>
  </li>
</ul>
```

Static mock for M2. Animate entrance staggered (150ms delay per item, respect
`prefers-reduced-motion`).

### Challenge Progress panel (right column)

```js
new SectionPanel({ title: 'CHALLENGE PROGRESS' })
```

Inner: render active challenges from `MockData.challenges` with `ProgressBar` per
challenge:

```js
MockData.challenges.forEach(ch => {
  const bar = new ProgressBar({
    label:        ch.title,
    value:        ch.progress,
    min:          0,
    max:          ch.target,
    valueText:    `${ch.progress} / ${ch.target}`,
    showEndLabel: true,
    animated:     true,
    variant:      ch.claimed ? 'default' : 'challenge',
  });
  // Render label above bar, status badge (COMPLETE / progress count) beside
});
```

Completed challenge rows get a "COMPLETE" badge (green). Partial rows show `progress/target`.

### ActionBar

```js
new ActionBar({
  primary: {
    label:    'RETURN TO LOBBY',
    variant:  'primary',
    actionId: ButtonIds.RESULTS_RETURN_LOBBY,
    onClick:  () => NavigationService.navigate(RouteIds.LOBBY),
  },
  secondary: [
    {
      label:    'REMATCH',
      variant:  'secondary',
      actionId: ButtonIds.RESULTS_REMATCH,
      onClick:  () => NavigationService.navigate(RouteIds.LOBBY),
    },
    {
      label:    'NEXT RACE',
      variant:  'secondary',
      actionId: ButtonIds.RESULTS_NEXT_RACE,
      onClick:  () => NavigationService.navigate(RouteIds.LOBBY),
    },
  ],
})
```

---

## 3. Data bindings

| Zone | Source |
|------|--------|
| Final position label | Session result (mock: "1st Place") |
| XP gain amount | `MockData.player.xp` (2500) |
| Level transition | `MockData.player.level` (24 → 25) |
| XP bar current/max | `MockData.player.xp` / `MockData.player.xpToNext` |
| Race stats | Static mock values (Total Time: 2:45.12, Best Lap: 0:51.34, Top Speed: 188 KM/H, Drifts: 11) |
| Challenge progress bars | `MockData.challenges` (all 4 entries) |
| Challenge bar progress | `ch.progress` / `ch.target` |
| Challenge claimed status | `ch.claimed` |

---

## 4. Navigation

| Element | Target |
|---------|--------|
| REMATCH | `RouteIds.LOBBY` |
| NEXT RACE | `RouteIds.LOBBY` |
| RETURN TO LOBBY | `RouteIds.LOBBY` |

No in-page navigation. No back button. This is a terminal screen — the only exit paths
are the three ActionBar buttons.

---

## 5. States

| State | Behavior |
|-------|----------|
| Level-up | XP bar animates to max, then "LEVEL UP" flash overlay triggers, bar resets to 0 and animates to new level's XP value |
| No rewards | Rewards panel renders `EmptyStateBlock` with label "No rewards this race" |
| All challenges complete | Challenge panel shows all bars at 100% with COMPLETE badges |
| Loading | Page renders with shimmer panels; no ActionBar until data resolves |

---

## 6. Keyboard flow

Initial focus: RETURN TO LOBBY (primary action — most likely intention).

```
Tab order (results page is read-mostly; minimal interactive elements):
  1. Podium zone (role="region"; not focusable — decorative)
  2. Race Stats panel (role="region"; not focusable)
  3. Rewards Earned panel (role="region"; not focusable)
  4. Challenge Progress panel (role="region"; not focusable)
  5. ActionBar: REMATCH
  6. ActionBar: NEXT RACE
  7. ActionBar: RETURN TO LOBBY  ← initial focus

Escape: no action (no modals on this page by default)
```

---

---

# Page 22 — Pause Menu

**Route:** `RouteIds.PAUSE` (`/pause`)  
**Controller:** `Page22PauseController`  
**View:** `Page22PauseView`  
**Mockup:** `22-Pause-Menu.png`

---

## 1. Layout

Modal overlay rendered above blurred/darkened game canvas. No TopNav. No PageHeader.
The game canvas remains in the DOM beneath the overlay (gameplay frozen, audio muted).

```
┌──────────────────────────────────────────────────────────────┐
│  GAME_CANVAS (blurred, opacity 0.4, pointer-events: none)    │
│                                                              │
│  PAUSE_OVERLAY (position: fixed; inset: 0; z-index: var(--z-modal))
│  ┌────────────────────────────────────┐                      │
│  │  PAUSE_PANEL (centered, ~360px wide)                      │
│  │                                    │                      │
│  │   [small eyebrow: "PAUSED"]        │                      │
│  │   [BEASTSIDE logo / brand mark]    │                      │
│  │                                    │                      │
│  │   [RESUME]  ← primary, full width  │                      │
│  │   [RESTART]                        │                      │
│  │   [SETTINGS]                       │                      │
│  │   [CONTROLS]                       │                      │
│  │   [LEAVE RACE]                     │                      │
│  │                                    │                      │
│  └────────────────────────────────────┘                      │
│                                           ┌────────────────┐ │
│                                           │  RACE STATUS   │ │
│                                           │  Lap: 2/5      │ │
│                                           │  Position: 4th │ │
│                                           │  Drift: 12,450 │ │
│                                           └────────────────┘ │
│                                                              │
│  [race timer continues visible in top-right: 22:15]          │
└──────────────────────────────────────────────────────────────┘
```

**CSS skeleton:**

```
.page-pause {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.kk-pause-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  width: clamp(280px, 30vw, 380px);
  padding: var(--space-8) var(--space-6);
  background: var(--color-panel-base);
  border: 1px solid var(--color-panel-border);
  border-radius: var(--radius-lg);
}

.kk-race-status {
  position: absolute;
  bottom: var(--space-8);
  right: var(--page-padding-x);
  width: 180px;
}

.kk-race-timer {
  position: absolute;
  top: var(--space-4);
  right: var(--page-padding-x);
}
```

---

## 2. Components used

### Overlay backdrop

```html
<div class="page-pause" role="dialog" aria-modal="true" aria-label="Game paused">
```

Focus trap must be active: Tab cycles only within `.kk-pause-panel` and `.kk-race-status`.

### Pause panel header

```html
<div class="kk-pause-panel__header">
  <span class="kk-pause-panel__eyebrow">PAUSED</span>
  <img class="kk-pause-panel__brand" src="/sprites/brand-mark.png"
       alt="Beastside Kart Kids" />
</div>
```

### Button stack

Each button is a `CTAButton`. Stack them inside a `ButtonBar` in vertical orientation.

```js
new ButtonBar({
  orientation: 'vertical',
  items: [
    {
      label:    'RESUME',
      variant:  'primary',
      actionId: ButtonIds.PAUSE_RESUME,
      onClick:  () => controller.resume(),     // closes overlay; resumes game
    },
    {
      label:    'RESTART',
      variant:  'secondary',
      actionId: ButtonIds.PAUSE_RESTART,
      onClick:  () => controller.restart(),
    },
    {
      label:    'SETTINGS',
      variant:  'ghost',
      actionId: ButtonIds.PAUSE_SETTINGS,
      onClick:  () => NavigationService.navigate(RouteIds.SETTINGS),
    },
    {
      label:    'CONTROLS',
      variant:  'ghost',
      actionId: ButtonIds.PAUSE_CONTROLS,
      onClick:  () => ModalService.open(ModalIds.CONTROLS_REFERENCE),
    },
    {
      label:    'LEAVE RACE',
      variant:  'danger',
      actionId: ButtonIds.PAUSE_LEAVE,
      onClick:  () => ModalService.open(ModalIds.CONFIRM_LEAVE_RACE),
    },
  ],
})
```

All buttons full-width within the panel (`width: 100%; min-height: var(--hit-target-min)`).

RESUME is the first button — visually primary, receives initial focus on mount.

LEAVE RACE triggers a `ConfirmationDialog`:

```js
new ConfirmationDialog({
  title:        'Leave Race?',
  body:         'Your progress will be lost.',
  confirmLabel: 'LEAVE',
  cancelLabel:  'STAY',
  variant:      'danger',
  onConfirm:    () => NavigationService.navigate(RouteIds.HOME),
  onCancel:     () => ModalService.close(ModalIds.CONFIRM_LEAVE_RACE),
})
```

On cancel: focus returns to LEAVE RACE button.

### Race Status panel (bottom-right, outside pause panel)

```js
new SectionPanel({ title: 'RACE STATUS' })
```

Inner:

```html
<dl class="kk-race-status__list">
  <div class="kk-race-status__row">
    <dt>LAP</dt><dd aria-label="Lap 2 of 5">2/5</dd>
  </div>
  <div class="kk-race-status__row">
    <dt>POSITION</dt><dd aria-label="Position: 4th">4th</dd>
  </div>
  <div class="kk-race-status__row">
    <dt>DRIFT SCORE</dt><dd>12,450</dd>
  </div>
</dl>
```

Static mock for M2. Race session state will drive this in integration phase.

### Race timer (top-right corner)

```html
<span class="kk-race-timer" aria-label="Race time: 22 minutes 15 seconds" aria-live="off">
  22:15
</span>
```

Frozen at pause time. `aria-live="off"` — not announced while paused.

---

## 3. Data bindings

| Zone | Source |
|------|--------|
| Lap indicator | Session state (mock: "2/5") |
| Position | Session state (mock: "4th") |
| Drift score | Session state (mock: "12,450") |
| Race timer | Session state (mock: "22:15") |

No MockData.js entries for pause state — these come from the game session. In M2, use
hardcoded placeholder values listed above.

---

## 4. Navigation

| Element | Target |
|---------|--------|
| RESUME | `controller.resume()` — close overlay, restore gameplay |
| RESTART | `controller.restart()` — restart session (no route change) |
| SETTINGS | `RouteIds.SETTINGS` (pushes settings on top; back returns to /pause) |
| CONTROLS | `ModalIds.CONTROLS_REFERENCE` modal (in-page, no route change) |
| LEAVE RACE | `ConfirmationDialog` → on confirm: `RouteIds.HOME` |

---

## 5. States

| State | Behavior |
|-------|----------|
| Loading (settings) | SETTINGS button shows loading state while page loads |
| Confirm leave dialog open | Pause panel buttons inert (focus trapped in dialog) |
| Controls modal open | Pause panel buttons inert (focus trapped in modal) |
| RESTART loading | RESTART button spinner while session resets |

---

## 6. Keyboard flow

Initial focus: RESUME button on pause overlay mount.

```
Tab order (focus trapped within overlay):
  1. RESUME  ← initial focus
  2. RESTART
  3. SETTINGS
  4. CONTROLS
  5. LEAVE RACE
  6. Race Status panel (role="region"; not focusable — read-only info)
  Tab wraps back to RESUME.

Escape: triggers RESUME (same as clicking RESUME — close overlay)
Enter on RESUME: close overlay
Enter on LEAVE RACE: open ConfirmationDialog
  ConfirmationDialog tab order:
    1. STAY  ← initial focus in dialog
    2. LEAVE
    Escape: STAY (close dialog; return to LEAVE RACE)
```

Gamepad mapping note (for Controls.js integration): Start button / Menu button = RESUME.
This mirrors standard pause behavior across console titles.

---

---

# Cross-page notes for the programmer

## New components required by M2

These are referenced above but do not exist in M1. Create as lightweight inline classes
or standalone component files as appropriate:

| Component | Used in | Complexity |
|-----------|---------|------------|
| `PlayerSummaryStrip` | Page 02 | Low — read-only DOM |
| `EventCard` | Page 02 | Low — button-like card |
| `CountdownTimer` | Page 05 | Medium — setInterval + aria-live |
| `PartyMemberRow` | Page 05 | Low — list item |
| `TrackVoteCard` | Page 05 | Low — card + button |
| `PodiumDisplay` | Page 19 | Medium — layout + animation |

## Custom events to emit (for analytics stubs)

| Event name | Page | Trigger |
|------------|------|---------|
| `start_game_clicked` | 01 | PRESS START |
| `quick_play_started` | 02, 03 | QUICK PLAY CTA |
| `mode_selected` | 04 | SELECT button |
| `lobby_ready_toggled` | 05 | READY UP |
| `lobby_start_match` | 05 | START MATCH |
| `results_rematch` | 19 | REMATCH |
| `pause_resume` | 22 | RESUME |
| `pause_leave_confirmed` | 22 | LEAVE confirm |

## Accessibility checklist summary

All 7 pages have been designed to satisfy:

- [x] Keyboard-only operation (roving focus via Arrow keys in CardGrid, ButtonBar, TopNav; Tab for sequential flow)
- [x] Gamepad-first design (large hit targets, no hover-only affordances)
- [x] Focus trap on modal overlays (Pause, ConfirmationDialog, ModalDialog)
- [x] `aria-live` regions for countdowns, XP bars, vote counts (scoped — not every tick)
- [x] Color is never the sole differentiator (ready/not-ready uses text + color + icon)
- [x] No flashing content without prefers-reduced-motion guards (pulse animation on Title, level-up flash on Results)
- [x] Subtitles not applicable to these pages (no dialogue cutscenes)
- [x] All text uses CSS custom properties — scalable at any supported resolution

## ButtonIds required (add to js/ui/enums/ButtonIds.js)

```js
// Page 01
TITLE_START, TITLE_SIGN_IN, TITLE_SETTINGS, TITLE_ACCESSIBILITY, TITLE_LANGUAGE, TITLE_EVENT,

// Page 02
HOME_QUICK_PLAY, HOME_PLAY_MODES, HOME_PARTY, HOME_GARAGE,
HOME_CREATE, HOME_PROFILE, HOME_SHOP, HOME_SETTINGS,

// Page 03
QUICK_PLAY_START, QUICK_PLAY_BACK,

// Page 04
PLAY_SELECT, PLAY_BACK,

// Page 05
LOBBY_INVITE, LOBBY_READY, LOBBY_START, LOBBY_START_PRIMARY, LOBBY_LEAVE,

// Page 19
RESULTS_REMATCH, RESULTS_NEXT_RACE, RESULTS_RETURN_LOBBY,

// Page 22
PAUSE_RESUME, PAUSE_RESTART, PAUSE_SETTINGS, PAUSE_CONTROLS, PAUSE_LEAVE,
```

## ModalIds required (add to js/ui/enums/ModalIds.js)

```js
SIGN_IN, TRACK_PICKER, RACE_RULES_CONFIG,
CONFIRM_LEAVE, CONFIRM_LEAVE_RACE, CONTROLS_REFERENCE,
```

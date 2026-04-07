# KART KIDS — UI/UX Product Requirements Document

**Codex implementation brief for a AAA-style arcade racing menu system, page scaffolding, routing, component architecture, and OOP scripting standards.**

**Visual direction:** premium modern arcade racer in the same broader ecosystem as **BEASTSIDE**, but faster, cleaner, more playful, and more racing-focused.

---

## Implementation goals

- Scaffold a full, navigable AAA-style racing game menu system for desktop-first web delivery with responsive foundations.
- Preserve a premium, bold, brand-family style influenced by **BEASTSIDE**: strong black/white foundations, condensed headers, rectangular framing, confident hierarchy, and selective racing accents.
- Build reusable object-oriented page controllers, UI components, services, state models, and routing logic so future integration is clean and low-risk.
- Make every page immediately understandable, visually structured, and linked through explicit button actions and route transitions.

---

# 1. Experience vision and style system

## Design direction

KART KIDS should feel like a **premium arcade racing franchise**:

- modern
- kinetic
- family-friendly
- highly readable
- cool without becoming gritty
- console-quality, adapted for web

The UI language should borrow **BEASTSIDE's confidence and graphic discipline**, then translate it into racing with:

- more motion
- more friendliness
- more toy-like premium finish
- more title-screen polish
- more motorsport-inspired hierarchy

## Visual rules

- Use dark translucent panels over richer scene backdrops.
- Use strong boxed titles and clear rectangular framing.
- Use all-caps utility labels and bold primary CTAs.
- Use premium spacing and icon-first content modules.
- Use selective accent colors only where needed: speed orange/yellow, restrained cyan/pink, white/high-contrast neutrals.
- Avoid cheap mobile clutter, dense debug HUDs, or generic neon overload.
- Avoid over-rounding everything; this is friendly, but still sharp and premium.

## Tone keywords

Fast, premium, readable, modular, confident, playful, cinematic, toy-like in finish, modern street-racer, ecosystem-consistent, console-quality adapted for web.

---

# 2. Application architecture

## Top-level routes

```txt
/                -> Title Screen
/home            -> Home / Main Menu
/quick-play      -> Quick Play
/play            -> Play Modes
/lobby           -> Lobby / Pre-Race Room
/party           -> Party / Friends
/events          -> Tournaments / Events
/ranked          -> Ranked / Competitive
/garage          -> Garage
/characters      -> Character Select
/karts           -> Kart Select
/profile         -> Player Profile / Career
/challenges      -> Challenges / Quests
/season          -> Rewards / Season / Pass
/shop            -> Shop / Store
/create          -> Track Builder / Create Hub
/editor          -> Track Editor
/discover        -> Community Tracks / Discover
/results         -> Results / Post-Race
/inbox           -> Notifications / Inbox
/settings        -> Settings
/pause           -> Pause Menu
/tutorial        -> Onboarding / Tutorial
```

## Navigation model

The application should use a central `AppShell` with:

- persistent global navigation where appropriate
- per-page controllers
- centralized routing
- modal overlays
- a consistent page header/action bar system
- deterministic back-stack handling
- caller-return context for nested flows

## View composition

Every page should be composed from reusable regions:

- Top bar
- Page header
- Primary content zone
- Secondary utility zone
- Bottom action bar
- Modal layer
- Toast / notification layer

## State architecture

Separate **view state** from **domain state**.

### Page-local UI state
Use for:

- tabs
- filters
- selection state
- sort order
- focus state
- temporary modal visibility

### Global domain state
Use services/stores for:

- profile
- inventory
- garage presets
- party
- lobby
- season
- matchmaking
- rewards
- shop balance
- tutorial progress

### Route params
Use for deep-linkable content:

- selected mode
- selected event
- selected track
- selected loadout
- selected discover category

---

# 3. Object-oriented engineering standards

## Programming model

Use object-oriented programming with clear responsibilities.

- Prefer **composition over inheritance** for UI widgets.
- Standardize abstract interfaces for:
  - pages
  - controllers
  - views
  - services
  - repositories
  - command objects

## Core classes

Recommended baseline:

- `AppShell`
- `RouterService`
- `NavigationService`
- `AnalyticsService`
- `ModalService`
- `NotificationService`
- `PageControllerBase`
- `PageViewBase`
- `CardComponentBase`
- `PanelComponentBase`
- `CTAButtonComponent`
- `TabsComponent`
- `ActionBarComponent`
- `MockRepositoryBase`
- per-page controller/view pairs

## Suggested page contract

Every page controller should expose at minimum:

```ts
initialize()
bindEvents()
loadData()
render()
attachNavigation()
validateState()
dispose()
```

Every page view should expose methods for:

- mounting content sections
- refreshing state
- applying disabled/loading/locked variants
- binding button references by ID
- rendering placeholder content

## Button linking pattern

Every clickable UI element must map to a named route action or controller command.

### Rules

- Do **not** use inline anonymous navigation logic.
- Use declarative button IDs.
- Use centralized route targets.
- Use controller-owned handlers for business flow.
- Keep route transitions testable and auditable.

## Best practices

- Use typed interfaces.
- Use single responsibility.
- Clean up listeners/subscriptions on unmount.
- Keep deterministic render order.
- Reuse mocks and repositories.
- Use constants/enums for page IDs, route IDs, button IDs, event IDs.
- Support explicit loading, error, empty, and locked-state handlers.
- Keep page scripts modular and testable.

---

# 4. Shared UI framework

## Required reusable components

- `TopNav`
- `SideRail`
- `PageHeader`
- `SectionPanel`
- `HeroPreviewPanel`
- `CardGrid`
- `ModeCard`
- `EventCard`
- `RewardCard`
- `TrackCard`
- `FriendRow`
- `PartyRoster`
- `ChallengeRow`
- `StatsPanel`
- `Tabs`
- `ActionBar`
- `ModalDialog`
- `ConfirmationDialog`
- `Toast`
- `EmptyStateBlock`
- `LockedStateBlock`
- `SearchFilterBar`
- `ProgressBar`
- `BadgeChip`
- `CurrencyStrip`
- `PlayerSummaryStrip`
- `ButtonBar`
- `LoadoutPreviewCard`

## Interaction states

Every reusable component must support:

- default
- hover
- focus
- selected
- pressed
- disabled
- loading
- locked
- success
- warning
- error

## Input support

Layouts and focus order must support:

- keyboard-first navigation
- controller-first navigation
- responsive foundations for future touch adaptation

Hit targets should be:

- large
- predictable
- spaced consistently

## Analytics hooks

Stub analytics events for major actions such as:

- `start_game_clicked`
- `quick_play_started`
- `lobby_ready_toggled`
- `event_opened`
- `ranked_queue_started`
- `garage_item_equipped`
- `reward_claimed`
- `track_published`
- `settings_changed`

---

# 5. Page interconnection matrix

Use this as the default routing contract.

## Global primary nav

- `QUICK PLAY` -> `/quick-play`
- `PLAY` -> `/play`
- `PARTY` -> `/party`
- `GARAGE` -> `/garage`
- `CREATE` -> `/create`
- `PROFILE` -> `/profile`
- `SHOP` -> `/shop`
- `SETTINGS` -> `/settings`

## Flow map

### Title / Home
- `/` -> `PRESS START` -> `/home`
- `/` -> `SETTINGS` -> `/settings`
- `/` -> `ACCESSIBILITY` -> `/settings#accessibility`
- `/` -> `LANGUAGE` -> `/settings#language`
- `/home` -> `QUICK PLAY` -> `/quick-play`
- `/home` -> `PLAY MODES` -> `/play`
- `/home` -> `PARTY` -> `/party`
- `/home` -> `GARAGE` -> `/garage`
- `/home` -> `CREATE` -> `/create`
- `/home` -> `PROFILE` -> `/profile`
- `/home` -> `SHOP` -> `/shop`
- `/home` -> `SETTINGS` -> `/settings`
- `/home` -> `FEATURED EVENT` -> `/events`
- `/home` -> `DAILY CHALLENGES` -> `/challenges`

### Race flow
- `/quick-play` -> `SELECTED CHARACTER` -> `/characters`
- `/quick-play` -> `SELECTED KART` -> `/karts`
- `/quick-play` -> `START RACE` -> `/lobby`
- `/play` -> `GRAND PRIX` -> mode setup -> `/lobby`
- `/play` -> `SINGLE RACE` -> mode setup -> `/lobby`
- `/play` -> `TIME TRIAL` -> mode setup -> `/lobby`
- `/play` -> `BATTLE MODE` -> mode setup -> `/lobby`
- `/play` -> `TEAM RACE` -> mode setup -> `/lobby`
- `/play` -> `ELIMINATION` -> mode setup -> `/lobby`
- `/play` -> `TOURNAMENTS` -> `/events`
- `/play` -> `RANKED` -> `/ranked`
- `/play` -> `CUSTOM GAME` -> `/lobby`
- `/lobby` -> `INVITE FRIENDS` -> `/party`
- `/lobby` -> `PLAYER LOADOUT` -> `/garage`
- `/lobby` -> `START MATCH` -> gameplay state
- gameplay -> pause button -> `/pause`
- gameplay complete -> `/results`
- `/pause` -> `RESUME` -> gameplay state
- `/pause` -> `SETTINGS` -> `/settings`
- `/pause` -> `LEAVE RACE` -> `/home`
- `/results` -> `REMATCH` -> `/lobby`
- `/results` -> `NEXT RACE` -> `/lobby`
- `/results` -> `RETURN TO LOBBY` -> `/lobby`
- `/results` -> `GARAGE` -> `/garage`

### Social / progression
- `/party` -> `JOINABLE SESSIONS` -> `/lobby`
- `/events` -> `ENTER EVENT` -> `/lobby`
- `/events` -> `LEADERBOARD` -> internal modal or `/ranked`
- `/ranked` -> `QUEUE RANKED` -> `/lobby`
- `/ranked` -> `LEADERBOARD` -> ranked leaderboard modal/view
- `/garage` -> `CHARACTERS` -> `/characters`
- `/garage` -> `KARTS` -> `/karts`
- `/profile` -> `ACHIEVEMENTS` -> internal tab
- `/profile` -> `MATCH HISTORY` -> internal tab
- `/challenges` -> `CLAIM` -> reward modal
- `/season` -> `CLAIM REWARD` -> reward modal
- `/shop` -> `PURCHASE` -> purchase confirmation modal
- `/inbox` -> `CLAIM` -> reward modal
- `/inbox` -> `CLAIM ALL` -> batch claim modal

### Create / UGC flow
- `/create` -> `NEW TRACK` -> `/editor`
- `/create` -> `EDIT TRACK` -> `/editor`
- `/create` -> `FEATURED TRACKS` -> `/discover`
- `/editor` -> `TEST DRIVE` -> gameplay preview state
- `/editor` -> `PUBLISH` -> publish confirmation modal
- `/discover` -> `PLAY NOW` -> `/lobby` or quick race start flow
- `/discover` -> `CREATOR` -> creator profile modal / future profile route

### Utility / onboarding
- `/settings` -> section tabs remain in page
- `/tutorial` -> `PRACTICE` -> `/quick-play`
- `/tutorial` -> `SKIP` -> `/home`

---

# 6. Detailed page requirements (01–23)

For each page, Codex should scaffold the named UI elements, wire the buttons to the listed routes/actions, and implement the recommended controller/component structure with mock data and placeholder service calls.

---

## 01 — Title Screen / Start Screen

### Purpose
First impression, branding, account entry, and handoff into the game.

### Required titled UI elements
- `KART KIDS LOGO`
- `PRESS START`
- `PLAYER SIGN-IN`
- `SETTINGS`
- `ACCESSIBILITY`
- `LANGUAGE`
- `FEATURED EVENT`
- `VERSION`

### Must contain
- full-screen hero background region
- strong title treatment
- one dominant CTA
- small utility controls
- account state placeholder
- version/build string

### Required button links
- `PRESS START` -> `/home`
- `PLAYER SIGN-IN` -> sign-in modal / placeholder auth action
- `SETTINGS` -> `/settings`
- `ACCESSIBILITY` -> `/settings#accessibility`
- `LANGUAGE` -> `/settings#language`
- `FEATURED EVENT` -> `/events`

### Suggested controller/view
- `Page01TitleController`
- `Page01TitleView`
- components: `HeroPreviewPanel`, `PageHeader`, `CTAButtonComponent`, `ModalDialog`

### Companion image
- `01-Title-Screen-Start-Screen.png`

---

## 02 — Home / Main Menu

### Purpose
Primary hub for all major game systems.

### Required titled UI elements
- `QUICK PLAY`
- `PLAY MODES`
- `PARTY`
- `GARAGE`
- `CREATE`
- `PROFILE`
- `SHOP`
- `SETTINGS`
- `FEATURED EVENT`
- `DAILY CHALLENGES`
- `PLAYER SUMMARY`
- `CURRENT LOADOUT`

### Must contain
- dominant quick play tile/button
- feature rail/card area
- player summary strip
- current character/kart preview
- notification affordance
- news/event region

### Required button links
- `QUICK PLAY` -> `/quick-play`
- `PLAY MODES` -> `/play`
- `PARTY` -> `/party`
- `GARAGE` -> `/garage`
- `CREATE` -> `/create`
- `PROFILE` -> `/profile`
- `SHOP` -> `/shop`
- `SETTINGS` -> `/settings`
- `FEATURED EVENT` -> `/events`
- `DAILY CHALLENGES` -> `/challenges`
- `CURRENT LOADOUT` -> `/garage`

### Suggested controller/view
- `Page02HomeController`
- `Page02HomeView`
- components: `TopNav`, `CardGrid`, `PlayerSummaryStrip`, `HeroPreviewPanel`, `EventCard`

### Companion image
- `02-Home-Main-Menu.png`

---

## 03 — Quick Play

### Purpose
Fastest path into a race.

### Required titled UI elements
- `QUICK PLAY`
- `SELECTED CHARACTER`
- `SELECTED KART`
- `TRACK SELECT`
- `MATCH TYPE`
- `RACE RULES`
- `BOT FILL`
- `START RACE`

### Must contain
- selected character preview
- selected kart preview
- track picker/randomizer
- match type selector
- rules preset selector
- bot fill toggle
- start button

### Required button links
- `SELECTED CHARACTER` -> `/characters`
- `SELECTED KART` -> `/karts`
- `TRACK SELECT` -> track picker modal
- `MATCH TYPE` -> match-type dropdown/modal
- `RACE RULES` -> rules modal/panel
- `START RACE` -> `/lobby`

### Suggested controller/view
- `Page03QuickPlayController`
- `Page03QuickPlayView`
- components: `HeroPreviewPanel`, `StatsPanel`, `SectionPanel`, `CTAButtonComponent`

### Companion image
- `03-Quick-Play.png`

---

## 04 — Play Modes

### Purpose
Full mode browser.

### Required titled UI elements
- `PLAY MODES`
- `GRAND PRIX`
- `SINGLE RACE`
- `TIME TRIAL`
- `BATTLE MODE`
- `TEAM RACE`
- `ELIMINATION`
- `TOURNAMENTS`
- `RANKED`
- `CUSTOM GAME`

### Must contain
- mode cards
- short descriptor for each mode
- online/offline markers
- player-count hints
- rewards/recommended markers where appropriate

### Required button links
- `GRAND PRIX` -> setup -> `/lobby`
- `SINGLE RACE` -> setup -> `/lobby`
- `TIME TRIAL` -> setup -> `/lobby`
- `BATTLE MODE` -> setup -> `/lobby`
- `TEAM RACE` -> setup -> `/lobby`
- `ELIMINATION` -> setup -> `/lobby`
- `TOURNAMENTS` -> `/events`
- `RANKED` -> `/ranked`
- `CUSTOM GAME` -> setup -> `/lobby`

### Suggested controller/view
- `Page04PlayModesController`
- `Page04PlayModesView`
- components: `ModeCard`, `CardGrid`, `SearchFilterBar`

### Companion image
- `04-Play-Modes.png`

---

## 05 — Lobby / Pre-Race Room

### Purpose
Pre-race social and rules staging area.

### Required titled UI elements
- `RACE LOBBY`
- `PARTY MEMBERS`
- `TRACK VOTE`
- `RACE RULES`
- `PLAYER LOADOUT`
- `READY STATUS`
- `INVITE FRIENDS`
- `START MATCH`
- `COUNTDOWN`

### Must contain
- roster with ready state
- host marker
- track vote module
- countdown area
- rules summary
- loadout preview access
- invite flow access

### Required button links
- `INVITE FRIENDS` -> `/party`
- `PLAYER LOADOUT` -> `/garage`
- `TRACK VOTE` -> vote action / modal
- `READY STATUS` -> ready/unready action
- `START MATCH` -> gameplay start

### Suggested controller/view
- `Page05LobbyController`
- `Page05LobbyView`
- services: `LobbyService`, `PartyService`, `MatchConfigService`
- components: `PartyRoster`, `SectionPanel`, `ActionBar`

### Companion image
- `05-Lobby-Pre-Race-Room.png`

---

## 06 — Party / Friends

### Purpose
Social management and invite flow.

### Required titled UI elements
- `PARTY`
- `PARTY MEMBERS`
- `FRIENDS LIST`
- `RECENT PLAYERS`
- `INVITE`
- `JOINABLE SESSIONS`
- `PARTY PRIVACY`
- `VOICE STATUS`

### Must contain
- online/offline friend states
- party member roster
- recent players
- joinable sessions list
- privacy selector

### Required button links
- `INVITE` -> invite action
- `JOINABLE SESSIONS` -> join selected session -> `/lobby`
- `PARTY MEMBERS` -> member actions modal
- `PARTY PRIVACY` -> privacy dropdown/modal

### Suggested controller/view
- `Page06PartyController`
- `Page06PartyView`
- services: `PartyService`, `FriendsService`, `PresenceService`
- components: `FriendRow`, `PartyRoster`, `SearchFilterBar`

### Companion image
- `06-Party-Friends.png`

---

## 07 — Tournaments / Events

### Purpose
Live ops hub and special events browser.

### Required titled UI elements
- `TOURNAMENTS`
- `LIVE EVENTS`
- `DAILY EVENTS`
- `WEEKLY EVENTS`
- `SEASON TOUR`
- `REWARDS`
- `LEADERBOARD`
- `ENTER EVENT`
- `TIME REMAINING`

### Must contain
- event cards with timers
- rewards preview
- eligibility tags
- enter action
- leaderboard access

### Required button links
- `LIVE EVENTS` -> internal tab
- `DAILY EVENTS` -> internal tab
- `WEEKLY EVENTS` -> internal tab
- `SEASON TOUR` -> `/season`
- `REWARDS` -> reward modal/panel
- `LEADERBOARD` -> leaderboard modal/view
- `ENTER EVENT` -> event setup -> `/lobby`

### Suggested controller/view
- `Page07EventsController`
- `Page07EventsView`
- services: `EventsService`, `RewardsService`
- components: `EventCard`, `RewardCard`, `Tabs`

### Companion image
- `07-Tournament-Events.png`

---

## 08 — Ranked / Competitive

### Purpose
Competitive progression and queue hub.

### Required titled UI elements
- `RANKED`
- `CURRENT RANK`
- `SEASON PROGRESS`
- `QUEUE RANKED`
- `MATCH HISTORY`
- `TIER REWARDS`
- `LEADERBOARD`
- `RANK RULES`

### Must contain
- current rank visual
- rank progress
- season status
- queue CTA
- leaderboard entry
- match history preview

### Required button links
- `QUEUE RANKED` -> ranked setup -> `/lobby`
- `MATCH HISTORY` -> history modal/tab
- `TIER REWARDS` -> reward modal/panel
- `LEADERBOARD` -> leaderboard modal/view
- `RANK RULES` -> rules modal

### Suggested controller/view
- `Page08RankedController`
- `Page08RankedView`
- services: `RankedService`, `ProfileService`
- components: `StatsPanel`, `ProgressBar`, `RewardCard`

### Companion image
- `08-Ranked-Competitive.png`

---

## 09 — Garage

### Purpose
Customization hub.

### Required titled UI elements
- `GARAGE`
- `CHARACTERS`
- `KARTS`
- `PAINT`
- `WHEELS`
- `ACCESSORIES`
- `EMOTES`
- `LOADOUT`
- `KART STATS`
- `SAVE PRESET`

### Must contain
- large hero preview
- tabs/categories for customization
- current loadout summary
- stats panel
- equip/unequip actions
- preset save/load placeholders

### Required button links
- `CHARACTERS` -> `/characters`
- `KARTS` -> `/karts`
- `PAINT` -> paint tab/modal
- `WHEELS` -> wheel tab/modal
- `ACCESSORIES` -> accessory tab/modal
- `EMOTES` -> emote tab/modal
- `SAVE PRESET` -> preset save action/modal

### Suggested controller/view
- `Page09GarageController`
- `Page09GarageView`
- services: `GarageService`, `InventoryService`, `PresetService`
- components: `HeroPreviewPanel`, `Tabs`, `StatsPanel`, `ActionBar`

### Companion image
- `09-Garage.png`

---

## 10 — Character Select

### Purpose
Character selection and skin browsing.

### Required titled UI elements
- `CHARACTER SELECT`
- `SELECTED CHARACTER`
- `CHARACTER SKINS`
- `CHARACTER STATS`
- `SPECIAL ABILITY`
- `OWNED`
- `LOCKED`
- `SELECT`

### Must contain
- character grid/carousel
- large selected character preview
- owned/locked labels
- stat readout
- special ability panel

### Required button links
- `CHARACTER SKINS` -> skins tab
- `SELECT` -> equip character -> return caller page
- `OWNED` / `LOCKED` -> state only / inspect unlock source

### Suggested controller/view
- `Page10CharacterSelectController`
- `Page10CharacterSelectView`
- services: `CharacterRepository`, `GarageService`
- components: `CardGrid`, `HeroPreviewPanel`, `StatsPanel`

### Companion image
- `10-Character-Select.png`

---

## 11 — Kart Select

### Purpose
Kart selection and stats comparison.

### Required titled UI elements
- `KART SELECT`
- `SELECTED KART`
- `KART STATS`
- `SPEED`
- `ACCELERATION`
- `HANDLING`
- `TRACTION`
- `BOOST`
- `TEST DRIVE`
- `SELECT`

### Must contain
- kart grid/carousel
- hero kart preview
- stat bars
- selected/equipped state
- optional test drive hook

### Required button links
- `TEST DRIVE` -> gameplay preview state or modal placeholder
- `SELECT` -> equip kart -> return caller page

### Suggested controller/view
- `Page11KartSelectController`
- `Page11KartSelectView`
- services: `KartRepository`, `GarageService`
- components: `HeroPreviewPanel`, `StatsPanel`, `CardGrid`

### Companion image
- `11-Kart-Select.png`

---

## 12 — Player Profile / Career

### Purpose
Player identity, stats, and long-term progress.

### Required titled UI elements
- `PLAYER PROFILE`
- `CAREER LEVEL`
- `XP PROGRESS`
- `LIFETIME STATS`
- `ACHIEVEMENTS`
- `BADGES`
- `MATCH HISTORY`
- `FAVORITE LOADOUT`
- `EDIT PROFILE`

### Must contain
- profile identity block
- stats summary
- achievements panel
- match history summary
- favorite loadout preview

### Required button links
- `ACHIEVEMENTS` -> achievements tab
- `BADGES` -> badges tab
- `MATCH HISTORY` -> history tab/modal
- `EDIT PROFILE` -> profile edit modal
- `FAVORITE LOADOUT` -> `/garage`

### Suggested controller/view
- `Page12ProfileController`
- `Page12ProfileView`
- services: `ProfileService`, `StatsRepository`
- components: `StatsPanel`, `BadgeChip`, `HeroPreviewPanel`

### Companion image
- `12-Player-Profile.png`

---

## 13 — Challenges / Quests

### Purpose
Retention and progress tasks.

### Required titled UI elements
- `CHALLENGES`
- `DAILY`
- `WEEKLY`
- `SEASONAL`
- `MILESTONES`
- `PROGRESS`
- `REWARDS`
- `CLAIM`
- `RESET TIMER`

### Must contain
- tabbed challenge categories
- challenge rows
- progress bars
- claim buttons
- reset timers

### Required button links
- `DAILY` -> category tab
- `WEEKLY` -> category tab
- `SEASONAL` -> category tab
- `MILESTONES` -> category tab
- `CLAIM` -> reward claim action/modal
- `REWARDS` -> reward detail modal

### Suggested controller/view
- `Page13ChallengesController`
- `Page13ChallengesView`
- services: `ChallengesService`, `RewardsService`
- components: `ChallengeRow`, `Tabs`, `ProgressBar`

### Companion image
- `13-Challenges-Quests.png`

---

## 14 — Rewards / Season / Pass

### Purpose
Season-track progression and claims.

### Required titled UI elements
- `SEASON PASS`
- `SEASON PROGRESS`
- `FREE TRACK`
- `PREMIUM TRACK`
- `CLAIM REWARD`
- `CURRENT TIER`
- `SEASON MISSIONS`
- `TIME REMAINING`

### Must contain
- season banner/header
- reward timeline
- free vs premium track distinction
- current tier marker
- claimable states

### Required button links
- `FREE TRACK` -> free track tab/view
- `PREMIUM TRACK` -> premium track tab/view
- `CLAIM REWARD` -> reward claim action/modal
- `SEASON MISSIONS` -> `/challenges`

### Suggested controller/view
- `Page14SeasonController`
- `Page14SeasonView`
- services: `SeasonService`, `RewardsService`
- components: `RewardCard`, `ProgressBar`, `Tabs`

### Companion image
- `14-Rewards-Season-Pass.png`

---

## 15 — Shop / Store

### Purpose
Storefront and purchasable content browser.

### Required titled UI elements
- `SHOP`
- `FEATURED`
- `CHARACTERS`
- `KARTS`
- `COSMETICS`
- `BUNDLES`
- `CURRENCY`
- `ITEM PREVIEW`
- `PURCHASE`

### Must contain
- featured carousel/grid
- category tabs
- item cards
- item preview pane
- balance/currency strip
- confirmation modal placeholder

### Required button links
- `FEATURED` -> category tab
- `CHARACTERS` -> category tab
- `KARTS` -> category tab
- `COSMETICS` -> category tab
- `BUNDLES` -> category tab
- `CURRENCY` -> category tab
- `PURCHASE` -> purchase confirmation modal/action

### Suggested controller/view
- `Page15ShopController`
- `Page15ShopView`
- services: `ShopService`, `WalletService`, `InventoryService`
- components: `ShopItemCard`, `CurrencyStrip`, `ModalDialog`, `Tabs`

### Companion image
- `15-Shop-Store.png`

---

## 16 — Track Builder / Create Hub

### Purpose
Entry point into creation tools and user-generated content.

### Required titled UI elements
- `CREATE`
- `NEW TRACK`
- `MY TRACKS`
- `DRAFTS`
- `PUBLISHED TRACKS`
- `FEATURED TRACKS`
- `STARTER TEMPLATES`
- `EDIT TRACK`

### Must contain
- new track CTA
- draft list
- published track list
- featured tracks entry
- starter templates

### Required button links
- `NEW TRACK` -> `/editor`
- `MY TRACKS` -> internal library tab
- `DRAFTS` -> internal library tab
- `PUBLISHED TRACKS` -> internal library tab
- `FEATURED TRACKS` -> `/discover`
- `STARTER TEMPLATES` -> template picker modal
- `EDIT TRACK` -> `/editor`

### Suggested controller/view
- `Page16CreateHubController`
- `Page16CreateHubView`
- services: `TrackRepository`, `CreatorService`
- components: `TrackCard`, `CardGrid`, `SearchFilterBar`

### Companion image
- `16-Track-Builder-Create-Hub.png`

---

## 17 — Track Editor

### Purpose
Actual track creation tool screen.

### Required titled UI elements
- `TRACK EDITOR`
- `3D VIEWPORT`
- `ROAD PIECES`
- `TURNS`
- `RAMPS`
- `BRIDGES`
- `TUNNELS`
- `JUMPS`
- `PROPS`
- `UNDO`
- `REDO`
- `SAVE`
- `TEST DRIVE`
- `PUBLISH`
- `VALIDATION`
- `TRACK METADATA`

### Must contain
- large central editing viewport
- asset palette
- transform tools
- metadata pane
- validation panel
- undo/redo/save/test/publish actions

### Required button links
- `ROAD PIECES` -> category tab
- `TURNS` -> category tab
- `RAMPS` -> category tab
- `BRIDGES` -> category tab
- `TUNNELS` -> category tab
- `JUMPS` -> category tab
- `PROPS` -> category tab
- `UNDO` -> command stack undo
- `REDO` -> command stack redo
- `SAVE` -> save track action
- `TEST DRIVE` -> gameplay preview state
- `PUBLISH` -> publish modal/action
- `VALIDATION` -> validation panel focus

### Suggested controller/view
- `Page17TrackEditorController`
- `Page17TrackEditorView`
- services: `TrackEditorService`, `ValidationService`, `TrackRepository`
- commands: `PlacePieceCommand`, `RemovePieceCommand`, `RotatePieceCommand`, `DuplicatePieceCommand`
- components: `SectionPanel`, `ActionBar`, `Tabs`, `ModalDialog`

### Companion image
- `17-Track-Editor.png`

---

## 18 — Community Tracks / Discover

### Purpose
Browse and play user-generated tracks.

### Required titled UI elements
- `DISCOVER TRACKS`
- `FEATURED`
- `POPULAR`
- `NEWEST`
- `FRIENDS`
- `FAVORITES`
- `SEARCH`
- `TRACK PREVIEW`
- `CREATOR`
- `PLAY NOW`

### Must contain
- filter tabs
- search bar
- track cards
- preview region
- creator attribution
- play CTA

### Required button links
- `FEATURED` -> filter tab
- `POPULAR` -> filter tab
- `NEWEST` -> filter tab
- `FRIENDS` -> filter tab
- `FAVORITES` -> filter tab
- `SEARCH` -> search action
- `CREATOR` -> creator profile modal/future route
- `PLAY NOW` -> `/lobby` or race start flow

### Suggested controller/view
- `Page18DiscoverController`
- `Page18DiscoverView`
- services: `CommunityTracksService`, `SearchService`
- components: `TrackCard`, `SearchFilterBar`, `CardGrid`

### Companion image
- `18-Community-Tracks-Discover.png`

---

## 19 — Results / Post-Race

### Purpose
Post-race payoff and progression summary.

### Required titled UI elements
- `RACE RESULTS`
- `FINAL POSITION`
- `PODIUM`
- `RACE STATS`
- `XP GAIN`
- `REWARDS EARNED`
- `CHALLENGE PROGRESS`
- `REMATCH`
- `NEXT RACE`
- `RETURN TO LOBBY`

### Must contain
- placement summary
- stat summary
- earned rewards
- challenge progress updates
- next actions

### Required button links
- `REMATCH` -> `/lobby`
- `NEXT RACE` -> `/lobby`
- `RETURN TO LOBBY` -> `/lobby`
- `REWARDS EARNED` -> reward modal
- `CHALLENGE PROGRESS` -> `/challenges`

### Suggested controller/view
- `Page19ResultsController`
- `Page19ResultsView`
- services: `ResultsService`, `RewardsService`, `ChallengesService`
- components: `RewardCard`, `StatsPanel`, `ActionBar`

### Companion image
- `19-Results-Post-Race.png`

---

## 20 — Notifications / Inbox

### Purpose
Message center for system notices and claims.

### Required titled UI elements
- `INBOX`
- `MESSAGES`
- `REWARDS`
- `EVENT NOTICES`
- `SYSTEM`
- `UNREAD`
- `CLAIM`
- `CLAIM ALL`

### Must contain
- category tabs
- message/reward rows
- unread states
- claimable rows

### Required button links
- `MESSAGES` -> category tab
- `REWARDS` -> category tab
- `EVENT NOTICES` -> category tab
- `SYSTEM` -> category tab
- `CLAIM` -> claim action
- `CLAIM ALL` -> batch claim action/modal

### Suggested controller/view
- `Page20InboxController`
- `Page20InboxView`
- services: `InboxService`, `RewardsService`
- components: `Tabs`, `SectionPanel`, `ActionBar`

### Companion image
- `20-Notifications-Inbox.png`

---

## 21 — Settings

### Purpose
Configuration center.

### Required titled UI elements
- `SETTINGS`
- `GAMEPLAY`
- `CONTROLS`
- `AUDIO`
- `VIDEO`
- `ACCESSIBILITY`
- `ACCOUNT`
- `PRIVACY`
- `CREDITS`
- `APPLY`
- `RESET`

### Must contain
- settings tabs
- controls/sliders/toggles placeholders
- apply/reset actions
- section grouping

### Required button links
- `GAMEPLAY` -> tab
- `CONTROLS` -> tab
- `AUDIO` -> tab
- `VIDEO` -> tab
- `ACCESSIBILITY` -> tab
- `ACCOUNT` -> tab
- `PRIVACY` -> tab
- `CREDITS` -> tab
- `APPLY` -> save settings action
- `RESET` -> reset confirmation modal

### Suggested controller/view
- `Page21SettingsController`
- `Page21SettingsView`
- services: `SettingsService`
- components: `Tabs`, `SectionPanel`, `ActionBar`, `ConfirmationDialog`

### Companion image
- `21-Settings.png`

---

## 22 — Pause Menu

### Purpose
In-race interruption overlay.

### Required titled UI elements
- `PAUSED`
- `RESUME`
- `RESTART`
- `SETTINGS`
- `CONTROLS`
- `LEAVE RACE`
- `RACE STATUS`

### Must contain
- darkened gameplay backdrop
- dominant resume action
- restart and leave confirmations
- race status summary

### Required button links
- `RESUME` -> resume gameplay
- `RESTART` -> restart confirmation -> gameplay reset
- `SETTINGS` -> `/settings`
- `CONTROLS` -> `/settings#controls`
- `LEAVE RACE` -> confirmation -> `/home`

### Suggested controller/view
- `Page22PauseController`
- `Page22PauseView`
- services: `PauseMenuService`, `ModalService`
- components: `ModalDialog`, `ActionBar`

### Companion image
- `22-Pause-Menu.png`

---

## 23 — Onboarding / Tutorial

### Purpose
Teach core mechanics and first-run progression.

### Required titled UI elements
- `TUTORIAL`
- `BASIC CONTROLS`
- `DRIFT`
- `BOOST`
- `ITEM USE`
- `PRACTICE`
- `SKIP`
- `STEP PROGRESS`

### Must contain
- multi-step tutorial panels
- progress indicator
- skip action
- practice CTA
- content zones for mechanic callouts

### Required button links
- `BASIC CONTROLS` -> step/tab
- `DRIFT` -> step/tab
- `BOOST` -> step/tab
- `ITEM USE` -> step/tab
- `PRACTICE` -> `/quick-play`
- `SKIP` -> `/home`

### Suggested controller/view
- `Page23TutorialController`
- `Page23TutorialView`
- services: `TutorialService`
- components: `Tabs`, `ProgressBar`, `ActionBar`

### Companion image
- `23-Onboarding-Tutorial.png`

---

# 7. Cross-cutting systems required for a complete racing game menu shell

## Global navigation and back-stack behavior
Implement:

- deterministic navigation history
- caller-return context
- route guards for first-run/tutorial flow
- global back action that respects modals before page changes

## Modal and confirmation system
Provide standard patterns for:

- leave confirmation
- restart confirmation
- purchase confirmation
- reset confirmation
- unsaved editor warnings
- claim reward confirmation/success

## Loading, empty, offline, and locked states
Every page must include placeholder views for:

- no content
- loading data
- unavailable network
- gated/locked content
- permissions errors where relevant

## Profile and inventory services
Centralize:

- profile
- currency
- owned items
- presets
- achievements
- challenges
- rewards
- progression

## Session and multiplayer services
Centralize:

- matchmaking state
- lobby state
- party state
- ready flags
- track votes
- network presence

## Editor command stack
Track Editor must use command objects for:

- place
- remove
- rotate
- duplicate

So `undo/redo` remain reliable and testable.

## Telemetry hooks
Stub analytics interfaces at page/controller level so interactions can be instrumented later without page rewrites.

## Accessibility
Plan for:

- focus order
- large hit targets
- subtitle/support settings
- colorblind placeholders
- UI scale support
- readable contrast

## QA instrumentation
Expose:

- page IDs
- route IDs
- button IDs
- modal IDs
- event IDs

So QA can assert every scaffolded page and interaction is wired correctly.

---

# 8. Suggested class and service inventory

## Core services
- `RouterService`
- `NavigationService`
- `ModalService`
- `NotificationService`
- `AnalyticsService`
- `SettingsService`
- `ProfileService`
- `GarageService`
- `InventoryService`
- `RewardsService`
- `ChallengesService`
- `SeasonService`
- `ShopService`
- `PartyService`
- `FriendsService`
- `PresenceService`
- `LobbyService`
- `MatchmakingService`
- `EventsService`
- `RankedService`
- `TrackRepository`
- `TrackEditorService`
- `ValidationService`
- `CommunityTracksService`
- `TutorialService`
- `InboxService`

## Repositories / data providers
- `CharacterRepository`
- `KartRepository`
- `ModeRepository`
- `MockProfileRepository`
- `MockSeasonRepository`
- `MockStoreRepository`
- `MockTrackRepository`

## Command objects
- `NavigateCommand`
- `ClaimRewardCommand`
- `PurchaseItemCommand`
- `SavePresetCommand`
- `PlacePieceCommand`
- `RemovePieceCommand`
- `RotatePieceCommand`
- `DuplicatePieceCommand`
- `PublishTrackCommand`

## Enums / constants
- `RouteIds`
- `PageIds`
- `ButtonIds`
- `ModalIds`
- `EventIds`
- `SettingTabs`
- `ChallengeTabs`
- `ShopTabs`
- `CreateTabs`

---

# 9. Coding standards and best practices for Codex

- Use typed models/interfaces for every page payload and shared data object.
- Do not rely on unstructured literals spread across pages.
- Keep all route names, page IDs, event IDs, and button IDs in centralized enums/constants.
- Avoid string duplication in page scripts.
- Use explicit controller methods for button handling.
- Do not inline route pushes directly inside random UI component callbacks when a page command object can own that behavior.
- Dispose listeners, subscriptions, timers, and animation hooks on page unmount.
- Every page must clean up after itself.
- Keep mock data in isolated repositories/services so real API integration can replace the backend layer later without rewriting views.
- Prefer composition: build cards, panels, rows, strips, and action bars as reusable objects with configuration props, not one-off page-specific duplicates.
- Implement loading, empty, locked, and error states as first-class UI states, not afterthoughts.
- Use consistent naming such as `PageXXController`, `PageXXView`, `RouteIds`, `ButtonIds`, `EventIds`, `MockRepositories`.
- Keep file structure predictable and production-friendly.

---

# 10. Recommended delivery milestones

## Milestone 1 — Core shell
- `AppShell`
- `RouterService`
- top nav
- page header
- buttons
- cards
- modal system
- toast system
- mock repositories

## Milestone 2 — Race flow
Pages:
- 01
- 02
- 03
- 04
- 05
- 19
- 22

with working navigation and mocked state transitions.

## Milestone 3 — Social and progression
Pages:
- 06
- 07
- 08
- 12
- 13
- 14
- 15
- 20

with profile/challenge/season/store placeholders.

## Milestone 4 — Customization
Pages:
- 09
- 10
- 11

with shared hero preview and equip state logic.

## Milestone 5 — Creation and UGC
Pages:
- 16
- 17
- 18

plus editor shell, command stack, and validation UI.

## Milestone 6 — Support systems
Pages:
- 21
- 23

plus accessibility placeholders, settings schemas, tutorial flow.

## Milestone 7 — QA pass
- button-link audit
- route audit
- empty/loading/locked states
- keyboard/controller traversal
- analytics hook audit

---

# 11. Definition of done

The scaffold is done when:

- All 23 pages exist, render cleanly, and are reachable via the intended route tree.
- Every required titled UI element for each page is scaffolded and visible in the layout.
- Every primary button is linked to a named route or explicit controller command.
- Shared components are reused consistently rather than recreated ad hoc per page.
- Pages support loading, empty, locked, and disabled states where relevant.
- OOP class structure is modular, typed, and disposable.
- Mock repositories can be replaced later by live integrations.
- The interface feels like a premium AAA-style racing game shell with coherent hierarchy and clear next-step actions.

---

# Appendix A — Companion image file mapping

These filenames should be stored alongside the PRD and used by Codex/design as the visual companion reference set for each page scaffold.

```txt
01-Title-Screen-Start-Screen.png
02-Home-Main-Menu.png
03-Quick-Play.png
04-Play-Modes.png
05-Lobby-Pre-Race-Room.png
06-Party-Friends.png
07-Tournament-Events.png
08-Ranked-Competitive.png
09-Garage.png
10-Character-Select.png
11-Kart-Select.png
12-Player-Profile.png
13-Challenges-Quests.png
14-Rewards-Season-Pass.png
15-Shop-Store.png
16-Track-Builder-Create-Hub.png
17-Track-Editor.png
18-Community-Tracks-Discover.png
19-Results-Post-Race.png
20-Notifications-Inbox.png
21-Settings.png
22-Pause-Menu.png
23-Onboarding-Tutorial.png
```

---

# Appendix B — Recommended folder / code structure

```txt
src/
  app/
    AppShell.ts
    RouteIds.ts
    PageIds.ts
    ButtonIds.ts
  services/
    RouterService.ts
    NavigationService.ts
    ModalService.ts
    NotificationService.ts
    AnalyticsService.ts
    SettingsService.ts
    ProfileService.ts
    GarageService.ts
    InventoryService.ts
    RewardsService.ts
    ChallengesService.ts
    SeasonService.ts
    ShopService.ts
    PartyService.ts
    FriendsService.ts
    PresenceService.ts
    LobbyService.ts
    MatchmakingService.ts
    EventsService.ts
    RankedService.ts
    TrackEditorService.ts
    ValidationService.ts
    CommunityTracksService.ts
    TutorialService.ts
    InboxService.ts
  repositories/
    CharacterRepository.ts
    KartRepository.ts
    ModeRepository.ts
    TrackRepository.ts
    mocks/
  components/
    navigation/
    panels/
    cards/
    lists/
    modals/
    action-bars/
    tabs/
    feedback/
  pages/
    page01-title/
    page02-home/
    page03-quick-play/
    page04-play-modes/
    page05-lobby/
    page06-party/
    page07-events/
    page08-ranked/
    page09-garage/
    page10-characters/
    page11-karts/
    page12-profile/
    page13-challenges/
    page14-season/
    page15-shop/
    page16-create/
    page17-editor/
    page18-discover/
    page19-results/
    page20-inbox/
    page21-settings/
    page22-pause/
    page23-tutorial/
  commands/
    NavigateCommand.ts
    ClaimRewardCommand.ts
    PurchaseItemCommand.ts
    SavePresetCommand.ts
    PlacePieceCommand.ts
    RemovePieceCommand.ts
    RotatePieceCommand.ts
    DuplicatePieceCommand.ts
    PublishTrackCommand.ts
  models/
  types/
  assets/
    ui-references/
      01-Title-Screen-Start-Screen.png
      ...
      23-Onboarding-Tutorial.png
```

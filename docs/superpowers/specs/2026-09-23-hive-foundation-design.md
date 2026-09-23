# Hive Foundation — Sub-project 1 Design (Foundation + Playable Loop)

- **Date:** 2026-09-23
- **Status:** Approved in design review, pending spec review
- **Scope:** Sub-project 1 of 4 (roadmap milestones M0–M4)

---

## 1. Context and intent

### Reference

A viral post showed a "complete beekeeping game from one prompt" built by Claude Opus 5.5 with no image files. From the screenshot we identified:

- A 3D low-poly world on a hex grid (grass, water, soil) with soft shadows, trees, rocks, a house, hive boxes, flower beds and a small beekeeper.
- Bright owned tiles vs. desaturated locked tiles, which suggests land expansion.
- A HUD with coins, honey (kg), season + day/year, a day progress bar and speed controls (pause, 1x, 2x, 4x).
- A bottom bar with Shop, Market, Harvest All (primary), Orders (with a notification badge) and Guide.
- Top-right buttons for language (TR/EN), camera, zoom, sound and settings.

Core loop: plant flowers → bees forage → hives fill → harvest → sell or fill orders → coins → more hives, seeds and land.

### What we are building

This is the **base for the user's own game**, not a faithful clone. It will diverge from the reference.

- Bees and honey are the **first production chain**. More chains (e.g. orchard → jam) come later, so the simulation is written in generic terms: resources, producers, sources and prices, defined in data packs.
- Stack: **Vite + TypeScript + vanilla Three.js + DOM UI**. No image files: meshes are procedural, icons are inline SVG.
- Target: desktop web browsers first. Touch works but is not tuned until sub-project 4.

### Success criteria for sub-project 1

1. `npm run check` (typecheck, lint, unit tests) and the Playwright smoke test pass.
2. The user signs off on the static scene at the art gate (§6.6).
3. In a manual playtest at 1x, a second hive is affordable after roughly 5 minutes of play.
4. The game holds 60 fps on an integrated-GPU laptop at map radius 12.
5. Reloading the page restores the game from the autosave.

---

## 2. Roadmap and scope

| Sub-project | Milestones | Contents |
|---|---|---|
| **1. Foundation + playable loop** (this spec) | M0–M4 | Hex engine, procedural art kit, sim core, HUD, build / harvest / sell / buy, autosave |
| 2. Life and juice | M5 | Bees flying between hive and beds, beekeeper walks to harvest (hex A*), floating numbers, synthesized audio |
| 3. Meta systems | M6 | Orders, land expansion, seasons that affect blooming, honey types by dominant flower, Guide/tutorial |
| 4. Ship | M7 | TR/EN, settings, mobile touch pass, performance pass, static deploy |

Each sub-project gets its own spec → plan → implementation cycle.

### Milestones inside sub-project 1

| Milestone | Scope | Exit criteria |
|---|---|---|
| M0 Skeleton | Vite + TS + Three, fixed-step loop, FPS overlay, `npm run check` wired | A lit hex prism renders; check passes |
| M1 World | `core/hex`, seeded worldgen, instanced tiles, lights and shadows, camera rig, hover highlight | Terrain resembles the reference; pan/zoom/rotate smooth at 60 fps |
| M2 Art kit | Palette and all prop factories, art registry, state → scene sync for a fixed starting state | Static scene side by side with the reference; **art gate sign-off** |
| M3 Sim core | Content types and bee pack, state, commands, systems, clock, save, tests including the balance bot | Headless 30-day run produces the expected honey curve; all sim tests pass |
| M4 Playable loop | HUD, toolbar, Shop, Market, build mode, inspect popover, toasts, autosave wiring, Playwright smoke test | All success criteria in §1 met |

M3 depends only on M0 and can be built in parallel with M1–M2.

### Explicitly out of scope for sub-project 1

Flying bees, beekeeper movement, floating numbers, audio, orders, buying land, seasonal effects, honey types beyond wildflower, the Guide, the Turkish translation, a language toggle, offline progress, mobile tuning, deployment.

---

## 3. Decisions log

| Decision | Choice | Why |
|---|---|---|
| Goal | Base for own game | User intends to diverge from the reference |
| Content direction | Bees first, more chains later | Sim must be generic; bee content is a data pack |
| Stack | Vite + TS + vanilla Three.js + DOM UI | Maintainable modules; can still be bundled to one HTML file later |
| Architecture | Plain serializable state + systems (not ECS, not OOP entities) | Free save/load, headless tests, easy debugging; entity counts are small |
| Time model | Session-only; pause/1x/2x/4x | Simplest and deterministic; `advance(state, dt)` stays pure so offline catch-up can be added later |
| Placement rule | Beds' nectar is shared equally among hives in range | Makes layout a real decision while staying readable |
| Flower types | In the data model now; one "wildflower" honey in sub-project 1 | Honey types arrive with Orders in sub-project 3 |
| Hive range | 1 (the six neighbors) | Matches the reference; value lives in data |
| UI tech | Vanilla TS + a small `h()` helper | Five panels do not justify a framework; Preact can be added to `ui/` later |
| i18n | All strings through `t(key)`; EN only | Adding TR later is a new strings file |
| Save | Autosave to localStorage in sub-project 1 | Nearly free with JSON state; avoids replaying from zero while testing |
| Dead ends | Last producer cannot be removed; safety-net grant | Guarantees the player can always get production going again |

---

## 4. Architecture

### 4.1 Module layout

```
src/
  core/                 pure TS, no dependencies
    hex.ts              axial coords, neighbors, ring, range, distance, key(), pixel↔hex
    rng.ts              seeded PRNG (mulberry32)
    events.ts           typed event bus
  content/              data only, no logic beyond validation
    types.ts            ResourceDef, TileDef, BuildableDef, ProducerDef, SourceDef, PriceDef
    registry.ts         registerPack(), lookups by id, validation
    packs/bees.ts       honey, hive, wildflower bed, house, prices, costs, starting setup
  sim/                  headless; never imports three or the DOM
    state.ts            GameState type, createInitialState(seed)
    worldgen.ts         seeded map generation
    commands.ts         dispatch(state, cmd) → result; all validation lives here
    systems/clock.ts    tick → day, season, year
    systems/production.ts   nectar sharing → producer fill
    systems/economy.ts  sell, costs, refunds, safety net
    advance.ts          advance(state, ticks): runs systems in a fixed order
  render/               three.js
    scene.ts camera.ts lights.ts
    tiles.ts            instanced hex meshes and grass tufts
    art/                palette.ts, registry.ts, one factory per prop
    sync.ts             state → scene reconciliation
    picking.ts          screen point → hex
    badges.ts           hive fill labels (CSS2DRenderer)
  ui/                   DOM
    hud.ts toolbar.ts toasts.ts icons.ts
    panels/shop.ts panels/market.ts
    inspect.ts          entity popover
    i18n.ts strings/en.ts
  game/
    loop.ts             fixed-step sim + requestAnimationFrame render
    controller.ts       input → commands; build-mode state machine
    save.ts             autosave, load, migrations
  main.ts
tests/                  vitest, mirrors core/ content/ sim/ game/save
e2e/                    Playwright smoke test
```

### 4.2 Dependency rules

```
core ← content ← sim ← game → render, ui
```

- `sim` never imports `three` or touches the DOM.
- `render` and `ui` never mutate state. They call `controller`, which calls `dispatch(cmd)`.
- Enforced with ESLint `no-restricted-imports`, which runs in `npm run check`.

### 4.3 Game loop

- The sim runs on a **fixed tick**: 1 tick = 0.1 s of real time at 1x = 1/600 of an in-game day.
- Speed changes how many ticks run per real second (0, 10, 20 or 40). Every tick is identical, which keeps runs deterministic.
- Commands are applied between ticks and can be logged with their tick number to replay a game.
- Rendering runs on `requestAnimationFrame`, independent of the tick rate.
- Real time per frame is capped at 250 ms. When the tab is hidden, time effectively stops, as the session-only model requires.

### 4.4 Dependencies

`three`, `@fontsource/nunito`; dev: `vite`, `typescript`, `vitest`, `eslint` + `typescript-eslint`, `@playwright/test`. Node 22+.

---

## 5. Simulation model

### 5.1 Content types

```ts
type ResourceId = string;   // 'coins', 'honey_wildflower'
type TileId = 'grass' | 'water' | 'soil';

interface ResourceDef  { id: ResourceId; unit: 'coin' | 'kg' }
interface TileDef      { id: TileId; buildable: boolean }

interface SourceDef {
  kind: 'nectar';
  flowerType: string;        // 'wildflower'
  yieldPerDay: number;       // nectar units per in-game day
}

interface ProducerDef {
  consumes: 'nectar';
  range: number;             // hex distance
  output: ResourceId;        // 'honey_wildflower' in sub-project 1
  conversion: number;        // kg of output per nectar unit
  capacity: number;          // kg stored before production stalls
  maxIntakePerDay: number;   // nectar units per day
}

interface BuildableDef {
  id: string;                // 'hive', 'bed_wildflower', 'house'
  cost: Partial<Record<ResourceId, number>>;
  allowedTiles: TileId[];
  setsTile?: TileId;         // a bed turns its tile into soil; the previous tile is restored on removal
  purchasable: boolean;      // false for the house
  removable: boolean;        // false for the house
  producer?: ProducerDef;
  source?: SourceDef;
}

interface PriceDef { resource: ResourceId; sell: number }  // coins per unit
```

`registry.ts` validates every pack at startup and in tests: every referenced id exists, no duplicate ids, all numbers are positive.

### 5.2 State

```ts
interface GameState {
  version: 1;
  seed: number;
  nextId: number;
  clock: { tick: number; speed: 0 | 1 | 2 | 4 };
  tiles: Record<HexKey, { tile: TileId; owned: boolean; entityId?: string; decor?: 'tree' | 'rock' }>;
  entities: Record<string, { id: string; def: string; hex: Hex; store?: number; prevTile?: TileId }>;
  inventory: Record<ResourceId, number>;
  flags: { fullNotified: Record<string, boolean> };
}
```

- Hexes use **axial coordinates (q, r)** with **pointy-top** orientation; `HexKey` is `"q,r"`.
- Day, season and year are derived from `clock.tick` rather than stored.
- The range map (which producers each source feeds) is a **derived cache**. It is rebuilt when an entity is placed or removed and is never saved.
- Quantities are floats. The UI rounds for display: coins down to whole numbers, kg to one decimal.

### 5.3 World generation

- Seeded by `state.seed`. The map is a hex disc of radius 12 (469 tiles).
- The starting plot is the radius-3 disc around the origin. It is `owned` and contains no water or decor.
- Outside the plot: noise-based water lakes plus scattered trees and rocks. Tiles with decor cannot be built on.
- Starting setup (from the bee pack): hive at the origin, 3 wildflower beds on three of its neighbors, and the house on another neighbor.

### 5.4 Production (runs every tick, `dt` in days)

```
for each source s:
    n_s   = number of producers p with distance(s, p) ≤ p.range
    share = s.yieldPerDay / n_s                       (skipped if n_s = 0)

for each producer p:
    intake  = min(Σ shares received, p.maxIntakePerDay)   excess is wasted
    p.store = min(p.capacity, p.store + intake × p.conversion × dt)
    if p.store reaches capacity and not fullNotified[p]: emit producerFull, set flag
```

- The flag resets when the store drops below capacity (after a harvest).
- Rates only change on placement or removal, so between those events a producer's store follows `min(capacity, store₀ + rate·t)`. That is what makes future offline catch-up trivial.

### 5.5 Clock

- 1 in-game day = 600 ticks (60 s at 1x).
- Season = `floor((day − 1) / 28) mod 4` → spring, summer, autumn, winter. Year = `floor((day − 1) / 112) + 1`.
- Seasons are labels only in sub-project 1. `dayStarted` is emitted at each day boundary.

### 5.6 Commands

| Command | Effect | Possible rejections |
|---|---|---|
| `place(defId, hex)` | Deducts cost, creates the entity, applies `setsTile` | `unknown_def`, `not_purchasable`, `out_of_bounds`, `not_owned`, `tile_not_buildable`, `tile_occupied`, `insufficient_funds` |
| `remove(entityId)` | Refunds `floor(50% of cost)`, removes the entity, restores the tile | `unknown_entity`, `not_removable`, `last_producer` |
| `harvest(entityId)` | Moves the producer's store into inventory | `unknown_entity`, `nothing_to_harvest` |
| `harvestAll()` | Harvests every producer with store > 0 | `nothing_to_harvest` |
| `sell(resource, amount \| 'all')` | Converts to coins at the listed price | `invalid_amount`, `insufficient_resource`, `not_sellable` |
| `setSpeed(0 \| 1 \| 2 \| 4)` | Changes speed | — |

- `dispatch` returns `{ ok: true, events }` or `{ ok: false, reason }` and never throws for player errors.
- **A rejected command leaves the state unchanged.**
- `last_producer`: the player's only remaining producer cannot be removed.

### 5.7 Events

`entityPlaced`, `entityRemoved`, `producerFull`, `harvested { id?, amount }`, `sold { resource, amount, coins }`, `dayStarted { day, season, year }`, `safetyNetGranted { coins }`.

Continuously changing values, such as fill level, are not events. Render and UI read them from state.

### 5.8 Safety net

At each `dayStarted`, check for a dead end:
- total production rate is 0,
- no honey is stored or in inventory, and
- coins are below the cheapest purchasable source.

If all three hold, grant coins up to that cost and emit `safetyNetGranted`. The UI shows a toast.

### 5.9 Starting balance (in `packs/bees.ts`; tuned with the balance bot)

| Item | Value |
|---|---|
| Starting coins | 60 |
| Starting entities | house (decoration), 1 hive, 3 wildflower beds |
| Allowed tiles | hive and bed: grass only |
| Hive | cost 120, range 1, max intake 4 nectar/day, 0.25 kg per nectar, capacity 5 kg, refund 60 |
| Wildflower bed | cost 20, 1 nectar/day, sets tile to soil, refund 10 |
| Honey (wildflower) | sells for 15 coins/kg |

Expected pace: buy a 4th bed at once (40 coins left, 1 kg/day = 15 coins/day), then afford a second hive after about 5–6 in-game days (≈5–6 min at 1x).

These values replace the draft in design review (150 starting coins, hive at 150). The draft let the player buy a second hive right away, which contradicted the pacing target.

---

## 6. Rendering and art kit

### 6.1 Scene

- `WebGLRenderer`: antialiasing, sRGB output, ACES filmic tone mapping.
- One `DirectionalLight` casting shadows (PCF soft, 2048 map, frustum fitted to the visible area) plus a `HemisphereLight` for soft fill.
- A CSS gradient behind a transparent canvas, and light fog so the map edges fade.
- No image files. Materials use flat colors. If a texture is ever needed, it is a `CanvasTexture` generated in code.

### 6.2 Camera rig (custom, not OrbitControls)

- Perspective camera, ~38° FOV, fixed ~50° tilt, looking at a target point on the ground.
- Drag to pan (clamped to map bounds), wheel or pinch to zoom (clamped), Q/E rotate in 60° steps with a smooth tween.
- `focus(hex)` tween for later use (walk-to-harvest, tutorial).

### 6.3 Tiles

- Pointy-top hex prisms, scaled to 0.95 over a darker ground plane so seams show through.
- One `InstancedMesh` per tile type, with small per-instance color variation. Owned tiles are bright green; unowned tiles are desaturated. Water sits slightly lower.
- Grass tufts: one `InstancedMesh` of tiny cones scattered from the seed.

### 6.4 Art kit (`render/art/`)

Each factory returns a `THREE.Group` built from primitives with flat shading and `MeshLambertMaterial`, using one shared material per palette color. Static parts are merged per prop with `mergeGeometries` and vertex colors. Repeated props (trees, flowers) are instanced.

| Prop | Construction |
|---|---|
| `palette.ts` | Named colors: grass, grassLocked, soil, water, terracotta, wood, hiveCream, leaf ×3, trunk, suitWhite, flower colors by flower type |
| Tree | Round (icosahedron canopy clusters) and pine (stacked cones), seeded size and rotation |
| Rock | Squashed dodecahedron with jittered vertices |
| House | Box body, triangular-prism terracotta roof, chimney, door, window boxes |
| Hive | 2–3 stacked boxes in slightly different shades, lid, entrance slot, stand |
| Flower bed | Soil tile plus N instanced flowers (stem, ring of petals, center) in the flower type's color |
| Beekeeper | White capsule body, head, wide-brim hat, see-through veil; idle bob only |

`render/art/registry.ts` maps a content def id to a factory. Content stays render-agnostic, so a new chain is a data pack plus an art module.

### 6.5 Sync, badges, picking

- **Sync:** `sync.ts` keeps an entityId → `Object3D` map. `entityPlaced` / `entityRemoved` create or dispose objects, and tile colors update when a tile's type changes.
- **Badges:** each hive has a fill bar and percentage through `CSS2DRenderer`. Text is crisp and shares the UI's CSS. The badge turns gold and pulses when full.
- **Picking:** raycast against the ground plane at y = 0, then `pixelToHex()`. No per-mesh raycasts. The hovered hex shows an outline and translucent fill.
- **Budget:** under 100 draw calls; 60 fps on an integrated-GPU laptop.

### 6.6 Art gate

At the end of M2, a side-by-side screenshot of the static starting scene next to the reference goes to the user for sign-off on palette and lighting. UI work (M4) starts only after that sign-off.

---

## 7. UI and input

### 7.1 HUD

Buttons for features that are not built yet stay hidden. There are no dead buttons.

| Position | Contents |
|---|---|
| Top left | Pills for coins and honey (kg) |
| Top center | Season, "Day N · Year Y", day progress bar, pause / 1x / 2x / 4x with the active one highlighted |
| Top right | Reset camera view; settings (reset save) |
| Bottom | Hex buttons: Shop, Market, Harvest All. Harvest All is the large primary button, shows total kg ready and is disabled at 0 |

### 7.2 Panels

One panel is open at a time; Esc closes it.

- **Shop:** lists purchasable buildables from the registry with an SVG icon, name and cost. Unaffordable items are grayed out. Choosing one enters build mode and closes the panel.
- **Market:** honey on hand and price per kg, –/+ amount buttons and **Sell all**, with a live preview of coins received.

### 7.3 Build mode

State machine in `controller.ts`: `idle → placing(defId) → idle`.

- A translucent ghost of the prop follows the hovered hex.
- Valid placement: green with ✓. Invalid: red with ✕ and the reason (e.g. "Not enough coins"), so validity is never shown by color alone.
- Producers also show their range ring and highlight the sources they would share.
- A click places. The mode stays active while the player can afford another; right-click or Esc exits.

### 7.4 Inspect popover

Clicking an entity while idle opens a small popover:

- **Hive:** fill (`3.2 / 5 kg`), rate (`0.75 kg/day`), sources in range with "shared ×N" where split, and Harvest / Remove (+60) buttons.
- **Bed:** yield (`1 nectar/day`), "shared by N hives", Remove (+10).
- **House:** name only.

Remove needs two clicks: the button changes to "Confirm" for 2 seconds.

### 7.5 Feedback

- Rejected command → toast with the translated reason.
- Harvest → toast "+3.2 kg". Sell → "+48 coins".
- Producer full → gold pulsing badge plus one toast (throttled).
- Safety net → toast explaining the grant.

### 7.6 Input map

| Input | Action |
|---|---|
| Left-drag (> 5 px) | Pan |
| Left-click / tap | Select or place |
| Wheel / pinch | Zoom |
| Q / E | Rotate 60° |
| Right-click / Esc | Cancel build mode or close panel |
| Space | Toggle pause |
| 1 / 2 / 3 | Speed 1x / 2x / 4x |
| H | Harvest all |

Touch: one finger pans, pinch zooms, tap clicks. Not tuned until sub-project 4.

### 7.7 Look

- CSS custom properties: cream panels, warm brown text, honey accent, 14 px corner radius, soft shadows.
- Hex buttons use `clip-path`. Font: Nunito via `@fontsource/nunito`, bundled locally. Icons: inline SVG in `icons.ts`.
- Real `<button>` elements with aria-labels and visible focus rings.

### 7.8 Update strategy

The UI subscribes to state and updates only text nodes whose values changed, at most once per sim tick. No full re-renders.

---

## 8. Testing

### 8.1 Unit tests (vitest, headless)

| Area | Tests |
|---|---|
| `core/hex` | Neighbors, distance, `range(r)` has `3r(r+1)+1` hexes, pixel↔hex round trip over a grid of sample points |
| `content/registry` | All referenced ids exist, no duplicates, positive numbers; the bee pack passes |
| `sim/commands` | Every rejection reason; place deducts cost; remove refunds 50% and restores the tile; harvest and sell math; **a rejected command leaves the state deep-equal to before** |
| `sim/production` | One bed and two hives gives 0.5 each; intake cap; stall at capacity with exactly one `producerFull`; flag resets after harvest; tick-size independence (`advance` of one day in 600 ticks vs. analytic `min(cap, s₀ + rate·t)` within ε) |
| `sim/clock` | Day, season and year boundaries; `dayStarted` fires once per day |
| Determinism | Same seed and same command log produce the same state hash |
| Balance bot | Greedy scripted player (harvest when full, sell, fill hive range with beds, buy a hive when affordable) affords a second hive within 6 in-game days |
| Dead-end fuzz | Seeded random command sequences over 30 days; after each `dayStarted` the game is recoverable (production > 0, or honey > 0, or coins ≥ cheapest source) |
| Save | Serialize → load round trip is deep-equal; a checked-in v1 fixture loads |

### 8.2 Render and UI

- **Playwright smoke test:** the page loads with no console errors, the canvas is not blank, and Shop → place bed lowers coins, checked through `window.__game`.
- **Art gate:** manual comparison with the reference (§6.6).

### 8.3 Commands and dev tools

- `npm run check` = `tsc --noEmit` + ESLint (including import boundaries) + vitest. `npm run e2e` runs Playwright.
- Dev builds only: `window.__game` (state, `dispatch`, `advance`), FPS overlay, `?seed=<n>`, `?speed=<n>` for fast testing.

---

## 9. Error handling

| Failure | Response |
|---|---|
| Player error (no funds, occupied tile, …) | Typed rejection, never thrown → toast |
| Sim invariant broken (a bug) | Throws in dev; logs and continues in production |
| Invalid content registry | Throws at startup in dev; tests keep it out of production |
| Save corrupt or unknown version | Raw data copied to `save_backup_<timestamp>`, fresh game, toast "Couldn't load save" |
| localStorage unavailable or full | Autosave disabled, one notice: "Progress won't be saved" |
| No WebGL | Friendly message screen instead of a blank page |
| WebGL context lost | Sim pauses, "Graphics reset…" overlay, resumes on restore, reload button as fallback |
| Tab hidden | Frame time capped at 250 ms, so time stops rather than jumping forward on return |

Autosave runs every 10 seconds and on `visibilitychange` (hidden) and `beforeunload`. Saves carry `version`; `save.ts` holds a migration table keyed by version.

---

## 10. Hooks for later sub-projects

- **Offline progress:** production is linear between placement events, so catch-up is one computation per producer.
- **Honey types:** `SourceDef.flowerType` already exists; sub-project 3 derives a producer's output from the dominant flower type in range.
- **Land expansion:** `tiles[].owned` already gates building; sub-project 3 adds a purchase command.
- **New chains:** a new content pack plus an art module; a new system only if the chain needs a new consumption kind.
- **Beekeeper movement:** `camera.focus(hex)` and the hex utilities are in place for A* in sub-project 2.

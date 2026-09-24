# Life and Juice — Sub-project 2 Design (M5)

- **Date:** 2026-09-24
- **Status:** Approved in design review, pending spec review
- **Scope:** Sub-project 2 of 4 (roadmap milestone M5)
- **Builds on:** [Sub-project 1 spec](2026-09-23-hive-foundation-design.md) (merged in PR #1)

---

## 1. Context and intent

Sub-project 1 delivered the foundation and a playable loop: a hex world, hives fed by flower beds in range, instant harvesting, selling, autosave. The world is static, though. Nothing moves except a gently bobbing beekeeper, and nothing makes a sound.

Sub-project 2 makes the world feel alive **and** makes the beekeeper part of the loop:

- The beekeeper walks to hives to harvest them. A harvest completes only when the beekeeper arrives.
- Bees fly between each hive and the beds in its range, and their numbers show how well the hive is doing.
- Floating numbers show what each action gained or cost.
- Code-generated sound effects and ambience, with a mute button.

Sub-project 1's rules still apply: no image or audio files, `sim` never depends on rendering, content stays data-driven, and the approved art style (pastel palette, rounded shapes, soft light) stays.

### Success criteria for sub-project 2

1. `npm run check` and all Playwright specs pass in CI.
2. Harvesting sends the beekeeper on a hex path; honey reaches the inventory only on arrival. Harvest All produces a nearest-first route.
3. No placement can leave a hive unreachable. Saves from sub-project 1 (version 1) load and play.
4. Bees visibly reflect each hive's state: busy, starved (no beds in range) or full.
5. The user signs off at the **motion gate** (§6.5) and the **audio gate** (§8.6).
6. 60 fps holds on an integrated-GPU laptop with 25 hives placed.
7. In a manual playtest at 1x, a second hive is still affordable after roughly 5 minutes (sub-project 1's pacing survives the walking delay).

---

## 2. Scope

### Milestones inside sub-project 2

| Step | Contents |
|---|---|
| M5.1 Walking sim | Pathfinding, walkability, worker state and tick, queued harvest commands, placement check, save v2 + migration |
| M5.2 Motion | Loop alpha + animation clock, walking beekeeper, work animation, bees, queue badges, motion gate |
| M5.3 Feedback | Floating numbers, toast changes, inspect button states, Harvest All filter |
| M5.4 Sound | Audio layer, SFX, ambience, mute button + prefs, audio gate |

Each step ends with `npm run check` green. The implementation plan breaks these into tasks.

### Explicitly out of scope

Music, a volume slider, more than one worker, hiring, ETAs, clicking the beekeeper, camera follow, carrying honey back to the house, terrain movement costs, offline progress, touch tuning. Balance changes beyond §5.10 belong to sub-project 3.

---

## 3. Decisions log

| Question | Decision | Why |
|---|---|---|
| Does the walk affect gameplay? | **Yes.** A harvest completes only when the beekeeper arrives | The beekeeper should matter, and hive placement relative to the house starts to count |
| When does honey reach the inventory? | **On arrival at the hive** | Smallest sim change; distance adds a delay, not a second trip |
| How do harvest orders line up? | **Queue without duplicates, nearest queued hive first**; Harvest All queues every hive with honey | Clicks are never lost, and the route never zigzags |
| Which hexes are walkable? | **Grass and beds.** Hives, house, water, trees and rocks block | Layout matters, but beds can never wall the beekeeper in |
| What if a hive gets boxed in? | **Reject the placement** (`blocks_path`) | A stuck state can never happen; the check is cheap |
| What do bees show? | **Real production**: count follows intake, none without beds, loitering when full | The world doubles as a status readout |
| How much audio? | **SFX + ambience, no music** | Cozy without the risk of an annoying loop |
| Beekeeper architecture | **Sim-owned agent that moves per tick** (approach A) | Deterministic, saved, headless-testable, replays stay exact |
| A* or BFS? | **BFS** | Uniform step cost on 469 hexes: same shortest paths, simpler. A* can replace it behind the same signature if terrain costs arrive |
| Pause at the hive? | **Yes, `workTicks` = 8 (0.8 s at 1x)** after arrival | Without it the beekeeper touches the hive and turns away in the same tick |
| How many workers? | **One** (`state.worker`, not a list) | Hiring is a sub-project 3 question and will bring its own migration |
| Floaters' clock | **Real time**, not game time | Readable at 4x and still visible while paused |
| Old saves with a boxed-in hive | Allowed to load; that hive is `unreachable` | Such layouts could exist before this rule |
| Starting layout | **House moves from (0,−1) to (0,−2)** in new games | At (0,−1) the home hex is adjacent to the starting hive, so the first harvest would involve no walk at all (§5.10) |

---

## 4. Architecture

### 4.1 New and changed modules

```
src/
  core/pathfind.ts        NEW  BFS: findPath, distancesFrom (pure, knows nothing about the sim)
  content/types.ts        +    WorkerDef, BuildableDef.walkable, TileDef.walkable, ContentPack.worker
  content/registry.ts     +    reg.worker, validation (§5.1)
  content/packs/bees.ts   +    beekeeper worker def, beds walkable, house moved
  content/tiles.ts        +    walkable per tile
  sim/walk.ts             NEW  isWalkable, homeHex, reachability, placement check helpers
  sim/worker.ts           NEW  workerTick, job selection, repath, collect
  sim/state.ts            ~    version 2, Worker
  sim/commands.ts         ~    queued harvest, new rejections
  sim/advance.ts          ~    runs workerTick after production
  sim/events.ts           ~    harvestQueued, jobDropped, harvested gains hex
  game/loop.ts            ~    alpha, accumulator kept while paused
  game/save.ts            ~    v1 -> v2 migration, worker validation
  game/prefs.ts           NEW  { sound } in localStorage, separate from the save
  game/devtools.ts        +    beekeeper(), audioLog()
  render/walker.ts        NEW  beekeeper movement and animation (moved out of sync.ts)
  render/bees.ts          NEW  instanced bees, buzzLevel()
  render/floaters.ts      NEW  world-anchored floating numbers
  render/badges.ts        ~    queued / target states
  render/art/beekeeper.ts ~    split into body, arms, legs
  render/art/buildings.ts ~    hive lid as its own mesh
  ui/feedback.ts          +    floater text per event, toast changes
  ui/hud.ts               +    HUD floaters, mute button
  ui/inspect.ts           ~    harvest button states
  ui/toolbar.ts           ~    readyToHarvest excludes queued hives
  ui/icons.ts, strings/   +    sound / soundOff icons, new strings (§7.7)
  eslint.config.js        +    audio layer rule
  audio/                  NEW  engine, recipes, cues, ambience, NullAudio
```

### 4.2 Dependency rules

Unchanged from sub-project 1, plus one new layer:

- `audio` may import `core`, `content` and types from `sim`. It must not import `render`, `ui`, `game` or `three`. Enforced by a new ESLint `no-restricted-imports` block that runs in `npm run check`.
- `main.ts` wires audio to session events, UI clicks, the walker's footsteps and the bee layer's buzz level.
- `render` may call read-only sim helpers (`getRangeMap`, `intakePerDay`), as it may today. It never mutates state.

### 4.3 Loop changes

- `startLoop` passes `alpha = accMs / TICK_MS` (0..1, how far the sim is toward the next tick) to `render(dt, time, alpha)`, and `view.frame` receives it.
- **Pausing keeps the accumulator** instead of resetting it to 0. Otherwise alpha would snap to 0 on pause and the walking beekeeper would jump back a fraction of a hex.
- Render keeps an **animation clock** that advances by `dt × effective speed`. Walk cycles, the work animation and bees use it, so they run faster at 4x and freeze while paused. Floaters use real time (§6.3).

---

## 5. Simulation

### 5.1 Content additions

```ts
interface WorkerDef {
  id: string;           // 'beekeeper'
  home: string;         // buildable the worker returns to: 'house'
  ticksPerHex: number;  // ticks per hex step; 5 = 2 hexes/s at 1x
  workTicks: number;    // ticks spent at a hive after arriving; 8 = 0.8 s at 1x
}

interface TileDef   { id: TileId; buildable: boolean; walkable: boolean }  // grass, soil: true; water: false
interface BuildableDef { /* … */ walkable?: boolean }                     // bed_wildflower: true
interface ContentPack  { /* … */ worker?: WorkerDef }
```

Registry validation adds: exactly one `worker` across all packs; its `home` names an existing, non-removable buildable; `ticksPerHex` and `workTicks` are positive integers. `reg.worker` returns the def.

### 5.2 State (save version 2)

```ts
interface Worker {
  def: string;
  at: Hex;               // last hex fully reached
  path: Hex[];           // hexes still to walk, next first
  stepTicks: number;     // progress toward path[0], 0..ticksPerHex-1
  target: string | null; // producer the worker is heading to or working at
  workLeft: number;      // ticks of work left at the hive, 0 when not working
  queue: string[];       // waiting producer ids; never contains target; no duplicates
}

interface GameState {
  version: 2;
  /* …all sub-project 1 fields unchanged… */
  worker: Worker;
}
```

`createInitialState` puts the worker on the home hex with an empty path and queue.

### 5.3 Walkability and the home hex (`sim/walk.ts`)

- `isWalkable(state, reg, hex)` is true when the tile exists, `TILES[tile].walkable` is true, the tile has no decor, and it either has no entity or the entity's def is `walkable`.
- The whole map is walkable terrain, not only the owned plot.
- `homeHex(state, reg)` is the first walkable neighbor of the home building, checked in this fixed order: (−1,+1), (0,+1), (−1,0), (+1,0), (0,−1), (+1,−1). The first two face the door (+z). It is derived, never stored, so it follows layout changes.
- If the home building has no walkable neighbor (possible only in old saves), `homeHex` returns the nearest walkable hex to it by BFS, with ties broken by the order above.

### 5.4 Pathfinding (`core/pathfind.ts`)

```ts
findPath(start: Hex, isGoal: (h: Hex) => boolean, passable: (h: Hex) => boolean): Hex[] | null
distancesFrom(start: Hex, passable: (h: Hex) => boolean): Map<HexKey, number>
```

- Breadth-first search. Neighbors are expanded in `HEX_DIRECTIONS` order, so the same map always gives the same path.
- `findPath` returns the hexes after `start`, ending on the first goal reached, or `[]` when `start` is already a goal, or `null` when no goal is reachable.
- The goal for a hive is "any walkable neighbor of it". The goal for going home is `homeHex`.

### 5.5 Worker tick (`sim/worker.ts`)

`advance` runs `productionTick`, then `workerTick`, then the clock. Each tick:

```
w = state.worker, def = reg.worker

1. Working:  if w.workLeft > 0:
                 w.workLeft -= 1
                 if w.workLeft == 0: w.target = null
                 stop.
2. New job:  if w.target is null and w.queue is not empty: startNextJob().
             (This also interrupts a walk home.)
3. Walk:     if w.path is not empty:
                 w.stepTicks += 1
                 if w.stepTicks < def.ticksPerHex: stop.
                 w.at = w.path.shift(); w.stepTicks = 0
4. Arrive:   if w.path is empty and w.target is set:
                 collect(w.target); w.workLeft = def.workTicks; stop.
5. Go home:  if w.path is empty and w.target is null and w.at is not homeHex: repath(homeHex).
```

`target` stays set while the worker works, so render and the inspect panel know which hive is being worked. It clears when the work ends.

- **`startNextJob`:** one `distancesFrom(origin)` flood, where origin is `path[0]` if `stepTicks > 0`, else `at`. Each queued hive's distance is the smallest distance to any of its walkable neighbors. The nearest wins; ties go to queue order. Queued hives with no reachable neighbor are removed and emit `jobDropped {id, reason: 'unreachable'}`. The winner leaves the queue, becomes `target`, and the worker re-paths to it.
- **A started step always finishes.** `repath(goal)` computes the new path from `path[0]` when `stepTicks > 0` and keeps `path[0]` at its front, so the worker never snaps backwards.
- **`collect(id)`:** moves the producer's whole store into the inventory, emits `harvested {id, hex, resource, amount}`, sets the store to 0 and clears the full flag. The amount is whatever is stored **at arrival**, including what accumulated during the walk.
- **Timing:** a job starts, and its first step begins, on the same tick. For a path of *n* hexes, collection happens on the *(n × ticksPerHex)*-th tick counting that one. A worker already next to the hive collects on the starting tick. The next job starts `workTicks` + 1 ticks after collection (the work ticks, then the tick that picks the job).

### 5.6 Commands

| Command | Behavior in sub-project 2 | Rejections |
|---|---|---|
| `harvest(id)` | If the hive is already `target` or queued: ok, no events. Otherwise appends to `queue` and emits `harvestQueued {id}`. Honey moves later, on arrival | `unknown_entity`, `nothing_to_harvest` (not a producer, or store is 0), `unreachable` |
| `harvestAll()` | Queues every producer with store > 0 that is reachable and not already queued or targeted, emitting one `harvestQueued` each. Ok with no events if every reachable hive with honey is already queued or targeted | `nothing_to_harvest` if no producer has honey; `unreachable` if the only ones with honey are unreachable |
| `remove(id)` | Unchanged refund, including the instant `harvested` for its stored honey. Also removes `id` from `queue`. If it was `target`: clears the target, sets `workLeft` to 0, and trims the path to the step in progress (`[path[0]]` if `stepTicks > 0`, else `[]`) | Unchanged |
| `place(def, hex)` | Unchanged, plus the checks in §5.7. After success, if `hex` is on the worker's remaining path, re-paths to its current goal (the target, or the recomputed `homeHex`); if a target has no path, drops that job with `jobDropped` | Adds `worker_in_way`, `blocks_path` |

"Reachable" means that some walkable neighbor of the hive is reachable from the worker's origin (§5.5).

### 5.7 Placement check (in `validatePlace`)

Runs after the existing checks, and only for buildables that are **not** `walkable`. Placing a bed can never block anything.

1. `worker_in_way` if the hex is `worker.at` or `worker.path[0]`.
2. `blocks_path`: flood fill from the worker's `at` twice, once as the map is now and once with the hex treated as blocked. Reject if:
   - any producer that was reachable becomes unreachable, or
   - the home building had a reachable walkable neighbor and loses it, or
   - the new building is a producer and would itself be unreachable.

Comparing before and after means a hive that was already boxed in, in an old save, does not make every future placement fail.

The ghost uses `validatePlace`, so it turns red and shows the reason with no controller changes. It re-validates on mouse move, not while the worker walks, so a click on a hex the worker is about to step into can still be rejected with a toast. That is accepted.

### 5.8 Events

| Event | Change |
|---|---|
| `harvestQueued {id}` | New |
| `jobDropped {id, reason: 'unreachable'}` | New |
| `harvested {id, hex, resource, amount}` | `id` is now required and `hex` is added, so floaters can anchor even after the hive is removed. The aggregated Harvest All form is gone |

### 5.9 Save version 2

- **Migration v1 → v2:** adds `worker` with `def` = the registry's worker, `at` = `homeHex`, empty `path` and `queue`, `stepTicks` = 0, `target` = null, `workLeft` = 0.
- **Validation** (extends the deep check): `worker.def` is the registry's worker; `at` is on the map and walkable; every hex in `path` is walkable and each is adjacent to the one before it (the first to `at`); `stepTicks` is an integer in 0..ticksPerHex−1 and is 0 when `path` is empty; `workLeft` is an integer in 0..workTicks, and is above 0 only when `target` is set and `path` is empty; `target` is null or an existing producer; `queue` holds existing producers, no duplicates, and not the target.
- The existing dry-run tick then runs on the migrated state.

### 5.10 Numbers and starting layout

- `ticksPerHex` = 5 (2 hexes/s at 1x), `workTicks` = 8.
- The longest walk inside the radius-3 plot is about 6 hexes, or 3 s at 1x. A hive takes about 5 in-game days (5 minutes at 1x) to fill, so travel adds a feel of effort, not economic pressure. Tuning that pressure belongs to sub-project 3.
- **Starting layout:** the house moves from (0,−1) to (0,−2) in new games. Its home hex becomes (−1,−1), one step from (0,−1), which is next to the starting hive. The first harvest is then a visible trip: one step out, lift the lid, one step back. At (0,−1) the home hex (−1,0) is itself next to the hive, so there would be no walk at all. Existing saves keep their layout.

---

## 6. Rendering

### 6.1 Walking beekeeper (`render/walker.ts`)

- Takes over the beekeeper from `sync.ts`, which stops placing it.
- **Position:** lerp from `at` to `path[0]` by `(stepTicks + alpha) / ticksPerHex`, in world space via `hexToWorld`.
- **Stopping point:** on the final step toward a hive or home, the endpoint shifts from the hex center toward the hive's (or door's) edge, so the beekeeper stands against what it is working on. This offset is render-only.
- **Facing:** yaw turns toward the direction of travel, or toward the hive while working, smoothed over about 0.15 s.
- **Walk cycle:** legs and arms swing and the body bobs. The stride phase advances by *distance travelled*, not time, so feet never slide at any speed. Each foot-down calls `onFootstep(surface, screenX)`, where surface is `'grass'` or `'soil'`.
- **Work:** while `workLeft > 0`, the beekeeper leans forward with arms raised, and the target hive's lid lifts and settles.
- **Idle:** today's gentle bob.

### 6.2 Bees (`render/bees.ts`)

- Two `InstancedMesh`es: bodies (yellow and brown stripes through vertex colors) and translucent wings, which flutter through a per-instance scale. That is 2 draw calls in total, with a hard cap of 150 bees.
- **Count per hive** = `round(intakePerDay / maxIntakePerDay × 6)`, minimum 1 when intake > 0.
  - No beds in range: no bees.
  - Store at capacity: 2–3 bees loiter in lazy loops around the entrance and make no trips.
- **Trip loop per bee:** leave the entrance → a curved flight (a bezier with a random lift and sideways drift) to one of the hive's beds, chosen with weight equal to its nectar share → hover and jitter over the flowers for 1–2 s → fly back → rest inside briefly → repeat. Start phases are randomized so the swarm does not pulse in sync.
- **Count changes:** surplus bees finish their current trip and vanish at the entrance. New bees appear from the entrance. Removing a hive removes its bees at once. Bees heading to a removed bed turn straight home.
- **`buzzLevel()`** returns `{ level: 0..1, pan: −1..1 }`: visible bees weighted by closeness to the screen center and by camera zoom, with pan from their weighted screen position. It returns level 0 while paused.

### 6.3 Floaters (`render/floaters.ts`)

- CSS2D objects, like the fill badges, so they follow camera pan and zoom and share the UI's font and CSS.
- UI builds the element (icon + text + tone class); render anchors it at a hex and animates it. Render never formats numbers.
- **Motion:** a small pop, then a rise of about 40 px over 1.2 s with ease-out, fading over the last 40%. Real time, so they stay readable at 4x and still play while paused.
- Floaters on the same anchor within 0.3 s stack upward instead of overlapping. At most 20 are live; the oldest is dropped first.

### 6.4 Art changes

- `makeBeekeeper` returns a group of body, 2 arms and 2 new small legs as child meshes, so the limbs can animate. Silhouette, colors and scale stay the same.
- The hive art returns its lid as a named child mesh (`lid`), so it can lift. The look stays the same.
- Queue states on the fill badge (§7.3).

### 6.5 Motion gate

Before M5.3 starts, the user watches the game in the browser: the walk (speed, stride, stopping points), the work animation and the bees (density, flight paths, full and starved states). Adjustments happen here, and the user signs off.

---

## 7. UI

### 7.1 Floating numbers

`ui/feedback.ts` gains `floatersForEvent(event, reg)`, a sibling of `toastForEvent`, which returns zero or more floaters:

| Event | Anchor | Text |
|---|---|---|
| `harvested` | its `hex` (world) | honey icon **+1.2 kg**, amber |
| `entityPlaced` with a coin cost | its hex (world) | coin icon **−120**, muted |
| `entityRemoved` with a coin refund | its hex (world) | coin icon **+60** |
| `sold` | HUD coin pill and honey pill | **+45** and **−3.0 kg** |
| `safetyNetGranted` | HUD coin pill | **+20** |

The zero rule from sub-project 1 holds: a floater that would show "+0.0 kg" is not shown. HUD floaters are plain DOM next to the pills in `ui/hud.ts`, with the same motion as §6.3.

### 7.2 Toasts

- The per-harvest toast is removed; the floater replaces it.
- Harvest All (button or H key) shows one toast, "Beekeeper heading to {n} hives", where n is the number of `harvestQueued` events in its dispatch result. The dispatch site shows it, not the per-event toast mapping, because a single harvest also emits `harvestQueued` and should not toast. When n is 0 there is no toast.
- `jobDropped` shows an error toast, "The beekeeper can't reach that hive".
- The "hive is full" toast is unchanged.

### 7.3 Hive badges

The fill badge gains two classes:

- `queued`: a dashed amber outline and a small basket icon.
- `target`: the same, pulsing gently while the beekeeper walks there or works.

There are no order numbers, because nearest-first can reshuffle the order as the beekeeper moves.

### 7.4 Inspect panel (hive)

The Harvest button reflects the job state:

| State | Button |
|---|---|
| Not queued, store shows above 0.0 kg | **Harvest** (enabled) |
| Queued | **Queued** (disabled) |
| Target, walking | **Beekeeper on the way** (disabled) |
| Target, working | **Collecting…** (disabled) |
| Unreachable (old saves only) | **Can't reach** (disabled) |

### 7.5 Harvest All and the H key

`readyToHarvest` counts only honey in hives that are neither queued nor the target. When everything with honey is queued, the badge shows 0 and the button disables, exactly as in the empty case today. The H key uses the same function, so the two stay in sync. An old-save unreachable hive is still counted; pressing the button then shows the `unreachable` toast.

### 7.6 Mute button and M key

- A speaker icon button in the HUD's right cluster, between reset-view and settings (as in the reference). Two new inline-SVG icons: `sound` and `soundOff`.
- It has `aria-pressed` and a label ("Sound on" / "Sound off"). **M** toggles it through the controller's key map.
- `UiDeps` gains `isSoundOn()` and `toggleSound()`; the controller's deps gain `toggleSound()`.

### 7.7 New strings (English)

| Key | Text |
|---|---|
| `reason.blocks_path` | Would block the beekeeper's path |
| `reason.worker_in_way` | The beekeeper is standing there |
| `reason.unreachable` | The beekeeper can't reach this hive |
| `toast.harvestQueued` | Beekeeper heading to {n} hives |
| `toast.jobDropped` | The beekeeper can't reach that hive |
| `inspect.queued` | Queued |
| `inspect.onTheWay` | Beekeeper on the way |
| `inspect.collecting` | Collecting… |
| `inspect.cantReach` | Can't reach |
| `hud.soundOn` / `hud.soundOff` | Sound on / Sound off |

---

## 8. Audio

### 8.1 Modules (`src/audio/`)

| File | Role |
|---|---|
| `engine.ts` | `AudioContext` and graph: master gain → `DynamicsCompressor` → destination, with an **sfx** bus and an **ambience** bus |
| `recipes.ts` | One function per sound, built from oscillators, a shared noise buffer and gain envelopes |
| `cues.ts` | Pure `cueForEvent(event) → SoundId \| null` |
| `ambience.ts` | Wind, birds, bee buzz |
| `index.ts` | `createAudio()` returns the Web Audio implementation, or `NullAudio` when `AudioContext` is missing |

`NullAudio` implements the same interface and does nothing. Tests use it too.

### 8.2 Engine rules

- **Autoplay:** the `AudioContext` is created on the first `pointerdown` or `keydown`. Anything played before that is dropped, not queued.
- A 1 s white-noise buffer is generated once and reused, starting at random offsets.
- **Anti-spam:** each sound has a cooldown (for example 30 ms for the click, 60 ms for the coin). At most 16 voices play at once; extra requests are dropped. Pitch varies randomly by ±3% so repeats do not sound mechanical.
- **Hidden tab:** the context suspends and resumes when the tab is visible again, unless muted.

### 8.3 Sound effects

| Trigger | Sound |
|---|---|
| Any UI button (one delegated `click` listener on the UI root, in `main.ts`) | Soft tick, 40 ms |
| `entityPlaced`, non-walkable building | Wooden thunk: low sine drop + short noise burst |
| `entityPlaced`, walkable building (bed) | Leafy rustle: band-passed noise |
| `entityRemoved` | Downward whoosh + pop |
| Any rejected command dispatched from a click or key | Soft low double-boop, never harsh |
| `harvestQueued` | Tiny blip |
| `harvested` | Lid clack, then a bubbly rising "glug" |
| `sold`, `safetyNetGranted` | Two-note chime |
| `producerFull` | One quiet bell |
| Walker footstep | Muffled thud; `soil` slightly brighter than `grass`. Volume falls off with camera distance; panned by `screenX` |

### 8.4 Ambience

- **Wind:** looped filtered noise, with a slow drift in cutoff and gain. Very quiet. It keeps playing while paused.
- **Birds:** every 6–20 s, a phrase of 2–5 fast chirps (sine sweeps in 2–4 kHz), panned randomly. It keeps playing while paused.
- **Bee buzz:** two slightly detuned sawtooth oscillators → band-pass → gain, with a slow wobble. `main.ts` reads `bees.buzzLevel()` at 10 Hz; the gain and pan ramp toward it smoothly. It fades out on pause, because the bees freeze.

### 8.5 Mute and preferences

- Sound is **on** by default.
- `game/prefs.ts` stores `{ sound: boolean }` under `hive-foundation.prefs`, separate from the save, so "Reset game" keeps the mute choice. If storage is unavailable, the choice lasts for the session only.
- Muting fades the master gain to 0 over 50 ms, then suspends the context. Unmuting resumes and fades back in. If the player mutes before the first gesture, no context is created at all.

### 8.6 Levels and audio gate

Starting levels: master 0.6, sfx 1.0, ambience 0.35, buzz peak 0.25. These are starting points only. Before merge, the user listens in the browser and approves or adjusts each sound and level.

---

## 9. Testing

New sim and core code is written test-first, as in sub-project 1.

### 9.1 Unit tests (vitest, headless)

- **`core/pathfind`:** shortest path on an open grid; detours around blockers; `null` when enclosed; `[]` when already at a goal; nearest of several goals; the same path on repeated runs; `distancesFrom` equals `hexDistance` on an open map.
- **`sim/walk`:** walkability for each tile, decor and building type; `homeHex` for the new starting layout is (−1,−1); the fallback for a boxed-in house.
- **`sim/worker`:**
  - Honey is not in the inventory before arrival and is there on the exact arrival tick (*n × 5* ticks); the amount equals the store at arrival.
  - The `workTicks` pause happens before the next job starts.
  - Nearest-first selection, with ties going to queue order.
  - The worker returns home when idle; a new order interrupts the walk home; the worker never snaps backwards.
  - Removing the target mid-walk moves on to the next job; a removed queued hive is dropped; the refund is unchanged.
  - A placement on the path triggers a re-path; `jobDropped` fires in a forced no-path state.
  - **Replay:** the same seed and the same command log give an identical final state.
- **Commands:** duplicate harvest is ok with no events; `harvestQueued`; `nothing_to_harvest`; `unreachable`; Harvest All queues only unqueued hives. `worker_in_way` and `blocks_path` fire where expected, including the old-save case where a boxed-in hive does not block other placements. Beds are never blocked.
- **`balance.test`:** the harness advances until the queue is empty. The existing payback expectations hold.
- **Save:** a v1 fixture migrates to v2 (worker at home, empty queue; boxed-in house uses the fallback). v2 round-trips. Each invalid worker field is rejected. The dry-run tick passes.
- **Registry:** exactly one worker; its home exists and is non-removable; `ticksPerHex` and `workTicks` are positive integers.
- **Loop:** alpha is derived from the accumulator, and the accumulator is kept while paused.

### 9.2 Render and UI (jsdom + three)

- **Walker:** interpolated position at alpha 0, 0.5 and 1; facing; the end offset toward the hive; footsteps fire in step with the stride and never while paused.
- **Bees:** the count formula (0 without beds, loiter count when full, the 150 cap); bees vanish with their hive; `buzzLevel` is 0 when paused or with no bees and rises as the camera moves closer.
- **Floaters:** spawn and expiry, stacking, the cap of 20. `sync` no longer places the beekeeper.
- **UI:** `floatersForEvent` texts (never "+0.0 kg"); the toast changes; the badge `queued` / `target` classes; the inspect button states in §7.4; `readyToHarvest` excluding queued honey; the mute button's `aria-pressed`; prefs persistence; the M key.

### 9.3 Audio

- The `cues.ts` mapping table.
- The engine against a stub `AudioContext`: cooldowns, the voice cap, no context before the first gesture, mute suspends the context. `createAudio` returns `NullAudio` when `AudioContext` is missing.
- Sound quality cannot be unit-tested; that is what the audio gate is for.

### 9.4 End-to-end (Playwright, new `e2e/life.spec.ts`)

- **Harvest flow:** fill a hive through `__game.advance`, click the hive, click Harvest. The button shows the queued state and the honey pill has not changed. Advance time: the beekeeper has moved, a "+x kg" floater appears, the honey pill increases, and the beekeeper walks home.
- **Box-in:** hovering a hex that would box in a hive shows a red ghost with the "Would block…" hint.
- **Mute:** the button toggles and the choice survives a reload.
- **Perf:** the existing render budget holds; bees add at most 2 draw calls with 25 hives placed.
- **New dev-only hooks** on `window.__game`: `beekeeper()` returns `{ at, path, target, world: {x, z} }`; `audioLog()` returns the last 50 cue ids played, so tests can check sounds fired without hearing them.

### 9.5 Gates

1. **Motion gate** (§6.5), before M5.3.
2. **Audio gate** (§8.6), before merge.

---

## 10. Error handling (additions)

| Failure | Response |
|---|---|
| No path to a queued hive at runtime (should be impossible for new placements) | Job dropped, `jobDropped` → error toast. The sim never throws for this |
| Old save with a boxed-in hive | Loads; that hive's harvest is rejected with `unreachable`; Harvest All skips it |
| Old save with a boxed-in house | Worker placed on the nearest walkable hex; `homeHex` uses the same fallback |
| Invalid worker data in a save | Handled like any corrupt save: backup, fresh game, toast |
| Web Audio unavailable | `NullAudio`; the game runs silently, and the mute button still toggles its stored preference |
| `AudioContext` creation or resume throws | Caught; audio disabled for the session with one console warning |
| Prefs storage unavailable | Mute works for the session only |

---

## 11. Hooks for later sub-projects

- **Offline progress:** production is still linear between placements, but catch-up must now also fast-forward the worker: either run `workerTick` for the elapsed ticks, or finish the queue instantly with the stores at the catch-up time.
- **More workers and hiring:** `state.worker` becomes a list with a shared job queue, via a v2 → v3 migration. `sim/worker.ts` already keeps job selection separate from movement.
- **Carrying and logistics:** a carry-back step could be added in `collect` without touching pathfinding.
- **Terrain costs:** swapping BFS for A* or Dijkstra inside `findPath` keeps its signature.
- **New chains:** another chain's worker is a new `WorkerDef` in its pack; `collect` already works for any producer.
- **Settings (sub-project 4):** a volume slider maps onto the existing master, sfx and ambience gains.

# Seasons and Purity — Sub-project 3 Design (M6)

- **Date:** 2026-09-25
- **Status:** Approved in design review, pending spec review
- **Scope:** Sub-project 3 (roadmap milestone M6)
- **Builds on:**
  - [Sub-project 1 spec](2026-09-23-hive-foundation-design.md) (merged in PR #1)
  - Sub-project 2 spec, `2026-09-24-life-and-juice-design.md` (PR #2). This sub-project's code builds on sub-project 2's code and starts after PR #2 merges.
  - Game rules v2 spec, `2026-09-25-game-rules-design.md` (PR #3). That document fixes the rules and numbers; this one fixes how they are built. Section references like "rules §5.3" point there.

---

## 1. Context and intent

The rules review found that the current loop is a solved optimization problem: always four beds per hive, sharing only wastes nectar, and the plot is full by about day 30. The rules spec answers that with three pillars (layout puzzle, seasonal farm, trade). This sub-project switches on the first one and the calendar that drives it:

- six flower types that bloom only in their seasons, with resting beds out of season;
- honey purity decided per harvested batch;
- three synergies (clump, water-side, crowding), each shown in the build preview;
- a placeable pond;
- 7-day seasons with winter replanting;
- the Honey Journal, which gives purity a goal before trade exists.

There is no trade and there are no chapters yet (sub-project 4). Every flower and the pond are in the Shop from the start, and each honey type sells at a fixed price.

Sub-project 1 and 2 rules still apply: no image or audio files, `sim` never imports `three` or the DOM, content stays data-driven, and the approved art style (pastel palette, rounded shapes, soft light) holds.

### Success criteria

1. `npm run check` and all Playwright specs pass in CI.
2. Balance bot v2, over a headless year:
   - the second hive is affordable around day 6;
   - the starting plot is not full by day 28;
   - the bot's strategy harvests a pure clover batch before the end of summer (day 14).
3. Saves from version 1 and version 2 load and play.
4. The user signs off at the **flower art gate** (§6.6) and the **playtest gate** (§8.5).
5. 60 fps holds on an integrated-GPU laptop with the starting plot full of mixed beds; beds add at most 12 draw calls.

---

## 2. Scope

### Milestones

| Step | Contents | Exit |
|---|---|---|
| **M6.1 Content and calendar** | `FlowerDef`, six flowers, six honey types and prices, the `rules` block, the pond, 7-day seasons, registry validation | `npm run check` green |
| **M6.2 Production v2** | Layout cache with season key, boosts and caps; resting beds; per-flower stores and cap split; batch purity at collection; winter refund; safety-net fix; Journal state; new events; save v3; balance bot v2 | A headless year run meets §1 criterion 2 |
| **M6.3 Flower art** | Bed layer, six flower shapes in bloom and at rest, pond art, flower-colored hive badges | **Flower art gate** |
| **M6.4 UI** | Build preview effects; popovers; Shop, Market, HUD, season banner, Journal; `e2e/seasons.spec.ts` | `npm run check` and Playwright green |
| **M6.5 Playtest gate** | The user plays a full year at 1x | The pure-vs-steady choice is felt |

M6.1 and M6.2 are sim work and can run before M6.3. Each step ends with `npm run check` green; the implementation plan breaks them into tasks.

### Out of scope

| Item | Where it goes |
|---|---|
| Market prices that drop as you sell, orders, festival, chapters | Sub-project 4 |
| Workshop, hive levels, beekeeper tools, land, garden path | Sub-project 5 |
| Tutorial and Guide | Sub-project 6 |
| Snow, ground tinting, weather | Later visual polish |

---

## 3. Decisions log

| Question | Decision | Why |
|---|---|---|
| How do the six flowers look? | **Distinct procedural shapes plus colors**, each with a resting variant | Readable at a glance and for colorblind players; the layout puzzle depends on telling flowers apart |
| How does production handle bonuses and seasons? | **Layout cache**: the existing range map, rebuilt only when entities change, also holds boosts and caps. The **season is part of the cache key** | Follows today's pattern; rebuilt four times a year; bees and the inspect panel get season-aware rates with no extra calls |
| How is a hive's cap split between flowers? | **Proportionally** to what each flower delivers | No flower is favored; the batch mix reflects the layout |
| Ties for the dominant flower | Registry order | Deterministic |
| When is purity decided? | At collection, for the whole batch | Makes harvest timing a decision (rules §5.2) |
| What does "discovered" mean? | The first batch that becomes honey R discovers R | One uniform rule; the first harvest discovers wildflower |
| How are beds drawn? | **A new bed layer**: one instanced mesh per flower × state | Today each bed is its own mesh (one draw call each), which would not survive more beds; this caps beds at 12 draw calls |
| How does a badge show purity? | Bar color = dominant flower; **solid = would be pure, striped = would be wildflower** | Avoids a second percentage next to the fill %; the exact purity is in the popover |
| How do UI and render share flower colors? | 3D colors in `render/art/palette.ts`; CSS variables `--flower-<id>` for the DOM | The UI never imports render code |
| Where do `Season` and `SEASONS` live? | Move from `sim/clock.ts` to `content/types.ts` | Content needs them for `FlowerDef.blooms`, and content cannot import sim |
| How does the safety net see through winter? | A special season key `'any'` in which every flower blooms | Winter no longer looks like a dead end |
| What happens to old saves' calendars? | Reset to Year 1, spring, day 1 | A day-40 save would land in an odd season (rules §6.3) |
| Which flowers are buyable? | All six, plus the pond, from the start | There are no chapters until sub-project 4 |

---

## 4. Architecture

### 4.1 New and changed modules

```
src/
  content/types.ts          +  SEASONS / Season (moved), FlowerDef, RulesDef, ContentPack.flowers / .rules
  content/registry.ts       +  reg.rules, reg.flower(), reg.flowers, reg.flowerByHoney(), reg.blooms(), reg.honeys; validation (§5.3)
  content/packs/bees.ts     ~  six flowers, six honeys, six beds, pond, prices, rules
  sim/clock.ts              ~  DAYS_PER_SEASON 7; imports Season from content
  sim/production.ts         ~  range map v2 (§5.5), per-flower tick (§5.6), storeTotal()
  sim/batch.ts              NEW  classifyBatch(), collectBatch(), purityThreshold()
  sim/journal.ts            NEW  emptyJournal(), recordBatch(), recordSale(), rollDay()
  sim/preview.ts            NEW  previewEffects() (§5.11)
  sim/economy.ts            ~  refundFor(def, season); safety net uses the 'any' season
  sim/worker.ts             ~  collect() calls collectBatch()
  sim/commands.ts           ~  remove: collectBatch + seasonal refund; sell: recordSale; store reads use storeTotal
  sim/advance.ts            ~  seasonChanged, journal day roll
  sim/state.ts              ~  version 3; Entity.store becomes a record; journal
  sim/events.ts             ~  seasonChanged, honeyDiscovered; harvested gains dominant and purity
  game/save.ts              ~  v2 -> v3 migration and validation
  game/controller.ts        ~  preview effects on hover; J key opens the Journal
  render/beds.ts            NEW  instanced bed layer (§6.1)
  render/preview.ts         NEW  anchors preview tags and neighbor markers (§6.5)
  render/art/flowerbed.ts   ~  makeFlowerBed(flower, 'bloom' | 'rest') for six flowers
  render/art/pond.ts        NEW  stone rim, reeds, lily pad
  render/art/palette.ts     +  petal colors for six flowers, rest tone
  render/art/registry.ts    ~  one bed factory per source's flower; pond
  render/sync.ts            ~  skips entities that have a source
  render/badges.ts          ~  flower color, striped class, storeTotal
  render/bees.ts            ~  the "full" check uses storeTotal
  render/view.ts            ~  wires the bed and preview layers
  ui/hud.ts                 +  honey breakdown, season-end chip, next-season row
  ui/banner.ts              NEW  season banner
  ui/panels/shop.ts         ~  groups, season dots
  ui/panels/market.ts       ~  one row per honey type
  ui/panels/journal.ts      NEW  Honey Journal
  ui/inspect.ts             ~  hive batch mix, bed yield breakdown
  ui/feedback.ts            +  honeyDiscovered toast and floater, typed harvest floater, preview tag elements
  ui/toolbar.ts             +  Journal button
  ui/icons.ts, strings/en.ts, styles.css   +  icons, strings (§7.8), --flower-* variables, striped bar, banner, journal
```

### 4.2 Dependency rules

Unchanged from sub-projects 1 and 2. `render/preview.ts` and `render/beds.ts` only read state and call read-only sim helpers (`getRangeMap`, `previewEffects`), as `render/bees.ts` already does. The UI builds every element that shows text or numbers; render only anchors and animates them.

---

## 5. Content and simulation

### 5.1 Types (`content/types.ts`)

```ts
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

export interface FlowerDef {
  id: string;           // 'clover'
  honey: ResourceId;    // 'honey_clover': what a pure batch of this flower becomes
  blooms: Season[];     // ['spring', 'summer']
}

export interface RulesDef {
  purityThreshold: number;                         // 0.7
  clump: { minNeighbors: number; bonus: number };  // 2, 0.5
  waterSide: { bonus: number };                    // 0.5
  crowding: { penalty: number };                   // 0.25 of the intake cap
  winterSourceRefund: number;                      // 1.0 of cost
}

export interface ContentPack {
  /* …existing fields… */
  flowers?: FlowerDef[];
  rules?: RulesDef;
}
```

- `SourceDef.flowerType` must name a `FlowerDef`.
- `ProducerDef.output` now means the honey a **mixed** batch becomes (`honey_wildflower`).

### 5.2 Bees pack

| Kind | Content |
|---|---|
| Resources | `honey_wildflower`, `honey_clover`, `honey_lavender`, `honey_heather`, `honey_sunflower`, `honey_snowdrop`, all in kg |
| Flowers | wildflower (spring, summer, autumn), clover (spring, summer), lavender (summer), heather (autumn), sunflower (summer, autumn), snowdrop (winter) |
| Beds | `bed_wildflower` 20 (1 nectar/day; existing id so saves keep working), `bed_clover` 25 (1), `bed_lavender` 40 (1), `bed_heather` 35 (1), `bed_sunflower` 30 (1.5), `bed_snowdrop` 60 (0.5). All: grass only, `setsTile: 'soil'`, `walkable: true` |
| Pond | `pond`: cost 80, grass only, `setsTile: 'water'`, not walkable, purchasable, removable |
| Prices (coins/kg) | wildflower 15, clover 20, lavender 30, heather 25, sunflower 18, snowdrop 45 |
| Rules | the values in §5.1 |
| Start | unchanged: house, one hive, three wildflower beds, 60 coins |

The pond turns its tile into real water, so the water-side check is simply "a neighboring tile is `water`" and lakes and ponds behave the same. The tile under a pond is restored on removal through the existing `prevTile` mechanism.

### 5.3 Registry

New validation, run at startup and in tests:

- exactly one `rules` block across all packs;
- flower ids are unique; each flower's `honey` is a registered resource with a price;
- `blooms` is non-empty and holds only real seasons;
- every source's `flowerType` is a registered flower;
- `purityThreshold` is in (0.5, 1], so at most one flower can reach it; bonuses are ≥ 0; the crowding penalty is in [0, 1); the winter refund is in [0, 1].

New lookups: `reg.rules`, `reg.flower(id)`, `reg.flowers` (registry order), `reg.flowerByHoney(resource)`, `reg.blooms(flowerId, season)` (true for `'any'`), and `reg.honeys`, the resources named by some flower. "Honey" everywhere in the UI means `reg.honeys`.

### 5.4 Calendar

- `DAYS_PER_SEASON` = 7; a year is 28 days. `calendar()` is otherwise unchanged.
- At a day start whose season differs from the previous day's, `advance` emits `dayStarted` and then `seasonChanged { season, year }`.
- "Season ends tomorrow" is derived by the UI from the calendar (the last day of a season); it is not an event.

### 5.5 Layout cache (`getRangeMap(state, reg, season = currentSeason(state))`)

`season` is a `Season` or `'any'`. The cache holds one map per key `(entity ids, season)` and keeps at most two: the current season and `'any'`. Entities never move, and tiles only change through entities (`setsTile`), so the entity ids plus the season fully determine the map.

```ts
interface SourceBoost { clump: boolean; waterSide: boolean; multiplier: number }  // 1 + bonuses

interface SourceShare {
  sourceId: string;
  flowerType: string;
  dormant: boolean;        // not blooming in this season ('any': never)
  nectarPerDay: number;    // yield × multiplier ÷ sharedWith, or 0 when dormant
  sharedWith: number;
}

interface RangeMap {
  sharesByProducer: Map<string, SourceShare[]>;
  producersBySource: Map<string, string[]>;
  boostBySource: Map<string, SourceBoost>;
  capByProducer: Map<string, number>;   // maxIntakePerDay × (1 − penalty) when crowded
  crowded: Set<string>;
}
```

- **Clump:** at least `minNeighbors` neighboring entities are sources of the same flower. Dormant beds count.
- **Water-side:** at least one neighboring tile is `water`.
- **Crowding:** at least one neighboring entity is a producer.
- Sharing is unchanged: every producer whose range covers a source gets an equal slice.
- `intakePerDay()` and `outputPerDay()` keep their signatures and read the current season's map, with the cap from `capByProducer`. Bees and the inspect panel therefore see season-aware, boosted rates.

### 5.6 Production tick (per tick, `dt` in days)

```
for each producer p:
  r[f]   = Σ nectarPerDay of p's shares with flowerType f
  R      = Σ r[f]
  scale  = R > 0 ? min(1, cap(p) / R) : 0
  add[f] = r[f] × scale × conversion × dt
  room   = capacity − storeTotal(p)
  if Σ add > room: multiply every add[f] by room / Σ add
  store[f] += add[f]
  full flag and producerFull as before, on storeTotal
```

- `Entity.store` is `Record<flowerType, number>` for producers (`{}` when empty) and absent for everything else.
- `storeTotal(entity)` replaces every read of `store` as a number: badges, bees, the Harvest All count, `nothing_to_harvest`, the full flag and the dead-end check.
- Between placements and season changes, each flower's rate is constant, so the analytic check in the tests stays `min(capacity, s₀ + rate·t)` per flower until the hive fills.

### 5.7 Batches and purity (`sim/batch.ts`)

```ts
classifyBatch(store, producer, reg, threshold): { resource; amount; dominant; purity }
collectBatch(state, reg, id, events): void
purityThreshold(state, reg): number   // reg.rules.purityThreshold; the Extractor hooks in here later
```

- `dominant` is the flower with the most kg; ties go to registry order. `purity` = dominant kg ÷ total.
- If `purity ≥ threshold`, `resource` is that flower's honey; otherwise it is `producer.output`.
- `collectBatch` does nothing for an empty store. Otherwise it adds the honey to the inventory, empties the store, clears the full flag, emits `harvested { id, hex, resource, amount, dominant, purity }`, and then calls `recordBatch`, which may emit `honeyDiscovered` (§5.9). `harvested` always comes first.
- Callers: sub-project 2's `collect()` in `sim/worker.ts` and the instant collection in `remove`.

### 5.8 Economy

- **Refunds:** `refundFor(def, season)` returns `floor(cost × winterSourceRefund)` for a def with a `source` removed in winter, and the usual `floor(cost × 0.5)` otherwise. The inspect Remove button shows the same number.
- **Safety net:** the "production is 0" test uses `getRangeMap(state, reg, 'any')`. Everything else in the check is unchanged, with stores read through `storeTotal`.

### 5.9 Honey Journal (`sim/journal.ts`)

```ts
interface JournalEntry { discoveredDay: number | null; bestPurity: number; totalKg: number; totalCoins: number }

interface Journal {
  honey: Record<ResourceId, JournalEntry>;   // one entry per reg.honeys, created empty
  records: { biggestBatchKg: number; bestDayCoins: number; todayCoins: number };
}
```

- `recordBatch(batch)`:
  - `honey[batch.resource].totalKg += amount`;
  - if `honey[batch.resource].discoveredDay` is null, set it to the current absolute day (`floor(tick / 600) + 1`) and emit `honeyDiscovered { resource }`;
  - `honey[flower(dominant).honey].bestPurity = max(…, purity)`: best purity is tracked under the dominant flower even when the batch fell below the threshold;
  - `records.biggestBatchKg = max(…, amount)`.
- `recordSale(resource, coins)`: adds to `honey[resource].totalCoins` and `records.todayCoins`. Safety-net grants do not count.
- `rollDay()` at each day start: `bestDayCoins = max(bestDayCoins, todayCoins)`, then `todayCoins = 0`.

### 5.10 Tick order

`productionTick` → `workerTick` → clock. On a day start: `dayStarted` → `seasonChanged` (if the season changed) → `rollDay` → safety net.

### 5.11 Preview effects (`sim/preview.ts`)

```ts
previewEffects(state, reg, defId, hex): {
  self: Array<'clump' | 'waterSide' | 'crowded'>;
  neighbors: Array<{ id: string; change: 'gain' | 'lose'; rule: 'clump' | 'waterSide' | 'crowded' }>;
}
```

- Computed directly from the layout around `hex`, as if the building were placed; it never mutates state and does not build a range map.
- `self` covers the new building: clump or water-side for a bed, crowded for a hive.
- `neighbors` covers existing entities whose boost or crowding would change: beds that would reach the clump threshold, beds next to a new pond (water-side), hives that would become crowded.
- Only called while the placement is valid.

### 5.12 Events

| Event | Change |
|---|---|
| `seasonChanged { season, year }` | New |
| `honeyDiscovered { resource }` | New |
| `harvested { id, hex, resource, amount, dominant, purity }` | Adds `dominant` and `purity`; `resource` is the classified honey |

### 5.13 Save version 3

- **State:** `version: 3`; `Entity.store` is a record (§5.6); `journal` (§5.9).
- **Migration v2 → v3:**
  - each producer's numeric store `x` becomes `{ wildflower: x }`, or `{}` when `x` is 0;
  - `clock.tick` resets to 0 (Year 1, spring, day 1). The worker's `stepTicks` and `workLeft` are relative counters, so a worker mid-walk is unaffected;
  - every honey in `reg.honeys` missing from the inventory is added at 0;
  - `journal` is created empty.
- A v1 save runs v1 → v2 (sub-project 2) and then v2 → v3.
- **Validation** (extends the deep check):
  - a producer's `store` is an object whose keys are registered flowers and whose values are finite and ≥ 0, with a total at most `capacity + 1e-6`; non-producers have no `store`;
  - `journal.honey` has exactly one well-formed entry per honey (`discoveredDay` a positive integer or null; the numbers finite and ≥ 0; `bestPurity` ≤ 1);
  - `journal.records` fields are finite and ≥ 0.
- The existing dry-run tick runs on the migrated state.

### 5.14 Balance bot v2

The scripted player:

- places beds to form clumps;
- builds the second hive when affordable and surrounds it with clover;
- harvests a hive when it is full, and every hive on the last day of a season;
- sells all honey right after each harvest (there is no reason to hold honey before sub-project 4).

It checks §1 criterion 2 over a 28-day headless run, advancing the worker until its queue is empty after each harvest, as sub-project 2's harness does.

---

## 6. Rendering

### 6.1 Bed layer (`render/beds.ts`)

- One `InstancedMesh` per flower × state (bloom, rest): at most 12 meshes and 12 draw calls, however many beds exist.
- `sync.ts` stops creating objects for entities with a `source`, as it stopped placing the beekeeper in sub-project 2. Tiles under beds still refresh through sync.
- The layer rebuilds its instance lists on `entityPlaced`, `entityRemoved` and `seasonChanged`. A bed's state comes from `reg.blooms(flower, season)`, so a bed with no hive in range still shows the right state.
- Each bed gets a seeded rotation so neighboring beds of the same flower do not look stamped.
- The build ghost keeps using the art registry, which returns a single-bed mesh.

### 6.2 Flower art (`makeFlowerBed(flower, state)`)

| Flower | Blooming | Height |
|---|---|---|
| Wildflower | Today's mixed five-petal flowers | Mid |
| Clover | Round white and pink puffs over three-leaf clusters | Low |
| Lavender | Thin stems with stacked purple buds on the top third | Mid–tall |
| Heather | Squashed pink-magenta bush mounds with small flower dots | Low |
| Sunflower | Five tall stems, a flat yellow disk with a brown center, two leaves | Tall |
| Snowdrop | Arched thin stems with small white drooping bell cones | Low |

- **Resting:** the same stems and leaves; flower heads shrink to closed buds and petal colors blend toward pale beige.
- Built from the existing primitives in `parts.ts`, merged per variant, flat-shaded with vertex colors, as in sub-project 1.

### 6.3 Pond (`render/art/pond.ts`)

The tile underneath already renders as water. The pond adds a ring of squashed stones, three or four reed clumps (thin cones) and a lily pad (a flat, notched cylinder).

### 6.4 Hive badges

- The fill bar keeps showing how full the hive is, in the dominant flower's color (`--flower-<id>`).
- **Solid** bar: the batch would come out pure. **Striped** bar (flower color and wildflower): it would come out as wildflower honey. Both use the current threshold.
- An empty hive shows the neutral bar color.
- The `full`, `queued` and `target` classes from sub-projects 1 and 2 are unchanged.

### 6.5 Preview layer (`render/preview.ts`)

- While placing, the controller calls `previewEffects` on hover and hands the result to the UI, which builds tag chips ("+50% clump", "+50% water", "−25% crowded"). Render anchors the chips beside the ghost with `CSS2DObject`, like the fill badges.
- Neighbor markers: a small green "+" over a bed that would gain a bonus, an amber "−" over a hive that would become crowded.
- The range ring and source highlighting for producers stay as they are.

### 6.6 Flower art gate

Before M6.4 starts, the user sees in the browser:

- all six flowers, blooming and resting, side by side;
- the pond;
- a mixed plot shown in each of the four seasons.

Adjustments happen here, then the user signs off.

---

## 7. UI

### 7.1 HUD

- **Honey pill:** total kg across `reg.honeys`. Hover or keyboard focus opens a small list: color dot, name, kg, for every honey above 0.
- **Season-end chip:** on the last day of a season, "Season ends tomorrow — harvest to keep batches pure".
- **Next season row:** under the calendar, "Next: Summer" followed by small colored flower dots for what will bloom.

### 7.2 Season banner (`ui/banner.ts`)

On `seasonChanged`: the season name and its blooming flowers, centered near the top, for 2.5 s with a fade. It does not block input and sits in an `aria-live="polite"` region.

### 7.3 Shop

- Grouped: **Hives**, **Flowers**, **Water**.
- Flower rows: colored icon, name, cost, four season dots (filled when blooming), nectar/day, pure honey price.
- Pond row: "Beds next to it: +50%".

### 7.4 Market

One row per honey type that is discovered or in stock (a migrated save can hold wildflower honey before its first new-style harvest): color dot, stock (kg), price per kg, −/+ amount, **Sell**, **All**, and a live preview of the coins. Prices are fixed in this sub-project. The sub-project 1 rule holds: an amount that would display as 0.0 kg is never offered.

### 7.5 Inspect popovers

| Entity | Content |
|---|---|
| Hive | Fill (`3.2 / 5 kg`); rate for the current season (`0.75 kg/day`); a batch mix bar with a legend ("Clover 82% · Wildflower 18% → pure Clover"); beds in range with flower, "resting", bonus tags and "shared ×N"; a "crowded" tag; the sub-project 2 Harvest button states |
| Bed | Flower name and bloom dots; yield with a breakdown ("1.5 nectar/day: base 1 + clump 50%") or "Resting until summer"; "shared by N hives"; Remove with the refund for the current season |
| Pond | Name; "N beds get +50%"; Remove |

### 7.6 Honey Journal (`ui/panels/journal.ts`)

- New toolbar button (book icon) and the **J** key.
- Six cards in registry order: color, name, "Discovered: Year 1, day 9" or "?" with a hint ("Blooms in summer"), best purity, total kg, total coins.
- A records section: biggest batch, best day's income.

### 7.7 Feedback

- `honeyDiscovered`: toast "New honey: Clover!" and a floater at the hive's hex in the flower's color.
- `harvested` floater: "+1.2 kg Clover" in the honey's color (sub-project 2 showed "+1.2 kg").
- `seasonChanged`: the banner (§7.2); no toast.

### 7.8 New strings (English)

| Key | Text |
|---|---|
| `flower.<id>` / `honey.<id>` | Wildflower, Clover, Lavender, Heather, Sunflower, Snowdrop |
| `season.endsTomorrow` | Season ends tomorrow — harvest to keep batches pure |
| `season.next` | Next: {season} |
| `shop.group.hives` / `.flowers` / `.water` | Hives / Flowers / Water |
| `shop.pondHint` | Beds next to it: +50% |
| `preview.clump` / `.water` / `.crowded` | +{n}% clump / +{n}% water / −{n}% crowded |
| `inspect.batch` | {parts} → {result} |
| `inspect.pure` | pure {honey} |
| `inspect.resting` | Resting until {season} |
| `inspect.crowded` | Crowded |
| `inspect.pondBeds` | {n} beds get +{p}% |
| `journal.title` | Honey Journal |
| `journal.discovered` | Discovered: Year {year}, day {day} |
| `journal.undiscovered` | Blooms in {seasons} |
| `journal.bestPurity` / `.totalKg` / `.totalCoins` | Best purity / Harvested / Earned |
| `journal.biggestBatch` / `.bestDay` | Biggest batch / Best day |
| `toast.honeyDiscovered` | New honey: {honey}! |

---

## 8. Testing

New sim code is written test-first, as in sub-projects 1 and 2.

### 8.1 Unit tests (vitest, headless)

- **Registry:** exactly one `rules` block; unknown flower on a source; honey without a price; empty or invalid `blooms`; threshold outside (0.5, 1]; the bees pack passes.
- **Calendar:** 7-day season and 28-day year boundaries; `seasonChanged` fires exactly once per season, after `dayStarted`.
- **Layout cache:**
  - clump with two same-flower neighbors, including dormant ones; no clump with different flowers;
  - water-side next to a lake tile and next to a pond;
  - crowding reduces the cap by 25%;
  - the map changes when the season changes and when an entity is placed or removed; `'any'` has no dormant shares.
- **Production:**
  - the cap is split proportionally between flowers;
  - adds are scaled to fit the remaining capacity; `producerFull` fires once;
  - a day in 600 ticks matches `min(capacity, s₀ + rate·t)` per flower within ε;
  - dormant beds add nothing.
- **Batch:** exactly 70% is pure; 69.9% becomes wildflower; ties go to registry order; an empty store does nothing; collection by the worker and by `remove` both classify.
- **Economy:** full refund for a bed removed in winter, 50% otherwise and for non-sources; the safety net does not fire in a winter with beds, and still fires in a real dead end.
- **Journal:** discovery once per honey; best purity recorded under the dominant flower for a mixed batch; sales add coins; `rollDay` keeps the best day.
- **Preview:** `self` and `neighbors` for a bed completing a clump, a pond next to beds, and a hive next to a hive.
- **Save:** v1 and v2 fixtures migrate to v3; v3 round-trips; every invalid store and journal field is rejected; the dry-run tick passes.
- **Replay:** the same seed and command log give the same final state.
- **Balance bot v2:** the year run meets §1 criterion 2.

### 8.2 Render and UI (jsdom + three)

- **Bed layer:** instance counts per flower and state; a season change moves beds between the bloom and rest meshes; sync no longer creates bed objects.
- **Flower art:** all 6 × 2 variants build non-empty geometry.
- **Badges:** flower color variable, the striped class below the threshold, neutral when empty.
- **Preview layer:** chips and markers appear for given effects and clear when placement ends.
- **UI:** Shop groups and season dots; a Market row per discovered or stocked honey and selling each type; popover texts in §7.5; the season-end chip on day 7 and not on day 6; the banner on `seasonChanged`; Journal cards before and after discovery; the honey pill breakdown; floater texts (never "+0.0 kg").

### 8.3 End-to-end (Playwright, `e2e/seasons.spec.ts`)

1. Advance to day 7: the season-end chip is visible.
2. Advance to day 8: the summer banner shows, and lavender beds are blooming (checked through `window.__game`).
3. Enter build mode with a clover bed and hover a hex next to two clover beds: the "+50% clump" chip is shown.
4. Fill a clover hive, harvest it and let the beekeeper collect: the "New honey: Clover!" toast shows and the Journal's clover card is filled in.
5. Performance: with the starting plot full of mixed beds, the render budget holds and beds add at most 12 draw calls.

### 8.4 Dev tools

`window.__game` gains `season()` (current season and day) for tests. Existing `advance` covers time travel.

### 8.5 Gates

1. **Flower art gate** (§6.6), before M6.4.
2. **Playtest gate**, before merge: the user plays a full year at 1x and confirms the pure-vs-steady choice is felt. Balance numbers may be adjusted here.

---

## 9. Error handling (additions)

| Failure | Response |
|---|---|
| Save with an unknown flower in a store, a store over capacity, or a malformed journal | Handled like any corrupt save: backup, fresh game, toast |
| Floating-point drift pushing a store past capacity | Adds are scaled to the remaining room in the tick; validation allows 1e-6 |
| Invalid `rules` or flowers in content | Throws at startup in dev; tests keep it out of production |
| A honey resource without a price | Rejected by the registry |
| `previewEffects` called for an invalid placement | Not called; the ghost shows the rejection reason as before |

---

## 10. Hooks for later sub-projects

- **Market saturation and orders (sub-project 4):** `sell` already records per-type coins; orders read `reg.honeys` and the inventory.
- **Extractor (sub-project 5):** `purityThreshold(state, reg)` is the one place the threshold is read.
- **Hive levels (sub-project 5):** `capByProducer` and the producer's capacity become level-aware in the range map and `storeTotal` checks.
- **Hive tool (sub-project 5):** reuses `collectBatch` for each extra hive.
- **Land (sub-project 5):** natural lakes on bought parcels feed the same water-side rule.
- **Second production chain:** new flowers and producers are content; the purity, boost and Journal code is generic.

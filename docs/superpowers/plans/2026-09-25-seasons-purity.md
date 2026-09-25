# Seasons and Purity (Sub-project 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch on the layout puzzle: six flower types that bloom only in their seasons, honey purity decided per harvested batch, three previewable synergies (clump, water-side, crowding), a placeable pond, 7-day seasons with winter replanting, and the Honey Journal.

**Architecture:**
- Flowers and the rule numbers are **content** (`FlowerDef`, `RulesDef` in the bees pack). `Season` moves into `content/` so flowers can declare when they bloom.
- The sim keeps its **layout cache** (`getRangeMap`), now keyed by entity ids **and season**. It also stores each bed's boost and each hive's cap after crowding. Neighbor queries live in a new `sim/layout.ts`, shared with the build preview (`sim/preview.ts`).
- A hive's store becomes **kg per flower**. When a batch is collected (by the walking beekeeper or by removal), `sim/batch.ts` classifies it as pure or mixed. `sim/journal.ts` records discoveries and records.
- Rendering adds an **instanced bed layer** (one mesh per flower × bloom/rest), six procedural flower shapes, a pond, flower-colored badges and a preview layer for bonus chips.
- UI adds the season chip, season banner, Shop groups, Market color dots, richer popovers and the Journal panel.
- Save version **3** migrates version 1 and 2 saves.

**Tech Stack:** Node 22, Vite 8, TypeScript 6.0, Three.js 0.186, Vitest 5 (+ jsdom), ESLint 10 + typescript-eslint 8, Playwright 1.63. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-25-seasons-purity-design.md`. Read it before starting; this plan argues from it. The rules and numbers come from the game rules v2 spec (`2026-09-25-game-rules-design.md`, PR #3). The sub-project 1 and 2 specs still apply wherever these are silent.

**Written against:** `feat/life-and-juice` at commit `4b124ae` (sub-project 2, Task 18 of 21). Task 0 re-checks every interface this plan edits once PR #2 has merged.

## Global Constraints

Every task implicitly includes these requirements.

- Every sub-project 1 and 2 constraint still holds:
  - No image, audio or model files in `src/` or `public/`.
  - Layer rule `core ← content ← sim ← game → render, ui`, plus the `audio/` rule from sub-project 2.
  - `core/`, `content/` and `sim/` never import `three` or touch DOM globals.
  - `render/` and `ui/` never import `game/` and never mutate `GameState`.
  - Every user-visible string goes through `t()` / `tx()` with a key in `src/ui/strings/en.ts`.
  - `npm run check` = `tsc --noEmit` + `eslint .` + `vitest run`, and it must be green at the end of every task.
- **Calendar:** 600 ticks per day (60 s at 1x). `DAYS_PER_SEASON = 7`, a year is 28 days. Seasons in order: spring, summer, autumn, winter.
- **Flowers (bees pack):**

  | Flower | Bed id | Cost | Nectar/day | Blooms | Honey | Price/kg |
  |---|---|---|---|---|---|---|
  | wildflower | `bed_wildflower` | 20 | 1 | spring, summer, autumn | `honey_wildflower` | 15 |
  | clover | `bed_clover` | 25 | 1 | spring, summer | `honey_clover` | 20 |
  | lavender | `bed_lavender` | 40 | 1 | summer | `honey_lavender` | 30 |
  | heather | `bed_heather` | 35 | 1 | autumn | `honey_heather` | 25 |
  | sunflower | `bed_sunflower` | 30 | 1.5 | summer, autumn | `honey_sunflower` | 18 |
  | snowdrop | `bed_snowdrop` | 60 | 0.5 | winter | `honey_snowdrop` | 45 |

  Every bed: `allowedTiles: ['grass']`, `setsTile: 'soil'`, `walkable: true`, purchasable, removable. Registry order is the order above.
- **Pond:** `pond`, cost 80, grass only, `setsTile: 'water'`, not walkable, purchasable, removable.
- **Rules block:** `purityThreshold: 0.7`, `clump: { minNeighbors: 2, bonus: 0.5 }`, `waterSide: { bonus: 0.5 }`, `crowding: { penalty: 0.25 }`, `winterSourceRefund: 1`.
- **Hive** (unchanged): cost 120, range 1, max intake 4 nectar/day, 0.25 kg per nectar, capacity 5 kg. `producer.output = 'honey_wildflower'` is the honey a **mixed** batch becomes.
- **Purity:** a batch is pure when its dominant flower is ≥ the threshold of the batch (with a 1e-9 tolerance so exactly 70% counts). Ties for dominant go to registry order.
- **Save:** `SAVE_VERSION = 3`, key `hive-foundation.save`. Migrations 1 → 2 (sub-project 2) → 3 (this plan).
- **Tick order:** production → worker → clock → on a day start: `dayStarted` → `seasonChanged` (first day of a season) → `rollDay` → safety net.
- **Draw calls:** beds use at most 12 `InstancedMesh`es; the whole scene stays under 100 draw calls (the sub-project 1 budget).
- **Flower CSS colors** (`src/base.css`, `:root`): `--flower-wildflower: #f2b53a`, `--flower-clover: #e98fb0`, `--flower-lavender: #9b7fd1`, `--flower-heather: #d96fa5`, `--flower-sunflower: #f5c518`, `--flower-snowdrop: #8fb4c9`.
- **Minus sign** in user-visible text is U+2212 (`−`), as in sub-project 2.

## Review Focus

The five inputs the spec implies that are easiest to get wrong. Each has a test pinned in the task named.

1. **Loading a sub-project 2 save made on day 40 with honey in a hive.** It loads on Year 1, spring, day 1; the honey is kept as wildflower; the beekeeper's queue survives. Task 5 (v2 fixture).
2. **A hive filling to capacity from several flowers at once.** It stops exactly at capacity (never above), `producerFull` fires once, and the badge reads 100%. Task 5 (sim), Task 13 (badge).
3. **Removing a bed in winter.** The refund is the full cost, and the popover's Remove button shows that same number. Task 7 (sim), Task 18 (popover).
4. **Winter with beds but no coins and no honey.** Not a dead end: the safety net stays quiet, and the dead-end fuzz still passes over a whole year. Task 7.
5. **A pond that would wall a hive off from the beekeeper.** Rejected with `blocks_path`, like any other non-walkable building. Task 3.

## Spec Deltas

Small, deliberate differences from the spec, listed so a reviewer does not flag them as drift.

1. **`honeyDiscovered` carries `hex`** (`{ resource, hex }`), so the discovery floater can anchor at the hive without the UI remembering the previous event.
2. **The Market lists rows for honey in stock**, as it does today, not for discovered honey with nothing left. An empty row has nothing to sell. The migration case the spec mentions (old wildflower honey before any new-style harvest) is covered because stock is enough.
3. **`calendar()` gains `dayOfYear`**, and the HUD shows "Day {dayOfYear} · Year {year}". With 28-day years, "Day 30 · Year 2" would be confusing. The Journal uses the same day of year.
4. **`registerDefaultArt(reg)` takes the registry**, so every buildable with a `source` gets a bed factory without the art registry hard-coding flower ids.
5. **The "beds add at most 12 draw calls" check is a unit test** (`BedLayer` never holds more than 12 meshes) plus an e2e check that the whole scene stays under 100 calls with a full plot, as sub-project 2 did for bees. Each mesh also draws in the shadow pass, so an e2e delta would count double.
6. **`refundFor(reg, def, season)`** replaces `refundFor(def)`; the winter rate lives in `reg.rules`.
7. **`isFull(entity, capacity)`** with a 1e-9 tolerance decides "full" everywhere (sim, badges, bees). Summing per-flower floats can land a hair under capacity.
8. **New module `sim/layout.ts`** (neighbor queries and `boostFor`), shared by the range map and `previewEffects`. The spec's module list does not name it.
9. **`EntitySync` takes a `skip` predicate**, so beds get no per-entity object while their tiles still refresh.
10. **`harvested.dominant` and `harvested.purity` are required fields.** Test literals that build `harvested` events gain `dominant: 'wildflower', purity: 1`.
11. **A mixed badge is striped with cream**, not with the wildflower color, so the stripes still show when the dominant flower is wildflower itself. The flower art gate can change it.
12. **Honey floaters keep their amber text** and show the flower's color as an underline (harvest) or a ring (discovery). Pale snowdrop text would not be readable on the cream floater.
13. **A new honey plays the existing `chime` cue** (sub-project 2 audio), the celebration sound the rules spec asks for; the sub-project 3 spec did not list one.

## File Map

```
src/content/types.ts registry.ts packs/bees.ts               SEASONS moved in, FlowerDef, RulesDef, lookups, six flowers, pond
src/sim/clock.ts advance.ts events.ts state.ts entities.ts   7-day seasons, seasonChanged, store record, journal, v3
src/sim/layout.ts                         NEW   neighbor queries, boostFor, crowdedCap
src/sim/production.ts                     range map v2, storeTotal, isFull, intakeByFlower, per-flower tick
src/sim/batch.ts                          NEW   classifyBatch, collectBatch, purityThreshold
src/sim/journal.ts                        NEW   emptyJournal, recordBatch, recordSale, rollDay
src/sim/preview.ts                        NEW   previewEffects
src/sim/economy.ts commands.ts worker.ts  winter refund, safety net 'any', collectBatch
src/game/save.ts                          v2 -> v3 migration, store and journal validation
src/game/controller.ts devtools.ts        preview wiring, J key, season(), showcase()
src/render/art/flowerbed.ts pond.ts palette.ts registry.ts   six shapes × bloom/rest, pond, colors, registerDefaultArt(reg)
src/render/beds.ts                        NEW   instanced bed layer
src/render/preview.ts                     NEW   preview chips and neighbor markers
src/render/sync.ts badges.ts bees.ts view.ts                 skip beds, flower badges, isFull, wiring
src/ui/hud.ts banner.ts(NEW) toolbar.ts inspect.ts feedback.ts app.ts icons.ts
src/ui/panels/shop.ts market.ts journal.ts(NEW)
src/ui/strings/en.ts styles.css src/base.css src/main.ts src/audio/cues.ts
tests/sim/{layout,batch,journal,preview}.test.ts, tests/render/beds.test.ts, tests/render/preview.test.ts,
tests/ui/{banner,journal}.test.ts, tests/fixtures/save-v2.json, e2e/seasons.spec.ts   NEW
```

## Milestones

| Milestone | Tasks | Ends with |
|---|---|---|
| Re-sync | 0 | Branch rebased on `main` after PR #2 merged; interfaces confirmed |
| M6.1 Content and calendar | 1–3 | Seasons, flowers, rules, pond in the content and the Shop |
| M6.2 Production v2 | 4–10 | Boosts, dormancy, per-flower stores, purity, winter rules, Journal, preview effects, balance bot v2 |
| M6.3 Flower art | 11–14 | Six flowers, bed layer, flower badges, **flower art gate** (Task 14) |
| M6.4 UI | 15–22 | HUD, banner, panels, popovers, feedback, Journal, preview chips, e2e |
| M6.5 Playtest | 23 | **Playtest gate** and wrap-up |

Tasks 14 and 23 are **human gates**. Stop and wait for the user's sign-off before continuing past them.

---

### Task 0: Re-sync with `main` after PR #2 merges

This plan was written while sub-project 2 was at Task 18 of 21. Its code must build on the merged version.

**Files:** none changed (unless the checks below find drift).

- [ ] **Step 1: Confirm PR #2 has merged**

Run: `gh pr view 2 --json state -q .state`
Expected: `MERGED`. If it prints anything else, stop and tell the user; this plan cannot start yet.

- [ ] **Step 2: Rebase this branch onto `main`**

```bash
git fetch origin
git rebase origin/main
npm ci
npm run check
```

Expected: the rebase applies cleanly (this branch only adds docs), and `npm run check` is green.

- [ ] **Step 3: Confirm the interfaces this plan edits**

Run each command and compare with the expectation. If anything differs, adapt the named task's edits to the real code and note the difference in that task's commit message.

```bash
grep -n "function collect" src/sim/worker.ts          # Task 5/6: collect(state, reg, id, events) exists
grep -rn "refundFor(" src | grep -v "^src/sim/economy.ts"   # Task 7: callers in sim/commands.ts and ui/inspect.ts only
grep -rn "registerDefaultArt(" src tests               # Task 3: main.ts + 5 render test files
grep -rnE "store \?\?|\.store\b" src                   # Task 5: the 13 read sites listed in Task 5
grep -n "sharesByProducer" src/render/bees.ts          # Task 4: bees read nectarPerDay weights from the range map
grep -n "openMarket" src/ui/toolbar.ts src/ui/app.ts   # Task 20: toolbar actions object
grep -n "export function installDevTools" src/game/devtools.ts   # Tasks 14, 22: (session, view, audio) signature
grep -n "case 'sold'" src/audio/cues.ts             # Task 19: sold shares the chime cue
```

- [ ] **Step 4: No commit**

Nothing changed. If Step 3 forced edits to this plan, commit the plan: `git commit -am "docs: re-sync the sub-project 3 plan with merged sub-project 2"`.

---

## M6.1 — Content and calendar

### Task 1: Seasons in content, 7-day calendar, `seasonChanged`

**Files:**
- Modify: `src/content/types.ts` (add `SEASONS`, `Season`)
- Modify: `src/sim/clock.ts`
- Modify: `src/sim/events.ts`
- Modify: `src/sim/advance.ts`
- Modify: `src/ui/hud.ts:78-82` (day of year)
- Test: `tests/sim/clock.test.ts`, `tests/sim/advance.test.ts`, `tests/ui/hud.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `content/types.ts`: `export const SEASONS = ['spring','summer','autumn','winter'] as const; export type Season = (typeof SEASONS)[number];`
  - `sim/clock.ts`: re-exports `SEASONS` and `Season`; `DAYS_PER_SEASON = 7`; `DAYS_PER_YEAR = 28`; `CalendarInfo { day; dayOfYear; season; year; dayProgress }`; `seasonAt(tick): Season`; `isFirstDayOfSeason(tick): boolean`; `isLastDayOfSeason(tick): boolean`; `nextSeason(season): Season`.
  - `GameEvent` gains `{ type: 'seasonChanged'; season: Season; year: number }`.

- [ ] **Step 1: Write the failing tests**

Replace the body of `tests/sim/clock.test.ts` below the `'agrees with the game loop on tick length'` test with:

```ts
  it('starts on day 1 of spring, year 1', () => {
    expect(calendar(0)).toEqual({ day: 1, dayOfYear: 1, season: 'spring', year: 1, dayProgress: 0 });
  });

  it('rolls 7-day seasons and 28-day years', () => {
    expect(calendar(599).day).toBe(1);
    expect(calendar(599).dayProgress).toBeCloseTo(599 / 600);
    expect(calendar(600).day).toBe(2);
    expect(calendar(7 * 600)).toMatchObject({ day: 8, dayOfYear: 8, season: 'summer', year: 1 });
    expect(calendar(14 * 600)).toMatchObject({ day: 15, season: 'autumn' });
    expect(calendar(21 * 600)).toMatchObject({ day: 22, season: 'winter' });
    expect(calendar(27 * 600 + 599)).toMatchObject({ day: 28, dayOfYear: 28, season: 'winter', year: 1 });
    expect(calendar(28 * 600)).toMatchObject({ day: 29, dayOfYear: 1, season: 'spring', year: 2 });
  });

  it('knows the first and last day of each season', () => {
    expect(isFirstDayOfSeason(0)).toBe(true);
    expect(isFirstDayOfSeason(600)).toBe(false);
    expect(isLastDayOfSeason(5 * 600)).toBe(false);
    expect(isLastDayOfSeason(6 * 600)).toBe(true);
    expect(isFirstDayOfSeason(7 * 600)).toBe(true);
    expect(isLastDayOfSeason(27 * 600)).toBe(true);
    expect(seasonAt(21 * 600)).toBe('winter');
    expect(nextSeason('autumn')).toBe('winter');
    expect(nextSeason('winter')).toBe('spring');
  });

  it('detects day boundaries', () => {
    expect(isDayStart(0)).toBe(true);
    expect(isDayStart(600)).toBe(true);
    expect(isDayStart(601)).toBe(false);
  });
```

Change the import line to:

```ts
import {
  DT_DAYS, TICKS_PER_DAY, TICKS_PER_SECOND, calendar, isDayStart, isFirstDayOfSeason, isLastDayOfSeason, nextSeason, seasonAt,
} from '../../src/sim/clock';
```

Add to `tests/sim/advance.test.ts`, inside `describe('advance', …)`:

```ts
  it('announces each new season once, right after its first dayStarted', () => {
    const state = newGame(1);
    const events = advance(state, reg, 28 * TICKS_PER_DAY);
    expect(events.filter((e) => e.type === 'seasonChanged')).toEqual([
      { type: 'seasonChanged', season: 'summer', year: 1 },
      { type: 'seasonChanged', season: 'autumn', year: 1 },
      { type: 'seasonChanged', season: 'winter', year: 1 },
      { type: 'seasonChanged', season: 'spring', year: 2 },
    ]);
    const first = events.findIndex((e) => e.type === 'seasonChanged');
    expect(events[first - 1]).toEqual({ type: 'dayStarted', day: 8, season: 'summer', year: 1 });
  });
```

In `tests/ui/hud.test.ts`, in `'shows coins, honey and the calendar, and keeps them current'`, replace:

```ts
    state.clock.tick = 600 * 29 + 300;
```
with
```ts
    state.clock.tick = 600 * 9 + 300;
```
and replace `expect(text(hud.el, 'day')).toBe('Day 30 · Year 1');` with `expect(text(hud.el, 'day')).toBe('Day 10 · Year 1');`. Then add a second check at the end of that test:

```ts
    state.clock.tick = 600 * 29;
    hud.update();
    expect(text(hud.el, 'season')).toBe('Spring');
    expect(text(hud.el, 'day')).toBe('Day 2 · Year 2');
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/sim/clock.test.ts tests/sim/advance.test.ts tests/ui/hud.test.ts`
Expected: FAIL. `isFirstDayOfSeason` is not exported, `dayOfYear` is missing, no `seasonChanged` events, and the HUD shows "Day 30 · Year 2".

- [ ] **Step 3: Move `SEASONS` into content**

Add to `src/content/types.ts`, above `ResourceId`:

```ts
/** The four seasons in calendar order. Lives in content so flowers can say when they bloom. */
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];
```

- [ ] **Step 4: Rewrite `src/sim/clock.ts`**

```ts
import { SEASONS, type Season } from '../content/types';

export { SEASONS };
export type { Season };

/** Sim ticks per real second at 1x speed. */
export const TICKS_PER_SECOND = 10;
/** One in-game day lasts 60 real seconds at 1x. */
export const TICKS_PER_DAY = 600;
/** In-game days per tick. */
export const DT_DAYS = 1 / TICKS_PER_DAY;
/** Rules spec §6.1: 7-day seasons, so one year (one chapter) is about 28 minutes at 1x. */
export const DAYS_PER_SEASON = 7;
export const DAYS_PER_YEAR = DAYS_PER_SEASON * SEASONS.length;

export interface CalendarInfo {
  /** Days since the game started, from 1. */
  day: number;
  /** 1..28 within the current year. */
  dayOfYear: number;
  season: Season;
  year: number;
  dayProgress: number;
}

export function calendar(tick: number): CalendarInfo {
  const day = Math.floor(tick / TICKS_PER_DAY) + 1;
  const dayOfYear = ((day - 1) % DAYS_PER_YEAR) + 1;
  return {
    day,
    dayOfYear,
    season: SEASONS[Math.floor((dayOfYear - 1) / DAYS_PER_SEASON)],
    year: Math.floor((day - 1) / DAYS_PER_YEAR) + 1,
    dayProgress: (tick % TICKS_PER_DAY) / TICKS_PER_DAY,
  };
}

export function isDayStart(tick: number): boolean {
  return tick % TICKS_PER_DAY === 0;
}

export const seasonAt = (tick: number): Season => calendar(tick).season;

export function isFirstDayOfSeason(tick: number): boolean {
  return (calendar(tick).dayOfYear - 1) % DAYS_PER_SEASON === 0;
}

/** The HUD's "season ends tomorrow" day (spec §5.4). */
export function isLastDayOfSeason(tick: number): boolean {
  return calendar(tick).dayOfYear % DAYS_PER_SEASON === 0;
}

export function nextSeason(season: Season): Season {
  return SEASONS[(SEASONS.indexOf(season) + 1) % SEASONS.length];
}
```

- [ ] **Step 5: Add the event and emit it**

In `src/sim/events.ts`, add to the `GameEvent` union after `dayStarted`:

```ts
  | { type: 'seasonChanged'; season: Season; year: number }
```

In `src/sim/advance.ts`, change the clock import to `import { DT_DAYS, calendar, isDayStart, isFirstDayOfSeason } from './clock';` and replace the day-start block with:

```ts
    if (isDayStart(state.clock.tick)) {
      const { day, season, year } = calendar(state.clock.tick);
      events.push({ type: 'dayStarted', day, season, year });
      if (isFirstDayOfSeason(state.clock.tick)) events.push({ type: 'seasonChanged', season, year });
      const grant = applySafetyNet(state, reg);
      if (grant) events.push(grant);
    }
```

- [ ] **Step 6: Show the day of the year in the HUD**

In `src/ui/hud.ts`, in `update()`, replace `setText(day, t('hud.dayYear', { day: cal.day, year: cal.year }));` with:

```ts
      setText(day, t('hud.dayYear', { day: cal.dayOfYear, year: cal.year }));
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/sim/clock.test.ts tests/sim/advance.test.ts tests/ui/hud.test.ts`
Expected: PASS.

- [ ] **Step 8: Run the full check**

Run: `npm run check`
Expected: PASS. If a `switch` over `GameEvent` somewhere is exhaustive (a `never` check), add a `case 'seasonChanged':` that returns what its `default` returns.

- [ ] **Step 9: Commit**

```bash
git add src/content/types.ts src/sim/clock.ts src/sim/events.ts src/sim/advance.ts src/ui/hud.ts tests/sim/clock.test.ts tests/sim/advance.test.ts tests/ui/hud.test.ts
git commit -m "feat(sim): 7-day seasons, 28-day years and a seasonChanged event"
```

---

### Task 2: Flowers and rules in content, registry lookups and validation

**Files:**
- Modify: `src/content/types.ts`
- Modify: `src/content/registry.ts`
- Modify: `src/content/packs/bees.ts` (wildflower flower + rules block, so the default packs stay valid)
- Test: `tests/content/registry.test.ts`

**Interfaces:**
- Consumes: `SEASONS`, `Season` (Task 1).
- Produces:
  - `FlowerDef { id: string; honey: ResourceId; blooms: Season[] }`
  - `RulesDef { purityThreshold; clump: { minNeighbors; bonus }; waterSide: { bonus }; crowding: { penalty }; winterSourceRefund }`
  - `ContentPack.flowers?: FlowerDef[]`, `ContentPack.rules?: RulesDef`
  - `Registry`: `flowers: Map<string, FlowerDef>` (registry order), `get rules(): RulesDef`, `findRules()`, `flower(id): FlowerDef` (throws `Unknown flower "<id>"`), `flowerByHoney(resource): FlowerDef | undefined`, `blooms(flowerId, season: Season | 'any'): boolean`, `get honeys(): ResourceId[]`.

- [ ] **Step 1: Write the failing tests**

In `tests/content/registry.test.ts`, extend `validPack()` so it stays valid under the new rules. Add these two properties to the returned object (after `prices`):

```ts
    flowers: [{ id: 'berry', honey: 'jam', blooms: ['summer'] }],
    rules: { purityThreshold: 0.7, clump: { minNeighbors: 2, bonus: 0.5 }, waterSide: { bonus: 0.5 }, crowding: { penalty: 0.25 }, winterSourceRefund: 1 },
```

Add inside `describe('validateRegistry', …)`:

```ts
  it('flags a source whose flower is not registered', () => {
    const p = validPack();
    p.buildables[1].source!.flowerType = 'tulip';
    expect(problemsFor(p).join('\n')).toContain('source flowerType "tulip" is not a flower');
  });

  it('flags a flower whose honey has no resource or no price', () => {
    const p = validPack();
    p.flowers = [{ id: 'berry', honey: 'jam', blooms: ['summer'] }, { id: 'rose', honey: 'rosewater', blooms: ['spring'] }];
    p.prices = [];
    const text = problemsFor(p).join('\n');
    expect(text).toContain('flower "berry": honey "jam" has no price');
    expect(text).toContain('flower "rose": honey "rosewater" is not a resource');
  });

  it('flags empty or unknown bloom seasons', () => {
    const p = validPack();
    p.flowers = [{ id: 'berry', honey: 'jam', blooms: [] }, { id: 'rose', honey: 'jam', blooms: ['monsoon' as never] }];
    const text = problemsFor(p).join('\n');
    expect(text).toContain('flower "berry": blooms is empty');
    expect(text).toContain('flower "rose": unknown season "monsoon"');
  });

  it('requires a rules block with sane numbers', () => {
    const missing = validPack();
    delete missing.rules;
    expect(problemsFor(missing).join('\n')).toContain('Missing rules');
    const bad = validPack();
    bad.rules = { purityThreshold: 0.5, clump: { minNeighbors: 0, bonus: -1 }, waterSide: { bonus: -0.1 }, crowding: { penalty: 1 }, winterSourceRefund: 2 };
    const text = problemsFor(bad).join('\n');
    expect(text).toContain('purityThreshold must be above 0.5 and at most 1');
    expect(text).toContain('clump.minNeighbors must be a positive integer');
    expect(text).toContain('clump.bonus must be zero or more');
    expect(text).toContain('waterSide.bonus must be zero or more');
    expect(text).toContain('crowding.penalty must be at least 0 and below 1');
    expect(text).toContain('winterSourceRefund must be between 0 and 1');
  });
```

Add inside `describe('Registry', …)`:

```ts
  it('refuses a second rules block and duplicate flowers', () => {
    const reg = new Registry();
    reg.registerPack(validPack());
    const again: ContentPack = { id: 'more', resources: [], buildables: [], prices: [], rules: validPack().rules };
    expect(() => reg.registerPack(again)).toThrow('Only one rules block is supported');
    const dupe: ContentPack = { id: 'dupe', resources: [], buildables: [], prices: [], flowers: validPack().flowers };
    expect(() => reg.registerPack(dupe)).toThrow('Duplicate flower id "berry"');
  });

  it('answers flower lookups', () => {
    const reg = createRegistry([validPack()]);
    expect(reg.flower('berry').honey).toBe('jam');
    expect(() => reg.flower('rose')).toThrow('Unknown flower "rose"');
    expect(reg.flowerByHoney('jam')?.id).toBe('berry');
    expect(reg.flowerByHoney('coins')).toBeUndefined();
    expect(reg.blooms('berry', 'summer')).toBe(true);
    expect(reg.blooms('berry', 'winter')).toBe(false);
    expect(reg.blooms('berry', 'any')).toBe(true);
    expect(reg.honeys).toEqual(['jam']);
    expect(reg.rules.purityThreshold).toBe(0.7);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/content/registry.test.ts`
Expected: FAIL (type errors on `flowers` / `rules`, missing lookups).

- [ ] **Step 3: Add the types**

In `src/content/types.ts`, add after `SourceDef`:

```ts
/** A flower a bed can grow. Its nectar becomes this honey when a batch is pure (spec §5.7). */
export interface FlowerDef {
  id: string;
  honey: ResourceId;
  blooms: Season[];
}

/** The layout-puzzle numbers (rules spec §5.3). Exactly one pack defines them. */
export interface RulesDef {
  /** Share of a batch one flower needs for the batch to count as pure. Above 0.5 so only one flower can reach it. */
  purityThreshold: number;
  clump: { minNeighbors: number; bonus: number };
  waterSide: { bonus: number };
  /** Share of a hive's intake cap lost when another hive stands next to it. */
  crowding: { penalty: number };
  /** Refund rate for sources removed in winter (the usual rate is 50%). */
  winterSourceRefund: number;
}
```

Add to `ContentPack`, after `prices`:

```ts
  flowers?: FlowerDef[];
  rules?: RulesDef;
```

- [ ] **Step 4: Register, look up and validate**

In `src/content/registry.ts`:

1. Extend the type import: add `SEASONS, type FlowerDef, type RulesDef, type Season` to the list imported from `./types`.
2. Add fields to `Registry`, after `prices`:

```ts
  readonly flowers = new Map<string, FlowerDef>();
  private rulesDef: RulesDef | undefined;
```

3. In `registerPack`, after the prices loop:

```ts
    for (const f of pack.flowers ?? []) {
      if (this.flowers.has(f.id)) throw new Error(`Duplicate flower id "${f.id}" in pack "${pack.id}"`);
      this.flowers.set(f.id, f);
    }
    if (pack.rules) {
      if (this.rulesDef) throw new Error(`Only one rules block is supported: pack "${pack.id}" would be a second`);
      this.rulesDef = pack.rules;
    }
```

4. Add methods after `findWorker()`:

```ts
  /** The layout-puzzle numbers. Validation guarantees they exist. */
  get rules(): RulesDef {
    if (!this.rulesDef) throw new Error('No rules registered');
    return this.rulesDef;
  }

  findRules(): RulesDef | undefined {
    return this.rulesDef;
  }

  flower(id: string): FlowerDef {
    const f = this.flowers.get(id);
    if (!f) throw new Error(`Unknown flower "${id}"`);
    return f;
  }

  flowerByHoney(resource: ResourceId): FlowerDef | undefined {
    for (const f of this.flowers.values()) if (f.honey === resource) return f;
    return undefined;
  }

  /** Whether a flower is in bloom. `'any'` treats every flower as blooming (the safety net's view). */
  blooms(flowerId: string, season: Season | 'any'): boolean {
    return season === 'any' || this.flower(flowerId).blooms.includes(season);
  }

  /** Every honey a flower can make, in registry order. "Honey" in the UI means these. */
  get honeys(): ResourceId[] {
    return [...this.flowers.values()].map((f) => f.honey);
  }
```

5. In `validateRegistry`, inside the buildables loop, replace the `b.source` line with:

```ts
    if (b.source) {
      if (!isPositive(b.source.yieldPerDay)) problems.push(`${where}: source yieldPerDay must be a positive number`);
      if (!reg.flowers.has(b.source.flowerType)) problems.push(`${where}: source flowerType "${b.source.flowerType}" is not a flower`);
    }
```

6. In `validateRegistry`, before the worker checks, add:

```ts
  for (const f of reg.flowers.values()) {
    const where = `flower "${f.id}"`;
    if (!reg.resources.has(f.honey)) problems.push(`${where}: honey "${f.honey}" is not a resource`);
    else if (!reg.price(f.honey)) problems.push(`${where}: honey "${f.honey}" has no price`);
    if (f.blooms.length === 0) problems.push(`${where}: blooms is empty`);
    for (const s of f.blooms) if (!(SEASONS as readonly string[]).includes(s)) problems.push(`${where}: unknown season "${s}"`);
  }

  const rules = reg.findRules();
  if (!rules) {
    problems.push('Missing rules: exactly one pack must define them');
  } else {
    if (!(rules.purityThreshold > 0.5 && rules.purityThreshold <= 1)) problems.push('rules: purityThreshold must be above 0.5 and at most 1');
    if (!Number.isInteger(rules.clump.minNeighbors) || rules.clump.minNeighbors < 1) {
      problems.push('rules: clump.minNeighbors must be a positive integer');
    }
    const bonuses: [string, number][] = [['clump.bonus', rules.clump.bonus], ['waterSide.bonus', rules.waterSide.bonus]];
    for (const [name, v] of bonuses) if (!(Number.isFinite(v) && v >= 0)) problems.push(`rules: ${name} must be zero or more`);
    if (!(rules.crowding.penalty >= 0 && rules.crowding.penalty < 1)) problems.push('rules: crowding.penalty must be at least 0 and below 1');
    if (!(rules.winterSourceRefund >= 0 && rules.winterSourceRefund <= 1)) problems.push('rules: winterSourceRefund must be between 0 and 1');
  }
```

- [ ] **Step 5: Keep the default packs valid**

In `src/content/packs/bees.ts`, add after `prices`:

```ts
  flowers: [{ id: 'wildflower', honey: 'honey_wildflower', blooms: ['spring', 'summer', 'autumn'] }],
  // Rules spec §5.3. Starting values for the balance bot.
  rules: {
    purityThreshold: 0.7,
    clump: { minNeighbors: 2, bonus: 0.5 },
    waterSide: { bonus: 0.5 },
    crowding: { penalty: 0.25 },
    winterSourceRefund: 1,
  },
```

(The other five flowers arrive in Task 3. Nothing reads `blooms` or `rules` yet.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/content/registry.test.ts`
Expected: PASS.

- [ ] **Step 7: Run the full check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/content tests/content/registry.test.ts
git commit -m "feat(content): flowers with bloom seasons and a rules block, with registry lookups and validation"
```

---

### Task 3: Six flowers, their honeys and the pond in the bees pack

**Files:**
- Modify: `src/content/packs/bees.ts`
- Modify: `src/ui/strings/en.ts`
- Create: `src/render/art/pond.ts`
- Modify: `src/render/art/palette.ts`
- Modify: `src/render/art/registry.ts` (`registerDefaultArt(reg)`)
- Modify: `src/main.ts` (call site)
- Modify: `tests/render/art.test.ts`, `tests/render/badges.test.ts`, `tests/render/ghost.test.ts`, `tests/render/sync.test.ts`, `tests/render/walker.test.ts` (call sites)
- Test: `tests/content/registry.test.ts`, `tests/sim/state.test.ts`, `tests/ui/panels.test.ts`, `tests/sim/commands.test.ts`, `tests/render/art.test.ts`

**Interfaces:**
- Consumes: `FlowerDef`, `RulesDef`, `Registry.flowers` (Task 2).
- Produces:
  - Buildables `bed_clover`, `bed_lavender`, `bed_heather`, `bed_sunflower`, `bed_snowdrop`, `pond`; resources and prices for five more honeys.
  - `registerDefaultArt(reg: Registry): void`
  - `makePond(): THREE.BufferGeometry` in `render/art/pond.ts`
  - Strings `flower.<id>` for all six flowers (used from Task 15 on).

- [ ] **Step 1: Write the failing tests**

In `tests/content/registry.test.ts`, replace the whole `describe('default packs', …)` body with:

```ts
  it('are valid and match the spec starting setup', () => {
    const reg = createRegistry(DEFAULT_PACKS);
    expect(reg.purchasable().map((b) => b.id)).toEqual([
      'hive', 'bed_wildflower', 'bed_clover', 'bed_lavender', 'bed_heather', 'bed_sunflower', 'bed_snowdrop', 'pond',
    ]);
    expect(reg.cheapestSourceCost()).toBe(20);
    expect(reg.start.inventory).toEqual({ coins: 60, honey_wildflower: 0 });
    const defs = reg.start.entities.map((e) => e.def).sort();
    expect(defs).toEqual(['bed_wildflower', 'bed_wildflower', 'bed_wildflower', 'hive', 'house']);
    expect(reg.buildable('house').removable).toBe(false);
    expect(reg.worker).toEqual({ id: 'beekeeper', home: 'house', ticksPerHex: 5, workTicks: 8 });
    expect(reg.buildable('hive').walkable).toBeUndefined();
    expect(reg.start.entities.find((e) => e.def === 'house')!.hex).toEqual({ q: 0, r: -2 });
    expect([TILES.grass.walkable, TILES.soil.walkable, TILES.water.walkable]).toEqual([true, true, false]);
  });

  it('define six flowers with the spec bloom seasons, beds and prices', () => {
    const reg = createRegistry(DEFAULT_PACKS);
    const table = [...reg.flowers.values()].map((f) => {
      const bed = reg.buildable(`bed_${f.id}`);
      return [f.id, f.blooms.join('+'), bed.cost.coins, bed.source!.yieldPerDay, reg.price(f.honey)!.sell];
    });
    expect(table).toEqual([
      ['wildflower', 'spring+summer+autumn', 20, 1, 15],
      ['clover', 'spring+summer', 25, 1, 20],
      ['lavender', 'summer', 40, 1, 30],
      ['heather', 'autumn', 35, 1, 25],
      ['sunflower', 'summer+autumn', 30, 1.5, 18],
      ['snowdrop', 'winter', 60, 0.5, 45],
    ]);
    for (const f of reg.flowers.values()) {
      expect(reg.buildable(`bed_${f.id}`)).toMatchObject({ allowedTiles: ['grass'], setsTile: 'soil', walkable: true, removable: true });
    }
    expect(reg.buildable('pond')).toMatchObject({ cost: { coins: 80 }, allowedTiles: ['grass'], setsTile: 'water', purchasable: true, removable: true });
    expect(reg.buildable('pond').walkable).toBeUndefined();
    expect(reg.buildable('hive').producer!.output).toBe('honey_wildflower');
  });
```

In `tests/sim/state.test.ts`, replace `expect(state.inventory).toEqual({ coins: 60, honey_wildflower: 0 });` with:

```ts
    expect(state.inventory).toEqual({
      coins: 60, honey_wildflower: 0, honey_clover: 0, honey_lavender: 0, honey_heather: 0, honey_sunflower: 0, honey_snowdrop: 0,
    });
```

In `tests/ui/panels.test.ts`, in the Shop test, replace the `expect(items.map…)` line with:

```ts
    expect(items.map((b) => b.querySelector('.name')!.textContent)).toEqual([
      'Beehive', 'Wildflower bed', 'Clover bed', 'Lavender bed', 'Heather bed', 'Sunflower bed', 'Snowdrop bed', 'Pond',
    ]);
```

Add to `tests/sim/commands.test.ts` (inside the `describe` that covers `place`, or a new `describe('pond', …)`; `hexKey`, `ORIGIN`, `hex`, `hexNeighbors`, `spawnEntity`, `clearEntities` and `validatePlace` are already imported there, or add them to the existing imports):

```ts
describe('pond', () => {
  it('turns its tile into water, and the grass comes back when it is removed', () => {
    const state = newGame(1);
    state.inventory.coins = 500;
    const at = hex(1, -1);
    const result = dispatch(state, reg, { type: 'place', def: 'pond', hex: at });
    expect(result.ok).toBe(true);
    expect(state.tiles[hexKey(at)].tile).toBe('water');
    const pond = Object.values(state.entities).find((e) => e.def === 'pond')!;
    dispatch(state, reg, { type: 'remove', id: pond.id });
    expect(state.tiles[hexKey(at)].tile).toBe('grass');
    expect(state.inventory.coins).toBe(500 - 80 + 40);
  });

  it('is refused where it would wall a hive off from the beekeeper', () => {
    const state = newGame(1);
    clearEntities(state);
    state.worker.at = hex(-1, -1);
    spawnEntity(state, reg, 'hive', ORIGIN);
    const ring = hexNeighbors(ORIGIN);
    for (const n of ring.slice(1)) spawnEntity(state, reg, 'pond', n);
    state.inventory.coins = 500;
    expect(validatePlace(state, reg, 'pond', ring[0])).toBe('blocks_path');
  });
});
```

In `tests/render/art.test.ts`:
1. Add `import { makePond } from '../../src/render/art/pond';`.
2. Change every `registerDefaultArt();` to `registerDefaultArt(reg);`.
3. Add inside `describe('art geometry', …)`:

```ts
  it('builds a vertex-colored pond that sits on its water tile', () => {
    const g = makePond();
    expect(g.getAttribute('color').count).toBe(g.getAttribute('position').count);
    g.computeBoundingBox();
    expect(g.boundingBox!.min.y).toBeGreaterThanOrEqual(-0.15);
    const pos = g.getAttribute('position');
    let reach = 0;
    for (let i = 0; i < pos.count; i++) reach = Math.max(reach, Math.hypot(pos.getX(i), pos.getZ(i)));
    expect(reach).toBeLessThanOrEqual(0.82);
  });
```

In `tests/render/badges.test.ts`, `tests/render/ghost.test.ts`, `tests/render/sync.test.ts` and `tests/render/walker.test.ts`, change `registerDefaultArt();` to `registerDefaultArt(reg);`. Each already imports `reg` from `../sim/helpers`; if one does not, add `reg` to that import.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/content tests/sim/state.test.ts tests/sim/commands.test.ts tests/ui/panels.test.ts tests/render`
Expected: FAIL (unknown buildables, `makePond` missing, `registerDefaultArt` arity).

- [ ] **Step 3: Fill the bees pack**

In `src/content/packs/bees.ts`, replace `resources`, the `bed_wildflower` buildable, `prices` and `flowers` so the pack reads:

```ts
import type { BuildableDef, ContentPack, Season } from '../types';

/** One flower bed per flower: all grass-only, soil underneath, walkable (rules spec §5.1). */
function bed(flower: string, coins: number, yieldPerDay: number): BuildableDef {
  return {
    id: `bed_${flower}`,
    cost: { coins },
    allowedTiles: ['grass'],
    setsTile: 'soil',
    purchasable: true,
    removable: true,
    walkable: true,
    source: { kind: 'nectar', flowerType: flower, yieldPerDay },
  };
}

const FLOWERS: [id: string, blooms: Season[], bedCost: number, nectarPerDay: number, pricePerKg: number][] = [
  ['wildflower', ['spring', 'summer', 'autumn'], 20, 1, 15],
  ['clover', ['spring', 'summer'], 25, 1, 20],
  ['lavender', ['summer'], 40, 1, 30],
  ['heather', ['autumn'], 35, 1, 25],
  ['sunflower', ['summer', 'autumn'], 30, 1.5, 18],
  ['snowdrop', ['winter'], 60, 0.5, 45],
];

/** First production chain: flower beds feed hives, hives make honey. Numbers from the rules spec §5.1. */
export const beesPack: ContentPack = {
  id: 'bees',
  resources: FLOWERS.map(([id]) => ({ id: `honey_${id}`, unit: 'kg' as const })),
  buildables: [
    { id: 'house', cost: {}, allowedTiles: ['grass'], purchasable: false, removable: false },
    {
      id: 'hive',
      cost: { coins: 120 },
      allowedTiles: ['grass'],
      purchasable: true,
      removable: true,
      // `output` is what a mixed batch becomes (spec §5.1).
      producer: { consumes: 'nectar', range: 1, output: 'honey_wildflower', conversion: 0.25, capacity: 5, maxIntakePerDay: 4 },
    },
    ...FLOWERS.map(([id, , cost, nectar]) => bed(id, cost, nectar)),
    // Real water: the tile turns to water and comes back as grass on removal (spec §5.2).
    { id: 'pond', cost: { coins: 80 }, allowedTiles: ['grass'], setsTile: 'water', purchasable: true, removable: true },
  ],
  prices: FLOWERS.map(([id, , , , price]) => ({ resource: `honey_${id}`, sell: price })),
  flowers: FLOWERS.map(([id, blooms]) => ({ id, honey: `honey_${id}`, blooms })),
  // Rules spec §5.3. Starting values for the balance bot.
  rules: {
    purityThreshold: 0.7,
    clump: { minNeighbors: 2, bonus: 0.5 },
    waterSide: { bonus: 0.5 },
    crowding: { penalty: 0.25 },
    winterSourceRefund: 1,
  },
  // 2 hexes per second at 1x; 0.8 s at each hive (sub-project 2 spec §5.10).
  worker: { id: 'beekeeper', home: 'house', ticksPerHex: 5, workTicks: 8 },
  start: {
    inventory: { coins: 60, honey_wildflower: 0 },
    // Hive at the origin with beds W / E / SW. The house sits two hexes north, so the beekeeper's home
    // hex (-1,-1) is one step from the hive and the first harvest is a visible walk.
    entities: [
      { def: 'hive', hex: { q: 0, r: 0 } },
      { def: 'house', hex: { q: 0, r: -2 } },
      { def: 'bed_wildflower', hex: { q: -1, r: 0 } },
      { def: 'bed_wildflower', hex: { q: 1, r: 0 } },
      { def: 'bed_wildflower', hex: { q: -1, r: 1 } },
    ],
  },
};
```

- [ ] **Step 4: Add the strings**

In `src/ui/strings/en.ts`, after `'defDesc.house'`, add:

```ts
  'def.bed_clover': 'Clover bed',
  'def.bed_lavender': 'Lavender bed',
  'def.bed_heather': 'Heather bed',
  'def.bed_sunflower': 'Sunflower bed',
  'def.bed_snowdrop': 'Snowdrop bed',
  'def.pond': 'Pond',
  'defDesc.bed_clover': 'Sweet white and pink puffs.',
  'defDesc.bed_lavender': 'Fragrant, short-lived and prized.',
  'defDesc.bed_heather': 'Low pink bushes for the autumn.',
  'defDesc.bed_sunflower': 'Big, bright and full of nectar.',
  'defDesc.bed_snowdrop': 'Tiny white bells in the snow.',
  'defDesc.pond': 'Water for thirsty flowers.',

  'flower.wildflower': 'Wildflower',
  'flower.clover': 'Clover',
  'flower.lavender': 'Lavender',
  'flower.heather': 'Heather',
  'flower.sunflower': 'Sunflower',
  'flower.snowdrop': 'Snowdrop',
```

After `'resource.honey_wildflower'`, add:

```ts
  'resource.honey_clover': 'Clover honey',
  'resource.honey_lavender': 'Lavender honey',
  'resource.honey_heather': 'Heather honey',
  'resource.honey_sunflower': 'Sunflower honey',
  'resource.honey_snowdrop': 'Snowdrop honey',
```

- [ ] **Step 5: Palette and pond art**

In `src/render/art/palette.ts`, add to `palette` (before `highlightHover`):

```ts
  stone2: '#8f8f86',
  reed: '#6f9a4a',
  lily: '#5fa052',
  lilyFlower: '#f7c6d9',
  cloverLeaf: '#7cc36a',
  bush: '#6f9a54',
  sunCenter: '#7a4a24',
  snowTip: '#8fcf7a',
  /** Faded petals of a resting bed. */
  rest: '#e8dcc3',
```

Replace `flowerColors` with:

```ts
/** Petal colors per flower type (SourceDef.flowerType). Keep in step with the --flower-* CSS colors. */
export const flowerColors: Record<string, readonly string[]> = {
  wildflower: ['#ffffff', '#f8c9dc', '#fff1a6', '#d9c8f5'],
  clover: ['#ffffff', '#f6c8d8', '#fbe3ec'],
  lavender: ['#9b7fd1', '#b39ae0', '#8a6cc4'],
  heather: ['#d96fa5', '#e58ab8', '#c75a93'],
  sunflower: ['#ffcf33', '#ffc21f'],
  snowdrop: ['#ffffff', '#f4f8f2'],
};
```

Create `src/render/art/pond.ts`:

```ts
import * as THREE from 'three';
import { palette } from './palette';
import { cone, cylinder, ico, merge, sphere } from './parts';

/** Height of the water surface: tiles.ts drops water tiles by 0.12. */
const WATER_Y = -0.12;
const STONES = 9;

/**
 * Stone rim, reeds and a lily pad. The water itself is the tile underneath, which the pond turned
 * into water (spec §6.3).
 */
export function makePond(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < STONES; i++) {
    const a = (i / STONES) * Math.PI * 2 + 0.3;
    const size = 0.07 + (i % 3) * 0.015;
    parts.push(ico(size, i % 2 === 0 ? palette.rock : palette.stone2, {
      at: [Math.cos(a) * 0.66, 0.02, Math.sin(a) * 0.66], scale: [1.25, 0.55, 1], rotY: a, flat: true,
    }));
  }
  const reedSpots: [number, number][] = [[-0.42, -0.3], [0.45, -0.2], [-0.2, 0.46]];
  for (const [x, z] of reedSpots) {
    for (let k = 0; k < 3; k++) {
      const h = 0.28 + k * 0.05;
      parts.push(cone(0.012, h, 4, palette.reed, { at: [x + k * 0.03, WATER_Y + h / 2, z + (k % 2) * 0.03], rotZ: (k - 1) * 0.15 }));
    }
  }
  parts.push(cylinder(0.11, 0.11, 0.01, 12, palette.lily, { at: [0.12, WATER_Y + 0.01, 0.08] }));
  parts.push(sphere(0.03, 6, 4, palette.lilyFlower, { at: [0.14, WATER_Y + 0.035, 0.1], scale: [1, 0.6, 1] }));
  return merge(parts);
}
```

- [ ] **Step 6: Register art for every bed and the pond**

In `src/render/art/registry.ts`, add imports `import type { Registry } from '../../content/registry';` and `import { makePond } from './pond';`, then replace `registerDefaultArt` with:

```ts
/** Geometry is built once and shared by every instance of a def. Every buildable with a source gets a bed. */
export function registerDefaultArt(reg: Registry): void {
  const house = makeHouse();
  const hive = makeHive();
  const hiveLid = makeHiveLid();
  const pond = makePond();
  registerArt('house', () => meshOf(house));
  registerArt('hive', () => {
    const group = new THREE.Group();
    const lid = meshOf(hiveLid);
    lid.name = 'lid';
    lid.position.y = HIVE_LID_Y;
    group.add(meshOf(hive), lid);
    return group;
  });
  const beds = new Map<string, THREE.BufferGeometry>();
  for (const def of reg.buildables.values()) {
    if (!def.source) continue;
    const flower = def.source.flowerType;
    if (!beds.has(flower)) beds.set(flower, makeFlowerBed(flower));
    const geometry = beds.get(flower)!;
    registerArt(def.id, () => meshOf(geometry));
  }
  registerArt('pond', () => meshOf(pond));
}
```

In `src/main.ts`, change `registerDefaultArt();` to `registerDefaultArt(reg);` (the registry is created on the line above).

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/content tests/sim/state.test.ts tests/sim/commands.test.ts tests/ui/panels.test.ts tests/render`
Expected: PASS.

- [ ] **Step 8: Run the full check**

Run: `npm run check`
Expected: PASS. The balance bot and the dead-end fuzz still pass: the new beds only appear in the fuzz's random placements, and nothing reads `blooms` yet.

- [ ] **Step 9: Commit**

```bash
git add src/content/packs/bees.ts src/ui/strings/en.ts src/render/art src/main.ts tests
git commit -m "feat(content): six flowers with their honeys and a placeable pond"
```

---
## M6.2 — Production v2

### Task 4: Layout queries and the season-aware range map

**Files:**
- Create: `src/sim/layout.ts`
- Modify: `src/sim/production.ts` (range map, cache, `intakePerDay`, `outputPerDay`)
- Test: `tests/sim/layout.test.ts` (new), `tests/sim/production.test.ts`

**Interfaces:**
- Consumes: `reg.rules`, `reg.blooms()` (Task 2); `seasonAt()` (Task 1); the `pond` buildable (Task 3).
- Produces:
  - `sim/layout.ts`: `SourceBoost { clump: boolean; waterSide: boolean; multiplier: number }`; `neighborEntities(state, at): Entity[]`; `sameFlowerNeighbors(state, reg, at, flowerType): number`; `touchesWater(state, at): boolean`; `hasProducerNeighbor(state, reg, at): boolean`; `boostFor(state, reg, at, flowerType): SourceBoost`; `crowdedCap(reg, maxIntake, crowded): number`.
  - `sim/production.ts`: `type SeasonKey = Season | 'any'`; `SourceShare { sourceId; flowerType; dormant; nectarPerDay; sharedWith }`; `RangeMap { sharesByProducer; producersBySource; boostBySource; capByProducer; crowded }`; `getRangeMap(state, reg, season?: SeasonKey)`; `intakePerDay(state, reg, id, season?)`; `outputPerDay(state, reg, id, season?)`.

- [ ] **Step 1: Write the failing layout tests**

Create `tests/sim/layout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ORIGIN, hex } from '../../src/core/hex';
import { spawnEntity } from '../../src/sim/entities';
import { boostFor, crowdedCap, hasProducerNeighbor, neighborEntities, sameFlowerNeighbors, touchesWater } from '../../src/sim/layout';
import { clearEntities, newGame, reg } from './helpers';

function empty() {
  const state = newGame(1);
  clearEntities(state);
  return state;
}

describe('layout queries', () => {
  it('finds the entities around a hex', () => {
    const state = empty();
    const a = spawnEntity(state, reg, 'bed_clover', hex(1, 0));
    spawnEntity(state, reg, 'bed_clover', hex(3, 0));
    expect(neighborEntities(state, ORIGIN)).toEqual([a]);
  });

  it('counts only neighbors of the same flower', () => {
    const state = empty();
    spawnEntity(state, reg, 'bed_clover', hex(1, -1));
    spawnEntity(state, reg, 'bed_clover', hex(0, 1));
    spawnEntity(state, reg, 'bed_wildflower', hex(2, -1));
    expect(sameFlowerNeighbors(state, reg, hex(1, 0), 'clover')).toBe(2);
    expect(sameFlowerNeighbors(state, reg, hex(1, 0), 'wildflower')).toBe(1);
  });

  it('sees water from lakes and ponds', () => {
    const state = empty();
    expect(touchesWater(state, hex(1, 0))).toBe(false);
    spawnEntity(state, reg, 'pond', hex(2, 0));
    expect(touchesWater(state, hex(1, 0))).toBe(true);
    expect(touchesWater(state, ORIGIN)).toBe(false);
  });

  it('knows when a hive has a hive next to it', () => {
    const state = empty();
    spawnEntity(state, reg, 'hive', ORIGIN);
    expect(hasProducerNeighbor(state, reg, hex(1, 0))).toBe(true);
    expect(hasProducerNeighbor(state, reg, hex(2, 0))).toBe(false);
  });

  it('adds the clump and water bonuses together', () => {
    const state = empty();
    spawnEntity(state, reg, 'bed_clover', hex(1, -1));
    spawnEntity(state, reg, 'bed_clover', hex(0, 1));
    expect(boostFor(state, reg, hex(1, 0), 'clover')).toEqual({ clump: true, waterSide: false, multiplier: 1.5 });
    spawnEntity(state, reg, 'pond', hex(2, 0));
    expect(boostFor(state, reg, hex(1, 0), 'clover')).toEqual({ clump: true, waterSide: true, multiplier: 2 });
    expect(boostFor(state, reg, hex(1, 0), 'lavender')).toEqual({ clump: false, waterSide: true, multiplier: 1.5 });
  });

  it('takes a quarter off a crowded cap', () => {
    expect(crowdedCap(reg, 4, false)).toBe(4);
    expect(crowdedCap(reg, 4, true)).toBe(3);
  });
});
```

- [ ] **Step 2: Write the failing range-map tests**

In `tests/sim/production.test.ts`, replace the `expect(map.sharesByProducer.get(a.id))…` line in `'splits a bed equally between the hives in its range'` with:

```ts
    expect(map.sharesByProducer.get(a.id)).toEqual([
      { sourceId: bed.id, flowerType: 'wildflower', dormant: false, nectarPerDay: 0.5, sharedWith: 2 },
    ]);
```

In `'caps intake at maxIntakePerDay'`, the six wildflower beds around the hive now clump; the intake is still capped at 4, so the test stays as it is.

Add a new block at the end of the file:

```ts
describe('boosts, crowding and seasons', () => {
  function lone() {
    const state = newGame(1);
    clearEntities(state);
    const hive = spawnEntity(state, reg, 'hive', ORIGIN);
    return { state, hive };
  }

  it('gives a clumped bed 50% more nectar', () => {
    const { state, hive } = lone();
    spawnEntity(state, reg, 'bed_wildflower', hex(1, -1));
    const middle = spawnEntity(state, reg, 'bed_wildflower', hex(1, 0));
    spawnEntity(state, reg, 'bed_wildflower', hex(0, 1));
    const map = getRangeMap(state, reg);
    expect(map.boostBySource.get(middle.id)).toEqual({ clump: true, waterSide: false, multiplier: 1.5 });
    expect(intakePerDay(state, reg, hive.id)).toBeCloseTo(3.5);
  });

  it('counts resting beds for the clump, but they give no nectar', () => {
    const { state, hive } = lone();
    state.clock.tick = 21 * TICKS_PER_DAY; // winter: clover rests
    spawnEntity(state, reg, 'bed_clover', hex(1, -1));
    const middle = spawnEntity(state, reg, 'bed_clover', hex(1, 0));
    spawnEntity(state, reg, 'bed_clover', hex(0, 1));
    const map = getRangeMap(state, reg);
    expect(map.boostBySource.get(middle.id)!.clump).toBe(true);
    expect(map.sharesByProducer.get(hive.id)!.every((s) => s.dormant && s.nectarPerDay === 0)).toBe(true);
    expect(intakePerDay(state, reg, hive.id)).toBe(0);
  });

  it('gives a bed beside a pond 50% more nectar', () => {
    const { state, hive } = lone();
    const bed = spawnEntity(state, reg, 'bed_wildflower', hex(1, 0));
    spawnEntity(state, reg, 'pond', hex(2, 0));
    expect(getRangeMap(state, reg).boostBySource.get(bed.id)!.waterSide).toBe(true);
    expect(intakePerDay(state, reg, hive.id)).toBeCloseTo(1.5);
  });

  it('cuts the cap of hives standing next to each other', () => {
    const { state, hive } = lone();
    const next = spawnEntity(state, reg, 'hive', hex(1, 0));
    const far = spawnEntity(state, reg, 'hive', hex(0, 3));
    const map = getRangeMap(state, reg);
    expect(map.capByProducer.get(hive.id)).toBe(3);
    expect(map.capByProducer.get(next.id)).toBe(3);
    expect(map.capByProducer.get(far.id)).toBe(4);
    expect([...map.crowded].sort()).toEqual([hive.id, next.id].sort());
    for (const n of hexNeighbors(hex(0, 3))) spawnEntity(state, reg, 'bed_wildflower', n);
    for (const n of hexNeighbors(ORIGIN)) if (!state.tiles[hexKey(n)].entityId) spawnEntity(state, reg, 'bed_wildflower', n);
    expect(intakePerDay(state, reg, hive.id)).toBe(3);
    expect(intakePerDay(state, reg, far.id)).toBe(4);
  });

  it('follows the season: lavender only gives nectar in summer', () => {
    const { state, hive } = lone();
    spawnEntity(state, reg, 'bed_lavender', hex(1, 0));
    expect(getRangeMap(state, reg).sharesByProducer.get(hive.id)).toEqual([
      expect.objectContaining({ flowerType: 'lavender', dormant: true, nectarPerDay: 0 }),
    ]);
    expect(intakePerDay(state, reg, hive.id)).toBe(0);
    expect(intakePerDay(state, reg, hive.id, 'any')).toBe(1);
    state.clock.tick = 7 * TICKS_PER_DAY;
    expect(intakePerDay(state, reg, hive.id)).toBe(1);
    expect(outputPerDay(state, reg, hive.id)).toBeCloseTo(0.25);
  });

  it('caches one map per season and rebuilds when the season changes', () => {
    const state = newGame(1);
    const spring = getRangeMap(state, reg);
    expect(getRangeMap(state, reg)).toBe(spring);
    state.clock.tick = 7 * TICKS_PER_DAY;
    const summer = getRangeMap(state, reg);
    expect(summer).not.toBe(spring);
    state.clock.tick = 0;
    expect(getRangeMap(state, reg)).toBe(spring);
  });
});
```

Add `hexKey` to the `core/hex` import at the top of the file.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/sim/layout.test.ts tests/sim/production.test.ts`
Expected: FAIL (`sim/layout` does not exist; shares have no `flowerType`).

- [ ] **Step 4: Create `src/sim/layout.ts`**

```ts
import { hexKey, hexNeighbors, type Hex } from '../core/hex';
import type { Registry } from '../content/registry';
import type { Entity, GameState } from './state';

/** How much more nectar a bed gives because of what surrounds it (rules spec §5.3). */
export interface SourceBoost {
  clump: boolean;
  waterSide: boolean;
  /** 1 plus every bonus that applies. */
  multiplier: number;
}

/** The entities standing on the six hexes around `at`, in HEX_DIRECTIONS order. */
export function neighborEntities(state: GameState, at: Hex): Entity[] {
  const out: Entity[] = [];
  for (const n of hexNeighbors(at)) {
    const id = state.tiles[hexKey(n)]?.entityId;
    const entity = id ? state.entities[id] : undefined;
    if (entity) out.push(entity);
  }
  return out;
}

/** Neighboring beds growing `flowerType`. Resting beds count: clump only looks at the layout. */
export function sameFlowerNeighbors(state: GameState, reg: Registry, at: Hex, flowerType: string): number {
  return neighborEntities(state, at).filter((e) => reg.buildable(e.def).source?.flowerType === flowerType).length;
}

/** Any neighboring tile is water: a lake, or a pond (which turns its tile to water). */
export function touchesWater(state: GameState, at: Hex): boolean {
  return hexNeighbors(at).some((n) => state.tiles[hexKey(n)]?.tile === 'water');
}

export function hasProducerNeighbor(state: GameState, reg: Registry, at: Hex): boolean {
  return neighborEntities(state, at).some((e) => reg.buildable(e.def).producer !== undefined);
}

export function boostFor(state: GameState, reg: Registry, at: Hex, flowerType: string): SourceBoost {
  const { clump, waterSide } = reg.rules;
  const isClump = sameFlowerNeighbors(state, reg, at, flowerType) >= clump.minNeighbors;
  const isWater = touchesWater(state, at);
  return {
    clump: isClump,
    waterSide: isWater,
    multiplier: 1 + (isClump ? clump.bonus : 0) + (isWater ? waterSide.bonus : 0),
  };
}

/** A hive with another hive next to it loses part of its intake cap. */
export function crowdedCap(reg: Registry, maxIntakePerDay: number, crowded: boolean): number {
  return crowded ? maxIntakePerDay * (1 - reg.rules.crowding.penalty) : maxIntakePerDay;
}
```

- [ ] **Step 5: Rebuild the range map around boosts, caps and seasons**

In `src/sim/production.ts`, replace everything from the `SourceShare` interface down to (and including) `outputPerDay` with:

```ts
/** A season, or 'any' to treat every flower as blooming (the safety net's view, spec §5.8). */
export type SeasonKey = Season | 'any';

export interface SourceShare {
  sourceId: string;
  flowerType: string;
  /** The flower is not in bloom in this season. */
  dormant: boolean;
  /** This producer's slice of the source's boosted daily yield; 0 when dormant. */
  nectarPerDay: number;
  /** How many producers split this source. */
  sharedWith: number;
}

export interface RangeMap {
  sharesByProducer: Map<string, SourceShare[]>;
  producersBySource: Map<string, string[]>;
  boostBySource: Map<string, SourceBoost>;
  /** Intake cap after crowding. */
  capByProducer: Map<string, number>;
  crowded: Set<string>;
}

export function buildRangeMap(state: GameState, reg: Registry, season: SeasonKey): RangeMap {
  const producers: { entity: Entity; def: ProducerDef }[] = [];
  const sources: { entity: Entity; def: SourceDef }[] = [];
  for (const entity of Object.values(state.entities)) {
    const def = reg.buildable(entity.def);
    if (def.producer) producers.push({ entity, def: def.producer });
    if (def.source) sources.push({ entity, def: def.source });
  }

  const sharesByProducer = new Map<string, SourceShare[]>();
  const capByProducer = new Map<string, number>();
  const crowded = new Set<string>();
  for (const p of producers) {
    const isCrowded = hasProducerNeighbor(state, reg, p.entity.hex);
    if (isCrowded) crowded.add(p.entity.id);
    capByProducer.set(p.entity.id, crowdedCap(reg, p.def.maxIntakePerDay, isCrowded));
    sharesByProducer.set(p.entity.id, []);
  }

  const producersBySource = new Map<string, string[]>();
  const boostBySource = new Map<string, SourceBoost>();
  for (const src of sources) {
    const boost = boostFor(state, reg, src.entity.hex, src.def.flowerType);
    boostBySource.set(src.entity.id, boost);
    const feeding = producers.filter(
      (p) => p.def.consumes === src.def.kind && hexDistance(p.entity.hex, src.entity.hex) <= p.def.range,
    );
    producersBySource.set(src.entity.id, feeding.map((p) => p.entity.id));
    const dormant = !reg.blooms(src.def.flowerType, season);
    for (const p of feeding) {
      sharesByProducer.get(p.entity.id)?.push({
        sourceId: src.entity.id,
        flowerType: src.def.flowerType,
        dormant,
        nectarPerDay: dormant ? 0 : (src.def.yieldPerDay * boost.multiplier) / feeding.length,
        sharedWith: feeding.length,
      });
    }
  }
  return { sharesByProducer, producersBySource, boostBySource, capByProducer, crowded };
}

/**
 * Derived data, never saved. Entities never move and tiles only change through entities (`setsTile`),
 * so the entity ids plus the season fully determine the map. Holds the current season and 'any'.
 */
const rangeCache = new WeakMap<GameState, Map<string, RangeMap>>();
const MAX_CACHED_MAPS = 2;

export function getRangeMap(state: GameState, reg: Registry, season: SeasonKey = seasonAt(state.clock.tick)): RangeMap {
  const key = `${Object.keys(state.entities).join('|')}#${season}`;
  let maps = rangeCache.get(state);
  if (!maps) {
    maps = new Map();
    rangeCache.set(state, maps);
  }
  const hit = maps.get(key);
  if (hit) return hit;
  const map = buildRangeMap(state, reg, season);
  maps.set(key, map);
  while (maps.size > MAX_CACHED_MAPS) maps.delete(maps.keys().next().value!);
  return map;
}

function producerOf(state: GameState, reg: Registry, id: string): ProducerDef | undefined {
  const entity = state.entities[id];
  return entity ? reg.buildable(entity.def).producer : undefined;
}

export function intakePerDay(state: GameState, reg: Registry, producerId: string, season?: SeasonKey): number {
  if (!producerOf(state, reg, producerId)) return 0;
  const map = getRangeMap(state, reg, season);
  const total = (map.sharesByProducer.get(producerId) ?? []).reduce((sum, s) => sum + s.nectarPerDay, 0);
  return Math.min(total, map.capByProducer.get(producerId) ?? 0);
}

export function outputPerDay(state: GameState, reg: Registry, producerId: string, season?: SeasonKey): number {
  const producer = producerOf(state, reg, producerId);
  return producer ? intakePerDay(state, reg, producerId, season) * producer.conversion : 0;
}
```

Update the imports at the top of `src/sim/production.ts`:

```ts
import { hexDistance } from '../core/hex';
import type { Registry } from '../content/registry';
import type { ProducerDef, Season, SourceDef } from '../content/types';
import { seasonAt } from './clock';
import type { GameEvent } from './events';
import { boostFor, crowdedCap, hasProducerNeighbor, type SourceBoost } from './layout';
import type { Entity, GameState } from './state';
```

`productionTick` is unchanged in this task; it already calls `outputPerDay`, so hives now follow boosts, crowding and seasons.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/sim/layout.test.ts tests/sim/production.test.ts`
Expected: PASS.

- [ ] **Step 7: Run the full check**

Run: `npm run check`
Expected: PASS. Wildflowers now rest in winter. The dead-end fuzz still passes because the safety net (not yet fixed; Task 7) hands out coins in winter, which counts as recoverable. The bees in `render/bees.ts` read `nectarPerDay` as their bed weights, so they already skip resting beds.

- [ ] **Step 8: Commit**

```bash
git add src/sim/layout.ts src/sim/production.ts tests/sim/layout.test.ts tests/sim/production.test.ts
git commit -m "feat(sim): clump, water-side and crowding in a season-aware range map"
```

---

### Task 5: Stores by flower, the per-flower production tick and save v3

**Files:**
- Modify: `src/sim/state.ts`, `src/sim/entities.ts`, `src/sim/production.ts`
- Modify: `src/sim/commands.ts`, `src/sim/economy.ts`, `src/sim/worker.ts` (read sites)
- Modify: `src/render/badges.ts`, `src/render/bees.ts`, `src/ui/inspect.ts`, `src/ui/toolbar.ts` (read sites)
- Modify: `src/game/save.ts`
- Create: `tests/fixtures/save-v2.json`
- Modify: `tests/sim/helpers.ts` and the test files listed in Step 1
- Test: `tests/sim/production.test.ts`, `tests/game/save.test.ts`

**Interfaces:**
- Consumes: `getRangeMap`, `intakePerDay` (Task 4); `reg.flowerByHoney`, `reg.honeys`, `reg.flowers` (Task 2).
- Produces:
  - `Entity.store?: Record<string, number>` (kg per flower; producers only; `{}` when empty).
  - `SAVE_VERSION = 3`, `GameState.version: 3`.
  - `sim/production.ts`: `storeTotal(entity): number`; `FULL_EPSILON = 1e-9`; `isFull(entity, capacity): boolean`; `intakeByFlower(state, reg, producerId, season?): Map<string, number>`.
  - `tests/sim/helpers.ts`: `setStore(entity, kg, flower = 'wildflower'): void`.

- [ ] **Step 1: Add the test helper and convert existing tests**

Add to `tests/sim/helpers.ts` (and add `Entity` to its state import if missing):

```ts
/** Test shortcut: a producer holding `kg` of one flower's honey-to-be (wildflower by default). */
export function setStore(entity: Entity, kg: number, flower = 'wildflower'): void {
  entity.store = kg > 0 ? { [flower]: kg } : {};
}
```

Convert every test that assigns or reads `store` as a number. Run from the repository root:

```bash
perl -pi -e 's/^(\s*)(\S.*?)\.store = ([0-9.]+);$/$1setStore($2, $3);/' \
  tests/game/controller.test.ts tests/game/save.test.ts tests/render/badges.test.ts tests/render/bees.test.ts \
  tests/sim/commands.test.ts tests/sim/production.test.ts tests/sim/worker.test.ts tests/ui/inspect.test.ts tests/ui/toolbar.test.ts
perl -pi -e 's/expect\(([\w.\[\]]+)\.store\)/expect(storeTotal($1))/g' \
  tests/game/save.test.ts tests/sim/advance.test.ts tests/sim/commands.test.ts tests/sim/production.test.ts \
  tests/sim/state.test.ts tests/sim/worker.test.ts
grep -rnE "\.store( =|\))" tests
```

Expected: the final `grep` prints nothing. Then fix the imports:

- Every file changed by the first command: add `setStore` to its existing import from the sim helpers (`./helpers` in `tests/sim/`, `../sim/helpers` elsewhere).
- Every file changed by the second command: import `storeTotal` from `src/sim/production` (`'../../src/sim/production'`), merging it into an existing import from that module where there is one.

In `tests/sim/production.test.ts`, in `'stalls at capacity and reports full exactly once'`, change `expect(storeTotal(hive)).toBe(5);` to `expect(storeTotal(hive)).toBeCloseTo(5, 9);` (the per-flower sum can land within 1e-9 of capacity).

In `tests/game/save.test.ts`, rename the mutation `'a non-numeric store'` to `'a store that is not an object'` (its mutation, `store: '2'`, stays).

- [ ] **Step 2: Write the failing tests**

Add to `tests/sim/production.test.ts`:

```ts
describe('stores by flower', () => {
  /** The six hexes around the origin in walking order, so each one touches the next (and the last touches the first). */
  const RING = [hex(1, 0), hex(1, -1), hex(0, -1), hex(-1, 0), hex(-1, 1), hex(0, 1)];

  function ringed(flowers: (string | null)[]) {
    const state = newGame(1);
    clearEntities(state);
    const hive = spawnEntity(state, reg, 'hive', ORIGIN);
    RING.forEach((n, i) => {
      const flower = flowers[i];
      if (flower) spawnEntity(state, reg, `bed_${flower}`, n);
    });
    return { state, hive };
  }

  it('starts every producer with an empty store', () => {
    const { hive } = ringed([]);
    expect(hive.store).toEqual({});
    expect(storeTotal(hive)).toBe(0);
  });

  it('shares the cap between flowers in proportion to what each brings', () => {
    // Around the ring: three clover then three wildflower. The middle bed of each group clumps (1 + 1.5 + 1 = 3.5 each).
    const { state, hive } = ringed(['clover', 'clover', 'clover', 'wildflower', 'wildflower', 'wildflower']);
    const byFlower = intakeByFlower(state, reg, hive.id);
    expect(byFlower.get('clover')).toBeCloseTo(2);
    expect(byFlower.get('wildflower')).toBeCloseTo(2);
    for (let i = 0; i < TICKS_PER_DAY; i++) productionTick(state, reg, DT_DAYS);
    expect(hive.store!.clover).toBeCloseTo(0.5, 9);
    expect(hive.store!.wildflower).toBeCloseTo(0.5, 9);
  });

  it('matches the analytic curve per flower under the cap', () => {
    const { state, hive } = ringed(['wildflower', null, 'wildflower', null, 'clover']);
    const byFlower = intakeByFlower(state, reg, hive.id);
    for (let i = 0; i < TICKS_PER_DAY; i++) productionTick(state, reg, DT_DAYS);
    expect(hive.store!.wildflower).toBeCloseTo(byFlower.get('wildflower')! * 0.25, 9);
    expect(hive.store!.clover).toBeCloseTo(byFlower.get('clover')! * 0.25, 9);
  });

  it('fills to capacity from several flowers without going over, reporting full once', () => {
    const { state, hive } = ringed(['clover', 'clover', 'clover', 'wildflower', 'wildflower', 'wildflower']);
    hive.store = { clover: 2.49, wildflower: 2.49 };
    const events: GameEvent[] = [];
    for (let i = 0; i < TICKS_PER_DAY; i++) events.push(...productionTick(state, reg, DT_DAYS));
    expect(storeTotal(hive)).toBeCloseTo(5, 9);
    expect(storeTotal(hive)).toBeLessThanOrEqual(5 + 1e-9);
    expect(isFull(hive, 5)).toBe(true);
    expect(events).toEqual([{ type: 'producerFull', id: hive.id }]);
  });

  it('adds nothing from resting beds', () => {
    const { state, hive } = ringed(['wildflower', 'wildflower', 'wildflower']);
    state.clock.tick = 21 * TICKS_PER_DAY;
    for (let i = 0; i < TICKS_PER_DAY; i++) productionTick(state, reg, DT_DAYS);
    expect(storeTotal(hive)).toBe(0);
  });
});
```

Add `intakeByFlower`, `isFull` and `storeTotal` to the `src/sim/production` import in that file.

Create `tests/fixtures/save-v2.json` (a sub-project 2 save on day 41 with honey in the hive and a queued harvest):

```json
{
  "version": 2,
  "seed": 7,
  "nextId": 3,
  "clock": { "tick": 24123, "speed": 1 },
  "tiles": {
    "0,0": { "tile": "grass", "owned": true, "entityId": "e1" },
    "1,0": { "tile": "soil", "owned": true, "entityId": "e2" },
    "0,1": { "tile": "grass", "owned": true },
    "5,0": { "tile": "water", "owned": false },
    "6,0": { "tile": "grass", "owned": false, "decor": "tree" }
  },
  "entities": {
    "e1": { "id": "e1", "def": "hive", "hex": { "q": 0, "r": 0 }, "store": 1.5 },
    "e2": { "id": "e2", "def": "bed_wildflower", "hex": { "q": 1, "r": 0 }, "prevTile": "grass" }
  },
  "inventory": { "coins": 42, "honey_wildflower": 0.5 },
  "flags": { "fullNotified": {} },
  "worker": { "def": "beekeeper", "at": { "q": 0, "r": 1 }, "path": [], "stepTicks": 0, "target": null, "workLeft": 0, "queue": ["e1"] }
}
```

In `tests/game/save.test.ts`, replace the test `'migrates the checked-in v1 fixture: same world, beekeeper idle at home'` with:

```ts
  const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');

  it('migrates the checked-in v1 fixture to v3: same world, beekeeper at home, stores by flower, calendar reset', () => {
    const raw = fixture('save-v1.json');
    const state = deserialize(raw, reg);
    expect(state.version).toBe(3);
    expect(state.clock).toEqual({ tick: 0, speed: 2 });
    expect(state.tiles).toEqual(JSON.parse(raw).tiles);
    expect(state.entities.e1.store).toEqual({ wildflower: 1.5 });
    expect(state.entities.e2.store).toBeUndefined();
    expect(state.inventory).toMatchObject({ coins: 42, honey_wildflower: 0.5, honey_clover: 0, honey_snowdrop: 0 });
    // The fixture has no house, so home falls back to the walkable hex nearest the origin.
    expect(state.worker).toEqual({ def: 'beekeeper', at: { q: 0, r: 1 }, path: [], stepTicks: 0, target: null, workLeft: 0, queue: [] });
  });

  it('migrates a day-40 v2 save: honey kept as wildflower, Year 1 spring again, queue kept', () => {
    const state = deserialize(fixture('save-v2.json'), reg);
    expect(state.version).toBe(3);
    expect(state.clock.tick).toBe(0);
    expect(state.entities.e1.store).toEqual({ wildflower: 1.5 });
    expect(state.worker.queue).toEqual(['e1']);
    expect(state.inventory.honey_wildflower).toBe(0.5);
    expect(state.inventory.honey_lavender).toBe(0);
  });
```

Add these entries to the `mutations` table:

```ts
    ['a store with an unknown flower', (s) => ({ ...s, entities: { ...s.entities, e1: { ...s.entities.e1, store: { tulip: 1 } } } })],
    ['a store over capacity', (s) => ({ ...s, entities: { ...s.entities, e1: { ...s.entities.e1, store: { wildflower: 6 } } } })],
    ['a flower bed with a store', (s) => ({ ...s, entities: { ...s.entities, e3: { ...s.entities.e3, store: {} } } })],
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/sim tests/game/save.test.ts`
Expected: FAIL (type errors: `store` is a number; `storeTotal`, `intakeByFlower`, `isFull` missing; fixtures stop at v2).

- [ ] **Step 4: Change the state shape**

In `src/sim/state.ts`:

```ts
  /** kg of honey-to-be inside a producer, by flower type. Producers only; `{}` when empty. */
  store?: Record<string, number>;
```

and change `version: 2;` to `version: 3;` and `export const SAVE_VERSION = 2;` to `export const SAVE_VERSION = 3;`.

In `src/sim/entities.ts`, change `if (def.producer) entity.store = 0;` to `if (def.producer) entity.store = {};`.

- [ ] **Step 5: Produce by flower**

Add to `src/sim/production.ts` (below `outputPerDay`), and replace `productionTick`:

```ts
/** Everything waiting in a producer, all flowers together. */
export function storeTotal(entity: Pick<Entity, 'store'>): number {
  let total = 0;
  for (const kg of Object.values(entity.store ?? {})) total += kg;
  return total;
}

/** Summing per-flower floats can land a hair under capacity. */
export const FULL_EPSILON = 1e-9;

export function isFull(entity: Pick<Entity, 'store'>, capacity: number): boolean {
  return storeTotal(entity) >= capacity - FULL_EPSILON;
}

/** Nectar per day by flower after the cap, which is shared in proportion to what each flower brings (spec §5.6). */
export function intakeByFlower(state: GameState, reg: Registry, producerId: string, season?: SeasonKey): Map<string, number> {
  const out = new Map<string, number>();
  if (!producerOf(state, reg, producerId)) return out;
  const map = getRangeMap(state, reg, season);
  let total = 0;
  for (const s of map.sharesByProducer.get(producerId) ?? []) {
    if (s.nectarPerDay <= 0) continue;
    out.set(s.flowerType, (out.get(s.flowerType) ?? 0) + s.nectarPerDay);
    total += s.nectarPerDay;
  }
  const cap = map.capByProducer.get(producerId) ?? 0;
  if (total > cap) for (const [flower, nectar] of out) out.set(flower, (nectar * cap) / total);
  return out;
}

/** Advances every producer by dtDays. Mutates state; returns producerFull events. */
export function productionTick(state: GameState, reg: Registry, dtDays: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (const id of getRangeMap(state, reg).sharesByProducer.keys()) {
    const entity = state.entities[id];
    const producer = reg.buildable(entity.def).producer;
    if (!producer) continue;
    const store = (entity.store ??= {});
    const adds = new Map<string, number>();
    let sum = 0;
    for (const [flower, nectar] of intakeByFlower(state, reg, id)) {
      const kg = nectar * producer.conversion * dtDays;
      adds.set(flower, kg);
      sum += kg;
    }
    const room = Math.max(0, producer.capacity - storeTotal(entity));
    const scale = sum > room ? room / sum : 1;
    for (const [flower, kg] of adds) store[flower] = (store[flower] ?? 0) + kg * scale;
    if (isFull(entity, producer.capacity)) {
      if (!state.flags.fullNotified[id]) {
        state.flags.fullNotified[id] = true;
        events.push({ type: 'producerFull', id });
      }
    } else if (state.flags.fullNotified[id]) {
      delete state.flags.fullNotified[id];
    }
  }
  return events;
}
```

- [ ] **Step 6: Update every read site**

Each place that read `store` as a number now uses `storeTotal` (import it from `../sim/production`, or `./production` inside `sim/`):

| File | Change |
|---|---|
| `src/sim/commands.ts` (`remove`) | `const stored = storeTotal(entity);` (the rest of the block is replaced in Task 6) |
| `src/sim/commands.ts` (`harvest`) | `if (!producer \|\| storeTotal(entity) <= 0) return fail('nothing_to_harvest');` |
| `src/sim/commands.ts` (`harvestAll`) | `.filter((e) => storeTotal(e) > 0)` |
| `src/sim/economy.ts` (`goodsOnHand`) | `total += storeTotal(e);` |
| `src/sim/worker.ts` (`collect`) | `const amount = storeTotal(entity);` and `entity.store = {};` |
| `src/render/bees.ts` (`survey`) | `const full = isFull(entity, producer.capacity);` |
| `src/ui/inspect.ts` (`harvestState`) | `disabled: showsAsZeroKg(storeTotal(entity))` |
| `src/ui/inspect.ts` (fill row) | `formatKg(storeTotal(e))` |
| `src/ui/toolbar.ts` (`readyToHarvest`) | `total += storeTotal(e);` |

In `src/render/badges.ts`, replace the fraction and full lines with:

```ts
      const full = isFull(entity, producer.capacity);
      const fraction = full ? 1 : Math.min(1, storeTotal(entity) / producer.capacity);
```

and `b.badge.classList.toggle('full', fraction >= 1);` with `b.badge.classList.toggle('full', full);`. Import `isFull, storeTotal` from `../sim/production`.

In `src/sim/commands.ts` (`remove`), the stored honey is still paid out as `def.producer.output` in this task; Task 6 replaces that block.

- [ ] **Step 7: Migrate saves to v3 and validate stores**

In `src/game/save.ts`, add the second migration to `MIGRATIONS`:

```ts
  // v2 -> v3 (sub-project 3): stores by flower, the calendar restarts, every honey in the inventory.
  2: (data, reg) => {
    const next = structuredClone(data) as Json & { entities: Record<string, Json>; inventory: Record<string, number>; clock: Json };
    for (const e of Object.values(next.entities)) {
      if (typeof e.store !== 'number') continue;
      const producer = typeof e.def === 'string' ? reg.findBuildable(e.def)?.producer : undefined;
      const flower = producer ? reg.flowerByHoney(producer.output)?.id : undefined;
      e.store = e.store > 0 && flower ? { [flower]: e.store } : {};
    }
    // A day-40 save would land in an odd season of a 28-day year (rules spec §6.3).
    next.clock = { ...next.clock, tick: 0 };
    for (const honey of reg.honeys) next.inventory[honey] ??= 0;
    next.version = 3;
    return next;
  },
```

In `assertGameState`, replace the store line

```ts
    if (def.producer && (!isFiniteNumber(e.store) || e.store < 0)) throw new Error(`Save entity ${id} has an invalid store`);
```

with

```ts
    if (def.producer) assertStore(id, e.store, def.producer.capacity, reg);
    else if (e.store !== undefined) throw new Error(`Save entity ${id} stores output but is not a producer`);
```

and add below `assertGameState`:

```ts
/** kg by flower: known flowers only, finite and non-negative, and no more than the producer holds. */
function assertStore(id: string, store: unknown, capacity: number, reg: Registry): void {
  if (!isObject(store)) throw new Error(`Save entity ${id} has an invalid store`);
  let total = 0;
  for (const [flower, kg] of Object.entries(store)) {
    if (!reg.flowers.has(flower)) throw new Error(`Save entity ${id} stores an unknown flower "${flower}"`);
    if (!isFiniteNumber(kg) || kg < 0) throw new Error(`Save entity ${id} has an invalid store`);
    total += kg;
  }
  if (total > capacity + 1e-6) throw new Error(`Save entity ${id} stores more than it holds`);
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/sim tests/game/save.test.ts`
Expected: PASS.

- [ ] **Step 9: Run the full check**

Run: `npm run check`
Expected: PASS (render and UI tests use `setStore` now).

- [ ] **Step 10: Commit**

```bash
git add src tests
git commit -m "feat(sim): stores by flower with the cap shared in proportion; save v3 migrates v1 and v2"
```

---

### Task 6: Batches and purity

**Files:**
- Create: `src/sim/batch.ts`
- Modify: `src/sim/events.ts` (`harvested` gains `dominant`, `purity`)
- Modify: `src/sim/worker.ts` (`collect` → `collectBatch`)
- Modify: `src/sim/commands.ts` (`remove`)
- Modify: `tests/audio/cues.test.ts`, `tests/ui/app.test.ts`, `tests/ui/foundation.test.ts` (event literals)
- Test: `tests/sim/batch.test.ts` (new)

**Interfaces:**
- Consumes: `storeTotal` (Task 5); `reg.flowers`, `reg.flower`, `reg.rules` (Task 2).
- Produces:
  - `Batch { resource: ResourceId; amount: number; dominant: string; purity: number }`
  - `purityThreshold(state, reg): number`
  - `classifyBatch(store, producer, reg, threshold): Batch | null`
  - `collectBatch(state, reg, id, events): Batch | null`
  - `harvested` event: `{ type: 'harvested'; id; hex; resource; amount; dominant: string; purity: number }`

- [ ] **Step 1: Write the failing tests**

Create `tests/sim/batch.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ORIGIN, hex } from '../../src/core/hex';
import { advance } from '../../src/sim/advance';
import { classifyBatch, collectBatch } from '../../src/sim/batch';
import { dispatch } from '../../src/sim/commands';
import { spawnEntity } from '../../src/sim/entities';
import type { GameEvent } from '../../src/sim/events';
import { storeTotal } from '../../src/sim/production';
import { entitiesOf, newGame, reg, setStore } from './helpers';

const hive = reg.buildable('hive').producer!;

describe('classifyBatch', () => {
  it('makes a batch pure at exactly the threshold', () => {
    expect(classifyBatch({ clover: 7, wildflower: 3 }, hive, reg, 0.7)).toEqual({
      resource: 'honey_clover', amount: 10, dominant: 'clover', purity: 0.7,
    });
  });

  it('makes a batch just under the threshold wildflower honey', () => {
    const batch = classifyBatch({ clover: 6.99, wildflower: 3.01 }, hive, reg, 0.7)!;
    expect(batch.resource).toBe('honey_wildflower');
    expect(batch.dominant).toBe('clover');
    expect(batch.purity).toBeCloseTo(0.699);
  });

  it('breaks a tie by registry order', () => {
    expect(classifyBatch({ lavender: 2, clover: 2 }, hive, reg, 0.7)).toMatchObject({ dominant: 'clover', purity: 0.5, resource: 'honey_wildflower' });
  });

  it('calls a pure wildflower batch wildflower honey too', () => {
    expect(classifyBatch({ wildflower: 1 }, hive, reg, 0.7)).toMatchObject({ resource: 'honey_wildflower', purity: 1 });
  });

  it('has nothing to say about an empty store', () => {
    expect(classifyBatch({}, hive, reg, 0.7)).toBeNull();
    expect(classifyBatch({ clover: 0 }, hive, reg, 0.7)).toBeNull();
  });
});

describe('collectBatch', () => {
  it('moves the classified honey into the inventory and empties the store', () => {
    const state = newGame(1);
    const [h] = entitiesOf(state, 'hive');
    h.store = { lavender: 1.6, wildflower: 0.4 };
    state.flags.fullNotified[h.id] = true;
    const events: GameEvent[] = [];
    const batch = collectBatch(state, reg, h.id, events);
    expect(batch).toMatchObject({ resource: 'honey_lavender', amount: 2, dominant: 'lavender', purity: 0.8 });
    expect(state.inventory.honey_lavender).toBeCloseTo(2);
    expect(h.store).toEqual({});
    expect(state.flags.fullNotified[h.id]).toBeUndefined();
    expect(events[0]).toEqual({ type: 'harvested', id: h.id, hex: ORIGIN, resource: 'honey_lavender', amount: 2, dominant: 'lavender', purity: 0.8 });
  });

  it('is what the walking beekeeper uses', () => {
    const state = newGame(1);
    const [h] = entitiesOf(state, 'hive');
    setStore(h, 2, 'clover');
    dispatch(state, reg, { type: 'harvest', id: h.id });
    const events = advance(state, reg, 5); // one step from home to the hive
    expect(storeTotal(h)).toBe(0);
    // The three wildflower beds added a sliver during the walk; the batch is still over 99% clover.
    expect(state.inventory.honey_clover).toBeGreaterThan(2);
    expect(events).toContainEqual(expect.objectContaining({ type: 'harvested', resource: 'honey_clover', dominant: 'clover' }));
  });

  it('is what removing a hive uses', () => {
    const state = newGame(1);
    const [h] = entitiesOf(state, 'hive');
    spawnEntity(state, reg, 'hive', hex(0, 3)); // not the last hive
    setStore(h, 1, 'heather');
    const result = dispatch(state, reg, { type: 'remove', id: h.id });
    expect(result.ok && result.events[0]).toMatchObject({ type: 'harvested', resource: 'honey_heather', amount: 1 });
    expect(state.inventory.honey_heather).toBe(1);
  });
});
```

Update test event literals: in `tests/audio/cues.test.ts`, `tests/ui/app.test.ts` and `tests/ui/foundation.test.ts`, every object literal with `type: 'harvested'` gains `dominant: 'wildflower', purity: 1`. For example:

```ts
{ type: 'harvested', id: 'e1', hex: ORIGIN, resource: 'honey_wildflower', amount: 1, dominant: 'wildflower', purity: 1 }
```

In `tests/ui/foundation.test.ts`, the `harvested` helper becomes:

```ts
    const harvested = (amount: number) => ({ type: 'harvested' as const, id: 'e1', hex: ORIGIN, resource: 'honey_wildflower', amount, dominant: 'wildflower', purity: 1 });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/sim/batch.test.ts`
Expected: FAIL (`sim/batch` does not exist).

- [ ] **Step 3: Extend the event**

In `src/sim/events.ts`, replace the `harvested` member with:

```ts
  | { type: 'harvested'; id: string; hex: Hex; resource: ResourceId; amount: number; dominant: string; purity: number }
```

- [ ] **Step 4: Create `src/sim/batch.ts`**

```ts
import { hex } from '../core/hex';
import type { Registry } from '../content/registry';
import type { ProducerDef, ResourceId } from '../content/types';
import { addResources } from './economy';
import type { GameEvent } from './events';
import type { GameState } from './state';

export interface Batch {
  resource: ResourceId;
  amount: number;
  /** The flower with the most kg in the batch. */
  dominant: string;
  /** Dominant kg ÷ total. */
  purity: number;
}

/** Tolerance so a batch at exactly the threshold (7 of 10 kg) counts as pure. */
const PURITY_EPSILON = 1e-9;

/** The one place the purity threshold is read, so the Extractor can raise it later (rules spec §8.2). */
export function purityThreshold(_state: GameState, reg: Registry): number {
  return reg.rules.purityThreshold;
}

/** What a store would become if collected now (spec §5.7). Null when it is empty. */
export function classifyBatch(store: Record<string, number>, producer: ProducerDef, reg: Registry, threshold: number): Batch | null {
  let amount = 0;
  for (const kg of Object.values(store)) amount += kg;
  if (amount <= 0) return null;
  let dominant = '';
  let best = -1;
  // Registry order breaks ties.
  for (const flower of reg.flowers.keys()) {
    const kg = store[flower] ?? 0;
    if (kg > best) {
      best = kg;
      dominant = flower;
    }
  }
  const purity = best / amount;
  const resource = purity >= threshold - PURITY_EPSILON ? reg.flower(dominant).honey : producer.output;
  return { resource, amount, dominant, purity };
}

/**
 * Collects a producer's whole store as one batch: classifies it, pays it into the inventory, empties the
 * store and emits `harvested`. Used by the walking beekeeper and by removal. Returns the batch, or null.
 */
export function collectBatch(state: GameState, reg: Registry, id: string, events: GameEvent[]): Batch | null {
  const entity = state.entities[id];
  const producer = entity ? reg.buildable(entity.def).producer : undefined;
  if (!entity || !producer) return null;
  const batch = classifyBatch(entity.store ?? {}, producer, reg, purityThreshold(state, reg));
  entity.store = {};
  delete state.flags.fullNotified[id];
  if (!batch) return null;
  addResources(state.inventory, { [batch.resource]: batch.amount });
  events.push({ type: 'harvested', id, hex: hex(entity.hex.q, entity.hex.r), ...batch });
  return batch;
}
```

- [ ] **Step 5: Use it from the worker and from removal**

In `src/sim/worker.ts`, delete the `collect` function and its now-unused imports (`addResources`, and `hex` if nothing else uses it), import `collectBatch` from `./batch`, and in `workerTick` step 4 replace `collect(state, reg, w.target, events);` with:

```ts
    collectBatch(state, reg, w.target, events);
```

In `src/sim/commands.ts` (`remove`), replace

```ts
  const stored = storeTotal(entity);
  if (def.producer && stored > 0) {
    addResources(state.inventory, { [def.producer.output]: stored });
    events.push({ type: 'harvested', id, hex: hex(entity.hex.q, entity.hex.r), resource: def.producer.output, amount: stored });
  }
```

with

```ts
  if (def.producer) collectBatch(state, reg, id, events);
```

and import `collectBatch` from `./batch`. Drop imports that are now unused (`hex`, `storeTotal` if unused).

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/sim tests/audio tests/ui`
Expected: PASS.

- [ ] **Step 7: Run the full check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/sim tests
git commit -m "feat(sim): classify each collected batch as pure or mixed honey"
```

---

### Task 7: Winter refunds and a safety net that sees through winter

**Files:**
- Modify: `src/sim/economy.ts`
- Modify: `src/sim/commands.ts` (`remove`)
- Modify: `src/ui/inspect.ts` (Remove label)
- Modify: `tests/sim/balance.test.ts` (dead-end fuzz)
- Test: `tests/sim/commands.test.ts`, `tests/sim/advance.test.ts`

**Interfaces:**
- Consumes: `reg.rules.winterSourceRefund` (Task 2); `seasonAt` (Task 1); `outputPerDay(…, season)` (Task 4).
- Produces:
  - `refundFor(reg, def, season): Amounts` (replaces `refundFor(def)`)
  - `totalOutputPerDay(state, reg, season?: SeasonKey): number`
  - `applySafetyNet` checks production with the `'any'` season.

- [ ] **Step 1: Write the failing tests**

Add to `tests/sim/commands.test.ts`:

```ts
describe('winter replanting', () => {
  it('refunds a flower bed in full during winter, and half the rest of the year', () => {
    const state = newGame(1);
    const [a, b] = entitiesOf(state, 'bed_wildflower');
    dispatch(state, reg, { type: 'remove', id: a.id });
    expect(state.inventory.coins).toBe(60 + 10);
    state.clock.tick = 21 * 600;
    dispatch(state, reg, { type: 'remove', id: b.id });
    expect(state.inventory.coins).toBe(70 + 20);
  });

  it('keeps the usual half refund for a hive in winter', () => {
    const state = newGame(1);
    state.clock.tick = 21 * 600;
    state.inventory.coins = 500;
    const spare = spawnEntity(state, reg, 'hive', hex(0, 3));
    dispatch(state, reg, { type: 'remove', id: spare.id });
    expect(state.inventory.coins).toBe(560);
  });
});
```

Add to `describe('safety net', …)` in `tests/sim/advance.test.ts`:

```ts
  it('does not treat winter as a dead end when beds are waiting for spring', () => {
    const state = stuckGame();
    spawnEntity(state, reg, 'bed_wildflower', hex(1, 0));
    state.clock.tick = 21 * TICKS_PER_DAY;
    const events = advance(state, reg, TICKS_PER_DAY);
    expect(events.some((e) => e.type === 'safetyNetGranted')).toBe(false);
    expect(state.inventory.coins).toBe(5);
  });
```

In `tests/sim/balance.test.ts`, make the dead-end fuzz season-proof and run it for a full year:

```ts
  const isRecoverable = (state: GameState) =>
    totalOutputPerDay(state, reg, 'any') > 0 ||
    goodsOnHand(state, reg) > 0 ||
    (state.inventory[COINS] ?? 0) >= reg.cheapestSourceCost();
```

In the fuzz loop, replace `for (let chunk = 0; chunk < 30 * 10; chunk++)` with `for (let chunk = 0; chunk < 28 * 10; chunk++)` (one full year) and the single wildflower sale with:

```ts
        } else if (roll < 0.85) {
          for (const honey of reg.honeys) dispatch(state, reg, { type: 'sell', resource: honey, amount: 'all' });
        }
```

Rename the test to `'random play for a whole year never leaves the player stuck'`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/sim/commands.test.ts tests/sim/advance.test.ts tests/sim/balance.test.ts`
Expected: FAIL (half refund in winter; the safety net grants coins in winter; `totalOutputPerDay` takes no season).

- [ ] **Step 3: Update `src/sim/economy.ts`**

Replace `refundFor` and `totalOutputPerDay`, and the production check in `applySafetyNet`:

```ts
/** What removing a building gives back: half, or `winterSourceRefund` for beds in winter (rules spec §6.2). */
export function refundFor(reg: Registry, def: BuildableDef, season: Season): Amounts {
  const rate = def.source && season === 'winter' ? reg.rules.winterSourceRefund : REFUND_RATE;
  const refund: Amounts = {};
  for (const [res, amount] of Object.entries(def.cost)) {
    const back = Math.floor((amount ?? 0) * rate);
    if (back > 0) refund[res] = back;
  }
  return refund;
}

export function totalOutputPerDay(state: GameState, reg: Registry, season?: SeasonKey): number {
  return entitiesWith(state, reg, 'producer').reduce((sum, e) => sum + outputPerDay(state, reg, e.id, season), 0);
}
```

and in `applySafetyNet`:

```ts
  // Count every bed as blooming: a quiet winter is not a dead end (spec §5.8).
  if (totalOutputPerDay(state, reg, 'any') > 0) return null;
```

Update the imports: `import type { Season } from '../content/types';` (merge with the existing type import) and `import { outputPerDay, storeTotal, type SeasonKey } from './production';`.

- [ ] **Step 4: Update the callers**

In `src/sim/commands.ts` (`remove`): `const refund = refundFor(reg, def, seasonAt(state.clock.tick));` and import `seasonAt` from `./clock`.

In `src/ui/inspect.ts` (`build`): `const label = t('inspect.remove', { coins: refundFor(deps.reg, def, seasonAt(deps.getState().clock.tick))[COINS] ?? 0 });` and import `seasonAt` from `../sim/clock`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/sim tests/ui/inspect.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/sim/economy.ts src/sim/commands.ts src/ui/inspect.ts tests/sim
git commit -m "feat(sim): full refund for beds removed in winter; winter is not a dead end"
```

---

### Task 8: The Honey Journal state

**Files:**
- Create: `src/sim/journal.ts`
- Modify: `src/sim/state.ts` (`journal`)
- Modify: `src/sim/events.ts` (`honeyDiscovered`)
- Modify: `src/sim/batch.ts` (`collectBatch` records the batch)
- Modify: `src/sim/commands.ts` (`sell` records the sale)
- Modify: `src/sim/advance.ts` (`rollDay`)
- Modify: `src/game/save.ts` (migration adds a journal; validation)
- Test: `tests/sim/journal.test.ts` (new), `tests/game/save.test.ts`

**Interfaces:**
- Consumes: `Batch`, `collectBatch` (Task 6); `calendar` (Task 1); `reg.honeys` (Task 2).
- Produces:
  - `JournalEntry { discoveredDay: number | null; bestPurity: number; totalKg: number; totalCoins: number }`
  - `Journal { honey: Record<ResourceId, JournalEntry>; records: { biggestBatchKg; bestDayCoins; todayCoins } }`
  - `emptyJournal(reg): Journal`; `recordBatch(state, reg, batch, at, events): void`; `recordSale(state, resource, coins): void`; `rollDay(state): void`
  - `GameState.journal: Journal`
  - Event `{ type: 'honeyDiscovered'; resource: ResourceId; hex: Hex }` (Spec Delta 1)

- [ ] **Step 1: Write the failing tests**

Create `tests/sim/journal.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ORIGIN } from '../../src/core/hex';
import { advance } from '../../src/sim/advance';
import { collectBatch } from '../../src/sim/batch';
import { TICKS_PER_DAY } from '../../src/sim/clock';
import { dispatch } from '../../src/sim/commands';
import type { GameEvent } from '../../src/sim/events';
import { emptyJournal } from '../../src/sim/journal';
import { entitiesOf, newGame, reg } from './helpers';

function withHive() {
  const state = newGame(1);
  const [hive] = entitiesOf(state, 'hive');
  return { state, hive };
}

describe('Honey Journal', () => {
  it('starts with one empty entry per honey', () => {
    const journal = emptyJournal(reg);
    expect(Object.keys(journal.honey)).toEqual(reg.honeys);
    expect(journal.honey.honey_clover).toEqual({ discoveredDay: null, bestPurity: 0, totalKg: 0, totalCoins: 0 });
    expect(journal.records).toEqual({ biggestBatchKg: 0, bestDayCoins: 0, todayCoins: 0 });
    expect(newGame(1).journal).toEqual(journal);
  });

  it('discovers a honey with the first batch that becomes it, once', () => {
    const { state, hive } = withHive();
    state.clock.tick = 8 * TICKS_PER_DAY + 10; // day 9
    hive.store = { clover: 1 };
    const events: GameEvent[] = [];
    collectBatch(state, reg, hive.id, events);
    expect(events.map((e) => e.type)).toEqual(['harvested', 'honeyDiscovered']);
    expect(events[1]).toEqual({ type: 'honeyDiscovered', resource: 'honey_clover', hex: ORIGIN });
    expect(state.journal.honey.honey_clover).toMatchObject({ discoveredDay: 9, totalKg: 1, bestPurity: 1 });
    hive.store = { clover: 0.5 };
    const again: GameEvent[] = [];
    collectBatch(state, reg, hive.id, again);
    expect(again.map((e) => e.type)).toEqual(['harvested']);
    expect(state.journal.honey.honey_clover.totalKg).toBeCloseTo(1.5);
  });

  it('tracks best purity under the dominant flower even when the batch was mixed', () => {
    const { state, hive } = withHive();
    hive.store = { clover: 0.6, wildflower: 0.4 };
    collectBatch(state, reg, hive.id, []);
    expect(state.journal.honey.honey_clover).toMatchObject({ discoveredDay: null, bestPurity: 0.6, totalKg: 0 });
    expect(state.journal.honey.honey_wildflower).toMatchObject({ discoveredDay: 1, totalKg: 1 });
    expect(state.journal.records.biggestBatchKg).toBe(1);
  });

  it('adds sales to the honey and to today, and keeps the best day', () => {
    const { state } = withHive();
    state.inventory.honey_lavender = 2;
    dispatch(state, reg, { type: 'sell', resource: 'honey_lavender', amount: 'all' });
    expect(state.journal.honey.honey_lavender.totalCoins).toBe(60);
    expect(state.journal.records.todayCoins).toBe(60);
    advance(state, reg, TICKS_PER_DAY);
    expect(state.journal.records).toMatchObject({ bestDayCoins: 60, todayCoins: 0 });
    state.inventory.honey_lavender = 1;
    dispatch(state, reg, { type: 'sell', resource: 'honey_lavender', amount: 'all' });
    advance(state, reg, TICKS_PER_DAY);
    expect(state.journal.records.bestDayCoins).toBe(60);
  });
});
```

In `tests/game/save.test.ts`:
- In both fixture tests, add `expect(state.journal).toEqual(emptyJournal(reg));` and import `emptyJournal` from `'../../src/sim/journal'`.
- Add these entries to `mutations`:

```ts
    ['no journal', (s) => {
      const copy: Partial<GameState> = structuredClone(s);
      delete copy.journal;
      return copy;
    }],
    ['a journal missing a honey', (s) => {
      const copy = structuredClone(s);
      delete (copy.journal.honey as Record<string, unknown>).honey_clover;
      return copy;
    }],
    ['a journal with negative coins', (s) => ({ ...s, journal: { ...s.journal, records: { ...s.journal.records, todayCoins: -1 } } })],
    ['a journal with a purity above 1', (s) => ({
      ...s, journal: { ...s.journal, honey: { ...s.journal.honey, honey_clover: { ...s.journal.honey.honey_clover, bestPurity: 1.5 } } },
    })],
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/sim/journal.test.ts tests/game/save.test.ts`
Expected: FAIL (`sim/journal` does not exist; no `journal` on the state).

- [ ] **Step 3: Create `src/sim/journal.ts`**

```ts
import type { Hex } from '../core/hex';
import type { Registry } from '../content/registry';
import type { ResourceId } from '../content/types';
import type { Batch } from './batch';
import { calendar } from './clock';
import type { GameEvent } from './events';
import type { GameState } from './state';

export interface JournalEntry {
  /** Absolute day of the first batch that became this honey; null until then. */
  discoveredDay: number | null;
  /** Best purity of any batch whose dominant flower makes this honey, pure or not. */
  bestPurity: number;
  totalKg: number;
  totalCoins: number;
}

export interface Journal {
  honey: Record<ResourceId, JournalEntry>;
  records: { biggestBatchKg: number; bestDayCoins: number; todayCoins: number };
}

export function emptyJournal(reg: Registry): Journal {
  const honey: Record<ResourceId, JournalEntry> = {};
  for (const id of reg.honeys) honey[id] = { discoveredDay: null, bestPurity: 0, totalKg: 0, totalCoins: 0 };
  return { honey, records: { biggestBatchKg: 0, bestDayCoins: 0, todayCoins: 0 } };
}

/** Called for every collected batch, after its `harvested` event (spec §5.9). */
export function recordBatch(state: GameState, reg: Registry, batch: Batch, at: Hex, events: GameEvent[]): void {
  const { honey, records } = state.journal;
  const made = honey[batch.resource];
  if (made) {
    made.totalKg += batch.amount;
    if (made.discoveredDay === null) {
      made.discoveredDay = calendar(state.clock.tick).day;
      events.push({ type: 'honeyDiscovered', resource: batch.resource, hex: at });
    }
  }
  const tracked = honey[reg.flower(batch.dominant).honey];
  if (tracked) tracked.bestPurity = Math.max(tracked.bestPurity, batch.purity);
  records.biggestBatchKg = Math.max(records.biggestBatchKg, batch.amount);
}

export function recordSale(state: GameState, resource: ResourceId, coins: number): void {
  const entry = state.journal.honey[resource];
  if (entry) entry.totalCoins += coins;
  state.journal.records.todayCoins += coins;
}

/** At each day start: keep the best day, start a new one. */
export function rollDay(state: GameState): void {
  const r = state.journal.records;
  r.bestDayCoins = Math.max(r.bestDayCoins, r.todayCoins);
  r.todayCoins = 0;
}
```

- [ ] **Step 4: Wire it in**

- `src/sim/events.ts`: add `| { type: 'honeyDiscovered'; resource: ResourceId; hex: Hex }`.
- `src/sim/state.ts`: add `journal: Journal;` to `GameState` (import `type Journal, emptyJournal` from `./journal`), and `journal: emptyJournal(reg),` to the object in `createInitialState`.
- `src/sim/batch.ts` (`collectBatch`): after the `events.push(...)` line add `recordBatch(state, reg, batch, hex(entity.hex.q, entity.hex.r), events);` (a copy, so the event never aliases the entity) and import `recordBatch` from `./journal`.
- `src/sim/commands.ts` (`sell`): before `return ok(...)` add `recordSale(state, resource, coins);` and import `recordSale` from `./journal`.
- `src/sim/advance.ts`: after the `seasonChanged` line add `rollDay(state);` and import `rollDay` from `./journal`.

- [ ] **Step 5: Save the journal**

In `src/game/save.ts`, in migration `2`, before `next.version = 3;` add:

```ts
    next.journal = emptyJournal(reg);
```

(import `emptyJournal` from `../sim/journal`). In `assertGameState`, after `assertWorker(...)`, add `assertJournal(data.journal, reg);` and add below `assertStore`:

```ts
/** One well-formed entry per honey, plus non-negative records. */
function assertJournal(journal: unknown, reg: Registry): void {
  if (!isObject(journal) || !isObject(journal.honey) || !isObject(journal.records)) throw new Error('Save has no journal');
  const honeys = reg.honeys;
  if (Object.keys(journal.honey).length !== honeys.length) throw new Error('Save journal has the wrong honeys');
  for (const honey of honeys) {
    const entry = journal.honey[honey];
    if (!isObject(entry)) throw new Error(`Save journal is missing ${honey}`);
    const day = entry.discoveredDay;
    if (day !== null && !(Number.isInteger(day) && (day as number) >= 1)) throw new Error(`Save journal has a bad discovery day for ${honey}`);
    for (const key of ['bestPurity', 'totalKg', 'totalCoins'] as const) {
      const v = entry[key];
      if (!isFiniteNumber(v) || v < 0) throw new Error(`Save journal has a bad ${key} for ${honey}`);
    }
    if ((entry.bestPurity as number) > 1) throw new Error(`Save journal has a purity above 1 for ${honey}`);
  }
  for (const key of ['biggestBatchKg', 'bestDayCoins', 'todayCoins'] as const) {
    const v = journal.records[key];
    if (!isFiniteNumber(v) || v < 0) throw new Error(`Save journal has a bad record ${key}`);
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/sim tests/game/save.test.ts`
Expected: PASS.

- [ ] **Step 7: Run the full check**

Run: `npm run check`
Expected: PASS. If a `switch` over `GameEvent` is exhaustive, add a `case 'honeyDiscovered':` that returns what its `default` returns.

- [ ] **Step 8: Commit**

```bash
git add src/sim src/game/save.ts tests
git commit -m "feat(sim): Honey Journal: discoveries, best purity, totals and records, saved in v3"
```

---

### Task 9: Build preview effects

**Files:**
- Create: `src/sim/preview.ts`
- Test: `tests/sim/preview.test.ts` (new)

**Interfaces:**
- Consumes: `sim/layout.ts` (Task 4); `reg.rules` (Task 2).
- Produces:
  - `type PreviewRule = 'clump' | 'waterSide' | 'crowded'`
  - `PreviewEffects { self: PreviewRule[]; neighbors: { id: string; change: 'gain' | 'lose'; rule: PreviewRule }[] }`
  - `previewEffects(state, reg, defId, at): PreviewEffects`

- [ ] **Step 1: Write the failing tests**

Create `tests/sim/preview.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ORIGIN, hex } from '../../src/core/hex';
import { spawnEntity } from '../../src/sim/entities';
import { previewEffects } from '../../src/sim/preview';
import { clearEntities, newGame, reg } from './helpers';

function empty() {
  const state = newGame(1);
  clearEntities(state);
  return state;
}

describe('previewEffects', () => {
  it('says a new bed would clump', () => {
    const state = empty();
    spawnEntity(state, reg, 'bed_clover', hex(1, -1));
    spawnEntity(state, reg, 'bed_clover', hex(0, 1));
    expect(previewEffects(state, reg, 'bed_clover', hex(1, 0))).toEqual({ self: ['clump'], neighbors: [] });
    expect(previewEffects(state, reg, 'bed_lavender', hex(1, 0))).toEqual({ self: [], neighbors: [] });
  });

  it('marks a neighbor that the new bed pushes over the clump threshold', () => {
    const state = empty();
    const a = spawnEntity(state, reg, 'bed_clover', hex(1, -1));
    spawnEntity(state, reg, 'bed_clover', hex(2, -2));
    expect(previewEffects(state, reg, 'bed_clover', hex(1, 0))).toEqual({
      self: [],
      neighbors: [{ id: a.id, change: 'gain', rule: 'clump' }],
    });
  });

  it('says a bed beside water gets the water bonus, and a pond gives it to the beds around it', () => {
    const state = empty();
    spawnEntity(state, reg, 'pond', hex(2, 0));
    expect(previewEffects(state, reg, 'bed_wildflower', hex(1, 0)).self).toEqual(['waterSide']);
    const b = spawnEntity(state, reg, 'bed_wildflower', hex(0, 1));
    const c = spawnEntity(state, reg, 'bed_wildflower', hex(-1, 1));
    const pond = previewEffects(state, reg, 'pond', hex(-1, 2)); // touches both beds
    expect(pond.self).toEqual([]);
    expect(pond.neighbors).toEqual(expect.arrayContaining([
      { id: b.id, change: 'gain', rule: 'waterSide' },
      { id: c.id, change: 'gain', rule: 'waterSide' },
    ]));
    expect(pond.neighbors).toHaveLength(2);
  });

  it('warns that hives next to each other get crowded, but only once per hive', () => {
    const state = empty();
    const a = spawnEntity(state, reg, 'hive', ORIGIN);
    expect(previewEffects(state, reg, 'hive', hex(1, 0))).toEqual({
      self: ['crowded'],
      neighbors: [{ id: a.id, change: 'lose', rule: 'crowded' }],
    });
    spawnEntity(state, reg, 'hive', hex(-1, 0)); // `a` is already crowded now
    expect(previewEffects(state, reg, 'hive', hex(1, 0)).neighbors).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/sim/preview.test.ts`
Expected: FAIL (`sim/preview` does not exist).

- [ ] **Step 3: Create `src/sim/preview.ts`**

```ts
import type { Hex } from '../core/hex';
import type { Registry } from '../content/registry';
import { hasProducerNeighbor, neighborEntities, sameFlowerNeighbors, touchesWater } from './layout';
import type { GameState } from './state';

export type PreviewRule = 'clump' | 'waterSide' | 'crowded';

export interface PreviewEffects {
  /** Bonuses (or crowding) the new building itself would get. */
  self: PreviewRule[];
  /** Existing buildings whose bonus or crowding would change. */
  neighbors: { id: string; change: 'gain' | 'lose'; rule: PreviewRule }[];
}

/**
 * What placing `defId` on `at` would do to the layout rules (spec §5.11). Read-only; computed straight
 * from the neighbors, without building a range map. Only meaningful for a valid placement.
 */
export function previewEffects(state: GameState, reg: Registry, defId: string, at: Hex): PreviewEffects {
  const def = reg.buildable(defId);
  const { minNeighbors } = reg.rules.clump;
  const self: PreviewRule[] = [];
  const neighbors: PreviewEffects['neighbors'] = [];

  if (def.source) {
    const flower = def.source.flowerType;
    if (sameFlowerNeighbors(state, reg, at, flower) >= minNeighbors) self.push('clump');
    if (touchesWater(state, at)) self.push('waterSide');
  }
  if (def.producer && hasProducerNeighbor(state, reg, at)) self.push('crowded');

  for (const n of neighborEntities(state, at)) {
    const nDef = reg.buildable(n.def);
    if (def.source && nDef.source?.flowerType === def.source.flowerType) {
      const before = sameFlowerNeighbors(state, reg, n.hex, def.source.flowerType);
      if (before < minNeighbors && before + 1 >= minNeighbors) neighbors.push({ id: n.id, change: 'gain', rule: 'clump' });
    }
    if (def.setsTile === 'water' && nDef.source && !touchesWater(state, n.hex)) {
      neighbors.push({ id: n.id, change: 'gain', rule: 'waterSide' });
    }
    if (def.producer && nDef.producer && !hasProducerNeighbor(state, reg, n.hex)) {
      neighbors.push({ id: n.id, change: 'lose', rule: 'crowded' });
    }
  }
  return { self, neighbors };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/sim/preview.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full check and commit**

Run: `npm run check` (expected: PASS), then:

```bash
git add src/sim/preview.ts tests/sim/preview.test.ts
git commit -m "feat(sim): preview which bonuses a placement would add or take away"
```

---

### Task 10: Balance bot v2

**Files:**
- Modify: `tests/sim/balance.test.ts`
- Possibly modify: `src/content/packs/bees.ts` (only if a target fails; see Step 3)

**Interfaces:**
- Consumes: `isLastDayOfSeason` (Task 1); `getRangeMap`, `intakePerDay(…, 'any')`, `isFull` (Tasks 4–5); `neighborEntities` (Task 4); `state.journal` (Task 8); `PLOT_RADIUS` (`sim/worldgen`).
- Produces: nothing for other tasks.

- [ ] **Step 1: Write the year-long bot**

Add to `tests/sim/balance.test.ts` (merge the new names into the existing imports):

```ts
import { ORIGIN, hexKey, hexNeighbors, hexRange, parseHexKey, type Hex } from '../../src/core/hex';
import { isLastDayOfSeason } from '../../src/sim/clock';
import { neighborEntities } from '../../src/sim/layout';
import { getRangeMap, intakePerDay, isFull } from '../../src/sim/production';
import { PLOT_RADIUS } from '../../src/sim/worldgen';

const isFreeGrass = (state: GameState, h: Hex): boolean => {
  const tile = state.tiles[hexKey(h)];
  return !!tile && tile.owned && !tile.entityId && !tile.decor && tile.tile === 'grass';
};

/** A spot for a new hive with room around it and no beds or hives next to it, so its honey can stay pure. */
function cleanHiveSpot(state: GameState): Hex | null {
  let best: Hex | null = null;
  let bestFree = 2; // at least three free neighbors
  for (const h of hexRange(ORIGIN, PLOT_RADIUS - 1)) {
    if (validatePlace(state, reg, 'hive', h) !== null) continue;
    if (neighborEntities(state, h).some((e) => reg.buildable(e.def).producer || reg.buildable(e.def).source)) continue;
    const free = hexNeighbors(h).filter((n) => isFreeGrass(state, n)).length;
    if (free > bestFree) {
      best = h;
      bestFree = free;
    }
  }
  return best;
}

/**
 * Year-long greedy player (spec §5.14): harvests full hives and every hive on the last day of a season,
 * sells everything, feeds the first hive wildflowers and every later hive clover, and opens a new hive
 * on a clean spot whenever every hive is fed.
 */
function yearBotTurn(state: GameState): void {
  const hives = entitiesWith(state, reg, 'producer');
  const due = isLastDayOfSeason(state.clock.tick) || hives.some((h) => isFull(h, reg.buildable(h.def).producer!.capacity));
  if (due) {
    dispatch(state, reg, { type: 'harvestAll' });
    finishHarvests(state);
    for (const honey of reg.honeys) {
      if ((state.inventory[honey] ?? 0) > 0) dispatch(state, reg, { type: 'sell', resource: honey, amount: 'all' });
    }
  }
  let allFed = true;
  hives.forEach((hive, i) => {
    const bed = i === 0 ? 'bed_wildflower' : 'bed_clover';
    const cap = getRangeMap(state, reg, 'any').capByProducer.get(hive.id) ?? 0;
    for (const n of hexNeighbors(hive.hex)) {
      if (intakePerDay(state, reg, hive.id, 'any') >= cap) break;
      if (validatePlace(state, reg, bed, n) === null) dispatch(state, reg, { type: 'place', def: bed, hex: n });
    }
    const hungry = intakePerDay(state, reg, hive.id, 'any') < cap;
    if (hungry && hexNeighbors(hive.hex).some((n) => isFreeGrass(state, n))) allFed = false;
  });
  if (allFed && (state.inventory[COINS] ?? 0) >= reg.buildable('hive').cost[COINS]!) {
    const spot = cleanHiveSpot(state);
    if (spot) dispatch(state, reg, { type: 'place', def: 'hive', hex: spot });
  }
}

describe('balance v2: one year', () => {
  it('meets the sub-project 3 pacing targets', () => {
    const state = newGame(42);
    let secondHiveDay: number | null = null;
    for (let chunk = 0; chunk < 28 * 10; chunk++) {
      yearBotTurn(state);
      if (secondHiveDay === null && entitiesWith(state, reg, 'producer').length >= 2) secondHiveDay = state.clock.tick / TICKS_PER_DAY + 1;
      advance(state, reg, CHUNK);
    }
    // The second hive around day 6.
    expect(secondHiveDay).not.toBeNull();
    expect(secondHiveDay!).toBeLessThanOrEqual(7);
    // A pure clover batch before the end of summer (day 14).
    const cloverDay = state.journal.honey.honey_clover.discoveredDay;
    expect(cloverDay).not.toBeNull();
    expect(cloverDay!).toBeLessThanOrEqual(14);
    // The starting plot is not full at the end of Year 1.
    const free = hexRange(ORIGIN, PLOT_RADIUS).filter((h) => isFreeGrass(state, h));
    expect(free.length).toBeGreaterThan(0);
  });
});
```

(`parseHexKey` is already imported by the fuzz test; keep it.)

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/sim/balance.test.ts`
Expected: PASS.

- [ ] **Step 3: If a target fails**

Do not loosen the test. Print what the bot reached (add a temporary `console.log` of `secondHiveDay`, `cloverDay` and `free.length`), then tune only the bees-pack starting values, one at a time and within ±25% of the spec number: `bed_clover` cost, `clump.bonus`, hive cost. Re-run after each change. Remove the `console.log`, and list every changed number in the commit message and in the Task 23 report so the user can review it at the playtest gate.

- [ ] **Step 4: Run the full check and commit**

Run: `npm run check` (expected: PASS), then:

```bash
git add tests/sim/balance.test.ts src/content/packs/bees.ts
git commit -m "test(sim): year-long balance bot for seasons and purity"
```

---
## M6.3 — Flower art

### Task 11: Six flower shapes, blooming and resting

**Files:**
- Modify: `src/render/art/flowerbed.ts`
- Test: `tests/render/art.test.ts`

**Interfaces:**
- Consumes: `flowerColors`, `palette` (Task 3).
- Produces: `type BedState = 'bloom' | 'rest'`; `makeFlowerBed(flowerType: string, state: BedState = 'bloom'): THREE.BufferGeometry`.

- [ ] **Step 1: Write the failing tests**

In `tests/render/art.test.ts`, replace the `['flower bed', () => makeFlowerBed('wildflower')],` entry of `geometries` with a spread of every flower in both looks. Put this above `const geometries`:

```ts
const FLOWERS = ['wildflower', 'clover', 'lavender', 'heather', 'sunflower', 'snowdrop'] as const;
const beds: [string, () => THREE.BufferGeometry][] = FLOWERS.flatMap((f) => [
  [`${f} bed`, () => makeFlowerBed(f)] as [string, () => THREE.BufferGeometry],
  [`resting ${f} bed`, () => makeFlowerBed(f, 'rest')] as [string, () => THREE.BufferGeometry],
]);
```

and add `...beds,` inside the `geometries` array in its place. Then add inside `describe('art geometry', …)`:

```ts
  it.each(FLOWERS)('gives %s a resting look that differs from its bloom', (flower) => {
    const bloom = makeFlowerBed(flower);
    const rest = makeFlowerBed(flower, 'rest');
    expect(Array.from(rest.getAttribute('color').array)).not.toEqual(Array.from(bloom.getAttribute('color').array));
    bloom.computeBoundingBox();
    rest.computeBoundingBox();
    expect(rest.boundingBox!.max.y).toBeLessThanOrEqual(bloom.boundingBox!.max.y + 1e-6);
  });

  it('gives each flower its own shape', () => {
    const vertexCounts = FLOWERS.map((f) => makeFlowerBed(f).getAttribute('position').count);
    expect(new Set(vertexCounts).size).toBe(FLOWERS.length);
  });

  it('makes sunflowers the tallest bed and heather one of the lowest', () => {
    const top = (f: string) => {
      const g = makeFlowerBed(f);
      g.computeBoundingBox();
      return g.boundingBox!.max.y;
    };
    for (const f of FLOWERS.filter((x) => x !== 'sunflower')) expect(top('sunflower')).toBeGreaterThan(top(f));
    expect(top('heather')).toBeLessThan(top('lavender'));
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/render/art.test.ts`
Expected: FAIL (every flower builds the same wildflower shape; no rest state).

- [ ] **Step 3: Rewrite `src/render/art/flowerbed.ts`**

```ts
import * as THREE from 'three';
import { flowerColors, palette } from './palette';
import { blob, cone, cylinder, merge, sphere } from './parts';

export type BedState = 'bloom' | 'rest';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
/** How far resting petals fade toward pale beige. */
const REST_FADE = 0.65;
/** Resting flower heads shrink to closed buds. */
const REST_HEAD = 0.55;

/** `n` spots spread by a golden-angle spiral within `radius` of the bed's center. */
function spots(n: number, radius: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const r = radius * Math.sqrt((i + 0.5) / n);
    const a = i * GOLDEN_ANGLE;
    out.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return out;
}

/** A flower color, faded toward beige when the bed is resting. */
function tone(color: string, state: BedState): THREE.Color {
  const c = new THREE.Color(color);
  return state === 'rest' ? c.lerp(new THREE.Color(palette.rest), REST_FADE) : c;
}

const headScale = (state: BedState): number => (state === 'rest' ? REST_HEAD : 1);

type Builder = (state: BedState, colors: readonly string[]) => THREE.BufferGeometry[];

/** One builder per flower (spec §6.2). Stems and leaves stay green at rest; only the flowers fade and close. */
const BUILDERS: Record<string, Builder> = {
  // Mixed five-petal flowers of mid height (the sub-project 1 look).
  wildflower: (state, colors) =>
    spots(11, 0.62).flatMap(([x, z], i) => {
      const height = 0.12 + (i % 3) * 0.03;
      const s = headScale(state);
      const petal = tone(colors[i % colors.length], state);
      const parts = [cylinder(0.012, 0.014, height, 4, palette.stem, { at: [x, height / 2, z] })];
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2 + i;
        parts.push(sphere(0.032 * s, 6, 4, petal, { scale: [1, 0.45, 1], at: [x + Math.cos(a) * 0.04 * s, height, z + Math.sin(a) * 0.04 * s] }));
      }
      parts.push(sphere(0.026 * s, 6, 4, tone(palette.flowerCenter, state), { at: [x, height + 0.01, z] }));
      return parts;
    }),

  // Low round puffs over three-leaf clusters.
  clover: (state, colors) =>
    spots(9, 0.6).flatMap(([x, z], i) => {
      const parts: THREE.BufferGeometry[] = [];
      for (let l = 0; l < 3; l++) {
        const a = (l / 3) * Math.PI * 2 + i;
        parts.push(sphere(0.035, 6, 4, palette.cloverLeaf, { scale: [1, 0.3, 1], at: [x + Math.cos(a) * 0.04, 0.02, z + Math.sin(a) * 0.04] }));
      }
      const h = 0.08 + (i % 2) * 0.02;
      parts.push(cylinder(0.008, 0.01, h, 4, palette.stem, { at: [x, h / 2, z] }));
      parts.push(sphere(0.042 * headScale(state), 7, 5, tone(colors[i % colors.length], state), { scale: [1, 0.85, 1], at: [x, h + 0.02, z] }));
      return parts;
    }),

  // Thin stems with stacked purple buds on the top third.
  lavender: (state, colors) =>
    spots(10, 0.6).flatMap(([x, z], i) => {
      const h = 0.22 + (i % 3) * 0.03;
      const parts = [cylinder(0.007, 0.009, h, 4, palette.stem, { at: [x, h / 2, z] })];
      for (let b = 0; b < 5; b++) {
        parts.push(sphere(0.018 * headScale(state), 5, 4, tone(colors[(i + b) % colors.length], state), {
          scale: [1, 1.3, 1], at: [x, h - 0.075 + b * 0.018, z],
        }));
      }
      return parts;
    }),

  // Squashed bush mounds dotted with small pink flowers.
  heather: (state, colors) =>
    spots(5, 0.5).flatMap(([x, z], i) => {
      const r = 0.11 + (i % 2) * 0.02;
      const parts = [blob(r, palette.bush, { scale: [1, 0.55, 1], at: [x, r * 0.35, z] })];
      for (let d = 0; d < 7; d++) {
        const a = (d / 7) * Math.PI * 2 + i * 0.7;
        const lift = d % 2 === 0 ? 0.55 : 0.3;
        parts.push(sphere(0.02 * headScale(state), 5, 4, tone(colors[d % colors.length], state), {
          at: [x + Math.cos(a) * r * 0.7, r * 0.35 + r * 0.55 * lift, z + Math.sin(a) * r * 0.7],
        }));
      }
      return parts;
    }),

  // Five tall stems, each with two leaves and a flat yellow disk tilted toward the camera (+z).
  sunflower: (state, colors) =>
    spots(5, 0.48).flatMap(([x, z], i) => {
      const h = 0.36 + (i % 2) * 0.05;
      const s = headScale(state);
      const tilt = 0.4;
      return [
        cylinder(0.014, 0.018, h, 5, palette.stem, { at: [x, h / 2, z] }),
        sphere(0.05, 6, 4, palette.leaf2, { scale: [1.4, 0.25, 0.7], rotY: i, at: [x + 0.04, h * 0.45, z] }),
        sphere(0.05, 6, 4, palette.leaf2, { scale: [1.4, 0.25, 0.7], rotY: i + 2, at: [x - 0.04, h * 0.6, z] }),
        cylinder(0.075 * s, 0.075 * s, 0.018, 12, tone(colors[i % colors.length], state), { rotX: tilt, at: [x, h, z + 0.02] }),
        cylinder(0.038 * s, 0.038 * s, 0.022, 10, tone(palette.sunCenter, state), { rotX: tilt, at: [x, h + 0.004, z + 0.024] }),
      ];
    }),

  // Short arched stems with small white drooping bells and a green tip.
  snowdrop: (state, colors) =>
    spots(10, 0.58).flatMap(([x, z], i) => {
      const h = 0.09 + (i % 3) * 0.015;
      const lean = 0.035;
      const s = headScale(state);
      return [
        cylinder(0.006, 0.007, h, 4, palette.stem, { at: [x, h / 2, z] }),
        cylinder(0.005, 0.005, 0.05, 4, palette.stem, { rotZ: -1.1, at: [x + lean / 2, h + 0.008, z] }),
        cone(0.022 * s, 0.038 * s, 6, tone(colors[i % colors.length], state), { rotX: Math.PI, at: [x + lean, h - 0.012, z] }),
        sphere(0.008, 4, 3, palette.snowTip, { at: [x + lean, h + 0.008, z] }),
        sphere(0.018, 5, 4, palette.leaf2, { scale: [0.5, 1.6, 0.5], at: [x - 0.015, 0.03, z] }),
      ];
    }),
};

/** One flower bed on its soil tile. Unknown flowers fall back to the wildflower shape in their colors. */
export function makeFlowerBed(flowerType: string, state: BedState = 'bloom'): THREE.BufferGeometry {
  const colors = flowerColors[flowerType] ?? ['#ffffff'];
  const build = BUILDERS[flowerType] ?? BUILDERS.wildflower;
  return merge(build(state, colors));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/render/art.test.ts`
Expected: PASS. If `'gives each flower its own shape'` fails because two flowers happen to share a vertex count, change one spot count (for example snowdrop `spots(10, …)` to `spots(11, …)`), not the test.

- [ ] **Step 5: Run the full check and commit**

Run: `npm run check` (expected: PASS), then:

```bash
git add src/render/art/flowerbed.ts tests/render/art.test.ts
git commit -m "feat(art): six flower shapes, each with a faded, closed resting look"
```

---

### Task 12: The instanced bed layer

**Files:**
- Create: `src/render/beds.ts`
- Modify: `src/render/sync.ts` (`skip` predicate)
- Modify: `src/render/view.ts`
- Modify: `src/main.ts` (re-sync on `seasonChanged`)
- Test: `tests/render/beds.test.ts` (new), `tests/render/sync.test.ts`

**Interfaces:**
- Consumes: `makeFlowerBed(flower, state)`, `BedState` (Task 11); `reg.blooms` (Task 2); `seasonAt` (Task 1).
- Produces:
  - `class BedLayer { group; constructor(reg, seed); rebuild(state): void; countFor(flower, state): number; get meshCount(): number; get activeMeshes(): number }`
  - `new EntitySync(parent, tiles, skip?: (entity: Entity) => boolean)`
  - `WorldView.beds: BedLayer`; `WorldView.syncEntities(state)` also rebuilds the bed layer.

- [ ] **Step 1: Write the failing tests**

Create `tests/render/beds.test.ts`:

```ts
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ORIGIN, hexKey, hexRange } from '../../src/core/hex';
import { BedLayer } from '../../src/render/beds';
import { spawnEntity } from '../../src/sim/entities';
import { newGame, reg } from '../sim/helpers';

const FLOWERS = ['wildflower', 'clover', 'lavender', 'heather', 'sunflower', 'snowdrop'];

describe('BedLayer', () => {
  it('draws the starting beds as blooming wildflowers', () => {
    const state = newGame(1);
    const layer = new BedLayer(reg, state.seed);
    layer.rebuild(state);
    expect(layer.countFor('wildflower', 'bloom')).toBe(3);
    expect(layer.countFor('wildflower', 'rest')).toBe(0);
  });

  it('moves beds to their resting look when the season changes', () => {
    const state = newGame(1);
    const layer = new BedLayer(reg, state.seed);
    layer.rebuild(state);
    state.clock.tick = 21 * 600;
    layer.rebuild(state);
    expect(layer.countFor('wildflower', 'bloom')).toBe(0);
    expect(layer.countFor('wildflower', 'rest')).toBe(3);
  });

  it('never needs more than one mesh per flower and look, however many beds there are', () => {
    const state = newGame(1);
    const free = hexRange(ORIGIN, 3).filter((h) => !state.tiles[hexKey(h)].entityId);
    free.forEach((h, i) => spawnEntity(state, reg, `bed_${FLOWERS[i % FLOWERS.length]}`, h));
    const layer = new BedLayer(reg, state.seed);
    for (const tick of [0, 7 * 600, 14 * 600, 21 * 600]) {
      state.clock.tick = tick;
      layer.rebuild(state);
      expect(layer.meshCount).toBeLessThanOrEqual(12);
      const drawn = FLOWERS.reduce((n, f) => n + layer.countFor(f, 'bloom') + layer.countFor(f, 'rest'), 0);
      expect(drawn).toBe(free.length + 3);
    }
    const instanced = layer.group.children.filter((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh);
    expect(instanced.length).toBe(layer.meshCount);
  });
});
```

Add to `tests/render/sync.test.ts`:

```ts
  it('skips what the predicate names, but still refreshes those tiles', () => {
    const state = newGame(1);
    const parent = new THREE.Group();
    const tiles = { setTile: vi.fn() };
    const sync = new EntitySync(parent, tiles, (e) => e.def.startsWith('bed_'));
    sync.reconcile(state);
    expect(parent.children).toHaveLength(2); // hive and house
    expect(tiles.setTile).toHaveBeenCalledTimes(5);
    const [bed] = entitiesOf(state, 'bed_wildflower');
    dispatch(state, reg, { type: 'remove', id: bed.id });
    tiles.setTile.mockClear();
    const { removed } = sync.reconcile(state);
    expect(removed).toEqual([bed.id]);
    expect(tiles.setTile).toHaveBeenCalledWith(hexKey(bed.hex), state.tiles[hexKey(bed.hex)]);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/render/beds.test.ts tests/render/sync.test.ts`
Expected: FAIL (`render/beds` does not exist; `EntitySync` has no `skip`).

- [ ] **Step 3: Create `src/render/beds.ts`**

```ts
import * as THREE from 'three';
import { hexToWorld } from '../core/hex';
import { hash2 } from '../core/rng';
import type { Registry } from '../content/registry';
import { seasonAt } from '../sim/clock';
import type { GameState } from '../sim/state';
import { makeFlowerBed, type BedState } from './art/flowerbed';
import { solidMaterial } from './art/materials';

const UP = new THREE.Vector3(0, 1, 0);
const ONE = new THREE.Vector3(1, 1, 1);

/**
 * Every flower bed, as one InstancedMesh per flower × look (spec §6.1): at most 12 draw calls however
 * many beds exist. A bed's look comes from `reg.blooms`, so a bed with no hive in range still rests in winter.
 */
export class BedLayer {
  readonly group = new THREE.Group();
  private readonly meshes = new Map<string, THREE.InstancedMesh>();
  private readonly geometries = new Map<string, THREE.BufferGeometry>();

  constructor(
    private readonly reg: Registry,
    private readonly seed: number,
  ) {}

  get meshCount(): number {
    return this.meshes.size;
  }

  get activeMeshes(): number {
    return [...this.meshes.values()].filter((m) => m.count > 0).length;
  }

  countFor(flower: string, look: BedState): number {
    return this.meshes.get(`${flower}:${look}`)?.count ?? 0;
  }

  /** Call after placement, removal and season changes. */
  rebuild(state: GameState): void {
    const season = seasonAt(state.clock.tick);
    const buckets = new Map<string, THREE.Matrix4[]>();
    for (const entity of Object.values(state.entities)) {
      const source = this.reg.buildable(entity.def).source;
      if (!source) continue;
      const look: BedState = this.reg.blooms(source.flowerType, season) ? 'bloom' : 'rest';
      const key = `${source.flowerType}:${look}`;
      const { x, z } = hexToWorld(entity.hex);
      // A seeded turn per hex, so neighboring beds of one flower don't look stamped.
      const turn = hash2(entity.hex.q, entity.hex.r, this.seed + 53) * Math.PI * 2;
      const matrix = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(UP, turn), ONE);
      const list = buckets.get(key);
      if (list) list.push(matrix);
      else buckets.set(key, [matrix]);
    }
    for (const [key, mesh] of this.meshes) if (!buckets.has(key)) mesh.count = 0;
    for (const [key, list] of buckets) {
      const mesh = this.meshFor(key, list.length);
      list.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }

  /** The mesh for one flower × look, grown (in powers of two) when it runs out of room. */
  private meshFor(key: string, needed: number): THREE.InstancedMesh {
    const existing = this.meshes.get(key);
    if (existing && existing.instanceMatrix.count >= needed) return existing;
    const capacity = Math.max(8, 2 ** Math.ceil(Math.log2(needed)));
    const mesh = new THREE.InstancedMesh(this.geometryFor(key), solidMaterial(), capacity);
    mesh.name = `beds-${key}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (existing) {
      this.group.remove(existing);
      existing.dispose();
    }
    this.meshes.set(key, mesh);
    this.group.add(mesh);
    return mesh;
  }

  private geometryFor(key: string): THREE.BufferGeometry {
    let geometry = this.geometries.get(key);
    if (!geometry) {
      const [flower, look] = key.split(':') as [string, BedState];
      geometry = makeFlowerBed(flower, look);
      this.geometries.set(key, geometry);
    }
    return geometry;
  }
}
```

- [ ] **Step 4: Let `EntitySync` skip beds**

In `src/render/sync.ts`, import `type Entity` from `../sim/state` (alongside `GameState`), then:

1. Change the constructor to:

```ts
  /** Entities `skip` names get no object here (another layer draws them), but their tiles still refresh. */
  private readonly skipped = new Map<string, string>();

  constructor(
    private readonly parent: THREE.Group,
    private readonly tiles: Pick<TileLayer, 'setTile'>,
    private readonly skip: (entity: Entity) => boolean = () => false,
  ) {}
```

2. In `reconcile`, after the loop that removes objects, add:

```ts
    for (const [id, key] of this.skipped) {
      if (state.entities[id]) continue;
      this.skipped.delete(id);
      removed.push(id);
      const tile = state.tiles[key];
      if (tile) this.tiles.setTile(key, tile);
    }
```

3. In the adding loop, replace `if (this.objects.has(entity.id)) continue;` with:

```ts
      if (this.objects.has(entity.id) || this.skipped.has(entity.id)) continue;
      if (this.skip(entity)) {
        const key = hexKey(entity.hex);
        this.skipped.set(entity.id, key);
        added.push(entity.id);
        this.tiles.setTile(key, state.tiles[key]);
        continue;
      }
```

- [ ] **Step 5: Wire the layer into the view**

In `src/render/view.ts`:
- import `BedLayer` from `./beds`;
- add `readonly beds: BedLayer;` to `WorldView`;
- replace `const entities = new EntitySync(entityRoot, tiles);` with:

```ts
  // Flower beds are drawn by the instanced bed layer, not one object each (spec §6.1).
  const entities = new EntitySync(entityRoot, tiles, (e) => reg.buildable(e.def).source !== undefined);
  const beds = new BedLayer(reg, state.seed);
```

- add `beds.group` to the `ctx.scene.add(...)` call;
- after `entities.reconcile(state);` add `beds.rebuild(state);`;
- add `beds,` to the returned object;
- change `syncEntities` to:

```ts
    syncEntities: (s) => {
      entities.reconcile(s);
      beds.rebuild(s);
    },
```

In `src/main.ts`, in the `session.events.onAny` handler, change the sync condition to:

```ts
    if (e.type === 'entityPlaced' || e.type === 'entityRemoved' || e.type === 'seasonChanged') view.syncEntities(session.state);
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/render`
Expected: PASS.

- [ ] **Step 7: Run the full check and the e2e smoke test**

Run: `npm run check && npm run e2e`
Expected: PASS. The smoke test's draw-call budget (< 100) still holds with the bed meshes.

- [ ] **Step 8: Commit**

```bash
git add src/render/beds.ts src/render/sync.ts src/render/view.ts src/main.ts tests/render
git commit -m "feat(render): draw flower beds as instanced meshes per flower and season look"
```

---

### Task 13: Flower-colored hive badges

**Files:**
- Modify: `src/render/badges.ts`
- Modify: `src/base.css` (`--flower-*` colors, fill and stripes)
- Test: `tests/render/badges.test.ts`

**Interfaces:**
- Consumes: `classifyBatch`, `purityThreshold` (Task 6); `isFull`, `storeTotal` (Task 5).
- Produces: badge element with `data-flower="<dominant>"`, CSS variable `--fill`, and class `mixed` when the batch would not come out as its dominant flower's honey. CSS variables `--flower-<id>` on `:root` (used by the UI from Task 15).

- [ ] **Step 1: Write the failing tests**

Add to `tests/render/badges.test.ts` (import `setStore` from `../sim/helpers`):

```ts
  it('colors the bar by the dominant flower and stripes a batch that would not stay pure', () => {
    const state = newGame(1);
    const sync = new EntitySync(new THREE.Group(), { setTile: () => {} });
    sync.reconcile(state);
    const badges = new BadgeLayer();
    const [hive] = entitiesOf(state, 'hive');
    const badge = () => (sync.objectFor(hive.id)!.children.find((c) => c instanceof CSS2DObject) as CSS2DObject).element.querySelector<HTMLElement>('.badge')!;

    badges.update(state, reg, sync);
    expect(badge().dataset.flower).toBe('');
    expect(badge().classList.contains('mixed')).toBe(false);

    hive.store = { clover: 3, wildflower: 1 };
    badges.update(state, reg, sync);
    expect(badge().dataset.flower).toBe('clover');
    expect(badge().style.getPropertyValue('--fill')).toBe('var(--flower-clover)');
    expect(badge().classList.contains('mixed')).toBe(false);

    hive.store = { clover: 1, lavender: 1 };
    badges.update(state, reg, sync);
    expect(badge().dataset.flower).toBe('clover');
    expect(badge().classList.contains('mixed')).toBe(true);
  });

  it('reads 100% and full when a mixed batch fills the hive', () => {
    const state = newGame(1);
    const sync = new EntitySync(new THREE.Group(), { setTile: () => {} });
    sync.reconcile(state);
    const badges = new BadgeLayer();
    const [hive] = entitiesOf(state, 'hive');
    hive.store = { clover: 2.5, wildflower: 2.5 - 1e-10 };
    badges.update(state, reg, sync);
    const el = (sync.objectFor(hive.id)!.children.find((c) => c instanceof CSS2DObject) as CSS2DObject).element;
    expect(el.textContent).toContain('100%');
    expect(el.querySelector('.badge')!.classList.contains('full')).toBe(true);
    setStore(hive, 0);
    badges.update(state, reg, sync);
    expect(el.textContent).toContain('0%');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/render/badges.test.ts`
Expected: FAIL (no `data-flower`, no `mixed`; 99% for the drifted store).

- [ ] **Step 3: Update `src/render/badges.ts`**

1. Imports: add `import { classifyBatch, purityThreshold } from '../sim/batch';` (keep `isFull, storeTotal` from Task 5).
2. Add `flower: string;` to the `Badge` interface and `flower: ''` to the object `create()` returns.
3. In `update`, after the `pct` / fill block and before the `full` toggle, add:

```ts
      const batch = classifyBatch(entity.store ?? {}, producer, reg, purityThreshold(state, reg));
      const flower = batch?.dominant ?? '';
      if (flower !== b.flower) {
        b.flower = flower;
        b.badge.dataset.flower = flower;
        if (flower) b.badge.style.setProperty('--fill', `var(--flower-${flower})`);
        else b.badge.style.removeProperty('--fill');
      }
      // Striped when this batch would lose its flower and come out as mixed honey (spec §6.4).
      b.badge.classList.toggle('mixed', batch !== null && batch.resource !== reg.flower(batch.dominant).honey);
```

4. In `create()`, set `badge.dataset.flower = '';` after its `className` line.
5. Leave the percentage code as Task 5 left it: `fraction` is already 1 when `isFull` says so, so a store within 1e-9 of capacity reads 100%.

- [ ] **Step 4: Add the flower colors and the fill styles**

At the top of `src/base.css`, add:

```css
/* Flower colors, shared by the 3D badges and the DOM UI. Keep in step with flowerColors in render/art/palette.ts. */
:root {
  --flower-wildflower: #f2b53a;
  --flower-clover: #e98fb0;
  --flower-lavender: #9b7fd1;
  --flower-heather: #d96fa5;
  --flower-sunflower: #f5c518;
  --flower-snowdrop: #8fb4c9;
}
```

Replace the `.badge-fill` rule with:

```css
.badge-fill {
  height: 100%;
  width: 0;
  background: var(--fill, #f2b53a);
}

/* A batch that would come out as mixed honey: the flower's color, striped. */
.badge.mixed .badge-fill {
  background: repeating-linear-gradient(135deg, var(--fill, #f2b53a) 0 3px, #fff8ec 3px 5px);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/render/badges.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full check and commit**

Run: `npm run check` (expected: PASS), then:

```bash
git add src/render/badges.ts src/base.css tests/render/badges.test.ts
git commit -m "feat(render): hive badges take the batch's flower color and stripe a mixed batch"
```

---

### Task 14: Flower art gate (human sign-off)

**Files:**
- Modify: `src/game/devtools.ts` (`showcase()`)
- Test: `tests/game/devtools.test.ts`

**Interfaces:**
- Consumes: `Session.reg`, `session.dispatch`.
- Produces: `window.__game.showcase(): void` (dev builds only): tops up coins and places two beds of every flower and a pond on the south half of the plot.

- [ ] **Step 1: Write the failing test**

Add to `tests/game/devtools.test.ts` (it already imports `vi`, `installDevTools`, `Session`, `newGame` and `reg`):

```ts
/** A session with the dev handle installed on a do-nothing view and audio log. */
function devSession(state = newGame(1)): Session {
  const session = new Session(reg, state, true);
  const view = {
    ctx: { renderer: { info: { render: { triangles: 0, calls: 0 } } } },
    hexToClient: vi.fn(() => ({ x: 0, y: 0 })),
    walker: { position: { x: 0, z: 0 } },
  };
  installDevTools(session, view, { log: [] });
  return session;
}

it('lays out a showcase: two beds of every flower and a pond', () => {
  const session = devSession();
  window.__game!.showcase();
  const defs = Object.values(session.state.entities).map((e) => e.def);
  for (const f of reg.flowers.keys()) expect(defs.filter((d) => d === `bed_${f}`).length).toBeGreaterThanOrEqual(2);
  expect(defs).toContain('pond');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/game/devtools.test.ts`
Expected: FAIL (`showcase` is not a function).

- [ ] **Step 3: Add `showcase()`**

In `src/game/devtools.ts`, add to `DevHandle`:

```ts
  /** Art gate helper: coins, then two beds of every flower and a pond on the south half of the plot. */
  showcase(): void;
```

and to the object in `installDevTools` (import `ORIGIN, hexRange` from `../core/hex` and `PLOT_RADIUS` from `../sim/worldgen`):

```ts
    showcase: () => {
      const state = session.state;
      state.inventory.coins = Math.max(state.inventory.coins ?? 0, 10_000);
      const wanted = [...session.reg.flowers.keys()].flatMap((f) => [`bed_${f}`, `bed_${f}`]).concat('pond');
      // The south half faces the default camera.
      for (const h of hexRange(ORIGIN, PLOT_RADIUS).filter((x) => x.r >= 1)) {
        if (wanted.length === 0) break;
        if (session.dispatch({ type: 'place', def: wanted[0], hex: h }).ok) wanted.shift();
      }
    },
```

- [ ] **Step 4: Run the test and the full check**

Run: `npx vitest run tests/game/devtools.test.ts && npm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/devtools.ts tests/game/devtools.test.ts
git commit -m "feat(dev): showcase() lays out every flower and a pond for the art gate"
```

- [ ] **Step 6: Run the gate**

1. Start the dev server (`npm run dev`) and open `/?seed=1`.
2. In the console run `__game.showcase()`, then take one screenshot per season: the current one, then after each `__game.advance(7 * 600)` (four screenshots: spring, summer, autumn, winter). Every flower appears blooming in at least one screenshot and resting in at least one.
3. Take a close-up of the pond and of a hive badge with a mixed batch (`__game.state.entities.e1.store = { clover: 1, lavender: 1 }`).
4. Send the screenshots to the user and ask them to sign off on: the six flower shapes and colors, the resting look, the pond, the badge colors and stripes.

- [ ] **Step 7: STOP and wait for the user's sign-off**

Apply any requested changes (palette values, shapes, sizes) in `palette.ts`, `flowerbed.ts`, `pond.ts` or `base.css`, re-run `npm run check`, re-send screenshots, and commit each round as `style(art): <what changed> after the flower art gate`. Do not start Task 15 until the user signs off. When they do, commit an empty marker: `git commit --allow-empty -m "chore: flower art gate passed"`.

---
## M6.4 — UI

### Task 15: HUD: honey by type, season-end chip, next season

**Files:**
- Create: `src/ui/dots.ts`
- Modify: `src/ui/hud.ts`
- Modify: `src/ui/strings/en.ts`, `src/ui/styles.css`
- Test: `tests/ui/hud.test.ts`

**Interfaces:**
- Consumes: `reg.honeys`, `reg.flowerByHoney`, `reg.flowers`, `reg.blooms` (Task 2); `isLastDayOfSeason`, `nextSeason`, `seasonAt` (Task 1); `--flower-*` (Task 13).
- Produces:
  - `ui/dots.ts`: `flowerDot(flowerId, label?): HTMLElement` (a colored dot; labelled for screen readers when `label` is given); `seasonDots(reg, flowerId): HTMLElement` (four dots, filled for bloom seasons, with an aria-label "Blooms in …").
  - HUD test ids: `honey-breakdown`, `season-end`, `season-next`.
  - Strings: `season.endsTomorrow`, `season.next`, `shop.blooms`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/ui/hud.test.ts`:

```ts
  it('breaks the honey pill down by type, leaving out what you have none of', () => {
    const { deps, state } = makeDeps();
    const hud = createHud(deps);
    state.inventory.honey_clover = 1.25;
    state.inventory.honey_wildflower = 0.5;
    hud.update();
    expect(text(hud.el, 'honey')).toBe('1.7 kg');
    const rows = [...hud.el.querySelectorAll('[data-testid="honey-breakdown"] .honey-row')].map((r) => r.textContent);
    expect(rows).toEqual(['Wildflower honey0.5 kg', 'Clover honey1.2 kg']);
    expect(hud.el.querySelector('[data-testid="honey-breakdown"] .dot')).not.toBeNull();
  });

  it('warns on the last day of a season, and only then', () => {
    const { deps, state } = makeDeps();
    const hud = createHud(deps);
    const chip = hud.el.querySelector<HTMLElement>('[data-testid="season-end"]')!;
    state.clock.tick = 5 * 600;
    hud.update();
    expect(chip.hidden).toBe(true);
    state.clock.tick = 6 * 600 + 10;
    hud.update();
    expect(chip.hidden).toBe(false);
    expect(chip.textContent).toBe('Season ends tomorrow — harvest to keep batches pure');
  });

  it('shows which flowers bloom next season', () => {
    const { deps, state } = makeDeps();
    const hud = createHud(deps);
    hud.update();
    const next = hud.el.querySelector('[data-testid="season-next"]')!;
    expect(next.textContent).toContain('Next: Summer');
    expect([...next.querySelectorAll('.dot')].map((d) => d.getAttribute('aria-label'))).toEqual(['Wildflower', 'Clover', 'Lavender', 'Sunflower']);
    state.clock.tick = 14 * 600; // autumn: winter comes next
    hud.update();
    expect(next.textContent).toContain('Next: Winter');
    expect([...next.querySelectorAll('.dot')].map((d) => d.getAttribute('aria-label'))).toEqual(['Snowdrop']);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/ui/hud.test.ts`
Expected: FAIL (no breakdown, chip or next-season row).

- [ ] **Step 3: Strings**

Add to `src/ui/strings/en.ts`, after the `season.*` keys:

```ts
  'season.endsTomorrow': 'Season ends tomorrow — harvest to keep batches pure',
  'season.next': 'Next: {season}',
```

and after `'shop.cost'`:

```ts
  'shop.blooms': 'Blooms in {seasons}',
```

- [ ] **Step 4: Create `src/ui/dots.ts`**

```ts
import type { Registry } from '../content/registry';
import { SEASONS } from '../content/types';
import { h } from './h';
import { t } from './i18n';

/** A small dot in a flower's color (the --flower-* CSS variables). Labelled when it stands alone. */
export function flowerDot(flowerId: string, label?: string): HTMLElement {
  return h('span', {
    class: 'dot',
    style: `background: var(--flower-${flowerId})`,
    role: label ? 'img' : null,
    'aria-label': label ?? null,
    title: label ?? null,
  });
}

/** Four season dots, filled for the seasons a flower blooms in. */
export function seasonDots(reg: Registry, flowerId: string): HTMLElement {
  const names = SEASONS.filter((s) => reg.blooms(flowerId, s)).map((s) => t(`season.${s}`));
  return h(
    'span',
    { class: 'season-dots', role: 'img', 'aria-label': t('shop.blooms', { seasons: names.join(', ') }) },
    ...SEASONS.map((s) => h('span', { class: reg.blooms(flowerId, s) ? 'season-dot on' : 'season-dot', title: t(`season.${s}`) })),
  );
}
```

- [ ] **Step 5: Extend the HUD**

In `src/ui/hud.ts`:

1. Imports: add `isLastDayOfSeason, nextSeason` to the `../sim/clock` import; add `import { showsAsZeroKg } from './format';` (merge with the existing format import); add `import { flowerDot } from './dots';` and add `tx` to the `./i18n` import.
2. Replace `kgOnHand` with:

```ts
/** Every honey together (spec §7.1): the pill's number. */
function kgOnHand(deps: UiDeps): number {
  const state = deps.getState();
  return deps.reg.honeys.reduce((kg, id) => kg + (state.inventory[id] ?? 0), 0);
}
```

3. Replace the honey pill line with:

```ts
  const breakdown = h('div', { class: 'honey-breakdown', 'data-testid': 'honey-breakdown' });
  const honeyPill = h('div', { class: 'pill honey-pill', title: t('hud.honey'), tabindex: '0' }, icon('honey'), honey, breakdown);
  let breakdownKey = '';
```

4. Replace the `clock-text` element with:

```ts
  const seasonEnd = h('div', { class: 'season-chip', 'data-testid': 'season-end', hidden: true }, t('season.endsTomorrow'));
  const next = h('div', { class: 'clock-next', 'data-testid': 'season-next' });
  let nextShown = '';
```

and in the `clock` element use `h('div', { class: 'clock-text' }, season, day, h('div', { class: 'clock-progress' }, progress), seasonEnd, next)`.

5. In `update()`, after the calendar lines, add:

```ts
      seasonEnd.hidden = !isLastDayOfSeason(state.clock.tick);
      const upcoming = nextSeason(cal.season);
      if (upcoming !== nextShown) {
        nextShown = upcoming;
        const blooming = [...deps.reg.flowers.values()].filter((f) => deps.reg.blooms(f.id, upcoming));
        next.replaceChildren(
          h('span', null, t('season.next', { season: t(`season.${upcoming}`) })),
          ...blooming.map((f) => flowerDot(f.id, tx(`flower.${f.id}`))),
        );
      }
      const shown = deps.reg.honeys.filter((id) => !showsAsZeroKg(state.inventory[id] ?? 0));
      const key = shown.map((id) => `${id}:${formatKg(state.inventory[id] ?? 0)}`).join('|');
      if (key !== breakdownKey) {
        breakdownKey = key;
        breakdown.replaceChildren(
          ...shown.map((id) =>
            h('div', { class: 'honey-row' },
              flowerDot(deps.reg.flowerByHoney(id)!.id),
              h('span', null, tx(`resource.${id}`)),
              h('span', { class: 'kg' }, t('hud.kg', { kg: formatKg(state.inventory[id] ?? 0) })),
            ),
          ),
        );
      }
```

- [ ] **Step 6: Styles**

Add to `src/ui/styles.css`:

```css
.dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; flex: none; }
.honey-breakdown { display: none; position: absolute; top: calc(100% + 6px); left: 0; min-width: 180px; padding: 8px 10px; background: var(--cream); border-radius: 10px; box-shadow: var(--shadow); font-size: 13px; }
.honey-pill:hover .honey-breakdown:not(:empty), .honey-pill:focus-within .honey-breakdown:not(:empty) { display: grid; gap: 4px; }
.honey-row { display: flex; align-items: center; gap: 6px; }
.honey-row .kg { margin-left: auto; }
.season-chip { margin-top: 4px; padding: 2px 8px; border-radius: 999px; background: var(--honey); font-size: 11px; font-weight: 800; }
.clock-next { display: flex; align-items: center; gap: 4px; margin-top: 3px; font-size: 11px; font-weight: 700; color: var(--brown-soft); }
.season-dots { display: inline-flex; gap: 3px; }
.season-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--cream-2); box-shadow: inset 0 0 0 1px var(--brown-soft); }
.season-dot.on { background: var(--honey-deep); box-shadow: none; }
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/ui/hud.test.ts`
Expected: PASS.

- [ ] **Step 8: Run the full check and commit**

Run: `npm run check` (expected: PASS), then:

```bash
git add src/ui tests/ui/hud.test.ts
git commit -m "feat(ui): honey by type, a season-end warning and next season's flowers in the HUD"
```

---

### Task 16: Season banner

**Files:**
- Create: `src/ui/banner.ts`
- Modify: `src/ui/app.ts`, `src/ui/styles.css`
- Test: `tests/ui/banner.test.ts` (new), `tests/ui/app.test.ts`

**Interfaces:**
- Consumes: `flowerDot` (Task 15); `seasonChanged` (Task 1).
- Produces: `BANNER_MS = 2500`; `createBanner(reg): { el: HTMLElement; show(season: Season): void }`.

- [ ] **Step 1: Write the failing tests**

Create `tests/ui/banner.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BANNER_MS, createBanner } from '../../src/ui/banner';
import { reg } from '../sim/helpers';

describe('season banner', () => {
  afterEach(() => vi.useRealTimers());

  it('names the season and what blooms, then goes away', () => {
    vi.useFakeTimers();
    const banner = createBanner(reg);
    expect(banner.el.hidden).toBe(true);
    banner.show('summer');
    expect(banner.el.hidden).toBe(false);
    expect(banner.el.getAttribute('aria-live')).toBe('polite');
    expect(banner.el.textContent).toContain('Summer');
    expect(banner.el.textContent).toContain('Lavender');
    expect(banner.el.textContent).toContain('Sunflower');
    expect(banner.el.textContent).not.toContain('Heather');
    vi.advanceTimersByTime(BANNER_MS + 10);
    expect(banner.el.hidden).toBe(true);
  });

  it('restarts its timer when a second season comes quickly', () => {
    vi.useFakeTimers();
    const banner = createBanner(reg);
    banner.show('autumn');
    vi.advanceTimersByTime(BANNER_MS - 100);
    banner.show('winter');
    vi.advanceTimersByTime(200);
    expect(banner.el.hidden).toBe(false);
    expect(banner.el.textContent).toContain('Snowdrop');
  });
});
```

Add to `tests/ui/app.test.ts`:

```ts
  it('shows the season banner when the season changes', () => {
    const { container, ui } = setup();
    ui.handleEvent({ type: 'seasonChanged', season: 'autumn', year: 1 });
    const banner = container.querySelector<HTMLElement>('.season-banner')!;
    expect(banner.hidden).toBe(false);
    expect(banner.textContent).toContain('Autumn');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/ui/banner.test.ts tests/ui/app.test.ts`
Expected: FAIL (`ui/banner` does not exist).

- [ ] **Step 3: Create `src/ui/banner.ts`**

```ts
import type { Registry } from '../content/registry';
import type { Season } from '../content/types';
import { flowerDot } from './dots';
import { h, setText } from './h';
import { t, tx } from './i18n';

/** How long the banner stays up. Keep in step with the 2.5 s `banner-in` animation in styles.css. */
export const BANNER_MS = 2500;

/** "Summer" and what blooms now (spec §7.2). Never takes input; announced politely to screen readers. */
export function createBanner(reg: Registry): { el: HTMLElement; show(season: Season): void } {
  const title = h('div', { class: 'banner-title' });
  const flowers = h('div', { class: 'banner-flowers' });
  const el = h('div', { class: 'season-banner', role: 'status', 'aria-live': 'polite', 'data-testid': 'season-banner', hidden: true }, title, flowers);
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    el,
    show(season) {
      setText(title, t(`season.${season}`));
      const blooming = [...reg.flowers.values()].filter((f) => reg.blooms(f.id, season));
      flowers.replaceChildren(...blooming.map((f) => h('span', { class: 'banner-flower' }, flowerDot(f.id), tx(`flower.${f.id}`))));
      el.hidden = false;
      el.classList.remove('show');
      void el.offsetWidth; // restart the CSS animation
      el.classList.add('show');
      clearTimeout(timer);
      timer = setTimeout(() => {
        el.hidden = true;
        el.classList.remove('show');
      }, BANNER_MS);
    },
  };
}
```

- [ ] **Step 4: Wire it into the app**

In `src/ui/app.ts`: import `createBanner` from `./banner`; after `const hud = createHud(deps);` add `const banner = createBanner(deps.reg);`; add `banner.el` to the `root` children (after `toasts.el`); and at the start of `handleEvent` add:

```ts
      if (e.type === 'seasonChanged') banner.show(e.season);
```

- [ ] **Step 5: Styles**

Add to `src/ui/styles.css`:

```css
.season-banner { position: absolute; top: 120px; left: 50%; transform: translateX(-50%); padding: 12px 22px; background: var(--cream); border-radius: var(--radius); box-shadow: var(--shadow); text-align: center; }
.season-banner.show { animation: banner-in 2.5s ease-out forwards; }
.banner-title { font-size: 24px; font-weight: 800; }
.banner-flowers { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 4px; font-size: 13px; font-weight: 700; }
.banner-flower { display: flex; align-items: center; gap: 4px; }
@keyframes banner-in {
  0% { opacity: 0; transform: translate(-50%, -8px); }
  12%, 80% { opacity: 1; transform: translate(-50%, 0); }
  100% { opacity: 0; transform: translate(-50%, 0); }
}
@media (prefers-reduced-motion: reduce) { .season-banner.show { animation: none; } }
```

- [ ] **Step 6: Run the tests, the full check, and commit**

Run: `npx vitest run tests/ui && npm run check` (expected: PASS), then:

```bash
git add src/ui tests/ui
git commit -m "feat(ui): a season banner that names what blooms now"
```

---

### Task 17: Shop groups and season dots; Market color dots

**Files:**
- Modify: `src/ui/panels/shop.ts`, `src/ui/panels/market.ts`
- Modify: `src/ui/strings/en.ts`, `src/ui/styles.css`
- Test: `tests/ui/panels.test.ts`

**Interfaces:**
- Consumes: `flowerDot`, `seasonDots` (Task 15); `reg.rules`, `reg.flowerByHoney`, `reg.price` (Task 2).
- Produces: Shop DOM with `.shop-group` sections and `.shop-heading` titles; flower items with `.season-dots` and `.stats`.

- [ ] **Step 1: Write the failing tests**

Add to `describe('Shop', …)` in `tests/ui/panels.test.ts`:

```ts
  it('groups items and shows each flower’s seasons, nectar and pure price', () => {
    const { deps } = makeDeps();
    const shop = createShopPanel(deps, { close: vi.fn(() => true) });
    shop.update();
    expect([...shop.body.querySelectorAll('.shop-heading')].map((e) => e.textContent)).toEqual(['Hives', 'Flowers', 'Water']);
    const clover = [...shop.body.querySelectorAll('.shop-item')].find((b) => b.querySelector('.name')!.textContent === 'Clover bed')!;
    expect(clover.querySelectorAll('.season-dot.on')).toHaveLength(2);
    expect(clover.querySelector('.season-dots')!.getAttribute('aria-label')).toBe('Blooms in Spring, Summer');
    expect(clover.querySelector('.stats')!.textContent).toContain('1 nectar/day · 20 coins/kg pure');
    const pond = [...shop.body.querySelectorAll('.shop-item')].find((b) => b.querySelector('.name')!.textContent === 'Pond')!;
    expect(pond.querySelector('.desc')!.textContent).toBe('Beds next to it: +50%');
  });
```

Add to `describe('Market', …)`:

```ts
  it('marks each honey with its flower color', () => {
    const { deps, state } = makeDeps();
    state.inventory.honey_clover = 2;
    const market = createMarketPanel(deps);
    market.onOpen?.();
    market.update();
    const rows = [...market.body.querySelectorAll<HTMLElement>('.market-row')].filter((r) => !r.hidden);
    expect(rows).toHaveLength(1);
    expect(rows[0].querySelector('.name')!.textContent).toBe('Clover honey');
    expect(rows[0].querySelector<HTMLElement>('.name .dot')!.getAttribute('style')).toContain('--flower-clover');
    expect(rows[0].textContent).toContain('20 coins per kg');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/ui/panels.test.ts`
Expected: FAIL (no headings, dots or stats).

- [ ] **Step 3: Strings**

Add to `src/ui/strings/en.ts`, after `'shop.blooms'`:

```ts
  'shop.group.hives': 'Hives',
  'shop.group.flowers': 'Flowers',
  'shop.group.water': 'Water',
  'shop.group.other': 'More',
  'shop.flowerStats': '{nectar} nectar/day · {price} coins/kg pure',
  'shop.pondHint': 'Beds next to it: +{n}%',
```

- [ ] **Step 4: Group the Shop**

Replace `src/ui/panels/shop.ts` with:

```ts
import { COINS, type BuildableDef } from '../../content/types';
import { canAfford } from '../../sim/economy';
import { seasonDots } from '../dots';
import { h } from '../h';
import { t, tx } from '../i18n';
import { icon, type IconName } from '../icons';
import type { UiDeps } from '../types';
import type { Panel, PanelHost } from './host';

type Group = 'hives' | 'flowers' | 'water' | 'other';
const GROUPS: readonly Group[] = ['hives', 'flowers', 'water', 'other'];

const groupOf = (def: BuildableDef): Group =>
  def.producer ? 'hives' : def.source ? 'flowers' : def.setsTile === 'water' ? 'water' : 'other';
const iconFor = (def: BuildableDef): IconName => (def.producer ? 'hive' : def.source ? 'flower' : 'cart');
const formatNectar = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function createShopPanel(deps: UiDeps, host: Pick<PanelHost, 'close'>): Panel {
  const { reg } = deps;

  const describe = (def: BuildableDef): Node[] => {
    if (def.setsTile === 'water') return [h('span', { class: 'desc' }, t('shop.pondHint', { n: Math.round(reg.rules.waterSide.bonus * 100) }))];
    const parts: Node[] = [h('span', { class: 'desc' }, tx(`defDesc.${def.id}`))];
    if (def.source) {
      const flower = reg.flower(def.source.flowerType);
      parts.push(h('span', { class: 'stats' },
        seasonDots(reg, flower.id),
        t('shop.flowerStats', { nectar: formatNectar(def.source.yieldPerDay), price: reg.price(flower.honey)?.sell ?? 0 }),
      ));
    }
    return parts;
  };

  const items = reg.purchasable().map((def) => {
    const itemIcon = icon(iconFor(def));
    if (def.source) itemIcon.style.color = `var(--flower-${def.source.flowerType})`;
    const button = h(
      'button',
      {
        class: 'btn shop-item', type: 'button',
        onclick: () => {
          host.close();
          deps.startPlacing(def.id);
        },
      },
      itemIcon,
      h('span', { class: 'shop-text' }, h('span', { class: 'name' }, tx(`def.${def.id}`)), ...describe(def)),
      h('span', { class: 'cost' }, icon('coin'), t('shop.cost', { coins: def.cost[COINS] ?? 0 })),
    );
    return { def, button };
  });

  const sections = GROUPS.flatMap((group) => {
    const inGroup = items.filter((i) => groupOf(i.def) === group);
    if (inGroup.length === 0) return [];
    return [h('div', { class: 'shop-group' }, h('h3', { class: 'shop-heading' }, t(`shop.group.${group}`)), ...inGroup.map((i) => i.button))];
  });

  return {
    title: t('shop.title'),
    body: h('div', { class: 'shop' }, h('p', { class: 'muted' }, t('shop.hint')), ...sections),
    update() {
      const inventory = deps.getState().inventory;
      for (const { def, button } of items) button.disabled = !canAfford(inventory, def.cost);
    },
  };
}
```

- [ ] **Step 5: Color the Market rows**

In `src/ui/panels/market.ts`, import `flowerDot` from `../dots`, and in `createRow` replace the name element `h('div', { class: 'name' }, tx(\`resource.${resource}\`)),` with:

```ts
    h('div', { class: 'name' }, ...(flower ? [flowerDot(flower.id)] : []), tx(`resource.${resource}`)),
```

adding `const flower = deps.reg.flowerByHoney(resource);` at the top of `createRow`. Rows still show only for honey in stock (Spec Delta 2).

- [ ] **Step 6: Styles**

Add to `src/ui/styles.css`:

```css
.shop-heading { margin: 12px 0 0; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--brown-soft); }
.shop-item .stats { display: flex; align-items: center; gap: 6px; margin-top: 2px; font-size: 11px; font-weight: 700; color: var(--brown-soft); }
.shop { max-height: min(60vh, 520px); overflow-y: auto; }
.market-row .name { display: flex; align-items: center; gap: 6px; }
```

- [ ] **Step 7: Run the tests, the full check, and commit**

Run: `npx vitest run tests/ui/panels.test.ts && npm run check` (expected: PASS), then:

```bash
git add src/ui tests/ui/panels.test.ts
git commit -m "feat(ui): Shop groups with season dots and flower stats; Market color dots"
```

---

### Task 18: Hive, bed and pond popovers

**Files:**
- Modify: `src/ui/inspect.ts`
- Modify: `src/ui/strings/en.ts`, `src/ui/styles.css`
- Test: `tests/ui/inspect.test.ts`

**Interfaces:**
- Consumes: `classifyBatch`, `purityThreshold` (Task 6); `getRangeMap` boosts, `crowded` (Task 4); `neighborEntities` (Task 4); `refundFor(reg, def, season)` (Task 7); `seasonAt`, `nextSeason` (Task 1); `seasonDots` (Task 15).
- Produces: strings `inspect.batch*`, `inspect.pure`, `inspect.resting`, `inspect.crowded`, `inspect.sharedX`, `inspect.base`, `inspect.plusClump`, `inspect.plusWater`, `inspect.yieldBoosted`, `inspect.pondBeds*`, `preview.clump`, `preview.water`, `preview.crowded` (the `preview.*` keys are reused by Task 21).

- [ ] **Step 1: Write the failing tests**

Add to `tests/ui/inspect.test.ts` (import `setStore` from `../sim/helpers` if needed):

```ts
  it('shows what the batch would become', () => {
    const { deps, state } = makeDeps();
    const inspect = createInspect(deps);
    const [hive] = entitiesOf(state, 'hive');
    hive.store = { clover: 0.9, wildflower: 0.3 };
    inspect.open(hive.id, at);
    expect(inspect.el.textContent).toContain('Clover 75% · Wildflower 25% → pure Clover');
    hive.store = { clover: 0.5, lavender: 0.5 };
    inspect.update();
    expect(inspect.el.textContent).toContain('Clover 50% · Lavender 50% → Wildflower honey');
    hive.store = {};
    inspect.update();
    expect(inspect.el.textContent).toContain('Empty');
  });

  it('lists the beds in range with their bonuses, and says when they rest or the hive is crowded', () => {
    const { deps, state } = makeDeps();
    spawnEntity(state, reg, 'bed_wildflower', hex(0, 1)); // (-1,1) now has two wildflower neighbors
    const inspect = createInspect(deps);
    const [hive] = entitiesOf(state, 'hive');
    inspect.open(hive.id, at);
    expect(inspect.el.textContent).toContain('Wildflower · +50% clump');
    state.clock.tick = 21 * 600;
    inspect.update();
    expect(inspect.el.textContent).toContain('Wildflower · Resting until Spring');
    spawnEntity(state, reg, 'hive', hex(1, -1));
    inspect.update();
    expect(inspect.el.textContent).toContain('Crowded');
  });

  it('breaks a bed’s nectar down, or says when it will bloom again', () => {
    const { deps, state } = makeDeps();
    spawnEntity(state, reg, 'bed_wildflower', hex(0, 1));
    const inspect = createInspect(deps);
    inspect.open(bedAt(state, -1, 1).id, at);
    expect(inspect.el.textContent).toContain('1.5 nectar/day (base 1 + clump 50%)');
    expect(inspect.el.querySelectorAll('.season-dot.on')).toHaveLength(3);
    state.clock.tick = 21 * 600;
    inspect.update();
    expect(inspect.el.textContent).toContain('Resting until Spring');
  });

  it('offers the full refund for a bed in winter, and pays it', () => {
    vi.useFakeTimers();
    const { deps, state } = makeDeps();
    state.clock.tick = 21 * 600;
    const bed = bedAt(state, -1, 0);
    const inspect = createInspect(deps);
    inspect.open(bed.id, at);
    const remove = [...inspect.el.querySelectorAll('button')].find((b) => b.textContent === 'Remove (+20)')!;
    remove.click();
    remove.click();
    expect(state.inventory.coins).toBe(80);
  });

  it('says how many beds a pond waters', () => {
    const { deps, state } = makeDeps();
    const pond = spawnEntity(state, reg, 'pond', hex(0, -1)); // touches the bed at (-1,0)
    const inspect = createInspect(deps);
    inspect.open(pond.id, at);
    expect(inspect.el.textContent).toContain('1 bed gets +50%');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/ui/inspect.test.ts`
Expected: FAIL.

- [ ] **Step 3: Strings**

Add to `src/ui/strings/en.ts`, after `'inspect.feedsMany'`:

```ts
  'inspect.batch': '{parts} → {result}',
  'inspect.batchPart': '{flower} {pct}%',
  'inspect.batchEmpty': 'Empty',
  'inspect.pure': 'pure {honey}',
  'inspect.resting': 'Resting until {season}',
  'inspect.crowded': 'Crowded: another hive stands next to it',
  'inspect.sharedX': 'shared ×{n}',
  'inspect.base': 'base {n}',
  'inspect.plusClump': 'clump {n}%',
  'inspect.plusWater': 'water {n}%',
  'inspect.yieldBoosted': '{n} nectar/day ({parts})',
  'inspect.pondBeds': '{n} beds get +{p}%',
  'inspect.pondBedsOne': '1 bed gets +{p}%',

  'preview.clump': '+{n}% clump',
  'preview.water': '+{n}% water',
  'preview.crowded': '−{n}% crowded',
```

- [ ] **Step 4: Extend `src/ui/inspect.ts`**

1. Imports: add `import { SEASONS, type Season } from '../content/types';` (merge with the `COINS` import), `import { classifyBatch, purityThreshold } from '../sim/batch';`, `import { nextSeason, seasonAt } from '../sim/clock';`, `import { neighborEntities } from '../sim/layout';`, `import { seasonDots } from './dots';`.
2. Change `const POPOVER_H = 220;` to `const POPOVER_H = 320;`.
3. Add these helpers inside `createInspect`, after `describeFeeding`:

```ts
  const pct = (fraction: number) => Math.round(fraction * 100);
  const formatNectar = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

  /** The next season this flower blooms in, counting from now. */
  const nextBloom = (flower: string): Season => {
    let s = seasonAt(deps.getState().clock.tick);
    for (let i = 0; i < SEASONS.length; i++) {
      s = nextSeason(s);
      if (deps.reg.blooms(flower, s)) return s;
    }
    return s;
  };

  /** "Clover 82% · Wildflower 18% → pure Clover" (spec §7.5). */
  const describeBatch = (e: Entity): string => {
    const producer = deps.reg.buildable(e.def).producer!;
    const store = e.store ?? {};
    const batch = classifyBatch(store, producer, deps.reg, purityThreshold(deps.getState(), deps.reg));
    if (!batch) return t('inspect.batchEmpty');
    const parts = [...deps.reg.flowers.keys()]
      .filter((f) => (store[f] ?? 0) > 0)
      .sort((a, b) => store[b] - store[a])
      .map((f) => t('inspect.batchPart', { flower: tx(`flower.${f}`), pct: pct(store[f] / batch.amount) }))
      .join(' · ');
    const pure = batch.resource === deps.reg.flower(batch.dominant).honey;
    const result = pure ? t('inspect.pure', { honey: tx(`flower.${batch.dominant}`) }) : tx(`resource.${batch.resource}`);
    return t('inspect.batch', { parts, result });
  };

  /** One line per bed in range: flower, resting, bonuses, sharing. */
  const describeBeds = (e: Entity): string => {
    const map = rangeMap();
    const { clump, waterSide } = deps.reg.rules;
    return (map.sharesByProducer.get(e.id) ?? []).map((s) => {
      const tags = [tx(`flower.${s.flowerType}`)];
      if (s.dormant) tags.push(t('inspect.resting', { season: t(`season.${nextBloom(s.flowerType)}`) }));
      const boost = map.boostBySource.get(s.sourceId);
      if (boost?.clump) tags.push(t('preview.clump', { n: pct(clump.bonus) }));
      if (boost?.waterSide) tags.push(t('preview.water', { n: pct(waterSide.bonus) }));
      if (s.sharedWith > 1) tags.push(t('inspect.sharedX', { n: s.sharedWith }));
      return tags.join(' · ');
    }).join('\n');
  };

  /** "1.5 nectar/day (base 1 + clump 50%)", or when it blooms again. */
  const describeYield = (e: Entity): string => {
    const source = deps.reg.buildable(e.def).source!;
    if (!deps.reg.blooms(source.flowerType, seasonAt(deps.getState().clock.tick))) {
      return t('inspect.resting', { season: t(`season.${nextBloom(source.flowerType)}`) });
    }
    const boost = rangeMap().boostBySource.get(e.id);
    const total = source.yieldPerDay * (boost?.multiplier ?? 1);
    const parts = [t('inspect.base', { n: formatNectar(source.yieldPerDay) })];
    if (boost?.clump) parts.push(t('inspect.plusClump', { n: pct(deps.reg.rules.clump.bonus) }));
    if (boost?.waterSide) parts.push(t('inspect.plusWater', { n: pct(deps.reg.rules.waterSide.bonus) }));
    return parts.length > 1
      ? t('inspect.yieldBoosted', { n: formatNectar(total), parts: parts.join(' + ') })
      : t('inspect.yield', { n: formatNectar(total) });
  };

  const describePond = (e: Entity): string => {
    const n = neighborEntities(deps.getState(), e.hex).filter((x) => deps.reg.buildable(x.def).source).length;
    const p = pct(deps.reg.rules.waterSide.bonus);
    return n === 1 ? t('inspect.pondBedsOne', { p }) : t('inspect.pondBeds', { n, p });
  };
```

4. In `build`, for producers, insert the batch row after the rate row, and the bed list and crowded rows after `row(describeSources)`:

```ts
        row(describeBatch),
        row(describeSources),
        row(describeBeds),
        row((e) => (rangeMap().crowded.has(e.id) ? t('inspect.crowded') : '')),
```

(so the producer block is: fill, rate, batch, sources summary, bed list, crowded).

5. Replace the source line `if (source) parts.push(row(() => t('inspect.yield', { n: source.yieldPerDay })), row(describeFeeding));` with:

```ts
    if (source) parts.push(row(describeYield), seasonDots(deps.reg, source.flowerType), row(describeFeeding));
    if (def.setsTile === 'water') parts.push(row(describePond));
```

- [ ] **Step 5: Styles**

Add to `src/ui/styles.css`:

```css
.inspect .row { white-space: pre-line; }
.inspect .row:empty { display: none; }
.inspect .season-dots { margin: 2px 0; }
```

- [ ] **Step 6: Run the tests, the full check, and commit**

Run: `npx vitest run tests/ui/inspect.test.ts && npm run check` (expected: PASS; the earlier inspect tests keep passing because the summary rows stay), then:

```bash
git add src/ui tests/ui/inspect.test.ts
git commit -m "feat(ui): popovers show the batch mix, bed bonuses, resting beds, crowding and ponds"
```

---

### Task 19: Harvest and discovery feedback

**Files:**
- Modify: `src/ui/feedback.ts`, `src/ui/app.ts`
- Modify: `src/audio/cues.ts` (a sound for a new honey)
- Modify: `src/ui/strings/en.ts`, `src/base.css`
- Test: `tests/ui/foundation.test.ts`, `tests/ui/app.test.ts`, `tests/audio/cues.test.ts`

**Interfaces:**
- Consumes: `harvested` with `dominant`/`purity` (Task 6); `honeyDiscovered { resource, hex }` (Task 8).
- Produces: `Floater` gains `flower?: string`, `tone` gains `'discovery'`, `icon` gains `'flower'`; `toastForEvent(e, reg?)`.

- [ ] **Step 1: Write the failing tests**

In `tests/ui/foundation.test.ts`, in `'shows collected honey over the hive, never +0.0 kg'`, replace the expected floater with:

```ts
      { anchor: { kind: 'world', hex: ORIGIN }, text: '+1.2 kg Wildflower', tone: 'honey', icon: 'honey', flower: 'wildflower' },
```

and add:

```ts
  it('names the honey a batch became, in its color', () => {
    const clover = { type: 'harvested' as const, id: 'e1', hex: ORIGIN, resource: 'honey_clover', amount: 2, dominant: 'clover', purity: 0.9 };
    expect(floatersForEvent(clover, reg)).toEqual([
      { anchor: { kind: 'world', hex: ORIGIN }, text: '+2.0 kg Clover', tone: 'honey', icon: 'honey', flower: 'clover' },
    ]);
  });

  it('celebrates a new honey with a toast and a floater over the hive', () => {
    const found = { type: 'honeyDiscovered' as const, resource: 'honey_lavender', hex: ORIGIN };
    expect(toastForEvent(found, reg)).toEqual({ text: 'New honey: Lavender!', kind: 'success' });
    expect(floatersForEvent(found, reg)).toEqual([
      { anchor: { kind: 'world', hex: ORIGIN }, text: 'New: Lavender', tone: 'discovery', icon: 'flower', flower: 'lavender' },
    ]);
  });

  it('colors a floater by its flower', () => {
    const el = floaterElement({ anchor: { kind: 'world', hex: ORIGIN }, text: '+1.0 kg Clover', tone: 'honey', icon: 'honey', flower: 'clover' });
    expect(el.getAttribute('style')).toContain('--floater-color: var(--flower-clover)');
  });
```

In `tests/audio/cues.test.ts`, add (the rules spec asks for a celebration sound; the existing chime is it):

```ts
  it('chimes for a new honey', () => {
    expect(cueForEvent({ type: 'honeyDiscovered', resource: 'honey_clover', hex: ORIGIN }, reg)).toBe('chime');
  });
```

In `tests/ui/app.test.ts`, add:

```ts
  it('toasts a new honey', () => {
    const { container, ui } = setup();
    ui.handleEvent({ type: 'honeyDiscovered', resource: 'honey_clover', hex: ORIGIN });
    expect(container.querySelector('.toasts')!.textContent).toContain('New honey: Clover!');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/ui/foundation.test.ts tests/ui/app.test.ts`
Expected: FAIL.

- [ ] **Step 3: Strings**

Add to `src/ui/strings/en.ts`:

```ts
  'toast.honeyDiscovered': 'New honey: {honey}!',
  'floater.kgGainHoney': '+{kg} kg {honey}',
  'floater.newHoney': 'New: {honey}',
```

- [ ] **Step 4: Update `src/ui/feedback.ts`**

1. Add `tx` to the `./i18n` import.
2. Add a helper below `reasonText`:

```ts
/** "Clover" for honey_clover, falling back to the resource's own name. */
function honeyName(resource: string, reg?: Registry): string {
  const flower = reg?.flowerByHoney(resource);
  return flower ? tx(`flower.${flower.id}`) : tx(`resource.${resource}`);
}
```

3. Change `toastForEvent`'s signature to `export function toastForEvent(e: GameEvent, reg?: Registry): { text: string; kind: ToastKind } | null` and add a case:

```ts
    case 'honeyDiscovered':
      return { text: t('toast.honeyDiscovered', { honey: honeyName(e.resource, reg) }), kind: 'success' };
```

4. Change the `Floater` interface to:

```ts
export interface Floater {
  anchor: FloaterAnchor;
  text: string;
  tone: 'honey' | 'coins' | 'spend' | 'discovery';
  icon: 'honey' | 'coin' | 'flower';
  /** Colors the floater with this flower's --flower-* color. */
  flower?: string;
}
```

5. Replace the `harvested` case in `floatersForEvent` and add `honeyDiscovered`:

```ts
    case 'harvested': {
      if (showsAsZeroKg(e.amount)) return [];
      const flower = reg.flowerByHoney(e.resource)?.id;
      const text = t('floater.kgGainHoney', { kg: formatKg(e.amount), honey: honeyName(e.resource, reg) });
      return [{ anchor: { kind: 'world', hex: e.hex }, text, tone: 'honey', icon: 'honey', ...(flower ? { flower } : {}) }];
    }
    case 'honeyDiscovered': {
      const flower = reg.flowerByHoney(e.resource)?.id;
      const text = t('floater.newHoney', { honey: honeyName(e.resource, reg) });
      return [{ anchor: { kind: 'world', hex: e.hex }, text, tone: 'discovery', icon: 'flower', ...(flower ? { flower } : {}) }];
    }
```

6. Replace `floaterElement` with:

```ts
export function floaterElement(f: Floater): HTMLElement {
  const style = f.flower ? `--floater-color: var(--flower-${f.flower})` : null;
  return h('div', { class: `floater ${f.tone}`, style }, icon(f.icon), h('span', null, f.text));
}
```

In `src/ui/app.ts`, change `const toast = toastForEvent(e);` to `const toast = toastForEvent(e, deps.reg);`.

In `src/audio/cues.ts`, add `case 'honeyDiscovered':` directly above `case 'sold':`, so it shares the `'chime'` return.

- [ ] **Step 5: Styles**

In `src/base.css`, change `.floater.honey { color: #b7780f; }` to use the flower color, and add the discovery tone:

```css
.floater.honey {
  color: #b7780f;
  border-bottom: 3px solid var(--floater-color, transparent);
}

.floater.discovery {
  color: #5a3d2b;
  box-shadow: 0 0 0 2px var(--floater-color, #f2b53a), 0 2px 6px rgba(70, 45, 20, 0.2);
}
```

(The amber text stays readable for every flower; the flower color shows as an underline or ring. Pale snowdrop text would not be readable on cream.)

- [ ] **Step 6: Run the tests, the full check, and commit**

Run: `npx vitest run tests/ui && npm run check` (expected: PASS), then:

```bash
git add src/ui src/audio/cues.ts src/base.css tests/ui tests/audio
git commit -m "feat(ui): name the honey a batch became, and celebrate a new one"
```

---

### Task 20: The Journal panel, toolbar button and J key

**Files:**
- Create: `src/ui/panels/journal.ts`
- Modify: `src/ui/icons.ts` (`book`), `src/ui/toolbar.ts`, `src/ui/app.ts`
- Modify: `src/game/controller.ts` (J key)
- Modify: `src/ui/strings/en.ts`, `src/ui/styles.css`
- Test: `tests/ui/journal.test.ts` (new), `tests/ui/toolbar.test.ts`, `tests/ui/app.test.ts`, `tests/game/controller.test.ts`

**Interfaces:**
- Consumes: `state.journal` (Task 8); `DAYS_PER_YEAR` (Task 1); `flowerDot` (Task 15).
- Produces: `createJournalPanel(deps): Panel`; toolbar `actions.openJournal()`; `Ui.toggleJournal(): void`; controller key `j`/`J`.

- [ ] **Step 1: Write the failing tests**

Create `tests/ui/journal.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createJournalPanel } from '../../src/ui/panels/journal';
import { makeDeps } from './helpers';

describe('Honey Journal panel', () => {
  it('hides undiscovered honey behind a question mark and a bloom hint', () => {
    const { deps } = makeDeps();
    const journal = createJournalPanel(deps);
    journal.update();
    expect(journal.title).toBe('Honey Journal');
    const card = journal.body.querySelector('[data-flower="clover"]')!;
    expect(card.classList.contains('undiscovered')).toBe(true);
    expect(card.querySelector('.journal-name')!.textContent).toBe('?');
    expect(card.textContent).toContain('Blooms in Spring, Summer');
  });

  it('fills in a discovered honey and the records', () => {
    const { deps, state } = makeDeps();
    Object.assign(state.journal.honey.honey_clover, { discoveredDay: 30, bestPurity: 0.913, totalKg: 4.25, totalCoins: 85 });
    Object.assign(state.journal.records, { biggestBatchKg: 3.5, bestDayCoins: 40, todayCoins: 55 });
    const journal = createJournalPanel(deps);
    journal.update();
    const card = journal.body.querySelector('[data-flower="clover"]')!;
    expect(card.classList.contains('undiscovered')).toBe(false);
    expect(card.querySelector('.journal-name')!.textContent).toBe('Clover honey');
    expect(card.textContent).toContain('Discovered: Year 2, day 2');
    expect(card.textContent).toContain('Best purity 91%');
    expect(card.textContent).toContain('Harvested 4.2 kg');
    expect(card.textContent).toContain('Earned 85 coins');
    expect(journal.body.textContent).toContain('Biggest batch: 3.5 kg');
    expect(journal.body.textContent).toContain('Best day: 55 coins');
  });
});
```

In `tests/ui/toolbar.test.ts`, give every `actions` object an `openJournal`:

```bash
perl -pi -e 's/\{ openShop: vi\.fn\(\), openMarket: vi\.fn\(\), toast: vi\.fn\(\) \}/{ openShop: vi.fn(), openMarket: vi.fn(), openJournal: vi.fn(), toast: vi.fn() }/g' tests/ui/toolbar.test.ts
```

and add:

```ts
  it('opens the Journal', () => {
    const { deps } = makeDeps();
    const actions = { openShop: vi.fn(), openMarket: vi.fn(), openJournal: vi.fn(), toast: vi.fn() };
    const bar = createToolbar(deps, actions);
    [...bar.el.querySelectorAll('button')].find((b) => b.textContent === 'Journal')!.click();
    expect(actions.openJournal).toHaveBeenCalled();
  });
```

In `tests/game/controller.test.ts`, add `toggleJournal: vi.fn()` to the `ui` object in `setup()`, and add:

```ts
  it('opens the Journal with J', () => {
    const { controller, ui } = setup();
    expect(controller.key('j')).toBe(true);
    expect(ui.toggleJournal).toHaveBeenCalled();
  });
```

In `tests/ui/app.test.ts`, add:

```ts
  it('opens the Journal from the toolbar and from toggleJournal', () => {
    const { container, ui } = setup();
    const panel = container.querySelector<HTMLElement>('.panel-host')!;
    ui.toggleJournal();
    expect(panel.hidden).toBe(false);
    expect(panel.textContent).toContain('Honey Journal');
    ui.toggleJournal();
    expect(panel.hidden).toBe(true);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/ui tests/game/controller.test.ts`
Expected: FAIL.

- [ ] **Step 3: Strings and icon**

Add to `src/ui/strings/en.ts`:

```ts
  'toolbar.journal': 'Journal',
  'journal.title': 'Honey Journal',
  'journal.unknown': '?',
  'journal.discovered': 'Discovered: Year {year}, day {day}',
  'journal.undiscovered': 'Blooms in {seasons}',
  'journal.bestPurity': 'Best purity {pct}%',
  'journal.totalKg': 'Harvested {kg} kg',
  'journal.totalCoins': 'Earned {coins} coins',
  'journal.records': 'Records',
  'journal.biggestBatch': 'Biggest batch: {kg} kg',
  'journal.bestDay': 'Best day: {coins} coins',
```

Add to `ICONS` in `src/ui/icons.ts`:

```ts
  book: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/><path d="M9 7h6"/>',
```

- [ ] **Step 4: Create `src/ui/panels/journal.ts`**

```ts
import { DAYS_PER_YEAR } from '../../sim/clock';
import { flowerDot } from '../dots';
import { formatCoins, formatKg } from '../format';
import { h, setText } from '../h';
import { t, tx } from '../i18n';
import type { UiDeps } from '../types';
import type { Panel } from './host';

/** Absolute day → year and day of that year. */
const dayParts = (day: number) => ({ year: Math.floor((day - 1) / DAYS_PER_YEAR) + 1, day: ((day - 1) % DAYS_PER_YEAR) + 1 });

/** Six cards, one per honey, plus records (spec §7.6). */
export function createJournalPanel(deps: UiDeps): Panel {
  const cards = [...deps.reg.flowers.values()].map((flower) => {
    const name = h('span');
    const status = h('div', { class: 'journal-status' });
    const purity = h('span');
    const kg = h('span');
    const coins = h('span');
    const el = h(
      'div',
      { class: 'journal-card', 'data-flower': flower.id },
      h('div', { class: 'journal-name' }, flowerDot(flower.id), name),
      status,
      h('div', { class: 'journal-stats' }, purity, kg, coins),
    );
    return { flower, el, name, status, purity, kg, coins };
  });
  const biggest = h('div');
  const bestDay = h('div');

  return {
    title: t('journal.title'),
    body: h(
      'div',
      { class: 'journal' },
      h('div', { class: 'journal-cards' }, ...cards.map((c) => c.el)),
      h('h3', { class: 'journal-heading' }, t('journal.records')),
      biggest,
      bestDay,
    ),
    update() {
      const journal = deps.getState().journal;
      for (const c of cards) {
        const entry = journal.honey[c.flower.honey];
        const found = entry.discoveredDay !== null;
        c.el.classList.toggle('undiscovered', !found);
        setText(c.name, found ? tx(`resource.${c.flower.honey}`) : t('journal.unknown'));
        setText(c.status, found
          ? t('journal.discovered', dayParts(entry.discoveredDay!))
          : t('journal.undiscovered', { seasons: c.flower.blooms.map((s) => t(`season.${s}`)).join(', ') }));
        setText(c.purity, t('journal.bestPurity', { pct: Math.round(entry.bestPurity * 100) }));
        setText(c.kg, t('journal.totalKg', { kg: formatKg(entry.totalKg) }));
        setText(c.coins, t('journal.totalCoins', { coins: formatCoins(entry.totalCoins) }));
      }
      setText(biggest, t('journal.biggestBatch', { kg: formatKg(journal.records.biggestBatchKg) }));
      // Today counts too: a record set this morning should show before tomorrow.
      setText(bestDay, t('journal.bestDay', { coins: formatCoins(Math.max(journal.records.bestDayCoins, journal.records.todayCoins)) }));
    },
  };
}
```

Note: in the undiscovered test the name is `'?'` and the dot is still there, but `.journal-name` text is only the name span's text (the dot has no text).

- [ ] **Step 5: Toolbar, app and controller**

In `src/ui/toolbar.ts`, add `openJournal(): void;` to the `actions` type, and add the button between Market and Harvest All:

```ts
    hexButton('book', t('toolbar.journal'), () => actions.openJournal()),
```

In `src/ui/app.ts`:
- import `createJournalPanel` from `./panels/journal`;
- after `const market = …` add `const journal = createJournalPanel(deps);`;
- add `openJournal: () => panels.toggle(journal),` to the toolbar actions;
- add `toggleJournal(): void;` to the `Ui` interface and `toggleJournal: () => panels.toggle(journal),` to the returned object.

In `src/game/controller.ts`, add `'toggleJournal'` to the `ui` `Pick<Ui, …>` list and a case in `key()`:

```ts
      case 'j':
      case 'J':
        this.deps.ui.toggleJournal();
        return true;
```

- [ ] **Step 6: Styles**

Add to `src/ui/styles.css`:

```css
.journal-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.journal-card { padding: 8px 10px; border-radius: 10px; background: var(--cream-2); font-size: 12px; font-weight: 700; }
.journal-card.undiscovered { opacity: 0.7; }
.journal-card.undiscovered .dot { filter: grayscale(1); }
.journal-name { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 800; }
.journal-status { color: var(--brown-soft); margin: 2px 0 4px; }
.journal-stats { display: grid; gap: 1px; }
.journal-heading { margin: 12px 0 4px; font-size: 13px; font-weight: 800; }
```

- [ ] **Step 7: Run the tests, the full check, and commit**

Run: `npx vitest run tests/ui tests/game && npm run check` (expected: PASS), then:

```bash
git add src/ui src/game/controller.ts tests
git commit -m "feat(ui): Honey Journal panel with a toolbar button and the J key"
```

---

### Task 21: Bonus chips and neighbor markers while placing

**Files:**
- Create: `src/render/preview.ts`
- Modify: `src/render/view.ts`
- Modify: `src/ui/feedback.ts` (`previewChips`, `previewMarker`)
- Modify: `src/game/controller.ts`
- Modify: `src/base.css`
- Test: `tests/render/preview.test.ts` (new), `tests/ui/foundation.test.ts`, `tests/game/controller.test.ts`

**Interfaces:**
- Consumes: `previewEffects`, `PreviewEffects`, `PreviewRule` (Task 9); `preview.*` strings (Task 18).
- Produces:
  - `class PreviewLayer { group; get count(): number; show(at: Hex, chips: HTMLElement | null, markers: { at: Hex; el: HTMLElement }[]): void; clear(): void }`
  - `WorldView.preview: PreviewLayer`
  - `previewChips(effects, reg): HTMLElement | null`; `previewMarker(change: 'gain' | 'lose'): HTMLElement`
  - `ControllerDeps.view.preview: Pick<PreviewLayer, 'show' | 'clear'>`

- [ ] **Step 1: Write the failing tests**

Create `tests/render/preview.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ORIGIN, hex } from '../../src/core/hex';
import { PreviewLayer } from '../../src/render/preview';

describe('PreviewLayer', () => {
  it('anchors chips beside the ghost and a marker over each changed neighbor, and clears them', () => {
    const layer = new PreviewLayer();
    const chips = document.createElement('div');
    layer.show(ORIGIN, chips, [{ at: hex(1, 0), el: document.createElement('span') }, { at: hex(0, 1), el: document.createElement('span') }]);
    expect(layer.count).toBe(3);
    expect(layer.group.children).toHaveLength(3);
    layer.show(ORIGIN, null, []);
    expect(layer.count).toBe(0);
    layer.show(ORIGIN, chips, []);
    layer.clear();
    expect(layer.group.children).toHaveLength(0);
  });
});
```

Add to `tests/ui/foundation.test.ts` (import `previewChips, previewMarker` from `../../src/ui/feedback`):

```ts
describe('preview chips', () => {
  it('spells out each bonus with its size', () => {
    const el = previewChips({ self: ['clump', 'waterSide'], neighbors: [] }, reg)!;
    expect([...el.querySelectorAll('.preview-chip')].map((c) => c.textContent)).toEqual(['+50% clump', '+50% water']);
    expect(previewChips({ self: ['crowded'], neighbors: [] }, reg)!.textContent).toBe('−25% crowded');
    expect(previewChips({ self: [], neighbors: [] }, reg)).toBeNull();
  });

  it('marks neighbors with + or −', () => {
    expect(previewMarker('gain').textContent).toBe('+');
    expect(previewMarker('lose').className).toBe('preview-marker lose');
  });
});
```

In `tests/game/controller.test.ts`, add `preview: { show: vi.fn(), clear: vi.fn() },` to the `view` object in `setup()`, and add:

```ts
  it('previews the bonuses a bed would get and the neighbors it would help', () => {
    const { controller, view } = setup();
    controller.startPlacing('bed_wildflower');
    // (0,1) touches the starting beds at (1,0) and (-1,1): it clumps, and pushes (-1,1) over the threshold.
    controller.hover(hex(0, 1), at);
    const [where, chips, markers] = view.preview.show.mock.lastCall!;
    expect(where).toEqual(hex(0, 1));
    expect(chips.textContent).toBe('+50% clump');
    expect(markers).toEqual([{ at: hex(-1, 1), el: expect.any(HTMLElement) }]);
    controller.hover(ORIGIN, at); // occupied: invalid
    expect(view.preview.clear).toHaveBeenCalled();
    controller.cancel();
    expect(view.preview.clear).toHaveBeenCalledTimes(2);
  });
```

`tests/game/controller.test.ts` builds DOM elements now; add `// @vitest-environment jsdom` as its first line if it is not there.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/render/preview.test.ts tests/ui/foundation.test.ts tests/game/controller.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/render/preview.ts`**

```ts
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { hexToWorld, type Hex } from '../core/hex';

/** Chips sit above the ghost; markers sit lower, over the neighbor they describe. */
const CHIPS_Y = 0.9;
const MARKER_Y = 0.55;

/**
 * Bonus chips beside the build ghost and +/− markers over neighbors a placement would change
 * (spec §6.5). The UI builds every element; this only anchors them.
 */
export class PreviewLayer {
  readonly group = new THREE.Group();
  private anchors: CSS2DObject[] = [];

  get count(): number {
    return this.anchors.length;
  }

  show(at: Hex, chips: HTMLElement | null, markers: { at: Hex; el: HTMLElement }[]): void {
    this.clear();
    if (chips) this.add(at, chips, CHIPS_Y);
    for (const m of markers) this.add(m.at, m.el, MARKER_Y);
  }

  clear(): void {
    for (const a of this.anchors) a.removeFromParent(); // CSS2DObject drops its element when removed
    this.anchors = [];
  }

  private add(at: Hex, el: HTMLElement, y: number): void {
    const holder = document.createElement('div');
    holder.className = 'preview-anchor';
    holder.append(el);
    const anchor = new CSS2DObject(holder);
    const { x, z } = hexToWorld(at);
    anchor.position.set(x, y, z);
    this.group.add(anchor);
    this.anchors.push(anchor);
  }
}
```

In `src/render/view.ts`: import `PreviewLayer`; add `readonly preview: PreviewLayer;` to `WorldView`; create `const preview = new PreviewLayer();`; add `preview.group` to `ctx.scene.add(...)`; return `preview`.

- [ ] **Step 4: UI builders**

Add to `src/ui/feedback.ts` (import `type { PreviewEffects, PreviewRule } from '../sim/preview'`):

```ts
function ruleText(rule: PreviewRule, reg: Registry): string {
  const pct = (x: number) => Math.round(x * 100);
  switch (rule) {
    case 'clump':
      return t('preview.clump', { n: pct(reg.rules.clump.bonus) });
    case 'waterSide':
      return t('preview.water', { n: pct(reg.rules.waterSide.bonus) });
    case 'crowded':
      return t('preview.crowded', { n: pct(reg.rules.crowding.penalty) });
  }
}

/** Chips for the bonuses (or crowding) the new building would get; null when there are none. */
export function previewChips(effects: PreviewEffects, reg: Registry): HTMLElement | null {
  if (effects.self.length === 0) return null;
  return h('div', { class: 'preview-chips' }, ...effects.self.map((rule) => h('span', { class: `preview-chip ${rule}` }, ruleText(rule, reg))));
}

export function previewMarker(change: 'gain' | 'lose'): HTMLElement {
  return h('span', { class: `preview-marker ${change}`, 'aria-hidden': 'true' }, change === 'gain' ? '+' : '−');
}
```

- [ ] **Step 5: Controller wiring**

In `src/game/controller.ts`:
- imports: `import type { PreviewLayer } from '../render/preview';`, `import { previewEffects } from '../sim/preview';`, and add `previewChips, previewMarker` to the `../ui/feedback` import;
- add `preview: Pick<PreviewLayer, 'show' | 'clear'>;` to `ControllerDeps.view`;
- in `cancel()` add `this.deps.view.preview.clear();`;
- in `hover()`, add `view.preview.clear();` inside the `if (!h)` block, and in the placing branch, after `ui.hint(...)`, add:

```ts
      if (valid) {
        const effects = previewEffects(state, reg, def.id, h);
        const markers = effects.neighbors.map((n) => ({ at: state.entities[n.id].hex, el: previewMarker(n.change) }));
        view.preview.show(h, previewChips(effects, reg), markers);
      } else {
        view.preview.clear();
      }
```

- in the idle branch of `hover()` (after `view.highlight.show(h, 'hover');`), add `view.preview.clear();`.

- [ ] **Step 6: Styles**

Add to `src/base.css`:

```css
.preview-anchor {
  pointer-events: none;
}

.preview-chips {
  display: flex;
  gap: 4px;
}

.preview-chip {
  padding: 2px 7px;
  border-radius: 999px;
  background: #fff8ec;
  box-shadow: 0 2px 6px rgba(70, 45, 20, 0.2);
  font: 800 11px/1.4 'Nunito', system-ui, sans-serif;
  color: #3f7f2f;
  white-space: nowrap;
}

.preview-chip.crowded {
  color: #c9443c;
}

.preview-marker {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font: 800 14px/1 'Nunito', system-ui, sans-serif;
  color: #fff;
}

.preview-marker.gain {
  background: #7ed957;
}

.preview-marker.lose {
  background: #d9951c;
}
```

- [ ] **Step 7: Run the tests, the full check, and commit**

Run: `npx vitest run tests/render tests/ui tests/game && npm run check` (expected: PASS), then:

```bash
git add src/render/preview.ts src/render/view.ts src/ui/feedback.ts src/game/controller.ts src/base.css tests
git commit -m "feat: bonus chips and neighbor markers while placing"
```

---

### Task 22: End-to-end: seasons, the clump preview, a pure batch, the budget

**Files:**
- Modify: `src/game/devtools.ts` (`season()`)
- Create: `e2e/seasons.spec.ts`
- Test: `tests/game/devtools.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: `window.__game.season(): { season: Season; dayOfYear: number; year: number }`.

- [ ] **Step 1: Add `season()` with a unit test**

Add to `tests/game/devtools.test.ts` (uses the `devSession` helper from Task 14):

```ts
it('reports the season and day', () => {
  const state = newGame(1);
  state.clock.tick = 9 * 600;
  devSession(state);
  expect(window.__game!.season()).toEqual({ season: 'summer', dayOfYear: 10, year: 1 });
});
```

In `src/game/devtools.ts`, add to `DevHandle`:

```ts
  season(): { season: Season; dayOfYear: number; year: number };
```

and to the handle (import `calendar` and `type Season` from `../sim/clock`):

```ts
    season: () => {
      const { season, dayOfYear, year } = calendar(session.state.clock.tick);
      return { season, dayOfYear, year };
    },
```

Run: `npx vitest run tests/game/devtools.test.ts` (expected: PASS).

- [ ] **Step 2: Write the e2e test**

Create `e2e/seasons.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

const nextFrames = (page: import('@playwright/test').Page) =>
  page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));

test('seasons, the clump preview, a pure batch in the Journal, and the draw-call budget', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/?seed=1');
  await page.waitForFunction(() => window.__game !== undefined);

  // 1. Day 7, the last day of spring: the HUD warns.
  await page.evaluate(() => window.__game!.advance(6 * 600));
  await expect(page.getByTestId('season-end')).toBeVisible();

  // 2. Day 8: summer, and the banner lists lavender.
  await page.evaluate(() => window.__game!.advance(600));
  expect(await page.evaluate(() => window.__game!.season().season)).toBe('summer');
  const banner = page.getByTestId('season-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('Summer');
  await expect(banner).toContainText('Lavender');

  // 3. A clover bed next to two clover beds: the preview promises the clump bonus.
  await page.evaluate(() => {
    const g = window.__game!;
    g.state.inventory.coins = 1000;
    g.dispatch({ type: 'place', def: 'bed_clover', hex: { q: 1, r: -1 } });
    g.dispatch({ type: 'place', def: 'bed_clover', hex: { q: 0, r: -1 } });
  });
  await page.getByRole('button', { name: 'Shop' }).click();
  await page.getByRole('button', { name: /Clover bed/ }).click();
  const spot = await page.evaluate(() => window.__game!.hexToClient(1, -2)); // touches both clover beds
  await page.mouse.move(spot.x, spot.y);
  await expect(page.locator('.preview-chip')).toHaveText('+50% clump');
  await page.keyboard.press('Escape');

  // 4. A pure clover batch: the beekeeper collects it, a toast celebrates, the Journal fills in.
  await page.evaluate(() => {
    const g = window.__game!;
    g.state.entities.e1.store = { clover: 2 };
    g.dispatch({ type: 'harvest', id: 'e1' });
    g.advance(30);
  });
  await expect(page.locator('.toast', { hasText: 'New honey: Clover!' })).toBeVisible();
  await page.getByRole('button', { name: 'Journal' }).click();
  await expect(page.locator('.journal-card[data-flower="clover"]')).toContainText('Discovered');
  await page.keyboard.press('Escape');

  // 5. A plot full of mixed beds stays within the draw-call budget.
  await page.evaluate(() => {
    const g = window.__game!;
    g.state.inventory.coins = 100_000;
    const flowers = ['wildflower', 'clover', 'lavender', 'heather', 'sunflower', 'snowdrop'];
    let placed = 0;
    for (let q = -3; q <= 3; q++) {
      for (let r = -3; r <= 3; r++) {
        if (Math.abs(q + r) > 3) continue;
        if (g.dispatch({ type: 'place', def: `bed_${flowers[placed % flowers.length]}`, hex: { q, r } }).ok) placed++;
      }
    }
  });
  await nextFrames(page);
  const info = await page.evaluate(() => window.__game!.renderInfo());
  expect(info.calls).toBeLessThan(100);
  expect(errors).toEqual([]);
});
```

- [ ] **Step 3: Run it**

Run: `npm run e2e`
Expected: PASS (both `smoke.spec.ts` and `seasons.spec.ts`).

- [ ] **Step 4: Run the full check and commit**

Run: `npm run check` (expected: PASS), then:

```bash
git add src/game/devtools.ts tests/game/devtools.test.ts e2e/seasons.spec.ts
git commit -m "test(e2e): seasons, clump preview, a pure batch and the draw-call budget"
```

---

## M6.5 — Playtest

### Task 23: Playtest gate and wrap-up

**Files:**
- Modify: `docs/superpowers/specs/2026-09-25-seasons-purity-design.md` (status line)
- Possibly modify: `src/content/packs/bees.ts` (balance, only with the user's agreement)

- [ ] **Step 1: Everything green**

Run: `npm run check && npm run e2e`
Expected: PASS.

- [ ] **Step 2: Hand the game to the user**

Start the dev server (`npm run dev`) and give the user the URL. Ask them to play one full year (28 days; about 28 minutes at 1x, or 7 at 4x) from a fresh game, and to tell you:

1. Did they face a real choice between a pure layout and a steady one?
2. Did the season-end warning make them time a harvest?
3. Did winter feel quiet rather than punishing?
4. Anything confusing in the Shop, the popovers, the badges or the Journal?

Include in the message every balance number Task 10 changed (if any).

- [ ] **Step 3: STOP and wait for the user's feedback**

Apply requested changes. Balance numbers live in `src/content/packs/bees.ts`; if a change breaks `tests/sim/balance.test.ts`, tell the user which target moved rather than loosening the test. Re-run `npm run check && npm run e2e` after each round, and commit each round as `tune: <what> after the playtest`.

- [ ] **Step 4: Mark the spec implemented**

When the user signs off, change the spec's status line to `- **Status:** Implemented` and commit:

```bash
git add docs/superpowers/specs/2026-09-25-seasons-purity-design.md
git commit -m "docs: mark sub-project 3 (seasons and purity) as implemented"
```

- [ ] **Step 5: Finish the branch**

Use superpowers:finishing-a-development-branch. The branch already has PR #4 (opened with the spec); push the commits there and update its description with what was built, the Spec Deltas above, any balance changes, and the two gates passed.

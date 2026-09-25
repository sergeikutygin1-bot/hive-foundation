# Game Rules v2 — Design (rules, progression, roadmap)

- **Date:** 2026-09-25
- **Status:** Approved in design review, pending spec review
- **Scope:** Umbrella game design for sub-projects 3–6. Each of them still gets its own detailed spec → plan → implementation cycle, which argues from this document.
- **Builds on:** [Sub-project 1 spec](2026-09-23-hive-foundation-design.md) (merged in PR #1) and the sub-project 2 spec, `2026-09-24-life-and-juice-design.md` (PR #2, in progress)

---

## 1. Context and intent

Sub-project 1 shipped a playable loop, and sub-project 2 is making it feel alive. Before building more, we reviewed the rules themselves: what the game has, how it plays out, and where it runs dry. The short answer (§3) is that the current loop is a solved optimization problem that runs out of content around day 30.

This document defines the target rules and the order in which to build them.

### Pillars

The game is a **cozy hex management game** built on three pillars. They were chosen together and are meant to feed each other.

| Pillar | Role | In one line |
|---|---|---|
| **Layout puzzle** | The core skill | Land is scarce, so the skill is **kg of honey per tile**: clumping beds, using water, keeping flower types apart |
| **Seasonal farm** | The rhythm | The calendar changes what blooms, so a good spring layout is a weaker autumn layout |
| **Trade** | The goals | Orders and the yearly festival ask for specific honey types, which give the layout its purpose |

The loop that ties them together: an order asks for a honey type → you arrange a flower mix around a hive → the season decides whether it blooms → you time the harvest to keep the batch pure → you deliver or sell.

**Not a pillar: idle / incremental.** There is no offline progress, prestige or reset loop. The game is played actively, in sessions.

### Structure

**One farm, played as year chapters.** Each in-game year is a chapter that ends with a festival order. Delivering it completes the chapter and makes new flowers, tools, hive levels, buildings and land available. Nothing is ever lost: missing a festival only means the chapter takes another year.

### Success criteria for the rules as a whole

Criteria 1, 3, 4 and 5 are balance-bot targets, checked from the sub-project that makes each testable (§12). Criterion 2 follows from the calendar; criterion 6 is a playtest check.

1. A second hive is affordable around day 6 (sub-project 1's target survives).
2. A chapter lasts about 30 minutes at 1x (a 28-day year).
3. The Year 1 festival can be completed by about day 24 with casual play.
4. The starting plot is not full before the end of Year 1 (day 28).
5. Within any 7-day window there is always something worth buying.
6. In a playtest, the player makes real choices between pure and steady layouts, and between selling and holding honey.

---

## 2. Current rules (v1, as on `main`)

This section is the reference for what exists today. Numbers are in `src/content/packs/bees.ts` and `src/sim/`.

### Time

- 1 in-game day = 600 ticks = 60 s at 1x. Speeds: pause, 1x, 2x, 4x.
- A season is 28 days; a year is 112 days. Seasons are labels only.
- Session-only: a hidden tab stops time, and nothing happens offline.

### World

- A hex disc of radius 12 (469 tiles). The player owns the radius-3 plot at the center (37 tiles), which has no water or decor.
- Outside the plot: lakes, trees and rocks. It cannot be bought yet.

### Buildings

| Building | Cost | Tile | Rule |
|---|---|---|---|
| Hive | 120 | grass | Producer. Takes nectar from sources within range 1, at most 4 nectar/day, 0.25 kg honey per nectar (max 1 kg/day). Stores up to 5 kg, then stalls |
| Wildflower bed | 20 | grass → soil | Source: 1 nectar/day |
| House | — | grass | Decoration; not purchasable or removable |

### Production

- Each bed splits its nectar **equally** among all hives in range.
- A hive takes the lesser of what it receives and its intake cap; the excess is wasted.
- A full hive stops, shows a gold badge and toasts once.

### Player actions

- **Place** a building (cost deducted).
- **Remove** a building: 50% refund, rounded down. A hive's stored honey is collected first. The last hive cannot be removed.
- **Harvest** one hive, or **Harvest All**. Instant in sub-project 1.
- **Sell** honey at a fixed 15 coins/kg.
- **Set speed.**

### Safety net

At each day start: if production is 0, there is no honey anywhere, and coins are below the cheapest bed, coins are topped up to that cost.

### Start

60 coins; a house, one hive and three wildflower beds. Income is 0.75 kg/day (11.25 coins/day).

### Changes coming from sub-project 2

- A harvest queues a job; the beekeeper walks there (BFS on the hex grid) and the honey arrives on arrival. Harvest All queues every hive, nearest first.
- Grass and beds are walkable; hives, the house, water, trees and rocks are not. Placements that would trap a hive or the house are rejected (`blocks_path`).
- The house moves from (0,−1) to (0,−2) in new games.
- Save version 2 adds the worker.

---

## 3. Findings

A greedy pacing model of the v1 rules (keep four beds per hive, buy beds first) gives hives #2–#7 on days 6, 14, 19, 23, 26 and 28. The plot is full by about **day 30**: 7 hives, 28 beds, 7 kg/day, 105 coins/day. By day 60 the player has about 18,000 coins and nothing to buy.

| # | Finding | Effect |
|---|---|---|
| 1 | **The build order is solved.** A bed pays back in 5.3 days; a hive plus four beds in 13.3 days. The optimum is always four beds per hive, beds first | No real choices |
| 2 | **Sharing only punishes.** Splitting never creates nectar; it only wastes it above a hive's cap. Layout is avoidance, not a puzzle | Placement feels flat |
| 3 | **Hard ceiling around day 30** (≈ 30 min at 1x, 8 min at 4x). Coins pile up with no use | The game ends early |
| 4 | **Harvesting and selling have no decisions.** The price is fixed, so there is never a reason to hold honey; harvesting is a periodic chore | Busywork |
| 5 | **Seasons, flower types and land ownership exist in data but do nothing** | Cheap to activate |
| 6 | **No goals.** No unlocks, milestones or win state; "more coins" is the only aim | Nothing pulls the player forward |

How this design answers them: #1 and #2 through purity, bloom seasons and synergies (§5); #3 through chapters, the Workshop, hive levels and land (§8); #4 through reacting prices, orders, the festival and purity timing (§5.2, §7); #5 through seasons (§6); #6 through the festival, orders and the Honey Journal (§7, §9).

---

## 4. Decisions log

| Question | Decision | Why |
|---|---|---|
| What keeps people playing? | Layout puzzle + seasonal farm + trade; not idle | User's choice; the three reinforce each other |
| Structure over time | One farm, year chapters, each ended by a festival | Uses the existing calendar, gives a clear goal, no hard failure |
| Year length | 7-day seasons, 28-day year (≈ 30 min at 1x) | One chapter per sitting; each season is long enough to replant and fill an order or two |
| Core layout rule | Honey type by batch purity + bloom seasons + three fixed synergies | Real trade-off (pure vs. steady) while staying readable; chosen over "purity only" (too thin) and full adjacency scoring (opaque, N² balancing) |
| When is purity decided? | Per harvested batch, at collection | Makes harvest timing a decision |
| Number of synergies | Exactly three: clump, water-side, crowding | Each is always shown in the build preview; more would hurt readability |
| Winter | Nothing blooms except snowdrop; hives never consume honey; bed removal refunds 100% | Quiet, not punishing; winter becomes the replanting season |
| Market | Prices drop as you sell a type and recover daily | Creates the sell-vs-hold decision without hurting early game |
| Orders | 2–3 slots, one type each, delivered all at once, no penalty on expiry | Goals with a premium; cozy |
| Festival missed | Chapter carries over into the next year with progress kept | No hard failure |
| Progression spending | A Workshop with four tracks: seeds, tools, hive levels, blueprints; chapters make items available, coins buy them | Coin sink plus agency; answers finding #3 |
| Hive upgrades | Per hive, three levels, one stacked box per level | "More kg per tile" fits the layout pillar; the existing hive art already stacks boxes |
| Beekeeper tools | Smoker, Boots, Extractor, Hive tool | Give sub-project 2's walking beekeeper a progression |
| New buildings | Pond and Garden path | Each adds a layout choice with a single, previewable rule |
| Collection goal | Honey Journal | Light collector goals with no balance impact |
| Chapter milestones and decorations | Considered, **not** chosen | User's choice |
| Order of work | Seasons and purity → trade and festival → Workshop and land → guide and ship | Each step needs the one before it (§12) |
| Where this work lives | Branch `docs/game-rules`, its own PR, separate from PR #2 | PR #2 is sub-project 2 only |

---

## 5. Layout rules

All numbers in this document are **starting values** stored in content packs and tuned by the balance bot. The rules are what this spec fixes.

### 5.1 Flowers

Every bed has a flower type. A flower blooms only in its seasons; out of season the bed is **dormant** and yields 0.

| Flower | Bed cost | Nectar/day | Blooms | Pure honey price | Available from |
|---|---|---|---|---|---|
| Wildflower | 20 | 1 | spring, summer, autumn | 15 | start |
| Clover | 25 | 1 | spring, summer | 20 | chapter 1 |
| Lavender | 40 | 1 | summer | 30 | chapter 2 |
| Heather | 35 | 1 | autumn | 25 | chapter 3 |
| Sunflower | 30 | 1.5 | summer, autumn | 18 | chapter 3 |
| Snowdrop | 60 | 0.5 | winter | 45 | chapter 4 |

- Each flower has its own honey resource: `honey_wildflower`, `honey_clover`, `honey_lavender`, `honey_heather`, `honey_sunflower`, `honey_snowdrop`.
- Wildflower honey is also the **mixed** honey (§5.2), so it is the base product.
- Sunflower is the volume flower (more nectar, low price); lavender is the premium one (short bloom, high price).
- "Available from" means: automatically available in sub-project 4, bought in the Workshop from sub-project 5 (§8.2). In sub-project 3, which has no chapters yet, every flower is in the Shop.

### 5.2 Honey batches and purity

- A hive's store is tracked **by flower**: for example 3.1 kg clover + 0.9 kg wildflower. Each nectar share is credited to the flower type of the bed it came from. Capacity applies to the total.
- When a batch is collected (by harvest, by removing the hive, or by the Hive tool), it is classified:
  - if one flower is at least the **purity threshold** of the batch (70%; 60% with the Extractor), the whole batch becomes that flower's honey;
  - otherwise the whole batch becomes wildflower honey.
- Harvesting just before a season change keeps a batch pure. This is the harvest-timing decision.

### 5.3 Synergies

Exactly three rules, all of them always shown in the build preview.

| Synergy | Rule |
|---|---|
| **Clump** | A bed with at least 2 neighboring beds of the **same** flower gets +50% nectar. Dormant beds still count as neighbors |
| **Water-side** | A bed next to at least one water tile (a lake or a pond) gets +50% nectar |
| **Crowding** | A hive with at least one neighboring hive has its intake cap reduced by 25% (Lv1: 4 → 3) |

- Bonuses add up: clump + water-side = +100%.
- Bonuses change what a bed yields; sharing still splits that yield equally among the hives in range, and hive caps still apply.
- The rule numbers (threshold, bonus sizes, minimum neighbors, crowding penalty, winter refund) live in one `rules` block in the content pack, not in code.

### 5.4 Pond

| Cost | Tiles | Rule |
|---|---|---|
| 80 | 1, on grass | Turns its tile into water (through the existing `setsTile` mechanism; the old tile comes back on removal). Not walkable. Removable for the usual 50% |

- The pond brings the water-side bonus into the starting plot. Without it, water-side would do nothing until land can be bought.
- It is not walkable, so sub-project 2's `blocks_path` placement check applies to it.
- In sub-project 3 it is in the Shop directly; from sub-project 5 it needs its blueprint (§8.2).

### 5.5 Readability

- **Build preview:** the ghost shows tags for the rules that would apply to the new building ("+50% clump", "+50% water", "−25% crowded"). Neighbors that would gain or lose a bonus get a small + or − marker.
- **Hive badge:** the fill bar takes the color of the batch's dominant flower and shows its purity %.
- **Hive inspect:** the batch mix and its outcome, e.g. "Clover 82% → pure Clover" or "Clover 55% → Wildflower".
- **Bed inspect:** yield with its breakdown (base, clump, water), bloom seasons, and how many hives share it.

### 5.6 Early game check

With sub-project 2's starting layout (house at (0,−2)), the three starting beds at (−1,0), (+1,0) and (−1,+1) are not clumped, so income stays at 0.75 kg/day. Placing the fourth bed on (0,+1) clumps two beds, giving 1.5 + 1.5 + 1 + 1 = 5 nectar/day, which reaches the hive's cap of 4. The ~6-day path to a second hive holds; the balance bot confirms it.

---

## 6. Seasons and calendar

### 6.1 Calendar

A day stays 60 s at 1x. A season is **7 days**, a year **28 days**.

| Days | Season | Blooming | What the season is for |
|---|---|---|---|
| 1–7 | Spring | wildflower, clover | Build up; the second hive arrives around day 6 |
| 8–14 | Summer | wildflower, clover, lavender, sunflower | Peak: the most flowers in bloom |
| 15–21 | Autumn | wildflower, heather, sunflower | Rework the mix before winter |
| 22–28 | Winter | snowdrop only | Deliver the festival, replant, prepare for spring |

### 6.2 Rules

- **Dormancy:** a bed out of season yields 0 and shows closed, pale flowers.
- **Hives never consume honey.** Winter is quiet, not a loss.
- **Winter replanting:** removing a bed (any source) during winter refunds **100%** of its cost instead of 50%.
- **Season change:** a `seasonChanged {season, year}` event plays a banner (and later a sound).
- **Advance warning:** on the last day of a season the HUD shows "Season ends tomorrow — harvest to keep batches pure".
- **Planning aids:** the HUD shows which flowers bloom next season; the Shop shows four season dots on each flower.
- **Safety net fix:** the dead-end check ignores dormancy and counts every bed as if it were blooming. Otherwise every winter would look like a dead end and hand out coins, although buying a bed in winter helps nothing.

### 6.3 Old saves

When a save from before this change loads:

- the farm, coins and honey stay;
- the calendar resets to Year 1, spring, day 1 (a day-40 save would otherwise land in an odd season);
- honey already stored in hives is credited as wildflower.

### 6.4 Out of scope here

Snow, ground tinting and weather. Only dormant flowers and the banner are needed for the rules to read; the rest is later polish.

---

## 7. Trade

### 7.1 Market prices react to sales

- Each honey type has a **price drop** between 0 and 50% of its base price. The current price is `base × (1 − drop)`.
- Selling a type raises its drop by 2 percentage points per kg sold, up to 50%. A sale is priced continuously along that slope, so selling 10 kg at once earns the same as selling 1 kg ten times in a row.
- The drop recovers by 10 percentage points per in-game day, continuously, down to 0.
- **Early game is unaffected:** at about 1 kg/day, the price is back to base by the next morning. The drop only bites when you dump large amounts of one type.
- **Market panel:** each type's current price with a trend arrow; the sale preview shows total coins and the price after the sale.

### 7.2 Orders board

| Field | Rule |
|---|---|
| Slots | 2 in chapter 1, 3 from chapter 2 |
| Asks for | One honey type × kg, drawn from the types you have unlocked whose flower blooms before the deadline |
| Amount | Drawn from a per-chapter range: ch1 2–5 kg, ch2 4–8, ch3 6–12, ch4 8–15 (rounded to 0.5 kg) |
| Deadline | End of the current season if at least 4 days remain, otherwise end of the next season |
| Reward | kg × base price × 1.6, rounded to whole coins |
| Delivery | One click, all at once, from inventory; the resource must match exactly |
| Expiry | The order disappears at its deadline with no penalty |
| Refill | Each empty slot gets a new order at the next day start |
| Randomness | Seeded: `hash2(seed, orderSerial)`, so the same save always gives the same orders |

Example: "5 kg Clover by end of summer → 160 coins".

### 7.3 Festival order

- One per chapter, defined in chapter data, shown as a pinned card on the orders board all year.
- **Due at the end of winter** (the end of day 28).
- **Partial deliveries** are accepted and shown as a progress bar.
- Starting values:

| Chapter | Asks for | Reward |
|---|---|---|
| 1 | 8 kg wildflower + 4 kg clover | 400 |
| 2 | 6 kg clover + 5 kg lavender | 800 |
| 3 | 5 kg lavender + 6 kg heather + 8 kg sunflower | 1,400 |
| 4 | 6 kg lavender + 6 kg heather + 3 kg snowdrop | 2,200 |

- Because nothing blooms in early winters and clover stops after summer, the player has to harvest pure batches in season and **hold them instead of selling**. That is the main trading decision of the year.

### 7.4 Several honey types in inventory

The inventory holds one resource per honey type. The HUD honey pill shows the total kg, with a per-type breakdown on hover.

---

## 8. Chapters and progression

### 8.1 Chapter flow

- **Delivering the festival completes the chapter at once:** the reward is paid and the next chapter's items become available. The next chapter's festival appears at the start of the next year.
- **Missing the festival:** at the end of winter the year rolls over, but the chapter stays. The festival card carries over with its partial deliveries kept. The HUD reads, for example, "Chapter 2 · Year 3".
- Before the Workshop exists (sub-project 4), completing a chapter unlocks that chapter's flowers automatically.

### 8.2 Workshop

A new toolbar button opens the Workshop: four tracks of permanent unlocks. A chapter makes an item **available**; coins **buy** it (`buyUnlock(id)`). Locked items show the chapter that unlocks them.

| Chapter | Seeds | Beekeeper tools | Hive levels | Blueprints |
|---|---|---|---|---|
| 1 | Clover (free) | **Smoker** 100: work time 0.8 s → 0.4 s (`workTicks` 8 → 4) | Lv2 | — |
| 2 | Lavender 150 | **Boots** 250: walk 2 → 3.3 hex/s (`ticksPerHex` 5 → 3) | Lv3 | **Pond** 100 |
| 3 | Heather 200, Sunflower 150 | **Extractor** 400: purity threshold 70% → 60% | — | **Garden path** 50 |
| 4 | Snowdrop 300 | **Hive tool** 500: on arrival at a hive, the beekeeper also collects every other hive with honey that touches the hex it stands on; those leave the queue | — | — |
| 5+ | Reserved for the second production chain (orchard → jam) | | | |

- Claiming Clover for free in chapter 1 is the player's first visit to the Workshop.
- Hive levels are not bought in the Workshop; a chapter makes the level available, and each hive is upgraded and paid for individually (§8.3). The Workshop lists them so the whole progression is in one place.
- The tools change sub-project 2's worker. The sim reads the worker's **effective stats** (definition plus owned tools) through one function, so the tools stay data.

### 8.3 Hive levels

Each hive is upgraded from its inspect popover (`upgrade(entityId)`). Each level adds a stacked box to the hive's art.

| Level | Intake cap | Capacity | Upgrade cost | Available from |
|---|---|---|---|---|
| Lv1 | 4 nectar/day | 5 kg | — | start |
| Lv2 | 6 nectar/day | 8 kg | 150 | chapter 1 |
| Lv3 | 8 nectar/day | 12 kg | 400 | chapter 2 |

- Higher caps are what let clumped and water-side beds pay off: more kg per tile.
- Crowding scales with the level: −25% of the current cap.
- Removing a hive refunds 50% of everything spent on it, upgrades included.

### 8.4 Land

- Outside the starting plot, every tile belongs to exactly one **parcel** of about 7 hexes. Parcels are generated from the world seed and are never saved. The generation method is settled in the sub-project 5 spec.
- A parcel can be bought (`buyParcel(id)`) when it shares an edge with owned land. Price: 100 × 1.5^n, where n is the number of parcels bought so far.
- Chapter gating by distance from the center: chapter 2 opens parcels centered within 6 hexes, chapter 3 within 9, chapter 4 all of them. Lakes start 5 or more hexes out, so water arrives mostly in chapter 3.
- Trees (30) and rocks (50) on owned land can be cleared (`clearDecor(hex)`), turning the tile into grass. Clearing also opens walking routes.

### 8.5 Garden path

| Cost | Tiles | Rule |
|---|---|---|
| 5 | 1, on grass | Walkable. The beekeeper crosses a path tile in half the ticks (rounded up) |

- Pathfinding moves from BFS to Dijkstra behind the same `findPath` signature; sub-project 2 planned for this.
- The trade-off: a path tile is a tile you cannot plant.
- **When it matters:** with more land and many upgraded hives, the beekeeper's time becomes the limit (for example, 20 Lv3 hives need about 10 trips a day). Paths, Boots, the Smoker and the Hive tool then compete for coins. The balance bot tracks the beekeeper's busy share of the day.

---

## 9. Honey Journal

A new toolbar button opens the Journal. It has no effect on balance.

- **Per honey type:** the day it was discovered (the first pure batch of that type), best purity, total kg harvested, total coins earned from it (sales and orders). Types not yet discovered show "?" and a hint about when they bloom.
- **Best purity** is tracked under a batch's dominant flower even when the batch fell below the threshold, so the player can see how close they got.
- **Records:** biggest single batch, best day's income, orders delivered, festivals completed.
- **Discovery moment:** the first pure batch of a new type emits `honeyDiscovered {resource}`, which shows a "New honey: Clover!" toast, a floater at the hive and a celebration sound (sub-project 2's audio layer).

---

## 10. Sim changes by sub-project

Every sub-project that changes the saved state bumps the save version with a migration and the existing deep validation plus dry-run tick.

### Sub-project 3 — seasons and purity (save v3)

- **Content:** `FlowerDef { id, honey, blooms }`; `SourceDef.flowerType` refers to it. `ProducerDef.output` becomes the resource for mixed batches. A `rules` block holds the purity threshold, the synergy numbers and the winter refund rate. New buildable: `pond`.
- **State:** `entity.store` becomes `Record<flowerType, kg>`; `journal`.
- **Calendar:** `DAYS_PER_SEASON` 28 → 7.
- **Events:** `seasonChanged`, `honeyDiscovered`. `harvested` reports the classified resource.
- **Migration:** v2 → v3 converts each numeric store to wildflower, resets the calendar (§6.3) and starts an empty journal.

### Sub-project 4 — trade and festival (save v4)

- **Content:** chapter data (festival lines and reward, order amount range, slots); base prices per honey type.
- **State:** price drop per honey type, orders, `orderSerial`, `chapter`, festival progress.
- **Commands:** `deliverOrder(id)`, `deliverFestival(resource, kg)`.
- **Rejections:** `unknown_order`, `insufficient_resource`.
- **Events:** `orderOffered`, `orderDelivered`, `orderExpired`, `festivalProgress`, `chapterCompleted`.

### Sub-project 5 — Workshop and land (save v5)

- **Content:** Workshop items (id, track, chapter, cost, effect); hive levels on `ProducerDef`; parcel generation settings; buildable `path` with a walk-speed factor.
- **State:** `unlocks` (list of ids), `entity.level`. Parcel ownership reuses `tiles[].owned`.
- **Commands:** `buyUnlock(id)`, `upgrade(entityId)`, `buyParcel(id)`, `clearDecor(hex)`.
- **Rejections:** `locked`, `already_owned`, `max_level`, `not_adjacent`.
- **Pathfinding:** Dijkstra behind `findPath`.

---

## 11. A year of play (chapter 1, target experience)

- **Spring (days 1–7):** add a fourth wildflower bed and see the clump bonus. Claim Clover in the Workshop. The first two orders appear on day 2, small and mostly wildflower. Buy a second hive around day 6 and ring it with clover beds.
- **Summer (days 8–14):** clover orders start to appear. The clover hive fills with pure batches; the player keeps 4 kg of clover aside for the festival instead of selling it all.
- **Autumn (days 15–21):** clover goes dormant. The warning on day 14 prompts one last pure clover harvest. The wildflower hives carry the season; the market price dips if the player sells too much at once.
- **Winter (days 22–28):** nothing blooms. The player delivers the festival from stored honey, removes a few beds at full refund, and plans next year's layout around the chapter 2 unlocks.

---

## 12. Roadmap

| # | Sub-project | Contents | Depends on | Size | Exit criteria |
|---|---|---|---|---|---|
| ✅ 1 | Foundation + playable loop (M0–M4) | Merged in PR #1 | — | — | Done |
| 🔄 2 | Life and juice (M5) | Walking beekeeper, bees, floating numbers, audio. Motion gate passed; feedback and sound remain | — | — | Audio gate and PR #2 merged |
| 3 | **Seasons and purity** (M6) | 7-day seasons; six flowers with bloom seasons; dormancy; batch purity; three synergies with preview tags; pond; winter refund; safety-net fix; Honey Journal; save v3; balance bot v2. Visuals only where the rules need them: flower colors, dormant flowers, season banner | 2 merged (save version) | M | A headless year run matches the expected curve; the pure-vs-steady choice is felt in a playtest |
| 4 | **Trade and festival** (M7) | Reacting prices; orders board; festival; chapter counter with automatic unlocks | 3 | M | The Year 1 festival completes by about day 24 with casual play |
| 5 | **Workshop and land** (M8) | Workshop (seeds, tools, hive levels, blueprints) replaces automatic unlocks; parcels; clearing; garden path with Dijkstra | 4; the tools also need 2 | L | Chapters 1–4 playable; coins are never idle for more than a season |
| 6 | **Guide and ship** (M9) | Chapter 1 doubles as a guided tutorial; TR/EN; settings with volume; touch pass; performance pass; static deploy | 5 | M | A new player finishes chapter 1 without help |
| 7+ | Second production chain | Orchard → jam as chapter 5 onward | 6 | — | — |

### Why this order

- **Seasons and purity first:** they are the core puzzle, and trade only makes sense once there are several honey types.
- **Trade before the Workshop:** orders and the festival give a goal before there is much to buy.
- **Tools after sub-project 2:** they modify its worker.

### Parallel work

The sub-project 3 spec can be written while sub-project 2 finishes. Its implementation waits for PR #2 to merge, because sub-project 3's save v3 builds on sub-project 2's v2.

### Balance bot targets per sub-project

| Target | Checked from |
|---|---|
| Second hive around day 6 | 3 |
| Plot not full before the end of Year 1 (day 28) | 3 |
| Year 1 festival by about day 24 | 4 |
| Something worth buying in every 7-day window | 5 |
| Beekeeper busy for under 60% of a day with a chapter-4 layout that uses paths and tools | 5 |

### Removed from the earlier roadmap

- **Offline progress:** idle is not a pillar.
- Sub-project 1's roadmap listed orders, land, seasons, honey types and the Guide as one "meta systems" sub-project; they are now sub-projects 3–6 above.

---

## 13. Out of scope

- Offline progress, prestige or any reset loop.
- Reputation, buying honey, named traders.
- Chapter milestones and decorations (considered and not chosen).
- Multiple beekeepers or hiring (sub-project 2 leaves a hook; not planned yet).
- Weather, snow and seasonal ground colors (visual polish, later).
- Content for chapter 5 and beyond, which belongs to the second production chain.

---

## 14. Hooks for later

- **Second chain:** a chain is a content pack (flowers become trees, hives become presses) plus chapter data; the purity, synergy and Workshop rules are generic.
- **More synergies:** the `rules` block is where they would go, but each new one must be previewable in the build ghost.
- **Hiring:** the Workshop's tools track is where a second worker would be bought, once sub-project 2's single `state.worker` becomes a list.

# Hive Foundation (Sub-project 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundation and first playable loop of a cozy hex-grid management game: a procedurally rendered 3D hex world where the player places hives and flower beds, harvests honey, sells it and expands, with autosave.

**Architecture:** One plain, serializable `GameState` object is advanced by pure-TS systems (`sim/`) and changed only through validated commands. `render/` (Three.js) and `ui/` (DOM) read state and send commands through injected callbacks. `game/` wires everything together (loop, input, session, save). Game content (resources, buildables, prices) lives in data packs, so new production chains are mostly data.

**Tech Stack:** Node 22, Vite 8, TypeScript 6.0, Three.js 0.186, Vitest 5 (+ jsdom), ESLint 10 + typescript-eslint 8, Playwright 1.63, @fontsource/nunito.

**Spec:** `docs/superpowers/specs/2026-09-23-hive-foundation-design.md`. Read it before starting. This plan argues from it.

## Global Constraints

Every task implicitly includes these requirements.

- Node `>=22`. TypeScript pinned to `~6.0.3` (typescript-eslint 8.70 supports TypeScript `<6.1`; do not install TypeScript 7).
- Vite + TypeScript + vanilla Three.js + DOM UI. No UI framework.
- **No image or model files** anywhere in `src/` or `public/`: no `.png/.jpg/.gif/.webp/.svg/.glb/.gltf`. Meshes are built from Three.js primitives in code, and icons are inline SVG strings. The only binary asset is the Nunito font from `@fontsource/nunito`.
- Layer rule: `core ← content ← sim ← game → render, ui`.
  - `core/`, `content/` and `sim/` never import `three` and never touch DOM globals.
  - `render/` and `ui/` never import `game/` and never mutate `GameState`; they change the game only through an injected `dispatch`.
  - ESLint enforces this.
- Hex math: axial `(q, r)`, **pointy-top**, `HexKey` = `"q,r"`, `HEX_SIZE = 1` (center to corner).
- World: map radius **12** (469 tiles). Starting plot radius **3** is owned and has no water or decor.
- Clock:
  - 1 tick = 0.1 s of real time at 1x = 1/600 of an in-game day.
  - Speeds 0/1/2/4 run 0/10/20/40 ticks per real second.
  - 28 days per season. Seasons are labels only.
  - Frame time is capped at 250 ms.
- Balance (bees pack), from spec §5.9:

  | Item | Values |
  |---|---|
  | Start | 60 coins; house + hive + 3 wildflower beds |
  | Hive | 120 coins; range 1; max intake 4 nectar/day; 0.25 kg per nectar; capacity 5 kg |
  | Wildflower bed | 20 coins; 1 nectar/day; sets its tile to soil |
  | Wildflower honey | sells for 15 coins/kg |
  | Removal refund | `floor(50% of cost)` |

- Every user-visible string goes through `t()` / `tx()` with keys in `src/ui/strings/en.ts`.
- Save: localStorage key `hive-foundation.save`. A corrupt save is copied to `save_backup_<timestamp>`. Autosave runs every 10 s and when the tab is hidden or closed.
- Performance: under 100 draw calls; 60 fps on an integrated-GPU laptop.
- `npm run check` = `tsc --noEmit` + `eslint .` + `vitest run`. `npm run e2e` = Playwright.

## Review Focus

Failure modes the spec implies but that are easy to miss. Each one has a pinning test in the task named.

1. **Float honey amounts when selling.** An inventory like `0.30000000000000004`, or a sell amount of `have + 1e-9`, must succeed and leave inventory at exactly `0`, never negative. Task 9.
2. **Double-click or repeated placement on one hex.** The second `place` is rejected with `tile_occupied` and the cost is charged once. Task 9.
3. **Background tab or a 10 s frame hitch at 4x.** At most 10 ticks run for that frame; no fast-forward. Task 4.
4. **Hand-edited or future-version save.** Missing fields or `version: 2` lead to a fresh game plus a backup copy, never a crash. Task 11.
5. **Mouse jitter during a click.** Under 5 px of movement is still a click (places or selects). 5 px or more is a pan and places nothing. Task 14.

## Spec Deltas

Small, deliberate differences from the spec. Each is listed here so a reviewer doesn't flag it as drift.

1. **Two extra rejection reasons:**
   - `invalid_speed` guards `setSpeed` against values from the dev console.
   - `internal_error` is only produced by `game/session` when the sim throws in a production build.
2. **Removing a producer keeps its stored output.** The honey goes to the inventory and a `harvested` event fires before `entityRemoved`. The spec didn't say; silently losing honey would feel like a bug.
3. **Extra `speedChanged` event**, so the UI can react to speed changes from keys or buttons.
4. **Tiles use one `InstancedMesh` for all tile types**, with per-instance color and height, instead of one mesh per type. Fewer draw calls, same look.
5. **The shadow frustum covers the whole map** (radius 22) rather than only the visible area. It's simpler, and 2048² is enough at this scale.
6. **`?seed=<n>` starts a fresh, deterministic world and disables loading and autosave**, so dev and e2e runs never overwrite a real save.

## File Map

```
package.json, tsconfig.json, vite.config.ts, eslint.config.js, playwright.config.ts, index.html
.claude/launch.json                     dev-server config for preview tooling
src/main.ts                             boot + wiring (rewritten in Tasks 1, 4, 14, 16, 24)
src/base.css                            page, canvas, label layer, badge styles
src/core/hex.ts rng.ts events.ts        pure helpers
src/content/types.ts tiles.ts registry.ts default.ts packs/base.ts packs/bees.ts
src/sim/state.ts entities.ts worldgen.ts clock.ts events.ts production.ts economy.ts commands.ts advance.ts
src/render/webgl.ts scene.ts lights.ts camera.ts tiles.ts picking.ts highlight.ts decor.ts sync.ts badges.ts ghost.ts view.ts
src/render/art/palette.ts parts.ts materials.ts nature.ts buildings.ts flowerbed.ts beekeeper.ts registry.ts
src/ui/h.ts i18n.ts format.ts icons.ts feedback.ts types.ts toasts.ts hud.ts toolbar.ts inspect.ts fatal.ts app.ts styles.css strings/en.ts
src/ui/panels/host.ts shop.ts market.ts
src/game/loop.ts fps.ts session.ts save.ts input.ts controller.ts devtools.ts
tests/core, tests/content, tests/sim, tests/game, tests/render, tests/ui   (vitest)
tests/fixtures/save-v1.json
e2e/smoke.spec.ts                       (Playwright)
```

Build order note: the spec's milestone table lists M1 (world) before M3 (sim). This plan builds the headless sim first (Tasks 5–12), because the renderer draws `GameState` tiles and entities. The art gate (Task 17) still comes before any UI work, as §6.6 requires.

---

## M0 — Skeleton

### Task 1: Project scaffold and tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `index.html`, `src/main.ts`, `.claude/launch.json`

**Interfaces:**
- Consumes: nothing.
- Produces: npm scripts `dev`, `build`, `typecheck`, `lint`, `test`, `check`, `e2e`. The ESLint layer rules every later task relies on.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "hive-foundation",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "npm run typecheck && npm run lint && npm run test",
    "e2e": "playwright test"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install three @fontsource/nunito
```

```bash
npm install -D typescript@~6.0.3 vite vitest jsdom @types/three @types/node@^22 eslint @eslint/js typescript-eslint globals @playwright/test
```

Expected: both finish without `ERESOLVE` errors. If npm reports a peer conflict for `typescript`, confirm the installed version with `npx tsc -v` (must print `Version 6.0.x`).

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client", "node"],
    "strict": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "tests", "e2e", "vite.config.ts", "playwright.config.ts"]
}
```

- [ ] **Step 4: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { port: 5173 },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
});
```

- [ ] **Step 5: Create `eslint.config.js` with the layer rules**

```js
import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

const HEADLESS_GLOBALS = ['window', 'document', 'localStorage', 'navigator', 'requestAnimationFrame'];

const layer = (files, patterns) => ({
  files,
  rules: {
    'no-restricted-imports': ['error', { patterns }],
    'no-restricted-globals': ['error', ...HEADLESS_GLOBALS],
  },
});

const NO_THREE = { group: ['three', 'three/*'], message: 'This layer is headless: no three.js.' };

export default defineConfig([
  { ignores: ['dist/', 'node_modules/', 'playwright-report/', 'test-results/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  layer(['src/core/**/*.ts'], [
    NO_THREE,
    { group: ['**/content/**', '**/sim/**', '**/render/**', '**/ui/**', '**/game/**'], message: 'core must not import other layers.' },
  ]),
  layer(['src/content/**/*.ts'], [
    NO_THREE,
    { group: ['**/sim/**', '**/render/**', '**/ui/**', '**/game/**'], message: 'content may import only core.' },
  ]),
  layer(['src/sim/**/*.ts'], [
    NO_THREE,
    { group: ['**/render/**', '**/ui/**', '**/game/**'], message: 'sim may import only core and content.' },
  ]),
  {
    files: ['src/render/**/*.ts', 'src/ui/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/game/**'], message: 'render/ui receive what they need through parameters; never import game/.' }],
      }],
    },
  },
]);
```

- [ ] **Step 6: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="data:," />
    <title>Hive</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

The `data:,` icon stops the browser requesting `/favicon.ico`. That 404 would otherwise show up as a console error in the Playwright smoke test.

- [ ] **Step 7: Create a temporary `src/main.ts` that renders one lit hex prism**

```ts
import * as THREE from 'three';

const app = document.getElementById('app');
if (!app) throw new Error('#app not found');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#cfe8f3');
const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 3, 4);
camera.lookAt(0, 0, 0);

scene.add(new THREE.HemisphereLight('#ffffff', '#6b8f4e', 1.2));
const sun = new THREE.DirectionalLight('#fff4e0', 2);
sun.position.set(3, 5, 2);
scene.add(sun);

const prism = new THREE.Mesh(
  new THREE.CylinderGeometry(1, 1, 0.3, 6),
  new THREE.MeshLambertMaterial({ color: '#9bd16a', flatShading: true }),
);
scene.add(prism);

renderer.setAnimationLoop((timeMs) => {
  prism.rotation.y = timeMs / 2000;
  renderer.render(scene, camera);
});
```

- [ ] **Step 8: Create `.claude/launch.json` for preview tooling**

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "dev", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 5173 }
  ]
}
```

- [ ] **Step 9: Run the full check**

Run: `npm run check`
Expected: typecheck passes, lint passes, and vitest prints `No test files found, exiting with code 0`. The overall exit code is 0.

- [ ] **Step 10: Prove the layer rules fire**

Create `src/sim/lint-probe.ts`:

```ts
import * as THREE from 'three';
import { probe } from '../render/nothing';
export const value = [THREE.REVISION, probe, window.innerWidth];
```

Run: `npx eslint src/sim/lint-probe.ts`
Expected: FAIL with three errors:
- `no-restricted-imports` for `three`
- `no-restricted-imports` for `../render/nothing`
- `no-restricted-globals` for `window`

If the `../render/nothing` pattern does **not** fire, change that pattern group in `eslint.config.js` from `'**/render/**'` to `'../render/*', '../../render/*', '**/render/*'` (likewise for the other layers) and re-run until it does.

Then delete the probe: `rm src/sim/lint-probe.ts`.

- [ ] **Step 11: Look at it**

Run: `npm run dev`, then open `http://localhost:5173` (or start the `dev` preview config).
Expected: a green hexagonal prism slowly rotating on a light-blue background, with no console errors.

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts eslint.config.js index.html src/main.ts .claude/launch.json
git commit -m "chore: scaffold Vite + TypeScript + three.js project with layer lint rules"
```

---

### Task 2: Hex math (`core/hex`)

**Files:**
- Create: `src/core/hex.ts`
- Test: `tests/core/hex.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - Types: `interface Hex { readonly q: number; readonly r: number }`, `type HexKey = string`
  - Constants: `HEX_SIZE = 1`, `ORIGIN: Hex`, `HEX_DIRECTIONS: readonly Hex[]`
  - Construction and keys: `hex(q, r): Hex`, `hexKey(h): HexKey`, `parseHexKey(key): Hex`, `hexAdd(a, b): Hex`, `hexScale(h, k): Hex`
  - Neighborhood: `hexNeighbors(h): Hex[]`, `hexDistance(a, b): number`, `hexRing(center, radius): Hex[]`, `hexRange(center, radius): Hex[]`
  - World mapping: `hexToWorld(h, size?): { x: number; z: number }`, `worldToHex(x, z, size?): Hex`, `hexRound(qf, rf): Hex`
  - Rule: returned hexes never contain `-0`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/core/hex.test.ts
import { describe, expect, it } from 'vitest';
import {
  HEX_SIZE, ORIGIN, hex, hexDistance, hexKey, hexNeighbors, hexRange, hexRing, hexToWorld, parseHexKey, worldToHex,
} from '../../src/core/hex';

describe('hex keys', () => {
  it('round-trips through a key', () => {
    expect(parseHexKey(hexKey(hex(3, -7)))).toEqual({ q: 3, r: -7 });
    expect(hexKey(hex(-0, 0))).toBe('0,0');
  });
});

describe('hex neighborhoods', () => {
  it('has six distinct neighbors at distance 1', () => {
    const center = hex(2, -1);
    const n = hexNeighbors(center);
    expect(n).toHaveLength(6);
    expect(new Set(n.map(hexKey)).size).toBe(6);
    for (const h of n) expect(hexDistance(h, center)).toBe(1);
  });

  it('computes distance', () => {
    expect(hexDistance(ORIGIN, hex(3, -1))).toBe(3);
    expect(hexDistance(hex(-2, 2), hex(2, -2))).toBe(4);
    expect(hexDistance(hex(1, 1), hex(1, 1))).toBe(0);
  });

  it('builds rings of 6r hexes at exactly distance r', () => {
    expect(hexRing(ORIGIN, 0)).toEqual([ORIGIN]);
    for (const r of [1, 2, 5]) {
      const ring = hexRing(hex(1, 2), r);
      expect(ring).toHaveLength(6 * r);
      expect(new Set(ring.map(hexKey)).size).toBe(6 * r);
      for (const h of ring) expect(hexDistance(h, hex(1, 2))).toBe(r);
    }
  });

  it('builds ranges of 3r(r+1)+1 unique hexes', () => {
    for (const r of [0, 1, 3, 12]) {
      const range = hexRange(ORIGIN, r);
      expect(range).toHaveLength(3 * r * (r + 1) + 1);
      expect(new Set(range.map(hexKey)).size).toBe(range.length);
      for (const h of range) expect(hexDistance(h, ORIGIN)).toBeLessThanOrEqual(r);
    }
  });
});

describe('hex <-> world', () => {
  it('lays out pointy-top rows', () => {
    expect(hexToWorld(hex(1, 0))).toEqual({ x: Math.sqrt(3), z: 0 });
    const p = hexToWorld(hex(0, 1));
    expect(p.x).toBeCloseTo(Math.sqrt(3) / 2);
    expect(p.z).toBeCloseTo(1.5);
  });

  it('maps every hex center back to its hex', () => {
    for (const h of hexRange(ORIGIN, 6)) {
      const { x, z } = hexToWorld(h);
      expect(worldToHex(x, z)).toEqual(h);
    }
  });

  it('maps points inside a hex back to that hex', () => {
    const inner = ((HEX_SIZE * Math.sqrt(3)) / 2) * 0.95;
    for (const h of hexRange(ORIGIN, 3)) {
      const c = hexToWorld(h);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        expect(worldToHex(c.x + Math.cos(a) * inner, c.z + Math.sin(a) * inner)).toEqual(h);
      }
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/core/hex.test.ts`
Expected: FAIL with `Failed to resolve import "../../src/core/hex"`.

- [ ] **Step 3: Implement `src/core/hex.ts`**

```ts
/** Axial hex coordinates, pointy-top layout. */
export interface Hex {
  readonly q: number;
  readonly r: number;
}
export type HexKey = string;

/** Distance from a hex center to one of its corners, in world units. */
export const HEX_SIZE = 1;

const SQRT3 = Math.sqrt(3);

/** Turns -0 into 0 so keys and deep equality stay stable. */
const norm = (n: number): number => (n === 0 ? 0 : n);

export function hex(q: number, r: number): Hex {
  return { q: norm(q), r: norm(r) };
}

export const ORIGIN: Hex = hex(0, 0);

export const HEX_DIRECTIONS: readonly Hex[] = [
  hex(1, 0), hex(1, -1), hex(0, -1), hex(-1, 0), hex(-1, 1), hex(0, 1),
];

export function hexKey(h: Hex): HexKey {
  return `${h.q},${h.r}`;
}

export function parseHexKey(key: HexKey): Hex {
  const [q, r] = key.split(',').map(Number);
  return hex(q, r);
}

export function hexAdd(a: Hex, b: Hex): Hex {
  return hex(a.q + b.q, a.r + b.r);
}

export function hexScale(h: Hex, k: number): Hex {
  return hex(h.q * k, h.r * k);
}

export function hexNeighbors(h: Hex): Hex[] {
  return HEX_DIRECTIONS.map((d) => hexAdd(h, d));
}

export function hexDistance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

/** Hexes at exactly `radius` steps from `center`. */
export function hexRing(center: Hex, radius: number): Hex[] {
  if (radius === 0) return [hex(center.q, center.r)];
  const out: Hex[] = [];
  let cur = hexAdd(center, hexScale(HEX_DIRECTIONS[4], radius));
  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < radius; step++) {
      out.push(cur);
      cur = hexAdd(cur, HEX_DIRECTIONS[side]);
    }
  }
  return out;
}

/** Hexes within `radius` steps of `center`, center included. */
export function hexRange(center: Hex, radius: number): Hex[] {
  const out: Hex[] = [];
  for (let dq = -radius; dq <= radius; dq++) {
    const lo = Math.max(-radius, -dq - radius);
    const hi = Math.min(radius, -dq + radius);
    for (let dr = lo; dr <= hi; dr++) out.push(hex(center.q + dq, center.r + dr));
  }
  return out;
}

export function hexToWorld(h: Hex, size = HEX_SIZE): { x: number; z: number } {
  return { x: size * SQRT3 * (h.q + h.r / 2), z: size * 1.5 * h.r };
}

export function worldToHex(x: number, z: number, size = HEX_SIZE): Hex {
  const q = ((SQRT3 / 3) * x - z / 3) / size;
  const r = ((2 / 3) * z) / size;
  return hexRound(q, r);
}

export function hexRound(qf: number, rf: number): Hex {
  const sf = -qf - rf;
  let q = Math.round(qf);
  let r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf);
  const dr = Math.abs(r - rf);
  const ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return hex(q, r);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/core/hex.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/hex.ts tests/core/hex.test.ts
git commit -m "feat(core): add axial pointy-top hex math"
```

---

### Task 3: Seeded RNG and typed event bus (`core/rng`, `core/events`)

**Files:**
- Create: `src/core/rng.ts`, `src/core/events.ts`
- Test: `tests/core/rng.test.ts`, `tests/core/events.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Rng = () => number` (returns a value in [0, 1))
  - `mulberry32(seed: number): Rng`
  - `randInt(rng, min, max): number` (inclusive)
  - `pick<T>(rng, items: readonly T[]): T` (throws on an empty list)
  - `hash2(a: number, b: number, seed?: number): number` (in [0, 1); stateless, for per-tile variation)
  - `class EventBus<E extends { type: string }>` with:
    - `on(type, fn): () => void`
    - `onAny(fn): () => void`
    - `emit(e): void`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/core/rng.test.ts
import { describe, expect, it } from 'vitest';
import { hash2, mulberry32, pick, randInt } from '../../src/core/rng';

describe('mulberry32', () => {
  it('is deterministic per seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect(Array.from({ length: 5 }, () => a())).toEqual(Array.from({ length: 5 }, () => b()));
  });

  it('differs across seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('stays in [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 10_000; i++) {
      const v = rng();
      expect(v >= 0 && v < 1).toBe(true);
    }
  });
});

describe('helpers', () => {
  it('randInt covers the inclusive range', () => {
    const rng = mulberry32(3);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(randInt(rng, 2, 5));
    expect([...seen].sort()).toEqual([2, 3, 4, 5]);
  });

  it('pick refuses an empty list', () => {
    expect(() => pick(mulberry32(1), [])).toThrow();
    expect(pick(mulberry32(1), ['only'])).toBe('only');
  });

  it('hash2 is deterministic, in range and well spread', () => {
    expect(hash2(3, 4, 1)).toBe(hash2(3, 4, 1));
    expect(hash2(3, 4, 1)).not.toBe(hash2(4, 3, 1));
    const buckets = new Set<number>();
    for (let q = -10; q <= 10; q++) {
      for (let r = -10; r <= 10; r++) {
        const v = hash2(q, r, 9);
        expect(v >= 0 && v < 1).toBe(true);
        buckets.add(Math.floor(v * 10));
      }
    }
    expect(buckets.size).toBe(10);
  });
});
```

```ts
// tests/core/events.test.ts
import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';

type E = { type: 'a'; n: number } | { type: 'b'; s: string };

describe('EventBus', () => {
  it('delivers typed events to matching listeners only', () => {
    const bus = new EventBus<E>();
    const got: number[] = [];
    bus.on('a', (e) => got.push(e.n));
    bus.emit({ type: 'a', n: 1 });
    bus.emit({ type: 'b', s: 'x' });
    expect(got).toEqual([1]);
  });

  it('onAny sees every event', () => {
    const bus = new EventBus<E>();
    const types: string[] = [];
    bus.onAny((e) => types.push(e.type));
    bus.emit({ type: 'a', n: 1 });
    bus.emit({ type: 'b', s: 'x' });
    expect(types).toEqual(['a', 'b']);
  });

  it('unsubscribes', () => {
    const bus = new EventBus<E>();
    let count = 0;
    const off = bus.on('a', () => count++);
    const offAny = bus.onAny(() => count++);
    off();
    offAny();
    bus.emit({ type: 'a', n: 1 });
    expect(count).toBe(0);
  });

  it('tolerates a listener unsubscribing during emit', () => {
    const bus = new EventBus<E>();
    const calls: string[] = [];
    const off = bus.on('a', () => {
      calls.push('first');
      off();
    });
    bus.on('a', () => calls.push('second'));
    bus.emit({ type: 'a', n: 1 });
    bus.emit({ type: 'a', n: 2 });
    expect(calls).toEqual(['first', 'second', 'second']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/core`
Expected: FAIL. Both new files report `Failed to resolve import` for `rng` and `events`. The hex tests still pass.

- [ ] **Step 3: Implement `src/core/rng.ts`**

```ts
/** Returns a float in [0, 1). */
export type Rng = () => number;

/** Small, fast, seedable PRNG. Same seed gives the same sequence. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max], both inclusive. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() called with an empty list');
  return items[Math.floor(rng() * items.length)];
}

/** Stateless hash of two integers (plus seed) to [0, 1). Used for per-tile visual variation. */
export function hash2(a: number, b: number, seed = 0): number {
  let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
```

- [ ] **Step 4: Implement `src/core/events.ts`**

```ts
type Listener<E> = (e: E) => void;

/** Typed pub/sub for discriminated-union events ({ type: ... }). */
export class EventBus<E extends { type: string }> {
  private readonly byType = new Map<string, Set<Listener<E>>>();
  private readonly any = new Set<Listener<E>>();

  on<T extends E['type']>(type: T, fn: (e: Extract<E, { type: T }>) => void): () => void {
    let set = this.byType.get(type);
    if (!set) {
      set = new Set();
      this.byType.set(type, set);
    }
    const listener = fn as Listener<E>;
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }

  onAny(fn: Listener<E>): () => void {
    this.any.add(fn);
    return () => {
      this.any.delete(fn);
    };
  }

  emit(e: E): void {
    for (const fn of [...(this.byType.get(e.type) ?? [])]) fn(e);
    for (const fn of [...this.any]) fn(e);
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/core`
Expected: PASS (all hex, rng and events tests).

- [ ] **Step 6: Commit**

```bash
git add src/core/rng.ts src/core/events.ts tests/core/rng.test.ts tests/core/events.test.ts
git commit -m "feat(core): add seeded RNG, hash2 and typed event bus"
```

---

### Task 4: Fixed-step loop and FPS meter (`game/loop`, `game/fps`)

**Files:**
- Create: `src/game/loop.ts`, `src/game/fps.ts`
- Modify: `src/main.ts` (full replacement below)
- Test: `tests/game/loop.test.ts`, `tests/game/fps.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - Constants: `TICK_MS = 100`, `MAX_FRAME_MS = 250`
  - `ticksForFrame(accMs, frameMs, speed): { ticks: number; accMs: number }`
  - `interface LoopHooks { getSpeed(): number; step(ticks: number): void; render(dtSec: number, timeSec: number): void }`
  - `startLoop(hooks): () => void` (the returned function stops the loop)
  - `createFpsMeter(): { el: HTMLElement; frame(dtSec: number): void }`

- [ ] **Step 1: Write the failing tests** (includes Review Focus #3)

```ts
// tests/game/loop.test.ts
import { describe, expect, it } from 'vitest';
import { MAX_FRAME_MS, TICK_MS, ticksForFrame } from '../../src/game/loop';

function runFrames(frames: number, frameMs: number, speed: number): number {
  let acc = 0;
  let total = 0;
  for (let i = 0; i < frames; i++) {
    const r = ticksForFrame(acc, frameMs, speed);
    acc = r.accMs;
    total += r.ticks;
  }
  return total;
}

describe('ticksForFrame', () => {
  it('runs 10 ticks per real second at 1x', () => {
    expect(TICK_MS).toBe(100);
    expect(runFrames(50, 20, 1)).toBe(10);
  });

  it('scales with speed', () => {
    expect(runFrames(50, 20, 2)).toBe(20);
    expect(runFrames(50, 20, 4)).toBe(40);
  });

  it('runs nothing and drops the accumulator while paused', () => {
    expect(ticksForFrame(90, 20, 0)).toEqual({ ticks: 0, accMs: 0 });
  });

  it('carries the remainder between frames', () => {
    const a = ticksForFrame(0, 60, 1);
    expect(a).toEqual({ ticks: 0, accMs: 60 });
    const b = ticksForFrame(a.accMs, 60, 1);
    expect(b.ticks).toBe(1);
    expect(b.accMs).toBeCloseTo(20);
  });

  it('caps a huge frame (background tab, hitch) so time never fast-forwards', () => {
    expect(MAX_FRAME_MS).toBe(250);
    expect(ticksForFrame(0, 10_000, 4).ticks).toBe(10);
    expect(ticksForFrame(0, 10_000, 1).ticks).toBe(2);
  });

  it('ignores negative frame times', () => {
    expect(ticksForFrame(0, -500, 1)).toEqual({ ticks: 0, accMs: 0 });
  });
});
```

```ts
// tests/game/fps.test.ts
// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { createFpsMeter } from '../../src/game/fps';

it('reports frames per second every half second', () => {
  const meter = createFpsMeter();
  for (let i = 0; i < 30; i++) meter.frame(1 / 60);
  expect(meter.el.textContent).toBe('60 fps');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/game`
Expected: FAIL with `Failed to resolve import "../../src/game/loop"` (and `fps`).

- [ ] **Step 3: Implement `src/game/loop.ts`**

```ts
/** Real milliseconds per sim tick at 1x. Must match sim/clock TICKS_PER_SECOND (10). */
export const TICK_MS = 100;
/** Longest real frame we account for; longer gaps (hidden tab, hitch) are dropped, not fast-forwarded. */
export const MAX_FRAME_MS = 250;

export function ticksForFrame(accMs: number, frameMs: number, speed: number): { ticks: number; accMs: number } {
  if (speed <= 0) return { ticks: 0, accMs: 0 };
  const acc = accMs + Math.min(Math.max(frameMs, 0), MAX_FRAME_MS) * speed;
  const ticks = Math.floor(acc / TICK_MS);
  return { ticks, accMs: acc - ticks * TICK_MS };
}

export interface LoopHooks {
  getSpeed(): number;
  step(ticks: number): void;
  render(dtSec: number, timeSec: number): void;
}

/** Fixed-step sim, free-running render. Returns a stop function. */
export function startLoop(hooks: LoopHooks): () => void {
  let acc = 0;
  let last = performance.now();
  let running = true;
  let raf = 0;
  const frame = (now: number) => {
    if (!running) return;
    const frameMs = now - last;
    last = now;
    const r = ticksForFrame(acc, frameMs, hooks.getSpeed());
    acc = r.accMs;
    if (r.ticks > 0) hooks.step(r.ticks);
    hooks.render(Math.min(Math.max(frameMs, 0), MAX_FRAME_MS) / 1000, now / 1000);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    running = false;
    cancelAnimationFrame(raf);
  };
}
```

- [ ] **Step 4: Implement `src/game/fps.ts`**

```ts
/** Dev-only frame-rate readout. */
export function createFpsMeter(): { el: HTMLElement; frame(dtSec: number): void } {
  const el = document.createElement('div');
  el.className = 'fps';
  let frames = 0;
  let time = 0;
  return {
    el,
    frame(dtSec: number) {
      frames += 1;
      time += dtSec;
      if (time >= 0.5 - 1e-9) {
        el.textContent = `${Math.round(frames / time)} fps`;
        frames = 0;
        time = 0;
      }
    },
  };
}
```

- [ ] **Step 5: Replace `src/main.ts` to drive the prism through the loop**

```ts
import * as THREE from 'three';
import { startLoop } from './game/loop';
import { createFpsMeter } from './game/fps';

const app = document.getElementById('app');
if (!app) throw new Error('#app not found');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#cfe8f3');
const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 3, 4);
camera.lookAt(0, 0, 0);

scene.add(new THREE.HemisphereLight('#ffffff', '#6b8f4e', 1.2));
const sun = new THREE.DirectionalLight('#fff4e0', 2);
sun.position.set(3, 5, 2);
scene.add(sun);

const prism = new THREE.Mesh(
  new THREE.CylinderGeometry(1, 1, 0.3, 6),
  new THREE.MeshLambertMaterial({ color: '#9bd16a', flatShading: true }),
);
scene.add(prism);

const fps = createFpsMeter();
Object.assign(fps.el.style, { position: 'fixed', left: '12px', bottom: '12px', font: '12px monospace' });
app.appendChild(fps.el);

let ticks = 0;
startLoop({
  getSpeed: () => 1,
  step: (n) => {
    ticks += n;
  },
  render: (dt) => {
    prism.rotation.y = ticks * 0.05;
    renderer.render(scene, camera);
    fps.frame(dt);
  },
});
```

- [ ] **Step 6: Run the checks**

Run: `npm run check`
Expected: all green.

- [ ] **Step 7: Look at it**

Run `npm run dev`.
Expected:
- The prism turns in steps (10 per second), so the rotation looks slightly steppy. That is correct: rotation is driven by sim ticks.
- The bottom-left readout shows about 60 fps.

- [ ] **Step 8: Commit**

```bash
git add src/game/loop.ts src/game/fps.ts src/main.ts tests/game/loop.test.ts tests/game/fps.test.ts
git commit -m "feat(game): add fixed-step loop with frame cap and dev FPS meter"
```

---
## M3 — Sim core (headless)

### Task 5: Content types, registry and packs (`content/`)

**Files:**
- Create: `src/content/types.ts`, `src/content/tiles.ts`, `src/content/registry.ts`, `src/content/packs/base.ts`, `src/content/packs/bees.ts`, `src/content/default.ts`
- Test: `tests/content/registry.test.ts`

**Interfaces:**
- Consumes: `Hex` from `core/hex`.
- Produces:
  - Types: `ResourceId = string`, `TileId = 'grass' | 'water' | 'soil'`, `Amounts = Partial<Record<ResourceId, number>>`, `ResourceDef`, `TileDef`, `SourceDef`, `ProducerDef`, `BuildableDef`, `PriceDef`, `StartingEntity`, `StartingSetup`, `ContentPack`
  - `COINS = 'coins'`
  - `TILES: Record<TileId, TileDef>`, `isTileId(v: string): v is TileId`
  - `class Registry` with:
    - maps `resources`, `buildables`, `prices`, and `start`
    - `registerPack(pack)`
    - lookups: `buildable(id)` (throws when unknown), `findBuildable(id)`, `price(resource)`
    - `purchasable(): BuildableDef[]`
    - `cheapestSourceCost(): number` (returns `Infinity` when there is no purchasable source)
  - `validateRegistry(reg): string[]`
  - `createRegistry(packs): Registry` (throws on any problem)
  - `basePack`, `beesPack`, `DEFAULT_PACKS`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/content/registry.test.ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_PACKS } from '../../src/content/default';
import { Registry, createRegistry, validateRegistry } from '../../src/content/registry';
import type { ContentPack } from '../../src/content/types';

function validPack(): ContentPack {
  return {
    id: 'test',
    resources: [{ id: 'coins', unit: 'coin' }, { id: 'jam', unit: 'kg' }],
    buildables: [
      {
        id: 'jar', cost: { coins: 5 }, allowedTiles: ['grass'], purchasable: true, removable: true,
        producer: { consumes: 'nectar', range: 1, output: 'jam', conversion: 1, capacity: 2, maxIntakePerDay: 1 },
      },
      {
        id: 'bush', cost: { coins: 2 }, allowedTiles: ['grass'], setsTile: 'soil', purchasable: true, removable: true,
        source: { kind: 'nectar', flowerType: 'berry', yieldPerDay: 1 },
      },
    ],
    prices: [{ resource: 'jam', sell: 3 }],
    start: { inventory: { coins: 10 }, entities: [{ def: 'jar', hex: { q: 0, r: 0 } }] },
  };
}

function problemsFor(pack: ContentPack): string[] {
  const reg = new Registry();
  reg.registerPack(pack);
  return validateRegistry(reg);
}

describe('validateRegistry', () => {
  it('accepts a valid pack', () => {
    expect(problemsFor(validPack())).toEqual([]);
  });

  it('flags a cost in an unknown resource', () => {
    const p = validPack();
    p.buildables[0].cost = { gems: 1 };
    expect(problemsFor(p).join('\n')).toContain('unknown resource "gems"');
  });

  it('flags a non-positive cost', () => {
    const p = validPack();
    p.buildables[0].cost = { coins: 0 };
    expect(problemsFor(p).join('\n')).toContain('must be a positive number');
  });

  it('flags a producer whose output is not a resource', () => {
    const p = validPack();
    p.buildables[0].producer!.output = 'nothing';
    expect(problemsFor(p).join('\n')).toContain('producer output "nothing"');
  });

  it('flags a negative source yield', () => {
    const p = validPack();
    p.buildables[1].source!.yieldPerDay = -1;
    expect(problemsFor(p).join('\n')).toContain('yieldPerDay');
  });

  it('flags empty or unknown tiles', () => {
    const p = validPack();
    p.buildables[0].allowedTiles = [];
    p.buildables[1].allowedTiles = ['lava' as never];
    const text = problemsFor(p).join('\n');
    expect(text).toContain('allowedTiles is empty');
    expect(text).toContain('unknown tile "lava"');
  });

  it('flags bad prices and bad starting setup', () => {
    const p = validPack();
    p.prices = [{ resource: 'gold', sell: 0 }];
    p.start = { inventory: { rubies: 1 }, entities: [{ def: 'castle', hex: { q: 0, r: 0 } }] };
    const text = problemsFor(p).join('\n');
    expect(text).toContain('price: unknown resource "gold"');
    expect(text).toContain('sell must be a positive number');
    expect(text).toContain('start: unknown resource "rubies"');
    expect(text).toContain('start: unknown buildable "castle"');
  });

  it('requires the coins resource', () => {
    const p = validPack();
    p.resources = p.resources.filter((r) => r.id !== 'coins');
    p.buildables.forEach((b) => (b.cost = {}));
    p.start = undefined;
    expect(problemsFor(p).join('\n')).toContain('Missing required resource "coins"');
  });
});

describe('Registry', () => {
  it('rejects duplicate ids across packs', () => {
    const reg = new Registry();
    reg.registerPack(validPack());
    expect(() => reg.registerPack({ ...validPack(), id: 'again' })).toThrow('Duplicate resource id "coins"');
  });

  it('createRegistry throws with every problem listed', () => {
    const p = validPack();
    p.buildables[0].cost = { gems: 1 };
    expect(() => createRegistry([p])).toThrow(/Invalid content:[\s\S]*gems/);
  });

  it('answers lookups', () => {
    const reg = createRegistry([validPack()]);
    expect(reg.buildable('jar').producer?.output).toBe('jam');
    expect(() => reg.buildable('nope')).toThrow('Unknown buildable "nope"');
    expect(reg.findBuildable('nope')).toBeUndefined();
    expect(reg.price('jam')?.sell).toBe(3);
    expect(reg.purchasable().map((b) => b.id)).toEqual(['jar', 'bush']);
    expect(reg.cheapestSourceCost()).toBe(2);
  });
});

describe('default packs', () => {
  it('are valid and match the spec starting setup', () => {
    const reg = createRegistry(DEFAULT_PACKS);
    expect(reg.purchasable().map((b) => b.id)).toEqual(['hive', 'bed_wildflower']);
    expect(reg.cheapestSourceCost()).toBe(20);
    expect(reg.start.inventory).toEqual({ coins: 60, honey_wildflower: 0 });
    const defs = reg.start.entities.map((e) => e.def).sort();
    expect(defs).toEqual(['bed_wildflower', 'bed_wildflower', 'bed_wildflower', 'hive', 'house']);
    expect(reg.buildable('house').removable).toBe(false);
    expect(reg.price('honey_wildflower')?.sell).toBe(15);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/content`
Expected: FAIL with `Failed to resolve import "../../src/content/default"`.

- [ ] **Step 3: Implement `src/content/types.ts`**

```ts
import type { Hex } from '../core/hex';

export type ResourceId = string;
export type TileId = 'grass' | 'water' | 'soil';
export type Amounts = Partial<Record<ResourceId, number>>;

export const COINS: ResourceId = 'coins';

export interface ResourceDef {
  id: ResourceId;
  unit: 'coin' | 'kg';
}

export interface TileDef {
  id: TileId;
  buildable: boolean;
}

export interface SourceDef {
  kind: 'nectar';
  flowerType: string;
  /** Nectar units per in-game day. */
  yieldPerDay: number;
}

export interface ProducerDef {
  consumes: 'nectar';
  /** Hex distance within which sources feed this producer. */
  range: number;
  output: ResourceId;
  /** Units of output per unit of nectar. */
  conversion: number;
  /** Output stored before production stalls. */
  capacity: number;
  maxIntakePerDay: number;
}

export interface BuildableDef {
  id: string;
  cost: Amounts;
  allowedTiles: TileId[];
  /** A placed entity turns its tile into this; the previous tile comes back on removal. */
  setsTile?: TileId;
  purchasable: boolean;
  removable: boolean;
  producer?: ProducerDef;
  source?: SourceDef;
}

export interface PriceDef {
  resource: ResourceId;
  /** Coins per unit. */
  sell: number;
}

export interface StartingEntity {
  def: string;
  hex: Hex;
}

export interface StartingSetup {
  inventory: Amounts;
  entities: StartingEntity[];
}

export interface ContentPack {
  id: string;
  resources: ResourceDef[];
  buildables: BuildableDef[];
  prices: PriceDef[];
  start?: StartingSetup;
}
```

- [ ] **Step 4: Implement `src/content/tiles.ts`**

```ts
import type { TileDef, TileId } from './types';

export const TILES: Record<TileId, TileDef> = {
  grass: { id: 'grass', buildable: true },
  soil: { id: 'soil', buildable: true },
  water: { id: 'water', buildable: false },
};

export function isTileId(v: string): v is TileId {
  return Object.hasOwn(TILES, v);
}
```

- [ ] **Step 5: Implement `src/content/registry.ts`**

```ts
import { isTileId } from './tiles';
import {
  COINS, type BuildableDef, type ContentPack, type PriceDef, type ResourceDef, type ResourceId, type StartingSetup,
} from './types';

export class Registry {
  readonly resources = new Map<ResourceId, ResourceDef>();
  readonly buildables = new Map<string, BuildableDef>();
  readonly prices = new Map<ResourceId, PriceDef>();
  readonly start: StartingSetup = { inventory: {}, entities: [] };

  registerPack(pack: ContentPack): void {
    for (const r of pack.resources) {
      if (this.resources.has(r.id)) throw new Error(`Duplicate resource id "${r.id}" in pack "${pack.id}"`);
      this.resources.set(r.id, r);
    }
    for (const b of pack.buildables) {
      if (this.buildables.has(b.id)) throw new Error(`Duplicate buildable id "${b.id}" in pack "${pack.id}"`);
      this.buildables.set(b.id, b);
    }
    for (const p of pack.prices) {
      if (this.prices.has(p.resource)) throw new Error(`Duplicate price for "${p.resource}" in pack "${pack.id}"`);
      this.prices.set(p.resource, p);
    }
    if (pack.start) {
      Object.assign(this.start.inventory, pack.start.inventory);
      this.start.entities.push(...pack.start.entities);
    }
  }

  buildable(id: string): BuildableDef {
    const def = this.buildables.get(id);
    if (!def) throw new Error(`Unknown buildable "${id}"`);
    return def;
  }

  findBuildable(id: string): BuildableDef | undefined {
    return this.buildables.get(id);
  }

  price(resource: ResourceId): PriceDef | undefined {
    return this.prices.get(resource);
  }

  purchasable(): BuildableDef[] {
    return [...this.buildables.values()].filter((b) => b.purchasable);
  }

  /** Coin cost of the cheapest purchasable source; Infinity if there is none. */
  cheapestSourceCost(): number {
    let min = Infinity;
    for (const b of this.purchasable()) if (b.source) min = Math.min(min, b.cost[COINS] ?? 0);
    return min;
  }
}

const isPositive = (n: number | undefined): boolean => n !== undefined && Number.isFinite(n) && n > 0;

export function validateRegistry(reg: Registry): string[] {
  const problems: string[] = [];
  if (!reg.resources.has(COINS)) problems.push(`Missing required resource "${COINS}"`);

  for (const b of reg.buildables.values()) {
    const where = `buildable "${b.id}"`;
    for (const [res, amount] of Object.entries(b.cost)) {
      if (!reg.resources.has(res)) problems.push(`${where}: cost uses unknown resource "${res}"`);
      if (!isPositive(amount)) problems.push(`${where}: cost of "${res}" must be a positive number`);
    }
    if (b.allowedTiles.length === 0) problems.push(`${where}: allowedTiles is empty`);
    for (const t of b.allowedTiles) if (!isTileId(t)) problems.push(`${where}: unknown tile "${t}"`);
    if (b.setsTile !== undefined && !isTileId(b.setsTile)) problems.push(`${where}: setsTile uses unknown tile "${b.setsTile}"`);
    if (b.producer) {
      const p = b.producer;
      if (!reg.resources.has(p.output)) problems.push(`${where}: producer output "${p.output}" is not a resource`);
      if (!Number.isInteger(p.range) || p.range < 0) problems.push(`${where}: producer range must be a non-negative integer`);
      for (const k of ['conversion', 'capacity', 'maxIntakePerDay'] as const) {
        if (!isPositive(p[k])) problems.push(`${where}: producer ${k} must be a positive number`);
      }
    }
    if (b.source && !isPositive(b.source.yieldPerDay)) problems.push(`${where}: source yieldPerDay must be a positive number`);
  }

  for (const p of reg.prices.values()) {
    if (!reg.resources.has(p.resource)) problems.push(`price: unknown resource "${p.resource}"`);
    if (!isPositive(p.sell)) problems.push(`price for "${p.resource}": sell must be a positive number`);
  }

  for (const [res, amount] of Object.entries(reg.start.inventory)) {
    if (!reg.resources.has(res)) problems.push(`start: unknown resource "${res}"`);
    if (amount === undefined || !Number.isFinite(amount) || amount < 0) problems.push(`start: "${res}" must be a non-negative number`);
  }
  for (const e of reg.start.entities) {
    if (!reg.buildables.has(e.def)) problems.push(`start: unknown buildable "${e.def}"`);
  }
  return problems;
}

/** Registers and validates packs. Invalid content is a bug, so this always throws. */
export function createRegistry(packs: readonly ContentPack[]): Registry {
  const reg = new Registry();
  for (const pack of packs) reg.registerPack(pack);
  const problems = validateRegistry(reg);
  if (problems.length > 0) throw new Error(`Invalid content:\n- ${problems.join('\n- ')}`);
  return reg;
}
```

- [ ] **Step 6: Implement the packs**

```ts
// src/content/packs/base.ts
import { COINS, type ContentPack } from '../types';

/** Resources every game needs regardless of production chains. */
export const basePack: ContentPack = {
  id: 'base',
  resources: [{ id: COINS, unit: 'coin' }],
  buildables: [],
  prices: [],
};
```

```ts
// src/content/packs/bees.ts
import type { ContentPack } from '../types';

/** First production chain: wildflower beds feed hives, hives make honey. Numbers from spec §5.9. */
export const beesPack: ContentPack = {
  id: 'bees',
  resources: [{ id: 'honey_wildflower', unit: 'kg' }],
  buildables: [
    { id: 'house', cost: {}, allowedTiles: ['grass'], purchasable: false, removable: false },
    {
      id: 'hive',
      cost: { coins: 120 },
      allowedTiles: ['grass'],
      purchasable: true,
      removable: true,
      producer: { consumes: 'nectar', range: 1, output: 'honey_wildflower', conversion: 0.25, capacity: 5, maxIntakePerDay: 4 },
    },
    {
      id: 'bed_wildflower',
      cost: { coins: 20 },
      allowedTiles: ['grass'],
      setsTile: 'soil',
      purchasable: true,
      removable: true,
      source: { kind: 'nectar', flowerType: 'wildflower', yieldPerDay: 1 },
    },
  ],
  prices: [{ resource: 'honey_wildflower', sell: 15 }],
  start: {
    inventory: { coins: 60, honey_wildflower: 0 },
    // Pointy-top neighbors of the origin: house NW, beds W / E / SW. NE (1,-1) and SE (0,1) stay free.
    entities: [
      { def: 'hive', hex: { q: 0, r: 0 } },
      { def: 'house', hex: { q: 0, r: -1 } },
      { def: 'bed_wildflower', hex: { q: -1, r: 0 } },
      { def: 'bed_wildflower', hex: { q: 1, r: 0 } },
      { def: 'bed_wildflower', hex: { q: -1, r: 1 } },
    ],
  },
};
```

```ts
// src/content/default.ts
import { basePack } from './packs/base';
import { beesPack } from './packs/bees';
import type { ContentPack } from './types';

export const DEFAULT_PACKS: readonly ContentPack[] = [basePack, beesPack];
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/content`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/content tests/content
git commit -m "feat(content): add data types, validated registry and base + bees packs"
```

---

### Task 6: Game state, entities and world generation (`sim/state`, `sim/entities`, `sim/worldgen`)

**Files:**
- Create: `src/sim/state.ts`, `src/sim/entities.ts`, `src/sim/worldgen.ts`, `tests/sim/helpers.ts`
- Test: `tests/sim/state.test.ts`

**Interfaces:**
- Consumes:
  - `core/hex`: `Hex`, `HexKey`, `hex`, `hexKey`, `hexRange`, `hexDistance`, `ORIGIN`
  - `core/rng`: `mulberry32`, `pick`
  - `content`: `Registry`, `TileId`, `ResourceId`
- Produces:
  - `sim/state`:
    - `interface Tile { tile: TileId; owned: boolean; entityId?: string; decor?: 'tree' | 'rock' }`
    - `interface Entity { id: string; def: string; hex: Hex; store?: number; prevTile?: TileId }`
    - `type Speed = 0 | 1 | 2 | 4`
    - `interface GameState { version: 1; seed; nextId; clock: { tick; speed: Speed }; tiles: Record<HexKey, Tile>; entities: Record<string, Entity>; inventory: Record<ResourceId, number>; flags: { fullNotified: Record<string, boolean> } }`
    - `SAVE_VERSION = 1`
    - `createInitialState(seed, reg): GameState`
  - `sim/entities`:
    - `spawnEntity(state, reg, defId, at): Entity`: charges nothing, applies `setsTile`, throws on occupied or missing tile.
    - `despawnEntity(state, id): Entity`: restores `prevTile` and clears the full flag.
    - `entitiesWith(state, reg, role: 'producer' | 'source'): Entity[]`
    - Entity ids are `e1`, `e2`, … and are never reused.
  - `sim/worldgen`: `MAP_RADIUS = 12`, `PLOT_RADIUS = 3`, `generateTiles(seed): Record<HexKey, Tile>`
  - `tests/sim/helpers.ts`: `reg`, `newGame(seed?)`, `clearEntities(state)`, `entitiesOf(state, def)`

- [ ] **Step 1: Create the shared test helpers**

```ts
// tests/sim/helpers.ts
import { DEFAULT_PACKS } from '../../src/content/default';
import { createRegistry } from '../../src/content/registry';
import { despawnEntity } from '../../src/sim/entities';
import { createInitialState, type Entity, type GameState } from '../../src/sim/state';

export const reg = createRegistry(DEFAULT_PACKS);

export function newGame(seed = 1): GameState {
  return createInitialState(seed, reg);
}

export function clearEntities(state: GameState): void {
  for (const id of Object.keys(state.entities)) despawnEntity(state, id);
}

export function entitiesOf(state: GameState, def: string): Entity[] {
  return Object.values(state.entities).filter((e) => e.def === def);
}
```

- [ ] **Step 2: Write the failing tests**

```ts
// tests/sim/state.test.ts
import { describe, expect, it } from 'vitest';
import { ORIGIN, hex, hexDistance, hexKey, parseHexKey } from '../../src/core/hex';
import { despawnEntity, entitiesWith, spawnEntity } from '../../src/sim/entities';
import { MAP_RADIUS, PLOT_RADIUS, generateTiles } from '../../src/sim/worldgen';
import { entitiesOf, newGame, reg } from './helpers';

describe('generateTiles', () => {
  const tiles = generateTiles(1);

  it('covers a radius-12 disc', () => {
    expect(Object.keys(tiles)).toHaveLength(469);
    for (const key of Object.keys(tiles)) expect(hexDistance(parseHexKey(key), ORIGIN)).toBeLessThanOrEqual(MAP_RADIUS);
  });

  it('owns exactly the radius-3 starting plot', () => {
    for (const [key, t] of Object.entries(tiles)) {
      expect(t.owned).toBe(hexDistance(parseHexKey(key), ORIGIN) <= PLOT_RADIUS);
    }
  });

  it('keeps the plot clear and water off its border', () => {
    for (const [key, t] of Object.entries(tiles)) {
      const d = hexDistance(parseHexKey(key), ORIGIN);
      if (d <= PLOT_RADIUS) {
        expect(t.tile).toBe('grass');
        expect(t.decor).toBeUndefined();
      }
      if (d <= PLOT_RADIUS + 1) expect(t.tile).not.toBe('water');
    }
  });

  it('has lakes and decor, never decor on water', () => {
    const all = Object.values(tiles);
    expect(all.filter((t) => t.tile === 'water').length).toBeGreaterThanOrEqual(3);
    expect(all.some((t) => t.decor === 'tree')).toBe(true);
    expect(all.some((t) => t.tile === 'water' && t.decor)).toBe(false);
  });

  it('is deterministic per seed', () => {
    expect(generateTiles(5)).toEqual(generateTiles(5));
    expect(generateTiles(5)).not.toEqual(generateTiles(6));
  });
});

describe('createInitialState', () => {
  const state = newGame(1);

  it('starts at tick 0, 1x speed, save version 1', () => {
    expect(state.version).toBe(1);
    expect(state.seed).toBe(1);
    expect(state.clock).toEqual({ tick: 0, speed: 1 });
    expect(state.flags).toEqual({ fullNotified: {} });
  });

  it('starts with the pack inventory', () => {
    expect(state.inventory).toEqual({ coins: 60, honey_wildflower: 0 });
  });

  it('places the starting entities', () => {
    const [hive] = entitiesOf(state, 'hive');
    expect(hive.hex).toEqual(ORIGIN);
    expect(hive.store).toBe(0);
    expect(entitiesOf(state, 'house')[0].hex).toEqual(hex(0, -1));
    expect(entitiesOf(state, 'bed_wildflower')).toHaveLength(3);
    expect(state.nextId).toBe(6);
    expect(entitiesWith(state, reg, 'producer')).toHaveLength(1);
    expect(entitiesWith(state, reg, 'source')).toHaveLength(3);
  });

  it('links tiles to entities and turns bed tiles into soil', () => {
    for (const e of Object.values(state.entities)) expect(state.tiles[hexKey(e.hex)].entityId).toBe(e.id);
    for (const bed of entitiesOf(state, 'bed_wildflower')) {
      expect(state.tiles[hexKey(bed.hex)].tile).toBe('soil');
      expect(bed.prevTile).toBe('grass');
    }
  });
});

describe('entities', () => {
  it('despawn restores the previous tile and clears links and flags', () => {
    const state = newGame(1);
    const [bed] = entitiesOf(state, 'bed_wildflower');
    state.flags.fullNotified[bed.id] = true;
    despawnEntity(state, bed.id);
    const tile = state.tiles[hexKey(bed.hex)];
    expect(tile.tile).toBe('grass');
    expect(tile.entityId).toBeUndefined();
    expect(state.entities[bed.id]).toBeUndefined();
    expect(state.flags.fullNotified[bed.id]).toBeUndefined();
  });

  it('spawn refuses occupied or missing tiles (invariant violations)', () => {
    const state = newGame(1);
    expect(() => spawnEntity(state, reg, 'hive', ORIGIN)).toThrow('occupied');
    expect(() => spawnEntity(state, reg, 'hive', hex(99, 0))).toThrow('no tile');
  });

  it('never reuses ids', () => {
    const state = newGame(1);
    const [bed] = entitiesOf(state, 'bed_wildflower');
    despawnEntity(state, bed.id);
    const again = spawnEntity(state, reg, 'bed_wildflower', bed.hex);
    expect(again.id).toBe('e6');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/sim`
Expected: FAIL with `Failed to resolve import "../../src/sim/entities"`.

- [ ] **Step 4: Implement `src/sim/worldgen.ts`**

```ts
import { ORIGIN, hexDistance, hexKey, hexRange, type HexKey } from '../core/hex';
import { mulberry32, pick } from '../core/rng';
import type { Tile } from './state';

export const MAP_RADIUS = 12;
export const PLOT_RADIUS = 3;

const LAKE_MIN_CENTER_DISTANCE = PLOT_RADIUS + 3;
const LAKE_KEEP_OUT = PLOT_RADIUS + 1;
const TREE_CHANCE = 0.1;
const ROCK_CHANCE = 0.03;

/** Seeded map: grass disc, a few ragged lakes outside the plot, scattered trees and rocks. */
export function generateTiles(seed: number): Record<HexKey, Tile> {
  const rng = mulberry32(seed);
  const all = hexRange(ORIGIN, MAP_RADIUS);
  const tiles: Record<HexKey, Tile> = {};
  for (const h of all) tiles[hexKey(h)] = { tile: 'grass', owned: hexDistance(h, ORIGIN) <= PLOT_RADIUS };

  const lakeCenters = all.filter((h) => hexDistance(h, ORIGIN) >= LAKE_MIN_CENTER_DISTANCE);
  const lakeCount = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < lakeCount; i++) {
    const center = pick(rng, lakeCenters);
    const radius = 1 + Math.floor(rng() * 2);
    for (const h of hexRange(center, radius)) {
      const tile = tiles[hexKey(h)];
      if (!tile || hexDistance(h, ORIGIN) <= LAKE_KEEP_OUT) continue;
      if (hexDistance(h, center) === radius && rng() < 0.4) continue; // ragged shoreline
      tile.tile = 'water';
    }
  }

  for (const h of all) {
    const tile = tiles[hexKey(h)];
    if (tile.tile !== 'grass' || hexDistance(h, ORIGIN) <= PLOT_RADIUS) continue;
    const roll = rng();
    if (roll < TREE_CHANCE) tile.decor = 'tree';
    else if (roll < TREE_CHANCE + ROCK_CHANCE) tile.decor = 'rock';
  }
  return tiles;
}
```

- [ ] **Step 5: Implement `src/sim/state.ts`**

```ts
import type { Hex, HexKey } from '../core/hex';
import type { Registry } from '../content/registry';
import type { ResourceId, TileId } from '../content/types';
import { spawnEntity } from './entities';
import { generateTiles } from './worldgen';

export interface Tile {
  tile: TileId;
  owned: boolean;
  entityId?: string;
  decor?: 'tree' | 'rock';
}

export interface Entity {
  id: string;
  def: string;
  hex: Hex;
  /** Output stored inside a producer. */
  store?: number;
  /** Tile type before `setsTile` changed it; restored on removal. */
  prevTile?: TileId;
}

export type Speed = 0 | 1 | 2 | 4;

/** The whole game. Plain JSON: saving is JSON.stringify. */
export interface GameState {
  version: 1;
  seed: number;
  nextId: number;
  clock: { tick: number; speed: Speed };
  tiles: Record<HexKey, Tile>;
  entities: Record<string, Entity>;
  inventory: Record<ResourceId, number>;
  flags: { fullNotified: Record<string, boolean> };
}

export const SAVE_VERSION = 1;

export function createInitialState(seed: number, reg: Registry): GameState {
  const state: GameState = {
    version: SAVE_VERSION,
    seed,
    nextId: 1,
    clock: { tick: 0, speed: 1 },
    tiles: generateTiles(seed),
    entities: {},
    inventory: {},
    flags: { fullNotified: {} },
  };
  for (const id of reg.resources.keys()) state.inventory[id] = 0;
  for (const [id, amount] of Object.entries(reg.start.inventory)) state.inventory[id] = amount ?? 0;
  for (const s of reg.start.entities) spawnEntity(state, reg, s.def, s.hex);
  return state;
}
```

- [ ] **Step 6: Implement `src/sim/entities.ts`**

```ts
import { hex, hexKey, type Hex } from '../core/hex';
import type { Registry } from '../content/registry';
import type { Entity, GameState } from './state';

/** Creates an entity without charging for it. Callers validate first; violations here are bugs. */
export function spawnEntity(state: GameState, reg: Registry, defId: string, at: Hex): Entity {
  const def = reg.buildable(defId);
  const key = hexKey(at);
  const tile = state.tiles[key];
  if (!tile) throw new Error(`spawnEntity: no tile at ${key}`);
  if (tile.entityId) throw new Error(`spawnEntity: tile ${key} is occupied`);
  const entity: Entity = { id: `e${state.nextId}`, def: defId, hex: hex(at.q, at.r) };
  state.nextId += 1;
  if (def.producer) entity.store = 0;
  if (def.setsTile) {
    entity.prevTile = tile.tile;
    tile.tile = def.setsTile;
  }
  tile.entityId = entity.id;
  state.entities[entity.id] = entity;
  return entity;
}

export function despawnEntity(state: GameState, id: string): Entity {
  const entity = state.entities[id];
  if (!entity) throw new Error(`despawnEntity: unknown entity ${id}`);
  const tile = state.tiles[hexKey(entity.hex)];
  if (tile) {
    delete tile.entityId;
    if (entity.prevTile) tile.tile = entity.prevTile;
  }
  delete state.entities[id];
  delete state.flags.fullNotified[id];
  return entity;
}

export function entitiesWith(state: GameState, reg: Registry, role: 'producer' | 'source'): Entity[] {
  return Object.values(state.entities).filter((e) => reg.buildable(e.def)[role] !== undefined);
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/sim`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/sim/state.ts src/sim/entities.ts src/sim/worldgen.ts tests/sim/helpers.ts tests/sim/state.test.ts
git commit -m "feat(sim): add game state, entity spawning and seeded world generation"
```

---

### Task 7: Clock (`sim/clock`)

**Files:**
- Create: `src/sim/clock.ts`
- Test: `tests/sim/clock.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - Constants: `TICKS_PER_SECOND = 10`, `TICKS_PER_DAY = 600`, `DT_DAYS = 1/600`, `DAYS_PER_SEASON = 28`, `SEASONS = ['spring', 'summer', 'autumn', 'winter']`
  - `type Season`
  - `interface CalendarInfo { day: number; season: Season; year: number; dayProgress: number }`
  - `calendar(tick): CalendarInfo`
  - `isDayStart(tick): boolean`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/sim/clock.test.ts
import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../src/game/loop';
import { DT_DAYS, TICKS_PER_DAY, TICKS_PER_SECOND, calendar, isDayStart } from '../../src/sim/clock';

describe('clock', () => {
  it('agrees with the game loop on tick length', () => {
    expect(1000 / TICKS_PER_SECOND).toBe(TICK_MS);
    expect(TICKS_PER_DAY).toBe(600);
    expect(DT_DAYS * TICKS_PER_DAY).toBeCloseTo(1);
  });

  it('starts on day 1 of spring, year 1', () => {
    expect(calendar(0)).toEqual({ day: 1, season: 'spring', year: 1, dayProgress: 0 });
  });

  it('rolls days, seasons and years', () => {
    expect(calendar(599).day).toBe(1);
    expect(calendar(599).dayProgress).toBeCloseTo(599 / 600);
    expect(calendar(600).day).toBe(2);
    expect(calendar(28 * 600)).toMatchObject({ day: 29, season: 'summer', year: 1 });
    expect(calendar(56 * 600)).toMatchObject({ day: 57, season: 'autumn' });
    expect(calendar(84 * 600)).toMatchObject({ day: 85, season: 'winter' });
    expect(calendar(112 * 600)).toMatchObject({ day: 113, season: 'spring', year: 2 });
  });

  it('detects day boundaries', () => {
    expect(isDayStart(0)).toBe(true);
    expect(isDayStart(600)).toBe(true);
    expect(isDayStart(601)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/sim/clock.test.ts`
Expected: FAIL with `Failed to resolve import "../../src/sim/clock"`.

- [ ] **Step 3: Implement `src/sim/clock.ts`**

```ts
/** Sim ticks per real second at 1x speed. */
export const TICKS_PER_SECOND = 10;
/** One in-game day lasts 60 real seconds at 1x. */
export const TICKS_PER_DAY = 600;
/** In-game days per tick. */
export const DT_DAYS = 1 / TICKS_PER_DAY;
export const DAYS_PER_SEASON = 28;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

export interface CalendarInfo {
  day: number;
  season: Season;
  year: number;
  dayProgress: number;
}

export function calendar(tick: number): CalendarInfo {
  const day = Math.floor(tick / TICKS_PER_DAY) + 1;
  return {
    day,
    season: SEASONS[Math.floor((day - 1) / DAYS_PER_SEASON) % SEASONS.length],
    year: Math.floor((day - 1) / (DAYS_PER_SEASON * SEASONS.length)) + 1,
    dayProgress: (tick % TICKS_PER_DAY) / TICKS_PER_DAY,
  };
}

export function isDayStart(tick: number): boolean {
  return tick % TICKS_PER_DAY === 0;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/sim/clock.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sim/clock.ts tests/sim/clock.test.ts
git commit -m "feat(sim): add tick-based calendar"
```

---

### Task 8: Production and events (`sim/events`, `sim/production`)

**Files:**
- Create: `src/sim/events.ts`, `src/sim/production.ts`
- Test: `tests/sim/production.test.ts`

**Interfaces:**
- Consumes:
  - `hexDistance`
  - `Registry`, `Amounts`, `ResourceId`
  - `GameState`, `Entity`, `Speed`
  - `Season`, `DT_DAYS`
  - `spawnEntity`
- Produces:
  - `sim/events`: `type GameEvent`, a union of:
    - `entityPlaced { entity }`
    - `entityRemoved { entity, refund: Amounts }`
    - `producerFull { id }`
    - `harvested { id?, resource, amount }`
    - `sold { resource, amount, coins }`
    - `dayStarted { day, season, year }`
    - `safetyNetGranted { coins }`
    - `speedChanged { speed }`
  - `sim/production`:
    - `interface SourceShare { sourceId: string; nectarPerDay: number; sharedWith: number }`
    - `interface RangeMap { sharesByProducer: Map<string, SourceShare[]>; producersBySource: Map<string, string[]> }`
    - `buildRangeMap(state, reg): RangeMap`
    - `getRangeMap(state, reg): RangeMap` (memoized per state object; rebuilt only when the set of entity ids changes)
    - `intakePerDay(state, reg, producerId): number`
    - `outputPerDay(state, reg, producerId): number`
    - `productionTick(state, reg, dtDays): GameEvent[]`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/sim/production.test.ts
import { describe, expect, it } from 'vitest';
import { ORIGIN, hex, hexNeighbors } from '../../src/core/hex';
import { DT_DAYS, TICKS_PER_DAY } from '../../src/sim/clock';
import { spawnEntity } from '../../src/sim/entities';
import type { GameEvent } from '../../src/sim/events';
import { getRangeMap, intakePerDay, outputPerDay, productionTick } from '../../src/sim/production';
import { clearEntities, entitiesOf, newGame, reg } from './helpers';

describe('range map', () => {
  it('feeds the starting hive from its three beds', () => {
    const state = newGame(1);
    const [hive] = entitiesOf(state, 'hive');
    const shares = getRangeMap(state, reg).sharesByProducer.get(hive.id)!;
    expect(shares).toHaveLength(3);
    for (const s of shares) expect(s).toMatchObject({ nectarPerDay: 1, sharedWith: 1 });
    expect(intakePerDay(state, reg, hive.id)).toBe(3);
    expect(outputPerDay(state, reg, hive.id)).toBeCloseTo(0.75);
  });

  it('splits a bed equally between the hives in its range', () => {
    const state = newGame(1);
    clearEntities(state);
    const a = spawnEntity(state, reg, 'hive', ORIGIN);
    const b = spawnEntity(state, reg, 'hive', hex(2, -1));
    const bed = spawnEntity(state, reg, 'bed_wildflower', hex(1, 0));
    const map = getRangeMap(state, reg);
    expect(map.producersBySource.get(bed.id)).toEqual([a.id, b.id]);
    expect(map.sharesByProducer.get(a.id)).toEqual([{ sourceId: bed.id, nectarPerDay: 0.5, sharedWith: 2 }]);
    expect(intakePerDay(state, reg, b.id)).toBe(0.5);
  });

  it('ignores beds out of range', () => {
    const state = newGame(1);
    clearEntities(state);
    const hive = spawnEntity(state, reg, 'hive', ORIGIN);
    const bed = spawnEntity(state, reg, 'bed_wildflower', hex(2, 0));
    expect(getRangeMap(state, reg).producersBySource.get(bed.id)).toEqual([]);
    expect(intakePerDay(state, reg, hive.id)).toBe(0);
  });

  it('caps intake at maxIntakePerDay', () => {
    const state = newGame(1);
    clearEntities(state);
    const hive = spawnEntity(state, reg, 'hive', ORIGIN);
    for (const n of hexNeighbors(ORIGIN)) spawnEntity(state, reg, 'bed_wildflower', n);
    expect(intakePerDay(state, reg, hive.id)).toBe(4);
    expect(outputPerDay(state, reg, hive.id)).toBeCloseTo(1);
  });

  it('memoizes until the set of entities changes', () => {
    const state = newGame(1);
    const first = getRangeMap(state, reg);
    expect(getRangeMap(state, reg)).toBe(first);
    spawnEntity(state, reg, 'bed_wildflower', hex(1, -1));
    expect(getRangeMap(state, reg)).not.toBe(first);
  });

  it('returns zero for unknown or non-producer entities', () => {
    const state = newGame(1);
    const [bed] = entitiesOf(state, 'bed_wildflower');
    expect(intakePerDay(state, reg, 'e999')).toBe(0);
    expect(outputPerDay(state, reg, bed.id)).toBe(0);
  });
});

describe('productionTick', () => {
  it('matches the analytic curve over one day of ticks', () => {
    const state = newGame(1);
    const [hive] = entitiesOf(state, 'hive');
    for (let i = 0; i < TICKS_PER_DAY; i++) productionTick(state, reg, DT_DAYS);
    expect(hive.store).toBeCloseTo(0.75, 9);
  });

  it('stalls at capacity and reports full exactly once', () => {
    const state = newGame(1);
    const [hive] = entitiesOf(state, 'hive');
    hive.store = 4.9;
    const events: GameEvent[] = [];
    for (let i = 0; i < 2 * TICKS_PER_DAY; i++) events.push(...productionTick(state, reg, DT_DAYS));
    expect(hive.store).toBe(5);
    expect(events).toEqual([{ type: 'producerFull', id: hive.id }]);
  });

  it('re-arms the full notification once the store drops', () => {
    const state = newGame(1);
    const [hive] = entitiesOf(state, 'hive');
    hive.store = 5;
    expect(productionTick(state, reg, DT_DAYS)).toHaveLength(1);
    hive.store = 0;
    productionTick(state, reg, DT_DAYS);
    expect(state.flags.fullNotified[hive.id]).toBeUndefined();
    hive.store = 5;
    expect(productionTick(state, reg, DT_DAYS)).toEqual([{ type: 'producerFull', id: hive.id }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/sim/production.test.ts`
Expected: FAIL with `Failed to resolve import "../../src/sim/production"`.

- [ ] **Step 3: Implement `src/sim/events.ts`**

```ts
import type { Amounts, ResourceId } from '../content/types';
import type { Season } from './clock';
import type { Entity, Speed } from './state';

export type GameEvent =
  | { type: 'entityPlaced'; entity: Entity }
  | { type: 'entityRemoved'; entity: Entity; refund: Amounts }
  | { type: 'producerFull'; id: string }
  | { type: 'harvested'; id?: string; resource: ResourceId; amount: number }
  | { type: 'sold'; resource: ResourceId; amount: number; coins: number }
  | { type: 'dayStarted'; day: number; season: Season; year: number }
  | { type: 'safetyNetGranted'; coins: number }
  | { type: 'speedChanged'; speed: Speed };
```

- [ ] **Step 4: Implement `src/sim/production.ts`**

```ts
import { hexDistance } from '../core/hex';
import type { Registry } from '../content/registry';
import type { ProducerDef, SourceDef } from '../content/types';
import type { GameEvent } from './events';
import type { Entity, GameState } from './state';

export interface SourceShare {
  sourceId: string;
  /** This producer's slice of the source's daily yield. */
  nectarPerDay: number;
  /** How many producers split this source. */
  sharedWith: number;
}

export interface RangeMap {
  sharesByProducer: Map<string, SourceShare[]>;
  producersBySource: Map<string, string[]>;
}

export function buildRangeMap(state: GameState, reg: Registry): RangeMap {
  const producers: { entity: Entity; def: ProducerDef }[] = [];
  const sources: { entity: Entity; def: SourceDef }[] = [];
  for (const entity of Object.values(state.entities)) {
    const def = reg.buildable(entity.def);
    if (def.producer) producers.push({ entity, def: def.producer });
    if (def.source) sources.push({ entity, def: def.source });
  }

  const sharesByProducer = new Map<string, SourceShare[]>();
  for (const p of producers) sharesByProducer.set(p.entity.id, []);
  const producersBySource = new Map<string, string[]>();

  for (const src of sources) {
    const feeding = producers.filter(
      (p) => p.def.consumes === src.def.kind && hexDistance(p.entity.hex, src.entity.hex) <= p.def.range,
    );
    producersBySource.set(src.entity.id, feeding.map((p) => p.entity.id));
    for (const p of feeding) {
      sharesByProducer.get(p.entity.id)?.push({
        sourceId: src.entity.id,
        nectarPerDay: src.def.yieldPerDay / feeding.length,
        sharedWith: feeding.length,
      });
    }
  }
  return { sharesByProducer, producersBySource };
}

/** Derived data, never saved. Entities never move, so the set of ids fully determines the map. */
const rangeCache = new WeakMap<GameState, { key: string; map: RangeMap }>();

export function getRangeMap(state: GameState, reg: Registry): RangeMap {
  const key = Object.keys(state.entities).join('|');
  const hit = rangeCache.get(state);
  if (hit && hit.key === key) return hit.map;
  const map = buildRangeMap(state, reg);
  rangeCache.set(state, { key, map });
  return map;
}

function producerOf(state: GameState, reg: Registry, id: string): ProducerDef | undefined {
  const entity = state.entities[id];
  return entity ? reg.buildable(entity.def).producer : undefined;
}

export function intakePerDay(state: GameState, reg: Registry, producerId: string): number {
  const producer = producerOf(state, reg, producerId);
  if (!producer) return 0;
  const shares = getRangeMap(state, reg).sharesByProducer.get(producerId) ?? [];
  const total = shares.reduce((sum, s) => sum + s.nectarPerDay, 0);
  return Math.min(total, producer.maxIntakePerDay);
}

export function outputPerDay(state: GameState, reg: Registry, producerId: string): number {
  const producer = producerOf(state, reg, producerId);
  return producer ? intakePerDay(state, reg, producerId) * producer.conversion : 0;
}

/** Advances every producer by dtDays. Mutates state; returns producerFull events. */
export function productionTick(state: GameState, reg: Registry, dtDays: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (const id of getRangeMap(state, reg).sharesByProducer.keys()) {
    const entity = state.entities[id];
    const producer = reg.buildable(entity.def).producer;
    if (!producer) continue;
    const next = Math.min(producer.capacity, (entity.store ?? 0) + outputPerDay(state, reg, id) * dtDays);
    entity.store = next;
    if (next >= producer.capacity) {
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

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/sim/production.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/sim/events.ts src/sim/production.ts tests/sim/production.test.ts
git commit -m "feat(sim): add shared-nectar production with memoized range map"
```

---
### Task 9: Commands and economy basics (`sim/commands`, `sim/economy`)

**Files:**
- Create: `src/sim/economy.ts`, `src/sim/commands.ts`
- Test: `tests/sim/commands.test.ts`

**Interfaces:**
- Consumes:
  - `hexKey`
  - `TILES`, `COINS`, `Registry`
  - `spawnEntity`, `despawnEntity`, `entitiesWith`
  - `GameEvent`, `GameState`, `Speed`
- Produces:
  - `sim/economy`:
    - `REFUND_RATE = 0.5`
    - `canAfford(inventory, cost): boolean`
    - `payCost(inventory, cost): void`
    - `addResources(inventory, amounts): void`
    - `refundFor(def): Amounts`
  - `sim/commands`:
    - `type Command`, a union of:
      - `place { def, hex }`
      - `remove { id }`
      - `harvest { id }`
      - `harvestAll`
      - `sell { resource, amount: number | 'all' }`
      - `setSpeed { speed }`
    - `REJECT_REASONS` (readonly tuple) and `type RejectReason`, which includes `internal_error` (only produced by `game/session`)
    - `type CommandResult = { ok: true; events } | { ok: false; reason }`
    - `validatePlace(state, reg, defId, at): RejectReason | null` (read-only preview for the build ghost)
    - `dispatch(state, reg, cmd): CommandResult`. It mutates state only on success; a rejected command leaves state deep-equal to before.

- [ ] **Step 1: Write the failing tests** (includes Review Focus #1 and #2)

```ts
// tests/sim/commands.test.ts
import { describe, expect, it } from 'vitest';
import { ORIGIN, hex, hexKey, type Hex } from '../../src/core/hex';
import { dispatch, validatePlace, type Command, type CommandResult } from '../../src/sim/commands';
import { spawnEntity } from '../../src/sim/entities';
import type { GameEvent } from '../../src/sim/events';
import type { GameState } from '../../src/sim/state';
import { entitiesOf, newGame, reg } from './helpers';

const NE = hex(1, -1);

function okEvents(result: CommandResult): GameEvent[] {
  if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
  return result.events;
}

function expectRejected(state: GameState, cmd: Command, reason: string): void {
  const before = structuredClone(state);
  expect(dispatch(state, reg, cmd)).toEqual({ ok: false, reason });
  expect(state).toEqual(before);
}

const placeBed = (at: Hex): Command => ({ type: 'place', def: 'bed_wildflower', hex: at });
const sellHoney = (amount: number | 'all'): Command => ({ type: 'sell', resource: 'honey_wildflower', amount });

describe('place', () => {
  it('buys and places a bed on free owned grass', () => {
    const state = newGame(1);
    const events = okEvents(dispatch(state, reg, placeBed(NE)));
    const tile = state.tiles[hexKey(NE)];
    const placed = state.entities[tile.entityId!];
    expect(state.inventory.coins).toBe(40);
    expect(tile.tile).toBe('soil');
    expect(placed.def).toBe('bed_wildflower');
    expect(events).toEqual([{ type: 'entityPlaced', entity: placed }]);
  });

  it.each([
    ['unknown_def', 'castle', NE],
    ['not_purchasable', 'house', NE],
    ['out_of_bounds', 'bed_wildflower', hex(40, 0)],
    ['not_owned', 'bed_wildflower', hex(5, 0)],
    ['tile_occupied', 'bed_wildflower', ORIGIN],
  ] as const)('rejects %s and leaves state untouched', (reason, def, at) => {
    expectRejected(newGame(1), { type: 'place', def, hex: at }, reason);
  });

  it('rejects water, decor and disallowed tile types as tile_not_buildable', () => {
    const state = newGame(1);
    const tile = state.tiles[hexKey(NE)];
    tile.tile = 'water';
    expectRejected(state, placeBed(NE), 'tile_not_buildable');
    tile.tile = 'grass';
    tile.decor = 'tree';
    expectRejected(state, placeBed(NE), 'tile_not_buildable');
    delete tile.decor;
    tile.tile = 'soil'; // buildable tile, but beds only allow grass
    expectRejected(state, placeBed(NE), 'tile_not_buildable');
  });

  it('rejects when coins are short', () => {
    const state = newGame(1);
    state.inventory.coins = 19;
    expectRejected(state, placeBed(NE), 'insufficient_funds');
  });

  it('charges once when the same hex is clicked twice', () => {
    const state = newGame(1);
    expect(dispatch(state, reg, placeBed(NE)).ok).toBe(true);
    expect(dispatch(state, reg, placeBed(NE))).toEqual({ ok: false, reason: 'tile_occupied' });
    expect(state.inventory.coins).toBe(40);
  });

  it('works while paused', () => {
    const state = newGame(1);
    state.clock.speed = 0;
    expect(dispatch(state, reg, placeBed(NE)).ok).toBe(true);
  });

  it('validatePlace previews without changing anything', () => {
    const state = newGame(1);
    const before = structuredClone(state);
    expect(validatePlace(state, reg, 'bed_wildflower', NE)).toBeNull();
    expect(validatePlace(state, reg, 'hive', NE)).toBe('insufficient_funds');
    expect(state).toEqual(before);
  });
});

describe('remove', () => {
  it('removes a bed, refunds half its cost and restores grass', () => {
    const state = newGame(1);
    const [bed] = entitiesOf(state, 'bed_wildflower');
    const events = okEvents(dispatch(state, reg, { type: 'remove', id: bed.id }));
    expect(events).toEqual([{ type: 'entityRemoved', entity: bed, refund: { coins: 10 } }]);
    expect(state.inventory.coins).toBe(70);
    expect(state.tiles[hexKey(bed.hex)].tile).toBe('grass');
    expect(state.entities[bed.id]).toBeUndefined();
  });

  it('rejects unknown, unremovable and last-producer removals', () => {
    const state = newGame(1);
    expectRejected(state, { type: 'remove', id: 'e999' }, 'unknown_entity');
    expectRejected(state, { type: 'remove', id: entitiesOf(state, 'house')[0].id }, 'not_removable');
    expectRejected(state, { type: 'remove', id: entitiesOf(state, 'hive')[0].id }, 'last_producer');
  });

  it('keeps stored honey when a hive is removed', () => {
    const state = newGame(1);
    const [first] = entitiesOf(state, 'hive');
    first.store = 2.5;
    spawnEntity(state, reg, 'hive', hex(2, -1));
    const events = okEvents(dispatch(state, reg, { type: 'remove', id: first.id }));
    expect(events.map((e) => e.type)).toEqual(['harvested', 'entityRemoved']);
    expect(state.inventory.honey_wildflower).toBe(2.5);
    expect(state.inventory.coins).toBe(120);
  });
});

describe('harvest', () => {
  it('moves a producer store into the inventory and clears the full flag', () => {
    const state = newGame(1);
    const [hive] = entitiesOf(state, 'hive');
    hive.store = 2.5;
    state.flags.fullNotified[hive.id] = true;
    const events = okEvents(dispatch(state, reg, { type: 'harvest', id: hive.id }));
    expect(events).toEqual([{ type: 'harvested', id: hive.id, resource: 'honey_wildflower', amount: 2.5 }]);
    expect(hive.store).toBe(0);
    expect(state.inventory.honey_wildflower).toBe(2.5);
    expect(state.flags.fullNotified[hive.id]).toBeUndefined();
  });

  it('rejects empty stores, non-producers and unknown ids', () => {
    const state = newGame(1);
    expectRejected(state, { type: 'harvest', id: entitiesOf(state, 'hive')[0].id }, 'nothing_to_harvest');
    expectRejected(state, { type: 'harvest', id: entitiesOf(state, 'bed_wildflower')[0].id }, 'nothing_to_harvest');
    expectRejected(state, { type: 'harvest', id: 'e999' }, 'unknown_entity');
  });

  it('harvestAll empties every producer into one event per resource', () => {
    const state = newGame(1);
    const [a] = entitiesOf(state, 'hive');
    const b = spawnEntity(state, reg, 'hive', hex(2, -1));
    a.store = 1.25;
    b.store = 2;
    const events = okEvents(dispatch(state, reg, { type: 'harvestAll' }));
    expect(events).toEqual([{ type: 'harvested', resource: 'honey_wildflower', amount: 3.25 }]);
    expect([a.store, b.store]).toEqual([0, 0]);
    expect(state.inventory.honey_wildflower).toBe(3.25);
  });

  it('harvestAll rejects when every store is empty', () => {
    expectRejected(newGame(1), { type: 'harvestAll' }, 'nothing_to_harvest');
  });
});

describe('sell', () => {
  it('sells an amount at the listed price', () => {
    const state = newGame(1);
    state.inventory.honey_wildflower = 3.5;
    const events = okEvents(dispatch(state, reg, sellHoney(2)));
    expect(events).toEqual([{ type: 'sold', resource: 'honey_wildflower', amount: 2, coins: 30 }]);
    expect(state.inventory.coins).toBe(90);
    expect(state.inventory.honey_wildflower).toBe(1.5);
  });

  it("sells everything with 'all'", () => {
    const state = newGame(1);
    state.inventory.honey_wildflower = 3.5;
    okEvents(dispatch(state, reg, sellHoney('all')));
    expect(state.inventory.coins).toBe(112.5);
    expect(state.inventory.honey_wildflower).toBe(0);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects amount %s as invalid_amount', (amount) => {
    const state = newGame(1);
    state.inventory.honey_wildflower = 3;
    expectRejected(state, sellHoney(amount), 'invalid_amount');
  });

  it('rejects selling more than you have', () => {
    const state = newGame(1);
    state.inventory.honey_wildflower = 1;
    expectRejected(state, sellHoney(2), 'insufficient_resource');
    state.inventory.honey_wildflower = 0;
    expectRejected(state, sellHoney('all'), 'insufficient_resource');
  });

  it('rejects resources the market does not buy', () => {
    expectRejected(newGame(1), { type: 'sell', resource: 'coins', amount: 1 }, 'not_sellable');
  });

  it('absorbs float noise and never leaves a negative remainder', () => {
    const state = newGame(1);
    state.inventory.honey_wildflower = 0.1 + 0.2; // 0.30000000000000004
    expect(dispatch(state, reg, sellHoney(0.3)).ok).toBe(true);
    expect(state.inventory.honey_wildflower).toBe(0);
    state.inventory.honey_wildflower = 2;
    expect(dispatch(state, reg, sellHoney(2 + 1e-9)).ok).toBe(true);
    expect(state.inventory.honey_wildflower).toBe(0);
  });
});

describe('setSpeed', () => {
  it('changes the speed', () => {
    const state = newGame(1);
    expect(okEvents(dispatch(state, reg, { type: 'setSpeed', speed: 4 }))).toEqual([{ type: 'speedChanged', speed: 4 }]);
    expect(state.clock.speed).toBe(4);
  });

  it('rejects unknown speeds', () => {
    expectRejected(newGame(1), { type: 'setSpeed', speed: 3 as never }, 'invalid_speed');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/sim/commands.test.ts`
Expected: FAIL with `Failed to resolve import "../../src/sim/commands"`.

- [ ] **Step 3: Implement `src/sim/economy.ts`**

```ts
import type { Amounts, BuildableDef, ResourceId } from '../content/types';

export const REFUND_RATE = 0.5;

type Inventory = Record<ResourceId, number>;

export function canAfford(inventory: Inventory, cost: Amounts): boolean {
  return Object.entries(cost).every(([res, amount]) => (inventory[res] ?? 0) >= (amount ?? 0));
}

export function payCost(inventory: Inventory, cost: Amounts): void {
  for (const [res, amount] of Object.entries(cost)) inventory[res] = (inventory[res] ?? 0) - (amount ?? 0);
}

export function addResources(inventory: Inventory, amounts: Amounts): void {
  for (const [res, amount] of Object.entries(amounts)) inventory[res] = (inventory[res] ?? 0) + (amount ?? 0);
}

export function refundFor(def: BuildableDef): Amounts {
  const refund: Amounts = {};
  for (const [res, amount] of Object.entries(def.cost)) {
    const back = Math.floor((amount ?? 0) * REFUND_RATE);
    if (back > 0) refund[res] = back;
  }
  return refund;
}
```

- [ ] **Step 4: Implement `src/sim/commands.ts`**

```ts
import { hexKey, type Hex } from '../core/hex';
import type { Registry } from '../content/registry';
import { TILES } from '../content/tiles';
import { COINS, type ResourceId } from '../content/types';
import { addResources, canAfford, payCost, refundFor } from './economy';
import { despawnEntity, entitiesWith, spawnEntity } from './entities';
import type { GameEvent } from './events';
import type { GameState, Speed } from './state';

export type Command =
  | { type: 'place'; def: string; hex: Hex }
  | { type: 'remove'; id: string }
  | { type: 'harvest'; id: string }
  | { type: 'harvestAll' }
  | { type: 'sell'; resource: ResourceId; amount: number | 'all' }
  | { type: 'setSpeed'; speed: Speed };

export const REJECT_REASONS = [
  'unknown_def',
  'not_purchasable',
  'out_of_bounds',
  'not_owned',
  'tile_occupied',
  'tile_not_buildable',
  'insufficient_funds',
  'unknown_entity',
  'not_removable',
  'last_producer',
  'nothing_to_harvest',
  'invalid_amount',
  'insufficient_resource',
  'not_sellable',
  'invalid_speed',
  /** Only produced by game/session when the sim throws in a production build. */
  'internal_error',
] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

export type CommandResult = { ok: true; events: GameEvent[] } | { ok: false; reason: RejectReason };

const SPEEDS: readonly Speed[] = [0, 1, 2, 4];
/** Tolerance for float noise in resource amounts. */
const EPSILON = 1e-6;

const ok = (events: GameEvent[]): CommandResult => ({ ok: true, events });
const fail = (reason: RejectReason): CommandResult => ({ ok: false, reason });

/** Why a placement would fail, or null if it would succeed. Never mutates. */
export function validatePlace(state: GameState, reg: Registry, defId: string, at: Hex): RejectReason | null {
  const def = reg.findBuildable(defId);
  if (!def) return 'unknown_def';
  if (!def.purchasable) return 'not_purchasable';
  const tile = state.tiles[hexKey(at)];
  if (!tile) return 'out_of_bounds';
  if (!tile.owned) return 'not_owned';
  if (tile.entityId) return 'tile_occupied';
  if (tile.decor || !TILES[tile.tile].buildable || !def.allowedTiles.includes(tile.tile)) return 'tile_not_buildable';
  if (!canAfford(state.inventory, def.cost)) return 'insufficient_funds';
  return null;
}

/** The only way the player changes the game. Validates first, then mutates. */
export function dispatch(state: GameState, reg: Registry, cmd: Command): CommandResult {
  switch (cmd.type) {
    case 'place':
      return place(state, reg, cmd.def, cmd.hex);
    case 'remove':
      return remove(state, reg, cmd.id);
    case 'harvest':
      return harvest(state, reg, cmd.id);
    case 'harvestAll':
      return harvestAll(state, reg);
    case 'sell':
      return sell(state, reg, cmd.resource, cmd.amount);
    case 'setSpeed':
      return setSpeed(state, cmd.speed);
  }
}

function place(state: GameState, reg: Registry, defId: string, at: Hex): CommandResult {
  const reason = validatePlace(state, reg, defId, at);
  if (reason) return fail(reason);
  const def = reg.buildable(defId);
  payCost(state.inventory, def.cost);
  const entity = spawnEntity(state, reg, defId, at);
  return ok([{ type: 'entityPlaced', entity: { ...entity } }]);
}

function remove(state: GameState, reg: Registry, id: string): CommandResult {
  const entity = state.entities[id];
  if (!entity) return fail('unknown_entity');
  const def = reg.buildable(entity.def);
  if (!def.removable) return fail('not_removable');
  if (def.producer && entitiesWith(state, reg, 'producer').length <= 1) return fail('last_producer');

  const events: GameEvent[] = [];
  const stored = entity.store ?? 0;
  if (def.producer && stored > 0) {
    addResources(state.inventory, { [def.producer.output]: stored });
    events.push({ type: 'harvested', id, resource: def.producer.output, amount: stored });
  }
  const refund = refundFor(def);
  addResources(state.inventory, refund);
  const removed = despawnEntity(state, id);
  events.push({ type: 'entityRemoved', entity: { ...removed }, refund });
  return ok(events);
}

function harvest(state: GameState, reg: Registry, id: string): CommandResult {
  const entity = state.entities[id];
  if (!entity) return fail('unknown_entity');
  const producer = reg.buildable(entity.def).producer;
  const amount = entity.store ?? 0;
  if (!producer || amount <= 0) return fail('nothing_to_harvest');
  entity.store = 0;
  delete state.flags.fullNotified[id];
  addResources(state.inventory, { [producer.output]: amount });
  return ok([{ type: 'harvested', id, resource: producer.output, amount }]);
}

function harvestAll(state: GameState, reg: Registry): CommandResult {
  const totals = new Map<ResourceId, number>();
  for (const entity of entitiesWith(state, reg, 'producer')) {
    const amount = entity.store ?? 0;
    const producer = reg.buildable(entity.def).producer;
    if (!producer || amount <= 0) continue;
    totals.set(producer.output, (totals.get(producer.output) ?? 0) + amount);
    entity.store = 0;
    delete state.flags.fullNotified[entity.id];
  }
  if (totals.size === 0) return fail('nothing_to_harvest');
  const events: GameEvent[] = [];
  for (const [resource, amount] of totals) {
    addResources(state.inventory, { [resource]: amount });
    events.push({ type: 'harvested', resource, amount });
  }
  return ok(events);
}

function sell(state: GameState, reg: Registry, resource: ResourceId, amount: number | 'all'): CommandResult {
  const price = reg.price(resource);
  if (!price) return fail('not_sellable');
  const have = state.inventory[resource] ?? 0;
  let qty: number;
  if (amount === 'all') {
    if (have <= 0) return fail('insufficient_resource');
    qty = have;
  } else {
    if (!Number.isFinite(amount) || amount <= 0) return fail('invalid_amount');
    if (amount > have + EPSILON) return fail('insufficient_resource');
    qty = Math.min(amount, have);
  }
  const coins = qty * price.sell;
  const left = have - qty;
  state.inventory[resource] = left < EPSILON ? 0 : left;
  addResources(state.inventory, { [COINS]: coins });
  return ok([{ type: 'sold', resource, amount: qty, coins }]);
}

function setSpeed(state: GameState, speed: Speed): CommandResult {
  if (!SPEEDS.includes(speed)) return fail('invalid_speed');
  state.clock.speed = speed;
  return ok([{ type: 'speedChanged', speed }]);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/sim/commands.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/sim/economy.ts src/sim/commands.ts tests/sim/commands.test.ts
git commit -m "feat(sim): add validated commands for place, remove, harvest, sell and speed"
```

---

### Task 10: Advance, safety net and determinism (`sim/advance`, `sim/economy`)

**Files:**
- Create: `src/sim/advance.ts`
- Modify: `src/sim/economy.ts` (full replacement below; adds `totalOutputPerDay`, `goodsOnHand`, `applySafetyNet`)
- Test: `tests/sim/advance.test.ts`

**Interfaces:**
- Consumes: `productionTick`, `outputPerDay`, `calendar`, `isDayStart`, `DT_DAYS`, `entitiesWith`, `COINS`, `Registry`
- Produces:
  - `advance(state, reg, ticks): GameEvent[]`. Per tick, in this order:
    1. production
    2. `tick += 1`
    3. on a day boundary: `dayStarted`, then the safety net
  - `totalOutputPerDay(state, reg): number`
  - `goodsOnHand(state, reg): number` (producer stores + priced inventory)
  - `applySafetyNet(state, reg): GameEvent | null`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/sim/advance.test.ts
import { describe, expect, it } from 'vitest';
import { ORIGIN, hex } from '../../src/core/hex';
import { advance } from '../../src/sim/advance';
import { TICKS_PER_DAY } from '../../src/sim/clock';
import { dispatch, type Command } from '../../src/sim/commands';
import { spawnEntity } from '../../src/sim/entities';
import { clearEntities, entitiesOf, newGame, reg } from './helpers';

describe('advance', () => {
  it('runs ticks, fills hives and announces the new day', () => {
    const state = newGame(1);
    const [hive] = entitiesOf(state, 'hive');
    const events = advance(state, reg, TICKS_PER_DAY);
    expect(state.clock.tick).toBe(600);
    expect(hive.store).toBeCloseTo(0.75, 9);
    expect(events).toEqual([{ type: 'dayStarted', day: 2, season: 'spring', year: 1 }]);
  });

  it('reports a hive filling up exactly once', () => {
    const state = newGame(1);
    const events = advance(state, reg, 7 * TICKS_PER_DAY);
    expect(events.filter((e) => e.type === 'producerFull')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'dayStarted')).toHaveLength(7);
  });

  it('does nothing for zero ticks', () => {
    const state = newGame(1);
    expect(advance(state, reg, 0)).toEqual([]);
    expect(state.clock.tick).toBe(0);
  });
});

describe('safety net', () => {
  function stuckGame() {
    const state = newGame(1);
    clearEntities(state);
    spawnEntity(state, reg, 'hive', ORIGIN);
    state.inventory.coins = 5;
    return state;
  }

  it('tops coins up to the cheapest source when the player is stuck', () => {
    const state = stuckGame();
    const events = advance(state, reg, TICKS_PER_DAY);
    expect(state.inventory.coins).toBe(20);
    expect(events).toContainEqual({ type: 'safetyNetGranted', coins: 15 });
  });

  it('stays out of the way whenever the player can still recover', () => {
    const withCoins = stuckGame();
    withCoins.inventory.coins = 20;
    const withHoney = stuckGame();
    withHoney.inventory.honey_wildflower = 0.5;
    const producing = stuckGame();
    spawnEntity(producing, reg, 'bed_wildflower', hex(1, 0));
    for (const [state, coins] of [[withCoins, 20], [withHoney, 5], [producing, 5]] as const) {
      const events = advance(state, reg, TICKS_PER_DAY);
      expect(events.some((e) => e.type === 'safetyNetGranted')).toBe(false);
      expect(state.inventory.coins).toBe(coins);
    }
  });
});

describe('determinism', () => {
  it('replays the same command log to the same state', () => {
    const log: { tick: number; cmd: Command }[] = [
      { tick: 0, cmd: { type: 'place', def: 'bed_wildflower', hex: hex(1, -1) } },
      { tick: 1500, cmd: { type: 'harvestAll' } },
      { tick: 1501, cmd: { type: 'sell', resource: 'honey_wildflower', amount: 'all' } },
      { tick: 2400, cmd: { type: 'setSpeed', speed: 4 } },
    ];
    const run = () => {
      const state = newGame(7);
      for (const { tick, cmd } of log) {
        advance(state, reg, tick - state.clock.tick);
        dispatch(state, reg, cmd);
      }
      advance(state, reg, 6000 - state.clock.tick);
      return JSON.stringify(state);
    };
    expect(run()).toBe(run());
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/sim/advance.test.ts`
Expected: FAIL with `Failed to resolve import "../../src/sim/advance"`.

- [ ] **Step 3: Replace `src/sim/economy.ts` with the full version**

```ts
import type { Registry } from '../content/registry';
import { COINS, type Amounts, type BuildableDef, type ResourceId } from '../content/types';
import { entitiesWith } from './entities';
import type { GameEvent } from './events';
import { outputPerDay } from './production';
import type { GameState } from './state';

export const REFUND_RATE = 0.5;

type Inventory = Record<ResourceId, number>;

export function canAfford(inventory: Inventory, cost: Amounts): boolean {
  return Object.entries(cost).every(([res, amount]) => (inventory[res] ?? 0) >= (amount ?? 0));
}

export function payCost(inventory: Inventory, cost: Amounts): void {
  for (const [res, amount] of Object.entries(cost)) inventory[res] = (inventory[res] ?? 0) - (amount ?? 0);
}

export function addResources(inventory: Inventory, amounts: Amounts): void {
  for (const [res, amount] of Object.entries(amounts)) inventory[res] = (inventory[res] ?? 0) + (amount ?? 0);
}

export function refundFor(def: BuildableDef): Amounts {
  const refund: Amounts = {};
  for (const [res, amount] of Object.entries(def.cost)) {
    const back = Math.floor((amount ?? 0) * REFUND_RATE);
    if (back > 0) refund[res] = back;
  }
  return refund;
}

export function totalOutputPerDay(state: GameState, reg: Registry): number {
  return entitiesWith(state, reg, 'producer').reduce((sum, e) => sum + outputPerDay(state, reg, e.id), 0);
}

/** Everything the player could still turn into coins: producer stores plus priced inventory. */
export function goodsOnHand(state: GameState, reg: Registry): number {
  let total = 0;
  for (const e of entitiesWith(state, reg, 'producer')) total += e.store ?? 0;
  for (const [res, amount] of Object.entries(state.inventory)) if (reg.price(res)) total += amount;
  return total;
}

/**
 * Dead-end guard (spec §5.8): with no production, nothing to sell and too few coins for the
 * cheapest source, top coins up to that cost.
 */
export function applySafetyNet(state: GameState, reg: Registry): GameEvent | null {
  const cheapest = reg.cheapestSourceCost();
  if (!Number.isFinite(cheapest)) return null;
  const coins = state.inventory[COINS] ?? 0;
  if (coins >= cheapest) return null;
  if (totalOutputPerDay(state, reg) > 0) return null;
  if (goodsOnHand(state, reg) > 0) return null;
  state.inventory[COINS] = cheapest;
  return { type: 'safetyNetGranted', coins: cheapest - coins };
}
```

- [ ] **Step 4: Implement `src/sim/advance.ts`**

```ts
import type { Registry } from '../content/registry';
import { DT_DAYS, calendar, isDayStart } from './clock';
import { applySafetyNet } from './economy';
import type { GameEvent } from './events';
import { productionTick } from './production';
import type { GameState } from './state';

/** Runs `ticks` fixed sim steps. Deterministic; mutates state; no I/O. Speed is the loop's concern. */
export function advance(state: GameState, reg: Registry, ticks: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    events.push(...productionTick(state, reg, DT_DAYS));
    state.clock.tick += 1;
    if (isDayStart(state.clock.tick)) {
      const { day, season, year } = calendar(state.clock.tick);
      events.push({ type: 'dayStarted', day, season, year });
      const grant = applySafetyNet(state, reg);
      if (grant) events.push(grant);
    }
  }
  return events;
}
```

- [ ] **Step 5: Run the sim tests**

Run: `npx vitest run tests/sim`
Expected: PASS (commands tests still pass with the replaced `economy.ts`).

- [ ] **Step 6: Commit**

```bash
git add src/sim/advance.ts src/sim/economy.ts tests/sim/advance.test.ts
git commit -m "feat(sim): add tick advance with day events and dead-end safety net"
```

---

### Task 11: Save, load and migrations (`game/save`)

**Files:**
- Create: `src/game/save.ts`, `tests/fixtures/save-v1.json`
- Test: `tests/game/save.test.ts`

**Interfaces:**
- Consumes: `GameState`, `SAVE_VERSION`, `Registry`
- Produces:
  - `interface SaveStorage { getItem(key): string | null; setItem(key, value): void; removeItem(key): void }`
  - `SAVE_KEY = 'hive-foundation.save'`
  - `type LoadResult`, a union of:
    - `{ status: 'loaded'; state }`
    - `{ status: 'empty' }`
    - `{ status: 'unavailable' }`
    - `{ status: 'corrupt'; backupKey: string | null; error: string }`
  - `serialize(state): string`
  - `deserialize(raw, reg): GameState` (throws when invalid)
  - `loadGame(storage, reg, now?): LoadResult`
  - `saveGame(storage, state): boolean`
  - `clearSave(storage): void`
  - `browserStorage(): SaveStorage | null`

- [ ] **Step 1: Create the v1 fixture** (`tests/fixtures/save-v1.json`)

```json
{
  "version": 1,
  "seed": 7,
  "nextId": 3,
  "clock": { "tick": 1234, "speed": 2 },
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
  "flags": { "fullNotified": {} }
}
```

- [ ] **Step 2: Write the failing tests** (includes Review Focus #4)

```ts
// tests/game/save.test.ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hex } from '../../src/core/hex';
import {
  SAVE_KEY, clearSave, deserialize, loadGame, saveGame, serialize, type SaveStorage,
} from '../../src/game/save';
import { advance } from '../../src/sim/advance';
import { dispatch } from '../../src/sim/commands';
import type { GameState } from '../../src/sim/state';
import { newGame, reg } from '../sim/helpers';

class MemoryStorage implements SaveStorage {
  readonly data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

describe('save / load', () => {
  it('round-trips a game in progress', () => {
    const state = newGame(3);
    advance(state, reg, 1234);
    dispatch(state, reg, { type: 'place', def: 'bed_wildflower', hex: hex(1, -1) });
    const storage = new MemoryStorage();
    expect(saveGame(storage, state)).toBe(true);
    expect(loadGame(storage, reg)).toEqual({ status: 'loaded', state });
  });

  it('reports an empty slot', () => {
    expect(loadGame(new MemoryStorage(), reg)).toEqual({ status: 'empty' });
  });

  it('backs up and rejects corrupt JSON', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, '{not json');
    const result = loadGame(storage, reg, 1_700_000_000_000);
    expect(result).toMatchObject({ status: 'corrupt', backupKey: 'save_backup_1700000000000' });
    expect(storage.getItem('save_backup_1700000000000')).toBe('{not json');
  });

  const mutations: [string, (s: GameState) => unknown][] = [
    ['a newer version', (s) => ({ ...s, version: 2 })],
    ['a missing clock', (s) => {
      const copy: Partial<GameState> = structuredClone(s);
      delete copy.clock;
      return copy;
    }],
    ['an unknown building', (s) => ({ ...s, entities: { ...s.entities, e1: { ...s.entities.e1, def: 'castle' } } })],
    ['a non-object', () => 42],
  ];

  it.each(mutations)('treats a save with %s as corrupt, never crashing', (_label, mutate) => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify(mutate(newGame(1))));
    const result = loadGame(storage, reg, 5);
    expect(result.status).toBe('corrupt');
    expect(storage.getItem('save_backup_5')).not.toBeNull();
  });

  it('reports storage that refuses access', () => {
    const denied: SaveStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(loadGame(denied, reg)).toEqual({ status: 'unavailable' });
    expect(saveGame(denied, newGame(1))).toBe(false);
    expect(() => clearSave(denied)).not.toThrow();
  });

  it('clearSave removes the slot', () => {
    const storage = new MemoryStorage();
    saveGame(storage, newGame(1));
    clearSave(storage);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });

  it('loads the checked-in v1 fixture', () => {
    const raw = readFileSync(new URL('../fixtures/save-v1.json', import.meta.url), 'utf8');
    const state = deserialize(raw, reg);
    expect(state.clock).toEqual({ tick: 1234, speed: 2 });
    expect(state.entities.e1.store).toBe(1.5);
    expect(state.inventory.coins).toBe(42);
    expect(serialize(state)).toBe(JSON.stringify(JSON.parse(raw)));
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/game/save.test.ts`
Expected: FAIL with `Failed to resolve import "../../src/game/save"`.

- [ ] **Step 4: Implement `src/game/save.ts`**

```ts
import type { Registry } from '../content/registry';
import { SAVE_VERSION, type GameState } from '../sim/state';

export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SAVE_KEY = 'hive-foundation.save';

export type LoadResult =
  | { status: 'loaded'; state: GameState }
  | { status: 'empty' }
  | { status: 'unavailable' }
  | { status: 'corrupt'; backupKey: string | null; error: string };

type Json = Record<string, unknown>;

/** Upgraders from save version N to N+1. Empty until the save format changes. */
const MIGRATIONS: Record<number, (data: Json) => Json> = {};

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(raw: string, reg: Registry): GameState {
  let data: unknown = JSON.parse(raw);
  if (!isObject(data) || typeof data.version !== 'number') throw new Error('Save has no version');
  let version = data.version;
  if (version > SAVE_VERSION) throw new Error(`Save version ${version} is newer than this game (${SAVE_VERSION})`);
  while (version < SAVE_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) throw new Error(`No migration from save version ${version}`);
    data = migrate(data as Json);
    version += 1;
  }
  assertGameState(data, reg);
  return data;
}

function assertGameState(data: unknown, reg: Registry): asserts data is GameState {
  if (!isObject(data)) throw new Error('Save is not an object');
  if (typeof data.seed !== 'number' || typeof data.nextId !== 'number') throw new Error('Save is missing seed or nextId');
  const clock = data.clock;
  if (!isObject(clock) || typeof clock.tick !== 'number' || typeof clock.speed !== 'number') {
    throw new Error('Save has an invalid clock');
  }
  const { tiles, entities, inventory, flags } = data;
  if (!isObject(tiles) || !isObject(entities) || !isObject(inventory) || !isObject(flags)) {
    throw new Error('Save is missing tiles, entities, inventory or flags');
  }
  for (const e of Object.values(entities)) {
    if (!isObject(e) || typeof e.def !== 'string' || !reg.findBuildable(e.def)) {
      throw new Error(`Save references an unknown building: ${JSON.stringify(e)}`);
    }
  }
}

export function loadGame(storage: SaveStorage, reg: Registry, now = Date.now()): LoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return { status: 'unavailable' };
  }
  if (raw === null) return { status: 'empty' };
  try {
    return { status: 'loaded', state: deserialize(raw, reg) };
  } catch (err) {
    const backupKey = `save_backup_${now}`;
    try {
      storage.setItem(backupKey, raw);
      return { status: 'corrupt', backupKey, error: String(err) };
    } catch {
      return { status: 'corrupt', backupKey: null, error: String(err) };
    }
  }
}

/** False when storage is unavailable or full. */
export function saveGame(storage: SaveStorage, state: GameState): boolean {
  try {
    storage.setItem(SAVE_KEY, serialize(state));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage: SaveStorage): void {
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    // Storage is unavailable: there is nothing we can clear.
  }
}

/** localStorage, or null where the browser forbids it (some private modes, sandboxed iframes). */
export function browserStorage(): SaveStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/game/save.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/save.ts tests/game/save.test.ts tests/fixtures/save-v1.json
git commit -m "feat(game): add versioned save/load with corrupt-save backup"
```

---

### Task 12: Balance bot and dead-end fuzz

**Files:**
- Test: `tests/sim/balance.test.ts`
- Modify only if the bot fails: `src/content/packs/bees.ts` (numbers only). Record any change in the spec's §5.9 table in the same commit.

**Interfaces:**
- Consumes: `advance`, `dispatch`, `validatePlace`, `entitiesWith`, `intakePerDay`, `totalOutputPerDay`, `goodsOnHand`, `TICKS_PER_DAY`, `mulberry32`, `pick`, `parseHexKey`, `hexNeighbors`, `COINS`
- Produces: the pacing guarantee from spec §1 (a second hive is affordable in 3–6 in-game days) and the no-dead-end guarantee.

- [ ] **Step 1: Write the tests**

```ts
// tests/sim/balance.test.ts
import { describe, expect, it } from 'vitest';
import { hexNeighbors, parseHexKey } from '../../src/core/hex';
import { mulberry32, pick } from '../../src/core/rng';
import { COINS } from '../../src/content/types';
import { advance } from '../../src/sim/advance';
import { TICKS_PER_DAY } from '../../src/sim/clock';
import { dispatch, validatePlace } from '../../src/sim/commands';
import { goodsOnHand, totalOutputPerDay } from '../../src/sim/economy';
import { entitiesWith } from '../../src/sim/entities';
import { intakePerDay } from '../../src/sim/production';
import type { GameState } from '../../src/sim/state';
import { newGame, reg } from './helpers';

const CHUNK = TICKS_PER_DAY / 10; // bot acts every 0.1 in-game day (6 real seconds at 1x)

/** Greedy player: harvest, sell, then give every hive enough beds to hit its intake cap. */
function botTurn(state: GameState): void {
  dispatch(state, reg, { type: 'harvestAll' });
  dispatch(state, reg, { type: 'sell', resource: 'honey_wildflower', amount: 'all' });
  for (const hive of entitiesWith(state, reg, 'producer')) {
    const max = reg.buildable(hive.def).producer!.maxIntakePerDay;
    for (const n of hexNeighbors(hive.hex)) {
      if (intakePerDay(state, reg, hive.id) >= max) break;
      if (validatePlace(state, reg, 'bed_wildflower', n) === null) {
        dispatch(state, reg, { type: 'place', def: 'bed_wildflower', hex: n });
      }
    }
  }
}

describe('balance', () => {
  it('lets a greedy player afford a second hive within 3–6 in-game days', () => {
    const state = newGame(42);
    const hiveCost = reg.buildable('hive').cost[COINS]!;
    let affordableAtDay: number | null = null;
    for (let chunk = 0; chunk < 30 * 10; chunk++) {
      botTurn(state);
      if ((state.inventory[COINS] ?? 0) >= hiveCost) {
        affordableAtDay = state.clock.tick / TICKS_PER_DAY;
        break;
      }
      advance(state, reg, CHUNK);
    }
    expect(affordableAtDay).not.toBeNull();
    expect(affordableAtDay!).toBeGreaterThanOrEqual(3);
    expect(affordableAtDay!).toBeLessThanOrEqual(6);
  });
});

describe('no dead ends', () => {
  const isRecoverable = (state: GameState) =>
    totalOutputPerDay(state, reg) > 0 ||
    goodsOnHand(state, reg) > 0 ||
    (state.inventory[COINS] ?? 0) >= reg.cheapestSourceCost();

  it('random play for 30 days never leaves the player stuck', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const state = newGame(seed);
      const rng = mulberry32(seed * 7919);
      const owned = Object.entries(state.tiles).filter(([, t]) => t.owned).map(([k]) => parseHexKey(k));
      const defs = reg.purchasable().map((b) => b.id);
      for (let chunk = 0; chunk < 30 * 10; chunk++) {
        const roll = rng();
        if (roll < 0.35) {
          dispatch(state, reg, { type: 'place', def: pick(rng, defs), hex: pick(rng, owned) });
        } else if (roll < 0.55) {
          const ids = Object.keys(state.entities);
          if (ids.length > 0) dispatch(state, reg, { type: 'remove', id: pick(rng, ids) });
        } else if (roll < 0.7) {
          dispatch(state, reg, { type: 'harvestAll' });
        } else if (roll < 0.85) {
          dispatch(state, reg, { type: 'sell', resource: 'honey_wildflower', amount: 'all' });
        }
        const events = advance(state, reg, CHUNK);
        if (events.some((e) => e.type === 'dayStarted')) {
          expect(isRecoverable(state), `seed ${seed}, day ${state.clock.tick / TICKS_PER_DAY}`).toBe(true);
        }
        expect(entitiesWith(state, reg, 'producer').length).toBeGreaterThan(0);
        expect(state.inventory[COINS]).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run tests/sim/balance.test.ts`
Expected: PASS.

The bot buys a 4th bed at once (40 coins left). It then earns 1 kg/day × 15 = 15 coins/day, so 120 coins arrive at about day 5.4.

If the pacing assertion fails, tune the four numbers in `src/content/packs/bees.ts`: starting coins, hive cost, bed cost, honey price. Keep the target of a second hive in about 5 real minutes at 1x, and re-run. Do not loosen the 3–6 day bounds.

- [ ] **Step 3: Run the whole suite**

Run: `npm run check`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add tests/sim/balance.test.ts
git commit -m "test(sim): add balance bot pacing check and dead-end fuzz"
```

(If you tuned numbers, also add `src/content/packs/bees.ts` and the spec, and say so in the message.)

---
## M1 — World rendering

### Task 13: Scene, lights, camera rig and tiles (`render/`)

**Files:**
- Create: `src/render/art/palette.ts`, `src/render/webgl.ts`, `src/render/scene.ts`, `src/render/lights.ts`, `src/render/camera.ts`, `src/render/tiles.ts`, `src/base.css`
- Test: `tests/render/camera.test.ts`, `tests/render/tiles.test.ts`

**Interfaces:**
- Consumes:
  - `core/hex`: `hexToWorld`, `parseHexKey`, `HexKey`, `HEX_SIZE`
  - `core/rng`: `hash2`
  - `sim/state`: `Tile`
- Produces:
  - `palette` (named hex colors) and `flowerColors: Record<string, readonly string[]>`
  - `isWebGLAvailable(): boolean`
  - `interface SceneContext { renderer; scene; camera: PerspectiveCamera; labels: CSS2DRenderer; resize(); render(); dispose() }` and `createScene(container): SceneContext`
  - `addLights(scene): DirectionalLight`
  - Camera:
    - `interface RigPose { targetX; targetZ; distance; yaw; pitch }`
    - Constants: `PITCH`, `YAW_STEP`, `RIG_HOME`, `RIG_LIMITS = { minDistance: 7, maxDistance: 34, maxTargetRadius: 16 }`
    - Pure helpers: `cameraPosition(pose): Vector3`, `clampTarget(x, z, r)`, `panDelta(dxPx, dyPx, pose, fovDeg, viewportHeightPx)`
    - `class CameraRig(camera, initial?)` with `pose`, `pan(dx, dy, viewportHeight)`, `zoom(deltaY)`, `zoomBy(factor)`, `rotate(dir: 1 | -1)`, `focus(x, z)`, `reset()`, `update(dtSec)`
  - Tiles:
    - `interface TileLayer { group; tiles: InstancedMesh; tufts: InstancedMesh; indexOf(key); setTile(key, tile); dispose() }`
    - `tileColor(tile, jitter, out?): Color`
    - `createTileLayer(tiles, seed): TileLayer`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/render/camera.test.ts
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  CameraRig, PITCH, RIG_HOME, RIG_LIMITS, YAW_STEP, cameraPosition, clampTarget, panDelta, type RigPose,
} from '../../src/render/camera';

const pose = (over: Partial<RigPose> = {}): RigPose => ({ targetX: 0, targetZ: 0, distance: 10, yaw: 0, pitch: PITCH, ...over });

describe('camera math', () => {
  it('sits behind and above the target at yaw 0', () => {
    const p = cameraPosition(pose());
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(10 * Math.sin(PITCH));
    expect(p.z).toBeCloseTo(10 * Math.cos(PITCH));
  });

  it('orbits the target with yaw', () => {
    const p = cameraPosition(pose({ yaw: Math.PI / 2 }));
    expect(p.x).toBeCloseTo(10 * Math.cos(PITCH));
    expect(p.z).toBeCloseTo(0);
  });

  it('clamps the target to a disc', () => {
    expect(clampTarget(3, 4, 10)).toEqual({ x: 3, z: 4 });
    const c = clampTarget(30, 40, 10);
    expect(c.x).toBeCloseTo(6);
    expect(c.z).toBeCloseTo(8);
  });

  it('pans so the ground follows the cursor', () => {
    const right = panDelta(100, 0, pose(), 38, 800);
    expect(right.x).toBeLessThan(0);
    expect(right.z).toBeCloseTo(0);
    const down = panDelta(0, 100, pose(), 38, 800);
    expect(down.x).toBeCloseTo(0);
    expect(down.z).toBeLessThan(0);
    const rotated = panDelta(100, 0, pose({ yaw: Math.PI / 2 }), 38, 800);
    expect(rotated.x).toBeCloseTo(0);
    expect(rotated.z).toBeGreaterThan(0);
  });
});

describe('CameraRig', () => {
  const make = () => {
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    return { camera, rig: new CameraRig(camera) };
  };

  it('looks at its target', () => {
    const { camera, rig } = make();
    const dir = camera.getWorldDirection(new THREE.Vector3());
    const toTarget = new THREE.Vector3(rig.pose.targetX, 0, rig.pose.targetZ).sub(camera.position).normalize();
    expect(dir.dot(toTarget)).toBeCloseTo(1, 5);
  });

  it('rotates in 60° steps with easing', () => {
    const { rig } = make();
    rig.rotate(1);
    rig.update(0.016);
    expect(rig.pose.yaw).toBeGreaterThan(0);
    expect(rig.pose.yaw).toBeLessThan(YAW_STEP);
    rig.update(10);
    expect(rig.pose.yaw).toBeCloseTo(YAW_STEP);
  });

  it('clamps zoom', () => {
    const { rig } = make();
    rig.zoom(100_000);
    rig.update(10);
    expect(rig.pose.distance).toBeCloseTo(RIG_LIMITS.maxDistance);
    rig.zoomBy(1_000);
    rig.update(10);
    expect(rig.pose.distance).toBeCloseTo(RIG_LIMITS.minDistance);
  });

  it('keeps panning inside the map', () => {
    const { rig } = make();
    for (let i = 0; i < 50; i++) rig.pan(-10_000, 0, 800);
    expect(Math.hypot(rig.pose.targetX, rig.pose.targetZ)).toBeLessThanOrEqual(RIG_LIMITS.maxTargetRadius + 1e-9);
  });

  it('reset eases back home', () => {
    const { rig } = make();
    rig.pan(300, 120, 800);
    rig.rotate(1);
    rig.zoom(500);
    rig.reset();
    rig.update(10);
    expect(rig.pose.targetX).toBeCloseTo(RIG_HOME.targetX);
    expect(rig.pose.targetZ).toBeCloseTo(RIG_HOME.targetZ);
    expect(rig.pose.distance).toBeCloseTo(RIG_HOME.distance);
    expect(Math.cos(rig.pose.yaw)).toBeCloseTo(1);
  });
});
```

```ts
// tests/render/tiles.test.ts
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { hex, hexKey } from '../../src/core/hex';
import { createTileLayer, tileColor } from '../../src/render/tiles';
import { newGame } from '../sim/helpers';

const hsl = (c: THREE.Color) => c.getHSL({ h: 0, s: 0, l: 0 });

describe('tile layer', () => {
  it('creates one tile instance and six grass tufts per tile', () => {
    const state = newGame(1);
    const layer = createTileLayer(state.tiles, state.seed);
    const n = Object.keys(state.tiles).length;
    expect(layer.tiles.count).toBe(n);
    expect(layer.tufts.count).toBe(n * 6);
  });

  it('colors owned grass more vividly than locked grass', () => {
    const owned = tileColor({ tile: 'grass', owned: true }, 0.5);
    const locked = tileColor({ tile: 'grass', owned: false }, 0.5);
    expect(hsl(owned).s).toBeGreaterThan(hsl(locked).s);
  });

  it('recolors a tile that becomes soil and hides its tufts', () => {
    const state = newGame(1);
    const layer = createTileLayer(state.tiles, state.seed);
    const key = hexKey(hex(1, -1));
    const i = layer.indexOf(key)!;
    const before = new THREE.Color();
    layer.tiles.getColorAt(i, before);
    layer.setTile(key, { tile: 'soil', owned: true });
    const after = new THREE.Color();
    layer.tiles.getColorAt(i, after);
    expect(after.equals(before)).toBe(false);
    const m = new THREE.Matrix4();
    const scale = new THREE.Vector3();
    for (let t = 0; t < 6; t++) {
      layer.tufts.getMatrixAt(i * 6 + t, m);
      m.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
      expect(scale.x).toBe(0);
    }
  });

  it('sinks water below grass', () => {
    const state = newGame(1);
    const layer = createTileLayer(state.tiles, state.seed);
    const waterKey = Object.keys(state.tiles).find((k) => state.tiles[k].tile === 'water')!;
    const y = (key: string) => {
      const m = new THREE.Matrix4();
      layer.tiles.getMatrixAt(layer.indexOf(key)!, m);
      return new THREE.Vector3().setFromMatrixPosition(m).y;
    };
    expect(y(waterKey)).toBeLessThan(y(hexKey(hex(0, 0))));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/render`
Expected: FAIL with `Failed to resolve import "../../src/render/camera"`.

- [ ] **Step 3: Create `src/render/art/palette.ts`**

```ts
/** Every color in the game world. Tune these at the art gate (Task 17). */
export const palette = {
  ground: '#5d7a45',
  grass: '#9fd46b',
  grassLocked: '#b4c38f',
  soil: '#7c5237',
  water: '#79c3de',
  tuft: '#6d9c47',
  trunk: '#7a5236',
  leaf1: '#6cab4f',
  leaf2: '#87c45c',
  leaf3: '#55953f',
  pine: '#3f7d4c',
  pine2: '#4a8c57',
  rock: '#a3a39b',
  wall: '#f1e4c6',
  timber: '#8a5a3b',
  roof: '#e2723c',
  roofDark: '#c85e2e',
  door: '#6b4127',
  window: '#a6d8ea',
  wood: '#b98650',
  hiveCream: '#f4e7c5',
  hiveCream2: '#eadbb2',
  hiveDark: '#3b2a1e',
  stem: '#5f9a3f',
  flowerCenter: '#f2b53a',
  suit: '#f7f5ef',
  skin: '#f1c7a5',
  hat: '#e8d4a2',
  glove: '#dcd2bb',
  veil: '#ffffff',
  highlightHover: '#ffffff',
  highlightValid: '#7ed957',
  highlightInvalid: '#e5534b',
  range: '#f2b53a',
  fog: '#dfeee0',
} as const;

/** Petal colors per flower type (SourceDef.flowerType). */
export const flowerColors: Record<string, readonly string[]> = {
  wildflower: ['#ffffff', '#f8c9dc', '#fff1a6', '#d9c8f5'],
};
```

- [ ] **Step 4: Create `src/render/webgl.ts`**

```ts
export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return typeof WebGL2RenderingContext !== 'undefined' && canvas.getContext('webgl2') !== null;
  } catch {
    return false;
  }
}
```

- [ ] **Step 5: Create `src/render/scene.ts`**

```ts
import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { palette } from './art/palette';

export interface SceneContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  labels: CSS2DRenderer;
  resize(): void;
  render(): void;
  dispose(): void;
}

export function createScene(container: HTMLElement): SceneContext {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'world-canvas';
  container.appendChild(renderer.domElement);

  const labels = new CSS2DRenderer();
  labels.domElement.className = 'world-labels';
  container.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(palette.fog, 30, 60);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);

  const resize = () => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h);
    labels.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  return {
    renderer,
    scene,
    camera,
    labels,
    resize,
    render() {
      renderer.render(scene, camera);
      labels.render(scene, camera);
    },
    dispose() {
      window.removeEventListener('resize', resize);
      renderer.dispose();
    },
  };
}
```

- [ ] **Step 6: Create `src/render/lights.ts`**

```ts
import * as THREE from 'three';

/** Soft sky fill plus one shadow-casting sun covering the whole map (radius ~21 world units). */
export function addLights(scene: THREE.Scene): THREE.DirectionalLight {
  scene.add(new THREE.HemisphereLight('#fdf6e3', '#7a9a5a', 1.4));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.4);
  sun.position.set(-8, 16, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const cam = sun.shadow.camera;
  const r = 22;
  cam.left = -r;
  cam.right = r;
  cam.top = r;
  cam.bottom = -r;
  cam.near = 1;
  cam.far = 60;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  return sun;
}
```

- [ ] **Step 7: Create `src/render/camera.ts`**

```ts
import * as THREE from 'three';

export interface RigPose {
  targetX: number;
  targetZ: number;
  distance: number;
  /** Radians around the target; 0 = camera on +z looking toward -z. */
  yaw: number;
  /** Radians above the ground plane. */
  pitch: number;
}

export const PITCH = THREE.MathUtils.degToRad(50);
export const YAW_STEP = Math.PI / 3;
export const RIG_HOME = { targetX: 0, targetZ: 0, distance: 16 } as const;
export const RIG_LIMITS = { minDistance: 7, maxDistance: 34, maxTargetRadius: 16 } as const;

export function cameraPosition(p: RigPose): THREE.Vector3 {
  const horizontal = p.distance * Math.cos(p.pitch);
  return new THREE.Vector3(
    p.targetX + Math.sin(p.yaw) * horizontal,
    p.distance * Math.sin(p.pitch),
    p.targetZ + Math.cos(p.yaw) * horizontal,
  );
}

export function clampTarget(x: number, z: number, maxRadius: number): { x: number; z: number } {
  const d = Math.hypot(x, z);
  if (d <= maxRadius) return { x, z };
  return { x: (x / d) * maxRadius, z: (z / d) * maxRadius };
}

/** Ground-plane change of the target for a drag, so the ground under the cursor follows it. */
export function panDelta(dxPx: number, dyPx: number, p: RigPose, fovDeg: number, viewportHeightPx: number): { x: number; z: number } {
  const worldPerPx = (2 * p.distance * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2)) / Math.max(viewportHeightPx, 1);
  const rightX = Math.cos(p.yaw);
  const rightZ = -Math.sin(p.yaw);
  const forwardX = -Math.sin(p.yaw);
  const forwardZ = -Math.cos(p.yaw);
  const across = -dxPx * worldPerPx;
  const along = (dyPx * worldPerPx) / Math.sin(p.pitch);
  return { x: across * rightX + along * forwardX, z: across * rightZ + along * forwardZ };
}

const EASED_KEYS = ['targetX', 'targetZ', 'distance', 'yaw'] as const;

/** Fixed-tilt orbit camera: drag pans, wheel zooms, Q/E rotates in hex-aligned 60° steps. */
export class CameraRig {
  readonly pose: RigPose;
  private readonly goal: RigPose;

  constructor(private readonly camera: THREE.PerspectiveCamera, initial: Partial<RigPose> = {}) {
    this.pose = { ...RIG_HOME, yaw: 0, pitch: PITCH, ...initial };
    this.goal = { ...this.pose };
    this.apply();
  }

  pan(dxPx: number, dyPx: number, viewportHeightPx: number): void {
    const d = panDelta(dxPx, dyPx, this.pose, this.camera.fov, viewportHeightPx);
    const t = clampTarget(this.pose.targetX + d.x, this.pose.targetZ + d.z, RIG_LIMITS.maxTargetRadius);
    this.pose.targetX = this.goal.targetX = t.x;
    this.pose.targetZ = this.goal.targetZ = t.z;
    this.apply();
  }

  zoom(deltaY: number): void {
    this.setDistance(this.goal.distance * Math.exp(deltaY * 0.0015));
  }

  /** Pinch: factor > 1 means fingers moved apart (zoom in). */
  zoomBy(factor: number): void {
    if (factor > 0) this.setDistance(this.goal.distance / factor);
  }

  rotate(dir: 1 | -1): void {
    this.goal.yaw += dir * YAW_STEP;
  }

  focus(x: number, z: number): void {
    const t = clampTarget(x, z, RIG_LIMITS.maxTargetRadius);
    this.goal.targetX = t.x;
    this.goal.targetZ = t.z;
  }

  reset(): void {
    this.goal.targetX = RIG_HOME.targetX;
    this.goal.targetZ = RIG_HOME.targetZ;
    this.goal.distance = RIG_HOME.distance;
    this.goal.yaw = Math.round(this.goal.yaw / (2 * Math.PI)) * 2 * Math.PI;
  }

  update(dtSec: number): void {
    const k = 1 - Math.exp(-dtSec * 10);
    for (const key of EASED_KEYS) {
      const diff = this.goal[key] - this.pose[key];
      this.pose[key] = Math.abs(diff) < 1e-4 ? this.goal[key] : this.pose[key] + diff * k;
    }
    this.apply();
  }

  private setDistance(d: number): void {
    this.goal.distance = THREE.MathUtils.clamp(d, RIG_LIMITS.minDistance, RIG_LIMITS.maxDistance);
  }

  private apply(): void {
    this.camera.position.copy(cameraPosition(this.pose));
    this.camera.lookAt(this.pose.targetX, 0, this.pose.targetZ);
    this.camera.updateMatrixWorld();
  }
}
```

- [ ] **Step 8: Create `src/render/tiles.ts`**

```ts
import * as THREE from 'three';
import { HEX_SIZE, hexToWorld, parseHexKey, type HexKey } from '../core/hex';
import { hash2 } from '../core/rng';
import type { Tile } from '../sim/state';
import { palette } from './art/palette';

const TILE_HEIGHT = 0.3;
const WATER_DROP = 0.12;
const TILE_SCALE = 0.95; // gaps show the darker ground plane as seams
const TUFTS_PER_TILE = 6;

export interface TileLayer {
  group: THREE.Group;
  tiles: THREE.InstancedMesh;
  tufts: THREE.InstancedMesh;
  indexOf(key: HexKey): number | undefined;
  setTile(key: HexKey, tile: Tile): void;
  dispose(): void;
}

export function tileColor(tile: Tile, jitter: number, out = new THREE.Color()): THREE.Color {
  const base =
    tile.tile === 'water' ? palette.water
    : tile.tile === 'soil' ? palette.soil
    : tile.owned ? palette.grass
    : palette.grassLocked;
  return out.set(base).offsetHSL(0, 0, (jitter - 0.5) * 0.06);
}

/** One instanced draw call for every tile, one for every grass tuft. */
export function createTileLayer(tiles: Record<HexKey, Tile>, seed: number): TileLayer {
  const keys = Object.keys(tiles);
  const tileGeo = new THREE.CylinderGeometry(HEX_SIZE * TILE_SCALE, HEX_SIZE * TILE_SCALE, TILE_HEIGHT, 6);
  const tileMat = new THREE.MeshLambertMaterial({ flatShading: true });
  const mesh = new THREE.InstancedMesh(tileGeo, tileMat, keys.length);
  mesh.receiveShadow = true;

  const tuftGeo = new THREE.ConeGeometry(0.035, 0.14, 3);
  tuftGeo.translate(0, 0.07, 0);
  const tuftMat = new THREE.MeshLambertMaterial({ color: palette.tuft, flatShading: true });
  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, keys.length * TUFTS_PER_TILE);

  const index = new Map<HexKey, number>();
  const m = new THREE.Matrix4();
  const color = new THREE.Color();
  const pos = new THREE.Vector3();
  const rot = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  const write = (i: number, key: HexKey, tile: Tile) => {
    const h = parseHexKey(key);
    const { x, z } = hexToWorld(h);
    const top = tile.tile === 'water' ? -WATER_DROP : 0;
    m.makeTranslation(x, top - TILE_HEIGHT / 2, z);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, tileColor(tile, hash2(h.q, h.r, seed), color));
    for (let t = 0; t < TUFTS_PER_TILE; t++) {
      const angle = hash2(h.q * 7 + t, h.r * 13 - t, seed) * Math.PI * 2;
      const radius = Math.sqrt(hash2(h.q - t * 3, h.r + t * 5, seed + 1)) * 0.7;
      const s = tile.tile === 'grass' ? 0.7 + hash2(h.q + t, h.r - t, seed + 2) * 0.6 : 0;
      pos.set(x + Math.cos(angle) * radius, 0, z + Math.sin(angle) * radius);
      rot.setFromAxisAngle(up, angle);
      scale.set(s, s, s);
      tufts.setMatrixAt(i * TUFTS_PER_TILE + t, m.compose(pos, rot, scale));
    }
  };

  const flush = () => {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    tufts.instanceMatrix.needsUpdate = true;
  };

  keys.forEach((key, i) => {
    index.set(key, i);
    write(i, key, tiles[key]);
  });
  flush();

  const groundGeo = new THREE.CircleGeometry(HEX_SIZE * 24, 48);
  const groundMat = new THREE.MeshLambertMaterial({ color: palette.ground });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -TILE_HEIGHT + 0.01;
  ground.receiveShadow = true;

  const group = new THREE.Group();
  group.add(ground, mesh, tufts);

  return {
    group,
    tiles: mesh,
    tufts,
    indexOf: (key) => index.get(key),
    setTile(key, tile) {
      const i = index.get(key);
      if (i === undefined) return;
      write(i, key, tile);
      flush();
    },
    dispose() {
      tileGeo.dispose();
      tileMat.dispose();
      tuftGeo.dispose();
      tuftMat.dispose();
      groundGeo.dispose();
      groundMat.dispose();
    },
  };
}
```

- [ ] **Step 9: Create `src/base.css`**

```css
html,
body {
  margin: 0;
  height: 100%;
  overflow: hidden;
}

body {
  background: linear-gradient(180deg, #d4ebf3 0%, #e7f1dc 100%);
  font-family: 'Nunito', system-ui, -apple-system, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
  user-select: none;
}

#app {
  position: fixed;
  inset: 0;
}

.world-canvas {
  position: absolute;
  inset: 0;
  display: block;
  touch-action: none;
}

.world-labels {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.fps {
  position: absolute;
  left: 14px;
  bottom: 14px;
  font: 700 12px/1 ui-monospace, monospace;
  color: #5a3d2b;
  background: rgba(255, 248, 236, 0.8);
  padding: 4px 6px;
  border-radius: 6px;
  pointer-events: none;
}
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npx vitest run tests/render`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/render src/base.css tests/render
git commit -m "feat(render): add scene, lights, camera rig and instanced hex tiles"
```

---

### Task 14: Picking, hover highlight, input and the M1 world view

**Files:**
- Create: `src/render/picking.ts`, `src/render/highlight.ts`, `src/render/view.ts`, `src/game/input.ts`
- Modify: `src/main.ts` (full replacement below)
- Test: `tests/render/picking.test.ts`, `tests/render/highlight.test.ts`, `tests/game/input.test.ts`

**Interfaces:**
- Consumes: `CameraRig`, `createScene`, `addLights`, `createTileLayer`, `palette`, `hexToWorld`, `worldToHex`, `hexKey`, `GameState`
- Produces:
  - Picking:
    - `clientToNdc(clientX, clientY, rect)`
    - `screenToGround(ndcX, ndcY, camera): { x; z } | null`
    - `pickHex(clientX, clientY, rect, camera, tiles: Record<HexKey, unknown>): Hex | null`
    - `worldToClient(x, y, z, camera, rect): { x; y }`
  - Highlight:
    - `type HighlightTone = 'hover' | 'valid' | 'invalid'`
    - `class HexHighlight` with `group`, `cursor`, `range`, `currentTone`, `fillMaterial`, and methods `show(h, tone)`, `hide()`, `showRange(hexes)`, `clearRange()`
  - Input:
    - `DRAG_THRESHOLD_PX = 5`
    - `isDrag(dx, dy): boolean`
    - `interface InputHandlers { pan(dx, dy); zoom(deltaY); pinch(factor); hover(x, y); click(x, y); cancel(); leave() }`
    - `attachInput(el, handlers): () => void`
  - View (M1 shape; Task 16 extends it): `interface WorldView { ctx; rig; tiles; highlight; pickHex(x, y); hexToClient(h, height?); frame(dtSec) }` and `createWorldView(container, state)`

- [ ] **Step 1: Write the failing tests** (includes Review Focus #5)

```ts
// tests/render/picking.test.ts
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ORIGIN, hex, hexKey, hexRange, hexToWorld } from '../../src/core/hex';
import { CameraRig } from '../../src/render/camera';
import { pickHex, worldToClient } from '../../src/render/picking';

const rect = { left: 0, top: 0, width: 800, height: 800 };
const tiles = Object.fromEntries(hexRange(ORIGIN, 12).map((h) => [hexKey(h), true]));

function cameraLookingAt(x: number, z: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  new CameraRig(camera, { targetX: x, targetZ: z });
  return camera;
}

describe('picking', () => {
  it('picks the hex under the screen center', () => {
    const target = hex(2, -1);
    const w = hexToWorld(target);
    expect(pickHex(400, 400, rect, cameraLookingAt(w.x, w.z), tiles)).toEqual(target);
  });

  it('round-trips hex -> screen -> hex', () => {
    const camera = cameraLookingAt(0, 0);
    for (const h of hexRange(ORIGIN, 3)) {
      const w = hexToWorld(h);
      const p = worldToClient(w.x, 0, w.z, camera, rect);
      expect(pickHex(p.x, p.y, rect, camera, tiles)).toEqual(h);
    }
  });

  it('returns null where there is no tile', () => {
    expect(pickHex(400, 400, rect, cameraLookingAt(0, 0), {})).toBeNull();
  });
});
```

```ts
// tests/render/highlight.test.ts
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { hex } from '../../src/core/hex';
import { palette } from '../../src/render/art/palette';
import { HexHighlight } from '../../src/render/highlight';

describe('HexHighlight', () => {
  it('shows a tinted cursor on a hex and hides it', () => {
    const hl = new HexHighlight();
    hl.show(hex(1, 0), 'invalid');
    expect(hl.cursor.visible).toBe(true);
    expect(hl.cursor.position.x).toBeCloseTo(Math.sqrt(3));
    expect(hl.currentTone).toBe('invalid');
    expect(hl.fillMaterial.color.getHex()).toBe(new THREE.Color(palette.highlightInvalid).getHex());
    hl.hide();
    expect(hl.cursor.visible).toBe(false);
  });

  it('shows and clears a range', () => {
    const hl = new HexHighlight();
    hl.showRange([hex(0, 1), hex(1, 0)]);
    expect(hl.range.visible).toBe(true);
    expect(hl.range.count).toBe(2);
    hl.clearRange();
    expect(hl.range.visible).toBe(false);
  });
});
```

```ts
// tests/game/input.test.ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { attachInput, isDrag, type InputHandlers } from '../../src/game/input';

function setup() {
  const el = document.createElement('div');
  const h: InputHandlers = {
    pan: vi.fn(), zoom: vi.fn(), pinch: vi.fn(), hover: vi.fn(), click: vi.fn(), cancel: vi.fn(), leave: vi.fn(),
  };
  attachInput(el, h);
  const fire = (type: string, x: number, y: number, init: MouseEventInit = {}) =>
    el.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, ...init }));
  return { el, h, fire };
}

describe('input', () => {
  it('uses a 5 px drag threshold', () => {
    expect(isDrag(3, 3)).toBe(false);
    expect(isDrag(3, 4)).toBe(true);
  });

  it('treats a small jitter as a click, not a pan', () => {
    const { h, fire } = setup();
    fire('pointerdown', 100, 100);
    fire('pointermove', 103, 102);
    fire('pointerup', 103, 102);
    expect(h.click).toHaveBeenCalledWith(103, 102);
    expect(h.pan).not.toHaveBeenCalled();
  });

  it('treats a longer drag as a pan and never clicks', () => {
    const { h, fire } = setup();
    fire('pointerdown', 100, 100);
    fire('pointermove', 104, 100);
    fire('pointermove', 110, 100);
    fire('pointerup', 110, 100);
    expect(h.pan).toHaveBeenCalledWith(6, 0);
    expect(h.click).not.toHaveBeenCalled();
  });

  it('hovers when no button is down', () => {
    const { h, fire } = setup();
    fire('pointermove', 50, 60);
    expect(h.hover).toHaveBeenCalledWith(50, 60);
  });

  it('cancels on right button and zooms on wheel', () => {
    const { el, h, fire } = setup();
    fire('pointerdown', 10, 10, { button: 2 });
    expect(h.cancel).toHaveBeenCalled();
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, cancelable: true }));
    expect(h.zoom).toHaveBeenCalledWith(120);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/render tests/game/input.test.ts`
Expected: FAIL with unresolved imports for `picking`, `highlight` and `input`.

- [ ] **Step 3: Create `src/render/picking.ts`**

```ts
import * as THREE from 'three';
import { hexKey, worldToHex, type Hex, type HexKey } from '../core/hex';

export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const hit = new THREE.Vector3();

export function clientToNdc(clientX: number, clientY: number, rect: ScreenRect): { x: number; y: number } {
  return {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: -((clientY - rect.top) / rect.height) * 2 + 1,
  };
}

/** Where a screen ray meets the y=0 ground plane. Pure math, no mesh raycasts. */
export function screenToGround(ndcX: number, ndcY: number, camera: THREE.Camera): { x: number; z: number } | null {
  ndc.set(ndcX, ndcY);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.ray.intersectPlane(groundPlane, hit) ? { x: hit.x, z: hit.z } : null;
}

export function pickHex(
  clientX: number, clientY: number, rect: ScreenRect, camera: THREE.Camera, tiles: Record<HexKey, unknown>,
): Hex | null {
  const p = clientToNdc(clientX, clientY, rect);
  const ground = screenToGround(p.x, p.y, camera);
  if (!ground) return null;
  const h = worldToHex(ground.x, ground.z);
  return tiles[hexKey(h)] ? h : null;
}

export function worldToClient(x: number, y: number, z: number, camera: THREE.Camera, rect: ScreenRect): { x: number; y: number } {
  const v = new THREE.Vector3(x, y, z).project(camera);
  return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
}
```

- [ ] **Step 4: Create `src/render/highlight.ts`**

```ts
import * as THREE from 'three';
import { HEX_SIZE, hexToWorld, type Hex } from '../core/hex';
import { palette } from './art/palette';

export type HighlightTone = 'hover' | 'valid' | 'invalid';

const TONE_COLORS: Record<HighlightTone, string> = {
  hover: palette.highlightHover,
  valid: palette.highlightValid,
  invalid: palette.highlightInvalid,
};
const MAX_RANGE = 64;

/** Pointy-top hex outline, just above the tile tops. */
function outlineGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k < 6; k++) {
    const a = THREE.MathUtils.degToRad(60 * k - 30);
    pts.push(new THREE.Vector3(Math.cos(a) * HEX_SIZE * 0.93, 0.03, Math.sin(a) * HEX_SIZE * 0.93));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

export class HexHighlight {
  readonly group = new THREE.Group();
  readonly cursor = new THREE.Group();
  readonly fillMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.35, depthWrite: false });
  readonly range: THREE.InstancedMesh;
  currentTone: HighlightTone = 'hover';
  private readonly lineMaterial = new THREE.LineBasicMaterial();

  constructor() {
    const fill = new THREE.Mesh(new THREE.CylinderGeometry(HEX_SIZE * 0.93, HEX_SIZE * 0.93, 0.02, 6), this.fillMaterial);
    fill.position.y = 0.02;
    const outline = new THREE.LineLoop(outlineGeometry(), this.lineMaterial);
    this.cursor.add(fill, outline);
    this.cursor.visible = false;

    const rangeMaterial = new THREE.MeshBasicMaterial({ color: palette.range, transparent: true, opacity: 0.25, depthWrite: false });
    this.range = new THREE.InstancedMesh(new THREE.CylinderGeometry(HEX_SIZE * 0.9, HEX_SIZE * 0.9, 0.015, 6), rangeMaterial, MAX_RANGE);
    this.range.visible = false;
    this.range.count = 0;

    this.group.add(this.cursor, this.range);
    this.setTone('hover');
  }

  show(h: Hex, tone: HighlightTone): void {
    const { x, z } = hexToWorld(h);
    this.cursor.position.set(x, 0, z);
    this.cursor.visible = true;
    this.setTone(tone);
  }

  hide(): void {
    this.cursor.visible = false;
  }

  showRange(hexes: readonly Hex[]): void {
    const m = new THREE.Matrix4();
    const n = Math.min(hexes.length, MAX_RANGE);
    for (let i = 0; i < n; i++) {
      const { x, z } = hexToWorld(hexes[i]);
      this.range.setMatrixAt(i, m.makeTranslation(x, 0.015, z));
    }
    this.range.count = n;
    this.range.instanceMatrix.needsUpdate = true;
    this.range.visible = n > 0;
  }

  clearRange(): void {
    this.range.visible = false;
    this.range.count = 0;
  }

  private setTone(tone: HighlightTone): void {
    this.currentTone = tone;
    this.fillMaterial.color.set(TONE_COLORS[tone]);
    this.lineMaterial.color.set(TONE_COLORS[tone]);
  }
}
```

- [ ] **Step 5: Create `src/game/input.ts`**

```ts
export const DRAG_THRESHOLD_PX = 5;

export function isDrag(dx: number, dy: number, threshold = DRAG_THRESHOLD_PX): boolean {
  return Math.hypot(dx, dy) >= threshold;
}

export interface InputHandlers {
  pan(dxPx: number, dyPx: number): void;
  zoom(deltaY: number): void;
  /** factor > 1: fingers moved apart. */
  pinch(factor: number): void;
  hover(clientX: number, clientY: number): void;
  click(clientX: number, clientY: number): void;
  cancel(): void;
  leave(): void;
}

type Point = { x: number; y: number };

/** Pointer/wheel handling for the world canvas: click vs drag, pinch zoom, right-click cancel. */
export function attachInput(el: HTMLElement, h: InputHandlers): () => void {
  const pointers = new Map<number, Point>();
  let downAt: Point | null = null;
  let dragging = false;
  let pinchDistance = 0;

  const twoPointerDistance = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onDown = (e: PointerEvent) => {
    if (e.button === 2) {
      h.cancel();
      return;
    }
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Not supported (tests) or pointer already gone: capture is only a nicety for drags leaving the canvas.
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      downAt = { x: e.clientX, y: e.clientY };
      dragging = false;
    } else if (pointers.size === 2) {
      pinchDistance = twoPointerDistance();
      dragging = true;
    }
  };

  const onMove = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) {
      h.hover(e.clientX, e.clientY);
      return;
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const d = twoPointerDistance();
      if (pinchDistance > 0) h.pinch(d / pinchDistance);
      pinchDistance = d;
      return;
    }
    if (downAt && !dragging && isDrag(e.clientX - downAt.x, e.clientY - downAt.y)) dragging = true;
    if (dragging) h.pan(e.clientX - prev.x, e.clientY - prev.y);
    else h.hover(e.clientX, e.clientY);
  };

  const onUp = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      if (!dragging && downAt) h.click(e.clientX, e.clientY);
      downAt = null;
      dragging = false;
      pinchDistance = 0;
    }
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    h.zoom(e.deltaY);
  };
  const onContextMenu = (e: Event) => e.preventDefault();
  const onLeave = () => {
    if (pointers.size === 0) h.leave();
  };

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  el.addEventListener('pointerleave', onLeave);
  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('contextmenu', onContextMenu);

  return () => {
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onUp);
    el.removeEventListener('pointerleave', onLeave);
    el.removeEventListener('wheel', onWheel);
    el.removeEventListener('contextmenu', onContextMenu);
  };
}
```

- [ ] **Step 6: Create `src/render/view.ts` (M1 version)**

```ts
import { hexToWorld, type Hex } from '../core/hex';
import type { GameState } from '../sim/state';
import { CameraRig } from './camera';
import { HexHighlight } from './highlight';
import { addLights } from './lights';
import { pickHex, worldToClient } from './picking';
import { createScene, type SceneContext } from './scene';
import { createTileLayer, type TileLayer } from './tiles';

export interface WorldView {
  readonly ctx: SceneContext;
  readonly rig: CameraRig;
  readonly tiles: TileLayer;
  readonly highlight: HexHighlight;
  pickHex(clientX: number, clientY: number): Hex | null;
  hexToClient(h: Hex, height?: number): { x: number; y: number };
  frame(dtSec: number): void;
}

export function createWorldView(container: HTMLElement, state: GameState): WorldView {
  const ctx = createScene(container);
  addLights(ctx.scene);
  const rig = new CameraRig(ctx.camera);
  const tiles = createTileLayer(state.tiles, state.seed);
  const highlight = new HexHighlight();
  ctx.scene.add(tiles.group, highlight.group);
  const canvas = ctx.renderer.domElement;

  return {
    ctx,
    rig,
    tiles,
    highlight,
    pickHex: (x, y) => pickHex(x, y, canvas.getBoundingClientRect(), ctx.camera, state.tiles),
    hexToClient(h, height = 0) {
      const p = hexToWorld(h);
      return worldToClient(p.x, height, p.z, ctx.camera, canvas.getBoundingClientRect());
    },
    frame(dtSec) {
      rig.update(dtSec);
      ctx.render();
    },
  };
}
```

- [ ] **Step 7: Replace `src/main.ts` with the M1 world**

```ts
import './base.css';
import { DEFAULT_PACKS } from './content/default';
import { createRegistry } from './content/registry';
import { createFpsMeter } from './game/fps';
import { attachInput } from './game/input';
import { startLoop } from './game/loop';
import { createWorldView } from './render/view';
import { createInitialState } from './sim/state';

const root = document.getElementById('app');
if (!root) throw new Error('#app not found');

const reg = createRegistry(DEFAULT_PACKS);
const seed = Number(new URLSearchParams(location.search).get('seed')) || 1;
const state = createInitialState(seed, reg);
const view = createWorldView(root, state);
const canvas = view.ctx.renderer.domElement;

const fps = createFpsMeter();
root.appendChild(fps.el);

attachInput(canvas, {
  pan: (dx, dy) => view.rig.pan(dx, dy, canvas.clientHeight),
  zoom: (deltaY) => view.rig.zoom(deltaY),
  pinch: (factor) => view.rig.zoomBy(factor),
  hover: (x, y) => {
    const h = view.pickHex(x, y);
    if (h) view.highlight.show(h, 'hover');
    else view.highlight.hide();
  },
  click: () => {},
  cancel: () => {},
  leave: () => view.highlight.hide(),
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'q' || e.key === 'Q') view.rig.rotate(-1);
  if (e.key === 'e' || e.key === 'E') view.rig.rotate(1);
});

startLoop({
  getSpeed: () => 0,
  step: () => {},
  render: (dt) => {
    view.frame(dt);
    fps.frame(dt);
  },
});
```

- [ ] **Step 8: Run the checks**

Run: `npm run check`
Expected: all green.

- [ ] **Step 9: Look at it (M1 exit)**

Run `npm run dev`, open `http://localhost:5173/?seed=1`.

Expected:
- A hex disc: a bright-green starting plot surrounded by desaturated grass, with blue lakes, darker seams between tiles and small grass tufts.
- Soft shadows are not visible yet; there are no props.
- Dragging pans, the wheel zooms, and Q/E rotate in smooth 60° steps.
- Hovering shows a white hex outline that follows the cursor exactly.
- The FPS readout stays around 60.

Fix any offset between the cursor and the highlight before continuing. It means `pickHex` and the tile layout disagree.

- [ ] **Step 10: Commit**

```bash
git add src/render/picking.ts src/render/highlight.ts src/render/view.ts src/game/input.ts src/main.ts tests/render/picking.test.ts tests/render/highlight.test.ts tests/game/input.test.ts
git commit -m "feat(render): add ground picking, hover highlight, input and M1 world view"
```

---

## M2 — Art kit

### Task 15: Procedural art kit and decor (`render/art/*`, `render/decor`)

**Files:**
- Create: `src/render/art/parts.ts`, `src/render/art/materials.ts`, `src/render/art/nature.ts`, `src/render/art/buildings.ts`, `src/render/art/flowerbed.ts`, `src/render/art/beekeeper.ts`, `src/render/art/registry.ts`, `src/render/decor.ts`
- Test: `tests/render/art.test.ts`

**Interfaces:**
- Consumes: `palette`, `flowerColors`, `hash2`, `hexToWorld`, `parseHexKey`, `Tile`, `DEFAULT_PACKS` (test only)
- Produces:
  - Parts:
    - `type Vec3`, `interface PartOptions { at?; scale?; rotX?; rotY?; rotZ? }`
    - `colored(geo, color, opts?)`
    - shape helpers `box`, `cylinder`, `cone`, `ico`, `sphere`, `capsule`
    - `merge(parts): BufferGeometry` (vertex-colored, merged)
  - Materials: `solidMaterial()`, `veilMaterial()`, `ghostMaterial(tone: 'valid' | 'invalid')` (each shared and cached)
  - Geometries: `makeRoundTree()`, `makePineTree()`, `makeRock()`, `makeHouse()`, `makeHive()`, `makeFlowerBed(flowerType)`
  - `makeBeekeeper(): THREE.Group`
  - Art registry:
    - `type ArtFactory = () => THREE.Object3D`
    - `registerArt(defId, factory)`, `hasArt(defId)`
    - `createArt(defId): Object3D` (sets `userData.defId`; throws when unregistered)
    - `meshOf(geometry)`
    - `registerDefaultArt()`
  - `createDecorLayer(tiles, seed): { group; counts: { round; pine; rock }; dispose() }`
  - Contract: every geometry has its origin at the tile center on the ground, `+z` is the front, it fits within the hex apothem (0.82), and its `min.y ≥ -0.05`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/render/art.test.ts
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { makeBeekeeper } from '../../src/render/art/beekeeper';
import { makeHive, makeHouse } from '../../src/render/art/buildings';
import { makeFlowerBed } from '../../src/render/art/flowerbed';
import { makePineTree, makeRock, makeRoundTree } from '../../src/render/art/nature';
import { createArt, hasArt, registerDefaultArt } from '../../src/render/art/registry';
import { createDecorLayer } from '../../src/render/decor';
import { newGame, reg } from '../sim/helpers';

const geometries: [string, () => THREE.BufferGeometry][] = [
  ['house', makeHouse],
  ['hive', makeHive],
  ['flower bed', () => makeFlowerBed('wildflower')],
  ['round tree', makeRoundTree],
  ['pine tree', makePineTree],
  ['rock', makeRock],
];

describe('art geometry', () => {
  it.each(geometries)('%s is vertex-colored and fits on one hex', (_name, make) => {
    const g = make();
    expect(g.getAttribute('color').count).toBe(g.getAttribute('position').count);
    g.computeBoundingBox();
    const b = g.boundingBox!;
    expect(b.min.y).toBeGreaterThanOrEqual(-0.05);
    const reach = Math.max(
      Math.hypot(b.max.x, b.max.z), Math.hypot(b.min.x, b.min.z),
      Math.hypot(b.max.x, b.min.z), Math.hypot(b.min.x, b.max.z),
    );
    expect(reach).toBeLessThanOrEqual(0.82);
  });

  it('builds a beekeeper with a solid body and a see-through veil', () => {
    const keeper = makeBeekeeper();
    const meshes = keeper.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh);
    expect(meshes).toHaveLength(2);
    expect(meshes[0].castShadow).toBe(true);
    expect((meshes[1].material as THREE.Material).transparent).toBe(true);
  });
});

describe('art registry', () => {
  it('has art for every buildable in the default packs', () => {
    registerDefaultArt();
    for (const id of reg.buildables.keys()) expect(hasArt(id)).toBe(true);
  });

  it('creates shadow-casting objects tagged with their def id', () => {
    registerDefaultArt();
    const hive = createArt('hive') as THREE.Mesh;
    expect(hive.castShadow).toBe(true);
    expect(hive.userData.defId).toBe('hive');
    expect(() => createArt('castle')).toThrow('No art registered for "castle"');
  });
});

describe('decor layer', () => {
  it('instances one mesh per decor tile', () => {
    const state = newGame(1);
    const layer = createDecorLayer(state.tiles, state.seed);
    const decorTiles = Object.values(state.tiles).filter((t) => t.decor).length;
    expect(layer.counts.round + layer.counts.pine + layer.counts.rock).toBe(decorTiles);
    const instanced = layer.group.children.filter((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh);
    expect(instanced.reduce((n, m) => n + m.count, 0)).toBe(decorTiles);
    expect(instanced.length).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/render/art.test.ts`
Expected: FAIL with unresolved imports under `src/render/art/`.

- [ ] **Step 3: Create `src/render/art/parts.ts`**

```ts
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type Vec3 = [number, number, number];

export interface PartOptions {
  at?: Vec3;
  scale?: Vec3;
  rotX?: number;
  rotY?: number;
  rotZ?: number;
}

/** Non-indexed copy with a flat vertex color, transformed (scale, rotate X/Z/Y, translate). */
export function colored(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, opts: PartOptions = {}): THREE.BufferGeometry {
  let g = geo;
  if (geo.index) {
    g = geo.toNonIndexed();
    geo.dispose();
  }
  if (opts.scale) g.scale(...opts.scale);
  if (opts.rotX) g.rotateX(opts.rotX);
  if (opts.rotZ) g.rotateZ(opts.rotZ);
  if (opts.rotY) g.rotateY(opts.rotY);
  if (opts.at) g.translate(...opts.at);
  const c = new THREE.Color(color);
  const count = g.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

export const box = (w: number, h: number, d: number, color: THREE.ColorRepresentation, opts?: PartOptions) =>
  colored(new THREE.BoxGeometry(w, h, d), color, opts);

export const cylinder = (
  rTop: number, rBottom: number, h: number, segments: number, color: THREE.ColorRepresentation, opts?: PartOptions,
) => colored(new THREE.CylinderGeometry(rTop, rBottom, h, segments), color, opts);

export const cone = (r: number, h: number, segments: number, color: THREE.ColorRepresentation, opts?: PartOptions) =>
  colored(new THREE.ConeGeometry(r, h, segments), color, opts);

export const ico = (r: number, color: THREE.ColorRepresentation, opts?: PartOptions) =>
  colored(new THREE.IcosahedronGeometry(r, 0), color, opts);

export const sphere = (r: number, wSeg: number, hSeg: number, color: THREE.ColorRepresentation, opts?: PartOptions) =>
  colored(new THREE.SphereGeometry(r, wSeg, hSeg), color, opts);

export const capsule = (r: number, length: number, color: THREE.ColorRepresentation, opts?: PartOptions) =>
  colored(new THREE.CapsuleGeometry(r, length, 4, 8), color, opts);

/** One geometry, one draw call, per prop. */
export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error('merge: parts have incompatible attributes');
  for (const p of parts) p.dispose();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}
```

- [ ] **Step 4: Create `src/render/art/materials.ts`**

```ts
import * as THREE from 'three';
import { palette } from './palette';

let solid: THREE.MeshLambertMaterial | null = null;
let veil: THREE.MeshLambertMaterial | null = null;
const ghosts = new Map<'valid' | 'invalid', THREE.MeshBasicMaterial>();

/** Shared by every prop: colors come from vertex colors, faces are flat-shaded. */
export function solidMaterial(): THREE.MeshLambertMaterial {
  solid ??= new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  return solid;
}

export function veilMaterial(): THREE.MeshLambertMaterial {
  veil ??= new THREE.MeshLambertMaterial({
    vertexColors: true, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false,
  });
  return veil;
}

export function ghostMaterial(tone: 'valid' | 'invalid'): THREE.MeshBasicMaterial {
  let m = ghosts.get(tone);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color: tone === 'valid' ? palette.highlightValid : palette.highlightInvalid,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    ghosts.set(tone, m);
  }
  return m;
}
```

- [ ] **Step 5: Create `src/render/art/nature.ts`**

```ts
import * as THREE from 'three';
import { hash2 } from '../../core/rng';
import { palette } from './palette';
import { colored, cone, cylinder, ico, merge } from './parts';

export function makeRoundTree(): THREE.BufferGeometry {
  return merge([
    cylinder(0.06, 0.09, 0.4, 6, palette.trunk, { at: [0, 0.2, 0] }),
    ico(0.32, palette.leaf1, { at: [0, 0.62, 0] }),
    ico(0.22, palette.leaf2, { at: [0.18, 0.5, 0.08] }),
    ico(0.2, palette.leaf3, { at: [-0.14, 0.55, -0.12] }),
  ]);
}

export function makePineTree(): THREE.BufferGeometry {
  return merge([
    cylinder(0.05, 0.07, 0.3, 6, palette.trunk, { at: [0, 0.15, 0] }),
    cone(0.34, 0.45, 7, palette.pine, { at: [0, 0.45, 0] }),
    cone(0.27, 0.4, 7, palette.pine2, { at: [0, 0.68, 0] }),
    cone(0.18, 0.34, 7, palette.pine, { at: [0, 0.9, 0] }),
  ]);
}

/** Dodecahedron squashed and jittered. Jitter is keyed by vertex position so shared corners move together (no cracks). */
export function makeRock(): THREE.BufferGeometry {
  const g = new THREE.DodecahedronGeometry(0.24, 0);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n = hash2(Math.round(x * 1000), Math.round(z * 1000) + Math.round(y * 1000) * 7, 99) - 0.5;
    const k = 1 + n * 0.35;
    pos.setXYZ(i, x * k, y * k * 0.6, z * k * 0.85);
  }
  g.computeVertexNormals();
  return merge([colored(g, palette.rock, { at: [0, 0.14, 0] })]);
}
```

- [ ] **Step 6: Create `src/render/art/buildings.ts`**

```ts
import * as THREE from 'three';
import { palette } from './palette';
import { box, colored, merge } from './parts';

const corners = (x: number, z: number): [number, number][] => [[-x, -z], [-x, z], [x, -z], [x, z]];

/** Timber-framed cottage with a terracotta gable roof. Front (door) faces +z. */
export function makeHouse(): THREE.BufferGeometry {
  // Triangular prism: 3-sided cylinder, apex rotated to point up, axis laid along x.
  const roof = colored(new THREE.CylinderGeometry(0.62, 0.62, 1.04, 3, 1, false, Math.PI / 2), palette.roof, {
    rotZ: Math.PI / 2,
    at: [0, 1.09, 0],
  });
  return merge([
    box(0.9, 0.08, 0.72, palette.timber, { at: [0, 0.04, 0] }),
    box(0.84, 0.66, 0.66, palette.wall, { at: [0, 0.41, 0] }),
    ...corners(0.42, 0.33).map(([x, z]) => box(0.06, 0.66, 0.06, palette.timber, { at: [x, 0.41, z] })),
    box(0.86, 0.05, 0.68, palette.timber, { at: [0, 0.76, 0] }),
    roof,
    box(0.12, 0.35, 0.12, palette.roofDark, { at: [0.26, 1.3, -0.3] }),
    box(0.2, 0.34, 0.03, palette.door, { at: [0, 0.25, 0.34] }),
    box(0.15, 0.15, 0.03, palette.window, { at: [-0.25, 0.48, 0.34] }),
    box(0.15, 0.15, 0.03, palette.window, { at: [0.25, 0.48, 0.34] }),
  ]);
}

/** Langstroth hive on a stand: two boxes, lid, entrance slot and landing board facing +z. */
export function makeHive(): THREE.BufferGeometry {
  return merge([
    ...corners(0.26, 0.24).map(([x, z]) => box(0.06, 0.12, 0.06, palette.wood, { at: [x, 0.06, z] })),
    box(0.66, 0.06, 0.6, palette.wood, { at: [0, 0.15, 0] }),
    box(0.58, 0.3, 0.52, palette.hiveCream, { at: [0, 0.33, 0] }),
    box(0.58, 0.26, 0.52, palette.hiveCream2, { at: [0, 0.61, 0] }),
    box(0.2, 0.03, 0.02, palette.wood, { at: [0, 0.4, 0.265] }),
    box(0.64, 0.07, 0.58, palette.wood, { at: [0, 0.775, 0] }),
    box(0.3, 0.04, 0.02, palette.hiveDark, { at: [0, 0.22, 0.265] }),
    box(0.36, 0.02, 0.1, palette.wood, { at: [0, 0.19, 0.3] }),
  ]);
}
```

- [ ] **Step 7: Create `src/render/art/flowerbed.ts`**

```ts
import * as THREE from 'three';
import { flowerColors, palette } from './palette';
import { cylinder, ico, merge } from './parts';

const FLOWERS_PER_BED = 11;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Flowers spread by a golden-angle spiral over the bed's soil tile. */
export function makeFlowerBed(flowerType: string): THREE.BufferGeometry {
  const colors = flowerColors[flowerType] ?? ['#ffffff'];
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < FLOWERS_PER_BED; i++) {
    const radius = 0.62 * Math.sqrt((i + 0.5) / FLOWERS_PER_BED);
    const angle = i * GOLDEN_ANGLE;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const height = 0.12 + (i % 3) * 0.03;
    parts.push(cylinder(0.012, 0.014, height, 4, palette.stem, { at: [x, height / 2, z] }));
    const petal = colors[i % colors.length];
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2 + i;
      parts.push(ico(0.032, petal, { scale: [1, 0.45, 1], at: [x + Math.cos(a) * 0.04, height, z + Math.sin(a) * 0.04] }));
    }
    parts.push(ico(0.026, palette.flowerCenter, { at: [x, height + 0.01, z] }));
  }
  return merge(parts);
}
```

- [ ] **Step 8: Create `src/render/art/beekeeper.ts`**

```ts
import * as THREE from 'three';
import { solidMaterial, veilMaterial } from './materials';
import { palette } from './palette';
import { capsule, colored, cylinder, merge, sphere } from './parts';

/** The tiny beekeeper: white suit, wide-brim hat, see-through veil. Idle only in sub-project 1. */
export function makeBeekeeper(): THREE.Group {
  const body = merge([
    capsule(0.1, 0.16, palette.suit, { at: [0, 0.2, 0] }),
    capsule(0.035, 0.14, palette.suit, { rotZ: 0.25, at: [0.13, 0.24, 0] }),
    capsule(0.035, 0.14, palette.suit, { rotZ: -0.25, at: [-0.13, 0.24, 0] }),
    sphere(0.04, 6, 4, palette.glove, { at: [0.16, 0.14, 0] }),
    sphere(0.04, 6, 4, palette.glove, { at: [-0.16, 0.14, 0] }),
    sphere(0.08, 10, 8, palette.skin, { at: [0, 0.44, 0] }),
    cylinder(0.18, 0.18, 0.015, 14, palette.hat, { at: [0, 0.52, 0] }),
    cylinder(0.08, 0.09, 0.08, 12, palette.hat, { at: [0, 0.57, 0] }),
  ]);
  const veilGeo = colored(new THREE.CylinderGeometry(0.12, 0.16, 0.14, 14, 1, true), palette.veil, { at: [0, 0.44, 0] });

  const bodyMesh = new THREE.Mesh(body, solidMaterial());
  bodyMesh.castShadow = true;
  const veil = new THREE.Mesh(veilGeo, veilMaterial());
  const group = new THREE.Group();
  group.name = 'beekeeper';
  group.add(bodyMesh, veil);
  return group;
}
```

- [ ] **Step 9: Create `src/render/art/registry.ts`**

```ts
import * as THREE from 'three';
import { makeHive, makeHouse } from './buildings';
import { makeFlowerBed } from './flowerbed';
import { solidMaterial } from './materials';

/**
 * Content def id -> 3D object. Deliberately source-agnostic (spec §6.4): a later sub-project can
 * register a factory that loads a .glb model for any def id without touching sim, ui or sync.
 */
export type ArtFactory = () => THREE.Object3D;

const factories = new Map<string, ArtFactory>();

export function registerArt(defId: string, factory: ArtFactory): void {
  factories.set(defId, factory);
}

export function hasArt(defId: string): boolean {
  return factories.has(defId);
}

export function createArt(defId: string): THREE.Object3D {
  const factory = factories.get(defId);
  if (!factory) throw new Error(`No art registered for "${defId}"`);
  const obj = factory();
  obj.userData.defId = defId;
  return obj;
}

export function meshOf(geometry: THREE.BufferGeometry): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, solidMaterial());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Geometry is built once and shared by every instance of a def. */
export function registerDefaultArt(): void {
  const house = makeHouse();
  const hive = makeHive();
  const wildflowerBed = makeFlowerBed('wildflower');
  registerArt('house', () => meshOf(house));
  registerArt('hive', () => meshOf(hive));
  registerArt('bed_wildflower', () => meshOf(wildflowerBed));
}
```

- [ ] **Step 10: Create `src/render/decor.ts`**

```ts
import * as THREE from 'three';
import { hexToWorld, parseHexKey, type HexKey } from '../core/hex';
import { hash2 } from '../core/rng';
import type { Tile } from '../sim/state';
import { solidMaterial } from './art/materials';
import { makePineTree, makeRock, makeRoundTree } from './art/nature';

type DecorKind = 'round' | 'pine' | 'rock';
const KINDS: readonly DecorKind[] = ['round', 'pine', 'rock'];

/** Trees and rocks as three instanced meshes (three draw calls total). */
export function createDecorLayer(tiles: Record<HexKey, Tile>, seed: number) {
  const buckets: Record<DecorKind, THREE.Matrix4[]> = { round: [], pine: [], rock: [] };
  const up = new THREE.Vector3(0, 1, 0);
  for (const [key, tile] of Object.entries(tiles)) {
    if (!tile.decor) continue;
    const h = parseHexKey(key);
    const { x, z } = hexToWorld(h);
    const r1 = hash2(h.q, h.r, seed + 11);
    const r2 = hash2(h.r, h.q, seed + 23);
    const r3 = hash2(h.q + h.r, h.q - h.r, seed + 37);
    const kind: DecorKind = tile.decor === 'rock' ? 'rock' : r1 < 0.6 ? 'round' : 'pine';
    const s = 0.8 + r2 * 0.45;
    buckets[kind].push(
      new THREE.Matrix4().compose(
        new THREE.Vector3(x + (r3 - 0.5) * 0.3, 0, z + (r1 - 0.5) * 0.3),
        new THREE.Quaternion().setFromAxisAngle(up, r2 * Math.PI * 2),
        new THREE.Vector3(s, s, s),
      ),
    );
  }

  const geometries: Record<DecorKind, THREE.BufferGeometry> = { round: makeRoundTree(), pine: makePineTree(), rock: makeRock() };
  const group = new THREE.Group();
  for (const kind of KINDS) {
    const list = buckets[kind];
    if (list.length === 0) continue;
    const mesh = new THREE.InstancedMesh(geometries[kind], solidMaterial(), list.length);
    list.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `decor-${kind}`;
    group.add(mesh);
  }

  return {
    group,
    counts: { round: buckets.round.length, pine: buckets.pine.length, rock: buckets.rock.length },
    dispose() {
      for (const g of Object.values(geometries)) g.dispose();
    },
  };
}
```

- [ ] **Step 11: Run the tests to verify they pass**

Run: `npx vitest run tests/render/art.test.ts`
Expected: PASS.

If a footprint assertion fails, shrink or move that prop's parts. **Do not relax the 0.82 bound**: props that overflow their hex overlap their neighbors.

- [ ] **Step 12: Commit**

```bash
git add src/render/art src/render/decor.ts tests/render/art.test.ts
git commit -m "feat(render): add procedural art kit, art registry and instanced decor"
```

---

### Task 16: Entity sync, fill badges, build ghost and the M2 scene

**Files:**
- Create: `src/render/sync.ts`, `src/render/badges.ts`, `src/render/ghost.ts`
- Modify: `src/render/view.ts` (full replacement), `src/main.ts` (full replacement), `src/base.css` (append badge styles)
- Test: `tests/render/sync.test.ts`, `tests/render/badges.test.ts`, `tests/render/ghost.test.ts`

**Interfaces:**
- Consumes: `createArt`, `makeBeekeeper`, `ghostMaterial`, `createDecorLayer`, `TileLayer`, `hexToWorld`, `hexKey`, `Registry`, `GameState`
- Produces:
  - `class EntitySync(parent: Group, tiles: Pick<TileLayer, 'setTile'>)` with:
    - `reconcile(state): { added: string[]; removed: string[] }`
    - `objectFor(id)`
    - `beekeeper: Group | null`
    - `update(timeSec)`
  - `class BadgeLayer` with `update(state, reg, entities: Pick<EntitySync, 'objectFor'>)` and `count`
  - `class Ghost` with `group`, `show(defId, h, valid)`, `hide()`, `clear()`, and `current` (read-only view of the ghost object for tests)
  - View (final): `interface WorldView` adds `entities`, `badges`, `ghost`, `syncEntities(state)` and `frame(state, dtSec, timeSec)`; `createWorldView(container, state, reg)`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/render/sync.test.ts
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { hex, hexKey, hexToWorld } from '../../src/core/hex';
import { registerDefaultArt } from '../../src/render/art/registry';
import { EntitySync } from '../../src/render/sync';
import { dispatch } from '../../src/sim/commands';
import { entitiesOf, newGame, reg } from '../sim/helpers';

registerDefaultArt();

describe('EntitySync', () => {
  it('creates an object per entity, positioned on its hex, plus the beekeeper', () => {
    const state = newGame(1);
    const parent = new THREE.Group();
    const tiles = { setTile: vi.fn() };
    const sync = new EntitySync(parent, tiles);
    const { added } = sync.reconcile(state);
    expect(added).toHaveLength(5);
    const [hive] = entitiesOf(state, 'hive');
    const obj = sync.objectFor(hive.id)!;
    const w = hexToWorld(hive.hex);
    expect([obj.position.x, obj.position.z]).toEqual([w.x, w.z]);
    expect(sync.beekeeper).not.toBeNull();
    expect(parent.children).toHaveLength(6);
    expect(tiles.setTile).toHaveBeenCalledTimes(5);
  });

  it('adds and removes objects as entities come and go, refreshing their tiles', () => {
    const state = newGame(1);
    const tiles = { setTile: vi.fn() };
    const sync = new EntitySync(new THREE.Group(), tiles);
    sync.reconcile(state);
    dispatch(state, reg, { type: 'place', def: 'bed_wildflower', hex: hex(1, -1) });
    expect(sync.reconcile(state).added).toHaveLength(1);
    expect(tiles.setTile).toHaveBeenLastCalledWith(hexKey(hex(1, -1)), state.tiles[hexKey(hex(1, -1))]);
    const [bed] = entitiesOf(state, 'bed_wildflower');
    dispatch(state, reg, { type: 'remove', id: bed.id });
    expect(sync.reconcile(state).removed).toEqual([bed.id]);
    expect(sync.objectFor(bed.id)).toBeUndefined();
    expect(tiles.setTile).toHaveBeenLastCalledWith(hexKey(bed.hex), { tile: 'grass', owned: true });
  });
});
```

```ts
// tests/render/badges.test.ts
// @vitest-environment jsdom
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { registerDefaultArt } from '../../src/render/art/registry';
import { BadgeLayer } from '../../src/render/badges';
import { EntitySync } from '../../src/render/sync';
import { dispatch } from '../../src/sim/commands';
import { spawnEntity } from '../../src/sim/entities';
import { hex } from '../../src/core/hex';
import { entitiesOf, newGame, reg } from '../sim/helpers';

registerDefaultArt();

describe('BadgeLayer', () => {
  it('shows each producer fill level and flags full hives', () => {
    const state = newGame(1);
    const sync = new EntitySync(new THREE.Group(), { setTile: () => {} });
    sync.reconcile(state);
    const badges = new BadgeLayer();
    badges.update(state, reg, sync);
    expect(badges.count).toBe(1);
    const [hive] = entitiesOf(state, 'hive');
    const el = () => (sync.objectFor(hive.id)!.children[0] as unknown as { element: HTMLElement }).element;
    expect(el().textContent).toContain('0%');
    hive.store = 2.5;
    badges.update(state, reg, sync);
    expect(el().textContent).toContain('50%');
    hive.store = 5;
    badges.update(state, reg, sync);
    expect(el().querySelector('.badge')!.classList.contains('full')).toBe(true);
  });

  it('drops badges for removed producers', () => {
    const state = newGame(1);
    const sync = new EntitySync(new THREE.Group(), { setTile: () => {} });
    const second = spawnEntity(state, reg, 'hive', hex(2, -1));
    sync.reconcile(state);
    const badges = new BadgeLayer();
    badges.update(state, reg, sync);
    expect(badges.count).toBe(2);
    dispatch(state, reg, { type: 'remove', id: second.id });
    sync.reconcile(state);
    badges.update(state, reg, sync);
    expect(badges.count).toBe(1);
  });
});
```

```ts
// tests/render/ghost.test.ts
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { hex } from '../../src/core/hex';
import { ghostMaterial } from '../../src/render/art/materials';
import { registerDefaultArt } from '../../src/render/art/registry';
import { Ghost } from '../../src/render/ghost';

registerDefaultArt();

const materialOf = (obj: THREE.Object3D): THREE.Material | null => {
  const found: THREE.Material[] = [];
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh) found.push(o.material as THREE.Material);
  });
  return found[0] ?? null;
};

describe('Ghost', () => {
  it('previews a def in valid/invalid tint and hides', () => {
    const ghost = new Ghost();
    ghost.show('hive', hex(1, 0), true);
    expect(ghost.group.visible).toBe(true);
    expect(materialOf(ghost.current!)).toBe(ghostMaterial('valid'));
    expect(ghost.current!.position.x).toBeCloseTo(Math.sqrt(3));
    ghost.show('hive', hex(1, 0), false);
    expect(materialOf(ghost.current!)).toBe(ghostMaterial('invalid'));
    ghost.hide();
    expect(ghost.group.visible).toBe(false);
  });

  it('swaps the preview object when the def changes', () => {
    const ghost = new Ghost();
    ghost.show('hive', hex(0, 0), true);
    const first = ghost.current;
    ghost.show('bed_wildflower', hex(0, 0), true);
    expect(ghost.current).not.toBe(first);
    expect(ghost.group.children).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/render`
Expected: FAIL with unresolved imports for `sync`, `badges` and `ghost`.

- [ ] **Step 3: Create `src/render/sync.ts`**

```ts
import * as THREE from 'three';
import { hexKey, hexToWorld } from '../core/hex';
import type { GameState } from '../sim/state';
import { makeBeekeeper } from './art/beekeeper';
import { createArt } from './art/registry';
import type { TileLayer } from './tiles';

/** The beekeeper stands at the front-right corner of this building. */
const BEEKEEPER_HOME_DEF = 'house';

/** Keeps one 3D object per entity, and refreshes the tile under anything that appears or disappears. */
export class EntitySync {
  beekeeper: THREE.Group | null = null;
  private readonly objects = new Map<string, THREE.Object3D>();

  constructor(
    private readonly parent: THREE.Group,
    private readonly tiles: Pick<TileLayer, 'setTile'>,
  ) {}

  reconcile(state: GameState): { added: string[]; removed: string[] } {
    const added: string[] = [];
    const removed: string[] = [];
    for (const [id, obj] of this.objects) {
      if (state.entities[id]) continue;
      this.parent.remove(obj);
      this.objects.delete(id);
      removed.push(id);
      const key = obj.userData.hexKey as string;
      const tile = state.tiles[key];
      if (tile) this.tiles.setTile(key, tile);
    }
    for (const entity of Object.values(state.entities)) {
      if (this.objects.has(entity.id)) continue;
      const obj = createArt(entity.def);
      const { x, z } = hexToWorld(entity.hex);
      obj.position.set(x, 0, z);
      const key = hexKey(entity.hex);
      obj.userData.entityId = entity.id;
      obj.userData.hexKey = key;
      this.parent.add(obj);
      this.objects.set(entity.id, obj);
      added.push(entity.id);
      this.tiles.setTile(key, state.tiles[key]);
    }
    this.placeBeekeeper(state);
    return { added, removed };
  }

  objectFor(id: string): THREE.Object3D | undefined {
    return this.objects.get(id);
  }

  update(timeSec: number): void {
    if (this.beekeeper) this.beekeeper.position.y = Math.abs(Math.sin(timeSec * 2.2)) * 0.03;
  }

  private placeBeekeeper(state: GameState): void {
    const home = Object.values(state.entities).find((e) => e.def === BEEKEEPER_HOME_DEF);
    if (!home) {
      if (this.beekeeper) this.parent.remove(this.beekeeper);
      this.beekeeper = null;
      return;
    }
    if (!this.beekeeper) {
      this.beekeeper = makeBeekeeper();
      this.parent.add(this.beekeeper);
    }
    const { x, z } = hexToWorld(home.hex);
    this.beekeeper.position.set(x + 0.55, 0, z + 0.55);
  }
}
```

- [ ] **Step 4: Create `src/render/badges.ts`**

```ts
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { Registry } from '../content/registry';
import type { GameState } from '../sim/state';
import type { EntitySync } from './sync';

interface Badge {
  anchor: CSS2DObject;
  badge: HTMLElement;
  fill: HTMLElement;
  label: HTMLElement;
  shown: string;
}

/** Fill-level label above each producer. HTML via CSS2DRenderer so text is crisp and shares the UI's CSS. */
export class BadgeLayer {
  private readonly badges = new Map<string, Badge>();

  get count(): number {
    return this.badges.size;
  }

  update(state: GameState, reg: Registry, entities: Pick<EntitySync, 'objectFor'>): void {
    const live = new Set<string>();
    for (const entity of Object.values(state.entities)) {
      const producer = reg.buildable(entity.def).producer;
      if (!producer) continue;
      live.add(entity.id);
      let b = this.badges.get(entity.id);
      if (!b) {
        const host = entities.objectFor(entity.id);
        if (!host) continue;
        b = this.create();
        host.add(b.anchor);
        this.badges.set(entity.id, b);
      }
      const fraction = Math.min(1, (entity.store ?? 0) / producer.capacity);
      const pct = `${Math.floor(fraction * 100)}%`;
      if (pct !== b.shown) {
        b.label.textContent = pct;
        b.fill.style.width = pct;
        b.shown = pct;
      }
      b.badge.classList.toggle('full', fraction >= 1);
    }
    for (const [id, b] of this.badges) {
      if (live.has(id)) continue;
      b.anchor.removeFromParent();
      this.badges.delete(id);
    }
  }

  private create(): Badge {
    // The CSS2DRenderer owns the anchor's transform, so animations go on the inner element.
    const anchorEl = document.createElement('div');
    anchorEl.className = 'badge-anchor';
    const badge = document.createElement('div');
    badge.className = 'badge';
    const label = document.createElement('span');
    label.className = 'badge-label';
    const bar = document.createElement('div');
    bar.className = 'badge-bar';
    const fill = document.createElement('div');
    fill.className = 'badge-fill';
    bar.append(fill);
    badge.append(label, bar);
    anchorEl.append(badge);
    const anchor = new CSS2DObject(anchorEl);
    anchor.position.set(0, 1.05, 0);
    return { anchor, badge, fill, label, shown: '' };
  }
}
```

- [ ] **Step 5: Create `src/render/ghost.ts`**

```ts
import * as THREE from 'three';
import { hexToWorld, type Hex } from '../core/hex';
import { ghostMaterial } from './art/materials';
import { createArt } from './art/registry';

/** Translucent preview of the item being placed. */
export class Ghost {
  readonly group = new THREE.Group();
  private obj: THREE.Object3D | null = null;
  private defId: string | null = null;

  get current(): THREE.Object3D | null {
    return this.obj;
  }

  show(defId: string, h: Hex, valid: boolean): void {
    if (defId !== this.defId) {
      this.clear();
      this.obj = createArt(defId);
      this.defId = defId;
      this.group.add(this.obj);
    }
    const material = ghostMaterial(valid ? 'valid' : 'invalid');
    this.obj?.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.material = material;
        o.castShadow = false;
      }
    });
    const { x, z } = hexToWorld(h);
    this.obj?.position.set(x, 0, z);
    this.group.visible = true;
  }

  hide(): void {
    this.group.visible = false;
  }

  clear(): void {
    if (this.obj) this.group.remove(this.obj);
    this.obj = null;
    this.defId = null;
  }
}
```

- [ ] **Step 6: Replace `src/render/view.ts` with the final version**

```ts
import * as THREE from 'three';
import { hexToWorld, type Hex } from '../core/hex';
import type { Registry } from '../content/registry';
import type { GameState } from '../sim/state';
import { BadgeLayer } from './badges';
import { CameraRig } from './camera';
import { createDecorLayer } from './decor';
import { Ghost } from './ghost';
import { HexHighlight } from './highlight';
import { addLights } from './lights';
import { pickHex, worldToClient } from './picking';
import { createScene, type SceneContext } from './scene';
import { EntitySync } from './sync';
import { createTileLayer, type TileLayer } from './tiles';

export interface WorldView {
  readonly ctx: SceneContext;
  readonly rig: CameraRig;
  readonly tiles: TileLayer;
  readonly highlight: HexHighlight;
  readonly entities: EntitySync;
  readonly badges: BadgeLayer;
  readonly ghost: Ghost;
  pickHex(clientX: number, clientY: number): Hex | null;
  hexToClient(h: Hex, height?: number): { x: number; y: number };
  syncEntities(state: GameState): void;
  frame(state: GameState, dtSec: number, timeSec: number): void;
}

/** Assembles the 3D world. Reads GameState; never mutates it. */
export function createWorldView(container: HTMLElement, state: GameState, reg: Registry): WorldView {
  const ctx = createScene(container);
  addLights(ctx.scene);
  const rig = new CameraRig(ctx.camera);
  const tiles = createTileLayer(state.tiles, state.seed);
  const decor = createDecorLayer(state.tiles, state.seed);
  const highlight = new HexHighlight();
  const entityRoot = new THREE.Group();
  const entities = new EntitySync(entityRoot, tiles);
  const badges = new BadgeLayer();
  const ghost = new Ghost();
  ctx.scene.add(tiles.group, decor.group, entityRoot, highlight.group, ghost.group);
  entities.reconcile(state);
  const canvas = ctx.renderer.domElement;

  return {
    ctx,
    rig,
    tiles,
    highlight,
    entities,
    badges,
    ghost,
    pickHex: (x, y) => pickHex(x, y, canvas.getBoundingClientRect(), ctx.camera, state.tiles),
    hexToClient(h, height = 0) {
      const p = hexToWorld(h);
      return worldToClient(p.x, height, p.z, ctx.camera, canvas.getBoundingClientRect());
    },
    syncEntities: (s) => {
      entities.reconcile(s);
    },
    frame(s, dtSec, timeSec) {
      rig.update(dtSec);
      entities.update(timeSec);
      badges.update(s, reg, entities);
      ctx.render();
    },
  };
}
```

- [ ] **Step 7: Append the badge styles to `src/base.css`**

```css
.badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 3px 7px 4px;
  border-radius: 8px;
  background: #fff8ec;
  color: #5a3d2b;
  box-shadow: 0 2px 6px rgba(70, 45, 20, 0.2);
  font: 800 11px/1 'Nunito', system-ui, sans-serif;
  pointer-events: none;
}

.badge-bar {
  width: 34px;
  height: 4px;
  border-radius: 2px;
  background: #f0e2c6;
  overflow: hidden;
}

.badge-fill {
  height: 100%;
  width: 0;
  background: #f2b53a;
}

.badge.full {
  background: #f2b53a;
  animation: badge-pulse 1.2s ease-in-out infinite;
}

.badge.full .badge-fill {
  background: #5a3d2b;
}

@keyframes badge-pulse {
  50% {
    transform: scale(1.12);
  }
}

@media (prefers-reduced-motion: reduce) {
  .badge.full {
    animation: none;
  }
}
```

- [ ] **Step 8: Replace `src/main.ts` with the M2 static scene**

```ts
import './base.css';
import { DEFAULT_PACKS } from './content/default';
import { createRegistry } from './content/registry';
import { createFpsMeter } from './game/fps';
import { attachInput } from './game/input';
import { startLoop } from './game/loop';
import { registerDefaultArt } from './render/art/registry';
import { createWorldView } from './render/view';
import { createInitialState } from './sim/state';

const root = document.getElementById('app');
if (!root) throw new Error('#app not found');

const reg = createRegistry(DEFAULT_PACKS);
registerDefaultArt();
const seed = Number(new URLSearchParams(location.search).get('seed')) || 1;
const state = createInitialState(seed, reg);
const view = createWorldView(root, state, reg);
const canvas = view.ctx.renderer.domElement;

const fps = createFpsMeter();
root.appendChild(fps.el);

attachInput(canvas, {
  pan: (dx, dy) => view.rig.pan(dx, dy, canvas.clientHeight),
  zoom: (deltaY) => view.rig.zoom(deltaY),
  pinch: (factor) => view.rig.zoomBy(factor),
  hover: (x, y) => {
    const h = view.pickHex(x, y);
    if (h) view.highlight.show(h, 'hover');
    else view.highlight.hide();
  },
  click: () => {},
  cancel: () => {},
  leave: () => view.highlight.hide(),
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'q' || e.key === 'Q') view.rig.rotate(-1);
  if (e.key === 'e' || e.key === 'E') view.rig.rotate(1);
});

startLoop({
  getSpeed: () => 0,
  step: () => {},
  render: (dt, time) => {
    view.frame(state, dt, time);
    fps.frame(dt);
  },
});
```

- [ ] **Step 9: Run the checks**

Run: `npm run check`
Expected: all green.

- [ ] **Step 10: Commit**

```bash
git add src/render/sync.ts src/render/badges.ts src/render/ghost.ts src/render/view.ts src/main.ts src/base.css tests/render/sync.test.ts tests/render/badges.test.ts tests/render/ghost.test.ts
git commit -m "feat(render): sync entities to the scene, add fill badges, build ghost and M2 scene"
```

---

### Task 17: ART GATE (checkpoint: stop for user sign-off)

**Files:**
- Modify (only if the user asks for changes): `src/render/art/palette.ts`, `src/render/lights.ts`, `src/render/scene.ts` (fog, tone mapping), the prop factories in `src/render/art/*`

**Interfaces:**
- Consumes: the M2 scene from Task 16.
- Produces: user sign-off on palette and lighting (spec §6.6). **UI work (Tasks 18+) does not start until the user approves.**

- [ ] **Step 1: Capture the scene**

Run `npm run dev` (or start the `dev` preview config), open `http://localhost:5173/?seed=1` at about 1280×800, and take a screenshot of the starting scene.

Check first:
- Shadows are visible under the house, hive and trees.
- Draw calls are under 100. Check with `renderer.info.render.calls` in the console, or temporarily log it.

- [ ] **Step 2: Present it side by side with the reference**

Show the user the screenshot next to the reference image they shared at the start of the project (a beekeeping hex game in a social post). If that image isn't available, ask them to share it again. Point out the specific differences you see: grass saturation, roof color, shadow softness, tile seam contrast, overall brightness.

- [ ] **Step 3: STOP and wait for the user's verdict**

Ask: "Does this look right, or what should change (colors, light, props)?" Do not continue to Task 18 without an explicit approval.

- [ ] **Step 4: Apply requested changes and repeat Steps 1–3 until approved**

Typical adjustments, in order of impact:
1. Colors in `palette.ts`.
2. `renderer.toneMappingExposure` in `scene.ts`.
3. Hemisphere and sun intensity in `lights.ts`.
4. Fog distances.

Re-run `npm run check` after each change.

- [ ] **Step 5: Commit the approved look**

```bash
git add src/render
git commit -m "style(render): tune palette and lighting after art gate review"
```

(Skip this step if nothing changed.)

---
## M4 — Playable loop

> Start only after Task 17's art gate is approved.

### Task 18: Game session (`game/session`)

**Files:**
- Create: `src/game/session.ts`
- Test: `tests/game/session.test.ts`

**Interfaces:**
- Consumes: `EventBus`, `advance`, `dispatch`, `Command`, `CommandResult`, `GameEvent`, `GameState`, `Registry`
- Produces: `class Session(reg, state, strict = import.meta.env.DEV)` with:
  - `readonly events: EventBus<GameEvent>`
  - `state`
  - `dispatch(cmd): CommandResult` (emits events and notifies change listeners only on success)
  - `step(ticks): void` (advances the sim, emits events, notifies)
  - `onChange(fn): () => void`
  - When the sim throws: rethrow if `strict`; otherwise `console.error` and continue (`dispatch` then returns `{ ok: false, reason: 'internal_error' }`).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/game/session.test.ts
import { describe, expect, it, vi } from 'vitest';
import { hex } from '../../src/core/hex';
import { Session } from '../../src/game/session';
import { newGame, reg } from '../sim/helpers';

const placeBed = { type: 'place', def: 'bed_wildflower', hex: hex(1, -1) } as const;

describe('Session', () => {
  it('emits events and notifies listeners on a successful command', () => {
    const session = new Session(reg, newGame(1), true);
    const seen: string[] = [];
    session.events.onAny((e) => seen.push(e.type));
    const changed = vi.fn();
    session.onChange(changed);
    expect(session.dispatch(placeBed).ok).toBe(true);
    expect(seen).toEqual(['entityPlaced']);
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('stays quiet on a rejected command', () => {
    const session = new Session(reg, newGame(1), true);
    const changed = vi.fn();
    session.onChange(changed);
    session.events.onAny(changed);
    expect(session.dispatch({ type: 'harvestAll' })).toEqual({ ok: false, reason: 'nothing_to_harvest' });
    expect(changed).not.toHaveBeenCalled();
  });

  it('steps the sim and forwards its events', () => {
    const session = new Session(reg, newGame(1), true);
    const seen: string[] = [];
    session.events.onAny((e) => seen.push(e.type));
    session.step(600);
    expect(session.state.clock.tick).toBe(600);
    expect(seen).toContain('dayStarted');
  });

  it('ignores zero-tick steps', () => {
    const session = new Session(reg, newGame(1), true);
    const changed = vi.fn();
    session.onChange(changed);
    session.step(0);
    expect(changed).not.toHaveBeenCalled();
  });

  it('rethrows sim invariant errors in strict (dev) mode', () => {
    const session = new Session(reg, newGame(1), true);
    session.state.entities.e1.def = 'missing';
    expect(() => session.step(1)).toThrow();
  });

  it('logs and keeps running in lenient (production) mode', () => {
    const session = new Session(reg, newGame(1), false);
    session.state.entities.e1.def = 'missing';
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => session.step(1)).not.toThrow();
    expect(session.dispatch({ type: 'harvest', id: 'e1' })).toEqual({ ok: false, reason: 'internal_error' });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/game/session.test.ts`
Expected: FAIL with `Failed to resolve import "../../src/game/session"`.

- [ ] **Step 3: Implement `src/game/session.ts`**

```ts
import { EventBus } from '../core/events';
import type { Registry } from '../content/registry';
import { advance } from '../sim/advance';
import { dispatch, type Command, type CommandResult } from '../sim/commands';
import type { GameEvent } from '../sim/events';
import type { GameState } from '../sim/state';

/** Owns the live GameState: routes commands and ticks into the sim and fans out events. */
export class Session {
  readonly events = new EventBus<GameEvent>();
  private readonly listeners = new Set<() => void>();

  constructor(
    readonly reg: Registry,
    public state: GameState,
    private readonly strict: boolean = import.meta.env.DEV,
  ) {}

  dispatch(cmd: Command): CommandResult {
    let result: CommandResult;
    try {
      result = dispatch(this.state, this.reg, cmd);
    } catch (err) {
      this.fail(err);
      return { ok: false, reason: 'internal_error' };
    }
    if (result.ok) {
      for (const e of result.events) this.events.emit(e);
      this.notify();
    }
    return result;
  }

  step(ticks: number): void {
    if (ticks <= 0) return;
    let events: GameEvent[];
    try {
      events = advance(this.state, this.reg, ticks);
    } catch (err) {
      this.fail(err);
      return;
    }
    for (const e of events) this.events.emit(e);
    this.notify();
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify(): void {
    for (const fn of [...this.listeners]) fn();
  }

  /** Spec §9: sim invariant broken -> throw in dev, log and continue in production. */
  private fail(err: unknown): void {
    if (this.strict) throw err;
    console.error('[sim] invariant broken; continuing', err);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/game/session.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/session.ts tests/game/session.test.ts
git commit -m "feat(game): add session that routes commands and ticks and fans out events"
```

---

### Task 19: UI foundation: DOM helper, strings, icons, formatting, feedback, styles

**Files:**
- Create: `src/ui/h.ts`, `src/ui/strings/en.ts`, `src/ui/i18n.ts`, `src/ui/format.ts`, `src/ui/icons.ts`, `src/ui/feedback.ts`, `src/ui/types.ts`, `src/ui/styles.css`
- Test: `tests/ui/foundation.test.ts`

**Interfaces:**
- Consumes: `REJECT_REASONS`, `RejectReason`, `Command`, `CommandResult`, `GameEvent`, `GameState`, `Registry`, `Season`
- Produces:
  - DOM helpers: `h(tag, props?, ...children)`, `setText(el, text)` (writes only when changed)
  - Strings: `en` (string table), `type StringKey`, `t(key: StringKey, vars?)`, `tx(key: string, vars?)` (falls back to the key)
  - Formatting: `formatKg(n)` (floor to 0.1, one decimal), `formatCoins(n)` (floor), `formatRate(n)` (two decimals)
  - Icons: `type IconName`, `icon(name): SVGSVGElement`
  - Feedback: `type ToastKind = 'info' | 'success' | 'error'`, `reasonText(reason)`, `toastForEvent(e): { text; kind } | null`
  - `interface UiDeps { reg; getState(); dispatch(cmd); startPlacing(defId); resetView(); resetSave() }`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/ui/foundation.test.ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { REJECT_REASONS } from '../../src/sim/commands';
import { reasonText, toastForEvent } from '../../src/ui/feedback';
import { formatCoins, formatKg, formatRate } from '../../src/ui/format';
import { h, setText } from '../../src/ui/h';
import { t, tx } from '../../src/ui/i18n';
import { icon } from '../../src/ui/icons';

describe('h()', () => {
  it('builds elements with classes, attributes, listeners and children', () => {
    const onClick = vi.fn();
    const el = h('button', { class: 'btn', 'aria-label': 'Go', disabled: true, onclick: onClick }, 'Go ', 3, null, false);
    expect(el.className).toBe('btn');
    expect(el.getAttribute('aria-label')).toBe('Go');
    expect(el.disabled).toBe(true);
    expect(el.textContent).toBe('Go 3');
    el.disabled = false;
    el.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('setText only writes when the text changes', () => {
    const el = h('span', null, 'a');
    const node = el.firstChild;
    setText(el, 'a');
    expect(el.firstChild).toBe(node);
    setText(el, 'b');
    expect(el.textContent).toBe('b');
  });
});

describe('strings', () => {
  it('interpolates variables', () => {
    expect(t('hud.dayYear', { day: 3, year: 1 })).toBe('Day 3 · Year 1');
  });

  it('falls back to the key for unknown runtime keys', () => {
    expect(tx('def.castle')).toBe('def.castle');
    expect(tx('def.hive')).toBe('Beehive');
  });

  it('has a message for every rejection reason', () => {
    for (const reason of REJECT_REASONS) expect(reasonText(reason)).not.toBe(`reason.${reason}`);
  });
});

describe('formatting', () => {
  it('floors kg to one decimal without float artifacts', () => {
    expect(formatKg(0)).toBe('0.0');
    expect(formatKg(1.25)).toBe('1.2');
    expect(formatKg(0.7 - 1e-12)).toBe('0.7');
    expect(formatKg(5)).toBe('5.0');
  });

  it('floors coins and shows rates with two decimals', () => {
    expect(formatCoins(72.9)).toBe('72');
    expect(formatCoins(20 - 1e-12)).toBe('20');
    expect(formatRate(0.75)).toBe('0.75');
  });
});

describe('icons', () => {
  it('returns an inline, decorative SVG', () => {
    const svg = icon('coin');
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.childNodes.length).toBeGreaterThan(0);
  });
});

describe('feedback', () => {
  it('turns game events into toasts', () => {
    expect(toastForEvent({ type: 'harvested', resource: 'honey_wildflower', amount: 3.25 })).toEqual({ text: '+3.2 kg', kind: 'success' });
    expect(toastForEvent({ type: 'sold', resource: 'honey_wildflower', amount: 3.2, coins: 48 })).toEqual({ text: '+48 coins', kind: 'success' });
    expect(toastForEvent({ type: 'producerFull', id: 'e1' })?.kind).toBe('info');
    expect(toastForEvent({ type: 'safetyNetGranted', coins: 15 })?.text).toContain('15');
    expect(toastForEvent({ type: 'speedChanged', speed: 2 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/ui`
Expected: FAIL with unresolved imports under `src/ui/`.

- [ ] **Step 3: Create `src/ui/h.ts`**

```ts
type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown>;

/**
 * Tiny element builder:
 * - `class` sets className
 * - `on*` functions become listeners
 * - `true` sets an empty attribute
 * - `false`, `null` and `undefined` are skipped
 */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'class') el.className = String(value);
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value as EventListener);
      else el.setAttribute(key, value === true ? '' : String(value));
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

/** Avoids needless DOM writes when a value hasn't changed (the HUD updates every tick). */
export function setText(el: Element, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}
```

- [ ] **Step 4: Create `src/ui/strings/en.ts`**

```ts
export const en = {
  'hud.coins': 'Coins',
  'hud.honey': 'Honey',
  'hud.kg': '{kg} kg',
  'hud.dayYear': 'Day {day} · Year {year}',
  'hud.clock': 'Calendar and game speed',
  'hud.pause': 'Pause',
  'hud.speed': '{n}x',
  'hud.speedLabel': '{n}x speed',
  'hud.resetView': 'Reset view',
  'hud.settings': 'Settings',

  'season.spring': 'Spring',
  'season.summer': 'Summer',
  'season.autumn': 'Autumn',
  'season.winter': 'Winter',

  'toolbar.label': 'Actions',
  'toolbar.shop': 'Shop',
  'toolbar.market': 'Market',
  'toolbar.harvestAll': 'Harvest All',

  'panel.close': 'Close',

  'shop.title': 'Shop',
  'shop.hint': 'Pick something, then click a tile to place it. Right-click or Esc to stop.',
  'shop.cost': '{coins}',

  'market.title': 'Market',
  'market.have': 'You have {kg} kg',
  'market.price': '{price} coins per kg',
  'market.less': 'Less',
  'market.more': 'More',
  'market.sell': 'Sell {kg} kg',
  'market.sellAll': 'Sell all',
  'market.preview': '= {coins} coins',
  'market.nothing': 'Nothing to sell yet. Harvest some honey first.',

  'def.hive': 'Beehive',
  'def.bed_wildflower': 'Wildflower bed',
  'def.house': 'Beekeeper’s house',
  'defDesc.hive': 'Turns nectar from beds next to it into honey.',
  'defDesc.bed_wildflower': 'Makes nectar for the hives next to it.',
  'defDesc.house': 'Home sweet home.',

  'resource.coins': 'Coins',
  'resource.honey_wildflower': 'Wildflower honey',

  'inspect.label': 'Details',
  'inspect.fill': '{have} / {cap} kg',
  'inspect.rate': '{rate} kg/day',
  'inspect.sources': '{count} flower beds in range',
  'inspect.shared': '{n} shared with another hive',
  'inspect.yield': '{n} nectar/day',
  'inspect.feedsNone': 'No hive next to it: its nectar is wasted',
  'inspect.feedsOne': 'Feeds 1 hive',
  'inspect.feedsMany': 'Shared by {n} hives',
  'inspect.harvest': 'Harvest',
  'inspect.remove': 'Remove (+{coins})',
  'inspect.confirm': 'Confirm remove',

  'hint.place': '{name} · {coins} coins',

  'toast.harvested': '+{kg} kg',
  'toast.sold': '+{coins} coins',
  'toast.full': 'A hive is full. Time to harvest!',
  'toast.safetyNet': 'The village lends you {coins} coins to get going again.',

  'reason.unknown_def': 'Unknown item',
  'reason.not_purchasable': 'That isn’t for sale',
  'reason.out_of_bounds': 'Outside the map',
  'reason.not_owned': 'You don’t own this land yet',
  'reason.tile_occupied': 'Something is already here',
  'reason.tile_not_buildable': 'Can’t build on this tile',
  'reason.insufficient_funds': 'Not enough coins',
  'reason.unknown_entity': 'That’s no longer here',
  'reason.not_removable': 'This can’t be removed',
  'reason.last_producer': 'You need at least one hive',
  'reason.nothing_to_harvest': 'Nothing to harvest yet',
  'reason.invalid_amount': 'Pick an amount first',
  'reason.insufficient_resource': 'You don’t have that much',
  'reason.not_sellable': 'The market doesn’t buy that',
  'reason.invalid_speed': 'Unknown speed',
  'reason.internal_error': 'Something went wrong',

  'settings.reset': 'Reset save',
  'settings.resetConfirm': 'Start over? Your current game will be deleted.',

  'notice.noSave': 'Progress won’t be saved in this browser.',
  'notice.corruptSave': 'Couldn’t load your save, so a new game was started.',

  'fatal.noWebglTitle': 'Your browser can’t show this game',
  'fatal.noWebglBody': 'It needs WebGL 2. Try an up-to-date Chrome, Firefox, Safari or Edge.',
  'fatal.contextLost': 'Graphics reset…',
  'fatal.reload': 'Reload',
} as const;
```

- [ ] **Step 5: Create `src/ui/i18n.ts`, `src/ui/format.ts` and `src/ui/types.ts`**

```ts
// src/ui/i18n.ts
import { en } from './strings/en';

export type StringKey = keyof typeof en;
type Vars = Record<string, string | number>;

const table: Record<string, string> = en;

function fill(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/** Compile-time-checked lookup. */
export function t(key: StringKey, vars?: Vars): string {
  return fill(table[key], vars);
}

/** For keys built at runtime (def ids, resource ids). Falls back to the key itself. */
export function tx(key: string, vars?: Vars): string {
  const template = table[key];
  return template === undefined ? key : fill(template, vars);
}
```

```ts
// src/ui/format.ts
const EPS = 1e-6;

/** Floors so the UI never shows more than you have; the epsilon absorbs float noise (0.7 - 1e-12). */
export const formatKg = (kg: number): string => (Math.floor(kg * 10 + EPS) / 10).toFixed(1);
export const formatCoins = (coins: number): string => String(Math.floor(coins + EPS));
export const formatRate = (perDay: number): string => perDay.toFixed(2);
```

```ts
// src/ui/types.ts
import type { Registry } from '../content/registry';
import type { Command, CommandResult } from '../sim/commands';
import type { GameState } from '../sim/state';

/** Everything the UI may use. Injected by game/, so ui/ never imports game/ (layer rule). */
export interface UiDeps {
  reg: Registry;
  getState(): GameState;
  dispatch(cmd: Command): CommandResult;
  startPlacing(defId: string): void;
  resetView(): void;
  resetSave(): void;
}
```

- [ ] **Step 6: Create `src/ui/icons.ts`**

```ts
/** 24×24 stroke icons as inline SVG markup: no image files. */
const ICONS = {
  coin: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/>',
  honey: '<path d="M8 4h8M9 4v2.5C6.5 7.5 5 9.5 5 12.5V17a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-4.5c0-3-1.5-5-4-6V4"/><path d="M5.5 12.5h13"/>',
  cart: '<path d="M3 4h2.5l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h7.9a1.5 1.5 0 0 0 1.5-1.1L20 8H6.3"/><circle cx="9.5" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>',
  basket: '<path d="M4 10h16l-1.6 8.4a2 2 0 0 1-2 1.6H7.6a2 2 0 0 1-2-1.6z"/><path d="M8 10l3-6M16 10l-3-6M9 14v3M12 14v3M15 14v3"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  hive: '<path d="M5 9h14v10H5zM4 9l1-3h14l1 3M5 13h14M10 19v-2.5h4V19"/>',
  flower: '<circle cx="12" cy="8" r="2"/><circle cx="12" cy="4.5" r="1.8"/><circle cx="15.3" cy="8" r="1.8"/><circle cx="8.7" cy="8" r="1.8"/><circle cx="12" cy="11.5" r="1.8"/><path d="M12 13.3V21M12 17.5c-1.8 0-3.2-1-3.7-2.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  minus: '<path d="M6 12h12"/>',
  plus: '<path d="M6 12h12M12 6v12"/>',
} as const;

export type IconName = keyof typeof ICONS;

export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'icon');
  svg.innerHTML = ICONS[name];
  return svg;
}
```

- [ ] **Step 7: Create `src/ui/feedback.ts`**

```ts
import type { RejectReason } from '../sim/commands';
import type { GameEvent } from '../sim/events';
import { formatCoins, formatKg } from './format';
import { t } from './i18n';

export type ToastKind = 'info' | 'success' | 'error';

export function reasonText(reason: RejectReason): string {
  return t(`reason.${reason}`);
}

export function toastForEvent(e: GameEvent): { text: string; kind: ToastKind } | null {
  switch (e.type) {
    case 'harvested':
      return { text: t('toast.harvested', { kg: formatKg(e.amount) }), kind: 'success' };
    case 'sold':
      return { text: t('toast.sold', { coins: formatCoins(e.coins) }), kind: 'success' };
    case 'producerFull':
      return { text: t('toast.full'), kind: 'info' };
    case 'safetyNetGranted':
      return { text: t('toast.safetyNet', { coins: formatCoins(e.coins) }), kind: 'info' };
    default:
      return null;
  }
}
```

- [ ] **Step 8: Create `src/ui/styles.css`**

```css
:root {
  --cream: #fff8ec;
  --cream-2: #f6ead3;
  --brown: #5a3d2b;
  --brown-soft: #8a6a52;
  --honey: #f2b53a;
  --honey-deep: #d9951c;
  --ok: #3f7f2f;
  --bad: #c9443c;
  --radius: 14px;
  --shadow: 0 6px 18px rgba(70, 45, 20, 0.18), 0 1px 3px rgba(70, 45, 20, 0.12);
  --font: 'Nunito', system-ui, -apple-system, 'Segoe UI', sans-serif;
}

.ui { position: absolute; inset: 0; pointer-events: none; font-family: var(--font); color: var(--brown); }
.ui [hidden] { display: none !important; }
.ui button, .ui .pill, .ui .clock, .ui .panel-host, .ui .inspect, .ui .toast, .ui .settings-menu { pointer-events: auto; }
.icon { width: 20px; height: 20px; flex: none; }

.btn { font: inherit; font-weight: 800; border: 0; border-radius: 10px; padding: 8px 14px; background: var(--cream-2); color: var(--brown); cursor: pointer; }
.btn:hover:not(:disabled) { background: #f0dfbf; }
.btn:disabled { opacity: 0.45; cursor: default; }
.btn.primary { background: var(--honey); }
.btn.primary:hover:not(:disabled) { background: var(--honey-deep); color: #fff; }
.btn:focus-visible, .hexbtn:focus-visible, .iconbtn:focus-visible, .speed:focus-visible { outline: 3px solid var(--honey-deep); outline-offset: 2px; }

/* HUD */
.hud-left { position: absolute; top: 14px; left: 14px; display: flex; gap: 10px; }
.pill { display: flex; align-items: center; gap: 8px; min-width: 76px; padding: 8px 16px 8px 10px; background: var(--cream); border-radius: 999px; box-shadow: var(--shadow); font-weight: 800; font-size: 18px; }
.pill .icon { color: var(--honey-deep); }
.clock { position: absolute; top: 14px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 14px; padding: 8px 10px 8px 14px; background: var(--cream); border-radius: var(--radius); box-shadow: var(--shadow); }
.clock > .icon { color: var(--honey-deep); }
.clock-season { font-weight: 800; font-size: 16px; }
.clock-day { font-size: 12px; font-weight: 700; color: var(--brown-soft); }
.clock-progress { height: 4px; margin-top: 4px; border-radius: 2px; background: var(--cream-2); overflow: hidden; }
.clock-progress > div { height: 100%; width: 0; background: var(--honey); }
.speeds { display: flex; gap: 4px; }
.speed { display: grid; place-items: center; min-width: 34px; height: 30px; border: 0; border-radius: 8px; background: transparent; color: var(--brown-soft); font: inherit; font-weight: 800; font-size: 13px; cursor: pointer; }
.speed .icon { width: 16px; height: 16px; }
.speed.active { background: var(--honey); color: var(--brown); }
.hud-right { position: absolute; top: 14px; right: 14px; display: flex; gap: 8px; }
.settings { position: relative; }
.settings-menu { position: absolute; top: 50px; right: 0; padding: 8px; background: var(--cream); border-radius: var(--radius); box-shadow: var(--shadow); white-space: nowrap; }
.iconbtn { display: grid; place-items: center; width: 42px; height: 42px; border: 0; border-radius: 50%; background: var(--cream); color: var(--brown); box-shadow: var(--shadow); cursor: pointer; }
.iconbtn.small { width: 32px; height: 32px; box-shadow: none; background: var(--cream-2); }
.iconbtn:disabled { opacity: 0.4; cursor: default; }

/* Toolbar */
.toolbar { position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); display: flex; align-items: flex-end; gap: 14px; }
.hexbtn { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 0; border: 0; background: none; color: var(--brown); font: inherit; cursor: pointer; filter: drop-shadow(0 4px 8px rgba(70, 45, 20, 0.25)); }
.hexbtn .hex { display: grid; place-items: center; width: 64px; height: 72px; background: var(--cream); clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); }
.hexbtn .hex .icon { width: 28px; height: 28px; }
.hexbtn.primary .hex { width: 84px; height: 94px; background: var(--honey); }
.hexbtn .label { padding: 2px 10px; border-radius: 999px; background: var(--cream); font-size: 12px; font-weight: 800; }
.hexbtn .badge-kg { position: absolute; top: -6px; right: -12px; padding: 2px 7px; border-radius: 999px; background: var(--brown); color: var(--cream); font-size: 11px; font-weight: 800; }
.hexbtn:disabled { cursor: default; }
.hexbtn:disabled .hex { opacity: 0.55; }
.hexbtn:not(:disabled):hover .hex { background: #fff; }
.hexbtn.primary:not(:disabled):hover .hex { background: var(--honey-deep); }

/* Panels */
.panel-host { position: absolute; left: 50%; bottom: 150px; transform: translateX(-50%); width: min(360px, calc(100vw - 32px)); padding: 14px 16px 16px; background: var(--cream); border-radius: var(--radius); box-shadow: var(--shadow); }
.panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.panel-head h2 { margin: 0; font-size: 18px; font-weight: 800; }
.muted { margin: 0; color: var(--brown-soft); font-size: 13px; font-weight: 700; }
.shop-item { display: flex; align-items: center; gap: 12px; width: 100%; margin-top: 8px; padding: 10px; text-align: left; }
.shop-item > .icon { width: 28px; height: 28px; color: var(--honey-deep); }
.shop-text { display: flex; flex-direction: column; }
.shop-item .name { font-weight: 800; }
.shop-item .desc { font-size: 12px; font-weight: 600; color: var(--brown-soft); }
.shop-item .cost { display: flex; align-items: center; gap: 4px; margin-left: auto; font-weight: 800; white-space: nowrap; }
.shop-item .cost .icon { width: 16px; height: 16px; color: var(--honey-deep); }
.market-row { display: grid; gap: 8px; }
.market-row .name { font-weight: 800; }
.stepper { display: flex; align-items: center; gap: 8px; }
.stepper .amount { min-width: 80px; text-align: center; font-size: 18px; font-weight: 800; }
.market-actions { display: flex; gap: 8px; }

/* Inspect popover */
.inspect { position: absolute; width: 240px; padding: 12px 14px; background: var(--cream); border-radius: var(--radius); box-shadow: var(--shadow); }
.inspect h3 { margin: 0 0 6px; font-size: 16px; font-weight: 800; }
.inspect .row { margin: 2px 0; font-size: 13px; font-weight: 700; }
.inspect .actions { display: flex; gap: 8px; margin-top: 10px; }

/* Toasts */
.toasts { position: absolute; top: 76px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 6px; }
.toast { padding: 8px 14px; border-radius: 999px; background: var(--cream); box-shadow: var(--shadow); font-size: 14px; font-weight: 800; animation: toast-in 0.18s ease-out; }
.toast.success { color: var(--ok); }
.toast.error { color: var(--bad); }
@keyframes toast-in { from { opacity: 0; transform: translateY(-6px); } }

/* Cursor hint while placing */
.cursor-hint { position: absolute; padding: 4px 10px; border-radius: 8px; background: var(--cream); box-shadow: var(--shadow); font-size: 12px; font-weight: 800; white-space: nowrap; transform: translate(14px, 14px); }
.cursor-hint.valid { color: var(--ok); }
.cursor-hint.invalid { color: var(--bad); }

/* Fatal screen and overlay */
.fatal, .overlay { position: absolute; inset: 0; z-index: 10; display: grid; place-items: center; background: rgba(40, 30, 20, 0.45); font-family: var(--font); }
.fatal-card, .overlay-card { max-width: 420px; padding: 24px 28px; border-radius: var(--radius); background: var(--cream); color: var(--brown); box-shadow: var(--shadow); text-align: center; }

@media (prefers-reduced-motion: reduce) {
  .toast { animation: none; }
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx vitest run tests/ui`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/ui tests/ui/foundation.test.ts
git commit -m "feat(ui): add DOM helper, strings, icons, formatting, feedback and styles"
```

---

### Task 20: HUD, toolbar and toasts

**Files:**
- Create: `src/ui/toasts.ts`, `src/ui/hud.ts`, `src/ui/toolbar.ts`, `tests/ui/helpers.ts`
- Test: `tests/ui/hud.test.ts`, `tests/ui/toolbar.test.ts`, `tests/ui/toasts.test.ts`

**Interfaces:**
- Consumes: `h`, `setText`, `t`, `icon`, `formatKg`, `formatCoins`, `calendar`, `COINS`, `UiDeps`, `ToastKind`
- Produces:
  - Toasts:
    - `TOAST_MS = 2500`
    - `interface ToastOptions { dedupeMs?: number }`
    - `interface Toasts { el; show(text, kind?, opts?) }`
    - `createToasts(now?: () => number): Toasts`. It shows at most 3 at a time and drops identical text within `dedupeMs` (default 1000).
  - HUD: `createHud(deps): { el; update() }`. Elements carry `data-testid` values `coins`, `honey`, `season`, `day`, `progress`.
  - Toolbar: `createToolbar(deps, actions: { openShop(); openMarket() }): { el; update() }`
  - Test helper: `makeDeps()` returns `{ deps, state }`, where `deps.dispatch` is a `vi.fn` wrapping the real sim dispatch.

- [ ] **Step 1: Create the UI test helper**

```ts
// tests/ui/helpers.ts
import { vi } from 'vitest';
import { dispatch, type Command } from '../../src/sim/commands';
import type { UiDeps } from '../../src/ui/types';
import { newGame, reg } from '../sim/helpers';

export function makeDeps() {
  const state = newGame(1);
  const deps = {
    reg,
    getState: () => state,
    dispatch: vi.fn((cmd: Command) => dispatch(state, reg, cmd)),
    startPlacing: vi.fn(),
    resetView: vi.fn(),
    resetSave: vi.fn(),
  } satisfies UiDeps;
  return { deps, state };
}
```

- [ ] **Step 2: Write the failing tests**

```ts
// tests/ui/hud.test.ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createHud } from '../../src/ui/hud';
import { makeDeps } from './helpers';

const text = (root: HTMLElement, id: string) => root.querySelector(`[data-testid="${id}"]`)!.textContent;

describe('HUD', () => {
  it('shows coins, honey and the calendar, and keeps them current', () => {
    const { deps, state } = makeDeps();
    const hud = createHud(deps);
    hud.update();
    expect(text(hud.el, 'coins')).toBe('60');
    expect(text(hud.el, 'honey')).toBe('0.0 kg');
    expect(text(hud.el, 'season')).toBe('Spring');
    expect(text(hud.el, 'day')).toBe('Day 1 · Year 1');

    state.inventory.coins = 72.9;
    state.inventory.honey_wildflower = 1.25;
    state.clock.tick = 600 * 29 + 300;
    hud.update();
    expect(text(hud.el, 'coins')).toBe('72');
    expect(text(hud.el, 'honey')).toBe('1.2 kg');
    expect(text(hud.el, 'season')).toBe('Summer');
    expect(text(hud.el, 'day')).toBe('Day 30 · Year 1');
    expect(hud.el.querySelector<HTMLElement>('[data-testid="progress"]')!.style.width).toBe('50%');
  });

  it('changes speed and marks the active button', () => {
    const { deps } = makeDeps();
    const hud = createHud(deps);
    hud.update();
    const twoX = hud.el.querySelector<HTMLButtonElement>('[aria-label="2x speed"]')!;
    twoX.click();
    expect(deps.dispatch).toHaveBeenCalledWith({ type: 'setSpeed', speed: 2 });
    hud.update();
    expect(twoX.classList.contains('active')).toBe(true);
    expect(twoX.getAttribute('aria-pressed')).toBe('true');
  });

  it('resets the view and offers a save reset in settings', () => {
    const { deps } = makeDeps();
    const hud = createHud(deps);
    hud.el.querySelector<HTMLButtonElement>('[aria-label="Reset view"]')!.click();
    expect(deps.resetView).toHaveBeenCalled();
    hud.el.querySelector<HTMLButtonElement>('[aria-label="Settings"]')!.click();
    const reset = [...hud.el.querySelectorAll('button')].find((b) => b.textContent === 'Reset save')!;
    expect(reset.closest('[hidden]')).toBeNull();
    reset.click();
    expect(deps.resetSave).toHaveBeenCalled();
  });
});
```

```ts
// tests/ui/toolbar.test.ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createToolbar } from '../../src/ui/toolbar';
import { entitiesOf } from '../sim/helpers';
import { makeDeps } from './helpers';

describe('toolbar', () => {
  it('opens the shop and market', () => {
    const { deps } = makeDeps();
    const actions = { openShop: vi.fn(), openMarket: vi.fn() };
    const bar = createToolbar(deps, actions);
    const [shop, market] = bar.el.querySelectorAll('button');
    shop.click();
    market.click();
    expect(actions.openShop).toHaveBeenCalled();
    expect(actions.openMarket).toHaveBeenCalled();
  });

  it('enables Harvest All only when honey is waiting, showing how much', () => {
    const { deps, state } = makeDeps();
    const bar = createToolbar(deps, { openShop: vi.fn(), openMarket: vi.fn() });
    bar.update();
    const harvest = bar.el.querySelector<HTMLButtonElement>('.hexbtn.primary')!;
    expect(harvest.disabled).toBe(true);
    entitiesOf(state, 'hive')[0].store = 2.5;
    bar.update();
    expect(harvest.disabled).toBe(false);
    expect(harvest.textContent).toContain('2.5 kg');
    harvest.click();
    expect(deps.dispatch).toHaveBeenCalledWith({ type: 'harvestAll' });
  });
});
```

```ts
// tests/ui/toasts.test.ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOAST_MS, createToasts } from '../../src/ui/toasts';

describe('toasts', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows up to three and dismisses them after a while', () => {
    let clock = 0;
    const toasts = createToasts(() => clock);
    for (const text of ['one', 'two', 'three', 'four']) {
      toasts.show(text);
      clock += 2000;
    }
    expect(toasts.el.children).toHaveLength(3);
    expect(toasts.el.textContent).not.toContain('one');
    vi.advanceTimersByTime(TOAST_MS + 100);
    expect(toasts.el.children).toHaveLength(0);
  });

  it('drops identical messages inside the dedupe window', () => {
    let clock = 0;
    const toasts = createToasts(() => clock);
    toasts.show('same');
    clock = 500;
    toasts.show('same');
    expect(toasts.el.children).toHaveLength(1);
    clock = 1600;
    toasts.show('same');
    expect(toasts.el.children).toHaveLength(2);
    toasts.show('full', 'info', { dedupeMs: 10_000 });
    clock = 9000;
    toasts.show('full', 'info', { dedupeMs: 10_000 });
    expect([...toasts.el.children].filter((c) => c.textContent === 'full')).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/ui`
Expected: FAIL with unresolved imports for `hud`, `toolbar` and `toasts`.

- [ ] **Step 4: Create `src/ui/toasts.ts`**

```ts
import type { ToastKind } from './feedback';
import { h } from './h';

export const TOAST_MS = 2500;
const MAX_TOASTS = 3;

export interface ToastOptions {
  /** Identical text shown again within this window is dropped. */
  dedupeMs?: number;
}

export interface Toasts {
  el: HTMLElement;
  show(text: string, kind?: ToastKind, opts?: ToastOptions): void;
}

export function createToasts(now: () => number = () => performance.now()): Toasts {
  const el = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
  const lastShown = new Map<string, number>();
  return {
    el,
    show(text, kind = 'info', opts = {}) {
      const at = now();
      const last = lastShown.get(text);
      if (last !== undefined && at - last < (opts.dedupeMs ?? 1000)) return;
      lastShown.set(text, at);
      const toast = h('div', { class: `toast ${kind}` }, text);
      el.append(toast);
      while (el.children.length > MAX_TOASTS) el.firstElementChild?.remove();
      setTimeout(() => toast.remove(), TOAST_MS);
    },
  };
}
```

- [ ] **Step 5: Create `src/ui/hud.ts`**

```ts
import { COINS } from '../content/types';
import { calendar } from '../sim/clock';
import type { Speed } from '../sim/state';
import { formatCoins, formatKg } from './format';
import { h, setText } from './h';
import { t } from './i18n';
import { icon } from './icons';
import type { UiDeps } from './types';

const SPEEDS: readonly Speed[] = [0, 1, 2, 4];

function kgOnHand(deps: UiDeps): number {
  const state = deps.getState();
  let kg = 0;
  for (const r of deps.reg.resources.values()) if (r.unit === 'kg') kg += state.inventory[r.id] ?? 0;
  return kg;
}

/** Top bar: resources (left), calendar + speed (center), view/settings (right). */
export function createHud(deps: UiDeps): { el: HTMLElement; update(): void } {
  const coins = h('span', { 'data-testid': 'coins' });
  const honey = h('span', { 'data-testid': 'honey' });
  const left = h(
    'div',
    { class: 'hud-left' },
    h('div', { class: 'pill', title: t('hud.coins') }, icon('coin'), coins),
    h('div', { class: 'pill', title: t('hud.honey') }, icon('honey'), honey),
  );

  const season = h('div', { class: 'clock-season', 'data-testid': 'season' });
  const day = h('div', { class: 'clock-day', 'data-testid': 'day' });
  const progress = h('div', { 'data-testid': 'progress' });
  const speedButtons = SPEEDS.map((speed) => {
    const label = speed === 0 ? t('hud.pause') : t('hud.speedLabel', { n: speed });
    return h(
      'button',
      {
        class: 'speed', type: 'button', 'aria-label': label, title: label, 'aria-pressed': 'false',
        onclick: () => deps.dispatch({ type: 'setSpeed', speed }),
      },
      speed === 0 ? icon('pause') : t('hud.speed', { n: speed }),
    );
  });
  const clock = h(
    'div',
    { class: 'clock', role: 'group', 'aria-label': t('hud.clock') },
    icon('flower'),
    h('div', { class: 'clock-text' }, season, day, h('div', { class: 'clock-progress' }, progress)),
    h('div', { class: 'speeds' }, ...speedButtons),
  );

  const menu = h('div', { class: 'settings-menu', hidden: true });
  const settingsButton = h(
    'button',
    { class: 'iconbtn', type: 'button', 'aria-label': t('hud.settings'), title: t('hud.settings'), 'aria-expanded': 'false' },
    icon('gear'),
  );
  settingsButton.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    settingsButton.setAttribute('aria-expanded', String(!menu.hidden));
  });
  menu.append(
    h('button', {
      class: 'btn', type: 'button',
      onclick: () => {
        menu.hidden = true;
        deps.resetSave();
      },
    }, t('settings.reset')),
  );
  const right = h(
    'div',
    { class: 'hud-right' },
    h('button', {
      class: 'iconbtn', type: 'button', 'aria-label': t('hud.resetView'), title: t('hud.resetView'),
      onclick: () => deps.resetView(),
    }, icon('target')),
    h('div', { class: 'settings' }, settingsButton, menu),
  );

  return {
    el: h('div', { class: 'hud' }, left, clock, right),
    update() {
      const state = deps.getState();
      setText(coins, formatCoins(state.inventory[COINS] ?? 0));
      setText(honey, t('hud.kg', { kg: formatKg(kgOnHand(deps)) }));
      const cal = calendar(state.clock.tick);
      setText(season, t(`season.${cal.season}`));
      setText(day, t('hud.dayYear', { day: cal.day, year: cal.year }));
      progress.style.width = `${Math.round(cal.dayProgress * 100)}%`;
      speedButtons.forEach((button, i) => {
        const active = SPEEDS[i] === state.clock.speed;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    },
  };
}
```

- [ ] **Step 6: Create `src/ui/toolbar.ts`**

```ts
import { formatKg } from './format';
import { h, setText } from './h';
import { t } from './i18n';
import { icon, type IconName } from './icons';
import type { UiDeps } from './types';

function readyToHarvest(deps: UiDeps): number {
  const state = deps.getState();
  let total = 0;
  for (const e of Object.values(state.entities)) if (deps.reg.buildable(e.def).producer) total += e.store ?? 0;
  return total;
}

function hexButton(name: IconName, label: string, onClick: () => void, primary = false, extra: Node | null = null) {
  return h(
    'button',
    { class: primary ? 'hexbtn primary' : 'hexbtn', type: 'button', onclick: onClick },
    h('span', { class: 'hex' }, icon(name)),
    h('span', { class: 'label' }, label),
    extra,
  );
}

/** Bottom bar. Orders and Guide join in sub-project 3; no dead buttons until then. */
export function createToolbar(deps: UiDeps, actions: { openShop(): void; openMarket(): void }): { el: HTMLElement; update(): void } {
  const kgBadge = h('span', { class: 'badge-kg', hidden: true });
  const harvest = hexButton('basket', t('toolbar.harvestAll'), () => deps.dispatch({ type: 'harvestAll' }), true, kgBadge);
  const el = h(
    'nav',
    { class: 'toolbar', 'aria-label': t('toolbar.label') },
    hexButton('cart', t('toolbar.shop'), () => actions.openShop()),
    hexButton('honey', t('toolbar.market'), () => actions.openMarket()),
    harvest,
  );
  return {
    el,
    update() {
      const ready = readyToHarvest(deps);
      harvest.disabled = ready <= 0;
      kgBadge.hidden = ready <= 0;
      setText(kgBadge, t('hud.kg', { kg: formatKg(ready) }));
    },
  };
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/ui`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/ui/toasts.ts src/ui/hud.ts src/ui/toolbar.ts tests/ui
git commit -m "feat(ui): add HUD, toolbar and toasts"
```

---

### Task 21: Panels: host, Shop and Market

**Files:**
- Create: `src/ui/panels/host.ts`, `src/ui/panels/shop.ts`, `src/ui/panels/market.ts`
- Test: `tests/ui/panels.test.ts`

**Interfaces:**
- Consumes: `h`, `setText`, `t`, `tx`, `icon`, `formatKg`, `formatCoins`, `canAfford`, `COINS`, `BuildableDef`, `UiDeps`
- Produces:
  - `interface Panel { readonly title: string; readonly body: HTMLElement; update(): void; onOpen?(): void }`
  - `class PanelHost` with `el`, `openPanel`, `open(panel)`, `toggle(panel)`, `close(): boolean`, `update()`
  - `createShopPanel(deps, host: Pick<PanelHost, 'close'>): Panel`
  - `createMarketPanel(deps): Panel`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/ui/panels.test.ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { h } from '../../src/ui/h';
import { t } from '../../src/ui/i18n';
import { PanelHost, type Panel } from '../../src/ui/panels/host';
import { createMarketPanel } from '../../src/ui/panels/market';
import { createShopPanel } from '../../src/ui/panels/shop';
import { makeDeps } from './helpers';

const fakePanel = (title: string): Panel => ({ title, body: h('div', null, `${title} body`), update: vi.fn() });

describe('PanelHost', () => {
  it('shows one panel at a time and closes', () => {
    const host = new PanelHost();
    const a = fakePanel('A');
    const b = fakePanel('B');
    host.open(a);
    expect(host.el.hidden).toBe(false);
    expect(host.el.textContent).toContain('A body');
    host.open(b);
    expect(host.el.textContent).not.toContain('A body');
    expect(host.openPanel).toBe(b);
    host.toggle(b);
    expect(host.el.hidden).toBe(true);
    expect(host.close()).toBe(false);
  });
});

describe('Shop', () => {
  it('lists purchasable items and disables what you cannot afford', () => {
    const { deps } = makeDeps();
    const host = { close: vi.fn(() => true) };
    const shop = createShopPanel(deps, host);
    shop.update();
    const items = [...shop.body.querySelectorAll<HTMLButtonElement>('.shop-item')];
    expect(items.map((b) => b.querySelector('.name')!.textContent)).toEqual(['Beehive', 'Wildflower bed']);
    expect(items[0].disabled).toBe(true);
    expect(items[1].disabled).toBe(false);
    items[1].click();
    expect(host.close).toHaveBeenCalled();
    expect(deps.startPlacing).toHaveBeenCalledWith('bed_wildflower');
  });
});

describe('Market', () => {
  it('sells a chosen amount, clamped to what you have', () => {
    const { deps, state } = makeDeps();
    state.inventory.honey_wildflower = 3.5;
    const market = createMarketPanel(deps);
    market.onOpen?.();
    market.update();
    expect(market.body.textContent).toContain('You have 3.5 kg');
    expect(market.body.textContent).toContain('= 15 coins');
    const more = market.body.querySelector<HTMLButtonElement>('[aria-label="More"]')!;
    for (let i = 0; i < 5; i++) more.click();
    expect(market.body.textContent).toContain('= 52 coins');
    market.body.querySelector<HTMLButtonElement>('.btn.primary')!.click();
    expect(deps.dispatch).toHaveBeenLastCalledWith({ type: 'sell', resource: 'honey_wildflower', amount: 3.5 });
    expect(state.inventory.honey_wildflower).toBe(0);
    market.update();
    expect(market.body.querySelector<HTMLElement>('.market-row')!.hidden).toBe(true);
    const empty = [...market.body.querySelectorAll<HTMLElement>('p.muted')].find((p) => p.textContent === t('market.nothing'))!;
    expect(empty.hidden).toBe(false);
  });

  it('sells everything at once', () => {
    const { deps, state } = makeDeps();
    state.inventory.honey_wildflower = 2;
    const market = createMarketPanel(deps);
    market.onOpen?.();
    market.update();
    [...market.body.querySelectorAll('button')].find((b) => b.textContent === 'Sell all')!.click();
    expect(deps.dispatch).toHaveBeenLastCalledWith({ type: 'sell', resource: 'honey_wildflower', amount: 'all' });
    expect(state.inventory.coins).toBe(90);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/ui/panels.test.ts`
Expected: FAIL with unresolved imports under `src/ui/panels/`.

- [ ] **Step 3: Create `src/ui/panels/host.ts`**

```ts
import { h, setText } from '../h';
import { t } from '../i18n';
import { icon } from '../icons';

export interface Panel {
  readonly title: string;
  readonly body: HTMLElement;
  update(): void;
  onOpen?(): void;
}

/** One panel open at a time, anchored above the toolbar. */
export class PanelHost {
  readonly el: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly bodyEl: HTMLElement;
  private current: Panel | null = null;

  constructor() {
    this.titleEl = h('h2', { id: 'panel-title' });
    this.bodyEl = h('div', { class: 'panel-body' });
    const closeButton = h('button', { class: 'iconbtn small', type: 'button', 'aria-label': t('panel.close') }, icon('close'));
    closeButton.addEventListener('click', () => this.close());
    this.el = h(
      'section',
      { class: 'panel-host', role: 'dialog', 'aria-labelledby': 'panel-title', hidden: true },
      h('div', { class: 'panel-head' }, this.titleEl, closeButton),
      this.bodyEl,
    );
  }

  get openPanel(): Panel | null {
    return this.current;
  }

  open(panel: Panel): void {
    this.current = panel;
    setText(this.titleEl, panel.title);
    this.bodyEl.replaceChildren(panel.body);
    this.el.hidden = false;
    panel.onOpen?.();
    panel.update();
  }

  toggle(panel: Panel): void {
    if (this.current === panel) this.close();
    else this.open(panel);
  }

  close(): boolean {
    if (!this.current) return false;
    this.current = null;
    this.el.hidden = true;
    this.bodyEl.replaceChildren();
    return true;
  }

  update(): void {
    this.current?.update();
  }
}
```

- [ ] **Step 4: Create `src/ui/panels/shop.ts`**

```ts
import { COINS, type BuildableDef } from '../../content/types';
import { canAfford } from '../../sim/economy';
import { h } from '../h';
import { t, tx } from '../i18n';
import { icon, type IconName } from '../icons';
import type { UiDeps } from '../types';
import type { Panel, PanelHost } from './host';

const iconFor = (def: BuildableDef): IconName => (def.producer ? 'hive' : def.source ? 'flower' : 'cart');

export function createShopPanel(deps: UiDeps, host: Pick<PanelHost, 'close'>): Panel {
  const items = deps.reg.purchasable().map((def) => {
    const button = h(
      'button',
      {
        class: 'btn shop-item', type: 'button',
        onclick: () => {
          host.close();
          deps.startPlacing(def.id);
        },
      },
      icon(iconFor(def)),
      h('span', { class: 'shop-text' }, h('span', { class: 'name' }, tx(`def.${def.id}`)), h('span', { class: 'desc' }, tx(`defDesc.${def.id}`))),
      h('span', { class: 'cost' }, icon('coin'), t('shop.cost', { coins: def.cost[COINS] ?? 0 })),
    );
    return { def, button };
  });

  return {
    title: t('shop.title'),
    body: h('div', { class: 'shop' }, h('p', { class: 'muted' }, t('shop.hint')), ...items.map((i) => i.button)),
    update() {
      const inventory = deps.getState().inventory;
      for (const { def, button } of items) button.disabled = !canAfford(inventory, def.cost);
    },
  };
}
```

- [ ] **Step 5: Create `src/ui/panels/market.ts`**

```ts
import type { ResourceId } from '../../content/types';
import { formatCoins, formatKg } from '../format';
import { h, setText } from '../h';
import { t, tx } from '../i18n';
import { icon } from '../icons';
import type { UiDeps } from '../types';
import type { Panel } from './host';

const STEP_KG = 1;

function createRow(deps: UiDeps, resource: ResourceId, pricePerUnit: number) {
  let amount = 0;
  const have = () => deps.getState().inventory[resource] ?? 0;

  const haveEl = h('p', { class: 'muted' });
  const amountEl = h('span', { class: 'amount' });
  const preview = h('p', { class: 'muted' });
  const less = h('button', { class: 'iconbtn small', type: 'button', 'aria-label': t('market.less') }, icon('minus'));
  const more = h('button', { class: 'iconbtn small', type: 'button', 'aria-label': t('market.more') }, icon('plus'));
  const sell = h('button', { class: 'btn primary', type: 'button' });
  const sellAll = h('button', { class: 'btn', type: 'button' }, t('market.sellAll'));
  const el = h(
    'div',
    { class: 'market-row' },
    h('div', { class: 'name' }, tx(`resource.${resource}`)),
    haveEl,
    h('p', { class: 'muted' }, t('market.price', { price: pricePerUnit })),
    h('div', { class: 'stepper' }, less, amountEl, more),
    preview,
    h('div', { class: 'market-actions' }, sell, sellAll),
  );

  /** Returns whether this resource is on hand. */
  const render = (): boolean => {
    const kg = have();
    if (amount > kg) amount = kg;
    if (amount <= 0 && kg > 0) amount = Math.min(STEP_KG, kg);
    setText(haveEl, t('market.have', { kg: formatKg(kg) }));
    setText(amountEl, t('hud.kg', { kg: formatKg(amount) }));
    setText(preview, t('market.preview', { coins: formatCoins(amount * pricePerUnit) }));
    setText(sell, t('market.sell', { kg: formatKg(amount) }));
    sell.disabled = amount <= 0;
    sellAll.disabled = kg <= 0;
    less.disabled = amount <= 0;
    more.disabled = amount >= kg;
    el.hidden = kg <= 0;
    return kg > 0;
  };

  less.addEventListener('click', () => {
    amount = Math.max(0, amount - STEP_KG);
    render();
  });
  more.addEventListener('click', () => {
    amount = Math.min(have(), amount + STEP_KG);
    render();
  });
  sell.addEventListener('click', () => {
    if (amount > 0) deps.dispatch({ type: 'sell', resource, amount });
  });
  sellAll.addEventListener('click', () => deps.dispatch({ type: 'sell', resource, amount: 'all' }));

  return {
    el,
    render,
    reset() {
      amount = Math.min(STEP_KG, have());
      render();
    },
  };
}

export function createMarketPanel(deps: UiDeps): Panel {
  const rows = [...deps.reg.prices.values()].map((p) => createRow(deps, p.resource, p.sell));
  const empty = h('p', { class: 'muted' }, t('market.nothing'));
  return {
    title: t('market.title'),
    body: h('div', { class: 'market' }, empty, ...rows.map((r) => r.el)),
    onOpen() {
      for (const r of rows) r.reset();
    },
    update() {
      let anything = false;
      for (const r of rows) anything = r.render() || anything;
      empty.hidden = anything;
    },
  };
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/ui/panels.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/ui/panels tests/ui/panels.test.ts
git commit -m "feat(ui): add panel host with Shop and Market panels"
```

---
### Task 22: Inspect popover, UI assembly and fatal screens

**Files:**
- Create: `src/ui/inspect.ts`, `src/ui/app.ts`, `src/ui/fatal.ts`
- Test: `tests/ui/inspect.test.ts`, `tests/ui/app.test.ts`

**Interfaces:**
- Consumes:
  - `getRangeMap`, `outputPerDay`, `refundFor`, `COINS`
  - `h`, `setText`, `t`, `tx`, formatters, `toastForEvent`
  - `createHud`, `createToolbar`, `createToasts`, `PanelHost`, `createShopPanel`, `createMarketPanel`, `UiDeps`
- Produces:
  - Inspect:
    - `CONFIRM_MS = 2000`
    - `interface Inspect { el; isOpen(); open(entityId, at); close(); update() }`
    - `createInspect(deps): Inspect`
  - UI assembly:
    - `interface Ui { root; update(); handleEvent(e); toast(text, kind?); closeTopmost(): boolean; openInspect(id, at); closeInspect(); hint(text | null, at | null, tone) }`
    - `createUi(container, deps): Ui`
  - Fatal screens: `showFatal(root, title, body): HTMLElement`, `showOverlay(root, text, reloadLabel): HTMLElement`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/ui/inspect.test.ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hex } from '../../src/core/hex';
import { dispatch } from '../../src/sim/commands';
import { spawnEntity } from '../../src/sim/entities';
import { CONFIRM_MS, createInspect } from '../../src/ui/inspect';
import { entitiesOf, reg } from '../sim/helpers';
import { makeDeps } from './helpers';

const at = { x: 10, y: 10 };
const bedAt = (state: ReturnType<typeof makeDeps>['state'], q: number, r: number) =>
  entitiesOf(state, 'bed_wildflower').find((b) => b.hex.q === q && b.hex.r === r)!;

describe('inspect popover', () => {
  afterEach(() => vi.useRealTimers());

  it('shows a hive fill level, honey rate and beds in range', () => {
    const { deps, state } = makeDeps();
    const inspect = createInspect(deps);
    const [hive] = entitiesOf(state, 'hive');
    hive.store = 1.25;
    inspect.open(hive.id, at);
    expect(inspect.isOpen()).toBe(true);
    const text = inspect.el.textContent;
    expect(text).toContain('Beehive');
    expect(text).toContain('1.2 / 5.0 kg');
    expect(text).toContain('0.75 kg/day');
    expect(text).toContain('3 flower beds in range');
  });

  it('explains when a bed is shared between hives', () => {
    const { deps, state } = makeDeps();
    spawnEntity(state, reg, 'hive', hex(2, -1));
    const inspect = createInspect(deps);
    inspect.open(bedAt(state, 1, 0).id, at);
    expect(inspect.el.textContent).toContain('Shared by 2 hives');
    inspect.open(entitiesOf(state, 'hive')[0].id, at);
    expect(inspect.el.textContent).toContain('1 shared with another hive');
  });

  it('asks for confirmation before removing, and the ask expires', () => {
    vi.useFakeTimers();
    const { deps, state } = makeDeps();
    const bed = bedAt(state, -1, 0);
    const inspect = createInspect(deps);
    inspect.open(bed.id, at);
    const remove = [...inspect.el.querySelectorAll('button')].find((b) => b.textContent === 'Remove (+10)')!;
    remove.click();
    expect(deps.dispatch).not.toHaveBeenCalled();
    expect(remove.textContent).toBe('Confirm remove');
    vi.advanceTimersByTime(CONFIRM_MS + 100);
    expect(remove.textContent).toBe('Remove (+10)');
    remove.click();
    remove.click();
    expect(deps.dispatch).toHaveBeenCalledWith({ type: 'remove', id: bed.id });
    expect(inspect.isOpen()).toBe(false);
  });

  it('harvests a hive from the popover', () => {
    const { deps, state } = makeDeps();
    const [hive] = entitiesOf(state, 'hive');
    hive.store = 2;
    const inspect = createInspect(deps);
    inspect.open(hive.id, at);
    [...inspect.el.querySelectorAll('button')].find((b) => b.textContent === 'Harvest')!.click();
    expect(state.inventory.honey_wildflower).toBe(2);
  });

  it('closes itself when its entity disappears', () => {
    const { deps, state } = makeDeps();
    const bed = bedAt(state, -1, 0);
    const inspect = createInspect(deps);
    inspect.open(bed.id, at);
    dispatch(state, reg, { type: 'remove', id: bed.id });
    inspect.update();
    expect(inspect.isOpen()).toBe(false);
  });

  it('shows just the name, with no actions, for the house', () => {
    const { deps, state } = makeDeps();
    const inspect = createInspect(deps);
    inspect.open(entitiesOf(state, 'house')[0].id, at);
    expect(inspect.el.textContent).toBe('Beekeeper’s house');
    expect(inspect.el.querySelectorAll('button')).toHaveLength(0);
  });
});
```

```ts
// tests/ui/app.test.ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createUi } from '../../src/ui/app';
import { showFatal, showOverlay } from '../../src/ui/fatal';
import { entitiesOf } from '../sim/helpers';
import { makeDeps } from './helpers';

function setup() {
  const { deps, state } = makeDeps();
  const container = document.createElement('div');
  const ui = createUi(container, deps);
  return { deps, state, container, ui };
}

describe('createUi', () => {
  it('turns game events into toasts', () => {
    const { container, ui } = setup();
    ui.handleEvent({ type: 'harvested', resource: 'honey_wildflower', amount: 1.5 });
    expect(container.querySelector('.toasts')!.textContent).toContain('+1.5 kg');
  });

  it('closes the topmost layer: inspect first, then the panel', () => {
    const { container, state, ui } = setup();
    container.querySelector<HTMLButtonElement>('.toolbar .hexbtn')!.click();
    const panel = container.querySelector<HTMLElement>('.panel-host')!;
    expect(panel.hidden).toBe(false);
    ui.openInspect(entitiesOf(state, 'hive')[0].id, { x: 10, y: 10 });
    expect(panel.hidden).toBe(true);
    expect(ui.closeTopmost()).toBe(true);
    expect(container.querySelector<HTMLElement>('.inspect')!.hidden).toBe(true);
    expect(ui.closeTopmost()).toBe(false);
  });

  it('shows and hides the cursor hint', () => {
    const { container, ui } = setup();
    ui.hint('Not enough coins', { x: 5, y: 6 }, 'invalid');
    const hint = container.querySelector<HTMLElement>('.cursor-hint')!;
    expect(hint.hidden).toBe(false);
    expect(hint.classList.contains('invalid')).toBe(true);
    expect(hint.style.left).toBe('5px');
    ui.hint(null, null, 'valid');
    expect(hint.hidden).toBe(true);
  });
});

describe('fatal screens', () => {
  it('renders an alert and a reloadable overlay', () => {
    const root = document.createElement('div');
    const fatal = showFatal(root, 'Title', 'Body');
    expect(fatal.getAttribute('role')).toBe('alert');
    expect(fatal.textContent).toContain('Title');
    const overlay = showOverlay(root, 'Graphics reset…', 'Reload');
    expect(overlay.querySelector('button')!.textContent).toBe('Reload');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/ui`
Expected: FAIL with unresolved imports for `inspect`, `app` and `fatal`.

- [ ] **Step 3: Create `src/ui/inspect.ts`**

```ts
import { COINS } from '../content/types';
import { refundFor } from '../sim/economy';
import { getRangeMap, outputPerDay } from '../sim/production';
import type { Entity } from '../sim/state';
import { formatKg, formatRate } from './format';
import { h, setText } from './h';
import { t, tx } from './i18n';
import type { UiDeps } from './types';

export const CONFIRM_MS = 2000;
const POPOVER_W = 260;
const POPOVER_H = 220;

type Point = { x: number; y: number };
type Row = { el: HTMLElement; value: (e: Entity) => string };

export interface Inspect {
  el: HTMLElement;
  isOpen(): boolean;
  open(entityId: string, at: Point): void;
  close(): void;
  update(): void;
}

/** Click-an-entity popover. This is where the nectar-sharing rules become visible (spec §7.4). */
export function createInspect(deps: UiDeps): Inspect {
  const el = h('div', { class: 'inspect', role: 'dialog', 'aria-label': t('inspect.label'), hidden: true });
  let entityId: string | null = null;
  let rows: Row[] = [];
  let confirming = false;
  let confirmTimer: ReturnType<typeof setTimeout> | undefined;

  const rangeMap = () => getRangeMap(deps.getState(), deps.reg);

  const describeSources = (e: Entity): string => {
    const shares = rangeMap().sharesByProducer.get(e.id) ?? [];
    const shared = shares.filter((s) => s.sharedWith > 1).length;
    const base = t('inspect.sources', { count: shares.length });
    return shared > 0 ? `${base} · ${t('inspect.shared', { n: shared })}` : base;
  };

  const describeFeeding = (e: Entity): string => {
    const n = rangeMap().producersBySource.get(e.id)?.length ?? 0;
    if (n === 0) return t('inspect.feedsNone');
    if (n === 1) return t('inspect.feedsOne');
    return t('inspect.feedsMany', { n });
  };

  const close = () => {
    entityId = null;
    rows = [];
    confirming = false;
    clearTimeout(confirmTimer);
    el.hidden = true;
    el.replaceChildren();
  };

  const build = (entity: Entity) => {
    const def = deps.reg.buildable(entity.def);
    rows = [];
    const row = (value: Row['value']) => {
      const r = h('div', { class: 'row' });
      rows.push({ el: r, value });
      return r;
    };
    const parts: Node[] = [h('h3', null, tx(`def.${def.id}`))];
    const producer = def.producer;
    if (producer) {
      parts.push(
        row((e) => t('inspect.fill', { have: formatKg(e.store ?? 0), cap: formatKg(producer.capacity) })),
        row((e) => t('inspect.rate', { rate: formatRate(outputPerDay(deps.getState(), deps.reg, e.id)) })),
        row(describeSources),
      );
    }
    const source = def.source;
    if (source) parts.push(row(() => t('inspect.yield', { n: source.yieldPerDay })), row(describeFeeding));

    const actions: HTMLElement[] = [];
    if (producer) {
      actions.push(h('button', { class: 'btn primary', type: 'button', onclick: () => deps.dispatch({ type: 'harvest', id: entity.id }) }, t('inspect.harvest')));
    }
    if (def.removable) {
      const label = t('inspect.remove', { coins: refundFor(def)[COINS] ?? 0 });
      const remove = h('button', { class: 'btn', type: 'button' }, label);
      remove.addEventListener('click', () => {
        if (!confirming) {
          confirming = true;
          setText(remove, t('inspect.confirm'));
          confirmTimer = setTimeout(() => {
            confirming = false;
            setText(remove, label);
          }, CONFIRM_MS);
          return;
        }
        clearTimeout(confirmTimer);
        confirming = false;
        if (deps.dispatch({ type: 'remove', id: entity.id }).ok) close();
      });
      actions.push(remove);
    }
    if (actions.length > 0) parts.push(h('div', { class: 'actions' }, ...actions));
    el.replaceChildren(...parts);
  };

  const update = () => {
    if (!entityId) return;
    const entity = deps.getState().entities[entityId];
    if (!entity) {
      close();
      return;
    }
    for (const r of rows) setText(r.el, r.value(entity));
  };

  return {
    el,
    isOpen: () => entityId !== null,
    open(id, at) {
      const entity = deps.getState().entities[id];
      if (!entity) return;
      close();
      entityId = id;
      build(entity);
      el.style.left = `${Math.max(8, Math.min(at.x + 14, window.innerWidth - POPOVER_W))}px`;
      el.style.top = `${Math.max(8, Math.min(at.y + 14, window.innerHeight - POPOVER_H))}px`;
      el.hidden = false;
      update();
    },
    close,
    update,
  };
}
```

- [ ] **Step 4: Create `src/ui/fatal.ts`**

```ts
import { h } from './h';

/** Full-screen message for unrecoverable problems (no WebGL). */
export function showFatal(root: HTMLElement, title: string, body: string): HTMLElement {
  const el = h('div', { class: 'fatal', role: 'alert' }, h('div', { class: 'fatal-card' }, h('h1', null, title), h('p', null, body)));
  root.appendChild(el);
  return el;
}

/** Blocking overlay with a reload button (WebGL context lost). */
export function showOverlay(root: HTMLElement, text: string, reloadLabel: string): HTMLElement {
  const el = h(
    'div',
    { class: 'overlay', role: 'status' },
    h('div', { class: 'overlay-card' }, h('p', null, text), h('button', { class: 'btn primary', type: 'button', onclick: () => location.reload() }, reloadLabel)),
  );
  root.appendChild(el);
  return el;
}
```

- [ ] **Step 5: Create `src/ui/app.ts`**

```ts
import type { GameEvent } from '../sim/events';
import { toastForEvent, type ToastKind } from './feedback';
import { h, setText } from './h';
import { createHud } from './hud';
import { createInspect } from './inspect';
import { PanelHost } from './panels/host';
import { createMarketPanel } from './panels/market';
import { createShopPanel } from './panels/shop';
import { createToasts } from './toasts';
import { createToolbar } from './toolbar';
import type { UiDeps } from './types';

type Point = { x: number; y: number };

/** "A hive is full" can fire often with several hives; show it at most every 10 s. */
const FULL_TOAST_DEDUPE_MS = 10_000;

export interface Ui {
  readonly root: HTMLElement;
  update(): void;
  handleEvent(e: GameEvent): void;
  toast(text: string, kind?: ToastKind): void;
  /** Closes the inspect popover, else the open panel. Returns whether anything closed. */
  closeTopmost(): boolean;
  openInspect(entityId: string, at: Point): void;
  closeInspect(): void;
  hint(text: string | null, at: Point | null, tone: 'valid' | 'invalid'): void;
}

export function createUi(container: HTMLElement, deps: UiDeps): Ui {
  const toasts = createToasts();
  const panels = new PanelHost();
  const shop = createShopPanel(deps, panels);
  const market = createMarketPanel(deps);
  const hud = createHud(deps);
  const toolbar = createToolbar(deps, { openShop: () => panels.toggle(shop), openMarket: () => panels.toggle(market) });
  const inspect = createInspect(deps);
  const hintEl = h('div', { class: 'cursor-hint', role: 'tooltip', hidden: true });
  const root = h('div', { class: 'ui' }, hud.el, toolbar.el, panels.el, inspect.el, toasts.el, hintEl);
  container.appendChild(root);

  return {
    root,
    update() {
      hud.update();
      toolbar.update();
      panels.update();
      inspect.update();
    },
    handleEvent(e) {
      const toast = toastForEvent(e);
      if (toast) toasts.show(toast.text, toast.kind, e.type === 'producerFull' ? { dedupeMs: FULL_TOAST_DEDUPE_MS } : {});
    },
    toast: (text, kind = 'info') => toasts.show(text, kind),
    closeTopmost() {
      if (inspect.isOpen()) {
        inspect.close();
        return true;
      }
      return panels.close();
    },
    openInspect(id, at) {
      panels.close();
      inspect.open(id, at);
    },
    closeInspect: () => inspect.close(),
    hint(text, at, tone) {
      if (!text || !at) {
        hintEl.hidden = true;
        return;
      }
      setText(hintEl, text);
      hintEl.className = `cursor-hint ${tone}`;
      hintEl.style.left = `${at.x}px`;
      hintEl.style.top = `${at.y}px`;
      hintEl.hidden = false;
    },
  };
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/ui`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/ui/inspect.ts src/ui/app.ts src/ui/fatal.ts tests/ui/inspect.test.ts tests/ui/app.test.ts
git commit -m "feat(ui): add inspect popover, UI assembly and fatal screens"
```

---

### Task 23: Controller: build mode, selection and keys (`game/controller`)

**Files:**
- Create: `src/game/controller.ts`
- Test: `tests/game/controller.test.ts`

**Interfaces:**
- Consumes: `validatePlace`, `canAfford`, `hexRange`, `hexKey`, `COINS`, `reasonText`, `t`, `tx`, `HexHighlight`, `Ghost`, `CameraRig`, `Ui`
- Produces:
  - `type Mode = { kind: 'idle' } | { kind: 'placing'; def: string }`
  - `interface ControllerDeps { reg; getState(); dispatch(cmd); view: { highlight; ghost; rig }; ui }` (only the methods it uses)
  - `class Controller` with:
    - `mode`
    - `startPlacing(defId)`, `cancel()`
    - `hover(h | null, at | null)`, `click(h | null, at | null)`
    - `key(key): boolean` (true when the key was handled)

- [ ] **Step 1: Write the failing tests**

```ts
// tests/game/controller.test.ts
import { describe, expect, it, vi } from 'vitest';
import { ORIGIN, hex } from '../../src/core/hex';
import { Controller } from '../../src/game/controller';
import { dispatch, type Command } from '../../src/sim/commands';
import { entitiesOf, newGame, reg } from '../sim/helpers';

const at = { x: 10, y: 20 };
const NE = hex(1, -1);

function setup() {
  const state = newGame(1);
  const view = {
    highlight: { show: vi.fn(), hide: vi.fn(), showRange: vi.fn(), clearRange: vi.fn() },
    ghost: { show: vi.fn(), hide: vi.fn() },
    rig: { rotate: vi.fn() },
  };
  const ui = { toast: vi.fn(), closeTopmost: vi.fn(() => false), openInspect: vi.fn(), closeInspect: vi.fn(), hint: vi.fn() };
  const send = vi.fn((cmd: Command) => dispatch(state, reg, cmd));
  const controller = new Controller({ reg, getState: () => state, dispatch: send, view, ui });
  return { state, view, ui, send, controller };
}

describe('build mode', () => {
  it('previews a valid spot in green with name and price', () => {
    const { controller, view, ui } = setup();
    controller.startPlacing('bed_wildflower');
    controller.hover(NE, at);
    expect(view.ghost.show).toHaveBeenLastCalledWith('bed_wildflower', NE, true);
    expect(view.highlight.show).toHaveBeenLastCalledWith(NE, 'valid');
    expect(ui.hint).toHaveBeenLastCalledWith('Wildflower bed · 20 coins', at, 'valid');
  });

  it('previews an invalid spot in red with the reason', () => {
    const { controller, view, ui } = setup();
    controller.startPlacing('bed_wildflower');
    controller.hover(ORIGIN, at);
    expect(view.ghost.show).toHaveBeenLastCalledWith('bed_wildflower', ORIGIN, false);
    expect(view.highlight.show).toHaveBeenLastCalledWith(ORIGIN, 'invalid');
    expect(ui.hint).toHaveBeenLastCalledWith('Something is already here', at, 'invalid');
  });

  it('shows the range ring while placing a hive', () => {
    const { controller, view } = setup();
    controller.startPlacing('hive');
    controller.hover(NE, at);
    const ring = view.highlight.showRange.mock.lastCall![0];
    expect(ring).toHaveLength(6);
    expect(ring).toEqual(expect.arrayContaining([hex(1, 0), hex(2, -1)]));
  });

  it('places on click and stays in build mode while you can afford another', () => {
    const { controller, state } = setup();
    controller.startPlacing('bed_wildflower');
    controller.click(NE, at);
    expect(state.inventory.coins).toBe(40);
    expect(controller.mode).toEqual({ kind: 'placing', def: 'bed_wildflower' });
  });

  it('leaves build mode once the next one is unaffordable', () => {
    const { controller, state, view } = setup();
    state.inventory.coins = 25;
    controller.startPlacing('bed_wildflower');
    controller.click(NE, at);
    expect(controller.mode).toEqual({ kind: 'idle' });
    expect(view.ghost.hide).toHaveBeenCalled();
  });

  it('stays in build mode after a rejected click', () => {
    const { controller, send } = setup();
    controller.startPlacing('bed_wildflower');
    controller.click(ORIGIN, at);
    expect(send).toHaveBeenCalled();
    expect(controller.mode.kind).toBe('placing');
  });

  it('Escape cancels build mode first, then closes UI layers', () => {
    const { controller, ui } = setup();
    controller.startPlacing('bed_wildflower');
    expect(controller.key('Escape')).toBe(true);
    expect(controller.mode.kind).toBe('idle');
    expect(ui.closeTopmost).not.toHaveBeenCalled();
    controller.key('Escape');
    expect(ui.closeTopmost).toHaveBeenCalled();
  });
});

describe('selection', () => {
  it('opens the inspect popover on an entity and closes it on empty ground', () => {
    const { controller, ui, state } = setup();
    controller.click(ORIGIN, at);
    expect(ui.openInspect).toHaveBeenCalledWith(entitiesOf(state, 'hive')[0].id, at);
    controller.click(NE, at);
    expect(ui.closeInspect).toHaveBeenCalled();
  });

  it('shows a hive range on hover', () => {
    const { controller, view } = setup();
    controller.hover(ORIGIN, at);
    expect(view.highlight.show).toHaveBeenLastCalledWith(ORIGIN, 'hover');
    expect(view.highlight.showRange.mock.lastCall![0]).toHaveLength(6);
  });

  it('clears the highlight, ghost and hint when the pointer leaves', () => {
    const { controller, view, ui } = setup();
    controller.hover(null, null);
    expect(view.highlight.hide).toHaveBeenCalled();
    expect(view.ghost.hide).toHaveBeenCalled();
    expect(ui.hint).toHaveBeenLastCalledWith(null, null, 'valid');
  });
});

describe('keys', () => {
  it('Space pauses and then restores the previous speed', () => {
    const { controller, state } = setup();
    controller.key('2');
    controller.key(' ');
    expect(state.clock.speed).toBe(0);
    controller.key(' ');
    expect(state.clock.speed).toBe(2);
  });

  it('maps 1/2/3 to 1x/2x/4x', () => {
    const { controller, state } = setup();
    controller.key('3');
    expect(state.clock.speed).toBe(4);
    controller.key('1');
    expect(state.clock.speed).toBe(1);
  });

  it('H harvests everything; Q/E rotate the camera', () => {
    const { controller, send, view } = setup();
    controller.key('h');
    expect(send).toHaveBeenLastCalledWith({ type: 'harvestAll' });
    controller.key('q');
    controller.key('E');
    expect(view.rig.rotate.mock.calls).toEqual([[-1], [1]]);
  });

  it('ignores unrelated keys', () => {
    expect(setup().controller.key('x')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/game/controller.test.ts`
Expected: FAIL with `Failed to resolve import "../../src/game/controller"`.

- [ ] **Step 3: Implement `src/game/controller.ts`**

```ts
import { hexKey, hexRange, type Hex } from '../core/hex';
import type { Registry } from '../content/registry';
import { COINS } from '../content/types';
import type { CameraRig } from '../render/camera';
import type { Ghost } from '../render/ghost';
import type { HexHighlight } from '../render/highlight';
import { validatePlace, type Command, type CommandResult } from '../sim/commands';
import { canAfford } from '../sim/economy';
import type { Entity, GameState, Speed } from '../sim/state';
import type { Ui } from '../ui/app';
import { reasonText } from '../ui/feedback';
import { t, tx } from '../ui/i18n';

export type Mode = { kind: 'idle' } | { kind: 'placing'; def: string };
type Point = { x: number; y: number };

export interface ControllerDeps {
  reg: Registry;
  getState(): GameState;
  dispatch(cmd: Command): CommandResult;
  view: {
    highlight: Pick<HexHighlight, 'show' | 'hide' | 'showRange' | 'clearRange'>;
    ghost: Pick<Ghost, 'show' | 'hide'>;
    rig: Pick<CameraRig, 'rotate'>;
  };
  ui: Pick<Ui, 'toast' | 'closeTopmost' | 'openInspect' | 'closeInspect' | 'hint'>;
}

const SPEED_KEYS: Readonly<Record<string, Speed>> = { '1': 1, '2': 2, '3': 4 };

function entityAt(state: GameState, h: Hex): Entity | undefined {
  const id = state.tiles[hexKey(h)]?.entityId;
  return id ? state.entities[id] : undefined;
}

function rangeAround(center: Hex, range: number): Hex[] {
  return hexRange(center, range).filter((x) => x.q !== center.q || x.r !== center.r);
}

/** Turns pointer and keyboard input into commands and view feedback (spec §7.3, §7.6). */
export class Controller {
  private current: Mode = { kind: 'idle' };
  private lastSpeed: Speed = 1;

  constructor(private readonly deps: ControllerDeps) {}

  get mode(): Mode {
    return this.current;
  }

  startPlacing(defId: string): void {
    this.current = { kind: 'placing', def: defId };
    this.deps.ui.closeInspect();
  }

  cancel(): void {
    this.current = { kind: 'idle' };
    this.deps.view.ghost.hide();
    this.deps.view.highlight.clearRange();
    this.deps.ui.hint(null, null, 'valid');
  }

  hover(h: Hex | null, at: Point | null): void {
    const { view, ui, reg } = this.deps;
    view.highlight.clearRange();
    if (!h) {
      view.highlight.hide();
      view.ghost.hide();
      ui.hint(null, null, 'valid');
      return;
    }
    const state = this.deps.getState();
    if (this.current.kind === 'placing') {
      const def = reg.buildable(this.current.def);
      const reason = validatePlace(state, reg, def.id, h);
      const valid = reason === null;
      view.ghost.show(def.id, h, valid);
      view.highlight.show(h, valid ? 'valid' : 'invalid');
      if (def.producer) view.highlight.showRange(rangeAround(h, def.producer.range));
      const text = reason === null
        ? t('hint.place', { name: tx(`def.${def.id}`), coins: def.cost[COINS] ?? 0 })
        : reasonText(reason);
      ui.hint(text, at, valid ? 'valid' : 'invalid');
      return;
    }
    view.highlight.show(h, 'hover');
    const entity = entityAt(state, h);
    const producer = entity ? reg.buildable(entity.def).producer : undefined;
    if (entity && producer) view.highlight.showRange(rangeAround(entity.hex, producer.range));
  }

  click(h: Hex | null, at: Point | null): void {
    if (this.current.kind === 'placing') {
      if (!h) return;
      const def = this.deps.reg.buildable(this.current.def);
      const result = this.deps.dispatch({ type: 'place', def: def.id, hex: h });
      if (result.ok && !canAfford(this.deps.getState().inventory, def.cost)) this.cancel();
      else this.hover(h, at);
      return;
    }
    const entity = h ? entityAt(this.deps.getState(), h) : undefined;
    if (entity && at) this.deps.ui.openInspect(entity.id, at);
    else this.deps.ui.closeInspect();
  }

  key(key: string): boolean {
    switch (key) {
      case 'Escape':
        if (this.current.kind === 'placing') {
          this.cancel();
          return true;
        }
        return this.deps.ui.closeTopmost();
      case ' ': {
        const speed = this.deps.getState().clock.speed;
        if (speed === 0) {
          this.deps.dispatch({ type: 'setSpeed', speed: this.lastSpeed });
        } else {
          this.lastSpeed = speed;
          this.deps.dispatch({ type: 'setSpeed', speed: 0 });
        }
        return true;
      }
      case 'h':
      case 'H':
        this.deps.dispatch({ type: 'harvestAll' });
        return true;
      case 'q':
      case 'Q':
        this.deps.view.rig.rotate(-1);
        return true;
      case 'e':
      case 'E':
        this.deps.view.rig.rotate(1);
        return true;
      default: {
        const speed = SPEED_KEYS[key];
        if (speed === undefined) return false;
        this.lastSpeed = speed;
        this.deps.dispatch({ type: 'setSpeed', speed });
        return true;
      }
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/game/controller.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/controller.ts tests/game/controller.test.ts
git commit -m "feat(game): add controller for build mode, selection and keyboard shortcuts"
```

---

### Task 24: Main wiring: input, autosave, dev tools, fatal screens and context loss

**Files:**
- Create: `src/game/devtools.ts`
- Modify: `src/main.ts` (final full replacement)
- Test: `tests/game/devtools.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - The playable game.
  - `window.__game` (dev builds only): `{ state; dispatch(cmd); advance(ticks); renderInfo(): { triangles; calls }; hexToClient(q, r) }`
  - URL params:
    - `?seed=<n>` starts a fresh, deterministic world and disables loading and autosave.
    - `?speed=<n>` (dev only) multiplies the game speed.

- [ ] **Step 1: Write the failing test**

```ts
// tests/game/devtools.test.ts
// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { installDevTools } from '../../src/game/devtools';
import { Session } from '../../src/game/session';
import { newGame, reg } from '../sim/helpers';

it('exposes a debug handle on window', () => {
  const session = new Session(reg, newGame(1), true);
  const view = {
    ctx: { renderer: { info: { render: { triangles: 12, calls: 3 } } } },
    hexToClient: vi.fn(() => ({ x: 1, y: 2 })),
  };
  installDevTools(session, view);
  const game = window.__game!;
  expect(game.state).toBe(session.state);
  game.advance(600);
  expect(session.state.clock.tick).toBe(600);
  expect(game.dispatch({ type: 'harvestAll' }).ok).toBe(true);
  expect(game.renderInfo()).toEqual({ triangles: 12, calls: 3 });
  expect(game.hexToClient(1, -1)).toEqual({ x: 1, y: 2 });
  expect(view.hexToClient).toHaveBeenCalledWith({ q: 1, r: -1 });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/game/devtools.test.ts`
Expected: FAIL with `Failed to resolve import "../../src/game/devtools"`.

- [ ] **Step 3: Create `src/game/devtools.ts`**

```ts
import type { Hex } from '../core/hex';
import type { Command, CommandResult } from '../sim/commands';
import type { GameState } from '../sim/state';
import type { Session } from './session';

export interface DevHandle {
  readonly state: GameState;
  dispatch(cmd: Command): CommandResult;
  advance(ticks: number): void;
  renderInfo(): { triangles: number; calls: number };
  hexToClient(q: number, r: number): { x: number; y: number };
}

declare global {
  interface Window {
    __game?: DevHandle;
  }
}

/** The subset of WorldView the dev handle needs (kept structural so tests can fake it). */
interface DevView {
  ctx: { renderer: { info: { render: { triangles: number; calls: number } } } };
  hexToClient(h: Hex): { x: number; y: number };
}

/** Dev builds only: a console/Playwright handle on the running game. */
export function installDevTools(session: Session, view: DevView): void {
  window.__game = {
    get state() {
      return session.state;
    },
    dispatch: (cmd) => session.dispatch(cmd),
    advance: (ticks) => session.step(ticks),
    renderInfo: () => {
      const { triangles, calls } = view.ctx.renderer.info.render;
      return { triangles, calls };
    },
    hexToClient: (q, r) => view.hexToClient({ q, r }),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/game/devtools.test.ts`
Expected: PASS.

- [ ] **Step 5: Replace `src/main.ts` with the final wiring**

```ts
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import './base.css';
import './ui/styles.css';
import { DEFAULT_PACKS } from './content/default';
import { createRegistry } from './content/registry';
import { Controller } from './game/controller';
import { installDevTools } from './game/devtools';
import { createFpsMeter } from './game/fps';
import { attachInput } from './game/input';
import { startLoop } from './game/loop';
import { browserStorage, clearSave, loadGame, saveGame } from './game/save';
import { Session } from './game/session';
import { registerDefaultArt } from './render/art/registry';
import { createWorldView } from './render/view';
import { isWebGLAvailable } from './render/webgl';
import type { Command } from './sim/commands';
import { createInitialState } from './sim/state';
import { createUi } from './ui/app';
import { showFatal, showOverlay } from './ui/fatal';
import { reasonText } from './ui/feedback';
import { t } from './ui/i18n';

const AUTOSAVE_MS = 10_000;

function boot(): void {
  const root = document.getElementById('app');
  if (!root) throw new Error('#app not found');
  if (!isWebGLAvailable()) {
    showFatal(root, t('fatal.noWebglTitle'), t('fatal.noWebglBody'));
    return;
  }

  const reg = createRegistry(DEFAULT_PACKS);
  registerDefaultArt();
  const params = new URLSearchParams(location.search);
  const storage = browserStorage();
  // ?seed=N gives a fresh, deterministic world (dev, e2e) and never touches the player's save.
  const fixedSeed = params.has('seed') ? Number(params.get('seed')) || 1 : null;
  const persist = storage !== null && fixedSeed === null;

  let state = createInitialState(fixedSeed ?? Math.floor(Math.random() * 2 ** 31), reg);
  const notices: string[] = [];
  if (!storage) notices.push(t('notice.noSave'));
  if (persist && storage) {
    const loaded = loadGame(storage, reg);
    if (loaded.status === 'loaded') state = loaded.state;
    else if (loaded.status === 'corrupt') notices.push(t('notice.corruptSave'));
    else if (loaded.status === 'unavailable') notices.push(t('notice.noSave'));
  }

  const session = new Session(reg, state);
  const view = createWorldView(root, session.state, reg);
  const canvas = view.ctx.renderer.domElement;

  let autosave = persist;
  let resetting = false;
  const save = () => {
    if (!autosave || resetting || !storage) return;
    if (!saveGame(storage, session.state)) {
      autosave = false;
      ui.toast(t('notice.noSave'), 'error');
    }
  };

  const send = (cmd: Command) => {
    const result = session.dispatch(cmd);
    if (!result.ok) ui.toast(reasonText(result.reason), 'error');
    return result;
  };

  const ui = createUi(root, {
    reg,
    getState: () => session.state,
    dispatch: send,
    startPlacing: (defId) => controller.startPlacing(defId),
    resetView: () => view.rig.reset(),
    resetSave: () => {
      if (!confirm(t('settings.resetConfirm'))) return;
      resetting = true;
      if (storage) clearSave(storage);
      location.reload();
    },
  });
  const controller = new Controller({ reg, getState: () => session.state, dispatch: send, view, ui });

  session.events.onAny((e) => {
    ui.handleEvent(e);
    if (e.type === 'entityPlaced' || e.type === 'entityRemoved') view.syncEntities(session.state);
  });
  session.onChange(() => ui.update());
  for (const notice of notices) ui.toast(notice, 'error');

  attachInput(canvas, {
    pan: (dx, dy) => view.rig.pan(dx, dy, canvas.clientHeight),
    zoom: (deltaY) => view.rig.zoom(deltaY),
    pinch: (factor) => view.rig.zoomBy(factor),
    hover: (x, y) => controller.hover(view.pickHex(x, y), { x, y }),
    click: (x, y) => controller.click(view.pickHex(x, y), { x, y }),
    cancel: () => controller.cancel(),
    leave: () => controller.hover(null, null),
  });

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Let focused buttons keep Space/Enter; never steal typing.
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.target instanceof HTMLButtonElement && (e.key === ' ' || e.key === 'Enter')) return;
    if (controller.key(e.key)) e.preventDefault();
  });

  let contextLost = false;
  let overlay: HTMLElement | null = null;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    contextLost = true;
    overlay = showOverlay(root, t('fatal.contextLost'), t('fatal.reload'));
  });
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    overlay?.remove();
    overlay = null;
  });

  const fps = import.meta.env.DEV ? createFpsMeter() : null;
  if (fps) root.appendChild(fps.el);
  const debugSpeed = import.meta.env.DEV ? Math.max(1, Number(params.get('speed')) || 1) : 1;

  startLoop({
    getSpeed: () => (contextLost ? 0 : session.state.clock.speed * debugSpeed),
    step: (ticks) => session.step(ticks),
    render: (dt, time) => {
      if (contextLost) return;
      view.frame(session.state, dt, time);
      fps?.frame(dt);
    },
  });

  setInterval(save, AUTOSAVE_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
  });
  window.addEventListener('beforeunload', save);

  ui.update();
  if (import.meta.env.DEV) installDevTools(session, view);
}

boot();
```

- [ ] **Step 6: Run the checks**

Run: `npm run check`
Expected: all green.

- [ ] **Step 7: Manual playtest (spec §1 success criteria 3 and 5)**

Run `npm run dev`, open `http://localhost:5173/` (no `?seed`, so the save is used), and verify each item:
1. The HUD shows 60 coins, `0.0 kg`, "Spring · Day 1 · Year 1", with 1x active. The hive badge reads 0% and rises.
2. **Shop → Wildflower bed**: the green ghost and "Wildflower bed · 20 coins" hint follow the cursor. Occupied hexes turn red with "Something is already here". Click the free hex next to the hive: coins drop to 40 and the tile turns to soil. You can still afford another bed, so build mode stays on; press Esc to leave it.
3. Click the hive: the popover shows fill, `1.00 kg/day` and "4 flower beds in range".
4. At 1x, harvest and sell as honey arrives (Harvest All button, Market → Sell all). A second hive becomes affordable after about 5 minutes. Place it so it shares a bed, then click that bed: "Shared by 2 hives".
5. Space pauses and resumes; 1/2/3 change speed; Q/E rotate; H harvests.
6. Reload the page: the game resumes where you left it (autosave every 10 s plus on unload).
7. Context loss: in the console, run `document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()`. The "Graphics reset…" overlay appears and time stops. Then call `.restoreContext()` on the same extension object and the overlay goes away.

Fix anything that fails before continuing.

- [ ] **Step 8: Commit**

```bash
git add src/main.ts src/game/devtools.ts tests/game/devtools.test.ts
git commit -m "feat: wire session, world view, UI, controller, autosave and dev tools into a playable loop"
```

---

### Task 25: Playwright smoke test and final verification

**Files:**
- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: `window.__game` (dev build), the Shop UI, the fixed seed via `?seed=1`.
- Produces: spec §1 success criterion 1 (the e2e half) and a draw-call budget check.

- [ ] **Step 1: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

const PORT = 5179;

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        // Headless Chromium renders WebGL through SwiftShader; newer Chrome requires opting in.
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

- [ ] **Step 2: Create `e2e/smoke.spec.ts`**

```ts
import { expect, test } from '@playwright/test';

test('loads, renders within budget, and places a flower bed through the Shop', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/?seed=1');
  await page.waitForFunction(() => window.__game !== undefined);
  await page.waitForFunction(() => window.__game!.renderInfo().triangles > 0);

  const info = await page.evaluate(() => window.__game!.renderInfo());
  expect(info.calls).toBeLessThan(100);
  expect(await page.evaluate(() => window.__game!.state.inventory.coins)).toBe(60);

  await page.getByRole('button', { name: 'Shop' }).click();
  await page.getByRole('button', { name: /Wildflower bed/ }).click();
  const target = await page.evaluate(() => window.__game!.hexToClient(1, -1));
  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
  await page.mouse.up();

  await expect.poll(() => page.evaluate(() => window.__game!.state.inventory.coins)).toBe(40);
  expect(errors).toEqual([]);
});
```

- [ ] **Step 3: Install the browser and run the smoke test**

```bash
npx playwright install chromium
```

Run: `npm run e2e`
Expected: `1 passed`.

If `renderInfo().triangles` stays 0 in headless mode, WebGL is unavailable in that Chromium. Confirm the `launchOptions.args` are applied (`npx playwright test --debug` shows the flags) before changing any game code.

- [ ] **Step 4: Final verification against spec §1**

Run each check and record the result in the commit message body:
1. `npm run check`: all green.
2. `npm run e2e`: passes.
3. Art gate: signed off in Task 17. Reference the approval.
4. Pacing: `tests/sim/balance.test.ts` passes (second hive affordable in 3–6 in-game days), and Task 24's manual playtest reached it in about 5 minutes at 1x.
5. Performance: the e2e draw-call assertion passes (< 100), and the dev FPS meter shows about 60 fps on the development laptop at map radius 12.
6. Persistence: Task 24 Step 7 item 6 (reload restores the game).
7. Asset rule: this command must print nothing:

```bash
git ls-files | grep -Ei '\.(png|jpe?g|gif|webp|svg|glb|gltf)$'
```

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e/smoke.spec.ts
git commit -m "test(e2e): add Playwright smoke test covering render budget and Shop placement"
```

---

## Out of scope reminders (do not build here)

These belong to sub-projects 2–4 (spec §2):
- flying bees, beekeeper walking, floating numbers, audio
- orders, land purchase, seasonal effects, honey types, the Guide
- the TR translation and language toggle
- offline progress
- mobile tuning, deployment

The code leaves hooks for them (spec §10). Do not add their UI buttons early; the spec requires no dead buttons.

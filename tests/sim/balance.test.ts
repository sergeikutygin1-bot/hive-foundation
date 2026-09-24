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

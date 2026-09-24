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

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

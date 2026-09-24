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

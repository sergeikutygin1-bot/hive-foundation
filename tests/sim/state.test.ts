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

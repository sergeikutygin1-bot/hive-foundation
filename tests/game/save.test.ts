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
    ['an entity without a hex', (s) => {
      const copy = structuredClone(s) as unknown as { entities: Record<string, Record<string, unknown>> };
      delete copy.entities.e1.hex;
      return copy;
    }],
    ['flags without fullNotified', (s) => ({ ...s, flags: {} })],
    ['an unknown tile type', (s) => ({ ...s, tiles: { ...s.tiles, '0,0': { ...s.tiles['0,0'], tile: 'lava' } } })],
    ['an impossible speed', (s) => ({ ...s, clock: { ...s.clock, speed: 1000 } })],
    ['a rewound id counter', (s) => ({ ...s, nextId: 1 })],
    ['a non-numeric store', (s) => ({ ...s, entities: { ...s.entities, e1: { ...s.entities.e1, store: '2' } } })],
    ['an entity its tile does not point to', (s) => ({ ...s, tiles: { ...s.tiles, '0,0': { tile: 'grass', owned: true } } })],
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

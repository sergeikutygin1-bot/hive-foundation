import type { Registry } from '../content/registry';
import { isTileId } from '../content/tiles';
import { advance } from '../sim/advance';
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
  // Last line of defence: a save that passes the shape checks must also survive one sim tick.
  advance(structuredClone(data), reg, 1);
  return data;
}

const SPEEDS: readonly unknown[] = [0, 1, 2, 4];
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Deep shape check: anything that passes can be rendered and simulated without throwing. */
function assertGameState(data: unknown, reg: Registry): asserts data is GameState {
  if (!isObject(data)) throw new Error('Save is not an object');
  if (typeof data.seed !== 'number' || !Number.isInteger(data.nextId) || (data.nextId as number) < 1) {
    throw new Error('Save is missing seed or nextId');
  }
  const clock = data.clock;
  if (!isObject(clock) || !Number.isInteger(clock.tick) || (clock.tick as number) < 0 || !SPEEDS.includes(clock.speed)) {
    throw new Error('Save has an invalid clock');
  }
  const { tiles, entities, inventory, flags } = data;
  if (!isObject(tiles) || !isObject(entities) || !isObject(inventory) || !isObject(flags) || !isObject(flags.fullNotified)) {
    throw new Error('Save is missing tiles, entities, inventory or flags');
  }
  for (const [key, tile] of Object.entries(tiles)) {
    if (!isObject(tile) || typeof tile.tile !== 'string' || !isTileId(tile.tile) || typeof tile.owned !== 'boolean') {
      throw new Error(`Save has an invalid tile at ${key}`);
    }
    if (tile.decor !== undefined && tile.decor !== 'tree' && tile.decor !== 'rock') throw new Error(`Save has invalid decor at ${key}`);
    if (tile.entityId !== undefined && (typeof tile.entityId !== 'string' || !isObject(entities[tile.entityId]))) {
      throw new Error(`Save tile ${key} points at a missing entity`);
    }
  }
  let highestId = 0;
  for (const [id, e] of Object.entries(entities)) {
    if (!isObject(e) || e.id !== id || typeof e.def !== 'string') throw new Error(`Save has a malformed entity ${id}`);
    const def = reg.findBuildable(e.def);
    if (!def) throw new Error(`Save references an unknown building: ${JSON.stringify(e)}`);
    const at = e.hex;
    if (!isObject(at) || !Number.isInteger(at.q) || !Number.isInteger(at.r)) throw new Error(`Save entity ${id} has no position`);
    const home = tiles[`${at.q},${at.r}`];
    if (!isObject(home) || home.entityId !== id) throw new Error(`Save entity ${id} is not linked to its tile`);
    if (def.producer && (!isFiniteNumber(e.store) || e.store < 0)) throw new Error(`Save entity ${id} has an invalid store`);
    const n = /^e(\d+)$/.exec(id);
    if (n) highestId = Math.max(highestId, Number(n[1]));
  }
  if ((data.nextId as number) <= highestId) throw new Error('Save id counter is behind its entities');
  for (const [res, amount] of Object.entries(inventory)) {
    if (!isFiniteNumber(amount)) throw new Error(`Save has an invalid amount of ${res}`);
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

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

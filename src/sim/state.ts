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

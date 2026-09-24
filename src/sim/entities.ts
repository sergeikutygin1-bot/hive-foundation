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

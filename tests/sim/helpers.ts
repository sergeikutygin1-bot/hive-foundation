import { DEFAULT_PACKS } from '../../src/content/default';
import { createRegistry } from '../../src/content/registry';
import { despawnEntity } from '../../src/sim/entities';
import { createInitialState, type Entity, type GameState } from '../../src/sim/state';

export const reg = createRegistry(DEFAULT_PACKS);

export function newGame(seed = 1): GameState {
  return createInitialState(seed, reg);
}

export function clearEntities(state: GameState): void {
  for (const id of Object.keys(state.entities)) despawnEntity(state, id);
}

export function entitiesOf(state: GameState, def: string): Entity[] {
  return Object.values(state.entities).filter((e) => e.def === def);
}

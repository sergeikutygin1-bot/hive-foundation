import { hexKey, type Hex } from '../core/hex';
import type { Registry } from '../content/registry';
import { TILES } from '../content/tiles';
import { COINS, type ResourceId } from '../content/types';
import { addResources, canAfford, payCost, refundFor } from './economy';
import { despawnEntity, entitiesWith, spawnEntity } from './entities';
import type { GameEvent } from './events';
import type { GameState, Speed } from './state';

export type Command =
  | { type: 'place'; def: string; hex: Hex }
  | { type: 'remove'; id: string }
  | { type: 'harvest'; id: string }
  | { type: 'harvestAll' }
  | { type: 'sell'; resource: ResourceId; amount: number | 'all' }
  | { type: 'setSpeed'; speed: Speed };

export const REJECT_REASONS = [
  'unknown_def',
  'not_purchasable',
  'out_of_bounds',
  'not_owned',
  'tile_occupied',
  'tile_not_buildable',
  'insufficient_funds',
  'unknown_entity',
  'not_removable',
  'last_producer',
  'nothing_to_harvest',
  'invalid_amount',
  'insufficient_resource',
  'not_sellable',
  'invalid_speed',
  /** Only produced by game/session when the sim throws in a production build. */
  'internal_error',
] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

export type CommandResult = { ok: true; events: GameEvent[] } | { ok: false; reason: RejectReason };

const SPEEDS: readonly Speed[] = [0, 1, 2, 4];
/** Tolerance for float noise in resource amounts. */
const EPSILON = 1e-6;

const ok = (events: GameEvent[]): CommandResult => ({ ok: true, events });
const fail = (reason: RejectReason): CommandResult => ({ ok: false, reason });

/** Why a placement would fail, or null if it would succeed. Never mutates. */
export function validatePlace(state: GameState, reg: Registry, defId: string, at: Hex): RejectReason | null {
  const def = reg.findBuildable(defId);
  if (!def) return 'unknown_def';
  if (!def.purchasable) return 'not_purchasable';
  const tile = state.tiles[hexKey(at)];
  if (!tile) return 'out_of_bounds';
  if (!tile.owned) return 'not_owned';
  if (tile.entityId) return 'tile_occupied';
  if (tile.decor || !TILES[tile.tile].buildable || !def.allowedTiles.includes(tile.tile)) return 'tile_not_buildable';
  if (!canAfford(state.inventory, def.cost)) return 'insufficient_funds';
  return null;
}

/** The only way the player changes the game. Validates first, then mutates. */
export function dispatch(state: GameState, reg: Registry, cmd: Command): CommandResult {
  switch (cmd.type) {
    case 'place':
      return place(state, reg, cmd.def, cmd.hex);
    case 'remove':
      return remove(state, reg, cmd.id);
    case 'harvest':
      return harvest(state, reg, cmd.id);
    case 'harvestAll':
      return harvestAll(state, reg);
    case 'sell':
      return sell(state, reg, cmd.resource, cmd.amount);
    case 'setSpeed':
      return setSpeed(state, cmd.speed);
  }
}

function place(state: GameState, reg: Registry, defId: string, at: Hex): CommandResult {
  const reason = validatePlace(state, reg, defId, at);
  if (reason) return fail(reason);
  const def = reg.buildable(defId);
  payCost(state.inventory, def.cost);
  const entity = spawnEntity(state, reg, defId, at);
  return ok([{ type: 'entityPlaced', entity: { ...entity } }]);
}

function remove(state: GameState, reg: Registry, id: string): CommandResult {
  const entity = state.entities[id];
  if (!entity) return fail('unknown_entity');
  const def = reg.buildable(entity.def);
  if (!def.removable) return fail('not_removable');
  if (def.producer && entitiesWith(state, reg, 'producer').length <= 1) return fail('last_producer');

  const events: GameEvent[] = [];
  const stored = entity.store ?? 0;
  if (def.producer && stored > 0) {
    addResources(state.inventory, { [def.producer.output]: stored });
    events.push({ type: 'harvested', id, resource: def.producer.output, amount: stored });
  }
  const refund = refundFor(def);
  addResources(state.inventory, refund);
  const removed = despawnEntity(state, id);
  events.push({ type: 'entityRemoved', entity: { ...removed }, refund });
  return ok(events);
}

function harvest(state: GameState, reg: Registry, id: string): CommandResult {
  const entity = state.entities[id];
  if (!entity) return fail('unknown_entity');
  const producer = reg.buildable(entity.def).producer;
  const amount = entity.store ?? 0;
  if (!producer || amount <= 0) return fail('nothing_to_harvest');
  entity.store = 0;
  delete state.flags.fullNotified[id];
  addResources(state.inventory, { [producer.output]: amount });
  return ok([{ type: 'harvested', id, resource: producer.output, amount }]);
}

function harvestAll(state: GameState, reg: Registry): CommandResult {
  const totals = new Map<ResourceId, number>();
  for (const entity of entitiesWith(state, reg, 'producer')) {
    const amount = entity.store ?? 0;
    const producer = reg.buildable(entity.def).producer;
    if (!producer || amount <= 0) continue;
    totals.set(producer.output, (totals.get(producer.output) ?? 0) + amount);
    entity.store = 0;
    delete state.flags.fullNotified[entity.id];
  }
  if (totals.size === 0) return fail('nothing_to_harvest');
  const events: GameEvent[] = [];
  for (const [resource, amount] of totals) {
    addResources(state.inventory, { [resource]: amount });
    events.push({ type: 'harvested', resource, amount });
  }
  return ok(events);
}

function sell(state: GameState, reg: Registry, resource: ResourceId, amount: number | 'all'): CommandResult {
  const price = reg.price(resource);
  if (!price) return fail('not_sellable');
  const have = state.inventory[resource] ?? 0;
  let qty: number;
  if (amount === 'all') {
    if (have <= 0) return fail('insufficient_resource');
    qty = have;
  } else {
    if (!Number.isFinite(amount) || amount <= 0) return fail('invalid_amount');
    if (amount > have + EPSILON) return fail('insufficient_resource');
    qty = Math.min(amount, have);
  }
  const coins = qty * price.sell;
  const left = have - qty;
  state.inventory[resource] = left < EPSILON ? 0 : left;
  addResources(state.inventory, { [COINS]: coins });
  return ok([{ type: 'sold', resource, amount: qty, coins }]);
}

function setSpeed(state: GameState, speed: Speed): CommandResult {
  if (!SPEEDS.includes(speed)) return fail('invalid_speed');
  state.clock.speed = speed;
  return ok([{ type: 'speedChanged', speed }]);
}

import type { Registry } from '../content/registry';
import { COINS, type Amounts, type BuildableDef, type ResourceId } from '../content/types';
import { entitiesWith } from './entities';
import type { GameEvent } from './events';
import { outputPerDay } from './production';
import type { GameState } from './state';

export const REFUND_RATE = 0.5;

type Inventory = Record<ResourceId, number>;

export function canAfford(inventory: Inventory, cost: Amounts): boolean {
  return Object.entries(cost).every(([res, amount]) => (inventory[res] ?? 0) >= (amount ?? 0));
}

export function payCost(inventory: Inventory, cost: Amounts): void {
  for (const [res, amount] of Object.entries(cost)) inventory[res] = (inventory[res] ?? 0) - (amount ?? 0);
}

export function addResources(inventory: Inventory, amounts: Amounts): void {
  for (const [res, amount] of Object.entries(amounts)) inventory[res] = (inventory[res] ?? 0) + (amount ?? 0);
}

export function refundFor(def: BuildableDef): Amounts {
  const refund: Amounts = {};
  for (const [res, amount] of Object.entries(def.cost)) {
    const back = Math.floor((amount ?? 0) * REFUND_RATE);
    if (back > 0) refund[res] = back;
  }
  return refund;
}

export function totalOutputPerDay(state: GameState, reg: Registry): number {
  return entitiesWith(state, reg, 'producer').reduce((sum, e) => sum + outputPerDay(state, reg, e.id), 0);
}

/** Everything the player could still turn into coins: producer stores plus priced inventory. */
export function goodsOnHand(state: GameState, reg: Registry): number {
  let total = 0;
  for (const e of entitiesWith(state, reg, 'producer')) total += e.store ?? 0;
  for (const [res, amount] of Object.entries(state.inventory)) if (reg.price(res)) total += amount;
  return total;
}

/**
 * Dead-end guard (spec §5.8): with no production, nothing to sell and too few coins for the
 * cheapest source, top coins up to that cost.
 */
export function applySafetyNet(state: GameState, reg: Registry): GameEvent | null {
  const cheapest = reg.cheapestSourceCost();
  if (!Number.isFinite(cheapest)) return null;
  const coins = state.inventory[COINS] ?? 0;
  if (coins >= cheapest) return null;
  if (totalOutputPerDay(state, reg) > 0) return null;
  if (goodsOnHand(state, reg) > 0) return null;
  state.inventory[COINS] = cheapest;
  return { type: 'safetyNetGranted', coins: cheapest - coins };
}

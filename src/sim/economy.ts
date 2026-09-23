import type { Amounts, BuildableDef, ResourceId } from '../content/types';

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

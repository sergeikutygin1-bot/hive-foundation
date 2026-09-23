import { isTileId } from './tiles';
import {
  COINS, type BuildableDef, type ContentPack, type PriceDef, type ResourceDef, type ResourceId, type StartingSetup,
} from './types';

export class Registry {
  readonly resources = new Map<ResourceId, ResourceDef>();
  readonly buildables = new Map<string, BuildableDef>();
  readonly prices = new Map<ResourceId, PriceDef>();
  readonly start: StartingSetup = { inventory: {}, entities: [] };

  registerPack(pack: ContentPack): void {
    for (const r of pack.resources) {
      if (this.resources.has(r.id)) throw new Error(`Duplicate resource id "${r.id}" in pack "${pack.id}"`);
      this.resources.set(r.id, r);
    }
    for (const b of pack.buildables) {
      if (this.buildables.has(b.id)) throw new Error(`Duplicate buildable id "${b.id}" in pack "${pack.id}"`);
      this.buildables.set(b.id, b);
    }
    for (const p of pack.prices) {
      if (this.prices.has(p.resource)) throw new Error(`Duplicate price for "${p.resource}" in pack "${pack.id}"`);
      this.prices.set(p.resource, p);
    }
    if (pack.start) {
      Object.assign(this.start.inventory, pack.start.inventory);
      this.start.entities.push(...pack.start.entities);
    }
  }

  buildable(id: string): BuildableDef {
    const def = this.buildables.get(id);
    if (!def) throw new Error(`Unknown buildable "${id}"`);
    return def;
  }

  findBuildable(id: string): BuildableDef | undefined {
    return this.buildables.get(id);
  }

  price(resource: ResourceId): PriceDef | undefined {
    return this.prices.get(resource);
  }

  purchasable(): BuildableDef[] {
    return [...this.buildables.values()].filter((b) => b.purchasable);
  }

  /** Coin cost of the cheapest purchasable source; Infinity if there is none. */
  cheapestSourceCost(): number {
    let min = Infinity;
    for (const b of this.purchasable()) if (b.source) min = Math.min(min, b.cost[COINS] ?? 0);
    return min;
  }
}

const isPositive = (n: number | undefined): boolean => n !== undefined && Number.isFinite(n) && n > 0;

export function validateRegistry(reg: Registry): string[] {
  const problems: string[] = [];
  if (!reg.resources.has(COINS)) problems.push(`Missing required resource "${COINS}"`);

  for (const b of reg.buildables.values()) {
    const where = `buildable "${b.id}"`;
    for (const [res, amount] of Object.entries(b.cost)) {
      if (!reg.resources.has(res)) problems.push(`${where}: cost uses unknown resource "${res}"`);
      if (!isPositive(amount)) problems.push(`${where}: cost of "${res}" must be a positive number`);
    }
    if (b.allowedTiles.length === 0) problems.push(`${where}: allowedTiles is empty`);
    for (const t of b.allowedTiles) if (!isTileId(t)) problems.push(`${where}: unknown tile "${t}"`);
    if (b.setsTile !== undefined && !isTileId(b.setsTile)) problems.push(`${where}: setsTile uses unknown tile "${b.setsTile}"`);
    if (b.producer) {
      const p = b.producer;
      if (!reg.resources.has(p.output)) problems.push(`${where}: producer output "${p.output}" is not a resource`);
      if (!Number.isInteger(p.range) || p.range < 0) problems.push(`${where}: producer range must be a non-negative integer`);
      for (const k of ['conversion', 'capacity', 'maxIntakePerDay'] as const) {
        if (!isPositive(p[k])) problems.push(`${where}: producer ${k} must be a positive number`);
      }
    }
    if (b.source && !isPositive(b.source.yieldPerDay)) problems.push(`${where}: source yieldPerDay must be a positive number`);
  }

  for (const p of reg.prices.values()) {
    if (!reg.resources.has(p.resource)) problems.push(`price: unknown resource "${p.resource}"`);
    if (!isPositive(p.sell)) problems.push(`price for "${p.resource}": sell must be a positive number`);
  }

  for (const [res, amount] of Object.entries(reg.start.inventory)) {
    if (!reg.resources.has(res)) problems.push(`start: unknown resource "${res}"`);
    if (amount === undefined || !Number.isFinite(amount) || amount < 0) problems.push(`start: "${res}" must be a non-negative number`);
  }
  for (const e of reg.start.entities) {
    if (!reg.buildables.has(e.def)) problems.push(`start: unknown buildable "${e.def}"`);
  }
  return problems;
}

/** Registers and validates packs. Invalid content is a bug, so this always throws. */
export function createRegistry(packs: readonly ContentPack[]): Registry {
  const reg = new Registry();
  for (const pack of packs) reg.registerPack(pack);
  const problems = validateRegistry(reg);
  if (problems.length > 0) throw new Error(`Invalid content:\n- ${problems.join('\n- ')}`);
  return reg;
}

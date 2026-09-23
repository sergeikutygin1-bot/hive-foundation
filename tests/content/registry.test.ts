import { describe, expect, it } from 'vitest';
import { DEFAULT_PACKS } from '../../src/content/default';
import { Registry, createRegistry, validateRegistry } from '../../src/content/registry';
import type { ContentPack } from '../../src/content/types';

function validPack(): ContentPack {
  return {
    id: 'test',
    resources: [{ id: 'coins', unit: 'coin' }, { id: 'jam', unit: 'kg' }],
    buildables: [
      {
        id: 'jar', cost: { coins: 5 }, allowedTiles: ['grass'], purchasable: true, removable: true,
        producer: { consumes: 'nectar', range: 1, output: 'jam', conversion: 1, capacity: 2, maxIntakePerDay: 1 },
      },
      {
        id: 'bush', cost: { coins: 2 }, allowedTiles: ['grass'], setsTile: 'soil', purchasable: true, removable: true,
        source: { kind: 'nectar', flowerType: 'berry', yieldPerDay: 1 },
      },
    ],
    prices: [{ resource: 'jam', sell: 3 }],
    start: { inventory: { coins: 10 }, entities: [{ def: 'jar', hex: { q: 0, r: 0 } }] },
  };
}

function problemsFor(pack: ContentPack): string[] {
  const reg = new Registry();
  reg.registerPack(pack);
  return validateRegistry(reg);
}

describe('validateRegistry', () => {
  it('accepts a valid pack', () => {
    expect(problemsFor(validPack())).toEqual([]);
  });

  it('flags a cost in an unknown resource', () => {
    const p = validPack();
    p.buildables[0].cost = { gems: 1 };
    expect(problemsFor(p).join('\n')).toContain('unknown resource "gems"');
  });

  it('flags a non-positive cost', () => {
    const p = validPack();
    p.buildables[0].cost = { coins: 0 };
    expect(problemsFor(p).join('\n')).toContain('must be a positive number');
  });

  it('flags a producer whose output is not a resource', () => {
    const p = validPack();
    p.buildables[0].producer!.output = 'nothing';
    expect(problemsFor(p).join('\n')).toContain('producer output "nothing"');
  });

  it('flags a negative source yield', () => {
    const p = validPack();
    p.buildables[1].source!.yieldPerDay = -1;
    expect(problemsFor(p).join('\n')).toContain('yieldPerDay');
  });

  it('flags empty or unknown tiles', () => {
    const p = validPack();
    p.buildables[0].allowedTiles = [];
    p.buildables[1].allowedTiles = ['lava' as never];
    const text = problemsFor(p).join('\n');
    expect(text).toContain('allowedTiles is empty');
    expect(text).toContain('unknown tile "lava"');
  });

  it('flags bad prices and bad starting setup', () => {
    const p = validPack();
    p.prices = [{ resource: 'gold', sell: 0 }];
    p.start = { inventory: { rubies: 1 }, entities: [{ def: 'castle', hex: { q: 0, r: 0 } }] };
    const text = problemsFor(p).join('\n');
    expect(text).toContain('price: unknown resource "gold"');
    expect(text).toContain('sell must be a positive number');
    expect(text).toContain('start: unknown resource "rubies"');
    expect(text).toContain('start: unknown buildable "castle"');
  });

  it('requires the coins resource', () => {
    const p = validPack();
    p.resources = p.resources.filter((r) => r.id !== 'coins');
    p.buildables.forEach((b) => (b.cost = {}));
    p.start = undefined;
    expect(problemsFor(p).join('\n')).toContain('Missing required resource "coins"');
  });
});

describe('Registry', () => {
  it('rejects duplicate ids across packs', () => {
    const reg = new Registry();
    reg.registerPack(validPack());
    expect(() => reg.registerPack({ ...validPack(), id: 'again' })).toThrow('Duplicate resource id "coins"');
  });

  it('createRegistry throws with every problem listed', () => {
    const p = validPack();
    p.buildables[0].cost = { gems: 1 };
    expect(() => createRegistry([p])).toThrow(/Invalid content:[\s\S]*gems/);
  });

  it('answers lookups', () => {
    const reg = createRegistry([validPack()]);
    expect(reg.buildable('jar').producer?.output).toBe('jam');
    expect(() => reg.buildable('nope')).toThrow('Unknown buildable "nope"');
    expect(reg.findBuildable('nope')).toBeUndefined();
    expect(reg.price('jam')?.sell).toBe(3);
    expect(reg.purchasable().map((b) => b.id)).toEqual(['jar', 'bush']);
    expect(reg.cheapestSourceCost()).toBe(2);
  });
});

describe('default packs', () => {
  it('are valid and match the spec starting setup', () => {
    const reg = createRegistry(DEFAULT_PACKS);
    expect(reg.purchasable().map((b) => b.id)).toEqual(['hive', 'bed_wildflower']);
    expect(reg.cheapestSourceCost()).toBe(20);
    expect(reg.start.inventory).toEqual({ coins: 60, honey_wildflower: 0 });
    const defs = reg.start.entities.map((e) => e.def).sort();
    expect(defs).toEqual(['bed_wildflower', 'bed_wildflower', 'bed_wildflower', 'hive', 'house']);
    expect(reg.buildable('house').removable).toBe(false);
    expect(reg.price('honey_wildflower')?.sell).toBe(15);
  });
});

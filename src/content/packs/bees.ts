import type { ContentPack } from '../types';

/** First production chain: wildflower beds feed hives, hives make honey. Numbers from spec §5.9. */
export const beesPack: ContentPack = {
  id: 'bees',
  resources: [{ id: 'honey_wildflower', unit: 'kg' }],
  buildables: [
    { id: 'house', cost: {}, allowedTiles: ['grass'], purchasable: false, removable: false },
    {
      id: 'hive',
      cost: { coins: 120 },
      allowedTiles: ['grass'],
      purchasable: true,
      removable: true,
      producer: { consumes: 'nectar', range: 1, output: 'honey_wildflower', conversion: 0.25, capacity: 5, maxIntakePerDay: 4 },
    },
    {
      id: 'bed_wildflower',
      cost: { coins: 20 },
      allowedTiles: ['grass'],
      setsTile: 'soil',
      purchasable: true,
      removable: true,
      source: { kind: 'nectar', flowerType: 'wildflower', yieldPerDay: 1 },
    },
  ],
  prices: [{ resource: 'honey_wildflower', sell: 15 }],
  start: {
    inventory: { coins: 60, honey_wildflower: 0 },
    // Pointy-top neighbors of the origin: house NW, beds W / E / SW. NE (1,-1) and SE (0,1) stay free.
    entities: [
      { def: 'hive', hex: { q: 0, r: 0 } },
      { def: 'house', hex: { q: 0, r: -1 } },
      { def: 'bed_wildflower', hex: { q: -1, r: 0 } },
      { def: 'bed_wildflower', hex: { q: 1, r: 0 } },
      { def: 'bed_wildflower', hex: { q: -1, r: 1 } },
    ],
  },
};

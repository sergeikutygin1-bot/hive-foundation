import { COINS, type ContentPack } from '../types';

/** Resources every game needs regardless of production chains. */
export const basePack: ContentPack = {
  id: 'base',
  resources: [{ id: COINS, unit: 'coin' }],
  buildables: [],
  prices: [],
};

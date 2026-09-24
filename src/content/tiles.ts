import type { TileDef, TileId } from './types';

export const TILES: Record<TileId, TileDef> = {
  grass: { id: 'grass', buildable: true },
  soil: { id: 'soil', buildable: true },
  water: { id: 'water', buildable: false },
};

export function isTileId(v: string): v is TileId {
  return Object.hasOwn(TILES, v);
}

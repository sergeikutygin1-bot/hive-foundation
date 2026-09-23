import { ORIGIN, hexDistance, hexKey, hexRange, type HexKey } from '../core/hex';
import { mulberry32, pick } from '../core/rng';
import type { Tile } from './state';

export const MAP_RADIUS = 12;
export const PLOT_RADIUS = 3;

const LAKE_MIN_CENTER_DISTANCE = PLOT_RADIUS + 3;
const LAKE_KEEP_OUT = PLOT_RADIUS + 1;
const TREE_CHANCE = 0.1;
const ROCK_CHANCE = 0.03;

/** Seeded map: grass disc, a few ragged lakes outside the plot, scattered trees and rocks. */
export function generateTiles(seed: number): Record<HexKey, Tile> {
  const rng = mulberry32(seed);
  const all = hexRange(ORIGIN, MAP_RADIUS);
  const tiles: Record<HexKey, Tile> = {};
  for (const h of all) tiles[hexKey(h)] = { tile: 'grass', owned: hexDistance(h, ORIGIN) <= PLOT_RADIUS };

  const lakeCenters = all.filter((h) => hexDistance(h, ORIGIN) >= LAKE_MIN_CENTER_DISTANCE);
  const lakeCount = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < lakeCount; i++) {
    const center = pick(rng, lakeCenters);
    const radius = 1 + Math.floor(rng() * 2);
    for (const h of hexRange(center, radius)) {
      const tile = tiles[hexKey(h)];
      if (!tile || hexDistance(h, ORIGIN) <= LAKE_KEEP_OUT) continue;
      if (hexDistance(h, center) === radius && rng() < 0.4) continue; // ragged shoreline
      tile.tile = 'water';
    }
  }

  for (const h of all) {
    const tile = tiles[hexKey(h)];
    if (tile.tile !== 'grass' || hexDistance(h, ORIGIN) <= PLOT_RADIUS) continue;
    const roll = rng();
    if (roll < TREE_CHANCE) tile.decor = 'tree';
    else if (roll < TREE_CHANCE + ROCK_CHANCE) tile.decor = 'rock';
  }
  return tiles;
}

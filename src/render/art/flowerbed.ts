import * as THREE from 'three';
import { flowerColors, palette } from './palette';
import { cylinder, ico, merge } from './parts';

const FLOWERS_PER_BED = 11;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Flowers spread by a golden-angle spiral over the bed's soil tile. */
export function makeFlowerBed(flowerType: string): THREE.BufferGeometry {
  const colors = flowerColors[flowerType] ?? ['#ffffff'];
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < FLOWERS_PER_BED; i++) {
    const radius = 0.62 * Math.sqrt((i + 0.5) / FLOWERS_PER_BED);
    const angle = i * GOLDEN_ANGLE;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const height = 0.12 + (i % 3) * 0.03;
    parts.push(cylinder(0.012, 0.014, height, 4, palette.stem, { at: [x, height / 2, z] }));
    const petal = colors[i % colors.length];
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2 + i;
      parts.push(ico(0.032, petal, { scale: [1, 0.45, 1], at: [x + Math.cos(a) * 0.04, height, z + Math.sin(a) * 0.04] }));
    }
    parts.push(ico(0.026, palette.flowerCenter, { at: [x, height + 0.01, z] }));
  }
  return merge(parts);
}

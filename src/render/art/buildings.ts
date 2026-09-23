import * as THREE from 'three';
import { palette } from './palette';
import { box, colored, merge } from './parts';

const corners = (x: number, z: number): [number, number][] => [[-x, -z], [-x, z], [x, -z], [x, z]];

/** Timber-framed cottage with a terracotta gable roof. Front (door) faces +z. */
export function makeHouse(): THREE.BufferGeometry {
  // Triangular prism: 3-sided cylinder, apex rotated to point up, axis laid along x.
  const roof = colored(new THREE.CylinderGeometry(0.62, 0.62, 1.04, 3, 1, false, Math.PI / 2), palette.roof, {
    rotZ: Math.PI / 2,
    at: [0, 1.09, 0],
  });
  return merge([
    box(0.9, 0.08, 0.72, palette.timber, { at: [0, 0.04, 0] }),
    box(0.84, 0.66, 0.66, palette.wall, { at: [0, 0.41, 0] }),
    ...corners(0.42, 0.33).map(([x, z]) => box(0.06, 0.66, 0.06, palette.timber, { at: [x, 0.41, z] })),
    box(0.86, 0.05, 0.68, palette.timber, { at: [0, 0.76, 0] }),
    roof,
    box(0.12, 0.35, 0.12, palette.roofDark, { at: [0.26, 1.3, -0.3] }),
    box(0.2, 0.34, 0.03, palette.door, { at: [0, 0.25, 0.34] }),
    box(0.15, 0.15, 0.03, palette.window, { at: [-0.25, 0.48, 0.34] }),
    box(0.15, 0.15, 0.03, palette.window, { at: [0.25, 0.48, 0.34] }),
  ]);
}

/** Langstroth hive on a stand: two boxes, lid, entrance slot and landing board facing +z. */
export function makeHive(): THREE.BufferGeometry {
  return merge([
    ...corners(0.26, 0.24).map(([x, z]) => box(0.06, 0.12, 0.06, palette.wood, { at: [x, 0.06, z] })),
    box(0.66, 0.06, 0.6, palette.wood, { at: [0, 0.15, 0] }),
    box(0.58, 0.3, 0.52, palette.hiveCream, { at: [0, 0.33, 0] }),
    box(0.58, 0.26, 0.52, palette.hiveCream2, { at: [0, 0.61, 0] }),
    box(0.2, 0.03, 0.02, palette.wood, { at: [0, 0.4, 0.265] }),
    box(0.64, 0.07, 0.58, palette.wood, { at: [0, 0.775, 0] }),
    box(0.3, 0.04, 0.02, palette.hiveDark, { at: [0, 0.22, 0.265] }),
    box(0.36, 0.02, 0.1, palette.wood, { at: [0, 0.19, 0.3] }),
  ]);
}

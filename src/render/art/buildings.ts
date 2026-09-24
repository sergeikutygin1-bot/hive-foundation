import * as THREE from 'three';
import { palette } from './palette';
import { box, colored, merge, rbox } from './parts';

const corners = (x: number, z: number): [number, number][] => [[-x, -z], [-x, z], [x, -z], [x, z]];

/** Vertical stretch tuned at the art gate: taller props read better from the game camera; footprint unchanged. */
const HOUSE_HEIGHT_SCALE = 1.35;
const HIVE_HEIGHT_SCALE = 1.15;

function stretchY(g: THREE.BufferGeometry, k: number): THREE.BufferGeometry {
  g.scale(1, k, 1);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/** Timber-framed cottage with a terracotta gable roof. Front (door) faces +z. */
export function makeHouse(): THREE.BufferGeometry {
  // Gable roof as a triangular prism: 3-sided cylinder, apex up, ridge along z so the gable faces the
  // camera (+z) over the door. Open-ended so the cream gable wall shows under the overhang.
  const roof = colored(new THREE.CylinderGeometry(0.62, 0.62, 0.84, 3, 1, true, Math.PI), palette.roof, {
    rotX: Math.PI / 2,
    at: [0, 1.09, 0],
    flat: true,
  });
  const gable = colored(new THREE.CylinderGeometry(0.56, 0.56, 0.64, 3, 1, false, Math.PI), palette.wall, {
    rotX: Math.PI / 2,
    at: [0, 1.06, 0],
    flat: true,
  });
  const house = merge([
    rbox(0.9, 0.08, 0.72, 0.03, palette.timber, { at: [0, 0.04, 0] }),
    rbox(0.84, 0.66, 0.66, 0.06, palette.wall, { at: [0, 0.41, 0] }),
    ...corners(0.42, 0.33).map(([x, z]) => box(0.06, 0.66, 0.06, palette.timber, { at: [x, 0.41, z] })),
    rbox(0.86, 0.05, 0.68, 0.02, palette.timber, { at: [0, 0.76, 0] }),
    gable,
    roof,
    rbox(0.12, 0.35, 0.12, 0.03, palette.roofDark, { at: [0.26, 1.3, -0.2] }),
    box(0.2, 0.34, 0.03, palette.door, { at: [0, 0.25, 0.34] }),
    box(0.15, 0.15, 0.03, palette.window, { at: [-0.25, 0.48, 0.34] }),
    box(0.15, 0.15, 0.03, palette.window, { at: [0.25, 0.48, 0.34] }),
  ]);
  return stretchY(house, HOUSE_HEIGHT_SCALE);
}

/** Langstroth hive on a stand: two boxes, lid, entrance slot and landing board facing +z. */
export function makeHive(): THREE.BufferGeometry {
  const hive = merge([
    ...corners(0.26, 0.24).map(([x, z]) => box(0.06, 0.12, 0.06, palette.wood, { at: [x, 0.06, z] })),
    rbox(0.66, 0.06, 0.6, 0.025, palette.wood, { at: [0, 0.15, 0] }),
    rbox(0.58, 0.3, 0.52, 0.05, palette.hiveCream, { at: [0, 0.33, 0] }),
    rbox(0.58, 0.26, 0.52, 0.05, palette.hiveCream2, { at: [0, 0.61, 0] }),
    box(0.2, 0.03, 0.02, palette.wood, { at: [0, 0.4, 0.265] }),
    rbox(0.64, 0.07, 0.58, 0.03, palette.wood, { at: [0, 0.775, 0] }),
    box(0.3, 0.04, 0.02, palette.hiveDark, { at: [0, 0.22, 0.265] }),
    box(0.36, 0.02, 0.1, palette.wood, { at: [0, 0.19, 0.3] }),
  ]);
  return stretchY(hive, HIVE_HEIGHT_SCALE);
}

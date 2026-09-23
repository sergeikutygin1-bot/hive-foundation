import * as THREE from 'three';
import { hash2 } from '../../core/rng';
import { palette } from './palette';
import { colored, cone, cylinder, ico, merge } from './parts';

export function makeRoundTree(): THREE.BufferGeometry {
  return merge([
    cylinder(0.06, 0.09, 0.4, 6, palette.trunk, { at: [0, 0.2, 0] }),
    ico(0.32, palette.leaf1, { at: [0, 0.62, 0] }),
    ico(0.22, palette.leaf2, { at: [0.18, 0.5, 0.08] }),
    ico(0.2, palette.leaf3, { at: [-0.14, 0.55, -0.12] }),
  ]);
}

export function makePineTree(): THREE.BufferGeometry {
  return merge([
    cylinder(0.05, 0.07, 0.3, 6, palette.trunk, { at: [0, 0.15, 0] }),
    cone(0.34, 0.45, 7, palette.pine, { at: [0, 0.45, 0] }),
    cone(0.27, 0.4, 7, palette.pine2, { at: [0, 0.68, 0] }),
    cone(0.18, 0.34, 7, palette.pine, { at: [0, 0.9, 0] }),
  ]);
}

/** Dodecahedron squashed and jittered. Jitter is keyed by vertex position so shared corners move together (no cracks). */
export function makeRock(): THREE.BufferGeometry {
  const g = new THREE.DodecahedronGeometry(0.24, 0);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n = hash2(Math.round(x * 1000), Math.round(z * 1000) + Math.round(y * 1000) * 7, 99) - 0.5;
    const k = 1 + n * 0.35;
    pos.setXYZ(i, x * k, y * k * 0.6, z * k * 0.85);
  }
  g.computeVertexNormals();
  return merge([colored(g, palette.rock, { at: [0, 0.14, 0] })]);
}

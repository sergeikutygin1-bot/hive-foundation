import * as THREE from 'three';
import { solidMaterial, veilMaterial } from './materials';
import { palette } from './palette';
import { capsule, colored, cylinder, merge, sphere } from './parts';

/** The tiny beekeeper: white suit, wide-brim hat, see-through veil. Idle only in sub-project 1. */
export function makeBeekeeper(): THREE.Group {
  const body = merge([
    capsule(0.1, 0.16, palette.suit, { at: [0, 0.2, 0] }),
    capsule(0.035, 0.14, palette.suit, { rotZ: 0.25, at: [0.13, 0.24, 0] }),
    capsule(0.035, 0.14, palette.suit, { rotZ: -0.25, at: [-0.13, 0.24, 0] }),
    sphere(0.04, 6, 4, palette.glove, { at: [0.16, 0.14, 0] }),
    sphere(0.04, 6, 4, palette.glove, { at: [-0.16, 0.14, 0] }),
    sphere(0.08, 10, 8, palette.skin, { at: [0, 0.44, 0] }),
    cylinder(0.18, 0.18, 0.015, 14, palette.hat, { at: [0, 0.52, 0] }),
    cylinder(0.08, 0.09, 0.08, 12, palette.hat, { at: [0, 0.57, 0] }),
  ]);
  const veilGeo = colored(new THREE.CylinderGeometry(0.12, 0.16, 0.14, 14, 1, true), palette.veil, { at: [0, 0.44, 0] });

  const bodyMesh = new THREE.Mesh(body, solidMaterial());
  bodyMesh.castShadow = true;
  const veil = new THREE.Mesh(veilGeo, veilMaterial());
  const group = new THREE.Group();
  group.name = 'beekeeper';
  group.add(bodyMesh, veil);
  return group;
}

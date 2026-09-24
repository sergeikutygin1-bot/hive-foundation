import * as THREE from 'three';
import { palette } from './palette';

let solid: THREE.MeshLambertMaterial | null = null;
let veil: THREE.MeshLambertMaterial | null = null;
const ghosts = new Map<'valid' | 'invalid', THREE.MeshBasicMaterial>();

/** Shared by every prop: colors come from vertex colors; shading is smooth so rounded parts read soft. */
export function solidMaterial(): THREE.MeshLambertMaterial {
  solid ??= new THREE.MeshLambertMaterial({ vertexColors: true });
  return solid;
}

export function veilMaterial(): THREE.MeshLambertMaterial {
  veil ??= new THREE.MeshLambertMaterial({
    vertexColors: true, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false,
  });
  return veil;
}

export function ghostMaterial(tone: 'valid' | 'invalid'): THREE.MeshBasicMaterial {
  let m = ghosts.get(tone);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color: tone === 'valid' ? palette.highlightValid : palette.highlightInvalid,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    ghosts.set(tone, m);
  }
  return m;
}

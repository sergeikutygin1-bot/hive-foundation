import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type Vec3 = [number, number, number];

export interface PartOptions {
  at?: Vec3;
  scale?: Vec3;
  rotX?: number;
  rotY?: number;
  rotZ?: number;
  /** Keep hard facets (e.g. roof planes) even though the prop material shades smoothly. */
  flat?: boolean;
}

/**
 * Non-indexed copy with a flat vertex color, transformed (scale, rotate X/Z/Y, translate).
 * UVs are dropped (props are untextured) so every part merges with every other.
 */
export function colored(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, opts: PartOptions = {}): THREE.BufferGeometry {
  let g = geo;
  if (geo.index) {
    g = geo.toNonIndexed();
    geo.dispose();
  }
  if (opts.scale) g.scale(...opts.scale);
  if (opts.rotX) g.rotateX(opts.rotX);
  if (opts.rotZ) g.rotateZ(opts.rotZ);
  if (opts.rotY) g.rotateY(opts.rotY);
  if (opts.at) g.translate(...opts.at);
  g.deleteAttribute('uv');
  if (opts.flat) g.computeVertexNormals(); // non-indexed geometry gets per-face normals
  const c = new THREE.Color(color);
  const count = g.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

export const box = (w: number, h: number, d: number, color: THREE.ColorRepresentation, opts?: PartOptions) =>
  colored(new THREE.BoxGeometry(w, h, d), color, opts);

/** Box with softly rounded edges; radius must stay under half the smallest side. */
export const rbox = (w: number, h: number, d: number, radius: number, color: THREE.ColorRepresentation, opts?: PartOptions) =>
  colored(new RoundedBoxGeometry(w, h, d, 3, radius), color, opts);

export const cylinder = (
  rTop: number, rBottom: number, h: number, segments: number, color: THREE.ColorRepresentation, opts?: PartOptions,
) => colored(new THREE.CylinderGeometry(rTop, rBottom, h, segments), color, opts);

export const cone = (r: number, h: number, segments: number, color: THREE.ColorRepresentation, opts?: PartOptions) =>
  colored(new THREE.ConeGeometry(r, h, segments), color, opts);

export const ico = (r: number, color: THREE.ColorRepresentation, opts?: PartOptions) =>
  colored(new THREE.IcosahedronGeometry(r, 0), color, opts);

/** Rounded low-poly lump (subdivided icosahedron with smooth normals): tree crowns and bushes. */
export const blob = (r: number, color: THREE.ColorRepresentation, opts?: PartOptions) =>
  colored(new THREE.IcosahedronGeometry(r, 1), color, opts);

export const sphere = (r: number, wSeg: number, hSeg: number, color: THREE.ColorRepresentation, opts?: PartOptions) =>
  colored(new THREE.SphereGeometry(r, wSeg, hSeg), color, opts);

export const capsule = (r: number, length: number, color: THREE.ColorRepresentation, opts?: PartOptions) =>
  colored(new THREE.CapsuleGeometry(r, length, 4, 8), color, opts);

/** One geometry, one draw call, per prop. */
export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error('merge: parts have incompatible attributes');
  for (const p of parts) p.dispose();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

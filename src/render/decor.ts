import * as THREE from 'three';
import { hexToWorld, parseHexKey, type HexKey } from '../core/hex';
import { hash2 } from '../core/rng';
import type { Tile } from '../sim/state';
import { solidMaterial } from './art/materials';
import { makePineTree, makeRock, makeRoundTree } from './art/nature';

type DecorKind = 'round' | 'pine' | 'rock';
const KINDS: readonly DecorKind[] = ['round', 'pine', 'rock'];

/** Trees and rocks as three instanced meshes (three draw calls total). */
export function createDecorLayer(tiles: Record<HexKey, Tile>, seed: number) {
  const buckets: Record<DecorKind, THREE.Matrix4[]> = { round: [], pine: [], rock: [] };
  const up = new THREE.Vector3(0, 1, 0);
  for (const [key, tile] of Object.entries(tiles)) {
    if (!tile.decor) continue;
    const h = parseHexKey(key);
    const { x, z } = hexToWorld(h);
    const r1 = hash2(h.q, h.r, seed + 11);
    const r2 = hash2(h.r, h.q, seed + 23);
    const r3 = hash2(h.q + h.r, h.q - h.r, seed + 37);
    const kind: DecorKind = tile.decor === 'rock' ? 'rock' : r1 < 0.6 ? 'round' : 'pine';
    const s = (kind === 'rock' ? 0.8 : 1.0) + r2 * 0.45;
    buckets[kind].push(
      new THREE.Matrix4().compose(
        new THREE.Vector3(x + (r3 - 0.5) * 0.3, 0, z + (r1 - 0.5) * 0.3),
        new THREE.Quaternion().setFromAxisAngle(up, r2 * Math.PI * 2),
        new THREE.Vector3(s, s, s),
      ),
    );
  }

  const geometries: Record<DecorKind, THREE.BufferGeometry> = { round: makeRoundTree(), pine: makePineTree(), rock: makeRock() };
  const group = new THREE.Group();
  for (const kind of KINDS) {
    const list = buckets[kind];
    if (list.length === 0) continue;
    const mesh = new THREE.InstancedMesh(geometries[kind], solidMaterial(), list.length);
    list.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `decor-${kind}`;
    group.add(mesh);
  }

  return {
    group,
    counts: { round: buckets.round.length, pine: buckets.pine.length, rock: buckets.rock.length },
    dispose() {
      for (const g of Object.values(geometries)) g.dispose();
    },
  };
}

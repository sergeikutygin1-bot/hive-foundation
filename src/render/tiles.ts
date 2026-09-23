import * as THREE from 'three';
import { HEX_SIZE, hexToWorld, parseHexKey, type HexKey } from '../core/hex';
import { hash2 } from '../core/rng';
import type { Tile } from '../sim/state';
import { palette } from './art/palette';

const TILE_HEIGHT = 0.3;
const WATER_DROP = 0.12;
const TILE_SCALE = 0.95; // gaps show the darker ground plane as seams
const TUFTS_PER_TILE = 6;

export interface TileLayer {
  group: THREE.Group;
  tiles: THREE.InstancedMesh;
  tufts: THREE.InstancedMesh;
  indexOf(key: HexKey): number | undefined;
  setTile(key: HexKey, tile: Tile): void;
  dispose(): void;
}

export function tileColor(tile: Tile, jitter: number, out = new THREE.Color()): THREE.Color {
  const base =
    tile.tile === 'water' ? palette.water
    : tile.tile === 'soil' ? palette.soil
    : tile.owned ? palette.grass
    : palette.grassLocked;
  return out.set(base).offsetHSL(0, 0, (jitter - 0.5) * 0.06);
}

/** One instanced draw call for every tile, one for every grass tuft. */
export function createTileLayer(tiles: Record<HexKey, Tile>, seed: number): TileLayer {
  const keys = Object.keys(tiles);
  const tileGeo = new THREE.CylinderGeometry(HEX_SIZE * TILE_SCALE, HEX_SIZE * TILE_SCALE, TILE_HEIGHT, 6);
  const tileMat = new THREE.MeshLambertMaterial({ flatShading: true });
  const mesh = new THREE.InstancedMesh(tileGeo, tileMat, keys.length);
  mesh.receiveShadow = true;

  const tuftGeo = new THREE.ConeGeometry(0.035, 0.14, 3);
  tuftGeo.translate(0, 0.07, 0);
  const tuftMat = new THREE.MeshLambertMaterial({ color: palette.tuft, flatShading: true });
  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, keys.length * TUFTS_PER_TILE);

  const index = new Map<HexKey, number>();
  const m = new THREE.Matrix4();
  const color = new THREE.Color();
  const pos = new THREE.Vector3();
  const rot = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  const write = (i: number, key: HexKey, tile: Tile) => {
    const h = parseHexKey(key);
    const { x, z } = hexToWorld(h);
    const top = tile.tile === 'water' ? -WATER_DROP : 0;
    m.makeTranslation(x, top - TILE_HEIGHT / 2, z);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, tileColor(tile, hash2(h.q, h.r, seed), color));
    for (let t = 0; t < TUFTS_PER_TILE; t++) {
      const angle = hash2(h.q * 7 + t, h.r * 13 - t, seed) * Math.PI * 2;
      const radius = Math.sqrt(hash2(h.q - t * 3, h.r + t * 5, seed + 1)) * 0.7;
      const s = tile.tile === 'grass' ? 0.7 + hash2(h.q + t, h.r - t, seed + 2) * 0.6 : 0;
      pos.set(x + Math.cos(angle) * radius, 0, z + Math.sin(angle) * radius);
      rot.setFromAxisAngle(up, angle);
      scale.set(s, s, s);
      tufts.setMatrixAt(i * TUFTS_PER_TILE + t, m.compose(pos, rot, scale));
    }
  };

  const flush = () => {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    tufts.instanceMatrix.needsUpdate = true;
  };

  keys.forEach((key, i) => {
    index.set(key, i);
    write(i, key, tiles[key]);
  });
  flush();

  const groundGeo = new THREE.CircleGeometry(HEX_SIZE * 24, 48);
  const groundMat = new THREE.MeshLambertMaterial({ color: palette.ground });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -TILE_HEIGHT + 0.01;
  ground.receiveShadow = true;

  const group = new THREE.Group();
  group.add(ground, mesh, tufts);

  return {
    group,
    tiles: mesh,
    tufts,
    indexOf: (key) => index.get(key),
    setTile(key, tile) {
      const i = index.get(key);
      if (i === undefined) return;
      write(i, key, tile);
      flush();
    },
    dispose() {
      tileGeo.dispose();
      tileMat.dispose();
      tuftGeo.dispose();
      tuftMat.dispose();
      groundGeo.dispose();
      groundMat.dispose();
    },
  };
}

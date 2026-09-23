import * as THREE from 'three';
import { hexKey, worldToHex, type Hex, type HexKey } from '../core/hex';

export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const hit = new THREE.Vector3();

export function clientToNdc(clientX: number, clientY: number, rect: ScreenRect): { x: number; y: number } {
  return {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: -((clientY - rect.top) / rect.height) * 2 + 1,
  };
}

/** Where a screen ray meets the y=0 ground plane. Pure math, no mesh raycasts. */
export function screenToGround(ndcX: number, ndcY: number, camera: THREE.Camera): { x: number; z: number } | null {
  ndc.set(ndcX, ndcY);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.ray.intersectPlane(groundPlane, hit) ? { x: hit.x, z: hit.z } : null;
}

export function pickHex(
  clientX: number, clientY: number, rect: ScreenRect, camera: THREE.Camera, tiles: Record<HexKey, unknown>,
): Hex | null {
  const p = clientToNdc(clientX, clientY, rect);
  const ground = screenToGround(p.x, p.y, camera);
  if (!ground) return null;
  const h = worldToHex(ground.x, ground.z);
  return tiles[hexKey(h)] ? h : null;
}

export function worldToClient(x: number, y: number, z: number, camera: THREE.Camera, rect: ScreenRect): { x: number; y: number } {
  const v = new THREE.Vector3(x, y, z).project(camera);
  return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
}

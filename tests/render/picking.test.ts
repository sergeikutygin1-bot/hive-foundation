import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ORIGIN, hex, hexKey, hexRange, hexToWorld } from '../../src/core/hex';
import { CameraRig } from '../../src/render/camera';
import { pickHex, worldToClient } from '../../src/render/picking';

const rect = { left: 0, top: 0, width: 800, height: 800 };
const tiles = Object.fromEntries(hexRange(ORIGIN, 12).map((h) => [hexKey(h), true]));

function cameraLookingAt(x: number, z: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  new CameraRig(camera, { targetX: x, targetZ: z });
  return camera;
}

describe('picking', () => {
  it('picks the hex under the screen center', () => {
    const target = hex(2, -1);
    const w = hexToWorld(target);
    expect(pickHex(400, 400, rect, cameraLookingAt(w.x, w.z), tiles)).toEqual(target);
  });

  it('round-trips hex -> screen -> hex', () => {
    const camera = cameraLookingAt(0, 0);
    for (const h of hexRange(ORIGIN, 3)) {
      const w = hexToWorld(h);
      const p = worldToClient(w.x, 0, w.z, camera, rect);
      expect(pickHex(p.x, p.y, rect, camera, tiles)).toEqual(h);
    }
  });

  it('returns null where there is no tile', () => {
    expect(pickHex(400, 400, rect, cameraLookingAt(0, 0), {})).toBeNull();
  });
});

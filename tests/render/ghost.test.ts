import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { hex } from '../../src/core/hex';
import { ghostMaterial } from '../../src/render/art/materials';
import { registerDefaultArt } from '../../src/render/art/registry';
import { Ghost } from '../../src/render/ghost';

registerDefaultArt();

const materialOf = (obj: THREE.Object3D): THREE.Material | null => {
  const found: THREE.Material[] = [];
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh) found.push(o.material as THREE.Material);
  });
  return found[0] ?? null;
};

describe('Ghost', () => {
  it('previews a def in valid/invalid tint and hides', () => {
    const ghost = new Ghost();
    ghost.show('hive', hex(1, 0), true);
    expect(ghost.group.visible).toBe(true);
    expect(materialOf(ghost.current!)).toBe(ghostMaterial('valid'));
    expect(ghost.current!.position.x).toBeCloseTo(Math.sqrt(3));
    ghost.show('hive', hex(1, 0), false);
    expect(materialOf(ghost.current!)).toBe(ghostMaterial('invalid'));
    ghost.hide();
    expect(ghost.group.visible).toBe(false);
  });

  it('swaps the preview object when the def changes', () => {
    const ghost = new Ghost();
    ghost.show('hive', hex(0, 0), true);
    const first = ghost.current;
    ghost.show('bed_wildflower', hex(0, 0), true);
    expect(ghost.current).not.toBe(first);
    expect(ghost.group.children).toHaveLength(1);
  });
});

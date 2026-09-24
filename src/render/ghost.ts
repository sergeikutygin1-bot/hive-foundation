import * as THREE from 'three';
import { hexToWorld, type Hex } from '../core/hex';
import { ghostMaterial } from './art/materials';
import { createArt } from './art/registry';

/** Translucent preview of the item being placed. */
export class Ghost {
  readonly group = new THREE.Group();
  private obj: THREE.Object3D | null = null;
  private defId: string | null = null;

  get current(): THREE.Object3D | null {
    return this.obj;
  }

  show(defId: string, h: Hex, valid: boolean): void {
    if (defId !== this.defId) {
      this.clear();
      this.obj = createArt(defId);
      this.defId = defId;
      this.group.add(this.obj);
    }
    const material = ghostMaterial(valid ? 'valid' : 'invalid');
    this.obj?.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.material = material;
        o.castShadow = false;
      }
    });
    const { x, z } = hexToWorld(h);
    this.obj?.position.set(x, 0, z);
    this.group.visible = true;
  }

  hide(): void {
    this.group.visible = false;
  }

  clear(): void {
    if (this.obj) this.group.remove(this.obj);
    this.obj = null;
    this.defId = null;
  }
}

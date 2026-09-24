import * as THREE from 'three';
import { hexKey, hexToWorld } from '../core/hex';
import type { GameState } from '../sim/state';
import { makeBeekeeper } from './art/beekeeper';
import { createArt } from './art/registry';
import type { TileLayer } from './tiles';

/** The beekeeper stands just in front of this building's door. */
const BEEKEEPER_HOME_DEF = 'house';

/** Keeps one 3D object per entity, and refreshes the tile under anything that appears or disappears. */
export class EntitySync {
  beekeeper: THREE.Group | null = null;
  private readonly objects = new Map<string, THREE.Object3D>();

  constructor(
    private readonly parent: THREE.Group,
    private readonly tiles: Pick<TileLayer, 'setTile'>,
  ) {}

  reconcile(state: GameState): { added: string[]; removed: string[] } {
    const added: string[] = [];
    const removed: string[] = [];
    for (const [id, obj] of this.objects) {
      if (state.entities[id]) continue;
      this.parent.remove(obj);
      this.objects.delete(id);
      removed.push(id);
      const key = obj.userData.hexKey as string;
      const tile = state.tiles[key];
      if (tile) this.tiles.setTile(key, tile);
    }
    for (const entity of Object.values(state.entities)) {
      if (this.objects.has(entity.id)) continue;
      const obj = createArt(entity.def);
      const { x, z } = hexToWorld(entity.hex);
      obj.position.set(x, 0, z);
      const key = hexKey(entity.hex);
      obj.userData.entityId = entity.id;
      obj.userData.hexKey = key;
      this.parent.add(obj);
      this.objects.set(entity.id, obj);
      added.push(entity.id);
      this.tiles.setTile(key, state.tiles[key]);
    }
    this.placeBeekeeper(state);
    return { added, removed };
  }

  objectFor(id: string): THREE.Object3D | undefined {
    return this.objects.get(id);
  }

  update(timeSec: number): void {
    if (this.beekeeper) this.beekeeper.position.y = Math.abs(Math.sin(timeSec * 2.2)) * 0.03;
  }

  private placeBeekeeper(state: GameState): void {
    const home = Object.values(state.entities).find((e) => e.def === BEEKEEPER_HOME_DEF);
    if (!home) {
      if (this.beekeeper) this.parent.remove(this.beekeeper);
      this.beekeeper = null;
      return;
    }
    if (!this.beekeeper) {
      this.beekeeper = makeBeekeeper();
      this.parent.add(this.beekeeper);
    }
    const { x, z } = hexToWorld(home.hex);
    this.beekeeper.position.set(x - 0.28, 0, z + 0.6);
  }
}

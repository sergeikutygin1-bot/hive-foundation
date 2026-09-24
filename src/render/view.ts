import * as THREE from 'three';
import { hexToWorld, type Hex } from '../core/hex';
import type { Registry } from '../content/registry';
import type { GameState } from '../sim/state';
import { BadgeLayer } from './badges';
import { CameraRig } from './camera';
import { createDecorLayer } from './decor';
import { Ghost } from './ghost';
import { HexHighlight } from './highlight';
import { addLights } from './lights';
import { pickHex, worldToClient } from './picking';
import { createScene, type SceneContext } from './scene';
import { EntitySync } from './sync';
import { createTileLayer, type TileLayer } from './tiles';

export interface WorldView {
  readonly ctx: SceneContext;
  readonly rig: CameraRig;
  readonly tiles: TileLayer;
  readonly highlight: HexHighlight;
  readonly entities: EntitySync;
  readonly badges: BadgeLayer;
  readonly ghost: Ghost;
  pickHex(clientX: number, clientY: number): Hex | null;
  hexToClient(h: Hex, height?: number): { x: number; y: number };
  syncEntities(state: GameState): void;
  frame(state: GameState, dtSec: number, timeSec: number): void;
}

/** Assembles the 3D world. Reads GameState; never mutates it. */
export function createWorldView(container: HTMLElement, state: GameState, reg: Registry): WorldView {
  const ctx = createScene(container);
  addLights(ctx.scene);
  const rig = new CameraRig(ctx.camera);
  const tiles = createTileLayer(state.tiles, state.seed);
  const decor = createDecorLayer(state.tiles, state.seed);
  const highlight = new HexHighlight();
  const entityRoot = new THREE.Group();
  const entities = new EntitySync(entityRoot, tiles);
  const badges = new BadgeLayer();
  const ghost = new Ghost();
  ctx.scene.add(tiles.group, decor.group, entityRoot, highlight.group, ghost.group);
  entities.reconcile(state);
  const canvas = ctx.renderer.domElement;

  return {
    ctx,
    rig,
    tiles,
    highlight,
    entities,
    badges,
    ghost,
    pickHex: (x, y) => pickHex(x, y, canvas.getBoundingClientRect(), ctx.camera, state.tiles),
    hexToClient(h, height = 0) {
      const p = hexToWorld(h);
      return worldToClient(p.x, height, p.z, ctx.camera, canvas.getBoundingClientRect());
    },
    syncEntities: (s) => {
      entities.reconcile(s);
    },
    frame(s, dtSec, timeSec) {
      rig.update(dtSec);
      entities.update(timeSec);
      badges.update(s, reg, entities);
      ctx.render();
    },
  };
}

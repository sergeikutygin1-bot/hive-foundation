import { hexToWorld, type Hex } from '../core/hex';
import type { GameState } from '../sim/state';
import { CameraRig } from './camera';
import { HexHighlight } from './highlight';
import { addLights } from './lights';
import { pickHex, worldToClient } from './picking';
import { createScene, type SceneContext } from './scene';
import { createTileLayer, type TileLayer } from './tiles';

export interface WorldView {
  readonly ctx: SceneContext;
  readonly rig: CameraRig;
  readonly tiles: TileLayer;
  readonly highlight: HexHighlight;
  pickHex(clientX: number, clientY: number): Hex | null;
  hexToClient(h: Hex, height?: number): { x: number; y: number };
  frame(dtSec: number): void;
}

export function createWorldView(container: HTMLElement, state: GameState): WorldView {
  const ctx = createScene(container);
  addLights(ctx.scene);
  const rig = new CameraRig(ctx.camera);
  const tiles = createTileLayer(state.tiles, state.seed);
  const highlight = new HexHighlight();
  ctx.scene.add(tiles.group, highlight.group);
  const canvas = ctx.renderer.domElement;

  return {
    ctx,
    rig,
    tiles,
    highlight,
    pickHex: (x, y) => pickHex(x, y, canvas.getBoundingClientRect(), ctx.camera, state.tiles),
    hexToClient(h, height = 0) {
      const p = hexToWorld(h);
      return worldToClient(p.x, height, p.z, ctx.camera, canvas.getBoundingClientRect());
    },
    frame(dtSec) {
      rig.update(dtSec);
      ctx.render();
    },
  };
}

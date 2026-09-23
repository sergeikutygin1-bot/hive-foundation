import './base.css';
import { DEFAULT_PACKS } from './content/default';
import { createRegistry } from './content/registry';
import { createFpsMeter } from './game/fps';
import { attachInput } from './game/input';
import { startLoop } from './game/loop';
import { createWorldView } from './render/view';
import { createInitialState } from './sim/state';

const root = document.getElementById('app');
if (!root) throw new Error('#app not found');

const reg = createRegistry(DEFAULT_PACKS);
const seed = Number(new URLSearchParams(location.search).get('seed')) || 1;
const state = createInitialState(seed, reg);
const view = createWorldView(root, state);
const canvas = view.ctx.renderer.domElement;

const fps = createFpsMeter();
root.appendChild(fps.el);

attachInput(canvas, {
  pan: (dx, dy) => view.rig.pan(dx, dy, canvas.clientHeight),
  zoom: (deltaY) => view.rig.zoom(deltaY),
  pinch: (factor) => view.rig.zoomBy(factor),
  hover: (x, y) => {
    const h = view.pickHex(x, y);
    if (h) view.highlight.show(h, 'hover');
    else view.highlight.hide();
  },
  click: () => {},
  cancel: () => {},
  leave: () => view.highlight.hide(),
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'q' || e.key === 'Q') view.rig.rotate(-1);
  if (e.key === 'e' || e.key === 'E') view.rig.rotate(1);
});

startLoop({
  getSpeed: () => 0,
  step: () => {},
  render: (dt) => {
    view.frame(dt);
    fps.frame(dt);
  },
});

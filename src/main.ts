import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import './base.css';
import './ui/styles.css';
import { DEFAULT_PACKS } from './content/default';
import { createRegistry } from './content/registry';
import { Controller } from './game/controller';
import { installDevTools } from './game/devtools';
import { createFpsMeter } from './game/fps';
import { attachInput } from './game/input';
import { createFocusTracker, routeKey } from './game/keys';
import { startLoop } from './game/loop';
import { browserStorage, clearSave, loadGame, saveGame } from './game/save';
import { Session } from './game/session';
import { registerDefaultArt } from './render/art/registry';
import { createWorldView } from './render/view';
import { isWebGLAvailable } from './render/webgl';
import type { Command } from './sim/commands';
import { createInitialState } from './sim/state';
import { createUi } from './ui/app';
import { showFatal, showOverlay } from './ui/fatal';
import { reasonText } from './ui/feedback';
import { t } from './ui/i18n';

const AUTOSAVE_MS = 10_000;

function boot(): void {
  const root = document.getElementById('app');
  if (!root) throw new Error('#app not found');
  if (!isWebGLAvailable()) {
    showFatal(root, t('fatal.noWebglTitle'), t('fatal.noWebglBody'));
    return;
  }

  const reg = createRegistry(DEFAULT_PACKS);
  registerDefaultArt();
  const params = new URLSearchParams(location.search);
  const storage = browserStorage();
  // ?seed=N gives a fresh, deterministic world (dev, e2e) and never touches the player's save.
  const fixedSeed = params.has('seed') ? Number(params.get('seed')) || 1 : null;
  const persist = storage !== null && fixedSeed === null;

  let state = createInitialState(fixedSeed ?? Math.floor(Math.random() * 2 ** 31), reg);
  const notices: string[] = [];
  if (!storage) notices.push(t('notice.noSave'));
  if (persist && storage) {
    const loaded = loadGame(storage, reg);
    if (loaded.status === 'loaded') state = loaded.state;
    else if (loaded.status === 'corrupt') notices.push(t('notice.corruptSave'));
    else if (loaded.status === 'unavailable') notices.push(t('notice.noSave'));
  }

  const session = new Session(reg, state);
  const view = createWorldView(root, session.state, reg);
  const canvas = view.ctx.renderer.domElement;

  let autosave = persist;
  let resetting = false;
  const save = () => {
    if (!autosave || resetting || !storage) return;
    if (!saveGame(storage, session.state)) {
      autosave = false;
      ui.toast(t('notice.noSave'), 'error');
    }
  };

  const send = (cmd: Command) => {
    const result = session.dispatch(cmd);
    if (!result.ok) ui.toast(reasonText(result.reason), 'error');
    return result;
  };

  const ui = createUi(root, {
    reg,
    getState: () => session.state,
    dispatch: send,
    startPlacing: (defId) => controller.startPlacing(defId),
    resetView: () => view.rig.reset(),
    resetSave: () => {
      if (!confirm(t('settings.resetConfirm'))) return;
      resetting = true;
      if (storage) clearSave(storage);
      location.reload();
    },
  });
  const controller = new Controller({ reg, getState: () => session.state, dispatch: send, view, ui });

  session.events.onAny((e) => {
    ui.handleEvent(e);
    if (e.type === 'entityPlaced' || e.type === 'entityRemoved') view.syncEntities(session.state);
  });
  session.onChange(() => ui.update());
  for (const notice of notices) ui.toast(notice, 'error');

  attachInput(canvas, {
    pan: (dx, dy) => view.rig.pan(dx, dy, canvas.clientHeight),
    zoom: (deltaY) => view.rig.zoom(deltaY),
    pinch: (factor) => view.rig.zoomBy(factor),
    hover: (x, y) => controller.hover(view.pickHex(x, y), { x, y }),
    click: (x, y) => controller.click(view.pickHex(x, y), { x, y }),
    cancel: () => controller.cancel(),
    leave: () => controller.hover(null, null),
  });

  const focus = createFocusTracker(window);
  window.addEventListener('keydown', (e) => {
    if (routeKey(e, () => focus.isKeyboardFocused()) !== 'game') return;
    // Drop mouse focus so this key acts as a shortcut, not a second click on the button.
    if (e.target instanceof HTMLButtonElement) e.target.blur();
    if (controller.key(e.key)) e.preventDefault();
  });

  let contextLost = false;
  let overlay: HTMLElement | null = null;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    contextLost = true;
    overlay = showOverlay(root, t('fatal.contextLost'), t('fatal.reload'));
  });
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    overlay?.remove();
    overlay = null;
  });

  const fps = import.meta.env.DEV ? createFpsMeter() : null;
  if (fps) root.appendChild(fps.el);
  const debugSpeed = import.meta.env.DEV ? Math.max(1, Number(params.get('speed')) || 1) : 1;

  startLoop({
    getSpeed: () => (contextLost ? 0 : session.state.clock.speed * debugSpeed),
    step: (ticks) => session.step(ticks),
    render: (dt, time) => {
      if (contextLost) return;
      view.frame(session.state, dt, time);
      fps?.frame(dt);
    },
  });

  setInterval(save, AUTOSAVE_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
  });
  window.addEventListener('beforeunload', save);

  ui.update();
  if (import.meta.env.DEV) installDevTools(session, view);
}

boot();

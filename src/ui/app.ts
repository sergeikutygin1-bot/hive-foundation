import type { GameEvent } from '../sim/events';
import { toastForEvent, type ToastKind } from './feedback';
import { h, setText } from './h';
import { createHud } from './hud';
import { createInspect } from './inspect';
import { PanelHost } from './panels/host';
import { createMarketPanel } from './panels/market';
import { createShopPanel } from './panels/shop';
import { createToasts } from './toasts';
import { createToolbar } from './toolbar';
import type { UiDeps } from './types';

type Point = { x: number; y: number };

/** "A hive is full" can fire often with several hives; show it at most every 10 s. */
const FULL_TOAST_DEDUPE_MS = 10_000;

export interface Ui {
  readonly root: HTMLElement;
  update(): void;
  handleEvent(e: GameEvent): void;
  toast(text: string, kind?: ToastKind): void;
  /** Closes the inspect popover, else the open panel. Returns whether anything closed. */
  closeTopmost(): boolean;
  openInspect(entityId: string, at: Point): void;
  closeInspect(): void;
  hint(text: string | null, at: Point | null, tone: 'valid' | 'invalid'): void;
}

export function createUi(container: HTMLElement, deps: UiDeps): Ui {
  const toasts = createToasts();
  const panels = new PanelHost();
  const shop = createShopPanel(deps, panels);
  const market = createMarketPanel(deps);
  const hud = createHud(deps);
  const toolbar = createToolbar(deps, { openShop: () => panels.toggle(shop), openMarket: () => panels.toggle(market) });
  const inspect = createInspect(deps);
  const hintEl = h('div', { class: 'cursor-hint', role: 'tooltip', hidden: true });
  const root = h('div', { class: 'ui' }, hud.el, toolbar.el, panels.el, inspect.el, toasts.el, hintEl);
  container.appendChild(root);

  return {
    root,
    update() {
      hud.update();
      toolbar.update();
      panels.update();
      inspect.update();
    },
    handleEvent(e) {
      const toast = toastForEvent(e);
      if (toast) toasts.show(toast.text, toast.kind, e.type === 'producerFull' ? { dedupeMs: FULL_TOAST_DEDUPE_MS } : {});
    },
    toast: (text, kind = 'info') => toasts.show(text, kind),
    closeTopmost() {
      if (inspect.isOpen()) {
        inspect.close();
        return true;
      }
      return panels.close();
    },
    openInspect(id, at) {
      panels.close();
      inspect.open(id, at);
    },
    closeInspect: () => inspect.close(),
    hint(text, at, tone) {
      if (!text || !at) {
        hintEl.hidden = true;
        return;
      }
      setText(hintEl, text);
      hintEl.className = `cursor-hint ${tone}`;
      hintEl.style.left = `${at.x}px`;
      hintEl.style.top = `${at.y}px`;
      hintEl.hidden = false;
    },
  };
}

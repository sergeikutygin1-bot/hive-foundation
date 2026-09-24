import type { ToastKind } from './feedback';
import { h } from './h';

export const TOAST_MS = 2500;
const MAX_TOASTS = 3;

export interface ToastOptions {
  /** Identical text shown again within this window is dropped. */
  dedupeMs?: number;
}

export interface Toasts {
  el: HTMLElement;
  show(text: string, kind?: ToastKind, opts?: ToastOptions): void;
}

export function createToasts(now: () => number = () => performance.now()): Toasts {
  const el = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
  const lastShown = new Map<string, number>();
  return {
    el,
    show(text, kind = 'info', opts = {}) {
      const at = now();
      const last = lastShown.get(text);
      if (last !== undefined && at - last < (opts.dedupeMs ?? 1000)) return;
      lastShown.set(text, at);
      const toast = h('div', { class: `toast ${kind}` }, text);
      el.append(toast);
      while (el.children.length > MAX_TOASTS) el.firstElementChild?.remove();
      setTimeout(() => toast.remove(), TOAST_MS);
    },
  };
}

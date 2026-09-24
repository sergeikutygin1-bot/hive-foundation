import { h } from './h';

/** Full-screen message for unrecoverable problems (no WebGL). */
export function showFatal(root: HTMLElement, title: string, body: string): HTMLElement {
  const el = h('div', { class: 'fatal', role: 'alert' }, h('div', { class: 'fatal-card' }, h('h1', null, title), h('p', null, body)));
  root.appendChild(el);
  return el;
}

/** Blocking overlay with a reload button (WebGL context lost). */
export function showOverlay(root: HTMLElement, text: string, reloadLabel: string): HTMLElement {
  const el = h(
    'div',
    { class: 'overlay', role: 'status' },
    h('div', { class: 'overlay-card' }, h('p', null, text), h('button', { class: 'btn primary', type: 'button', onclick: () => location.reload() }, reloadLabel)),
  );
  root.appendChild(el);
  return el;
}

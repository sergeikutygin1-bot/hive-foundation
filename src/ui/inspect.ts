import { COINS } from '../content/types';
import { refundFor } from '../sim/economy';
import { getRangeMap, outputPerDay } from '../sim/production';
import type { Entity } from '../sim/state';
import { formatKg, formatRate } from './format';
import { h, setText } from './h';
import { t, tx } from './i18n';
import type { UiDeps } from './types';

export const CONFIRM_MS = 2000;
const POPOVER_W = 260;
const POPOVER_H = 220;

type Point = { x: number; y: number };
type Row = { el: HTMLElement; value: (e: Entity) => string };

export interface Inspect {
  el: HTMLElement;
  isOpen(): boolean;
  open(entityId: string, at: Point): void;
  close(): void;
  update(): void;
}

/** Click-an-entity popover. This is where the nectar-sharing rules become visible (spec §7.4). */
export function createInspect(deps: UiDeps): Inspect {
  const el = h('div', { class: 'inspect', role: 'dialog', 'aria-label': t('inspect.label'), hidden: true });
  let entityId: string | null = null;
  let rows: Row[] = [];
  let confirming = false;
  let confirmTimer: ReturnType<typeof setTimeout> | undefined;

  const rangeMap = () => getRangeMap(deps.getState(), deps.reg);

  const describeSources = (e: Entity): string => {
    const shares = rangeMap().sharesByProducer.get(e.id) ?? [];
    const shared = shares.filter((s) => s.sharedWith > 1).length;
    const base = t('inspect.sources', { count: shares.length });
    return shared > 0 ? `${base} · ${t('inspect.shared', { n: shared })}` : base;
  };

  const describeFeeding = (e: Entity): string => {
    const n = rangeMap().producersBySource.get(e.id)?.length ?? 0;
    if (n === 0) return t('inspect.feedsNone');
    if (n === 1) return t('inspect.feedsOne');
    return t('inspect.feedsMany', { n });
  };

  const close = () => {
    entityId = null;
    rows = [];
    confirming = false;
    clearTimeout(confirmTimer);
    el.hidden = true;
    el.replaceChildren();
  };

  const build = (entity: Entity) => {
    const def = deps.reg.buildable(entity.def);
    rows = [];
    const row = (value: Row['value']) => {
      const r = h('div', { class: 'row' });
      rows.push({ el: r, value });
      return r;
    };
    const parts: Node[] = [h('h3', null, tx(`def.${def.id}`))];
    const producer = def.producer;
    if (producer) {
      parts.push(
        row((e) => t('inspect.fill', { have: formatKg(e.store ?? 0), cap: formatKg(producer.capacity) })),
        row((e) => t('inspect.rate', { rate: formatRate(outputPerDay(deps.getState(), deps.reg, e.id)) })),
        row(describeSources),
      );
    }
    const source = def.source;
    if (source) parts.push(row(() => t('inspect.yield', { n: source.yieldPerDay })), row(describeFeeding));

    const actions: HTMLElement[] = [];
    if (producer) {
      actions.push(h('button', { class: 'btn primary', type: 'button', onclick: () => deps.dispatch({ type: 'harvest', id: entity.id }) }, t('inspect.harvest')));
    }
    if (def.removable) {
      const label = t('inspect.remove', { coins: refundFor(def)[COINS] ?? 0 });
      const remove = h('button', { class: 'btn', type: 'button' }, label);
      remove.addEventListener('click', () => {
        if (!confirming) {
          confirming = true;
          setText(remove, t('inspect.confirm'));
          confirmTimer = setTimeout(() => {
            confirming = false;
            setText(remove, label);
          }, CONFIRM_MS);
          return;
        }
        clearTimeout(confirmTimer);
        confirming = false;
        if (deps.dispatch({ type: 'remove', id: entity.id }).ok) close();
      });
      actions.push(remove);
    }
    if (actions.length > 0) parts.push(h('div', { class: 'actions' }, ...actions));
    el.replaceChildren(...parts);
  };

  const update = () => {
    if (!entityId) return;
    const entity = deps.getState().entities[entityId];
    if (!entity) {
      close();
      return;
    }
    for (const r of rows) setText(r.el, r.value(entity));
  };

  return {
    el,
    isOpen: () => entityId !== null,
    open(id, at) {
      const entity = deps.getState().entities[id];
      if (!entity) return;
      close();
      entityId = id;
      build(entity);
      el.style.left = `${Math.max(8, Math.min(at.x + 14, window.innerWidth - POPOVER_W))}px`;
      el.style.top = `${Math.max(8, Math.min(at.y + 14, window.innerHeight - POPOVER_H))}px`;
      el.hidden = false;
      update();
    },
    close,
    update,
  };
}

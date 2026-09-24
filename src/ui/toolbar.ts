import type { Registry } from '../content/registry';
import type { GameState } from '../sim/state';
import { formatKg, showsAsZeroKg } from './format';
import { h, setText } from './h';
import { t } from './i18n';
import { icon, type IconName } from './icons';
import type { UiDeps } from './types';

/** Output waiting in all producers. */
export function readyToHarvest(reg: Registry, state: GameState): number {
  let total = 0;
  for (const e of Object.values(state.entities)) if (reg.buildable(e.def).producer) total += e.store ?? 0;
  return total;
}

function hexButton(name: IconName, label: string, onClick: () => void, primary = false, extra: Node | null = null) {
  return h(
    'button',
    { class: primary ? 'hexbtn primary' : 'hexbtn', type: 'button', onclick: onClick },
    h('span', { class: 'hex' }, icon(name)),
    h('span', { class: 'label' }, label),
    extra,
  );
}

/** Bottom bar. Orders and Guide join in sub-project 3; no dead buttons until then. */
export function createToolbar(deps: UiDeps, actions: { openShop(): void; openMarket(): void }): { el: HTMLElement; update(): void } {
  const kgBadge = h('span', { class: 'badge-kg', hidden: true });
  const harvest = hexButton('basket', t('toolbar.harvestAll'), () => deps.dispatch({ type: 'harvestAll' }), true, kgBadge);
  const el = h(
    'nav',
    { class: 'toolbar', 'aria-label': t('toolbar.label') },
    hexButton('cart', t('toolbar.shop'), () => actions.openShop()),
    hexButton('honey', t('toolbar.market'), () => actions.openMarket()),
    harvest,
  );
  return {
    el,
    update() {
      const ready = readyToHarvest(deps.reg, deps.getState());
      harvest.disabled = showsAsZeroKg(ready);
      kgBadge.hidden = showsAsZeroKg(ready);
      setText(kgBadge, t('hud.kg', { kg: formatKg(ready) }));
    },
  };
}

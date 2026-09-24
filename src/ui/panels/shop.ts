import { COINS, type BuildableDef } from '../../content/types';
import { canAfford } from '../../sim/economy';
import { h } from '../h';
import { t, tx } from '../i18n';
import { icon, type IconName } from '../icons';
import type { UiDeps } from '../types';
import type { Panel, PanelHost } from './host';

const iconFor = (def: BuildableDef): IconName => (def.producer ? 'hive' : def.source ? 'flower' : 'cart');

export function createShopPanel(deps: UiDeps, host: Pick<PanelHost, 'close'>): Panel {
  const items = deps.reg.purchasable().map((def) => {
    const button = h(
      'button',
      {
        class: 'btn shop-item', type: 'button',
        onclick: () => {
          host.close();
          deps.startPlacing(def.id);
        },
      },
      icon(iconFor(def)),
      h('span', { class: 'shop-text' }, h('span', { class: 'name' }, tx(`def.${def.id}`)), h('span', { class: 'desc' }, tx(`defDesc.${def.id}`))),
      h('span', { class: 'cost' }, icon('coin'), t('shop.cost', { coins: def.cost[COINS] ?? 0 })),
    );
    return { def, button };
  });

  return {
    title: t('shop.title'),
    body: h('div', { class: 'shop' }, h('p', { class: 'muted' }, t('shop.hint')), ...items.map((i) => i.button)),
    update() {
      const inventory = deps.getState().inventory;
      for (const { def, button } of items) button.disabled = !canAfford(inventory, def.cost);
    },
  };
}

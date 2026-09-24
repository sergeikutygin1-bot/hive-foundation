import type { ResourceId } from '../../content/types';
import { formatCoins, formatKg, showsAsZeroKg } from '../format';
import { h, setText } from '../h';
import { t, tx } from '../i18n';
import { icon } from '../icons';
import type { UiDeps } from '../types';
import type { Panel } from './host';

const STEP_KG = 1;

function createRow(deps: UiDeps, resource: ResourceId, pricePerUnit: number) {
  let amount = 0;
  const have = () => deps.getState().inventory[resource] ?? 0;

  const haveEl = h('p', { class: 'muted' });
  const amountEl = h('span', { class: 'amount' });
  const preview = h('p', { class: 'muted' });
  const less = h('button', { class: 'iconbtn small', type: 'button', 'aria-label': t('market.less') }, icon('minus'));
  const more = h('button', { class: 'iconbtn small', type: 'button', 'aria-label': t('market.more') }, icon('plus'));
  const sell = h('button', { class: 'btn primary', type: 'button' });
  const sellAll = h('button', { class: 'btn', type: 'button' }, t('market.sellAll'));
  const el = h(
    'div',
    { class: 'market-row' },
    h('div', { class: 'name' }, tx(`resource.${resource}`)),
    haveEl,
    h('p', { class: 'muted' }, t('market.price', { price: pricePerUnit })),
    h('div', { class: 'stepper' }, less, amountEl, more),
    preview,
    h('div', { class: 'market-actions' }, sell, sellAll),
  );

  /** Returns whether a displayable amount of this resource is on hand. */
  const render = (): boolean => {
    const kg = have();
    const onHand = !showsAsZeroKg(kg);
    if (amount > kg) amount = kg;
    if (amount <= 0 && kg > 0) amount = Math.min(STEP_KG, kg);
    setText(haveEl, t('market.have', { kg: formatKg(kg) }));
    setText(amountEl, t('hud.kg', { kg: formatKg(amount) }));
    setText(preview, t('market.preview', { coins: formatCoins(amount * pricePerUnit) }));
    setText(sell, t('market.sell', { kg: formatKg(amount) }));
    sell.disabled = !onHand || showsAsZeroKg(amount);
    sellAll.disabled = !onHand;
    less.disabled = amount <= 0;
    more.disabled = amount >= kg;
    el.hidden = !onHand;
    return onHand;
  };

  less.addEventListener('click', () => {
    amount = Math.max(0, amount - STEP_KG);
    render();
  });
  more.addEventListener('click', () => {
    amount = Math.min(have(), amount + STEP_KG);
    render();
  });
  sell.addEventListener('click', () => {
    if (amount > 0) deps.dispatch({ type: 'sell', resource, amount });
  });
  sellAll.addEventListener('click', () => deps.dispatch({ type: 'sell', resource, amount: 'all' }));

  return {
    el,
    render,
    reset() {
      amount = Math.min(STEP_KG, have());
      render();
    },
  };
}

export function createMarketPanel(deps: UiDeps): Panel {
  const rows = [...deps.reg.prices.values()].map((p) => createRow(deps, p.resource, p.sell));
  const empty = h('p', { class: 'muted' }, t('market.nothing'));
  return {
    title: t('market.title'),
    body: h('div', { class: 'market' }, empty, ...rows.map((r) => r.el)),
    onOpen() {
      for (const r of rows) r.reset();
    },
    update() {
      let anything = false;
      for (const r of rows) anything = r.render() || anything;
      empty.hidden = anything;
    },
  };
}

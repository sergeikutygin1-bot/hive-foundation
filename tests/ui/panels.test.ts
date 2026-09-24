// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { h } from '../../src/ui/h';
import { t } from '../../src/ui/i18n';
import { PanelHost, type Panel } from '../../src/ui/panels/host';
import { createMarketPanel } from '../../src/ui/panels/market';
import { createShopPanel } from '../../src/ui/panels/shop';
import { makeDeps } from './helpers';

const fakePanel = (title: string): Panel => ({ title, body: h('div', null, `${title} body`), update: vi.fn() });

describe('PanelHost', () => {
  it('shows one panel at a time and closes', () => {
    const host = new PanelHost();
    const a = fakePanel('A');
    const b = fakePanel('B');
    host.open(a);
    expect(host.el.hidden).toBe(false);
    expect(host.el.textContent).toContain('A body');
    host.open(b);
    expect(host.el.textContent).not.toContain('A body');
    expect(host.openPanel).toBe(b);
    host.toggle(b);
    expect(host.el.hidden).toBe(true);
    expect(host.close()).toBe(false);
  });
});

describe('Shop', () => {
  it('lists purchasable items and disables what you cannot afford', () => {
    const { deps } = makeDeps();
    const host = { close: vi.fn(() => true) };
    const shop = createShopPanel(deps, host);
    shop.update();
    const items = [...shop.body.querySelectorAll<HTMLButtonElement>('.shop-item')];
    expect(items.map((b) => b.querySelector('.name')!.textContent)).toEqual(['Beehive', 'Wildflower bed']);
    expect(items[0].disabled).toBe(true);
    expect(items[1].disabled).toBe(false);
    items[1].click();
    expect(host.close).toHaveBeenCalled();
    expect(deps.startPlacing).toHaveBeenCalledWith('bed_wildflower');
  });
});

describe('Market', () => {
  it('sells a chosen amount, clamped to what you have', () => {
    const { deps, state } = makeDeps();
    state.inventory.honey_wildflower = 3.5;
    const market = createMarketPanel(deps);
    market.onOpen?.();
    market.update();
    expect(market.body.textContent).toContain('You have 3.5 kg');
    expect(market.body.textContent).toContain('= 15 coins');
    const more = market.body.querySelector<HTMLButtonElement>('[aria-label="More"]')!;
    for (let i = 0; i < 5; i++) more.click();
    expect(market.body.textContent).toContain('= 52 coins');
    market.body.querySelector<HTMLButtonElement>('.btn.primary')!.click();
    expect(deps.dispatch).toHaveBeenLastCalledWith({ type: 'sell', resource: 'honey_wildflower', amount: 3.5 });
    expect(state.inventory.honey_wildflower).toBe(0);
    market.update();
    expect(market.body.querySelector<HTMLElement>('.market-row')!.hidden).toBe(true);
    const empty = [...market.body.querySelectorAll<HTMLElement>('p.muted')].find((p) => p.textContent === t('market.nothing'))!;
    expect(empty.hidden).toBe(false);
  });

  it('sells everything at once', () => {
    const { deps, state } = makeDeps();
    state.inventory.honey_wildflower = 2;
    const market = createMarketPanel(deps);
    market.onOpen?.();
    market.update();
    [...market.body.querySelectorAll('button')].find((b) => b.textContent === 'Sell all')!.click();
    expect(deps.dispatch).toHaveBeenLastCalledWith({ type: 'sell', resource: 'honey_wildflower', amount: 'all' });
    expect(state.inventory.coins).toBe(90);
  });
});

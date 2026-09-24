// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createToolbar } from '../../src/ui/toolbar';
import { entitiesOf } from '../sim/helpers';
import { makeDeps } from './helpers';

describe('toolbar', () => {
  it('opens the shop and market', () => {
    const { deps } = makeDeps();
    const actions = { openShop: vi.fn(), openMarket: vi.fn() };
    const bar = createToolbar(deps, actions);
    const [shop, market] = bar.el.querySelectorAll('button');
    shop.click();
    market.click();
    expect(actions.openShop).toHaveBeenCalled();
    expect(actions.openMarket).toHaveBeenCalled();
  });

  it('enables Harvest All only when honey is waiting, showing how much', () => {
    const { deps, state } = makeDeps();
    const bar = createToolbar(deps, { openShop: vi.fn(), openMarket: vi.fn() });
    bar.update();
    const harvest = bar.el.querySelector<HTMLButtonElement>('.hexbtn.primary')!;
    expect(harvest.disabled).toBe(true);
    entitiesOf(state, 'hive')[0].store = 2.5;
    bar.update();
    expect(harvest.disabled).toBe(false);
    expect(harvest.textContent).toContain('2.5 kg');
    harvest.click();
    expect(deps.dispatch).toHaveBeenCalledWith({ type: 'harvestAll' });
  });

  it('stays disabled while the ready amount still displays as 0.0 kg', () => {
    const { deps, state } = makeDeps();
    const bar = createToolbar(deps, { openShop: vi.fn(), openMarket: vi.fn() });
    entitiesOf(state, 'hive')[0].store = 0.00125;
    bar.update();
    expect(bar.el.querySelector<HTMLButtonElement>('.hexbtn.primary')!.disabled).toBe(true);
    expect(bar.el.querySelector<HTMLElement>('.badge-kg')!.hidden).toBe(true);
  });
});

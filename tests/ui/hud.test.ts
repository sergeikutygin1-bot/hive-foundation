// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createHud } from '../../src/ui/hud';
import { makeDeps } from './helpers';

const text = (root: HTMLElement, id: string) => root.querySelector(`[data-testid="${id}"]`)!.textContent;

describe('HUD', () => {
  it('shows coins, honey and the calendar, and keeps them current', () => {
    const { deps, state } = makeDeps();
    const hud = createHud(deps);
    hud.update();
    expect(text(hud.el, 'coins')).toBe('60');
    expect(text(hud.el, 'honey')).toBe('0.0 kg');
    expect(text(hud.el, 'season')).toBe('Spring');
    expect(text(hud.el, 'day')).toBe('Day 1 · Year 1');

    state.inventory.coins = 72.9;
    state.inventory.honey_wildflower = 1.25;
    state.clock.tick = 600 * 29 + 300;
    hud.update();
    expect(text(hud.el, 'coins')).toBe('72');
    expect(text(hud.el, 'honey')).toBe('1.2 kg');
    expect(text(hud.el, 'season')).toBe('Summer');
    expect(text(hud.el, 'day')).toBe('Day 30 · Year 1');
    expect(hud.el.querySelector<HTMLElement>('[data-testid="progress"]')!.style.width).toBe('50%');
  });

  it('changes speed and marks the active button', () => {
    const { deps } = makeDeps();
    const hud = createHud(deps);
    hud.update();
    const twoX = hud.el.querySelector<HTMLButtonElement>('[aria-label="2x speed"]')!;
    twoX.click();
    expect(deps.dispatch).toHaveBeenCalledWith({ type: 'setSpeed', speed: 2 });
    hud.update();
    expect(twoX.classList.contains('active')).toBe(true);
    expect(twoX.getAttribute('aria-pressed')).toBe('true');
  });

  it('resets the view and offers a save reset in settings', () => {
    const { deps } = makeDeps();
    const hud = createHud(deps);
    hud.el.querySelector<HTMLButtonElement>('[aria-label="Reset view"]')!.click();
    expect(deps.resetView).toHaveBeenCalled();
    hud.el.querySelector<HTMLButtonElement>('[aria-label="Settings"]')!.click();
    const reset = [...hud.el.querySelectorAll('button')].find((b) => b.textContent === 'Reset save')!;
    expect(reset.closest('[hidden]')).toBeNull();
    reset.click();
    expect(deps.resetSave).toHaveBeenCalled();
  });
});

import { COINS } from '../content/types';
import { calendar } from '../sim/clock';
import type { Speed } from '../sim/state';
import { formatCoins, formatKg } from './format';
import { h, setText } from './h';
import { t } from './i18n';
import { icon } from './icons';
import type { UiDeps } from './types';

const SPEEDS: readonly Speed[] = [0, 1, 2, 4];

function kgOnHand(deps: UiDeps): number {
  const state = deps.getState();
  let kg = 0;
  for (const r of deps.reg.resources.values()) if (r.unit === 'kg') kg += state.inventory[r.id] ?? 0;
  return kg;
}

/** Top bar: resources (left), calendar + speed (center), view/settings (right). */
export function createHud(deps: UiDeps): { el: HTMLElement; update(): void } {
  const coins = h('span', { 'data-testid': 'coins' });
  const honey = h('span', { 'data-testid': 'honey' });
  const left = h(
    'div',
    { class: 'hud-left' },
    h('div', { class: 'pill', title: t('hud.coins') }, icon('coin'), coins),
    h('div', { class: 'pill', title: t('hud.honey') }, icon('honey'), honey),
  );

  const season = h('div', { class: 'clock-season', 'data-testid': 'season' });
  const day = h('div', { class: 'clock-day', 'data-testid': 'day' });
  const progress = h('div', { 'data-testid': 'progress' });
  const speedButtons = SPEEDS.map((speed) => {
    const label = speed === 0 ? t('hud.pause') : t('hud.speedLabel', { n: speed });
    return h(
      'button',
      {
        class: 'speed', type: 'button', 'aria-label': label, title: label, 'aria-pressed': 'false',
        onclick: () => deps.dispatch({ type: 'setSpeed', speed }),
      },
      speed === 0 ? icon('pause') : t('hud.speed', { n: speed }),
    );
  });
  const clock = h(
    'div',
    { class: 'clock', role: 'group', 'aria-label': t('hud.clock') },
    icon('flower'),
    h('div', { class: 'clock-text' }, season, day, h('div', { class: 'clock-progress' }, progress)),
    h('div', { class: 'speeds' }, ...speedButtons),
  );

  const menu = h('div', { class: 'settings-menu', hidden: true });
  const settingsButton = h(
    'button',
    { class: 'iconbtn', type: 'button', 'aria-label': t('hud.settings'), title: t('hud.settings'), 'aria-expanded': 'false' },
    icon('gear'),
  );
  settingsButton.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    settingsButton.setAttribute('aria-expanded', String(!menu.hidden));
  });
  menu.append(
    h('button', {
      class: 'btn', type: 'button',
      onclick: () => {
        menu.hidden = true;
        deps.resetSave();
      },
    }, t('settings.reset')),
  );
  const right = h(
    'div',
    { class: 'hud-right' },
    h('button', {
      class: 'iconbtn', type: 'button', 'aria-label': t('hud.resetView'), title: t('hud.resetView'),
      onclick: () => deps.resetView(),
    }, icon('target')),
    h('div', { class: 'settings' }, settingsButton, menu),
  );

  return {
    el: h('div', { class: 'hud' }, left, clock, right),
    update() {
      const state = deps.getState();
      setText(coins, formatCoins(state.inventory[COINS] ?? 0));
      setText(honey, t('hud.kg', { kg: formatKg(kgOnHand(deps)) }));
      const cal = calendar(state.clock.tick);
      setText(season, t(`season.${cal.season}`));
      setText(day, t('hud.dayYear', { day: cal.day, year: cal.year }));
      progress.style.width = `${Math.round(cal.dayProgress * 100)}%`;
      speedButtons.forEach((button, i) => {
        const active = SPEEDS[i] === state.clock.speed;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    },
  };
}

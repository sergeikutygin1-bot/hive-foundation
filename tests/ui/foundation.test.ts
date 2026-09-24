// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { REJECT_REASONS } from '../../src/sim/commands';
import { reasonText, toastForEvent } from '../../src/ui/feedback';
import { formatCoins, formatKg, formatRate } from '../../src/ui/format';
import { h, setText } from '../../src/ui/h';
import { t, tx } from '../../src/ui/i18n';
import { icon } from '../../src/ui/icons';

describe('h()', () => {
  it('builds elements with classes, attributes, listeners and children', () => {
    const onClick = vi.fn();
    const el = h('button', { class: 'btn', 'aria-label': 'Go', disabled: true, onclick: onClick }, 'Go ', 3, null, false);
    expect(el.className).toBe('btn');
    expect(el.getAttribute('aria-label')).toBe('Go');
    expect(el.disabled).toBe(true);
    expect(el.textContent).toBe('Go 3');
    el.disabled = false;
    el.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('setText only writes when the text changes', () => {
    const el = h('span', null, 'a');
    const node = el.firstChild;
    setText(el, 'a');
    expect(el.firstChild).toBe(node);
    setText(el, 'b');
    expect(el.textContent).toBe('b');
  });
});

describe('strings', () => {
  it('interpolates variables', () => {
    expect(t('hud.dayYear', { day: 3, year: 1 })).toBe('Day 3 · Year 1');
  });

  it('falls back to the key for unknown runtime keys', () => {
    expect(tx('def.castle')).toBe('def.castle');
    expect(tx('def.hive')).toBe('Beehive');
  });

  it('has a message for every rejection reason', () => {
    for (const reason of REJECT_REASONS) expect(reasonText(reason)).not.toBe(`reason.${reason}`);
  });
});

describe('formatting', () => {
  it('floors kg to one decimal without float artifacts', () => {
    expect(formatKg(0)).toBe('0.0');
    expect(formatKg(1.25)).toBe('1.2');
    expect(formatKg(0.7 - 1e-12)).toBe('0.7');
    expect(formatKg(5)).toBe('5.0');
  });

  it('floors coins and shows rates with two decimals', () => {
    expect(formatCoins(72.9)).toBe('72');
    expect(formatCoins(20 - 1e-12)).toBe('20');
    expect(formatRate(0.75)).toBe('0.75');
  });
});

describe('icons', () => {
  it('returns an inline, decorative SVG', () => {
    const svg = icon('coin');
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.childNodes.length).toBeGreaterThan(0);
  });
});

describe('feedback', () => {
  it('turns game events into toasts', () => {
    expect(toastForEvent({ type: 'harvested', resource: 'honey_wildflower', amount: 3.25 })).toEqual({ text: '+3.2 kg', kind: 'success' });
    expect(toastForEvent({ type: 'sold', resource: 'honey_wildflower', amount: 3.2, coins: 48 })).toEqual({ text: '+48 coins', kind: 'success' });
    expect(toastForEvent({ type: 'producerFull', id: 'e1' })?.kind).toBe('info');
    expect(toastForEvent({ type: 'safetyNetGranted', coins: 15 })?.text).toContain('15');
    expect(toastForEvent({ type: 'speedChanged', speed: 2 })).toBeNull();
  });
});

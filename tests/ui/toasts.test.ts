// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOAST_MS, createToasts } from '../../src/ui/toasts';

describe('toasts', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows up to three and dismisses them after a while', () => {
    let clock = 0;
    const toasts = createToasts(() => clock);
    for (const text of ['one', 'two', 'three', 'four']) {
      toasts.show(text);
      clock += 2000;
    }
    expect(toasts.el.children).toHaveLength(3);
    expect(toasts.el.textContent).not.toContain('one');
    vi.advanceTimersByTime(TOAST_MS + 100);
    expect(toasts.el.children).toHaveLength(0);
  });

  it('drops identical messages inside the dedupe window', () => {
    let clock = 0;
    const toasts = createToasts(() => clock);
    toasts.show('same');
    clock = 500;
    toasts.show('same');
    expect(toasts.el.children).toHaveLength(1);
    clock = 1600;
    toasts.show('same');
    expect(toasts.el.children).toHaveLength(2);
    toasts.show('full', 'info', { dedupeMs: 10_000 });
    clock = 9000;
    toasts.show('full', 'info', { dedupeMs: 10_000 });
    expect([...toasts.el.children].filter((c) => c.textContent === 'full')).toHaveLength(1);
  });
});

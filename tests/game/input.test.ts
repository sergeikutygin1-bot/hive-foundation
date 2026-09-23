// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { attachInput, isDrag, type InputHandlers } from '../../src/game/input';

function setup() {
  const el = document.createElement('div');
  const h: InputHandlers = {
    pan: vi.fn(), zoom: vi.fn(), pinch: vi.fn(), hover: vi.fn(), click: vi.fn(), cancel: vi.fn(), leave: vi.fn(),
  };
  attachInput(el, h);
  const fire = (type: string, x: number, y: number, init: MouseEventInit = {}) =>
    el.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, ...init }));
  return { el, h, fire };
}

describe('input', () => {
  it('uses a 5 px drag threshold', () => {
    expect(isDrag(3, 3)).toBe(false);
    expect(isDrag(3, 4)).toBe(true);
  });

  it('treats a small jitter as a click, not a pan', () => {
    const { h, fire } = setup();
    fire('pointerdown', 100, 100);
    fire('pointermove', 103, 102);
    fire('pointerup', 103, 102);
    expect(h.click).toHaveBeenCalledWith(103, 102);
    expect(h.pan).not.toHaveBeenCalled();
  });

  it('treats a longer drag as a pan and never clicks', () => {
    const { h, fire } = setup();
    fire('pointerdown', 100, 100);
    fire('pointermove', 104, 100);
    fire('pointermove', 110, 100);
    fire('pointerup', 110, 100);
    expect(h.pan).toHaveBeenCalledWith(6, 0);
    expect(h.click).not.toHaveBeenCalled();
  });

  it('hovers when no button is down', () => {
    const { h, fire } = setup();
    fire('pointermove', 50, 60);
    expect(h.hover).toHaveBeenCalledWith(50, 60);
  });

  it('cancels on right button and zooms on wheel', () => {
    const { el, h, fire } = setup();
    fire('pointerdown', 10, 10, { button: 2 });
    expect(h.cancel).toHaveBeenCalled();
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, cancelable: true }));
    expect(h.zoom).toHaveBeenCalledWith(120);
  });
});

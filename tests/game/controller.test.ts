import { describe, expect, it, vi } from 'vitest';
import { ORIGIN, hex } from '../../src/core/hex';
import { Controller } from '../../src/game/controller';
import { dispatch, type Command } from '../../src/sim/commands';
import { entitiesOf, newGame, reg } from '../sim/helpers';

const at = { x: 10, y: 20 };
const NE = hex(1, -1);

function setup() {
  const state = newGame(1);
  const view = {
    highlight: { show: vi.fn(), hide: vi.fn(), showRange: vi.fn(), clearRange: vi.fn() },
    ghost: { show: vi.fn(), hide: vi.fn() },
    rig: { rotate: vi.fn() },
  };
  const ui = { toast: vi.fn(), closeTopmost: vi.fn(() => false), openInspect: vi.fn(), closeInspect: vi.fn(), hint: vi.fn() };
  const send = vi.fn((cmd: Command) => dispatch(state, reg, cmd));
  const controller = new Controller({ reg, getState: () => state, dispatch: send, view, ui });
  return { state, view, ui, send, controller };
}

describe('build mode', () => {
  it('previews a valid spot in green with name and price', () => {
    const { controller, view, ui } = setup();
    controller.startPlacing('bed_wildflower');
    controller.hover(NE, at);
    expect(view.ghost.show).toHaveBeenLastCalledWith('bed_wildflower', NE, true);
    expect(view.highlight.show).toHaveBeenLastCalledWith(NE, 'valid');
    expect(ui.hint).toHaveBeenLastCalledWith('Wildflower bed · 20 coins', at, 'valid');
  });

  it('previews an invalid spot in red with the reason', () => {
    const { controller, view, ui } = setup();
    controller.startPlacing('bed_wildflower');
    controller.hover(ORIGIN, at);
    expect(view.ghost.show).toHaveBeenLastCalledWith('bed_wildflower', ORIGIN, false);
    expect(view.highlight.show).toHaveBeenLastCalledWith(ORIGIN, 'invalid');
    expect(ui.hint).toHaveBeenLastCalledWith('Something is already here', at, 'invalid');
  });

  it('shows the range ring while placing a hive', () => {
    const { controller, view } = setup();
    controller.startPlacing('hive');
    controller.hover(NE, at);
    const ring = view.highlight.showRange.mock.lastCall![0];
    expect(ring).toHaveLength(6);
    expect(ring).toEqual(expect.arrayContaining([hex(1, 0), hex(2, -1)]));
  });

  it('places on click and stays in build mode while you can afford another', () => {
    const { controller, state } = setup();
    controller.startPlacing('bed_wildflower');
    controller.click(NE, at);
    expect(state.inventory.coins).toBe(40);
    expect(controller.mode).toEqual({ kind: 'placing', def: 'bed_wildflower' });
  });

  it('leaves build mode once the next one is unaffordable', () => {
    const { controller, state, view } = setup();
    state.inventory.coins = 25;
    controller.startPlacing('bed_wildflower');
    controller.click(NE, at);
    expect(controller.mode).toEqual({ kind: 'idle' });
    expect(view.ghost.hide).toHaveBeenCalled();
  });

  it('stays in build mode after a rejected click', () => {
    const { controller, send } = setup();
    controller.startPlacing('bed_wildflower');
    controller.click(ORIGIN, at);
    expect(send).toHaveBeenCalled();
    expect(controller.mode.kind).toBe('placing');
  });

  it('Escape cancels build mode first, then closes UI layers', () => {
    const { controller, ui } = setup();
    controller.startPlacing('bed_wildflower');
    expect(controller.key('Escape')).toBe(true);
    expect(controller.mode.kind).toBe('idle');
    expect(ui.closeTopmost).not.toHaveBeenCalled();
    controller.key('Escape');
    expect(ui.closeTopmost).toHaveBeenCalled();
  });
});

describe('selection', () => {
  it('opens the inspect popover on an entity and closes it on empty ground', () => {
    const { controller, ui, state } = setup();
    controller.click(ORIGIN, at);
    expect(ui.openInspect).toHaveBeenCalledWith(entitiesOf(state, 'hive')[0].id, at);
    controller.click(NE, at);
    expect(ui.closeInspect).toHaveBeenCalled();
  });

  it('shows a hive range on hover', () => {
    const { controller, view } = setup();
    controller.hover(ORIGIN, at);
    expect(view.highlight.show).toHaveBeenLastCalledWith(ORIGIN, 'hover');
    expect(view.highlight.showRange.mock.lastCall![0]).toHaveLength(6);
  });

  it('clears the highlight, ghost and hint when the pointer leaves', () => {
    const { controller, view, ui } = setup();
    controller.hover(null, null);
    expect(view.highlight.hide).toHaveBeenCalled();
    expect(view.ghost.hide).toHaveBeenCalled();
    expect(ui.hint).toHaveBeenLastCalledWith(null, null, 'valid');
  });
});

describe('keys', () => {
  it('Space pauses and then restores the previous speed', () => {
    const { controller, state } = setup();
    controller.key('2');
    controller.key(' ');
    expect(state.clock.speed).toBe(0);
    controller.key(' ');
    expect(state.clock.speed).toBe(2);
  });

  it('maps 1/2/3 to 1x/2x/4x', () => {
    const { controller, state } = setup();
    controller.key('3');
    expect(state.clock.speed).toBe(4);
    controller.key('1');
    expect(state.clock.speed).toBe(1);
  });

  it('H harvests everything; Q/E rotate the camera', () => {
    const { controller, send, view } = setup();
    controller.key('h');
    expect(send).toHaveBeenLastCalledWith({ type: 'harvestAll' });
    controller.key('q');
    controller.key('E');
    expect(view.rig.rotate.mock.calls).toEqual([[-1], [1]]);
  });

  it('ignores unrelated keys', () => {
    expect(setup().controller.key('x')).toBe(false);
  });
});

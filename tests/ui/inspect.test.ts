// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hex } from '../../src/core/hex';
import { dispatch } from '../../src/sim/commands';
import { spawnEntity } from '../../src/sim/entities';
import { CONFIRM_MS, createInspect } from '../../src/ui/inspect';
import { entitiesOf, reg } from '../sim/helpers';
import { makeDeps } from './helpers';

const at = { x: 10, y: 10 };
const bedAt = (state: ReturnType<typeof makeDeps>['state'], q: number, r: number) =>
  entitiesOf(state, 'bed_wildflower').find((b) => b.hex.q === q && b.hex.r === r)!;

describe('inspect popover', () => {
  afterEach(() => vi.useRealTimers());

  it('shows a hive fill level, honey rate and beds in range', () => {
    const { deps, state } = makeDeps();
    const inspect = createInspect(deps);
    const [hive] = entitiesOf(state, 'hive');
    hive.store = 1.25;
    inspect.open(hive.id, at);
    expect(inspect.isOpen()).toBe(true);
    const text = inspect.el.textContent;
    expect(text).toContain('Beehive');
    expect(text).toContain('1.2 / 5.0 kg');
    expect(text).toContain('0.75 kg/day');
    expect(text).toContain('3 flower beds in range');
  });

  it('explains when a bed is shared between hives', () => {
    const { deps, state } = makeDeps();
    spawnEntity(state, reg, 'hive', hex(2, -1));
    const inspect = createInspect(deps);
    inspect.open(bedAt(state, 1, 0).id, at);
    expect(inspect.el.textContent).toContain('Shared by 2 hives');
    inspect.open(entitiesOf(state, 'hive')[0].id, at);
    expect(inspect.el.textContent).toContain('1 shared with another hive');
  });

  it('asks for confirmation before removing, and the ask expires', () => {
    vi.useFakeTimers();
    const { deps, state } = makeDeps();
    const bed = bedAt(state, -1, 0);
    const inspect = createInspect(deps);
    inspect.open(bed.id, at);
    const remove = [...inspect.el.querySelectorAll('button')].find((b) => b.textContent === 'Remove (+10)')!;
    remove.click();
    expect(deps.dispatch).not.toHaveBeenCalled();
    expect(remove.textContent).toBe('Confirm remove');
    vi.advanceTimersByTime(CONFIRM_MS + 100);
    expect(remove.textContent).toBe('Remove (+10)');
    remove.click();
    remove.click();
    expect(deps.dispatch).toHaveBeenCalledWith({ type: 'remove', id: bed.id });
    expect(inspect.isOpen()).toBe(false);
  });

  it('harvests a hive from the popover', () => {
    const { deps, state } = makeDeps();
    const [hive] = entitiesOf(state, 'hive');
    hive.store = 2;
    const inspect = createInspect(deps);
    inspect.open(hive.id, at);
    [...inspect.el.querySelectorAll('button')].find((b) => b.textContent === 'Harvest')!.click();
    expect(state.inventory.honey_wildflower).toBe(2);
  });

  it('closes itself when its entity disappears', () => {
    const { deps, state } = makeDeps();
    const bed = bedAt(state, -1, 0);
    const inspect = createInspect(deps);
    inspect.open(bed.id, at);
    dispatch(state, reg, { type: 'remove', id: bed.id });
    inspect.update();
    expect(inspect.isOpen()).toBe(false);
  });

  it('shows just the name, with no actions, for the house', () => {
    const { deps, state } = makeDeps();
    const inspect = createInspect(deps);
    inspect.open(entitiesOf(state, 'house')[0].id, at);
    expect(inspect.el.textContent).toBe('Beekeeper’s house');
    expect(inspect.el.querySelectorAll('button')).toHaveLength(0);
  });
});

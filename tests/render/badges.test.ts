// @vitest-environment jsdom
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { registerDefaultArt } from '../../src/render/art/registry';
import { BadgeLayer } from '../../src/render/badges';
import { EntitySync } from '../../src/render/sync';
import { dispatch } from '../../src/sim/commands';
import { spawnEntity } from '../../src/sim/entities';
import { hex } from '../../src/core/hex';
import { entitiesOf, newGame, reg } from '../sim/helpers';

registerDefaultArt();

describe('BadgeLayer', () => {
  it('shows each producer fill level and flags full hives', () => {
    const state = newGame(1);
    const sync = new EntitySync(new THREE.Group(), { setTile: () => {} });
    sync.reconcile(state);
    const badges = new BadgeLayer();
    badges.update(state, reg, sync);
    expect(badges.count).toBe(1);
    const [hive] = entitiesOf(state, 'hive');
    const el = () => (sync.objectFor(hive.id)!.children[0] as unknown as { element: HTMLElement }).element;
    expect(el().textContent).toContain('0%');
    hive.store = 2.5;
    badges.update(state, reg, sync);
    expect(el().textContent).toContain('50%');
    hive.store = 5;
    badges.update(state, reg, sync);
    expect(el().querySelector('.badge')!.classList.contains('full')).toBe(true);
  });

  it('drops badges for removed producers', () => {
    const state = newGame(1);
    const sync = new EntitySync(new THREE.Group(), { setTile: () => {} });
    const second = spawnEntity(state, reg, 'hive', hex(2, -1));
    sync.reconcile(state);
    const badges = new BadgeLayer();
    badges.update(state, reg, sync);
    expect(badges.count).toBe(2);
    dispatch(state, reg, { type: 'remove', id: second.id });
    sync.reconcile(state);
    badges.update(state, reg, sync);
    expect(badges.count).toBe(1);
  });
});

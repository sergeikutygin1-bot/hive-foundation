import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { hex, hexKey, hexToWorld } from '../../src/core/hex';
import { registerDefaultArt } from '../../src/render/art/registry';
import { EntitySync } from '../../src/render/sync';
import { dispatch } from '../../src/sim/commands';
import { entitiesOf, newGame, reg } from '../sim/helpers';

registerDefaultArt();

describe('EntitySync', () => {
  it('creates an object per entity, positioned on its hex, plus the beekeeper', () => {
    const state = newGame(1);
    const parent = new THREE.Group();
    const tiles = { setTile: vi.fn() };
    const sync = new EntitySync(parent, tiles);
    const { added } = sync.reconcile(state);
    expect(added).toHaveLength(5);
    const [hive] = entitiesOf(state, 'hive');
    const obj = sync.objectFor(hive.id)!;
    const w = hexToWorld(hive.hex);
    expect([obj.position.x, obj.position.z]).toEqual([w.x, w.z]);
    expect(sync.beekeeper).not.toBeNull();
    expect(parent.children).toHaveLength(6);
    expect(tiles.setTile).toHaveBeenCalledTimes(5);
  });

  it('adds and removes objects as entities come and go, refreshing their tiles', () => {
    const state = newGame(1);
    const tiles = { setTile: vi.fn() };
    const sync = new EntitySync(new THREE.Group(), tiles);
    sync.reconcile(state);
    dispatch(state, reg, { type: 'place', def: 'bed_wildflower', hex: hex(1, -1) });
    expect(sync.reconcile(state).added).toHaveLength(1);
    expect(tiles.setTile).toHaveBeenLastCalledWith(hexKey(hex(1, -1)), state.tiles[hexKey(hex(1, -1))]);
    const [bed] = entitiesOf(state, 'bed_wildflower');
    dispatch(state, reg, { type: 'remove', id: bed.id });
    expect(sync.reconcile(state).removed).toEqual([bed.id]);
    expect(sync.objectFor(bed.id)).toBeUndefined();
    expect(tiles.setTile).toHaveBeenLastCalledWith(hexKey(bed.hex), { tile: 'grass', owned: true });
  });
});

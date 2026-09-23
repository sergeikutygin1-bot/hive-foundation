import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { makeBeekeeper } from '../../src/render/art/beekeeper';
import { makeHive, makeHouse } from '../../src/render/art/buildings';
import { makeFlowerBed } from '../../src/render/art/flowerbed';
import { makePineTree, makeRock, makeRoundTree } from '../../src/render/art/nature';
import { createArt, hasArt, registerDefaultArt } from '../../src/render/art/registry';
import { createDecorLayer } from '../../src/render/decor';
import { newGame, reg } from '../sim/helpers';

const geometries: [string, () => THREE.BufferGeometry][] = [
  ['house', makeHouse],
  ['hive', makeHive],
  ['flower bed', () => makeFlowerBed('wildflower')],
  ['round tree', makeRoundTree],
  ['pine tree', makePineTree],
  ['rock', makeRock],
];

describe('art geometry', () => {
  it.each(geometries)('%s is vertex-colored and fits on one hex', (_name, make) => {
    const g = make();
    expect(g.getAttribute('color').count).toBe(g.getAttribute('position').count);
    g.computeBoundingBox();
    expect(g.boundingBox!.min.y).toBeGreaterThanOrEqual(-0.05);
    // Farthest vertex from the tile center, measured horizontally (bounding-box corners overstate round props).
    const pos = g.getAttribute('position');
    let reach = 0;
    for (let i = 0; i < pos.count; i++) reach = Math.max(reach, Math.hypot(pos.getX(i), pos.getZ(i)));
    expect(reach).toBeLessThanOrEqual(0.82);
  });

  it('builds a beekeeper with a solid body and a see-through veil', () => {
    const keeper = makeBeekeeper();
    const meshes = keeper.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh);
    expect(meshes).toHaveLength(2);
    expect(meshes[0].castShadow).toBe(true);
    expect((meshes[1].material as THREE.Material).transparent).toBe(true);
  });
});

describe('art registry', () => {
  it('has art for every buildable in the default packs', () => {
    registerDefaultArt();
    for (const id of reg.buildables.keys()) expect(hasArt(id)).toBe(true);
  });

  it('creates shadow-casting objects tagged with their def id', () => {
    registerDefaultArt();
    const hive = createArt('hive') as THREE.Mesh;
    expect(hive.castShadow).toBe(true);
    expect(hive.userData.defId).toBe('hive');
    expect(() => createArt('castle')).toThrow('No art registered for "castle"');
  });
});

describe('decor layer', () => {
  it('instances one mesh per decor tile', () => {
    const state = newGame(1);
    const layer = createDecorLayer(state.tiles, state.seed);
    const decorTiles = Object.values(state.tiles).filter((t) => t.decor).length;
    expect(layer.counts.round + layer.counts.pine + layer.counts.rock).toBe(decorTiles);
    const instanced = layer.group.children.filter((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh);
    expect(instanced.reduce((n, m) => n + m.count, 0)).toBe(decorTiles);
    expect(instanced.length).toBeLessThanOrEqual(3);
  });
});

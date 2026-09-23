import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { hex, hexKey } from '../../src/core/hex';
import { createTileLayer, tileColor } from '../../src/render/tiles';
import { newGame } from '../sim/helpers';

const hsl = (c: THREE.Color) => c.getHSL({ h: 0, s: 0, l: 0 });

describe('tile layer', () => {
  it('creates one tile instance and six grass tufts per tile', () => {
    const state = newGame(1);
    const layer = createTileLayer(state.tiles, state.seed);
    const n = Object.keys(state.tiles).length;
    expect(layer.tiles.count).toBe(n);
    expect(layer.tufts.count).toBe(n * 6);
  });

  it('colors owned grass more vividly than locked grass', () => {
    const owned = tileColor({ tile: 'grass', owned: true }, 0.5);
    const locked = tileColor({ tile: 'grass', owned: false }, 0.5);
    expect(hsl(owned).s).toBeGreaterThan(hsl(locked).s);
  });

  it('recolors a tile that becomes soil and hides its tufts', () => {
    const state = newGame(1);
    const layer = createTileLayer(state.tiles, state.seed);
    const key = hexKey(hex(1, -1));
    const i = layer.indexOf(key)!;
    const before = new THREE.Color();
    layer.tiles.getColorAt(i, before);
    layer.setTile(key, { tile: 'soil', owned: true });
    const after = new THREE.Color();
    layer.tiles.getColorAt(i, after);
    expect(after.equals(before)).toBe(false);
    const m = new THREE.Matrix4();
    const column = new THREE.Vector3();
    for (let t = 0; t < 6; t++) {
      layer.tufts.getMatrixAt(i * 6 + t, m);
      // Matrix4.decompose reports scale 1 for singular matrices, so measure the basis column directly.
      expect(column.setFromMatrixColumn(m, 0).length()).toBe(0);
    }
  });

  it('sinks water below grass', () => {
    const state = newGame(1);
    const layer = createTileLayer(state.tiles, state.seed);
    const waterKey = Object.keys(state.tiles).find((k) => state.tiles[k].tile === 'water')!;
    const y = (key: string) => {
      const m = new THREE.Matrix4();
      layer.tiles.getMatrixAt(layer.indexOf(key)!, m);
      return new THREE.Vector3().setFromMatrixPosition(m).y;
    };
    expect(y(waterKey)).toBeLessThan(y(hexKey(hex(0, 0))));
  });
});

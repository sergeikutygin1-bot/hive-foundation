import { describe, expect, it } from 'vitest';
import {
  HEX_SIZE, ORIGIN, hex, hexDistance, hexKey, hexNeighbors, hexRange, hexRing, hexToWorld, parseHexKey, worldToHex,
} from '../../src/core/hex';

describe('hex keys', () => {
  it('round-trips through a key', () => {
    expect(parseHexKey(hexKey(hex(3, -7)))).toEqual({ q: 3, r: -7 });
    expect(hexKey(hex(-0, 0))).toBe('0,0');
  });
});

describe('hex neighborhoods', () => {
  it('has six distinct neighbors at distance 1', () => {
    const center = hex(2, -1);
    const n = hexNeighbors(center);
    expect(n).toHaveLength(6);
    expect(new Set(n.map(hexKey)).size).toBe(6);
    for (const h of n) expect(hexDistance(h, center)).toBe(1);
  });

  it('computes distance', () => {
    expect(hexDistance(ORIGIN, hex(3, -1))).toBe(3);
    expect(hexDistance(hex(-2, 2), hex(2, -2))).toBe(4);
    expect(hexDistance(hex(1, 1), hex(1, 1))).toBe(0);
  });

  it('builds rings of 6r hexes at exactly distance r', () => {
    expect(hexRing(ORIGIN, 0)).toEqual([ORIGIN]);
    for (const r of [1, 2, 5]) {
      const ring = hexRing(hex(1, 2), r);
      expect(ring).toHaveLength(6 * r);
      expect(new Set(ring.map(hexKey)).size).toBe(6 * r);
      for (const h of ring) expect(hexDistance(h, hex(1, 2))).toBe(r);
    }
  });

  it('builds ranges of 3r(r+1)+1 unique hexes', () => {
    for (const r of [0, 1, 3, 12]) {
      const range = hexRange(ORIGIN, r);
      expect(range).toHaveLength(3 * r * (r + 1) + 1);
      expect(new Set(range.map(hexKey)).size).toBe(range.length);
      for (const h of range) expect(hexDistance(h, ORIGIN)).toBeLessThanOrEqual(r);
    }
  });
});

describe('hex <-> world', () => {
  it('lays out pointy-top rows', () => {
    expect(hexToWorld(hex(1, 0))).toEqual({ x: Math.sqrt(3), z: 0 });
    const p = hexToWorld(hex(0, 1));
    expect(p.x).toBeCloseTo(Math.sqrt(3) / 2);
    expect(p.z).toBeCloseTo(1.5);
  });

  it('maps every hex center back to its hex', () => {
    for (const h of hexRange(ORIGIN, 6)) {
      const { x, z } = hexToWorld(h);
      expect(worldToHex(x, z)).toEqual(h);
    }
  });

  it('maps points inside a hex back to that hex', () => {
    const inner = ((HEX_SIZE * Math.sqrt(3)) / 2) * 0.95;
    for (const h of hexRange(ORIGIN, 3)) {
      const c = hexToWorld(h);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        expect(worldToHex(c.x + Math.cos(a) * inner, c.z + Math.sin(a) * inner)).toEqual(h);
      }
    }
  });
});

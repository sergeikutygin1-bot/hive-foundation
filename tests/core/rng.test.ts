import { describe, expect, it } from 'vitest';
import { hash2, mulberry32, pick, randInt } from '../../src/core/rng';

describe('mulberry32', () => {
  it('is deterministic per seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect(Array.from({ length: 5 }, () => a())).toEqual(Array.from({ length: 5 }, () => b()));
  });

  it('differs across seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('stays in [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 10_000; i++) {
      const v = rng();
      expect(v >= 0 && v < 1).toBe(true);
    }
  });
});

describe('helpers', () => {
  it('randInt covers the inclusive range', () => {
    const rng = mulberry32(3);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(randInt(rng, 2, 5));
    expect([...seen].sort()).toEqual([2, 3, 4, 5]);
  });

  it('pick refuses an empty list', () => {
    expect(() => pick(mulberry32(1), [])).toThrow();
    expect(pick(mulberry32(1), ['only'])).toBe('only');
  });

  it('hash2 is deterministic, in range and well spread', () => {
    expect(hash2(3, 4, 1)).toBe(hash2(3, 4, 1));
    expect(hash2(3, 4, 1)).not.toBe(hash2(4, 3, 1));
    const buckets = new Set<number>();
    for (let q = -10; q <= 10; q++) {
      for (let r = -10; r <= 10; r++) {
        const v = hash2(q, r, 9);
        expect(v >= 0 && v < 1).toBe(true);
        buckets.add(Math.floor(v * 10));
      }
    }
    expect(buckets.size).toBe(10);
  });
});

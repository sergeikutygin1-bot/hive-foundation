import { describe, expect, it } from 'vitest';
import { MAX_FRAME_MS, TICK_MS, ticksForFrame } from '../../src/game/loop';

function runFrames(frames: number, frameMs: number, speed: number): number {
  let acc = 0;
  let total = 0;
  for (let i = 0; i < frames; i++) {
    const r = ticksForFrame(acc, frameMs, speed);
    acc = r.accMs;
    total += r.ticks;
  }
  return total;
}

describe('ticksForFrame', () => {
  it('runs 10 ticks per real second at 1x', () => {
    expect(TICK_MS).toBe(100);
    expect(runFrames(50, 20, 1)).toBe(10);
  });

  it('scales with speed', () => {
    expect(runFrames(50, 20, 2)).toBe(20);
    expect(runFrames(50, 20, 4)).toBe(40);
  });

  it('runs nothing and drops the accumulator while paused', () => {
    expect(ticksForFrame(90, 20, 0)).toEqual({ ticks: 0, accMs: 0 });
  });

  it('carries the remainder between frames', () => {
    const a = ticksForFrame(0, 60, 1);
    expect(a).toEqual({ ticks: 0, accMs: 60 });
    const b = ticksForFrame(a.accMs, 60, 1);
    expect(b.ticks).toBe(1);
    expect(b.accMs).toBeCloseTo(20);
  });

  it('caps a huge frame (background tab, hitch) so time never fast-forwards', () => {
    expect(MAX_FRAME_MS).toBe(250);
    expect(ticksForFrame(0, 10_000, 4).ticks).toBe(10);
    expect(ticksForFrame(0, 10_000, 1).ticks).toBe(2);
  });

  it('ignores negative frame times', () => {
    expect(ticksForFrame(0, -500, 1)).toEqual({ ticks: 0, accMs: 0 });
  });
});

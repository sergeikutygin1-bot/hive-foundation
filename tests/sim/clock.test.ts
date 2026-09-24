import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../src/game/loop';
import { DT_DAYS, TICKS_PER_DAY, TICKS_PER_SECOND, calendar, isDayStart } from '../../src/sim/clock';

describe('clock', () => {
  it('agrees with the game loop on tick length', () => {
    expect(1000 / TICKS_PER_SECOND).toBe(TICK_MS);
    expect(TICKS_PER_DAY).toBe(600);
    expect(DT_DAYS * TICKS_PER_DAY).toBeCloseTo(1);
  });

  it('starts on day 1 of spring, year 1', () => {
    expect(calendar(0)).toEqual({ day: 1, season: 'spring', year: 1, dayProgress: 0 });
  });

  it('rolls days, seasons and years', () => {
    expect(calendar(599).day).toBe(1);
    expect(calendar(599).dayProgress).toBeCloseTo(599 / 600);
    expect(calendar(600).day).toBe(2);
    expect(calendar(28 * 600)).toMatchObject({ day: 29, season: 'summer', year: 1 });
    expect(calendar(56 * 600)).toMatchObject({ day: 57, season: 'autumn' });
    expect(calendar(84 * 600)).toMatchObject({ day: 85, season: 'winter' });
    expect(calendar(112 * 600)).toMatchObject({ day: 113, season: 'spring', year: 2 });
  });

  it('detects day boundaries', () => {
    expect(isDayStart(0)).toBe(true);
    expect(isDayStart(600)).toBe(true);
    expect(isDayStart(601)).toBe(false);
  });
});

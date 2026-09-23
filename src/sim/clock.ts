/** Sim ticks per real second at 1x speed. */
export const TICKS_PER_SECOND = 10;
/** One in-game day lasts 60 real seconds at 1x. */
export const TICKS_PER_DAY = 600;
/** In-game days per tick. */
export const DT_DAYS = 1 / TICKS_PER_DAY;
export const DAYS_PER_SEASON = 28;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

export interface CalendarInfo {
  day: number;
  season: Season;
  year: number;
  dayProgress: number;
}

export function calendar(tick: number): CalendarInfo {
  const day = Math.floor(tick / TICKS_PER_DAY) + 1;
  return {
    day,
    season: SEASONS[Math.floor((day - 1) / DAYS_PER_SEASON) % SEASONS.length],
    year: Math.floor((day - 1) / (DAYS_PER_SEASON * SEASONS.length)) + 1,
    dayProgress: (tick % TICKS_PER_DAY) / TICKS_PER_DAY,
  };
}

export function isDayStart(tick: number): boolean {
  return tick % TICKS_PER_DAY === 0;
}

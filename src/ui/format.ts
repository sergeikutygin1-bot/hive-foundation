const EPS = 1e-6;

/** Floors so the UI never shows more than you have; the epsilon absorbs float noise (0.7 - 1e-12). */
export const formatKg = (kg: number): string => (Math.floor(kg * 10 + EPS) / 10).toFixed(1);
export const formatCoins = (coins: number): string => String(Math.floor(coins + EPS));
export const formatRate = (perDay: number): string => perDay.toFixed(2);

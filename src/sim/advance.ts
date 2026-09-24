import type { Registry } from '../content/registry';
import { DT_DAYS, calendar, isDayStart } from './clock';
import { applySafetyNet } from './economy';
import type { GameEvent } from './events';
import { productionTick } from './production';
import type { GameState } from './state';

/** Runs `ticks` fixed sim steps. Deterministic; mutates state; no I/O. Speed is the loop's concern. */
export function advance(state: GameState, reg: Registry, ticks: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    events.push(...productionTick(state, reg, DT_DAYS));
    state.clock.tick += 1;
    if (isDayStart(state.clock.tick)) {
      const { day, season, year } = calendar(state.clock.tick);
      events.push({ type: 'dayStarted', day, season, year });
      const grant = applySafetyNet(state, reg);
      if (grant) events.push(grant);
    }
  }
  return events;
}

import { hexDistance } from '../core/hex';
import type { Registry } from '../content/registry';
import type { ProducerDef, SourceDef } from '../content/types';
import type { GameEvent } from './events';
import type { Entity, GameState } from './state';

export interface SourceShare {
  sourceId: string;
  /** This producer's slice of the source's daily yield. */
  nectarPerDay: number;
  /** How many producers split this source. */
  sharedWith: number;
}

export interface RangeMap {
  sharesByProducer: Map<string, SourceShare[]>;
  producersBySource: Map<string, string[]>;
}

export function buildRangeMap(state: GameState, reg: Registry): RangeMap {
  const producers: { entity: Entity; def: ProducerDef }[] = [];
  const sources: { entity: Entity; def: SourceDef }[] = [];
  for (const entity of Object.values(state.entities)) {
    const def = reg.buildable(entity.def);
    if (def.producer) producers.push({ entity, def: def.producer });
    if (def.source) sources.push({ entity, def: def.source });
  }

  const sharesByProducer = new Map<string, SourceShare[]>();
  for (const p of producers) sharesByProducer.set(p.entity.id, []);
  const producersBySource = new Map<string, string[]>();

  for (const src of sources) {
    const feeding = producers.filter(
      (p) => p.def.consumes === src.def.kind && hexDistance(p.entity.hex, src.entity.hex) <= p.def.range,
    );
    producersBySource.set(src.entity.id, feeding.map((p) => p.entity.id));
    for (const p of feeding) {
      sharesByProducer.get(p.entity.id)?.push({
        sourceId: src.entity.id,
        nectarPerDay: src.def.yieldPerDay / feeding.length,
        sharedWith: feeding.length,
      });
    }
  }
  return { sharesByProducer, producersBySource };
}

/** Derived data, never saved. Entities never move, so the set of ids fully determines the map. */
const rangeCache = new WeakMap<GameState, { key: string; map: RangeMap }>();

export function getRangeMap(state: GameState, reg: Registry): RangeMap {
  const key = Object.keys(state.entities).join('|');
  const hit = rangeCache.get(state);
  if (hit && hit.key === key) return hit.map;
  const map = buildRangeMap(state, reg);
  rangeCache.set(state, { key, map });
  return map;
}

function producerOf(state: GameState, reg: Registry, id: string): ProducerDef | undefined {
  const entity = state.entities[id];
  return entity ? reg.buildable(entity.def).producer : undefined;
}

export function intakePerDay(state: GameState, reg: Registry, producerId: string): number {
  const producer = producerOf(state, reg, producerId);
  if (!producer) return 0;
  const shares = getRangeMap(state, reg).sharesByProducer.get(producerId) ?? [];
  const total = shares.reduce((sum, s) => sum + s.nectarPerDay, 0);
  return Math.min(total, producer.maxIntakePerDay);
}

export function outputPerDay(state: GameState, reg: Registry, producerId: string): number {
  const producer = producerOf(state, reg, producerId);
  return producer ? intakePerDay(state, reg, producerId) * producer.conversion : 0;
}

/** Advances every producer by dtDays. Mutates state; returns producerFull events. */
export function productionTick(state: GameState, reg: Registry, dtDays: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (const id of getRangeMap(state, reg).sharesByProducer.keys()) {
    const entity = state.entities[id];
    const producer = reg.buildable(entity.def).producer;
    if (!producer) continue;
    const next = Math.min(producer.capacity, (entity.store ?? 0) + outputPerDay(state, reg, id) * dtDays);
    entity.store = next;
    if (next >= producer.capacity) {
      if (!state.flags.fullNotified[id]) {
        state.flags.fullNotified[id] = true;
        events.push({ type: 'producerFull', id });
      }
    } else if (state.flags.fullNotified[id]) {
      delete state.flags.fullNotified[id];
    }
  }
  return events;
}

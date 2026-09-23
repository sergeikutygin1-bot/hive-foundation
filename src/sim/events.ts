import type { Amounts, ResourceId } from '../content/types';
import type { Season } from './clock';
import type { Entity, Speed } from './state';

export type GameEvent =
  | { type: 'entityPlaced'; entity: Entity }
  | { type: 'entityRemoved'; entity: Entity; refund: Amounts }
  | { type: 'producerFull'; id: string }
  | { type: 'harvested'; id?: string; resource: ResourceId; amount: number }
  | { type: 'sold'; resource: ResourceId; amount: number; coins: number }
  | { type: 'dayStarted'; day: number; season: Season; year: number }
  | { type: 'safetyNetGranted'; coins: number }
  | { type: 'speedChanged'; speed: Speed };

import type { Hex } from '../core/hex';

export type ResourceId = string;
export type TileId = 'grass' | 'water' | 'soil';
export type Amounts = Partial<Record<ResourceId, number>>;

export const COINS: ResourceId = 'coins';

export interface ResourceDef {
  id: ResourceId;
  unit: 'coin' | 'kg';
}

export interface TileDef {
  id: TileId;
  buildable: boolean;
}

export interface SourceDef {
  kind: 'nectar';
  flowerType: string;
  /** Nectar units per in-game day. */
  yieldPerDay: number;
}

export interface ProducerDef {
  consumes: 'nectar';
  /** Hex distance within which sources feed this producer. */
  range: number;
  output: ResourceId;
  /** Units of output per unit of nectar. */
  conversion: number;
  /** Output stored before production stalls. */
  capacity: number;
  maxIntakePerDay: number;
}

export interface BuildableDef {
  id: string;
  cost: Amounts;
  allowedTiles: TileId[];
  /** A placed entity turns its tile into this; the previous tile comes back on removal. */
  setsTile?: TileId;
  purchasable: boolean;
  removable: boolean;
  producer?: ProducerDef;
  source?: SourceDef;
}

export interface PriceDef {
  resource: ResourceId;
  /** Coins per unit. */
  sell: number;
}

export interface StartingEntity {
  def: string;
  hex: Hex;
}

export interface StartingSetup {
  inventory: Amounts;
  entities: StartingEntity[];
}

export interface ContentPack {
  id: string;
  resources: ResourceDef[];
  buildables: BuildableDef[];
  prices: PriceDef[];
  start?: StartingSetup;
}

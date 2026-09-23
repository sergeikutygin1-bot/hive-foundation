import { basePack } from './packs/base';
import { beesPack } from './packs/bees';
import type { ContentPack } from './types';

export const DEFAULT_PACKS: readonly ContentPack[] = [basePack, beesPack];

import type { CosmeticConfig, CosmeticId } from '../types/cosmetic';

export const COSMETIC_CONFIGS: Record<CosmeticId, CosmeticConfig> = {
  thunder_hammer: {
    id: 'thunder_hammer',
    type: 'attack_effect',
    price: 100,
    icon: 'T',
    nameKey: 'cosmetic.thunderHammer.name',
    descriptionKey: 'cosmetic.thunderHammer.desc',
  },
};

export const COSMETICS: CosmeticConfig[] = Object.values(COSMETIC_CONFIGS);

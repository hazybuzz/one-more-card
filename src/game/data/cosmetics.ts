import type { CosmeticConfig, CosmeticId } from '../types/cosmetic';

export const COSMETIC_CONFIGS: Record<CosmeticId, CosmeticConfig> = {
  thunder_hammer: {
    id: 'thunder_hammer',
    type: 'attack_effect',
    price: 250,
    icon: 'T',
    nameKey: 'cosmetic.thunderHammer.name',
    descriptionKey: 'cosmetic.thunderHammer.desc',
  },
  jade_sword_array: {
    id: 'jade_sword_array',
    type: 'attack_effect',
    price: 250,
    icon: '剑',
    nameKey: 'cosmetic.jadeSwordArray.name',
    descriptionKey: 'cosmetic.jadeSwordArray.desc',
  },
  sakura_slash: {
    id: 'sakura_slash',
    type: 'attack_effect',
    price: 250,
    icon: '花',
    nameKey: 'cosmetic.sakuraSlash.name',
    descriptionKey: 'cosmetic.sakuraSlash.desc',
  },
};

export const COSMETICS: CosmeticConfig[] = Object.values(COSMETIC_CONFIGS);

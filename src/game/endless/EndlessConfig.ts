import type { ItemId } from '../types/item';

export const ENDLESS_CONFIG = {
  rulesVersion: 'endless-v1',
  entryCost: 100,
  playerHp: 12,
  startingSupplyCoins: 70,
  coinsPerDefeat: 25,
  defeatBonus: 10,
  coinsPerResonancePoint: 2,
  resonanceBonusCapPerDefeat: 10,
  defeatsPerStage: 5,
  defeatsPerAttackIncrease: 10,
  priceIncreasePerStage: 5,
  purchasesPerVisit: 2,
  inventoryCapacity: 4,
  baseItemPrices: {
    heal_potion: 20, cooling_charm: 15, resonance_dust: 30, holy_shield: 45, resonance_dice: 25,
  } satisfies Record<ItemId, number>,
  backgroundTextureKey: 'endless-hell-tavern-background',
  backgroundShadeOpacity: 0.5,
  backgroundPath: '/image/env-assets/endless/hell-tavern-background-v2.png',
} as const;

// Full refresh recovery and settlement persistence are available.
export const ENDLESS_BATTLE_READY = true;

/** Test and production use independent save slots. */
export function isEndlessBattleReady(mode: 'test' | 'production'): boolean {
  return ENDLESS_BATTLE_READY || mode === 'test';
}

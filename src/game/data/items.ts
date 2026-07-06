import type { ItemConfig, ItemId } from '../types/item';

export const ITEM_CONFIGS: Record<ItemId, ItemConfig> = {
  heal_potion: {
    id: 'heal_potion',
    price: 10,
    icon: '+',
    nameKey: 'item.healPotion.name',
    descriptionKey: 'item.healPotion.desc',
    useTiming: 'unknown-hand',
    effectId: 'fate_beer',
    resourceKey: 'item_fate_beer',
  },
  cooling_charm: {
    id: 'cooling_charm',
    price: 5,
    icon: '?',
    nameKey: 'item.coolingCharm.name',
    descriptionKey: 'item.coolingCharm.desc',
    useTiming: 'player-turn',
    effectId: 'fate_reroll',
    resourceKey: 'item_fate_reroll',
  },
  resonance_dust: {
    id: 'resonance_dust',
    price: 10,
    icon: '!',
    nameKey: 'item.resonanceDust.name',
    descriptionKey: 'item.resonanceDust.desc',
    useTiming: 'unknown-hand',
    effectId: 'resonance_horn',
    resourceKey: 'item_resonance_horn',
  },
};

export const ITEMS: ItemConfig[] = Object.values(ITEM_CONFIGS);

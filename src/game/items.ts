import { ITEMS as ITEM_CONFIGS } from './data/items';
import type { ItemConfig, ItemId as ConfigItemId } from './types/item';

export type ItemId = ConfigItemId;

export type ItemDefinition = Pick<ItemConfig, 'id' | 'price' | 'icon' | 'nameKey' | 'descriptionKey' | 'maxUsesPerBattle' | 'resourceKey'>;

export const ITEMS: ItemDefinition[] = ITEM_CONFIGS.map(({ id, price, icon, nameKey, descriptionKey, maxUsesPerBattle, resourceKey }) => ({
  id,
  price,
  icon,
  nameKey,
  descriptionKey,
  maxUsesPerBattle,
  resourceKey,
}));

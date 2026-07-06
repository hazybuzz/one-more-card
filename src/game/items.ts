import { ITEMS as ITEM_CONFIGS } from './data/items';
import type { ItemConfig, ItemId as ConfigItemId } from './types/item';

export type ItemId = ConfigItemId;

export type ItemDefinition = Pick<ItemConfig, 'id' | 'price' | 'icon' | 'nameKey' | 'descriptionKey'>;

export const ITEMS: ItemDefinition[] = ITEM_CONFIGS.map(({ id, price, icon, nameKey, descriptionKey }) => ({
  id,
  price,
  icon,
  nameKey,
  descriptionKey,
}));

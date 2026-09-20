import type { CosmeticConfig } from '../../game/cosmetics';
import type { ItemDefinition } from '../../game/items';

export type CatalogCategoryId =
  | 'battle-items'
  | 'effects'
  | 'card-styles'
  | 'character-styles'
  | 'table-decorations';

export type CatalogEntryKind = 'consumable' | 'cosmetic';
export type CatalogOwnership = 'stackable' | 'permanent';

export interface CatalogVisualConfig {
  thumbnailTextureKey?: string;
  previewTextureKey?: string;
  textureAngle?: number;
  accentColor?: number;
  fallbackIcon: string;
}

export interface CatalogEntryViewModel {
  id: string;
  kind: CatalogEntryKind;
  category: CatalogCategoryId;
  ownership: CatalogOwnership;
  nameKey: string;
  descriptionKey: string;
  price: number;
  ownedCount: number;
  equipped: boolean;
  affordable: boolean;
  visual: CatalogVisualConfig;
}

interface CatalogEntryContext {
  soulCoins: number;
  ownedCount: number;
  equipped?: boolean;
  thumbnailTextureKey?: string;
  previewTextureKey?: string;
  textureAngle?: number;
  accentColor?: number;
}

export function createItemCatalogEntry(
  item: ItemDefinition,
  context: CatalogEntryContext,
): CatalogEntryViewModel {
  return {
    id: item.id,
    kind: 'consumable',
    category: 'battle-items',
    ownership: 'stackable',
    nameKey: item.nameKey,
    descriptionKey: item.descriptionKey,
    price: item.price,
    ownedCount: context.ownedCount,
    equipped: false,
    affordable: context.soulCoins >= item.price,
    visual: {
      thumbnailTextureKey: context.thumbnailTextureKey,
      previewTextureKey: context.previewTextureKey,
      textureAngle: context.textureAngle,
      accentColor: context.accentColor,
      fallbackIcon: item.icon,
    },
  };
}

export function createCosmeticCatalogEntry(
  cosmetic: CosmeticConfig,
  context: CatalogEntryContext,
): CatalogEntryViewModel {
  return {
    id: cosmetic.id,
    kind: 'cosmetic',
    category: 'effects',
    ownership: 'permanent',
    nameKey: cosmetic.nameKey,
    descriptionKey: cosmetic.descriptionKey,
    price: cosmetic.price,
    ownedCount: context.ownedCount,
    equipped: context.equipped ?? false,
    affordable: context.soulCoins >= cosmetic.price,
    visual: {
      thumbnailTextureKey: context.thumbnailTextureKey,
      previewTextureKey: context.previewTextureKey,
      textureAngle: context.textureAngle,
      accentColor: context.accentColor,
      fallbackIcon: cosmetic.icon,
    },
  };
}

export function entriesForCategory(
  entries: CatalogEntryViewModel[],
  category: CatalogCategoryId,
): CatalogEntryViewModel[] {
  return entries.filter((entry) => entry.category === category);
}

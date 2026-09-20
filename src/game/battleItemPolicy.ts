import type { ItemDefinition } from './items';

export const MAX_BATTLE_ITEM_USES = 3;
export function remainingBattleItemUses(mode: string, used: number): number {
  return mode === 'endless' ? Infinity : Math.max(0, MAX_BATTLE_ITEM_USES - used);
}
export function battleItemUseLimitReached(mode: string, item: ItemDefinition, counts: Partial<Record<ItemDefinition['id'], number>>): boolean {
  return mode !== 'endless' && item.maxUsesPerBattle !== undefined && (counts[item.id] ?? 0) >= item.maxUsesPerBattle;
}

export function battleItemDescriptionKey(mode: string, item: ItemDefinition): string {
  return mode === 'endless' && item.id === 'holy_shield' ? 'endless.items.shieldDescription' : item.descriptionKey;
}

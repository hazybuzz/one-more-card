export type ItemId = 'heal_potion' | 'cooling_charm' | 'resonance_dust' | 'holy_shield' | 'resonance_dice';
export type ItemUseTiming = 'unknown-hand' | 'player-turn';
export type ItemEffectId = 'fate_beer' | 'fate_reroll' | 'resonance_horn' | 'holy_shield' | 'resonance_reroll';

export interface ItemConfig {
  id: ItemId;
  price: number;
  icon: string;
  nameKey: string;
  descriptionKey: string;
  useTiming: ItemUseTiming;
  effectId: ItemEffectId;
  maxUsesPerBattle?: number;
  resourceKey?: string;
}

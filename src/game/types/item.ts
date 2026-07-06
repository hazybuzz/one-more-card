export type ItemId = 'heal_potion' | 'cooling_charm' | 'resonance_dust';
export type ItemUseTiming = 'unknown-hand' | 'player-turn';
export type ItemEffectId = 'fate_beer' | 'fate_reroll' | 'resonance_horn';

export interface ItemConfig {
  id: ItemId;
  price: number;
  icon: string;
  nameKey: string;
  descriptionKey: string;
  useTiming: ItemUseTiming;
  effectId: ItemEffectId;
  resourceKey?: string;
}

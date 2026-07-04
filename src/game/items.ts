export type ItemId = 'heal_potion' | 'cooling_charm' | 'resonance_dust';

export interface ItemDefinition {
  id: ItemId;
  price: number;
  icon: string;
  nameKey: string;
  descriptionKey: string;
}

export const ITEMS: ItemDefinition[] = [
  {
    id: 'heal_potion',
    price: 10,
    icon: '+',
    nameKey: 'item.healPotion.name',
    descriptionKey: 'item.healPotion.desc',
  },
  {
    id: 'cooling_charm',
    price: 5,
    icon: '?',
    nameKey: 'item.coolingCharm.name',
    descriptionKey: 'item.coolingCharm.desc',
  },
  {
    id: 'resonance_dust',
    price: 10,
    icon: '!',
    nameKey: 'item.resonanceDust.name',
    descriptionKey: 'item.resonanceDust.desc',
  },
];

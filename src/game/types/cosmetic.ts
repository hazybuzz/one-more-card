export type CosmeticId = 'thunder_hammer';
export type CosmeticType = 'attack_effect';

export interface CosmeticConfig {
  id: CosmeticId;
  type: CosmeticType;
  price: number;
  icon: string;
  nameKey: string;
  descriptionKey: string;
}

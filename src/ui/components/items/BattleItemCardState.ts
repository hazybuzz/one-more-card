import type { ItemId } from '../../../game/types/item';

export interface BattleItemCardState {
  id: ItemId;
  icon: string;
  iconTextureKey?: string;
  name: string;
  description: string;
  count: number;
  available: boolean;
  unavailableReason?: string;
  timingLabel: string;
  selected: boolean;
}

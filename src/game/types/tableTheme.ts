import type { EnemyId } from './enemy';

export type TableThemeId = 'evernight_tavern' | 'northern_longhouse' | 'dragon_gate' | 'edo_teahouse';
export type EntryStakeMultiplier = 1 | 2 | 3;
export const ENTRY_STAKE_MULTIPLIERS: EntryStakeMultiplier[] = [1, 2, 3];

export interface TableThemeVisualConfig {
  accentColor: number;
  glowColor: string;
  backgroundColor: number;
  panelColor: number;
  panelAltColor: number;
  lineColor: number;
  tableColor: number;
  tableRingColor: number;
  motif: 'tavern' | 'northern' | 'dragon' | 'edo';
}

export interface TableThemeConfig {
  id: TableThemeId;
  nameKey: string;
  subtitleKey: string;
  descriptionKey: string;
  entryCost: number;
  rewardMultiplier: number;
  unlockedByDefault: boolean;
  enemyIds: EnemyId[];
  playerHp: number;
  visual: TableThemeVisualConfig;
}

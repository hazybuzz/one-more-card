import type { EnemyId } from './enemy';

export type TableThemeId = 'evernight_tavern' | 'northern_longhouse';

export interface TableThemeVisualConfig {
  accentColor: number;
  glowColor: string;
  backgroundColor: number;
  panelColor: number;
  panelAltColor: number;
  lineColor: number;
  tableColor: number;
  tableRingColor: number;
  motif: 'tavern' | 'northern';
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

import type { EnemyId } from './enemy';

export const TABLE_THEME_IDS = [
  'evernight_tavern',
  'northern_longhouse',
  'dragon_gate',
  'edo_teahouse',
] as const;

export type TableThemeId = typeof TABLE_THEME_IDS[number];
export type EntryStakeMultiplier = 1 | 2 | 3;
export const ENTRY_STAKE_MULTIPLIERS: EntryStakeMultiplier[] = [1, 2, 3];

export interface StakeDifficultyConfig {
  multiplier: EntryStakeMultiplier;
  enemyHpModifier: number;
  passiveHpThresholdModifier: number;
  labelKey: string;
  descriptionKey: string;
}

export interface TableThemeVisualConfig {
  accentColor: number;
  enemyFrameColor: number;
  glowColor: string;
  backgroundColor: number;
  panelColor: number;
  panelAltColor: number;
  lineColor: number;
  tableColor: number;
  tableRingColor: number;
  motif: 'tavern' | 'northern' | 'dragon' | 'edo';
}

export interface TableThemeUnlockConfig {
  requiredFormalWins: number;
  coinCost: number;
}

export interface TableThemeConfig {
  id: TableThemeId;
  nameKey: string;
  subtitleKey: string;
  descriptionKey: string;
  entryCost: number;
  payoutMultiplier: number;
  unlockedByDefault: boolean;
  unlock?: TableThemeUnlockConfig;
  enemyIds: EnemyId[];
  playerHp: number;
  passiveHpThresholds?: Partial<Record<EnemyId, number>>;
  visual: TableThemeVisualConfig;
}

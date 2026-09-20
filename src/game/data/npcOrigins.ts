import { TABLE_THEMES } from './tableThemes';
import type { EnemyId } from '../types/enemy';
import type { TableThemeId } from '../types/tableTheme';

export function getNpcSourceTheme(enemyId: EnemyId): TableThemeId {
  if (enemyId === 'einherjar') return 'northern_longhouse';
  return TABLE_THEMES.find((theme) => theme.enemyIds.includes(enemyId))?.id ?? 'evernight_tavern';
}

export function getNpcBasePassiveThreshold(enemyId: EnemyId): number {
  const origin = TABLE_THEMES.find((theme) => theme.id === getNpcSourceTheme(enemyId));
  return origin?.passiveHpThresholds?.[enemyId] ?? 3;
}

export const ENDLESS_NPC_ART_IDS: EnemyId[] = [...new Set(TABLE_THEMES.flatMap((theme) => theme.enemyIds).concat('einherjar'))];

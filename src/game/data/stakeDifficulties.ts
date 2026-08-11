import type { EntryStakeMultiplier, StakeDifficultyConfig } from '../types/tableTheme';

export const STAKE_DIFFICULTIES: Record<EntryStakeMultiplier, StakeDifficultyConfig> = {
  1: {
    multiplier: 1,
    enemyHpModifier: -1,
    passiveHpThresholdModifier: -1,
    labelKey: 'tableSelect.difficulty.easy',
    descriptionKey: 'tableSelect.difficulty.easyDescription',
  },
  2: {
    multiplier: 2,
    enemyHpModifier: 0,
    passiveHpThresholdModifier: 0,
    labelKey: 'tableSelect.difficulty.standard',
    descriptionKey: 'tableSelect.difficulty.standardDescription',
  },
  3: {
    multiplier: 3,
    enemyHpModifier: 1,
    passiveHpThresholdModifier: 1,
    labelKey: 'tableSelect.difficulty.high',
    descriptionKey: 'tableSelect.difficulty.highDescription',
  },
};

export function getStakeDifficulty(multiplier: EntryStakeMultiplier): StakeDifficultyConfig {
  return STAKE_DIFFICULTIES[multiplier];
}

import { TABLE_THEME_IDS, ENTRY_STAKE_MULTIPLIERS } from '../types/tableTheme';
import type { FormalDifficultyWins } from './EndlessState';
import { ENDLESS_CONFIG } from './EndlessConfig';

export function getEndlessUnlockProgress(wins: FormalDifficultyWins): { completed: number; required: number; unlocked: boolean } {
  const completed = TABLE_THEME_IDS.reduce((count, theme) => count
    + ENTRY_STAKE_MULTIPLIERS.filter((difficulty) => (wins[theme]?.[difficulty] ?? 0) > 0).length, 0);
  const required = TABLE_THEME_IDS.length * ENTRY_STAKE_MULTIPLIERS.length;
  return { completed, required, unlocked: completed === required };
}

export function calculateEndlessSettlement(defeated: number, resonance: number, spent: number, startingSupplyCoins = 0) {
  const k = Math.max(0, Math.floor(defeated));
  const r = Math.max(0, Math.floor(resonance));
  const earned = k * ENDLESS_CONFIG.coinsPerDefeat;
  const wallet = calculateEndlessBalance(earned, spent, startingSupplyCoins).cashWallet;
  const defeatBonus = k * ENDLESS_CONFIG.defeatBonus;
  const resonanceBonus = Math.min(r * ENDLESS_CONFIG.coinsPerResonancePoint, k * ENDLESS_CONFIG.resonanceBonusCapPerDefeat);
  return { earned, wallet, defeatBonus, resonanceBonus, total: wallet + defeatBonus + resonanceBonus };
}

/** Gift coins are spent first and can never be paid out. */
export function calculateEndlessBalance(earned: number, spent: number, startingSupplyCoins = 0) {
  const supply = Math.max(0, Math.floor(startingSupplyCoins));
  const purchases = Math.max(0, Math.floor(spent));
  const supplyRemaining = Math.max(0, supply - purchases);
  const cashWallet = Math.max(0, earned - Math.max(0, purchases - supply));
  return { supplyRemaining, cashWallet, wallet: supplyRemaining + cashWallet };
}

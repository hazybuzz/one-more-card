import type { CosmeticId } from './cosmetic';
import type { ItemId } from './item';
import type { EntryStakeMultiplier, TableThemeId } from './tableTheme';

export const ECONOMY_INCOME_SOURCES = [
  'story_first_clear',
  'formal_victory',
  'relief',
  'pvp_victory',
] as const;

export const ECONOMY_EXPENSE_SINKS = [
  'formal_entry',
  'item_purchase',
  'cosmetic_purchase',
  'theme_unlock',
  'pvp_loss',
] as const;

export type EconomyIncomeSource = typeof ECONOMY_INCOME_SOURCES[number];
export type EconomyExpenseSink = typeof ECONOMY_EXPENSE_SINKS[number];
export type EconomyCategory = EconomyIncomeSource | EconomyExpenseSink;

export interface EconomyTransactionContext {
  levelId?: string;
  themeId?: TableThemeId;
  stakeMultiplier?: EntryStakeMultiplier;
  itemId?: ItemId;
  cosmeticId?: CosmeticId;
}

export interface EconomyTransaction extends EconomyTransactionContext {
  timestamp: number;
  direction: 'income' | 'expense';
  category: EconomyCategory;
  amount: number;
  balanceAfter: number;
}

export interface EconomyStats {
  openingBalance: number;
  totalEarned: number;
  totalSpent: number;
  incomeBySource: Record<EconomyIncomeSource, number>;
  spendingBySink: Record<EconomyExpenseSink, number>;
}

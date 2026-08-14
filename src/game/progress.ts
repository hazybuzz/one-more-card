import { CHAPTERS } from './data/chapters';
import { getRuntimeMode, setRuntimeMode, type RuntimeMode } from './runtimeMode';
import type { CosmeticId } from './types/cosmetic';
import {
  ECONOMY_EXPENSE_SINKS,
  ECONOMY_INCOME_SOURCES,
  type EconomyExpenseSink,
  type EconomyIncomeSource,
  type EconomyStats,
  type EconomyTransaction,
  type EconomyTransactionContext,
} from './types/economy';
import { TABLE_THEME_IDS, type TableThemeId } from './types/tableTheme';

export interface BattleStats {
  wins: number;
  losses: number;
  battlesPlayed: number;
}

export interface FormalTableStats extends BattleStats {
  winsByTheme: Partial<Record<TableThemeId, number>>;
}

export type TableThemePurchaseStatus = 'unlocked' | 'already-unlocked' | 'wins-required' | 'not-enough-coins';

export interface TableThemePurchaseResult {
  status: TableThemePurchaseStatus;
  cost: number;
  total: number;
  currentWins: number;
  requiredWins: number;
}

export interface StoryProgress {
  unlockedLevelIds: string[];
  completedLevelIds: string[];
}

export interface GameProgress {
  soulCoins: number;
  ownedItems: Record<string, number>;
  ownedCosmetics: CosmeticId[];
  unlockedTableThemeIds: TableThemeId[];
  complimentaryTableEntryThemeIds: TableThemeId[];
  equippedAttackEffect?: CosmeticId;
  stats: BattleStats;
  formalTableStats: FormalTableStats;
  economyStats: EconomyStats;
  economyTransactions: EconomyTransaction[];
  story: StoryProgress;
}

const STORAGE_KEYS: Record<RuntimeMode, string> = {
  production: 'one-more-card-progress',
  test: 'one-more-card-test-progress',
};

const DEFAULT_PROGRESS: GameProgress = {
  soulCoins: 100,
  ownedItems: {
    heal_potion: 2,
  },
  ownedCosmetics: [],
  unlockedTableThemeIds: ['evernight_tavern'],
  complimentaryTableEntryThemeIds: [],
  equippedAttackEffect: undefined,
  stats: {
    wins: 0,
    losses: 0,
    battlesPlayed: 0,
  },
  formalTableStats: {
    wins: 0,
    losses: 0,
    battlesPlayed: 0,
    winsByTheme: {},
  },
  economyStats: {
    openingBalance: 100,
    totalEarned: 0,
    totalSpent: 0,
    incomeBySource: {
      story_first_clear: 0,
      formal_victory: 0,
      relief: 0,
      pvp_victory: 0,
    },
    spendingBySink: {
      formal_entry: 0,
      item_purchase: 0,
      cosmetic_purchase: 0,
      theme_unlock: 0,
      pvp_loss: 0,
    },
  },
  economyTransactions: [],
  story: {
    unlockedLevelIds: ['chapter1_1'],
    completedLevelIds: [],
  },
};

function createTestProgress(): GameProgress {
  const testProgress = cloneProgress(DEFAULT_PROGRESS);
  testProgress.soulCoins = 9999;
  testProgress.economyStats.openingBalance = 9999;
  testProgress.unlockedTableThemeIds = [...TABLE_THEME_IDS];
  testProgress.complimentaryTableEntryThemeIds = [];
  testProgress.story.unlockedLevelIds = CHAPTERS.flatMap((chapter) => chapter.levels.map((level) => level.id));
  testProgress.story.completedLevelIds = [];
  return testProgress;
}

let progress: GameProgress = loadProgress();

export function getProgress(): GameProgress {
  return progress;
}

export function switchProgressMode(mode: RuntimeMode): void {
  if (mode === getRuntimeMode()) {
    return;
  }

  saveProgress();
  setRuntimeMode(mode);
  progress = loadProgress();
}

export function resetTestProgress(): void {
  if (getRuntimeMode() !== 'test') {
    return;
  }

  progress = createTestProgress();
  saveProgress();
}

export function grantSoulCoins(
  source: EconomyIncomeSource,
  amount: number,
  context: EconomyTransactionContext = {},
): number {
  const reward = Math.max(0, Math.floor(amount));
  if (reward <= 0) {
    return 0;
  }

  progress.soulCoins += reward;
  progress.economyStats.totalEarned += reward;
  progress.economyStats.incomeBySource[source] += reward;
  appendEconomyTransaction('income', source, reward, context);
  saveProgress();
  return reward;
}

export function spendSoulCoins(
  sink: EconomyExpenseSink,
  amount: number,
  context: EconomyTransactionContext = {},
): boolean {
  const cost = Math.max(0, Math.floor(amount));
  if (progress.soulCoins < cost) {
    return false;
  }

  applySoulCoinExpense(sink, cost, context);
  saveProgress();
  return true;
}

export function getEconomyDebugSnapshot(): Pick<GameProgress, 'soulCoins' | 'economyStats' | 'economyTransactions'> {
  return {
    soulCoins: progress.soulCoins,
    economyStats: cloneEconomyStats(progress.economyStats),
    economyTransactions: progress.economyTransactions.map((transaction) => ({ ...transaction })),
  };
}

export function addItem(itemId: string, count = 1): void {
  const amount = Math.max(0, Math.floor(count));
  if (amount <= 0) {
    return;
  }

  progress.ownedItems[itemId] = (progress.ownedItems[itemId] ?? 0) + amount;
  saveProgress();
}

export function consumeItem(itemId: string, count = 1): boolean {
  const amount = Math.max(0, Math.floor(count));
  if (amount <= 0) {
    return true;
  }

  const currentCount = progress.ownedItems[itemId] ?? 0;
  if (currentCount < amount) {
    return false;
  }

  const nextCount = currentCount - amount;
  if (nextCount <= 0) {
    delete progress.ownedItems[itemId];
  } else {
    progress.ownedItems[itemId] = nextCount;
  }

  saveProgress();
  return true;
}

export function ownsCosmetic(cosmeticId: CosmeticId): boolean {
  return progress.ownedCosmetics.includes(cosmeticId);
}

export function addCosmetic(cosmeticId: CosmeticId): void {
  if (ownsCosmetic(cosmeticId)) {
    return;
  }

  progress.ownedCosmetics.push(cosmeticId);
  saveProgress();
}

export function isTableThemeUnlocked(themeId: TableThemeId): boolean {
  return progress.unlockedTableThemeIds.includes(themeId);
}

export function unlockTableTheme(themeId: TableThemeId): boolean {
  if (isTableThemeUnlocked(themeId)) {
    return false;
  }

  progress.unlockedTableThemeIds.push(themeId);
  grantComplimentaryTableEntry(themeId);
  saveProgress();
  return true;
}

export function hasComplimentaryTableEntry(themeId: TableThemeId): boolean {
  return progress.complimentaryTableEntryThemeIds.includes(themeId);
}

export function consumeComplimentaryTableEntry(themeId: TableThemeId): boolean {
  const index = progress.complimentaryTableEntryThemeIds.indexOf(themeId);
  if (index < 0) {
    return false;
  }

  progress.complimentaryTableEntryThemeIds.splice(index, 1);
  saveProgress();
  return true;
}

export function tryPurchaseTableTheme(
  themeId: TableThemeId,
  coinCost: number,
  requiredFormalWins: number,
): TableThemePurchaseResult {
  const cost = Math.max(0, Math.floor(coinCost));
  const requiredWins = Math.max(0, Math.floor(requiredFormalWins));
  const currentWins = progress.formalTableStats.wins;
  const result = (status: TableThemePurchaseStatus): TableThemePurchaseResult => ({
    status,
    cost,
    total: progress.soulCoins,
    currentWins,
    requiredWins,
  });

  if (isTableThemeUnlocked(themeId)) {
    return result('already-unlocked');
  }
  if (currentWins < requiredWins) {
    return result('wins-required');
  }
  if (progress.soulCoins < cost) {
    return result('not-enough-coins');
  }

  applySoulCoinExpense('theme_unlock', cost, { themeId });
  progress.unlockedTableThemeIds.push(themeId);
  grantComplimentaryTableEntry(themeId);
  saveProgress();
  return result('unlocked');
}

function grantComplimentaryTableEntry(themeId: TableThemeId): void {
  if (themeId === 'evernight_tavern' || progress.complimentaryTableEntryThemeIds.includes(themeId)) {
    return;
  }

  progress.complimentaryTableEntryThemeIds.push(themeId);
}

export function equipAttackEffect(cosmeticId: CosmeticId): boolean {
  if (!ownsCosmetic(cosmeticId)) {
    return false;
  }

  progress.equippedAttackEffect = cosmeticId;
  saveProgress();
  return true;
}

export function unequipAttackEffect(): void {
  progress.equippedAttackEffect = undefined;
  saveProgress();
}

export function recordBattleResult(outcome: 'victory' | 'defeat'): void {
  progress.stats.battlesPlayed += 1;
  if (outcome === 'victory') {
    progress.stats.wins += 1;
  } else {
    progress.stats.losses += 1;
  }

  saveProgress();
}

export function recordFormalTableResult(outcome: 'victory' | 'defeat', themeId: TableThemeId): void {
  progress.stats.battlesPlayed += 1;
  progress.formalTableStats.battlesPlayed += 1;

  if (outcome === 'victory') {
    progress.stats.wins += 1;
    progress.formalTableStats.wins += 1;
    progress.formalTableStats.winsByTheme[themeId] = (progress.formalTableStats.winsByTheme[themeId] ?? 0) + 1;
  } else {
    progress.stats.losses += 1;
    progress.formalTableStats.losses += 1;
  }

  saveProgress();
}

export function isStoryLevelUnlocked(levelId: string): boolean {
  return progress.story.unlockedLevelIds.includes(levelId);
}

export function isStoryLevelCompleted(levelId: string): boolean {
  return progress.story.completedLevelIds.includes(levelId);
}

export function unlockStoryLevel(levelId: string): void {
  if (progress.story.unlockedLevelIds.includes(levelId)) {
    return;
  }

  progress.story.unlockedLevelIds.push(levelId);
  saveProgress();
}

export function completeStoryLevel(levelId: string): void {
  if (progress.story.completedLevelIds.includes(levelId)) {
    return;
  }

  progress.story.completedLevelIds.push(levelId);
  saveProgress();
}

export function resetProgress(): void {
  progress = defaultProgressForCurrentMode();
  saveProgress();
}

function loadProgress(): GameProgress {
  const defaultProgress = defaultProgressForCurrentMode();
  try {
    const raw = localStorage.getItem(storageKeyForCurrentMode());
    if (!raw) {
      return defaultProgress;
    }

    const parsed = JSON.parse(raw) as Partial<GameProgress>;
    return normalizeProgress(parsed, defaultProgress);
  } catch {
    return defaultProgress;
  }
}

function saveProgress(): void {
  try {
    localStorage.setItem(storageKeyForCurrentMode(), JSON.stringify(progress));
  } catch {
    // Saving can fail in private or embedded browser contexts.
  }
}

function applySoulCoinExpense(
  sink: EconomyExpenseSink,
  cost: number,
  context: EconomyTransactionContext,
): void {
  if (cost <= 0) {
    return;
  }

  progress.soulCoins -= cost;
  progress.economyStats.totalSpent += cost;
  progress.economyStats.spendingBySink[sink] += cost;
  appendEconomyTransaction('expense', sink, cost, context);
}

function appendEconomyTransaction(
  direction: 'income' | 'expense',
  category: EconomyIncomeSource | EconomyExpenseSink,
  amount: number,
  context: EconomyTransactionContext,
): void {
  progress.economyTransactions.push({
    timestamp: Date.now(),
    direction,
    category,
    amount,
    balanceAfter: progress.soulCoins,
    ...context,
  });
  progress.economyTransactions = progress.economyTransactions.slice(-100);
}

function normalizeProgress(value: Partial<GameProgress>, defaultProgress = cloneProgress(DEFAULT_PROGRESS)): GameProgress {
  const soulCoins = normalizeNumber(value.soulCoins, defaultProgress.soulCoins);
  const unlockedTableThemeIds = getRuntimeMode() === 'test'
    ? [...TABLE_THEME_IDS]
    : normalizeUnlockedTableThemeIds(value.unlockedTableThemeIds);
  return {
    soulCoins,
    ownedItems: normalizeItems(value.ownedItems),
    ownedCosmetics: normalizeCosmetics(value.ownedCosmetics),
    unlockedTableThemeIds,
    complimentaryTableEntryThemeIds: normalizeComplimentaryTableEntryThemeIds(
      value.complimentaryTableEntryThemeIds,
      unlockedTableThemeIds,
    ),
    equippedAttackEffect: normalizeEquippedAttackEffect(value.equippedAttackEffect, value.ownedCosmetics),
    stats: {
      wins: normalizeNumber(value.stats?.wins, defaultProgress.stats.wins),
      losses: normalizeNumber(value.stats?.losses, defaultProgress.stats.losses),
      battlesPlayed: normalizeNumber(value.stats?.battlesPlayed, defaultProgress.stats.battlesPlayed),
    },
    formalTableStats: normalizeFormalTableStats(value.formalTableStats),
    economyStats: normalizeEconomyStats(value.economyStats, soulCoins),
    economyTransactions: normalizeEconomyTransactions(value.economyTransactions),
    story: normalizeStoryProgress(value.story, defaultProgress.story),
  };
}

function normalizeEconomyStats(stats: unknown, currentBalance: number): EconomyStats {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) {
    return {
      ...cloneEconomyStats(DEFAULT_PROGRESS.economyStats),
      openingBalance: currentBalance,
    };
  }

  const value = stats as Partial<EconomyStats>;
  return {
    openingBalance: normalizeNumber(value.openingBalance, currentBalance),
    totalEarned: normalizeNumber(value.totalEarned, 0),
    totalSpent: normalizeNumber(value.totalSpent, 0),
    incomeBySource: normalizeCategoryTotals(value.incomeBySource, ECONOMY_INCOME_SOURCES),
    spendingBySink: normalizeCategoryTotals(value.spendingBySink, ECONOMY_EXPENSE_SINKS),
  };
}

function normalizeCategoryTotals<T extends string>(value: unknown, categories: readonly T[]): Record<T, number> {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return categories.reduce<Record<T, number>>((normalized, category) => {
    normalized[category] = normalizeNumber(source[category], 0);
    return normalized;
  }, {} as Record<T, number>);
}

function normalizeEconomyTransactions(transactions: unknown): EconomyTransaction[] {
  if (!Array.isArray(transactions)) {
    return [];
  }

  const validIncome = new Set<string>(ECONOMY_INCOME_SOURCES);
  const validExpenses = new Set<string>(ECONOMY_EXPENSE_SINKS);
  return transactions.flatMap<EconomyTransaction>((transaction) => {
    if (!transaction || typeof transaction !== 'object' || Array.isArray(transaction)) {
      return [];
    }

    const value = transaction as Partial<EconomyTransaction>;
    const category = typeof value.category === 'string' ? value.category : '';
    const direction = value.direction;
    if (
      (direction !== 'income' && direction !== 'expense')
      || (direction === 'income' && !validIncome.has(category))
      || (direction === 'expense' && !validExpenses.has(category))
    ) {
      return [];
    }

    return [{
      timestamp: normalizeNumber(value.timestamp, 0),
      direction,
      category: category as EconomyTransaction['category'],
      amount: normalizeNumber(value.amount, 0),
      balanceAfter: normalizeNumber(value.balanceAfter, 0),
      ...(typeof value.levelId === 'string' ? { levelId: value.levelId } : {}),
      ...(TABLE_THEME_IDS.includes(value.themeId as TableThemeId) ? { themeId: value.themeId as TableThemeId } : {}),
      ...(value.stakeMultiplier === 1 || value.stakeMultiplier === 2 || value.stakeMultiplier === 3
        ? { stakeMultiplier: value.stakeMultiplier }
        : {}),
      ...(typeof value.itemId === 'string' ? { itemId: value.itemId } : {}),
      ...(typeof value.cosmeticId === 'string' ? { cosmeticId: value.cosmeticId } : {}),
    }];
  }).slice(-100);
}

function normalizeFormalTableStats(stats: unknown): FormalTableStats {
  const defaultStats = DEFAULT_PROGRESS.formalTableStats;
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) {
    return cloneFormalTableStats(defaultStats);
  }

  const value = stats as Partial<FormalTableStats>;
  return {
    wins: normalizeNumber(value.wins, defaultStats.wins),
    losses: normalizeNumber(value.losses, defaultStats.losses),
    battlesPlayed: normalizeNumber(value.battlesPlayed, defaultStats.battlesPlayed),
    winsByTheme: normalizeWinsByTheme(value.winsByTheme),
  };
}

function normalizeWinsByTheme(winsByTheme: unknown): Partial<Record<TableThemeId, number>> {
  if (!winsByTheme || typeof winsByTheme !== 'object' || Array.isArray(winsByTheme)) {
    return {};
  }

  return TABLE_THEME_IDS.reduce<Partial<Record<TableThemeId, number>>>((normalized, themeId) => {
    const wins = normalizeNumber((winsByTheme as Record<string, unknown>)[themeId], 0);
    if (wins > 0) {
      normalized[themeId] = wins;
    }
    return normalized;
  }, {});
}

function normalizeCosmetics(cosmetics: unknown): CosmeticId[] {
  const validCosmetics: CosmeticId[] = ['thunder_hammer', 'jade_sword_array', 'sakura_slash'];
  if (!Array.isArray(cosmetics)) {
    return [];
  }

  return uniqueStrings(cosmetics.filter((item): item is CosmeticId => validCosmetics.includes(item as CosmeticId))) as CosmeticId[];
}

function normalizeUnlockedTableThemeIds(themeIds: unknown): TableThemeId[] {
  const validThemeIds = new Set<string>(TABLE_THEME_IDS);
  const normalized = Array.isArray(themeIds)
    ? themeIds.filter((themeId): themeId is TableThemeId => typeof themeId === 'string' && validThemeIds.has(themeId))
    : [];

  return uniqueStrings(['evernight_tavern', ...normalized]) as TableThemeId[];
}

function normalizeComplimentaryTableEntryThemeIds(themeIds: unknown, unlockedThemeIds: TableThemeId[]): TableThemeId[] {
  if (themeIds === undefined) {
    return unlockedThemeIds.filter((themeId) => themeId !== 'evernight_tavern');
  }

  const unlocked = new Set<TableThemeId>(unlockedThemeIds);
  const validThemeIds = new Set<string>(TABLE_THEME_IDS);
  const normalized = Array.isArray(themeIds)
    ? themeIds.filter((themeId): themeId is TableThemeId => (
      typeof themeId === 'string'
      && themeId !== 'evernight_tavern'
      && validThemeIds.has(themeId)
      && unlocked.has(themeId as TableThemeId)
    ))
    : [];
  return uniqueStrings(normalized) as TableThemeId[];
}

function normalizeEquippedAttackEffect(value: unknown, ownedCosmetics: unknown): CosmeticId | undefined {
  const owned = normalizeCosmetics(ownedCosmetics);
  if (typeof value !== 'string') {
    return undefined;
  }

  return owned.includes(value as CosmeticId) ? value as CosmeticId : undefined;
}

function normalizeItems(items: unknown): Record<string, number> {
  if (!items || typeof items !== 'object' || Array.isArray(items)) {
    return {};
  }

  return Object.entries(items).reduce<Record<string, number>>((normalized, [itemId, count]) => {
    const amount = normalizeNumber(count, 0);
    if (amount > 0) {
      normalized[itemId] = amount;
    }

    return normalized;
  }, {});
}

function normalizeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

function normalizeStoryProgress(story: unknown, defaultValue = DEFAULT_PROGRESS.story): StoryProgress {
  const defaultStory = cloneStoryProgress(defaultValue);
  if (!story || typeof story !== 'object' || Array.isArray(story)) {
    return defaultStory;
  }

  const value = story as Partial<StoryProgress>;
  const unlockedLevelIds = normalizeStringList(value.unlockedLevelIds);
  const completedLevelIds = normalizeStringList(value.completedLevelIds);
  const migratedUnlockedLevelIds = migrateStoryUnlocks(unlockedLevelIds, completedLevelIds);

  return {
    unlockedLevelIds: uniqueStrings([...defaultStory.unlockedLevelIds, ...migratedUnlockedLevelIds]),
    completedLevelIds: uniqueStrings(completedLevelIds),
  };
}

function migrateStoryUnlocks(unlockedLevelIds: string[], completedLevelIds: string[]): string[] {
  const unlocked = new Set(unlockedLevelIds);

  // The removed "Heating Table" used chapter1_5. Players who had reached it
  // should now land on the new fifth level, internally still chapter1_6.
  if (unlocked.has('chapter1_5')) {
    unlocked.add('chapter1_6');
  }

  CHAPTERS.forEach((chapter) => {
    chapter.levels.forEach((level, index) => {
      if (!completedLevelIds.includes(level.id)) {
        return;
      }

      const nextLevel = chapter.levels[index + 1];
      if (nextLevel) {
        unlocked.add(nextLevel.id);
      }
    });
  });

  return [...unlocked];
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueStrings(value.filter((item): item is string => typeof item === 'string' && item.length > 0));
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function cloneProgress(value: GameProgress): GameProgress {
  return {
    soulCoins: value.soulCoins,
    ownedItems: { ...value.ownedItems },
    ownedCosmetics: [...value.ownedCosmetics],
    unlockedTableThemeIds: [...value.unlockedTableThemeIds],
    complimentaryTableEntryThemeIds: [...value.complimentaryTableEntryThemeIds],
    equippedAttackEffect: value.equippedAttackEffect,
    stats: { ...value.stats },
    formalTableStats: cloneFormalTableStats(value.formalTableStats),
    economyStats: cloneEconomyStats(value.economyStats),
    economyTransactions: value.economyTransactions.map((transaction) => ({ ...transaction })),
    story: cloneStoryProgress(value.story),
  };
}

function cloneEconomyStats(value: EconomyStats): EconomyStats {
  return {
    openingBalance: value.openingBalance,
    totalEarned: value.totalEarned,
    totalSpent: value.totalSpent,
    incomeBySource: { ...value.incomeBySource },
    spendingBySink: { ...value.spendingBySink },
  };
}

function cloneFormalTableStats(value: FormalTableStats): FormalTableStats {
  return {
    wins: value.wins,
    losses: value.losses,
    battlesPlayed: value.battlesPlayed,
    winsByTheme: { ...value.winsByTheme },
  };
}

function cloneStoryProgress(value: StoryProgress): StoryProgress {
  return {
    unlockedLevelIds: [...value.unlockedLevelIds],
    completedLevelIds: [...value.completedLevelIds],
  };
}

function defaultProgressForCurrentMode(): GameProgress {
  return getRuntimeMode() === 'test' ? createTestProgress() : cloneProgress(DEFAULT_PROGRESS);
}

function storageKeyForCurrentMode(): string {
  return STORAGE_KEYS[getRuntimeMode()];
}

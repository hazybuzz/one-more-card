export interface BattleStats {
  wins: number;
  losses: number;
  battlesPlayed: number;
}

export interface StoryProgress {
  unlockedLevelIds: string[];
  completedLevelIds: string[];
}

export interface GameProgress {
  soulCoins: number;
  ownedItems: Record<string, number>;
  stats: BattleStats;
  story: StoryProgress;
}

const STORAGE_KEY = 'one-more-card-progress';

const DEFAULT_PROGRESS: GameProgress = {
  soulCoins: 100,
  ownedItems: {
    heal_potion: 2,
  },
  stats: {
    wins: 0,
    losses: 0,
    battlesPlayed: 0,
  },
  story: {
    unlockedLevelIds: ['chapter1_1'],
    completedLevelIds: [],
  },
};

let progress: GameProgress = loadProgress();

export function getProgress(): GameProgress {
  return progress;
}

export function setSoulCoins(amount: number): void {
  progress.soulCoins = Math.max(0, Math.floor(amount));
  saveProgress();
}

export function addSoulCoins(amount: number): void {
  setSoulCoins(progress.soulCoins + amount);
}

export function spendSoulCoins(amount: number): boolean {
  const cost = Math.max(0, Math.floor(amount));
  if (progress.soulCoins < cost) {
    return false;
  }

  setSoulCoins(progress.soulCoins - cost);
  return true;
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

export function recordBattleResult(outcome: 'victory' | 'defeat'): void {
  progress.stats.battlesPlayed += 1;
  if (outcome === 'victory') {
    progress.stats.wins += 1;
  } else {
    progress.stats.losses += 1;
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
  progress = cloneProgress(DEFAULT_PROGRESS);
  saveProgress();
}

function loadProgress(): GameProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return cloneProgress(DEFAULT_PROGRESS);
    }

    const parsed = JSON.parse(raw) as Partial<GameProgress>;
    return normalizeProgress(parsed);
  } catch {
    return cloneProgress(DEFAULT_PROGRESS);
  }
}

function saveProgress(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Saving can fail in private or embedded browser contexts.
  }
}

function normalizeProgress(value: Partial<GameProgress>): GameProgress {
  const defaultProgress = cloneProgress(DEFAULT_PROGRESS);
  return {
    soulCoins: normalizeNumber(value.soulCoins, defaultProgress.soulCoins),
    ownedItems: normalizeItems(value.ownedItems),
    stats: {
      wins: normalizeNumber(value.stats?.wins, defaultProgress.stats.wins),
      losses: normalizeNumber(value.stats?.losses, defaultProgress.stats.losses),
      battlesPlayed: normalizeNumber(value.stats?.battlesPlayed, defaultProgress.stats.battlesPlayed),
    },
    story: normalizeStoryProgress(value.story),
  };
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

function normalizeStoryProgress(story: unknown): StoryProgress {
  const defaultStory = cloneStoryProgress(DEFAULT_PROGRESS.story);
  if (!story || typeof story !== 'object' || Array.isArray(story)) {
    return defaultStory;
  }

  const value = story as Partial<StoryProgress>;
  const unlockedLevelIds = normalizeStringList(value.unlockedLevelIds);
  const completedLevelIds = normalizeStringList(value.completedLevelIds);

  return {
    unlockedLevelIds: uniqueStrings([...defaultStory.unlockedLevelIds, ...unlockedLevelIds]),
    completedLevelIds: uniqueStrings(completedLevelIds),
  };
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
    stats: { ...value.stats },
    story: cloneStoryProgress(value.story),
  };
}

function cloneStoryProgress(value: StoryProgress): StoryProgress {
  return {
    unlockedLevelIds: [...value.unlockedLevelIds],
    completedLevelIds: [...value.completedLevelIds],
  };
}

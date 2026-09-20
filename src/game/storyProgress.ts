import { CHAPTERS } from './data/chapters';
import { completeStoryLevel, isStoryLevelUnlocked, unlockStoryLevel } from './progress';
import type { LevelConfig } from './types/level';

export interface StoryLevelCompletionResult {
  completedLevelId: string;
  nextLevelId?: string;
  unlockedNextLevel: boolean;
}

export function completeStoryLevelAndUnlockNext(levelId: string): StoryLevelCompletionResult {
  completeStoryLevel(levelId);

  const nextLevel = getNextStoryLevel(levelId);
  for (const chapter of CHAPTERS) {
    for (const level of chapter.levels) {
      if (level.optional && level.unlockAfterLevelId === levelId) {
        unlockStoryLevel(level.id);
      }
    }
  }
  if (!nextLevel) {
    return {
      completedLevelId: levelId,
      unlockedNextLevel: false,
    };
  }

  const wasUnlocked = isStoryLevelUnlocked(nextLevel.id);
  unlockStoryLevel(nextLevel.id);

  return {
    completedLevelId: levelId,
    nextLevelId: nextLevel.id,
    unlockedNextLevel: !wasUnlocked,
  };
}

export function getNextStoryLevel(levelId: string): LevelConfig | undefined {
  for (const chapter of CHAPTERS) {
    const requiredLevels = chapter.levels.filter((level) => !level.optional);
    const index = requiredLevels.findIndex((level) => level.id === levelId);
    if (index < 0) {
      continue;
    }

    return requiredLevels[index + 1];
  }

  return undefined;
}

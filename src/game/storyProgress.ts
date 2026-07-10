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
    const index = chapter.levels.findIndex((level) => level.id === levelId);
    if (index < 0) {
      continue;
    }

    return chapter.levels[index + 1];
  }

  return undefined;
}

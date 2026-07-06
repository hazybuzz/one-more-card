import type { LevelConfig } from '../types/level';
import { CHAPTERS } from './chapters';

export const LEVELS: LevelConfig[] = CHAPTERS.flatMap((chapter) => chapter.levels);

export function getLevelById(levelId: string): LevelConfig | undefined {
  return LEVELS.find((level) => level.id === levelId);
}

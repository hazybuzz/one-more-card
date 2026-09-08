import type { IntroStagePreset, IntroStageSlot } from '../../game/data/introSequences';

export interface StoryStageSlotLayout {
  x: number;
  y: number;
  height: number;
  depth: number;
}

export const STORY_STAGE_LAYOUT: Record<IntroStageSlot, StoryStageSlotLayout> = {
  leftRear: { x: 278, y: 400, height: 264, depth: 1 },
  leftMain: { x: 318, y: 410, height: 320, depth: 3 },
  center: { x: 640, y: 394, height: 328, depth: 4 },
  rightMain: { x: 970, y: 410, height: 320, depth: 3 },
  rightRear: { x: 1010, y: 400, height: 264, depth: 1 },
};

const STORY_STAGE_PRESET_LAYOUTS: Partial<
  Record<IntroStagePreset, Partial<Record<IntroStageSlot, StoryStageSlotLayout>>>
> = {
  solo: {
    center: { x: 640, y: 414, height: 350, depth: 4 },
    rightMain: { x: 932, y: 410, height: 334, depth: 4 },
  },
  duo: {
    leftRear: { x: 278, y: 408, height: 252, depth: 1 },
    rightMain: { x: 958, y: 414, height: 326, depth: 4 },
  },
  bossEntrance: {
    leftRear: { x: 260, y: 410, height: 244, depth: 1 },
    rightMain: { x: 928, y: 412, height: 350, depth: 5 },
  },
  fullTable: {
    leftRear: { x: 142, y: 430, height: 216, depth: 1 },
    leftMain: { x: 376, y: 434, height: 248, depth: 3 },
    center: { x: 640, y: 426, height: 268, depth: 5 },
    rightMain: { x: 904, y: 434, height: 248, depth: 3 },
    rightRear: { x: 1138, y: 430, height: 216, depth: 1 },
  },
};

export function resolveStoryStageSlot(
  preset: IntroStagePreset,
  slot: IntroStageSlot,
): StoryStageSlotLayout {
  return STORY_STAGE_PRESET_LAYOUTS[preset]?.[slot] ?? STORY_STAGE_LAYOUT[slot];
}

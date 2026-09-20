import type { EnemyId } from '../types/enemy';

export type IntroStagePreset = 'solo' | 'duo' | 'bossEntrance' | 'fullTable';
export type IntroStageSlot = 'leftRear' | 'leftMain' | 'center' | 'rightMain' | 'rightRear';

export interface IntroCastMember {
  actorId: EnemyId;
  slot: IntroStageSlot;
  scale?: number;
  entrance?: 'automatic' | 'scripted';
}

export type IntroStageAction =
  | { type: 'pushCards' }
  | { type: 'revealActor'; actorId: EnemyId }
  | { type: 'revealActors'; actorIds: EnemyId[]; staggerMs?: number };

export type IntroStep =
  | { type: 'dialogue'; textKey: string; speakerId?: EnemyId; actions?: IntroStageAction[] }
  | { type: 'narration'; textKey: string; actions?: IntroStageAction[] }
  | { type: 'levelTitle'; titleKey: string; subtitleKey?: string; actions?: IntroStageAction[] };

export interface IntroSequenceConfig {
  id: string;
  bgm: { key: string; path: string; volume: number };
  shuffleSfx: { key: string; path: string; volume: number; delayMs: number };
  titleKey: string;
  showTitle?: boolean;
  stagePreset?: IntroStagePreset;
  cast?: IntroCastMember[];
  openingActions?: IntroStageAction[];
  narrationKeys: string[];
  steps: IntroStep[];
}

const bgm = { key: 'chapter1IntroBgm', path: '/audio/chapter1-in-ngm.ogg', volume: 0.52 };
const shuffleSfx = { key: 'cardShuffle', path: '/audio/card-shuffle.ogg', volume: 0.55, delayMs: 520 };

export const INTRO_SEQUENCES: Record<string, IntroSequenceConfig> = {
  chapter1_opening: {
    id: 'chapter1_opening', bgm, shuffleSfx, titleKey: 'intro.chapter1.title', showTitle: true,
    stagePreset: 'duo',
    cast: [
      { actorId: 'bartender', slot: 'leftRear', scale: 0.9 },
      { actorId: 'goblin', slot: 'rightMain', scale: 1.02 },
    ],
    narrationKeys: ['intro.chapter1.line1'],
    steps: [
      { type: 'dialogue', textKey: 'intro.chapter1.bartender1', speakerId: 'bartender' },
      { type: 'narration', textKey: 'intro.chapter1.pushCards', actions: [{ type: 'pushCards' }] },
      { type: 'dialogue', textKey: 'intro.chapter1_2.goblin1', speakerId: 'goblin' },
      { type: 'levelTitle', titleKey: 'level.chapter1_1.title', subtitleKey: 'level.chapter1_1.subtitle' },
    ],
  },
  chapter1_3_opening: {
    id: 'chapter1_3_opening', bgm, shuffleSfx, titleKey: 'intro.chapter1.title', showTitle: false,
    stagePreset: 'duo',
    cast: [{ actorId: 'bartender', slot: 'leftRear', scale: 0.9 }, { actorId: 'gambler', slot: 'rightMain', scale: 1.02 }],
    narrationKeys: ['intro.chapter1_3.scene1'],
    steps: [
      { type: 'dialogue', textKey: 'intro.chapter1_3.gambler1', speakerId: 'gambler' },
      { type: 'dialogue', textKey: 'intro.chapter1_3.bartender1', speakerId: 'bartender' },
      { type: 'levelTitle', titleKey: 'level.chapter1_3.title', subtitleKey: 'level.chapter1_3.subtitle' },
    ],
  },
  chapter1_6_opening: {
    id: 'chapter1_6_opening', bgm, shuffleSfx, titleKey: 'intro.chapter1.title', showTitle: false,
    stagePreset: 'duo',
    cast: [{ actorId: 'bartender', slot: 'leftRear', scale: 0.88 }, { actorId: 'paladin', slot: 'rightMain', scale: 1.02 }],
    narrationKeys: ['intro.chapter1_6.scene1'],
    steps: [
      { type: 'dialogue', textKey: 'intro.chapter1_6.paladin1', speakerId: 'paladin' },
      { type: 'dialogue', textKey: 'intro.chapter1_6.bartender1', speakerId: 'bartender' },
      { type: 'levelTitle', titleKey: 'level.chapter1_6.title', subtitleKey: 'level.chapter1_6.subtitle' },
    ],
  },
  chapter1_7_opening: {
    id: 'chapter1_7_opening', bgm, shuffleSfx, titleKey: 'intro.chapter1.title', showTitle: false,
    stagePreset: 'duo',
    cast: [{ actorId: 'bartender', slot: 'leftRear', scale: 0.88 }, { actorId: 'merchant', slot: 'rightMain', scale: 1.02 }],
    narrationKeys: ['intro.chapter1_7.scene1'],
    steps: [
      { type: 'dialogue', textKey: 'intro.chapter1_7.merchant1', speakerId: 'merchant' },
      { type: 'dialogue', textKey: 'intro.chapter1_7.bartender1', speakerId: 'bartender' },
      { type: 'levelTitle', titleKey: 'level.chapter1_7.title', subtitleKey: 'level.chapter1_7.subtitle' },
    ],
  },
  chapter1_9_opening: {
    id: 'chapter1_9_opening', bgm, shuffleSfx, titleKey: 'intro.chapter1.title', showTitle: false,
    stagePreset: 'fullTable',
    cast: [
      { actorId: 'bartender', slot: 'leftRear', scale: 0.82 },
      { actorId: 'goblin', slot: 'leftMain', scale: 0.9, entrance: 'scripted' },
      { actorId: 'keeper', slot: 'center', scale: 0.92 },
      { actorId: 'werewolf', slot: 'rightMain', scale: 0.88, entrance: 'scripted' },
      { actorId: 'gambler', slot: 'rightRear', scale: 0.82, entrance: 'scripted' },
    ],
    openingActions: [{ type: 'revealActors', actorIds: ['goblin', 'gambler', 'werewolf'], staggerMs: 180 }],
    narrationKeys: ['intro.chapter1_9.scene4'],
    steps: [
      { type: 'dialogue', textKey: 'intro.chapter1_9.bartender1', speakerId: 'bartender' },
      { type: 'dialogue', textKey: 'intro.chapter1_9.keeper1', speakerId: 'keeper' },
      { type: 'levelTitle', titleKey: 'level.chapter1_9.title', subtitleKey: 'level.chapter1_9.subtitle' },
    ],
  },
  chapter1_8_opening: {
    id: 'chapter1_8_opening', bgm, shuffleSfx: { ...shuffleSfx, delayMs: 700 }, titleKey: 'intro.chapter1.title', showTitle: false,
    stagePreset: 'bossEntrance',
    cast: [{ actorId: 'bartender', slot: 'leftRear', scale: 0.88 }, { actorId: 'keeper', slot: 'rightMain', scale: 1.06, entrance: 'scripted' }],
    narrationKeys: ['intro.chapter1_8.scene1', 'intro.chapter1_8.scene6'],
    steps: [
      { type: 'dialogue', textKey: 'intro.chapter1_8.bartender1', speakerId: 'bartender', actions: [{ type: 'revealActor', actorId: 'keeper' }] },
      { type: 'dialogue', textKey: 'intro.chapter1_8.keeper1', speakerId: 'keeper' },
      { type: 'dialogue', textKey: 'intro.chapter1_8.keeper4', speakerId: 'keeper' },
      { type: 'levelTitle', titleKey: 'level.chapter1_8.title', subtitleKey: 'level.chapter1_8.subtitle' },
    ],
  },
};

export function getIntroSequence(introId: string): IntroSequenceConfig | undefined {
  return INTRO_SEQUENCES[introId];
}

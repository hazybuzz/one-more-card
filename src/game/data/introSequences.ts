export type IntroStep =
  | { type: 'dialogue'; textKey: string }
  | { type: 'narration'; textKey: string }
  | { type: 'levelTitle'; titleKey: string; subtitleKey?: string };

export interface IntroSequenceConfig {
  id: string;
  bgm: {
    key: string;
    path: string;
    volume: number;
  };
  shuffleSfx: {
    key: string;
    path: string;
    volume: number;
    delayMs: number;
  };
  titleKey: string;
  showTitle?: boolean;
  narrationKeys: string[];
  steps: IntroStep[];
}

export const INTRO_SEQUENCES: Record<string, IntroSequenceConfig> = {
  chapter1_opening: {
    id: 'chapter1_opening',
    bgm: {
      key: 'chapter1IntroBgm',
      path: '/audio/chapter1-in-ngm.ogg',
      volume: 0.52,
    },
    shuffleSfx: {
      key: 'cardShuffle',
      path: '/audio/card-shuffle.ogg',
      volume: 0.7,
      delayMs: 520,
    },
    titleKey: 'intro.chapter1.title',
    showTitle: true,
    narrationKeys: [
      'intro.chapter1.line1',
      'intro.chapter1.line2',
    ],
    steps: [
      { type: 'dialogue', textKey: 'intro.chapter1.bartender1' },
      { type: 'dialogue', textKey: 'intro.chapter1.bartender2' },
      { type: 'dialogue', textKey: 'intro.chapter1.bartender3' },
      { type: 'dialogue', textKey: 'intro.chapter1.bartender4' },
      { type: 'dialogue', textKey: 'intro.chapter1.bartender5' },
      { type: 'narration', textKey: 'intro.chapter1.pushCards' },
      { type: 'dialogue', textKey: 'intro.chapter1.bartender6' },
      { type: 'dialogue', textKey: 'intro.chapter1.bartender7' },
      { type: 'levelTitle', titleKey: 'level.chapter1_1.title', subtitleKey: 'level.chapter1_1.subtitle' },
    ],
  },
  chapter1_2_opening: {
    id: 'chapter1_2_opening',
    bgm: {
      key: 'chapter1IntroBgm',
      path: '/audio/chapter1-in-ngm.ogg',
      volume: 0.52,
    },
    shuffleSfx: {
      key: 'cardShuffle',
      path: '/audio/card-shuffle.ogg',
      volume: 0.56,
      delayMs: 620,
    },
    titleKey: 'intro.chapter1.title',
    showTitle: false,
    narrationKeys: [
      'intro.chapter1_2.scene1',
      'intro.chapter1_2.scene2',
      'intro.chapter1_2.scene3',
    ],
    steps: [
      { type: 'dialogue', textKey: 'intro.chapter1_2.goblin1' },
      { type: 'dialogue', textKey: 'intro.chapter1_2.goblin2' },
      { type: 'dialogue', textKey: 'intro.chapter1_2.bartender1' },
      { type: 'dialogue', textKey: 'intro.chapter1_2.bartender2' },
      { type: 'levelTitle', titleKey: 'level.chapter1_2.title', subtitleKey: 'level.chapter1_2.subtitle' },
    ],
  },
  chapter1_3_opening: {
    id: 'chapter1_3_opening',
    bgm: {
      key: 'chapter1IntroBgm',
      path: '/audio/chapter1-in-ngm.ogg',
      volume: 0.52,
    },
    shuffleSfx: {
      key: 'cardShuffle',
      path: '/audio/card-shuffle.ogg',
      volume: 0.62,
      delayMs: 520,
    },
    titleKey: 'intro.chapter1.title',
    showTitle: false,
    narrationKeys: [
      'intro.chapter1_3.scene1',
    ],
    steps: [
      { type: 'dialogue', textKey: 'intro.chapter1_3.gambler1' },
      { type: 'dialogue', textKey: 'intro.chapter1_3.gambler2' },
      { type: 'dialogue', textKey: 'intro.chapter1_3.bartender1' },
      { type: 'dialogue', textKey: 'intro.chapter1_3.bartender2' },
      { type: 'levelTitle', titleKey: 'level.chapter1_3.title', subtitleKey: 'level.chapter1_3.subtitle' },
    ],
  },
  chapter1_4_opening: {
    id: 'chapter1_4_opening',
    bgm: {
      key: 'chapter1IntroBgm',
      path: '/audio/chapter1-in-ngm.ogg',
      volume: 0.52,
    },
    shuffleSfx: {
      key: 'cardShuffle',
      path: '/audio/card-shuffle.ogg',
      volume: 0.58,
      delayMs: 620,
    },
    titleKey: 'intro.chapter1.title',
    showTitle: false,
    narrationKeys: [
      'intro.chapter1_4.scene1',
      'intro.chapter1_4.scene2',
      'intro.chapter1_4.scene3',
    ],
    steps: [
      { type: 'dialogue', textKey: 'intro.chapter1_4.werewolf1' },
      { type: 'dialogue', textKey: 'intro.chapter1_4.bartender1' },
      { type: 'dialogue', textKey: 'intro.chapter1_4.bartender2' },
      { type: 'dialogue', textKey: 'intro.chapter1_4.bartender3' },
      { type: 'dialogue', textKey: 'intro.chapter1_4.bartender4' },
      { type: 'levelTitle', titleKey: 'level.chapter1_4.title', subtitleKey: 'level.chapter1_4.subtitle' },
    ],
  },
};

export function getIntroSequence(introId: string): IntroSequenceConfig | undefined {
  return INTRO_SEQUENCES[introId];
}

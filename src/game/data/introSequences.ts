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
};

export function getIntroSequence(introId: string): IntroSequenceConfig | undefined {
  return INTRO_SEQUENCES[introId];
}

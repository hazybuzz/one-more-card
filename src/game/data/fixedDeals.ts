import type { FixedRoundConfig } from '../types/level';

export const FIXED_DEALS: Record<string, FixedRoundConfig[]> = {
  chapter1_1: [
    {
      id: 'chapter1_1_round1',
      playerCards: ['H8', 'C7'],
      enemies: [
        {
          enemyId: 'bartender',
          cards: ['S2', 'DA'],
          visibleCards: ['S2'],
        },
      ],
      availableActions: ['view_hand', 'compare'],
      preferredAction: 'compare',
      lessonKey: 'tutorial.chapter1.pointRule',
      tutorialBeforeCompareKey: 'tutorial.chapter1.compareRule',
      revealSummaryKeys: [
        'tutorial.chapter1.round1.playerMath',
        'tutorial.chapter1.round1.bartenderMath',
        'tutorial.chapter1.round1.result',
      ],
      afterRevealDialogueKeys: [
        'tutorial.chapter1.round1.bartender1',
        'tutorial.chapter1.round1.bartender2',
      ],
    },
    {
      id: 'chapter1_1_round2',
      playerCards: ['SK', 'H9'],
      enemies: [
        {
          enemyId: 'bartender',
          cards: ['C6', 'DQ'],
          visibleCards: ['C6'],
        },
      ],
      availableActions: ['view_hand', 'compare'],
      preferredAction: 'compare',
      lessonKey: 'tutorial.chapter1.zeroCards',
      tutorialBeforeCompareKey: 'tutorial.chapter1.compareRule',
      revealSummaryKeys: [
        'tutorial.chapter1.round2.playerMath',
        'tutorial.chapter1.round2.bartenderMath',
        'tutorial.chapter1.round2.result',
      ],
      afterRevealDialogueKeys: [
        'tutorial.chapter1.round2.bartender1',
        'tutorial.chapter1.round2.bartender2',
      ],
    },
    {
      id: 'chapter1_1_round3',
      playerCards: ['H4', 'S2'],
      enemies: [
        {
          enemyId: 'bartender',
          cards: ['C9', 'DK'],
          visibleCards: ['C9'],
        },
      ],
      availableActions: ['view_hand', 'compare'],
      preferredAction: 'compare',
      lessonKey: 'tutorial.chapter1.lowPointLose',
      tutorialBeforeCompareKey: 'tutorial.chapter1.compareRule',
      revealSummaryKeys: [
        'tutorial.chapter1.round3.playerMath',
        'tutorial.chapter1.round3.bartenderMath',
        'tutorial.chapter1.round3.result',
      ],
      afterRevealDialogueKeys: [
        'tutorial.chapter1.round3.bartender1',
        'tutorial.chapter1.round3.bartender2',
        'tutorial.chapter1.round3.bartender3',
      ],
    },
    {
      id: 'chapter1_1_round4',
      playerCards: ['H10', 'C9'],
      enemies: [
        {
          enemyId: 'bartender',
          cards: ['S5', 'D3'],
          visibleCards: ['S5'],
        },
      ],
      availableActions: ['view_hand', 'compare'],
      preferredAction: 'compare',
      tutorialBeforeCompareKey: 'tutorial.chapter1.compareRule',
      revealSummaryKeys: [
        'tutorial.chapter1.round4.playerMath',
        'tutorial.chapter1.round4.bartenderMath',
        'tutorial.chapter1.round4.result',
      ],
    },
  ],
};

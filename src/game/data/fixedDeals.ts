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
  chapter1_2: [
    {
      id: 'chapter1_2_round1',
      playerCards: ['H3', 'S2'],
      enemies: [
        {
          enemyId: 'goblin',
          cards: ['C5', 'DA'],
          visibleCards: ['C5'],
          scriptedInviteResult: 'reject',
          scriptedInviteReasonKey: 'tutorial.chapter1_2.round1.rejectReason',
          inviteDialogueKeys: [
            'tutorial.chapter1_2.round1.goblinReject1',
            'tutorial.chapter1_2.round1.goblinReject2',
            'tutorial.chapter1_2.round1.bartenderReject1',
          ],
        },
      ],
      availableActions: ['view_hand', 'invite', 'compare', 'reveal'],
      preferredAction: 'invite',
      lessonKey: 'tutorial.chapter1_2.hiddenCardsAndInvite',
      tutorialBeforeCompareKey: 'tutorial.chapter1_2.compareAfterInvite',
      revealSummaryKeys: [
        'tutorial.chapter1_2.round1.playerMath',
        'tutorial.chapter1_2.round1.goblinMath',
        'tutorial.chapter1_2.round1.result',
      ],
      afterRevealDialogueKeys: [
        'tutorial.chapter1_2.round1.bartender1',
        'tutorial.chapter1_2.round1.bartender2',
      ],
    },
    {
      id: 'chapter1_2_round2',
      playerCards: ['H7', 'CK'],
      enemies: [
        {
          enemyId: 'goblin',
          cards: ['D2', 'SA'],
          visibleCards: ['D2'],
          scriptedInviteResult: 'accept',
          scriptedInviteReasonKey: 'tutorial.chapter1_2.round2.acceptReason',
          drawCardOnAccept: 'HQ',
          inviteDialogueKeys: [
            'tutorial.chapter1_2.round2.goblinAccept1',
            'tutorial.chapter1_2.round2.goblinAccept2',
            'tutorial.chapter1_2.round2.bartenderAccept1',
          ],
          compareWithoutInviteDialogueKeys: [
            'tutorial.chapter1_2.round2.skipInviteHint',
          ],
        },
      ],
      availableActions: ['view_hand', 'invite', 'compare', 'reveal'],
      preferredAction: 'invite',
      revealSummaryKeys: [
        'tutorial.chapter1_2.round2.playerMath',
        'tutorial.chapter1_2.round2.goblinMath',
        'tutorial.chapter1_2.round2.result',
      ],
    },
    {
      id: 'chapter1_2_round3',
      playerCards: ['H5', 'H3'],
      enemies: [
        {
          enemyId: 'goblin',
          cards: ['S3', 'CA'],
          visibleCards: ['S3'],
          scriptedInviteResult: 'accept',
          scriptedInviteReasonKey: 'tutorial.chapter1_2.round3.acceptReason',
          drawCardOnAccept: 'D2',
          inviteDialogueKeys: [
            'tutorial.chapter1_2.round3.goblinAccept1',
            'tutorial.chapter1_2.round3.goblinAccept2',
            'tutorial.chapter1_2.round3.bartenderAccept1',
          ],
        },
      ],
      availableActions: ['view_hand', 'invite', 'compare', 'reveal'],
      preferredAction: 'invite',
      revealSummaryKeys: [
        'tutorial.chapter1_2.round3.playerMath',
        'tutorial.chapter1_2.round3.goblinMath',
        'tutorial.chapter1_2.round3.result',
      ],
    },
  ],
  chapter1_3: [
    {
      id: 'chapter1_3_round1',
      playerCards: ['H4', 'CK'],
      playerDrawCards: ['S6'],
      maxPlayerDraws: 1,
      enemies: [
        {
          enemyId: 'gambler',
          cards: ['D3', 'S2'],
          visibleCards: ['D3'],
          scriptedInviteResult: 'accept',
          scriptedInviteReasonKey: 'tutorial.chapter1_3.round1.acceptReason',
          drawCardOnAccept: 'H8',
          inviteDialogueKeys: [
            'tutorial.chapter1_3.round1.gamblerAccept1',
            'tutorial.chapter1_3.round1.gamblerAccept2',
          ],
          compareWithoutInviteDialogueKeys: [
            'tutorial.chapter1_3.round1.skipInviteHint',
          ],
        },
      ],
      availableActions: ['view_hand', 'invite', 'compare', 'player_draw', 'reveal'],
      preferredAction: 'invite',
      revealSummaryKeys: [
        'tutorial.chapter1_3.round1.playerMath',
        'tutorial.chapter1_3.round1.gamblerMath',
        'tutorial.chapter1_3.round1.result',
      ],
    },
    {
      id: 'chapter1_3_round2',
      playerCards: ['S2', 'D3'],
      playerDrawCards: ['H4'],
      maxPlayerDraws: 1,
      enemies: [
        {
          enemyId: 'gambler',
          cards: ['C6', 'HQ'],
          visibleCards: ['C6'],
          scriptedInviteResult: 'accept',
          scriptedInviteReasonKey: 'tutorial.chapter1_3.round2.acceptReason',
          drawCardOnAccept: 'S2',
          inviteDialogueKeys: [
            'tutorial.chapter1_3.round2.gamblerAccept1',
            'tutorial.chapter1_3.round2.gamblerAccept2',
          ],
          compareWithoutInviteDialogueKeys: [
            'tutorial.chapter1_3.round2.skipInviteHint',
          ],
        },
      ],
      availableActions: ['view_hand', 'invite', 'compare', 'player_draw', 'reveal'],
      preferredAction: 'invite',
      revealSummaryKeys: [
        'tutorial.chapter1_3.round2.playerMath',
        'tutorial.chapter1_3.round2.gamblerMath',
        'tutorial.chapter1_3.round2.result',
      ],
    },
    {
      id: 'chapter1_3_round3',
      playerCards: ['S9', 'DK'],
      playerDrawCards: ['H6'],
      maxPlayerDraws: 1,
      enemies: [
        {
          enemyId: 'gambler',
          cards: ['H7', 'CK'],
          visibleCards: ['H7'],
          scriptedInviteResult: 'accept',
          scriptedInviteReasonKey: 'tutorial.chapter1_3.round3.acceptReason',
          drawCardOnAccept: 'S2',
          inviteDialogueKeys: [
            'tutorial.chapter1_3.round3.gamblerAccept1',
            'tutorial.chapter1_3.round3.gamblerAccept2',
          ],
        },
      ],
      availableActions: ['view_hand', 'invite', 'compare', 'player_draw', 'reveal'],
      preferredAction: 'compare',
      revealSummaryKeys: [
        'tutorial.chapter1_3.round3.playerMath',
        'tutorial.chapter1_3.round3.gamblerMath',
        'tutorial.chapter1_3.round3.result',
      ],
    },
    {
      id: 'chapter1_3_round4',
      playerCards: ['H8', 'SQ'],
      playerDrawCards: ['CA'],
      maxPlayerDraws: 1,
      enemies: [
        {
          enemyId: 'gambler',
          cards: ['D4', 'C2'],
          visibleCards: ['D4'],
          scriptedInviteResult: 'accept',
          scriptedInviteReasonKey: 'tutorial.chapter1_3.round4.acceptReason',
          drawCardOnAccept: 'H3',
          inviteDialogueKeys: [
            'tutorial.chapter1_3.round4.gamblerAccept1',
            'tutorial.chapter1_3.round4.gamblerAccept2',
          ],
        },
      ],
      availableActions: ['view_hand', 'invite', 'compare', 'player_draw', 'reveal'],
      preferredAction: 'compare',
      revealSummaryKeys: [
        'tutorial.chapter1_3.round4.playerMath',
        'tutorial.chapter1_3.round4.gamblerMath',
        'tutorial.chapter1_3.round4.result',
      ],
    },
    {
      id: 'chapter1_3_round5',
      playerCards: ['C6', 'DK'],
      playerDrawCards: ['H2'],
      maxPlayerDraws: 1,
      enemies: [
        {
          enemyId: 'gambler',
          cards: ['S5', 'HK'],
          visibleCards: ['S5'],
          scriptedInviteResult: 'accept',
          scriptedInviteReasonKey: 'tutorial.chapter1_3.round5.acceptReason',
          drawCardOnAccept: 'D6',
          inviteDialogueKeys: [
            'tutorial.chapter1_3.round5.gamblerAccept1',
            'tutorial.chapter1_3.round5.gamblerAccept2',
          ],
        },
      ],
      availableActions: ['view_hand', 'invite', 'compare', 'player_draw', 'reveal'],
      preferredAction: 'invite',
      revealSummaryKeys: [
        'tutorial.chapter1_3.round5.playerMath',
        'tutorial.chapter1_3.round5.gamblerMath',
        'tutorial.chapter1_3.round5.result',
      ],
    },
    {
      id: 'chapter1_3_round6',
      playerCards: ['H8', 'CA'],
      playerDrawCards: ['C7'],
      maxPlayerDraws: 1,
      enemies: [
        {
          enemyId: 'gambler',
          cards: ['D6', 'S2'],
          visibleCards: ['D6'],
          scriptedInviteResult: 'accept',
          scriptedInviteReasonKey: 'tutorial.chapter1_3.round6.acceptReason',
          drawCardOnAccept: 'HA',
          inviteDialogueKeys: [
            'tutorial.chapter1_3.round6.gamblerAccept1',
            'tutorial.chapter1_3.round6.gamblerAccept2',
          ],
        },
      ],
      availableActions: ['view_hand', 'invite', 'compare', 'player_draw', 'reveal'],
      preferredAction: 'compare',
      revealSummaryKeys: [
        'tutorial.chapter1_3.round6.playerMath',
        'tutorial.chapter1_3.round6.gamblerMath',
        'tutorial.chapter1_3.round6.result',
      ],
    },
  ],
  chapter1_4: [
    {
      id: 'chapter1_4_round1',
      playerCards: ['H7', 'HK'],
      maxPlayerDraws: 1,
      enemies: [
        {
          enemyId: 'werewolf',
          cards: ['C5', 'DA'],
          visibleCards: ['C5'],
          scriptedInviteResult: 'reject',
          scriptedInviteReasonKey: 'tutorial.chapter1_4.round1.rejectReason',
        },
      ],
      availableActions: ['view_hand', 'invite', 'compare', 'player_draw', 'reveal'],
      preferredAction: 'compare',
      revealSummaryKeys: [
        'tutorial.chapter1_4.round1.result',
      ],
    },
    {
      id: 'chapter1_4_round2',
      playerCards: ['S5', 'DQ'],
      maxPlayerDraws: 1,
      enemies: [
        {
          enemyId: 'werewolf',
          cards: ['C6', 'CA'],
          visibleCards: ['C6'],
          scriptedInviteResult: 'reject',
          scriptedInviteReasonKey: 'tutorial.chapter1_4.round2.rejectReason',
        },
      ],
      availableActions: ['view_hand', 'invite', 'compare', 'player_draw', 'reveal'],
      preferredAction: 'compare',
      revealSummaryKeys: [
        'tutorial.chapter1_4.round2.result',
      ],
    },
    {
      id: 'chapter1_4_round3',
      playerCards: ['H4', 'H5'],
      maxPlayerDraws: 1,
      enemies: [
        {
          enemyId: 'werewolf',
          cards: ['S9', 'DK'],
          visibleCards: ['S9'],
          scriptedInviteResult: 'reject',
          scriptedInviteReasonKey: 'tutorial.chapter1_4.round3.rejectReason',
        },
      ],
      availableActions: ['view_hand', 'invite', 'compare', 'player_draw', 'reveal'],
      preferredAction: 'compare',
      revealSummaryKeys: [
        'tutorial.chapter1_4.round3.result',
      ],
    },
    {
      id: 'chapter1_4_round4',
      playerCards: ['D3', 'D4'],
      playerDrawCards: ['D2'],
      maxPlayerDraws: 1,
      enemies: [
        {
          enemyId: 'werewolf',
          cards: ['S8', 'HQ'],
          visibleCards: ['S8'],
          scriptedInviteResult: 'reject',
          scriptedInviteReasonKey: 'tutorial.chapter1_4.round4.rejectReason',
        },
      ],
      availableActions: ['view_hand', 'invite', 'compare', 'player_draw', 'reveal'],
      preferredAction: 'player_draw',
      revealSummaryKeys: [
        'tutorial.chapter1_4.round4.result',
      ],
    },
  ],
};

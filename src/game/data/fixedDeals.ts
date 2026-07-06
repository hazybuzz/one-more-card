import type { FixedRoundConfig } from '../types/level';

export const FIXED_DEALS: Record<string, FixedRoundConfig[]> = {
  chapter1_1: [
    {
      id: 'chapter1_1_round1',
      playerCards: ['H6', 'S2'],
      enemies: [
        {
          enemyId: 'goblin',
          cards: ['C8', 'DA'],
          visibleCards: ['C8'],
          scriptedInviteResult: 'reject',
        },
      ],
      availableActions: ['view_hand', 'invite', 'compare'],
      preferredAction: 'invite',
      lessonKey: 'tutorial.chapter1.inviteGoblin',
    },
  ],
};

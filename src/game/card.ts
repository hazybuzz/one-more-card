import { t } from './i18n';

export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | '小王' | '大王';

export interface Card {
  suit?: Suit;
  rank: Rank;
}

export const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
export const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function cardValue(card: Card): number {
  if (isJoker(card)) {
    return 0;
  }

  if (card.rank === 'A') {
    return 1;
  }

  if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') {
    return 0;
  }

  return Number(card.rank);
}

export function formatCard(card: Card): string {
  if (isJoker(card)) {
    return card.rank === '小王' ? t('card.smallJoker') : t('card.bigJoker');
  }

  return `${card.suit}${card.rank}`;
}

export function isJoker(card: Card): boolean {
  return card.rank === '小王' || card.rank === '大王';
}

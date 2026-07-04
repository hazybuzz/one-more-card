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

export function cardImageIndex(card: Card): number {
  if (card.rank === '小王') {
    return 53;
  }

  if (card.rank === '大王') {
    return 54;
  }

  const rankOrder: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
  const suitOrder: Suit[] = ['♣', '♠', '♥', '♦'];
  const rankIndex = rankOrder.indexOf(card.rank);
  const suitIndex = card.suit ? suitOrder.indexOf(card.suit) : -1;
  if (rankIndex < 0 || suitIndex < 0) {
    return 53;
  }

  return rankIndex * 4 + suitIndex + 1;
}

export function isJoker(card: Card): boolean {
  return card.rank === '小王' || card.rank === '大王';
}

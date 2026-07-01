import { Card, cardValue, isJoker } from './card';
import { t } from './i18n';

export type ResonanceKind = 'none' | 'resonance' | 'strong';

export interface ScoreResult {
  rawTotal: number;
  point: number;
  resonance: ResonanceKind;
  multiplier: number;
  reason: string;
}

export function scoreHand(cards: Card[]): ScoreResult {
  const rawTotal = cards.reduce((total, card) => total + cardValue(card), 0);
  const sameSuit = hasSameSuitWithJokers(cards);
  const sameRank = cards.length >= 2 && cards.every((card) => !isJoker(card) && card.rank === cards[0].rank);
  const hasResonance = sameSuit || sameRank;

  if (hasResonance && cards.length >= 3) {
    return {
      rawTotal,
      point: rawTotal % 10,
      resonance: 'strong',
      multiplier: 3,
      reason: sameRank ? t('score.reason.sameRank') : t('score.reason.sameSuit'),
    };
  }

  if (hasResonance) {
    return {
      rawTotal,
      point: rawTotal % 10,
      resonance: 'resonance',
      multiplier: 2,
      reason: sameRank ? t('score.reason.sameRank') : t('score.reason.sameSuit'),
    };
  }

  return {
    rawTotal,
    point: rawTotal % 10,
    resonance: 'none',
    multiplier: 1,
    reason: t('score.reason.none'),
  };
}

function hasSameSuitWithJokers(cards: Card[]): boolean {
  if (cards.length < 2) {
    return false;
  }

  const suitedCards = cards.filter((card) => !isJoker(card));
  if (suitedCards.length === 0) {
    return true;
  }

  return suitedCards.every((card) => card.suit === suitedCards[0].suit);
}

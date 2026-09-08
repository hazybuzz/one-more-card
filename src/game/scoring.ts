import { Card, Rank, cardValue, isJoker } from './card';
import { t } from './i18n';

export type ResonanceKind = 'none' | 'resonance' | 'strong' | 'boom';

export type BoomSize = 3 | 4;

export interface ScoreResult {
  rawTotal: number;
  point: number;
  resonance: ResonanceKind;
  multiplier: number;
  reason: string;
  boomSize?: BoomSize;
  boomRank?: Rank;
}

export function scoreHand(cards: Card[]): ScoreResult {
  const rawTotal = cards.reduce((total, card) => total + cardValue(card), 0);
  const sameSuit = hasSameSuitWithJokers(cards);
  const sameRank = cards.length >= 2 && cards.every((card) => !isJoker(card) && card.rank === cards[0].rank);
  const hasResonance = sameSuit || sameRank;

  if (sameRank && (cards.length === 3 || cards.length === 4)) {
    return {
      rawTotal,
      point: rawTotal % 10,
      resonance: 'boom',
      multiplier: cards.length === 4 ? 8 : 4,
      reason: t('score.reason.boom'),
      boomSize: cards.length,
      boomRank: cards[0].rank,
    };
  }

  if (hasResonance && cards.length >= 3) {
    return {
      rawTotal,
      point: rawTotal % 10,
      resonance: 'strong',
      multiplier: cards.length,
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

export function compareScoreResults(first: ScoreResult, second: ScoreResult): number {
  const firstBoom = first.resonance === 'boom';
  const secondBoom = second.resonance === 'boom';
  if (firstBoom || secondBoom) {
    if (firstBoom !== secondBoom) {
      return firstBoom ? 1 : -1;
    }

    const sizeDifference = (first.boomSize ?? 0) - (second.boomSize ?? 0);
    if (sizeDifference !== 0) {
      return sizeDifference;
    }

    return boomRankPower(first.boomRank) - boomRankPower(second.boomRank);
  }

  if (first.point !== second.point) {
    return first.point - second.point;
  }

  return resonancePower(first.resonance) - resonancePower(second.resonance);
}

function boomRankPower(rank?: Rank): number {
  const order: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  return rank ? order.indexOf(rank) : -1;
}

function resonancePower(resonance: ResonanceKind): number {
  if (resonance === 'strong') {
    return 2;
  }

  if (resonance === 'resonance') {
    return 1;
  }

  return 0;
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

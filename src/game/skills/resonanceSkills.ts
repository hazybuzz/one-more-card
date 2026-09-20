import type { Card, Rank, Suit } from '../card';
import { isJoker } from '../card';

export interface ResonanceShiftChoice {
  card: Card;
  targetSuit: Suit;
}

export type ResonanceSummonTarget =
  | { kind: 'rank'; rank: Rank }
  | { kind: 'suit'; suit: Suit };

export function canResonanceShift(cards: Card[]): boolean {
  return chooseResonanceShift(cards) !== undefined;
}

export function chooseResonanceShift(cards: Card[], random: () => number = Math.random): ResonanceShiftChoice | undefined {
  if (cards.length < 2) {
    return undefined;
  }

  const suitGroups = new Map<Suit, Card[]>();
  cards.forEach((card) => {
    if (!card.suit) {
      return;
    }

    const group = suitGroups.get(card.suit) ?? [];
    group.push(card);
    suitGroups.set(card.suit, group);
  });

  if (suitGroups.size <= 1) {
    return undefined;
  }

  const groups = [...suitGroups.entries()];
  if (groups.length > 2) {
    return undefined;
  }

  const counts = groups.map(([, group]) => group.length);
  const allEqual = counts.every((count) => count === counts[0]);

  if (allEqual) {
    if (cards.length !== 2) {
      return undefined;
    }

    const source = randomItem(cards, random);
    const target = randomItem(cards.filter((card) => card !== source && card.suit && card.suit !== source?.suit), random);
    if (!source || !target?.suit) {
      return undefined;
    }

    return { card: source, targetSuit: target.suit };
  }

  const maxCount = Math.max(...counts);
  const minCount = Math.min(...counts);
  if (minCount !== 1) {
    return undefined;
  }

  const majoritySuits = groups.filter(([, group]) => group.length === maxCount).map(([suit]) => suit);
  const minorityCards = groups.filter(([, group]) => group.length === minCount).flatMap(([, group]) => group);
  const card = randomItem(minorityCards, random);
  const targetSuit = randomItem(majoritySuits, random);
  if (!card || !targetSuit || card.suit === targetSuit) {
    return undefined;
  }

  return { card, targetSuit };
}

export function chooseResonanceSummonSuit(cards: Card[], random: () => number = Math.random): Suit | undefined {
  const suitedCards = cards.filter((card) => !isJoker(card) && card.suit);
  if (suitedCards.length === 0) {
    return randomItem(['♠', '♥', '♦', '♣'], random);
  }

  const counts = new Map<Suit, number>();
  suitedCards.forEach((card) => {
    if (!card.suit) {
      return;
    }

    counts.set(card.suit, (counts.get(card.suit) ?? 0) + 1);
  });

  const maxCount = Math.max(...counts.values());
  return randomItem([...counts.entries()].filter(([, count]) => count === maxCount).map(([suit]) => suit), random);
}

export function chooseResonanceSummonTarget(cards: Card[], random: () => number = Math.random): ResonanceSummonTarget | undefined {
  if (cards.length < 2) {
    return undefined;
  }

  const nonJokers = cards.filter((card) => !isJoker(card));
  const sameRank = nonJokers.length === cards.length && cards.every((card) => card.rank === cards[0].rank);
  if (sameRank) {
    return { kind: 'rank', rank: cards[0].rank };
  }

  const suit = chooseResonanceSummonSuit(cards, random);
  return suit ? { kind: 'suit', suit } : undefined;
}

export function isResonanceSummonMatch(card: Card, target: ResonanceSummonTarget): boolean {
  if (isJoker(card)) {
    return false;
  }

  return target.kind === 'rank'
    ? card.rank === target.rank
    : card.suit === target.suit;
}

export function drawResonanceSummonCard(cards: Card[], targetSuit: Suit): Card | undefined {
  const index = cards.findIndex((card) => !isJoker(card) && card.suit === targetSuit);
  if (index < 0) {
    return undefined;
  }

  const [card] = cards.splice(index, 1);
  return card;
}

function randomItem<T>(items: T[], random: () => number = Math.random): T | undefined {
  return items[Math.floor(random() * items.length)];
}

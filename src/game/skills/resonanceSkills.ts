import type { Card, Suit } from '../card';
import { isJoker } from '../card';

export interface ResonanceShiftChoice {
  card: Card;
  targetSuit: Suit;
}

export function canResonanceShift(cards: Card[]): boolean {
  return chooseResonanceShift(cards) !== undefined;
}

export function chooseResonanceShift(cards: Card[]): ResonanceShiftChoice | undefined {
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

    const source = randomItem(cards);
    const target = randomItem(cards.filter((card) => card !== source && card.suit && card.suit !== source?.suit));
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
  const card = randomItem(minorityCards);
  const targetSuit = randomItem(majoritySuits);
  if (!card || !targetSuit || card.suit === targetSuit) {
    return undefined;
  }

  return { card, targetSuit };
}

export function chooseResonanceSummonSuit(cards: Card[]): Suit | undefined {
  const suitedCards = cards.filter((card) => !isJoker(card) && card.suit);
  if (suitedCards.length === 0) {
    return randomItem(['♠', '♥', '♦', '♣']);
  }

  const counts = new Map<Suit, number>();
  suitedCards.forEach((card) => {
    if (!card.suit) {
      return;
    }

    counts.set(card.suit, (counts.get(card.suit) ?? 0) + 1);
  });

  const maxCount = Math.max(...counts.values());
  return randomItem([...counts.entries()].filter(([, count]) => count === maxCount).map(([suit]) => suit));
}

export function drawResonanceSummonCard(cards: Card[], targetSuit: Suit): Card | undefined {
  const index = cards.findIndex((card) => !isJoker(card) && card.suit === targetSuit);
  if (index < 0) {
    return undefined;
  }

  const [card] = cards.splice(index, 1);
  return card;
}

function randomItem<T>(items: T[]): T | undefined {
  return items[Math.floor(Math.random() * items.length)];
}

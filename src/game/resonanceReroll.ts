import { RANKS, isJoker, type Card } from './card';
import { scoreHand } from './scoring';

/** Pick a different reachable point uniformly, then a matching card transformation. */
export function rerollResonancePoint(hand: Card[], random: () => number = Math.random): Card[] | undefined {
  const before = scoreHand(hand);
  if (hand.length < 2 || before.resonance === 'none') return undefined;
  const candidates = new Map<number, Card[][]>();
  const add = (cards: Card[]) => {
    const after = scoreHand(cards);
    if (after.point === before.point || after.resonance !== before.resonance || after.multiplier !== before.multiplier) return;
    const group = candidates.get(after.point) ?? [];
    group.push(cards); candidates.set(after.point, group);
  };
  const sameRank = hand.every(card => !isJoker(card) && card.rank === hand[0].rank);
  if (sameRank) {
    RANKS.forEach(rank => add(hand.map(card => ({ ...card, rank }))));
  } else {
    const normalIndexes = hand.map((card, index) => isJoker(card) ? -1 : index).filter(index => index >= 0);
    // Even an all-joker resonance can be given a new point by materializing one suited card.
    (normalIndexes.length ? normalIndexes : [0]).forEach(index => {
      RANKS.forEach(rank => add(hand.map((card, i) => i === index
        ? { suit: card.suit ?? '♠', rank } : { ...card })));
    });
  }
  const points = [...candidates.keys()];
  if (!points.length) return undefined;
  const group = candidates.get(points[Math.floor(random() * points.length)])!;
  return group[Math.floor(random() * group.length)];
}

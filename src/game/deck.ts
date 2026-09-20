import { Card, RANKS, SUITS } from './card';

export class Deck {
  private cards: Card[];

  constructor(private readonly random: () => number = Math.random, cards?: Card[]) {
    this.cards = cards ? cards.map((card) => ({ ...card })) : this.createDeck();
    if (!cards) this.shuffle();
  }

  draw(): Card {
    const card = this.cards.pop();
    if (!card) {
      throw new Error('Deck is empty');
    }

    return card;
  }

  drawWhere(predicate: (card: Card) => boolean): Card | undefined {
    const index = this.cards.findIndex(predicate);
    if (index < 0) {
      return undefined;
    }

    const [card] = this.cards.splice(index, 1);
    return card;
  }

  getState(): Card[] { return this.cards.map((card) => ({ ...card })); }

  remaining(): number {
    return this.cards.length;
  }

  private createDeck(): Card[] {
    return SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank })));
  }

  private shuffle(): void {
    for (let index = this.cards.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(this.random() * (index + 1));
      [this.cards[index], this.cards[swapIndex]] = [this.cards[swapIndex], this.cards[index]];
    }
  }
}

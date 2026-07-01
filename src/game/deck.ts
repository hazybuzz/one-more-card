import { Card, RANKS, SUITS } from './card';

export class Deck {
  private cards: Card[];

  constructor() {
    this.cards = this.createDeck();
    this.shuffle();
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

  remaining(): number {
    return this.cards.length;
  }

  private createDeck(): Card[] {
    const suitedCards = SUITS.flatMap((suit) => RANKS.filter((rank) => rank !== '小王' && rank !== '大王').map((rank) => ({ suit, rank })));
    return [...suitedCards, { rank: '小王' }, { rank: '大王' }];
  }

  private shuffle(): void {
    for (let index = this.cards.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [this.cards[index], this.cards[swapIndex]] = [this.cards[swapIndex], this.cards[index]];
    }
  }
}

import Phaser from 'phaser';
import { CARD_FRONT_TEXTURE_KEY, RANKS, cardFrameName, type Card, type Rank, type Suit } from './card';

const CARD_SHEET_PATH = '/image/cards/dark-fate-deck/card-fronts-dark-fate.png';
export const CARD_BACK_TEXTURE_KEY = 'card-back';
export const CARD_BACK_PATH = '/image/cards/dark-fate-deck/backs/fate-stone-flat-preview.png';
const CARD_FRAME_WIDTH = 68;
const CARD_FRAME_HEIGHT = 95;
const CARD_SHEET_MARGIN = 2;
const CARD_COLUMN_STEP = 71;
const CARD_ROW_STEP = 97;
const CARD_SHEET_SUITS: Suit[] = ['♦', '♣', '♥', '♠'];
const COURT_RANKS: Rank[] = ['J', 'Q', 'K'];
const COURT_PORTRAIT_VARIANTS: Record<Suit, string> = {
  '♣': 'club-occult',
  '♦': 'diamond-desert',
  '♥': 'heart-eastern',
  '♠': 'spade-northern',
};

export function courtPortraitTextureKey(card: Card): string | undefined {
  if (!card.suit || !COURT_RANKS.includes(card.rank)) {
    return undefined;
  }

  return `court-portrait-${card.rank.toLowerCase()}-${COURT_PORTRAIT_VARIANTS[card.suit]}`;
}

export function preloadCardImages(scene: Phaser.Scene): void {
  if (!scene.textures.exists(CARD_FRONT_TEXTURE_KEY)) {
    scene.load.image(CARD_FRONT_TEXTURE_KEY, CARD_SHEET_PATH);
  }

  preloadCardBack(scene);

  CARD_SHEET_SUITS.forEach((suit) => {
    COURT_RANKS.forEach((rank) => {
      const card: Card = { suit, rank };
      const textureKey = courtPortraitTextureKey(card);
      if (!textureKey || scene.textures.exists(textureKey)) {
        return;
      }

      const variant = COURT_PORTRAIT_VARIANTS[suit];
      scene.load.image(
        textureKey,
        `/image/cards/dark-fate-deck/courts/game-portraits/${rank.toLowerCase()}-${variant}.png`,
      );
    });
  });
}

export function preloadCardBack(scene: Phaser.Scene): void {
  if (!scene.textures.exists(CARD_BACK_TEXTURE_KEY)) {
    scene.load.image(CARD_BACK_TEXTURE_KEY, CARD_BACK_PATH);
  }
}

export function ensureCardFrames(scene: Phaser.Scene): void {
  if (!scene.textures.exists(CARD_FRONT_TEXTURE_KEY)) {
    return;
  }

  const texture = scene.textures.get(CARD_FRONT_TEXTURE_KEY);
  if (texture.has('diamond-A')) {
    return;
  }

  CARD_SHEET_SUITS.forEach((suit, row) => {
    RANKS.forEach((rank, column) => {
      const card: Card = { suit, rank };
      const frameName = cardFrameName(card);
      if (!frameName) {
        return;
      }

      texture.add(
        frameName,
        0,
        CARD_SHEET_MARGIN + column * CARD_COLUMN_STEP,
        CARD_SHEET_MARGIN + row * CARD_ROW_STEP,
        CARD_FRAME_WIDTH,
        CARD_FRAME_HEIGHT,
      );
    });
  });
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

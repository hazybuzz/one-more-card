import Phaser from 'phaser';
import { CARD_FRONT_TEXTURE_KEY, RANKS, cardFrameName, type Card, type Suit } from './card';

const CARD_SHEET_PATH = '/image/cards/pixel_art_poker_cards_-_card_fronts.png';
const CARD_FRAME_WIDTH = 68;
const CARD_FRAME_HEIGHT = 95;
const CARD_SHEET_MARGIN = 2;
const CARD_COLUMN_STEP = 71;
const CARD_ROW_STEP = 97;
const CARD_SHEET_SUITS: Suit[] = ['♦', '♣', '♥', '♠'];

export function preloadCardImages(scene: Phaser.Scene): void {
  if (!scene.textures.exists(CARD_FRONT_TEXTURE_KEY)) {
    scene.load.image(CARD_FRONT_TEXTURE_KEY, CARD_SHEET_PATH);
  }

  if (!scene.textures.exists('card-back')) {
    scene.load.image('card-back', '/image/cards/back.png');
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

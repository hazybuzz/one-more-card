import Phaser from 'phaser';
import { CARD_FONT_FAMILY, GAME_FONT_FAMILY } from '../themes/typography';
import { courtPortraitTextureKey } from '../../game/assets';
import { Card, formatCard } from '../../game/card';

export interface CardViewOptions {
  x: number;
  y: number;
  card?: Card;
  hidden?: boolean;
  width: number;
  showLabel?: boolean;
  label?: string;
  resonant?: boolean;
  boom?: boolean;
  muted?: boolean;
  ambientGlow?: boolean;
}

const CARD_ASPECT_RATIO = 1.4;
const RESONANCE_COLOR = 0xffd86b;
const BOOM_RED = 0xff392b;
const BOOM_GOLD = 0xffc247;
const RED_SUIT_COLOR = '#9f2635';
const BLACK_SUIT_COLOR = '#171b22';
const COURT_PORTRAIT_DISPLAY_SCALE = 0.65025;

interface CourtPortraitLayout {
  scale: number;
  x: number;
  y: number;
}

const DEFAULT_COURT_LAYOUT: CourtPortraitLayout = { scale: 1, x: 0.06, y: 0.08 };
const COURT_PORTRAIT_LAYOUTS: Partial<Record<string, CourtPortraitLayout>> = {
  'J♣': { scale: 1.04, x: 0.06, y: 0.08 },
  'J♦': { scale: 1.07, x: 0.06, y: 0.08 },
  'J♥': { scale: 1.17, x: 0.07, y: 0.07 },
  'J♠': { scale: 1.07, x: 0.06, y: 0.08 },
  'Q♣': { scale: 1.09, x: 0.06, y: 0.07 },
  'Q♦': { scale: 1.07, x: 0.06, y: 0.08 },
  'Q♥': { scale: 1, x: 0.06, y: 0.08 },
  'Q♠': { scale: 1.07, x: 0.06, y: 0.08 },
  'K♣': { scale: 1.09, x: 0.06, y: 0.07 },
  'K♦': { scale: 1.01, x: 0.06, y: 0.08 },
  'K♥': { scale: 1.16, x: 0.06, y: 0.06 },
  'K♠': { scale: 0.92, x: 0.06, y: 0.09 },
};

function courtPortraitLayout(card: Card): CourtPortraitLayout {
  return COURT_PORTRAIT_LAYOUTS[`${card.rank}${card.suit ?? ''}`] ?? DEFAULT_COURT_LAYOUT;
}

function createMinimalCardFace(
  scene: Phaser.Scene,
  card: Card,
  width: number,
  height: number,
): Phaser.GameObjects.Container {
  const face = scene.add.container(0, 0);
  const redSuit = card.suit === '♥' || card.suit === '♦';
  const color = redSuit ? RED_SUIT_COLOR : BLACK_SUIT_COLOR;
  const suitSymbol = card.suit ?? '✦';
  const courtTextureKey = courtPortraitTextureKey(card);
  const borderWidth = Math.max(2, Math.round(width * 0.035));
  const background = scene.add.rectangle(0, 0, width, height, 0xf1eee7, 1)
    .setStrokeStyle(borderWidth, 0x5f5a54, 1);
  face.add(background);

  if (courtTextureKey && scene.textures.exists(courtTextureKey)) {
    const cornerX = -width / 2 + Math.max(6, width * 0.08);
    const cornerY = -height / 2 + Math.max(5, height * 0.045);
    const rank = scene.add.text(cornerX, cornerY, card.rank, {
      fontFamily: CARD_FONT_FAMILY,
      fontSize: `${Math.round(width * 0.39)}px`,
      color,
      fontStyle: 'bold',
    }).setOrigin(0, 0);
    const suit = scene.add.text(cornerX + width * 0.02, cornerY + height * 0.25, suitSymbol, {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: `${Math.round(width * 0.28)}px`,
      color,
      fontStyle: 'bold',
    }).setOrigin(0, 0);
    const portraitLayout = courtPortraitLayout(card);
    const portrait = scene.add.image(
      width * portraitLayout.x,
      height * portraitLayout.y,
      courtTextureKey,
    ).setOrigin(0.5);
    const sourceWidth = portrait.width;
    const sourceHeight = portrait.height;
    const croppedHeight = Math.round(sourceHeight * 0.76);
    const displayHeight = height * 0.7 * portraitLayout.scale * COURT_PORTRAIT_DISPLAY_SCALE;
    const uniformScale = displayHeight / croppedHeight;
    portrait.setCrop(0, 0, sourceWidth, croppedHeight);
    portrait.setScale(uniformScale);
    rank.setResolution(2);
    suit.setResolution(2);
    face.add([portrait, rank, suit]);
    return face;
  }

  const rankSize = card.rank === '10'
    ? Math.round(width * 0.52)
    : Math.round(width * 0.62);
  const rank = scene.add.text(0, -height * 0.21, card.rank, {
    fontFamily: CARD_FONT_FAMILY,
    fontSize: `${rankSize}px`,
    color,
    fontStyle: 'bold',
  }).setOrigin(0.5);
  const suit = scene.add.text(0, height * 0.18, suitSymbol, {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: `${Math.round(width * 0.62)}px`,
    color,
    fontStyle: 'bold',
  }).setOrigin(0.5);
  rank.setResolution(2);
  suit.setResolution(2);
  face.add([rank, suit]);
  return face;
}

export function createCardView(scene: Phaser.Scene, options: CardViewOptions): Phaser.GameObjects.Container {
  const hidden = options.hidden || !options.card;
  const height = Math.round(options.width * CARD_ASPECT_RATIO);
  const container = scene.add.container(options.x, options.y);
  const visibleCard = hidden ? undefined : options.card;
  const cardFace = visibleCard
    ? createMinimalCardFace(scene, visibleCard, options.width, height)
    : scene.add.image(0, 0, 'card-back').setOrigin(0.5).setDisplaySize(options.width, height);
  cardFace.setAlpha(options.muted ? 0.45 : 1);
  if (options.ambientGlow) {
    const mutedAlpha = options.muted ? 0.35 : 1;
    const softShadow = scene.add.rectangle(4, 7, options.width + 8, height + 8, 0x000000, 0.16 * mutedAlpha);
    const contactShadow = scene.add.rectangle(2, 4, options.width + 2, height + 2, 0x000000, 0.34 * mutedAlpha);
    container.add([softShadow, contactShadow]);
  }
  container.add(cardFace);

  if ((options.resonant || options.boom) && !hidden) {
    const accent = options.boom ? BOOM_RED : RESONANCE_COLOR;
    const innerAccent = options.boom ? BOOM_GOLD : 0xffffff;
    const aura = scene.add.rectangle(0, 0, options.width + 18, height + 18, accent, options.boom ? 0.26 : 0.18)
      .setStrokeStyle(10, accent, options.boom ? 0.34 : 0.2);
    const glow = scene.add.rectangle(0, 0, options.width + 10, height + 10, 0x000000, 0)
      .setStrokeStyle(options.boom ? 6 : 5, accent, 1);
    const inner = scene.add.rectangle(0, 0, options.width + 2, height + 2, 0x000000, 0)
      .setStrokeStyle(2, innerAccent, options.boom ? 0.95 : 0.55);
    if (options.muted) {
      aura.setAlpha(0.28);
      glow.setAlpha(0.34);
      inner.setAlpha(0.24);
    }
    container.addAt(aura, 0);
    container.addAt(glow, 1);
    container.addAt(inner, 2);
  }

  if (options.showLabel && visibleCard) {
    const label = options.label ?? formatCard(visibleCard);
    const text = scene.add.text(0, height / 2 + 13, label, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '13px',
      color: options.boom ? '#ffb63f' : options.resonant ? '#ffd86b' : '#aeb4c0',
      fontStyle: options.resonant || options.boom ? 'bold' : 'normal',
    }).setOrigin(0.5);

    if (options.resonant || options.boom) {
      text.setShadow(0, 0, options.boom ? '#ff392b' : '#ffd86b', options.boom ? 14 : 10, true, true);
    }

    container.add(text);
  }

  return container;
}

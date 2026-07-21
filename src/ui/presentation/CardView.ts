import Phaser from 'phaser';
import { Card, cardImageIndex, formatCard } from '../../game/card';

export interface CardViewOptions {
  x: number;
  y: number;
  card?: Card;
  hidden?: boolean;
  width: number;
  showLabel?: boolean;
  label?: string;
  resonant?: boolean;
  muted?: boolean;
}

const CARD_ASPECT_RATIO = 1.4;
const RESONANCE_COLOR = 0xffd86b;

export function createCardView(scene: Phaser.Scene, options: CardViewOptions): Phaser.GameObjects.Container {
  const hidden = options.hidden || !options.card;
  const height = Math.round(options.width * CARD_ASPECT_RATIO);
  const container = scene.add.container(options.x, options.y);
  const visibleCard = hidden ? undefined : options.card;
  const texture = visibleCard ? `card-${cardImageIndex(visibleCard)}` : 'card-back';
  const image = scene.add.image(0, 0, texture).setOrigin(0.5);
  image.setDisplaySize(options.width, height);
  if (options.muted) {
    image.setAlpha(0.45);
  }
  container.add(image);

  if (options.resonant && !hidden) {
    const aura = scene.add.rectangle(0, 0, options.width + 18, height + 18, RESONANCE_COLOR, 0.18)
      .setStrokeStyle(10, RESONANCE_COLOR, 0.2);
    const glow = scene.add.rectangle(0, 0, options.width + 10, height + 10, 0x000000, 0)
      .setStrokeStyle(5, RESONANCE_COLOR, 1);
    const inner = scene.add.rectangle(0, 0, options.width + 2, height + 2, 0x000000, 0)
      .setStrokeStyle(2, 0xffffff, 0.55);
    if (options.muted) {
      aura.setAlpha(0.28);
      glow.setAlpha(0.34);
      inner.setAlpha(0.24);
    }
    container.addAt(aura, 0);
    container.addAt(glow, 1);
    container.addAt(inner, 2);
  }

  if (hidden) {
    container.add(scene.add.text(0, 0, '?', {
      fontFamily: 'Arial',
      fontSize: `${Math.round(options.width * 0.36)}px`,
      color: '#f2f2ed',
      fontStyle: 'bold',
    }).setOrigin(0.5));
  }

  if (options.showLabel && visibleCard) {
    const label = options.label ?? formatCard(visibleCard);
    const text = scene.add.text(0, height / 2 + 13, label, {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: options.resonant ? '#ffd86b' : '#aeb4c0',
      fontStyle: options.resonant ? 'bold' : 'normal',
    }).setOrigin(0.5);

    if (options.resonant) {
      text.setShadow(0, 0, '#ffd86b', 10, true, true);
    }

    container.add(text);
  }

  return container;
}

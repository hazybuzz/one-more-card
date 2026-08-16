import Phaser from 'phaser';
import { ensureCardFrames } from '../../game/assets';
import { CARD_FRONT_TEXTURE_KEY, Card, cardFrameName, formatCard } from '../../game/card';

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
  ambientGlow?: boolean;
}

const CARD_ASPECT_RATIO = 1.4;
const RESONANCE_COLOR = 0xffd86b;

export function createCardView(scene: Phaser.Scene, options: CardViewOptions): Phaser.GameObjects.Container {
  const hidden = options.hidden || !options.card;
  const height = Math.round(options.width * CARD_ASPECT_RATIO);
  const container = scene.add.container(options.x, options.y);
  const visibleCard = hidden ? undefined : options.card;
  if (visibleCard) {
    ensureCardFrames(scene);
  }
  const frame = visibleCard ? cardFrameName(visibleCard) : undefined;
  const texture = frame ? CARD_FRONT_TEXTURE_KEY : 'card-back';
  const image = scene.add.image(0, 0, texture, frame).setOrigin(0.5);
  image.setDisplaySize(options.width, height);
  if (options.muted) {
    image.setAlpha(0.45);
  }
  if (options.ambientGlow) {
    const glowColor = options.resonant && !hidden ? RESONANCE_COLOR : 0x8ba4c7;
    const mutedAlpha = options.muted ? 0.35 : 1;
    const outerGlow = scene.add.rectangle(0, 0, options.width + 10, height + 10, glowColor, 0.04)
      .setStrokeStyle(7, glowColor, 0.12);
    const edgeGlow = scene.add.rectangle(0, 0, options.width + 3, height + 3, 0x000000, 0)
      .setStrokeStyle(2, glowColor, 0.24);
    container.add([outerGlow, edgeGlow]);

    const rankSeed = options.card?.rank
      ? Array.from(options.card.rank).reduce((total, character) => total + character.charCodeAt(0), 0)
      : 0;
    const phaseOffset = options.x * 19 + options.y * 7 + rankSeed * 113;
    const updateGlow = (): void => {
      const pulse = 0.5 + Math.sin((scene.time.now + phaseOffset) / 680) * 0.5;
      outerGlow.setAlpha((0.22 + pulse * 0.38) * mutedAlpha);
      edgeGlow.setAlpha((0.34 + pulse * 0.42) * mutedAlpha);
      outerGlow.setScale(0.985 + pulse * 0.035);
    };
    scene.events.on(Phaser.Scenes.Events.UPDATE, updateGlow);
    updateGlow();
    container.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.UPDATE, updateGlow);
    });
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

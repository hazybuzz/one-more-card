import Phaser from 'phaser';
import { t } from '../../../game/i18n';
import { GAME_FONT_FAMILY } from '../../themes/typography';
import type { PassiveVfxContext } from './PassiveVfxDirector';
import { playBrokenRing, playPixelBurst } from './PixelVfxPrimitives';

const COLORS = {
  deep: 0x120408,
  blackRed: 0x26070d,
  wine: 0x5b0d1c,
  crimson: 0xb51b38,
  scarlet: 0xed4960,
  ivory: 0xe7c8aa,
} as const;

const TOTAL_DURATION = 2240;

export function playGamblerBlessingVfx(context: PassiveVfxContext): void {
  const { scene, anchors, event } = context;
  const source = anchors.source;
  const labelPosition = anchors.sourceLabel ?? new Phaser.Math.Vector2(source.x, source.y - 108);
  const hand = anchors.sourceHand ?? new Phaser.Math.Vector2(source.x, source.y + 94);
  const camera = scene.cameras.main;
  const shade = scene.add.rectangle(
    camera.centerX,
    camera.centerY,
    camera.width,
    camera.height,
    COLORS.deep,
    0,
  ).setDepth(37);
  const label = scene.add.text(labelPosition.x, labelPosition.y, t('battle.passive.gamblerBlessing'), {
    fontFamily: GAME_FONT_FAMILY,
    fontSize: '23px',
    color: '#ed4960',
    fontStyle: 'bold',
    stroke: '#120408',
    strokeThickness: 6,
  }).setOrigin(0.5).setDepth(46).setAlpha(0);
  label.setShadow(0, 0, '#b51b38', 16, true, true);

  const cardCount = Math.max(1, event.amount ?? 2);
  const oldCards = createDoomedCards(scene, hand, cardCount);

  scene.sound.play('cardPlace', { volume: 0.5, rate: 0.86 });
  scene.tweens.add({
    targets: shade,
    alpha: 0.24,
    duration: 240,
    ease: 'Sine.easeOut',
  });
  scene.tweens.add({
    targets: label,
    alpha: 1,
    y: label.y - 5,
    duration: 220,
    ease: 'Back.easeOut',
  });

  playBrokenRing(scene, {
    x: source.x,
    y: source.y,
    radius: 82,
    color: COLORS.wine,
    highlightColor: COLORS.scarlet,
    segments: 18,
    segmentWidth: 10,
    segmentHeight: 3,
    duration: 980,
    depth: 40,
  });
  playBrokenRing(scene, {
    x: source.x,
    y: source.y,
    radius: 61,
    color: COLORS.blackRed,
    highlightColor: COLORS.crimson,
    segments: 12,
    segmentWidth: 7,
    segmentHeight: 3,
    duration: 1120,
    depth: 39,
    clockwise: false,
  });

  scene.time.delayedCall(360, () => {
    scene.sound.play('attackFire', { volume: 0.34, rate: 0.8 });
    oldCards.forEach((card, index) => {
      scene.time.delayedCall(index * 80, () => burnCard(scene, card, index));
    });
  });

  scene.time.delayedCall(1120, () => {
    const fateCard = createFateCard(scene, hand.x, hand.y - 8);
    scene.sound.play('cardPlace', { volume: 0.55, rate: 1.08 });
    scene.tweens.add({
      targets: fateCard,
      alpha: 1,
      scaleX: { from: 0.08, to: 1 },
      scaleY: { from: 0.88, to: 1.08 },
      angle: { from: -10, to: 4 },
      duration: 170,
      yoyo: true,
      repeat: 2,
      hold: 35,
      ease: 'Cubic.easeInOut',
      onComplete: () => {
        fateCard.setScale(1);
        fateCard.setAngle(0);
        playPixelBurst(scene, {
          x: hand.x,
          y: hand.y - 8,
          colors: [COLORS.wine, COLORS.crimson, COLORS.scarlet, COLORS.ivory],
          count: 16,
          minDistance: 26,
          maxDistance: 92,
          pixelSize: 3,
          duration: 620,
          depth: 46,
        });
        scene.tweens.add({
          targets: fateCard,
          alpha: 0,
          scale: 1.32,
          duration: 320,
          ease: 'Cubic.easeOut',
          onComplete: () => fateCard.destroy(true),
        });
      },
    });
  });

  scene.time.delayedCall(1820, () => {
    scene.tweens.add({
      targets: [shade, label],
      alpha: 0,
      duration: 340,
      ease: 'Sine.easeIn',
    });
  });
  scene.time.delayedCall(TOTAL_DURATION, () => {
    shade.destroy();
    label.destroy();
    oldCards.forEach((card) => card.destroy(true));
    context.onComplete();
  });
}

function createDoomedCards(
  scene: Phaser.Scene,
  hand: Phaser.Math.Vector2,
  count: number,
): Phaser.GameObjects.Container[] {
  const spacing = 34;
  return Array.from({ length: count }, (_, index) => {
    const offset = (index - (count - 1) / 2) * spacing;
    const card = scene.add.container(hand.x + offset, hand.y).setDepth(42).setAlpha(0);
    const shadow = scene.add.rectangle(2, 3, 42, 62, COLORS.deep, 0.64);
    const body = scene.add.rectangle(0, 0, 40, 60, COLORS.blackRed, 0.98)
      .setStrokeStyle(3, COLORS.crimson, 0.92);
    const mark = scene.add.rectangle(0, 0, 13, 13, COLORS.scarlet, 0.88).setAngle(45);
    const cut = scene.add.rectangle(0, 0, 4, 20, COLORS.deep, 0.95).setAngle(45);
    card.add([shadow, body, mark, cut]);
    card.setAngle((index - (count - 1) / 2) * 7);
    scene.tweens.add({
      targets: card,
      alpha: 1,
      y: hand.y - 4,
      duration: 220,
      delay: index * 45,
      ease: 'Back.easeOut',
    });
    return card;
  });
}

function burnCard(scene: Phaser.Scene, card: Phaser.GameObjects.Container, index: number): void {
  if (!card.active) {
    return;
  }
  const origin = new Phaser.Math.Vector2(card.x, card.y);
  for (let flameIndex = 0; flameIndex < 9; flameIndex += 1) {
    const color = [COLORS.blackRed, COLORS.wine, COLORS.crimson, COLORS.scarlet][flameIndex % 4];
    const flame = scene.add.rectangle(
      origin.x + Phaser.Math.Between(-18, 18),
      origin.y + Phaser.Math.Between(-24, 22),
      Phaser.Math.Between(3, 7),
      Phaser.Math.Between(6, 12),
      color,
      0.94,
    ).setDepth(44);
    scene.tweens.add({
      targets: flame,
      y: flame.y - Phaser.Math.Between(34, 68),
      x: flame.x + Phaser.Math.Between(-12, 12),
      alpha: 0,
      scaleY: 1.6,
      duration: 420 + flameIndex * 24,
      delay: flameIndex * 28,
      ease: 'Cubic.easeOut',
      onComplete: () => flame.destroy(),
    });
  }
  scene.tweens.add({
    targets: card,
    alpha: 0,
    y: card.y - 24,
    scaleX: 0.72,
    scaleY: 0.42,
    angle: card.angle + (index % 2 === 0 ? -18 : 18),
    duration: 620,
    ease: 'Cubic.easeIn',
    onComplete: () => card.destroy(true),
  });
  playPixelBurst(scene, {
    x: origin.x,
    y: origin.y,
    colors: [COLORS.deep, COLORS.blackRed, COLORS.wine, COLORS.ivory],
    count: 9,
    minDistance: 18,
    maxDistance: 66,
    pixelSize: 3,
    duration: 720,
    depth: 43,
  });
}

function createFateCard(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const card = scene.add.container(x, y).setDepth(45).setAlpha(0);
  const glow = scene.add.rectangle(0, 0, 58, 78, COLORS.crimson, 0.18)
    .setStrokeStyle(4, COLORS.scarlet, 0.52)
    .setBlendMode(Phaser.BlendModes.ADD);
  const body = scene.add.rectangle(0, 0, 46, 66, COLORS.wine, 1)
    .setStrokeStyle(3, COLORS.ivory, 0.96);
  const outerMark = scene.add.rectangle(0, 0, 23, 23, COLORS.crimson, 0.9).setAngle(45);
  const innerMark = scene.add.rectangle(0, 0, 9, 9, COLORS.ivory, 1).setAngle(45);
  card.add([glow, body, outerMark, innerMark]);
  return card;
}

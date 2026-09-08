import Phaser from 'phaser';
import { GAME_FONT_FAMILY } from '../themes/typography';

export interface SoulRedeemVfxOptions {
  center: Phaser.Math.Vector2;
  iconTextureKey: string;
  title: string;
  healAmount: number;
  onRevive: () => void;
  onComplete: () => void;
}

const COLORS = {
  shade: 0x07101b,
  ivory: 0xfff4c8,
  gold: 0xf2cc74,
  paleGold: 0xffe9a8,
  soul: 0xdff4ff,
  blue: 0x8fc8e8,
  green: '#8ef0a4',
} as const;

export function playSoulRedeemVfx(scene: Phaser.Scene, options: SoulRedeemVfxOptions): void {
  const { center } = options;
  const camera = scene.cameras.main;
  const blocker = scene.add.rectangle(
    camera.centerX,
    camera.centerY,
    camera.width,
    camera.height,
    COLORS.shade,
    0,
  ).setDepth(68).setInteractive();
  const lightColumn = scene.add.rectangle(center.x, center.y - 52, 90, 270, COLORS.paleGold, 0)
    .setDepth(69)
    .setBlendMode(Phaser.BlendModes.ADD);
  const angel = scene.add.container(center.x, center.y + 12).setDepth(73).setAlpha(0).setScale(0.38);
  const haloOuter = scene.add.circle(0, 0, 55, COLORS.gold, 0.08)
    .setStrokeStyle(4, COLORS.paleGold, 0.82)
    .setBlendMode(Phaser.BlendModes.ADD);
  const haloInner = scene.add.circle(0, 0, 40, COLORS.soul, 0.1)
    .setStrokeStyle(2, COLORS.soul, 0.76)
    .setBlendMode(Phaser.BlendModes.ADD);
  const runeRing = createBrokenRuneRing(scene, 48);
  const wings = createLightWings(scene);
  const icon = scene.add.image(0, 0, options.iconTextureKey).setDisplaySize(76, 76);
  angel.add([haloOuter, haloInner, runeRing, wings, icon]);

  const title = scene.add.text(center.x, center.y - 154, options.title, {
    fontFamily: GAME_FONT_FAMILY,
    fontSize: '30px',
    color: '#f2cc74',
    fontStyle: 'bold',
    stroke: '#2c1d08',
    strokeThickness: 5,
  }).setOrigin(0.5).setDepth(74).setAlpha(0);
  title.setShadow(0, 0, '#ffe9a8', 18, true, true);

  scene.sound.play('resonanceEcho', { volume: 0.46, rate: 0.86 });
  playSoulParticles(scene, center.x, center.y + 12, 12, COLORS.gold, 70);
  scene.tweens.add({
    targets: blocker,
    alpha: 0.28,
    duration: 260,
    ease: 'Sine.easeOut',
  });
  scene.tweens.add({
    targets: lightColumn,
    alpha: 0.16,
    scaleX: { from: 0.35, to: 1 },
    duration: 420,
    ease: 'Sine.easeOut',
  });
  scene.tweens.add({
    targets: angel,
    y: center.y - 102,
    alpha: 1,
    scale: 1,
    duration: 680,
    ease: 'Cubic.easeOut',
    onComplete: () => {
      playSoulParticles(scene, angel.x, angel.y, 10, COLORS.soul, 74);
      scene.tweens.add({
        targets: title,
        alpha: 1,
        y: title.y - 5,
        duration: 240,
        ease: 'Back.easeOut',
      });
      scene.tweens.add({
        targets: angel,
        angle: 7,
        duration: 520,
        yoyo: true,
        ease: 'Sine.easeInOut',
      });
      scene.time.delayedCall(360, () => descendSoul(scene, options, {
        blocker,
        lightColumn,
        angel,
        title,
      }));
    },
  });
  scene.tweens.add({
    targets: runeRing,
    angle: 32,
    duration: 1900,
    ease: 'Sine.easeInOut',
  });
}

function descendSoul(
  scene: Phaser.Scene,
  options: SoulRedeemVfxOptions,
  objects: {
    blocker: Phaser.GameObjects.Rectangle;
    lightColumn: Phaser.GameObjects.Rectangle;
    angel: Phaser.GameObjects.Container;
    title: Phaser.GameObjects.Text;
  },
): void {
  const { center } = options;
  scene.tweens.add({
    targets: objects.angel,
    y: center.y,
    scale: 0.7,
    angle: 0,
    duration: 460,
    ease: 'Cubic.easeIn',
    onComplete: () => {
      options.onRevive();
      scene.sound.play('healSound', { volume: 0.58 });
      playReviveImpact(scene, center, options.healAmount);
      objects.angel.setAlpha(0);
      scene.time.delayedCall(90, () => {
        scene.tweens.add({
          targets: [objects.blocker, objects.lightColumn, objects.title],
          alpha: 0,
          duration: 580,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            objects.blocker.destroy();
            objects.lightColumn.destroy();
            objects.angel.destroy(true);
            objects.title.destroy();
            options.onComplete();
          },
        });
      });
    },
  });
}

function createBrokenRuneRing(scene: Phaser.Scene, radius: number): Phaser.GameObjects.Container {
  const ring = scene.add.container();
  for (let index = 0; index < 16; index += 1) {
    if (index % 5 === 2) {
      continue;
    }
    const angle = (index / 16) * Math.PI * 2;
    const mark = scene.add.rectangle(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      index % 4 === 0 ? 8 : 5,
      2,
      index % 4 === 0 ? COLORS.ivory : COLORS.gold,
      index % 3 === 0 ? 0.92 : 0.66,
    ).setRotation(angle + Math.PI / 2);
    ring.add(mark);
  }
  return ring;
}

function createLightWings(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const wings = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  wings.lineStyle(8, COLORS.gold, 0.12);
  drawWingPaths(wings);
  wings.lineStyle(3, COLORS.soul, 0.58);
  drawWingPaths(wings);
  return wings;
}

function drawWingPaths(graphics: Phaser.GameObjects.Graphics): void {
  graphics.beginPath();
  graphics.moveTo(-24, 4);
  graphics.lineTo(-48, -12);
  graphics.lineTo(-70, -4);
  graphics.lineTo(-52, 12);
  graphics.lineTo(-72, 22);
  graphics.lineTo(-40, 28);
  graphics.strokePath();
  graphics.beginPath();
  graphics.moveTo(24, 4);
  graphics.lineTo(48, -12);
  graphics.lineTo(70, -4);
  graphics.lineTo(52, 12);
  graphics.lineTo(72, 22);
  graphics.lineTo(40, 28);
  graphics.strokePath();
}

function playReviveImpact(scene: Phaser.Scene, center: Phaser.Math.Vector2, amount: number): void {
  const outer = scene.add.circle(center.x, center.y, 28, COLORS.gold, 0.22)
    .setDepth(73)
    .setStrokeStyle(5, COLORS.ivory, 0.96)
    .setBlendMode(Phaser.BlendModes.ADD);
  const inner = scene.add.circle(center.x, center.y, 15, COLORS.soul, 0.48)
    .setDepth(74)
    .setBlendMode(Phaser.BlendModes.ADD);
  const text = scene.add.text(center.x, center.y - 82, `HP +${amount}`, {
    fontFamily: GAME_FONT_FAMILY,
    fontSize: '30px',
    color: COLORS.green,
    fontStyle: 'bold',
    stroke: '#102014',
    strokeThickness: 5,
  }).setOrigin(0.5).setDepth(75);
  text.setShadow(0, 0, COLORS.green, 14, true, true);
  playSoulParticles(scene, center.x, center.y, 18, COLORS.paleGold, 74);
  scene.tweens.add({
    targets: [outer, inner],
    scale: 3.2,
    alpha: 0,
    duration: 680,
    ease: 'Cubic.easeOut',
    onComplete: () => {
      outer.destroy();
      inner.destroy();
    },
  });
  scene.tweens.add({
    targets: text,
    y: text.y - 42,
    alpha: 0,
    delay: 160,
    duration: 760,
    ease: 'Cubic.easeOut',
    onComplete: () => text.destroy(),
  });
}

function playSoulParticles(
  scene: Phaser.Scene,
  x: number,
  y: number,
  count: number,
  color: number,
  depth: number,
): void {
  for (let index = 0; index < count; index += 1) {
    const spark = scene.add.rectangle(
      x + Phaser.Math.Between(-28, 28),
      y + Phaser.Math.Between(-18, 18),
      Phaser.Math.Between(3, 6),
      Phaser.Math.Between(3, 6),
      color,
      0.9,
    ).setDepth(depth).setAngle(45);
    scene.tweens.add({
      targets: spark,
      x: spark.x + Phaser.Math.Between(-58, 58),
      y: spark.y - Phaser.Math.Between(38, 92),
      scale: 0.25,
      alpha: 0,
      duration: Phaser.Math.Between(520, 820),
      ease: 'Sine.easeOut',
      onComplete: () => spark.destroy(),
    });
  }
}

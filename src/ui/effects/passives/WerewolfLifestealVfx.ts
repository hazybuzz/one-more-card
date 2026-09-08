import Phaser from 'phaser';
import { t } from '../../../game/i18n';
import { GAME_FONT_FAMILY } from '../../themes/typography';
import type { PassiveVfxContext } from './PassiveVfxDirector';
import { playPixelArcTransfer, playPixelBurst } from './PixelVfxPrimitives';

const COLORS = {
  deep: 0x100307,
  blackBlood: 0x25050a,
  blood: 0x700d1d,
  crimson: 0xb51f35,
  bright: 0xef5c62,
  moon: 0xd7b9ad,
} as const;

export function playWerewolfLifestealVfx(context: PassiveVfxContext): void {
  const { scene, anchors, event } = context;
  const source = anchors.source;
  const labelPosition = anchors.sourceLabel ?? new Phaser.Math.Vector2(source.x, source.y - 108);
  const player = anchors.player;
  const amount = Math.max(1, event.amount ?? 1);
  const camera = scene.cameras.main;
  const shade = scene.add.rectangle(
    camera.centerX,
    camera.centerY,
    camera.width,
    camera.height,
    COLORS.deep,
    0,
  ).setDepth(37);
  const crescent = createBloodMoonCrescent(scene, source.x, source.y);
  const label = scene.add.text(labelPosition.x, labelPosition.y, t('battle.passive.werewolfLifesteal'), {
    fontFamily: GAME_FONT_FAMILY,
    fontSize: '23px',
    color: '#ef7d78',
    fontStyle: 'bold',
    stroke: '#100307',
    strokeThickness: 6,
  }).setOrigin(0.5).setDepth(46).setAlpha(0);
  label.setShadow(0, 0, '#b51f35', 16, true, true);

  scene.sound.play('attackWind', { volume: 0.28, rate: 0.72 });
  scene.tweens.add({
    targets: shade,
    alpha: 0.2,
    duration: 220,
    ease: 'Sine.easeOut',
  });
  scene.tweens.add({
    targets: [crescent, label],
    alpha: 1,
    duration: 240,
    ease: 'Sine.easeOut',
  });
  playPixelBurst(scene, {
    x: player.x,
    y: player.y,
    colors: [COLORS.blackBlood, COLORS.blood, COLORS.crimson],
    count: 12,
    minDistance: 14,
    maxDistance: 56,
    pixelSize: 3,
    duration: 520,
    depth: 42,
  });

  scene.time.delayedCall(220, () => {
    playPixelArcTransfer(scene, {
      from: player,
      to: source,
      colors: [COLORS.blackBlood, COLORS.blood, COLORS.crimson, COLORS.bright],
      count: 12 + Math.min(6, amount * 2),
      arcHeight: 84,
      pixelSize: 4,
      duration: 720,
      stagger: 42,
      depth: 44,
      onComplete: () => {
        context.feedback?.showEnemyHeal?.(event.sourceEnemyIndex, amount);
        playPixelBurst(scene, {
          x: source.x,
          y: source.y,
          colors: [COLORS.blood, COLORS.crimson, COLORS.bright, COLORS.moon],
          count: 18,
          minDistance: 20,
          maxDistance: 84,
          pixelSize: 4,
          duration: 680,
          depth: 45,
        });
        scene.tweens.add({
          targets: crescent,
          scale: 1.18,
          alpha: 0,
          duration: 480,
          ease: 'Cubic.easeOut',
        });
        scene.tweens.add({
          targets: [shade, label],
          alpha: 0,
          duration: 420,
          ease: 'Sine.easeIn',
        });
        scene.time.delayedCall(540, () => {
          shade.destroy();
          crescent.destroy(true);
          label.destroy();
          context.onComplete();
        });
      },
    });
  });
}

function createBloodMoonCrescent(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const crescent = scene.add.container(x + 22, y - 2).setDepth(49).setAlpha(0).setScale(0.84);
  const outerGlow = drawCrescent(scene, 78, 62, -20, COLORS.blood, 0.16);
  const bodyGlow = drawCrescent(scene, 70, 55, -18, COLORS.crimson, 0.34);
  const body = drawCrescent(scene, 63, 49, -16, COLORS.blood, 0.82);
  const highlight = scene.add.graphics();
  highlight.lineStyle(4, COLORS.crimson, 0.9);
  highlight.beginPath();
  highlight.arc(0, 0, 63, Phaser.Math.DegToRad(-112), Phaser.Math.DegToRad(112), false);
  highlight.strokePath();
  highlight.lineStyle(2, COLORS.moon, 0.86);
  highlight.beginPath();
  highlight.arc(0, 0, 61, Phaser.Math.DegToRad(-104), Phaser.Math.DegToRad(104), false);
  highlight.strokePath();
  const tips = [
    scene.add.rectangle(22, -58, 7, 7, COLORS.bright, 0.94).setAngle(45),
    scene.add.rectangle(22, 58, 7, 7, COLORS.bright, 0.94).setAngle(45),
  ];
  crescent.add([outerGlow, bodyGlow, body, highlight, ...tips]);
  scene.tweens.add({
    targets: crescent,
    angle: { from: -4, to: 4 },
    scale: { from: 0.84, to: 1.02 },
    duration: 760,
    yoyo: true,
    repeat: 1,
    ease: 'Sine.easeInOut',
  });
  return crescent;
}

function drawCrescent(
  scene: Phaser.Scene,
  outerRadius: number,
  innerRadius: number,
  innerOffsetX: number,
  color: number,
  alpha: number,
): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics();
  const outerStart = Phaser.Math.DegToRad(-112);
  const outerEnd = Phaser.Math.DegToRad(112);
  const innerStart = Phaser.Math.DegToRad(112);
  const innerEnd = Phaser.Math.DegToRad(-112);

  graphics.fillStyle(color, alpha);
  graphics.beginPath();
  graphics.arc(0, 0, outerRadius, outerStart, outerEnd, false);
  graphics.arc(innerOffsetX, 0, innerRadius, innerStart, innerEnd, true);
  graphics.closePath();
  graphics.fillPath();
  return graphics;
}

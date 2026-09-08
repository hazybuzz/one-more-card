import Phaser from 'phaser';
import { t } from '../../../game/i18n';
import { GAME_FONT_FAMILY } from '../../themes/typography';
import type { PassiveVfxContext } from './PassiveVfxDirector';
import { playBrokenRing, playJaggedScan, playPixelBurst } from './PixelVfxPrimitives';

const COLORS = {
  deep: 0x07140c,
  shadow: 0x13291a,
  green: 0x315c32,
  bright: 0x78a85a,
  pale: 0xb6d68c,
} as const;

const TOTAL_DURATION = 1540;

export function playGoblinInstinctVfx(context: PassiveVfxContext): void {
  const { scene, anchors } = context;
  const source = anchors.source;
  const labelPosition = anchors.sourceLabel ?? new Phaser.Math.Vector2(source.x, source.y - 104);
  const hand = anchors.playerHand ?? anchors.player;
  const ear = new Phaser.Math.Vector2(source.x - 42, source.y - 20);
  const camera = scene.cameras.main;
  const shade = scene.add.rectangle(
    camera.centerX,
    camera.centerY,
    camera.width,
    camera.height,
    COLORS.deep,
    0,
  ).setDepth(37);
  const handTrace = scene.add.rectangle(hand.x, hand.y, 154, 108, COLORS.shadow, 0.08)
    .setStrokeStyle(3, COLORS.green, 0.82)
    .setDepth(39)
    .setAlpha(0);
  const earGlow = createEarGlow(scene, ear.x, ear.y);
  const label = scene.add.text(labelPosition.x, labelPosition.y, t('battle.passive.goblinInstinct'), {
    fontFamily: GAME_FONT_FAMILY,
    fontSize: '22px',
    color: '#b6d68c',
    fontStyle: 'bold',
    stroke: '#07140c',
    strokeThickness: 5,
  }).setOrigin(0.5).setDepth(44).setAlpha(0);
  label.setShadow(0, 0, '#315c32', 14, true, true);

  scene.sound.play('attackWind', { volume: 0.3, rate: 0.82 });
  playBrokenRing(scene, {
    x: source.x,
    y: source.y,
    radius: 76,
    color: COLORS.green,
    highlightColor: COLORS.pale,
    segments: 16,
    duration: 720,
    depth: 40,
    clockwise: false,
  });
  playPixelBurst(scene, {
    x: source.x,
    y: source.y,
    colors: [COLORS.shadow, COLORS.green, COLORS.bright],
    count: 10,
    minDistance: 20,
    maxDistance: 62,
    pixelSize: 3,
    duration: 680,
    depth: 41,
  });

  scene.tweens.add({
    targets: shade,
    alpha: 0.22,
    duration: 220,
    ease: 'Sine.easeOut',
  });
  scene.tweens.add({
    targets: [earGlow, label],
    alpha: 1,
    duration: 180,
    delay: 120,
    ease: 'Stepped',
  });

  scene.time.delayedCall(310, () => {
    scene.tweens.add({
      targets: handTrace,
      alpha: { from: 0, to: 1 },
      duration: 110,
      yoyo: true,
      hold: 500,
      ease: 'Stepped',
    });
    playJaggedScan(scene, {
      from: hand,
      to: ear,
      color: COLORS.green,
      highlightColor: COLORS.pale,
      segments: 11,
      jitter: 7,
      lineWidth: 3,
      duration: 720,
      depth: 42,
      onComplete: () => {
        playPixelBurst(scene, {
          x: ear.x,
          y: ear.y,
          colors: [COLORS.green, COLORS.bright, 0xe3c96c],
          count: 8,
          minDistance: 12,
          maxDistance: 44,
          pixelSize: 3,
          duration: 460,
          depth: 43,
        });
      },
    });
  });

  scene.time.delayedCall(1080, () => {
    scene.tweens.add({
      targets: [shade, handTrace, earGlow, label],
      alpha: 0,
      duration: 360,
      ease: 'Sine.easeIn',
    });
  });
  scene.time.delayedCall(TOTAL_DURATION, () => {
    shade.destroy();
    handTrace.destroy();
    earGlow.destroy(true);
    label.destroy();
    context.onComplete();
  });
}

function createEarGlow(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const glow = scene.add.container(x, y).setDepth(43).setAlpha(0);
  const outer = scene.add.circle(0, 0, 25, COLORS.green, 0.18)
    .setBlendMode(Phaser.BlendModes.ADD);
  const middle = scene.add.circle(0, 0, 14, COLORS.bright, 0.34)
    .setBlendMode(Phaser.BlendModes.ADD);
  const core = scene.add.circle(0, 0, 6, 0xe3c96c, 0.96)
    .setBlendMode(Phaser.BlendModes.ADD);
  const sparkPositions = [
    { x: -18, y: -10, size: 4 },
    { x: 19, y: -5, size: 3 },
    { x: -12, y: 17, size: 3 },
    { x: 14, y: 15, size: 4 },
  ];
  const sparks = sparkPositions.map(({ x: sparkX, y: sparkY, size }) => (
    scene.add.rectangle(sparkX, sparkY, size, size, 0xe3c96c, 0.9)
  ));
  glow.add([outer, middle, core, ...sparks]);
  scene.tweens.add({
    targets: [middle, core],
    alpha: { from: 0.5, to: 1 },
    scale: { from: 0.86, to: 1.16 },
    duration: 260,
    yoyo: true,
    repeat: 3,
    ease: 'Sine.easeInOut',
  });
  scene.tweens.add({
    targets: sparks,
    angle: 90,
    alpha: { from: 0.42, to: 1 },
    duration: 520,
    yoyo: true,
    repeat: 1,
    ease: 'Stepped',
  });
  return glow;
}

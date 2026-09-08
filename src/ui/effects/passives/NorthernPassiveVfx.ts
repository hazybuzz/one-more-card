import Phaser from 'phaser';
import { t } from '../../../game/i18n';
import { GAME_FONT_FAMILY } from '../../themes/typography';
import type { PassiveVfxContext } from './PassiveVfxDirector';
import { playBrokenRing, playPixelArcTransfer, playPixelBurst } from './PixelVfxPrimitives';

const DEPTH = {
  shade: 37,
  aura: 40,
  transfer: 43,
  label: 47,
} as const;

const WAR = {
  deep: 0x170705,
  ember: 0x8f2718,
  red: 0xd7442d,
  orange: 0xf27a32,
  gold: 0xf4be62,
} as const;

const RUNE = {
  deep: 0x06131d,
  blue: 0x246b91,
  bright: 0x6ecaf2,
  ice: 0xc4efff,
  heal: 0x75d49a,
} as const;

const SOUL = {
  deep: 0x07121b,
  blue: 0x4d8db4,
  pale: 0xbfeaff,
  white: 0xf2f6df,
  gold: 0xe8c778,
} as const;

export function playWarHornVfx(context: PassiveVfxContext): void {
  const { scene, anchors, event } = context;
  const shade = createShade(scene, WAR.deep, 0.18);
  const label = createLabel(scene, anchors.sourceLabel ?? anchors.source, t('battle.passive.warHorn'), '#ffb36c', WAR.deep);
  const icon = createIcon(scene, 'icon-passive-war-horn', anchors.source.x, anchors.source.y - 8, 72, WAR.gold);

  scene.sound.play('attackFire', { volume: 0.48, rate: 0.72 });
  playBrokenRing(scene, {
    x: anchors.source.x,
    y: anchors.source.y,
    radius: 82,
    color: WAR.ember,
    highlightColor: WAR.gold,
    segments: 18,
    segmentWidth: 11,
    segmentHeight: 4,
    duration: 1080,
    depth: DEPTH.aura,
  });
  playPixelBurst(scene, {
    x: anchors.source.x,
    y: anchors.source.y,
    colors: [WAR.ember, WAR.red, WAR.orange, WAR.gold],
    count: 18,
    minDistance: 24,
    maxDistance: 92,
    pixelSize: 4,
    duration: 720,
    depth: DEPTH.transfer,
  });

  scene.time.delayedCall(420, () => {
    scene.sound.play('attackWind', { volume: 0.34, rate: 0.66 });
    anchors.targets.forEach((target, index) => {
      scene.time.delayedCall(index * 90, () => {
        playHornWave(scene, anchors.source, target);
        scene.time.delayedCall(510, () => {
          context.feedback?.revealEnemyAttackBonus?.(event.targetEnemyIndexes[index]);
          playTargetImpact(scene, target, [WAR.red, WAR.orange, WAR.gold]);
          createFloatingText(scene, target, t('battle.passive.attackUp'), '#ff8a65', WAR.deep);
        });
      });
    });
  });

  scene.time.delayedCall(1420, () => fadeOut(scene, [shade, label, icon], 360));
  scene.time.delayedCall(1840, () => {
    destroyAll([shade, label, icon]);
    context.onComplete();
  });
}

export function playRuneBlessingVfx(context: PassiveVfxContext): void {
  const { scene, anchors, event } = context;
  const target = anchors.targets[0] ?? anchors.source;
  const targetIndex = event.targetEnemyIndexes[0] ?? event.sourceEnemyIndex;
  const isHeal = event.effect === 'heal';
  const landingColor = isHeal ? RUNE.heal : RUNE.bright;
  const shade = createShade(scene, RUNE.deep, 0.16);
  const label = createLabel(scene, anchors.sourceLabel ?? anchors.source, t('battle.passive.runeBlessing'), '#9edfff', RUNE.deep);
  const icon = createIcon(scene, 'icon-passive-rune-blessing', anchors.source.x, anchors.source.y - 6, 68, RUNE.ice);

  scene.sound.play('attackWind', { volume: 0.36, rate: 0.76 });
  playBrokenRing(scene, {
    x: anchors.source.x,
    y: anchors.source.y,
    radius: 76,
    color: RUNE.blue,
    highlightColor: RUNE.ice,
    segments: 16,
    segmentWidth: 9,
    segmentHeight: 3,
    duration: 1120,
    depth: DEPTH.aura,
    clockwise: false,
  });

  scene.time.delayedCall(380, () => {
    playPixelArcTransfer(scene, {
      from: anchors.source,
      to: target,
      colors: [RUNE.blue, RUNE.bright, RUNE.ice, landingColor],
      count: 11,
      arcHeight: 76,
      pixelSize: 4,
      duration: 680,
      stagger: 36,
      depth: DEPTH.transfer,
      onArrive: () => {
        if (isHeal) {
          context.feedback?.showEnemyHeal?.(targetIndex, Math.max(1, event.amount ?? 1));
        } else {
          context.feedback?.revealEnemyAttackBonus?.(targetIndex);
        }
        playTargetImpact(scene, target, [RUNE.blue, landingColor, RUNE.ice]);
        createFloatingText(
          scene,
          target,
          isHeal ? t('battle.passive.hpUp') : t('battle.passive.attackUp'),
          isHeal ? '#9cf1b7' : '#a9e5ff',
          RUNE.deep,
        );
      },
    });
  });

  scene.time.delayedCall(1480, () => fadeOut(scene, [shade, label, icon], 340));
  scene.time.delayedCall(1880, () => {
    destroyAll([shade, label, icon]);
    context.onComplete();
  });
}

export function playEinherjarSummonVfx(context: PassiveVfxContext): void {
  const { scene, anchors, event } = context;
  const target = anchors.targets[0] ?? anchors.source;
  const targetIndex = event.targetEnemyIndexes[0] ?? event.sourceEnemyIndex;
  const shade = createShade(scene, SOUL.deep, 0.24);
  const label = createLabel(scene, anchors.sourceLabel ?? anchors.source, t('battle.passive.einherjarSummon'), '#d8f3ff', SOUL.deep);
  const icon = createIcon(scene, 'icon-passive-einherjar-summon', anchors.source.x, anchors.source.y - 8, 72, SOUL.gold);
  const column = createSummonColumn(scene, target);

  scene.sound.play('resonanceEcho', { volume: 0.5, rate: 0.82 });
  playBrokenRing(scene, {
    x: anchors.source.x,
    y: anchors.source.y,
    radius: 84,
    color: SOUL.blue,
    highlightColor: SOUL.gold,
    segments: 18,
    segmentWidth: 10,
    segmentHeight: 3,
    duration: 1260,
    depth: DEPTH.aura,
  });

  scene.time.delayedCall(420, () => {
    playPixelArcTransfer(scene, {
      from: anchors.source,
      to: target,
      colors: [SOUL.blue, SOUL.pale, SOUL.white, SOUL.gold],
      count: 16,
      arcHeight: 112,
      pixelSize: 4,
      duration: 760,
      stagger: 34,
      depth: DEPTH.transfer,
    });
    scene.tweens.add({
      targets: column,
      alpha: { from: 0, to: 1 },
      scaleY: { from: 0.25, to: 1 },
      duration: 640,
      ease: 'Cubic.easeOut',
    });
  });

  scene.time.delayedCall(1160, () => {
    context.feedback?.revealSummonedEnemy?.(targetIndex);
    scene.sound.play('cardPlace', { volume: 0.5, rate: 0.78 });
    playTargetImpact(scene, target, [SOUL.blue, SOUL.pale, SOUL.white, SOUL.gold], 24);
    createFloatingText(scene, target, t('battle.passive.einherjarArrive'), '#d8f3ff', SOUL.deep);
  });

  scene.time.delayedCall(1660, () => fadeOut(scene, [shade, label, icon, column], 420));
  scene.time.delayedCall(2140, () => {
    destroyAll([shade, label, icon, column]);
    context.onComplete();
  });
}

function createShade(scene: Phaser.Scene, color: number, targetAlpha: number): Phaser.GameObjects.Rectangle {
  const camera = scene.cameras.main;
  const shade = scene.add.rectangle(camera.centerX, camera.centerY, camera.width, camera.height, color, 0).setDepth(DEPTH.shade);
  scene.tweens.add({ targets: shade, alpha: targetAlpha, duration: 260, ease: 'Sine.easeOut' });
  return shade;
}

function createLabel(
  scene: Phaser.Scene,
  position: Phaser.Math.Vector2,
  value: string,
  color: string,
  stroke: number,
): Phaser.GameObjects.Text {
  const y = Phaser.Math.Clamp(position.y, 42, scene.cameras.main.height - 42);
  const label = scene.add.text(position.x, y, value, {
    fontFamily: GAME_FONT_FAMILY,
    fontSize: '23px',
    color,
    fontStyle: 'bold',
    stroke: `#${stroke.toString(16).padStart(6, '0')}`,
    strokeThickness: 6,
  }).setOrigin(0.5).setDepth(DEPTH.label).setAlpha(0).setScale(0.92);
  label.setShadow(0, 0, color, 15, true, true);
  scene.tweens.add({ targets: label, alpha: 1, scale: 1, duration: 260, ease: 'Back.easeOut' });
  return label;
}

function createIcon(
  scene: Phaser.Scene,
  textureKey: string,
  x: number,
  y: number,
  size: number,
  fallbackColor: number,
): Phaser.GameObjects.Image | Phaser.GameObjects.Arc {
  const icon = scene.textures.exists(textureKey)
    ? scene.add.image(x, y, textureKey).setDisplaySize(size, size)
    : scene.add.circle(x, y, size / 2, fallbackColor, 0.72).setStrokeStyle(3, 0xffffff, 0.6);
  icon.setDepth(DEPTH.label - 1).setAlpha(0).setScale(0.72);
  scene.tweens.add({
    targets: icon,
    alpha: 1,
    scale: 1,
    angle: { from: -6, to: 6 },
    duration: 420,
    yoyo: true,
    repeat: 1,
    ease: 'Sine.easeInOut',
  });
  return icon;
}

function playHornWave(scene: Phaser.Scene, from: Phaser.Math.Vector2, to: Phaser.Math.Vector2): void {
  playPixelArcTransfer(scene, {
    from,
    to,
    colors: [WAR.ember, WAR.red, WAR.orange, WAR.gold],
    count: 8,
    arcHeight: 34,
    pixelSize: 5,
    duration: 470,
    stagger: 24,
    depth: DEPTH.transfer,
  });
  for (let waveIndex = 0; waveIndex < 3; waveIndex += 1) {
    const ring = scene.add.circle(from.x, from.y, 24, WAR.orange, 0)
      .setStrokeStyle(4 - waveIndex, waveIndex === 2 ? WAR.gold : WAR.orange, 0.88)
      .setDepth(DEPTH.transfer);
    scene.tweens.add({
      targets: ring,
      scale: 2.7 + waveIndex * 0.55,
      alpha: 0,
      duration: 620,
      delay: waveIndex * 90,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
  }
}

function createSummonColumn(scene: Phaser.Scene, target: Phaser.Math.Vector2): Phaser.GameObjects.Container {
  const column = scene.add.container(target.x, target.y).setDepth(DEPTH.transfer).setAlpha(0);
  const glow = scene.add.rectangle(0, 0, 92, 226, SOUL.blue, 0.14).setStrokeStyle(3, SOUL.pale, 0.72);
  const core = scene.add.rectangle(0, 0, 28, 214, SOUL.white, 0.16);
  const base = scene.add.ellipse(0, 88, 112, 34, SOUL.blue, 0.2).setStrokeStyle(3, SOUL.gold, 0.82);
  const runes = Array.from({ length: 8 }, (_, index) => {
    const angle = (index / 8) * Math.PI * 2;
    return scene.add.rectangle(Math.cos(angle) * 46, 88 + Math.sin(angle) * 14, 7, 7, index % 2 ? SOUL.pale : SOUL.gold, 0.88)
      .setAngle(45);
  });
  column.add([glow, core, base, ...runes]);
  scene.tweens.add({ targets: runes, angle: '+=180', duration: 1300, ease: 'Linear' });
  return column;
}

function playTargetImpact(
  scene: Phaser.Scene,
  target: Phaser.Math.Vector2,
  colors: readonly number[],
  count = 16,
): void {
  playBrokenRing(scene, {
    x: target.x,
    y: target.y,
    radius: 70,
    color: colors[0] ?? 0xffffff,
    highlightColor: colors[colors.length - 1] ?? 0xffffff,
    duration: 720,
    depth: DEPTH.transfer,
  });
  playPixelBurst(scene, {
    x: target.x,
    y: target.y,
    colors,
    count,
    minDistance: 18,
    maxDistance: 78,
    pixelSize: 4,
    duration: 620,
    depth: DEPTH.transfer + 1,
  });
}

function createFloatingText(
  scene: Phaser.Scene,
  target: Phaser.Math.Vector2,
  value: string,
  color: string,
  stroke: number,
): void {
  const text = scene.add.text(target.x, Phaser.Math.Clamp(target.y - 94, 42, scene.cameras.main.height - 42), value, {
    fontFamily: GAME_FONT_FAMILY,
    fontSize: '21px',
    color,
    fontStyle: 'bold',
    stroke: `#${stroke.toString(16).padStart(6, '0')}`,
    strokeThickness: 5,
  }).setOrigin(0.5).setDepth(DEPTH.label).setAlpha(0);
  text.setShadow(0, 0, color, 13, true, true);
  scene.tweens.add({
    targets: text,
    alpha: { from: 0, to: 1 },
    y: text.y - 12,
    duration: 260,
    yoyo: true,
    hold: 430,
    ease: 'Sine.easeOut',
    onComplete: () => text.destroy(),
  });
}

function fadeOut(scene: Phaser.Scene, targets: Phaser.GameObjects.GameObject[], duration: number): void {
  scene.tweens.add({ targets, alpha: 0, duration, ease: 'Sine.easeIn' });
}

function destroyAll(targets: Phaser.GameObjects.GameObject[]): void {
  targets.forEach((target) => {
    if (target.active) {
      target.destroy();
    }
  });
}

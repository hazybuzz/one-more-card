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

const SOUL_MIST_TEXTURE = 'soul-redeem-soft-mist-v1';

export function playSoulRedeemVfx(scene: Phaser.Scene, options: SoulRedeemVfxOptions): void {
  const { center } = options;
  const mistTexture = ensureSoulMistTexture(scene);
  const camera = scene.cameras.main;
  let finished = false;
  const blocker = scene.add.rectangle(camera.centerX, camera.centerY, camera.width, camera.height, COLORS.shade, 0)
    .setDepth(68).setInteractive();
  const angel = scene.add.container(center.x, center.y + 96).setDepth(73).setAlpha(0).setScale(0.38);
  const iconGlow = scene.add.image(0, 0, mistTexture)
    .setDisplaySize(116, 116).setTint(COLORS.paleGold).setAlpha(0.34)
    .setBlendMode(Phaser.BlendModes.ADD);
  const icon = scene.add.image(0, 0, options.iconTextureKey).setDisplaySize(76, 76);
  const highlight = scene.add.image(0, 0, options.iconTextureKey)
    .setDisplaySize(80, 80).setTint(COLORS.soul).setAlpha(0.34)
    .setBlendMode(Phaser.BlendModes.ADD);
  angel.add([iconGlow, highlight, icon]);

  const title = scene.add.text(center.x, center.y - 170, options.title, {
    fontFamily: GAME_FONT_FAMILY,
    fontSize: '30px',
    color: '#f2cc74',
    fontStyle: 'bold',
    stroke: '#2c1d08',
    strokeThickness: 5,
  }).setOrigin(0.5).setDepth(74).setAlpha(0);
  title.setShadow(0, 0, '#ffe9a8', 18, true, true);

  const cleanup = (): void => {
    if (finished) return;
    finished = true;
    scene.tweens.killTweensOf([blocker, angel, iconGlow, highlight, title]);
    blocker.destroy();
    angel.destroy(true);
    title.destroy();
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);

  scene.sound.play('resonanceEcho', { volume: 0.46, rate: 0.86 });
  playSoulParticles(scene, center.x, center.y + 42, 22, [COLORS.soul, COLORS.blue, COLORS.paleGold], 71, 'rise');
  playRisingMist(scene, mistTexture, center.x, center.y + 70, 13, 70);
  scene.tweens.add({ targets: blocker, alpha: 0.28, duration: 280, ease: 'Sine.easeOut' });
  scene.tweens.add({
    targets: angel,
    y: center.y - 116,
    alpha: 1,
    scale: 1,
    duration: 780,
    ease: 'Cubic.easeOut',
    onUpdate: () => {
      if (Phaser.Math.Between(0, 3) === 0) spawnSoulMote(scene, angel.x, angel.y + 30, COLORS.soul, 72, 'rise');
    },
    onComplete: () => {
      playRisingMist(scene, mistTexture, angel.x, angel.y + 15, 8, 72);
      playSoulParticles(scene, angel.x, angel.y, 14, [COLORS.soul, COLORS.paleGold], 74, 'gather');
      scene.tweens.add({ targets: title, alpha: 1, y: title.y - 5, duration: 240, ease: 'Back.easeOut' });
      scene.tweens.add({ targets: angel, x: angel.x + 5, angle: 4, duration: 170, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
      scene.time.delayedCall(320, () => flySoulHome(scene, options, mistTexture, {
        blocker, angel, title, cleanup,
        isFinished: () => finished,
        finish: () => { finished = true; },
      }));
    },
  });
  scene.tweens.add({ targets: iconGlow, alpha: 0.58, scale: 1.18, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
}

function flySoulHome(
  scene: Phaser.Scene,
  options: SoulRedeemVfxOptions,
  mistTexture: string,
  objects: {
    blocker: Phaser.GameObjects.Rectangle;
    angel: Phaser.GameObjects.Container;
    title: Phaser.GameObjects.Text;
    cleanup: () => void;
    isFinished: () => boolean;
    finish: () => void;
  },
): void {
  if (objects.isFinished() || !objects.angel.active) return;
  const start = new Phaser.Math.Vector2(objects.angel.x, objects.angel.y);
  const control = new Phaser.Math.Vector2(options.center.x + 82, options.center.y - 54);
  const progress = { value: 0 };
  let lastTrailAt = -Infinity;
  scene.tweens.add({
    targets: progress,
    value: 1,
    duration: 540,
    ease: 'Cubic.easeIn',
    onUpdate: () => {
      const t = progress.value;
      const inverse = 1 - t;
      objects.angel.setPosition(
        inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * options.center.x,
        inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * options.center.y,
      );
      objects.angel.setScale(1 - t * 0.58).setAlpha(1 - t * 0.12);
      if (scene.time.now - lastTrailAt >= 34) {
        lastTrailAt = scene.time.now;
        spawnSoulTrail(scene, mistTexture, objects.angel.x, objects.angel.y, t);
      }
    },
    onComplete: () => {
      if (objects.isFinished()) return;
      options.onRevive();
      scene.sound.play('healSound', { volume: 0.58 });
      objects.angel.setAlpha(0);
      playReviveBloom(scene, mistTexture, options.center, options.healAmount);
      scene.time.delayedCall(110, () => {
        scene.tweens.add({
          targets: [objects.blocker, objects.title], alpha: 0, duration: 650, ease: 'Sine.easeInOut',
          onComplete: () => {
            if (objects.isFinished()) return;
            objects.finish();
            scene.events.off(Phaser.Scenes.Events.SHUTDOWN, objects.cleanup);
            objects.blocker.destroy();
            objects.angel.destroy(true);
            objects.title.destroy();
            options.onComplete();
          },
        });
      });
    },
  });
}

function ensureSoulMistTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(SOUL_MIST_TEXTURE)) return SOUL_MIST_TEXTURE;
  const texture = scene.textures.createCanvas(SOUL_MIST_TEXTURE, 96, 96);
  if (!texture) return SOUL_MIST_TEXTURE;
  const context = texture.getContext();
  context.clearRect(0, 0, 96, 96);
  for (const lobe of [{ x: 34, y: 52, radius: 29 }, { x: 54, y: 39, radius: 34 }, { x: 66, y: 57, radius: 25 }]) {
    const gradient = context.createRadialGradient(lobe.x, lobe.y, 0, lobe.x, lobe.y, lobe.radius);
    gradient.addColorStop(0, 'rgba(235,246,255,0.34)');
    gradient.addColorStop(0.42, 'rgba(193,222,240,0.17)');
    gradient.addColorStop(1, 'rgba(160,205,232,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 96, 96);
  }
  texture.update();
  return SOUL_MIST_TEXTURE;
}

function playRisingMist(scene: Phaser.Scene, textureKey: string, x: number, y: number, count: number, depth: number): void {
  for (let index = 0; index < count; index += 1) {
    const puff = scene.add.image(x + Phaser.Math.Between(-42, 42), y + Phaser.Math.Between(-12, 24), textureKey)
      .setDepth(depth).setTint(index % 4 === 0 ? COLORS.paleGold : COLORS.soul).setAlpha(0)
      .setDisplaySize(Phaser.Math.Between(58, 94), Phaser.Math.Between(48, 80)).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: puff,
      x: puff.x + Phaser.Math.Between(-32, 32), y: puff.y - Phaser.Math.Between(85, 155),
      alpha: { from: 0, to: index % 4 === 0 ? 0.24 : 0.32 },
      scaleX: Phaser.Math.FloatBetween(1.4, 1.9), scaleY: Phaser.Math.FloatBetween(1.2, 1.65),
      angle: Phaser.Math.Between(-20, 20), delay: index * 34, duration: Phaser.Math.Between(880, 1320),
      ease: 'Sine.easeOut', onComplete: () => puff.destroy(),
    });
    scene.time.delayedCall(index * 34 + 390, () => {
      if (puff.active) scene.tweens.add({ targets: puff, alpha: 0, duration: 520, ease: 'Sine.easeIn' });
    });
  }
}

function spawnSoulTrail(scene: Phaser.Scene, textureKey: string, x: number, y: number, progress: number): void {
  const mist = scene.add.image(x, y + 8, textureKey).setDepth(71).setTint(COLORS.soul).setAlpha(0.24)
    .setDisplaySize(50 - progress * 14, 42 - progress * 10).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: mist, alpha: 0, scale: 1.6, y: y - 12, duration: 360,
    ease: 'Sine.easeOut', onComplete: () => mist.destroy() });
  spawnSoulMote(scene, x + Phaser.Math.Between(-8, 8), y + Phaser.Math.Between(-5, 8),
    Phaser.Math.Between(0, 2) === 0 ? COLORS.paleGold : COLORS.soul, 72, 'trail');
}

function playReviveBloom(scene: Phaser.Scene, textureKey: string, center: Phaser.Math.Vector2, amount: number): void {
  for (let index = 0; index < 11; index += 1) {
    const angle = index * Math.PI * 2 / 11;
    const mist = scene.add.image(center.x, center.y, textureKey).setDepth(72)
      .setTint(index % 3 === 0 ? COLORS.paleGold : COLORS.soul).setAlpha(0.34)
      .setDisplaySize(64, 58).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: mist,
      x: center.x + Math.cos(angle) * Phaser.Math.Between(48, 92),
      y: center.y + Math.sin(angle) * Phaser.Math.Between(38, 78) - 18,
      alpha: 0, scale: Phaser.Math.FloatBetween(1.45, 2), duration: Phaser.Math.Between(560, 820),
      ease: 'Cubic.easeOut', onComplete: () => mist.destroy(),
    });
  }
  playSoulParticles(scene, center.x, center.y, 34, [COLORS.ivory, COLORS.paleGold, COLORS.soul], 74, 'burst');
  const text = scene.add.text(center.x, center.y - 82, `HP +${amount}`, {
    fontFamily: GAME_FONT_FAMILY, fontSize: '30px', color: COLORS.green, fontStyle: 'bold',
    stroke: '#102014', strokeThickness: 5,
  }).setOrigin(0.5).setDepth(75);
  text.setShadow(0, 0, COLORS.green, 14, true, true);
  scene.tweens.add({ targets: text, y: text.y - 42, alpha: 0, delay: 160, duration: 760,
    ease: 'Cubic.easeOut', onComplete: () => text.destroy() });
}

function playSoulParticles(
  scene: Phaser.Scene,
  x: number,
  y: number,
  count: number,
  colors: readonly number[],
  depth: number,
  motion: 'rise' | 'gather' | 'burst',
): void {
  for (let index = 0; index < count; index += 1) {
    spawnSoulMote(scene, x, y, colors[index % colors.length] ?? COLORS.soul, depth, motion);
  }
}

function spawnSoulMote(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  depth: number,
  motion: 'rise' | 'gather' | 'burst' | 'trail',
): void {
  const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
  const startRadius = motion === 'gather' ? Phaser.Math.Between(48, 88) : Phaser.Math.Between(4, 26);
  const startX = x + Math.cos(angle) * startRadius;
  const startY = y + Math.sin(angle) * startRadius;
  const mote = scene.add.rectangle(startX, startY, Phaser.Math.Between(2, 5), Phaser.Math.Between(3, 7), color, 0.92)
    .setDepth(depth).setRotation(angle).setBlendMode(Phaser.BlendModes.ADD);
  const distance = motion === 'burst' ? Phaser.Math.Between(54, 118) : Phaser.Math.Between(28, 78);
  const targetX = motion === 'gather' ? x : startX + Math.cos(angle) * distance;
  const targetY = motion === 'gather' ? y
    : startY + Math.sin(angle) * (motion === 'rise' ? 22 : distance) - (motion === 'rise' ? 82 : 12);
  scene.tweens.add({
    targets: mote, x: targetX, y: targetY, alpha: 0, scale: 0.2,
    delay: motion === 'trail' ? 0 : Phaser.Math.Between(0, 180),
    duration: motion === 'gather' ? 520 : Phaser.Math.Between(480, 820),
    ease: motion === 'gather' ? 'Cubic.easeIn' : 'Cubic.easeOut',
    onComplete: () => mote.destroy(),
  });
}

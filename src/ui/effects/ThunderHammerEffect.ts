import Phaser from 'phaser';
import { playResonanceGather, playResonanceBloom } from './ResonanceWeaponAccent';

export type ThunderHammerTier = 'normal' | 'resonance' | 'strong' | 'boom';

export interface ThunderHammerEffectOptions {
  from: Phaser.Math.Vector2;
  to: Phaser.Math.Vector2;
  tier: ThunderHammerTier;
  onHit: () => void;
  onComplete: () => void;
}

const TEXTURE_KEY = 'effect-player-thunder-hammer';
const TEXTURE_PATH = '/image/battle/effects/player/thunder-hammer.png';
const STORM = 0x70d6ff;
const PALE = 0xd8f6ff;
const GOLD = 0xf6d86b;

const TIERS: Record<ThunderHammerTier, {
  size: number;
  tailLength: number;
  tailWidth: number;
  lightningCount: number;
  impactParticles: number;
  duration: number;
  shake: number;
}> = {
  normal: { size: 78, tailLength: 92, tailWidth: 16, lightningCount: 1, impactParticles: 14, duration: 540, shake: 4 },
  resonance: { size: 78, tailLength: 138, tailWidth: 23, lightningCount: 5, impactParticles: 32, duration: 580, shake: 6 },
  strong: { size: 78, tailLength: 190, tailWidth: 32, lightningCount: 9, impactParticles: 52, duration: 630, shake: 10 },
  boom: { size: 78, tailLength: 235, tailWidth: 42, lightningCount: 12, impactParticles: 68, duration: 680, shake: 14 },
};

export function preloadThunderHammerEffect(scene: Phaser.Scene): void {
  if (!scene.textures.exists(TEXTURE_KEY)) scene.load.image(TEXTURE_KEY, TEXTURE_PATH);
}

export function playThunderHammerEffect(scene: Phaser.Scene, options: ThunderHammerEffectOptions): void {
  const tier = TIERS[options.tier];
  const topTarget = options.to.y < 190;
  const displaySize = tier.size;
  const impactCenter = new Phaser.Math.Vector2(options.to.x, options.to.y - displaySize * 0.27);
  const side = options.to.x < scene.cameras.main.centerX ? -1 : 1;
  const horizontalOffset = topTarget ? side * 132 : side * 72;
  const start = new Phaser.Math.Vector2(
    impactCenter.x + horizontalOffset,
    topTarget ? -displaySize * 0.62 : Math.max(-displaySize * 0.62, impactCenter.y - 330),
  );
  const control = new Phaser.Math.Vector2(
    (start.x + impactCenter.x) / 2 + horizontalOffset * 0.12,
    start.y + (impactCenter.y - start.y) * 0.38,
  );
  const projectile = scene.add.container(start.x, start.y).setDepth(43).setAlpha(0).setScale(0.72);
  const tail = createLightningTail(scene, tier.tailLength, tier.tailWidth, options.tier).setDepth(40).setAlpha(0);
  const outerGlow = scene.add.circle(0, 0, displaySize * 0.42, STORM, 0.16).setBlendMode(Phaser.BlendModes.ADD);
  const innerGlow = scene.add.circle(0, 0, displaySize * 0.27, PALE, 0.22).setBlendMode(Phaser.BlendModes.ADD);
  const goldGlow = options.tier === 'normal' ? undefined : scene.add.circle(
    0,
    0,
    displaySize * (options.tier === 'boom' ? 0.58 : options.tier === 'strong' ? 0.5 : 0.44),
    GOLD,
    options.tier === 'boom' ? 0.2 : options.tier === 'strong' ? 0.14 : 0.09,
  ).setBlendMode(Phaser.BlendModes.ADD);
  const hammerGlow = scene.add.image(0, 0, TEXTURE_KEY).setDisplaySize(displaySize * 1.07, displaySize * 1.07)
    .setRotation(-Phaser.Math.DegToRad(45)).setTint(options.tier === 'normal' ? STORM : GOLD)
    .setAlpha(options.tier === 'normal' ? 0.36 : 0.28).setBlendMode(Phaser.BlendModes.ADD);
  const hammer = scene.add.image(0, 0, TEXTURE_KEY).setDisplaySize(displaySize, displaySize)
    .setRotation(-Phaser.Math.DegToRad(45));
  projectile.add([outerGlow, ...(goldGlow ? [goldGlow] : []), innerGlow, hammerGlow, hammer]);

  scene.sound.play('attackWind', { volume: options.tier === 'boom' ? 0.76 : options.tier === 'strong' ? 0.68 : 0.58 });
  playLaunchCharge(scene, options.from, options.tier, tier.lightningCount);
  scene.tweens.add({ targets: projectile, alpha: 1, scale: 1, duration: 190, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: [outerGlow, innerGlow], alpha: '+=0.18', scale: 1.18,
    duration: 220, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  if (goldGlow) {
    scene.tweens.add({ targets: goldGlow, alpha: '+=0.14', scale: 1.24,
      duration: options.tier === 'boom' ? 140 : 210, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  const progress = { value: 0 };
  let lastTrailAt = -Infinity;
  let lastLightningAt = -Infinity;
  let afterimageIndex = 0;
  let preStrikePlayed = false;
  if (options.tier !== 'normal') playResonanceGather(scene, options.from, STORM, options.tier !== 'resonance');
  scene.tweens.add({
    targets: progress,
    value: 1,
    duration: tier.duration,
    ease: 'Sine.easeInOut',
    onUpdate: () => {
      const t = progress.value;
      if (!preStrikePlayed && t > 0.72 && (options.tier === 'strong' || options.tier === 'boom')) {
        preStrikePlayed = true;
        playFlightLightning(scene, impactCenter.x, impactCenter.y - 42, Math.PI / 2, 32, options.tier);
        playFlightLightning(scene, impactCenter.x, impactCenter.y - 42, Math.PI / 2, 32, options.tier);
      }
      const inverse = 1 - t;
      const x = inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * impactCenter.x;
      const y = inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * impactCenter.y;
      const tangentX = 2 * inverse * (control.x - start.x) + 2 * t * (impactCenter.x - control.x);
      const tangentY = 2 * inverse * (control.y - start.y) + 2 * t * (impactCenter.y - control.y);
      const fallAngle = Math.atan2(tangentY, tangentX);
      projectile.setPosition(x, y);
      tail.setPosition(x, y).setRotation(fallAngle).setAlpha(Math.min(0.9, t * 2.2));
      if (scene.time.now - lastTrailAt >= (options.tier === 'boom' ? 28 : options.tier === 'strong' ? 36 : 46)) {
        lastTrailAt = scene.time.now;
        spawnHammerAfterimage(scene, projectile, hammer.angle, displaySize, afterimageIndex++, options.tier);
      }
      if (scene.time.now - lastLightningAt >= (options.tier === 'boom' ? 52 : options.tier === 'strong' ? 78 : 118)) {
        lastLightningAt = scene.time.now;
        playFlightLightning(scene, x, y, fallAngle, tier.tailWidth, options.tier);
      }
    },
    onComplete: () => {
      options.onHit();
      if (options.tier === 'normal') scene.cameras.main.shake(170, tier.shake / 1000);
      playThunderImpact(scene, options.to, options.tier, tier.impactParticles);
      if (options.tier !== 'normal') playResonanceBloom(scene, options.to, STORM, options.tier !== 'resonance');
      scene.tweens.killTweensOf([outerGlow, innerGlow, goldGlow, hammer, hammerGlow].filter(Boolean));
      scene.tweens.add({
        targets: projectile,
        y: projectile.y + 22,
        alpha: 0,
        scale: 0.84,
        duration: 240,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          tail.destroy();
          projectile.destroy(true);
          scene.time.delayedCall(options.tier === 'boom' ? 440 : 320, options.onComplete);
        },
      });
    },
  });
  projectile.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.tweens.killTweensOf(projectile);
    if (tail.active) tail.destroy();
  });
}

function createLightningTail(
  scene: Phaser.Scene,
  length: number,
  width: number,
  tier: ThunderHammerTier,
): Phaser.GameObjects.Graphics {
  const tail = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  tail.fillStyle(0x102b54, 0.42);
  tail.fillTriangle(8, -width, -length, 0, 8, width);
  tail.fillStyle(STORM, 0.5);
  tail.fillTriangle(10, -width * 0.55, -length * 0.82, 0, 10, width * 0.55);
  if (tier !== 'normal') {
    const goldWidth = tier === 'boom' ? 0.42 : tier === 'strong' ? 0.31 : 0.22;
    const goldLength = tier === 'boom' ? 0.9 : tier === 'strong' ? 0.76 : 0.62;
    tail.fillStyle(GOLD, tier === 'boom' ? 0.62 : tier === 'strong' ? 0.46 : 0.32);
    tail.fillTriangle(11, -width * goldWidth, -length * goldLength, 0, 11, width * goldWidth);
  }
  tail.fillStyle(PALE, 0.76);
  tail.fillTriangle(12, -width * 0.17, -length * 0.62, 0, 12, width * 0.17);
  return tail;
}

function playLaunchCharge(scene: Phaser.Scene, start: Phaser.Math.Vector2, tier: ThunderHammerTier, count: number): void {
  for (let index = 0; index < count + 5; index += 1) {
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const radius = Phaser.Math.Between(26, 66);
    const spark = scene.add.rectangle(start.x + Math.cos(angle) * radius, start.y + Math.sin(angle) * radius,
      index % 3 === 0 ? 7 : 3, 3, tier !== 'normal' && index % 4 === 0 ? GOLD : STORM, 0.9)
      .setDepth(42).setRotation(angle).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: spark, x: start.x, y: start.y,
      alpha: 0, scale: 0.2, duration: Phaser.Math.Between(260, 430), ease: 'Cubic.easeIn',
      onComplete: () => spark.destroy() });
  }
}

function spawnHammerAfterimage(
  scene: Phaser.Scene,
  projectile: Phaser.GameObjects.Container,
  hammerAngle: number,
  size: number,
  index: number,
  tier: ThunderHammerTier,
): void {
  const goldInterval = tier === 'boom' ? 2 : tier === 'strong' ? 3 : 5;
  const color = tier !== 'normal' && index % goldInterval === 0 ? GOLD : STORM;
  const image = scene.add.image(projectile.x, projectile.y, TEXTURE_KEY).setDepth(39)
    .setDisplaySize(size * 0.84, size * 0.84).setRotation(projectile.rotation + Phaser.Math.DegToRad(hammerAngle))
    .setTint(color).setAlpha(tier === 'boom' && color === GOLD ? 0.3 : 0.2).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: image, alpha: 0, scale: 0.62, duration: 300, ease: 'Sine.easeOut',
    onComplete: () => image.destroy() });
}

function playFlightLightning(
  scene: Phaser.Scene,
  x: number,
  y: number,
  angle: number,
  spread: number,
  tier: ThunderHammerTier,
): void {
  const length = tier === 'boom' ? Phaser.Math.Between(64, 112) : Phaser.Math.Between(42, 82);
  const side = Phaser.Math.Between(0, 1) === 0 ? -1 : 1;
  const direction = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle));
  const normal = new Phaser.Math.Vector2(-direction.y, direction.x);
  const start = new Phaser.Math.Vector2(x, y).add(normal.scale(side * Phaser.Math.Between(8, spread)));
  const end = start.clone().add(direction.scale(-length)).add(normal.scale(side * Phaser.Math.Between(12, 34)));
  const bolt = scene.add.graphics().setDepth(42).setBlendMode(Phaser.BlendModes.ADD);
  drawBolt(bolt, start, end, tier === 'boom' ? 4 : 3, 0xffffff, 0.9);
  const goldChance = tier === 'boom' ? 1 : tier === 'strong' ? 0.85 : tier === 'resonance' ? 0.65 : 0;
  const accent = Math.random() < goldChance ? GOLD : STORM;
  drawBolt(bolt, start, end, 2, accent, 1);
  if (tier !== 'normal') {
    const fork = start.clone().lerp(end, 0.5);
    const branchEnd = fork.clone().add(new Phaser.Math.Vector2(side * 26, -22));
    drawBolt(bolt, fork, branchEnd, tier === 'resonance' ? 1.5 : 2.5, GOLD, 0.95);
  }
  scene.tweens.add({ targets: bolt, alpha: 0, duration: tier === 'boom' ? 190 : 150,
    onComplete: () => bolt.destroy() });
}

function playThunderImpact(scene: Phaser.Scene, point: Phaser.Math.Vector2, tier: ThunderHammerTier, count: number): void {
  if (tier !== 'normal') {
    const strikeHeight = tier === 'boom' ? 260 : tier === 'strong' ? 210 : 165;
    const strikeCount = tier === 'boom' ? 3 : tier === 'strong' ? 2 : 1;
    for (let index = 0; index < strikeCount; index += 1) {
      const strike = scene.add.graphics().setDepth(49).setBlendMode(Phaser.BlendModes.ADD);
      const from = new Phaser.Math.Vector2(point.x + Phaser.Math.Between(-24, 24), point.y - strikeHeight);
      const to = new Phaser.Math.Vector2(point.x + Phaser.Math.Between(-10, 10), point.y + 8);
      drawBolt(strike, from, to, tier === 'boom' ? 8 : 6, 0xffffff, 0.92);
      drawBolt(strike, from, to, tier === 'boom' ? 4 : 3, GOLD, 1);
      scene.tweens.add({ targets: strike, alpha: 0, duration: 170 + index * 45,
        onComplete: () => strike.destroy() });
    }
  }
  const branchCount = tier === 'boom' ? 10 : tier === 'strong' ? 7 : tier === 'resonance' ? 5 : 3;
  for (let index = 0; index < branchCount; index += 1) {
    const angle = index * Math.PI * 2 / branchCount + Phaser.Math.FloatBetween(-0.2, 0.2);
    const end = new Phaser.Math.Vector2(point.x + Math.cos(angle) * Phaser.Math.Between(70, tier === 'boom' ? 170 : 125),
      point.y + Math.sin(angle) * Phaser.Math.Between(55, tier === 'boom' ? 145 : 110));
    const bolt = scene.add.graphics().setDepth(47).setBlendMode(Phaser.BlendModes.ADD);
    drawBolt(bolt, point, end, tier === 'boom' ? 6 : 4, 0xffffff, 0.95);
    drawBolt(bolt, point, end, tier === 'boom' ? 3 : 2, tier !== 'normal' && index % 3 !== 1 ? GOLD : STORM, 1);
    scene.tweens.add({ targets: bolt, alpha: 0, duration: Phaser.Math.Between(220, 390),
      onComplete: () => bolt.destroy() });
  }
  for (let index = 0; index < count; index += 1) {
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const distance = Phaser.Math.Between(38, tier === 'boom' ? 158 : tier === 'strong' ? 128 : 100);
    const long = index % 4 === 0;
    const particle = scene.add.rectangle(point.x, point.y, long ? Phaser.Math.Between(9, 15) : Phaser.Math.Between(3, 6),
      long ? 3 : Phaser.Math.Between(3, 6), tier !== 'normal' && index % 5 === 0 ? GOLD : index % 3 === 0 ? PALE : STORM, 0.96)
      .setDepth(48).setRotation(angle).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: particle, x: point.x + Math.cos(angle) * distance,
      y: point.y + Math.sin(angle) * distance + Phaser.Math.Between(6, 26), alpha: 0, scale: 0.18,
      angle: particle.angle + 70, delay: index % 5 * 12, duration: Phaser.Math.Between(480, 820),
      ease: 'Cubic.easeOut', onComplete: () => particle.destroy() });
  }
  const flash = scene.add.ellipse(point.x, point.y, tier === 'boom' ? 112 : 82, tier === 'boom' ? 92 : 68, 0xffffff, 0.42)
    .setDepth(46).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: flash, alpha: 0, scale: 1.7, duration: 180, onComplete: () => flash.destroy() });
  if (tier !== 'normal') {
    const goldFlash = scene.add.ellipse(point.x, point.y, tier === 'boom' ? 138 : tier === 'strong' ? 112 : 92,
      tier === 'boom' ? 72 : tier === 'strong' ? 58 : 46, GOLD, tier === 'boom' ? 0.38 : 0.25)
      .setDepth(45).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: goldFlash, alpha: 0, scaleX: 1.9, scaleY: 1.35, duration: 260,
      ease: 'Cubic.easeOut', onComplete: () => goldFlash.destroy() });
  }
}

function drawBolt(
  graphics: Phaser.GameObjects.Graphics,
  from: Phaser.Math.Vector2,
  to: Phaser.Math.Vector2,
  width: number,
  color: number,
  alpha: number,
): void {
  graphics.lineStyle(width, color, alpha);
  graphics.beginPath();
  graphics.moveTo(from.x, from.y);
  const segments = 4;
  for (let index = 1; index < segments; index += 1) {
    const t = index / segments;
    graphics.lineTo(Phaser.Math.Linear(from.x, to.x, t) + Phaser.Math.Between(-10, 10),
      Phaser.Math.Linear(from.y, to.y, t) + Phaser.Math.Between(-10, 10));
  }
  graphics.lineTo(to.x, to.y);
  graphics.strokePath();
}

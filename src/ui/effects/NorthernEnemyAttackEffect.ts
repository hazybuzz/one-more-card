import Phaser from 'phaser';
import type { ResonanceKind } from '../../game/scoring';
import type { EnemyId } from '../../game/types/enemy';

type NorthernEnemyId = Extract<EnemyId, 'viking_warrior' | 'rune_shaman' | 'valkyrie' | 'einherjar'>;

export interface NorthernEnemyAttackOptions {
  enemyId: EnemyId;
  from: Phaser.Math.Vector2;
  to: Phaser.Math.Vector2;
  resonance?: ResonanceKind;
  onHit: () => void;
  onComplete?: () => void;
}

interface AttackTier {
  scale: number;
  glowAlpha: number;
  trailInterval: number;
  particles: number;
  impactRadius: number;
}

const TIERS: Record<ResonanceKind, AttackTier> = {
  none: { scale: 0.86, glowAlpha: 0.2, trailInterval: 74, particles: 10, impactRadius: 54 },
  resonance: { scale: 1.04, glowAlpha: 0.32, trailInterval: 56, particles: 16, impactRadius: 70 },
  strong: { scale: 1.2, glowAlpha: 0.44, trailInterval: 44, particles: 22, impactRadius: 86 },
  boom: { scale: 1.34, glowAlpha: 0.54, trailInterval: 38, particles: 28, impactRadius: 100 },
};

export function playNorthernEnemyAttackEffect(scene: Phaser.Scene, options: NorthernEnemyAttackOptions): boolean {
  if (!isNorthernEnemy(options.enemyId)) {
    return false;
  }

  switch (options.enemyId) {
    case 'viking_warrior':
      playFlyingAxe(scene, options);
      break;
    case 'rune_shaman':
      playRuneOrb(scene, options);
      break;
    case 'valkyrie':
      playValkyrieSpear(scene, options);
      break;
    case 'einherjar':
      playSpiritBlade(scene, options);
      break;
  }
  return true;
}

function playFlyingAxe(scene: Phaser.Scene, options: NorthernEnemyAttackOptions): void {
  const resonance = options.resonance ?? 'none';
  const tier = TIERS[resonance];
  const visualTier = { ...tier, scale: tier.scale * 0.85 };
  const palette = [0x491016, 0xa82727, 0xe45335, 0xffa15d] as const;
  const projectile = scene.add.container(options.from.x, options.from.y).setDepth(43).setScale(visualTier.scale);
  const glow = scene.add.circle(0, 0, 33, palette[2], tier.glowAlpha).setBlendMode(Phaser.BlendModes.ADD);
  projectile.add([glow, createSingleBladeAxe(scene)]);
  scene.sound.play(resonance === 'none' ? 'attackFire' : 'attackWind', {
    volume: resonance === 'none' ? 0.48 : 0.56,
    rate: 0.88,
  });

  const flightAngle = Phaser.Math.Angle.Between(options.from.x, options.from.y, options.to.x, options.to.y);
  // The cutting edge sits left and slightly above the container origin. Rotate that
  // exact contact point toward the target, then offset the container so the blade,
  // rather than the handle, lands on the player.
  const bladeContact = new Phaser.Math.Vector2(39, -16);
  const bladeContactAngle = Math.atan2(bladeContact.y, bladeContact.x);
  // Flip the landing pose so the blade still makes contact while the handle
  // points downward instead of rising above the player.
  const impactRotation = flightAngle - bladeContactAngle + Math.PI - Math.PI / 2;
  const impactAngle = Phaser.Math.RadToDeg(impactRotation);
  const rotatedContact = bladeContact.clone().rotate(impactRotation).scale(visualTier.scale);
  const flightTarget = new Phaser.Math.Vector2(
    options.to.x - rotatedContact.x,
    options.to.y - rotatedContact.y,
  );
  playLinearFlight(scene, projectile, options, visualTier, 660, resonance === 'none' ? 760 : 1040, () => {
    spawnAxeAfterimage(scene, projectile.x, projectile.y, projectile.angle, visualTier.scale, tier.glowAlpha);
  }, palette, 'axe', false, impactAngle, flightTarget);
}

function playRuneOrb(scene: Phaser.Scene, options: NorthernEnemyAttackOptions): void {
  const resonance = options.resonance ?? 'none';
  const tier = TIERS[resonance];
  const palette = [0x0d3325, 0x2c8254, 0x7ad69b, 0xeafff2] as const;
  const projectile = scene.add.container(options.from.x, options.from.y).setDepth(43).setScale(tier.scale);
  const outer = scene.add.circle(0, 0, 33, palette[1], tier.glowAlpha).setBlendMode(Phaser.BlendModes.ADD);
  const inner = scene.add.circle(0, 0, 21, palette[2], 0.4).setBlendMode(Phaser.BlendModes.ADD);
  const core = scene.add.circle(0, 0, 11, palette[3], 0.96);
  const rune = createRuneMark(scene, palette[0], palette[3]);
  projectile.add([outer, inner, core, rune]);
  scene.tweens.add({ targets: rune, angle: -190, duration: 920, ease: 'Linear' });
  scene.tweens.add({ targets: [outer, inner], scale: { from: 0.86, to: 1.16 }, duration: 260, yoyo: true, repeat: -1 });
  scene.sound.play('attackWind', { volume: resonance === 'none' ? 0.46 : 0.56, rate: 0.8 });

  playLinearFlight(scene, projectile, options, tier, 720, 90, () => {
    spawnRuneMote(scene, projectile.x, projectile.y, palette, tier.glowAlpha);
  }, palette, 'rune');
}

function playValkyrieSpear(scene: Phaser.Scene, options: NorthernEnemyAttackOptions): void {
  const resonance = options.resonance ?? 'none';
  const tier = TIERS[resonance];
  const visualTier = { ...tier, scale: tier.scale * 0.85 };
  const palette = [0x1c405f, 0x4b91c2, 0xb8e4ff, 0xf7fcff] as const;
  const start = options.from.clone();
  const end = options.to.clone();
  const control = new Phaser.Math.Vector2((start.x + end.x) / 2, Math.min(start.y, end.y) - 132);
  const curve = new Phaser.Curves.QuadraticBezier(start, control, end);
  const projectile = scene.add.container(start.x, start.y).setDepth(43).setScale(visualTier.scale);
  const glow = scene.add.ellipse(0, 0, 148, 27, palette[1], tier.glowAlpha).setBlendMode(Phaser.BlendModes.ADD);
  projectile.add([glow, createLightSpear(scene, palette)]);
  scene.sound.play('attackWind', { volume: resonance === 'none' ? 0.5 : 0.6, rate: 1.08 });

  const progress = { value: 0 };
  let lastTrailAt = -Infinity;
  scene.tweens.add({
    targets: progress,
    value: 1,
    duration: 760,
    ease: 'Sine.easeInOut',
    onUpdate: () => {
      const point = curve.getPoint(progress.value);
      const tangent = curve.getTangent(Math.min(0.999, progress.value + 0.001));
      projectile.setPosition(snap(point.x), snap(point.y));
      projectile.setRotation(Math.atan2(tangent.y, tangent.x));
      if (scene.time.now - lastTrailAt >= visualTier.trailInterval) {
        lastTrailAt = scene.time.now;
        spawnSpearTrail(scene, point, tangent, visualTier, palette);
      }
    },
    onComplete: () => playImpact(scene, projectile, options, visualTier, palette, 'spear'),
  });
}

function playSpiritBlade(scene: Phaser.Scene, options: NorthernEnemyAttackOptions): void {
  const resonance = options.resonance ?? 'none';
  const tier = TIERS[resonance];
  const palette = [0x102a45, 0x236aa5, 0x52c9f2, 0xbceeff, 0xf7fdff] as const;
  const projectile = scene.add.container(options.from.x, options.from.y).setDepth(43).setScale(tier.scale * 0.72);
  const glow = scene.add.ellipse(-18, 0, 116, 72, palette[1], tier.glowAlpha * 0.74).setBlendMode(Phaser.BlendModes.ADD);
  projectile.add([glow, createSpiritCrescent(scene, palette)]);
  scene.sound.play('attackWind', { volume: resonance === 'none' ? 0.42 : 0.52, rate: 1.14 });

  playLinearFlight(scene, projectile, options, tier, 620, 0, () => {
    spawnSpiritAfterimage(scene, projectile.x, projectile.y, projectile.rotation, tier.scale, palette, tier.glowAlpha);
  }, palette, 'spirit', true);
}

function playLinearFlight(
  scene: Phaser.Scene,
  projectile: Phaser.GameObjects.Container,
  options: NorthernEnemyAttackOptions,
  tier: AttackTier,
  duration: number,
  spin: number,
  spawnTrail: () => void,
  palette: readonly number[],
  kind: ImpactKind,
  alignToPath = false,
  finalAngle?: number,
  flightTarget?: Phaser.Math.Vector2,
): void {
  if (alignToPath) {
    projectile.setRotation(Phaser.Math.Angle.Between(options.from.x, options.from.y, options.to.x, options.to.y));
  }
  let lastTrailAt = -Infinity;
  const turnDirection = Math.sign(spin) || 1;
  const fullTurns = Math.max(2, Math.floor(Math.abs(spin) / 360));
  const tweenAngle = finalAngle === undefined
    ? projectile.angle + spin
    : projectile.angle
      + turnDirection * fullTurns * 360
      + Phaser.Math.Angle.WrapDegrees(finalAngle - projectile.angle);
  scene.tweens.add({
    targets: projectile,
    x: flightTarget?.x ?? options.to.x,
    y: flightTarget?.y ?? options.to.y,
    angle: tweenAngle,
    duration,
    ease: 'Sine.easeInOut',
    onUpdate: () => {
      if (scene.time.now - lastTrailAt >= tier.trailInterval) {
        lastTrailAt = scene.time.now;
        spawnTrail();
      }
    },
    onComplete: () => {
      if (finalAngle !== undefined) {
        projectile.setAngle(finalAngle);
      }
      playImpact(scene, projectile, options, tier, palette, kind, flightTarget);
    },
  });
}

type ImpactKind = 'axe' | 'rune' | 'spear' | 'spirit';

function playImpact(
  scene: Phaser.Scene,
  projectile: Phaser.GameObjects.Container,
  options: NorthernEnemyAttackOptions,
  tier: AttackTier,
  palette: readonly number[],
  kind: ImpactKind,
  projectileImpactPosition?: Phaser.Math.Vector2,
): void {
  projectile.setPosition(
    projectileImpactPosition?.x ?? options.to.x,
    projectileImpactPosition?.y ?? options.to.y,
  );
  const ring = scene.add.circle(options.to.x, options.to.y, 14, palette[1] ?? 0xffffff, 0.16)
    .setStrokeStyle(kind === 'axe' ? 5 : 3, palette[3] ?? 0xffffff, 0.94)
    .setDepth(44);
  const flash = scene.add.circle(options.to.x, options.to.y, 9, palette[3] ?? 0xffffff, 0.9)
    .setDepth(45)
    .setBlendMode(Phaser.BlendModes.ADD);
  if (kind !== 'spear') {
    spawnImpactParticles(scene, options.to, tier, palette, kind);
  }

  if (kind === 'spear') {
    spawnSpearImpactBurst(scene, options.to, tier, palette);
  }

  // The short hold lets the eye register contact before HP and damage text update.
  scene.time.delayedCall(82, () => {
    options.onHit();
    scene.tweens.add({
      targets: [ring, flash],
      scale: tier.impactRadius / 14,
      alpha: 0,
      duration: 300,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        ring.destroy();
        flash.destroy();
      },
    });
    scene.tweens.add({
      targets: projectile,
      alpha: 0,
      scale: tier.scale * 1.22,
      duration: 240,
      ease: 'Cubic.easeOut',
      onComplete: () => projectile.destroy(true),
    });
    scene.time.delayedCall(320, () => options.onComplete?.());
  });
}

function createSingleBladeAxe(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const axe = scene.add.container(0, 0);
  const art = scene.add.graphics().setScale(-1, 1);

  art.fillStyle(0x241512, 1);
  art.fillRect(2, -34, 11, 88);
  art.fillStyle(0x6a3c26, 1);
  art.fillRect(3, -35, 8, 86);
  art.lineStyle(2, 0xb97745, 1);
  art.strokeRect(3, -35, 8, 86);
  art.fillStyle(0x2b1814, 1);
  art.fillRect(1, 40, 12, 13);
  art.lineStyle(1, 0x8f5532, 1);
  art.strokeRect(1, 40, 12, 13);

  art.fillStyle(0x596168, 1);
  art.lineStyle(3, 0xe25a38, 1);
  art.beginPath();
  art.moveTo(-39, -36);
  art.lineTo(-43, -25);
  art.lineTo(-42, -13);
  art.lineTo(-37, -3);
  art.lineTo(-28, 6);
  art.lineTo(-18, -10);
  art.lineTo(-13, -20);
  art.lineTo(14, -20);
  art.lineTo(22, -25);
  art.lineTo(21, -34);
  art.lineTo(12, -38);
  art.closePath();
  art.fillPath();
  art.strokePath();

  art.fillStyle(0x353b40, 1);
  art.fillRect(0, -36, 14, 19);
  art.lineStyle(2, 0xaeb5ba, 0.9);
  art.strokeRect(0, -36, 14, 19);
  art.lineStyle(2, 0x9ca3a8, 0.9);
  art.beginPath();
  art.moveTo(-12, -27);
  art.lineTo(18, -27);
  art.strokePath();
  art.lineStyle(4, 0xffad69, 1);
  art.beginPath();
  art.moveTo(-39, -36);
  art.lineTo(-43, -25);
  art.lineTo(-42, -13);
  art.lineTo(-37, -3);
  art.lineTo(-28, 6);
  art.strokePath();

  axe.add(art);
  return axe;
}

function createRuneMark(scene: Phaser.Scene, dark: number, light: number): Phaser.GameObjects.Graphics {
  const rune = scene.add.graphics();
  rune.lineStyle(3, dark, 1);
  rune.beginPath();
  rune.moveTo(-5, -8);
  rune.lineTo(-5, 9);
  rune.moveTo(-5, -7);
  rune.lineTo(7, -2);
  rune.lineTo(-5, 2);
  rune.moveTo(0, 1);
  rune.lineTo(8, 9);
  rune.strokePath();
  rune.lineStyle(1, light, 0.9);
  rune.strokeCircle(0, 0, 14);
  return rune;
}

function createLightSpear(scene: Phaser.Scene, palette: readonly number[]): Phaser.GameObjects.Container {
  const spear = scene.add.container(0, 0);
  const art = scene.add.graphics();

  art.fillStyle(0x201711, 1);
  art.fillRect(-73, -2, 101, 8);
  art.fillStyle(0x754529, 1);
  art.fillRect(-74, -3, 101, 6);
  art.lineStyle(1, 0xc08754, 1);
  art.strokeRect(-74, -3, 101, 6);
  art.fillStyle(palette[0], 1);
  art.fillCircle(-76, 0, 7);
  art.lineStyle(2, palette[2], 1);
  art.strokeCircle(-76, 0, 7);
  art.fillStyle(palette[3], 0.9);
  art.fillCircle(-76, 0, 3);
  art.fillStyle(palette[1], 1);
  art.fillRect(-71, -6, 9, 12);
  art.lineStyle(1, palette[3], 0.9);
  art.strokeRect(-71, -6, 9, 12);

  art.fillStyle(palette[1], 1);
  art.lineStyle(2, palette[3], 1);
  art.beginPath();
  art.moveTo(12, -8);
  art.lineTo(40, -6);
  art.lineTo(48, 0);
  art.lineTo(40, 6);
  art.lineTo(12, 8);
  art.closePath();
  art.fillPath();
  art.strokePath();
  art.fillStyle(palette[2], 1);
  art.fillTriangle(23, -7, 40, -17, 35, -5);
  art.fillTriangle(23, 7, 40, 17, 35, 5);
  art.lineStyle(1, palette[3], 0.9);
  art.strokeTriangle(23, -7, 40, -17, 35, -5);
  art.strokeTriangle(23, 7, 40, 17, 35, 5);

  art.fillStyle(palette[2], 1);
  art.lineStyle(3, palette[3], 1);
  art.beginPath();
  art.moveTo(33, -10);
  art.lineTo(59, -13);
  art.lineTo(87, 0);
  art.lineTo(59, 13);
  art.lineTo(33, 10);
  art.lineTo(44, 0);
  art.closePath();
  art.fillPath();
  art.strokePath();
  art.fillStyle(palette[0], 1);
  art.fillRect(25, -10, 8, 20);
  art.lineStyle(2, palette[3], 0.9);
  art.strokeRect(25, -10, 8, 20);
  art.lineStyle(2, palette[3], 0.94);
  art.beginPath();
  art.moveTo(36, 0);
  art.lineTo(84, 0);
  art.strokePath();

  spear.add(art);
  return spear;
}

function createSpiritCrescent(
  scene: Phaser.Scene,
  palette: readonly number[],
  includeSpeedLines = true,
): Phaser.GameObjects.Container {
  const crescent = scene.add.container(0, 0);

  if (includeSpeedLines) {
    const speedLines = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    const lines = [
      { y: -34, start: -104, end: -25, width: 2, alpha: 0.34, color: palette[1] },
      { y: -25, start: -126, end: -14, width: 3, alpha: 0.52, color: palette[2] },
      { y: -15, start: -92, end: 2, width: 2, alpha: 0.68, color: palette[3] },
      { y: -7, start: -138, end: 11, width: 4, alpha: 0.46, color: palette[1] },
      { y: 2, start: -118, end: 20, width: 3, alpha: 0.72, color: palette[2] },
      { y: 11, start: -146, end: 8, width: 2, alpha: 0.46, color: palette[3] },
      { y: 21, start: -108, end: -8, width: 3, alpha: 0.56, color: palette[1] },
      { y: 31, start: -124, end: -24, width: 2, alpha: 0.34, color: palette[2] },
    ];
    lines.forEach((line) => {
      speedLines.lineStyle(line.width, line.color ?? palette[2], line.alpha);
      speedLines.beginPath();
      speedLines.moveTo(line.start, line.y);
      speedLines.lineTo(line.end, line.y);
      speedLines.strokePath();
    });
    crescent.add(speedLines);
  }

  const points = [
    -20, -58,
    7, -51,
    28, -31,
    39, 0,
    28, 31,
    7, 51,
    -20, 58,
    -3, 38,
    8, 21,
    13, 0,
    8, -21,
    -3, -38,
  ];
  const aura = scene.add.polygon(0, 0, points, palette[1], 0.26)
    .setScale(1.18)
    .setBlendMode(Phaser.BlendModes.ADD);
  const blade = scene.add.polygon(0, 0, points, palette[2], 0.96)
    .setStrokeStyle(3, palette[4] ?? 0xffffff, 1)
    .setBlendMode(Phaser.BlendModes.ADD);
  const core = scene.add.polygon(2, 0, points, palette[3], 0.58)
    .setScale(0.82, 0.9)
    .setBlendMode(Phaser.BlendModes.ADD);

  crescent.add([aura, blade, core]);
  return crescent;
}

function spawnAxeAfterimage(scene: Phaser.Scene, x: number, y: number, angle: number, scale: number, alpha: number): void {
  const echo = createSingleBladeAxe(scene).setPosition(x, y).setDepth(40).setAngle(angle).setScale(scale).setAlpha(Math.max(0.18, alpha));
  scene.tweens.add({ targets: echo, alpha: 0, scale: scale * 0.62, duration: 280, onComplete: () => echo.destroy(true) });
}

function spawnRuneMote(scene: Phaser.Scene, x: number, y: number, palette: readonly number[], alpha: number): void {
  const mote = scene.add.rectangle(x, y, 7, 7, palette[Phaser.Math.Between(1, 3)] ?? palette[2], Math.max(0.42, alpha))
    .setDepth(40)
    .setAngle(45);
  scene.tweens.add({
    targets: mote,
    x: x + Phaser.Math.Between(-18, 18),
    y: y + Phaser.Math.Between(-18, 18),
    alpha: 0,
    scale: 0.35,
    duration: 360,
    onComplete: () => mote.destroy(),
  });
}

function spawnSpearTrail(
  scene: Phaser.Scene,
  point: Phaser.Math.Vector2,
  tangent: Phaser.Math.Vector2,
  tier: AttackTier,
  palette: readonly number[],
): void {
  const rotation = Math.atan2(tangent.y, tangent.x);
  const tailX = point.x - tangent.x * 58 * tier.scale;
  const tailY = point.y - tangent.y * 58 * tier.scale;
  const trail = scene.add.container(tailX, tailY).setDepth(40).setRotation(rotation);
  const halo = scene.add.ellipse(0, 0, 138 * tier.scale, 18 * tier.scale, palette[1], Math.max(0.18, tier.glowAlpha * 0.72))
    .setBlendMode(Phaser.BlendModes.ADD);
  const body = scene.add.rectangle(0, 0, 126 * tier.scale, 7 * tier.scale, palette[2], Math.max(0.5, tier.glowAlpha + 0.18))
    .setBlendMode(Phaser.BlendModes.ADD);
  const core = scene.add.rectangle(18 * tier.scale, 0, 94 * tier.scale, 2 * tier.scale, palette[3], 0.9)
    .setBlendMode(Phaser.BlendModes.ADD);
  trail.add([halo, body, core]);
  scene.tweens.add({
    targets: trail,
    alpha: 0,
    scaleX: 0.6,
    scaleY: 0.55,
    duration: 430,
    ease: 'Cubic.easeOut',
    onComplete: () => trail.destroy(true),
  });

  for (let index = 0; index < 2; index += 1) {
    const mote = scene.add.circle(
      tailX + Phaser.Math.Between(-20, 20),
      tailY + Phaser.Math.Between(-8, 8),
      Phaser.Math.Between(2, 4),
      palette[index + 1] ?? palette[2],
      0.76,
    ).setDepth(40).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: mote,
      x: mote.x - tangent.x * Phaser.Math.Between(24, 48),
      y: mote.y - tangent.y * Phaser.Math.Between(24, 48) + Phaser.Math.Between(-10, 10),
      alpha: 0,
      scale: 0.3,
      duration: Phaser.Math.Between(300, 440),
      onComplete: () => mote.destroy(),
    });
  }
}

function spawnSpiritAfterimage(
  scene: Phaser.Scene,
  x: number,
  y: number,
  rotation: number,
  scale: number,
  palette: readonly number[],
  alpha: number,
): void {
  const echo = createSpiritCrescent(scene, palette, false).setPosition(x, y).setRotation(rotation).setScale(scale * 0.66)
    .setAlpha(Math.max(0.16, alpha * 0.74)).setDepth(40);
  scene.tweens.add({
    targets: echo,
    alpha: 0,
    scaleX: scale * 0.46,
    scaleY: scale * 0.58,
    duration: 260,
    ease: 'Cubic.easeOut',
    onComplete: () => echo.destroy(true),
  });
}

function spawnSpearImpactBurst(
  scene: Phaser.Scene,
  target: Phaser.Math.Vector2,
  tier: AttackTier,
  palette: readonly number[],
): void {
  const burstCount = Math.round(tier.particles * 0.75);
  for (let index = 0; index < burstCount; index += 1) {
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const distance = Phaser.Math.Between(34, Math.round(tier.impactRadius * 1.15));
    const particle = scene.add.circle(
      target.x,
      target.y,
      Phaser.Math.Between(2, 5),
      palette[Phaser.Math.Between(1, 3)] ?? palette[2],
      0.94,
    ).setDepth(46).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: particle,
      x: target.x + Math.cos(angle) * distance,
      y: target.y + Math.sin(angle) * distance,
      alpha: 0,
      scale: 0.25,
      duration: Phaser.Math.Between(380, 620),
      ease: 'Cubic.easeOut',
      onComplete: () => particle.destroy(),
    });
  }
}

function spawnImpactParticles(
  scene: Phaser.Scene,
  target: Phaser.Math.Vector2,
  tier: AttackTier,
  palette: readonly number[],
  kind: ImpactKind,
): void {
  for (let index = 0; index < tier.particles; index += 1) {
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const distance = Phaser.Math.Between(28, tier.impactRadius);
    const elongated = kind === 'axe' || kind === 'spear';
    const particle = scene.add.rectangle(
      target.x,
      target.y,
      elongated ? Phaser.Math.Between(3, 6) : Phaser.Math.Between(4, 8),
      elongated ? Phaser.Math.Between(10, 22) : Phaser.Math.Between(4, 8),
      palette[index % palette.length] ?? 0xffffff,
      0.9,
    ).setDepth(45).setRotation(angle);
    scene.tweens.add({
      targets: particle,
      x: target.x + Math.cos(angle) * distance,
      y: target.y + Math.sin(angle) * distance,
      alpha: 0,
      scale: 0.45,
      duration: Phaser.Math.Between(360, 560),
      ease: 'Cubic.easeOut',
      onComplete: () => particle.destroy(),
    });
  }
}

function isNorthernEnemy(enemyId: EnemyId): enemyId is NorthernEnemyId {
  return enemyId === 'viking_warrior' || enemyId === 'rune_shaman' || enemyId === 'valkyrie' || enemyId === 'einherjar';
}

function snap(value: number): number {
  return Phaser.Math.Snap.To(value, 2);
}

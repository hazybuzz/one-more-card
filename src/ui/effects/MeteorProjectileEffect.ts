import Phaser from 'phaser';
import type { ResonanceKind } from '../../game/scoring';

export interface MeteorProjectilePalette {
  outerGlow: number;
  innerGlow: number;
  tailOuter: number;
  tailMiddle: number;
  tailCore: number;
}

export interface MeteorProjectileTier {
  size: number;
  outerGlowRadius: number;
  innerGlowRadius: number;
  tailLength: number;
  tailWidth: number;
  trailInterval: number;
  trailAlpha: number;
  impactScale: number;
}

export interface MeteorProjectileOptions {
  from: Phaser.Math.Vector2;
  to: Phaser.Math.Vector2;
  textureKey: string;
  palette: MeteorProjectilePalette;
  resonance?: ResonanceKind;
  rotationOffset?: number;
  travelRotation?: Partial<Record<ResonanceKind, number>>;
  tiers?: Partial<Record<ResonanceKind, Partial<MeteorProjectileTier>>>;
  depth?: number;
  soundKey?: string;
  soundKeys?: Partial<Record<ResonanceKind, string>>;
  soundVolumes?: Partial<Record<ResonanceKind, number>>;
  shakeStrongAttack?: boolean;
  onHit: () => void;
  onComplete: () => void;
}

const DEFAULT_TIERS: Record<ResonanceKind, MeteorProjectileTier> = {
  none: {
    size: 64,
    outerGlowRadius: 31,
    innerGlowRadius: 19,
    tailLength: 112,
    tailWidth: 17,
    trailInterval: 78,
    trailAlpha: 0.16,
    impactScale: 1.12,
  },
  resonance: {
    size: 82,
    outerGlowRadius: 42,
    innerGlowRadius: 25,
    tailLength: 150,
    tailWidth: 23,
    trailInterval: 58,
    trailAlpha: 0.23,
    impactScale: 1.22,
  },
  strong: {
    size: 100,
    outerGlowRadius: 52,
    innerGlowRadius: 31,
    tailLength: 190,
    tailWidth: 30,
    trailInterval: 46,
    trailAlpha: 0.28,
    impactScale: 1.3,
  },
  boom: {
    size: 112,
    outerGlowRadius: 60,
    innerGlowRadius: 36,
    tailLength: 218,
    tailWidth: 34,
    trailInterval: 40,
    trailAlpha: 0.34,
    impactScale: 1.4,
  },
};

const DEFAULT_TRAVEL_ROTATION: Record<ResonanceKind, number> = {
  none: 7,
  resonance: 12,
  strong: 18,
  boom: 22,
};

const DEFAULT_SOUND_VOLUMES: Record<ResonanceKind, number> = {
  none: 0.46,
  resonance: 0.54,
  strong: 0.6,
  boom: 0.66,
};

export function playMeteorProjectileEffect(scene: Phaser.Scene, options: MeteorProjectileOptions): void {
  const resonance = options.resonance ?? 'none';
  const strong = resonance === 'strong' || resonance === 'boom';
  const tier = resolveTier(resonance, options.tiers);
  const angle = Phaser.Math.Angle.Between(options.from.x, options.from.y, options.to.x, options.to.y);
  const direction = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle));
  const distance = Phaser.Math.Distance.Between(options.from.x, options.from.y, options.to.x, options.to.y);
  const start = options.from.clone().add(direction.scale(Math.min(30, distance * 0.07)));
  const projectileDepth = options.depth ?? 42;
  const projectile = scene.add.container(start.x, start.y).setDepth(projectileDepth);
  const meteorTail = createMeteorTail(scene, tier, resonance, options.palette);
  meteorTail.setRotation(angle);
  const outerGlow = scene.add.circle(0, 0, tier.outerGlowRadius, options.palette.outerGlow, 0.14)
    .setBlendMode(Phaser.BlendModes.ADD);
  const innerGlow = scene.add.circle(0, 0, tier.innerGlowRadius, options.palette.innerGlow, 0.26)
    .setBlendMode(Phaser.BlendModes.ADD);
  const art = scene.add.image(0, 0, options.textureKey)
    .setDisplaySize(tier.size, tier.size)
    .setRotation(angle + (options.rotationOffset ?? 0));
  projectile.add([meteorTail, outerGlow, innerGlow, art]);
  projectile.setScale(0.76).setAlpha(1);

  const glowTween = scene.tweens.add({
    targets: outerGlow,
    alpha: { from: strong ? 0.2 : 0.12, to: resonance === 'none' ? 0.24 : 0.42 },
    scale: { from: 0.9, to: strong ? 1.22 : 1.12 },
    duration: strong ? 420 : 520,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  const tailTween = scene.tweens.add({
    targets: meteorTail,
    scaleX: { from: 0.88, to: 1.08 },
    alpha: { from: resonance === 'none' ? 0.78 : 0.9, to: 1 },
    duration: strong ? 260 : 340,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  const soundKey = options.soundKeys?.[resonance] ?? options.soundKey;
  if (soundKey) {
    scene.sound.play(soundKey, {
      volume: options.soundVolumes?.[resonance] ?? DEFAULT_SOUND_VOLUMES[resonance],
    });
  }

  const duration = Phaser.Math.Clamp(520 + distance * 0.28, 600, 760);
  let lastTrailAt = -Infinity;
  scene.tweens.add({
    targets: projectile,
    x: options.to.x,
    y: options.to.y,
    scaleX: 1,
    scaleY: 1,
    angle: options.travelRotation?.[resonance] ?? DEFAULT_TRAVEL_ROTATION[resonance],
    duration,
    ease: 'Sine.easeInOut',
    onUpdate: () => {
      if (scene.time.now - lastTrailAt < tier.trailInterval) {
        return;
      }
      lastTrailAt = scene.time.now;
      spawnAfterimage(scene, projectile, art.rotation, tier, options.textureKey, options.palette, projectileDepth);
    },
    onComplete: () => {
      glowTween.stop();
      tailTween.stop();
      playImpact(scene, projectile, outerGlow, innerGlow, art, resonance, tier, options);
    },
  });
}

function resolveTier(
  resonance: ResonanceKind,
  overrides?: Partial<Record<ResonanceKind, Partial<MeteorProjectileTier>>>,
): MeteorProjectileTier {
  return {
    ...DEFAULT_TIERS[resonance],
    ...overrides?.[resonance],
  };
}

function createMeteorTail(
  scene: Phaser.Scene,
  tier: MeteorProjectileTier,
  resonance: ResonanceKind,
  palette: MeteorProjectilePalette,
): Phaser.GameObjects.Graphics {
  const tail = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const strength = resonance === 'strong' || resonance === 'boom' ? 1 : resonance === 'resonance' ? 0.86 : 0.68;
  tail.fillStyle(palette.tailOuter, 0.2 * strength);
  tail.fillTriangle(5, -tier.tailWidth, -tier.tailLength, 0, 5, tier.tailWidth);
  tail.fillStyle(palette.tailMiddle, 0.32 * strength);
  tail.fillTriangle(7, -tier.tailWidth * 0.58, -tier.tailLength * 0.82, 0, 7, tier.tailWidth * 0.58);
  tail.fillStyle(palette.tailCore, 0.56 * strength);
  tail.fillTriangle(8, -tier.tailWidth * 0.22, -tier.tailLength * 0.58, 0, 8, tier.tailWidth * 0.22);
  return tail;
}

function spawnAfterimage(
  scene: Phaser.Scene,
  projectile: Phaser.GameObjects.Container,
  artRotation: number,
  tier: MeteorProjectileTier,
  textureKey: string,
  palette: MeteorProjectilePalette,
  projectileDepth: number,
): void {
  const glow = scene.add.circle(
    projectile.x,
    projectile.y,
    tier.innerGlowRadius,
    palette.outerGlow,
    tier.trailAlpha * 0.7,
  ).setDepth(projectileDepth - 3).setBlendMode(Phaser.BlendModes.ADD);
  const echo = scene.add.image(projectile.x, projectile.y, textureKey)
    .setDisplaySize(tier.size, tier.size)
    .setRotation(artRotation + Phaser.Math.DegToRad(projectile.angle))
    .setAlpha(tier.trailAlpha)
    .setDepth(projectileDepth - 2)
    .setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: [glow, echo],
    alpha: 0,
    scaleX: 0.68,
    scaleY: 0.68,
    duration: 300,
    ease: 'Quad.easeOut',
    onComplete: () => {
      glow.destroy();
      echo.destroy();
    },
  });
}

function playImpact(
  scene: Phaser.Scene,
  projectile: Phaser.GameObjects.Container,
  outerGlow: Phaser.GameObjects.Arc,
  innerGlow: Phaser.GameObjects.Arc,
  art: Phaser.GameObjects.Image,
  resonance: ResonanceKind,
  tier: MeteorProjectileTier,
  options: MeteorProjectileOptions,
): void {
  const strong = resonance === 'strong' || resonance === 'boom';
  outerGlow.setAlpha(strong ? 0.58 : resonance === 'resonance' ? 0.46 : 0.3);
  innerGlow.setAlpha(strong ? 0.72 : resonance === 'resonance' ? 0.58 : 0.4);
  if (strong && options.shakeStrongAttack !== false) {
    scene.cameras.main.shake(130, 0.0035);
  }

  scene.tweens.add({
    targets: projectile,
    scaleX: tier.impactScale,
    scaleY: tier.impactScale,
    duration: 80,
    ease: 'Cubic.easeOut',
    onComplete: () => {
      options.onHit();
      scene.tweens.add({
        targets: projectile,
        alpha: 0,
        scaleX: tier.impactScale * 1.16,
        scaleY: tier.impactScale * 1.16,
        duration: strong ? 280 : 230,
        ease: 'Quad.easeOut',
        onComplete: () => {
          projectile.destroy(true);
          options.onComplete();
        },
      });
    },
  });

  scene.tweens.add({
    targets: art,
    angle: art.angle + (strong ? 34 : 18),
    duration: strong ? 300 : 250,
    ease: 'Sine.easeOut',
  });
}

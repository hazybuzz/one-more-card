import Phaser from 'phaser';
import type { ResonanceKind } from '../../game/scoring';
import type { EnemyId } from '../../game/types/enemy';
import {
  playMeteorProjectileEffect,
  type MeteorProjectilePalette,
  type MeteorProjectileTier,
} from './MeteorProjectileEffect';

type EdoAttackEnemyId = Extract<EnemyId, 'shogun_samurai' | 'ninja' | 'oiran'>;

export interface EdoEnemyAttackOptions {
  enemyId: EnemyId;
  from: Phaser.Math.Vector2;
  to: Phaser.Math.Vector2;
  resonance?: ResonanceKind;
  iaijutsu?: boolean;
  onHit: () => void;
  onComplete?: () => void;
}

interface EdoAttackArtConfig {
  textureKey: string;
  path: string;
  palette: MeteorProjectilePalette;
  tint?: number;
  artGlowAlpha?: number;
  artSpin?: Partial<Record<ResonanceKind, number>>;
  rotationOffset?: number;
  travelRotation: Partial<Record<ResonanceKind, number>>;
  tiers: Partial<Record<ResonanceKind, Partial<MeteorProjectileTier>>>;
}

const BLUE_SLASH: MeteorProjectilePalette = {
  outerGlow: 0x173f78,
  innerGlow: 0x7ddcff,
  tailOuter: 0x07152d,
  tailMiddle: 0x1768ad,
  tailCore: 0xc9f5ff,
};

const GOLD_SLASH: MeteorProjectilePalette = {
  outerGlow: 0x7f470c,
  innerGlow: 0xffcf55,
  tailOuter: 0x2b1604,
  tailMiddle: 0xc17a17,
  tailCore: 0xfff0a3,
};

const EDO_ATTACK_ART: Record<EdoAttackEnemyId, EdoAttackArtConfig> = {
  shogun_samurai: {
    textureKey: 'effect-edo-samurai-crescent',
    path: '/image/battle/effects/edo-teahouse/samurai-crescent.png',
    palette: BLUE_SLASH,
    tint: 0x9ddfff,
    travelRotation: { none: 2, resonance: 4, strong: 6, boom: 8 },
    tiers: {
      none: { size: 72, tailLength: 132, tailWidth: 18, trailAlpha: 0.2 },
      resonance: { size: 90, tailLength: 174, tailWidth: 25, trailAlpha: 0.28 },
      strong: { size: 106, tailLength: 208, tailWidth: 31, trailAlpha: 0.34 },
      boom: { size: 118, tailLength: 232, tailWidth: 36, trailAlpha: 0.4 },
    },
  },
  ninja: {
    textureKey: 'effect-edo-ninja-kunai',
    path: '/image/battle/effects/edo-teahouse/ninja-kunai.png',
    palette: {
      outerGlow: 0x596777,
      innerGlow: 0xe8f4f7,
      tailOuter: 0x161a22,
      tailMiddle: 0x778b9b,
      tailCore: 0xffffff,
    },
    tint: 0xeaf3f5,
    artGlowAlpha: 0.34,
    travelRotation: { none: 0, resonance: 0, strong: 0, boom: 0 },
    tiers: {
      none: { size: 86, outerGlowRadius: 40, innerGlowRadius: 24, tailLength: 128, tailWidth: 15, trailAlpha: 0.25 },
      resonance: { size: 106, outerGlowRadius: 52, innerGlowRadius: 31, tailLength: 170, tailWidth: 21, trailAlpha: 0.32 },
      strong: { size: 124, outerGlowRadius: 62, innerGlowRadius: 37, tailLength: 204, tailWidth: 27, trailAlpha: 0.38 },
      boom: { size: 138, outerGlowRadius: 70, innerGlowRadius: 42, tailLength: 232, tailWidth: 31, trailAlpha: 0.43 },
    },
  },
  oiran: {
    textureKey: 'effect-edo-oiran-fan',
    path: '/image/battle/effects/edo-teahouse/oiran-fan.png',
    palette: {
      outerGlow: 0x8b2347,
      innerGlow: 0xff9eb6,
      tailOuter: 0x250711,
      tailMiddle: 0xc32f5b,
      tailCore: 0xffd5b0,
    },
    artGlowAlpha: 0.3,
    artSpin: { none: 360, resonance: 480, strong: 600, boom: 720 },
    rotationOffset: -Math.PI / 2,
    travelRotation: { none: 2, resonance: 3, strong: 4, boom: 5 },
    tiers: {
      none: { size: 82, outerGlowRadius: 43, innerGlowRadius: 26, tailLength: 126, tailWidth: 23, trailInterval: 58, trailAlpha: 0.28 },
      resonance: { size: 102, outerGlowRadius: 55, innerGlowRadius: 33, tailLength: 168, tailWidth: 30, trailInterval: 46, trailAlpha: 0.35 },
      strong: { size: 118, outerGlowRadius: 65, innerGlowRadius: 39, tailLength: 202, tailWidth: 37, trailInterval: 38, trailAlpha: 0.42 },
      boom: { size: 132, outerGlowRadius: 73, innerGlowRadius: 44, tailLength: 228, tailWidth: 42, trailInterval: 32, trailAlpha: 0.48 },
    },
  },
};

export function preloadEdoEnemyAttackEffects(scene: Phaser.Scene): void {
  Object.values(EDO_ATTACK_ART).forEach(({ textureKey, path }) => {
    if (!scene.textures.exists(textureKey)) {
      scene.load.image(textureKey, path);
    }
  });
}

export function playEdoEnemyAttackEffect(scene: Phaser.Scene, options: EdoEnemyAttackOptions): boolean {
  if (!isEdoAttackEnemy(options.enemyId)) {
    return false;
  }

  const enemyId = options.enemyId;
  const config = EDO_ATTACK_ART[enemyId];
  const iaijutsu = enemyId === 'shogun_samurai' && options.iaijutsu === true;
  const resonance = options.resonance ?? 'none';
  playMeteorProjectileEffect(scene, {
    from: options.from,
    to: options.to,
    resonance,
    textureKey: config.textureKey,
    artTint: iaijutsu ? 0xffd45c : config.tint,
    artGlowAlpha: config.artGlowAlpha,
    artSpin: config.artSpin,
    palette: iaijutsu ? GOLD_SLASH : config.palette,
    rotationOffset: config.rotationOffset,
    travelRotation: config.travelRotation,
    tiers: config.tiers,
    soundKey: 'attackWind',
    soundVolumes: { none: 0.46, resonance: 0.54, strong: 0.6, boom: 0.64 },
    onHit: () => {
      spawnEdoImpact(scene, enemyId, options.to, resonance, iaijutsu);
      options.onHit();
    },
    onComplete: options.onComplete ?? (() => undefined),
  });
  return true;
}

function spawnEdoImpact(
  scene: Phaser.Scene,
  enemyId: EdoAttackEnemyId,
  point: Phaser.Math.Vector2,
  resonance: ResonanceKind,
  iaijutsu: boolean,
): void {
  const count = resonance === 'boom' ? 22 : resonance === 'strong' ? 17 : resonance === 'resonance' ? 12 : 8;
  const colors = enemyId === 'oiran'
    ? [0x7f1738, 0xd84f72, 0xffa4b7, 0xd4a65d]
    : enemyId === 'ninja'
      ? [0x403650, 0x8997a3, 0xdce7eb]
      : iaijutsu
        ? [0x9b5d14, 0xe6a72c, 0xffe58a]
        : [0x1d65a8, 0x63c6ee, 0xd8f7ff];

  for (let index = 0; index < count; index += 1) {
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const distance = Phaser.Math.Between(26, resonance === 'none' ? 58 : 82);
    const color = colors[index % colors.length] ?? 0xffffff;
    const particle = enemyId === 'oiran'
      ? scene.add.ellipse(point.x, point.y, 8, 4, color, 0.9).setRotation(angle)
      : scene.add.rectangle(point.x, point.y, Phaser.Math.Between(3, 7), Phaser.Math.Between(1, 3), color, 0.92).setRotation(angle);
    particle.setDepth(47).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: particle,
      x: point.x + Math.cos(angle) * distance,
      y: point.y + Math.sin(angle) * distance,
      angle: particle.angle + Phaser.Math.Between(-90, 90),
      alpha: 0,
      scale: 0.35,
      duration: Phaser.Math.Between(280, 480),
      ease: 'Cubic.easeOut',
      onComplete: () => particle.destroy(),
    });
  }
}

function isEdoAttackEnemy(enemyId: EnemyId): enemyId is EdoAttackEnemyId {
  return enemyId === 'shogun_samurai' || enemyId === 'ninja' || enemyId === 'oiran';
}

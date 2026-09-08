import Phaser from 'phaser';
import type { ResonanceKind } from '../../game/scoring';
import type { EnemyId } from '../../game/types/enemy';
import {
  playMeteorProjectileEffect,
  type MeteorProjectileOptions,
  type MeteorProjectilePalette,
  type MeteorProjectileTier,
} from './MeteorProjectileEffect';

type EvernightAttackEnemyId = Extract<EnemyId, 'goblin' | 'gambler' | 'werewolf'>;

interface EnemyAttackArtConfig {
  textureKey: string;
  path: string;
  palette: MeteorProjectilePalette;
  rotationOffset?: number;
  travelRotation?: Partial<Record<ResonanceKind, number>>;
  tiers: Partial<Record<ResonanceKind, Partial<MeteorProjectileTier>>>;
}

interface EvernightEnemyAttackOptions {
  enemyId: EnemyId;
  from: Phaser.Math.Vector2;
  to: Phaser.Math.Vector2;
  resonance?: ResonanceKind;
  onHit: () => void;
  onComplete?: () => void;
}

const EVERNIGHT_ATTACK_ART: Record<EvernightAttackEnemyId, EnemyAttackArtConfig> = {
  goblin: {
    textureKey: 'effect-enemy-goblin-rust-dagger',
    path: '/image/battle/effects/enemies/goblin-rust-dagger.png',
    palette: {
      outerGlow: 0x315c32,
      innerGlow: 0x78a85a,
      tailOuter: 0x102417,
      tailMiddle: 0x315f34,
      tailCore: 0x91b86b,
    },
    travelRotation: { none: 3, resonance: 6, strong: 9 },
    tiers: {
      none: { size: 72, tailLength: 104, tailWidth: 14 },
      resonance: { size: 92, tailLength: 148, tailWidth: 21 },
      strong: { size: 110, tailLength: 184, tailWidth: 27 },
    },
  },
  gambler: {
    textureKey: 'effect-enemy-gambler-red-card',
    path: '/image/battle/effects/enemies/gambler-red-card.png',
    palette: {
      outerGlow: 0xb51023,
      innerGlow: 0xff8a8a,
      tailOuter: 0x3b0610,
      tailMiddle: 0xbd1028,
      tailCore: 0xffb0a6,
    },
    travelRotation: { none: 12, resonance: 24, strong: 38 },
    tiers: {
      none: { size: 68, tailLength: 110, tailWidth: 17 },
      resonance: { size: 88, tailLength: 156, tailWidth: 24 },
      strong: { size: 106, tailLength: 194, tailWidth: 31 },
    },
  },
  werewolf: {
    textureKey: 'effect-enemy-werewolf-blood-claw',
    path: '/image/battle/effects/enemies/werewolf-blood-claw.png',
    palette: {
      outerGlow: 0xa00018,
      innerGlow: 0xff5a58,
      tailOuter: 0x180307,
      tailMiddle: 0x8d0014,
      tailCore: 0xff7770,
    },
    travelRotation: { none: 2, resonance: 4, strong: 6 },
    tiers: {
      none: { size: 78, tailLength: 116, tailWidth: 20 },
      resonance: { size: 100, tailLength: 164, tailWidth: 28 },
      strong: { size: 120, tailLength: 204, tailWidth: 36 },
    },
  },
};

export function preloadEvernightEnemyAttackEffects(scene: Phaser.Scene): void {
  Object.values(EVERNIGHT_ATTACK_ART).forEach(({ textureKey, path }) => {
    if (!scene.textures.exists(textureKey)) {
      scene.load.image(textureKey, path);
    }
  });
}

export function playEvernightEnemyAttackEffect(
  scene: Phaser.Scene,
  options: EvernightEnemyAttackOptions,
): boolean {
  if (!isEvernightAttackEnemy(options.enemyId)) {
    return false;
  }

  const config = EVERNIGHT_ATTACK_ART[options.enemyId];
  const projectileOptions: MeteorProjectileOptions = {
    from: options.from,
    to: options.to,
    resonance: options.resonance,
    textureKey: config.textureKey,
    palette: config.palette,
    rotationOffset: config.rotationOffset,
    travelRotation: config.travelRotation,
    tiers: config.tiers,
    soundKeys: {
      none: 'attackFire',
      resonance: 'attackWind',
      strong: 'attackWind',
    },
    onHit: options.onHit,
    onComplete: options.onComplete ?? (() => undefined),
  };
  playMeteorProjectileEffect(scene, projectileOptions);
  return true;
}

function isEvernightAttackEnemy(enemyId: EnemyId): enemyId is EvernightAttackEnemyId {
  return enemyId === 'goblin' || enemyId === 'gambler' || enemyId === 'werewolf';
}

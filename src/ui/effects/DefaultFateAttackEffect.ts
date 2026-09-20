import Phaser from 'phaser';
import { playResonanceGather, playResonanceBloom } from './ResonanceWeaponAccent';
import type { ResonanceKind } from '../../game/scoring';
import { playMeteorProjectileEffect } from './MeteorProjectileEffect';

const FATE_SHARD_ART = {
  textureKey: 'effect-default-fate-shard',
  path: '/image/battle/effects/default-fate/fate-shard.png',
} as const;

interface DefaultFateAttackOptions {
  from: Phaser.Math.Vector2;
  to: Phaser.Math.Vector2;
  resonance?: ResonanceKind;
  onHit: () => void;
  onComplete: () => void;
}

export function preloadDefaultFateAttackEffect(scene: Phaser.Scene): void {
  if (!scene.textures.exists(FATE_SHARD_ART.textureKey)) {
    scene.load.image(FATE_SHARD_ART.textureKey, FATE_SHARD_ART.path);
  }
}

export function playDefaultFateAttackEffect(scene: Phaser.Scene, options: DefaultFateAttackOptions): void {
  const resonant = !!options.resonance && options.resonance !== 'none';
  const strong = options.resonance === 'strong' || options.resonance === 'boom';
  if (resonant) playResonanceGather(scene, options.from, 0xffd86b, strong);
  playMeteorProjectileEffect(scene, {
    ...options,
    onHit: () => {
      options.onHit();
      if (resonant) playResonanceBloom(scene, options.to, 0xffca64, strong);
    },
    textureKey: FATE_SHARD_ART.textureKey,
    rotationOffset: Math.PI / 4,
    soundKey: 'attackWind',
    shakeStrongAttack: false,
    palette: {
      outerGlow: 0xffb526,
      innerGlow: 0xffef9a,
      tailOuter: 0xb75a10,
      tailMiddle: 0xffb526,
      tailCore: 0xfff0ad,
    },
  });
}

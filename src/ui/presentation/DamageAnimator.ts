import Phaser from 'phaser';

export interface DamageProjectileOptions {
  from: Phaser.Math.Vector2;
  to: Phaser.Math.Vector2;
  color: number;
  label: string;
  resonant?: boolean;
  attackSoundKey?: string;
  resonanceSoundKey?: string;
  impactSoundKey?: string;
  onImpact?: () => void;
  onComplete?: () => void;
}

export interface ClashProjectileOptions {
  a: DamageProjectileOptions;
  b: DamageProjectileOptions;
  onClash?: (point: Phaser.Math.Vector2) => void;
  onComplete?: () => void;
}

export function playDamageProjectile(scene: Phaser.Scene, options: DamageProjectileOptions): void {
  let lastTrailAt = 0;
  const projectile = scene.add.container(options.from.x, options.from.y).setDepth(70);
  projectile.add(scene.add.circle(0, 0, 28, options.color, 0.16));
  projectile.add(scene.add.circle(0, 0, 18, options.color, 0.34));
  projectile.add(scene.add.circle(0, 0, 9, 0xffffff, 0.92));
  const rune = scene.add.text(0, 0, options.label.slice(0, 2), {
    fontFamily: 'Arial',
    fontSize: '13px',
    color: '#f2f2ed',
  }).setOrigin(0.5);
  rune.setShadow(0, 0, '#ffffff', 8, true, true);
  projectile.add(rune);

  const attackSound = options.resonant ? options.resonanceSoundKey : options.attackSoundKey;
  if (attackSound) {
    scene.sound.play(attackSound, { volume: options.resonant ? 0.48 : 0.45 });
  }

  scene.tweens.add({
    targets: projectile,
    x: options.to.x,
    y: options.to.y,
    scaleX: 1.16,
    scaleY: 1.16,
    duration: 640,
    ease: 'Sine.easeInOut',
    onUpdate: () => {
      if (scene.time.now - lastTrailAt < 48) {
        return;
      }

      lastTrailAt = scene.time.now;
      spawnTrail(scene, projectile.x, projectile.y, options.color);
    },
    onComplete: () => {
      projectile.destroy(true);
      if (options.impactSoundKey) {
        scene.sound.play(options.impactSoundKey, { volume: 0.5 });
      }
      playImpactBurst(scene, options.to.x, options.to.y, options.color);
      options.onImpact?.();
      options.onComplete?.();
    },
  });
}

export function playClashProjectiles(scene: Phaser.Scene, options: ClashProjectileOptions): void {
  const midpoint = new Phaser.Math.Vector2(
    (options.a.from.x + options.b.from.x) / 2,
    (options.a.from.y + options.b.from.y) / 2,
  );
  let arrived = 0;
  const onArrive = () => {
    arrived += 1;
    if (arrived < 2) {
      return;
    }

    playImpactBurst(scene, midpoint.x, midpoint.y, 0xffffff);
    options.onClash?.(midpoint);
    options.onComplete?.();
  };

  playDamageProjectile(scene, {
    ...options.a,
    to: midpoint,
    impactSoundKey: undefined,
    onImpact: onArrive,
  });
  playDamageProjectile(scene, {
    ...options.b,
    to: midpoint,
    impactSoundKey: undefined,
    onImpact: onArrive,
  });
}

function spawnTrail(scene: Phaser.Scene, x: number, y: number, color: number): void {
  const trail = scene.add.circle(x, y, 13, color, 0.28).setDepth(68);
  scene.tweens.add({
    targets: trail,
    scale: 0.24,
    alpha: 0,
    duration: 420,
    ease: 'Quad.easeOut',
    onComplete: () => trail.destroy(),
  });
}

function playImpactBurst(scene: Phaser.Scene, x: number, y: number, color: number): void {
  const outer = scene.add.circle(x, y, 8, color, 0.36).setDepth(69);
  const inner = scene.add.circle(x, y, 4, 0xffffff, 0.9).setDepth(70);
  scene.tweens.add({
    targets: outer,
    scale: 5,
    alpha: 0,
    duration: 420,
    ease: 'Cubic.easeOut',
    onComplete: () => outer.destroy(),
  });
  scene.tweens.add({
    targets: inner,
    scale: 3,
    alpha: 0,
    duration: 280,
    ease: 'Quad.easeOut',
    onComplete: () => inner.destroy(),
  });
}


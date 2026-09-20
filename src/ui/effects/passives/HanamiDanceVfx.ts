import Phaser from 'phaser';
import { createMeteorTail, type MeteorProjectileTier } from '../MeteorProjectileEffect';

export const HANAMI_PALETTES = {
  mark: { color: 0xf09ab5, light: 0xffd2e3, dark: 0x923353, text: '#ffd2e3' },
  reward_heal: { color: 0x62d98b, light: 0xc4ffda, dark: 0x236e42, text: '#a0f5bd' },
  reward_attack: { color: 0xff5364, light: 0xffc1c7, dark: 0x922333, text: '#ff9da8' },
} as const;

export type HanamiEffect = keyof typeof HANAMI_PALETTES;

export function playHanamiDanceVfx(scene: Phaser.Scene, options: {
  from: Phaser.Math.Vector2;
  to: Phaser.Math.Vector2;
  effect: HanamiEffect;
  onHit: () => void;
  onComplete: () => void;
}): void {
  const palette = HANAMI_PALETTES[options.effect];
  const tier: MeteorProjectileTier = {
    size: 64, outerGlowRadius: 34, innerGlowRadius: 22, tailLength: 112,
    tailWidth: 17, trailInterval: 35, trailAlpha: 0.3, impactScale: 1,
  };
  const root = scene.add.container(options.from.x, options.from.y).setDepth(29).setScale(0.65).setAlpha(0);
  const tail = createMeteorTail(scene, tier, 'none', {
    outerGlow: palette.dark, innerGlow: palette.light,
    tailOuter: palette.dark, tailMiddle: palette.color, tailCore: palette.light,
  }).setRotation(Phaser.Math.Angle.Between(options.from.x, options.from.y, options.to.x, options.to.y)).setAlpha(0);
  const glow = scene.add.circle(0, 0, 35, palette.color, 0.18).setBlendMode(Phaser.BlendModes.ADD);
  const inner = scene.add.circle(0, 0, 24, palette.light, 0.14).setBlendMode(Phaser.BlendModes.ADD);
  const fan = scene.add.container(0, 0);
  fan.add(scene.add.arc(0, 6, 32, 202, 338, false, palette.color, 0.95).setStrokeStyle(2, palette.light, 0.95));
  fan.add(scene.add.rectangle(0, 23, 5, 24, 0xe5ba63, 0.96).setStrokeStyle(1, palette.dark, 0.9));
  for (let i = 0; i < 5; i += 1) {
    fan.add(scene.add.rectangle(0, -3, 2, 45, palette.light, 0.8).setOrigin(0.5, 1).setAngle(-42 + i * 21));
  }
  root.add([tail, glow, inner, fan]);
  const owned = new Set<Phaser.GameObjects.GameObject>([root, tail, glow, inner, fan]);
  const track = <T extends Phaser.GameObjects.GameObject>(object: T): T => {
    owned.add(object);
    object.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.tweens.killTweensOf(object);
      owned.delete(object);
    });
    return object;
  };
  const cleanup = () => {
    for (const object of [...owned]) {
      scene.tweens.killTweensOf(object);
      if (object.scene) object.destroy();
    }
    owned.clear();
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
  // Irregular spirals keep the motion airy instead of drawing a closed ring.
  const swirl = (center: Phaser.Math.Vector2, count: number, impact: boolean) => {
    for (let i = 0; i < count; i += 1) {
      const petal = i % 3 === 0;
      const startAngle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const startRadius = impact ? Phaser.Math.Between(8, 25) : Phaser.Math.Between(22, 56);
      const reach = impact ? Phaser.Math.Between(60, 124) : Phaser.Math.Between(55, 95);
      const turn = (i % 2 === 0 ? 1 : -1) * Phaser.Math.FloatBetween(0.9, 2.3);
      const particle = track(scene.add.ellipse(center.x, center.y,
        petal ? 5 : 3, petal ? 11 : 3,
        i % 4 === 0 ? palette.light : palette.color, 0)
        .setDepth(30).setBlendMode(Phaser.BlendModes.ADD));
      const motion = scene.tweens.addCounter({ from: 0, to: 1,
        delay: Phaser.Math.Between(0, impact ? 160 : 200),
        duration: impact ? Phaser.Math.Between(650, 880) : Phaser.Math.Between(520, 760),
        onUpdate: (tween) => {
          if (!particle.scene) return;
          const progress = tween.getValue() ?? 0;
          const radius = startRadius + (reach - startRadius) * (1 - Math.pow(1 - progress, 2));
          const angle = startAngle + progress * turn;
          particle.setPosition(center.x + Math.cos(angle) * radius,
            center.y + Math.sin(angle) * radius * 0.7 + progress * (impact ? 28 : -24));
          particle.setRotation(angle + progress * 3);
          particle.setAlpha(Math.sin(Math.PI * progress) * 0.9);
          particle.setScale(1 - progress * 0.65);
        }, onComplete: () => particle.destroy(),
      });
      particle.once(Phaser.GameObjects.Events.DESTROY, () => motion.remove());
    }
  };
  swirl(options.from, 36, false);
  // Petals and sparks orbit the moving fan throughout casting and flight.
  for (let i = 0; i < 12; i += 1) {
    const petal = i % 3 === 0;
    const mote = scene.add.ellipse(0, 0, petal ? 4 : 3, petal ? 9 : 3,
      i % 2 === 0 ? palette.light : palette.color, 0.85)
      .setBlendMode(Phaser.BlendModes.ADD);
    root.add(mote);
    const orbit = scene.tweens.addCounter({ from: i * Math.PI * 2 / 12, to: i * Math.PI * 2 / 12 + Math.PI * 6,
      duration: 1200 + i * 35, repeat: -1,
      onUpdate: (tween) => {
        if (!mote.scene) return;
        const angle = tween.getValue() ?? 0;
        const radius = 32 + (i % 4) * 5 + Math.sin(angle * 2) * 4;
        mote.setPosition(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.72);
        mote.setRotation(angle + Math.PI / 4);
      },
    });
    mote.once(Phaser.GameObjects.Events.DESTROY, () => orbit.remove());
  }
  const distance = Phaser.Math.Distance.Between(options.from.x, options.from.y, options.to.x, options.to.y);
  const flightDuration = Phaser.Math.Clamp(480 + distance * 0.26, 580, 760);
  scene.tweens.add({ targets: fan, angle: options.effect === 'mark' ? 600 : -600,
    duration: 280 + flightDuration, ease: 'Linear' });
  scene.tweens.add({ targets: glow, alpha: 0.42, scale: 1.18, duration: 260, yoyo: true, repeat: -1 });
  scene.tweens.add({ targets: root, alpha: 1, scale: 0.95, duration: 280,
    onComplete: () => {
      tail.setAlpha(1);
      let lastTrailAt = -Infinity;
      scene.tweens.add({ targets: root, x: options.to.x, y: options.to.y,
        duration: flightDuration, ease: 'Sine.easeInOut',
        onUpdate: () => {
          if (scene.time.now - lastTrailAt < tier.trailInterval) return;
          lastTrailAt = scene.time.now;
          const mote = track(scene.add.circle(root.x + Phaser.Math.Between(-7, 7), root.y + Phaser.Math.Between(-7, 7),
            Phaser.Math.Between(2, 4), palette.color, 0.7).setDepth(28).setBlendMode(Phaser.BlendModes.ADD));
          scene.tweens.add({ targets: mote, alpha: 0, scale: 0.15, y: mote.y + 10, duration: 300,
            onComplete: () => mote.destroy() });
          const petal = track(scene.add.ellipse(root.x + Phaser.Math.Between(-24, 24), root.y + Phaser.Math.Between(-20, 20),
            4, 9, palette.light, 0.75).setDepth(30).setAngle(Phaser.Math.Between(0, 360))
            .setBlendMode(Phaser.BlendModes.ADD));
          scene.tweens.add({ targets: petal, x: petal.x + Phaser.Math.Between(-22, 22),
            y: petal.y + 26, angle: petal.angle + 150, alpha: 0, scale: 0.35, duration: 440,
            onComplete: () => petal.destroy() });
        },
        onComplete: () => {
          // Reveal may rebuild the scene UI. Dispose flight before it, spawn impact after it.
          cleanup();
          options.onHit();
          swirl(options.to, 36, true);
          const impactParticleCount = 48;
          for (let i = 0; i < impactParticleCount; i += 1) {
            const angle = i * Math.PI * 2 / impactParticleCount + Phaser.Math.FloatBetween(-0.18, 0.18);
            const outerWave = i % 3 !== 0;
            const reach = outerWave ? Phaser.Math.Between(78, 142) : Phaser.Math.Between(36, 82);
            const delay = outerWave ? Phaser.Math.Between(30, 110) : 0;
            const particle = track(scene.add.ellipse(options.to.x, options.to.y,
              i % 4 === 0 ? 5 : 3, i % 4 === 0 ? 12 : 4,
              i % 4 === 0 ? palette.light : palette.color, 0.95)
              .setRotation(angle).setDepth(30).setBlendMode(Phaser.BlendModes.ADD));
            scene.tweens.add({ targets: particle,
              x: options.to.x + Math.cos(angle) * reach,
              y: options.to.y + Math.sin(angle) * reach + (outerWave ? 18 : 10),
              alpha: 0, scale: 0.2, angle: particle.angle + 90,
              delay, duration: 580 + (i % 6) * 55, ease: 'Cubic.easeOut',
              onComplete: () => particle.destroy() });
          }
          scene.time.delayedCall(1040, () => {
            cleanup();
            scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup);
            options.onComplete();
          });
        },
      });
    },
  });
}

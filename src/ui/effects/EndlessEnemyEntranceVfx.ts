import Phaser from 'phaser';

/** A short, seat-local variant of the spirit summon: smoke, rising light, then arrival. */
export function playEndlessEnemyEntranceVfx(scene: Phaser.Scene, options: {
  center: Phaser.Math.Vector2;
  width: number;
  height: number;
  onReveal: () => void;
  onComplete: () => void;
}): void {
  const { center, width, height } = options;
  const root = scene.add.container(center.x, center.y).setDepth(60);
  const baseY = height * 0.38;
  const glow = scene.add.ellipse(0, baseY, width * 0.85, 24, 0xbd873d, 0.3).setBlendMode(Phaser.BlendModes.ADD);
  root.add(glow);
  for (let i = 0; i < 12; i++) {
    const fog = scene.add.ellipse(Phaser.Math.Between(-width * 0.3, width * 0.3), baseY + Phaser.Math.Between(-12, 12),
      Phaser.Math.Between(30, 58), Phaser.Math.Between(22, 40), i % 2 ? 0x591c1b : 0x852c24, 0).setBlendMode(Phaser.BlendModes.ADD);
    root.add(fog);
    scene.tweens.add({ targets: fog, y: fog.y - height * 0.6, x: fog.x * 0.5, alpha: { from: 0.16, to: 0 },
      scaleX: 1.4, scaleY: 1.8, delay: i * 22, duration: 570, ease: 'Sine.easeOut' });
  }
  // Several overlapping translucent ellipses keep the column soft and within the portrait.
  for (let i = 0; i < 5; i++) {
    const light = scene.add.ellipse(0, 0, width * (0.18 + i * 0.09), height * 0.88, 0xe6b66a, 0)
      .setBlendMode(Phaser.BlendModes.ADD);
    root.add(light);
    scene.tweens.add({ targets: light, alpha: { from: 0.06, to: 0 }, scaleY: { from: 0.25, to: 1 },
      delay: 100 + i * 20, duration: 640, ease: 'Cubic.easeOut' });
  }
  for (let i = 0; i < 30; i++) {
    const spark = scene.add.rectangle(Phaser.Math.Between(-width * 0.4, width * 0.4), baseY,
      i % 3 ? 3 : 4, i % 3 ? 3 : 4, i % 2 ? 0xf0cf8c : 0xb77938, 0.85)
      .setAngle(45).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    root.add(spark);
    scene.tweens.add({ targets: spark, x: spark.x * 0.35, y: Phaser.Math.Between(-height * 0.4, 0),
      alpha: { from: 0.85, to: 0 }, delay: i * 9, duration: 480, ease: 'Sine.easeOut' });
  }
  scene.time.delayedCall(200, () => {
    options.onReveal();
    scene.sound.play('cardPlace', { volume: 0.32, rate: 0.8 });
  });
  scene.time.delayedCall(550, () => {
    for (let i = 0; i < 18; i++) {
      const angle = i / 18 * Math.PI * 2;
      const spark = scene.add.rectangle(Math.cos(angle) * 12, Math.sin(angle) * 12, 3, 3, 0xe8be76, 0.8)
        .setAngle(45).setBlendMode(Phaser.BlendModes.ADD);
      root.add(spark);
      scene.tweens.add({ targets: spark, x: Math.cos(angle) * width * 0.43, y: Math.sin(angle) * height * 0.35,
        alpha: 0, scale: 0.25, duration: 300, ease: 'Cubic.easeOut' });
    }
    scene.tweens.add({ targets: glow, alpha: 0, scaleX: 1.15, duration: 300 });
  });
  scene.time.delayedCall(850, () => { root.destroy(true); options.onComplete(); });
}

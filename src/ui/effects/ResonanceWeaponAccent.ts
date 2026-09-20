import Phaser from 'phaser';

/** Local, finite particle layers. Tween delays also respect the shared impact hold. */
export function playResonanceGather(scene: Phaser.Scene, point: { x: number; y: number }, color: number, strong: boolean): void {
  const count = strong ? 28 : 16;
  for (let i = 0; i < count; i += 1) {
    const angle = i * Math.PI * 2 / count;
    const radius = Phaser.Math.Between(48, strong ? 105 : 78);
    const spark = scene.add.rectangle(point.x + Math.cos(angle) * radius, point.y + Math.sin(angle) * radius * 0.75,
      i % 3 === 0 ? 10 : 4, 3, i % 2 === 0 ? 0xffdf83 : color, 0)
      .setDepth(40).setRotation(angle).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: spark, x: point.x, y: point.y, alpha: 0.9, scaleX: 0.25,
      delay: i % 5 * 24, duration: strong ? 300 : 250, ease: 'Cubic.easeIn',
      onComplete: () => spark.destroy() });
    spark.once(Phaser.GameObjects.Events.DESTROY, () => scene.tweens.killTweensOf(spark));
  }
}

export function playResonanceBloom(scene: Phaser.Scene, point: { x: number; y: number }, color: number,
  strong: boolean, petals = false): void {
  const count = strong ? 36 : 18;
  for (let i = 0; i < count; i += 1) {
    const angle = i * Math.PI * 2 / count + Phaser.Math.FloatBetween(-0.1, 0.1);
    const reach = Phaser.Math.Between(48, strong ? 142 : 104);
    const particle = scene.add.ellipse(point.x, point.y, petals ? 6 : 12, petals ? 12 : 3,
      i % 3 === 0 ? 0xffe5a1 : color, 0)
      .setDepth(48).setRotation(angle).setBlendMode(Phaser.BlendModes.ADD);
    // A second wave blooms after the initial contact; no extra damage callback.
    scene.tweens.add({ targets: particle, alpha: 0.95, duration: 40, delay: strong ? 155 : 95,
      onComplete: () => {
        scene.tweens.add({ targets: particle,
          x: point.x + Math.cos(angle) * reach, y: point.y + Math.sin(angle) * reach * 0.8 + (petals ? 26 : 0),
          angle: particle.angle + (petals ? 180 : 35), alpha: 0, scale: 0.25,
          duration: petals ? 640 : 470, ease: 'Cubic.easeOut', onComplete: () => particle.destroy() });
      } });
    particle.once(Phaser.GameObjects.Events.DESTROY, () => scene.tweens.killTweensOf(particle));
  }
}

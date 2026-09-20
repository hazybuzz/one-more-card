import Phaser from 'phaser';

/** Presentation-owned: logic can consume the passive before its attack arrives. */
export class NinjaSmokeVfx {
  readonly container: Phaser.GameObjects.Container;
  private readonly puffs: Phaser.GameObjects.Image[] = [];
  private readonly timers: Phaser.Time.TimerEvent[] = [];

  constructor(private readonly scene: Phaser.Scene, x: number, y: number, radius: number) {
    const key = 'ninja-soft-smoke';
    if (!scene.textures.exists(key)) {
      const texture = scene.textures.createCanvas(key, 128, 128)!;
      const ctx = texture.context;
      // Overlapping soft lobes avoid the hard outlines of the old circle burst.
      for (let i = 0; i < 9; i += 1) {
        const angle = i * 2.4;
        const cx = 64 + Math.cos(angle) * 20;
        const cy = 64 + Math.sin(angle) * 18;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 39);
        gradient.addColorStop(0, 'rgba(245,247,249,0.35)');
        gradient.addColorStop(0.45, 'rgba(221,228,234,0.18)');
        gradient.addColorStop(1, 'rgba(221,228,234,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 128, 128);
      }
      texture.refresh();
    }
    this.container = scene.add.container(x, y).setDepth(13).setScale(1.25);
    for (let i = 0; i < 12; i += 1) {
      const angle = i * Math.PI * 2 / 12;
      const px = Math.cos(angle) * radius * 0.63;
      const py = Math.sin(angle) * radius * 0.63;
      const puff = scene.add.image(0, radius * 0.4, key)
        .setDisplaySize(radius * 1.15, radius * 1.05).setAlpha(0).setRotation(angle);
      this.container.add(puff);
      this.puffs.push(puff);
      scene.tweens.add({
        targets: puff, x: px, y: py, alpha: 0.33, duration: 440,
        delay: i * 14, ease: 'Cubic.easeOut',
        onComplete: () => {
          scene.tweens.add({
            targets: puff, x: px + Math.sin(angle) * 5, y: py - 5,
            angle: puff.angle + 16, alpha: 0.23, duration: 1300 + i * 65,
            yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
          });
        },
      });
    }
  }

  evade(onEvade: () => void, onComplete: () => void): void {
    for (const puff of this.puffs) {
      this.scene.tweens.killTweensOf(puff);
      this.scene.tweens.add({ targets: puff, alpha: 0.55, duration: 100 });
    }
    // Impact first, then a readable dodge beat, then release the smoke.
    this.timers.push(this.scene.time.delayedCall(110, onEvade));
    this.timers.push(this.scene.time.delayedCall(330, () => {
      for (const puff of this.puffs) {
        this.scene.tweens.add({
          targets: puff, x: puff.x * 1.7, y: puff.y * 1.55 - 18,
          scaleX: puff.scaleX * 1.5, scaleY: puff.scaleY * 1.5,
          alpha: 0, duration: 620, ease: 'Cubic.easeOut',
        });
      }
    }));
    this.timers.push(this.scene.time.delayedCall(970, () => {
      this.destroy();
      onComplete();
    }));
  }

  destroy(): void {
    this.timers.forEach((timer) => timer.remove(false));
    this.puffs.forEach((puff) => this.scene.tweens.killTweensOf(puff));
    this.container.destroy(true);
  }
}

import Phaser from 'phaser';

interface HeartMeterOptions {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  muted?: boolean;
  heartSize?: number;
  spacing?: number;
  onShowTooltip?: () => void;
  onHideTooltip?: () => void;
}

interface HeartSlot {
  capacity: 1 | 2;
  base: Phaser.GameObjects.Text;
  fill: Phaser.GameObjects.Text;
}

export class HeartMeter {
  readonly container: Phaser.GameObjects.Container;

  private readonly scene: Phaser.Scene;
  private readonly maxHp: number;
  private readonly muted: boolean;
  private readonly slots: HeartSlot[] = [];
  private hp: number;

  constructor(scene: Phaser.Scene, options: HeartMeterOptions) {
    this.scene = scene;
    this.hp = Phaser.Math.Clamp(options.hp, 0, options.maxHp);
    this.maxHp = Math.max(1, options.maxHp);
    this.muted = options.muted ?? false;
    this.container = scene.add.container(options.x, options.y);

    const slotCount = Math.ceil(this.maxHp / 2);
    const heartSize = options.heartSize ?? 22;
    const spacing = options.spacing ?? heartSize + 2;
    const startX = -((slotCount - 1) * spacing) / 2;

    for (let index = 0; index < slotCount; index += 1) {
      const capacity: 1 | 2 = index === slotCount - 1 && this.maxHp % 2 === 1 ? 1 : 2;
      const x = startX + index * spacing;
      const base = this.createHeart(x, heartSize, '#3a2830', false);
      const fill = this.createHeart(x, heartSize, this.muted ? '#7b6670' : '#ff4b5f', true);
      if (capacity === 1) {
        this.cropHeart(base, 0.5);
      }
      this.container.add([base, fill]);
      this.slots.push({ capacity, base, fill });
    }

    this.updateSlots();
    const width = Math.max(heartSize, (slotCount - 1) * spacing + heartSize);
    this.container.setSize(width, heartSize + 8);
    if (options.onShowTooltip || options.onHideTooltip) {
      this.container.setInteractive({ useHandCursor: false });
      this.container.on('pointerover', () => options.onShowTooltip?.());
      this.container.on('pointerout', () => options.onHideTooltip?.());
    }
  }

  setHp(hp: number, animate = false): void {
    const nextHp = Phaser.Math.Clamp(hp, 0, this.maxHp);
    if (nextHp === this.hp) {
      return;
    }

    this.hp = nextHp;
    this.updateSlots();
    if (animate && this.container.active) {
      this.scene.tweens.killTweensOf(this.container);
      this.scene.tweens.add({
        targets: this.container,
        scaleX: 1.1,
        scaleY: 1.1,
        duration: 120,
        yoyo: true,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          if (this.container.active) {
            this.container.setScale(1);
          }
        },
      });
    }
  }

  private createHeart(x: number, size: number, color: string, glowing: boolean): Phaser.GameObjects.Text {
    const heart = this.scene.add.text(x, 0, '♥', {
      fontFamily: 'Arial',
      fontSize: `${size}px`,
      color,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    if (glowing && !this.muted) {
      heart.setShadow(0, 0, '#ff3048', 8, true, true);
    }
    return heart;
  }

  private updateSlots(): void {
    this.slots.forEach((slot, index) => {
      const value = Phaser.Math.Clamp(this.hp - index * 2, 0, slot.capacity);
      const ratio = value / 2;
      slot.fill.setVisible(value > 0);
      if (value > 0) {
        this.cropHeart(slot.fill, ratio);
      }
      slot.base.setAlpha(this.muted ? 0.45 : 0.78);
      slot.fill.setAlpha(this.muted ? 0.58 : 1);
    });
  }

  private cropHeart(heart: Phaser.GameObjects.Text, ratio: number): void {
    heart.setCrop(0, 0, Math.max(1, heart.width * ratio), heart.height);
  }
}

import Phaser from 'phaser';

interface HandViewOptions<T> {
  x: number;
  y: number;
  items: T[];
  itemWidth: number;
  spacing: number;
  slotCount?: number;
  createItem: (item: T, index: number, x: number) => Phaser.GameObjects.GameObject;
}

export class HandView<T> {
  readonly container: Phaser.GameObjects.Container;
  readonly width: number;
  readonly rightEdge: number;

  constructor(scene: Phaser.Scene, options: HandViewOptions<T>) {
    this.container = scene.add.container(options.x, options.y);
    const slotCount = Math.max(options.items.length, options.slotCount ?? options.items.length);
    this.width = slotCount > 0
      ? options.itemWidth + (slotCount - 1) * options.spacing
      : 0;
    this.rightEdge = this.width / 2;
    const firstCenter = -this.width / 2 + options.itemWidth / 2;
    options.items.forEach((item, index) => {
      const x = firstCenter + index * options.spacing;
      this.container.add(options.createItem(item, index, x));
    });
  }
}

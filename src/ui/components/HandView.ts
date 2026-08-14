import Phaser from 'phaser';

interface HandViewOptions<T> {
  x: number;
  y: number;
  items: T[];
  itemWidth: number;
  spacing: number;
  slotCount?: number;
  fan?: boolean;
  createItem: (item: T, index: number, x: number, y: number, angle: number) => Phaser.GameObjects.GameObject;
}

export interface HandItemPose {
  x: number;
  y: number;
  angle: number;
}

export function resolveHandItemPose(
  index: number,
  slotCount: number,
  itemWidth: number,
  spacing: number,
  fan = false,
): HandItemPose {
  const width = slotCount > 0 ? itemWidth + (slotCount - 1) * spacing : 0;
  const firstCenter = -width / 2 + itemWidth / 2;
  const centerIndex = (slotCount - 1) / 2;
  const offset = index - centerIndex;
  const edgeDistance = centerIndex > 0 ? Math.abs(offset) / centerIndex : 0;

  return {
    x: firstCenter + index * spacing,
    y: fan ? -Math.round(edgeDistance * 4) : 0,
    angle: fan ? offset * 4 : 0,
  };
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
    options.items.forEach((item, index) => {
      const pose = resolveHandItemPose(index, slotCount, options.itemWidth, options.spacing, options.fan);
      this.container.add(options.createItem(item, index, pose.x, pose.y, pose.angle));
    });
  }
}

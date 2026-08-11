import Phaser from 'phaser';
import type { AbilitySlot } from './AbilitySlot';

export type AbilityOrbitPosition = 'top-left' | 'bottom-left' | 'top-right' | 'bottom-right';

interface AbilityOrbitOptions {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
}

export class AbilityOrbit {
  readonly container: Phaser.GameObjects.Container;

  private readonly radiusX: number;
  private readonly radiusY: number;

  constructor(scene: Phaser.Scene, options: AbilityOrbitOptions) {
    this.container = scene.add.container(options.x, options.y);
    this.radiusX = options.radiusX;
    this.radiusY = options.radiusY;
  }

  add(position: AbilityOrbitPosition, slot: AbilitySlot): void {
    this.addContainer(position, slot.container);
  }

  addContainer(position: AbilityOrbitPosition, slot: Phaser.GameObjects.Container): void {
    const left = position.endsWith('left');
    const top = position.startsWith('top');
    slot.setPosition(left ? -this.radiusX : this.radiusX, top ? -this.radiusY : this.radiusY);
    this.container.add(slot);
  }
}

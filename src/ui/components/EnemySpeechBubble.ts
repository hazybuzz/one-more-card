import Phaser from 'phaser';
import { GAME_FONT_FAMILY } from '../themes/typography';

export type EnemySpeechDirection = 'right-up' | 'left-up' | 'left';

interface EnemySpeechBubbleOptions {
  tipX: number;
  tipY: number;
  text: string;
  direction: EnemySpeechDirection;
  depth?: number;
  onComplete?: () => void;
}

const MAX_TEXT_WIDTH = 162;
const HORIZONTAL_PADDING = 14;
const VERTICAL_PADDING = 9;

export class EnemySpeechBubble {
  readonly container: Phaser.GameObjects.Container;
  private dismissTimer?: Phaser.Time.TimerEvent;
  private dismissed = false;

  constructor(private readonly scene: Phaser.Scene, options: EnemySpeechBubbleOptions) {
    const text = scene.add.text(0, 0, options.text, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '15px',
      color: '#24201e',
      fontStyle: 'bold',
      lineSpacing: 2,
      wordWrap: { width: MAX_TEXT_WIDTH, useAdvancedWrap: true },
    });
    const width = Phaser.Math.Clamp(Math.ceil(text.width + HORIZONTAL_PADDING * 2), 90, 190);
    text.setWordWrapWidth(width - HORIZONTAL_PADDING * 2, true);
    const height = Math.max(38, Math.ceil(text.height + VERTICAL_PADDING * 2));
    text.setPosition(-width / 2 + HORIZONTAL_PADDING, 0).setOrigin(0, 0.5);

    const artwork = scene.add.graphics();
    this.drawBubble(artwork, width, height, options.direction);
    const target = this.resolveTarget(options, width, height);
    const entranceOffset = this.entranceOffset(options.direction);

    this.container = scene.add.container(
      target.x + entranceOffset.x,
      target.y + entranceOffset.y,
      [artwork, text],
    ).setDepth(options.depth ?? 46).setAlpha(0).setScale(0.92);

    scene.tweens.add({
      targets: this.container,
      x: target.x,
      y: target.y,
      alpha: 1,
      scale: 1,
      duration: 140,
      ease: 'Back.easeOut',
    });

    this.dismissTimer = scene.time.delayedCall(this.displayDuration(options.text), () => {
      this.dismiss(options.onComplete);
    });
  }

  destroy(): void {
    this.dismissed = true;
    this.dismissTimer?.remove(false);
    this.dismissTimer = undefined;
    this.scene.tweens.killTweensOf(this.container);
    this.container.destroy(true);
  }

  private dismiss(onComplete?: () => void): void {
    if (this.dismissed || !this.container.scene) {
      return;
    }
    this.dismissed = true;
    this.dismissTimer = undefined;
    this.scene.tweens.add({
      targets: this.container,
      y: this.container.y - 4,
      alpha: 0,
      scale: 0.97,
      duration: 140,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.container.destroy(true);
        onComplete?.();
      },
    });
  }

  private displayDuration(text: string): number {
    return Phaser.Math.Clamp(1120 + [...text].length * 68, 1400, 2200);
  }

  private resolveTarget(
    options: EnemySpeechBubbleOptions,
    width: number,
    height: number,
  ): Phaser.Math.Vector2 {
    if (options.direction === 'right-up') {
      return new Phaser.Math.Vector2(options.tipX + width / 2 + 10, options.tipY - height / 2 - 4);
    }
    if (options.direction === 'left-up') {
      return new Phaser.Math.Vector2(options.tipX - width / 2 - 10, options.tipY - height / 2 - 4);
    }
    return new Phaser.Math.Vector2(options.tipX - width / 2 - 10, options.tipY);
  }

  private entranceOffset(direction: EnemySpeechDirection): Phaser.Math.Vector2 {
    if (direction === 'right-up') {
      return new Phaser.Math.Vector2(-14, 10);
    }
    if (direction === 'left-up') {
      return new Phaser.Math.Vector2(14, 10);
    }
    return new Phaser.Math.Vector2(14, 0);
  }

  private drawBubble(
    graphics: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    direction: EnemySpeechDirection,
  ): void {
    const left = -width / 2;
    const top = -height / 2;
    const right = width / 2;
    const bottom = height / 2;
    const shadowOffsetX = 4;
    const shadowOffsetY = 5;

    graphics.fillStyle(0x000000, 0.34);
    graphics.fillRoundedRect(left + shadowOffsetX, top + shadowOffsetY, width, height, 6);
    this.fillTail(graphics, direction, left + shadowOffsetX, right + shadowOffsetX, bottom + shadowOffsetY, 0x000000, 0.34);

    graphics.fillStyle(0xf7f3e8, 0.99);
    graphics.fillRoundedRect(left, top, width, height, 6);
    graphics.lineStyle(2, 0x2b2725, 0.88);
    graphics.strokeRoundedRect(left, top, width, height, 6);
    this.fillTail(graphics, direction, left, right, bottom, 0xf7f3e8, 0.99);
    this.strokeTail(graphics, direction, left, right, bottom);
  }

  private fillTail(
    graphics: Phaser.GameObjects.Graphics,
    direction: EnemySpeechDirection,
    left: number,
    right: number,
    bottom: number,
    color: number,
    alpha: number,
  ): void {
    graphics.fillStyle(color, alpha);
    graphics.beginPath();
    if (direction === 'right-up') {
      graphics.moveTo(left, bottom - 18);
      graphics.lineTo(left - 12, bottom + 4);
      graphics.lineTo(left, bottom - 4);
    } else if (direction === 'left-up') {
      graphics.moveTo(right, bottom - 18);
      graphics.lineTo(right + 12, bottom + 4);
      graphics.lineTo(right, bottom - 4);
    } else {
      graphics.moveTo(right, -9);
      graphics.lineTo(right + 12, 0);
      graphics.lineTo(right, 9);
    }
    graphics.closePath();
    graphics.fillPath();
  }

  private strokeTail(
    graphics: Phaser.GameObjects.Graphics,
    direction: EnemySpeechDirection,
    left: number,
    right: number,
    bottom: number,
  ): void {
    graphics.beginPath();
    if (direction === 'right-up') {
      graphics.moveTo(left, bottom - 18);
      graphics.lineTo(left - 12, bottom + 4);
      graphics.lineTo(left, bottom - 4);
    } else if (direction === 'left-up') {
      graphics.moveTo(right, bottom - 18);
      graphics.lineTo(right + 12, bottom + 4);
      graphics.lineTo(right, bottom - 4);
    } else {
      graphics.moveTo(right, -9);
      graphics.lineTo(right + 12, 0);
      graphics.lineTo(right, 9);
    }
    graphics.strokePath();
  }
}

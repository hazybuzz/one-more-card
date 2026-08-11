import Phaser from 'phaser';
import type { NineSliceArtAsset } from '../art';

interface CharacterFrameOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  accentColor: number;
  backgroundColor?: number;
  skin?: NineSliceArtAsset;
  active?: boolean;
  muted?: boolean;
}

export class CharacterFrame {
  readonly container: Phaser.GameObjects.Container;
  readonly portraitLayer: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, options: CharacterFrameOptions) {
    this.container = scene.add.container(options.x, options.y);
    const alpha = options.muted ? 0.45 : 1;
    const background = scene.add.rectangle(0, 0, options.width, options.height, options.backgroundColor ?? 0x10151d, 0.92)
      .setStrokeStyle(2, options.accentColor, 0.3 * alpha);
    this.portraitLayer = scene.add.container(0, 0).setAlpha(alpha);
    const innerBorder = scene.add.rectangle(0, 0, options.width - 10, options.height - 10, 0x000000, 0)
      .setStrokeStyle(1, 0xffffff, 0.15 * alpha);
    const outerBorder = scene.add.rectangle(0, 0, options.width + 8, options.height + 8, 0x000000, 0)
      .setStrokeStyle(options.active ? 4 : 2, options.accentColor, (options.active ? 1 : 0.72) * alpha);
    const namePlate = scene.add.rectangle(0, options.height / 2 - 14, options.width - 12, 24, 0x090b10, 0.88)
      .setStrokeStyle(1, options.accentColor, 0.42 * alpha);
    this.container.add([background, this.portraitLayer]);

    const hasSkin = options.skin && scene.textures.exists(options.skin.textureKey);
    if (hasSkin) {
      this.container.add(scene.add.nineslice(
        0,
        0,
        options.skin!.textureKey,
        undefined,
        options.width + 8,
        options.height + 8,
        options.skin!.leftWidth,
        options.skin!.rightWidth,
        options.skin!.topHeight,
        options.skin!.bottomHeight,
      ).setAlpha(alpha));
    }

    this.container.add([innerBorder, outerBorder, namePlate]);

    if (options.active) {
      const focusWidth = options.width + 14;
      const focusHeight = options.height + 14;
      const themeGlow = scene.add.rectangle(0, 0, focusWidth + 8, focusHeight + 8, 0x000000, 0)
        .setStrokeStyle(4, options.accentColor, 0.38);
      const separator = scene.add.rectangle(0, 0, focusWidth + 3, focusHeight + 3, 0x000000, 0)
        .setStrokeStyle(6, 0x050608, 0.92);
      const focusBorder = scene.add.rectangle(0, 0, focusWidth, focusHeight, 0x000000, 0)
        .setStrokeStyle(2, 0xfff6df, 0.92);
      const horizontalLength = Math.round(options.width * 0.3);
      const verticalLength = Math.round(options.height * 0.26);
      const segments = [
        this.focusSegment(scene, 0, -focusHeight / 2, horizontalLength, 3),
        this.focusSegment(scene, focusWidth / 2, 0, 3, verticalLength),
        this.focusSegment(scene, 0, focusHeight / 2, horizontalLength, 3),
        this.focusSegment(scene, -focusWidth / 2, 0, 3, verticalLength),
      ];
      this.container.add([themeGlow, separator, focusBorder, ...segments]);

      scene.tweens.add({
        targets: [themeGlow, focusBorder],
        alpha: { from: 0.52, to: 1 },
        duration: 760,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      segments.forEach((segment, index) => {
        scene.tweens.add({
          targets: segment,
          alpha: { from: 0.16, to: 1 },
          duration: 220,
          delay: index * 240,
          yoyo: true,
          repeat: -1,
          repeatDelay: 520,
          ease: 'Sine.easeInOut',
        });
      });
      focusBorder.once(Phaser.GameObjects.Events.DESTROY, () => {
        scene.tweens.killTweensOf([themeGlow, focusBorder, ...segments]);
      });
    }
  }

  addPortrait(portrait: Phaser.GameObjects.GameObject): void {
    this.portraitLayer.add(portrait);
  }

  private focusSegment(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Phaser.GameObjects.Container {
    const segment = scene.add.container(x, y).setAlpha(0.16);
    const glow = scene.add.rectangle(0, 0, width + 6, height + 6, 0xfff1c7, 0.22);
    const core = scene.add.rectangle(0, 0, width, height, 0xffffff, 0.98);
    segment.add([glow, core]);
    return segment;
  }
}

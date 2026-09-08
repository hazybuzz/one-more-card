import Phaser from 'phaser';
import type { NineSliceArtAsset } from '../art';

export interface MedievalPanelOptions {
  x?: number;
  y?: number;
  width: number;
  height: number;
  skin?: NineSliceArtAsset;
  fallbackFill: number;
  fallbackLine: number;
}

export class MedievalPanel {
  static render(scene: Phaser.Scene, options: MedievalPanelOptions): Phaser.GameObjects.Container {
    const x = options.x ?? 0;
    const y = options.y ?? 0;
    const container = scene.add.container(x, y);
    const hasSkin = Boolean(options.skin && scene.textures.exists(options.skin.textureKey));

    if (hasSkin) {
      const createSlice = (offsetX: number, offsetY: number): Phaser.GameObjects.NineSlice => scene.add.nineslice(
        offsetX,
        offsetY,
        options.skin!.textureKey,
        undefined,
        options.width,
        options.height,
        options.skin!.leftWidth,
        options.skin!.rightWidth,
        options.skin!.topHeight,
        options.skin!.bottomHeight,
      );
      const shadow = createSlice(5, 8).setTint(0x000000).setAlpha(0.58);
      const panel = createSlice(0, 0);
      container.add([shadow, panel]);
    } else {
      container.add(
        scene.add.rectangle(0, 0, options.width, options.height, options.fallbackFill, 0.98),
      );
    }

    return container;
  }
}

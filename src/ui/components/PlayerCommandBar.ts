import Phaser from 'phaser';
import type { NineSliceArtAsset } from '../art';

interface PlayerCommandBarOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  skin?: NineSliceArtAsset;
  colors: {
    panel: number;
    panelAlt: number;
    line: number;
    accent: number;
  };
}

export interface PlayerCommandBarAnchors {
  actions: { x: number; y: number };
}

export class PlayerCommandBar {
  static render(scene: Phaser.Scene, options: PlayerCommandBarOptions): {
    container: Phaser.GameObjects.Container;
    anchors: PlayerCommandBarAnchors;
  } {
    const container = scene.add.container(options.x, options.y);
    // BattleScene's button factory uses top-left coordinates.
    const actions = { x: 0, y: -24 };

    const hasSkin = options.skin && scene.textures.exists(options.skin.textureKey);
    const background = hasSkin
      ? scene.add.nineslice(
        0,
        0,
        options.skin!.textureKey,
        undefined,
        options.width,
        options.height,
        options.skin!.leftWidth,
        options.skin!.rightWidth,
        options.skin!.topHeight,
        options.skin!.bottomHeight,
      )
      : scene.add.rectangle(0, 0, options.width, options.height, options.colors.panel, 0.94)
        .setStrokeStyle(2, options.colors.line, 0.95);
    const inner = scene.add.rectangle(0, 0, options.width - 8, options.height - 8, options.colors.panelAlt, 0.22);
    const topLine = scene.add.rectangle(0, -options.height / 2 + 2, options.width - 22, 2, options.colors.accent, 0.52);
    const leftCap = scene.add.rectangle(-options.width / 2 + 9, 0, 3, options.height - 18, options.colors.accent, 0.28);
    const rightCap = scene.add.rectangle(options.width / 2 - 9, 0, 3, options.height - 18, options.colors.accent, 0.28);
    container.add(hasSkin ? [background] : [background, inner, topLine, leftCap, rightCap]);

    return { container, anchors: { actions } };
  }
}

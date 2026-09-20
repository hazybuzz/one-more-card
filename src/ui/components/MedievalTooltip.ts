import Phaser from 'phaser';
import type { NineSliceArtAsset } from '../art';
import { GAME_FONT_FAMILY } from '../themes/typography';
import { MEDIEVAL_UI_COLORS } from '../themes/medievalPalette';
import { MedievalPanel } from './MedievalPanel';

export interface MedievalTooltipOptions {
  x: number;
  y: number;
  title: string;
  body: string;
  skin?: NineSliceArtAsset;
  fallbackFill: number;
  fallbackLine: number;
  width?: number;
  depth?: number;
  bounds?: Phaser.Geom.Rectangle;
}

export class MedievalTooltip {
  static render(scene: Phaser.Scene, options: MedievalTooltipOptions): Phaser.GameObjects.Container {
    const width = options.width ?? 360;
    const horizontalPadding = 24;
    const title = scene.add.text(-width / 2 + horizontalPadding, 0, options.title, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '19px',
      color: MEDIEVAL_UI_COLORS.textBright,
      fontStyle: 'bold',
      wordWrap: { width: width - horizontalPadding * 2, useAdvancedWrap: true },
    });
    const body = scene.add.text(-width / 2 + horizontalPadding, 0, options.body, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '16px',
      color: MEDIEVAL_UI_COLORS.text,
      lineSpacing: 6,
      wordWrap: { width: width - horizontalPadding * 2, useAdvancedWrap: true },
    });
    const height = Math.max(120, title.height + body.height + 70);
    const bounds = options.bounds ?? new Phaser.Geom.Rectangle(0, 0, 1280, 720);
    const safeX = Phaser.Math.Clamp(options.x, bounds.left + width / 2 + 12, bounds.right - width / 2 - 12);
    const safeY = Phaser.Math.Clamp(options.y, bounds.top + height / 2 + 12, bounds.bottom - height / 2 - 12);
    const container = scene.add.container(safeX, safeY)
      .setDepth(options.depth ?? 180)
      .setName('skill-tooltip');

    const panel = MedievalPanel.render(scene, {
      width,
      height,
      skin: options.skin,
      fallbackFill: options.fallbackFill,
      fallbackLine: options.fallbackLine,
    });
    const dividerY = -height / 2 + 48;
    const divider = scene.add.rectangle(0, dividerY, width - 48, 1, MEDIEVAL_UI_COLORS.line, 0.68);
    const dividerCore = scene.add.rectangle(0, dividerY, 52, 2, MEDIEVAL_UI_COLORS.accent, 0.82);

    title.setY(-height / 2 + 18);
    body.setY(dividerY + 14);
    container.add([panel, divider, dividerCore, title, body]);
    return container;
  }
}

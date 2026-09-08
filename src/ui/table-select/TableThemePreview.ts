import Phaser from 'phaser';
import type { TableThemeConfig } from '../../game/types/tableTheme';
import { getTableThemeSelectArt } from './TableThemeArtRegistry';
import { TABLE_THEME_CARD_LAYOUT } from './tableSelectLayout';

export class TableThemePreview {
  static render(
    scene: Phaser.Scene,
    theme: TableThemeConfig,
    unlocked: boolean,
  ): Phaser.GameObjects.Container {
    const container = scene.add.container(0, 0);
    const art = getTableThemeSelectArt(theme.id);
    const { width, height } = TABLE_THEME_CARD_LAYOUT.preview;
    const shadow = scene.add.rectangle(3, 4, width + 4, height + 4, 0x000000, 0.5);
    const preview = scene.add.image(0, 0, art.previewKey).setDisplaySize(width, height);
    const wash = scene.add.rectangle(0, 0, width, height, 0x09090b, unlocked ? 0.08 : 0.62);
    const border = scene.add.rectangle(0, 0, width + 6, height + 6, 0x000000, 0)
      .setStrokeStyle(2, unlocked ? theme.visual.accentColor : 0x55545a, unlocked ? 0.9 : 0.58);
    container.add([shadow, preview, wash, border]);
    return container;
  }
}

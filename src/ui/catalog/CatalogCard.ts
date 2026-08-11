import Phaser from 'phaser';
import { t } from '../../game/i18n';
import type { CatalogEntryViewModel } from './CatalogViewModel';

interface CatalogCardOptions {
  entry: CatalogEntryViewModel;
  width: number;
  height: number;
  selected: boolean;
  metaText: string;
  actionLabel?: string;
  colors: {
    panel: number;
    panelHover: number;
    line: number;
    accent: number;
    accentText: string;
    text: string;
    muted: string;
    equipped: number;
  };
  createButton: (x: number, y: number, width: number, height: number, label: string, onClick: () => void) => Phaser.GameObjects.Container;
  onSelect: () => void;
  onAction?: () => void;
}

export class CatalogCard {
  static render(scene: Phaser.Scene, options: CatalogCardOptions): Phaser.GameObjects.Container {
    const { entry, width, height } = options;
    const container = scene.add.container(0, 0);
    const border = entry.equipped ? options.colors.equipped : options.selected ? options.colors.accent : options.colors.line;
    const background = scene.add.rectangle(0, 0, width, height, options.colors.panel, 0.98).setStrokeStyle(2, border);
    background.setInteractive({ useHandCursor: true });
    background.on(Phaser.Input.Events.POINTER_OVER, () => {
      background.setFillStyle(options.colors.panelHover, 0.98);
      background.setStrokeStyle(2, options.colors.accent);
      options.onSelect();
    });
    background.on(Phaser.Input.Events.POINTER_OUT, () => {
      background.setFillStyle(options.colors.panel, 0.98);
      background.setStrokeStyle(2, border);
    });
    background.on(Phaser.Input.Events.POINTER_DOWN, options.onSelect);
    container.add(background);

    const visualY = -height / 2 + 39;
    container.add(scene.add.rectangle(0, visualY, 64, 58, 0x111319, 0.78).setStrokeStyle(1, border, 0.75));
    if (entry.visual.thumbnailTextureKey && scene.textures.exists(entry.visual.thumbnailTextureKey)) {
      container.add(scene.add.image(0, visualY, entry.visual.thumbnailTextureKey).setDisplaySize(56, 50));
    } else {
      const icon = scene.add.text(0, visualY - 1, entry.visual.fallbackIcon, {
        fontFamily: 'Arial',
        fontSize: '30px',
        color: entry.equipped ? '#9fe7ff' : options.colors.accentText,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      icon.setShadow(0, 0, entry.equipped ? '#9fe7ff' : options.colors.accentText, 8, true, true);
      container.add(icon);
    }

    container.add(scene.add.text(0, 1, t(entry.nameKey), {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: options.colors.text,
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: width - 22 },
    }).setOrigin(0.5));
    container.add(scene.add.text(0, 25, options.metaText, {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: entry.equipped ? '#9fe7ff' : options.colors.muted,
    }).setOrigin(0.5));
    if (options.actionLabel && options.onAction) {
      container.add(options.createButton(-72, height / 2 - 33, 144, 30, options.actionLabel, options.onAction));
    }

    return container;
  }
}

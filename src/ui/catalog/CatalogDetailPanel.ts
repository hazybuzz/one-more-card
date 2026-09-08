import Phaser from 'phaser';
import { GAME_FONT_FAMILY } from '../themes/typography';
import { CATALOG_LEATHER_PANEL_SKIN } from '../art/commonUiArt';
import { SOUL_COIN_TEXTURE_KEY } from '../components/SoulCoinDisplay';
import { t } from '../../game/i18n';
import type { CatalogEntryViewModel } from './CatalogViewModel';

interface CatalogDetailPanelOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  entry: CatalogEntryViewModel;
  categoryLabel: string;
  ownershipText: string;
  priceText?: string;
  actionLabel?: string;
  colors: {
    panel: number;
    line: number;
    accent: number;
    accentText: string;
    text: string;
    muted: string;
    equipped: number;
  };
  createButton: (x: number, y: number, width: number, height: number, label: string, onClick: () => void) => Phaser.GameObjects.Container;
  onAction?: () => void;
}

export class CatalogDetailPanel {
  static render(scene: Phaser.Scene, options: CatalogDetailPanelOptions): Phaser.GameObjects.Container {
    const { entry, width, height } = options;
    const container = scene.add.container(options.x, options.y);
    const border = entry.equipped ? options.colors.equipped : options.colors.accent;
    const panel = scene.textures.exists(CATALOG_LEATHER_PANEL_SKIN.textureKey)
      ? scene.add.nineslice(
        width / 2,
        height / 2,
        CATALOG_LEATHER_PANEL_SKIN.textureKey,
        undefined,
        width,
        height,
        CATALOG_LEATHER_PANEL_SKIN.leftWidth,
        CATALOG_LEATHER_PANEL_SKIN.rightWidth,
        CATALOG_LEATHER_PANEL_SKIN.topHeight,
        CATALOG_LEATHER_PANEL_SKIN.bottomHeight,
      ).setTint(entry.equipped ? 0xc8eaff : 0xffe0aa)
      : scene.add.rectangle(width / 2, height / 2, width, height, options.colors.panel, 0.98).setStrokeStyle(2, border);
    container.add(panel);

    container.add(scene.add.text(22, 20, options.categoryLabel, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '14px',
      color: options.colors.muted,
    }));

    const previewX = width / 2;
    const previewY = 112;
    container.add(scene.add.rectangle(previewX, previewY, 144, 126, 0x111319, 0.82).setStrokeStyle(2, border, 0.78));
    const previewKey = entry.visual.previewTextureKey ?? entry.visual.thumbnailTextureKey;
    if (previewKey && scene.textures.exists(previewKey)) {
      container.add(scene.add.image(previewX, previewY, previewKey).setDisplaySize(134, 116));
    } else {
      const icon = scene.add.text(previewX, previewY - 2, entry.visual.fallbackIcon, {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: '54px',
        color: entry.equipped ? '#9fe7ff' : options.colors.accentText,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      icon.setShadow(0, 0, entry.equipped ? '#9fe7ff' : options.colors.accentText, 12, true, true);
      container.add(icon);
    }

    container.add(scene.add.text(width / 2, 194, t(entry.nameKey), {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '24px',
      color: options.colors.text,
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: width - 36, useAdvancedWrap: true },
    }).setOrigin(0.5));
    container.add(scene.add.text(22, 232, t(entry.descriptionKey), {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '15px',
      color: options.colors.muted,
      lineSpacing: 6,
      wordWrap: { width: width - 44, useAdvancedWrap: true },
    }));

    container.add(scene.add.line(width / 2, height - 126, 0, 0, width - 44, 0, options.colors.line, 0.9).setLineWidth(1));
    container.add(scene.add.text(22, height - 106, options.ownershipText, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '15px',
      color: entry.equipped ? '#9fe7ff' : options.colors.text,
      fontStyle: entry.equipped ? 'bold' : 'normal',
    }));
    if (options.priceText) {
      const hasCoinIcon = scene.textures.exists(SOUL_COIN_TEXTURE_KEY);
      const coinX = width - 27;
      const priceY = height - 97;
      container.add(scene.add.text(hasCoinIcon ? coinX - 9 : width - 22, priceY, options.priceText, {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: '15px',
        color: options.colors.accentText,
        fontStyle: 'bold',
      }).setOrigin(1, 0.5));
      if (hasCoinIcon) {
        container.add(scene.add.image(coinX, priceY + 1.5, SOUL_COIN_TEXTURE_KEY).setDisplaySize(10, 10));
      }
    }
    if (options.actionLabel && options.onAction) {
      container.add(options.createButton(22, height - 66, width - 44, 44, options.actionLabel, options.onAction));
    }
    return container;
  }
}

import Phaser from 'phaser';
import { GAME_FONT_FAMILY } from '../themes/typography';
import { CATALOG_LEATHER_PANEL_SKIN } from '../art/commonUiArt';
import { SOUL_COIN_TEXTURE_KEY } from '../components/SoulCoinDisplay';
import { t } from '../../game/i18n';
import type { CatalogEntryViewModel } from './CatalogViewModel';

interface CatalogCardOptions {
  entry: CatalogEntryViewModel;
  width: number;
  height: number;
  selected: boolean;
  metaText: string;
  priceText?: string;
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
    let selected = options.selected;
    const border = entry.equipped ? options.colors.equipped : options.selected ? options.colors.accent : options.colors.line;
    const selectionHalo = scene.add.rectangle(0, 0, width + 4, height + 4, options.colors.accent, 0.055)
      .setStrokeStyle(2, options.colors.accent, 0.78)
      .setAlpha(selected ? 1 : 0);
    container.add(selectionHalo);
    const hasPanelSkin = scene.textures.exists(CATALOG_LEATHER_PANEL_SKIN.textureKey);
    const background = hasPanelSkin
      ? scene.add.nineslice(
        0,
        0,
        CATALOG_LEATHER_PANEL_SKIN.textureKey,
        undefined,
        width,
        height,
        CATALOG_LEATHER_PANEL_SKIN.leftWidth,
        CATALOG_LEATHER_PANEL_SKIN.rightWidth,
        CATALOG_LEATHER_PANEL_SKIN.topHeight,
        CATALOG_LEATHER_PANEL_SKIN.bottomHeight,
      )
      : scene.add.rectangle(0, 0, width, height, options.colors.panel, 0.98).setStrokeStyle(2, border);
    const applyBackgroundState = (state: 'rest' | 'hover'): void => {
      if (background instanceof Phaser.GameObjects.NineSlice) {
        const restTint = entry.equipped ? 0xc8eaff : selected ? 0xffdfad : 0xd0b99d;
        background.setTint(state === 'hover' ? 0xffe2b8 : restTint);
        return;
      }
      background.setFillStyle(state === 'hover' ? options.colors.panelHover : options.colors.panel, 0.98);
      background.setStrokeStyle(2, state === 'hover' ? options.colors.accent : border);
    };
    applyBackgroundState('rest');
    background.setInteractive({ useHandCursor: true });
    background.on(Phaser.Input.Events.POINTER_OVER, () => {
      applyBackgroundState('hover');
      options.onSelect();
    });
    background.on(Phaser.Input.Events.POINTER_OUT, () => {
      applyBackgroundState('rest');
    });
    background.on(Phaser.Input.Events.POINTER_DOWN, options.onSelect);
    container.add(background);

    const visualY = -height / 2 + 42;
    container.add(scene.add.rectangle(0, visualY, 58, 54, 0x160d09, 0.94).setStrokeStyle(1, 0x8e683c, 0.88));
    if (entry.visual.thumbnailTextureKey && scene.textures.exists(entry.visual.thumbnailTextureKey)) {
      if (entry.visual.accentColor !== undefined) {
        container.add(scene.add.ellipse(0, visualY, 48, 34, entry.visual.accentColor, 0.18)
          .setBlendMode(Phaser.BlendModes.ADD));
      }
      const image = scene.add.image(0, visualY, entry.visual.thumbnailTextureKey);
      fitCatalogImage(image, 50, 46, entry.visual.textureAngle ?? 0);
      container.add(image);
    } else {
      const icon = scene.add.text(0, visualY - 1, entry.visual.fallbackIcon, {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: '30px',
        color: entry.equipped ? '#9fe7ff' : options.colors.accentText,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      icon.setShadow(0, 0, entry.equipped ? '#9fe7ff' : options.colors.accentText, 8, true, true);
      container.add(icon);
    }

    container.add(scene.add.text(0, 0, t(entry.nameKey), {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '16px',
      color: '#f1dfc0',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: width - 28 },
    }).setOrigin(0.5));
    const metaColor = entry.equipped ? '#9fe7ff' : '#bda991';
    if (options.priceText && scene.textures.exists(SOUL_COIN_TEXTURE_KEY)) {
      const metaRow = scene.add.container(0, 24);
      const price = scene.add.text(0, 0, options.priceText, {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: '14px',
        color: options.colors.accentText,
      }).setOrigin(0, 0.5);
      const coin = scene.add.image(0, 1.5, SOUL_COIN_TEXTURE_KEY).setDisplaySize(10, 10);
      const ownership = options.metaText
        ? scene.add.text(0, 0, `· ${options.metaText}`, {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: '14px',
          color: metaColor,
        }).setOrigin(0, 0.5)
        : undefined;
      const totalWidth = price.width + 4 + 10 + (ownership ? 7 + ownership.width : 0);
      let cursorX = -totalWidth / 2;
      price.setX(cursorX);
      cursorX += price.width + 4;
      coin.setX(cursorX + 5);
      cursorX += 10;
      if (ownership) {
        ownership.setX(cursorX + 7);
        metaRow.add(ownership);
      }
      metaRow.add([price, coin]);
      container.add(metaRow);
    } else {
      container.add(scene.add.text(0, 24, options.metaText, {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: '14px',
        color: metaColor,
      }).setOrigin(0.5));
    }
    if (options.actionLabel && options.onAction) {
      container.add(options.createButton(-78, height / 2 - 44, 156, 30, options.actionLabel, options.onAction));
    }

    container.setDataEnabled();
    container.setData('setSelected', (nextSelected: boolean): void => {
      selected = nextSelected;
      selectionHalo.setAlpha(selected ? 1 : 0);
      applyBackgroundState('rest');
    });

    return container;
  }
}

function fitCatalogImage(
  image: Phaser.GameObjects.Image,
  maxWidth: number,
  maxHeight: number,
  angle: number,
): void {
  const radians = Phaser.Math.DegToRad(angle);
  const rotatedWidth = Math.abs(image.width * Math.cos(radians)) + Math.abs(image.height * Math.sin(radians));
  const rotatedHeight = Math.abs(image.width * Math.sin(radians)) + Math.abs(image.height * Math.cos(radians));
  const scale = Math.min(maxWidth / rotatedWidth, maxHeight / rotatedHeight);
  image.setScale(scale).setAngle(angle);
}

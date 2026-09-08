import Phaser from 'phaser';
import { GAME_FONT_FAMILY } from '../themes/typography';
import { CATALOG_LEATHER_PANEL_SKIN } from '../art/commonUiArt';
import type { CatalogCategoryId } from './CatalogViewModel';

export interface CatalogCategoryTab {
  id: CatalogCategoryId;
  label: string;
  count: number;
}

interface CategoryTabsOptions {
  x: number;
  y: number;
  width: number;
  rowHeight?: number;
  gap?: number;
  activeCategory: CatalogCategoryId;
  tabs: CatalogCategoryTab[];
  colors: {
    panel: number;
    activePanel: number;
    line: number;
    accent: number;
    accentText: string;
    text: string;
    muted: string;
  };
  onSelect: (category: CatalogCategoryId) => void;
}

export class CategoryTabs {
  static render(scene: Phaser.Scene, options: CategoryTabsOptions): Phaser.GameObjects.Container {
    const rowHeight = options.rowHeight ?? 54;
    const gap = options.gap ?? 10;
    const container = scene.add.container(options.x, options.y);

    options.tabs.forEach((tab, index) => {
      const active = tab.id === options.activeCategory;
      const row = scene.add.container(0, index * (rowHeight + gap));
      const hasPanelSkin = scene.textures.exists(CATALOG_LEATHER_PANEL_SKIN.textureKey);
      const background = hasPanelSkin
        ? scene.add.nineslice(
          options.width / 2,
          rowHeight / 2,
          CATALOG_LEATHER_PANEL_SKIN.textureKey,
          undefined,
          options.width,
          rowHeight,
          CATALOG_LEATHER_PANEL_SKIN.leftWidth,
          CATALOG_LEATHER_PANEL_SKIN.rightWidth,
          CATALOG_LEATHER_PANEL_SKIN.topHeight,
          CATALOG_LEATHER_PANEL_SKIN.bottomHeight,
        )
        : scene.add.rectangle(
          options.width / 2,
          rowHeight / 2,
          options.width,
          rowHeight,
          active ? options.colors.activePanel : options.colors.panel,
          0.98,
        ).setStrokeStyle(2, active ? options.colors.accent : options.colors.line);
      const applyBackgroundState = (hovering: boolean): void => {
        if (background instanceof Phaser.GameObjects.NineSlice) {
          background.setTint(active ? 0xffd99b : hovering ? 0xe8c69c : 0xc5ad91);
          return;
        }
        background.setFillStyle(
          active ? options.colors.activePanel : hovering ? options.colors.activePanel : options.colors.panel,
          active ? 0.98 : hovering ? 0.72 : 0.98,
        );
      };
      applyBackgroundState(false);
      const label = scene.add.text(16, rowHeight / 2, tab.label, {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: '17px',
        color: active ? options.colors.text : options.colors.muted,
        fontStyle: active ? 'bold' : 'normal',
      }).setOrigin(0, 0.5);
      const count = scene.add.text(options.width - 16, rowHeight / 2, `${tab.count}`, {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: '15px',
        color: active ? options.colors.accentText : options.colors.muted,
        fontStyle: 'bold',
      }).setOrigin(1, 0.5);

      background.setInteractive({ useHandCursor: !active });
      background.on(Phaser.Input.Events.POINTER_OVER, () => {
        if (!active) {
          applyBackgroundState(true);
        }
      });
      background.on(Phaser.Input.Events.POINTER_OUT, () => {
        if (!active) {
          applyBackgroundState(false);
        }
      });
      background.on(Phaser.Input.Events.POINTER_DOWN, () => {
        if (!active) {
          options.onSelect(tab.id);
        }
      });
      row.add([background, label, count]);
      container.add(row);
    });

    return container;
  }
}

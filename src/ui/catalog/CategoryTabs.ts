import Phaser from 'phaser';
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
      const background = scene.add.rectangle(
        options.width / 2,
        rowHeight / 2,
        options.width,
        rowHeight,
        active ? options.colors.activePanel : options.colors.panel,
        0.98,
      ).setStrokeStyle(2, active ? options.colors.accent : options.colors.line);
      const label = scene.add.text(16, rowHeight / 2, tab.label, {
        fontFamily: 'Arial',
        fontSize: '17px',
        color: active ? options.colors.text : options.colors.muted,
        fontStyle: active ? 'bold' : 'normal',
      }).setOrigin(0, 0.5);
      const count = scene.add.text(options.width - 16, rowHeight / 2, `${tab.count}`, {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: active ? options.colors.accentText : options.colors.muted,
        fontStyle: 'bold',
      }).setOrigin(1, 0.5);

      background.setInteractive({ useHandCursor: !active });
      background.on(Phaser.Input.Events.POINTER_OVER, () => {
        if (!active) {
          background.setFillStyle(options.colors.activePanel, 0.72);
        }
      });
      background.on(Phaser.Input.Events.POINTER_OUT, () => {
        if (!active) {
          background.setFillStyle(options.colors.panel, 0.98);
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

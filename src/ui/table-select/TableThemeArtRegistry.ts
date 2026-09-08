import Phaser from 'phaser';
import type { TableThemeId } from '../../game/types/tableTheme';

export interface TableThemeSelectArt {
  frameKey: string;
  framePath: string;
  previewKey: string;
  previewPath: string;
}

export const TABLE_SELECT_BACKGROUND = {
  key: 'table-select-background',
  path: '/image/ui/table-select/background.png',
};

const TABLE_THEME_SELECT_ART: Record<TableThemeId, TableThemeSelectArt> = {
  evernight_tavern: {
    frameKey: 'table-select-card-evernight',
    framePath: '/image/ui/table-select/card-evernight.png',
    previewKey: 'table-select-preview-evernight',
    previewPath: '/image/ui/table-select/preview-evernight.png',
  },
  northern_longhouse: {
    frameKey: 'table-select-card-northern',
    framePath: '/image/ui/table-select/card-northern.png',
    previewKey: 'table-select-preview-northern',
    previewPath: '/image/ui/table-select/preview-northern.png',
  },
  dragon_gate: {
    frameKey: 'table-select-card-dragon',
    framePath: '/image/ui/table-select/card-dragon.png',
    previewKey: 'table-select-preview-dragon',
    previewPath: '/image/ui/table-select/preview-dragon.png',
  },
  edo_teahouse: {
    frameKey: 'table-select-card-edo',
    framePath: '/image/ui/table-select/card-edo.png',
    previewKey: 'table-select-preview-edo',
    previewPath: '/image/ui/table-select/preview-edo.png',
  },
};

export function getTableThemeSelectArt(themeId: TableThemeId): TableThemeSelectArt {
  return TABLE_THEME_SELECT_ART[themeId];
}

export function preloadTableSelectArt(scene: Phaser.Scene): void {
  if (!scene.textures.exists(TABLE_SELECT_BACKGROUND.key)) {
    scene.load.image(TABLE_SELECT_BACKGROUND.key, TABLE_SELECT_BACKGROUND.path);
  }

  Object.values(TABLE_THEME_SELECT_ART).forEach((art) => {
    if (!scene.textures.exists(art.frameKey)) {
      scene.load.image(art.frameKey, art.framePath);
    }
    if (!scene.textures.exists(art.previewKey)) {
      scene.load.image(art.previewKey, art.previewPath);
    }
  });
}

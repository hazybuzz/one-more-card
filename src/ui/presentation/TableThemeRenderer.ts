import Phaser from 'phaser';
import type { TableThemeVisualConfig } from '../../game/types/tableTheme';
import type { BattleThemeArtManifest, ImageArtAsset } from '../art';
import {
  renderBattleTableDecorations,
  renderBattleTableDecorationsAt,
  renderBattleTableSurface,
} from './BattleTableSurface';

export const DEFAULT_TABLE_THEME_VISUAL: TableThemeVisualConfig = {
  accentColor: 0xe8cf73,
  enemyFrameColor: 0xaeb6c3,
  glowColor: '#e8cf73',
  backgroundColor: 0x101114,
  panelColor: 0x1b1d22,
  panelAltColor: 0x252832,
  lineColor: 0x3b3f4c,
  tableColor: 0x191c22,
  tableRingColor: 0x2b303c,
  motif: 'tavern',
};

export function resolveTableThemeVisual(visual?: TableThemeVisualConfig): TableThemeVisualConfig {
  return visual ?? DEFAULT_TABLE_THEME_VISUAL;
}

export function renderBattleTableTheme(
  scene: Phaser.Scene,
  visual?: TableThemeVisualConfig,
  art?: BattleThemeArtManifest,
): void {
  const resolvedVisual = resolveTableThemeVisual(visual);
  if (art?.background && scene.textures.exists(art.background.textureKey)) {
    renderArtLayer(scene, art.background, -30);
    if (art.background.brightenAlpha && art.background.brightenAlpha > 0) {
      renderArtLayer(scene, art.background, -29)
        .setAlpha(art.background.brightenAlpha)
        .setBlendMode(Phaser.BlendModes.SCREEN);
    }
  } else if (resolvedVisual.motif === 'northern') {
    renderNorthernTheme(scene, resolvedVisual);
  } else if (resolvedVisual.motif === 'dragon') {
    renderDragonGateTheme(scene, resolvedVisual);
  } else if (resolvedVisual.motif === 'edo') {
    renderEdoTheme(scene, resolvedVisual);
  } else {
    renderTavernTheme(scene, resolvedVisual);
  }

  const tableOverlay = art?.tableOverlay && scene.textures.exists(art.tableOverlay.textureKey)
    ? art.tableOverlay
    : undefined;
  const backgroundIncludesTable = Boolean(
    art?.background?.includesTable && scene.textures.exists(art.background.textureKey),
  );
  if (!tableOverlay && !backgroundIncludesTable) {
    renderBattleTableSurface(scene, resolvedVisual);
  }
  if (tableOverlay) {
    renderArtLayer(scene, tableOverlay, -20);
    renderBattleTableDecorations(scene, resolvedVisual);
  }
  if (backgroundIncludesTable && art?.background?.tableCandlePositions?.length) {
    renderBattleTableDecorationsAt(scene, resolvedVisual, art.background.tableCandlePositions);
  }
  if (art?.foreground && scene.textures.exists(art.foreground.textureKey)) {
    renderArtLayer(scene, art.foreground, -10);
  }
}

function renderArtLayer(scene: Phaser.Scene, asset: ImageArtAsset, depth: number): Phaser.GameObjects.Image {
  const image = scene.add.image(640, 360, asset.textureKey).setDepth(depth);
  if (asset.fit === 'cover') {
    image.setScale(Math.max(1280 / image.width, 720 / image.height));
  } else {
    image.setDisplaySize(1280, 720);
  }
  return image;
}

function renderTavernTheme(scene: Phaser.Scene, visual: TableThemeVisualConfig): void {
  scene.add.rectangle(640, 360, 1280, 720, visual.backgroundColor);
  scene.add.rectangle(640, 360, 1280, 720, 0x14161a);
  scene.add.circle(640, 350, 205, visual.tableColor, 0.95).setStrokeStyle(2, visual.lineColor);
  scene.add.circle(640, 350, 145, 0x101114, 0.5).setStrokeStyle(1, visual.tableRingColor);
}

function renderNorthernTheme(scene: Phaser.Scene, visual: TableThemeVisualConfig): void {
  scene.add.rectangle(640, 360, 1280, 720, visual.backgroundColor);
  scene.add.rectangle(640, 90, 1280, 180, 0x0b1821, 0.86);
  scene.add.rectangle(640, 182, 1280, 16, 0x1c2b33, 0.82).setStrokeStyle(1, visual.lineColor, 0.42);
  scene.add.rectangle(640, 360, 1280, 720, 0x05080d, 0.22);

  for (let i = 0; i < 8; i += 1) {
    const x = 120 + i * 150;
    scene.add.rectangle(x, 84, 84, 18, 0x26343a, 0.74).setAngle(i % 2 === 0 ? -4 : 4);
  }

  scene.add.circle(198, 454, 46, 0xff8a3d, 0.08).setStrokeStyle(2, 0xff8a3d, 0.35);
  scene.add.circle(1082, 454, 46, 0xff8a3d, 0.08).setStrokeStyle(2, 0xff8a3d, 0.35);
  scene.add.circle(198, 454, 15, 0xff8a3d, 0.38);
  scene.add.circle(1082, 454, 15, 0xff8a3d, 0.38);

  scene.add.circle(640, 350, 214, visual.tableColor, 0.95).setStrokeStyle(3, visual.tableRingColor, 0.55);
  scene.add.circle(640, 350, 154, 0x071018, 0.58).setStrokeStyle(2, visual.tableRingColor, 0.32);
  scene.add.circle(640, 350, 90, 0x79c9ff, 0.035).setStrokeStyle(2, visual.tableRingColor, 0.24);
  ['I', 'V', 'X', 'R'].forEach((glyph, index) => {
    const angle = (-90 + index * 90) * (Math.PI / 180);
    const x = 640 + Math.cos(angle) * 178;
    const y = 350 + Math.sin(angle) * 178;
    const rune = scene.add.text(x, y, glyph, {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: visual.glowColor,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    rune.setAlpha(0.45);
    rune.setShadow(0, 0, visual.glowColor, 8, true, true);
  });

  for (let i = 0; i < 7; i += 1) {
    scene.add.rectangle(640, 236 + i * 34, 980 - i * 42, 1, visual.tableRingColor, 0.05 + i * 0.015);
  }
}

function renderDragonGateTheme(scene: Phaser.Scene, visual: TableThemeVisualConfig): void {
  scene.add.rectangle(640, 360, 1280, 720, visual.backgroundColor);
  scene.add.rectangle(640, 360, 1280, 720, 0x090204, 0.22);

  scene.add.rectangle(640, 74, 1280, 148, 0x260b0f, 0.88);
  scene.add.rectangle(640, 154, 1160, 18, 0x5d1f22, 0.72).setStrokeStyle(1, visual.tableRingColor, 0.45);
  for (let i = 0; i < 9; i += 1) {
    const x = 102 + i * 136;
    scene.add.rectangle(x, 76, 72, 116, 0x3a1417, 0.78).setStrokeStyle(2, 0x7a3131, 0.35);
    scene.add.rectangle(x, 76, 44, 92, 0x140609, 0.24).setStrokeStyle(1, visual.tableRingColor, 0.22);
  }

  renderLantern(scene, 142, 238, visual);
  renderLantern(scene, 1138, 238, visual);
  scene.add.rectangle(640, 186, 300, 58, 0x1f0a0d, 0.92).setStrokeStyle(3, visual.tableRingColor, 0.68);
  const sign = scene.add.text(640, 186, '龍門', {
    fontFamily: 'Arial',
    fontSize: '32px',
    color: visual.glowColor,
    fontStyle: 'bold',
  }).setOrigin(0.5);
  sign.setShadow(0, 0, visual.glowColor, 10, true, true);

  scene.add.circle(640, 350, 220, visual.tableColor, 0.97).setStrokeStyle(4, visual.tableRingColor, 0.7);
  scene.add.circle(640, 350, 160, 0x16080b, 0.58).setStrokeStyle(2, visual.tableRingColor, 0.36);
  scene.add.circle(640, 350, 96, 0x4f1518, 0.22).setStrokeStyle(2, visual.tableRingColor, 0.28);

  for (let i = 0; i < 8; i += 1) {
    const angle = (i * 45) * (Math.PI / 180);
    const x = 640 + Math.cos(angle) * 188;
    const y = 350 + Math.sin(angle) * 188;
    scene.add.rectangle(x, y, 46, 3, visual.tableRingColor, 0.26).setAngle(i * 45);
  }

  ['財', '命', '義', '機'].forEach((glyph, index) => {
    const angle = (-90 + index * 90) * (Math.PI / 180);
    const x = 640 + Math.cos(angle) * 132;
    const y = 350 + Math.sin(angle) * 132;
    const text = scene.add.text(x, y, glyph, {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: visual.glowColor,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    text.setAlpha(0.5);
    text.setShadow(0, 0, visual.glowColor, 8, true, true);
  });
}

function renderEdoTheme(scene: Phaser.Scene, visual: TableThemeVisualConfig): void {
  scene.add.rectangle(640, 360, 1280, 720, visual.backgroundColor);
  scene.add.rectangle(640, 360, 1280, 720, 0x08050d, 0.26);
  scene.add.rectangle(640, 84, 1280, 168, 0x1b1324, 0.92);
  scene.add.rectangle(640, 168, 1160, 16, 0x4e3047, 0.72).setStrokeStyle(1, visual.tableRingColor, 0.4);

  for (let index = 0; index < 9; index += 1) {
    const x = 100 + index * 135;
    scene.add.rectangle(x, 82, 70, 118, 0x271b31, 0.74).setStrokeStyle(1, 0x9a6b82, 0.34);
    scene.add.line(0, 0, x, 26, x, 138, 0xeccbd0, 0.14).setOrigin(0, 0).setLineWidth(1);
  }

  renderEdoLantern(scene, 154, 244, visual);
  renderEdoLantern(scene, 1126, 244, visual);
  scene.add.circle(640, 350, 222, visual.tableColor, 0.97).setStrokeStyle(4, visual.tableRingColor, 0.68);
  scene.add.circle(640, 350, 162, 0x1a0f1d, 0.62).setStrokeStyle(2, 0xf0b4c0, 0.34);
  scene.add.circle(640, 350, 98, 0x4d263d, 0.2).setStrokeStyle(2, visual.tableRingColor, 0.24);

  ['花', '影', '刃', '宴'].forEach((glyph, index) => {
    const angle = (-90 + index * 90) * (Math.PI / 180);
    const x = 640 + Math.cos(angle) * 134;
    const y = 350 + Math.sin(angle) * 134;
    const text = scene.add.text(x, y, glyph, {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: visual.glowColor,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    text.setAlpha(0.5);
    text.setShadow(0, 0, visual.glowColor, 8, true, true);
  });
}

function renderLantern(scene: Phaser.Scene, x: number, y: number, visual: TableThemeVisualConfig): void {
  scene.add.line(0, 0, x, y - 92, x, y - 46, visual.tableRingColor, 0.4).setOrigin(0, 0).setLineWidth(2);
  scene.add.ellipse(x, y, 58, 78, 0xb72a24, 0.82).setStrokeStyle(3, visual.tableRingColor, 0.72);
  scene.add.rectangle(x, y - 40, 42, 8, visual.tableRingColor, 0.72);
  scene.add.rectangle(x, y + 40, 42, 8, visual.tableRingColor, 0.72);
  scene.add.circle(x, y, 26, 0xffd46b, 0.12);
}

function renderEdoLantern(scene: Phaser.Scene, x: number, y: number, visual: TableThemeVisualConfig): void {
  scene.add.line(0, 0, x, y - 96, x, y - 42, visual.tableRingColor, 0.44).setOrigin(0, 0).setLineWidth(2);
  scene.add.ellipse(x, y, 54, 70, 0xc65a75, 0.76).setStrokeStyle(3, visual.tableRingColor, 0.7);
  scene.add.rectangle(x, y - 37, 40, 7, visual.tableRingColor, 0.76);
  scene.add.rectangle(x, y + 37, 40, 7, visual.tableRingColor, 0.76);
  scene.add.circle(x, y, 22, 0xffd9a0, 0.14);
}

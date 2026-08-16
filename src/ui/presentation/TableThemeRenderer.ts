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
  } else {
    renderProceduralBackground(scene, resolvedVisual);
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

function renderProceduralBackground(scene: Phaser.Scene, visual: TableThemeVisualConfig): void {
  const existing = new Set(scene.children.getChildren());
  if (visual.motif === 'northern') {
    renderNorthernTheme(scene, visual);
  } else if (visual.motif === 'dragon') {
    renderDragonGateTheme(scene, visual);
  } else if (visual.motif === 'edo') {
    renderEdoTheme(scene, visual);
  } else {
    renderTavernTheme(scene, visual);
  }

  scene.children.getChildren().forEach((child) => {
    if (!existing.has(child)) {
      (child as Phaser.GameObjects.GameObject & { setDepth(depth: number): unknown }).setDepth(-30);
    }
  });
}

function renderArtLayer(scene: Phaser.Scene, asset: ImageArtAsset, depth: number): Phaser.GameObjects.Image {
  const image = scene.add.image(asset.x ?? 640, asset.y ?? 360, asset.textureKey).setDepth(depth);
  if (asset.displayWidth && asset.displayHeight) {
    image.setDisplaySize(asset.displayWidth, asset.displayHeight);
  } else if (asset.fit === 'cover') {
    image.setScale(Math.max(1280 / image.width, 720 / image.height));
  } else {
    image.setDisplaySize(1280, 720);
  }
  return image;
}

function renderTavernTheme(scene: Phaser.Scene, visual: TableThemeVisualConfig): void {
  scene.add.rectangle(640, 360, 1280, 720, visual.backgroundColor);
  scene.add.rectangle(640, 360, 1280, 720, 0x14161a);
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

  const tableTextureKey = ensureNorthernTableTexture(scene);
  if (tableTextureKey) {
    scene.add.image(640, 360, tableTextureKey).setDisplaySize(1280, 720);
  }

  renderNorthernPixelCandle(scene, 198, 454, 0);
  renderNorthernPixelCandle(scene, 1082, 454, 180);

  const runes = ['I', 'V', 'X', 'R'].map((glyph, index) => {
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
    return rune;
  });

  scene.tweens.add({
    targets: runes,
    alpha: { from: 0.28, to: 0.58 },
    duration: 1500,
    yoyo: true,
    repeat: -1,
    ease: 'Stepped',
    easeParams: [4],
  });
  runes[0]?.once(Phaser.GameObjects.Events.DESTROY, () => scene.tweens.killTweensOf(runes));
}

const NORTHERN_TABLE_TEXTURE_KEY = 'procedural-northern-table-pixel-v1';

function ensureNorthernTableTexture(scene: Phaser.Scene): string | undefined {
  if (scene.textures.exists(NORTHERN_TABLE_TEXTURE_KEY)) {
    return NORTHERN_TABLE_TEXTURE_KEY;
  }

  const texture = scene.textures.createCanvas(NORTHERN_TABLE_TEXTURE_KEY, 320, 180);
  if (!texture) {
    return undefined;
  }

  const context = texture.getContext();
  const centerX = 160;
  const centerY = 88;
  const outerRadius = 57;
  const clothRadius = 47;
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, 320, 180);

  context.save();
  context.beginPath();
  context.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
  context.clip();
  context.fillStyle = '#342a26';
  context.fillRect(centerX - outerRadius, centerY - outerRadius, outerRadius * 2, outerRadius * 2);

  context.fillStyle = '#46372e';
  for (let index = 0; index < 72; index += 1) {
    const angle = ((index * 47) % 360) * (Math.PI / 180);
    const distance = 48 + ((index * 13) % 8);
    const x = Math.round(centerX + Math.cos(angle) * distance);
    const y = Math.round(centerY + Math.sin(angle) * distance);
    const length = 2 + (index % 4);
    context.fillRect(x, y, index % 2 === 0 ? length : 1, index % 2 === 0 ? 1 : length);
  }

  context.strokeStyle = '#171b20';
  context.lineWidth = 1;
  for (let index = 0; index < 12; index += 1) {
    const angle = index * Math.PI / 6;
    context.beginPath();
    context.moveTo(
      Math.round(centerX + Math.cos(angle) * clothRadius),
      Math.round(centerY + Math.sin(angle) * clothRadius),
    );
    context.lineTo(
      Math.round(centerX + Math.cos(angle) * outerRadius),
      Math.round(centerY + Math.sin(angle) * outerRadius),
    );
    context.stroke();
  }
  context.restore();

  context.fillStyle = '#0c1822';
  context.beginPath();
  context.arc(centerX, centerY, clothRadius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#496879';
  context.lineWidth = 2;
  context.stroke();

  context.save();
  context.beginPath();
  context.arc(centerX, centerY, clothRadius - 2, 0, Math.PI * 2);
  context.clip();
  for (let y = centerY - 44; y <= centerY + 44; y += 2) {
    for (let x = centerX - 44; x <= centerX + 44; x += 2) {
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy > 43 * 43) {
        continue;
      }
      const noise = Math.abs((x * 17 + y * 31 + x * y * 3) % 29);
      if (noise === 0) {
        context.fillStyle = '#142839';
        context.fillRect(x, y, 1, 1);
      } else if (noise === 1) {
        context.fillStyle = '#08121b';
        context.fillRect(x, y, 1, 1);
      }
    }
  }
  context.restore();

  context.setLineDash([2, 2]);
  context.strokeStyle = '#7896a4';
  context.lineWidth = 1;
  context.beginPath();
  context.arc(centerX, centerY, clothRadius - 4, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);

  context.strokeStyle = '#6f93a8';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(centerX, centerY - 17);
  context.lineTo(centerX, centerY + 18);
  context.moveTo(centerX - 10, centerY - 7);
  context.lineTo(centerX, centerY + 1);
  context.lineTo(centerX + 10, centerY - 7);
  context.moveTo(centerX - 8, centerY + 9);
  context.lineTo(centerX, centerY + 18);
  context.lineTo(centerX + 8, centerY + 9);
  context.stroke();

  context.fillStyle = '#11151a';
  for (let index = 0; index < 8; index += 1) {
    const angle = index * Math.PI / 4 + Math.PI / 8;
    const x = Math.round(centerX + Math.cos(angle) * 53);
    const y = Math.round(centerY + Math.sin(angle) * 53);
    context.fillRect(x - 1, y - 1, 3, 3);
    context.fillStyle = '#78818a';
    context.fillRect(x, y, 1, 1);
    context.fillStyle = '#11151a';
  }

  texture.update();
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return NORTHERN_TABLE_TEXTURE_KEY;
}

function renderNorthernPixelCandle(scene: Phaser.Scene, x: number, y: number, phase: number): void {
  const container = scene.add.container(x, y);
  const outerGlow = scene.add.rectangle(0, -20, 72, 60, 0xff8738, 0.035);
  const innerGlow = scene.add.rectangle(0, -20, 38, 42, 0xffb34f, 0.07);
  const waxShadow = scene.add.rectangle(2, 2, 13, 31, 0x6e777d, 0.96);
  const wax = scene.add.rectangle(0, 0, 11, 30, 0xc8c4ad, 1);
  const waxLight = scene.add.rectangle(-3, -1, 3, 26, 0xf0e4bd, 0.78);
  const wick = scene.add.rectangle(0, -18, 2, 5, 0x17191c, 1);
  const flameOuter = scene.add.rectangle(0, -25, 7, 11, 0xf26f2c, 0.96);
  const flameCore = scene.add.rectangle(0, -24, 3, 7, 0xffe58a, 1);
  const sparkA = scene.add.rectangle(-5, -31, 2, 2, 0xffbd62, 0.82);
  const sparkB = scene.add.rectangle(5, -35, 2, 2, 0xff8a3d, 0.72);
  outerGlow.setBlendMode(Phaser.BlendModes.ADD);
  innerGlow.setBlendMode(Phaser.BlendModes.ADD);
  container.add([outerGlow, innerGlow, waxShadow, wax, waxLight, wick, flameOuter, flameCore, sparkA, sparkB]);

  scene.tweens.add({
    targets: [outerGlow, innerGlow],
    alpha: { from: 0.035, to: 0.11 },
    scaleX: { from: 0.94, to: 1.06 },
    scaleY: { from: 0.96, to: 1.04 },
    duration: 760,
    delay: phase,
    yoyo: true,
    repeat: -1,
    ease: 'Stepped',
    easeParams: [4],
  });
  scene.tweens.add({
    targets: [flameOuter, flameCore],
    scaleX: { from: 0.82, to: 1.1 },
    scaleY: { from: 0.9, to: 1.14 },
    x: { from: -1, to: 1 },
    duration: 310,
    delay: phase,
    yoyo: true,
    repeat: -1,
    ease: 'Stepped',
    easeParams: [3],
  });
  [sparkA, sparkB].forEach((spark, index) => {
    const startY = spark.y;
    scene.tweens.add({
      targets: spark,
      y: startY - 14 - index * 4,
      alpha: 0,
      duration: 720 + index * 160,
      delay: phase + index * 260,
      repeat: -1,
      repeatDelay: 460 + index * 180,
      ease: 'Stepped',
      easeParams: [5],
    });
  });
  container.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.tweens.killTweensOf([outerGlow, innerGlow, flameOuter, flameCore, sparkA, sparkB]);
  });
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

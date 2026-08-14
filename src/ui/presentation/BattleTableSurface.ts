import Phaser from 'phaser';
import type { TableSurfaceVisualConfig, TableThemeVisualConfig } from '../../game/types/tableTheme';

const DEFAULT_SURFACE: TableSurfaceVisualConfig = {
  woodColor: 0x3a2418,
  woodEdgeColor: 0x17100c,
  clothColor: 0x42161c,
  clothBorderColor: 0xb78a4b,
  motifColor: 0xd8bd72,
  lightColor: 0xffc66d,
};

export function renderBattleTableSurface(scene: Phaser.Scene, visual: TableThemeVisualConfig): void {
  const surface = visual.tableSurface ?? DEFAULT_SURFACE;
  const container = scene.add.container(0, 0);
  const graphics = scene.add.graphics();

  drawTrapezoid(graphics, 640, 220, 440, 630, 1200, surface.woodColor, 0.98);
  graphics.lineStyle(4, surface.clothBorderColor, 0.28);
  strokeTrapezoid(graphics, 640, 220, 440, 630, 1200);
  drawWoodPlanks(graphics, surface);
  drawFrontEdge(graphics, surface);
  container.add(graphics);

  const cloth = scene.add.graphics();
  drawTrapezoid(cloth, 640, 246, 290, 608, 800, surface.clothColor, 0.93);
  cloth.lineStyle(3, surface.clothBorderColor, 0.68);
  strokeTrapezoid(cloth, 640, 246, 290, 608, 800);
  cloth.lineStyle(1, surface.clothBorderColor, 0.34);
  strokeTrapezoid(cloth, 640, 257, 270, 594, 750);
  container.add(cloth);

  const motif = scene.add.container(640, 420).setAlpha(0.13);
  motif.add(renderMotif(scene, visual.motif, surface.motifColor));
  container.add(motif);
  addTableCandles(scene, container, surface);
}

export function renderBattleTableDecorations(scene: Phaser.Scene, visual: TableThemeVisualConfig): void {
  renderBattleTableDecorationsAt(scene, visual, [
    { x: 430, y: 280, scale: 0.82 },
    { x: 850, y: 280, scale: 0.82 },
  ]);
}

export function renderBattleTableDecorationsAt(
  scene: Phaser.Scene,
  visual: TableThemeVisualConfig,
  positions: Array<{ x: number; y: number; scale?: number }>,
): void {
  const surface = visual.tableSurface ?? DEFAULT_SURFACE;
  const container = scene.add.container(0, 0).setDepth(-9);
  positions.forEach(({ x, y, scale = 0.82 }) => {
    container.add(createCandle(scene, x, y, surface, scale));
  });
}

function addTableCandles(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  surface: TableSurfaceVisualConfig,
): void {
  container.add(createCandle(scene, 430, 280, surface, 0.82));
  container.add(createCandle(scene, 850, 280, surface, 0.82));
}

function drawWoodPlanks(graphics: Phaser.GameObjects.Graphics, surface: TableSurfaceVisualConfig): void {
  graphics.lineStyle(2, surface.woodEdgeColor, 0.3);
  [-390, -195, 195, 390].forEach((offset) => {
    graphics.beginPath();
    graphics.moveTo(640 + offset * 0.37, 224);
    graphics.lineTo(640 + offset, 624);
    graphics.strokePath();
  });
  graphics.lineStyle(1, surface.clothBorderColor, 0.1);
  [318, 424, 530].forEach((y) => {
    const progress = (y - 220) / 410;
    const halfWidth = Phaser.Math.Linear(220, 600, progress);
    graphics.beginPath();
    graphics.moveTo(640 - halfWidth, y);
    graphics.lineTo(640 + halfWidth, y);
    graphics.strokePath();
  });
}

function drawFrontEdge(graphics: Phaser.GameObjects.Graphics, surface: TableSurfaceVisualConfig): void {
  graphics.fillStyle(surface.woodEdgeColor, 0.98);
  graphics.beginPath();
  graphics.moveTo(40, 630);
  graphics.lineTo(1240, 630);
  graphics.lineTo(1212, 660);
  graphics.lineTo(68, 660);
  graphics.closePath();
  graphics.fillPath();
  graphics.lineStyle(3, surface.clothBorderColor, 0.25);
  graphics.beginPath();
  graphics.moveTo(40, 630);
  graphics.lineTo(1240, 630);
  graphics.strokePath();
  graphics.lineStyle(2, 0x000000, 0.45);
  graphics.beginPath();
  graphics.moveTo(68, 660);
  graphics.lineTo(1212, 660);
  graphics.strokePath();
}

function renderMotif(scene: Phaser.Scene, motif: TableThemeVisualConfig['motif'], color: number): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics();
  graphics.lineStyle(3, color, 0.92);
  if (motif === 'northern') {
    drawNorthernMotif(graphics);
  } else if (motif === 'dragon') {
    drawDragonMotif(graphics);
  } else if (motif === 'edo') {
    drawEdoMotif(graphics);
  } else {
    drawTavernMotif(graphics);
  }
  return graphics;
}

function drawTavernMotif(graphics: Phaser.GameObjects.Graphics): void {
  graphics.strokeCircle(0, 0, 90);
  graphics.strokeCircle(0, 0, 54);
  drawDiamond(graphics, 0, 0, 112);
  [-1, 1].forEach((direction) => {
    graphics.beginPath();
    graphics.moveTo(direction * 118, 0);
    graphics.lineTo(direction * 184, 0);
    graphics.strokePath();
  });
}

function drawNorthernMotif(graphics: Phaser.GameObjects.Graphics): void {
  drawDiamond(graphics, 0, 0, 108);
  graphics.beginPath();
  graphics.moveTo(0, -112);
  graphics.lineTo(0, 112);
  graphics.moveTo(-76, -76);
  graphics.lineTo(76, 76);
  graphics.moveTo(76, -76);
  graphics.lineTo(-76, 76);
  graphics.strokePath();
  [-150, 150].forEach((x) => {
    graphics.beginPath();
    graphics.moveTo(x - 18, -30);
    graphics.lineTo(x + 18, 0);
    graphics.lineTo(x - 18, 30);
    graphics.strokePath();
  });
}

function drawDragonMotif(graphics: Phaser.GameObjects.Graphics): void {
  [48, 82, 116].forEach((size) => drawDiamond(graphics, 0, 0, size));
  [-190, 190].forEach((x) => {
    graphics.strokeRect(x - 34, -34, 68, 68);
    drawDiamond(graphics, x, 0, 34);
  });
}

function drawEdoMotif(graphics: Phaser.GameObjects.Graphics): void {
  for (let index = 0; index < 5; index += 1) {
    const angle = Phaser.Math.DegToRad(-56 + index * 28);
    graphics.beginPath();
    graphics.arc(0, 52, 118, angle - 0.17, angle + 0.17, false);
    graphics.strokePath();
  }
  graphics.beginPath();
  graphics.arc(0, 52, 118, Phaser.Math.DegToRad(-72), Phaser.Math.DegToRad(72), false);
  graphics.strokePath();
  [-158, 158].forEach((x) => graphics.strokeCircle(x, 0, 18));
}

function createCandle(
  scene: Phaser.Scene,
  x: number,
  y: number,
  surface: TableSurfaceVisualConfig,
  scale = 1,
): Phaser.GameObjects.Container {
  const candle = scene.add.container(x, y).setScale(scale);
  const glow = scene.add.circle(0, -24, 58, surface.lightColor, 0.09);
  const tray = scene.add.ellipse(0, 26, 56, 16, 0x21160f, 0.96).setStrokeStyle(2, surface.clothBorderColor, 0.48);
  const wax = scene.add.rectangle(0, 0, 22, 56, 0xe2cfaa, 0.96).setStrokeStyle(1, 0x8f7356, 0.75);
  const waxDrip = scene.add.rectangle(6, -8, 5, 20, 0xf3e3bf, 0.88).setOrigin(0.5, 0);
  const wick = scene.add.rectangle(0, -32, 2, 10, 0x271b17, 0.94);
  const flame = scene.add.ellipse(0, -44, 12, 25, surface.lightColor, 0.94).setStrokeStyle(1, 0xffedaa, 0.88);
  const flameCore = scene.add.ellipse(0, -41, 5, 12, 0xfff4c7, 0.96);
  candle.add([glow, tray, wax, waxDrip, wick, flame, flameCore]);
  scene.tweens.add({
    targets: [flame, flameCore],
    scaleX: { from: 0.86, to: 1.08 },
    scaleY: { from: 0.92, to: 1.12 },
    angle: { from: -3, to: 3 },
    duration: 680,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.06, to: 0.14 },
    scale: { from: 0.9, to: 1.08 },
    duration: 920,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  candle.once(Phaser.GameObjects.Events.DESTROY, () => scene.tweens.killTweensOf([glow, flame, flameCore]));
  return candle;
}

function drawDiamond(graphics: Phaser.GameObjects.Graphics, x: number, y: number, extent: number): void {
  graphics.beginPath();
  graphics.moveTo(x, y - extent);
  graphics.lineTo(x + extent, y);
  graphics.lineTo(x, y + extent);
  graphics.lineTo(x - extent, y);
  graphics.closePath();
  graphics.strokePath();
}

function drawTrapezoid(
  graphics: Phaser.GameObjects.Graphics,
  centerX: number,
  topY: number,
  topWidth: number,
  bottomY: number,
  bottomWidth: number,
  color: number,
  alpha: number,
): void {
  graphics.fillStyle(color, alpha);
  graphics.beginPath();
  trapezoidPath(graphics, centerX, topY, topWidth, bottomY, bottomWidth);
  graphics.fillPath();
}

function strokeTrapezoid(
  graphics: Phaser.GameObjects.Graphics,
  centerX: number,
  topY: number,
  topWidth: number,
  bottomY: number,
  bottomWidth: number,
): void {
  graphics.beginPath();
  trapezoidPath(graphics, centerX, topY, topWidth, bottomY, bottomWidth);
  graphics.strokePath();
}

function trapezoidPath(
  graphics: Phaser.GameObjects.Graphics,
  centerX: number,
  topY: number,
  topWidth: number,
  bottomY: number,
  bottomWidth: number,
): void {
  graphics.moveTo(centerX - topWidth / 2, topY);
  graphics.lineTo(centerX + topWidth / 2, topY);
  graphics.lineTo(centerX + bottomWidth / 2, bottomY);
  graphics.lineTo(centerX - bottomWidth / 2, bottomY);
  graphics.closePath();
}

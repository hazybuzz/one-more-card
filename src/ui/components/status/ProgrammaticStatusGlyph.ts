import Phaser from 'phaser';
import type { BattleStatusId } from '../../state/BattleStatusState';

export function createProgrammaticStatusGlyph(
  scene: Phaser.Scene,
  statusId: BattleStatusId,
  color: number,
  size: number,
): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0);
  const glow = drawGlyph(scene, statusId, color, 5).setAlpha(0.32).setBlendMode(Phaser.BlendModes.ADD);
  const core = drawGlyph(scene, statusId, 0xfff8e8, 2);
  const scale = size / 24;
  glow.setScale(scale);
  core.setScale(scale);
  root.add([glow, core]);
  return root;
}

function drawGlyph(
  scene: Phaser.Scene,
  statusId: BattleStatusId,
  color: number,
  width: number,
): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics();
  graphics.lineStyle(width, color, 1);
  graphics.fillStyle(color, 1);

  switch (statusId) {
    case 'attack-bonus':
      drawSword(graphics, -5, 6, 6, -5);
      graphics.fillTriangle(3, -8, 10, -10, 8, -3);
      graphics.lineBetween(-9, 8, -4, 3);
      graphics.lineBetween(-7, 10, -2, 5);
      break;
    case 'incoming-damage':
      drawSword(graphics, -4, -6, 5, 4);
      graphics.fillTriangle(2, 6, 10, 9, 7, 1);
      graphics.beginPath();
      graphics.moveTo(-10, -5);
      graphics.lineTo(-5, -1);
      graphics.lineTo(-9, 3);
      graphics.lineTo(-4, 7);
      graphics.strokePath();
      break;
    case 'holy-shield':
      graphics.beginPath();
      graphics.moveTo(0, -10);
      graphics.lineTo(8, -6);
      graphics.lineTo(7, 3);
      graphics.lineTo(0, 10);
      graphics.lineTo(-7, 3);
      graphics.lineTo(-8, -6);
      graphics.closePath();
      graphics.strokePath();
      graphics.lineBetween(0, -6, 0, 6);
      break;
    case 'iaijutsu':
      graphics.lineBetween(-9, 6, 7, -7);
      graphics.lineBetween(-7, 9, 10, -5);
      graphics.lineBetween(-10, 3, -5, 9);
      graphics.fillCircle(8, -9, width > 2 ? 2 : 1.2);
      graphics.lineBetween(5, -10, 10, -7);
      break;
    case 'hanami-fan':
      graphics.beginPath();
      graphics.arc(0, 5, 10, Phaser.Math.DegToRad(205), Phaser.Math.DegToRad(335));
      graphics.strokePath();
      for (const angle of [-50, -25, 0, 25, 50]) {
        const radians = Phaser.Math.DegToRad(angle - 90);
        graphics.lineBetween(0, 8, Math.cos(radians) * 10, 8 + Math.sin(radians) * 10);
      }
      graphics.lineBetween(0, 7, 0, 11);
      break;
    case 'smoke-evasion':
      graphics.strokeCircle(-5, 1, 4);
      graphics.strokeCircle(0, -3, 5);
      graphics.strokeCircle(6, 1, 4);
      graphics.lineBetween(-8, 5, 6, 5);
      graphics.lineBetween(-8, 9, 4, 9);
      break;
    case 'taoist-talisman':
      graphics.strokeRect(-7, -10, 14, 20);
      graphics.beginPath();
      graphics.moveTo(-4, -5);
      graphics.lineTo(3, -2);
      graphics.lineTo(-2, 2);
      graphics.lineTo(4, 5);
      graphics.strokePath();
      graphics.fillCircle(0, 0, width > 2 ? 1.8 : 1);
      break;
  }

  return graphics;
}

function drawSword(
  graphics: Phaser.GameObjects.Graphics,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): void {
  graphics.lineBetween(fromX, fromY, toX, toY);
  graphics.lineBetween(fromX - 3, fromY - 3, fromX + 3, fromY + 3);
}

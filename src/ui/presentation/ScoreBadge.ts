import Phaser from 'phaser';

export interface ScoreBadgeOptions {
  x: number;
  y: number;
  point: number;
  label?: string;
  scale?: number;
}

export function createScoreBadge(scene: Phaser.Scene, options: ScoreBadgeOptions): Phaser.GameObjects.Container {
  const scale = options.scale ?? 1;
  const color = pointColor(options.point);
  const badge = scene.add.container(options.x, options.y);
  badge.add(scene.add.circle(0, 0, 31 * scale, color.fill, 0.18).setStrokeStyle(2, color.stroke, 0.95));
  badge.add(scene.add.circle(0, 0, 22 * scale, color.fill, 0.26));
  const pointText = scene.add.text(0, -3 * scale, `${options.point}`, {
    fontFamily: 'Arial',
    fontSize: `${Math.round(31 * scale)}px`,
    color: color.text,
    fontStyle: 'bold',
  }).setOrigin(0.5);
  pointText.setShadow(0, 0, color.glow, 14 * scale, true, true);

  if (options.point >= 7) {
    pointText.setTint(0xcaff8a, 0x55ff9e, 0x1fd97a, 0x079b5a);
  }

  badge.add(pointText);
  badge.add(scene.add.text(0, 20 * scale, options.label ?? '点', {
    fontFamily: 'Arial',
    fontSize: `${Math.round(12 * scale)}px`,
    color: color.text,
  }).setOrigin(0.5));
  return badge;
}

function pointColor(point: number): { fill: number; stroke: number; text: string; glow: string } {
  if (point >= 1 && point <= 3) {
    return { fill: 0xff4058, stroke: 0xff6f7f, text: '#ff6f7f', glow: '#ff4058' };
  }

  if (point >= 4 && point <= 6) {
    return { fill: 0xf0c84b, stroke: 0xffe28a, text: '#ffe28a', glow: '#f0c84b' };
  }

  if (point >= 7) {
    return { fill: 0x35e582, stroke: 0x98ff9f, text: '#98ff9f', glow: '#35e582' };
  }

  return { fill: 0x8b96aa, stroke: 0xb5c0d0, text: '#b5c0d0', glow: '#8b96aa' };
}


import Phaser from 'phaser';
import type { ResonanceKind } from '../../game/scoring';

export interface ScoreBadgeOptions {
  x: number;
  y: number;
  point: number;
  label?: string;
  scale?: number;
  variant?: 'orb' | 'compact';
  resonance?: ResonanceKind;
  multiplier?: number;
  resonanceLabel?: string;
}

export function createScoreBadge(scene: Phaser.Scene, options: ScoreBadgeOptions): Phaser.GameObjects.Container {
  const scale = options.scale ?? 1;
  const color = pointColor(options.point);
  const badge = scene.add.container(options.x, options.y);
  if (options.variant === 'compact') {
    const resonance = options.resonance ?? 'none';
    const resonant = resonance !== 'none';
    const strong = resonance === 'strong';
    const width = resonant ? 72 : 58;
    const height = resonant ? 48 : 28;
    const stroke = resonant ? 0xffd86b : color.stroke;
    const fill = resonant ? 0x5c4518 : color.fill;
    const fillAlpha = resonant ? 0.34 : options.point >= 7 ? 0.22 : 0.12;
    if (resonant) {
      badge.add(scene.add.rectangle(0, 0, width + (strong ? 10 : 7), height + 8, 0xffd86b, strong ? 0.12 : 0.08)
        .setStrokeStyle(strong ? 4 : 3, 0xffd86b, strong ? 0.36 : 0.24));
    }
    const frame = scene.add.rectangle(0, 0, width, height, fill, fillAlpha)
      .setStrokeStyle(strong ? 3 : 2, stroke, resonant ? 1 : options.point >= 7 ? 0.82 : 0.58);
    badge.add(frame);
    badge.add(scene.add.rectangle(0, 0, width - 8, height - 8, 0x050608, 0.18)
      .setStrokeStyle(1, resonant ? 0xffefae : 0xaeb4c0, resonant ? 0.58 : 0.2));
    const compactText = scene.add.text(0, resonant ? -10 : 0, `${options.point} ${options.label ?? '点'}`, {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: resonant ? '#ffe59a' : color.text,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    if (resonant) {
      compactText.setShadow(0, 0, '#ffd86b', strong ? 12 : 8, true, true);
    } else if (options.point >= 7) {
      compactText.setShadow(0, 0, color.glow, 7, true, true);
    }
    badge.add(compactText);
    if (resonant) {
      const resonanceText = scene.add.text(0, 11, options.resonanceLabel ?? `×${options.multiplier ?? 2}`, {
        fontFamily: 'Arial',
        fontSize: '12px',
        color: '#ffd86b',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      resonanceText.setShadow(0, 0, '#ffd86b', strong ? 10 : 7, true, true);
      badge.add(resonanceText);
    }
    return badge;
  }

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
    return { fill: 0x388bd8, stroke: 0x82c8ff, text: '#9bd5ff', glow: '#4aa8ff' };
  }

  if (point >= 7) {
    return { fill: 0x35e582, stroke: 0x98ff9f, text: '#98ff9f', glow: '#35e582' };
  }

  return { fill: 0x8b96aa, stroke: 0xb5c0d0, text: '#b5c0d0', glow: '#8b96aa' };
}

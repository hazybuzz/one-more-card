import Phaser from 'phaser';
import { getBattleIconArt } from '../art';
import type { BattleStatusState } from '../state/BattleStatusState';
import { GAME_FONT_FAMILY } from '../themes/typography';
import { BattleStatusBadge } from './status/BattleStatusBadge';

export type StatusIconState = BattleStatusState;

interface StatusIconRowOptions {
  x: number;
  y: number;
  statuses: StatusIconState[];
  variant?: 'icon' | 'compact';
  diameter?: number;
  gap?: number;
  onShowTooltip: (x: number, y: number, title: string, description: string) => void;
  onHideTooltip: () => void;
}

export class StatusIconRow {
  readonly container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, options: StatusIconRowOptions) {
    this.container = scene.add.container(options.x, options.y);
    if (options.variant === 'icon') {
      this.renderFramedIcons(scene, options);
      return;
    }

    this.renderCompactIcons(scene, options);
  }

  private renderCompactIcons(scene: Phaser.Scene, options: StatusIconRowOptions): void {
    const gap = options.gap ?? 7;
    const orderedStatuses = [...options.statuses].sort((left, right) => right.priority - left.priority);
    const visibleStatuses = orderedStatuses.slice(0, 5);
    const hiddenStatuses = orderedStatuses.slice(5);
    const entries = visibleStatuses.map((status) => {
      const iconSize = status.iconSize ?? 32;
      return {
        status,
        iconSize,
        width: iconSize,
      };
    });
    const overflowWidth = hiddenStatuses.length > 0 ? 30 : 0;
    const itemCount = entries.length + (hiddenStatuses.length > 0 ? 1 : 0);
    const totalWidth = entries.reduce((sum, entry) => sum + entry.width, overflowWidth)
      + Math.max(0, itemCount - 1) * gap;
    let cursor = -totalWidth / 2;

    entries.forEach(({ status, iconSize, width }) => {
      const centerX = cursor + width / 2;
      const entry = scene.add.container(centerX, 0);
      const badge = new BattleStatusBadge(scene, status, iconSize);
      entry.add(badge.container);
      this.container.add(entry);
      badge.hitArea.on('pointerover', () => options.onShowTooltip(
        options.x + centerX,
        options.y - Math.max(44, iconSize + 12),
        status.title,
        status.description,
      ));
      badge.hitArea.on('pointerout', options.onHideTooltip);
      badge.playTransition(scene, status.transition);
      cursor += width + gap;
    });

    if (hiddenStatuses.length > 0) {
      const x = cursor + overflowWidth / 2;
      const label = scene.add.text(x, 0, `+${hiddenStatuses.length}`, {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: '13px',
        color: '#e7ddcf',
        fontStyle: 'bold',
      }).setOrigin(0.5).setShadow(0, 1, '#120d0c', 4, true, true);
      const hitArea = scene.add.rectangle(x, 0, overflowWidth, 32, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: false });
      this.container.add([label, hitArea]);
      hitArea.on('pointerover', () => options.onShowTooltip(
        options.x + x,
        options.y - 44,
        `+${hiddenStatuses.length}`,
        hiddenStatuses.map((status) => status.title).join('\n'),
      ));
      hitArea.on('pointerout', options.onHideTooltip);
    }
  }

  private renderFramedIcons(scene: Phaser.Scene, options: StatusIconRowOptions): void {
    const diameter = options.diameter ?? 26;
    const gap = options.gap ?? 6;
    const step = diameter + gap;
    const startX = -((options.statuses.length - 1) * step) / 2;

    options.statuses.forEach((status, index) => {
      const x = startX + index * step;
      const background = scene.add.circle(x, 0, diameter / 2, 0x20242c, 0.96)
        .setStrokeStyle(2, status.color, 0.9)
        .setInteractive({ useHandCursor: false });
      const iconArt = getBattleIconArt(status.iconArtId);
      const icon = scene.textures.exists(iconArt.textureKey)
        ? scene.add.image(x, 0, iconArt.textureKey).setDisplaySize(diameter * 0.72, diameter * 0.72)
        : scene.add.text(x, -1, status.fallbackIcon, {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: `${Math.round(diameter * 0.5)}px`,
          color: status.textColor,
          fontStyle: 'bold',
        }).setOrigin(0.5);
      this.container.add([background, icon]);
      background.on('pointerover', () => options.onShowTooltip(
        options.x + x,
        options.y - 54,
        status.title,
        status.description,
      ));
      background.on('pointerout', options.onHideTooltip);
    });
  }
}

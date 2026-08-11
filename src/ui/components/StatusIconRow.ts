import Phaser from 'phaser';

export interface StatusIconState {
  id: string;
  icon: string;
  color: number;
  textColor: string;
  title: string;
  description: string;
  label?: string;
  badge?: string;
}

interface StatusIconRowOptions {
  x: number;
  y: number;
  statuses: StatusIconState[];
  variant?: 'icon' | 'tag';
  diameter?: number;
  gap?: number;
  onShowTooltip: (x: number, y: number, title: string, description: string) => void;
  onHideTooltip: () => void;
}

export class StatusIconRow {
  readonly container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, options: StatusIconRowOptions) {
    this.container = scene.add.container(options.x, options.y);
    if (options.variant === 'tag') {
      this.renderTags(scene, options);
      return;
    }

    const diameter = options.diameter ?? 26;
    const gap = options.gap ?? 6;
    const step = diameter + gap;
    const startX = -((options.statuses.length - 1) * step) / 2;

    options.statuses.forEach((status, index) => {
      const x = startX + index * step;
      const background = scene.add.circle(x, 0, diameter / 2, 0x20242c, 0.96)
        .setStrokeStyle(2, status.color, 0.9)
        .setInteractive({ useHandCursor: false });
      const icon = scene.add.text(x, -1, status.icon, {
        fontFamily: 'Arial',
        fontSize: `${Math.round(diameter * 0.5)}px`,
        color: status.textColor,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      icon.setShadow(0, 0, status.textColor, 6, true, true);
      this.container.add([background, icon]);

      if (status.badge) {
        this.container.add(scene.add.text(x + diameter * 0.36, diameter * 0.34, status.badge, {
          fontFamily: 'Arial',
          fontSize: '9px',
          color: '#ffffff',
          fontStyle: 'bold',
          backgroundColor: '#8f2436',
        }).setOrigin(0.5));
      }

      background.on('pointerover', () => options.onShowTooltip(options.x + x, options.y - 54, status.title, status.description));
      background.on('pointerout', options.onHideTooltip);
    });
  }

  private renderTags(scene: Phaser.Scene, options: StatusIconRowOptions): void {
    const gap = options.gap ?? 5;
    const height = 22;
    const entries = options.statuses.map((status) => {
      const label = status.label ?? status.title;
      const text = scene.add.text(0, 0, label, {
        fontFamily: 'Arial',
        fontSize: '11px',
        color: status.textColor,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      return { status, text, width: Phaser.Math.Clamp(text.width + 16, 42, 104) };
    });
    const totalWidth = entries.reduce((sum, entry) => sum + entry.width, 0) + Math.max(0, entries.length - 1) * gap;
    let cursor = -totalWidth / 2;

    entries.forEach(({ status, text, width }) => {
      const x = cursor + width / 2;
      const background = scene.add.rectangle(x, 0, width, height, 0x11151c, 0.9)
        .setStrokeStyle(1, status.color, 0.96)
        .setInteractive({ useHandCursor: false });
      text.setPosition(x, 0);
      text.setShadow(0, 0, status.textColor, 5, true, true);
      this.container.add([background, text]);
      background.on('pointerover', () => options.onShowTooltip(options.x + x, options.y - 48, status.title, status.description));
      background.on('pointerout', options.onHideTooltip);
      cursor += width + gap;
    });
  }
}

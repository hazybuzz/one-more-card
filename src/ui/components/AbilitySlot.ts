import Phaser from 'phaser';

export interface AbilitySlotOptions {
  x?: number;
  y?: number;
  diameter?: number;
  icon: string;
  color: number;
  textColor: string;
  enabled?: boolean;
  cooldown?: number;
  badge?: string;
  badgeColor?: number;
  badgeStrokeColor?: number;
  badgeTextColor?: string;
  onActivate?: () => void;
  onShowTooltip?: () => void;
  onHideTooltip?: () => void;
}

export class AbilitySlot {
  readonly container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, options: AbilitySlotOptions) {
    const enabled = options.enabled ?? true;
    const diameter = options.diameter ?? 44;
    const radius = diameter / 2;
    this.container = scene.add.container(options.x ?? 0, options.y ?? 0);
    const background = scene.add.circle(0, 0, radius, enabled ? 0x282d37 : 0x1b1e25, 0.96)
      .setStrokeStyle(2, enabled ? options.color : 0x4a4f5a, enabled ? 0.96 : 0.62);
    const glow = scene.add.circle(0, 0, radius - 5, options.color, enabled ? 0.14 : 0.04);
    const icon = scene.add.text(0, -1, options.icon, {
      fontFamily: 'Arial',
      fontSize: `${Math.round(diameter * 0.48)}px`,
      color: enabled ? options.textColor : '#747b88',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    if (enabled) {
      icon.setShadow(0, 0, options.textColor, 8, true, true);
    }
    this.container.add([background, glow, icon]);

    const badgeText = options.cooldown && options.cooldown > 0 ? `${options.cooldown}` : options.badge;
    if (badgeText) {
      const badgeColor = enabled ? (options.badgeColor ?? 0xb6293e) : 0x555b66;
      const badgeStrokeColor = enabled ? (options.badgeStrokeColor ?? 0xff8290) : 0x777e89;
      const badge = scene.add.circle(radius - 2, radius - 2, 9, badgeColor, 0.98)
        .setStrokeStyle(1, badgeStrokeColor, 0.9);
      const text = scene.add.text(radius - 2, radius - 2, badgeText, {
        fontFamily: 'Arial',
        fontSize: '10px',
        color: enabled ? (options.badgeTextColor ?? '#ffffff') : '#b0b5be',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      this.container.add([badge, text]);
    }

    background.setInteractive({ useHandCursor: enabled && Boolean(options.onActivate) });
    background.on('pointerover', () => {
      background.setFillStyle(enabled ? 0x373e4b : 0x242832);
      options.onShowTooltip?.();
    });
    background.on('pointerout', () => {
      background.setFillStyle(enabled ? 0x282d37 : 0x1b1e25);
      options.onHideTooltip?.();
    });
    background.on('pointerdown', () => {
      if (enabled) {
        options.onActivate?.();
      }
    });
  }
}

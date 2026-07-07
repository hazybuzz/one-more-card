import Phaser from 'phaser';

interface ItemBarOptions {
  x: number;
  y: number;
  enabled: boolean;
  label: string;
  colors: {
    accent: number;
    accentText: string;
    line: number;
    muted: string;
    panelEnabled: number;
    panelDisabled: number;
    text: string;
  };
  onOpen: () => void;
}

export class ItemBar {
  static render(scene: Phaser.Scene, options: ItemBarOptions): Phaser.GameObjects.Container {
    const slot = scene.add.container(options.x, options.y);
    const fill = options.enabled ? options.colors.panelEnabled : options.colors.panelDisabled;
    const rect = scene.add.rectangle(0, 0, 78, 64, fill).setStrokeStyle(2, options.enabled ? options.colors.accent : options.colors.line);
    const iconGlow = scene.add.circle(0, -10, 19, options.colors.accent, options.enabled ? 0.18 : 0.08);
    const icon = scene.add.text(0, -12, '□', {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: options.enabled ? options.colors.accentText : options.colors.muted,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const label = scene.add.text(0, 20, options.label, {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: options.enabled ? options.colors.text : options.colors.muted,
    }).setOrigin(0.5);

    if (options.enabled) {
      icon.setShadow(0, 0, options.colors.accentText, 10, true, true);
    }

    rect.setInteractive({ useHandCursor: options.enabled });
    rect.on('pointerover', () => rect.setFillStyle(0x343947));
    rect.on('pointerout', () => rect.setFillStyle(fill));
    rect.on('pointerdown', () => {
      if (options.enabled) {
        options.onOpen();
      }
    });

    slot.add([rect, iconGlow, icon, label]);
    return slot;
  }
}

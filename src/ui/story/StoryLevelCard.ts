import Phaser from 'phaser';
import { CATALOG_LEATHER_PANEL_SKIN, EVERNIGHT_BUTTON_SKIN } from '../art/commonUiArt';
import { MedievalButton } from '../components/MedievalButton';
import { GAME_FONT_FAMILY } from '../themes/typography';

export type StoryLevelCardState = 'completed' | 'current' | 'unlocked' | 'locked';

interface StoryLevelCardOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  subtitle: string;
  statusLabel: string;
  buttonLabel: string;
  state: StoryLevelCardState;
  onActivate: () => void;
}

const STATE_COLORS: Record<StoryLevelCardState, { accent: number; text: string; tint: number }> = {
  completed: { accent: 0x72bd7e, text: '#8fd69a', tint: 0xc5d2b8 },
  current: { accent: 0xe8cf73, text: '#f0d77f', tint: 0xffdaa0 },
  unlocked: { accent: 0xb78a52, text: '#d6b77e', tint: 0xd1b696 },
  locked: { accent: 0x66615b, text: '#817b73', tint: 0x77736e },
};

export class StoryLevelCard {
  static render(scene: Phaser.Scene, options: StoryLevelCardOptions): Phaser.GameObjects.Container {
    const container = scene.add.container(options.x, options.y);
    const colors = STATE_COLORS[options.state];
    const unlocked = options.state !== 'locked';
    const currentHalo = scene.add.rectangle(0, 0, options.width + 5, options.height + 5, colors.accent, 0.025)
      .setStrokeStyle(2, colors.accent, 0.7)
      .setAlpha(options.state === 'current' ? 0.62 : 0);
    container.add(currentHalo);

    const hasSkin = scene.textures.exists(CATALOG_LEATHER_PANEL_SKIN.textureKey);
    const panel = hasSkin
      ? scene.add.nineslice(
        0,
        0,
        CATALOG_LEATHER_PANEL_SKIN.textureKey,
        undefined,
        options.width,
        options.height,
        CATALOG_LEATHER_PANEL_SKIN.leftWidth,
        CATALOG_LEATHER_PANEL_SKIN.rightWidth,
        CATALOG_LEATHER_PANEL_SKIN.topHeight,
        CATALOG_LEATHER_PANEL_SKIN.bottomHeight,
      ).setTint(colors.tint)
      : scene.add.rectangle(0, 0, options.width, options.height, 0x24150f, 0.96)
        .setStrokeStyle(2, colors.accent);
    const applyPanelState = (hovering: boolean): void => {
      if (panel instanceof Phaser.GameObjects.NineSlice) {
        panel.setTint(hovering ? (options.state === 'current' ? 0xffe6bd : 0xe7c9a2) : colors.tint);
        return;
      }
      panel.setFillStyle(hovering ? 0x38231a : 0x24150f, 0.96);
    };
    container.add(panel);

    if (options.state === 'locked') {
      container.add(scene.add.rectangle(0, 0, options.width - 12, options.height - 12, 0x09090a, 0.56));
    } else {
      container.add(scene.add.rectangle(-options.width / 2 + 7, 0, 3, options.height - 18, colors.accent, options.state === 'current' ? 0.92 : 0.52));
    }

    const titleColor = unlocked ? '#f0e2ca' : '#817d77';
    const subtitleColor = unlocked ? '#bda88b' : '#716d68';
    container.add(scene.add.text(-options.width / 2 + 30, -23, options.title, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '21px',
      color: titleColor,
      fontStyle: 'bold',
      wordWrap: { width: options.width - 210, useAdvancedWrap: true },
    }));
    container.add(scene.add.text(-options.width / 2 + 30, 9, options.subtitle, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '14px',
      color: subtitleColor,
      wordWrap: { width: options.width - 210, useAdvancedWrap: true },
    }));

    const status = scene.add.text(options.width / 2 - 158, -22, options.statusLabel, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '14px',
      color: colors.text,
      fontStyle: 'bold',
    }).setOrigin(1, 0);
    if (unlocked) {
      status.setShadow(0, 0, colors.text, options.state === 'current' ? 8 : 4, true, true);
    }
    container.add(status);

    const button = MedievalButton.render(scene, {
      x: options.width / 2 - 150,
      y: 3,
      width: 136,
      height: 32,
      label: options.buttonLabel,
      fontSize: '14px',
      enabled: unlocked,
      variant: options.state === 'current' ? 'primary' : options.state === 'locked' ? 'secondary' : 'normal',
      skin: EVERNIGHT_BUTTON_SKIN,
      onActivate: options.onActivate,
    });
    container.add(button);

    if (options.state === 'current') {
      const tween = scene.tweens.add({
        targets: currentHalo,
        alpha: { from: 0.32, to: 0.8 },
        duration: 2100,
        ease: 'Sine.InOut',
        yoyo: true,
        repeat: -1,
      });
      container.once(Phaser.GameObjects.Events.DESTROY, () => tween.remove());
    }

    if (unlocked) {
      panel.setInteractive({ useHandCursor: true });
      panel.on(Phaser.Input.Events.POINTER_OVER, () => applyPanelState(true));
      panel.on(Phaser.Input.Events.POINTER_OUT, () => applyPanelState(false));
      panel.on(Phaser.Input.Events.POINTER_DOWN, options.onActivate);
    }

    return container;
  }
}

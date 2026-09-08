import Phaser from 'phaser';
import type { NineSliceArtAsset } from '../art';
import { MEDIEVAL_UI_COLORS } from '../themes/medievalPalette';
import { GAME_FONT_FAMILY } from '../themes/typography';

export type MedievalButtonVariant = 'normal' | 'primary' | 'secondary' | 'danger';

export interface MedievalButtonOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  fontSize?: string;
  enabled?: boolean;
  variant?: MedievalButtonVariant;
  skin?: NineSliceArtAsset;
  tint?: number;
  hoverTint?: number;
  pressedTint?: number;
  onActivate: () => void;
}

const COLORS = {
  text: MEDIEVAL_UI_COLORS.text,
  textHover: MEDIEVAL_UI_COLORS.textBright,
  textDisabled: '#75675d',
  fallbackFill: 0x21130f,
  fallbackBorder: 0x8f6a35,
  danger: 0x8e2828,
  primary: 0xc99745,
  secondary: 0x080706,
};

export class MedievalButton {
  static render(scene: Phaser.Scene, options: MedievalButtonOptions): Phaser.GameObjects.Container {
    const enabled = options.enabled ?? true;
    const variant = options.variant ?? 'normal';
    const container = scene.add.container(options.x, options.y);
    const centerX = options.width / 2;
    const centerY = options.height / 2;
    const hasSkin = Boolean(options.skin && scene.textures.exists(options.skin.textureKey));

    const background = hasSkin
      ? scene.add.nineslice(
        centerX,
        centerY,
        options.skin!.textureKey,
        undefined,
        options.width,
        options.height,
        options.skin!.leftWidth,
        options.skin!.rightWidth,
        options.skin!.topHeight,
        options.skin!.bottomHeight,
      )
      : scene.add.rectangle(centerX, centerY, options.width, options.height, COLORS.fallbackFill)
        .setStrokeStyle(2, COLORS.fallbackBorder);

    const dangerWash = scene.add.rectangle(
      centerX,
      centerY,
      Math.max(12, options.width - 18),
      Math.max(12, options.height - 14),
      COLORS.danger,
      variant === 'danger' ? 0.22 : 0,
    );
    const emphasisWash = scene.add.rectangle(
      centerX,
      centerY,
      Math.max(12, options.width - 18),
      Math.max(12, options.height - 14),
      variant === 'primary' ? COLORS.primary : COLORS.secondary,
      variant === 'primary' ? 0.12 : variant === 'secondary' ? 0.32 : 0,
    );
    const disabledWash = scene.add.rectangle(
      centerX,
      centerY,
      Math.max(12, options.width - 8),
      Math.max(12, options.height - 8),
      0x343434,
      enabled ? 0 : 0.66,
    );
    const label = scene.add.text(centerX, centerY, options.label, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: options.fontSize ?? '19px',
      color: enabled
        ? (variant === 'primary' ? COLORS.textHover : variant === 'secondary' ? MEDIEVAL_UI_COLORS.textMuted : COLORS.text)
        : COLORS.textDisabled,
      align: 'center',
    }).setOrigin(0.5);
    label.setShadow(0, 2, '#090503', 4, true, true);

    container.add([background, dangerWash, emphasisWash, disabledWash, label]);

    if (!enabled) {
      return container;
    }

    let hovering = false;
    let pressed = false;
    const applyState = (): void => {
      container.setY(options.y + (pressed ? 2 : 0));
      const restingColor = variant === 'primary'
        ? COLORS.textHover
        : variant === 'secondary' ? MEDIEVAL_UI_COLORS.textMuted : COLORS.text;
      label.setColor(hovering ? COLORS.textHover : restingColor);
      label.setShadow(0, hovering ? 0 : 2, hovering ? '#b87832' : '#090503', hovering ? 9 : 4, true, true);
      if (hasSkin) {
        const restingTint = options.tint
          ?? (variant === 'primary' ? 0xffdfae : variant === 'secondary' ? 0xb7aa9a : 0xffffff);
        const hoverTint = options.hoverTint ?? 0xffd6a0;
        const pressedTint = options.pressedTint ?? 0xc59a72;
        (background as Phaser.GameObjects.NineSlice).setTint(
          pressed ? pressedTint : hovering ? hoverTint : restingTint,
        );
      } else {
        (background as Phaser.GameObjects.Rectangle).setFillStyle(
          pressed ? 0x160c09 : hovering ? 0x352019 : COLORS.fallbackFill,
        );
      }
    };

    background.setInteractive({ useHandCursor: true });
    applyState();
    background.on('pointerover', () => {
      hovering = true;
      applyState();
    });
    background.on('pointerout', () => {
      hovering = false;
      pressed = false;
      applyState();
    });
    background.on('pointerdown', () => {
      pressed = true;
      applyState();
      options.onActivate();
    });
    background.on('pointerup', () => {
      pressed = false;
      applyState();
    });

    return container;
  }
}

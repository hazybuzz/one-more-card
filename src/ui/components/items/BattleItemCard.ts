import Phaser from 'phaser';
import { GAME_FONT_FAMILY } from '../../themes/typography';
import type { BattleItemCardState } from './BattleItemCardState';

export interface BattleItemCardOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  state: BattleItemCardState;
  frameTextureKey?: string;
  onSelect: (id: BattleItemCardState['id']) => void;
}

const CARD_COLORS = {
  fill: 0x211713,
  fillSelected: 0x302017,
  line: 0x80643e,
  lineSelected: 0xd6aa55,
  text: '#e8d7b4',
  name: '#e7bd68',
  muted: '#a99a83',
  available: '#83d697',
  unavailable: '#c08077',
  badge: 0x2f7449,
};

export class BattleItemCard {
  readonly container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, options: BattleItemCardOptions) {
    const { state, width, height } = options;
    const container = scene.add.container(options.x, options.y);
    this.container = container;

    const shadow = scene.add.rectangle(5, 7, width, height, 0x050403, 0.62)
      .setStrokeStyle(1, 0x050403, 0.5);
    const hasFrameTexture = Boolean(options.frameTextureKey && scene.textures.exists(options.frameTextureKey));
    const background = hasFrameTexture
      ? scene.add.image(0, 0, options.frameTextureKey!).setDisplaySize(width, height)
      : scene.add.rectangle(
        0,
        0,
        width,
        height,
        state.selected ? CARD_COLORS.fillSelected : CARD_COLORS.fill,
        state.available ? 0.98 : 0.8,
      ).setStrokeStyle(
        state.selected ? 3 : 2,
        state.selected ? CARD_COLORS.lineSelected : CARD_COLORS.line,
        state.selected ? 1 : 0.72,
      );
    const innerLine = scene.add.rectangle(0, 0, width - 12, height - 12, 0x000000, 0)
      .setStrokeStyle(1, state.selected ? 0xe7c274 : 0x5b452e, hasFrameTexture ? 0 : state.selected ? 0.72 : 0.5);
    const selectedGlow = scene.add.rectangle(0, 0, width + 6, height + 6, 0xd0a34e, 0)
      .setStrokeStyle(4, 0xd9ad59, state.selected ? 0.3 : 0)
      .setBlendMode(Phaser.BlendModes.ADD);

    const iconY = -height / 2 + 70;
    const iconGlow = scene.add.circle(0, iconY, 48, 0xd7aa55, state.selected && state.available ? 0.13 : 0)
      .setBlendMode(Phaser.BlendModes.ADD);
    const icon = state.iconTextureKey && scene.textures.exists(state.iconTextureKey)
      ? scene.add.image(0, iconY, state.iconTextureKey).setDisplaySize(82, 82)
      : scene.add.text(0, iconY, state.icon, {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: '42px',
        color: CARD_COLORS.name,
      }).setOrigin(0.5);
    icon.setAlpha(state.available ? 1 : 0.52);

    const countBadge = scene.add.container(width / 2 - 25, -height / 2 + 24);
    countBadge.add(scene.add.circle(0, 0, 17, CARD_COLORS.badge, 0.98).setStrokeStyle(2, 0x86d99c, 0.82));
    countBadge.add(scene.add.text(0, 0, `×${state.count}`, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '13px',
      color: '#eaffef',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    const name = scene.add.text(0, iconY + 48, state.name, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '19px',
      color: state.available ? CARD_COLORS.name : CARD_COLORS.muted,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    if (state.selected) {
      name.setShadow(0, 0, CARD_COLORS.name, 8, true, true);
    }

    const description = scene.add.text(0, iconY + 74, state.description, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '15px',
      color: state.available ? CARD_COLORS.text : CARD_COLORS.muted,
      align: 'center',
      lineSpacing: 5,
      wordWrap: { width: width - 26, useAdvancedWrap: true },
    }).setOrigin(0.5, 0);
    const maxDescriptionBottom = height / 2 - 50;
    if (description.y + description.height > maxDescriptionBottom) {
      description.setCrop(0, 0, description.width, Math.max(20, maxDescriptionBottom - description.y));
    }

    const timing = scene.add.text(0, height / 2 - 27, state.available ? state.timingLabel : state.unavailableReason ?? state.timingLabel, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '12px',
      color: state.available ? CARD_COLORS.available : CARD_COLORS.unavailable,
      align: 'center',
      wordWrap: { width: width - 22, useAdvancedWrap: true },
    }).setOrigin(0.5);

    const disabledWash = scene.add.rectangle(0, 0, width - 8, height - 8, 0x29303a, state.available ? 0 : 0.38);
    const hitTarget = scene.add.rectangle(0, 0, width, height, 0x000000, 0.001);
    container.add([
      shadow,
      background,
      innerLine,
      selectedGlow,
      iconGlow,
      icon,
      countBadge,
      name,
      description,
      timing,
      disabledWash,
      hitTarget,
    ]);

    hitTarget.setInteractive({ useHandCursor: true });
    let hovering = false;
    const applyHover = (): void => {
      container.setY(options.y + (hovering ? -6 : 0));
      if (!state.selected && !hasFrameTexture) {
        (background as Phaser.GameObjects.Rectangle).setStrokeStyle(
          hovering ? 3 : 2,
          hovering ? 0xc89d50 : CARD_COLORS.line,
          hovering ? 0.92 : 0.72,
        );
      }
      if (hasFrameTexture) {
        (background as Phaser.GameObjects.Image).setTint(hovering || state.selected ? 0xffe4b8 : 0xffffff);
      }
      iconGlow.setAlpha((state.selected || hovering) && state.available ? 0.13 : 0);
    };
    hitTarget.on('pointerover', () => {
      hovering = true;
      applyHover();
    });
    hitTarget.on('pointerout', () => {
      hovering = false;
      applyHover();
    });
    hitTarget.on('pointerdown', () => {
      scene.sound.play('buttonClick', { volume: 0.36 });
      options.onSelect(state.id);
    });
    applyHover();
  }
}

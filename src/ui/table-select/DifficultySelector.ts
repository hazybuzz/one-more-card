import Phaser from 'phaser';
import type { EntryStakeMultiplier, TableThemeConfig } from '../../game/types/tableTheme';
import { GAME_FONT_FAMILY } from '../themes/typography';

export interface DifficultySelectorOption {
  multiplier: EntryStakeMultiplier;
  label: string;
  enabled: boolean;
  selected: boolean;
}

const BUTTON_WIDTH = 72;
const BUTTON_HEIGHT = 38;
const BUTTON_GAP = 2;

const DIFFICULTY_COLORS: Record<EntryStakeMultiplier, { fill: number; text: string }> = {
  1: { fill: 0x4f9b68, text: '#c9f3d2' },
  2: { fill: 0xc08b3e, text: '#ffe0a0' },
  3: { fill: 0xb64d58, text: '#ffc2c7' },
};

export class DifficultySelector {
  static render(
    scene: Phaser.Scene,
    theme: TableThemeConfig,
    options: DifficultySelectorOption[],
    onSelect: (multiplier: EntryStakeMultiplier) => void,
  ): Phaser.GameObjects.Container {
    const container = scene.add.container(0, 0);
    const totalWidth = options.length * BUTTON_WIDTH + Math.max(0, options.length - 1) * BUTTON_GAP;
    container.add(scene.add.rectangle(totalWidth / 2, BUTTON_HEIGHT / 2, totalWidth + 4, BUTTON_HEIGHT + 4, 0x050506, 0.7)
      .setStrokeStyle(1, theme.visual.accentColor, 0.28));

    options.forEach((option, index) => {
      const x = index * (BUTTON_WIDTH + BUTTON_GAP);
      const segment = scene.add.container(x, 0);
      const difficultyColor = DIFFICULTY_COLORS[option.multiplier];
      const glow = scene.add.rectangle(
        BUTTON_WIDTH / 2,
        BUTTON_HEIGHT / 2,
        BUTTON_WIDTH + 2,
        BUTTON_HEIGHT + 2,
        difficultyColor.fill,
        option.selected ? 0.12 : 0,
      );
      if (option.selected) {
        glow.setBlendMode(Phaser.BlendModes.ADD);
      }

      const background = scene.add.rectangle(
        BUTTON_WIDTH / 2,
        BUTTON_HEIGHT / 2,
        BUTTON_WIDTH,
        BUTTON_HEIGHT,
        option.selected ? difficultyColor.fill : 0x09090b,
        option.selected ? 0.38 : 0.68,
      ).setStrokeStyle(
        option.selected ? 2 : 1,
        difficultyColor.fill,
        option.selected ? 1 : 0.42,
      );

      const label = scene.add.text(BUTTON_WIDTH / 2, BUTTON_HEIGHT / 2, option.label, {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: '14px',
        color: option.enabled
          ? option.selected ? difficultyColor.text : '#d1c4b1'
          : '#69635d',
        fontStyle: option.selected ? 'bold' : '',
      }).setOrigin(0.5).setShadow(0, 2, '#050403', 3, true, true);

      const selectedLine = scene.add.rectangle(
        BUTTON_WIDTH / 2,
        BUTTON_HEIGHT - 3,
        option.selected ? 38 : 0,
        2,
        difficultyColor.fill,
        option.selected ? 1 : 0,
      );
      segment.add([glow, background, selectedLine, label]);

      if (option.enabled) {
        background.setInteractive({ useHandCursor: true });
        background.on('pointerover', () => {
          if (!option.selected) {
            background.setFillStyle(difficultyColor.fill, 0.18);
            background.setStrokeStyle(1, difficultyColor.fill, 0.8);
            label.setColor(difficultyColor.text);
          }
        });
        background.on('pointerout', () => {
          if (!option.selected) {
            background.setFillStyle(0x09090b, 0.7);
            background.setStrokeStyle(1, difficultyColor.fill, 0.42);
            label.setColor('#d1c4b1');
          }
        });
        background.on('pointerdown', () => onSelect(option.multiplier));
      }

      container.add(segment);
    });

    return container;
  }
}

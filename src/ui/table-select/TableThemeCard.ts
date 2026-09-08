import Phaser from 'phaser';
import { t } from '../../game/i18n';
import type { EntryStakeMultiplier, TableThemeConfig } from '../../game/types/tableTheme';
import { MedievalButton } from '../components/MedievalButton';
import { EVERNIGHT_BUTTON_SKIN } from '../art/commonUiArt';
import { DISPLAY_FONT_FAMILY, GAME_FONT_FAMILY } from '../themes/typography';
import { DifficultySelector, type DifficultySelectorOption } from './DifficultySelector';
import { getTableThemeSelectArt } from './TableThemeArtRegistry';
import { TABLE_THEME_CARD_LAYOUT } from './tableSelectLayout';
import { TableThemePreview } from './TableThemePreview';

export interface LockedThemeViewModel {
  currentWins: number;
  requiredWins: number;
  coinCost: number;
  hasWins: boolean;
  canAfford: boolean;
  canUnlock: boolean;
  buttonLabel: string;
}

export interface ReliefThemeViewModel {
  targetCoins: number;
}

export interface TableThemeCardOptions {
  x: number;
  y: number;
  theme: TableThemeConfig;
  unlocked: boolean;
  totalCost: number;
  minimumReward: number;
  maximumReward: number;
  complimentaryEntry: boolean;
  canEnter: boolean;
  enterLabel: string;
  difficultyOptions: DifficultySelectorOption[];
  locked?: LockedThemeViewModel;
  relief?: ReliefThemeViewModel;
  onStake: (multiplier: EntryStakeMultiplier) => void;
  onEnter: () => void;
  onUnlock: () => void;
}

const COLORS = {
  text: '#f1e5cf',
  muted: '#b8aa9a',
  gold: '#e7c56e',
  danger: '#ef6472',
};

export class TableThemeCard {
  static render(scene: Phaser.Scene, options: TableThemeCardOptions): Phaser.GameObjects.Container {
    const { theme, unlocked } = options;
    const card = scene.add.container(options.x, options.y);
    const art = getTableThemeSelectArt(theme.id);
    const shadow = scene.add.image(5, 8, art.frameKey)
      .setDisplaySize(TABLE_THEME_CARD_LAYOUT.width, TABLE_THEME_CARD_LAYOUT.height)
      .setTint(0x000000)
      .setAlpha(0.58);
    const frame = scene.add.image(0, 0, art.frameKey)
      .setDisplaySize(TABLE_THEME_CARD_LAYOUT.width, TABLE_THEME_CARD_LAYOUT.height)
      .setAlpha(unlocked ? 1 : 0.72);
    if (!unlocked) {
      frame.setTint(0x777477);
    }
    const hoverGlow = scene.add.rectangle(0, 0, 490, 230, theme.visual.accentColor, 0)
      .setStrokeStyle(1, theme.visual.accentColor, 0);
    card.add([shadow, frame, hoverGlow]);

    const preview = TableThemePreview.render(scene, theme, unlocked).setPosition(
      TABLE_THEME_CARD_LAYOUT.preview.x,
      TABLE_THEME_CARD_LAYOUT.preview.y,
    );
    card.add(preview);
    card.add(scene.add.text(TABLE_THEME_CARD_LAYOUT.title.x, TABLE_THEME_CARD_LAYOUT.title.y, t(theme.nameKey), {
      fontFamily: DISPLAY_FONT_FAMILY,
      fontSize: '27px',
      color: unlocked ? COLORS.text : '#8c898c',
      fontStyle: 'bold',
      wordWrap: { width: TABLE_THEME_CARD_LAYOUT.title.width, useAdvancedWrap: false },
    }).setShadow(0, 2, '#080504', 4, true, true));
    card.add(scene.add.text(TABLE_THEME_CARD_LAYOUT.title.x, -39, t(theme.subtitleKey), {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '15px',
      color: unlocked ? theme.visual.glowColor : '#77777d',
      wordWrap: { width: TABLE_THEME_CARD_LAYOUT.title.width, useAdvancedWrap: false },
    }).setShadow(0, 2, '#080504', 3, true, true));

    const hitArea = scene.add.rectangle(0, -28, 490, 166, 0x000000, 0.001).setInteractive({ useHandCursor: true });
    hitArea.on('pointerover', () => {
      hoverGlow.setFillStyle(theme.visual.accentColor, unlocked ? 0.035 : 0.015);
      hoverGlow.setStrokeStyle(1, theme.visual.accentColor, unlocked ? 0.38 : 0.16);
    });
    hitArea.on('pointerout', () => {
      hoverGlow.setFillStyle(theme.visual.accentColor, 0);
      hoverGlow.setStrokeStyle(1, theme.visual.accentColor, 0);
    });
    card.add(hitArea);

    if (options.locked) {
      this.renderLocked(scene, card, options);
    } else if (options.relief) {
      this.renderRelief(scene, card, options);
    } else {
      this.renderPlayable(scene, card, options);
    }

    return card;
  }

  private static renderPlayable(
    scene: Phaser.Scene,
    card: Phaser.GameObjects.Container,
    options: TableThemeCardOptions,
  ): void {
    const { theme } = options;
    this.addMetric(scene, card, -220, TABLE_THEME_CARD_LAYOUT.metricsY, options.complimentaryEntry
      ? t('tableSelect.complimentaryEntryCost')
      : t('tableSelect.roundCost', { cost: options.totalCost }), 'left', COLORS.gold);
    this.addMetric(scene, card, 0, TABLE_THEME_CARD_LAYOUT.metricsY, t('tableSelect.payoutRate', {
      multiplier: theme.payoutMultiplier.toFixed(1),
    }), 'center', theme.visual.glowColor);
    this.addMetric(scene, card, 220, TABLE_THEME_CARD_LAYOUT.metricsY, t('tableSelect.estimatedVictoryReward', {
      minimum: options.minimumReward,
      maximum: options.maximumReward,
    }), 'right', '#9be0ad');

    const actionPanel = TABLE_THEME_CARD_LAYOUT.actionPanel;
    card.add(scene.add.rectangle(actionPanel.x, actionPanel.y, actionPanel.width, actionPanel.height, 0x070708, 0.38)
      .setStrokeStyle(1, theme.visual.accentColor, 0.32));
    card.add(DifficultySelector.render(scene, theme, options.difficultyOptions, options.onStake).setPosition(-216, 40));
    card.add(MedievalButton.render(scene, {
      x: 48,
      y: 40,
      width: 180,
      height: 44,
      label: options.enterLabel,
      fontSize: '16px',
      enabled: options.canEnter,
      variant: 'primary',
      skin: EVERNIGHT_BUTTON_SKIN,
      tint: theme.visual.accentColor,
      onActivate: options.onEnter,
    }));
  }

  private static renderLocked(
    scene: Phaser.Scene,
    card: Phaser.GameObjects.Container,
    options: TableThemeCardOptions,
  ): void {
    const locked = options.locked!;
    const theme = options.theme;
    const lock = scene.add.graphics();
    lock.lineStyle(3, 0xc1b7a5, 0.72).strokeCircle(-174, -66, 13);
    lock.fillStyle(0x29282b, 0.96).fillRoundedRect(-189, -67, 30, 25, 4);
    card.add(lock);

    this.addMetric(scene, card, -220, TABLE_THEME_CARD_LAYOUT.metricsY, t('tableSelect.unlockProgress', {
      current: Math.min(locked.currentWins, locked.requiredWins),
      required: locked.requiredWins,
    }), 'left', locked.hasWins ? theme.visual.glowColor : COLORS.muted);
    this.addMetric(scene, card, 220, TABLE_THEME_CARD_LAYOUT.metricsY, t('tableSelect.unlockCost', { cost: locked.coinCost }), 'right',
      locked.canAfford ? COLORS.gold : COLORS.danger);
    const actionPanel = TABLE_THEME_CARD_LAYOUT.actionPanel;
    card.add(scene.add.rectangle(actionPanel.x, actionPanel.y, actionPanel.width, actionPanel.height, 0x080809, 0.48)
      .setStrokeStyle(1, 0x777477, 0.3));
    card.add(MedievalButton.render(scene, {
      x: -130,
      y: 49,
      width: 260,
      height: 44,
      label: locked.buttonLabel,
      fontSize: '16px',
      enabled: locked.canUnlock,
      variant: locked.canUnlock ? 'primary' : 'secondary',
      skin: EVERNIGHT_BUTTON_SKIN,
      tint: locked.canUnlock ? theme.visual.accentColor : 0x7b7470,
      onActivate: options.onUnlock,
    }));
  }

  private static renderRelief(
    scene: Phaser.Scene,
    card: Phaser.GameObjects.Container,
    options: TableThemeCardOptions,
  ): void {
    const theme = options.theme;
    this.addMetric(scene, card, -220, TABLE_THEME_CARD_LAYOUT.metricsY, t('tableSelect.reliefTitle'), 'left', theme.visual.glowColor);
    this.addMetric(scene, card, 220, TABLE_THEME_CARD_LAYOUT.metricsY, t('tableSelect.reliefFree'), 'right', COLORS.gold);
    const actionPanel = TABLE_THEME_CARD_LAYOUT.actionPanel;
    card.add(scene.add.rectangle(actionPanel.x, actionPanel.y, actionPanel.width, actionPanel.height, 0x080809, 0.4)
      .setStrokeStyle(1, theme.visual.accentColor, 0.28));
    card.add(scene.add.text(-216, 42, t('tableSelect.reliefHint', { target: options.relief!.targetCoins }), {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '13px',
      color: COLORS.muted,
      lineSpacing: 4,
      wordWrap: { width: 258 },
    }));
    card.add(MedievalButton.render(scene, {
      x: 48,
      y: 49,
      width: 180,
      height: 44,
      label: t('tableSelect.reliefEnter'),
      fontSize: '16px',
      variant: 'primary',
      skin: EVERNIGHT_BUTTON_SKIN,
      tint: theme.visual.accentColor,
      onActivate: options.onEnter,
    }));
  }

  private static addMetric(
    scene: Phaser.Scene,
    card: Phaser.GameObjects.Container,
    x: number,
    y: number,
    value: string,
    align: 'left' | 'center' | 'right',
    color = COLORS.muted,
  ): void {
    const originX = align === 'left' ? 0 : align === 'right' ? 1 : 0.5;
    card.add(scene.add.text(x, y, value, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '15px',
      color,
      fontStyle: align === 'center' ? 'bold' : '',
    }).setOrigin(originX, 0));
  }
}

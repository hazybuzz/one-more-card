import Phaser from 'phaser';
import { playLobbyMusic, preloadLobbyMusic } from '../game/audio';
import { TABLE_THEMES } from '../game/data/tableThemes';
import { tryPayEntryCost } from '../game/economy';
import { t, toggleLanguage } from '../game/i18n';
import { getProgress } from '../game/progress';
import type { EntryStakeMultiplier, TableThemeConfig, TableThemeId } from '../game/types/tableTheme';
import { ENTRY_STAKE_MULTIPLIERS } from '../game/types/tableTheme';

const COLORS = {
  bg: 0x101114,
  panel: 0x1b1d22,
  line: 0x3b3f4c,
  text: '#f2f2ed',
  muted: '#aeb4c0',
  accent: 0xe8cf73,
  accentText: '#e8cf73',
  button: 0x303542,
  buttonHover: 0x41495b,
  disabled: 0x20232a,
  dangerText: '#ff4b5f',
};

type ThemeSelection = Partial<Record<TableThemeId, EntryStakeMultiplier>>;

export class TableSelectScene extends Phaser.Scene {
  private statusText?: Phaser.GameObjects.Text;
  private stakeByTheme: ThemeSelection = {};

  constructor() {
    super('TableSelectScene');
  }

  preload(): void {
    preloadLobbyMusic(this);
    if (!this.cache.audio.exists('buttonClick')) {
      this.load.audio('buttonClick', '/audio/switch28.ogg');
    }
  }

  create(): void {
    playLobbyMusic(this);
    this.render();
  }

  private render(status = ''): void {
    this.children.removeAll(true);
    this.addBackground();
    this.renderLanguageToggle();
    this.renderSoulCoins();
    this.renderHeader();
    this.renderThemes();
    this.statusText = this.add.text(640, 668, status, {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: status ? COLORS.accentText : COLORS.muted,
    }).setOrigin(0.5);
  }

  private addBackground(): void {
    this.add.rectangle(640, 360, 1280, 720, COLORS.bg);
    this.add.circle(640, 376, 326, 0x191c22, 0.82).setStrokeStyle(2, COLORS.line);
    this.add.circle(640, 376, 196, 0x101114, 0.48).setStrokeStyle(1, 0x2b303c);
    this.add.rectangle(640, 360, 1280, 1, COLORS.line, 0.2);
  }

  private renderHeader(): void {
    this.add.text(640, 76, t('tableSelect.title'), {
      fontFamily: 'Arial',
      fontSize: '42px',
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, COLORS.accentText, 10, true, true);

    this.add.text(640, 116, t('tableSelect.subtitle'), {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: COLORS.muted,
    }).setOrigin(0.5);

    this.add.container(110, 50).add([
      this.button(0, 0, 178, 44, t('tableSelect.returnLobby'), () => {
        this.scene.start('StartScene');
      }, { fontSize: '16px' }),
    ]);
  }

  private renderLanguageToggle(): void {
    this.add.container(92, 104).add([
      this.button(0, 0, 144, 40, t('language.button'), () => {
        toggleLanguage();
        this.scene.restart();
      }, { fontSize: '15px' }),
    ]);
  }

  private renderSoulCoins(): void {
    const container = this.add.container(1118, 50);
    const panel = this.add.rectangle(0, 0, 236, 52, COLORS.panel, 0.95).setStrokeStyle(2, COLORS.accent);
    const label = this.add.text(-96, -13, t('progress.soulCoins'), {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: COLORS.muted,
    });
    const value = this.add.text(96, 0, `${getProgress().soulCoins}`, {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: COLORS.accentText,
      fontStyle: 'bold',
    }).setOrigin(1, 0.5);
    value.setShadow(0, 0, COLORS.accentText, 10, true, true);
    container.add([panel, label, value]);
  }

  private renderThemes(): void {
    const slots = [
      { x: 382, y: 272 },
      { x: 898, y: 272 },
      { x: 382, y: 542 },
      { x: 898, y: 542 },
    ];

    slots.forEach((slot, index) => {
      const theme = TABLE_THEMES[index];
      if (theme) {
        this.renderThemeCard(slot.x, slot.y, theme);
      } else {
        this.renderComingSoonCard(slot.x, slot.y);
      }
    });
  }

  private renderThemeCard(x: number, y: number, theme: TableThemeConfig): void {
    const unlocked = theme.unlockedByDefault;
    const stake = this.stakeByTheme[theme.id] ?? 1;
    const totalCost = this.roundCost(theme, stake);
    const totalRewardMultiplier = theme.rewardMultiplier * stake;
    const canEnter = unlocked && getProgress().soulCoins >= totalCost;
    const card = this.add.container(x, y);
    const panel = this.add.rectangle(0, 0, 456, 232, theme.visual.panelColor, 0.96).setStrokeStyle(2, unlocked ? theme.visual.accentColor : COLORS.line);
    card.add(panel);
    card.add(this.themePreview(-170, -58, theme, unlocked));

    card.add(this.add.text(-102, -91, t(theme.nameKey), {
      fontFamily: 'Arial',
      fontSize: '26px',
      color: unlocked ? COLORS.text : COLORS.muted,
      fontStyle: 'bold',
    }));
    card.add(this.add.text(-102, -57, t(theme.subtitleKey), {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: unlocked ? theme.visual.glowColor : COLORS.muted,
    }));

    card.add(this.add.text(-202, -2, t('tableSelect.baseEntry', { cost: theme.entryCost }), {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: COLORS.muted,
    }));
    card.add(this.add.text(-22, -2, t('tableSelect.rewardPreview', { multiplier: totalRewardMultiplier.toFixed(1) }), {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: theme.visual.glowColor,
    }).setOrigin(0.5, 0));
    card.add(this.add.text(202, -2, t('tableSelect.roundCost', { cost: totalCost }), {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: canEnter ? COLORS.accentText : COLORS.dangerText,
      fontStyle: 'bold',
    }).setOrigin(1, 0));

    card.add(this.add.rectangle(0, 70, 410, 76, 0x0c0d10, 0.24).setStrokeStyle(1, COLORS.line, 0.35));

    card.add(this.add.text(-196, 37, t('tableSelect.stake'), {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: COLORS.muted,
    }));

    ENTRY_STAKE_MULTIPLIERS.forEach((multiplier, index) => {
      const cost = this.roundCost(theme, multiplier);
      const affordable = getProgress().soulCoins >= cost;
      const selected = multiplier === stake;
      card.add(this.button(-154 + index * 58, 79, 52, 38, `${multiplier}x`, () => {
        this.stakeByTheme[theme.id] = multiplier;
        this.render();
      }, {
        fontSize: '15px',
        enabled: unlocked && affordable,
        fill: selected ? theme.visual.accentColor : undefined,
        textColor: selected ? '#101114' : undefined,
      }));
    });

    card.add(this.button(112, 79, 176, 42, canEnter ? t('tableSelect.enter') : t('tableSelect.notEnoughCoinsShort'), () => {
      this.enterTheme(theme, stake);
    }, { fontSize: '16px', enabled: canEnter }));
  }

  private renderComingSoonCard(x: number, y: number): void {
    const card = this.add.container(x, y);
    card.add(this.add.rectangle(0, 0, 456, 232, COLORS.panel, 0.76).setStrokeStyle(2, COLORS.line));
    card.add(this.add.circle(-170, -34, 44, 0x2a2d35, 0.9).setStrokeStyle(2, COLORS.line));
    card.add(this.add.text(-170, -36, '?', {
      fontFamily: 'Arial',
      fontSize: '36px',
      color: COLORS.muted,
      fontStyle: 'bold',
    }).setOrigin(0.5));
    card.add(this.add.text(-102, -78, t('tableSelect.comingSoon'), {
      fontFamily: 'Arial',
      fontSize: '26px',
      color: COLORS.muted,
      fontStyle: 'bold',
    }));
    card.add(this.add.text(-102, -42, t('tableSelect.comingSoonHint'), {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: COLORS.muted,
    }));
  }

  private themePreview(x: number, y: number, theme: TableThemeConfig, unlocked: boolean): Phaser.GameObjects.Container {
    const preview = this.add.container(x, y);
    const alpha = unlocked ? 1 : 0.45;
    preview.add(this.add.rectangle(0, 0, 88, 70, theme.visual.backgroundColor, 0.96).setStrokeStyle(2, theme.visual.accentColor, alpha));
    preview.add(this.add.circle(0, 6, 24, theme.visual.tableColor, 0.95).setStrokeStyle(2, theme.visual.tableRingColor, alpha * 0.75));
    preview.add(this.add.circle(0, 6, 14, 0x050608, 0.45).setStrokeStyle(1, theme.visual.accentColor, alpha * 0.45));

    if (theme.visual.motif === 'northern') {
      preview.add(this.add.rectangle(0, -25, 66, 7, 0x26343a, 0.78));
      preview.add(this.add.circle(-28, 22, 6, 0xff8a3d, 0.36));
      preview.add(this.add.circle(28, 22, 6, 0xff8a3d, 0.36));
      const rune = this.add.text(0, 6, 'R', {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: theme.visual.glowColor,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      rune.setAlpha(0.68);
      rune.setShadow(0, 0, theme.visual.glowColor, 8, true, true);
      preview.add(rune);
    } else if (theme.visual.motif === 'dragon') {
      preview.add(this.add.rectangle(0, -25, 68, 8, 0x5d1f22, 0.82).setStrokeStyle(1, theme.visual.tableRingColor, 0.45));
      preview.add(this.add.ellipse(-28, 22, 12, 18, 0xb72a24, 0.72).setStrokeStyle(1, theme.visual.tableRingColor, 0.58));
      preview.add(this.add.ellipse(28, 22, 12, 18, 0xb72a24, 0.72).setStrokeStyle(1, theme.visual.tableRingColor, 0.58));
      const gate = this.add.text(0, 6, '門', {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: theme.visual.glowColor,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      gate.setAlpha(0.72);
      gate.setShadow(0, 0, theme.visual.glowColor, 8, true, true);
      preview.add(gate);
    } else if (theme.visual.motif === 'edo') {
      preview.add(this.add.rectangle(0, -25, 66, 7, 0x5a334c, 0.82).setStrokeStyle(1, theme.visual.tableRingColor, 0.45));
      preview.add(this.add.ellipse(-28, 22, 12, 18, 0xc65a75, 0.7).setStrokeStyle(1, theme.visual.tableRingColor, 0.58));
      preview.add(this.add.ellipse(28, 22, 12, 18, 0xc65a75, 0.7).setStrokeStyle(1, theme.visual.tableRingColor, 0.58));
      const fan = this.add.text(0, 6, '扇', {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: theme.visual.glowColor,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      fan.setAlpha(0.72);
      fan.setShadow(0, 0, theme.visual.glowColor, 8, true, true);
      preview.add(fan);
    } else {
      preview.add(this.add.rectangle(0, -26, 60, 5, 0x2f2a22, 0.84));
      preview.add(this.add.circle(-26, 20, 6, 0xe8cf73, 0.32));
      preview.add(this.add.circle(26, 20, 6, 0xe8cf73, 0.32));
    }

    return preview;
  }

  private enterTheme(theme: TableThemeConfig, stakeMultiplier: EntryStakeMultiplier): void {
    const cost = this.roundCost(theme, stakeMultiplier);
    const entry = tryPayEntryCost(cost);
    if (!entry.paid) {
      this.render(t('tableSelect.notEnoughCoins', { cost, total: entry.total }));
      return;
    }

    this.render(t('tableSelect.entryPaid', { cost: entry.amount, total: entry.total }));
    this.time.delayedCall(320, () => this.scene.start('BattleScene', {
      tableThemeId: theme.id,
      stakeMultiplier,
    }));
  }

  private roundCost(theme: TableThemeConfig, stakeMultiplier: EntryStakeMultiplier): number {
    return theme.entryCost * stakeMultiplier;
  }

  private button(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void,
    options: { fontSize?: string; enabled?: boolean; fill?: number; textColor?: string } = {},
  ): Phaser.GameObjects.Container {
    const enabled = options.enabled ?? true;
    const button = this.add.container(x, y);
    const fill = options.fill ?? (enabled ? COLORS.button : COLORS.disabled);
    const rect = this.add.rectangle(0, 0, width, height, fill).setStrokeStyle(2, enabled ? COLORS.line : 0x343741);
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Arial',
      fontSize: options.fontSize ?? '20px',
      color: options.textColor ?? (enabled ? COLORS.text : COLORS.muted),
    }).setOrigin(0.5);

    if (enabled) {
      rect.setInteractive({ useHandCursor: true });
      rect.on('pointerover', () => rect.setFillStyle(options.fill ?? COLORS.buttonHover));
      rect.on('pointerout', () => rect.setFillStyle(fill));
      rect.on('pointerdown', () => {
        this.sound.play('buttonClick', { volume: 0.42 });
        onClick();
      });
    }

    button.add([rect, text]);
    return button;
  }
}

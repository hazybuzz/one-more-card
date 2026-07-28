import Phaser from 'phaser';
import { playLobbyMusic, preloadLobbyMusic } from '../game/audio';
import { TABLE_THEMES } from '../game/data/tableThemes';
import { payEntryCost } from '../game/economy';
import { t, toggleLanguage } from '../game/i18n';
import { getProgress } from '../game/progress';
import type { TableThemeConfig } from '../game/types/tableTheme';

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
};

export class TableSelectScene extends Phaser.Scene {
  private statusText?: Phaser.GameObjects.Text;

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
    this.addBackground();
    this.renderLanguageToggle();
    this.renderSoulCoins();
    this.renderHeader();
    this.renderThemes();
  }

  private addBackground(): void {
    this.add.rectangle(640, 360, 1280, 720, COLORS.bg);
    this.add.circle(640, 360, 292, 0x191c22, 0.9).setStrokeStyle(2, COLORS.line);
    this.add.circle(640, 360, 178, 0x101114, 0.52).setStrokeStyle(1, 0x2b303c);
    this.add.rectangle(640, 360, 1280, 1, COLORS.line, 0.25);
  }

  private renderHeader(): void {
    this.add.text(640, 82, t('tableSelect.title'), {
      fontFamily: 'Arial',
      fontSize: '44px',
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, COLORS.accentText, 10, true, true);

    this.add.text(640, 128, t('tableSelect.subtitle'), {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: COLORS.muted,
    }).setOrigin(0.5);

    this.add.container(110, 50).add([
      this.button(0, 0, 178, 44, t('tableSelect.returnLobby'), () => {
        this.scene.start('StartScene');
      }, { fontSize: '16px' }),
    ]);

    this.statusText = this.add.text(640, 646, '', {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: COLORS.accentText,
    }).setOrigin(0.5);
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
    TABLE_THEMES.forEach((theme, index) => {
      this.renderThemeCard(640, 318 + index * 156, theme);
    });
  }

  private renderThemeCard(x: number, y: number, theme: TableThemeConfig): void {
    const unlocked = theme.unlockedByDefault;
    const card = this.add.container(x, y);
    const panel = this.add.rectangle(0, 0, 720, 132, theme.visual.panelColor, 0.96).setStrokeStyle(2, unlocked ? theme.visual.accentColor : COLORS.line);
    card.add(panel);
    card.add(this.themePreview(-252, 0, theme, unlocked));
    card.add(this.add.text(-186, -46, t(theme.nameKey), {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: unlocked ? COLORS.text : COLORS.muted,
      fontStyle: 'bold',
    }));
    card.add(this.add.text(-186, -12, t(theme.subtitleKey), {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: unlocked ? theme.visual.glowColor : COLORS.muted,
    }));
    card.add(this.add.text(-186, 20, t(theme.descriptionKey), {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: COLORS.muted,
      wordWrap: { width: 300 },
    }));
    card.add(this.add.text(174, -42, t('tableSelect.entryCost', { cost: theme.entryCost }), {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: theme.visual.glowColor,
      fontStyle: 'bold',
    }).setOrigin(0.5));
    card.add(this.add.text(174, -12, t('tableSelect.reward', { multiplier: theme.rewardMultiplier }), {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: COLORS.muted,
    }).setOrigin(0.5));
    card.add(this.button(174, 30, 176, 44, unlocked ? t('tableSelect.enter') : t('tableSelect.locked'), () => {
      this.enterTheme(theme);
    }, { fontSize: '17px', enabled: unlocked }));
  }

  private themePreview(x: number, y: number, theme: TableThemeConfig, unlocked: boolean): Phaser.GameObjects.Container {
    const preview = this.add.container(x, y);
    const alpha = unlocked ? 1 : 0.45;
    preview.add(this.add.rectangle(0, 0, 104, 86, theme.visual.backgroundColor, 0.96).setStrokeStyle(2, theme.visual.accentColor, alpha));
    preview.add(this.add.circle(0, 6, 30, theme.visual.tableColor, 0.95).setStrokeStyle(2, theme.visual.tableRingColor, alpha * 0.75));
    preview.add(this.add.circle(0, 6, 18, 0x050608, 0.45).setStrokeStyle(1, theme.visual.accentColor, alpha * 0.45));

    if (theme.visual.motif === 'northern') {
      preview.add(this.add.rectangle(0, -30, 82, 8, 0x26343a, 0.78));
      preview.add(this.add.circle(-34, 28, 8, 0xff8a3d, 0.36));
      preview.add(this.add.circle(34, 28, 8, 0xff8a3d, 0.36));
      const rune = this.add.text(0, 6, 'ᚱ', {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: theme.visual.glowColor,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      rune.setAlpha(0.68);
      rune.setShadow(0, 0, theme.visual.glowColor, 8, true, true);
      preview.add(rune);
    } else {
      preview.add(this.add.rectangle(0, -32, 74, 6, 0x2f2a22, 0.84));
      preview.add(this.add.circle(-32, 24, 7, 0xe8cf73, 0.32));
      preview.add(this.add.circle(32, 24, 7, 0xe8cf73, 0.32));
    }

    return preview;
  }

  private enterTheme(theme: TableThemeConfig): void {
    const entry = payEntryCost(theme.entryCost);
    this.showStatus(entry.amount > 0
      ? t('tableSelect.entryPaid', { cost: entry.amount, total: entry.total })
      : t('tableSelect.entryFree'));
    this.time.delayedCall(320, () => this.scene.start('BattleScene', { tableThemeId: theme.id }));
  }

  private button(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void,
    options: { fontSize?: string; enabled?: boolean } = {},
  ): Phaser.GameObjects.Container {
    const enabled = options.enabled ?? true;
    const button = this.add.container(x, y);
    const fill = enabled ? COLORS.button : COLORS.disabled;
    const rect = this.add.rectangle(0, 0, width, height, fill).setStrokeStyle(2, enabled ? COLORS.line : 0x343741);
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Arial',
      fontSize: options.fontSize ?? '20px',
      color: enabled ? COLORS.text : COLORS.muted,
    }).setOrigin(0.5);

    if (enabled) {
      rect.setInteractive({ useHandCursor: true });
      rect.on('pointerover', () => rect.setFillStyle(COLORS.buttonHover));
      rect.on('pointerout', () => rect.setFillStyle(fill));
      rect.on('pointerdown', () => {
        this.sound.play('buttonClick', { volume: 0.42 });
        onClick();
      });
    }

    button.add([rect, text]);
    return button;
  }

  private showStatus(message: string): void {
    this.statusText?.setText(message);
  }
}

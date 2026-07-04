import Phaser from 'phaser';
import { preloadCardImages } from '../game/assets';
import { playLobbyMusic, preloadLobbyMusic } from '../game/audio';
import { BATTLE_ENTRY_COST, payBattleEntry } from '../game/economy';
import { t, toggleLanguage } from '../game/i18n';
import { getProgress, resetProgress } from '../game/progress';

const COLORS = {
  bg: 0x101114,
  panel: 0x1b1d22,
  line: 0x3b3f4c,
  text: '#f2f2ed',
  muted: '#aeb4c0',
  accent: 0xe8cf73,
  accentText: '#e8cf73',
  heat: '#ff4b5f',
  button: 0x303542,
  buttonHover: 0x41495b,
};

export class StartScene extends Phaser.Scene {
  private statusText?: Phaser.GameObjects.Text;
  private pendingStatus = '';

  constructor() {
    super('StartScene');
  }

  init(data?: { status?: string }): void {
    this.pendingStatus = data?.status ?? '';
  }

  preload(): void {
    preloadLobbyMusic(this);
    preloadCardImages(this);
    if (!this.cache.audio.exists('buttonClick')) {
      this.load.audio('buttonClick', '/audio/switch28.ogg');
    }
  }

  create(): void {
    playLobbyMusic(this);
    this.addBackground();
    this.renderLanguageToggle();
    this.renderSoulCoins();
    this.renderTitle();
    this.renderMenu();
    this.renderDebugActions();
    this.showStatus(this.pendingStatus);
  }

  private addBackground(): void {
    this.add.rectangle(640, 360, 1280, 720, COLORS.bg);
    this.add.circle(640, 360, 248, 0x191c22, 0.92).setStrokeStyle(2, COLORS.line);
    this.add.circle(640, 360, 168, 0x101114, 0.52).setStrokeStyle(1, 0x2b303c);
    this.add.rectangle(640, 360, 1280, 1, COLORS.line, 0.28);
    this.add.rectangle(640, 360, 1, 720, COLORS.line, 0.18);
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

  private renderLanguageToggle(): void {
    this.add.container(92, 50).add([
      this.menuButton(0, 0, 144, 44, t('language.button'), () => {
        toggleLanguage();
        this.scene.restart();
      }, '16px'),
    ]);
  }

  private renderTitle(): void {
    const title = this.add.text(640, 178, t('start.title'), {
      fontFamily: 'Arial',
      fontSize: '70px',
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    title.setShadow(0, 0, COLORS.heat, 14, true, true);

    const subtitle = this.add.text(640, 240, t('start.subtitle'), {
      fontFamily: 'Arial',
      fontSize: '19px',
      color: COLORS.muted,
    }).setOrigin(0.5);
    subtitle.setShadow(0, 0, '#000000', 5, true, true);
  }

  private renderMenu(): void {
    this.add.container(640, 382).add([
      this.menuButton(0, 0, 300, 58, t('start.game', { cost: BATTLE_ENTRY_COST }), () => {
        const entry = payBattleEntry();
        this.showStatus(entry.amount > 0
          ? t('start.entryPaid', { cost: entry.amount, total: entry.total })
          : t('start.entryFree'));
        this.time.delayedCall(320, () => this.scene.start('BattleScene'));
      }),
      this.menuButton(0, 78, 260, 58, t('start.shop'), () => {
        this.scene.start('ShopScene');
      }),
      this.menuButton(0, 156, 260, 58, t('start.inventory'), () => {
        this.scene.start('InventoryScene');
      }),
    ]);

    this.statusText = this.add.text(640, 596, '', {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: COLORS.accentText,
    }).setOrigin(0.5);
  }

  private renderDebugActions(): void {
    this.add.container(1168, 668).add([
      this.menuButton(0, 0, 168, 42, t('start.resetGold'), () => {
        resetProgress();
        this.scene.restart({ status: t('start.goldReset', { total: getProgress().soulCoins }) });
      }, '16px'),
    ]);
  }

  private menuButton(x: number, y: number, width: number, height: number, label: string, onClick: () => void, fontSize = '22px'): Phaser.GameObjects.Container {
    const button = this.add.container(x, y);
    const rect = this.add.rectangle(0, 0, width, height, COLORS.button).setStrokeStyle(2, COLORS.line);
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Arial',
      fontSize,
      color: COLORS.text,
    }).setOrigin(0.5);

    rect.setInteractive({ useHandCursor: true });
    rect.on('pointerover', () => rect.setFillStyle(COLORS.buttonHover));
    rect.on('pointerout', () => rect.setFillStyle(COLORS.button));
    rect.on('pointerdown', () => {
      this.playButtonClick();
      onClick();
    });

    button.add([rect, text]);
    return button;
  }

  private playButtonClick(): void {
    this.sound.play('buttonClick', { volume: 0.42 });
  }

  private showStatus(message: string): void {
    this.statusText?.setText(message);
  }
}

import Phaser from 'phaser';
import { preloadCardImages } from '../game/assets';
import { playLobbyMusic, preloadLobbyMusic } from '../game/audio';
import { t, toggleLanguage } from '../game/i18n';
import { getEconomyDebugSnapshot, getProgress, resetTestProgress, switchProgressMode } from '../game/progress';
import { getRuntimeMode, isTestMode } from '../game/runtimeMode';

const COLORS = {
  bg: 0x101114,
  panel: 0x1b1d22,
  line: 0x3b3f4c,
  text: '#f2f2ed',
  muted: '#aeb4c0',
  accent: 0xe8cf73,
  accentText: '#e8cf73',
  dangerText: '#ff4b5f',
  button: 0x303542,
  buttonHover: 0x41495b,
};

export class StartScene extends Phaser.Scene {
  private statusText?: Phaser.GameObjects.Text;
  private economyDebugModal?: Phaser.GameObjects.Container;
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
    this.renderRuntimeModeBadge();
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
    title.setShadow(0, 0, COLORS.dangerText, 14, true, true);

    const subtitle = this.add.text(640, 240, t('start.subtitle'), {
      fontFamily: 'Arial',
      fontSize: '19px',
      color: COLORS.muted,
    }).setOrigin(0.5);
    subtitle.setShadow(0, 0, '#000000', 5, true, true);
  }

  private renderRuntimeModeBadge(): void {
    if (!import.meta.env.DEV || !isTestMode()) {
      return;
    }

    const badge = this.add.container(640, 286);
    const panel = this.add.rectangle(0, 0, 310, 34, 0x493a10, 0.96).setStrokeStyle(2, 0xffd85c, 0.92);
    const label = this.add.text(0, 0, t('runtimeMode.testBadge'), {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: '#ffe99a',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    label.setShadow(0, 0, '#ffd85c', 7, true, true);
    badge.add([panel, label]);
  }

  private renderMenu(): void {
    this.add.container(640, 360).add([
      this.menuButton(0, 0, 300, 58, t('start.game'), () => {
        this.scene.start('TableSelectScene');
      }),
      this.menuButton(0, 70, 260, 56, t('start.story'), () => {
        this.scene.start('StorySelectScene');
      }),
      this.menuButton(0, 140, 260, 56, t('start.pvp'), () => {
        this.scene.start('PvpLobbyScene');
      }),
      this.menuButton(0, 210, 260, 56, t('start.shop'), () => {
        this.scene.start('ShopScene');
      }),
      this.menuButton(0, 280, 260, 56, t('start.inventory'), () => {
        this.scene.start('InventoryScene');
      }),
    ]);

    this.statusText = this.add.text(640, 664, '', {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: COLORS.accentText,
    }).setOrigin(0.5);
  }

  private renderDebugActions(): void {
    if (!import.meta.env.DEV) {
      return;
    }

    const actions = this.add.container(1168, 668);
    const mode = getRuntimeMode();
    actions.add(this.menuButton(0, 0, 168, 42, mode === 'test'
      ? t('runtimeMode.switchProduction')
      : t('runtimeMode.switchTest'), () => {
      const nextMode = mode === 'test' ? 'production' : 'test';
      switchProgressMode(nextMode);
      this.scene.restart({ status: nextMode === 'test' ? t('runtimeMode.testEnabled') : t('runtimeMode.productionEnabled') });
    }, '15px'));

    if (mode === 'test') {
      actions.add(this.menuButton(0, -52, 168, 42, t('runtimeMode.resetTest'), () => {
        resetTestProgress();
        this.scene.restart({ status: t('runtimeMode.testReset', { total: getProgress().soulCoins }) });
      }, '15px'));
    }

    actions.add(this.menuButton(0, mode === 'test' ? -104 : -52, 168, 42, t('start.economyDebug'), () => {
      this.showEconomyDebugModal();
    }, '15px'));
  }

  private showEconomyDebugModal(): void {
    if (this.economyDebugModal) {
      return;
    }

    const snapshot = getEconomyDebugSnapshot();
    const stats = snapshot.economyStats;
    const modal = this.add.container(640, 360).setDepth(100);
    this.economyDebugModal = modal;
    modal.add(this.add.rectangle(0, 0, 1280, 720, 0x050608, 0.76).setInteractive());
    modal.add(this.add.rectangle(0, 0, 820, 570, COLORS.panel, 0.99).setStrokeStyle(2, COLORS.accent));
    modal.add(this.add.text(0, -246, t('economyDebug.title'), {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, COLORS.accentText, 9, true, true));

    modal.add(this.add.text(0, -190, [
      t('economyDebug.current', { amount: snapshot.soulCoins }),
      t('economyDebug.opening', { amount: stats.openingBalance }),
      t('economyDebug.totalEarned', { amount: stats.totalEarned }),
      t('economyDebug.totalSpent', { amount: stats.totalSpent }),
      t('economyDebug.recentCount', { count: snapshot.economyTransactions.length }),
    ].join('    '), {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: COLORS.accentText,
      align: 'center',
      wordWrap: { width: 740 },
    }).setOrigin(0.5));

    modal.add(this.economyDebugColumn(-360, -128, t('economyDebug.incomeTitle'), [
      t('economyDebug.storyFirstClear', { amount: stats.incomeBySource.story_first_clear }),
      t('economyDebug.formalVictory', { amount: stats.incomeBySource.formal_victory }),
      t('economyDebug.relief', { amount: stats.incomeBySource.relief }),
      t('economyDebug.pvpVictory', { amount: stats.incomeBySource.pvp_victory }),
    ]));
    modal.add(this.economyDebugColumn(20, -128, t('economyDebug.expenseTitle'), [
      t('economyDebug.formalEntry', { amount: stats.spendingBySink.formal_entry }),
      t('economyDebug.itemPurchase', { amount: stats.spendingBySink.item_purchase }),
      t('economyDebug.cosmeticPurchase', { amount: stats.spendingBySink.cosmetic_purchase }),
      t('economyDebug.themeUnlock', { amount: stats.spendingBySink.theme_unlock }),
      t('economyDebug.pvpLoss', { amount: stats.spendingBySink.pvp_loss }),
    ]));

    modal.add([
      this.menuButton(-120, 238, 190, 46, t('economyDebug.export'), () => this.exportEconomyDebugJson(), '16px'),
      this.menuButton(120, 238, 190, 46, t('economyDebug.close'), () => {
        modal.destroy(true);
        this.economyDebugModal = undefined;
      }, '16px'),
    ]);
  }

  private economyDebugColumn(x: number, y: number, title: string, lines: string[]): Phaser.GameObjects.Container {
    const column = this.add.container(x, y);
    column.add(this.add.rectangle(170, 122, 340, 300, 0x111318, 0.72).setStrokeStyle(1, COLORS.line));
    column.add(this.add.text(22, 0, title, {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: COLORS.text,
      fontStyle: 'bold',
    }));
    column.add(this.add.text(22, 48, lines.join('\n'), {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: COLORS.muted,
      lineSpacing: 15,
    }));
    return column;
  }

  private exportEconomyDebugJson(): void {
    const payload = JSON.stringify({
      exportedAt: new Date().toISOString(),
      ...getEconomyDebugSnapshot(),
    }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `one-more-card-economy-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
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

import Phaser from 'phaser';
import { DISPLAY_FONT_FAMILY, GAME_FONT_FAMILY } from '../ui/themes/typography';
import { preloadCardImages } from '../game/assets';
import { playLobbyMusic, preloadLobbyMusic } from '../game/audio';
import { getLanguage, t, toggleLanguage } from '../game/i18n';
import { getEconomyDebugSnapshot, getProgress, resetTestProgress, switchProgressMode } from '../game/progress';
import { getRuntimeMode, isTestMode } from '../game/runtimeMode';
import { EVERNIGHT_BUTTON_SKIN } from '../ui/art/commonUiArt';
import { MedievalButton, type MedievalButtonVariant } from '../ui/components/MedievalButton';
import { SoulCoinDisplay } from '../ui/components/SoulCoinDisplay';
import { START_LAYOUT } from '../ui/layout/startLayout';

const COLORS = {
  bg: 0x101114,
  panel: 0x1b1d22,
  line: 0x3b3f4c,
  text: '#f2f2ed',
  muted: '#aeb4c0',
  accent: 0xe8cf73,
  accentText: '#e8cf73',
  dangerText: '#ff4b5f',
  warmLight: 0xb8813f,
};

type MenuButtonVariant = 'primary' | 'secondary' | 'utility';

const START_BACKGROUND_KEY = 'evernight-start-background';
const START_BACKGROUND_PATH = '/image/env-assets/evernight/start-background.png';
const START_TITLE_LOGOS = {
  zh: {
    key: 'start-title-logo-zh',
    path: '/image/ui/start/title-logo-zh.png',
    width: 352,
  },
  en: {
    key: 'start-title-logo-en',
    path: '/image/ui/start/title-logo-en.png',
    width: 520,
  },
} as const;

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
    if (!this.textures.exists(START_BACKGROUND_KEY)) {
      this.load.image(START_BACKGROUND_KEY, START_BACKGROUND_PATH);
    }
    Object.values(START_TITLE_LOGOS).forEach(({ key, path }) => {
      if (!this.textures.exists(key)) {
        this.load.image(key, path);
      }
    });
    SoulCoinDisplay.preload(this);
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
    const { width, height } = START_LAYOUT.canvas;

    this.add.rectangle(width / 2, height / 2, width, height, COLORS.bg);

    if (this.textures.exists(START_BACKGROUND_KEY)) {
      this.add.image(width / 2, height / 2, START_BACKGROUND_KEY).setDisplaySize(width, height);
    } else {
      this.addFallbackBackground();
    }

    this.add.rectangle(width / 2, height / 2, width, height, 0x050608, 0.14);
    this.add.rectangle(width / 2, 2, width, 4, 0x020304, 0.9);
    this.add.rectangle(width / 2, height - 2, width, 4, 0x020304, 0.9);
  }

  private addFallbackBackground(): void {
    const art = START_LAYOUT.artSafeArea;

    // Low-contrast tavern geometry marks the composition reserved for final art.
    this.add.rectangle(art.x + art.width / 2, art.y + art.height / 2, art.width, art.height, 0x15171c, 0.72);
    this.add.rectangle(640, 518, 1080, 118, 0x19140f, 0.98).setStrokeStyle(2, 0x4a3523, 0.72);
    this.add.rectangle(640, 468, 1080, 18, 0x332417, 0.95);
    this.add.rectangle(680, 235, 780, 5, 0x3a2c20, 0.8);
    this.add.rectangle(680, 318, 780, 5, 0x3a2c20, 0.8);
    this.add.rectangle(208, 208, 126, 190, 0x0b1520, 0.9).setStrokeStyle(5, 0x302a25, 0.92);
    this.add.rectangle(208, 208, 4, 184, 0x302a25, 0.9);
    this.add.rectangle(208, 208, 120, 4, 0x302a25, 0.9);

    [374, 476, 578, 702, 804, 906, 1008].forEach((x, index) => {
      const bottleHeight = 30 + (index % 3) * 8;
      this.add.rectangle(x, 218 - bottleHeight / 2, 16, bottleHeight, 0x302c28, 0.92);
      this.add.rectangle(x, 196 - bottleHeight, 6, 10, 0x302c28, 0.92);
    });

    [346, 640, 934].forEach((x) => {
      this.add.rectangle(x, 426, 12, 48, 0x8e6b3a, 0.7);
      this.add.triangle(x, 394, -8, 13, 0, -13, 8, 13, COLORS.warmLight, 0.9);
    });
  }

  private renderSoulCoins(): void {
    const layout = START_LAYOUT.soulCoins;
    SoulCoinDisplay.render(this, {
      ...layout,
      value: getProgress().soulCoins,
    });
  }

  private renderLanguageToggle(): void {
    const layout = START_LAYOUT.language;
    this.add.container(layout.x, layout.y).add([
      this.menuButton(0, 0, layout.width, layout.height, t('language.button'), () => {
        toggleLanguage();
        this.scene.restart();
      }, '15px', 'utility'),
    ]);
  }

  private renderTitle(): void {
    const layout = START_LAYOUT.brand;
    const logo = START_TITLE_LOGOS[getLanguage()];

    if (this.textures.exists(logo.key)) {
      const title = this.add.image(layout.centerX, layout.titleY + 12, logo.key).setOrigin(0.5);
      title.setDisplaySize(logo.width, logo.width / title.width * title.height);
    } else {
      const title = this.add.text(layout.centerX, layout.titleY, t('start.title'), {
        fontFamily: DISPLAY_FONT_FAMILY,
        fontSize: '66px',
        color: COLORS.text,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      title.setShadow(0, 0, COLORS.dangerText, 14, true, true);
    }

    const subtitle = this.add.text(layout.centerX, layout.subtitleY + 24, t('start.subtitle'), {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '19px',
      color: COLORS.muted,
      align: 'center',
      wordWrap: { width: layout.width, useAdvancedWrap: true },
      lineSpacing: 6,
    }).setOrigin(0.5);
    subtitle.setShadow(0, 0, '#000000', 5, true, true);

    this.add.rectangle(layout.centerX, layout.dividerY, 112, 2, COLORS.accent, 0.82);
    this.add.rectangle(layout.centerX, layout.dividerY + 4, 248, 1, COLORS.line, 0.54);
  }

  private renderRuntimeModeBadge(): void {
    if (!import.meta.env.DEV || !isTestMode()) {
      return;
    }

    const badge = this.add.container(1122, 94);
    const panel = this.add.rectangle(0, 0, 236, 28, 0x493a10, 0.96).setStrokeStyle(1, 0xffd85c, 0.92);
    const label = this.add.text(0, 0, t('runtimeMode.testBadge'), {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '15px',
      color: '#ffe99a',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    label.setShadow(0, 0, '#ffd85c', 7, true, true);
    badge.add([panel, label]);
  }

  private renderMenu(): void {
    const layout = START_LAYOUT.menu;
    const menu = this.add.container(layout.x, layout.y);
    const primaryCenterX = layout.primaryWidth / 2;
    const utilityRowWidth = layout.utilityWidth * 2 + layout.utilityGap;
    const utilityLeft = (layout.primaryWidth - utilityRowWidth) / 2;
    const secondaryTop = layout.primaryHeight + layout.rowGap;
    const utilityTop = secondaryTop + layout.secondaryHeight + layout.rowGap;

    menu.add(this.menuButton(primaryCenterX, layout.primaryHeight / 2, layout.primaryWidth, layout.primaryHeight, t('start.game'), () => {
      this.scene.start('TableSelectScene');
    }, '24px', 'primary'));

    menu.add(this.menuButton(primaryCenterX, secondaryTop + layout.secondaryHeight / 2, layout.secondaryWidth, layout.secondaryHeight, t('start.story'), () => {
      this.scene.start('StorySelectScene');
    }, '21px', 'secondary'));

    menu.add([
      this.menuButton(utilityLeft + layout.utilityWidth / 2, utilityTop + layout.utilityHeight / 2, layout.utilityWidth, layout.utilityHeight, t('start.shop'), () => {
        this.scene.start('ShopScene');
      }, '18px', 'utility'),
      this.menuButton(utilityLeft + layout.utilityWidth + layout.utilityGap + layout.utilityWidth / 2, utilityTop + layout.utilityHeight / 2, layout.utilityWidth, layout.utilityHeight, t('start.inventory'), () => {
        this.scene.start('InventoryScene');
      }, '18px', 'utility'),
    ]);

    if (isTestMode()) {
      const pvpTop = utilityTop + layout.utilityHeight + layout.rowGap;
      menu.add(this.menuButton(primaryCenterX, pvpTop + 22, layout.secondaryWidth, 44, t('start.pvp'), () => {
        this.scene.start('PvpLobbyScene');
      }, '16px', 'utility'));
    }

    const statusLayout = START_LAYOUT.status;
    this.statusText = this.add.text(statusLayout.centerX, statusLayout.y, '', {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '17px',
      color: COLORS.accentText,
      align: 'center',
      wordWrap: { width: statusLayout.width },
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
      fontFamily: GAME_FONT_FAMILY,
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
      fontFamily: GAME_FONT_FAMILY,
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
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '21px',
      color: COLORS.text,
      fontStyle: 'bold',
    }));
    column.add(this.add.text(22, 48, lines.join('\n'), {
      fontFamily: GAME_FONT_FAMILY,
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

  private menuButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void,
    fontSize = '22px',
    variant: MenuButtonVariant = 'secondary',
  ): Phaser.GameObjects.Container {
    const medievalVariant: MedievalButtonVariant = variant === 'primary'
      ? 'primary'
      : variant === 'utility' ? 'secondary' : 'normal';

    return MedievalButton.render(this, {
      x: x - width / 2,
      y: y - height / 2,
      width,
      height,
      label,
      fontSize,
      variant: medievalVariant,
      skin: EVERNIGHT_BUTTON_SKIN,
      onActivate: () => {
        this.playButtonClick();
        onClick();
      },
    });
  }

  private playButtonClick(): void {
    this.sound.play('buttonClick', { volume: 0.42 });
  }

  private showStatus(message: string): void {
    this.statusText?.setText(message);
  }
}

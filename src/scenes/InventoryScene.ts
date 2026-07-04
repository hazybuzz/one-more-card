import Phaser from 'phaser';
import { playLobbyMusic, preloadLobbyMusic } from '../game/audio';
import { ITEMS, ItemDefinition } from '../game/items';
import { t } from '../game/i18n';
import { getProgress } from '../game/progress';

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
};

export class InventoryScene extends Phaser.Scene {
  constructor() {
    super('InventoryScene');
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
    this.renderHeader();
    this.renderInventory();
    this.add.text(640, 642, t('inventory.futureUse'), {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: COLORS.muted,
    }).setOrigin(0.5);
  }

  private addBackground(): void {
    this.add.rectangle(640, 360, 1280, 720, COLORS.bg);
    this.add.circle(640, 360, 248, 0x191c22, 0.92).setStrokeStyle(2, COLORS.line);
    this.add.circle(640, 360, 168, 0x101114, 0.52).setStrokeStyle(1, 0x2b303c);
  }

  private renderHeader(): void {
    this.add.text(640, 78, t('inventory.title'), {
      fontFamily: 'Arial',
      fontSize: '42px',
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, COLORS.accentText, 10, true, true);

    this.add.container(110, 50).add([
      this.button(0, 0, 178, 44, t('inventory.returnLobby'), () => {
        this.scene.start('StartScene');
      }, '16px'),
    ]);

    const coinPanel = this.add.container(1118, 50);
    coinPanel.add(this.add.rectangle(0, 0, 236, 52, COLORS.panel, 0.95).setStrokeStyle(2, COLORS.accent));
    coinPanel.add(this.add.text(-96, -13, t('progress.soulCoins'), {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: COLORS.muted,
    }));
    const value = this.add.text(96, 0, `${getProgress().soulCoins}`, {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: COLORS.accentText,
      fontStyle: 'bold',
    }).setOrigin(1, 0.5);
    value.setShadow(0, 0, COLORS.accentText, 10, true, true);
    coinPanel.add(value);
  }

  private renderInventory(): void {
    const ownedItems = ITEMS.filter((item) => (getProgress().ownedItems[item.id] ?? 0) > 0);
    if (ownedItems.length === 0) {
      this.add.text(640, 360, t('inventory.empty'), {
        fontFamily: 'Arial',
        fontSize: '28px',
        color: COLORS.muted,
      }).setOrigin(0.5);
      return;
    }

    const startX = 278;
    ownedItems.forEach((item, index) => {
      this.renderItemCard(startX + index * 362, 348, item, getProgress().ownedItems[item.id] ?? 0);
    });
  }

  private renderItemCard(x: number, y: number, item: ItemDefinition, count: number): void {
    const card = this.add.container(x, y);
    card.add(this.add.rectangle(0, 0, 304, 320, COLORS.panel, 0.96).setStrokeStyle(2, COLORS.accent));
    card.add(this.add.circle(0, -96, 38, COLORS.accent, 0.18).setStrokeStyle(2, COLORS.accent));
    card.add(this.add.text(0, -99, item.icon, {
      fontFamily: 'Arial',
      fontSize: '42px',
      color: COLORS.accentText,
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, COLORS.accentText, 8, true, true));

    card.add(this.add.text(0, -36, t(item.nameKey), {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5));
    card.add(this.add.text(0, 4, t('inventory.owned', { count }), {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: COLORS.accentText,
    }).setOrigin(0.5));
    card.add(this.add.text(-122, 42, t(item.descriptionKey), {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: COLORS.muted,
      lineSpacing: 4,
      wordWrap: { width: 244 },
      align: 'center',
    }));
  }

  private button(x: number, y: number, width: number, height: number, label: string, onClick: () => void, fontSize = '20px'): Phaser.GameObjects.Container {
    const button = this.add.container(x, y);
    const rect = this.add.rectangle(width / 2, height / 2, width, height, COLORS.button).setStrokeStyle(2, COLORS.line);
    const text = this.add.text(width / 2, height / 2, label, {
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
}

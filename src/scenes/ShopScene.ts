import Phaser from 'phaser';
import { playLobbyMusic, preloadLobbyMusic } from '../game/audio';
import { COSMETICS, CosmeticConfig } from '../game/cosmetics';
import { ITEMS, ItemDefinition } from '../game/items';
import { t } from '../game/i18n';
import { addCosmetic, addItem, equipAttackEffect, getProgress, ownsCosmetic, spendSoulCoins, unequipAttackEffect } from '../game/progress';

const COLORS = {
  bg: 0x101114,
  panel: 0x1b1d22,
  panelAlt: 0x252832,
  line: 0x3b3f4c,
  text: '#f2f2ed',
  muted: '#aeb4c0',
  accent: 0xe8cf73,
  accentText: '#e8cf73',
  green: '#78d18a',
  dangerText: '#ff4b5f',
  button: 0x303542,
  buttonHover: 0x41495b,
};

export class ShopScene extends Phaser.Scene {
  private statusText?: Phaser.GameObjects.Text;

  constructor() {
    super('ShopScene');
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
    this.renderHeader();
    this.renderItems();
    this.renderCosmetics();
    this.statusText = this.add.text(640, 674, status || t('shop.futureUse'), {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: status ? COLORS.accentText : COLORS.muted,
    }).setOrigin(0.5);
  }

  private addBackground(): void {
    this.add.rectangle(640, 360, 1280, 720, COLORS.bg);
    this.add.circle(640, 360, 248, 0x191c22, 0.92).setStrokeStyle(2, COLORS.line);
    this.add.circle(640, 360, 168, 0x101114, 0.52).setStrokeStyle(1, 0x2b303c);
  }

  private renderHeader(): void {
    this.add.text(640, 78, t('shop.title'), {
      fontFamily: 'Arial',
      fontSize: '42px',
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, COLORS.accentText, 10, true, true);

    this.add.container(110, 50).add([
      this.button(0, 0, 178, 44, t('shop.returnLobby'), () => {
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

  private renderItems(): void {
    this.add.text(640, 152, t('shop.itemsSection'), {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const startX = 278;
    ITEMS.forEach((item, index) => {
      this.renderItemCard(startX + index * 362, 310, item);
    });
  }

  private renderItemCard(x: number, y: number, item: ItemDefinition): void {
    const progress = getProgress();
    const canAfford = progress.soulCoins >= item.price;
    const ownedCount = progress.ownedItems[item.id] ?? 0;
    const card = this.add.container(x, y);

    card.add(this.add.rectangle(0, 0, 304, 268, COLORS.panel, 0.96).setStrokeStyle(2, canAfford ? COLORS.accent : COLORS.line));
    card.add(this.add.circle(0, -82, 30, canAfford ? COLORS.accent : COLORS.line, canAfford ? 0.18 : 0.12).setStrokeStyle(2, canAfford ? COLORS.accent : COLORS.line));
    card.add(this.add.text(0, -84, item.icon, {
      fontFamily: 'Arial',
      fontSize: '34px',
      color: canAfford ? COLORS.accentText : COLORS.muted,
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, canAfford ? COLORS.accentText : '#000000', 8, true, true));

    card.add(this.add.text(0, -34, t(item.nameKey), {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5));
    card.add(this.add.text(0, -4, t('shop.price', { price: item.price }), {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: COLORS.accentText,
    }).setOrigin(0.5));
    card.add(this.add.text(0, 22, t('shop.owned', { count: ownedCount }), {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: COLORS.muted,
    }).setOrigin(0.5));
    card.add(this.add.text(-122, 50, t(item.descriptionKey), {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: COLORS.muted,
      lineSpacing: 4,
      wordWrap: { width: 244 },
      align: 'center',
    }));
    card.add(this.button(-72, 88, 144, 42, t('shop.buy'), () => this.buyItem(item), '17px', canAfford ? COLORS.button : 0x25272d));
  }

  private renderCosmetics(): void {
    this.add.text(640, 470, t('shop.cosmeticsSection'), {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    COSMETICS.forEach((cosmetic, index) => {
      this.renderCosmeticCard(278 + index * 362, 580, cosmetic);
    });
  }

  private renderCosmeticCard(x: number, y: number, cosmetic: CosmeticConfig): void {
    const progress = getProgress();
    const owned = ownsCosmetic(cosmetic.id);
    const equipped = progress.equippedAttackEffect === cosmetic.id;
    const canAfford = progress.soulCoins >= cosmetic.price;
    const card = this.add.container(x, y);
    const active = owned || canAfford;

    card.add(this.add.rectangle(0, 0, 304, 152, COLORS.panel, 0.96).setStrokeStyle(2, equipped ? 0x7fd7ff : active ? COLORS.accent : COLORS.line));
    card.add(this.add.circle(-112, -28, 32, equipped ? 0x3b8dff : COLORS.accent, equipped ? 0.24 : 0.16).setStrokeStyle(2, equipped ? 0x7fd7ff : COLORS.accent));
    const icon = this.add.text(-112, -30, cosmetic.icon, {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: equipped ? '#9fe7ff' : COLORS.accentText,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    icon.setShadow(0, 0, equipped ? '#9fe7ff' : COLORS.accentText, 10, true, true);
    card.add(icon);

    card.add(this.add.text(-70, -54, t(cosmetic.nameKey), {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: COLORS.text,
      fontStyle: 'bold',
    }));
    card.add(this.add.text(-70, -24, owned ? t('shop.ownedPermanent') : t('shop.price', { price: cosmetic.price }), {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: owned ? COLORS.green : COLORS.accentText,
    }));
    card.add(this.add.text(-70, 2, t(cosmetic.descriptionKey), {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: COLORS.muted,
      lineSpacing: 3,
      wordWrap: { width: 190 },
    }));

    const label = equipped ? t('shop.unequip') : owned ? t('shop.equip') : t('shop.buy');
    const fill = equipped ? 0x1f4d66 : canAfford || owned ? COLORS.button : 0x25272d;
    card.add(this.button(76, 34, 136, 40, label, () => this.buyOrEquipCosmetic(cosmetic), '16px', fill));
  }

  private buyItem(item: ItemDefinition): void {
    if (!spendSoulCoins(item.price)) {
      this.render(t('shop.notEnoughCoins', { item: t(item.nameKey) }));
      return;
    }

    addItem(item.id, 1);
    this.render(t('shop.buySuccess', { item: t(item.nameKey) }));
  }

  private buyOrEquipCosmetic(cosmetic: CosmeticConfig): void {
    if (getProgress().equippedAttackEffect === cosmetic.id) {
      unequipAttackEffect();
      this.render(t('shop.unequipSuccess', { item: t(cosmetic.nameKey) }));
      return;
    }

    if (!ownsCosmetic(cosmetic.id)) {
      if (!spendSoulCoins(cosmetic.price)) {
        this.render(t('shop.notEnoughCoins', { item: t(cosmetic.nameKey) }));
        return;
      }

      addCosmetic(cosmetic.id);
    }

    equipAttackEffect(cosmetic.id);
    this.render(t('shop.equipSuccess', { item: t(cosmetic.nameKey) }));
  }

  private button(x: number, y: number, width: number, height: number, label: string, onClick: () => void, fontSize = '20px', fill = COLORS.button): Phaser.GameObjects.Container {
    const button = this.add.container(x, y);
    const rect = this.add.rectangle(width / 2, height / 2, width, height, fill).setStrokeStyle(2, COLORS.line);
    const text = this.add.text(width / 2, height / 2, label, {
      fontFamily: 'Arial',
      fontSize,
      color: COLORS.text,
    }).setOrigin(0.5);

    rect.setInteractive({ useHandCursor: true });
    rect.on('pointerover', () => rect.setFillStyle(COLORS.buttonHover));
    rect.on('pointerout', () => rect.setFillStyle(fill));
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

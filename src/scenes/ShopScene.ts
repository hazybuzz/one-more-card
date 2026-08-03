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
  private itemTooltip?: Phaser.GameObjects.Container;

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
    this.hideItemTooltip();
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
    this.renderSectionTitle(146, t('shop.itemsSection'));

    const positions = this.gridPositions(ITEMS.length, 236, 116, 218);
    ITEMS.forEach((item, index) => {
      const position = positions[index];
      this.renderItemCard(position.x, position.y, item);
    });
  }

  private renderSectionTitle(y: number, label: string): void {
    this.add.text(640, y, label, {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.line(640, y + 20, 0, 0, 1040, 0, COLORS.line, 0.9).setLineWidth(1);
  }

  private gridPositions(count: number, startY: number, cardWidth: number, gap: number): Array<{ x: number; y: number }> {
    const columns = 3;
    const rows = Math.max(1, Math.ceil(count / columns));
    const positions: Array<{ x: number; y: number }> = [];

    for (let index = 0; index < count; index += 1) {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const cardsInRow = row === rows - 1 ? count - row * columns : columns;
      const rowWidth = cardsInRow * cardWidth + Math.max(0, cardsInRow - 1) * gap;
      positions.push({
        x: 640 - rowWidth / 2 + cardWidth / 2 + column * (cardWidth + gap),
        y: startY + row * 132,
      });
    }

    return positions;
  }

  private renderItemCard(x: number, y: number, item: ItemDefinition): void {
    const progress = getProgress();
    const canAfford = progress.soulCoins >= item.price;
    const ownedCount = progress.ownedItems[item.id] ?? 0;
    const card = this.add.container(x, y);

    const border = canAfford ? COLORS.accent : COLORS.line;
    const background = this.add.rectangle(0, 0, 218, 112, COLORS.panel, 0.96).setStrokeStyle(2, border);
    background.setInteractive({ useHandCursor: true });
    background.on('pointerover', () => this.showShopTooltip(x, y - 76, t(item.nameKey), t(item.descriptionKey), t('shop.price', { price: item.price })));
    background.on('pointerout', () => this.hideItemTooltip());
    card.add(background);
    card.add(this.add.circle(-76, -15, 24, canAfford ? COLORS.accent : COLORS.line, canAfford ? 0.18 : 0.12).setStrokeStyle(2, border));
    card.add(this.add.text(-76, -16, item.icon, {
      fontFamily: 'Arial',
      fontSize: '27px',
      color: canAfford ? COLORS.accentText : COLORS.muted,
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, canAfford ? COLORS.accentText : '#000000', 7, true, true));

    card.add(this.add.text(-42, -40, t(item.nameKey), {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: COLORS.text,
      fontStyle: 'bold',
    }));
    card.add(this.add.text(-42, -15, t('shop.price', { price: item.price }), {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: COLORS.accentText,
    }));
    card.add(this.add.text(-42, 8, t('shop.owned', { count: ownedCount }), {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: COLORS.muted,
    }));
    card.add(this.infoButton(82, -37, () => this.showShopTooltip(x, y - 76, t(item.nameKey), t(item.descriptionKey), t('shop.price', { price: item.price }))));
    card.add(this.button(32, 30, 142, 38, t('shop.buy'), () => this.buyItem(item), '16px', canAfford ? COLORS.button : 0x25272d));
  }

  private renderCosmetics(): void {
    this.renderSectionTitle(400, t('shop.cosmeticsSection'));

    const positions = this.gridPositions(COSMETICS.length, 510, 218, 18);
    COSMETICS.forEach((cosmetic, index) => {
      const position = positions[index];
      this.renderCosmeticCard(position.x, position.y, cosmetic);
    });
  }

  private renderCosmeticCard(x: number, y: number, cosmetic: CosmeticConfig): void {
    const progress = getProgress();
    const owned = ownsCosmetic(cosmetic.id);
    const equipped = progress.equippedAttackEffect === cosmetic.id;
    const canAfford = progress.soulCoins >= cosmetic.price;
    const card = this.add.container(x, y);
    const active = owned || canAfford;

    const border = equipped ? 0x7fd7ff : active ? COLORS.accent : COLORS.line;
    const background = this.add.rectangle(0, 0, 218, 112, COLORS.panel, 0.96).setStrokeStyle(2, border);
    background.setInteractive({ useHandCursor: true });
    background.on('pointerover', () => this.showShopTooltip(x, y - 76, t(cosmetic.nameKey), t(cosmetic.descriptionKey), owned ? t('shop.ownedPermanent') : t('shop.price', { price: cosmetic.price })));
    background.on('pointerout', () => this.hideItemTooltip());
    card.add(background);
    card.add(this.add.circle(-76, -15, 24, equipped ? 0x3b8dff : COLORS.accent, equipped ? 0.24 : 0.16).setStrokeStyle(2, border));
    const icon = this.add.text(-76, -16, cosmetic.icon, {
      fontFamily: 'Arial',
      fontSize: '27px',
      color: equipped ? '#9fe7ff' : COLORS.accentText,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    icon.setShadow(0, 0, equipped ? '#9fe7ff' : COLORS.accentText, 10, true, true);
    card.add(icon);

    card.add(this.add.text(-42, -40, t(cosmetic.nameKey), {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: COLORS.text,
      fontStyle: 'bold',
    }));
    card.add(this.add.text(-42, -15, owned ? t('shop.ownedPermanent') : t('shop.price', { price: cosmetic.price }), {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: owned ? COLORS.green : COLORS.accentText,
    }));
    card.add(this.infoButton(82, -37, () => this.showShopTooltip(x, y - 76, t(cosmetic.nameKey), t(cosmetic.descriptionKey), owned ? t('shop.ownedPermanent') : t('shop.price', { price: cosmetic.price }))));

    const label = equipped ? t('shop.unequip') : owned ? t('shop.equip') : t('shop.buy');
    const fill = equipped ? 0x1f4d66 : canAfford || owned ? COLORS.button : 0x25272d;
    card.add(this.button(32, 30, 142, 38, label, () => this.buyOrEquipCosmetic(cosmetic), '16px', fill));
  }

  private infoButton(x: number, y: number, onClick: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const circle = this.add.circle(0, 0, 11, COLORS.panelAlt).setStrokeStyle(1, COLORS.line);
    const label = this.add.text(0, -1, 'i', {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: COLORS.muted,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    circle.setInteractive({ useHandCursor: true });
    circle.on('pointerover', onClick);
    circle.on('pointerdown', onClick);
    container.add([circle, label]);
    return container;
  }

  private showShopTooltip(x: number, y: number, title: string, description: string, meta: string): void {
    this.hideItemTooltip();
    const width = 300;
    const height = 132;
    const safeX = Phaser.Math.Clamp(x, width / 2 + 18, 1280 - width / 2 - 18);
    const safeY = Phaser.Math.Clamp(y, height / 2 + 18, 720 - height / 2 - 18);
    const tooltip = this.add.container(safeX, safeY).setDepth(20);
    tooltip.add(this.add.rectangle(0, 0, width, height, 0x101114, 0.98).setStrokeStyle(2, COLORS.accent));
    tooltip.add(this.add.text(-132, -50, title, {
      fontFamily: 'Arial',
      fontSize: '19px',
      color: COLORS.text,
      fontStyle: 'bold',
    }));
    tooltip.add(this.add.text(-132, -20, description, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: COLORS.muted,
      lineSpacing: 4,
      wordWrap: { width: 264 },
    }));
    tooltip.add(this.add.text(-132, 44, meta, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: COLORS.accentText,
      fontStyle: 'bold',
    }));
    this.itemTooltip = tooltip;
  }

  private hideItemTooltip(): void {
    this.itemTooltip?.destroy();
    this.itemTooltip = undefined;
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

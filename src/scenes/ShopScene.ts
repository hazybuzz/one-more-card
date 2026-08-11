import Phaser from 'phaser';
import { playLobbyMusic, preloadLobbyMusic } from '../game/audio';
import { COSMETICS, type CosmeticConfig } from '../game/cosmetics';
import { t } from '../game/i18n';
import { ITEMS, type ItemDefinition } from '../game/items';
import {
  addCosmetic,
  addItem,
  equipAttackEffect,
  getProgress,
  ownsCosmetic,
  spendSoulCoins,
  unequipAttackEffect,
} from '../game/progress';
import {
  CatalogCard,
  CatalogDetailPanel,
  CategoryTabs,
  createCosmeticCatalogEntry,
  createItemCatalogEntry,
  DESKTOP_CATALOG_LAYOUT,
  entriesForCategory,
  ScrollableGrid,
  type CatalogCategoryId,
  type CatalogEntryViewModel,
} from '../ui/catalog';

const COLORS = {
  bg: 0x101114,
  panel: 0x1b1d22,
  panelAlt: 0x252832,
  line: 0x3b3f4c,
  text: '#f2f2ed',
  muted: '#aeb4c0',
  accent: 0xe8cf73,
  accentText: '#e8cf73',
  equipped: 0x7fd7ff,
  green: '#78d18a',
  button: 0x303542,
  buttonHover: 0x41495b,
};

const CATALOG_LAYOUT = DESKTOP_CATALOG_LAYOUT;

export class ShopScene extends Phaser.Scene {
  private activeCategory: CatalogCategoryId = 'battle-items';
  private selectedEntryId?: string;
  private scrollGrid?: ScrollableGrid<CatalogEntryViewModel>;
  private detailPanel?: Phaser.GameObjects.Container;

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
    this.scrollGrid?.destroy();
    this.scrollGrid = undefined;
    this.detailPanel = undefined;
    this.children.removeAll(true);
    this.addBackground();
    this.renderHeader();

    const entries = this.catalogEntries();
    const activeEntries = entriesForCategory(entries, this.activeCategory);
    if (!activeEntries.some((entry) => entry.id === this.selectedEntryId)) {
      this.selectedEntryId = activeEntries[0]?.id;
    }

    this.renderCategoryTabs(entries);
    this.renderCatalogGrid(activeEntries);
    this.renderSelectedEntry(activeEntries);
    this.renderStatus(status);
  }

  private addBackground(): void {
    this.add.rectangle(640, 360, 1280, 720, COLORS.bg);
    this.add.circle(640, 372, 300, 0x191c22, 0.58).setStrokeStyle(1, COLORS.line, 0.55);
    this.add.line(640, 124, 0, 0, 1224, 0, COLORS.line, 0.7).setLineWidth(1);
  }

  private renderHeader(): void {
    this.add.text(640, 62, t('shop.title'), {
      fontFamily: 'Arial',
      fontSize: '38px',
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, COLORS.accentText, 9, true, true);

    this.add.container(24, 30).add(this.button(0, 0, 176, 44, t('shop.returnLobby'), () => {
      this.scene.start('StartScene');
    }, '16px'));

    const coinPanel = this.add.container(1118, 52);
    coinPanel.add(this.add.rectangle(0, 0, 236, 52, COLORS.panel, 0.96).setStrokeStyle(2, COLORS.accent));
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

  private catalogEntries(): CatalogEntryViewModel[] {
    const progress = getProgress();
    const itemEntries = ITEMS.map((item) => createItemCatalogEntry(item, {
      soulCoins: progress.soulCoins,
      ownedCount: progress.ownedItems[item.id] ?? 0,
    }));
    const cosmeticEntries = COSMETICS.map((cosmetic) => createCosmeticCatalogEntry(cosmetic, {
      soulCoins: progress.soulCoins,
      ownedCount: ownsCosmetic(cosmetic.id) ? 1 : 0,
      equipped: progress.equippedAttackEffect === cosmetic.id,
    }));
    return [...itemEntries, ...cosmeticEntries];
  }

  private renderCategoryTabs(entries: CatalogEntryViewModel[]): void {
    this.add.text(CATALOG_LAYOUT.sidebarX, 132, t('shop.categories'), {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: COLORS.muted,
    });
    CategoryTabs.render(this, {
      x: CATALOG_LAYOUT.sidebarX,
      y: CATALOG_LAYOUT.sidebarY,
      width: CATALOG_LAYOUT.sidebarWidth,
      activeCategory: this.activeCategory,
      tabs: [
        {
          id: 'battle-items',
          label: t('shop.itemsSection'),
          count: entriesForCategory(entries, 'battle-items').length,
        },
        {
          id: 'effects',
          label: t('shop.cosmeticsSection'),
          count: entriesForCategory(entries, 'effects').length,
        },
      ],
      colors: {
        panel: COLORS.panel,
        activePanel: COLORS.panelAlt,
        line: COLORS.line,
        accent: COLORS.accent,
        accentText: COLORS.accentText,
        text: COLORS.text,
        muted: COLORS.muted,
      },
      onSelect: (category) => {
        this.playButtonClick();
        this.activeCategory = category;
        this.selectedEntryId = undefined;
        this.render();
      },
    });
  }

  private renderCatalogGrid(entries: CatalogEntryViewModel[]): void {
    const sectionLabel = this.categoryLabel(this.activeCategory);
    this.add.text(CATALOG_LAYOUT.gridX, 126, sectionLabel, {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: COLORS.text,
      fontStyle: 'bold',
    });
    this.add.text(CATALOG_LAYOUT.gridX + CATALOG_LAYOUT.gridWidth - 14, 132, `${entries.length}`, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: COLORS.muted,
    }).setOrigin(1, 0.5);

    this.scrollGrid = new ScrollableGrid<CatalogEntryViewModel>(this, {
      x: CATALOG_LAYOUT.gridX,
      y: CATALOG_LAYOUT.gridY,
      width: CATALOG_LAYOUT.gridWidth,
      height: CATALOG_LAYOUT.gridHeight,
      columns: 3,
      cellWidth: 204,
      cellHeight: 158,
      columnGap: 14,
      rowGap: 14,
      scrollbar: {
        thumbColor: 0x747b8c,
        thumbHoverColor: 0xa8b0c2,
        trackColor: COLORS.panelAlt,
      },
    });
    this.scrollGrid.setItems(entries, (_scene, entry) => CatalogCard.render(this, {
      entry,
      width: 196,
      height: 150,
      selected: entry.id === this.selectedEntryId,
      metaText: this.cardMetaText(entry),
      actionLabel: this.actionLabel(entry),
      colors: {
        panel: COLORS.panel,
        panelHover: COLORS.panelAlt,
        line: COLORS.line,
        accent: COLORS.accent,
        accentText: COLORS.accentText,
        text: COLORS.text,
        muted: COLORS.muted,
        equipped: COLORS.equipped,
      },
      createButton: (x, y, width, height, label, onClick) => this.button(x, y, width, height, label, onClick, '14px'),
      onSelect: () => this.selectEntry(entry.id),
      onAction: () => this.activateEntry(entry),
    }));
  }

  private selectEntry(entryId: string): void {
    if (this.selectedEntryId === entryId) {
      return;
    }

    this.selectedEntryId = entryId;
    this.detailPanel?.destroy(true);
    const entries = entriesForCategory(this.catalogEntries(), this.activeCategory);
    this.renderSelectedEntry(entries);
  }

  private renderSelectedEntry(entries: CatalogEntryViewModel[]): void {
    const entry = entries.find((candidate) => candidate.id === this.selectedEntryId) ?? entries[0];
    if (!entry) {
      return;
    }

    this.selectedEntryId = entry.id;
    this.detailPanel = CatalogDetailPanel.render(this, {
      x: CATALOG_LAYOUT.detailX,
      y: CATALOG_LAYOUT.detailY,
      width: CATALOG_LAYOUT.detailWidth,
      height: CATALOG_LAYOUT.detailHeight,
      entry,
      categoryLabel: this.categoryLabel(entry.category),
      ownershipText: this.ownershipText(entry),
      priceText: t('shop.price', { price: entry.price }),
      actionLabel: this.actionLabel(entry),
      colors: {
        panel: COLORS.panel,
        line: COLORS.line,
        accent: COLORS.accent,
        accentText: COLORS.accentText,
        text: COLORS.text,
        muted: COLORS.muted,
        equipped: COLORS.equipped,
      },
      createButton: (x, y, width, height, label, onClick) => this.button(x, y, width, height, label, onClick, '17px'),
      onAction: () => this.activateEntry(entry),
    });
  }

  private categoryLabel(category: CatalogCategoryId): string {
    return category === 'battle-items' ? t('shop.itemsSection') : t('shop.cosmeticsSection');
  }

  private cardMetaText(entry: CatalogEntryViewModel): string {
    if (entry.ownership === 'stackable') {
      return `${t('shop.price', { price: entry.price })}  ·  ${t('shop.owned', { count: entry.ownedCount })}`;
    }

    if (entry.equipped) {
      return t('shop.equipped');
    }

    return entry.ownedCount > 0 ? t('shop.ownedPermanent') : t('shop.price', { price: entry.price });
  }

  private ownershipText(entry: CatalogEntryViewModel): string {
    if (entry.ownership === 'stackable') {
      return t('shop.owned', { count: entry.ownedCount });
    }

    return entry.equipped ? t('shop.equipped') : entry.ownedCount > 0 ? t('shop.ownedPermanent') : t('shop.notOwned');
  }

  private actionLabel(entry: CatalogEntryViewModel): string {
    if (entry.kind === 'consumable') {
      return t('shop.buy');
    }

    if (entry.equipped) {
      return t('shop.unequip');
    }

    return entry.ownedCount > 0 ? t('shop.equip') : t('shop.buy');
  }

  private activateEntry(entry: CatalogEntryViewModel): void {
    if (entry.kind === 'consumable') {
      const item = ITEMS.find((candidate) => candidate.id === entry.id);
      if (item) {
        this.buyItem(item);
      }
      return;
    }

    const cosmetic = COSMETICS.find((candidate) => candidate.id === entry.id);
    if (cosmetic) {
      this.buyOrEquipCosmetic(cosmetic);
    }
  }

  private renderStatus(status: string): void {
    const message = status || t('shop.futureUse');
    const text = this.add.text(640, 682, message, {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: status ? COLORS.accentText : COLORS.muted,
      align: 'center',
      wordWrap: { width: 760 },
    }).setOrigin(0.5);
    if (status) {
      text.setShadow(0, 0, COLORS.accentText, 8, true, true);
    }
  }

  private buyItem(item: ItemDefinition): void {
    if (!spendSoulCoins('item_purchase', item.price, { itemId: item.id })) {
      this.render(t('shop.notEnoughCoins', { item: t(item.nameKey) }));
      return;
    }

    addItem(item.id, 1);
    this.selectedEntryId = item.id;
    this.render(t('shop.buySuccess', { item: t(item.nameKey) }));
  }

  private buyOrEquipCosmetic(cosmetic: CosmeticConfig): void {
    if (getProgress().equippedAttackEffect === cosmetic.id) {
      unequipAttackEffect();
      this.selectedEntryId = cosmetic.id;
      this.render(t('shop.unequipSuccess', { item: t(cosmetic.nameKey) }));
      return;
    }

    if (!ownsCosmetic(cosmetic.id)) {
      if (!spendSoulCoins('cosmetic_purchase', cosmetic.price, { cosmeticId: cosmetic.id })) {
        this.render(t('shop.notEnoughCoins', { item: t(cosmetic.nameKey) }));
        return;
      }
      addCosmetic(cosmetic.id);
    }

    equipAttackEffect(cosmetic.id);
    this.selectedEntryId = cosmetic.id;
    this.render(t('shop.equipSuccess', { item: t(cosmetic.nameKey) }));
  }

  private button(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void,
    fontSize = '20px',
    fill = COLORS.button,
  ): Phaser.GameObjects.Container {
    const button = this.add.container(x, y);
    const rect = this.add.rectangle(width / 2, height / 2, width, height, fill).setStrokeStyle(2, COLORS.line);
    const text = this.add.text(width / 2, height / 2, label, {
      fontFamily: 'Arial',
      fontSize,
      color: COLORS.text,
    }).setOrigin(0.5);

    rect.setInteractive({ useHandCursor: true });
    rect.on(Phaser.Input.Events.POINTER_OVER, () => rect.setFillStyle(COLORS.buttonHover));
    rect.on(Phaser.Input.Events.POINTER_OUT, () => rect.setFillStyle(fill));
    rect.on(Phaser.Input.Events.POINTER_DOWN, () => {
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

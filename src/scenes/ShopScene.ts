import Phaser from 'phaser';
import { GAME_FONT_FAMILY } from '../ui/themes/typography';
import { playLobbyMusic, preloadLobbyMusic } from '../game/audio';
import { COSMETICS, type CosmeticConfig } from '../game/cosmetics';
import { t } from '../game/i18n';
import { ITEMS, type ItemDefinition } from '../game/items';
import { configureBattleIconTextures, getBattleIconArtByResourceKey, preloadBattleIcons } from '../ui/art';
import { getCosmeticCatalogArt, preloadCosmeticCatalogArt } from '../ui/art/CosmeticArtRegistry';
import { EVERNIGHT_BUTTON_SKIN } from '../ui/art/commonUiArt';
import { MedievalButton } from '../ui/components/MedievalButton';
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
  CATALOG_BACKGROUND_KEY,
  CatalogDetailPanel,
  CatalogSceneShell,
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
  private readonly cardViews = new Map<string, Phaser.GameObjects.Container>();

  constructor() {
    super('ShopScene');
  }

  preload(): void {
    preloadLobbyMusic(this);
    preloadBattleIcons(this);
    preloadCosmeticCatalogArt(this);
    CatalogSceneShell.preload(this);
    if (!this.cache.audio.exists('buttonClick')) {
      this.load.audio('buttonClick', '/audio/switch28.ogg');
    }
  }

  create(): void {
    configureBattleIconTextures(this);
    playLobbyMusic(this);
    this.render();
  }

  private render(status = ''): void {
    this.scrollGrid?.destroy();
    this.scrollGrid = undefined;
    this.detailPanel = undefined;
    this.cardViews.clear();
    this.children.removeAll(true);
    CatalogSceneShell.render(this, {
      title: t('shop.title'),
      backLabel: t('shop.returnLobby'),
      soulCoins: getProgress().soulCoins,
      backgroundTextureKey: CATALOG_BACKGROUND_KEY,
      backgroundShadeAlpha: 0.7,
      onBack: () => this.scene.start('StartScene'),
    });

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

  private catalogEntries(): CatalogEntryViewModel[] {
    const progress = getProgress();
    const itemEntries = ITEMS.map((item) => {
      const iconArt = getBattleIconArtByResourceKey(item.resourceKey);
      return createItemCatalogEntry(item, {
        soulCoins: progress.soulCoins,
        ownedCount: progress.ownedItems[item.id] ?? 0,
        thumbnailTextureKey: iconArt?.textureKey,
        previewTextureKey: iconArt?.textureKey,
      });
    });
    const cosmeticEntries = COSMETICS.map((cosmetic) => {
      const art = getCosmeticCatalogArt(cosmetic.id);
      return createCosmeticCatalogEntry(cosmetic, {
        soulCoins: progress.soulCoins,
        ownedCount: ownsCosmetic(cosmetic.id) ? 1 : 0,
        equipped: progress.equippedAttackEffect === cosmetic.id,
        thumbnailTextureKey: art.textureKey,
        previewTextureKey: art.textureKey,
        textureAngle: art.angle,
        accentColor: art.accentColor,
      });
    });
    return [...itemEntries, ...cosmeticEntries];
  }

  private renderCategoryTabs(entries: CatalogEntryViewModel[]): void {
    this.add.text(CATALOG_LAYOUT.sidebarX, 132, t('shop.categories'), {
      fontFamily: GAME_FONT_FAMILY,
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
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '22px',
      color: COLORS.text,
      fontStyle: 'bold',
    });
    this.add.text(CATALOG_LAYOUT.gridX + CATALOG_LAYOUT.gridWidth - 14, 132, `${entries.length}`, {
      fontFamily: GAME_FONT_FAMILY,
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
      cellHeight: 174,
      columnGap: 14,
      rowGap: 14,
      scrollbar: {
        thumbColor: 0x747b8c,
        thumbHoverColor: 0xa8b0c2,
        trackColor: COLORS.panelAlt,
      },
    });
    this.scrollGrid.setItems(entries, (_scene, entry) => {
      const card = CatalogCard.render(this, {
        entry,
        width: 196,
        height: 166,
        selected: entry.id === this.selectedEntryId,
        metaText: this.cardMetaText(entry),
        priceText: this.cardPriceText(entry),
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
      });
      this.cardViews.set(entry.id, card);
      return card;
    });
  }

  private selectEntry(entryId: string): void {
    if (this.selectedEntryId === entryId) {
      return;
    }

    const previousEntryId = this.selectedEntryId;
    this.selectedEntryId = entryId;
    this.setCardSelected(previousEntryId, false);
    this.setCardSelected(entryId, true);
    this.detailPanel?.destroy(true);
    const entries = entriesForCategory(this.catalogEntries(), this.activeCategory);
    this.renderSelectedEntry(entries);
  }

  private setCardSelected(entryId: string | undefined, selected: boolean): void {
    if (!entryId) {
      return;
    }
    const setSelected = this.cardViews.get(entryId)?.getData('setSelected') as ((value: boolean) => void) | undefined;
    setSelected?.(selected);
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
      return t('shop.owned', { count: entry.ownedCount });
    }

    if (entry.equipped) {
      return t('shop.equipped');
    }

    return entry.ownedCount > 0 ? t('shop.ownedPermanent') : t('shop.notOwned');
  }

  private cardPriceText(entry: CatalogEntryViewModel): string | undefined {
    if (entry.ownership === 'permanent' && entry.ownedCount > 0) {
      return undefined;
    }
    return t('shop.price', { price: entry.price });
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
      fontFamily: GAME_FONT_FAMILY,
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
  ): Phaser.GameObjects.Container {
    return MedievalButton.render(this, {
      x,
      y,
      width,
      height,
      label,
      fontSize,
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
}

import Phaser from 'phaser';
import { GAME_FONT_FAMILY } from '../ui/themes/typography';
import { playLobbyMusic, preloadLobbyMusic } from '../game/audio';
import { COSMETICS } from '../game/cosmetics';
import { t } from '../game/i18n';
import { ITEMS } from '../game/items';
import { configureBattleIconTextures, getBattleIconArtByResourceKey, preloadBattleIcons } from '../ui/art';
import { EVERNIGHT_BUTTON_SKIN } from '../ui/art/commonUiArt';
import { MedievalButton } from '../ui/components/MedievalButton';
import { equipAttackEffect, getProgress, ownsCosmetic, unequipAttackEffect } from '../game/progress';
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
  button: 0x303542,
  buttonHover: 0x41495b,
};

const CATALOG_LAYOUT = DESKTOP_CATALOG_LAYOUT;

export class InventoryScene extends Phaser.Scene {
  private activeCategory: CatalogCategoryId = 'battle-items';
  private selectedEntryId?: string;
  private scrollGrid?: ScrollableGrid<CatalogEntryViewModel>;
  private detailPanel?: Phaser.GameObjects.Container;
  private readonly cardViews = new Map<string, Phaser.GameObjects.Container>();

  constructor() {
    super('InventoryScene');
  }

  preload(): void {
    preloadLobbyMusic(this);
    preloadBattleIcons(this);
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
      title: t('inventory.title'),
      backLabel: t('inventory.returnLobby'),
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
    this.renderStatus(status, entries.length === 0);
  }

  private catalogEntries(): CatalogEntryViewModel[] {
    const progress = getProgress();
    const itemEntries = ITEMS
      .filter((item) => (progress.ownedItems[item.id] ?? 0) > 0)
      .map((item) => {
        const iconArt = getBattleIconArtByResourceKey(item.resourceKey);
        return createItemCatalogEntry(item, {
          soulCoins: progress.soulCoins,
          ownedCount: progress.ownedItems[item.id] ?? 0,
          thumbnailTextureKey: iconArt?.textureKey,
          previewTextureKey: iconArt?.textureKey,
        });
      });
    const cosmeticEntries = COSMETICS
      .filter((cosmetic) => ownsCosmetic(cosmetic.id))
      .map((cosmetic) => createCosmeticCatalogEntry(cosmetic, {
        soulCoins: progress.soulCoins,
        ownedCount: 1,
        equipped: progress.equippedAttackEffect === cosmetic.id,
      }));
    return [...itemEntries, ...cosmeticEntries];
  }

  private renderCategoryTabs(entries: CatalogEntryViewModel[]): void {
    this.add.text(CATALOG_LAYOUT.sidebarX, 132, t('inventory.categories'), {
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
          label: t('inventory.itemsSection'),
          count: entriesForCategory(entries, 'battle-items').length,
        },
        {
          id: 'effects',
          label: t('inventory.cosmeticsSection'),
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
    this.add.text(CATALOG_LAYOUT.gridX, 126, this.categoryLabel(this.activeCategory), {
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

    if (entries.length === 0) {
      this.add.text(
        CATALOG_LAYOUT.gridX + CATALOG_LAYOUT.gridWidth / 2,
        CATALOG_LAYOUT.gridY + CATALOG_LAYOUT.gridHeight / 2,
        t('inventory.categoryEmpty'),
        {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: '22px',
          color: COLORS.muted,
        },
      ).setOrigin(0.5);
      return;
    }

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
        actionLabel: entry.kind === 'cosmetic' ? this.actionLabel(entry) : undefined,
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
        onAction: entry.kind === 'cosmetic' ? () => this.toggleCosmetic(entry) : undefined,
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
    this.renderSelectedEntry(entriesForCategory(this.catalogEntries(), this.activeCategory));
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
      this.renderEmptyDetailPanel();
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
      ownershipText: entry.ownership === 'stackable'
        ? t('inventory.owned', { count: entry.ownedCount })
        : entry.equipped ? t('inventory.equipped') : t('inventory.ownedPermanent'),
      actionLabel: entry.kind === 'cosmetic' ? this.actionLabel(entry) : undefined,
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
      onAction: entry.kind === 'cosmetic' ? () => this.toggleCosmetic(entry) : undefined,
    });
  }

  private renderEmptyDetailPanel(): void {
    const { detailX, detailY, detailWidth, detailHeight } = CATALOG_LAYOUT;
    const panel = this.add.container(detailX, detailY);
    panel.add(this.add.rectangle(detailWidth / 2, detailHeight / 2, detailWidth, detailHeight, COLORS.panel, 0.72).setStrokeStyle(2, COLORS.line));
    panel.add(this.add.text(detailWidth / 2, detailHeight / 2, t('inventory.emptyDetail'), {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '18px',
      color: COLORS.muted,
      align: 'center',
      wordWrap: { width: detailWidth - 56 },
    }).setOrigin(0.5));
    this.detailPanel = panel;
  }

  private categoryLabel(category: CatalogCategoryId): string {
    return category === 'battle-items' ? t('inventory.itemsSection') : t('inventory.cosmeticsSection');
  }

  private cardMetaText(entry: CatalogEntryViewModel): string {
    if (entry.ownership === 'stackable') {
      return t('inventory.owned', { count: entry.ownedCount });
    }
    return entry.equipped ? t('inventory.equipped') : t('inventory.ownedPermanent');
  }

  private actionLabel(entry: CatalogEntryViewModel): string {
    return entry.equipped ? t('inventory.unequip') : t('inventory.equip');
  }

  private toggleCosmetic(entry: CatalogEntryViewModel): void {
    const cosmetic = COSMETICS.find((candidate) => candidate.id === entry.id);
    if (!cosmetic || !ownsCosmetic(cosmetic.id)) {
      return;
    }

    this.selectedEntryId = cosmetic.id;
    if (getProgress().equippedAttackEffect === cosmetic.id) {
      unequipAttackEffect();
      this.render(t('inventory.unequipSuccess', { item: t(cosmetic.nameKey) }));
      return;
    }

    equipAttackEffect(cosmetic.id);
    this.render(t('inventory.equipSuccess', { item: t(cosmetic.nameKey) }));
  }

  private renderStatus(status: string, empty: boolean): void {
    const message = status || (empty ? t('inventory.empty') : t('inventory.futureUse'));
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

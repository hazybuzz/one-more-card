import { battleItemDescriptionKey } from '../../game/battleItemPolicy';
import Phaser from 'phaser';
import { ENDLESS_CONFIG } from '../../game/endless/EndlessConfig';
import type { EndlessBattleAccounting } from '../../game/endless/EndlessLedger';
import { ITEMS } from '../../game/items';
import { t } from '../../game/i18n';
import type { ItemId } from '../../game/types/item';
import { getBattleIconArtByResourceKey } from '../art';
import { CATALOG_LEATHER_PANEL_SKIN, EVERNIGHT_BUTTON_SKIN } from '../art/commonUiArt';
import { GAME_FONT_FAMILY } from '../themes/typography';
import { MedievalPanel } from './MedievalPanel';
import { MedievalButton } from './MedievalButton';

export function renderEndlessShopModal(scene: Phaser.Scene, options: {
  accounting: EndlessBattleAccounting;
  message?: string;
  onBuy: (item: ItemId, visitId: number) => void;
  onFinish: (visitId: number) => void;
}): Phaser.GameObjects.Container {
  const root = scene.add.container(640, 360).setDepth(115);
  const { accounting: state } = options;
  const visit = state.shop.visit!;
  const opening = visit.kind === 'opening';
  root.add(scene.add.rectangle(0, 0, 1280, 720, 0x030304, 0.86).setInteractive());
  root.add(MedievalPanel.render(scene, { width: 1020, height: 610, skin: CATALOG_LEATHER_PANEL_SKIN,
    fallbackFill: 0x24150f, fallbackLine: 0xb95b4d }));
  const text = (x: number, y: number, value: string, size: number, width = 950, color = '#f1e5cf') => {
    const label = scene.add.text(x, y, value, { fontFamily: GAME_FONT_FAMILY, fontSize: `${size}px`, color,
      align: 'center', wordWrap: { width, useAdvancedWrap: true }, lineSpacing: 5 }).setOrigin(0.5);
    root.add(label);
    return label;
  };
  text(0, -258, t(opening ? 'endless.opening.title' : 'endless.shop.title'), 30);
  text(0, -212, t('endless.shop.summary', { coins: state.wallet, count: state.shop.inventoryCount,
    capacity: state.shop.capacity, used: visit.purchases, max: ENDLESS_CONFIG.purchasesPerVisit }), 18);
  text(0, -176, t(opening ? 'endless.opening.intro' : 'endless.shop.visits', { remaining: visit.remaining, coins: state.startingSupplyCoins }), 15, 950, '#bdb3aa');
  ITEMS.forEach((item, index) => {
    const x = (index - (ITEMS.length - 1) / 2) * 190;
    root.add(scene.add.rectangle(x, 22, 180, 338, 0x160f0c, 0.9).setStrokeStyle(1, 0x715a3c));
    const icon = getBattleIconArtByResourceKey(item.resourceKey);
    if (icon && scene.textures.exists(icon.textureKey)) root.add(scene.add.image(x, -105, icon.textureKey).setDisplaySize(54, 54));
    else text(x, -105, item.icon, 30, 180, '#edbd80');
    text(x, -53, t(item.nameKey), 20, 168);
    text(x, 9, t(opening && ['heal_potion','holy_shield'].includes(item.id) ? `endless.opening.item.${item.id}` : battleItemDescriptionKey('endless', item)), 15, 164, '#cfc5b8');
    text(x, 78, t('endless.shop.itemStatus', { price: visit.prices[item.id], stock: visit.stock[item.id],
      owned: state.shop.ownedItems[item.id] ?? 0 }), 15, 164, '#edbd80');
    const reason = visit.stock[item.id] <= 0 ? 'sold-out'
      : visit.purchases >= ENDLESS_CONFIG.purchasesPerVisit ? 'purchase-limit'
        : state.shop.inventoryCount >= state.shop.capacity ? 'inventory-full'
          : state.wallet < visit.prices[item.id] ? 'not-enough-coins' : undefined;
    root.add(MedievalButton.render(scene, { x: x - 80, y: 124, width: 160, height: 44,
      label: t(reason ? `endless.shop.${reason}` : 'endless.shop.buy'), fontSize: '15px', enabled: !reason,
      variant: 'primary', skin: EVERNIGHT_BUTTON_SKIN, onActivate: () => options.onBuy(item.id, visit.id) }));
  });
  const rules = t(state.startingSupplyCoins > 0 ? 'endless.shop.supplyRules' : 'endless.shop.rules', { coins: state.supplyRemaining });
  text(0, 214, options.message ? `${options.message}  ${rules}` : rules, 15, 950, '#bdb3aa');
  root.add(MedievalButton.render(scene, { x: -140, y: 248, width: 280, height: 44,
    label: t(opening ? 'endless.opening.start' : visit.remaining > 1 ? 'endless.shop.nextVisit' : 'endless.shop.continue'), fontSize: '17px',
    variant: 'secondary', skin: EVERNIGHT_BUTTON_SKIN, onActivate: () => options.onFinish(visit.id) }));
  return root;
}

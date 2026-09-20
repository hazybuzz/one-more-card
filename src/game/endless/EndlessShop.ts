import { ENDLESS_CONFIG } from './EndlessConfig';
import type { ItemId } from '../types/item';

export type EndlessPurchaseResult = { bought: true; price: number } | {
  bought: false; reason: 'closed' | 'stale-visit' | 'sold-out' | 'purchase-limit' | 'inventory-full' | 'not-enough-coins';
};

/** All balances and inventory belong to this run; no external progress writes. */
export class EndlessShop {
  private spent = 0;
  private items: Partial<Record<ItemId, number>> = {};
  private completed = 0;
  private visit?: { id: number; remaining: number; purchases: number; stock: Record<ItemId, number>; prices: Record<ItemId, number>; kind?: 'opening' };
  private openingCompleted: boolean;

  constructor(openingAvailable = false) { this.openingCompleted = !openingAvailable; }
  get isOpeningVisit(): boolean { return this.visit?.kind === 'opening'; }
  openStartingShop(): boolean {
    if (this.openingCompleted || this.visit) return false;
    this.visit = { id: 0, kind: 'opening', remaining: 1, purchases: 0, stock: this.freshStock(), prices: { ...ENDLESS_CONFIG.baseItemPrices } };
    return true;
  }

  get spentCoins(): number { return this.spent; }
  get ownedItems(): Partial<Record<ItemId, number>> { return { ...this.items }; }
  get inventoryCount(): number { return Object.values(this.items).reduce((sum, count) => sum + (count ?? 0), 0); }
  get isOpen(): boolean { return !!this.visit; }
  hasPending(defeats: number): boolean { return this.completed < Math.floor((defeats + 1) / 2); }

  open(defeats: number): boolean {
    if (this.visit) return true;
    const remaining = Math.floor((defeats + 1) / 2) - this.completed;
    if (remaining <= 0) return false;
    const stage = Math.floor(defeats / ENDLESS_CONFIG.defeatsPerStage);
    const prices = Object.fromEntries(Object.entries(ENDLESS_CONFIG.baseItemPrices)
      .map(([id, price]) => [id, price + stage * ENDLESS_CONFIG.priceIncreasePerStage])) as Record<ItemId, number>;
    this.visit = { id: this.completed + 1, remaining, purchases: 0, stock: this.freshStock(), prices };
    return true;
  }

  buy(id: ItemId, visitId: number, earnedCoins: number): EndlessPurchaseResult {
    const visit = this.visit;
    if (!visit) return { bought: false, reason: 'closed' };
    if (visit.id !== visitId) return { bought: false, reason: 'stale-visit' };
    if (!(visit.stock[id] > 0)) return { bought: false, reason: 'sold-out' };
    if (visit.purchases >= ENDLESS_CONFIG.purchasesPerVisit) return { bought: false, reason: 'purchase-limit' };
    if (this.inventoryCount >= ENDLESS_CONFIG.inventoryCapacity) return { bought: false, reason: 'inventory-full' };
    const price = visit.prices[id];
    if (earnedCoins - this.spent < price) return { bought: false, reason: 'not-enough-coins' };
    this.spent += price;
    this.items[id] = (this.items[id] ?? 0) + 1;
    visit.stock[id] -= 1;
    visit.purchases += 1;
    return { bought: true, price };
  }

  finishVisit(visitId: number): boolean {
    if (!this.visit || this.visit.id !== visitId) return false;
    if (this.isOpeningVisit) {
      this.openingCompleted = true;
      this.visit = undefined;
      return true;
    }
    this.completed += 1;
    if (this.visit.remaining > 1) {
      this.visit = { ...this.visit, id: this.completed + 1, remaining: this.visit.remaining - 1,
        purchases: 0, stock: this.freshStock() };
    } else this.visit = undefined;
    return true;
  }

  consume(id: ItemId): boolean {
    if (this.isOpen || !(this.items[id]! > 0)) return false;
    this.items[id] = this.items[id]! - 1;
    if (this.items[id] === 0) delete this.items[id];
    return true;
  }

  discardInventory(): void {
    this.items = {};
    this.visit = undefined;
  }

  getState(defeats: number) {
    return { openingCompleted: this.openingCompleted, completedVisits: this.completed, pendingVisits: Math.floor((defeats + 1) / 2) - this.completed,
      inventoryCount: this.inventoryCount, capacity: ENDLESS_CONFIG.inventoryCapacity,
      ownedItems: this.ownedItems,
      visit: this.visit ? { ...this.visit, stock: { ...this.visit.stock }, prices: { ...this.visit.prices } } : undefined };
  }

  getSaveState() { return { spent: this.spent, ...this.getState(0) }; }

  restore(state: EndlessShopSave): void {
    this.spent = state.spent;
    this.openingCompleted = state.openingCompleted ?? true;
    this.items = { ...state.ownedItems };
    this.completed = state.completedVisits;
    this.visit = state.visit ? { ...state.visit,
      stock: Object.assign({ resonance_dice: 0 }, state.visit.stock),
      prices: Object.assign({ resonance_dice: ENDLESS_CONFIG.baseItemPrices.resonance_dice }, state.visit.prices) } : undefined;
  }

  private freshStock(): Record<ItemId, number> {
    return Object.fromEntries(Object.keys(ENDLESS_CONFIG.baseItemPrices).map(id => [id, 1])) as Record<ItemId, number>;
  }
}

export type EndlessShopSave = ReturnType<EndlessShop['getSaveState']>;

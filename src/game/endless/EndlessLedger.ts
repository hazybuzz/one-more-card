import { EndlessShop } from './EndlessShop';
import { calculateEndlessBalance } from './EndlessRules';
import { ENDLESS_CONFIG } from './EndlessConfig';
import type { EnemyId } from '../types/enemy';
import type { ItemId } from '../types/item';

export type EndlessLogicEvent =
  | { type: 'npc-defeated'; actionId: string; enemyInstanceId: string; enemyId: EnemyId; spirit: boolean; coins: number }
  | { type: 'resonance-scored'; actionId: string; enemyInstanceId: string; points: number; actualDamage: number }
  | { type: 'endless-stage-changed'; actionId: string; round: number; stage: number; attackBonus: number };

export class EndlessLedger {
  readonly shop: EndlessShop;
  constructor(public startingSupplyCoins = 0) { this.shop = new EndlessShop(startingSupplyCoins > 0); }
  private defeated = new Set<string>();
  private scored = new Set<string>();
  private events: EndlessLogicEvent[] = [];
  private defeats = 0;
  private spirits = 0;
  private points = 0;
  private stage = 0;
  private attackBonus = 0;

  recordDefeat(actionId: string, enemyInstanceId: string, enemyId: EnemyId, spirit: boolean): void {
    if (this.defeated.has(enemyInstanceId)) return;
    this.defeated.add(enemyInstanceId);
    if (spirit) this.spirits += 1;
    else this.defeats += 1;
    this.events.push({ type: 'npc-defeated', actionId, enemyInstanceId, enemyId, spirit,
      coins: spirit ? 0 : ENDLESS_CONFIG.coinsPerDefeat });
  }

  recordResonance(actionId: string, enemyInstanceId: string, points: number, actualDamage: number): void {
    if (points <= 1 || actualDamage <= 0 || this.scored.has(actionId)) return;
    this.scored.add(actionId);
    this.points += points;
    this.events.push({ type: 'resonance-scored', actionId, enemyInstanceId, points, actualDamage });
  }

  beginRound(round: number, actionId: string): void {
    const stage = Math.floor(this.defeats / ENDLESS_CONFIG.defeatsPerStage);
    const attackBonus = Math.floor(this.defeats / ENDLESS_CONFIG.defeatsPerAttackIncrease);
    if (stage !== this.stage || attackBonus !== this.attackBonus) {
      this.stage = stage;
      this.attackBonus = attackBonus;
      this.events.push({ type: 'endless-stage-changed', actionId, round, stage, attackBonus });
    }
  }

  get currentStage(): number { return this.stage; }
  get currentAttackBonus(): number { return this.attackBonus; }

  getSaveState() {
    return { startingSupplyCoins: this.startingSupplyCoins, defeated: [...this.defeated], scored: [...this.scored], events: this.events.map((event) => ({ ...event })),
      defeats: this.defeats, spirits: this.spirits, points: this.points, stage: this.stage, attackBonus: this.attackBonus,
      shop: this.shop.getSaveState() };
  }

  restore(state: EndlessLedgerSave): void {
    this.startingSupplyCoins = state.startingSupplyCoins ?? 0;
    this.defeated = new Set(state.defeated); this.scored = new Set(state.scored);
    this.events = state.events.map((event) => ({ ...event }));
    this.defeats = state.defeats; this.spirits = state.spirits; this.points = state.points;
    this.stage = state.stage; this.attackBonus = state.attackBonus;
    this.shop.restore(state.shop);
  }

  getState() {
    const nextStage = Math.floor(this.defeats / ENDLESS_CONFIG.defeatsPerStage);
    const balance = calculateEndlessBalance(this.defeats * ENDLESS_CONFIG.coinsPerDefeat, this.shop.spentCoins, this.startingSupplyCoins);
    return {
      startingSupplyCoins: this.startingSupplyCoins, supplyRemaining: balance.supplyRemaining, cashWallet: balance.cashWallet,
      defeatedCount: this.defeats, clearedSpiritCount: this.spirits, resonancePoints: this.points,
      earnedCoins: this.defeats * ENDLESS_CONFIG.coinsPerDefeat,
      wallet: balance.wallet, spentCoins: this.shop.spentCoins,
      shop: this.shop.getState(this.defeats),
      shopOpportunities: Math.floor((this.defeats + 1) / 2),
      stage: this.stage, attackBonus: this.attackBonus,
      nextStage, nextAttackBonus: Math.floor(this.defeats / ENDLESS_CONFIG.defeatsPerAttackIncrease),
      nextShopAt: Math.floor((this.defeats + 1) / 2) * 2 + 1,
      nextItemPrices: Object.fromEntries(Object.entries(ENDLESS_CONFIG.baseItemPrices)
        .map(([id, price]) => [id, price + nextStage * ENDLESS_CONFIG.priceIncreasePerStage])) as Record<ItemId, number>,
      events: this.events.map((event) => ({ ...event })),
    };
  }
}

export type EndlessBattleAccounting = ReturnType<EndlessLedger['getState']>;

export type EndlessLedgerSave = ReturnType<EndlessLedger['getSaveState']>;

import type { PlayerState, BattlePhase, BattleOutcome, BattleResult } from '../battle';
import { RANKS, SUITS, type Card } from '../card';
import { ENEMY_CONFIGS } from '../data/enemies';
import type { EnemyState, EnemyType } from '../enemy';
import { ENDLESS_SEAT_POOLS, type EndlessRosterState } from './EndlessRoster';
import type { EndlessLedgerSave } from './EndlessLedger';
import type { EndlessEndReason } from './EndlessSettlement';
import { ENDLESS_CONFIG } from './EndlessConfig';

export interface EndlessBattleSnapshot {
  version: 1; runId: string; randomState: number;
  nextEnemyInstance: number; nextLogicAction: number; enemyDamageActions: [string, string][];
  roster: EndlessRosterState; ledger: EndlessLedgerSave;
  player: PlayerState; enemies: EnemyState[]; deck: Card[]; log: string[];
  phase: BattlePhase; battleOutcome?: BattleOutcome; endlessEndReason?: EndlessEndReason;
  currentEnemyIndex: number; round: number; roundRevealed: boolean;
  pendingSoulRedeem: boolean; pendingEnemySoulRedeem?: EnemyType; pendingItemReveal: boolean;
  results: BattleResult[];
}
const integer = (n: unknown, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= 0 && (n as number) <= max;
const cards = (v: unknown): v is Card[] => Array.isArray(v) && v.length <= 52 && v.every(c => c &&
  (RANKS.includes(c.rank) && SUITS.includes(c.suit) || ['小王', '大王'].includes(c.rank)));

/** Reject incomplete/corrupt snapshots rather than silently restarting a paid run. */
export function validEndlessSnapshot(value: unknown, runId: string): value is EndlessBattleSnapshot {
  try {
    const s = value as EndlessBattleSnapshot;
    if (!s || s.version !== 1 || s.runId !== runId || !integer(s.randomState, 0xffffffff)
      || !integer(s.nextEnemyInstance) || !integer(s.nextLogicAction) || !integer(s.round)
      || !['choice','enemy-turn','player-turn','round-result','battle-result'].includes(s.phase)
      || ![-1,0,1,2,3].includes(s.currentEnemyIndex) || !cards(s.deck) || !cards(s.player.hand)
      || !integer(s.player.hp,ENDLESS_CONFIG.playerHp) || s.player.maxHp !== ENDLESS_CONFIG.playerHp || !Array.isArray(s.log) || !s.log.every(v=>typeof v==='string')
      || typeof s.pendingSoulRedeem !== 'boolean' || typeof s.pendingItemReveal !== 'boolean'
      || typeof s.roundRevealed !== 'boolean' || typeof s.player.soulRedeemUsed !== 'boolean') return false;
    for (const key of ['drawCountThisRound','resonanceShiftCooldown','resonanceSummonCooldown','incomingDamageBonus','shieldCharges'] as const)
      if (!integer(s.player[key])) return false;
    for (const key of ['fateMode','resonanceShiftUsed','resonanceSummonUsed','drawLocked'] as const)
      if (typeof s.player[key] !== 'boolean') return false;
    if (s.battleOutcome !== undefined && s.battleOutcome !== 'defeat' || s.endlessEndReason !== undefined && !['exit','defeat'].includes(s.endlessEndReason)) return false;
    if (s.phase === 'battle-result' && (s.battleOutcome !== 'defeat' || !s.endlessEndReason)) return false;
    if (!Array.isArray(s.enemies) || s.enemies.length !== 3 || new Set(s.enemies.map(e=>e.instanceId)).size !== 3) return false;
    const validEnemy = (e: EnemyState) => e && ENEMY_CONFIGS[e.id] && typeof e.instanceId === 'string'
      && ['evernight_tavern','northern_longhouse','dragon_gate','edo_teahouse'].includes(e.sourceThemeId)
      && e.instanceId.startsWith(runId+':') && integer(e.hp,e.maxHp) && integer(e.maxHp) && e.maxHp>0 && cards(e.hand)
      && typeof e.defeated==='boolean' && typeof e.summoned==='boolean'
      && ['passiveTriggered','passiveTriggeredThisRound','soulRedeemUsed','revealed','compared','taoistTalismaned','smokeScreenArmed','smokeScreenUsed'].every(k=>typeof (e as unknown as Record<string,unknown>)[k]==='boolean')
      && ['attackBonus','roundAttackBonus','iaijutsuStacks','hanamiDamageBank','summonCount'].every(k=>integer((e as unknown as Record<string,unknown>)[k]));
    if (!s.enemies.every((e,seat)=>validEnemy(e) && e.seatIndex===seat && (e.id==='einherjar' || ENDLESS_SEAT_POOLS[seat].some(id=>id===e.id)))) return false;
    if (!Array.isArray(s.results) || !s.results.every(r=>validEnemy(r.enemy) && ['win','lose','draw'].includes(r.outcome)
      && integer(r.damage) && integer(r.playerScore.multiplier) && integer(r.enemyScore.multiplier))) return false;
    const roster=s.roster;
    if (!integer(roster.randomState,0xffffffff) || roster.bags.length!==3 || roster.lastDraws.length!==3
      || !roster.bags.every((bag,seat)=>Array.isArray(bag) && new Set(bag).size===bag.length && bag.every(id=>ENDLESS_SEAT_POOLS[seat].some(p=>p===id)))
      || !roster.lastDraws.every((id,seat)=>id==null || ENDLESS_SEAT_POOLS[seat].some(p=>p===id))) return false;
    const l=s.ledger;
    if (!['defeats','spirits','points','stage','attackBonus'].every(k=>integer((l as unknown as Record<string,unknown>)[k]))
      || l.stage>Math.floor(l.defeats/ENDLESS_CONFIG.defeatsPerStage) || l.attackBonus>Math.floor(l.defeats/ENDLESS_CONFIG.defeatsPerAttackIncrease)
      || !Array.isArray(l.defeated) || new Set(l.defeated).size!==l.defeated.length || l.defeated.length!==l.defeats+l.spirits
      || !Array.isArray(l.scored) || new Set(l.scored).size!==l.scored.length || !Array.isArray(l.events)
      || !Array.isArray(s.enemyDamageActions) || !s.enemyDamageActions.every(pair=>pair.length===2&&pair.every(v=>typeof v==='string'))) return false;
    const supply = l.startingSupplyCoins ?? 0;
    if (!integer(supply)) return false;
    const shop=l.shop;
    if (!integer(shop.spent,l.defeats*ENDLESS_CONFIG.coinsPerDefeat + supply) || !integer(shop.completedVisits,Math.floor((l.defeats+1)/2))
      || !shop.ownedItems || Object.entries(shop.ownedItems).some(([id,n])=>!['heal_potion','cooling_charm','resonance_dust','holy_shield','resonance_dice'].includes(id)||!integer(n,ENDLESS_CONFIG.inventoryCapacity))
      || Object.values(shop.ownedItems).reduce((sum,n)=>sum+(n??0),0)>ENDLESS_CONFIG.inventoryCapacity) return false;
    if (shop.visit) {
      const v=shop.visit;
      const opening = v.kind === 'opening';
      if (v.kind !== undefined && !opening) return false;
      if (opening ? supply <= 0 || s.round !== 0 || shop.openingCompleted !== false || v.id !== 0 || v.remaining !== 1
        : v.id !== shop.completedVisits + 1 || v.remaining > Math.floor((l.defeats+1)/2)-shop.completedVisits) return false;
      if (!integer(v.purchases,ENDLESS_CONFIG.purchasesPerVisit) || !integer(v.remaining) || v.remaining<1
        || !['heal_potion','cooling_charm','resonance_dust','holy_shield'].every(id=>integer(v.stock[id as keyof typeof v.stock],1)&&integer(v.prices[id as keyof typeof v.prices]))) return false;
      if ((v.stock.resonance_dice !== undefined || v.prices.resonance_dice !== undefined)
        && (!integer(v.stock.resonance_dice,1) || !integer(v.prices.resonance_dice))) return false;
    }
    if (shop.openingCompleted !== undefined && typeof shop.openingCompleted !== 'boolean') return false;
    if (s.round === 0 && (shop.visit?.kind !== 'opening' || !['choice','battle-result'].includes(s.phase)
      || s.player.hand.length !== 0 || s.enemies.some(e => e.hand.length !== 0 || e.passiveTriggered || e.passiveTriggeredThisRound
        || e.taoistTalismaned || e.smokeScreenArmed || e.hanamiFanTargetId !== undefined)
      || s.results.length !== 0 || l.defeats !== 0 || l.spirits !== 0 || l.points !== 0
      || s.pendingSoulRedeem || s.pendingEnemySoulRedeem || s.pendingItemReveal || shop.completedVisits !== 0)) return false;
    if (s.round > 0 && supply > 0 && shop.openingCompleted !== true) return false;
    return true;
  } catch { return false; }
}

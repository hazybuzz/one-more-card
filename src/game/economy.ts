import { getRuntimeMode } from './runtimeMode';
import type { EndlessSettlementSummary, EndlessSettlementResult } from './endless/EndlessSettlement';
import { isEndlessBattleReady } from './endless/EndlessConfig';
import type { EndlessEntryResult } from './endless/EndlessState';
import { addItem, getProgress, grantSoulCoins, recordBattleResult, recordFormalTableResult, reserveEndlessEntry, settleEndlessProgress, spendSoulCoins } from './progress';
import type { EconomyTransactionContext } from './types/economy';
import type { RewardConfig } from './types/level';
import type { EntryStakeMultiplier, TableThemeId } from './types/tableTheme';

export const BATTLE_ENTRY_COST = 20;
export const DEFAULT_FORMAL_PAYOUT_MULTIPLIER = 1.5;
export const PVP_DUEL_COIN_STAKE = 20;
export const RELIEF_COIN_THRESHOLD = BATTLE_ENTRY_COST;
export const RELIEF_TARGET_COINS = 30;

export interface EconomyChange {
  amount: number;
  total: number;
  rewardStatus?: 'granted' | 'already-claimed' | 'none';
}

export interface EntryPaymentResult extends EconomyChange {
  paid: boolean;
}

export function calculateFormalVictoryReward(
  nominalEntryCost: number,
  remainingHp: number,
  payoutMultiplier: number,
): number {
  const entry = Math.max(0, Math.floor(nominalEntryCost));
  const hp = Math.max(0, Math.floor(remainingHp));
  const multiplier = Math.max(0, payoutMultiplier);
  return Math.max(0, Math.floor((entry + hp) * multiplier));
}

export function payBattleEntry(): EconomyChange {
  return payEntryCost(BATTLE_ENTRY_COST);
}

export function payEntryCost(cost: number, context: EconomyTransactionContext = {}): EconomyChange {
  const currentCoins = getProgress().soulCoins;
  const paid = Math.min(currentCoins, Math.max(0, Math.floor(cost)));
  spendSoulCoins('formal_entry', paid, context);
  return {
    amount: paid,
    total: getProgress().soulCoins,
  };
}

export function tryPayEntryCost(cost: number, context: EconomyTransactionContext = {}): EntryPaymentResult {
  const normalizedCost = Math.max(0, Math.floor(cost));
  const currentCoins = getProgress().soulCoins;
  if (currentCoins < normalizedCost) {
    return {
      paid: false,
      amount: 0,
      total: currentCoins,
    };
  }

  spendSoulCoins('formal_entry', normalizedCost, context);
  return {
    paid: true,
    amount: normalizedCost,
    total: getProgress().soulCoins,
  };
}

export function settleBattleEconomy(
  outcome: 'victory' | 'defeat',
  remainingHp: number,
  nominalEntryCost = BATTLE_ENTRY_COST,
  payoutMultiplier = DEFAULT_FORMAL_PAYOUT_MULTIPLIER,
  tableThemeId?: TableThemeId,
  stakeMultiplier?: EntryStakeMultiplier,
): EconomyChange {
  if (tableThemeId) {
    recordFormalTableResult(outcome, tableThemeId, stakeMultiplier);
  } else {
    recordBattleResult(outcome);
  }

  if (outcome === 'victory') {
    const reward = calculateFormalVictoryReward(nominalEntryCost, remainingHp, payoutMultiplier);
    grantSoulCoins('formal_victory', reward, {
      themeId: tableThemeId,
      stakeMultiplier,
    });
    return {
      amount: reward,
      total: getProgress().soulCoins,
    };
  }

  return {
    amount: 0,
    total: getProgress().soulCoins,
  };
}

export function settleStoryBattleEconomy(
  outcome: 'victory' | 'defeat',
  rewards: RewardConfig[] = [],
  isFirstClear: boolean,
  levelId?: string,
): EconomyChange {
  recordBattleResult(outcome);

  if (outcome === 'defeat') {
    return {
      amount: 0,
      total: getProgress().soulCoins,
      rewardStatus: 'none',
    };
  }

  if (!isFirstClear) {
    return {
      amount: 0,
      total: getProgress().soulCoins,
      rewardStatus: 'already-claimed',
    };
  }

  const coinReward = rewards.reduce((total, reward) => total + Math.max(0, Math.floor(reward.soulCoins ?? 0)), 0);
  rewards.forEach((reward) => {
    Object.entries(reward.items ?? {}).forEach(([itemId, count]) => {
      addItem(itemId, count);
    });
  });
  grantSoulCoins('story_first_clear', coinReward, { levelId });

  return {
    amount: coinReward,
    total: getProgress().soulCoins,
    rewardStatus: 'granted',
  };
}

export function settleReliefBattleEconomy(outcome: 'victory' | 'defeat'): EconomyChange {
  recordBattleResult(outcome);

  if (outcome === 'defeat') {
    return {
      amount: 0,
      total: getProgress().soulCoins,
      rewardStatus: 'none',
    };
  }

  const currentCoins = getProgress().soulCoins;
  const reward = Math.max(0, RELIEF_TARGET_COINS - currentCoins);
  grantSoulCoins('relief', reward);
  return {
    amount: reward,
    total: getProgress().soulCoins,
    rewardStatus: 'granted',
  };
}

export function settlePvpDuelEconomy(outcome: 'victory' | 'defeat'): EconomyChange {
  recordBattleResult(outcome);

  if (outcome === 'victory') {
    grantSoulCoins('pvp_victory', PVP_DUEL_COIN_STAKE);
    return {
      amount: PVP_DUEL_COIN_STAKE,
      total: getProgress().soulCoins,
    };
  }

  const currentCoins = getProgress().soulCoins;
  const loss = Math.min(currentCoins, PVP_DUEL_COIN_STAKE);
  spendSoulCoins('pvp_loss', loss);
  return {
    amount: -loss,
    total: getProgress().soulCoins,
  };
}

/** Optional Web Lock serializes future paid entry across tabs; reservation itself is idempotent. */
export async function tryEnterEndlessMode(): Promise<EndlessEntryResult> {
  if (!isEndlessBattleReady(getRuntimeMode())) return { status: 'not-ready', amount: 0, total: getProgress().soulCoins };
  const runId = globalThis.crypto?.randomUUID?.() ?? `endless-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('one-more-card-endless-entry', () => reserveEndlessEntry(runId));
  }
  return reserveEndlessEntry(runId);
}

export async function settleEndlessEconomy(summary: EndlessSettlementSummary, ownerId?: string): Promise<EndlessSettlementResult> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('one-more-card-endless-entry', () => settleEndlessProgress(summary, ownerId));
  }
  return settleEndlessProgress(summary, ownerId);
}

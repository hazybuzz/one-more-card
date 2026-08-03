import { addSoulCoins, getProgress, recordBattleResult, setSoulCoins } from './progress';

export const BATTLE_ENTRY_COST = 20;
export const BATTLE_WIN_BASE_REWARD = 30;
export const HP_TO_COIN_RATE = 1;
export const PVP_DUEL_COIN_STAKE = 20;

export interface EconomyChange {
  amount: number;
  total: number;
}

export interface EntryPaymentResult extends EconomyChange {
  paid: boolean;
}

export function payBattleEntry(): EconomyChange {
  return payEntryCost(BATTLE_ENTRY_COST);
}

export function payEntryCost(cost: number): EconomyChange {
  const currentCoins = getProgress().soulCoins;
  const paid = Math.min(currentCoins, Math.max(0, Math.floor(cost)));
  setSoulCoins(currentCoins - paid);
  return {
    amount: paid,
    total: getProgress().soulCoins,
  };
}

export function tryPayEntryCost(cost: number): EntryPaymentResult {
  const normalizedCost = Math.max(0, Math.floor(cost));
  const currentCoins = getProgress().soulCoins;
  if (currentCoins < normalizedCost) {
    return {
      paid: false,
      amount: 0,
      total: currentCoins,
    };
  }

  setSoulCoins(currentCoins - normalizedCost);
  return {
    paid: true,
    amount: normalizedCost,
    total: getProgress().soulCoins,
  };
}

export function settleBattleEconomy(outcome: 'victory' | 'defeat', remainingHp: number, rewardMultiplier = 1): EconomyChange {
  recordBattleResult(outcome);

  if (outcome === 'victory') {
    const baseReward = BATTLE_WIN_BASE_REWARD + Math.max(0, Math.floor(remainingHp)) * HP_TO_COIN_RATE;
    const reward = Math.max(0, Math.floor(baseReward * Math.max(0, rewardMultiplier)));
    addSoulCoins(reward);
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

export function settlePvpDuelEconomy(outcome: 'victory' | 'defeat'): EconomyChange {
  recordBattleResult(outcome);

  if (outcome === 'victory') {
    addSoulCoins(PVP_DUEL_COIN_STAKE);
    return {
      amount: PVP_DUEL_COIN_STAKE,
      total: getProgress().soulCoins,
    };
  }

  const currentCoins = getProgress().soulCoins;
  const loss = Math.min(currentCoins, PVP_DUEL_COIN_STAKE);
  setSoulCoins(currentCoins - loss);
  return {
    amount: -loss,
    total: getProgress().soulCoins,
  };
}

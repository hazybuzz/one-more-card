import { addSoulCoins, getProgress, recordBattleResult, setSoulCoins } from './progress';

export const BATTLE_ENTRY_COST = 20;
export const BATTLE_WIN_BASE_REWARD = 30;
export const HP_TO_COIN_RATE = 1;

export interface EconomyChange {
  amount: number;
  total: number;
}

export function payBattleEntry(): EconomyChange {
  const currentCoins = getProgress().soulCoins;
  const paid = Math.min(currentCoins, BATTLE_ENTRY_COST);
  setSoulCoins(currentCoins - paid);
  return {
    amount: paid,
    total: getProgress().soulCoins,
  };
}

export function settleBattleEconomy(outcome: 'victory' | 'defeat', remainingHp: number): EconomyChange {
  recordBattleResult(outcome);

  if (outcome === 'victory') {
    const reward = BATTLE_WIN_BASE_REWARD + Math.max(0, Math.floor(remainingHp)) * HP_TO_COIN_RATE;
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

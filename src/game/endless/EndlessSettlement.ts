import { ENDLESS_CONFIG } from './EndlessConfig';
import { calculateEndlessSettlement } from './EndlessRules';
import type { EndlessBattleAccounting } from './EndlessLedger';

export type EndlessEndReason = 'defeat' | 'exit';
export interface EndlessSettlementSummary {
  runId: string;
  rulesVersion: 'endless-v1';
  reason: EndlessEndReason;
  round: number;
  defeatedCount: number;
  clearedSpiritCount: number;
  resonancePoints: number;
  entryPaid: number;
  earned: number;
  startingSupplyCoins?: number;
  spent: number;
  wallet: number;
  defeatBonus: number;
  resonanceBonus: number;
  total: number;
}
export interface EndlessSettlementReceipt extends EndlessSettlementSummary {
  settledAt: number;
  balanceAfter: number;
}
export type EndlessSettlementResult =
  | { status: 'settled' | 'already-settled'; receipt: EndlessSettlementReceipt }
  | { status: 'storage-unavailable' | 'invalid-run' };

export function summarizeEndlessRun(runId: string, round: number, accounting: EndlessBattleAccounting, reason: EndlessEndReason): EndlessSettlementSummary {
  return { runId, rulesVersion: ENDLESS_CONFIG.rulesVersion, reason, round,
    defeatedCount: accounting.defeatedCount, clearedSpiritCount: accounting.clearedSpiritCount,
    resonancePoints: accounting.resonancePoints, entryPaid: ENDLESS_CONFIG.entryCost,
    spent: accounting.spentCoins,
    startingSupplyCoins: accounting.startingSupplyCoins,
    ...calculateEndlessSettlement(accounting.defeatedCount, accounting.resonancePoints, accounting.spentCoins, accounting.startingSupplyCoins) };
}

export function normalizeEndlessReceipt(value: unknown): EndlessSettlementReceipt | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const r = value as EndlessSettlementReceipt;
  if (typeof r.runId !== 'string' || !r.runId || r.rulesVersion !== ENDLESS_CONFIG.rulesVersion
    || !['defeat', 'exit'].includes(r.reason) || r.entryPaid !== ENDLESS_CONFIG.entryCost) return undefined;
  const fields = ['round', 'defeatedCount', 'clearedSpiritCount', 'resonancePoints', 'earned', 'spent', 'wallet',
    'defeatBonus', 'resonanceBonus', 'total', 'settledAt', 'balanceAfter'] as const;
  if (fields.some((key) => !Number.isSafeInteger(r[key]) || r[key] < 0)) return undefined;
  if (!Number.isSafeInteger(r.startingSupplyCoins ?? 0) || (r.startingSupplyCoins ?? 0) < 0) return undefined;
  const expected = calculateEndlessSettlement(r.defeatedCount, r.resonancePoints, r.spent, r.startingSupplyCoins);
  if (r.spent > expected.earned + (r.startingSupplyCoins ?? 0) || Object.entries(expected).some(([key, amount]) => r[key as keyof typeof expected] !== amount)) return undefined;
  return { ...r };
}

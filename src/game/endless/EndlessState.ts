import type { EndlessBattleSnapshot } from './EndlessSnapshot';
import type { ItemId } from '../types/item';
import type { EntryStakeMultiplier, TableThemeId } from '../types/tableTheme';

export type FormalDifficultyWins = Partial<Record<TableThemeId, Partial<Record<EntryStakeMultiplier, number>>>>;

/** Stage-one paid reservation; later stages extend this into the resumable battle state. */
export interface EndlessSession {
  runId: string;
  rulesVersion: 'endless-v1';
  status: 'ready' | 'active' | 'ended' | 'invalid';
  snapshot?: EndlessBattleSnapshot;
  revision?: number;
  owner?: { id: string; expiresAt: number };
  startedAt: number;
  seed: number;
  entryPaid: 100;
  playerHp: number;
  maxPlayerHp: number;
  round: number;
  defeatedCount: number;
  clearedSpiritCount: number;
  resonancePoints: number;
  wallet: number;
  /** Missing on older paid runs: resume without granting opening supplies. */
  startingSupplyCoins?: number;
  spentCoins: number;
  ownedItems: Partial<Record<ItemId, number>>;
}

export type EndlessEntryResult =
  | { status: 'created' | 'resumed'; amount: number; total: number; session: EndlessSession }
  | { status: 'locked' | 'not-enough-coins' | 'storage-unavailable' | 'not-ready' | 'invalid-save'; amount: 0; total: number };

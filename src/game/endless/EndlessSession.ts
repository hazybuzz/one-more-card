import { validEndlessSnapshot } from './EndlessSnapshot';
import { ENDLESS_CONFIG } from './EndlessConfig';
import type { EndlessSession } from './EndlessState';

export function createEndlessSession(runId: string): EndlessSession {
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  return {
    runId, revision: 0, rulesVersion: ENDLESS_CONFIG.rulesVersion, status: 'ready', startedAt: Date.now(), seed,
    entryPaid: ENDLESS_CONFIG.entryCost, playerHp: ENDLESS_CONFIG.playerHp, maxPlayerHp: ENDLESS_CONFIG.playerHp,
    round: 0, defeatedCount: 0, clearedSpiritCount: 0, resonancePoints: 0, wallet: ENDLESS_CONFIG.startingSupplyCoins, startingSupplyCoins: ENDLESS_CONFIG.startingSupplyCoins, spentCoins: 0, ownedItems: {},
  };
}

export function cloneEndlessSession(session: EndlessSession): EndlessSession {
  return JSON.parse(JSON.stringify(session));
}

export function normalizeEndlessSession(value: unknown): EndlessSession | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const session = value as Partial<EndlessSession>;
  if (typeof session.runId !== 'string' || !session.runId || session.rulesVersion !== ENDLESS_CONFIG.rulesVersion
    || !Number.isSafeInteger(session.seed) || session.seed! < 0 || session.seed! > 0xffffffff
    || !Number.isSafeInteger(session.startedAt) || session.startedAt! < 0 || session.entryPaid !== ENDLESS_CONFIG.entryCost) return undefined;
  if (session.owner && (typeof session.owner.id !== 'string' || !session.owner.id || !Number.isSafeInteger(session.owner.expiresAt)))
    return { ...session, status: 'invalid', snapshot: undefined, owner: undefined, ownedItems: {} } as EndlessSession;
  if (session.status === 'ready' && session.round === 0 && !session.snapshot
    && session.playerHp === ENDLESS_CONFIG.playerHp && session.maxPlayerHp === ENDLESS_CONFIG.playerHp
    && ['defeatedCount','clearedSpiritCount','resonancePoints','spentCoins'].every(key => (session as unknown as Record<string, unknown>)[key] === 0)
    && session.wallet === (session.startingSupplyCoins ?? 0)
    && Number.isSafeInteger(session.startingSupplyCoins ?? 0) && (session.startingSupplyCoins ?? 0) >= 0
    && session.ownedItems && Object.keys(session.ownedItems).length === 0) {
    return { ...session, ownedItems: {}, revision: session.revision ?? 0 } as EndlessSession;
  }
  if ((session.status === 'active' || session.status === 'ended') && validEndlessSnapshot(session.snapshot, session.runId)
    && Number.isSafeInteger(session.revision) && session.revision! >= 0) return cloneEndlessSession(session as EndlessSession);
  return { ...session, status: 'invalid', snapshot: undefined, ownedItems: {} } as EndlessSession;
}

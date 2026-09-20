import { claimEndlessRun, checkEndlessOwner, saveEndlessBattle, renewEndlessOwner, releaseEndlessOwner } from '../progress';
import { getRuntimeMode } from '../runtimeMode';
import type { EndlessSession } from './EndlessState';
import type { EndlessBattleSnapshot } from './EndlessSnapshot';

export class EndlessRunController {
  private releaseLock?: () => void;
  private closed = false;
  private readonly mode = getRuntimeMode();
  constructor(public session: EndlessSession, readonly ownerId: string) {}
  static async acquire(runId: string): Promise<{ status: 'acquired'; controller: EndlessRunController } | { status: 'busy' | 'invalid-save' | 'storage-unavailable' }> {
    const ownerId = globalThis.crypto?.randomUUID?.() ?? `owner-${Date.now()}-${Math.random()}`;
    const claim = () => {
      const result = claimEndlessRun(runId, ownerId);
      if (result.status !== 'saved') return { status: result.status === 'stale' ? 'busy' as const : result.status };
      return { status: 'acquired' as const, controller: new EndlessRunController(result.session, ownerId) };
    };
    if (typeof navigator === 'undefined' || !navigator.locks) return claim();
    return new Promise((resolve) => {
      void navigator.locks.request(`one-more-card-endless-play-${getRuntimeMode()}`, { ifAvailable: true }, async (lock) => {
        if (!lock) { resolve({ status: 'busy' }); return; }
        const result = claim();
        resolve(result);
        if (result.status === 'acquired') await new Promise<void>(release => { result.controller.releaseLock = release; });
      }).catch(() => resolve({ status: 'storage-unavailable' }));
    });
  }
  before = (): void => {
    if (this.closed || getRuntimeMode() !== this.mode) throw new Error('stale');
    const result = checkEndlessOwner(this.session.runId, this.ownerId, this.session.revision ?? 0);
    if (result.status !== 'saved') throw new Error(result.status);
  };
  commit = (snapshot: EndlessBattleSnapshot): void => {
    const result = saveEndlessBattle(this.session.runId, this.ownerId, this.session.revision ?? 0, snapshot);
    if (result.status !== 'saved') throw new Error(result.status);
    this.session = result.session;
  };
  renew(): boolean { return !this.closed && getRuntimeMode() === this.mode && renewEndlessOwner(this.session.runId, this.ownerId); }
  release(): void {
    if (this.closed) return;
    this.closed = true;
    if (getRuntimeMode() === this.mode) releaseEndlessOwner(this.session.runId, this.ownerId);
    this.releaseLock?.();
  }
}

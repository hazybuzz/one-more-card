import type { EnemyId } from '../types/enemy';

export const ENDLESS_SEAT_POOLS = [
  ['goblin', 'viking_warrior', 'swordsman', 'shogun_samurai'],
  ['gambler', 'rune_shaman', 'songstress', 'ninja'],
  ['werewolf', 'valkyrie', 'taoist', 'oiran'],
] as const satisfies readonly (readonly EnemyId[])[];

export interface EndlessRosterState {
  randomState: number;
  bags: EnemyId[][];
  lastDraws: (EnemyId | undefined)[];
}

/** One independent shuffled bag per seat. Random state is explicit for later run saving. */
export class EndlessRoster {
  private randomState: number;
  private readonly bags: EnemyId[][] = [[], [], []];
  private readonly lastDraws: (EnemyId | undefined)[] = [undefined, undefined, undefined];

  constructor(seed: number) {
    this.randomState = seed >>> 0;
  }

  draw(seat: number): EnemyId {
    const pool = ENDLESS_SEAT_POOLS[seat];
    if (!pool) throw new Error(`Unknown endless seat: ${seat}`);
    const bag = this.bags[seat];
    if (bag.length === 0) {
      bag.push(...pool);
      for (let i = bag.length - 1; i > 0; i -= 1) {
        const j = Math.floor(this.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      if (bag[0] === this.lastDraws[seat]) [bag[0], bag[1]] = [bag[1], bag[0]];
    }
    const id = bag.shift()!;
    this.lastDraws[seat] = id;
    return id;
  }

  /** Deterministic test/restore rosters still establish the previous occupant. */
  rememberInitialOccupant(seat: number, id: EnemyId): void {
    if (!ENDLESS_SEAT_POOLS[seat]?.some((candidate) => candidate === id)) return;
    this.lastDraws[seat] = id;
    // Consume the specified initial role from its first bag, without redrawing that role.
    const remaining = [...ENDLESS_SEAT_POOLS[seat]].filter((candidate) => candidate !== id);
    for (let i = remaining.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.random() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
    this.bags[seat] = remaining;
  }

  restore(state: EndlessRosterState): void {
    this.randomState = state.randomState;
    state.bags.forEach((bag, seat) => { this.bags[seat] = [...bag]; });
    state.lastDraws.forEach((id, seat) => { this.lastDraws[seat] = id ?? undefined; });
  }

  getState(): EndlessRosterState {
    return { randomState: this.randomState, bags: this.bags.map((bag) => [...bag]), lastDraws: [...this.lastDraws] };
  }

  private random(): number {
    this.randomState = (this.randomState + 0x6d2b79f5) >>> 0;
    let value = this.randomState;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  }
}

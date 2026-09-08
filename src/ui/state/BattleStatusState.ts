import type { BattleIconId } from '../art';

export type BattleStatusKind = 'buff' | 'debuff' | 'charge' | 'neutral';
export type BattleStatusTransition = 'none' | 'added' | 'stacked' | 'removed';

export type BattleStatusId =
  | 'attack-bonus'
  | 'incoming-damage'
  | 'holy-shield'
  | 'iaijutsu'
  | 'hanami-fan'
  | 'smoke-evasion'
  | 'taoist-talisman';

export interface BattleStatusState {
  id: BattleStatusId;
  kind: BattleStatusKind;
  iconArtId: BattleIconId;
  fallbackIcon: string;
  color: number;
  textColor: string;
  title: string;
  description: string;
  stacks: number;
  priority: number;
  transition: BattleStatusTransition;
  iconSize?: number;
}

interface BattleStatusDefinition {
  kind: BattleStatusKind;
  iconArtId: BattleIconId;
  fallbackIcon: string;
  color: number;
  textColor: string;
  priority: number;
  iconSize?: number;
}

const STATUS_DEFINITIONS: Record<BattleStatusId, BattleStatusDefinition> = {
  'attack-bonus': {
    kind: 'buff',
    iconArtId: 'status-attack-bonus',
    fallbackIcon: '+',
    color: 0xd9af60,
    textColor: '#f4d58a',
    priority: 60,
  },
  'incoming-damage': {
    kind: 'debuff',
    iconArtId: 'status-incoming-damage',
    fallbackIcon: '!',
    color: 0xc9565d,
    textColor: '#ffadb2',
    priority: 100,
  },
  'holy-shield': {
    kind: 'buff',
    iconArtId: 'status-holy-shield',
    fallbackIcon: '◆',
    color: 0xd6a84f,
    textColor: '#ffe29a',
    priority: 95,
  },
  iaijutsu: {
    kind: 'charge',
    iconArtId: 'status-iaijutsu',
    fallbackIcon: '刀',
    color: 0xb94d64,
    textColor: '#efacb9',
    priority: 75,
  },
  'hanami-fan': {
    kind: 'buff',
    iconArtId: 'status-hanami-fan',
    fallbackIcon: '扇',
    color: 0xd6788f,
    textColor: '#ffc2d1',
    priority: 70,
  },
  'smoke-evasion': {
    kind: 'buff',
    iconArtId: 'status-smoke-evasion',
    fallbackIcon: '影',
    color: 0x8e78bb,
    textColor: '#d8cbff',
    priority: 90,
  },
  'taoist-talisman': {
    kind: 'buff',
    iconArtId: 'heavenly-insight',
    fallbackIcon: '符',
    color: 0x72d8b3,
    textColor: '#92f0cc',
    priority: 80,
    iconSize: 34,
  },
};

export function createBattleStatusState(
  id: BattleStatusId,
  options: { title: string; description: string; stacks?: number },
): BattleStatusState {
  const definition = STATUS_DEFINITIONS[id];
  return {
    id,
    ...definition,
    title: options.title,
    description: options.description,
    stacks: Math.max(1, Math.floor(options.stacks ?? 1)),
    transition: 'none',
  };
}

export function reconcileBattleStatusStates(
  previous: ReadonlyMap<BattleStatusId, BattleStatusState> | undefined,
  current: BattleStatusState[],
): BattleStatusState[] {
  const currentById = new Map(current.map((status) => [status.id, status]));
  const reconciled: BattleStatusState[] = current.map((status) => {
    const oldStatus = previous?.get(status.id);
    const transition: BattleStatusTransition = !oldStatus
      ? 'added'
      : (oldStatus.stacks !== status.stacks ? 'stacked' : 'none');
    return { ...status, transition };
  });

  previous?.forEach((status, id) => {
    if (!currentById.has(id)) {
      reconciled.push({ ...status, transition: 'removed' });
    }
  });

  return reconciled.sort((left, right) => right.priority - left.priority);
}

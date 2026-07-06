import { EnemyType } from '../enemy';

export type {
  BattleOutcome,
  BattlePhase,
  BattleResult,
  PlayerState,
  SkillResult,
} from '../battle';

export type BattleAction =
  | { type: 'choose-view-hand' }
  | { type: 'choose-fate' }
  | { type: 'invite-current-enemy' }
  | { type: 'compare-current-enemy' }
  | { type: 'player-draw' }
  | { type: 'player-stand' }
  | { type: 'next-round' }
  | { type: 'reveal-by-item' }
  | { type: 'use-skill'; skill: 'resonance-shift' | 'resonance-summon' }
  | { type: 'debug-set-current-enemy'; enemyId: EnemyType };

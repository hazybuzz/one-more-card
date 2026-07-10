import type { Card } from '../card';
import type { EnemyType } from '../enemy';
import type { BattleOutcome, BattlePhase } from '../types/battle';
import type { BattleActionId, LevelConfig } from '../types/level';
import type { ResonanceKind, ScoreResult } from '../scoring';

export interface BattlePlayerState {
  hp: number;
  maxHp: number;
  hand: Card[];
  fateMode: boolean;
  drawCountThisRound: number;
  resonanceShiftUsed: boolean;
  resonanceSummonUsed: boolean;
  resonanceShiftCooldown: number;
  resonanceSummonCooldown: number;
  canUseResonanceShift: boolean;
  canUseResonanceSummon: boolean;
  drawLocked: boolean;
  incomingDamageBonus: number;
  soulRedeemUsed: boolean;
  score: ScoreResult;
}

export interface BattleEnemyState {
  id: EnemyType;
  hp: number;
  maxHp: number;
  hand: Card[];
  revealed: boolean;
  compared: boolean;
  invited?: boolean;
  acceptedInvite?: boolean;
  invitedDrawCount?: 1 | 2;
  passiveTriggeredThisRound: boolean;
  defeated: boolean;
  score: ScoreResult;
}

export interface BattleResultState {
  enemyId: EnemyType;
  enemyScore: ScoreResult;
  playerScore: ScoreResult;
  outcome: 'win' | 'lose' | 'draw';
  damage: number;
}

export interface BattleState {
  levelId?: string;
  levelConfig?: LevelConfig;
  levelIntroLessonKey?: string;
  phase: BattlePhase;
  battleOutcome: BattleOutcome;
  currentEnemyIndex: number;
  currentEnemyId?: EnemyType;
  round: number;
  currentFixedRoundId?: string;
  currentLessonKey?: string;
  currentTutorialBeforeCompareKey?: string;
  currentPlayerTurnLessonKey?: string;
  availableActions?: BattleActionId[];
  maxPlayerDrawsThisRound: number;
  roundRevealed: boolean;
  pendingSoulRedeem: boolean;
  player: BattlePlayerState;
  enemies: BattleEnemyState[];
  aliveEnemyIds: EnemyType[];
  results: BattleResultState[];
  logs: string[];
}

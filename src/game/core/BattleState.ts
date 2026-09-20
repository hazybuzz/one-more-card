import type { EndlessEndReason } from '../endless/EndlessSettlement';
import type { EndlessBattleAccounting } from '../endless/EndlessLedger';
import type { EndlessRosterState } from '../endless/EndlessRoster';
import type { TableThemeId } from '../types/tableTheme';
import type { Card } from '../card';
import type { EnemyType } from '../enemy';
import type { BattleOutcome, BattlePhase } from '../types/battle';
import type { BattleActionId, LevelConfig } from '../types/level';
import type { SkillId } from '../types/skill';
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
  shieldCharges: number;
  soulRedeemUsed: boolean;
  score: ScoreResult;
}

export interface BattleEnemyState {
  instanceId: string;
  seatIndex: number;
  sourceThemeId: TableThemeId;
  id: EnemyType;
  hp: number;
  maxHp: number;
  hand: Card[];
  revealed: boolean;
  compared: boolean;
  invited?: boolean;
  acceptedInvite?: boolean;
  invitedDrawCount?: 1 | 2;
  passiveTriggered: boolean;
  passiveTriggeredThisRound: boolean;
  soulRedeemUsed: boolean;
  defeated: boolean;
  attackBonus: number;
  roundAttackBonus: number;
  taoistTalismaned: boolean;
  talismanSourceInstanceId?: string;
  iaijutsuStacks: number;
  smokeScreenArmed: boolean;
  smokeScreenUsed: boolean;
  hanamiFanTargetId?: EnemyType;
  hanamiFanTargetInstanceId?: string;
  hanamiDamageBank: number;
  summoned: boolean;
  summonCount: number;
  score: ScoreResult;
}

export interface BattleResultState {
  enemyId: EnemyType;
  enemyScore: ScoreResult;
  playerScore: ScoreResult;
  outcome: 'win' | 'lose' | 'draw';
  damage: number;
  evaded?: boolean;
  shielded?: boolean;
  originalDamage?: number;
}

export interface BattleState {
  mode: 'story' | 'formal' | 'endless';
  endlessRoster?: EndlessRosterState;
  endlessAccounting?: EndlessBattleAccounting;
  endlessEndReason?: EndlessEndReason;
  levelId?: string;
  levelConfig?: LevelConfig;
  levelIntroLessonKey?: string;
  phase: BattlePhase;
  battleOutcome: BattleOutcome;
  currentEnemyIndex: number;
  currentEnemyId?: EnemyType;
  currentEnemyInstanceId?: string;
  round: number;
  currentFixedRoundId?: string;
  currentLessonKey?: string;
  currentTutorialBeforeCompareKey?: string;
  currentPlayerTurnLessonKey?: string;
  availableActions?: BattleActionId[];
  availableSkills?: SkillId[];
  maxPlayerDrawsThisRound: number;
  roundRevealed: boolean;
  pendingSoulRedeem: boolean;
  pendingEnemySoulRedeem?: EnemyType;
  player: BattlePlayerState;
  enemies: BattleEnemyState[];
  aliveEnemyIds: EnemyType[];
  results: BattleResultState[];
  logs: string[];
}

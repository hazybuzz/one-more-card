import type { CardCode } from './card';
import type { DialogueLine, TutorialTip } from './dialogue';
import type { EnemyId } from './enemy';
import type { ItemId } from './item';
import type { SkillId } from './skill';

export type BattleMechanicId =
  | 'invite'
  | 'compare'
  | 'player_draw'
  | 'resonance'
  | 'skills'
  | 'items'
  | 'soul_redeem'
  | 'enemy_passives'
  | 'boss';

export type BattleActionId =
  | 'view_hand'
  | 'invite'
  | 'compare'
  | 'player_draw'
  | 'reveal'
  | 'use_skill'
  | 'use_item';

export interface RewardConfig {
  soulCoins?: number;
  items?: Partial<Record<ItemId, number>>;
  unlockSkills?: SkillId[];
}

export interface BossConfig {
  enemyId: EnemyId;
  phaseHpThresholds?: number[];
  dialogueKey?: string;
}

export interface FixedRoundEnemyConfig {
  enemyId: EnemyId;
  cards: CardCode[];
  visibleCards?: CardCode[];
  scriptedInviteResult?: 'accept' | 'reject';
  scriptedInviteReasonKey?: string;
  drawCardOnAccept?: CardCode;
  inviteDialogueKeys?: string[];
  compareWithoutInviteDialogueKeys?: string[];
}

export interface FixedRoundConfig {
  id: string;
  playerCards: CardCode[];
  playerDrawCards?: CardCode[];
  maxPlayerDraws?: number;
  playerTurnLessonKey?: string;
  enemies: FixedRoundEnemyConfig[];
  availableActions?: BattleActionId[];
  preferredAction?: BattleActionId;
  triggerDialogue?: Record<string, DialogueLine[]>;
  wrongChoiceHintKey?: string;
  lessonKey?: string;
  tutorialBeforeCompareKey?: string;
  revealSummaryKeys?: string[];
  afterRevealDialogueKeys?: string[];
}

export interface LevelConfig {
  id: string;
  chapterId: string;
  titleKey: string;
  subtitleKey?: string;
  enemyIds: EnemyId[];
  playerHp: number;
  enemyHpOverrides?: Partial<Record<EnemyId, number>>;
  maxPlayerDrawsPerRound?: number;
  unlockedMechanics: BattleMechanicId[];
  levelIntroLessonKey?: string;
  fixedRounds?: FixedRoundConfig[];
  useRandomAfterFixedRounds?: boolean;
  introDialogue?: DialogueLine[];
  victoryDialogue?: DialogueLine[];
  defeatDialogue?: DialogueLine[];
  tutorialTips?: TutorialTip[];
  rewards?: RewardConfig[];
  bossConfig?: BossConfig;
}

export interface ChapterConfig {
  id: string;
  titleKey: string;
  subtitleKey?: string;
  levels: LevelConfig[];
}

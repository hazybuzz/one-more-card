import type { CardCode } from './card';
import type { DialogueLine, TutorialTip } from './dialogue';
import type { EnemyId } from './enemy';
import type { ItemId } from './item';
import type { SkillId } from './skill';

export type BattleMechanicId =
  | 'invite'
  | 'compare'
  | 'player_draw'
  | 'heat'
  | 'resonance'
  | 'skills'
  | 'items'
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
  drawCardOnAccept?: CardCode;
}

export interface FixedRoundConfig {
  id: string;
  playerCards: CardCode[];
  enemies: FixedRoundEnemyConfig[];
  availableActions?: BattleActionId[];
  preferredAction?: BattleActionId;
  triggerDialogue?: Record<string, DialogueLine[]>;
  wrongChoiceHintKey?: string;
  lessonKey?: string;
}

export interface LevelConfig {
  id: string;
  chapterId: string;
  titleKey: string;
  subtitleKey?: string;
  enemyIds: EnemyId[];
  playerHp: number;
  enemyHpOverrides?: Partial<Record<EnemyId, number>>;
  unlockedMechanics: BattleMechanicId[];
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

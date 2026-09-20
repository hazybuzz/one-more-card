import type { TableThemeId } from '../types/tableTheme';
import { Card } from '../card';
import type { EnemySpeechIntent } from '../data/enemySpeech';
import { EnemyType } from '../enemy';
import { ResonanceKind } from '../scoring';

export type BattlePresentationEvent =
  | { type: 'enemy-entered'; enemyId: EnemyType; enemyInstanceId: string; enemyIndex: number; sourceThemeId: TableThemeId }
  | { type: 'card-dealt'; target: 'player' | EnemyType; card: Card; cardIndex: number; context: 'round-start' | 'action' }
  | { type: 'enemy-speech'; enemyId: EnemyType; intent: EnemySpeechIntent }
  | {
    type: 'passive-effect';
    passiveId:
      | 'war_horn'
      | 'rune_blessing'
      | 'einherjar_summon'
      | 'goblin_instinct'
      | 'gambler_blessing'
      | 'werewolf_lifesteal'
      | 'chivalry'
      | 'red_silk_toast'
      | 'heavenly_insight'
      | 'iaijutsu_charge'
      | 'smoke_substitution'
      | 'hanami_dance';
    sourceEnemyId: EnemyType;
    sourceEnemyInstanceId?: string;
    sourceEnemyIndex: number;
    targetEnemyIds: EnemyType[];
    targetEnemyInstanceIds?: string[];
    targetEnemyIndexes: number[];
    effect:
      | 'attack'
      | 'heal'
      | 'summon'
      | 'sense'
      | 'reroll'
      | 'reduce_damage'
      | 'charge'
      | 'release'
      | 'arm'
      | 'evade'
      | 'mark'
      | 'reward_attack'
      | 'reward_heal';
    amount?: number;
    timing?: 'round-start' | 'combat';
  }
  | { type: 'cards-redealt'; target: EnemyType; targetEnemyIndex: number; targetEnemyInstanceId?: string; count: number }
  | {
    type: 'card-replaced';
    targetEnemyInstanceId?: string;
    target: EnemyType;
    targetEnemyIndex: number;
    cardIndex: number;
    previousCard: Card;
    replacementCard: Card;
  }
  | {
    type: 'damage';
    attacker: 'player' | 'enemy';
    enemyId: EnemyType;
    enemyInstanceId?: string;
    amount: number;
    resonance?: ResonanceKind;
    hpAfter?: number;
    evaded?: boolean;
    shielded?: boolean;
    originalAmount?: number;
    iaijutsuBonus?: number;
    killRewardHeal?: number;
    guard?: {
      protectorEnemyId: EnemyType;
      protectorEnemyInstanceId?: string;
      protectorEnemyIndex: number;
      protectorHpAfter: number;
      preventedDamage: number;
      legacyAttackBonus?: number;
      killRewardHeal?: number;
    };
  }
  | { type: 'clash'; enemyId: EnemyType; enemyInstanceId?: string; amount: number }
  | { type: 'heal'; target: 'player' | EnemyType; amount: number }
  | { type: 'round-revealed'; round: number }
  | { type: 'round-ended'; round: number }
  | { type: 'battle-ended'; outcome: 'victory' | 'defeat' };

export type BattleCombatPresentationEvent = Extract<BattlePresentationEvent, { type: 'damage' | 'clash' }>;

import { Card } from '../card';
import { EnemyType } from '../enemy';
import { ResonanceKind } from '../scoring';

export type BattlePresentationEvent =
  | { type: 'card-dealt'; target: 'player' | EnemyType; card: Card; cardIndex: number; context: 'round-start' | 'action' }
  | { type: 'enemy-speech'; enemyId: EnemyType; text: string }
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
    sourceEnemyIndex: number;
    targetEnemyIds: EnemyType[];
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
  | { type: 'cards-redealt'; target: EnemyType; targetEnemyIndex: number; count: number }
  | {
    type: 'card-replaced';
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
    amount: number;
    resonance?: ResonanceKind;
    hpAfter?: number;
    evaded?: boolean;
    shielded?: boolean;
    originalAmount?: number;
    guard?: {
      protectorEnemyId: EnemyType;
      protectorEnemyIndex: number;
      protectorHpAfter: number;
      preventedDamage: number;
      legacyAttackBonus?: number;
    };
  }
  | { type: 'clash'; enemyId: EnemyType; amount: number }
  | { type: 'heal'; target: 'player' | EnemyType; amount: number }
  | { type: 'round-revealed'; round: number }
  | { type: 'round-ended'; round: number }
  | { type: 'battle-ended'; outcome: 'victory' | 'defeat' };

export type BattleCombatPresentationEvent = Extract<BattlePresentationEvent, { type: 'damage' | 'clash' }>;

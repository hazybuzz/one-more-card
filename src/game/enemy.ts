import { Card, isJoker } from './card';
import { ENEMY_CONFIGS, ENEMY_LIST } from './data/enemies';
import { t } from './i18n';
import { scoreHand } from './scoring';
import type { EnemyConfig, EnemyId } from './types/enemy';
import type { LevelConfig } from './types/level';

export type EnemyType = EnemyId;

export type EnemyDefinition = Pick<EnemyConfig, 'id' | 'maxHp'>;

export interface EnemyState extends EnemyDefinition {
  hp: number;
  hand: Card[];
  revealed: boolean;
  compared: boolean;
  invited?: boolean;
  acceptedInvite?: boolean;
  invitedDrawCount?: 1 | 2;
  passiveTriggeredThisRound: boolean;
  soulRedeemUsed: boolean;
  defeated: boolean;
}

export interface EnemyDecision {
  accepts: boolean;
  reason: string;
}

export const ENEMIES: EnemyDefinition[] = ENEMY_LIST.map(({ id, maxHp }) => ({ id, maxHp }));

export function createEnemies(): EnemyState[] {
  return createEnemiesForLevel();
}

export function createEnemiesForLevel(level?: LevelConfig): EnemyState[] {
  const enemyIds = level?.enemyIds ?? ENEMIES.map((enemy) => enemy.id);
  return enemyIds.map((enemyId) => {
    const enemyConfig = ENEMY_CONFIGS[enemyId];
    const baseEnemy = enemyConfig ? { id: enemyConfig.id, maxHp: enemyConfig.maxHp } : undefined;
    if (!baseEnemy) {
      throw new Error(`Unknown enemy id: ${enemyId}`);
    }

    const maxHp = level?.enemyHpOverrides?.[enemyId] ?? baseEnemy.maxHp;
    return {
      ...baseEnemy,
      maxHp,
      hp: maxHp,
      hand: [],
      revealed: false,
      compared: false,
      passiveTriggeredThisRound: false,
      soulRedeemUsed: false,
      defeated: false,
    };
  });
}

export function decideInvite(enemy: EnemyState, playerPoint?: number): EnemyDecision {
  const point = scoreHand(enemy.hand).point;

  if (enemy.id === 'goblin') {
    if (enemy.hp < 3 && playerPoint !== undefined) {
      if (point >= playerPoint) {
        return chance(0.08, t('enemy.ai.goblin.peekSafe'));
      }

      return chance(0.74, t('enemy.ai.goblin.peekBehind'));
    }

    if (point >= 7) {
      return chance(0.12, t('enemy.ai.goblin.high'));
    }

    if (point >= 5) {
      return chance(0.32, t('enemy.ai.goblin.mid'));
    }

    return chance(0.58, t('enemy.ai.goblin.low'));
  }

  if (enemy.id === 'gambler') {
    if (point >= 9) {
      return chance(0.42, t('enemy.ai.gambler.high'));
    }

    if (point >= 6) {
      return chance(0.68, t('enemy.ai.gambler.mid'));
    }

    return chance(0.84, t('enemy.ai.gambler.low'));
  }

  if (enemy.id === 'paladin') {
    if (point >= 8) {
      return chance(0.18, t('enemy.ai.paladin.high'));
    }

    if (point >= 5) {
      return chance(0.42, t('enemy.ai.paladin.mid'));
    }

    return chance(0.64, t('enemy.ai.paladin.low'));
  }

  if (enemy.id === 'merchant') {
    if (point >= 8) {
      return chance(0.22, t('enemy.ai.merchant.high'));
    }

    if (point >= 5) {
      return chance(0.5, t('enemy.ai.merchant.mid'));
    }

    return chance(0.66, t('enemy.ai.merchant.low'));
  }

  if (enemy.id === 'keeper') {
    if (point >= 8) {
      return chance(0.08, t('enemy.ai.keeper.high'));
    }

    if (point >= 7) {
      return chance(0.22, t('enemy.ai.keeper.seven'));
    }

    if (point >= 5) {
      return chance(0.42, t('enemy.ai.keeper.mid'));
    }

    return chance(0.68, t('enemy.ai.keeper.low'));
  }

  const resonanceChance = hasResonanceOpportunity(enemy);
  if (resonanceChance) {
    return chance(0.7, t('enemy.ai.werewolf.resonance'));
  }

  if (point >= 8) {
    return chance(0.28, t('enemy.ai.werewolf.high'));
  }

  if (point >= 6) {
    return chance(0.48, t('enemy.ai.werewolf.mid'));
  }

  return chance(0.68, t('enemy.ai.werewolf.low'));
}

function chance(probability: number, reason: string): EnemyDecision {
  return {
    accepts: Math.random() < probability,
    reason,
  };
}

function hasResonanceOpportunity(enemy: EnemyState): boolean {
  if (enemy.hand.length < 2) {
    return false;
  }

  const nonJokers = enemy.hand.filter((card) => !isJoker(card));
  const sameSuitWithJokers = nonJokers.length === 0 || nonJokers.every((card) => card.suit === nonJokers[0].suit);
  const sameRank = enemy.hand.every((card) => !isJoker(card) && card.rank === enemy.hand[0].rank);
  return sameSuitWithJokers || sameRank;
}

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
      defeated: false,
    };
  });
}

export function decideInvite(enemy: EnemyState, heat: number, playerPoint?: number): EnemyDecision {
  const point = scoreHand(enemy.hand).point;
  const heatBonus = heat <= 2 ? 0 : heat <= 5 ? 0.18 : 0.34;

  if (enemy.id === 'goblin') {
    if (enemy.hp < 3 && playerPoint !== undefined) {
      if (point >= playerPoint) {
        return chance(clamp(0.08 + heatBonus * 0.5), t('enemy.ai.goblin.peekSafe'));
      }

      return chance(clamp(0.74 + heatBonus), t('enemy.ai.goblin.peekBehind'));
    }

    if (point >= 7) {
      return chance(clamp(0.12 + heatBonus), t('enemy.ai.goblin.high'));
    }

    if (point >= 5) {
      return chance(clamp(0.32 + heatBonus), t('enemy.ai.goblin.mid'));
    }

    return chance(clamp(0.58 + heatBonus), t('enemy.ai.goblin.low'));
  }

  if (enemy.id === 'gambler') {
    if (point >= 9) {
      return chance(clamp(0.42 + heatBonus), t('enemy.ai.gambler.high'));
    }

    if (point >= 6) {
      return chance(clamp(0.68 + heatBonus), t('enemy.ai.gambler.mid'));
    }

    return chance(clamp(0.84 + heatBonus), t('enemy.ai.gambler.low'));
  }

  const resonanceChance = hasResonanceOpportunity(enemy);
  if (resonanceChance) {
    return chance(clamp(0.7 + heatBonus), t('enemy.ai.werewolf.resonance'));
  }

  if (point >= 8) {
    return chance(clamp(0.28 + heatBonus), t('enemy.ai.werewolf.high'));
  }

  if (point >= 6) {
    return chance(clamp(0.48 + heatBonus), t('enemy.ai.werewolf.mid'));
  }

  return chance(clamp(0.68 + heatBonus), t('enemy.ai.werewolf.low'));
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

function clamp(value: number): number {
  return Math.max(0.05, Math.min(0.95, value));
}

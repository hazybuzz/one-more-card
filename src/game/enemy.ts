import { getNpcSourceTheme } from './data/npcOrigins';
import { Card, isJoker } from './card';
import { ENEMY_CONFIGS, ENEMY_LIST } from './data/enemies';
import { t } from './i18n';
import { scoreHand } from './scoring';
import type { EnemyConfig, EnemyId } from './types/enemy';
import type { LevelConfig } from './types/level';
import type { TableThemeConfig, TableThemeId } from './types/tableTheme';

export type EnemyType = EnemyId;

export type EnemyDefinition = Pick<EnemyConfig, 'id' | 'maxHp'>;

export interface EnemyState extends EnemyDefinition {
  instanceId: string;
  seatIndex: number;
  sourceThemeId: TableThemeId;
  hp: number;
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
  hanamiFanTargetId?: EnemyId;
  hanamiFanTargetInstanceId?: string;
  hanamiDamageBank: number;
  summoned: boolean;
  summonCount: number;
}

export interface EnemyDecision {
  accepts: boolean;
  reason: string;
}

export const ENEMIES: EnemyDefinition[] = ENEMY_LIST.map(({ id, maxHp }) => ({ id, maxHp }));

export function createEnemyInstancePrefix(): string {
  return globalThis.crypto?.randomUUID?.() ?? `battle-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createEnemies(): EnemyState[] {
  return createEnemiesForLevel();
}

export function createEnemiesForLevel(
  level?: LevelConfig,
  tableTheme?: TableThemeConfig,
  enemyHpModifier = 0,
  instancePrefix: string = createEnemyInstancePrefix(),
): EnemyState[] {
  const enemyIds = level?.enemyIds ?? tableTheme?.enemyIds ?? ENEMIES.map((enemy) => enemy.id);
  return enemyIds.map((enemyId, index) => {
    const baseHp = ENEMY_CONFIGS[enemyId]?.maxHp;
    if (baseHp === undefined) throw new Error(`Unknown enemy id: ${enemyId}`);
    const adjustedHp = tableTheme && enemyId !== 'einherjar' ? Math.max(1, baseHp + enemyHpModifier) : baseHp;
    return createEnemyState(enemyId, {
      instanceId: `${instancePrefix}:${index + 1}`, seatIndex: index,
      maxHp: level?.enemyHpOverrides?.[enemyId] ?? adjustedHp,
    });
  });
}

/** Shared fresh-state factory for initial rosters, summons and later endless replacements. */
export function createEnemyState(enemyId: EnemyId, options: {
  instanceId: string; seatIndex: number; maxHp?: number; hpModifier?: number; summoned?: boolean;
}): EnemyState {
  const config = ENEMY_CONFIGS[enemyId];
  if (!config) throw new Error(`Unknown enemy id: ${enemyId}`);
  const maxHp = options.maxHp ?? Math.max(1, config.maxHp + (enemyId === 'einherjar' ? 0 : options.hpModifier ?? 0));
  return {
    id: enemyId, instanceId: options.instanceId, seatIndex: options.seatIndex,
    sourceThemeId: getNpcSourceTheme(enemyId), maxHp, hp: maxHp, hand: [],
    revealed: false, compared: false, passiveTriggered: false, passiveTriggeredThisRound: false,
    soulRedeemUsed: false, defeated: false, attackBonus: 0, roundAttackBonus: 0,
    taoistTalismaned: false, talismanSourceInstanceId: undefined, iaijutsuStacks: 0,
    smokeScreenArmed: false, smokeScreenUsed: false, hanamiFanTargetId: undefined,
    hanamiFanTargetInstanceId: undefined, hanamiDamageBank: 0,
    summoned: options.summoned ?? false, summonCount: 0,
  };
}

export function decideInvite(enemy: EnemyState, playerPoint?: number, passiveHpThreshold = 3, random: () => number = Math.random): EnemyDecision {
  const chance = (probability: number, reason: string): EnemyDecision => ({ accepts: random() < probability, reason });
  const point = scoreHand(enemy.hand).point;

  if (enemy.id === 'goblin') {
    if (enemy.hp < passiveHpThreshold && playerPoint !== undefined) {
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

  if (enemy.id === 'viking_warrior') {
    if (point >= 9) {
      return chance(0.46, t('enemy.ai.viking.high'));
    }

    if (point >= 6) {
      return chance(0.72, t('enemy.ai.viking.mid'));
    }

    return chance(0.88, t('enemy.ai.viking.low'));
  }

  if (enemy.id === 'rune_shaman') {
    if (point >= 7) {
      return chance(0.14, t('enemy.ai.runeShaman.high'));
    }

    if (point >= 5) {
      return chance(0.28, t('enemy.ai.runeShaman.mid'));
    }

    return chance(0.5, t('enemy.ai.runeShaman.low'));
  }

  if (enemy.id === 'valkyrie') {
    if (point >= 8) {
      return chance(0.26, t('enemy.ai.valkyrie.high'));
    }

    if (point >= 6) {
      return chance(0.5, t('enemy.ai.valkyrie.mid'));
    }

    return chance(0.66, t('enemy.ai.valkyrie.low'));
  }

  if (enemy.id === 'swordsman') {
    if (point >= 9) {
      return chance(0.38, t('enemy.ai.swordsman.high'));
    }

    if (point >= 6) {
      return chance(0.68, t('enemy.ai.swordsman.mid'));
    }

    return chance(0.84, t('enemy.ai.swordsman.low'));
  }

  if (enemy.id === 'songstress') {
    if (point >= 7) {
      return chance(0.1, t('enemy.ai.songstress.high'));
    }

    if (point >= 5) {
      return chance(0.28, t('enemy.ai.songstress.mid'));
    }

    return chance(0.48, t('enemy.ai.songstress.low'));
  }

  if (enemy.id === 'taoist') {
    if (point >= 8) {
      return chance(0.16, t('enemy.ai.taoist.high'));
    }

    if (point >= 5) {
      return chance(0.46, t('enemy.ai.taoist.mid'));
    }

    return chance(0.66, t('enemy.ai.taoist.low'));
  }

  if (enemy.id === 'shogun_samurai') {
    if (point >= 9) {
      return chance(0.06, t('enemy.ai.samurai.high'));
    }

    if (point >= 7) {
      return chance(0.22, t('enemy.ai.samurai.mid'));
    }

    return chance(0.62, t('enemy.ai.samurai.low'));
  }

  if (enemy.id === 'ninja') {
    if (point >= 7) {
      return chance(0.12, t('enemy.ai.ninja.high'));
    }

    if (point >= 5) {
      return chance(0.3, t('enemy.ai.ninja.mid'));
    }

    return chance(0.54, t('enemy.ai.ninja.low'));
  }

  if (enemy.id === 'oiran') {
    if (point >= 8) {
      return chance(0.18, t('enemy.ai.oiran.high'));
    }

    if (point >= 5) {
      return chance(0.44, t('enemy.ai.oiran.mid'));
    }

    return chance(0.64, t('enemy.ai.oiran.low'));
  }

  if (enemy.id === 'einherjar') {
    if (point >= 8) {
      return chance(0.2, t('enemy.ai.einherjar.high'));
    }

    if (point >= 5) {
      return chance(0.44, t('enemy.ai.einherjar.mid'));
    }

    return chance(0.7, t('enemy.ai.einherjar.low'));
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

function hasResonanceOpportunity(enemy: EnemyState): boolean {
  if (enemy.hand.length < 2) {
    return false;
  }

  const nonJokers = enemy.hand.filter((card) => !isJoker(card));
  const sameSuitWithJokers = nonJokers.length === 0 || nonJokers.every((card) => card.suit === nonJokers[0].suit);
  const sameRank = enemy.hand.every((card) => !isJoker(card) && card.rank === enemy.hand[0].rank);
  return sameSuitWithJokers || sameRank;
}

import type { EnemyConfig, EnemyId } from '../types/enemy';

export const ENEMY_CONFIGS: Record<EnemyId, EnemyConfig> = {
  bartender: {
    id: 'bartender',
    maxHp: 3,
    aiType: 'silent',
    nameKey: 'enemy.bartender.name',
    personalityKey: 'enemy.bartender.personality',
    portraitKey: 'enemy_bartender',
    colorKey: 'bartender',
  },
  goblin: {
    id: 'goblin',
    maxHp: 5,
    aiType: 'cautious',
    passiveId: 'goblin_instinct',
    nameKey: 'enemy.goblin.name',
    personalityKey: 'enemy.goblin.personality',
    portraitKey: 'enemy_goblin',
    colorKey: 'goblin',
  },
  gambler: {
    id: 'gambler',
    maxHp: 7,
    aiType: 'aggressive',
    passiveId: 'gambler_blessing',
    nameKey: 'enemy.gambler.name',
    personalityKey: 'enemy.gambler.personality',
    portraitKey: 'enemy_gambler',
    colorKey: 'gambler',
  },
  werewolf: {
    id: 'werewolf',
    maxHp: 8,
    aiType: 'resonance',
    passiveId: 'werewolf_lifesteal',
    nameKey: 'enemy.werewolf.name',
    personalityKey: 'enemy.werewolf.personality',
    portraitKey: 'enemy_werewolf',
    colorKey: 'werewolf',
  },
};

export const DEFAULT_ENEMY_IDS: EnemyId[] = ['goblin', 'gambler', 'werewolf'];

export const ENEMY_LIST: EnemyConfig[] = DEFAULT_ENEMY_IDS.map((id) => ENEMY_CONFIGS[id]);

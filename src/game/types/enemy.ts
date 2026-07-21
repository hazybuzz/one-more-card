export type EnemyId = 'bartender' | 'goblin' | 'gambler' | 'werewolf' | 'paladin' | 'merchant' | 'keeper';
export type EnemyAIType = 'silent' | 'cautious' | 'aggressive' | 'resonance' | 'fated' | 'merchant' | 'keeper';
export type EnemyPassiveId = 'goblin_instinct' | 'gambler_blessing' | 'werewolf_lifesteal';

export interface EnemyConfig {
  id: EnemyId;
  maxHp: number;
  aiType: EnemyAIType;
  passiveId?: EnemyPassiveId;
  nameKey: string;
  personalityKey: string;
  portraitKey?: string;
  colorKey?: string;
}

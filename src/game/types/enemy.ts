export type EnemyId = 'goblin' | 'gambler' | 'werewolf';
export type EnemyAIType = 'cautious' | 'aggressive' | 'resonance';
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

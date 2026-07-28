export type EnemyId =
  | 'bartender'
  | 'goblin'
  | 'gambler'
  | 'werewolf'
  | 'paladin'
  | 'merchant'
  | 'keeper'
  | 'viking_warrior'
  | 'rune_shaman'
  | 'valkyrie'
  | 'einherjar';
export type EnemyAIType = 'silent' | 'cautious' | 'aggressive' | 'resonance' | 'fated' | 'merchant' | 'keeper' | 'balanced';
export type EnemyPassiveId =
  | 'goblin_instinct'
  | 'gambler_blessing'
  | 'werewolf_lifesteal'
  | 'war_horn'
  | 'rune_blessing'
  | 'einherjar_summon';

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

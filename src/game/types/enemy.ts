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
  | 'einherjar'
  | 'swordsman'
  | 'songstress'
  | 'taoist'
  | 'shogun_samurai'
  | 'ninja'
  | 'oiran';
export type EnemyAIType = 'silent' | 'cautious' | 'aggressive' | 'resonance' | 'fated' | 'merchant' | 'keeper' | 'balanced' | 'disciplined';
export type EnemyPassiveId =
  | 'goblin_instinct'
  | 'gambler_blessing'
  | 'werewolf_lifesteal'
  | 'war_horn'
  | 'rune_blessing'
  | 'einherjar_summon'
  | 'chivalry'
  | 'red_silk_toast'
  | 'heavenly_insight'
  | 'iaijutsu_charge'
  | 'smoke_substitution'
  | 'hanami_dance';

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

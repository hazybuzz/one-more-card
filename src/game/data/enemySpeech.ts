import type { EnemyId } from '../types/enemy';

export type EnemySpeechIntent = 'accept' | 'reject';

type EnemySpeechKeySet = Record<EnemySpeechIntent, readonly string[]>;

const speechKeys = (enemyId: EnemyId): EnemySpeechKeySet => ({
  accept: [0, 1, 2].map((index) => `battle.speech.${enemyId}.accept.${index}`),
  reject: [0, 1, 2].map((index) => `battle.speech.${enemyId}.reject.${index}`),
});

export const ENEMY_SPEECH_KEYS: Record<EnemyId, EnemySpeechKeySet> = {
  bartender: speechKeys('bartender'),
  goblin: speechKeys('goblin'),
  gambler: speechKeys('gambler'),
  werewolf: speechKeys('werewolf'),
  paladin: speechKeys('paladin'),
  merchant: speechKeys('merchant'),
  keeper: speechKeys('keeper'),
  viking_warrior: speechKeys('viking_warrior'),
  rune_shaman: speechKeys('rune_shaman'),
  valkyrie: speechKeys('valkyrie'),
  einherjar: speechKeys('einherjar'),
  swordsman: speechKeys('swordsman'),
  songstress: speechKeys('songstress'),
  taoist: speechKeys('taoist'),
  shogun_samurai: speechKeys('shogun_samurai'),
  ninja: speechKeys('ninja'),
  oiran: speechKeys('oiran'),
};

export function chooseEnemySpeechKey(
  enemyId: EnemyId,
  intent: EnemySpeechIntent,
  previousKey?: string,
  randomValue = Math.random(),
): string {
  const keys = ENEMY_SPEECH_KEYS[enemyId][intent];
  const candidates = previousKey ? keys.filter((key) => key !== previousKey) : [...keys];
  const normalizedRandom = Math.min(0.999999, Math.max(0, randomValue));
  return candidates[Math.floor(normalizedRandom * candidates.length)];
}

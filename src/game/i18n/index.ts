import { en } from './en';
import { Language, TranslationMap, TranslationParams } from './types';
import { zh } from './zh';

const STORAGE_KEY = 'one-more-card-language';

const messages: Record<Language, TranslationMap> = {
  zh,
  en,
};

let currentLanguage: Language = loadLanguage();

export function getLanguage(): Language {
  return currentLanguage;
}

export function setLanguage(language: Language): void {
  currentLanguage = language;
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Local storage can be unavailable in embedded contexts.
  }
}

export function toggleLanguage(): Language {
  const nextLanguage = currentLanguage === 'zh' ? 'en' : 'zh';
  setLanguage(nextLanguage);
  return nextLanguage;
}

export function t(key: string, params: TranslationParams = {}): string {
  const template = messages[currentLanguage][key] ?? messages.zh[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, paramKey: string) => String(params[paramKey] ?? ''));
}

export function enemyName(enemyId: string): string {
  return t(`enemy.${enemyId}.name`);
}

export function enemyPersonality(enemyId: string): string {
  return t(`enemy.${enemyId}.personality`);
}

function loadLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'zh' || saved === 'en') {
      return saved;
    }
  } catch {
    // Default to Chinese if local storage is unavailable.
  }

  return 'zh';
}

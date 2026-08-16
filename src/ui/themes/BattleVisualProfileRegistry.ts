import { isTestMode } from '../../game/runtimeMode';
import type { BattleVisualProfile, BattleVisualProfileId } from './BattleVisualProfile';
import { PROCEDURAL_TAVERN_PROFILE } from './proceduralTavernProfile';

const STORAGE_KEY = 'one-more-card-battle-visual-profile';
const EXPERIMENTAL_VISUAL_PROFILES_ENABLED = false;

const CLASSIC_PROFILE: BattleVisualProfile = {
  id: 'classic',
  labelKey: 'visualProfile.classic',
  renderer: 'classic',
};

const PROFILES: Record<BattleVisualProfileId, BattleVisualProfile> = {
  classic: CLASSIC_PROFILE,
  procedural_tavern_lab: PROCEDURAL_TAVERN_PROFILE,
};

export function getBattleVisualProfile(id: BattleVisualProfileId): BattleVisualProfile {
  return PROFILES[id];
}

export function getSelectedBattleVisualProfileId(): BattleVisualProfileId {
  if (!EXPERIMENTAL_VISUAL_PROFILES_ENABLED || !import.meta.env.DEV || !isTestMode()) {
    return 'classic';
  }

  try {
    return localStorage.getItem(STORAGE_KEY) === 'procedural_tavern_lab'
      ? 'procedural_tavern_lab'
      : 'classic';
  } catch {
    return 'classic';
  }
}

export function getSelectedBattleVisualProfile(): BattleVisualProfile {
  return getBattleVisualProfile(getSelectedBattleVisualProfileId());
}

export function setSelectedBattleVisualProfileId(id: BattleVisualProfileId): void {
  if (!EXPERIMENTAL_VISUAL_PROFILES_ENABLED || !import.meta.env.DEV || !isTestMode()) {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Embedded or private browser contexts may reject persistent storage.
  }
}

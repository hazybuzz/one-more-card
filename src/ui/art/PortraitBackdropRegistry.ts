import type { EnemyId } from '../../game/types/enemy';
import type { TableThemeId } from '../../game/types/tableTheme';
import type { PortraitBackdropConfig } from './types';

export type PortraitCombatantId = 'player' | EnemyId;

const EVERNIGHT_BACKDROPS: Partial<Record<PortraitCombatantId, PortraitBackdropConfig>> = {
  player: {
    id: 'evernight-player-fate',
    baseColor: 0x11141d,
    secondaryColor: 0x272334,
    accentColor: 0xd8b85f,
    motif: 'fate',
    seed: 11,
    rimColor: 0xf0ce73,
    rimStrength: 0.65,
  },
  goblin: {
    id: 'evernight-goblin-coins',
    baseColor: 0x13170f,
    secondaryColor: 0x29301c,
    accentColor: 0xa88b43,
    motif: 'coins',
    seed: 23,
    rimColor: 0x9db76a,
    rimStrength: 0.42,
  },
  gambler: {
    id: 'evernight-gambler-cards',
    baseColor: 0x1b1013,
    secondaryColor: 0x3c1c22,
    accentColor: 0xb84f4c,
    motif: 'cards',
    seed: 37,
    rimColor: 0xd47767,
    rimStrength: 0.5,
  },
  werewolf: {
    id: 'evernight-werewolf-moon',
    baseColor: 0x101820,
    secondaryColor: 0x243746,
    accentColor: 0x8eb7d2,
    motif: 'moon',
    seed: 53,
    rimColor: 0x8eb7d2,
    rimStrength: 0.82,
  },
};

const EVERNIGHT_STORY_BACKDROP: PortraitBackdropConfig = {
  id: 'evernight-story-tavern',
  baseColor: 0x151311,
  secondaryColor: 0x30251d,
  accentColor: 0x8c7049,
  motif: 'tavern',
  seed: 71,
  rimColor: 0xb99a67,
  rimStrength: 0.36,
};

export function getPortraitBackdrop(
  themeId: TableThemeId,
  combatantId: PortraitCombatantId,
): PortraitBackdropConfig | undefined {
  if (themeId !== 'evernight_tavern') {
    return undefined;
  }

  return EVERNIGHT_BACKDROPS[combatantId] ?? EVERNIGHT_STORY_BACKDROP;
}

import type { EnemyId } from '../../game/types/enemy';
import type { TableThemeId } from '../../game/types/tableTheme';
import { DRAGON_GATE_PALETTE } from './dragonGateArt';
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

const NORTHERN_LONGHOUSE_BACKDROPS: Partial<Record<PortraitCombatantId, PortraitBackdropConfig>> = {
  player: {
    id: 'northern-player-fate',
    baseColor: 0x101722,
    secondaryColor: 0x26364a,
    accentColor: 0xe0bd62,
    motif: 'fate',
    seed: 89,
    rimColor: 0xf1d98a,
    rimStrength: 0.62,
  },
  viking_warrior: {
    id: 'northern-viking-ember',
    baseColor: 0x1d1112,
    secondaryColor: 0x4a2020,
    accentColor: 0xdc583d,
    motif: 'cards',
    seed: 101,
    rimColor: 0xf07b55,
    rimStrength: 0.66,
  },
  rune_shaman: {
    id: 'northern-shaman-runes',
    baseColor: 0x0d1b18,
    secondaryColor: 0x1e4338,
    accentColor: 0x84dfb2,
    motif: 'tavern',
    seed: 113,
    rimColor: 0xc2f4da,
    rimStrength: 0.58,
  },
  valkyrie: {
    id: 'northern-valkyrie-frost',
    baseColor: 0x0e1824,
    secondaryColor: 0x254c68,
    accentColor: 0x79cbea,
    motif: 'moon',
    seed: 127,
    rimColor: 0xc8efff,
    rimStrength: 0.72,
  },
  einherjar: {
    id: 'northern-einherjar-spirit',
    baseColor: 0x0b1722,
    secondaryColor: 0x1d4961,
    accentColor: 0x69d8ef,
    motif: 'moon',
    seed: 139,
    rimColor: 0xc9f7ff,
    rimStrength: 0.78,
  },
};

const DRAGON_GATE_BACKDROPS: Partial<Record<PortraitCombatantId, PortraitBackdropConfig>> = {
  player: {
    id: 'dragon-gate-player-fate-stone',
    baseColor: DRAGON_GATE_PALETTE.ink,
    secondaryColor: 0x352422,
    accentColor: DRAGON_GATE_PALETTE.oldGold,
    motif: 'fate',
    seed: 151,
    rimColor: DRAGON_GATE_PALETTE.parchment,
    rimStrength: 0.62,
  },
  swordsman: {
    id: 'dragon-gate-swordsman-sword-aura',
    baseColor: DRAGON_GATE_PALETTE.ink,
    secondaryColor: DRAGON_GATE_PALETTE.lacquer,
    accentColor: DRAGON_GATE_PALETTE.deepRed,
    motif: 'cards',
    seed: 163,
    rimColor: 0xd05a4f,
    rimStrength: 0.68,
  },
  songstress: {
    id: 'dragon-gate-songstress-silk-dance',
    baseColor: 0x211016,
    secondaryColor: 0x542333,
    accentColor: DRAGON_GATE_PALETTE.silkRose,
    motif: 'tavern',
    seed: 179,
    rimColor: 0xf0a4b2,
    rimStrength: 0.58,
  },
  taoist: {
    id: 'dragon-gate-taoist-jade-trigram',
    baseColor: 0x0b1816,
    secondaryColor: 0x183b35,
    accentColor: DRAGON_GATE_PALETTE.jade,
    motif: 'moon',
    seed: 193,
    rimColor: 0xa2dfcc,
    rimStrength: 0.6,
  },
};

export function getPortraitBackdrop(
  themeId: TableThemeId,
  combatantId: PortraitCombatantId,
): PortraitBackdropConfig | undefined {
  if (themeId === 'evernight_tavern') {
    return EVERNIGHT_BACKDROPS[combatantId] ?? EVERNIGHT_STORY_BACKDROP;
  }

  if (themeId === 'northern_longhouse') {
    return NORTHERN_LONGHOUSE_BACKDROPS[combatantId];
  }

  if (themeId === 'dragon_gate') {
    return DRAGON_GATE_BACKDROPS[combatantId];
  }

  return undefined;
}

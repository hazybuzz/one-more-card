import type { EnemyId } from '../../game/types/enemy';
import type { TableThemeId } from '../../game/types/tableTheme';
import type { BattleThemeArtManifest, CharacterArtConfig } from './types';

export const PLAYER_CHARACTER_ART: CharacterArtConfig = {
  id: 'fateweaver',
  asset: {
    kind: 'spritesheet',
    textureKey: 'player-fateweaver',
    path: '/image/user/user1/all.png',
    frameWidth: 128,
    frameHeight: 128,
    pixelArt: true,
  },
  frames: {
    idle: 0,
    cast: 1,
    attack: 2,
    hurt: 3,
  },
  displayWidth: 128,
  displayHeight: 128,
};

const ENEMY_CHARACTER_ART: Partial<Record<EnemyId, CharacterArtConfig>> = {
  goblin: {
    id: 'goblin',
    asset: {
      kind: 'spritesheet',
      textureKey: 'enemy-goblin-portrait',
      path: '/image/npc/goblin/all.png',
      frameWidth: 128,
      frameHeight: 128,
      pixelArt: true,
    },
    frames: {
      idle: 0,
      cast: 1,
      attack: 2,
      hurt: 3,
    },
    displayWidth: 120,
    displayHeight: 120,
  },
  gambler: {
    id: 'gambler',
    asset: {
      kind: 'spritesheet',
      textureKey: 'enemy-gambler-portrait',
      path: '/image/npc/gambler/all.png',
      frameWidth: 128,
      frameHeight: 128,
      pixelArt: true,
    },
    frames: {
      idle: 0,
      cast: 1,
      attack: 2,
      hurt: 3,
    },
    displayWidth: 120,
    displayHeight: 120,
  },
  werewolf: {
    id: 'werewolf',
    asset: {
      kind: 'spritesheet',
      textureKey: 'enemy-werewolf-portrait',
      path: '/image/npc/werewolf/all.png',
      frameWidth: 128,
      frameHeight: 128,
      pixelArt: true,
    },
    frames: {
      idle: 0,
      cast: 1,
      attack: 2,
      hurt: 3,
    },
    displayWidth: 120,
    displayHeight: 120,
  },
  viking_warrior: {
    id: 'viking-warrior',
    asset: {
      kind: 'spritesheet',
      textureKey: 'enemy-viking-warrior-portrait',
      path: '/image/npc/vk-warrior/all.png',
      frameWidth: 128,
      frameHeight: 128,
      pixelArt: true,
    },
    frames: {
      idle: 0,
      cast: 1,
      attack: 2,
      hurt: 3,
    },
    displayWidth: 126,
    displayHeight: 126,
  },
  rune_shaman: {
    id: 'rune-shaman',
    asset: {
      kind: 'spritesheet',
      textureKey: 'enemy-rune-shaman-portrait',
      path: '/image/npc/shaman/all.png',
      frameWidth: 128,
      frameHeight: 128,
      pixelArt: true,
    },
    frames: {
      idle: 0,
      cast: 1,
      attack: 2,
      hurt: 3,
    },
    displayWidth: 126,
    displayHeight: 126,
  },
  valkyrie: {
    id: 'valkyrie',
    asset: {
      kind: 'spritesheet',
      textureKey: 'enemy-valkyrie-portrait',
      path: '/image/npc/valkyrie/all.png',
      frameWidth: 128,
      frameHeight: 128,
      pixelArt: true,
    },
    frames: {
      idle: 0,
      cast: 1,
      attack: 2,
      hurt: 3,
    },
    displayWidth: 126,
    displayHeight: 126,
  },
  einherjar: {
    id: 'einherjar',
    asset: {
      kind: 'spritesheet',
      textureKey: 'enemy-einherjar-portrait',
      path: '/image/npc/heroic-spirit/all.png',
      frameWidth: 128,
      frameHeight: 128,
      pixelArt: true,
    },
    frames: {
      idle: 0,
      cast: 1,
      attack: 2,
      hurt: 3,
    },
    displayWidth: 126,
    displayHeight: 126,
  },
  swordsman: {
    id: 'swordsman',
    asset: {
      kind: 'spritesheet',
      textureKey: 'enemy-swordsman-portrait',
      path: '/image/npc/wuxia/all.png',
      frameWidth: 128,
      frameHeight: 128,
      pixelArt: true,
    },
    frames: {
      idle: 0,
      cast: 1,
      attack: 2,
      hurt: 3,
    },
    displayWidth: 126,
    displayHeight: 126,
  },
  songstress: {
    id: 'dancing-maiden',
    asset: {
      kind: 'spritesheet',
      textureKey: 'enemy-dancing-maiden-portrait',
      path: '/image/npc/dancing-maiden/all.png',
      frameWidth: 128,
      frameHeight: 128,
      pixelArt: true,
    },
    frames: {
      idle: 0,
      cast: 1,
      attack: 2,
      hurt: 3,
    },
    displayWidth: 126,
    displayHeight: 126,
  },
  taoist: {
    id: 'taoist',
    asset: {
      kind: 'spritesheet',
      textureKey: 'enemy-taoist-portrait',
      path: '/image/npc/taoist/all.png',
      frameWidth: 128,
      frameHeight: 128,
      pixelArt: true,
    },
    frames: {
      idle: 0,
      cast: 1,
      attack: 2,
      hurt: 3,
    },
    displayWidth: 126,
    displayHeight: 126,
  },
};

// Empty manifests intentionally keep the current procedural themes as fallbacks.
// Each slot becomes active as soon as an asset is registered and loaded.
const BATTLE_THEME_ART: Record<TableThemeId, BattleThemeArtManifest> = {
  evernight_tavern: { themeId: 'evernight_tavern' },
  northern_longhouse: { themeId: 'northern_longhouse' },
  dragon_gate: { themeId: 'dragon_gate' },
  edo_teahouse: { themeId: 'edo_teahouse' },
};

export function getBattleThemeArt(themeId: TableThemeId): BattleThemeArtManifest {
  return BATTLE_THEME_ART[themeId];
}

export function getEnemyCharacterArt(enemyId: EnemyId): CharacterArtConfig | undefined {
  return ENEMY_CHARACTER_ART[enemyId];
}

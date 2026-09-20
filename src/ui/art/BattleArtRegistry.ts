import type { EnemyId } from '../../game/types/enemy';
import type { TableThemeId } from '../../game/types/tableTheme';
import type { BackgroundArtAsset, BattleThemeArtManifest, CharacterArtConfig } from './types';
import { EVERNIGHT_BUTTON_SKIN } from './commonUiArt';
import { DRAGON_GATE_THEME_ART } from './dragonGateArt';
import { EDO_TEAHOUSE_THEME_ART } from './edoTeahouseArt';
import { NORTHERN_LONGHOUSE_THEME_ART } from './northernLonghouseArt';

const PLAYER_PORTRAIT_SIZE = 140;
const ENEMY_PORTRAIT_SIZE = 140;
const LARGE_COMPOSITION_PORTRAIT_SIZE = 112;
const EVERNIGHT_CHARACTER_FRAME = {
  kind: 'image' as const,
  textureKey: 'theme-evernight-character-frame',
  path: '/image/env-assets/evernight/c-border-512.png',
  displayScale: 1.1,
  offsetY: 0,
};

export type EvernightBackgroundVariantId = 'classic' | 'sevenColor' | 'fiveColor' | 'overhead' | 'overheadPixel';

export const EVERNIGHT_BACKGROUND_VARIANTS: ReadonlyArray<{
  id: EvernightBackgroundVariantId;
  labelKey: string;
  asset: BackgroundArtAsset;
}> = [
    {
      id: 'classic',
      labelKey: 'battle.backgroundStyle.classic',
      asset: {
        kind: 'image',
        textureKey: 'theme-evernight-battle-background-classic',
        path: '/image/env-assets/evernight/battle-background.png',
        fit: 'stretch',
        includesTable: true,
      },
    },
    {
      id: 'sevenColor',
      labelKey: 'battle.backgroundStyle.sevenColor',
      asset: {
        kind: 'image',
        textureKey: 'theme-evernight-battle-background-seven-color',
        path: '/image/env-assets/evernight/battle-background-seven-color.png',
        fit: 'stretch',
        includesTable: true,
      },
    },
    {
      id: 'fiveColor',
      labelKey: 'battle.backgroundStyle.fiveColor',
      asset: {
        kind: 'image',
        textureKey: 'theme-evernight-battle-background-five-color',
        path: '/image/env-assets/evernight/battle-background-five-color.png',
        fit: 'stretch',
        includesTable: true,
      },
    },
    {
      id: 'overhead',
      labelKey: 'battle.backgroundStyle.overhead',
      asset: {
        kind: 'image',
        textureKey: 'theme-evernight-battle-background-overhead',
        path: '/image/env-assets/evernight/battle-background-overhead.png',
        fit: 'stretch',
        includesTable: true,
      },
    },
    {
      id: 'overheadPixel',
      labelKey: 'battle.backgroundStyle.overheadPixel',
      asset: {
        kind: 'image',
        textureKey: 'theme-evernight-battle-background-overhead-pixel',
        path: '/image/env-assets/evernight/battle-background-overhead-pixel-master.png',
        fit: 'stretch',
        includesTable: true,
      },
    },
  ];

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
  poseOffsets: {
    cast: { x: 6, y: 0 },
  },
  displayWidth: PLAYER_PORTRAIT_SIZE,
  displayHeight: PLAYER_PORTRAIT_SIZE,
};

const ENEMY_CHARACTER_ART: Partial<Record<EnemyId, CharacterArtConfig>> = {
  bartender: {
    id: 'bartender',
    asset: {
      kind: 'spritesheet',
      textureKey: 'enemy-bartender-portrait',
      path: '/image/npc/bartender/all.png',
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
    displayWidth: LARGE_COMPOSITION_PORTRAIT_SIZE,
    displayHeight: LARGE_COMPOSITION_PORTRAIT_SIZE,
  },
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
    displayWidth: ENEMY_PORTRAIT_SIZE,
    displayHeight: ENEMY_PORTRAIT_SIZE,
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
    displayWidth: ENEMY_PORTRAIT_SIZE,
    displayHeight: ENEMY_PORTRAIT_SIZE,
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
    displayWidth: LARGE_COMPOSITION_PORTRAIT_SIZE,
    displayHeight: LARGE_COMPOSITION_PORTRAIT_SIZE,
  },
  paladin: {
    id: 'paladin',
    asset: {
      kind: 'spritesheet',
      textureKey: 'enemy-paladin-portrait',
      path: '/image/npc/knight/all.png',
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
    displayOffset: { x: 0, y: -6 },
    displayWidth: LARGE_COMPOSITION_PORTRAIT_SIZE,
    displayHeight: LARGE_COMPOSITION_PORTRAIT_SIZE,
  },
  merchant: {
    id: 'merchant',
    asset: {
      kind: 'spritesheet',
      textureKey: 'enemy-merchant-portrait',
      path: '/image/npc/merchant/all.png',
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
    displayWidth: LARGE_COMPOSITION_PORTRAIT_SIZE,
    displayHeight: LARGE_COMPOSITION_PORTRAIT_SIZE,
  },
  keeper: {
    id: 'keeper',
    asset: {
      kind: 'spritesheet',
      textureKey: 'enemy-keeper-portrait',
      path: '/image/npc/boss/all.png',
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
    displayWidth: LARGE_COMPOSITION_PORTRAIT_SIZE,
    displayHeight: LARGE_COMPOSITION_PORTRAIT_SIZE,
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
    displayWidth: ENEMY_PORTRAIT_SIZE,
    displayHeight: ENEMY_PORTRAIT_SIZE,
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
    displayWidth: ENEMY_PORTRAIT_SIZE * 0.85,
    displayHeight: ENEMY_PORTRAIT_SIZE * 0.85,
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
    displayWidth: ENEMY_PORTRAIT_SIZE,
    displayHeight: ENEMY_PORTRAIT_SIZE,
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
    displayWidth: ENEMY_PORTRAIT_SIZE,
    displayHeight: ENEMY_PORTRAIT_SIZE,
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
    displayWidth: ENEMY_PORTRAIT_SIZE,
    displayHeight: ENEMY_PORTRAIT_SIZE,
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
    displayWidth: ENEMY_PORTRAIT_SIZE,
    displayHeight: ENEMY_PORTRAIT_SIZE,
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
    displayWidth: ENEMY_PORTRAIT_SIZE,
    displayHeight: ENEMY_PORTRAIT_SIZE,
  },
  shogun_samurai: {
    id: 'shogun-samurai',
    asset: {
      kind: 'spritesheet',
      textureKey: 'enemy-shogun-samurai-portrait',
      path: '/image/npc/samurai/all.png',
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
    displayWidth: ENEMY_PORTRAIT_SIZE * 0.9,
    displayHeight: ENEMY_PORTRAIT_SIZE * 0.9,
  },
  ninja: {
    id: 'ninja',
    asset: {
      kind: 'spritesheet',
      textureKey: 'enemy-ninja-portrait',
      path: '/image/npc/ninja/all.png',
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
    displayWidth: ENEMY_PORTRAIT_SIZE * 0.9,
    displayHeight: ENEMY_PORTRAIT_SIZE * 0.9,
  },
  oiran: {
    id: 'oiran',
    asset: {
      kind: 'spritesheet',
      textureKey: 'enemy-oiran-portrait',
      path: '/image/npc/oiran/all.png',
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
    displayWidth: ENEMY_PORTRAIT_SIZE * 0.9,
    displayHeight: ENEMY_PORTRAIT_SIZE * 0.9,
  },
};

// Empty manifests intentionally keep the current procedural themes as fallbacks.
// Each slot becomes active as soon as an asset is registered and loaded.
const BATTLE_THEME_ART: Record<TableThemeId, BattleThemeArtManifest> = {
  evernight_tavern: {
    themeId: 'evernight_tavern',
    background: EVERNIGHT_BACKGROUND_VARIANTS.find((variant) => variant.id === 'classic')!.asset,
    playerFrame: EVERNIGHT_CHARACTER_FRAME,
    enemyFrame: EVERNIGHT_CHARACTER_FRAME,
    actionButton: EVERNIGHT_BUTTON_SKIN,
    modalPanel: {
      kind: 'image',
      textureKey: 'theme-evernight-modal-panel',
      path: '/image/ui/evernight/modal-panel.png',
      leftWidth: 56,
      rightWidth: 56,
      topHeight: 48,
      bottomHeight: 48,
    },
    tooltipPanel: {
      kind: 'image',
      textureKey: 'theme-evernight-tooltip-panel',
      path: '/image/ui/evernight/tooltip-panel.png',
      leftWidth: 34,
      rightWidth: 34,
      topHeight: 30,
      bottomHeight: 30,
    },
  },
  northern_longhouse: NORTHERN_LONGHOUSE_THEME_ART,
  dragon_gate: DRAGON_GATE_THEME_ART,
  edo_teahouse: EDO_TEAHOUSE_THEME_ART,
};

export function getBattleThemeArt(themeId: TableThemeId): BattleThemeArtManifest {
  return BATTLE_THEME_ART[themeId];
}

export function getEnemyCharacterArt(enemyId: EnemyId): CharacterArtConfig | undefined {
  return ENEMY_CHARACTER_ART[enemyId];
}

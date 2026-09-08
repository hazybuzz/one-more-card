import type { EnemyId } from '../../game/types/enemy';
import type { BattleThemeArtManifest } from './types';

export const NORTHERN_LONGHOUSE_ENEMY_IDS = [
  'viking_warrior',
  'rune_shaman',
  'valkyrie',
  'einherjar',
] as const satisfies readonly EnemyId[];

export const NORTHERN_LONGHOUSE_PALETTE = {
  ink: 0x11151b,
  charredWood: 0x29231f,
  coldIron: 0x667785,
  runeBlue: 0x58b8e8,
  frostBlue: 0xa8d8e8,
  emberOrange: 0xc56a35,
  bone: 0xd5c7a7,
} as const;

export const NORTHERN_LONGHOUSE_ASSET_PATHS = {
  root: '/image/ui/northern-longhouse',
  characterFrame: '/image/ui/northern-longhouse/character-frame.png',
  actionButton: '/image/ui/northern-longhouse/action-button.png',
  modalPanel: '/image/ui/northern-longhouse/modal-panel.png',
  tooltipPanel: '/image/ui/northern-longhouse/tooltip-panel.png',
  passiveIcons: {
    warHorn: '/image/icons/passives/war-horn.png',
    runeBlessing: '/image/icons/passives/rune-blessing.png',
    einherjarSummon: '/image/icons/passives/einherjar-summon.png',
  },
  attacks: {
    vikingWarrior: '/image/battle/effects/northern-longhouse/viking-axe-chroma.png',
    runeShaman: '/image/battle/effects/northern-longhouse/rune-bolt-chroma.png',
    valkyrie: '/image/battle/effects/northern-longhouse/valkyrie-spear-chroma.png',
    einherjar: '/image/battle/effects/northern-longhouse/einherjar-blade-chroma.png',
  },
} as const;

// New slots are added here only after their assets exist. This keeps partial
// theme work playable while giving every later art pass one stable registry.
export const NORTHERN_LONGHOUSE_THEME_ART: BattleThemeArtManifest = {
  themeId: 'northern_longhouse',
  background: {
    kind: 'image',
    textureKey: 'theme-northern-longhouse-battle-background',
    path: '/image/ui/table-select/preview-northern-master.png',
    fit: 'stretch',
    alpha: 0.7,
    includesTable: true,
  },
  playerFrame: {
    kind: 'image',
    textureKey: 'theme-northern-longhouse-character-frame',
    path: NORTHERN_LONGHOUSE_ASSET_PATHS.characterFrame,
    displayScale: 1.1,
  },
  enemyFrame: {
    kind: 'image',
    textureKey: 'theme-northern-longhouse-character-frame',
    path: NORTHERN_LONGHOUSE_ASSET_PATHS.characterFrame,
    displayScale: 1.1,
  },
  actionButton: {
    kind: 'image',
    textureKey: 'theme-northern-longhouse-action-button',
    path: NORTHERN_LONGHOUSE_ASSET_PATHS.actionButton,
    leftWidth: 36,
    rightWidth: 36,
    topHeight: 14,
    bottomHeight: 14,
  },
  modalPanel: {
    kind: 'image',
    textureKey: 'theme-northern-longhouse-modal-panel',
    path: NORTHERN_LONGHOUSE_ASSET_PATHS.modalPanel,
    leftWidth: 56,
    rightWidth: 56,
    topHeight: 48,
    bottomHeight: 48,
  },
  tooltipPanel: {
    kind: 'image',
    textureKey: 'theme-northern-longhouse-tooltip-panel',
    path: NORTHERN_LONGHOUSE_ASSET_PATHS.tooltipPanel,
    leftWidth: 30,
    rightWidth: 30,
    topHeight: 26,
    bottomHeight: 26,
  },
};

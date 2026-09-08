import type { EnemyId } from '../../game/types/enemy';
import type { BattleThemeArtManifest } from './types';

export const DRAGON_GATE_ENEMY_IDS = [
  'swordsman',
  'songstress',
  'taoist',
] as const satisfies readonly EnemyId[];

export const DRAGON_GATE_PALETTE = {
  ink: 0x120b0c,
  lacquer: 0x4a1015,
  deepRed: 0x741d22,
  oldGold: 0xb98943,
  silkRose: 0xd57287,
  jade: 0x67b99e,
  parchment: 0xdbc69d,
} as const;

export const DRAGON_GATE_ASSET_PATHS = {
  root: '/image/ui/dragon-gate',
  background: '/image/ui/table-select/preview-dragon-master.png',
  characterFrame: '/image/ui/dragon-gate/character-frame.png',
  actionButton: '/image/ui/dragon-gate/action-button.png',
  modalPanel: '/image/ui/dragon-gate/modal-panel.png',
  tooltipPanel: '/image/ui/dragon-gate/tooltip-panel.png',
  passiveIcons: {
    chivalry: '/image/icons/passives/chivalry.png',
    redSilkToast: '/image/icons/passives/red-silk-toast.png',
    heavenlyInsight: '/image/icons/passives/heavenly-insight.png',
  },
} as const;

// Only assets that already exist are registered here. Later art steps can fill
// the prepared slots without making the current playable build load missing files.
export const DRAGON_GATE_THEME_ART: BattleThemeArtManifest = {
  themeId: 'dragon_gate',
  background: {
    kind: 'image',
    textureKey: 'theme-dragon-gate-battle-background',
    path: DRAGON_GATE_ASSET_PATHS.background,
    fit: 'stretch',
    alpha: 0.7,
    includesTable: true,
  },
  playerFrame: {
    kind: 'image',
    textureKey: 'theme-dragon-gate-character-frame',
    path: DRAGON_GATE_ASSET_PATHS.characterFrame,
    displayScale: 1.1,
  },
  enemyFrame: {
    kind: 'image',
    textureKey: 'theme-dragon-gate-character-frame',
    path: DRAGON_GATE_ASSET_PATHS.characterFrame,
    displayScale: 1.1,
  },
  actionButton: {
    kind: 'image',
    textureKey: 'theme-dragon-gate-action-button',
    path: DRAGON_GATE_ASSET_PATHS.actionButton,
    leftWidth: 30,
    rightWidth: 30,
    topHeight: 12,
    bottomHeight: 12,
  },
  modalPanel: {
    kind: 'image',
    textureKey: 'theme-dragon-gate-modal-panel',
    path: DRAGON_GATE_ASSET_PATHS.modalPanel,
    leftWidth: 40,
    rightWidth: 40,
    topHeight: 34,
    bottomHeight: 34,
  },
  tooltipPanel: {
    kind: 'image',
    textureKey: 'theme-dragon-gate-tooltip-panel',
    path: DRAGON_GATE_ASSET_PATHS.tooltipPanel,
    leftWidth: 18,
    rightWidth: 18,
    topHeight: 16,
    bottomHeight: 16,
  },
};

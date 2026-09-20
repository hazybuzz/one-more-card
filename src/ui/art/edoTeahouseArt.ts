import type { EnemyId } from '../../game/types/enemy';
import type { BattleThemeArtManifest } from './types';

export const EDO_TEAHOUSE_ENEMY_IDS = [
  'shogun_samurai',
  'ninja',
  'oiran',
] as const satisfies readonly EnemyId[];

export const EDO_TEAHOUSE_PALETTE = {
  ink: 0x0d0c10,
  lacquer: 0x35151f,
  deepVermilion: 0x6a2935,
  mutedRose: 0xb66f82,
  oldGold: 0xb58a46,
  ricePaper: 0xd8c9ae,
} as const;

// These stable paths are reserved for the following Edo UI steps. Assets are
// added to the manifest only after their files exist, avoiding preload errors.
export const EDO_TEAHOUSE_ASSET_PATHS = {
  root: '/image/ui/edo-teahouse',
  background: '/image/ui/table-select/preview-edo-master.png',
  characterFrame: '/image/ui/edo-teahouse/character-frame.png',
  actionButton: '/image/ui/edo-teahouse/action-button.png',
  modalPanel: '/image/ui/edo-teahouse/modal-panel.png',
  tooltipPanel: '/image/ui/edo-teahouse/tooltip-panel.png',
  passiveIcons: {
    iaijutsuCharge: '/image/icons/passives/iaijutsu-charge.png',
    smokeSubstitution: '/image/icons/passives/smoke-substitution.png',
    hanamiDance: '/image/icons/passives/hanami-dance.png',
  },
} as const;

export const EDO_TEAHOUSE_THEME_ART: BattleThemeArtManifest = {
  themeId: 'edo_teahouse',
  background: {
    kind: 'image',
    textureKey: 'theme-edo-teahouse-battle-background',
    path: EDO_TEAHOUSE_ASSET_PATHS.background,
    fit: 'stretch',
    alpha: 0.7,
    includesTable: true,
  },
  playerFrame: {
    kind: 'image',
    textureKey: 'theme-edo-teahouse-character-frame',
    path: EDO_TEAHOUSE_ASSET_PATHS.characterFrame,
    displayScale: 1.1,
  },
  enemyFrame: {
    kind: 'image',
    textureKey: 'theme-edo-teahouse-character-frame',
    path: EDO_TEAHOUSE_ASSET_PATHS.characterFrame,
    displayScale: 1.1,
  },
  actionButton: {
    kind: 'image',
    textureKey: 'theme-edo-teahouse-action-button',
    path: EDO_TEAHOUSE_ASSET_PATHS.actionButton,
    leftWidth: 30,
    rightWidth: 30,
    topHeight: 12,
    bottomHeight: 12,
  },
  modalPanel: {
    kind: 'image',
    textureKey: 'theme-edo-teahouse-modal-panel',
    path: EDO_TEAHOUSE_ASSET_PATHS.modalPanel,
    leftWidth: 44,
    rightWidth: 44,
    topHeight: 44,
    bottomHeight: 44,
  },
  tooltipPanel: {
    kind: 'image',
    textureKey: 'theme-edo-teahouse-tooltip-panel',
    path: EDO_TEAHOUSE_ASSET_PATHS.tooltipPanel,
    leftWidth: 18,
    rightWidth: 18,
    topHeight: 16,
    bottomHeight: 16,
  },
};

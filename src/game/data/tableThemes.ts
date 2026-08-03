import type { TableThemeConfig, TableThemeId } from '../types/tableTheme';

export const TABLE_THEMES: TableThemeConfig[] = [
  {
    id: 'evernight_tavern',
    nameKey: 'tableTheme.evernight.name',
    subtitleKey: 'tableTheme.evernight.subtitle',
    descriptionKey: 'tableTheme.evernight.description',
    entryCost: 20,
    rewardMultiplier: 1,
    unlockedByDefault: true,
    enemyIds: ['goblin', 'gambler', 'werewolf'],
    playerHp: 12,
    visual: {
      accentColor: 0xe8cf73,
      glowColor: '#e8cf73',
      backgroundColor: 0x101114,
      panelColor: 0x1b1d22,
      panelAltColor: 0x252832,
      lineColor: 0x3b3f4c,
      tableColor: 0x191c22,
      tableRingColor: 0x2b303c,
      motif: 'tavern',
    },
  },
  {
    id: 'northern_longhouse',
    nameKey: 'tableTheme.northernLonghouse.name',
    subtitleKey: 'tableTheme.northernLonghouse.subtitle',
    descriptionKey: 'tableTheme.northernLonghouse.description',
    entryCost: 25,
    rewardMultiplier: 1.2,
    unlockedByDefault: true,
    enemyIds: ['viking_warrior', 'rune_shaman', 'valkyrie'],
    playerHp: 12,
    visual: {
      accentColor: 0x79c9ff,
      glowColor: '#79c9ff',
      backgroundColor: 0x071018,
      panelColor: 0x13202a,
      panelAltColor: 0x1b3341,
      lineColor: 0x36586a,
      tableColor: 0x0e1a23,
      tableRingColor: 0x79c9ff,
      motif: 'northern',
    },
  },
  {
    id: 'dragon_gate',
    nameKey: 'tableTheme.dragonGate.name',
    subtitleKey: 'tableTheme.dragonGate.subtitle',
    descriptionKey: 'tableTheme.dragonGate.description',
    entryCost: 30,
    rewardMultiplier: 1.4,
    unlockedByDefault: true,
    enemyIds: ['swordsman', 'songstress', 'taoist'],
    playerHp: 12,
    visual: {
      accentColor: 0xf0c45c,
      glowColor: '#f0c45c',
      backgroundColor: 0x16080b,
      panelColor: 0x231116,
      panelAltColor: 0x35191c,
      lineColor: 0x7a3131,
      tableColor: 0x2b1215,
      tableRingColor: 0xd6a64f,
      motif: 'dragon',
    },
  },
  {
    id: 'edo_teahouse',
    nameKey: 'tableTheme.edoTeahouse.name',
    subtitleKey: 'tableTheme.edoTeahouse.subtitle',
    descriptionKey: 'tableTheme.edoTeahouse.description',
    entryCost: 35,
    rewardMultiplier: 1.6,
    unlockedByDefault: true,
    enemyIds: ['shogun_samurai', 'ninja', 'oiran'],
    playerHp: 12,
    visual: {
      accentColor: 0xe89aa9,
      glowColor: '#f3b5c1',
      backgroundColor: 0x120d18,
      panelColor: 0x211725,
      panelAltColor: 0x35203a,
      lineColor: 0x8c536b,
      tableColor: 0x291522,
      tableRingColor: 0xe6b65d,
      motif: 'edo',
    },
  },
];

export function getTableThemeById(themeId: TableThemeId): TableThemeConfig | undefined {
  return TABLE_THEMES.find((theme) => theme.id === themeId);
}

export function defaultTableTheme(): TableThemeConfig {
  return TABLE_THEMES[0];
}

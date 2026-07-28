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
    entryCost: 50,
    rewardMultiplier: 1.5,
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
];

export function getTableThemeById(themeId: TableThemeId): TableThemeConfig | undefined {
  return TABLE_THEMES.find((theme) => theme.id === themeId);
}

export function defaultTableTheme(): TableThemeConfig {
  return TABLE_THEMES[0];
}

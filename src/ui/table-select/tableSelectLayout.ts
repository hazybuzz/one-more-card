export const TABLE_SELECT_LAYOUT = {
  cardWidth: 520,
  cardHeight: 280,
  slots: [
    { x: 360, y: 266 },
    { x: 920, y: 266 },
    { x: 360, y: 536 },
    { x: 920, y: 536 },
  ],
  header: {
    titleY: 64,
    subtitleY: 105,
  },
  statusY: 680,
} as const;

export const TABLE_THEME_CARD_LAYOUT = {
  width: 520,
  height: 280,
  safeLeft: -232,
  safeRight: 232,
  safeTop: -108,
  safeBottom: 116,
  preview: {
    x: -158,
    y: -52,
    width: 110,
    height: 60,
  },
  title: {
    x: -78,
    y: -76,
    width: 298,
  },
  metricsY: 3,
  actionPanel: {
    x: 0,
    y: 63,
    width: 464,
    height: 78,
  },
} as const;

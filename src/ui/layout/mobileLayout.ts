export const MOBILE_BATTLE_LAYOUT_BLUEPRINT = {
  id: 'mobile-portrait-draft',
  implemented: false,
  orientation: 'portrait',
  canvas: { width: 720, height: 1280 },
  zones: {
    enemies: 'upper-table',
    centerInfo: 'table-center',
    player: 'lower-table',
    commandBar: 'bottom-safe-area',
  },
} as const;

import type { BattleVisualProfile } from './BattleVisualProfile';

export const PROCEDURAL_TAVERN_PROFILE: BattleVisualProfile = {
  id: 'procedural_tavern_lab',
  labelKey: 'visualProfile.proceduralTavern',
  renderer: 'procedural_tavern',
  tavern: {
    background: 0x070606,
    backgroundAlt: 0x17100d,
    woodDark: 0x1b100c,
    wood: 0x3a2418,
    woodLight: 0x765033,
    cloth: 0x351315,
    clothEdge: 0x9b6737,
    candle: 0xffb45f,
    candleCore: 0xfff0bd,
    moonlight: 0x7697bd,
    resonance: 0xe8cf73,
    panel: 0x1a1413,
    panelAlt: 0x2a1c19,
    motion: {
      candleFlickerDuration: 920,
      moonBreathDuration: 6800,
      runeBreathDuration: 3200,
      dustCount: 12,
    },
  },
};

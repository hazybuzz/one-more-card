export const BATTLE_VISUAL_PROFILE_IDS = ['classic', 'procedural_tavern_lab'] as const;

export type BattleVisualProfileId = typeof BATTLE_VISUAL_PROFILE_IDS[number];

export interface ProceduralTavernVisualTokens {
  background: number;
  backgroundAlt: number;
  woodDark: number;
  wood: number;
  woodLight: number;
  cloth: number;
  clothEdge: number;
  candle: number;
  candleCore: number;
  moonlight: number;
  resonance: number;
  panel: number;
  panelAlt: number;
  motion: {
    candleFlickerDuration: number;
    moonBreathDuration: number;
    runeBreathDuration: number;
    dustCount: number;
  };
}

export interface BattleVisualProfile {
  id: BattleVisualProfileId;
  labelKey: string;
  renderer: 'classic' | 'procedural_tavern';
  tavern?: ProceduralTavernVisualTokens;
}

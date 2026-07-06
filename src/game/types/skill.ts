export type SkillId = 'resonance_shift' | 'resonance_summon' | 'soul_redeem';
export type SkillKind = 'active' | 'passive';

export interface SkillConfig {
  id: SkillId;
  kind: SkillKind;
  nameKey: string;
  tooltipKey: string;
  icon: string;
  cooldownRounds?: number;
  resourceKey?: string;
}

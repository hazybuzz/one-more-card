import type { SkillConfig, SkillId } from '../types/skill';

export const SKILL_CONFIGS: Record<SkillId, SkillConfig> = {
  resonance_shift: {
    id: 'resonance_shift',
    kind: 'active',
    nameKey: 'skill.resonanceShift.name',
    tooltipKey: 'skill.resonanceShift.tooltip',
    icon: '◇',
    cooldownRounds: 2,
    resourceKey: 'skill_resonance_shift',
  },
  resonance_summon: {
    id: 'resonance_summon',
    kind: 'active',
    nameKey: 'skill.resonanceSummon.name',
    tooltipKey: 'skill.resonanceSummon.tooltip',
    icon: '✦',
    cooldownRounds: 2,
    resourceKey: 'skill_resonance_summon',
  },
  soul_redeem: {
    id: 'soul_redeem',
    kind: 'passive',
    nameKey: 'skill.soulRedeem.name',
    tooltipKey: 'skill.soulRedeem.tooltip',
    icon: '✚',
    resourceKey: 'skill_soul_redeem',
  },
};

export const SKILL_LIST: SkillConfig[] = Object.values(SKILL_CONFIGS);

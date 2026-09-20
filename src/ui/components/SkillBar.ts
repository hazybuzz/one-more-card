import Phaser from 'phaser';
import { t } from '../../game/i18n';
import { getBattleIconArt } from '../art';
import type { SkillSlotId, SkillSlotState } from '../state/UIState';
import { AbilitySlot } from './AbilitySlot';
import { addTutorialGuide } from './TutorialGuide';

interface SkillBarOptions {
  x: number;
  y: number;
  skills: Record<SkillSlotId, SkillSlotState>;
  colors: {
    cooldown: string;
    line: number;
    muted: string;
    resonance: string;
    text: string;
    accent: number;
    panelEnabled: number;
    panelDisabled: number;
    panelHover: number;
  };
  tooltipOrigin: {
    x: number;
    y: number;
  };
  onShowTooltip: (x: number, y: number, title: string, body: string) => void;
  onHideTooltip: () => void;
  onUse: (id: SkillSlotId, title: string, tooltip: string, tooltipX: number, tooltipY: number) => void;
  direction?: 'vertical' | 'horizontal';
  slotGap?: number;
  guideTarget?: SkillSlotId;
}

export class SkillBar {
  static render(scene: Phaser.Scene, options: SkillBarOptions): Phaser.GameObjects.Container {
    const container = scene.add.container(options.x, options.y);
    const visibleSkills = (['shift', 'summon'] as SkillSlotId[]).filter((id) => options.skills[id].visible);
    visibleSkills.forEach((id, index) => {
      const gap = options.slotGap ?? 84;
      const offsetX = options.direction === 'horizontal' ? index * gap : 0;
      const offsetY = options.direction === 'horizontal' ? 0 : index * gap;
      container.add(this.renderSlot(scene, options, id, offsetX, offsetY));
      if (id === options.guideTarget) {
        addTutorialGuide(scene, container, offsetX, offsetY, 66, 66);
      }
    });
    return container;
  }

  private static renderSlot(scene: Phaser.Scene, options: SkillBarOptions, id: SkillSlotId, offsetX: number, offsetY: number): Phaser.GameObjects.Container {
    const skill = options.skills[id];
    const title = t(skill.titleKey);
    const tooltip = t(skill.tooltipKey, { rounds: skill.cooldown });
    const tooltipX = options.tooltipOrigin.x + options.x + offsetX + (options.direction === 'horizontal' ? 0 : 70);
    const tooltipY = options.tooltipOrigin.y + options.y + offsetY - 98;
    const iconTextureKey = skill.iconArtId ? getBattleIconArt(skill.iconArtId).textureKey : undefined;
    return new AbilitySlot(scene, {
      x: offsetX,
      y: offsetY,
      icon: skill.icon,
      iconTextureKey,
      variant: 'active',
      radiateWhenEnabled: true,
      color: 0xd8b45e,
      textColor: options.colors.resonance,
      enabled: skill.enabled,
      unavailable: !skill.enabled && skill.cooldown <= 0,
      cooldown: skill.cooldown,
      cooldownMax: 2,
      backgroundColor: options.colors.panelEnabled,
      disabledBackgroundColor: options.colors.panelDisabled,
      hoverBackgroundColor: options.colors.panelHover,
      onShowTooltip: () => options.onShowTooltip(tooltipX, tooltipY, title, tooltip),
      onHideTooltip: options.onHideTooltip,
      onActivate: () => options.onUse(id, title, tooltip, tooltipX, tooltipY),
    }).container;
  }
}

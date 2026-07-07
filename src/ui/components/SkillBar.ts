import Phaser from 'phaser';
import { t } from '../../game/i18n';
import type { SkillSlotId, SkillSlotState } from '../state/UIState';

interface SkillBarOptions {
  x: number;
  y: number;
  skills: Record<SkillSlotId, SkillSlotState>;
  colors: {
    heat: string;
    line: number;
    muted: string;
    resonance: string;
    text: string;
  };
  tooltipOrigin: {
    x: number;
    y: number;
  };
  onShowTooltip: (x: number, y: number, title: string, body: string) => void;
  onHideTooltip: () => void;
  onUse: (id: SkillSlotId, title: string, tooltip: string, tooltipX: number, tooltipY: number) => void;
}

export class SkillBar {
  static render(scene: Phaser.Scene, options: SkillBarOptions): Phaser.GameObjects.Container {
    const container = scene.add.container(options.x, options.y);
    container.add(this.renderSlot(scene, options, 'shift', 0));
    container.add(this.renderSlot(scene, options, 'summon', 84));
    return container;
  }

  private static renderSlot(scene: Phaser.Scene, options: SkillBarOptions, id: SkillSlotId, offsetY: number): Phaser.GameObjects.Container {
    const skill = options.skills[id];
    const title = t(skill.titleKey);
    const tooltip = t(skill.tooltipKey, { rounds: skill.cooldown });
    const tooltipX = options.tooltipOrigin.x + options.x + 70;
    const tooltipY = options.tooltipOrigin.y + options.y + offsetY - 98;
    const slot = scene.add.container(0, offsetY);
    const rect = scene.add.rectangle(0, 0, 78, 64, skill.enabled ? 0x2a2e38 : 0x20232a).setStrokeStyle(2, skill.enabled ? 0xffd86b : options.colors.line);
    const iconGlow = scene.add.circle(0, -10, 19, 0xffd86b, skill.enabled ? 0.22 : 0.08);
    const icon = scene.add.text(0, -12, skill.icon, {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: skill.enabled ? options.colors.resonance : options.colors.muted,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const label = scene.add.text(0, 20, title, {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: skill.enabled ? options.colors.text : options.colors.muted,
    }).setOrigin(0.5);
    const children: Phaser.GameObjects.GameObject[] = [rect, iconGlow, icon, label];

    if (skill.cooldown > 0) {
      children.push(scene.add.text(0, 33, `CD ${skill.cooldown}`, {
        fontFamily: 'Arial',
        fontSize: '11px',
        color: options.colors.heat,
        fontStyle: 'bold',
      }).setOrigin(0.5));
    }

    if (skill.enabled) {
      icon.setShadow(0, 0, options.colors.resonance, 10, true, true);
    }

    rect.setInteractive({ useHandCursor: skill.enabled });
    rect.on('pointerover', () => {
      rect.setFillStyle(0x343947);
      options.onShowTooltip(tooltipX, tooltipY, title, tooltip);
    });
    rect.on('pointerout', () => {
      rect.setFillStyle(skill.enabled ? 0x2a2e38 : 0x20232a);
      options.onHideTooltip();
    });
    rect.on('pointerdown', () => {
      if (skill.enabled) {
        options.onUse(id, title, tooltip, tooltipX, tooltipY);
      }
    });

    slot.add(children);
    return slot;
  }
}

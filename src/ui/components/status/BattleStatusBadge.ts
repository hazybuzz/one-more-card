import Phaser from 'phaser';
import type { BattleStatusState } from '../../state/BattleStatusState';
import { GAME_FONT_FAMILY } from '../../themes/typography';
import { createProgrammaticStatusGlyph } from './ProgrammaticStatusGlyph';

export class BattleStatusBadge {
  readonly container: Phaser.GameObjects.Container;
  readonly hitArea: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, status: BattleStatusState, size = 32) {
    this.container = scene.add.container(0, 0);
    const half = size / 2;
    const frameColor = status.color;
    const shadow = scene.add.rectangle(2, 3, size + 2, size + 2, 0x000000, 0.72);
    const outerGlow = scene.add.rectangle(0, 0, size + 5, size + 5, 0x000000, 0)
      .setStrokeStyle(4, frameColor, status.kind === 'debuff' ? 0.32 : 0.2)
      .setBlendMode(Phaser.BlendModes.ADD);
    const outerFrame = scene.add.rectangle(0, 0, size, size, 0x07090d, 0.98)
      .setStrokeStyle(2, 0x020305, 1);
    const innerFrame = scene.add.rectangle(0, 0, size - 4, size - 4, 0x11151c, 0.98)
      .setStrokeStyle(2, frameColor, 0.94);
    const innerLight = scene.add.rectangle(0, 0, size - 8, size - 8, 0x000000, 0)
      .setStrokeStyle(1, 0xfff3d0, 0.28);
    const topSheen = scene.add.rectangle(0, -half + 3, size - 7, 2, frameColor, 0.45)
      .setBlendMode(Phaser.BlendModes.ADD);
    const glyph = createProgrammaticStatusGlyph(scene, status.id, frameColor, size * 0.58);
    this.container.add([shadow, outerGlow, outerFrame, innerFrame, innerLight, topSheen, glyph]);

    if (status.kind === 'buff') {
      this.container.add(scene.add.circle(-half + 5, -half + 5, 2, 0xfff4ce, 0.92)
        .setBlendMode(Phaser.BlendModes.ADD));
    } else if (status.kind === 'debuff') {
      this.container.add(scene.add.triangle(0, half + 2, -4, -2, 4, -2, 0, 4, frameColor, 0.95));
    } else if (status.kind === 'charge') {
      const orbit = scene.add.container(0, 0);
      for (let index = 0; index < 4; index += 1) {
        const angle = index * Math.PI / 2;
        orbit.add(scene.add.rectangle(Math.cos(angle) * (half - 1), Math.sin(angle) * (half - 1), 2, 2, frameColor, 0.8));
      }
      this.container.add(orbit);
      scene.tweens.add({ targets: orbit, angle: 360, duration: 5200, repeat: -1, ease: 'Linear' });
      orbit.once(Phaser.GameObjects.Events.DESTROY, () => scene.tweens.killTweensOf(orbit));
    }

    if (status.stacks > 1) {
      const badgeSize = status.stacks >= 10 ? 16 : 14;
      const stackX = half - 3;
      const stackY = half - 3;
      const stackBack = scene.add.circle(stackX, stackY, badgeSize / 2, 0x05070a, 1)
        .setStrokeStyle(1, frameColor, 1);
      const stackText = scene.add.text(stackX, stackY, `${status.stacks}`, {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: status.stacks >= 10 ? '8px' : '9px',
        color: '#fff8e8',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      stackText.setShadow(0, 0, status.textColor, 3, true, true);
      this.container.add([stackBack, stackText]);
    }

    this.hitArea = scene.add.rectangle(0, 0, size + 4, size + 4, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: false });
    this.container.add(this.hitArea);

    const pulseDuration = status.kind === 'debuff' ? 1180 : 1580;
    scene.tweens.add({
      targets: outerGlow,
      alpha: { from: status.kind === 'debuff' ? 0.42 : 0.24, to: status.kind === 'debuff' ? 0.82 : 0.5 },
      duration: pulseDuration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.container.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.tweens.killTweensOf([this.container, outerGlow]);
    });
  }

  playTransition(scene: Phaser.Scene, transition: BattleStatusState['transition']): void {
    if (transition === 'added') {
      this.container.setAlpha(0).setScale(0.74);
      scene.tweens.add({ targets: this.container, alpha: 1, scale: 1, duration: 210, ease: 'Back.easeOut' });
    } else if (transition === 'stacked') {
      scene.tweens.add({ targets: this.container, scale: 1.18, duration: 120, yoyo: true, ease: 'Sine.easeOut' });
    } else if (transition === 'removed') {
      this.hitArea.disableInteractive();
      scene.tweens.add({ targets: this.container, alpha: 0, y: -6, duration: 190, ease: 'Cubic.easeIn' });
    }
  }
}

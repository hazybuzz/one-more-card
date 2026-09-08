import Phaser from 'phaser';
import { CARD_BACK_TEXTURE_KEY } from '../../game/assets';

export class StoryCardPushEffect {
  static play(scene: Phaser.Scene): Phaser.GameObjects.Container | undefined {
    if (!scene.textures.exists(CARD_BACK_TEXTURE_KEY)) {
      return undefined;
    }

    const stack = scene.add.container(640, 704).setAlpha(0);
    const cardOffsets = [
      { x: -13, y: 5, angle: -7 },
      { x: 0, y: 0, angle: 0 },
      { x: 13, y: 5, angle: 7 },
    ];

    cardOffsets.forEach(({ x, y, angle }) => {
      stack.add(scene.add.image(x, y, CARD_BACK_TEXTURE_KEY)
        .setDisplaySize(62, 87)
        .setAngle(angle)
        .setOrigin(0.5));
    });

    scene.tweens.add({
      targets: stack,
      y: 602,
      alpha: 1,
      duration: 560,
      ease: 'Cubic.easeOut',
    });
    scene.tweens.add({
      targets: stack,
      scaleX: 1.035,
      scaleY: 1.035,
      duration: 220,
      delay: 560,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });

    return stack;
  }
}

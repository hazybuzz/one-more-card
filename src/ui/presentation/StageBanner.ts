import Phaser from 'phaser';

export interface StageBannerOptions {
  text: string;
  x?: number;
  y?: number;
  color?: string;
  stroke?: string;
  fontSize?: string;
  lineSpacing?: number;
  fadeInMs?: number;
  holdMs?: number;
  fadeOutMs?: number;
  renderBefore?: () => void;
  onComplete?: () => void;
}

export function playStageBanner(scene: Phaser.Scene, options: StageBannerOptions): Phaser.GameObjects.Container {
  options.renderBefore?.();

  const color = options.color ?? '#ff4b5f';
  const container = scene.add.container(options.x ?? 640, options.y ?? 342).setDepth(70);
  const blocker = scene.add.rectangle(0, 18, 1280, 720, 0x000000, 0.01).setInteractive();
  const text = scene.add.text(0, 0, options.text, {
    fontFamily: 'Arial',
    fontSize: options.fontSize ?? '104px',
    color,
    fontStyle: 'bold',
    stroke: options.stroke ?? '#3a070d',
    strokeThickness: 8,
    align: 'center',
    lineSpacing: options.lineSpacing ?? 12,
  }).setOrigin(0.5);
  text.setShadow(0, 0, color, 36, true, true);
  container.add([blocker, text]);
  container.setAlpha(0);
  container.setScale(0.56);

  scene.tweens.add({
    targets: container,
    alpha: 1,
    scale: 1,
    duration: options.fadeInMs ?? 360,
    ease: 'Back.easeOut',
    onComplete: () => {
      scene.time.delayedCall(options.holdMs ?? 420, () => {
        scene.tweens.add({
          targets: container,
          alpha: 0,
          y: container.y - 34,
          scale: 1.12,
          duration: options.fadeOutMs ?? 300,
          ease: 'Sine.easeIn',
          onComplete: () => {
            container.destroy(true);
            options.onComplete?.();
          },
        });
      });
    },
  });

  return container;
}


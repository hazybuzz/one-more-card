import Phaser from 'phaser';

export interface DealAnimationStep {
  to: Phaser.Math.Vector2;
  onArrive?: () => void;
}

export interface DealSequenceOptions {
  steps: DealAnimationStep[];
  from?: Phaser.Math.Vector2;
  delayMs?: number;
  cardWidth?: number;
  cardHeight?: number;
  soundKey?: string;
  soundVolume?: number;
  canContinue?: () => boolean;
  onStepComplete?: (index: number) => void;
  onComplete?: () => void;
}

export function playDealSequence(scene: Phaser.Scene, options: DealSequenceOptions): void {
  const from = options.from ?? new Phaser.Math.Vector2(640, 350);
  const delayMs = options.delayMs ?? 70;

  const playStep = (index: number) => {
    if (index >= options.steps.length || options.canContinue?.() === false) {
      options.onComplete?.();
      return;
    }

    const step = options.steps[index];
    playDealCard(scene, {
      from,
      to: step.to,
      width: options.cardWidth,
      height: options.cardHeight,
      soundKey: options.soundKey,
      soundVolume: options.soundVolume,
      onComplete: () => {
        step.onArrive?.();
        options.onStepComplete?.(index);
        scene.time.delayedCall(delayMs, () => playStep(index + 1));
      },
    });
  };

  playStep(0);
}

interface DealCardOptions {
  from: Phaser.Math.Vector2;
  to: Phaser.Math.Vector2;
  width?: number;
  height?: number;
  soundKey?: string;
  soundVolume?: number;
  onComplete?: () => void;
}

function playDealCard(scene: Phaser.Scene, options: DealCardOptions): void {
  const width = options.width ?? 34;
  const height = options.height ?? 48;
  const card = scene.add.container(options.from.x, options.from.y).setDepth(30);
  card.add(scene.add.rectangle(0, 0, width, height, 0xf2f2ed, 0.96).setStrokeStyle(2, 0xe8cf73));
  card.add(scene.add.rectangle(0, 0, width * 0.72, height * 0.74, 0x2b303c, 0.18).setStrokeStyle(1, 0x2b303c, 0.45));
  card.add(scene.add.text(0, 0, '?', {
    fontFamily: 'Arial',
    fontSize: `${Math.round(height * 0.42)}px`,
    color: '#101114',
    fontStyle: 'bold',
  }).setOrigin(0.5));

  if (options.soundKey) {
    scene.sound.play(options.soundKey, { volume: options.soundVolume ?? 0.56 });
  }

  scene.tweens.add({
    targets: card,
    x: options.to.x,
    y: options.to.y,
    angle: Phaser.Math.Between(-5, 5),
    duration: 160,
    ease: 'Sine.easeInOut',
    onComplete: () => {
      card.destroy(true);
      options.onComplete?.();
    },
  });
}


import Phaser from 'phaser';

export interface FloatingTextOptions {
  x: number;
  y: number;
  text: string;
  color?: string;
  glow?: string;
  fontSize?: string;
  durationMs?: number;
}

export function showFloatingText(scene: Phaser.Scene, options: FloatingTextOptions): Phaser.GameObjects.Text {
  const color = options.color ?? '#ef6f6c';
  const text = scene.add.text(options.x, options.y, options.text, {
    fontFamily: 'Arial',
    fontSize: options.fontSize ?? '28px',
    color,
    stroke: '#101114',
    strokeThickness: 4,
    fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(80);
  text.setShadow(0, 0, options.glow ?? color, 10, true, true);

  scene.tweens.add({
    targets: text,
    y: options.y - 42,
    alpha: 0,
    duration: options.durationMs ?? 760,
    ease: 'Cubic.easeOut',
    onComplete: () => text.destroy(),
  });

  return text;
}

export function showDamageText(scene: Phaser.Scene, x: number, y: number, amount: number): Phaser.GameObjects.Text {
  return showFloatingText(scene, {
    x,
    y,
    text: `-${amount} HP`,
    color: '#ef6f6c',
    glow: '#ff4b5f',
  });
}

export function showClashText(scene: Phaser.Scene, x: number, y: number, label: string): Phaser.GameObjects.Text {
  return showFloatingText(scene, {
    x,
    y,
    text: label,
    color: '#d9f4ff',
    glow: '#73c7ff',
    fontSize: '26px',
    durationMs: 900,
  });
}

export function shakeContainer(scene: Phaser.Scene, target?: Phaser.GameObjects.Container): void {
  if (!target) {
    return;
  }

  scene.tweens.add({
    targets: target,
    x: target.x + 7,
    duration: 42,
    yoyo: true,
    repeat: 5,
    ease: 'Sine.easeInOut',
  });
}


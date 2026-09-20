import Phaser from 'phaser';

export function addTutorialGuide(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  width: number,
  height: number,
  arrowBelow = false,
): Phaser.GameObjects.Container {
  const guide = scene.add.container(x, y).setDepth(200);
  const glow = scene.add.rectangle(0, 0, width + 12, height + 12, 0xffd86a, 0.08)
    .setStrokeStyle(3, 0xffd86a, 0.95)
    .setBlendMode(Phaser.BlendModes.ADD);
  const arrowY = arrowBelow ? height / 2 + 22 : -height / 2 - 22;
  const arrowGlow = scene.add.triangle(0, arrowY, -13, -12, 13, -12, 0, 12, 0xffd86a, 0.28)
    .setScale(1.45)
    .setBlendMode(Phaser.BlendModes.ADD);
  const arrow = scene.add.triangle(0, arrowY, -11, -10, 11, -10, 0, 10, 0xffe28a, 1)
    .setStrokeStyle(2, 0x7a4310, 0.9);
  if (arrowBelow) {
    arrow.setAngle(180);
    arrowGlow.setAngle(180);
  }
  guide.add([glow, arrowGlow, arrow]);
  parent.add(guide);

  scene.tweens.add({
    targets: [arrow, arrowGlow],
    y: arrowY + (arrowBelow ? -8 : 8),
    duration: 520,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  scene.tweens.add({
    targets: glow,
    alpha: 0.42,
    duration: 680,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  return guide;
}

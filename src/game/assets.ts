import Phaser from 'phaser';

export function preloadCardImages(scene: Phaser.Scene): void {
  for (let index = 1; index <= 54; index += 1) {
    const key = `card-${index}`;
    if (!scene.textures.exists(key)) {
      scene.load.image(key, `/image/cards/${index}.png`);
    }
  }

  if (!scene.textures.exists('card-back')) {
    scene.load.image('card-back', '/image/cards/back.png');
  }
}

import Phaser from 'phaser';

export function preloadResonanceEffects(scene: Phaser.Scene): void {
  if (!scene.cache.audio.exists('resonanceEcho')) {
    scene.load.audio('resonanceEcho', '/audio/echo.wav');
  }
}

export function playResonanceEcho(scene: Phaser.Scene, volume = 0.48): void {
  scene.sound.play('resonanceEcho', { volume });
}


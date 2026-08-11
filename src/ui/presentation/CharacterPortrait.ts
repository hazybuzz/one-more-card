import Phaser from 'phaser';
import type { CharacterArtConfig, CharacterArtPose } from '../art';

export function createCharacterPortrait(
  scene: Phaser.Scene,
  config: CharacterArtConfig,
  pose: CharacterArtPose,
  x: number,
  y: number,
): Phaser.GameObjects.Image | undefined {
  if (!scene.textures.exists(config.asset.textureKey)) {
    return undefined;
  }

  return scene.add.image(x, y, config.asset.textureKey, config.frames[pose])
    .setOrigin(0.5)
    .setDisplaySize(config.displayWidth, config.displayHeight);
}

export function applyCharacterPortraitPose(
  portrait: Phaser.GameObjects.Image,
  config: CharacterArtConfig,
  pose: CharacterArtPose,
): void {
  portrait.setFrame(config.frames[pose]);
}

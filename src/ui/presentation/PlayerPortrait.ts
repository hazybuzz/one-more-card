import Phaser from 'phaser';
import { PLAYER_CHARACTER_ART, type PortraitBackdropConfig } from '../art';
import { applyCharacterPortraitPose, createCharacterPortrait } from './CharacterPortrait';

export type PlayerPortraitPose = 'idle' | 'cast' | 'attack' | 'hurt';

export const PLAYER_PORTRAIT_TEXTURE = PLAYER_CHARACTER_ART.asset.textureKey;

export const PLAYER_PORTRAIT_FRAMES = PLAYER_CHARACTER_ART.frames;

export function preloadPlayerPortraits(scene: Phaser.Scene): void {
  if (scene.textures.exists(PLAYER_PORTRAIT_TEXTURE)) {
    return;
  }

  const asset = PLAYER_CHARACTER_ART.asset;
  if (asset.kind === 'spritesheet') {
    scene.load.spritesheet(asset.textureKey, asset.path, {
      frameWidth: asset.frameWidth,
      frameHeight: asset.frameHeight,
    });
  }
}

export function configurePlayerPortraitTextures(scene: Phaser.Scene): void {
  scene.textures.get(PLAYER_PORTRAIT_TEXTURE).setFilter(Phaser.Textures.FilterMode.NEAREST);
}

export function applyPlayerPortraitPose(
  portrait: Phaser.GameObjects.Image,
  pose: PlayerPortraitPose,
  backdrop?: PortraitBackdropConfig,
): void {
  applyCharacterPortraitPose(portrait, PLAYER_CHARACTER_ART, pose, backdrop);
}

export function createPlayerPortrait(
  scene: Phaser.Scene,
  pose: PlayerPortraitPose,
  x: number,
  y: number,
  backdrop?: PortraitBackdropConfig,
): Phaser.GameObjects.Image {
  const portrait = createCharacterPortrait(scene, PLAYER_CHARACTER_ART, pose, x, y, backdrop);
  if (!portrait) {
    throw new Error(`Player portrait texture is not loaded: ${PLAYER_PORTRAIT_TEXTURE}`);
  }
  return portrait;
}

import Phaser from 'phaser';
import type { CharacterArtConfig, CharacterArtPose, PortraitBackdropConfig } from '../art';

function portraitTextureKey(
  config: CharacterArtConfig,
  pose: CharacterArtPose,
  backdrop?: PortraitBackdropConfig,
): string {
  const offset = config.poseOffsets?.[pose] ?? { x: 0, y: 0 };
  const backdropVersion = backdrop ? `-${backdrop.id}` : '';
  return `${config.asset.textureKey}-portrait-frame-${config.frames[pose]}-${offset.x}-${offset.y}${backdropVersion}-opaque-v2`;
}

function makePortraitPixelsOpaque(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  for (let index = 3; index < pixels.length; index += 4) {
    const alpha = pixels[index];
    pixels[index] = alpha < 24 ? 0 : 255;
  }
  context.putImageData(imageData, 0, 0);
}

function ensurePortraitTexture(
  scene: Phaser.Scene,
  config: CharacterArtConfig,
  pose: CharacterArtPose,
  backdrop?: PortraitBackdropConfig,
): string | undefined {
  const sourceKey = config.asset.textureKey;
  if (!scene.textures.exists(sourceKey)) {
    return undefined;
  }

  const textureKey = portraitTextureKey(config, pose, backdrop);
  if (scene.textures.exists(textureKey)) {
    return textureKey;
  }

  const sourceFrame = scene.textures.getFrame(sourceKey, config.frames[pose]);
  if (!sourceFrame) {
    return undefined;
  }

  const width = sourceFrame.cutWidth / sourceFrame.source.resolution;
  const height = sourceFrame.cutHeight / sourceFrame.source.resolution;
  const texture = scene.textures.createCanvas(textureKey, width, height);
  if (!texture) {
    return undefined;
  }

  const context = texture.getContext();
  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = false;
  const offset = config.poseOffsets?.[pose] ?? { x: 0, y: 0 };
  texture.drawFrame(sourceKey, config.frames[pose], offset.x, offset.y, false);
  makePortraitPixelsOpaque(context, width, height);
  texture.update();

  if (config.asset.pixelArt) {
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  return textureKey;
}

export function createCharacterPortrait(
  scene: Phaser.Scene,
  config: CharacterArtConfig,
  pose: CharacterArtPose,
  x: number,
  y: number,
  backdrop?: PortraitBackdropConfig,
): Phaser.GameObjects.Image | undefined {
  const textureKey = ensurePortraitTexture(scene, config, pose, backdrop);
  if (!textureKey) {
    return undefined;
  }

  return scene.add.image(x, y, textureKey)
    .setOrigin(0.5)
    .setDisplaySize(config.displayWidth, config.displayHeight);
}

export function applyCharacterPortraitPose(
  portrait: Phaser.GameObjects.Image,
  config: CharacterArtConfig,
  pose: CharacterArtPose,
  backdrop?: PortraitBackdropConfig,
): void {
  const textureKey = ensurePortraitTexture(portrait.scene, config, pose, backdrop);
  if (textureKey) {
    portrait.setTexture(textureKey);
  }
}

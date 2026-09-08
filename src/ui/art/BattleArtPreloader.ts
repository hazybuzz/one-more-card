import Phaser from 'phaser';
import type { EnemyId } from '../../game/types/enemy';
import { getBattleThemeArt, getEnemyCharacterArt, PLAYER_CHARACTER_ART } from './BattleArtRegistry';
import type { ArtAsset, BattleArtSelection, BattleThemeArtManifest, CharacterArtConfig, ImageArtAsset } from './types';

const CHARACTER_ART_DEPENDENCIES: Partial<Record<EnemyId, EnemyId[]>> = {
  valkyrie: ['einherjar'],
};

export function preloadBattleArt(scene: Phaser.Scene, selection: BattleArtSelection): void {
  preloadCharacterArt(scene, PLAYER_CHARACTER_ART);
  characterArtIds(selection).forEach((enemyId) => {
    const art = getEnemyCharacterArt(enemyId);
    if (art) {
      preloadCharacterArt(scene, art);
    }
  });

  const theme = getBattleThemeArt(selection.themeId);
  themeAssets(theme).forEach((asset) => preloadAsset(scene, asset));
}

export function configureBattleArtTextures(scene: Phaser.Scene, selection: BattleArtSelection): void {
  const assets: ArtAsset[] = [PLAYER_CHARACTER_ART.asset];
  characterArtIds(selection).forEach((enemyId) => {
    const art = getEnemyCharacterArt(enemyId);
    if (art) {
      assets.push(art.asset);
    }
  });
  assets.push(...themeAssets(getBattleThemeArt(selection.themeId)));

  assets.forEach((asset) => {
    if (asset.pixelArt && scene.textures.exists(asset.textureKey)) {
      scene.textures.get(asset.textureKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  });
}

function characterArtIds(selection: BattleArtSelection): EnemyId[] {
  const ids = new Set<EnemyId>(selection.enemyIds);
  const pending = [...selection.enemyIds];

  while (pending.length > 0) {
    const enemyId = pending.pop()!;
    CHARACTER_ART_DEPENDENCIES[enemyId]?.forEach((dependencyId) => {
      if (!ids.has(dependencyId)) {
        ids.add(dependencyId);
        pending.push(dependencyId);
      }
    });
  }

  return [...ids];
}

function preloadCharacterArt(scene: Phaser.Scene, config: CharacterArtConfig): void {
  preloadAsset(scene, config.asset);
}

function preloadAsset(scene: Phaser.Scene, asset: ArtAsset): void {
  if (scene.textures.exists(asset.textureKey)) {
    return;
  }

  if (asset.kind === 'spritesheet') {
    scene.load.spritesheet(asset.textureKey, asset.path, {
      frameWidth: asset.frameWidth,
      frameHeight: asset.frameHeight,
    });
    return;
  }

  scene.load.image(asset.textureKey, asset.path);
}

function themeAssets(theme: BattleThemeArtManifest): ArtAsset[] {
  const assets = [
    theme.background,
    ...(theme.backgroundVariants ?? []),
    theme.tableOverlay,
    theme.foreground,
    theme.playerFrame,
    theme.enemyFrame,
    theme.playerPanel,
    theme.enemyPanel,
    theme.actionBar,
    theme.actionButton,
    theme.modalPanel,
    theme.tooltipPanel,
  ].filter((asset): asset is ImageArtAsset => Boolean(asset));
  return [...new Map(assets.map((asset) => [asset.textureKey, asset])).values()];
}

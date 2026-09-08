import Phaser from 'phaser';
import type { IntroSequenceConfig } from '../../game/data/introSequences';
import type { EnemyId } from '../../game/types/enemy';
import { preloadCardBack } from '../../game/assets';
import { getEnemyCharacterArt } from '../art/BattleArtRegistry';

export const STORY_BACKGROUND = {
  key: 'story-chapter-one-tavern-background',
  path: '/image/story/chapter1/tavern-dialogue-background.png',
};

export interface StoryPortraitAsset {
  key: string;
  path: string;
}

const STORY_PORTRAIT_OVERRIDES: Partial<Record<EnemyId, StoryPortraitAsset>> = {
  bartender: {
    key: 'story-bartender-idle-hd',
    path: '/image/story/chapter1/characters/bartender-idle-hd.png',
  },
  goblin: {
    key: 'story-goblin-idle-hd',
    path: '/image/story/chapter1/characters/goblin-idle-hd.png',
  },
  gambler: {
    key: 'story-gambler-idle-hd',
    path: '/image/story/chapter1/characters/gambler-idle-hd.png',
  },
  werewolf: {
    key: 'story-werewolf-idle-hd',
    path: '/image/story/chapter1/characters/werewolf-idle-hd.png',
  },
  paladin: {
    key: 'story-paladin-idle-hd',
    path: '/image/story/chapter1/characters/paladin-idle-hd.png',
  },
  merchant: {
    key: 'story-merchant-idle-hd',
    path: '/image/story/chapter1/characters/merchant-idle-hd.png',
  },
  keeper: {
    key: 'story-keeper-idle-hd',
    path: '/image/story/chapter1/characters/keeper-idle-hd.png',
  },
};

export function getStoryPortraitAsset(actorId: EnemyId): StoryPortraitAsset | undefined {
  return STORY_PORTRAIT_OVERRIDES[actorId];
}

export function preloadStoryArt(scene: Phaser.Scene, intro: IntroSequenceConfig): void {
  if (!scene.textures.exists(STORY_BACKGROUND.key)) {
    scene.load.image(STORY_BACKGROUND.key, STORY_BACKGROUND.path);
  }

  preloadCardBack(scene);

  intro.cast?.forEach(({ actorId }) => {
    const storyPortrait = getStoryPortraitAsset(actorId);
    if (storyPortrait) {
      if (!scene.textures.exists(storyPortrait.key)) {
        scene.load.image(storyPortrait.key, storyPortrait.path);
      }
      return;
    }

    const art = getEnemyCharacterArt(actorId);
    if (!art || scene.textures.exists(art.asset.textureKey)) {
      return;
    }

    if (art.asset.kind === 'spritesheet') {
      scene.load.spritesheet(art.asset.textureKey, art.asset.path, {
        frameWidth: art.asset.frameWidth,
        frameHeight: art.asset.frameHeight,
      });
      return;
    }

    scene.load.image(art.asset.textureKey, art.asset.path);
  });
}

export function configureStoryArtTextures(scene: Phaser.Scene, intro: IntroSequenceConfig): void {
  intro.cast?.forEach(({ actorId }) => {
    const storyPortrait = getStoryPortraitAsset(actorId);
    if (storyPortrait && scene.textures.exists(storyPortrait.key)) {
      scene.textures.get(storyPortrait.key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      return;
    }

    const art = getEnemyCharacterArt(actorId);
    if (art?.asset.pixelArt && scene.textures.exists(art.asset.textureKey)) {
      scene.textures.get(art.asset.textureKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  });
}

import Phaser from 'phaser';
import type { CosmeticId } from '../../game/cosmetics';

export interface CosmeticCatalogArt {
  textureKey: string;
  path: string;
  angle: number;
  accentColor: number;
}

const COSMETIC_CATALOG_ART: Record<CosmeticId, CosmeticCatalogArt> = {
  thunder_hammer: {
    textureKey: 'catalog-cosmetic-thunder-hammer',
    path: '/image/battle/effects/player/thunder-hammer.png',
    angle: -18,
    accentColor: 0x70d6ff,
  },
  jade_sword_array: {
    textureKey: 'catalog-cosmetic-jade-sword',
    path: '/image/battle/effects/player/jade-sword.png',
    angle: 42,
    accentColor: 0x65dfbd,
  },
  sakura_slash: {
    textureKey: 'catalog-cosmetic-sakura-katana',
    path: '/image/battle/effects/player/sakura-katana.png',
    angle: -18,
    accentColor: 0xff79bd,
  },
};

export function getCosmeticCatalogArt(id: CosmeticId): CosmeticCatalogArt {
  return COSMETIC_CATALOG_ART[id];
}

export function preloadCosmeticCatalogArt(scene: Phaser.Scene): void {
  Object.values(COSMETIC_CATALOG_ART).forEach((art) => {
    if (!scene.textures.exists(art.textureKey)) {
      scene.load.image(art.textureKey, art.path);
    }
  });
}

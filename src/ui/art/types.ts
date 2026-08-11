import type { EnemyId } from '../../game/types/enemy';
import type { TableThemeId } from '../../game/types/tableTheme';

export type CharacterArtPose = 'idle' | 'cast' | 'attack' | 'hurt';

export interface ImageArtAsset {
  kind: 'image';
  textureKey: string;
  path: string;
  pixelArt?: boolean;
}

export interface SpriteSheetArtAsset {
  kind: 'spritesheet';
  textureKey: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
  pixelArt?: boolean;
}

export type ArtAsset = ImageArtAsset | SpriteSheetArtAsset;

export interface NineSliceArtAsset extends ImageArtAsset {
  leftWidth: number;
  rightWidth: number;
  topHeight: number;
  bottomHeight: number;
}

export interface CharacterArtConfig {
  id: string;
  asset: ArtAsset;
  frames: Record<CharacterArtPose, number>;
  displayWidth: number;
  displayHeight: number;
}

export interface BattleThemeArtManifest {
  themeId: TableThemeId;
  background?: ImageArtAsset;
  tableOverlay?: ImageArtAsset;
  foreground?: ImageArtAsset;
  playerFrame?: NineSliceArtAsset;
  enemyFrame?: NineSliceArtAsset;
  playerPanel?: NineSliceArtAsset;
  enemyPanel?: NineSliceArtAsset;
  actionBar?: NineSliceArtAsset;
}

export interface BattleArtSelection {
  themeId: TableThemeId;
  enemyIds: EnemyId[];
}

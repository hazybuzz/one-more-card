import type { EnemyId } from '../../game/types/enemy';
import type { TableThemeId } from '../../game/types/tableTheme';

export type CharacterArtPose = 'idle' | 'cast' | 'attack' | 'hurt';

export interface ImageArtAsset {
  kind: 'image';
  textureKey: string;
  path: string;
  pixelArt?: boolean;
  fit?: 'stretch' | 'cover';
  x?: number;
  y?: number;
  displayWidth?: number;
  displayHeight?: number;
}

export interface BackgroundArtAsset extends ImageArtAsset {
  brightenAlpha?: number;
  includesTable?: boolean;
  tableCandlePositions?: Array<{ x: number; y: number; scale?: number }>;
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

export interface CharacterFrameArtAsset extends ImageArtAsset {
  displayScale?: number;
  offsetX?: number;
  offsetY?: number;
  leftWidth?: number;
  rightWidth?: number;
  topHeight?: number;
  bottomHeight?: number;
}

export interface CharacterArtConfig {
  id: string;
  asset: ArtAsset;
  frames: Record<CharacterArtPose, number>;
  poseOffsets?: Partial<Record<CharacterArtPose, { x: number; y: number }>>;
  displayWidth: number;
  displayHeight: number;
}

export type PortraitBackdropMotif = 'fate' | 'coins' | 'cards' | 'moon' | 'tavern';

export interface PortraitBackdropConfig {
  id: string;
  baseColor: number;
  secondaryColor: number;
  accentColor: number;
  motif: PortraitBackdropMotif;
  seed: number;
  rimColor?: number;
  rimStrength?: number;
}

export interface BattleThemeArtManifest {
  themeId: TableThemeId;
  background?: BackgroundArtAsset;
  tableOverlay?: ImageArtAsset;
  foreground?: ImageArtAsset;
  playerFrame?: CharacterFrameArtAsset;
  enemyFrame?: CharacterFrameArtAsset;
  playerPanel?: NineSliceArtAsset;
  enemyPanel?: NineSliceArtAsset;
  actionBar?: NineSliceArtAsset;
}

export interface BattleArtSelection {
  themeId: TableThemeId;
  enemyIds: EnemyId[];
}

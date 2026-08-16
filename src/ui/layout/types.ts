export interface LayoutPoint {
  x: number;
  y: number;
}

export interface LayoutRect extends LayoutPoint {
  width: number;
  height: number;
}

export type HorizontalAnchorEdge = 'left' | 'center' | 'right';
export type VerticalAnchorEdge = 'top' | 'center' | 'bottom';

export interface RelativePanelAnchor {
  horizontal: HorizontalAnchorEdge;
  vertical: VerticalAnchorEdge;
  x: number;
  y: number;
}

export interface CombatantPanelAnchorConfig {
  name: RelativePanelAnchor;
  hp: RelativePanelAnchor;
  subtitle: RelativePanelAnchor;
  cardRow: RelativePanelAnchor;
  score: RelativePanelAnchor;
  resonance: RelativePanelAnchor;
  portrait: RelativePanelAnchor;
  speech: RelativePanelAnchor;
  passive: RelativePanelAnchor;
  statusPrimary: RelativePanelAnchor;
  statusAttack: RelativePanelAnchor;
  talisman: RelativePanelAnchor;
  passiveTooltipOffset: LayoutPoint;
}

export type CombatantLayoutVariant = 'player' | 'enemy-top' | 'enemy-left' | 'enemy-side';

export interface CombatantPanelLayoutConfig {
  variants: Record<CombatantLayoutVariant, CombatantPanelAnchorConfig>;
  frame: {
    headerHeight: number;
    headerCenterTopInset: number;
    headerDividerTopInset: number;
    horizontalInset: number;
    contentDividerScoreOffsetX: number;
    contentDividerY: number;
    contentDividerMinimumHeight: number;
    contentDividerHeightInset: number;
    playerPortraitRadius: number;
    focusPadding: number;
    focusMarkerSize: number;
    focusMarkerGap: number;
  };
}

export interface PlayerHudLayoutConfig {
  health: LayoutPoint;
  statuses: LayoutPoint;
  portrait: LayoutRect;
  name: LayoutPoint;
  hand: LayoutPoint;
  handGap: number;
  utilityBar: LayoutPoint;
  utilityGap: number;
  actions: LayoutPoint;
  scoreGap: number;
  orbitRadiusX: number;
  orbitRadiusY: number;
}

export type EnemyHudSeat = 'left' | 'top' | 'right';

export interface EnemyHudLayoutConfig {
  health: LayoutPoint;
  statuses: LayoutPoint;
  portrait: LayoutRect;
  name: LayoutPoint;
  hand: LayoutPoint;
  scoreSide: 'left' | 'right';
  scoreGap: number;
  speech: LayoutPoint;
  passivePosition: 'top-left' | 'bottom-left' | 'top-right' | 'bottom-right';
  orbitRadiusX: number;
  orbitRadiusY: number;
}

export interface BattleLayoutConfig {
  id: string;
  canvas: { width: number; height: number };
  seats: {
    player: LayoutRect;
    enemies: [LayoutRect, LayoutRect, LayoutRect];
  };
  centerInfo: LayoutPoint;
  stageBanner: LayoutPoint;
  dealOrigin: LayoutPoint;
  commandBar: LayoutRect;
  playerControls: {
    item: RelativePanelAnchor;
    skills: RelativePanelAnchor;
  };
  playerHud: PlayerHudLayoutConfig;
  enemyHud: Record<EnemyHudSeat, EnemyHudLayoutConfig>;
  hud: {
    logButton: LayoutPoint;
    exitButton: LayoutPoint;
  };
  cards: {
    width: number;
    spacing: number;
    enemyWidth: number;
    enemySpacing: number;
  };
  combatantPanel: CombatantPanelLayoutConfig;
}

export function resolveRelativePanelAnchor(anchor: RelativePanelAnchor, width: number, height: number): LayoutPoint {
  const baseX = anchor.horizontal === 'left' ? -width / 2 : anchor.horizontal === 'right' ? width / 2 : 0;
  const baseY = anchor.vertical === 'top' ? -height / 2 : anchor.vertical === 'bottom' ? height / 2 : 0;
  return { x: baseX + anchor.x, y: baseY + anchor.y };
}

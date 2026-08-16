import Phaser from 'phaser';
import {
  resolveRelativePanelAnchor,
  type CombatantLayoutVariant,
  type CombatantPanelLayoutConfig,
} from '../layout';
import type { NineSliceArtAsset } from '../art';

export type CombatantPanelVariant = CombatantLayoutVariant;

export interface PanelAnchor {
  x: number;
  y: number;
}

export interface CombatantPanelLayout {
  width: number;
  height: number;
  variant: CombatantPanelVariant;
  name: PanelAnchor;
  hp: PanelAnchor;
  subtitle: PanelAnchor;
  cardRow: PanelAnchor;
  score: PanelAnchor;
  resonance: PanelAnchor;
  portrait: PanelAnchor;
  speech: PanelAnchor;
  passive: PanelAnchor;
  statusPrimary: PanelAnchor;
  statusAttack: PanelAnchor;
  talisman: PanelAnchor;
  passiveTooltipOffset: PanelAnchor;
}

interface CombatantPanelOptions {
  width: number;
  height: number;
  variant: CombatantPanelVariant;
  layoutConfig: CombatantPanelLayoutConfig;
  panelColor: number;
  panelAltColor: number;
  lineColor: number;
  accentColor: number;
  active?: boolean;
  defeated?: boolean;
  defeatedColor?: number;
  focusColor?: number;
  skin?: NineSliceArtAsset;
}

export class CombatantPanel {
  static layout(
    width: number,
    height: number,
    variant: CombatantPanelVariant,
    layoutConfig: CombatantPanelLayoutConfig,
  ): CombatantPanelLayout {
    const anchors = layoutConfig.variants[variant];

    return {
      width,
      height,
      variant,
      name: resolveRelativePanelAnchor(anchors.name, width, height),
      hp: resolveRelativePanelAnchor(anchors.hp, width, height),
      subtitle: resolveRelativePanelAnchor(anchors.subtitle, width, height),
      cardRow: resolveRelativePanelAnchor(anchors.cardRow, width, height),
      score: resolveRelativePanelAnchor(anchors.score, width, height),
      resonance: resolveRelativePanelAnchor(anchors.resonance, width, height),
      portrait: resolveRelativePanelAnchor(anchors.portrait, width, height),
      speech: resolveRelativePanelAnchor(anchors.speech, width, height),
      passive: resolveRelativePanelAnchor(anchors.passive, width, height),
      statusPrimary: resolveRelativePanelAnchor(anchors.statusPrimary, width, height),
      statusAttack: resolveRelativePanelAnchor(anchors.statusAttack, width, height),
      talisman: resolveRelativePanelAnchor(anchors.talisman, width, height),
      passiveTooltipOffset: anchors.passiveTooltipOffset,
    };
  }

  static render(scene: Phaser.Scene, options: CombatantPanelOptions): {
    container: Phaser.GameObjects.Container;
    layout: CombatantPanelLayout;
  } {
    const layout = this.layout(options.width, options.height, options.variant, options.layoutConfig);
    const frame = options.layoutConfig.frame;
    const container = scene.add.container(0, 0);
    const fillColor = options.defeated
      ? (options.defeatedColor ?? 0x24262b)
      : (options.active ? options.panelAltColor : options.panelColor);
    const borderColor = options.active ? options.accentColor : options.lineColor;

    const hasSkin = options.skin && scene.textures.exists(options.skin.textureKey);
    const body = hasSkin
      ? scene.add.nineslice(
        0,
        0,
        options.skin!.textureKey,
        undefined,
        options.width,
        options.height,
        options.skin!.leftWidth,
        options.skin!.rightWidth,
        options.skin!.topHeight,
        options.skin!.bottomHeight,
      ).setAlpha(options.defeated ? 0.54 : 0.82)
      : scene.add.rectangle(0, 0, options.width, options.height, fillColor, options.defeated ? 0.36 : 0.48)
        .setStrokeStyle(2, borderColor, options.defeated ? 0.46 : 0.7);
    const innerOutline = scene.add.rectangle(0, 0, options.width - 10, options.height - 10, 0x000000, 0)
      .setStrokeStyle(1, 0xffffff, options.defeated ? 0.06 : 0.12);
    const contentDivider = options.variant === 'player'
      ? scene.add.rectangle(0, 68, options.width - 28, 1, options.lineColor, 0.28)
      : scene.add.rectangle(0, 8, 1, options.height - 28, options.lineColor, 0.22);
    container.add([body, innerOutline, contentDivider]);

    if (options.active && !options.defeated) {
      const focusColor = options.focusColor ?? options.accentColor;
      const focusOutline = scene.add.rectangle(0, 0, options.width + frame.focusPadding, options.height + frame.focusPadding, focusColor, 0.025)
        .setStrokeStyle(3, focusColor, 0.92);
      const focusEdge = scene.add.rectangle(0, -options.height / 2 + 3, Math.min(104, options.width * 0.32), 3, focusColor, 0.92);
      container.add([focusOutline, focusEdge]);
      scene.tweens.add({
        targets: [focusOutline, focusEdge],
        alpha: { from: 0.48, to: 1 },
        duration: 920,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });
      focusOutline.once(Phaser.GameObjects.Events.DESTROY, () => {
        scene.tweens.killTweensOf([focusOutline, focusEdge]);
      });
    }

    if (options.defeated) {
      container.setAlpha(0.82);
    }

    return { container, layout };
  }
}

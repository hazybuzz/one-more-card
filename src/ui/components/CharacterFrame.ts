import Phaser from 'phaser';
import type { CharacterFrameArtAsset } from '../art';

interface CharacterFrameOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  accentColor: number;
  backgroundColor?: number;
  skin?: CharacterFrameArtAsset;
  shape?: 'rectangle' | 'circle';
  backdrop?: 'none' | 'diamond';
  active?: boolean;
  muted?: boolean;
}

type NineSliceCharacterFrameArtAsset = CharacterFrameArtAsset & {
  leftWidth: number;
  rightWidth: number;
  topHeight: number;
  bottomHeight: number;
};

const ACTIVE_FRAME_PULSE_DURATION = 2200;
const ACTIVE_SEGMENT_DURATION = 760;
const ACTIVE_SEGMENT_DELAY = 520;
const ACTIVE_SEGMENT_REPEAT_DELAY = 1400;

function isNineSliceSkin(asset: CharacterFrameArtAsset): asset is NineSliceCharacterFrameArtAsset {
  return asset.leftWidth !== undefined
    && asset.rightWidth !== undefined
    && asset.topHeight !== undefined
    && asset.bottomHeight !== undefined;
}

export class CharacterFrame {
  readonly container: Phaser.GameObjects.Container;
  readonly portraitBackdropLayer: Phaser.GameObjects.Container;
  readonly portraitLayer: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, options: CharacterFrameOptions) {
    this.container = scene.make.container({
      x: options.x,
      y: options.y,
      add: false,
    });
    const alpha = options.muted ? 0.45 : 1;
    const shape = options.shape ?? 'rectangle';

    if (shape === 'circle') {
      this.portraitBackdropLayer = scene.make.container({ x: 0, y: 0, add: false }).setAlpha(alpha);
      this.portraitLayer = scene.make.container({ x: 0, y: 0, add: false });
      this.createCircularFrame(scene, options, alpha);
      return;
    }

    const background = scene.add.rectangle(0, 0, options.width, options.height, options.backgroundColor ?? 0x10151d, 0.92)
      .setStrokeStyle(2, options.accentColor, 0.3 * alpha);
    this.portraitBackdropLayer = scene.make.container({ x: 0, y: 0, add: false }).setAlpha(alpha);
    this.portraitLayer = scene.make.container({ x: 0, y: 0, add: false });
    const innerBorder = scene.add.rectangle(0, 0, options.width - 10, options.height - 10, 0x000000, 0)
      .setStrokeStyle(1, 0xffffff, 0.15 * alpha);
    const outerBorder = scene.add.rectangle(0, 0, options.width + 8, options.height + 8, 0x000000, 0)
      .setStrokeStyle(options.active ? 4 : 2, options.accentColor, (options.active ? 1 : 0.72) * alpha);
    const namePlate = scene.add.rectangle(0, options.height / 2 - 14, options.width - 12, 24, 0x090b10, 0.88)
      .setStrokeStyle(1, options.accentColor, 0.42 * alpha);
    this.container.add([background, this.portraitBackdropLayer, this.portraitLayer]);

    const skin = options.skin;
    const hasSkin = Boolean(skin && scene.textures.exists(skin.textureKey));
    if (skin && hasSkin && isNineSliceSkin(skin)) {
      this.container.add(scene.add.nineslice(
        0,
        0,
        skin.textureKey,
        undefined,
        options.width + 8,
        options.height + 8,
        skin.leftWidth,
        skin.rightWidth,
        skin.topHeight,
        skin.bottomHeight,
      ).setAlpha(alpha));
    }

    this.container.add([innerBorder, outerBorder, namePlate]);

    if (options.active) {
      const focusWidth = options.width + 14;
      const focusHeight = options.height + 14;
      const themeGlow = scene.add.rectangle(0, 0, focusWidth + 8, focusHeight + 8, 0x000000, 0)
        .setStrokeStyle(3, options.accentColor, 0.22);
      const separator = scene.add.rectangle(0, 0, focusWidth + 3, focusHeight + 3, 0x000000, 0)
        .setStrokeStyle(6, 0x050608, 0.92);
      const focusBorder = scene.add.rectangle(0, 0, focusWidth, focusHeight, 0x000000, 0)
        .setStrokeStyle(1, 0xfff6df, 0.58);
      const horizontalLength = Math.round(options.width * 0.3);
      const verticalLength = Math.round(options.height * 0.26);
      const segments = [
        this.focusSegment(scene, 0, -focusHeight / 2, horizontalLength, 3),
        this.focusSegment(scene, focusWidth / 2, 0, 3, verticalLength),
        this.focusSegment(scene, 0, focusHeight / 2, horizontalLength, 3),
        this.focusSegment(scene, -focusWidth / 2, 0, 3, verticalLength),
      ];
      this.container.add([themeGlow, separator, focusBorder, ...segments]);

      scene.tweens.add({
        targets: [themeGlow, focusBorder],
        alpha: { from: 0.4, to: 0.72 },
        duration: ACTIVE_FRAME_PULSE_DURATION,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      segments.forEach((segment, index) => {
        scene.tweens.add({
          targets: segment,
          alpha: { from: 0.1, to: 0.55 },
          duration: ACTIVE_SEGMENT_DURATION,
          delay: index * ACTIVE_SEGMENT_DELAY,
          yoyo: true,
          repeat: -1,
          repeatDelay: ACTIVE_SEGMENT_REPEAT_DELAY,
          ease: 'Sine.easeInOut',
        });
      });
      focusBorder.once(Phaser.GameObjects.Events.DESTROY, () => {
        scene.tweens.killTweensOf([themeGlow, focusBorder, ...segments]);
      });
    }
  }

  addPortrait(portrait: Phaser.GameObjects.GameObject): void {
    this.portraitLayer.add(portrait);
    this.container.bringToTop(this.portraitLayer);
  }

  addPortraitBackdrop(backdrop: Phaser.GameObjects.GameObject): void {
    this.portraitBackdropLayer.add(backdrop);
  }

  private createCircularFrame(scene: Phaser.Scene, options: CharacterFrameOptions, alpha: number): void {
    const radius = Math.min(options.width, options.height) / 2;
    const skin = options.skin;
    const hasSkin = Boolean(skin && scene.textures.exists(skin.textureKey));
    if (options.backdrop === 'diamond' && !hasSkin) {
      this.container.add(this.createDiamondBackdrop(scene, radius, options.accentColor, alpha, Boolean(options.active)));
    }
    const ambientHalo = this.createCircularAmbientHalo(
      scene,
      radius,
      options.accentColor,
      alpha,
      options.x * 17 + options.y * 11,
    );
    this.container.add(ambientHalo);
    const background = scene.add.circle(0, 0, radius, options.backgroundColor ?? 0x080a0f, 1)
      .setStrokeStyle(2, options.accentColor, 0.32 * alpha);
    this.container.add([background, this.portraitBackdropLayer, this.portraitLayer]);
    if (skin && hasSkin) {
      const scale = skin.displayScale ?? 1;
      const skinOverlay = scene.make.image({
        x: skin.offsetX ?? 0,
        y: skin.offsetY ?? 0,
        key: skin.textureKey,
        add: false,
      });
      skinOverlay.setDisplaySize(options.width * scale, options.height * scale).setAlpha(alpha);
      this.container.add(skinOverlay);
    } else {
      const innerBorder = scene.add.circle(0, 0, radius - 7, 0x000000, 0)
        .setStrokeStyle(1, 0xffffff, 0.17 * alpha);
      const outerBorder = scene.add.circle(0, 0, radius + 4, 0x000000, 0)
        .setStrokeStyle(options.active ? 4 : 2, options.accentColor, (options.active ? 1 : 0.76) * alpha);
      this.container.add([innerBorder, outerBorder]);
    }

    if (!options.active) {
      return;
    }

    const focusRadius = radius + 10;
    const themeGlow = scene.add.circle(0, 0, focusRadius + 5, 0x000000, 0)
      .setStrokeStyle(3, options.accentColor, 0.2);
    const separator = scene.add.circle(0, 0, focusRadius + 1, 0x000000, 0)
      .setStrokeStyle(6, 0x050608, 0.92);
    const focusBorder = scene.add.circle(0, 0, focusRadius - 2, 0x000000, 0)
      .setStrokeStyle(1, 0xfff6df, 0.58);
    const segments = Array.from({ length: 4 }, (_, index) => this.focusArc(
      scene,
      focusRadius + 2,
      -Math.PI / 2 + index * Math.PI / 2 + 0.16,
      -Math.PI / 2 + index * Math.PI / 2 + 0.66,
    ));
    this.container.add([themeGlow, separator, focusBorder, ...segments]);

    scene.tweens.add({
      targets: [themeGlow, focusBorder],
      alpha: { from: 0.4, to: 0.72 },
      duration: ACTIVE_FRAME_PULSE_DURATION,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    segments.forEach((segment, index) => {
      scene.tweens.add({
        targets: segment,
        alpha: { from: 0.1, to: 0.55 },
        duration: ACTIVE_SEGMENT_DURATION,
        delay: index * ACTIVE_SEGMENT_DELAY,
        yoyo: true,
        repeat: -1,
        repeatDelay: ACTIVE_SEGMENT_REPEAT_DELAY,
        ease: 'Sine.easeInOut',
      });
    });
    focusBorder.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.tweens.killTweensOf([themeGlow, focusBorder, ...segments]);
    });
  }

  private createCircularAmbientHalo(
    scene: Phaser.Scene,
    radius: number,
    color: number,
    alpha: number,
    phaseOffset: number,
  ): Phaser.GameObjects.Container {
    const halo = scene.add.container(0, 0);
    const outerGlow = scene.add.circle(0, 0, radius + 6, 0x000000, 0)
      .setStrokeStyle(8, color, 0.12 * alpha);
    const edgeGlow = scene.add.circle(0, 0, radius + 2, 0x000000, 0)
      .setStrokeStyle(2, color, 0.28 * alpha);
    halo.add([outerGlow, edgeGlow]);

    const updateGlow = (): void => {
      const pulse = 0.5 + Math.sin((scene.time.now + phaseOffset) / 760) * 0.5;
      outerGlow.setAlpha((0.34 + pulse * 0.46) * alpha);
      edgeGlow.setAlpha((0.48 + pulse * 0.42) * alpha);
      outerGlow.setScale(0.985 + pulse * 0.035);
      edgeGlow.setScale(0.995 + pulse * 0.012);
    };
    scene.events.on(Phaser.Scenes.Events.UPDATE, updateGlow);
    updateGlow();
    halo.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.UPDATE, updateGlow);
    });
    return halo;
  }

  private createDiamondBackdrop(
    scene: Phaser.Scene,
    radius: number,
    accentColor: number,
    alpha: number,
    active: boolean,
  ): Phaser.GameObjects.Container {
    const backdrop = scene.add.container(0, 0).setAlpha(alpha);
    const outerExtent = radius + 20;
    const innerExtent = radius + 10;
    const fill = scene.add.graphics();
    fill.fillStyle(accentColor, 0.045);
    fill.beginPath();
    fill.moveTo(0, -outerExtent);
    fill.lineTo(outerExtent, 0);
    fill.lineTo(0, outerExtent);
    fill.lineTo(-outerExtent, 0);
    fill.closePath();
    fill.fillPath();

    const corners = Array.from({ length: 4 }, (_, index) => this.diamondCorner(
      scene,
      outerExtent,
      innerExtent,
      index,
      accentColor,
    ));
    backdrop.add([fill, ...corners]);

    if (!active) {
      return backdrop;
    }

    scene.tweens.add({
      targets: backdrop,
      angle: { from: -4, to: 4 },
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    corners.forEach((corner, index) => {
      scene.tweens.add({
        targets: corner,
        alpha: { from: 0.44, to: 1 },
        duration: 420,
        delay: index * 260,
        yoyo: true,
        repeat: -1,
        repeatDelay: 900,
        ease: 'Sine.easeInOut',
      });
    });
    backdrop.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.tweens.killTweensOf([backdrop, ...corners]);
    });
    return backdrop;
  }

  private diamondCorner(
    scene: Phaser.Scene,
    outerExtent: number,
    innerExtent: number,
    index: number,
    accentColor: number,
  ): Phaser.GameObjects.Graphics {
    const corner = scene.add.graphics();
    this.drawDiamondCorner(corner, outerExtent, index, 24, 2, accentColor, 0.3);
    this.drawDiamondCorner(corner, innerExtent, index, 18, 1, 0xfff6df, 0.17);
    return corner;
  }

  private drawDiamondCorner(
    graphics: Phaser.GameObjects.Graphics,
    extent: number,
    index: number,
    length: number,
    lineWidth: number,
    color: number,
    alpha: number,
  ): void {
    const vertices = [
      { x: 0, y: -extent, before: { x: -length, y: -extent + length }, after: { x: length, y: -extent + length } },
      { x: extent, y: 0, before: { x: extent - length, y: -length }, after: { x: extent - length, y: length } },
      { x: 0, y: extent, before: { x: length, y: extent - length }, after: { x: -length, y: extent - length } },
      { x: -extent, y: 0, before: { x: -extent + length, y: length }, after: { x: -extent + length, y: -length } },
    ];
    const vertex = vertices[index];
    graphics.lineStyle(lineWidth, color, alpha);
    graphics.beginPath();
    graphics.moveTo(vertex.before.x, vertex.before.y);
    graphics.lineTo(vertex.x, vertex.y);
    graphics.lineTo(vertex.after.x, vertex.after.y);
    graphics.strokePath();
  }

  private focusArc(scene: Phaser.Scene, radius: number, startAngle: number, endAngle: number): Phaser.GameObjects.Graphics {
    const arc = scene.add.graphics().setAlpha(0.1);
    arc.lineStyle(3, 0xfff6df, 0.72);
    arc.beginPath();
    arc.arc(0, 0, radius, startAngle, endAngle, false);
    arc.strokePath();
    return arc;
  }

  private focusSegment(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Phaser.GameObjects.Container {
    const segment = scene.add.container(x, y).setAlpha(0.1);
    const glow = scene.add.rectangle(0, 0, width + 6, height + 6, 0xfff1c7, 0.14);
    const core = scene.add.rectangle(0, 0, width, height, 0xfff6df, 0.72);
    segment.add([glow, core]);
    return segment;
  }
}

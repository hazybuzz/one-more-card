import Phaser from 'phaser';
import { ABILITY_SLOT_ART } from '../art';
import { GAME_FONT_FAMILY } from '../themes/typography';

export interface AbilitySlotOptions {
  x?: number;
  y?: number;
  diameter?: number;
  icon: string;
  iconTextureKey?: string;
  variant?: 'active' | 'item' | 'passive';
  radiateWhenEnabled?: boolean;
  color: number;
  textColor: string;
  enabled?: boolean;
  unavailable?: boolean;
  cooldown?: number;
  cooldownMax?: number;
  badge?: string;
  badgeColor?: number;
  badgeStrokeColor?: number;
  badgeTextColor?: string;
  backgroundColor?: number;
  slotFillColor?: number;
  slotFillAlpha?: number;
  disabledBackgroundColor?: number;
  hoverBackgroundColor?: number;
  onActivate?: () => void;
  onShowTooltip?: () => void;
  onHideTooltip?: () => void;
}

export class AbilitySlot {
  readonly container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, options: AbilitySlotOptions) {
    const enabled = options.enabled ?? true;
    const cooling = (options.cooldown ?? 0) > 0;
    const unavailable = Boolean(options.unavailable) && !cooling;
    const diameter = options.diameter ?? 44;
    const radius = diameter / 2;
    const radiating = enabled && Boolean(options.radiateWhenEnabled);
    this.container = scene.add.container(options.x ?? 0, options.y ?? 0);
    const eclipseHalo = scene.add.container(0, 0).setAlpha(radiating ? 0.58 : 0);
    let eclipseArc: Phaser.GameObjects.Graphics | undefined;
    if (radiating) {
      const corona = scene.add.circle(0, 0, radius + 3, options.color, 0.08)
        .setStrokeStyle(3, options.color, 0.6)
        .setBlendMode(Phaser.BlendModes.ADD);
      const outerGlow = scene.add.circle(0, 0, radius + 5, options.color, 0)
        .setStrokeStyle(3, options.color, 0.16)
        .setBlendMode(Phaser.BlendModes.ADD);
      eclipseArc = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      eclipseArc.lineStyle(2, options.color, 0.9);
      eclipseArc.beginPath();
      eclipseArc.arc(0, 0, radius + 4, -1.18, 0.2, false);
      eclipseArc.strokePath();
      eclipseArc.beginPath();
      eclipseArc.arc(0, 0, radius + 4, 1.92, 3.24, false);
      eclipseArc.strokePath();
      eclipseHalo.add([outerGlow, corona, eclipseArc]);
    }
    const slotFrame = scene.textures.exists(ABILITY_SLOT_ART.textureKey)
      ? scene.add.image(0, 0, ABILITY_SLOT_ART.textureKey).setDisplaySize(diameter + 8, diameter + 8)
      : undefined;
    const themedSlotFill = slotFrame && options.slotFillColor !== undefined
      ? scene.add.circle(
        0,
        0,
        radius - 2.5,
        options.slotFillColor,
        options.slotFillAlpha ?? 0.72,
      )
      : undefined;
    const fallbackBackground = slotFrame
      ? undefined
      : scene.add.circle(0, 0, radius, options.backgroundColor ?? 0x191716, 0.98);
    const icon = options.iconTextureKey && scene.textures.exists(options.iconTextureKey)
      ? scene.add.image(0, 0, options.iconTextureKey)
        .setDisplaySize(Math.round(diameter * 0.76), Math.round(diameter * 0.76))
      : scene.add.text(0, -1, options.icon, {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: `${Math.round(diameter * 0.48)}px`,
        color: options.textColor,
        fontStyle: 'bold',
      }).setOrigin(0.5);
    if (!(icon instanceof Phaser.GameObjects.Image)) {
      icon.setShadow(0, 0, options.textColor, 8, true, true);
    }
    const iconBaseScaleX = icon.scaleX;
    const iconBaseScaleY = icon.scaleY;
    const disabledOverlay = scene.add.circle(
      0,
      0,
      radius - 2,
      0x101a28,
      cooling || unavailable ? 0.68 : 0,
    );
    this.container.add(eclipseHalo);
    if (fallbackBackground) {
      this.container.add(fallbackBackground);
    }
    if (slotFrame) {
      this.container.add(slotFrame);
    }
    if (themedSlotFill) {
      this.container.add(themedSlotFill);
    }
    this.container.add([icon, disabledOverlay]);

    if (cooling) {
      const cooldown = options.cooldown ?? 0;
      const cooldownMax = Math.max(cooldown, options.cooldownMax ?? 2);
      const restoredRatio = Phaser.Math.Clamp((cooldownMax - cooldown) / cooldownMax, 0, 1);
      const ring = scene.add.graphics();
      ring.lineStyle(3, 0x31445d, 0.94);
      ring.beginPath();
      ring.arc(0, 0, radius + 1, -Math.PI / 2, Math.PI * 1.5, false);
      ring.strokePath();
      if (restoredRatio > 0) {
        ring.lineStyle(3, 0x7da6cf, 0.96);
        ring.beginPath();
        ring.arc(0, 0, radius + 1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * restoredRatio, false);
        ring.strokePath();
      }
      const cooldownText = scene.add.text(0, -4, `${cooldown}`, {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: `${Math.round(diameter * 0.38)}px`,
        color: '#d5e6f5',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      cooldownText.setShadow(0, 0, '#75a8d5', 5, true, true);
      const cooldownLabel = scene.add.text(0, radius * 0.47, 'CD', {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: `${Math.max(7, Math.round(diameter * 0.16))}px`,
        color: '#87a4bf',
      }).setOrigin(0.5);
      this.container.add([ring, cooldownText, cooldownLabel]);
    }

    if (radiating) {
      if (eclipseArc) {
        const rotationDuration = 14000;
        const continuousAngle = ((scene.time.now % rotationDuration) / rotationDuration) * 360;
        eclipseArc.setAngle(continuousAngle);
        scene.tweens.add({
          targets: eclipseArc,
          angle: continuousAngle + 360,
          duration: rotationDuration,
          repeat: -1,
          ease: 'Linear',
        });
      }
      this.container.once(Phaser.GameObjects.Events.DESTROY, () => {
        if (eclipseArc) {
          scene.tweens.killTweensOf(eclipseArc);
        }
        scene.tweens.killTweensOf(icon);
      });
    }

    const badgeText = cooling ? undefined : options.badge;
    if (badgeText) {
      const badgeColor = options.badgeColor ?? 0xb6293e;
      const badgeStrokeColor = options.badgeStrokeColor ?? 0xff8290;
      const badge = scene.add.circle(radius - 2, radius - 2, 9, badgeColor, 0.98)
        .setStrokeStyle(1, badgeStrokeColor, 0.9);
      const text = scene.add.text(radius - 2, radius - 2, badgeText, {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: '10px',
        color: options.badgeTextColor ?? '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      this.container.add([badge, text]);
    }

    const hitArea = scene.add.circle(0, 0, radius + 2, 0x000000, 0.001)
      .setInteractive({ useHandCursor: enabled && Boolean(options.onActivate) });
    this.container.add(hitArea);
    hitArea.on('pointerover', () => {
      slotFrame?.setTint(0xffe8bd);
      scene.tweens.killTweensOf(icon);
      scene.tweens.add({
        targets: icon,
        scaleX: iconBaseScaleX * 1.03,
        scaleY: iconBaseScaleY * 1.03,
        duration: 110,
        ease: 'Sine.easeOut',
      });
      options.onShowTooltip?.();
    });
    hitArea.on('pointerout', () => {
      slotFrame?.clearTint();
      scene.tweens.killTweensOf(icon);
      scene.tweens.add({
        targets: icon,
        scaleX: iconBaseScaleX,
        scaleY: iconBaseScaleY,
        duration: 110,
        ease: 'Sine.easeOut',
      });
      options.onHideTooltip?.();
    });
    hitArea.on('pointerdown', () => {
      if (enabled) {
        options.onActivate?.();
      }
    });
  }
}

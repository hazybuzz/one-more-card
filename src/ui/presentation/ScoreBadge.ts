import Phaser from 'phaser';
import { GAME_FONT_FAMILY } from '../themes/typography';
import type { ResonanceKind } from '../../game/scoring';
import { t } from '../../game/i18n';
import { SCORE_BADGE_ART } from '../art';

export interface ScoreBadgeOptions {
  x: number;
  y: number;
  point: number;
  label?: string;
  scale?: number;
  variant?: 'orb' | 'compact';
  resonance?: ResonanceKind;
}

// Phaser centers the font's full ascent/descent box, while Almendra SC numerals
// sit visually low inside that box. Keep this correction local to score numerals.
const SCORE_NUMBER_OPTICAL_Y = -3;
const SCORE_RING_ROTATION_MS = 30000;
const SCORE_GLOW_BREATH_MS = 2400;
const BOOM_BADGE_GOLD = 0xffb02e;

function scoreNumberY(baseY: number, scale = 1): number {
  return baseY + SCORE_NUMBER_OPTICAL_Y * scale;
}

export function createScoreBadge(scene: Phaser.Scene, options: ScoreBadgeOptions): Phaser.GameObjects.Container {
  const scale = options.scale ?? 1;
  const color = pointColor();
  const badge = scene.add.container(options.x, options.y);
  if (options.variant === 'compact') {
    const resonance = options.resonance ?? 'none';
    const resonant = resonance !== 'none';
    const strong = resonance === 'strong';
    const boom = resonance === 'boom';
    const diameter = (resonant ? 68 : 64) * scale;
    const accentTint = boom ? 0xff4d32 : resonant ? 0xffd86b : 0xdceaff;
    const ringGlowLayer = scene.add.container(0, 0);
    const ringLayer = scene.add.container(0, 0);
    if (scene.textures.exists(SCORE_BADGE_ART.textureKey)) {
      ringGlowLayer.add(scene.add.image(0, 0, SCORE_BADGE_ART.textureKey)
        .setDisplaySize(
          diameter + (resonant ? (strong ? 12 : 8) : 6) * scale,
          diameter + (resonant ? (strong ? 12 : 8) : 6) * scale,
        )
        .setTint(accentTint)
        .setBlendMode(Phaser.BlendModes.ADD));
      ringLayer.add(scene.add.image(0, 0, SCORE_BADGE_ART.textureKey).setDisplaySize(diameter, diameter));
    } else {
      ringGlowLayer.add(scene.add.circle(0, 0, diameter / 2 + 4 * scale, 0x000000, 0)
        .setStrokeStyle(5, accentTint, 0.8));
      ringLayer.add(scene.add.circle(0, 0, diameter / 2, 0x101726, 0.96)
        .setStrokeStyle(2, boom ? 0xffb02e : resonant ? 0xffd86b : 0x8998aa, 0.9));
    }
    if (boom) {
      ringLayer.each((child: Phaser.GameObjects.GameObject) => {
        (child as Phaser.GameObjects.Image).setTint?.(BOOM_BADGE_GOLD);
      });
    }
    badge.add([ringGlowLayer, ringLayer]);
    const numberY = scoreNumberY(0, scale);
    const textColor = boom ? '#ffd36a' : resonant ? '#ffe59a' : color.text;
    const glowColor = boom ? '#ff3b24' : resonant ? '#ffd86b' : color.glow;
    const displayText = boom ? t('score.boom') : `${options.point}`;
    const fontSize = `${Math.round((boom ? 18 : 32) * scale)}px`;
    const compactGlow = scene.add.text(0, numberY, displayText, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize,
      color: textColor,
      fontStyle: 'bold',
    }).setOrigin(0.5).setBlendMode(Phaser.BlendModes.ADD);
    compactGlow.setShadow(0, 0, glowColor, (strong ? 20 : resonant ? 15 : 12) * scale, true, true);
    const compactText = scene.add.text(0, numberY, displayText, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize,
      color: textColor,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    if (resonant) {
      compactText.setShadow(0, 0, boom ? '#ff3b24' : '#ffd86b', (boom ? 18 : strong ? 15 : 11) * scale, true, true);
    } else {
      compactText.setShadow(0, 0, color.glow, 8 * scale, true, true);
    }
    badge.add([compactGlow, compactText]);
    attachBadgeMotion(scene, badge, ringLayer, ringGlowLayer, compactGlow, options, resonant, strong || boom);
    return badge;
  }

  const ringGlowLayer = scene.add.container(0, 0);
  const ringLayer = scene.add.container(0, 0);
  if (scene.textures.exists(SCORE_BADGE_ART.textureKey)) {
    ringGlowLayer.add(scene.add.image(0, 0, SCORE_BADGE_ART.textureKey)
      .setDisplaySize(70 * scale, 70 * scale)
      .setTint(0xdceaff)
      .setBlendMode(Phaser.BlendModes.ADD));
    ringLayer.add(scene.add.image(0, 0, SCORE_BADGE_ART.textureKey).setDisplaySize(64 * scale, 64 * scale));
  } else {
    ringGlowLayer.add(scene.add.circle(0, 0, 36 * scale, 0x000000, 0)
      .setStrokeStyle(5, 0xdceaff, 0.8));
    ringLayer.add(scene.add.circle(0, 0, 32 * scale, color.fill, 0.18)
      .setStrokeStyle(2, color.stroke, 0.95));
  }
  badge.add([ringGlowLayer, ringLayer]);
  const numberY = scoreNumberY(0, scale);
  const boom = options.resonance === 'boom';
  const displayText = boom ? t('score.boom') : `${options.point}`;
  const fontSize = `${Math.round((boom ? 19 : 34) * scale)}px`;
  const pointGlow = scene.add.text(0, numberY, displayText, {
    fontFamily: GAME_FONT_FAMILY,
    fontSize,
    color: boom ? '#ffd36a' : color.text,
    fontStyle: 'bold',
  }).setOrigin(0.5).setBlendMode(Phaser.BlendModes.ADD);
  pointGlow.setShadow(0, 0, boom ? '#ff3b24' : color.glow, 18 * scale, true, true);
  const pointText = scene.add.text(0, scoreNumberY(0, scale), displayText, {
    fontFamily: GAME_FONT_FAMILY,
    fontSize,
    color: boom ? '#ffd36a' : color.text,
    fontStyle: 'bold',
  }).setOrigin(0.5);
  pointText.setShadow(0, 0, boom ? '#ff3b24' : color.glow, 14 * scale, true, true);

  badge.add([pointGlow, pointText]);
  attachBadgeMotion(scene, badge, ringLayer, ringGlowLayer, pointGlow, options, boom, boom);
  return badge;
}

function attachBadgeMotion(
  scene: Phaser.Scene,
  badge: Phaser.GameObjects.Container,
  ringLayer: Phaser.GameObjects.Container,
  ringGlowLayer: Phaser.GameObjects.Container,
  glowText: Phaser.GameObjects.Text,
  options: ScoreBadgeOptions,
  resonant: boolean,
  strong: boolean,
): void {
  const phaseSeed = Math.round(options.x * 17 + options.y * 11);
  const phaseOffset = ((phaseSeed % SCORE_RING_ROTATION_MS) + SCORE_RING_ROTATION_MS) % SCORE_RING_ROTATION_MS;
  const updateMotion = (): void => {
    const now = scene.time.now + phaseOffset;
    const rotation = (now % SCORE_RING_ROTATION_MS) / SCORE_RING_ROTATION_MS * 360;
    ringLayer.setAngle(rotation);
    ringGlowLayer.setAngle(rotation);
    const pulse = 0.5 + Math.sin(now / SCORE_GLOW_BREATH_MS * Math.PI * 2) * 0.5;
    const textMinAlpha = resonant ? (strong ? 0.4 : 0.32) : 0.22;
    const textAlphaRange = resonant ? (strong ? 0.6 : 0.54) : 0.46;
    const ringMinAlpha = resonant ? (strong ? 0.28 : 0.2) : 0.14;
    const ringAlphaRange = resonant ? (strong ? 0.48 : 0.4) : 0.3;
    glowText.setAlpha(textMinAlpha + pulse * textAlphaRange);
    ringGlowLayer.setAlpha(ringMinAlpha + pulse * ringAlphaRange);
    ringGlowLayer.setScale(1 + pulse * 0.025);
  };

  scene.events.on(Phaser.Scenes.Events.UPDATE, updateMotion);
  updateMotion();
  badge.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, updateMotion);
  });
}

function pointColor(): { fill: number; stroke: number; text: string; glow: string } {
  return { fill: 0xc8d0dc, stroke: 0xe7edf5, text: '#f1f5fa', glow: '#c9d8eb' };
}

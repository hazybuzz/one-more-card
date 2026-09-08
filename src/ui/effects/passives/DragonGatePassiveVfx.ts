import Phaser from 'phaser';
import { playDriftingParticleAura, playPixelBurst } from './PixelVfxPrimitives';

const DEPTH = { aura: 39, transfer: 43, accent: 45 } as const;
const CHIVALRY = [0x351014, 0x7d2025, 0xc4533c, 0xc69a55, 0xf2d58b] as const;
const SILK = [0x26080d, 0x681221, 0xa92d43, 0xd86579, 0xd6aa62] as const;
const HEAVEN = [0x102b27, 0x286b5e, 0x62b99d, 0xbce5c7, 0xd8b968] as const;

export interface RedSilkToastVfxOptions {
  source: Phaser.Math.Vector2;
  target: Phaser.Math.Vector2;
  onHeal: () => void;
  onAttackUp: () => void;
  onComplete: () => void;
}

export interface HeavenlyInsightVfxOptions {
  source: Phaser.Math.Vector2;
  target: Phaser.Math.Vector2;
  mode: 'sense' | 'reroll';
  onLand?: () => void;
  onComplete: () => void;
}

export function playRedSilkToastVfx(scene: Phaser.Scene, options: RedSilkToastVfxOptions): void {
  const icon = createIconPulse(scene, 'icon-passive-red-silk-toast', options.source, 58, SILK[3]);
  const sourceAura = playDriftingParticleAura(scene, {
    x: options.source.x,
    y: options.source.y,
    colors: [SILK[1], SILK[2], SILK[3], SILK[4]],
    count: 26,
    minRadius: 34,
    maxRadius: 72,
    duration: 1080,
    depth: DEPTH.aura,
    upwardDrift: 26,
  });
  const strings = scene.add.graphics().setDepth(DEPTH.transfer).setBlendMode(Phaser.BlendModes.ADD);
  const direction = options.target.clone().subtract(options.source);
  const normal = new Phaser.Math.Vector2(-direction.y, direction.x).normalize();
  const control = options.source.clone().add(direction.clone().scale(0.5)).add(normal.scale(72));
  const curve = new Phaser.Curves.QuadraticBezier(options.source, control, options.target);
  const musicCore = createSilkMusicCore(scene)
    .setPosition(options.source.x, options.source.y)
    .setDepth(DEPTH.accent)
    .setAlpha(0)
    .setScale(0.56);
  const progress = { value: 0 };
  let lastGlintAt = -Infinity;

  scene.sound.play('attackWind', { volume: 0.36, rate: 1.04 });
  scene.tweens.add({
    targets: musicCore,
    alpha: 1,
    scale: 0.82,
    angle: 36,
    duration: 180,
    ease: 'Back.easeOut',
  });
  scene.time.delayedCall(180, () => {
    scene.tweens.add({
      targets: progress,
      value: 1,
      duration: 700,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const head = curve.getPoint(progress.value);
        musicCore.setPosition(snap(head.x), snap(head.y));
        musicCore.setAngle(36 + progress.value * 180);
        drawSilkMusicStrings(strings, curve, progress.value, scene.time.now);
        if (scene.time.now - lastGlintAt >= 74) {
          lastGlintAt = scene.time.now;
          createSilkMusicGlint(scene, head);
        }
      },
      onComplete: () => {
        options.onHeal();
        musicCore.destroy(true);
        playSilkBlessingImpact(scene, options.target);
        scene.tweens.add({
          targets: strings,
          alpha: 0,
          duration: 260,
          ease: 'Cubic.easeOut',
          onComplete: () => strings.destroy(),
        });
      },
    });
  });

  scene.time.delayedCall(1110, () => {
    options.onAttackUp();
    playDriftingParticleAura(scene, {
      x: options.target.x,
      y: options.target.y,
      colors: [SILK[2], SILK[3], SILK[4]],
      count: 22,
      minRadius: 24,
      maxRadius: 56,
      duration: 620,
      depth: DEPTH.accent,
      clockwise: false,
      upwardDrift: 30,
    });
  });

  scene.time.delayedCall(1320, () => fadeAndDestroy(scene, [icon, sourceAura], 300));
  scene.time.delayedCall(1680, options.onComplete);
}

export function playHeavenlyInsightVfx(scene: Phaser.Scene, options: HeavenlyInsightVfxOptions): void {
  const icon = createIconPulse(scene, 'icon-passive-heavenly-insight', options.source, 56, HEAVEN[2]);
  const sourceAura = playDriftingParticleAura(scene, {
    x: options.source.x,
    y: options.source.y,
    colors: [HEAVEN[1], HEAVEN[2], HEAVEN[3], HEAVEN[4]],
    count: 23,
    minRadius: 32,
    maxRadius: 68,
    clockwise: false,
    duration: 980,
    depth: DEPTH.aura,
    upwardDrift: 34,
  });
  const talisman = createTalisman(scene, options.source).setDepth(DEPTH.transfer).setAlpha(0).setScale(0.82);
  const midpoint = new Phaser.Math.Vector2(
    (options.source.x + options.target.x) / 2,
    Math.min(options.source.y, options.target.y) - 54,
  );
  const curve = new Phaser.Curves.QuadraticBezier(options.source, midpoint, options.target);
  const progress = { value: 0 };
  let lastMoteAt = -Infinity;

  scene.sound.play(options.mode === 'sense' ? 'cardPlace' : 'attackWind', {
    volume: options.mode === 'sense' ? 0.38 : 0.34,
    rate: 0.84,
  });
  scene.time.delayedCall(180, () => {
    scene.tweens.add({ targets: talisman, alpha: 1, scale: 1, duration: 170, ease: 'Cubic.easeOut' });
    scene.tweens.add({
      targets: progress,
      value: 1,
      duration: 580,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const point = curve.getPoint(progress.value);
        talisman.setPosition(snap(point.x), snap(point.y)).setAngle(Phaser.Math.Linear(-8, 7, progress.value));
        if (scene.time.now - lastMoteAt >= 82) {
          lastMoteAt = scene.time.now;
          createJadeMote(scene, point);
        }
      },
      onComplete: () => {
        options.onLand?.();
        playQuietImpact(scene, options.target, HEAVEN, 10);
        if (options.mode === 'sense') {
          createTalismanSeal(scene, options.target);
        }
      },
    });
  });

  scene.time.delayedCall(980, () => fadeAndDestroy(scene, [icon, sourceAura, talisman], 280));
  scene.time.delayedCall(1320, options.onComplete);
}

export function playChivalryGuardVfx(scene: Phaser.Scene, position: Phaser.Math.Vector2): void {
  playDriftingParticleAura(scene, {
    x: position.x,
    y: position.y,
    colors: [CHIVALRY[1], CHIVALRY[2], CHIVALRY[3], CHIVALRY[4]],
    count: 19,
    minRadius: 22,
    maxRadius: 54,
    duration: 620,
    depth: DEPTH.transfer,
    upwardDrift: 18,
  });
  [-31, 31].forEach((angle, index) => {
    const slash = scene.add.rectangle(
      position.x,
      position.y,
      88,
      index === 0 ? 4 : 3,
      index === 0 ? CHIVALRY[4] : CHIVALRY[2],
      0.92,
    ).setDepth(DEPTH.accent).setAngle(angle).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: slash,
      alpha: 0,
      scaleX: 1.45,
      scaleY: 0.2,
      duration: 300,
      ease: 'Cubic.easeOut',
      onComplete: () => slash.destroy(),
    });
  });
  playPixelBurst(scene, {
    x: position.x,
    y: position.y,
    colors: CHIVALRY,
    count: 12,
    minDistance: 16,
    maxDistance: 58,
    pixelSize: 3,
    duration: 440,
    depth: DEPTH.accent,
  });
}

export function playTalismanBurnVfx(scene: Phaser.Scene, position: Phaser.Math.Vector2): void {
  const talisman = createTalisman(scene, position).setDepth(DEPTH.transfer);
  const eye = scene.add.ellipse(position.x, position.y - 3, 18, 9, HEAVEN[3], 0.2)
    .setStrokeStyle(2, HEAVEN[3], 0.9)
    .setDepth(DEPTH.accent)
    .setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: eye,
    scale: 1.3,
    alpha: 0,
    duration: 420,
    ease: 'Cubic.easeOut',
    onComplete: () => eye.destroy(),
  });
  for (let index = 0; index < 12; index += 1) {
    scene.time.delayedCall(index * 36, () => {
      const flame = scene.add.rectangle(
        position.x + Phaser.Math.Between(-14, 14),
        position.y + 22 - index * 2,
        Phaser.Math.Between(3, 6),
        Phaser.Math.Between(5, 9),
        HEAVEN[1 + (index % 3)],
        0.86,
      ).setDepth(DEPTH.accent).setAngle(45).setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({
        targets: flame,
        x: flame.x + Phaser.Math.Between(-10, 10),
        y: flame.y - Phaser.Math.Between(28, 52),
        alpha: 0,
        scale: 0.25,
        duration: 430,
        ease: 'Cubic.easeOut',
        onComplete: () => flame.destroy(),
      });
    });
  }
  scene.tweens.add({
    targets: talisman,
    alpha: 0,
    scaleY: 0.42,
    y: position.y - 18,
    duration: 620,
    ease: 'Cubic.easeIn',
    onComplete: () => talisman.destroy(true),
  });
}

function createIconPulse(
  scene: Phaser.Scene,
  textureKey: string,
  position: Phaser.Math.Vector2,
  size: number,
  fallbackColor: number,
): Phaser.GameObjects.Image | Phaser.GameObjects.Arc {
  const icon = scene.textures.exists(textureKey)
    ? scene.add.image(position.x, position.y - 8, textureKey).setDisplaySize(size, size)
    : scene.add.circle(position.x, position.y - 8, size / 2, fallbackColor, 0.3);
  icon.setDepth(DEPTH.aura + 1).setAlpha(0).setScale(0.82);
  scene.tweens.add({
    targets: icon,
    alpha: { from: 0, to: 0.78 },
    scale: { from: 0.82, to: 1 },
    duration: 260,
    yoyo: true,
    hold: 520,
    ease: 'Sine.easeInOut',
  });
  return icon;
}

function createTalisman(scene: Phaser.Scene, position: Phaser.Math.Vector2): Phaser.GameObjects.Container {
  const talisman = scene.add.container(position.x, position.y);
  const paper = scene.add.rectangle(0, 0, 26, 44, 0xc9aa63, 1).setStrokeStyle(2, 0x49331f, 1);
  const fold = scene.add.triangle(9, 18, 0, 0, 8, 0, 8, -8, 0x735233, 1);
  const mark = scene.add.graphics();
  mark.lineStyle(2, HEAVEN[0], 0.95);
  mark.strokeEllipse(0, -5, 14, 7);
  mark.beginPath();
  mark.moveTo(0, 0);
  mark.lineTo(-5, 7);
  mark.lineTo(5, 11);
  mark.lineTo(-2, 17);
  mark.strokePath();
  talisman.add([paper, fold, mark]);
  return talisman;
}

function createTalismanSeal(scene: Phaser.Scene, position: Phaser.Math.Vector2): void {
  const seal = scene.add.container(position.x, position.y).setDepth(DEPTH.accent).setAlpha(0);
  const eye = scene.add.ellipse(0, 0, 25, 12, HEAVEN[1], 0.16).setStrokeStyle(2, HEAVEN[3], 0.88);
  const pupil = scene.add.rectangle(0, 0, 4, 9, HEAVEN[4], 0.94).setAngle(45);
  seal.add([eye, pupil]);
  for (let index = 0; index < 11; index += 1) {
    const angle = (index / 11) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.42, 0.42);
    const radius = Phaser.Math.Between(24, 42);
    const fragment = scene.add.rectangle(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 0.78,
      index % 3 === 0 ? 7 : 4,
      index % 3 === 0 ? 2 : 4,
      index % 4 === 0 ? HEAVEN[4] : HEAVEN[2],
      index % 2 === 0 ? 0.9 : 0.62,
    ).setAngle(Phaser.Math.Between(-55, 55)).setBlendMode(Phaser.BlendModes.ADD);
    seal.add(fragment);
    scene.tweens.add({
      targets: fragment,
      x: fragment.x + Phaser.Math.Between(-12, 12),
      y: fragment.y - Phaser.Math.Between(12, 32),
      alpha: 0,
      angle: fragment.angle + Phaser.Math.Between(-70, 70),
      duration: Phaser.Math.Between(460, 720),
      ease: 'Sine.easeOut',
    });
  }
  scene.tweens.add({
    targets: seal,
    alpha: { from: 0, to: 0.86 },
    scale: { from: 0.84, to: 1.04 },
    duration: 240,
    yoyo: true,
    hold: 360,
    ease: 'Sine.easeInOut',
    onComplete: () => seal.destroy(true),
  });
}

function createSilkMusicCore(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const core = scene.add.container(0, 0);
  const outerGlow = scene.add.circle(0, 0, 27, SILK[2], 0.2)
    .setBlendMode(Phaser.BlendModes.ADD);
  const innerGlow = scene.add.circle(0, 0, 14, SILK[4], 0.24)
    .setBlendMode(Phaser.BlendModes.ADD);
  const mark = scene.add.graphics();
  mark.fillStyle(SILK[0], 1);
  mark.fillPoints([
    new Phaser.Geom.Point(0, -15),
    new Phaser.Geom.Point(13, 0),
    new Phaser.Geom.Point(0, 15),
    new Phaser.Geom.Point(-13, 0),
  ], true);
  mark.lineStyle(3, SILK[3], 1);
  mark.strokePoints([
    new Phaser.Geom.Point(0, -13),
    new Phaser.Geom.Point(11, 0),
    new Phaser.Geom.Point(0, 13),
    new Phaser.Geom.Point(-11, 0),
  ], true);
  mark.fillStyle(SILK[4], 1);
  mark.fillCircle(0, 0, 5);
  core.add([outerGlow, innerGlow, mark]);
  scene.tweens.add({
    targets: [outerGlow, innerGlow],
    alpha: { from: 0.12, to: 0.34 },
    scale: { from: 0.88, to: 1.12 },
    duration: 320,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  return core;
}

function drawSilkMusicStrings(
  graphics: Phaser.GameObjects.Graphics,
  curve: Phaser.Curves.QuadraticBezier,
  progress: number,
  time: number,
): void {
  graphics.clear();
  const start = Math.max(0, progress - 0.5);
  const phase = time * 0.012;
  const strands = [-1, 0, 1].map((strand) => Array.from({ length: 19 }, (_, index) => {
    const local = index / 18;
    const point = curve.getPoint(Phaser.Math.Linear(start, progress, local));
    const tangent = curve.getTangent(Phaser.Math.Linear(start, progress, local)).normalize();
    const strandNormal = new Phaser.Math.Vector2(-tangent.y, tangent.x);
    const envelope = Math.sin(local * Math.PI);
    const offset = (strand * 6 + Math.sin(local * Math.PI * 3 - phase + strand) * 3) * envelope;
    return point.add(strandNormal.scale(offset));
  }));
  const stroke = (points: Phaser.Math.Vector2[], width: number, color: number, alpha: number) => {
    graphics.lineStyle(width, color, alpha);
    graphics.beginPath();
    graphics.moveTo(snap(points[0].x), snap(points[0].y));
    points.slice(1).forEach((point) => graphics.lineTo(snap(point.x), snap(point.y)));
    graphics.strokePath();
  };
  strands.forEach((points, index) => {
    stroke(points, 8, SILK[1], 0.3);
    stroke(points, index === 1 ? 3 : 2, index === 1 ? SILK[4] : SILK[3], 0.88);
  });
}

function createSilkMusicGlint(scene: Phaser.Scene, point: Phaser.Math.Vector2): void {
  const glint = scene.add.rectangle(point.x, point.y, 5, 5, SILK[4], 0.78)
    .setDepth(DEPTH.transfer)
    .setAngle(45)
    .setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: glint,
    x: point.x + Phaser.Math.Between(-15, 15),
    y: point.y + Phaser.Math.Between(-12, 12),
    alpha: 0,
    scale: 0.2,
    duration: 380,
    onComplete: () => glint.destroy(),
  });
}

function playSilkBlessingImpact(scene: Phaser.Scene, target: Phaser.Math.Vector2): void {
  playQuietImpact(scene, target, SILK, 20);
  for (let index = 0; index < 24; index += 1) {
    const direction = index % 2 === 0 ? -1 : 1;
    const distanceX = Phaser.Math.Between(20, 74) * direction;
    const distanceY = Phaser.Math.Between(24, 82);
    const mote = scene.add.rectangle(
      target.x + Phaser.Math.Between(-10, 10),
      target.y + Phaser.Math.Between(-8, 10),
      index % 3 === 0 ? 6 : 4,
      index % 3 === 0 ? 4 : 3,
      index % 2 === 0 ? SILK[4] : SILK[3],
      0.88,
    ).setDepth(DEPTH.accent).setAngle(45).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: mote,
      x: target.x + distanceX,
      y: target.y - distanceY + Phaser.Math.Between(-10, 18),
      alpha: 0,
      scale: 0.25,
      angle: mote.angle + direction * Phaser.Math.Between(30, 100),
      delay: index * 14,
      duration: Phaser.Math.Between(420, 620),
      ease: 'Cubic.easeOut',
      onComplete: () => mote.destroy(),
    });
  }
}

function createJadeMote(scene: Phaser.Scene, point: Phaser.Math.Vector2): void {
  const mote = scene.add.rectangle(point.x, point.y, 5, 5, HEAVEN[2], 0.68)
    .setDepth(DEPTH.transfer - 1)
    .setAngle(45)
    .setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: mote, alpha: 0, scale: 0.25, duration: 340, onComplete: () => mote.destroy() });
}

function playQuietImpact(scene: Phaser.Scene, position: Phaser.Math.Vector2, colors: readonly number[], count: number): void {
  playPixelBurst(scene, {
    x: position.x,
    y: position.y,
    colors,
    count,
    minDistance: 12,
    maxDistance: 50,
    pixelSize: 3,
    duration: 480,
    depth: DEPTH.accent,
  });
}

function fadeAndDestroy(scene: Phaser.Scene, targets: Phaser.GameObjects.GameObject[], duration: number): void {
  const active = targets.filter((target) => target.active);
  if (active.length === 0) {
    return;
  }
  scene.tweens.add({
    targets: active,
    alpha: 0,
    duration,
    ease: 'Sine.easeOut',
    onComplete: () => active.forEach((target) => target.destroy()),
  });
}

function snap(value: number): number {
  return Phaser.Math.Snap.To(value, 2);
}

import Phaser from 'phaser';

export interface PixelBurstOptions {
  x: number;
  y: number;
  colors: readonly number[];
  count?: number;
  minDistance?: number;
  maxDistance?: number;
  pixelSize?: number;
  duration?: number;
  depth?: number;
}

export interface JaggedScanOptions {
  from: Phaser.Math.Vector2;
  to: Phaser.Math.Vector2;
  color: number;
  highlightColor?: number;
  segments?: number;
  jitter?: number;
  lineWidth?: number;
  duration?: number;
  depth?: number;
  onComplete?: () => void;
}

export interface BrokenRingOptions {
  x: number;
  y: number;
  radius: number;
  color: number;
  highlightColor?: number;
  segments?: number;
  segmentWidth?: number;
  segmentHeight?: number;
  rotation?: number;
  duration?: number;
  depth?: number;
  clockwise?: boolean;
}

export interface PixelArcTransferOptions {
  from: Phaser.Math.Vector2;
  to: Phaser.Math.Vector2;
  colors: readonly number[];
  count?: number;
  arcHeight?: number;
  pixelSize?: number;
  duration?: number;
  stagger?: number;
  depth?: number;
  onArrive?: () => void;
  onComplete?: () => void;
}

export interface DriftingParticleAuraOptions {
  x: number;
  y: number;
  colors: readonly number[];
  count?: number;
  minRadius?: number;
  maxRadius?: number;
  duration?: number;
  depth?: number;
  clockwise?: boolean;
  upwardDrift?: number;
}

export function playPixelBurst(scene: Phaser.Scene, options: PixelBurstOptions): void {
  const count = options.count ?? 12;
  const minDistance = options.minDistance ?? 24;
  const maxDistance = options.maxDistance ?? 72;
  const pixelSize = options.pixelSize ?? 4;
  const duration = options.duration ?? 620;
  const depth = options.depth ?? 40;

  for (let index = 0; index < count; index += 1) {
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const distance = Phaser.Math.Between(minDistance, maxDistance);
    const size = pixelSize + Phaser.Math.Between(0, pixelSize);
    const color = options.colors[index % options.colors.length] ?? 0xffffff;
    const pixel = scene.add.rectangle(options.x, options.y, size, size, color, 0.92)
      .setDepth(depth)
      .setAngle(Phaser.Math.Between(-20, 20));
    scene.tweens.add({
      targets: pixel,
      x: snap(options.x + Math.cos(angle) * distance, 2),
      y: snap(options.y + Math.sin(angle) * distance, 2),
      alpha: 0,
      scaleX: Phaser.Math.FloatBetween(0.35, 0.7),
      scaleY: Phaser.Math.FloatBetween(0.35, 0.7),
      duration: duration + Phaser.Math.Between(-80, 100),
      ease: 'Cubic.easeOut',
      onComplete: () => pixel.destroy(),
    });
  }
}

export function playJaggedScan(scene: Phaser.Scene, options: JaggedScanOptions): void {
  const segments = Math.max(3, options.segments ?? 9);
  const jitter = options.jitter ?? 8;
  const duration = options.duration ?? 760;
  const depth = options.depth ?? 42;
  const direction = options.to.clone().subtract(options.from);
  const normal = new Phaser.Math.Vector2(-direction.y, direction.x).normalize();
  const points: Phaser.Math.Vector2[] = [];

  for (let index = 0; index <= segments; index += 1) {
    const progress = index / segments;
    const offset = index === 0 || index === segments
      ? 0
      : Phaser.Math.Between(-jitter, jitter);
    points.push(new Phaser.Math.Vector2(
      snap(Phaser.Math.Linear(options.from.x, options.to.x, progress) + normal.x * offset, 2),
      snap(Phaser.Math.Linear(options.from.y, options.to.y, progress) + normal.y * offset, 2),
    ));
  }

  const beam = scene.add.graphics().setDepth(depth).setAlpha(0);
  beam.lineStyle((options.lineWidth ?? 4) + 4, options.color, 0.2);
  strokePoints(beam, points);
  beam.lineStyle(options.lineWidth ?? 4, options.color, 0.9);
  strokePoints(beam, points);
  beam.lineStyle(1, options.highlightColor ?? 0xe9ffd9, 0.96);
  strokePoints(beam, points);

  scene.tweens.add({
    targets: beam,
    alpha: { from: 0, to: 1 },
    duration: 130,
    yoyo: true,
    hold: Math.max(0, duration - 330),
    ease: 'Stepped',
    onComplete: () => {
      beam.destroy();
      options.onComplete?.();
    },
  });
}

export function playBrokenRing(scene: Phaser.Scene, options: BrokenRingOptions): Phaser.GameObjects.Container {
  const segments = Math.max(6, options.segments ?? 14);
  const duration = options.duration ?? 980;
  const depth = options.depth ?? 41;
  const ring = scene.add.container(options.x, options.y).setDepth(depth).setAlpha(0);

  for (let index = 0; index < segments; index += 1) {
    if (index % 5 === 2) {
      continue;
    }
    const angle = (index / segments) * Math.PI * 2;
    const color = index % 4 === 0 ? (options.highlightColor ?? options.color) : options.color;
    const segment = scene.add.rectangle(
      Math.cos(angle) * options.radius,
      Math.sin(angle) * options.radius,
      options.segmentWidth ?? 8,
      options.segmentHeight ?? 3,
      color,
      index % 3 === 0 ? 0.94 : 0.7,
    ).setRotation(angle + Math.PI / 2);
    ring.add(segment);
  }

  ring.setAngle(options.rotation ?? 0);
  scene.tweens.add({
    targets: ring,
    alpha: { from: 0, to: 1 },
    angle: ring.angle + (options.clockwise === false ? -42 : 42),
    scale: { from: 0.88, to: 1.08 },
    duration,
    yoyo: true,
    ease: 'Sine.easeInOut',
    onComplete: () => ring.destroy(true),
  });
  return ring;
}

export function playDriftingParticleAura(
  scene: Phaser.Scene,
  options: DriftingParticleAuraOptions,
): Phaser.GameObjects.Container {
  const count = Math.max(6, options.count ?? 14);
  const minRadius = options.minRadius ?? 38;
  const maxRadius = Math.max(minRadius + 1, options.maxRadius ?? 72);
  const duration = options.duration ?? 1100;
  const direction = options.clockwise === false ? -1 : 1;
  const upwardDrift = options.upwardDrift ?? 20;
  const aura = scene.add.container(options.x, options.y)
    .setDepth(options.depth ?? 41)
    .setAlpha(0);

  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.34, 0.34);
    const radius = Phaser.Math.Between(minRadius, maxRadius);
    const size = Phaser.Math.Between(2, index % 4 === 0 ? 6 : 4);
    const color = options.colors[index % options.colors.length] ?? 0xffffff;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * Phaser.Math.FloatBetween(0.72, 1.08);
    const tangentX = -Math.sin(angle) * Phaser.Math.Between(8, 22) * direction;
    const tangentY = Math.cos(angle) * Phaser.Math.Between(8, 22) * direction;
    const mote = scene.add.rectangle(x, y, size, size, color, index % 3 === 0 ? 0.9 : 0.62)
      .setAngle(Phaser.Math.Between(-45, 45))
      .setBlendMode(Phaser.BlendModes.ADD);
    aura.add(mote);
    scene.tweens.add({
      targets: mote,
      x: x + tangentX + Phaser.Math.Between(-8, 8),
      y: y + tangentY - Phaser.Math.Between(Math.round(upwardDrift * 0.45), upwardDrift),
      alpha: 0,
      scale: Phaser.Math.FloatBetween(0.2, 0.58),
      angle: mote.angle + direction * Phaser.Math.Between(25, 80),
      delay: Phaser.Math.Between(40, 260),
      duration: Phaser.Math.Between(Math.round(duration * 0.58), duration),
      ease: 'Sine.easeOut',
    });
  }

  scene.tweens.add({
    targets: aura,
    alpha: { from: 0, to: 1 },
    angle: direction * Phaser.Math.Between(14, 28),
    duration: 180,
    ease: 'Sine.easeOut',
  });
  scene.time.delayedCall(duration + 280, () => {
    if (aura.active) {
      aura.destroy(true);
    }
  });
  return aura;
}

export function playPixelArcTransfer(scene: Phaser.Scene, options: PixelArcTransferOptions): void {
  const count = Math.max(1, options.count ?? 9);
  const duration = options.duration ?? 720;
  const stagger = options.stagger ?? 52;
  const depth = options.depth ?? 43;
  const midpoint = new Phaser.Math.Vector2(
    (options.from.x + options.to.x) / 2,
    Math.min(options.from.y, options.to.y) - (options.arcHeight ?? 72),
  );
  const curve = new Phaser.Curves.QuadraticBezier(options.from, midpoint, options.to);
  let completed = 0;
  let arrivalNotified = false;

  for (let index = 0; index < count; index += 1) {
    const color = options.colors[index % options.colors.length] ?? 0xffffff;
    const size = (options.pixelSize ?? 5) + (index % 3 === 0 ? 2 : 0);
    const pixel = scene.add.rectangle(options.from.x, options.from.y, size, size, color, 0.88)
      .setDepth(depth)
      .setAlpha(0);
    const progress = { value: 0 };
    scene.tweens.add({
      targets: progress,
      value: 1,
      duration,
      delay: index * stagger,
      ease: 'Sine.easeInOut',
      onStart: () => pixel.setAlpha(0.9),
      onUpdate: () => {
        const point = curve.getPoint(progress.value);
        pixel.setPosition(snap(point.x, 2), snap(point.y, 2));
      },
      onComplete: () => {
        pixel.destroy();
        if (!arrivalNotified) {
          arrivalNotified = true;
          options.onArrive?.();
        }
        completed += 1;
        if (completed === count) {
          options.onComplete?.();
        }
      },
    });
  }
}

function strokePoints(graphics: Phaser.GameObjects.Graphics, points: Phaser.Math.Vector2[]): void {
  graphics.beginPath();
  graphics.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => graphics.lineTo(point.x, point.y));
  graphics.strokePath();
}

function snap(value: number, gap: number): number {
  return Phaser.Math.Snap.To(value, gap);
}

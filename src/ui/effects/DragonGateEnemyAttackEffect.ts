import Phaser from 'phaser';
import type { ResonanceKind } from '../../game/scoring';
import type { EnemyId } from '../../game/types/enemy';

type DragonGateEnemyId = Extract<EnemyId, 'swordsman' | 'songstress' | 'taoist'>;

export interface DragonGateEnemyAttackOptions {
  enemyId: EnemyId;
  from: Phaser.Math.Vector2;
  to: Phaser.Math.Vector2;
  resonance?: ResonanceKind;
  onHit: () => void;
  onComplete?: () => void;
}

interface AttackTier {
  scale: number;
  glowAlpha: number;
  particles: number;
  impactRadius: number;
  trailInterval: number;
}

const TIERS: Record<ResonanceKind, AttackTier> = {
  none: { scale: 0.82, glowAlpha: 0.2, particles: 9, impactRadius: 50, trailInterval: 70 },
  resonance: { scale: 1, glowAlpha: 0.3, particles: 14, impactRadius: 64, trailInterval: 54 },
  strong: { scale: 1.16, glowAlpha: 0.42, particles: 20, impactRadius: 80, trailInterval: 42 },
  boom: { scale: 1.3, glowAlpha: 0.52, particles: 26, impactRadius: 94, trailInterval: 36 },
};

export function playDragonGateEnemyAttackEffect(
  scene: Phaser.Scene,
  options: DragonGateEnemyAttackOptions,
): boolean {
  if (!isDragonGateEnemy(options.enemyId)) {
    return false;
  }

  switch (options.enemyId) {
    case 'swordsman':
      playSwordAura(scene, options);
      break;
    case 'songstress':
      playRedSilkWhip(scene, options);
      break;
    case 'taoist':
      playTalismanSpiritFire(scene, options);
      break;
  }
  return true;
}

function playSwordAura(scene: Phaser.Scene, options: DragonGateEnemyAttackOptions): void {
  const tier = TIERS[options.resonance ?? 'none'];
  const palette = [0x102522, 0x1f665b, 0x35aa91, 0x83ead0, 0xeafff8] as const;
  const direction = options.to.clone().subtract(options.from).normalize();
  const projectile = scene.add.container(options.from.x, options.from.y)
    .setDepth(43)
    .setScale(tier.scale)
    .setRotation(Phaser.Math.Angle.Between(options.from.x, options.from.y, options.to.x, options.to.y));
  const glow = scene.add.ellipse(2, 0, 118, 34, palette[2], tier.glowAlpha * 0.72)
    .setBlendMode(Phaser.BlendModes.ADD);
  projectile.add([glow, createQingfengSword(scene, palette)]);
  const trail = scene.add.graphics()
    .setDepth(41)
    .setBlendMode(Phaser.BlendModes.ADD);
  scene.sound.play('attackWind', { volume: options.resonance === 'none' ? 0.48 : 0.6, rate: 1.12 });

  scene.tweens.add({
    targets: projectile,
    x: options.to.x,
    y: options.to.y,
    duration: 610,
    ease: 'Cubic.easeIn',
    onUpdate: () => {
      const travelled = Phaser.Math.Distance.Between(
        options.from.x,
        options.from.y,
        projectile.x,
        projectile.y,
      );
      drawQingfengTrail(
        trail,
        new Phaser.Math.Vector2(projectile.x, projectile.y),
        direction,
        Math.min(230 * tier.scale, travelled),
        tier.scale,
        palette,
      );
    },
    onComplete: () => playImpact(scene, options, tier, palette, 'sword', () => {
      projectile.destroy(true);
      scene.tweens.add({
        targets: trail,
        alpha: 0,
        duration: 210,
        ease: 'Cubic.easeOut',
        onComplete: () => trail.destroy(),
      });
    }),
  });
}

function playRedSilkWhip(scene: Phaser.Scene, options: DragonGateEnemyAttackOptions): void {
  const tier = TIERS[options.resonance ?? 'none'];
  const palette = [0x26080d, 0x711526, 0xc9364e, 0xe1a64a, 0xffe2a0] as const;
  const direction = options.to.clone().subtract(options.from);
  const normal = new Phaser.Math.Vector2(-direction.y, direction.x).normalize();
  const control = options.from.clone().add(direction.scale(0.5)).add(normal.scale(52));
  const curve = new Phaser.Curves.QuadraticBezier(options.from, control, options.to);
  const strings = scene.add.graphics().setDepth(42).setBlendMode(Phaser.BlendModes.ADD);
  const musicCore = createCrimsonMusicCore(scene, palette, tier)
    .setPosition(options.from.x, options.from.y)
    .setDepth(44)
    .setScale(tier.scale);
  const progress = { value: 0 };
  let lastMoteAt = -Infinity;

  scene.sound.play('attackWind', {
    volume: options.resonance === 'none' ? 0.42 : 0.54,
    rate: 0.92,
  });
  scene.tweens.add({
    targets: progress,
    value: 1,
    duration: 740,
    ease: 'Sine.easeInOut',
    onUpdate: () => {
      const head = curve.getPoint(progress.value);
      musicCore.setPosition(snap(head.x), snap(head.y));
      musicCore.setAngle(progress.value * 210);
      drawCrimsonStrings(strings, curve, progress.value, tier.scale, palette, scene.time.now);
      if (scene.time.now - lastMoteAt >= tier.trailInterval * 1.45) {
        lastMoteAt = scene.time.now;
        spawnMusicGlint(scene, head, palette, tier.glowAlpha);
      }
    },
    onComplete: () => {
      playImpact(scene, options, tier, palette, 'music', () => {
        musicCore.destroy(true);
        scene.tweens.add({
          targets: strings,
          alpha: 0,
          duration: 260,
          ease: 'Cubic.easeOut',
          onComplete: () => strings.destroy(),
        });
      });
    },
  });
}

function playTalismanSpiritFire(scene: Phaser.Scene, options: DragonGateEnemyAttackOptions): void {
  const tier = TIERS[options.resonance ?? 'none'];
  const palette = [0x12332d, 0x287462, 0x62bea0, 0xc6f0cf, 0xe5c36f] as const;
  const direction = options.to.clone().subtract(options.from);
  const normal = new Phaser.Math.Vector2(-direction.y, direction.x).normalize();
  const control = options.from.clone().add(direction.scale(0.5)).add(normal.scale(-34));
  const curve = new Phaser.Curves.QuadraticBezier(options.from, control, options.to);
  const projectile = scene.add.container(options.from.x, options.from.y).setDepth(43).setScale(tier.scale);
  const trail = scene.add.graphics().setDepth(41).setBlendMode(Phaser.BlendModes.ADD);
  const glow = scene.add.circle(0, 0, 35, palette[2], tier.glowAlpha).setBlendMode(Phaser.BlendModes.ADD);
  const halo = createBrokenJadeHalo(scene, palette);
  const talisman = createTalisman(scene, palette);
  projectile.add([glow, halo, talisman]);
  scene.tweens.add({ targets: halo, angle: 180, duration: 900, ease: 'Linear' });
  scene.tweens.add({ targets: talisman, angle: { from: -5, to: 5 }, duration: 190, yoyo: true, repeat: -1 });
  scene.sound.play('attackFire', { volume: options.resonance === 'none' ? 0.44 : 0.56, rate: 0.86 });

  const progress = { value: 0 };
  let lastTrailAt = -Infinity;
  scene.tweens.add({
    targets: progress,
    value: 1,
    duration: 680,
    ease: 'Sine.easeInOut',
    onUpdate: () => {
      const point = curve.getPoint(progress.value);
      projectile.setPosition(snap(point.x), snap(point.y));
      projectile.setAngle(Phaser.Math.Linear(-8, 12, progress.value));
      drawJadeSpiritTrail(trail, curve, progress.value, tier.scale, palette);
      if (scene.time.now - lastTrailAt >= tier.trailInterval) {
        lastTrailAt = scene.time.now;
        spawnSpiritFlame(scene, point, options.from, options.to, tier, palette);
      }
    },
    onComplete: () => playImpact(scene, options, tier, palette, 'talisman', () => {
      projectile.destroy(true);
      scene.tweens.add({
        targets: trail,
        alpha: 0,
        duration: 230,
        ease: 'Cubic.easeOut',
        onComplete: () => trail.destroy(),
      });
    }),
  });
}

function playLinearFlight(
  scene: Phaser.Scene,
  projectile: Phaser.GameObjects.Container,
  options: DragonGateEnemyAttackOptions,
  tier: AttackTier,
  duration: number,
  spawnTrail: () => void,
  palette: readonly number[],
  kind: ImpactKind,
): void {
  let lastTrailAt = -Infinity;
  scene.tweens.add({
    targets: projectile,
    x: options.to.x,
    y: options.to.y,
    duration,
    ease: 'Cubic.easeIn',
    onUpdate: () => {
      if (scene.time.now - lastTrailAt >= tier.trailInterval) {
        lastTrailAt = scene.time.now;
        spawnTrail();
      }
    },
    onComplete: () => playImpact(scene, options, tier, palette, kind, () => projectile.destroy(true)),
  });
}

type ImpactKind = 'sword' | 'music' | 'talisman';

function playImpact(
  scene: Phaser.Scene,
  options: DragonGateEnemyAttackOptions,
  tier: AttackTier,
  palette: readonly number[],
  kind: ImpactKind,
  destroyProjectile: () => void,
): void {
  const ring = kind === 'music'
    ? scene.add.ellipse(options.to.x, options.to.y, 34, 14, palette[1], 0.14)
      .setStrokeStyle(3, palette[3] ?? 0xffffff, 0.92)
      .setDepth(44)
    : scene.add.circle(options.to.x, options.to.y, 13, palette[1], 0.14)
      .setStrokeStyle(kind === 'sword' ? 4 : 3, palette[3] ?? 0xffffff, 0.92)
      .setDepth(44);
  const flash = scene.add.circle(options.to.x, options.to.y, 8, palette[4] ?? 0xffffff, 0.92)
    .setDepth(45)
    .setBlendMode(Phaser.BlendModes.ADD);
  spawnImpactParticles(scene, options.to, tier, palette, kind);
  if (kind === 'sword') {
    createCrossSlash(scene, options.to, tier, palette);
  } else if (kind === 'music') {
    createSoundWaveImpact(scene, options.to, tier, palette);
  }

  scene.time.delayedCall(82, () => {
    options.onHit();
    if (options.resonance === 'strong' || options.resonance === 'boom') {
      scene.cameras.main.shake(130, 0.003);
    }
    destroyProjectile();
    scene.tweens.add({
      targets: [ring, flash],
      scale: tier.impactRadius / 13,
      alpha: 0,
      duration: 300,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        ring.destroy();
        flash.destroy();
      },
    });
    scene.time.delayedCall(320, () => options.onComplete?.());
  });
}

function createQingfengSword(scene: Phaser.Scene, palette: readonly number[]): Phaser.GameObjects.Container {
  const sword = scene.add.container(0, 0);
  const art = scene.add.graphics();

  art.fillStyle(palette[0], 1);
  art.fillPoints([
    new Phaser.Geom.Point(-25, -7),
    new Phaser.Geom.Point(39, -7),
    new Phaser.Geom.Point(57, 0),
    new Phaser.Geom.Point(39, 7),
    new Phaser.Geom.Point(-25, 7),
  ], true);
  art.fillStyle(0xc7ded9, 1);
  art.fillPoints([
    new Phaser.Geom.Point(-22, -5),
    new Phaser.Geom.Point(39, -5),
    new Phaser.Geom.Point(53, 0),
    new Phaser.Geom.Point(-22, 0),
  ], true);
  art.fillStyle(palette[4], 1);
  art.fillPoints([
    new Phaser.Geom.Point(-22, 0),
    new Phaser.Geom.Point(53, 0),
    new Phaser.Geom.Point(39, 5),
    new Phaser.Geom.Point(-22, 5),
  ], true);
  art.lineStyle(2, palette[3], 0.95);
  art.beginPath();
  art.moveTo(-17, 0);
  art.lineTo(43, 0);
  art.strokePath();

  art.fillStyle(0xb99a4b, 1);
  art.fillRect(-29, -12, 7, 24);
  art.fillStyle(0xf0d47d, 1);
  art.fillRect(-27, -10, 3, 20);
  art.fillStyle(palette[0], 1);
  art.fillRect(-49, -5, 20, 10);
  art.fillStyle(palette[2], 1);
  art.fillRect(-47, -4, 17, 8);
  art.lineStyle(2, palette[4], 0.9);
  art.beginPath();
  art.moveTo(-44, -4);
  art.lineTo(-39, 4);
  art.moveTo(-37, -4);
  art.lineTo(-32, 4);
  art.strokePath();
  art.fillStyle(0xb99a4b, 1);
  art.fillCircle(-51, 0, 5);

  sword.add(art);
  return sword;
}

function drawQingfengTrail(
  graphics: Phaser.GameObjects.Graphics,
  head: Phaser.Math.Vector2,
  direction: Phaser.Math.Vector2,
  length: number,
  scale: number,
  palette: readonly number[],
): void {
  graphics.clear();
  if (length < 4) {
    return;
  }

  const normal = new Phaser.Math.Vector2(-direction.y, direction.x);
  const trailHead = head.clone().subtract(direction.clone().scale(18 * scale));
  const tail = trailHead.clone().subtract(direction.clone().scale(length));
  const drawLayer = (halfWidth: number, color: number, alpha: number, tailInset = 0) => {
    const layerTail = tail.clone().add(direction.clone().scale(tailInset));
    graphics.fillStyle(color, alpha);
    graphics.fillTriangle(
      snap(layerTail.x),
      snap(layerTail.y),
      snap(trailHead.x + normal.x * halfWidth * scale),
      snap(trailHead.y + normal.y * halfWidth * scale),
      snap(trailHead.x - normal.x * halfWidth * scale),
      snap(trailHead.y - normal.y * halfWidth * scale),
    );
  };

  drawLayer(15, palette[1], 0.16);
  drawLayer(8, palette[2], 0.34, length * 0.08);
  drawLayer(3, palette[3], 0.72, length * 0.2);
}

function createCrimsonMusicCore(
  scene: Phaser.Scene,
  palette: readonly number[],
  tier: AttackTier,
): Phaser.GameObjects.Container {
  const core = scene.add.container(0, 0);
  const glow = scene.add.circle(0, 0, 22, palette[2], tier.glowAlpha * 0.72)
    .setBlendMode(Phaser.BlendModes.ADD);
  const art = scene.add.graphics();
  art.fillStyle(palette[0], 1);
  art.fillPoints([
    new Phaser.Geom.Point(0, -15),
    new Phaser.Geom.Point(13, 0),
    new Phaser.Geom.Point(0, 15),
    new Phaser.Geom.Point(-13, 0),
  ], true);
  art.lineStyle(3, palette[3], 1);
  art.strokePoints([
    new Phaser.Geom.Point(0, -13),
    new Phaser.Geom.Point(11, 0),
    new Phaser.Geom.Point(0, 13),
    new Phaser.Geom.Point(-11, 0),
  ], true);
  art.fillStyle(palette[4], 1);
  art.fillPoints([
    new Phaser.Geom.Point(0, -7),
    new Phaser.Geom.Point(6, 0),
    new Phaser.Geom.Point(0, 7),
    new Phaser.Geom.Point(-6, 0),
  ], true);
  core.add([glow, art]);
  return core;
}

function drawCrimsonStrings(
  graphics: Phaser.GameObjects.Graphics,
  curve: Phaser.Curves.QuadraticBezier,
  progress: number,
  scale: number,
  palette: readonly number[],
  time: number,
): void {
  graphics.clear();
  const start = Math.max(0, progress - 0.48);
  const phase = time * 0.012;
  const paths = [-1, 0, 1].map((strand) => {
    const points: Phaser.Math.Vector2[] = [];
    for (let index = 0; index <= 18; index += 1) {
      const local = index / 18;
      const t = Phaser.Math.Linear(start, progress, local);
      const point = curve.getPoint(t);
      const tangent = curve.getTangent(t).normalize();
      const strandNormal = new Phaser.Math.Vector2(-tangent.y, tangent.x);
      const envelope = Math.sin(Math.PI * local);
      const offset = (
        strand * 7
        + Math.sin(local * Math.PI * 3.2 - phase + strand * 0.9) * 3.5
      ) * envelope * scale;
      points.push(point.add(strandNormal.scale(offset)));
    }
    return points;
  });
  const draw = (points: Phaser.Math.Vector2[], width: number, color: number, alpha: number) => {
    graphics.lineStyle(Math.max(1, width * scale), color, alpha);
    graphics.beginPath();
    graphics.moveTo(snap(points[0].x), snap(points[0].y));
    points.slice(1).forEach((point) => graphics.lineTo(snap(point.x), snap(point.y)));
    graphics.strokePath();
  };
  paths.forEach((points, index) => {
    draw(points, 7, palette[1], 0.34);
    draw(points, index === 1 ? 2.5 : 2, index === 1 ? palette[3] : palette[2], 0.92);
  });
}

function createTalisman(scene: Phaser.Scene, palette: readonly number[]): Phaser.GameObjects.Container {
  const talisman = scene.add.container(0, 0);
  const paper = scene.add.graphics();
  paper.fillStyle(palette[4], 1);
  paper.lineStyle(3, 0x54331c, 1);
  paper.fillRect(-13, -24, 26, 48);
  paper.strokeRect(-13, -24, 26, 48);
  paper.lineStyle(3, palette[0], 0.95);
  paper.strokeCircle(0, -7, 6);
  paper.beginPath();
  paper.moveTo(0, -1);
  paper.lineTo(-6, 6);
  paper.lineTo(5, 11);
  paper.lineTo(-3, 18);
  paper.strokePath();
  talisman.add(paper);
  return talisman;
}

function drawJadeSpiritTrail(
  graphics: Phaser.GameObjects.Graphics,
  curve: Phaser.Curves.QuadraticBezier,
  progress: number,
  scale: number,
  palette: readonly number[],
): void {
  graphics.clear();
  const start = Math.max(0, progress - 0.5);
  const points = Array.from(
    { length: 19 },
    (_, index) => curve.getPoint(Phaser.Math.Linear(start, progress, index / 18)),
  );
  const draw = (width: number, color: number, alpha: number) => {
    graphics.lineStyle(Math.max(1, width * scale), color, alpha);
    graphics.beginPath();
    graphics.moveTo(snap(points[0].x), snap(points[0].y));
    points.slice(1).forEach((point) => graphics.lineTo(snap(point.x), snap(point.y)));
    graphics.strokePath();
  };

  draw(18, palette[1], 0.15);
  draw(9, palette[2], 0.34);
  draw(3, palette[3], 0.86);
  draw(1, palette[4], 0.96);
}

function createBrokenJadeHalo(scene: Phaser.Scene, palette: readonly number[]): Phaser.GameObjects.Graphics {
  const halo = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  halo.lineStyle(4, palette[2], 0.92);
  halo.beginPath();
  halo.arc(0, 0, 28, -0.2, 1.78, false);
  halo.strokePath();
  halo.beginPath();
  halo.arc(0, 0, 28, 2.08, 5.55, false);
  halo.strokePath();
  halo.fillStyle(palette[3], 0.92);
  halo.fillRect(-3, -33, 6, 6);
  halo.fillRect(-3, 27, 6, 6);
  return halo;
}

function createCrossSlash(
  scene: Phaser.Scene,
  target: Phaser.Math.Vector2,
  tier: AttackTier,
  palette: readonly number[],
): void {
  [-28, 28].forEach((angle) => {
    const slash = scene.add.rectangle(target.x, target.y, 92 * tier.scale, 4, palette[4], 0.94)
      .setDepth(46)
      .setAngle(angle)
      .setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: slash,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 0.25,
      duration: 260,
      ease: 'Cubic.easeOut',
      onComplete: () => slash.destroy(),
    });
  });
}

function createSoundWaveImpact(
  scene: Phaser.Scene,
  target: Phaser.Math.Vector2,
  tier: AttackTier,
  palette: readonly number[],
): void {
  [0, 100].forEach((delay, index) => {
    const wave = scene.add.ellipse(target.x, target.y, 36, 13, palette[index === 0 ? 4 : 3], 0)
      .setStrokeStyle(index === 0 ? 4 : 3, palette[index === 0 ? 4 : 3], 0.94)
      .setDepth(46)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
    scene.time.delayedCall(delay, () => {
      wave.setAlpha(0.94);
      scene.tweens.add({
        targets: wave,
        scaleX: 3.2 * tier.scale,
        scaleY: 2.1 * tier.scale,
        alpha: 0,
        duration: 320,
        ease: 'Cubic.easeOut',
        onComplete: () => wave.destroy(),
      });
    });
  });
}

function spawnMusicGlint(
  scene: Phaser.Scene,
  point: Phaser.Math.Vector2,
  palette: readonly number[],
  alpha: number,
): void {
  const glint = scene.add.rectangle(point.x, point.y, 5, 5, palette[3], Math.max(0.54, alpha))
    .setDepth(42)
    .setAngle(45);
  scene.tweens.add({
    targets: glint,
    x: point.x + Phaser.Math.Between(-14, 14),
    y: point.y + Phaser.Math.Between(-10, 10),
    alpha: 0,
    scale: 0.25,
    duration: 360,
    onComplete: () => glint.destroy(),
  });
}

function spawnSpiritFlame(
  scene: Phaser.Scene,
  point: Phaser.Math.Vector2,
  from: Phaser.Math.Vector2,
  to: Phaser.Math.Vector2,
  tier: AttackTier,
  palette: readonly number[],
): void {
  const direction = to.clone().subtract(from).normalize();
  const flame = scene.add.rectangle(point.x, point.y, 7 * tier.scale, 14 * tier.scale, palette[2], 0.78)
    .setDepth(40)
    .setAngle(45)
    .setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: flame,
    x: point.x - direction.x * 34,
    y: point.y - direction.y * 34 + Phaser.Math.Between(-9, 9),
    alpha: 0,
    scale: 0.25,
    duration: 390,
    ease: 'Cubic.easeOut',
    onComplete: () => flame.destroy(),
  });
}

function spawnImpactParticles(
  scene: Phaser.Scene,
  target: Phaser.Math.Vector2,
  tier: AttackTier,
  palette: readonly number[],
  kind: ImpactKind,
): void {
  for (let index = 0; index < tier.particles; index += 1) {
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const distance = Phaser.Math.Between(24, tier.impactRadius);
    const elongated = kind === 'sword';
    const particle = scene.add.rectangle(
      target.x,
      target.y,
      elongated ? Phaser.Math.Between(3, 5) : Phaser.Math.Between(4, 7),
      elongated ? Phaser.Math.Between(9, 18) : Phaser.Math.Between(4, 7),
      palette[index % palette.length],
      0.9,
    ).setDepth(45).setRotation(angle).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: particle,
      x: target.x + Math.cos(angle) * distance,
      y: target.y + Math.sin(angle) * distance,
      alpha: 0,
      scale: 0.35,
      duration: Phaser.Math.Between(340, 540),
      ease: 'Cubic.easeOut',
      onComplete: () => particle.destroy(),
    });
  }
}

function isDragonGateEnemy(enemyId: EnemyId): enemyId is DragonGateEnemyId {
  return enemyId === 'swordsman' || enemyId === 'songstress' || enemyId === 'taoist';
}

function snap(value: number): number {
  return Phaser.Math.Snap.To(value, 2);
}

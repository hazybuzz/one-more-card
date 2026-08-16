import Phaser from 'phaser';
import type { PortraitBackdropConfig } from '../art';

function colorCss(color: number, alpha = 1): string {
  const red = (color >> 16) & 0xff;
  const green = (color >> 8) & 0xff;
  const blue = color & 0xff;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function ensureGlowTexture(scene: Phaser.Scene, config: PortraitBackdropConfig): string {
  const textureKey = `portrait-glow-${config.id}-ambient-v2`;
  if (scene.textures.exists(textureKey)) {
    return textureKey;
  }

  const texture = scene.textures.createCanvas(textureKey, 64, 64);
  if (!texture) {
    return textureKey;
  }

  const context = texture.getContext();
  const gradient = context.createRadialGradient(32, 30, 1, 32, 32, 32);
  gradient.addColorStop(0, colorCss(config.accentColor, 0.42));
  gradient.addColorStop(0.42, colorCss(config.accentColor, 0.16));
  gradient.addColorStop(1, colorCss(config.accentColor, 0));
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  texture.update();
  return textureKey;
}

function createOrbitShards(
  scene: Phaser.Scene,
  color: number,
  width: number,
  height: number,
  variant: 'outer' | 'inner',
): Phaser.GameObjects.Container {
  const orbit = scene.add.container(0, 0);
  const outer = variant === 'outer';
  const radiusX = width * (outer ? 0.43 : 0.34);
  const radiusY = height * (outer ? 0.4 : 0.31);
  const count = outer ? 10 : 7;
  const angleOffset = outer ? -0.32 : 0.18;

  Array.from({ length: count }, (_, index) => angleOffset + index * (Math.PI * 2 / count)).forEach((angle, index) => {
    const longShard = (index + (outer ? 0 : 1)) % 3 === 0;
    const shard = scene.add.rectangle(
      Math.cos(angle) * radiusX,
      Math.sin(angle) * radiusY,
      longShard ? 3 : 2,
      longShard ? (outer ? 13 : 9) : (outer ? 8 : 6),
      color,
      longShard ? (outer ? 0.68 : 0.5) : (outer ? 0.42 : 0.3),
    ).setRotation(angle + Math.PI / 2);
    orbit.add(shard);

    if (outer && index % 2 === 0) {
      const spark = scene.add.rectangle(
        Math.cos(angle + 0.09) * (radiusX - 7),
        Math.sin(angle + 0.09) * (radiusY - 7),
        3,
        3,
        color,
        0.52,
      ).setRotation(Math.PI / 4);
      orbit.add(spark);
    }
  });

  return orbit;
}

export function createCharacterPortraitBackdrop(
  scene: Phaser.Scene,
  config: PortraitBackdropConfig,
  x: number,
  y: number,
  displayWidth: number,
  displayHeight: number,
): Phaser.GameObjects.Container {
  const root = scene.add.container(x, y);
  const glow = scene.add.image(0, -3, ensureGlowTexture(scene, config))
    .setOrigin(0.5)
    .setDisplaySize(displayWidth * 0.88, displayHeight * 0.88);
  const outerOrbit = createOrbitShards(scene, config.accentColor, displayWidth, displayHeight, 'outer');
  const innerOrbit = createOrbitShards(scene, config.accentColor, displayWidth, displayHeight, 'inner');

  root.add([glow, outerOrbit, innerOrbit]);

  const phaseOffset = config.seed * 173;
  const updateAmbient = (_time: number): void => {
    const time = scene.time.now + phaseOffset;
    const slowPulse = 0.5 + Math.sin(time / 720) * 0.5;
    const counterPulse = 0.5 + Math.sin(time / 720 + Math.PI) * 0.5;
    glow.setAlpha(0.16 + slowPulse * 0.18);
    glow.setScale(0.97 + slowPulse * 0.06);
    outerOrbit.setRotation(time / 10800);
    innerOrbit.setRotation(-time / 14800);
    outerOrbit.setAlpha(0.38 + slowPulse * 0.36);
    innerOrbit.setAlpha(0.24 + counterPulse * 0.3);
    outerOrbit.setScale(0.98 + slowPulse * 0.04);
    innerOrbit.setScale(1.02 - slowPulse * 0.035);
  };

  scene.events.on(Phaser.Scenes.Events.UPDATE, updateAmbient);
  updateAmbient(scene.time.now);
  root.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, updateAmbient);
  });

  return root;
}

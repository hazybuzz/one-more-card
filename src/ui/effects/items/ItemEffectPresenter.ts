import Phaser from 'phaser';
import type { Card } from '../../../game/card';
import { createCardView } from '../../presentation/CardView';

export interface EffectPoint {
  x: number;
  y: number;
}

interface BaseItemEffectConfig {
  iconTextureKey: string;
  player: EffectPoint;
  onComplete: () => void;
}

interface FateBeerEffectConfig extends BaseItemEffectConfig {
  iconStart: EffectPoint;
  onDrink: () => void;
}

interface FateRerollEffectConfig extends BaseItemEffectConfig {
  cards: Card[];
  hand: EffectPoint;
  cardWidth: number;
  cardSpacing: number;
  onCardsConsumed: () => void;
}

interface ResonanceHornEffectConfig extends BaseItemEffectConfig {
  label: string;
  onReveal: () => void;
}

interface HolyShieldEffectConfig extends BaseItemEffectConfig {
  charges: number;
  label: string;
  onActivated: () => void;
}

interface HolyShieldBlockEffectConfig extends BaseItemEffectConfig {
  blockedDamage: number;
  label: string;
}

type EffectRunner = (finish: () => void) => void;

export class ItemEffectPresenter {
  private readonly queue: Array<{ run: EffectRunner; onComplete: () => void }> = [];
  private playing = false;
  private destroyed = false;

  constructor(private readonly scene: Phaser.Scene) {}

  destroy(): void {
    this.destroyed = true;
    this.queue.length = 0;
  }

  playFateBeer(config: FateBeerEffectConfig): void {
    this.enqueue((finish) => {
      const shade = this.scene.add.rectangle(640, 360, 1280, 720, 0x050608, 0)
        .setDepth(55)
        .setInteractive();
      const icon = this.scene.add.image(config.iconStart.x, config.iconStart.y, config.iconTextureKey)
        .setDepth(63)
        .setDisplaySize(86, 86)
        .setAlpha(0)
        .setScale(0.72)
        .setRotation(-0.28);
      const amberGlow = this.scene.add.circle(config.player.x, config.player.y, 28, 0xd99432, 0)
        .setDepth(58)
        .setBlendMode(Phaser.BlendModes.ADD);

      this.scene.sound.play('beerBubble', { volume: 0.58 });
      this.scene.tweens.add({ targets: shade, alpha: 0.28, duration: 240, ease: 'Sine.easeOut' });
      this.scene.tweens.add({
        targets: icon,
        x: config.player.x + 62,
        y: config.player.y - 54,
        alpha: 1,
        scale: 1,
        rotation: -0.06,
        duration: 420,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          this.playBubbles(icon.x - 8, icon.y - 25, 0xffe3a1, 65);
          this.scene.tweens.add({
            targets: icon,
            y: icon.y - 10,
            rotation: 0.48,
            duration: 360,
            ease: 'Sine.easeInOut',
            onComplete: () => {
              config.onDrink();
              this.scene.tweens.add({
                targets: amberGlow,
                alpha: 0.5,
                scale: 3.2,
                duration: 540,
                ease: 'Cubic.easeOut',
              });
              this.scene.tweens.add({
                targets: icon,
                alpha: 0,
                y: icon.y - 26,
                duration: 260,
                ease: 'Sine.easeOut',
              });
              this.scene.tweens.add({
                targets: shade,
                alpha: 0,
                duration: 430,
                delay: 220,
                onComplete: () => {
                  shade.destroy();
                  icon.destroy();
                  amberGlow.destroy();
                  finish();
                },
              });
            },
          });
        },
      });
    }, config.onComplete);
  }

  playFateReroll(config: FateRerollEffectConfig): void {
    this.enqueue((finish) => {
      const shade = this.scene.add.rectangle(640, 360, 1280, 720, 0x10060b, 0)
        .setDepth(55)
        .setInteractive();
      const icon = this.scene.add.image(config.hand.x, config.hand.y - 94, config.iconTextureKey)
        .setDepth(65)
        .setDisplaySize(92, 92)
        .setAlpha(0)
        .setScale(0.7);
      const orbit = this.scene.add.circle(config.hand.x, config.hand.y - 8, 66, 0x6e1d2e, 0.08)
        .setStrokeStyle(3, 0xb78745, 0.78)
        .setDepth(62)
        .setBlendMode(Phaser.BlendModes.ADD);
      const cards = config.cards.map((card, index) => createCardView(this.scene, {
        x: config.hand.x + (index - (config.cards.length - 1) / 2) * config.cardSpacing,
        y: config.hand.y,
        card,
        width: config.cardWidth,
      }).setDepth(63));

      this.scene.sound.play('resonanceEcho', { volume: 0.28, rate: 0.76 });
      this.scene.tweens.add({ targets: shade, alpha: 0.44, duration: 260, ease: 'Sine.easeOut' });
      this.scene.tweens.add({
        targets: icon,
        alpha: 1,
        scale: 1,
        duration: 320,
        ease: 'Back.easeOut',
      });
      this.scene.tweens.add({
        targets: orbit,
        angle: 160,
        scale: 1.18,
        alpha: 0.55,
        duration: 760,
        ease: 'Sine.easeInOut',
      });
      this.scene.time.delayedCall(360, () => {
        cards.forEach((card, index) => {
          this.scene.tweens.add({
            targets: card,
            x: icon.x,
            y: icon.y + 16,
            angle: index % 2 === 0 ? -28 : 28,
            scale: 0.18,
            alpha: 0,
            duration: 470 + index * 55,
            ease: 'Cubic.easeIn',
            onComplete: () => card.destroy(true),
          });
        });
        this.playPaperFragments(config.hand.x, config.hand.y - 10);
      });
      this.scene.time.delayedCall(900, () => {
        config.onCardsConsumed();
        this.scene.tweens.add({
          targets: [icon, orbit],
          alpha: 0,
          scale: 1.3,
          duration: 280,
          ease: 'Cubic.easeOut',
        });
        this.scene.tweens.add({
          targets: shade,
          alpha: 0,
          duration: 360,
          onComplete: () => {
            shade.destroy();
            icon.destroy();
            orbit.destroy();
            finish();
          },
        });
      });
    }, config.onComplete);
  }

  playResonanceHorn(config: ResonanceHornEffectConfig): void {
    this.enqueue((finish) => {
      const shade = this.scene.add.rectangle(640, 360, 1280, 720, 0x050608, 0)
        .setDepth(55)
        .setInteractive();
      const horn = this.scene.add.image(config.player.x, config.player.y - 82, config.iconTextureKey)
        .setDepth(66)
        .setDisplaySize(104, 104)
        .setAlpha(0)
        .setScale(0.55)
        .setRotation(-0.32);
      const runeRing = this.scene.add.circle(config.player.x, config.player.y - 8, 46, 0xb89148, 0.05)
        .setStrokeStyle(3, 0xe1bf72, 0.86)
        .setDepth(63)
        .setBlendMode(Phaser.BlendModes.ADD);
      const hornSound = this.scene.sound.add('fateHorn', { volume: 0.62 });
      hornSound.play();
      this.scene.time.delayedCall(5000, () => {
        if (hornSound.isPlaying) {
          hornSound.stop();
        }
        hornSound.destroy();
      });

      this.scene.tweens.add({ targets: shade, alpha: 0.52, duration: 420, ease: 'Sine.easeOut' });
      this.scene.tweens.add({
        targets: horn,
        alpha: 1,
        scale: 1,
        rotation: -0.08,
        duration: 560,
        ease: 'Back.easeOut',
      });
      this.scene.time.delayedCall(620, () => {
        this.playShockwaves(config.player.x, config.player.y - 18);
        this.scene.tweens.add({
          targets: runeRing,
          alpha: 0.72,
          scale: 2.5,
          angle: 130,
          duration: 1280,
          ease: 'Sine.easeOut',
        });
      });
      this.scene.time.delayedCall(1600, () => {
        config.onReveal();
        this.scene.sound.play('resonanceEcho', { volume: 0.5 });
        this.playGoldenThreads(config.player.x, config.player.y - 18);
        const label = this.scene.add.text(config.player.x, config.player.y - 154, config.label, {
          fontFamily: 'Almendra SC, serif',
          fontSize: '27px',
          color: '#f3d482',
          stroke: '#3b2607',
          strokeThickness: 4,
          fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(68);
        label.setShadow(0, 0, '#d5a94e', 16, true, true);
        this.scene.tweens.add({
          targets: label,
          y: label.y - 18,
          alpha: 0,
          duration: 1050,
          delay: 430,
          ease: 'Sine.easeOut',
          onComplete: () => label.destroy(),
        });
      });
      this.scene.time.delayedCall(2500, () => {
        this.scene.tweens.add({ targets: [horn, runeRing], alpha: 0, duration: 420 });
        this.scene.tweens.add({
          targets: shade,
          alpha: 0,
          duration: 500,
          onComplete: () => {
            horn.destroy();
            runeRing.destroy();
            finish();
          },
        });
      });
    }, config.onComplete);
  }

  playHolyShieldActivation(config: HolyShieldEffectConfig): void {
    this.enqueue((finish) => {
      const icon = this.scene.add.image(config.player.x, config.player.y - 116, config.iconTextureKey)
        .setDepth(66)
        .setDisplaySize(98, 98)
        .setAlpha(0)
        .setScale(0.62)
        .setAngle(-18);
      const core = this.scene.add.circle(config.player.x, config.player.y, 22, 0xe8b84f, 0)
        .setDepth(64)
        .setBlendMode(Phaser.BlendModes.ADD);
      const ward = this.scene.add.circle(config.player.x, config.player.y, 48, 0xd6a23f, 0.05)
        .setStrokeStyle(4, 0xffdf8a, 0)
        .setDepth(63)
        .setBlendMode(Phaser.BlendModes.ADD);

      this.scene.sound.play('resonanceEcho', { volume: 0.38, rate: 0.82 });
      this.scene.tweens.add({
        targets: icon,
        y: config.player.y - 22,
        alpha: 1,
        scale: 1,
        angle: 0,
        duration: 520,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          config.onActivated();
          this.scene.tweens.add({ targets: core, alpha: 0.58, scale: 3.8, duration: 520, ease: 'Cubic.easeOut' });
          this.scene.tweens.add({
            targets: ward,
            alpha: 0.82,
            scale: 1.7,
            duration: 620,
            ease: 'Back.easeOut',
          });
          const label = this.scene.add.text(config.player.x, config.player.y - 130, config.label, {
            fontFamily: 'Almendra SC, serif',
            fontSize: '23px',
            color: '#ffe19a',
            stroke: '#33210a',
            strokeThickness: 4,
            fontStyle: 'bold',
          }).setOrigin(0.5).setDepth(68);
          label.setShadow(0, 0, '#e6b957', 14, true, true);
          this.scene.tweens.add({ targets: label, y: label.y - 18, alpha: 0, duration: 760, delay: 300, onComplete: () => label.destroy() });
        },
      });
      this.scene.time.delayedCall(1160, () => {
        this.scene.tweens.add({ targets: [icon, core, ward], alpha: 0, duration: 300, onComplete: () => {
          icon.destroy();
          core.destroy();
          ward.destroy();
          finish();
        } });
      });
    }, config.onComplete);
  }

  playHolyShieldBlock(config: HolyShieldBlockEffectConfig): void {
    this.enqueue((finish) => {
      const icon = this.scene.add.image(config.player.x, config.player.y, config.iconTextureKey)
        .setDepth(67)
        .setDisplaySize(112, 112)
        .setAlpha(0.96)
        .setScale(0.72);
      const impact = this.scene.add.circle(config.player.x, config.player.y, 30, 0xffd66d, 0.52)
        .setStrokeStyle(5, 0xffedac, 0.96)
        .setDepth(66)
        .setBlendMode(Phaser.BlendModes.ADD);
      const label = this.scene.add.text(config.player.x, config.player.y - 126, config.label, {
        fontFamily: 'Almendra SC, serif',
        fontSize: '22px',
        color: '#ffebad',
        stroke: '#33210a',
        strokeThickness: 4,
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(68);
      const damage = this.scene.add.text(config.player.x, config.player.y - 92, `-${config.blockedDamage}`, {
        fontFamily: 'Almendra SC, serif',
        fontSize: '20px',
        color: '#ffd878',
        stroke: '#33210a',
        strokeThickness: 3,
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(68);

      this.scene.sound.play('resonanceEcho', { volume: 0.4, rate: 0.9 });
      this.scene.cameras.main.shake(110, 0.0025);
      this.scene.tweens.add({ targets: icon, scale: 1.08, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
      this.scene.tweens.add({ targets: impact, scale: 3.5, alpha: 0, duration: 560, ease: 'Cubic.easeOut' });
      this.scene.tweens.add({ targets: [label, damage], y: '-=22', alpha: 0, duration: 720, delay: 180, ease: 'Sine.easeOut' });
      this.scene.time.delayedCall(820, () => {
        icon.destroy();
        impact.destroy();
        label.destroy();
        damage.destroy();
        finish();
      });
    }, config.onComplete);
  }

  private enqueue(run: EffectRunner, onComplete: () => void): void {
    this.queue.push({ run, onComplete });
    this.playNext();
  }

  private playNext(): void {
    if (this.playing || this.destroyed) {
      return;
    }
    const next = this.queue.shift();
    if (!next) {
      return;
    }
    this.playing = true;
    let finished = false;
    next.run(() => {
      if (finished || this.destroyed) {
        return;
      }
      finished = true;
      this.playing = false;
      next.onComplete();
      this.playNext();
    });
  }

  private playBubbles(x: number, y: number, color: number, depth: number): void {
    [-18, -7, 6, 18].forEach((offset, index) => {
      const bubble = this.scene.add.circle(x + offset, y + (index % 2) * 6, 4 + (index % 2), color, 0.82).setDepth(depth);
      this.scene.tweens.add({
        targets: bubble,
        x: bubble.x + (index - 1.5) * 7,
        y: bubble.y - 30 - index * 5,
        alpha: 0,
        scale: 1.7,
        duration: 430 + index * 65,
        ease: 'Sine.easeOut',
        onComplete: () => bubble.destroy(),
      });
    });
  }

  private playPaperFragments(x: number, y: number): void {
    for (let index = 0; index < 12; index += 1) {
      const fragment = this.scene.add.rectangle(x, y, 4 + index % 3, 7 + index % 4, index % 2 === 0 ? 0x8f263a : 0x30212a, 0.9)
        .setDepth(64)
        .setAngle(Phaser.Math.Between(-40, 40));
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(34, 78);
      this.scene.tweens.add({
        targets: fragment,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        angle: Phaser.Math.Between(-160, 160),
        alpha: 0,
        duration: Phaser.Math.Between(420, 680),
        ease: 'Cubic.easeOut',
        onComplete: () => fragment.destroy(),
      });
    }
  }

  private playShockwaves(x: number, y: number): void {
    [0, 180, 360].forEach((delay) => {
      const ring = this.scene.add.circle(x, y, 20, 0xd4b36a, 0.04)
        .setStrokeStyle(3, 0xe7ca84, 0.82)
        .setDepth(64)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({
        targets: ring,
        scale: 5.6,
        alpha: 0,
        duration: 1000,
        delay,
        ease: 'Cubic.easeOut',
        onComplete: () => ring.destroy(),
      });
    });
  }

  private playGoldenThreads(x: number, y: number): void {
    for (let index = 0; index < 14; index += 1) {
      const angle = (Math.PI * 2 * index) / 14;
      const particle = this.scene.add.rectangle(
        x + Math.cos(angle) * 82,
        y + Math.sin(angle) * 48,
        3,
        10,
        index % 2 === 0 ? 0xf1d486 : 0xb68c45,
        0.88,
      ).setDepth(66).setRotation(angle);
      this.scene.tweens.add({
        targets: particle,
        x,
        y,
        alpha: 0,
        scaleY: 2.2,
        duration: 620 + (index % 3) * 80,
        ease: 'Cubic.easeIn',
        onComplete: () => particle.destroy(),
      });
    }
  }
}

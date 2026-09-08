import Phaser from 'phaser';
import { SOUL_STONE_ART } from '../art';
import { GAME_FONT_FAMILY } from '../themes/typography';

interface SoulStoneMeterOptions {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  muted?: boolean;
  stoneSize?: number;
  spacing?: number;
  arcRadius?: number;
  onShowTooltip?: () => void;
  onHideTooltip?: () => void;
}

type SoulStoneState = 'burning' | 'ember' | 'empty';

interface SoulStoneSlot {
  capacity: 1 | 2;
  container: Phaser.GameObjects.Container;
  stone: Phaser.GameObjects.Image;
  halo: Phaser.GameObjects.Arc;
  flameOuter: Phaser.GameObjects.Ellipse;
  flameInner: Phaser.GameObjects.Ellipse;
  ember: Phaser.GameObjects.Arc;
  state: SoulStoneState;
}

export class SoulStoneMeter {
  readonly container: Phaser.GameObjects.Container;

  private readonly scene: Phaser.Scene;
  private readonly maxHp: number;
  private readonly muted: boolean;
  private readonly slots: SoulStoneSlot[] = [];
  private readonly updateHandler: (time: number) => void;
  private readonly valueText: Phaser.GameObjects.Text;
  private hp: number;

  constructor(scene: Phaser.Scene, options: SoulStoneMeterOptions) {
    this.scene = scene;
    this.hp = Phaser.Math.Clamp(options.hp, 0, options.maxHp);
    this.maxHp = Math.max(1, options.maxHp);
    this.muted = options.muted ?? false;
    this.container = scene.add.container(options.x, options.y);

    const slotCount = Math.ceil(this.maxHp / 2);
    const stoneSize = options.stoneSize ?? 30;
    const spacing = options.spacing ?? 25;
    const arcRadius = options.arcRadius ?? 92;
    const centerIndex = (slotCount - 1) / 2;
    const angularStep = spacing / arcRadius;
    const outerAngle = centerIndex * angularStep;
    const edgeX = Math.sin(outerAngle) * arcRadius;

    for (let index = 0; index < slotCount; index += 1) {
      const offset = index - centerIndex;
      const angle = offset * angularStep;
      const slot = this.createSlot(
        Math.sin(angle) * arcRadius,
        -Math.cos(angle) * arcRadius,
        stoneSize,
        index === slotCount - 1 && this.maxHp % 2 === 1 ? 1 : 2,
      );
      this.slots.push(slot);
      this.container.add(slot.container);
    }

    const valueX = edgeX + stoneSize / 2 + 25;
    const valueY = -arcRadius + stoneSize * 0.28;
    const valueBackground = scene.add.rectangle(valueX, valueY, 46, 21, 0x140a0c, 0.78)
      .setStrokeStyle(1, 0xa64a4f, 0.72);
    this.valueText = scene.add.text(valueX, valueY - 1, `${this.hp}/${this.maxHp}`, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '13px',
      color: this.muted ? '#817477' : '#ff9b93',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    if (!this.muted) {
      this.valueText.setShadow(0, 0, '#ef3348', 6, true, true);
    }
    this.container.add([valueBackground, this.valueText]);

    this.updateSlots();
    this.animateBurningStones(scene.time.now);
    this.updateHandler = (time) => this.animateBurningStones(time);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.updateHandler);
    this.container.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.UPDATE, this.updateHandler);
      this.slots.forEach((slot) => scene.tweens.killTweensOf(slot.container));
    });

    if (options.onShowTooltip || options.onHideTooltip) {
      const edgeY = -Math.cos(outerAngle) * arcRadius;
      const meterWidth = Math.max(stoneSize, edgeX * 2 + stoneSize);
      const meterHeight = edgeY + arcRadius + stoneSize + 12;
      const hitArea = scene.add.rectangle(0, (-arcRadius + edgeY) / 2, meterWidth, meterHeight, 0x000000, 0.001)
        .setInteractive({ useHandCursor: false });
      this.container.add(hitArea);
      hitArea.on('pointerover', () => options.onShowTooltip?.());
      hitArea.on('pointerout', () => options.onHideTooltip?.());
    }
  }

  setHp(hp: number, animate = false): void {
    const nextHp = Phaser.Math.Clamp(hp, 0, this.maxHp);
    if (nextHp === this.hp) {
      return;
    }

    const previousStates = this.slots.map((slot) => slot.state);
    this.hp = nextHp;
    this.valueText.setText(`${this.hp}/${this.maxHp}`);
    this.updateSlots();
    if (!animate) {
      return;
    }

    this.slots.forEach((slot, index) => {
      if (slot.state === previousStates[index]) {
        return;
      }
      this.scene.tweens.killTweensOf(slot.container);
      slot.container.setScale(1).setAngle(0);
      this.scene.tweens.add({
        targets: slot.container,
        scaleX: { from: 1.18, to: 1 },
        scaleY: { from: 1.18, to: 1 },
        angle: { from: index % 2 === 0 ? -5 : 5, to: 0 },
        duration: 260,
        ease: 'Back.easeOut',
      });
    });
  }

  private createSlot(x: number, y: number, size: number, capacity: 1 | 2): SoulStoneSlot {
    const container = this.scene.add.container(x, y);
    const halo = this.scene.add.circle(0, -1, size * 0.45, 0xff382f, 0.56)
      .setBlendMode(Phaser.BlendModes.ADD);
    const stone = this.scene.add.image(0, 0, SOUL_STONE_ART.textureKey).setDisplaySize(size, size);
    const flameOuter = this.scene.add.ellipse(0, -size * 0.4, size * 0.28, size * 0.48, 0xe63a20, 0.86)
      .setBlendMode(Phaser.BlendModes.ADD);
    const flameInner = this.scene.add.ellipse(0, -size * 0.42, size * 0.14, size * 0.31, 0xffdc62, 0.96)
      .setBlendMode(Phaser.BlendModes.ADD);
    const ember = this.scene.add.circle(0, -size * 0.04, Math.max(1.5, size * 0.07), 0xc72d28, 0.82)
      .setBlendMode(Phaser.BlendModes.ADD);
    container.add([halo, stone, flameOuter, flameInner, ember]);
    return { capacity, container, stone, halo, flameOuter, flameInner, ember, state: 'empty' };
  }

  private updateSlots(): void {
    this.slots.forEach((slot, index) => {
      const value = Phaser.Math.Clamp(this.hp - index * 2, 0, slot.capacity);
      const nextState: SoulStoneState = value <= 0
        ? 'empty'
        : (value >= 2 ? 'burning' : 'ember');
      slot.state = nextState;
      this.applyState(slot);
    });
  }

  private applyState(slot: SoulStoneSlot): void {
    if (this.muted || slot.state === 'empty') {
      slot.stone.setTint(0x4a4546).setAlpha(this.muted ? 0.28 : 0.42);
      slot.halo.setVisible(!this.muted);
      slot.flameOuter.setVisible(false);
      slot.flameInner.setVisible(false);
      slot.ember.setVisible(false);
      return;
    }

    if (slot.state === 'ember') {
      slot.stone.setTint(0x8a5d58).setAlpha(0.82);
      slot.halo.setVisible(true);
      slot.flameOuter.setVisible(false);
      slot.flameInner.setVisible(false);
      slot.ember.setVisible(true);
      return;
    }

    slot.stone.clearTint().setAlpha(1);
    slot.halo.setVisible(true);
    slot.flameOuter.setVisible(true);
    slot.flameInner.setVisible(true);
    slot.ember.setVisible(false);
  }

  private animateBurningStones(time: number): void {
    this.slots.forEach((slot, index) => {
      if (this.muted) {
        return;
      }
      const phase = time * 0.006 + index * 0.83;
      const haloBase = slot.state === 'burning' ? 0.3 : (slot.state === 'ember' ? 0.15 : 0.045);
      const haloRange = slot.state === 'burning' ? 0.09 : (slot.state === 'ember' ? 0.045 : 0.014);
      slot.halo.setAlpha(haloBase + Math.sin(phase * 0.64) * haloRange);
      if (slot.state !== 'burning') {
        return;
      }
      slot.flameOuter.setX(Math.sin(phase * 0.7) * 1.1);
      slot.flameOuter.setScale(0.93 + Math.sin(phase) * 0.1, 0.88 + Math.sin(phase * 1.17) * 0.17);
      slot.flameOuter.setAlpha(0.74 + Math.sin(phase * 0.91) * 0.14);
      slot.flameInner.setX(Math.sin(phase * 0.72) * 1.2);
      slot.flameInner.setScale(0.9 + Math.cos(phase) * 0.08, 0.85 + Math.cos(phase * 1.13) * 0.15);
    });
  }
}

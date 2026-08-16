import Phaser from 'phaser';
import type { BattleLayoutConfig } from '../layout';
import type { ProceduralTavernVisualTokens } from '../themes';

export class ProceduralTavernBackdrop {
  readonly container: Phaser.GameObjects.Container;

  private readonly animatedTargets: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    layout: BattleLayoutConfig,
    tokens: ProceduralTavernVisualTokens,
    enemyCount: number,
  ) {
    this.container = scene.add.container(0, 0).setDepth(-50).setName('procedural-tavern-backdrop');
    this.renderFoundation(layout, tokens, enemyCount);
  }

  destroy(): void {
    this.animatedTargets.forEach((target) => this.scene.tweens.killTweensOf(target));
    if (this.container.scene) {
      this.container.destroy(true);
    }
  }

  private renderFoundation(
    layout: BattleLayoutConfig,
    tokens: ProceduralTavernVisualTokens,
    enemyCount: number,
  ): void {
    this.container.add([
      this.scene.add.rectangle(640, 360, 1280, 720, tokens.background),
      this.scene.add.rectangle(640, 360, 1280, 720, tokens.backgroundAlt, 0.42),
    ]);

    this.renderWoodenRoom(tokens);
    this.renderMoonWindow(tokens);
    this.renderTavernDetails(tokens);
    this.renderTable(tokens);

    const enemyCenters = this.enemyPortraitCenters(layout, enemyCount);
    const playerCenter = new Phaser.Math.Vector2(
      layout.seats.player.x + layout.playerHud.portrait.x,
      layout.seats.player.y + layout.playerHud.portrait.y,
    );
    const seats = [...enemyCenters, playerCenter];

    this.renderTableSigil(tokens);
    this.renderSeatLight(seats, tokens);
    this.renderCandles(tokens);
    this.renderDust(tokens);
    this.renderVignette(tokens);
  }

  private renderWoodenRoom(tokens: ProceduralTavernVisualTokens): void {
    const room = this.scene.add.graphics();
    room.fillStyle(tokens.woodDark, 0.96);
    room.fillRect(0, 0, 1280, 272);
    room.fillStyle(tokens.background, 0.5);
    room.fillRect(0, 272, 1280, 448);

    room.lineStyle(2, tokens.woodLight, 0.12);
    for (let x = 20; x < 1280; x += 92) {
      room.lineBetween(x, 0, x + 12, 272);
    }

    room.fillStyle(tokens.wood, 0.78);
    room.fillRect(0, 20, 1280, 22);
    room.fillRect(0, 190, 1280, 18);
    room.fillRect(0, 258, 1280, 24);
    room.fillRect(64, 0, 28, 282);
    room.fillRect(1188, 0, 28, 282);
    room.fillRect(402, 0, 20, 272);
    room.fillRect(858, 0, 20, 272);

    room.lineStyle(2, tokens.woodLight, 0.2);
    room.lineBetween(0, 42, 1280, 42);
    room.lineBetween(0, 208, 1280, 208);
    room.lineBetween(0, 282, 1280, 282);
    this.container.add(room);
  }

  private renderMoonWindow(tokens: ProceduralTavernVisualTokens): void {
    const frame = this.scene.add.graphics();
    frame.fillStyle(0x05080c, 0.98);
    frame.fillRoundedRect(118, 62, 176, 148, 3);
    frame.lineStyle(8, tokens.wood, 1);
    frame.strokeRoundedRect(114, 58, 184, 156, 4);
    frame.lineStyle(4, tokens.woodLight, 0.7);
    frame.lineBetween(206, 62, 206, 206);
    frame.lineBetween(120, 134, 292, 134);
    this.container.add(frame);

    const moon = this.scene.add.circle(248, 94, 22, tokens.moonlight, 0.38);
    const moonGlow = this.scene.add.circle(248, 94, 48, tokens.moonlight, 0.07);
    const beam = this.scene.add.graphics();
    beam.fillStyle(tokens.moonlight, 0.035);
    beam.fillPoints([
      new Phaser.Geom.Point(124, 76),
      new Phaser.Geom.Point(292, 76),
      new Phaser.Geom.Point(538, 612),
      new Phaser.Geom.Point(260, 612),
    ], true);
    this.container.add([beam, moonGlow, moon]);
    this.animatedTargets.push(beam, moonGlow, moon);

    this.scene.tweens.add({
      targets: [beam, moonGlow],
      alpha: { from: 0.55, to: 1 },
      duration: tokens.motion.moonBreathDuration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.scene.tweens.add({
      targets: moon,
      alpha: { from: 0.58, to: 0.9 },
      duration: tokens.motion.moonBreathDuration * 0.78,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private renderTavernDetails(tokens: ProceduralTavernVisualTokens): void {
    const details = this.scene.add.graphics();

    details.fillStyle(tokens.wood, 0.84);
    details.fillRect(936, 84, 244, 14);
    details.fillRect(930, 164, 250, 14);
    details.lineStyle(2, tokens.woodLight, 0.2);
    details.lineBetween(936, 98, 1180, 98);
    details.lineBetween(930, 178, 1180, 178);

    const bottles = [954, 978, 1010, 1048, 1070, 1112, 1142, 1162];
    bottles.forEach((x, index) => {
      const shelfY = index % 2 === 0 ? 84 : 164;
      const height = 24 + (index % 3) * 8;
      details.fillStyle(index % 3 === 0 ? 0x385043 : 0x4b2921, 0.46);
      details.fillRoundedRect(x, shelfY - height, 12 + (index % 2) * 4, height, 3);
      details.fillRect(x + 4, shelfY - height - 8, 5, 10);
    });

    details.fillStyle(0x755232, 0.42);
    details.fillRoundedRect(520, 68, 148, 108, 5);
    details.lineStyle(2, tokens.clothEdge, 0.28);
    details.strokeRoundedRect(520, 68, 148, 108, 5);
    details.lineStyle(1, 0x241813, 0.48);
    details.lineBetween(538, 92, 646, 148);
    details.lineBetween(548, 150, 636, 92);
    details.strokeCircle(588, 120, 24);

    details.lineStyle(5, tokens.woodLight, 0.38);
    details.strokeCircle(790, 112, 34);
    details.lineBetween(768, 86, 748, 58);
    details.lineBetween(812, 86, 832, 58);
    details.lineStyle(3, tokens.woodLight, 0.3);
    details.lineBetween(768, 86, 754, 74);
    details.lineBetween(812, 86, 826, 74);
    this.container.add(details);
  }

  private renderTable(tokens: ProceduralTavernVisualTokens): void {
    const table = this.scene.add.graphics();
    const outer = [
      new Phaser.Geom.Point(300, 198),
      new Phaser.Geom.Point(980, 198),
      new Phaser.Geom.Point(1238, 690),
      new Phaser.Geom.Point(42, 690),
    ];
    const cloth = [
      new Phaser.Geom.Point(332, 222),
      new Phaser.Geom.Point(948, 222),
      new Phaser.Geom.Point(1152, 638),
      new Phaser.Geom.Point(128, 638),
    ];

    table.fillStyle(tokens.wood, 1);
    table.fillPoints(outer, true);
    table.lineStyle(5, tokens.woodLight, 0.62);
    table.strokePoints(outer, true);
    table.fillStyle(tokens.cloth, 0.95);
    table.fillPoints(cloth, true);
    table.lineStyle(3, tokens.clothEdge, 0.5);
    table.strokePoints(cloth, true);

    table.lineStyle(1, tokens.clothEdge, 0.12);
    [286, 380, 486, 584].forEach((y) => {
      const progress = (y - 222) / (638 - 222);
      const halfWidth = Phaser.Math.Linear(294, 492, progress);
      table.lineBetween(640 - halfWidth, y, 640 + halfWidth, y);
    });
    table.lineStyle(2, tokens.woodLight, 0.16);
    table.lineBetween(54, 670, 1226, 670);
    this.container.add(table);

    const front = this.scene.add.graphics();
    front.fillStyle(tokens.woodDark, 1);
    front.fillPoints([
      new Phaser.Geom.Point(42, 690),
      new Phaser.Geom.Point(1238, 690),
      new Phaser.Geom.Point(1188, 720),
      new Phaser.Geom.Point(92, 720),
    ], true);
    front.lineStyle(2, tokens.woodLight, 0.36);
    front.lineBetween(42, 690, 1238, 690);
    this.container.add(front);
  }

  private renderTableSigil(tokens: ProceduralTavernVisualTokens): void {
    const sigil = this.scene.add.graphics();
    sigil.lineStyle(1, tokens.resonance, 0.16);
    sigil.strokeCircle(640, 420, 72);
    sigil.strokeCircle(640, 420, 46);
    for (let index = 0; index < 8; index += 1) {
      const angle = Phaser.Math.DegToRad(index * 45);
      sigil.lineBetween(
        640 + Math.cos(angle) * 48,
        420 + Math.sin(angle) * 48,
        640 + Math.cos(angle) * 67,
        420 + Math.sin(angle) * 67,
      );
    }
    this.container.add(sigil);
    this.animatedTargets.push(sigil);
    this.scene.tweens.add({
      targets: sigil,
      alpha: { from: 0.28, to: 0.78 },
      scale: { from: 0.98, to: 1.025 },
      duration: tokens.motion.runeBreathDuration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private renderSeatLight(seats: Phaser.Math.Vector2[], tokens: ProceduralTavernVisualTokens): void {
    seats.forEach((seat, index) => {
      const isPlayer = index === seats.length - 1;
      const color = isPlayer ? tokens.candle : index === 1 ? tokens.moonlight : tokens.woodLight;
      const halo = this.scene.add.circle(seat.x, seat.y, 96, color, 0.018)
        .setStrokeStyle(2, color, isPlayer ? 0.18 : 0.1);
      this.container.add(halo);
      this.animatedTargets.push(halo);
      this.scene.tweens.add({
        targets: halo,
        alpha: { from: 0.2, to: 0.56 },
        scale: { from: 0.98, to: 1.04 },
        duration: 2600 + index * 280,
        delay: index * 190,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
  }

  private renderCandles(tokens: ProceduralTavernVisualTokens): void {
    this.renderCandle(440, 266, 42, tokens, 0);
    this.renderCandle(840, 266, 42, tokens, 270);
  }

  private renderCandle(
    x: number,
    y: number,
    height: number,
    tokens: ProceduralTavernVisualTokens,
    delay: number,
  ): void {
    const glow = this.scene.add.circle(x, y - height - 10, 74, tokens.candle, 0.045);
    const body = this.scene.add.rectangle(x, y - height / 2, 14, height, 0xe8d8b5, 0.9);
    const base = this.scene.add.ellipse(x, y + 2, 42, 10, tokens.woodDark, 0.9)
      .setStrokeStyle(2, tokens.clothEdge, 0.4);
    const flame = this.scene.add.ellipse(x, y - height - 10, 11, 25, tokens.candle, 0.94);
    const core = this.scene.add.ellipse(x, y - height - 7, 4, 12, tokens.candleCore, 1);
    this.container.add([glow, base, body, flame, core]);
    this.animatedTargets.push(glow, flame, core);

    this.scene.tweens.add({
      targets: [flame, core],
      x: { from: x - 1.5, to: x + 1.5 },
      scaleY: { from: 0.88, to: 1.12 },
      alpha: { from: 0.78, to: 1 },
      duration: tokens.motion.candleFlickerDuration,
      delay,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.scene.tweens.add({
      targets: glow,
      scale: { from: 0.88, to: 1.12 },
      alpha: { from: 0.38, to: 0.82 },
      duration: tokens.motion.candleFlickerDuration * 1.7,
      delay,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private renderDust(tokens: ProceduralTavernVisualTokens): void {
    for (let index = 0; index < tokens.motion.dustCount; index += 1) {
      const x = 86 + (index * 101) % 1100;
      const y = 76 + (index * 73) % 560;
      const dust = this.scene.add.circle(
        x,
        y,
        index % 3 === 0 ? 1.8 : 1.2,
        index % 4 === 0 ? tokens.moonlight : tokens.candleCore,
        0.12,
      );
      this.container.add(dust);
      this.animatedTargets.push(dust);
      this.scene.tweens.add({
        targets: dust,
        x: x + (index % 2 === 0 ? 18 : -18),
        y: y - 28 - (index % 4) * 9,
        alpha: { from: 0.05, to: 0.28 },
        duration: 4800 + index * 240,
        delay: index * 170,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private renderVignette(tokens: ProceduralTavernVisualTokens): void {
    const vignette = this.scene.add.graphics();
    vignette.fillStyle(tokens.background, 0.54);
    vignette.fillRect(0, 0, 46, 720);
    vignette.fillRect(1234, 0, 46, 720);
    vignette.fillRect(0, 0, 1280, 22);
    vignette.fillRect(0, 698, 1280, 22);
    vignette.lineStyle(30, tokens.background, 0.18);
    vignette.strokeRoundedRect(12, 12, 1256, 696, 18);
    this.container.add(vignette);
  }

  private enemyPortraitCenters(layout: BattleLayoutConfig, enemyCount: number): Phaser.Math.Vector2[] {
    if (enemyCount === 1) {
      const seat = layout.seats.enemies[1];
      const hud = layout.enemyHud.top;
      return [new Phaser.Math.Vector2(seat.x + hud.portrait.x, seat.y + hud.portrait.y)];
    }

    const hudKeys = ['left', 'top', 'right'] as const;
    return layout.seats.enemies.slice(0, enemyCount).map((seat, index) => {
      const hud = layout.enemyHud[hudKeys[index]];
      return new Phaser.Math.Vector2(seat.x + hud.portrait.x, seat.y + hud.portrait.y);
    });
  }
}

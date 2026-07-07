import Phaser from 'phaser';

interface HeatMeterOptions {
  x: number;
  y: number;
  text: string;
  color: string;
  glowStrong: boolean;
}

export class HeatMeter {
  static render(scene: Phaser.Scene, options: HeatMeterOptions): Phaser.GameObjects.Text {
    const heatText = scene.add.text(options.x, options.y, options.text, {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: options.color,
    }).setOrigin(0.5);

    heatText.setShadow(0, 0, options.color, options.glowStrong ? 14 : 6, true, true);
    return heatText;
  }
}

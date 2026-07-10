import Phaser from 'phaser';

interface BlockingMessageModalOptions {
  title: string;
  body: string;
  buttonLabel: string;
  onClose: () => void;
  colors: {
    panel: number;
    line: number;
    text: string;
    muted: string;
    accent: number;
    accentText: string;
    button: number;
    buttonHover: number;
  };
}

export class BlockingMessageModal {
  static render(scene: Phaser.Scene, options: BlockingMessageModalOptions): Phaser.GameObjects.Container {
    const container = scene.add.container(640, 360).setDepth(120);
    const overlay = scene.add.rectangle(0, 0, 1280, 720, 0x000000, 0.68).setInteractive();
    const panelWidth = 620;
    const bodyWidth = 530;
    const estimatedLines = estimateTextLines(options.body, 34);
    const panelHeight = Phaser.Math.Clamp(240 + estimatedLines * 24, 320, 540);
    const titleY = -panelHeight / 2 + 48;
    const buttonY = panelHeight / 2 - 64;
    const panel = scene.add.rectangle(0, 0, panelWidth, panelHeight, options.colors.panel, 0.98).setStrokeStyle(2, options.colors.accent);
    const title = scene.add.text(0, titleY, options.title, {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: options.colors.accentText,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    title.setShadow(0, 0, options.colors.accentText, 10, true, true);

    const body = scene.add.text(0, -8, options.body, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: options.colors.text,
      align: 'center',
      lineSpacing: 7,
      wordWrap: { width: bodyWidth },
    }).setOrigin(0.5);

    const button = scene.add.container(-100, buttonY - 25);
    const rect = scene.add.rectangle(100, 25, 200, 50, options.colors.button).setStrokeStyle(2, options.colors.line);
    const label = scene.add.text(100, 25, options.buttonLabel, {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: options.colors.text,
    }).setOrigin(0.5);

    rect.setInteractive({ useHandCursor: true });
    rect.on('pointerover', () => rect.setFillStyle(options.colors.buttonHover));
    rect.on('pointerout', () => rect.setFillStyle(options.colors.button));
    rect.on('pointerdown', () => options.onClose());
    button.add([rect, label]);

    container.add([overlay, panel, title, body, button]);
    return container;
  }
}

function estimateTextLines(text: string, charsPerLine: number): number {
  return text.split('\n').reduce((total, line) => {
    const visualLines = Math.max(1, Math.ceil(line.length / charsPerLine));
    return total + visualLines;
  }, 0);
}

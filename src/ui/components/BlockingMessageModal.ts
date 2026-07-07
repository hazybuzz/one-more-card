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
    const panel = scene.add.rectangle(0, 0, 560, 360, options.colors.panel, 0.98).setStrokeStyle(2, options.colors.accent);
    const title = scene.add.text(0, -132, options.title, {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: options.colors.accentText,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    title.setShadow(0, 0, options.colors.accentText, 10, true, true);

    const body = scene.add.text(0, -22, options.body, {
      fontFamily: 'Arial',
      fontSize: '19px',
      color: options.colors.text,
      align: 'center',
      lineSpacing: 8,
      wordWrap: { width: 470 },
    }).setOrigin(0.5);

    const button = scene.add.container(-100, 114);
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

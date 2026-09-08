import Phaser from 'phaser';
import type { NineSliceArtAsset } from '../art';
import { GAME_FONT_FAMILY } from '../themes/typography';
import { MedievalButton } from './MedievalButton';
import { MedievalPanel } from './MedievalPanel';

interface BlockingMessageModalOptions {
  title: string;
  body: string;
  buttonLabel: string;
  onClose: () => void;
  panelSkin?: NineSliceArtAsset;
  buttonSkin?: NineSliceArtAsset;
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
    const panel = MedievalPanel.render(scene, {
      width: panelWidth,
      height: panelHeight,
      skin: options.panelSkin,
      fallbackFill: options.colors.panel,
      fallbackLine: options.colors.line,
    });
    const title = scene.add.text(0, titleY, options.title, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '30px',
      color: options.colors.accentText,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    title.setShadow(0, 0, options.colors.accentText, 10, true, true);

    const body = scene.add.text(0, -8, options.body, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '18px',
      color: options.colors.text,
      align: 'center',
      lineSpacing: 7,
      wordWrap: { width: bodyWidth, useAdvancedWrap: true },
    }).setOrigin(0.5);

    const button = MedievalButton.render(scene, {
      x: -100,
      y: buttonY - 25,
      width: 200,
      height: 50,
      label: options.buttonLabel,
      skin: options.buttonSkin,
      onActivate: options.onClose,
    });

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

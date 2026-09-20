import Phaser from 'phaser';
import { GAME_FONT_FAMILY } from '../themes/typography';
import { addTutorialGuide } from './TutorialGuide';
import { MedievalButton } from './MedievalButton';

export interface TutorialFocusArea {
  x: number;
  y: number;
  width: number;
  height: number;
  interactive?: boolean;
}

export class BattleTutorialOverlay {
  static render(scene: Phaser.Scene, options: {
    areas: TutorialFocusArea[];
    body: string;
    nextLabel?: string;
    skipLabel: string;
    onNext: () => void;
    onSkip: () => void;
  }): Phaser.GameObjects.Container {
    const root = scene.add.container(0, 0).setDepth(160);
    const holes = scene.make.graphics({ x: 0, y: 0 });
    holes.fillStyle(0xffffff);
    options.areas.forEach((area) => holes.fillRoundedRect(area.x - area.width / 2 - 8, area.y - area.height / 2 - 8, area.width + 16, area.height + 16, 12));
    const mask = holes.createGeometryMask();
    mask.setInvertAlpha(true);
    const shade = scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.65).setMask(mask);
    const blocker = scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.001);
    blocker.setInteractive(new Phaser.Geom.Rectangle(0, 0, 1280, 720), (_shape: unknown, x: number, y: number) =>
      !options.areas.some((area) => area.interactive && Math.abs(x - area.x) <= area.width / 2 && Math.abs(y - area.y) <= area.height / 2));
    root.add([shade, blocker]);
    options.areas.forEach((area) => addTutorialGuide(scene, root, area.x, area.y, area.width, area.height, area.y - area.height / 2 < 45));
    const body = scene.add.text(640, options.nextLabel ? 329 : 355, options.body, {
      fontFamily: GAME_FONT_FAMILY, fontSize: '19px', color: '#fff0cb', align: 'center',
      wordWrap: { width: 476, useAdvancedWrap: true }, lineSpacing: 6,
    }).setOrigin(0.5);
    const panel = scene.add.rectangle(640, 355, 520, Math.max(options.nextLabel ? 146 : 112, body.height + (options.nextLabel ? 86 : 40)), 0x211b14, 0.98).setStrokeStyle(2, 0xd9b663);
    root.add([panel, body]);
    if (options.nextLabel) {
      const centerY = Math.max(401, 329 + body.height / 2 + 30);
      root.add(MedievalButton.render(scene, {
        x: 520, y: centerY - 22, width: 240, height: 44,
        label: options.nextLabel, fontSize: '19px', variant: 'primary', onActivate: options.onNext,
      }));
    }
    const skip = scene.add.text(1190, 44, options.skipLabel, { fontFamily: GAME_FONT_FAMILY, fontSize: '17px', color: '#ffe6a3', backgroundColor: '#211b14' })
      .setOrigin(0.5).setPadding(15, 10).setInteractive({ useHandCursor: true });
    skip.on('pointerdown', options.onSkip);
    root.add(skip);
    root.once('destroy', () => { mask.destroy(); holes.destroy(); });
    return root;
  }
}

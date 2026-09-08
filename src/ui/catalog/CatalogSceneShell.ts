import Phaser from 'phaser';
import { CATALOG_LEATHER_PANEL_SKIN, EVERNIGHT_BUTTON_SKIN } from '../art/commonUiArt';
import { MedievalButton } from '../components/MedievalButton';
import { SoulCoinDisplay } from '../components/SoulCoinDisplay';
import { DISPLAY_FONT_FAMILY } from '../themes/typography';

export interface CatalogSceneShellOptions {
  title: string;
  backLabel: string;
  soulCoins: number;
  onBack: () => void;
  backgroundTextureKey?: string;
  backgroundShadeAlpha?: number;
}

export const CATALOG_BACKGROUND_KEY = 'evernight-catalog-background';
const CATALOG_BACKGROUND_PATH = '/image/env-assets/evernight/catalog-background.png';

const COLORS = {
  bg: 0x101114,
  panel: 0x191c22,
  line: 0x3b3f4c,
  text: '#f2f2ed',
  accentText: '#e8cf73',
};

export class CatalogSceneShell {
  static preload(scene: Phaser.Scene): void {
    SoulCoinDisplay.preload(scene);
    if (!scene.textures.exists(CATALOG_BACKGROUND_KEY)) {
      scene.load.image(CATALOG_BACKGROUND_KEY, CATALOG_BACKGROUND_PATH);
    }
    if (!scene.textures.exists(CATALOG_LEATHER_PANEL_SKIN.textureKey)) {
      scene.load.image(CATALOG_LEATHER_PANEL_SKIN.textureKey, CATALOG_LEATHER_PANEL_SKIN.path);
    }
  }

  static render(scene: Phaser.Scene, options: CatalogSceneShellOptions): void {
    const width = Number(scene.scale.gameSize.width);
    const height = Number(scene.scale.gameSize.height);
    const background = scene.add.container(0, 0).setDepth(-100);
    background.add(scene.add.rectangle(width / 2, height / 2, width, height, COLORS.bg));

    if (options.backgroundTextureKey && scene.textures.exists(options.backgroundTextureKey)) {
      background.add(scene.add.image(width / 2, height / 2, options.backgroundTextureKey).setDisplaySize(width, height));
      background.add(scene.add.rectangle(
        width / 2,
        height / 2,
        width,
        height,
        0x060608,
        options.backgroundShadeAlpha ?? 0.22,
      ));
    } else {
      background.add(scene.add.circle(width / 2, 372, 300, COLORS.panel, 0.58).setStrokeStyle(1, COLORS.line, 0.55));
      background.add(scene.add.line(width / 2, 124, 0, 0, width - 56, 0, COLORS.line, 0.7).setLineWidth(1));
    }

    const title = scene.add.text(width / 2, 62, options.title, {
      fontFamily: DISPLAY_FONT_FAMILY,
      fontSize: '38px',
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(20);
    title.setShadow(0, 0, COLORS.accentText, 9, true, true);

    MedievalButton.render(scene, {
      x: 24,
      y: 30,
      width: 176,
      height: 44,
      label: options.backLabel,
      fontSize: '16px',
      variant: 'secondary',
      skin: EVERNIGHT_BUTTON_SKIN,
      onActivate: () => {
        if (scene.cache.audio.exists('buttonClick')) {
          scene.sound.play('buttonClick', { volume: 0.42 });
        }
        options.onBack();
      },
    }).setDepth(20);

    SoulCoinDisplay.render(scene, {
      x: 1118,
      y: 52,
      value: options.soulCoins,
      depth: 20,
    });
  }
}

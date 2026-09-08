import Phaser from 'phaser';
import { t } from '../../game/i18n';
import { EVERNIGHT_BUTTON_SKIN } from '../art/commonUiArt';
import { GAME_FONT_FAMILY } from '../themes/typography';

export const SOUL_COIN_TEXTURE_KEY = 'ui-soul-coin';
const SOUL_COIN_PATH = '/image/ui/start/soul-coin.png';

export interface SoulCoinDisplayOptions {
  x: number;
  y: number;
  value: number;
  width?: number;
  height?: number;
  depth?: number;
}

export class SoulCoinDisplay {
  readonly container: Phaser.GameObjects.Container;
  private readonly valueText: Phaser.GameObjects.Text;

  static preload(scene: Phaser.Scene, includeSkin = true): void {
    if (includeSkin && !scene.textures.exists(EVERNIGHT_BUTTON_SKIN.textureKey)) {
      scene.load.image(EVERNIGHT_BUTTON_SKIN.textureKey, EVERNIGHT_BUTTON_SKIN.path);
    }
    if (!scene.textures.exists(SOUL_COIN_TEXTURE_KEY)) {
      scene.load.image(SOUL_COIN_TEXTURE_KEY, SOUL_COIN_PATH);
    }
  }

  static render(scene: Phaser.Scene, options: SoulCoinDisplayOptions): SoulCoinDisplay {
    return new SoulCoinDisplay(scene, options);
  }

  private constructor(scene: Phaser.Scene, options: SoulCoinDisplayOptions) {
    const width = options.width ?? 236;
    const height = options.height ?? 52;
    this.container = scene.add.container(options.x, options.y).setDepth(options.depth ?? 10);
    const hasSkin = scene.textures.exists(EVERNIGHT_BUTTON_SKIN.textureKey);
    const panel = hasSkin
      ? scene.add.nineslice(
        0,
        0,
        EVERNIGHT_BUTTON_SKIN.textureKey,
        undefined,
        width,
        height,
        EVERNIGHT_BUTTON_SKIN.leftWidth,
        EVERNIGHT_BUTTON_SKIN.rightWidth,
        EVERNIGHT_BUTTON_SKIN.topHeight,
        EVERNIGHT_BUTTON_SKIN.bottomHeight,
      ).setTint(0xd8bd91)
      : scene.add.rectangle(0, 0, width, height, 0x1b1d22, 0.96).setStrokeStyle(2, 0xe8cf73);
    const innerShade = scene.add.rectangle(0, 0, width - 18, height - 14, 0x170d09, 0.28);
    const coinX = width / 2 - 40;
    const coinGlow = scene.add.image(coinX, 0, SOUL_COIN_TEXTURE_KEY)
      .setDisplaySize(27, 27)
      .setTint(0xffd866)
      .setAlpha(0.16)
      .setBlendMode(Phaser.BlendModes.ADD);
    const coin = scene.add.image(coinX, 0, SOUL_COIN_TEXTURE_KEY).setDisplaySize(18, 18);
    const label = scene.add.text(-width / 2 + 42, 0, t('progress.soulCoins'), {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '16px',
      color: '#c9b994',
    }).setOrigin(0, 0.5);
    this.valueText = scene.add.text(coinX - 14, -2, `${options.value}`, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '22px',
      color: '#f1cf72',
      fontStyle: 'bold',
    }).setOrigin(1, 0.5);
    this.valueText.setShadow(0, 0, '#d69a35', 8, true, true);
    this.container.add([panel, innerShade, label, this.valueText, coinGlow, coin]);

    const glowTween = scene.tweens.add({
      targets: coinGlow,
      alpha: { from: 0.1, to: 0.3 },
      duration: 2200,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
    });
    this.container.once(Phaser.GameObjects.Events.DESTROY, () => glowTween.remove());
  }

  setValue(value: number): void {
    this.valueText.setText(`${value}`);
  }
}

import Phaser from 'phaser';
import { playLobbyMusic, preloadLobbyMusic } from '../game/audio';
import { CHAPTER_ONE } from '../game/data/chapterOne';
import { t, toggleLanguage } from '../game/i18n';
import { getProgress } from '../game/progress';
import type { LevelConfig } from '../game/types/level';

const COLORS = {
  bg: 0x101114,
  panel: 0x1b1d22,
  panelAlt: 0x252832,
  line: 0x3b3f4c,
  text: '#f2f2ed',
  muted: '#aeb4c0',
  accent: 0xe8cf73,
  accentText: '#e8cf73',
  green: '#78d18a',
  button: 0x303542,
  buttonHover: 0x41495b,
  disabled: 0x20232a,
};

export class StorySelectScene extends Phaser.Scene {
  constructor() {
    super('StorySelectScene');
  }

  preload(): void {
    preloadLobbyMusic(this);
    if (!this.cache.audio.exists('buttonClick')) {
      this.load.audio('buttonClick', '/audio/switch28.ogg');
    }
  }

  create(): void {
    playLobbyMusic(this);
    this.addBackground();
    this.renderLanguageToggle();
    this.renderSoulCoins();
    this.renderHeader();
    this.renderLevels();
  }

  private addBackground(): void {
    this.add.rectangle(640, 360, 1280, 720, COLORS.bg);
    this.add.circle(640, 360, 290, 0x191c22, 0.9).setStrokeStyle(2, COLORS.line);
    this.add.circle(640, 360, 188, 0x101114, 0.45).setStrokeStyle(1, 0x2b303c);
    this.add.rectangle(640, 360, 1280, 1, COLORS.line, 0.24);
  }

  private renderHeader(): void {
    this.add.text(640, 76, t('story.title'), {
      fontFamily: 'Arial',
      fontSize: '44px',
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, COLORS.accentText, 10, true, true);

    this.add.text(640, 120, t(CHAPTER_ONE.titleKey), {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: COLORS.accentText,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    if (CHAPTER_ONE.subtitleKey) {
      this.add.text(640, 150, t(CHAPTER_ONE.subtitleKey), {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: COLORS.muted,
      }).setOrigin(0.5);
    }

    this.add.container(110, 50).add([
      this.button(0, 0, 178, 44, t('story.returnLobby'), () => {
        this.scene.start('StartScene');
      }, { fontSize: '16px' }),
    ]);
  }

  private renderLanguageToggle(): void {
    this.add.container(92, 104).add([
      this.button(0, 0, 144, 40, t('language.button'), () => {
        toggleLanguage();
        this.scene.restart();
      }, { fontSize: '15px' }),
    ]);
  }

  private renderSoulCoins(): void {
    const container = this.add.container(1118, 50);
    const panel = this.add.rectangle(0, 0, 236, 52, COLORS.panel, 0.95).setStrokeStyle(2, COLORS.accent);
    const label = this.add.text(-96, -13, t('progress.soulCoins'), {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: COLORS.muted,
    });
    const value = this.add.text(96, 0, `${getProgress().soulCoins}`, {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: COLORS.accentText,
      fontStyle: 'bold',
    }).setOrigin(1, 0.5);
    value.setShadow(0, 0, COLORS.accentText, 10, true, true);
    container.add([panel, label, value]);
  }

  private renderLevels(): void {
    const startX = 304;
    const startY = 236;
    const colGap = 672;
    const rowGap = 98;

    CHAPTER_ONE.levels.forEach((level, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      this.renderLevelCard(startX + col * colGap, startY + row * rowGap, level, index);
    });
  }

  private renderLevelCard(x: number, y: number, level: LevelConfig, index: number): void {
    const unlocked = index === 0;
    const card = this.add.container(x, y);
    const fill = unlocked ? COLORS.panel : COLORS.disabled;
    const stroke = unlocked ? COLORS.accent : COLORS.line;
    const titleColor = unlocked ? COLORS.text : COLORS.muted;
    const subtitleColor = unlocked ? COLORS.accentText : COLORS.muted;

    const rect = this.add.rectangle(0, 0, 560, 74, fill, 0.96).setStrokeStyle(2, stroke);
    card.add(rect);
    card.add(this.add.text(-248, -20, t(level.titleKey), {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: titleColor,
      fontStyle: 'bold',
    }));
    card.add(this.add.text(-248, 12, level.subtitleKey ? t(level.subtitleKey) : '', {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: subtitleColor,
    }));

    const status = this.add.text(238, 0, unlocked ? t('story.level.enter') : t('story.level.locked'), {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: unlocked ? COLORS.green : COLORS.muted,
      fontStyle: 'bold',
    }).setOrigin(1, 0.5);
    if (unlocked) {
      status.setShadow(0, 0, COLORS.green, 8, true, true);
    }
    card.add(status);

    rect.setInteractive({ useHandCursor: unlocked });
    rect.on('pointerover', () => {
      if (unlocked) {
        rect.setFillStyle(COLORS.panelAlt);
      }
    });
    rect.on('pointerout', () => rect.setFillStyle(fill));
    rect.on('pointerdown', () => {
      if (!unlocked) {
        return;
      }

      this.playButtonClick();
      this.scene.start('ChapterIntroScene', {
        introId: 'chapter1_opening',
        levelId: level.id,
      });
    });
  }

  private button(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void,
    options: { fontSize?: string; fill?: number } = {},
  ): Phaser.GameObjects.Container {
    const fill = options.fill ?? COLORS.button;
    const button = this.add.container(x, y);
    const rect = this.add.rectangle(0, 0, width, height, fill).setStrokeStyle(2, COLORS.line);
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Arial',
      fontSize: options.fontSize ?? '20px',
      color: COLORS.text,
    }).setOrigin(0.5);

    rect.setInteractive({ useHandCursor: true });
    rect.on('pointerover', () => rect.setFillStyle(COLORS.buttonHover));
    rect.on('pointerout', () => rect.setFillStyle(fill));
    rect.on('pointerdown', () => {
      this.playButtonClick();
      onClick();
    });

    button.add([rect, text]);
    return button;
  }

  private playButtonClick(): void {
    this.sound.play('buttonClick', { volume: 0.42 });
  }
}

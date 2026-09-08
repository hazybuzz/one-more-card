import Phaser from 'phaser';
import { DISPLAY_FONT_FAMILY, GAME_FONT_FAMILY } from '../ui/themes/typography';
import { playLobbyMusic, preloadLobbyMusic } from '../game/audio';
import { CHAPTER_ONE } from '../game/data/chapterOne';
import { introIdForLevel } from '../game/data/levelIntros';
import { t, toggleLanguage } from '../game/i18n';
import { getProgress, isStoryLevelCompleted, isStoryLevelUnlocked } from '../game/progress';
import type { LevelConfig } from '../game/types/level';
import { CATALOG_LEATHER_PANEL_SKIN, EVERNIGHT_BUTTON_SKIN } from '../ui/art/commonUiArt';
import { MedievalButton } from '../ui/components/MedievalButton';
import { SoulCoinDisplay } from '../ui/components/SoulCoinDisplay';
import { StoryLevelCard, type StoryLevelCardState } from '../ui/story/StoryLevelCard';

const STORY_BACKGROUND_KEY = 'evernight-start-background';
const STORY_BACKGROUND_PATH = '/image/env-assets/evernight/start-background.png';

const COLORS = {
  bg: 0x101114,
  line: 0x3b3f4c,
  text: '#f2f2ed',
  muted: '#aeb4c0',
  accent: 0xe8cf73,
  accentText: '#e8cf73',
  green: '#78d18a',
};

export class StorySelectScene extends Phaser.Scene {
  constructor() {
    super('StorySelectScene');
  }

  preload(): void {
    preloadLobbyMusic(this);
    SoulCoinDisplay.preload(this);
    if (!this.textures.exists(STORY_BACKGROUND_KEY)) {
      this.load.image(STORY_BACKGROUND_KEY, STORY_BACKGROUND_PATH);
    }
    if (!this.textures.exists(CATALOG_LEATHER_PANEL_SKIN.textureKey)) {
      this.load.image(CATALOG_LEATHER_PANEL_SKIN.textureKey, CATALOG_LEATHER_PANEL_SKIN.path);
    }
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
    if (this.textures.exists(STORY_BACKGROUND_KEY)) {
      this.add.image(640, 360, STORY_BACKGROUND_KEY).setDisplaySize(1280, 720);
      this.add.rectangle(640, 360, 1280, 720, 0x070708, 0.72);
      this.add.rectangle(640, 90, 1280, 180, 0x050506, 0.18);
      this.add.rectangle(640, 610, 1280, 220, 0x050506, 0.16);
    }
  }

  private renderHeader(): void {
    this.add.text(640, 76, t('story.title'), {
      fontFamily: DISPLAY_FONT_FAMILY,
      fontSize: '44px',
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, COLORS.accentText, 10, true, true);

    this.add.text(640, 120, t(CHAPTER_ONE.titleKey), {
      fontFamily: DISPLAY_FONT_FAMILY,
      fontSize: '24px',
      color: COLORS.accentText,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    if (CHAPTER_ONE.subtitleKey) {
      this.add.text(640, 150, t(CHAPTER_ONE.subtitleKey), {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: '16px',
        color: COLORS.muted,
      }).setOrigin(0.5);
    }

    const completedCount = CHAPTER_ONE.levels.filter((level) => isStoryLevelCompleted(level.id)).length;
    this.add.text(640, 178, t('story.progress', { completed: completedCount, total: CHAPTER_ONE.levels.length }), {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '16px',
      color: COLORS.green,
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, COLORS.green, 8, true, true);

    this.button(110, 50, 178, 44, t('story.returnLobby'), () => {
      this.scene.start('StartScene');
    }, { fontSize: '16px' });
  }

  private renderLanguageToggle(): void {
    this.button(92, 104, 144, 40, t('language.button'), () => {
      toggleLanguage();
      this.scene.restart();
    }, { fontSize: '15px' });
  }

  private renderSoulCoins(): void {
    SoulCoinDisplay.render(this, { x: 1118, y: 50, value: getProgress().soulCoins });
  }

  private renderLevels(): void {
    const startX = 344;
    const startY = 244;
    const colGap = 592;
    const rowGap = 102;
    const currentLevelId = this.currentLevelId();

    CHAPTER_ONE.levels.forEach((level, index) => {
      const col = index < 4 ? 0 : 1;
      const row = index % 4;
      this.renderLevelCard(startX + col * colGap, startY + row * rowGap, level, index, level.id === currentLevelId);
    });
  }

  private currentLevelId(): string | undefined {
    return CHAPTER_ONE.levels.find((level) => isStoryLevelUnlocked(level.id) && !isStoryLevelCompleted(level.id))?.id;
  }

  private renderLevelCard(x: number, y: number, level: LevelConfig, _index: number, current: boolean): void {
    const unlocked = isStoryLevelUnlocked(level.id);
    const completed = isStoryLevelCompleted(level.id);
    StoryLevelCard.render(this, {
      x,
      y,
      width: 520,
      height: 82,
      title: t(level.titleKey),
      subtitle: level.subtitleKey ? t(level.subtitleKey) : '',
      statusLabel: this.levelStatusLabel(unlocked, completed, current),
      buttonLabel: this.levelButtonLabel(unlocked, completed),
      state: this.levelCardState(unlocked, completed, current),
      onActivate: () => {
      this.playButtonClick();
      this.scene.start('ChapterIntroScene', {
        introId: introIdForLevel(level.id),
        levelId: level.id,
      });
      },
    });
  }

  private levelCardState(unlocked: boolean, completed: boolean, current: boolean): StoryLevelCardState {
    if (completed) {
      return 'completed';
    }
    if (current) {
      return 'current';
    }
    return unlocked ? 'unlocked' : 'locked';
  }

  private levelStatusLabel(unlocked: boolean, completed: boolean, current: boolean): string {
    if (completed) {
      return t('story.level.completed');
    }

    if (current) {
      return t('story.level.current');
    }

    return unlocked ? t('story.level.unlocked') : t('story.level.locked');
  }

  private levelButtonLabel(unlocked: boolean, completed: boolean): string {
    if (completed) {
      return t('story.level.replay');
    }

    return unlocked ? t('story.level.enter') : t('story.level.locked');
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
    return MedievalButton.render(this, {
      x: x - width / 2,
      y: y - height / 2,
      width,
      height,
      label,
      fontSize: options.fontSize ?? '20px',
      variant: 'secondary',
      skin: EVERNIGHT_BUTTON_SKIN,
      onActivate: () => {
        this.playButtonClick();
        onClick();
      },
    });
  }

  private playButtonClick(): void {
    this.sound.play('buttonClick', { volume: 0.42 });
  }
}

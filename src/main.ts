import Phaser from 'phaser';
import './style.css';
import { BattleScene } from './scenes/BattleScene';
import { ChapterIntroScene } from './scenes/ChapterIntroScene';
import { InventoryScene } from './scenes/InventoryScene';
import { PvpBattleScene } from './scenes/PvpBattleScene';
import { PvpLobbyScene } from './scenes/PvpLobbyScene';
import { ShopScene } from './scenes/ShopScene';
import { StartScene } from './scenes/StartScene';
import { StorySelectScene } from './scenes/StorySelectScene';
import { TableSelectScene } from './scenes/TableSelectScene';
import { DISPLAY_FONT_NAME, GAME_FONT_NAME } from './ui/themes/typography';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#101114',
  scene: [StartScene, TableSelectScene, StorySelectScene, PvpLobbyScene, PvpBattleScene, ShopScene, InventoryScene, ChapterIntroScene, BattleScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

async function bootstrap(): Promise<void> {
  if ('fonts' in document) {
    try {
      await Promise.all([
        document.fonts.load(`16px "${GAME_FONT_NAME}"`),
        document.fonts.load(`32px "${DISPLAY_FONT_NAME}"`),
      ]);
    } catch (error) {
      console.warn('Unable to preload the game fonts; using the system fallback.', error);
    }
  }

  new Phaser.Game(config);
}

void bootstrap();

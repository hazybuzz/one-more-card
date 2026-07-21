import Phaser from 'phaser';
import { BattleScene } from './scenes/BattleScene';
import { ChapterIntroScene } from './scenes/ChapterIntroScene';
import { InventoryScene } from './scenes/InventoryScene';
import { PvpBattleScene } from './scenes/PvpBattleScene';
import { PvpLobbyScene } from './scenes/PvpLobbyScene';
import { ShopScene } from './scenes/ShopScene';
import { StartScene } from './scenes/StartScene';
import { StorySelectScene } from './scenes/StorySelectScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#101114',
  scene: [StartScene, StorySelectScene, PvpLobbyScene, PvpBattleScene, ShopScene, InventoryScene, ChapterIntroScene, BattleScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);

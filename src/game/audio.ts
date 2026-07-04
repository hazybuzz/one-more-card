import Phaser from 'phaser';

export const AUDIO_KEYS = {
  lobbyMusic: 'lobbyMusic',
  battleMusic: 'battleMusic',
} as const;

export function preloadLobbyMusic(scene: Phaser.Scene): void {
  if (!scene.cache.audio.exists(AUDIO_KEYS.lobbyMusic)) {
    scene.load.audio(AUDIO_KEYS.lobbyMusic, '/audio/w-soul.mp3');
  }
}

export function playLobbyMusic(scene: Phaser.Scene): void {
  const existing = scene.sound.get(AUDIO_KEYS.lobbyMusic);
  if (existing) {
    if (!existing.isPlaying) {
      existing.play({ loop: true, volume: 0.44 });
    }
    return;
  }

  scene.sound.add(AUDIO_KEYS.lobbyMusic, {
    loop: true,
    volume: 0.44,
  }).play();
}

export function stopLobbyMusic(scene: Phaser.Scene): void {
  scene.sound.stopByKey(AUDIO_KEYS.lobbyMusic);
}

export function preloadBattleMusic(scene: Phaser.Scene): void {
  if (!scene.cache.audio.exists(AUDIO_KEYS.battleMusic)) {
    scene.load.audio(AUDIO_KEYS.battleMusic, '/audio/battle-bgm-forest.ogg');
  }
}

export function playBattleMusic(scene: Phaser.Scene): void {
  const existing = scene.sound.get(AUDIO_KEYS.battleMusic);
  if (existing) {
    if (!existing.isPlaying) {
      existing.play({ loop: true, volume: 0.32 });
    }
    return;
  }

  scene.sound.add(AUDIO_KEYS.battleMusic, {
    loop: true,
    volume: 0.32,
  }).play();
}

export function stopBattleMusic(scene: Phaser.Scene): void {
  scene.sound.stopByKey(AUDIO_KEYS.battleMusic);
}

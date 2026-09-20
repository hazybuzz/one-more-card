import type { EndlessSettlementReceipt } from '../../game/endless/EndlessSettlement';
import Phaser from 'phaser';
import { ENDLESS_CONFIG } from '../../game/endless/EndlessConfig';
import { getEndlessUnlockProgress } from '../../game/endless/EndlessRules';
import type { FormalDifficultyWins } from '../../game/endless/EndlessState';
import { TABLE_THEMES } from '../../game/data/tableThemes';
import { getStakeDifficulty } from '../../game/data/stakeDifficulties';
import { t } from '../../game/i18n';
import { CATALOG_LEATHER_PANEL_SKIN, EVERNIGHT_BUTTON_SKIN } from '../art/commonUiArt';
import { GAME_FONT_FAMILY } from '../themes/typography';
import { MedievalPanel } from './MedievalPanel';
import { MedievalButton } from './MedievalButton';

export function renderEndlessEntryModal(scene: Phaser.Scene, options: {
  wins: FormalDifficultyWins;
  coins: number;
  battleReady: boolean;
  hasSession: boolean;
  bestScore?: EndlessSettlementReceipt;
  message?: string;
  closeLabel?: string;
  onEnter: () => void;
  onClose: () => void;
}): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0).setDepth(110);
  root.add(scene.add.rectangle(640, 360, 1280, 720, 0x030304, 0.86).setInteractive());
  root.add(MedievalPanel.render(scene, { x: 640, y: 360, width: 760, height: 610,
    skin: CATALOG_LEATHER_PANEL_SKIN, fallbackFill: 0x24150f, fallbackLine: 0xb95b4d }));
  const label = (x: number, y: number, value: string, size: number, color = '#f1e5cf') => {
    root.add(scene.add.text(x, y, value, { fontFamily: GAME_FONT_FAMILY, fontSize: `${size}px`, color,
      align: 'center', wordWrap: { width: 650 }, lineSpacing: 5 }).setOrigin(0.5));
  };
  const progress = getEndlessUnlockProgress(options.wins);
  label(640, 95, t('endless.title'), 32);
  label(640, 137, t(progress.unlocked ? 'endless.unlocked' : 'endless.unlockProgress', progress), 17, '#edbd80');
  label(640, 176, t('endless.clearRequirement'), 16, '#bdb3aa');
  for (let i = 0; i < TABLE_THEMES.length; i += 1) {
    const theme = TABLE_THEMES[i];
    const y = 216 + i * 39;
    label(430, y, t(theme.nameKey), 17);
    for (const difficulty of [1, 2, 3] as const) {
      const cleared = (options.wins[theme.id]?.[difficulty] ?? 0) > 0;
      label(595 + (difficulty - 1) * 120, y,
        `${cleared ? '✓' : '—'} ${t(getStakeDifficulty(difficulty).labelKey)}`, 16, cleared ? '#8fdda4' : '#857c78');
    }
  }
  label(640, 401, t(options.hasSession ? 'endless.rules' : 'endless.opening.entryRules', { coins: ENDLESS_CONFIG.startingSupplyCoins }), 17);
  label(640, 458, t(options.bestScore ? 'endless.best.record' : 'endless.best.empty',
    { defeats: options.bestScore?.defeatedCount ?? 0, resonance: options.bestScore?.resonancePoints ?? 0 }), 16, '#edbd80');
  label(640, 495, t('endless.entryCost', { cost: ENDLESS_CONFIG.entryCost, coins: options.coins }), 18, '#edbd80');
  const canEnter = options.battleReady && (options.hasSession || progress.unlocked && options.coins >= ENDLESS_CONFIG.entryCost);
  const hint = !options.battleReady ? 'endless.preparing'
    : !progress.unlocked ? 'endless.clearRequirement'
      : options.coins < ENDLESS_CONFIG.entryCost && !options.hasSession ? 'endless.notEnoughCoins' : options.hasSession ? 'endless.feeHint' : 'endless.opening.feeHint';
  label(640, 537, options.message ?? t(hint), 15, '#bdb3aa');
  root.add(MedievalButton.render(scene, { x: 408, y: 584, width: 205, height: 45,
    label: options.closeLabel ?? t('endless.close'), fontSize: '17px', variant: 'secondary', skin: EVERNIGHT_BUTTON_SKIN,
    onActivate: options.onClose }));
  root.add(MedievalButton.render(scene, { x: 653, y: 584, width: 220, height: 45,
    label: t(!options.battleReady ? 'endless.comingSoon' : options.hasSession ? 'endless.resume' : 'endless.enter'),
    fontSize: '17px', enabled: canEnter, variant: 'primary', skin: EVERNIGHT_BUTTON_SKIN,
    onActivate: options.onEnter }));
  return root;
}

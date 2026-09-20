import Phaser from 'phaser';
import type { EndlessBattleAccounting } from '../../game/endless/EndlessLedger';
import { calculateEndlessSettlement } from '../../game/endless/EndlessRules';
import { t } from '../../game/i18n';
import { SoulCoinDisplay } from './SoulCoinDisplay';

export function renderEndlessBattleHud(scene: Phaser.Scene, state: EndlessBattleAccounting): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0).setDepth(150);
  const entries = [
    { x: 66, label: 'endless.hud.defeatsLabel', value: state.defeatedCount, showCoin: false },
    { x: 182, label: 'endless.hud.resonanceLabel', value: state.resonancePoints, showCoin: false },
    { x: 942, label: 'endless.hud.walletLabel', value: state.wallet, showCoin: true },
    { x: 1162, label: 'endless.hud.settlementLabel', value: calculateEndlessSettlement(state.defeatedCount, state.resonancePoints, state.spentCoins, state.startingSupplyCoins).total, showCoin: true },
  ];
  for (const entry of entries) root.add(SoulCoinDisplay.render(scene, {
    x: entry.x, y: 46, width: entry.showCoin ? 180 : 130, height: 52, value: entry.value,
    label: t(entry.label), showCoin: entry.showCoin, compact: true, stacked: false,
  }).container);
  return root;
}

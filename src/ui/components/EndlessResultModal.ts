import Phaser from 'phaser';
import type { EndlessSettlementSummary, EndlessSettlementReceipt } from '../../game/endless/EndlessSettlement';
import { t } from '../../game/i18n';
import { GAME_FONT_FAMILY } from '../themes/typography';
import { CATALOG_LEATHER_PANEL_SKIN, EVERNIGHT_BUTTON_SKIN } from '../art/commonUiArt';
import { MedievalPanel } from './MedievalPanel';
import { MedievalButton } from './MedievalButton';

export function renderEndlessResultModal(scene: Phaser.Scene, options: {
  summary: EndlessSettlementSummary;
  receipt?: EndlessSettlementReceipt;
  pending: boolean;
  isLocalBest?: boolean;
  error?: string;
  onRetry: () => void;
  onReturn: () => void;
}): Phaser.GameObjects.Container {
  const root = scene.add.container(640, 360).setDepth(160);
  root.add(scene.add.rectangle(0, 0, 1280, 720, 0x030304, 0.86).setInteractive());
  root.add(MedievalPanel.render(scene, { width: 790, height: 610, skin: CATALOG_LEATHER_PANEL_SKIN,
    fallbackFill: 0x24150f, fallbackLine: 0xb95b4d }));
  const label = (x: number, y: number, value: string, size: number, color = '#f1e5cf', width = 720) => {
    root.add(scene.add.text(x, y, value, { fontFamily: GAME_FONT_FAMILY, fontSize: `${size}px`, color,
      wordWrap: { width, useAdvancedWrap: true }, align: 'center' }).setOrigin(0.5));
  };
  const s = options.summary;
  label(0, -255, t(s.reason === 'exit' ? 'endless.result.exit' : 'endless.result.defeat'), 32);
  label(0, -201, t('endless.result.counts', { defeats: s.defeatedCount, spirits: s.clearedSpiritCount, resonance: s.resonancePoints, round: s.round }), 18);
  const hasSupply = (s.startingSupplyCoins ?? 0) > 0;
  const rows: readonly [string, number][] = [
    ...(hasSupply ? [['endless.result.supply', s.startingSupplyCoins!] as [string, number]] : []),
    ['endless.result.earned', s.earned], ['endless.result.spent', s.spent], [hasSupply ? 'endless.result.cashWallet' : 'endless.result.wallet', s.wallet],
    ['endless.result.defeatBonus', s.defeatBonus], ['endless.result.resonanceBonus', s.resonanceBonus],
  ];
  rows.forEach(([key, amount], index) => {
    label(-150, -138 + index * (hasSupply ? 36 : 44), t(key), 18, '#cfc5b8', 350);
    label(230, -138 + index * (hasSupply ? 36 : 44), `${amount}`, 21, '#edbd80', 180);
  });
  label(0, 102, t('endless.result.total', { coins: s.total }), 28, '#edbd80');
  label(0, 150, t(hasSupply ? 'endless.result.supplyFee' : 'endless.result.fee', { cost: s.entryPaid, coins: Math.max(0, (s.startingSupplyCoins ?? 0) - s.spent) }), 15, '#bdb3aa');
  label(0, 189, options.error ?? t(options.receipt ? 'endless.result.paid' : 'endless.result.pending',
    { coins: options.receipt?.balanceAfter ?? 0 }) + (options.receipt && options.isLocalBest ? ` · ${t('endless.best.new')}` : ''), 16, options.error ? '#ed8e86' : '#bdb3aa');
  if (options.error) root.add(MedievalButton.render(scene, { x: -255, y: 240, width: 235, height: 44,
    label: t('endless.result.retry'), fontSize: '17px', variant: 'primary', skin: EVERNIGHT_BUTTON_SKIN,
    enabled: !options.pending, onActivate: options.onRetry }));
  root.add(MedievalButton.render(scene, { x: options.error ? 20 : -150, y: 240, width: options.error ? 235 : 300, height: 44,
    label: t('battle.result.returnLobby'), fontSize: '17px', variant: 'secondary', skin: EVERNIGHT_BUTTON_SKIN,
    enabled: !!options.receipt, onActivate: options.onReturn }));
  return root;
}

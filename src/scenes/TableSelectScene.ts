import Phaser from 'phaser';
import { playLobbyMusic, preloadLobbyMusic } from '../game/audio';
import { getStakeDifficulty } from '../game/data/stakeDifficulties';
import { TABLE_THEMES } from '../game/data/tableThemes';
import { calculateFormalVictoryReward, RELIEF_COIN_THRESHOLD, RELIEF_TARGET_COINS, tryPayEntryCost } from '../game/economy';
import { t, toggleLanguage } from '../game/i18n';
import {
  consumeComplimentaryTableEntry,
  getProgress,
  hasComplimentaryTableEntry,
  isTableThemeUnlocked,
  tryPurchaseTableTheme,
} from '../game/progress';
import type { EntryStakeMultiplier, TableThemeConfig, TableThemeId } from '../game/types/tableTheme';
import { ENTRY_STAKE_MULTIPLIERS } from '../game/types/tableTheme';

const COLORS = {
  bg: 0x101114,
  panel: 0x1b1d22,
  line: 0x3b3f4c,
  text: '#f2f2ed',
  muted: '#aeb4c0',
  accent: 0xe8cf73,
  accentText: '#e8cf73',
  button: 0x303542,
  buttonHover: 0x41495b,
  disabled: 0x20232a,
  dangerText: '#ff4b5f',
};

type ThemeSelection = Partial<Record<TableThemeId, EntryStakeMultiplier>>;

export class TableSelectScene extends Phaser.Scene {
  private statusText?: Phaser.GameObjects.Text;
  private stakeByTheme: ThemeSelection = {};

  constructor() {
    super('TableSelectScene');
  }

  preload(): void {
    preloadLobbyMusic(this);
    if (!this.cache.audio.exists('buttonClick')) {
      this.load.audio('buttonClick', '/audio/switch28.ogg');
    }
  }

  create(): void {
    playLobbyMusic(this);
    this.render();
  }

  private render(status = ''): void {
    this.children.removeAll(true);
    this.addBackground();
    this.renderLanguageToggle();
    this.renderSoulCoins();
    this.renderHeader();
    this.renderThemes();
    this.statusText = this.add.text(640, 668, status, {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: status ? COLORS.accentText : COLORS.muted,
    }).setOrigin(0.5);
  }

  private addBackground(): void {
    this.add.rectangle(640, 360, 1280, 720, COLORS.bg);
    this.add.circle(640, 376, 326, 0x191c22, 0.82).setStrokeStyle(2, COLORS.line);
    this.add.circle(640, 376, 196, 0x101114, 0.48).setStrokeStyle(1, 0x2b303c);
    this.add.rectangle(640, 360, 1280, 1, COLORS.line, 0.2);
  }

  private renderHeader(): void {
    this.add.text(640, 76, t('tableSelect.title'), {
      fontFamily: 'Arial',
      fontSize: '42px',
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, COLORS.accentText, 10, true, true);

    this.add.text(640, 116, t('tableSelect.subtitle'), {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: COLORS.muted,
    }).setOrigin(0.5);

    this.add.container(110, 50).add([
      this.button(0, 0, 178, 44, t('tableSelect.returnLobby'), () => {
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

  private renderThemes(): void {
    const slots = [
      { x: 382, y: 272 },
      { x: 898, y: 272 },
      { x: 382, y: 542 },
      { x: 898, y: 542 },
    ];

    slots.forEach((slot, index) => {
      const theme = TABLE_THEMES[index];
      if (theme) {
        this.renderThemeCard(slot.x, slot.y, theme);
      } else {
        this.renderComingSoonCard(slot.x, slot.y);
      }
    });
  }

  private renderThemeCard(x: number, y: number, theme: TableThemeConfig): void {
    const unlocked = isTableThemeUnlocked(theme.id);
    const stake = this.stakeByTheme[theme.id] ?? 1;
    const difficulty = getStakeDifficulty(stake);
    const totalCost = this.roundCost(theme, stake);
    const maxReward = calculateFormalVictoryReward(totalCost, theme.playerHp, theme.payoutMultiplier);
    const complimentaryEntry = unlocked && stake === 1 && hasComplimentaryTableEntry(theme.id);
    const canEnter = unlocked && (complimentaryEntry || getProgress().soulCoins >= totalCost);
    const card = this.add.container(x, y);
    const panel = this.add.rectangle(0, 0, 456, 232, theme.visual.panelColor, 0.96).setStrokeStyle(2, unlocked ? theme.visual.accentColor : COLORS.line);
    card.add(panel);
    card.add(this.themePreview(-170, -58, theme, unlocked));

    card.add(this.add.text(-102, -91, t(theme.nameKey), {
      fontFamily: 'Arial',
      fontSize: '26px',
      color: unlocked ? COLORS.text : COLORS.muted,
      fontStyle: 'bold',
    }));
    card.add(this.add.text(-102, -57, t(theme.subtitleKey), {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: unlocked ? theme.visual.glowColor : COLORS.muted,
    }));

    if (!unlocked) {
      this.renderLockedThemeContent(card, theme);
      return;
    }

    if (theme.id === 'evernight_tavern' && getProgress().soulCoins < RELIEF_COIN_THRESHOLD) {
      this.renderReliefThemeContent(card, theme);
      return;
    }

    card.add(this.add.text(-202, -2, t('tableSelect.baseEntry', { cost: theme.entryCost }), {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: COLORS.muted,
    }));
    card.add(this.add.text(-22, -2, t('tableSelect.payoutRate', { multiplier: theme.payoutMultiplier.toFixed(1) }), {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: theme.visual.glowColor,
    }).setOrigin(0.5, 0));
    card.add(this.add.text(202, -2, complimentaryEntry
      ? t('tableSelect.complimentaryEntryCost')
      : t('tableSelect.roundCost', { cost: totalCost }), {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: canEnter ? COLORS.accentText : COLORS.dangerText,
      fontStyle: 'bold',
    }).setOrigin(1, 0));

    card.add(this.add.rectangle(0, 70, 410, 76, 0x0c0d10, 0.24).setStrokeStyle(1, COLORS.line, 0.35));

    card.add(this.add.text(-196, 35, `${t('tableSelect.stake')} · ${t(difficulty.labelKey)}`, {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: theme.visual.glowColor,
      fontStyle: 'bold',
    }));
    card.add(this.add.text(-196, 52, t(difficulty.descriptionKey), {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: COLORS.muted,
    }));
    card.add(this.add.text(202, 35, t('tableSelect.maxRewardPreview', { reward: maxReward }), {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: theme.visual.glowColor,
      fontStyle: 'bold',
    }).setOrigin(1, 0));

    ENTRY_STAKE_MULTIPLIERS.forEach((multiplier, index) => {
      const cost = this.roundCost(theme, multiplier);
      const affordable = (multiplier === 1 && hasComplimentaryTableEntry(theme.id))
        || getProgress().soulCoins >= cost;
      const selected = multiplier === stake;
      card.add(this.button(-154 + index * 58, 86, 52, 38, `${multiplier}x`, () => {
        this.stakeByTheme[theme.id] = multiplier;
        this.render();
      }, {
        fontSize: '15px',
        enabled: unlocked && affordable,
        fill: selected ? theme.visual.accentColor : undefined,
        textColor: selected ? '#101114' : undefined,
      }));
    });

    const enterLabel = complimentaryEntry
      ? t('tableSelect.complimentaryEnter')
      : canEnter
        ? t('tableSelect.enter')
        : t('tableSelect.notEnoughCoinsShort');
    card.add(this.button(112, 86, 176, 42, enterLabel, () => {
      this.enterTheme(theme, stake);
    }, { fontSize: '16px', enabled: canEnter }));
  }

  private renderReliefThemeContent(card: Phaser.GameObjects.Container, theme: TableThemeConfig): void {
    card.add(this.add.text(-202, -4, t('tableSelect.reliefTitle'), {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: theme.visual.glowColor,
      fontStyle: 'bold',
    }));
    card.add(this.add.text(202, -2, t('tableSelect.reliefFree'), {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: COLORS.accentText,
      fontStyle: 'bold',
    }).setOrigin(1, 0));
    card.add(this.add.rectangle(0, 70, 410, 76, 0x0c0d10, 0.24).setStrokeStyle(1, COLORS.line, 0.35));
    card.add(this.add.text(-196, 43, t('tableSelect.reliefHint', { target: RELIEF_TARGET_COINS }), {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: COLORS.muted,
      lineSpacing: 4,
    }));
    card.add(this.button(112, 72, 176, 44, t('tableSelect.reliefEnter'), () => {
      this.enterReliefTheme(theme);
    }, {
      fontSize: '16px',
      fill: theme.visual.accentColor,
      textColor: '#101114',
    }));
  }

  private renderLockedThemeContent(card: Phaser.GameObjects.Container, theme: TableThemeConfig): void {
    const unlock = theme.unlock;
    if (!unlock) {
      card.add(this.add.text(0, 52, t('tableSelect.locked'), {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: COLORS.muted,
      }).setOrigin(0.5));
      return;
    }

    const progress = getProgress();
    const currentWins = progress.formalTableStats.wins;
    const hasWins = currentWins >= unlock.requiredFormalWins;
    const canAfford = progress.soulCoins >= unlock.coinCost;
    const canUnlock = hasWins && canAfford;

    card.add(this.add.text(-170, -58, '🔒', {
      fontFamily: 'Arial',
      fontSize: '23px',
      color: COLORS.text,
    }).setOrigin(0.5).setShadow(0, 0, '#000000', 7, true, true));

    card.add(this.add.text(-202, -2, t('tableSelect.unlockProgress', {
      current: Math.min(currentWins, unlock.requiredFormalWins),
      required: unlock.requiredFormalWins,
    }), {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: hasWins ? theme.visual.glowColor : COLORS.muted,
    }));
    card.add(this.add.text(202, -2, t('tableSelect.unlockCost', { cost: unlock.coinCost }), {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: canAfford ? COLORS.accentText : COLORS.dangerText,
      fontStyle: 'bold',
    }).setOrigin(1, 0));

    card.add(this.add.rectangle(0, 70, 410, 76, 0x0c0d10, 0.24).setStrokeStyle(1, COLORS.line, 0.35));
    const label = !hasWins
      ? t('tableSelect.winsRequiredShort')
      : !canAfford
        ? t('tableSelect.notEnoughCoinsShort')
        : t('tableSelect.unlock');
    card.add(this.button(0, 70, 238, 44, label, () => {
      this.showUnlockConfirmation(theme);
    }, {
      fontSize: '16px',
      enabled: canUnlock,
      fill: canUnlock ? theme.visual.accentColor : undefined,
      textColor: canUnlock ? '#101114' : undefined,
    }));
  }

  private showUnlockConfirmation(theme: TableThemeConfig): void {
    const unlock = theme.unlock;
    if (!unlock) {
      return;
    }

    const overlay = this.add.container(0, 0).setDepth(100);
    const blocker = this.add.rectangle(640, 360, 1280, 720, 0x050608, 0.76).setInteractive();
    const panel = this.add.rectangle(640, 360, 520, 292, COLORS.panel, 0.99).setStrokeStyle(2, theme.visual.accentColor);
    const title = this.add.text(640, 270, t('tableSelect.unlockConfirmTitle'), {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, theme.visual.glowColor, 9, true, true);
    const body = this.add.text(640, 350, t('tableSelect.unlockConfirmBody', {
      name: t(theme.nameKey),
      cost: unlock.coinCost,
      remaining: getProgress().soulCoins - unlock.coinCost,
    }), {
      fontFamily: 'Arial',
      fontSize: '19px',
      color: COLORS.muted,
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5);
    const cancel = this.button(515, 442, 190, 46, t('tableSelect.unlockCancel'), () => {
      overlay.destroy(true);
    }, { fontSize: '17px' });
    const confirm = this.button(765, 442, 190, 46, t('tableSelect.unlockConfirm'), () => {
      const result = tryPurchaseTableTheme(theme.id, unlock.coinCost, unlock.requiredFormalWins);
      overlay.destroy(true);
      if (result.status === 'unlocked') {
        this.render(t('tableSelect.unlockSuccess', { name: t(theme.nameKey), total: result.total }));
        return;
      }
      if (result.status === 'wins-required') {
        this.render(t('tableSelect.unlockWinsMissing', { current: result.currentWins, required: result.requiredWins }));
        return;
      }
      if (result.status === 'not-enough-coins') {
        this.render(t('tableSelect.notEnoughCoins', { cost: result.cost, total: result.total }));
        return;
      }
      this.render(t('tableSelect.unlockAlreadyOwned'));
    }, {
      fontSize: '17px',
      fill: theme.visual.accentColor,
      textColor: '#101114',
    });

    overlay.add([blocker, panel, title, body, cancel, confirm]);
  }

  private renderComingSoonCard(x: number, y: number): void {
    const card = this.add.container(x, y);
    card.add(this.add.rectangle(0, 0, 456, 232, COLORS.panel, 0.76).setStrokeStyle(2, COLORS.line));
    card.add(this.add.circle(-170, -34, 44, 0x2a2d35, 0.9).setStrokeStyle(2, COLORS.line));
    card.add(this.add.text(-170, -36, '?', {
      fontFamily: 'Arial',
      fontSize: '36px',
      color: COLORS.muted,
      fontStyle: 'bold',
    }).setOrigin(0.5));
    card.add(this.add.text(-102, -78, t('tableSelect.comingSoon'), {
      fontFamily: 'Arial',
      fontSize: '26px',
      color: COLORS.muted,
      fontStyle: 'bold',
    }));
    card.add(this.add.text(-102, -42, t('tableSelect.comingSoonHint'), {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: COLORS.muted,
    }));
  }

  private themePreview(x: number, y: number, theme: TableThemeConfig, unlocked: boolean): Phaser.GameObjects.Container {
    const preview = this.add.container(x, y);
    const alpha = unlocked ? 1 : 0.45;
    preview.add(this.add.rectangle(0, 0, 88, 70, theme.visual.backgroundColor, 0.96).setStrokeStyle(2, theme.visual.accentColor, alpha));
    preview.add(this.add.circle(0, 6, 24, theme.visual.tableColor, 0.95).setStrokeStyle(2, theme.visual.tableRingColor, alpha * 0.75));
    preview.add(this.add.circle(0, 6, 14, 0x050608, 0.45).setStrokeStyle(1, theme.visual.accentColor, alpha * 0.45));

    if (theme.visual.motif === 'northern') {
      preview.add(this.add.rectangle(0, -25, 66, 7, 0x26343a, 0.78));
      preview.add(this.add.circle(-28, 22, 6, 0xff8a3d, 0.36));
      preview.add(this.add.circle(28, 22, 6, 0xff8a3d, 0.36));
      const rune = this.add.text(0, 6, 'R', {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: theme.visual.glowColor,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      rune.setAlpha(0.68);
      rune.setShadow(0, 0, theme.visual.glowColor, 8, true, true);
      preview.add(rune);
    } else if (theme.visual.motif === 'dragon') {
      preview.add(this.add.rectangle(0, -25, 68, 8, 0x5d1f22, 0.82).setStrokeStyle(1, theme.visual.tableRingColor, 0.45));
      preview.add(this.add.ellipse(-28, 22, 12, 18, 0xb72a24, 0.72).setStrokeStyle(1, theme.visual.tableRingColor, 0.58));
      preview.add(this.add.ellipse(28, 22, 12, 18, 0xb72a24, 0.72).setStrokeStyle(1, theme.visual.tableRingColor, 0.58));
      const gate = this.add.text(0, 6, '門', {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: theme.visual.glowColor,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      gate.setAlpha(0.72);
      gate.setShadow(0, 0, theme.visual.glowColor, 8, true, true);
      preview.add(gate);
    } else if (theme.visual.motif === 'edo') {
      preview.add(this.add.rectangle(0, -25, 66, 7, 0x5a334c, 0.82).setStrokeStyle(1, theme.visual.tableRingColor, 0.45));
      preview.add(this.add.ellipse(-28, 22, 12, 18, 0xc65a75, 0.7).setStrokeStyle(1, theme.visual.tableRingColor, 0.58));
      preview.add(this.add.ellipse(28, 22, 12, 18, 0xc65a75, 0.7).setStrokeStyle(1, theme.visual.tableRingColor, 0.58));
      const fan = this.add.text(0, 6, '扇', {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: theme.visual.glowColor,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      fan.setAlpha(0.72);
      fan.setShadow(0, 0, theme.visual.glowColor, 8, true, true);
      preview.add(fan);
    } else {
      preview.add(this.add.rectangle(0, -26, 60, 5, 0x2f2a22, 0.84));
      preview.add(this.add.circle(-26, 20, 6, 0xe8cf73, 0.32));
      preview.add(this.add.circle(26, 20, 6, 0xe8cf73, 0.32));
    }

    return preview;
  }

  private enterTheme(theme: TableThemeConfig, stakeMultiplier: EntryStakeMultiplier): void {
    if (stakeMultiplier === 1 && consumeComplimentaryTableEntry(theme.id)) {
      this.render(t('tableSelect.complimentaryEntryUsed', { name: t(theme.nameKey) }));
      this.time.delayedCall(320, () => this.scene.start('BattleScene', {
        tableThemeId: theme.id,
        stakeMultiplier,
      }));
      return;
    }

    const cost = this.roundCost(theme, stakeMultiplier);
    const entry = tryPayEntryCost(cost, {
      themeId: theme.id,
      stakeMultiplier,
    });
    if (!entry.paid) {
      this.render(t('tableSelect.notEnoughCoins', { cost, total: entry.total }));
      return;
    }

    this.render(t('tableSelect.entryPaid', { cost: entry.amount, total: entry.total }));
    this.time.delayedCall(320, () => this.scene.start('BattleScene', {
      tableThemeId: theme.id,
      stakeMultiplier,
    }));
  }

  private enterReliefTheme(theme: TableThemeConfig): void {
    if (theme.id !== 'evernight_tavern' || getProgress().soulCoins >= RELIEF_COIN_THRESHOLD) {
      this.render();
      return;
    }

    this.scene.start('BattleScene', {
      tableThemeId: theme.id,
      stakeMultiplier: 1,
      reliefMode: true,
    });
  }

  private roundCost(theme: TableThemeConfig, stakeMultiplier: EntryStakeMultiplier): number {
    return theme.entryCost * stakeMultiplier;
  }

  private button(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void,
    options: { fontSize?: string; enabled?: boolean; fill?: number; textColor?: string } = {},
  ): Phaser.GameObjects.Container {
    const enabled = options.enabled ?? true;
    const button = this.add.container(x, y);
    const fill = options.fill ?? (enabled ? COLORS.button : COLORS.disabled);
    const rect = this.add.rectangle(0, 0, width, height, fill).setStrokeStyle(2, enabled ? COLORS.line : 0x343741);
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Arial',
      fontSize: options.fontSize ?? '20px',
      color: options.textColor ?? (enabled ? COLORS.text : COLORS.muted),
    }).setOrigin(0.5);

    if (enabled) {
      rect.setInteractive({ useHandCursor: true });
      rect.on('pointerover', () => rect.setFillStyle(options.fill ?? COLORS.buttonHover));
      rect.on('pointerout', () => rect.setFillStyle(fill));
      rect.on('pointerdown', () => {
        this.sound.play('buttonClick', { volume: 0.42 });
        onClick();
      });
    }

    button.add([rect, text]);
    return button;
  }
}

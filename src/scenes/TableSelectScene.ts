import Phaser from 'phaser';
import { DISPLAY_FONT_FAMILY, GAME_FONT_FAMILY } from '../ui/themes/typography';
import { playLobbyMusic, preloadLobbyMusic } from '../game/audio';
import { getStakeDifficulty } from '../game/data/stakeDifficulties';
import { TABLE_THEMES } from '../game/data/tableThemes';
import {
  calculateFormalVictoryReward,
  RELIEF_COIN_THRESHOLD,
  RELIEF_TARGET_COINS,
  tryPayEntryCost,
} from '../game/economy';
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
import { CATALOG_LEATHER_PANEL_SKIN, EVERNIGHT_BUTTON_SKIN } from '../ui/art/commonUiArt';
import { MedievalButton } from '../ui/components/MedievalButton';
import { MedievalPanel } from '../ui/components/MedievalPanel';
import { SoulCoinDisplay } from '../ui/components/SoulCoinDisplay';
import {
  preloadTableSelectArt,
  TABLE_SELECT_BACKGROUND,
  TABLE_SELECT_LAYOUT,
  TableThemeCard,
} from '../ui/table-select';

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
    SoulCoinDisplay.preload(this);
    preloadTableSelectArt(this);
    if (!this.textures.exists(CATALOG_LEATHER_PANEL_SKIN.textureKey)) {
      this.load.image(CATALOG_LEATHER_PANEL_SKIN.textureKey, CATALOG_LEATHER_PANEL_SKIN.path);
    }
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
    this.statusText = this.add.text(640, TABLE_SELECT_LAYOUT.statusY, status, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '17px',
      color: status ? COLORS.accentText : COLORS.muted,
    }).setOrigin(0.5);
  }

  private addBackground(): void {
    this.add.image(640, 360, TABLE_SELECT_BACKGROUND.key).setDisplaySize(1280, 720);
    this.add.rectangle(640, 360, 1280, 720, 0x050506, 0.42);
    this.add.rectangle(640, 88, 1280, 176, 0x050506, 0.26);
    this.add.rectangle(640, 686, 1280, 68, 0x050506, 0.34);
  }

  private renderHeader(): void {
    this.add.text(640, TABLE_SELECT_LAYOUT.header.titleY, t('tableSelect.title'), {
      fontFamily: DISPLAY_FONT_FAMILY,
      fontSize: '42px',
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, COLORS.accentText, 10, true, true);

    this.add.text(640, TABLE_SELECT_LAYOUT.header.subtitleY, t('tableSelect.subtitle'), {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '16px',
      color: COLORS.muted,
    }).setOrigin(0.5);

    MedievalButton.render(this, {
      x: 24,
      y: 26,
      width: 178,
      height: 44,
      label: t('tableSelect.returnLobby'),
      fontSize: '16px',
      skin: EVERNIGHT_BUTTON_SKIN,
      onActivate: () => {
        this.playButtonClick();
        this.scene.start('StartScene');
      },
    });
  }

  private renderLanguageToggle(): void {
    MedievalButton.render(this, {
      x: 24,
      y: 84,
      width: 144,
      height: 40,
      label: t('language.button'),
      fontSize: '15px',
      variant: 'secondary',
      skin: EVERNIGHT_BUTTON_SKIN,
      onActivate: () => {
        this.playButtonClick();
        toggleLanguage();
        this.scene.restart();
      },
    });
  }

  private renderSoulCoins(): void {
    SoulCoinDisplay.render(this, { x: 1118, y: 50, value: getProgress().soulCoins });
  }

  private renderThemes(): void {
    TABLE_SELECT_LAYOUT.slots.forEach((slot, index) => {
      const theme = TABLE_THEMES[index];
      if (theme) {
        this.renderThemeCard(slot.x, slot.y, theme);
      }
    });
  }

  private renderThemeCard(x: number, y: number, theme: TableThemeConfig): void {
    const unlocked = isTableThemeUnlocked(theme.id);
    const stake = this.stakeByTheme[theme.id] ?? 1;
    const totalCost = this.roundCost(theme, stake);
    const minimumReward = calculateFormalVictoryReward(totalCost, 1, theme.payoutMultiplier);
    const maximumReward = calculateFormalVictoryReward(totalCost, theme.playerHp, theme.payoutMultiplier);
    const complimentaryEntry = unlocked && stake === 1 && hasComplimentaryTableEntry(theme.id);
    const canEnter = unlocked && (complimentaryEntry || getProgress().soulCoins >= totalCost);
    const enterLabel = complimentaryEntry
      ? t('tableSelect.complimentaryEnter')
      : canEnter
        ? t('tableSelect.enter')
        : t('tableSelect.notEnoughCoinsShort');
    const progress = getProgress();
    const unlock = theme.unlock;
    const locked = !unlocked && unlock ? {
      currentWins: progress.formalTableStats.wins,
      requiredWins: unlock.requiredFormalWins,
      coinCost: unlock.coinCost,
      hasWins: progress.formalTableStats.wins >= unlock.requiredFormalWins,
      canAfford: progress.soulCoins >= unlock.coinCost,
      canUnlock: progress.formalTableStats.wins >= unlock.requiredFormalWins
        && progress.soulCoins >= unlock.coinCost,
      buttonLabel: progress.formalTableStats.wins < unlock.requiredFormalWins
        ? t('tableSelect.winsRequiredShort')
        : progress.soulCoins < unlock.coinCost
          ? t('tableSelect.notEnoughCoinsShort')
          : t('tableSelect.unlock'),
    } : undefined;
    const relief = unlocked
      && theme.id === 'evernight_tavern'
      && progress.soulCoins < RELIEF_COIN_THRESHOLD
      ? { targetCoins: RELIEF_TARGET_COINS }
      : undefined;

    TableThemeCard.render(this, {
      x,
      y,
      theme,
      unlocked,
      totalCost,
      minimumReward,
      maximumReward,
      complimentaryEntry,
      canEnter,
      enterLabel,
      difficultyOptions: ENTRY_STAKE_MULTIPLIERS.map((multiplier) => ({
        multiplier,
        label: t(getStakeDifficulty(multiplier).labelKey),
        selected: multiplier === stake,
        enabled: unlocked && ((multiplier === 1 && hasComplimentaryTableEntry(theme.id))
          || progress.soulCoins >= this.roundCost(theme, multiplier)),
      })),
      locked,
      relief,
      onStake: (multiplier) => {
        this.playButtonClick();
        this.stakeByTheme[theme.id] = multiplier;
        this.render();
      },
      onEnter: () => {
        this.playButtonClick();
        if (relief) {
          this.enterReliefTheme(theme);
          return;
        }
        this.enterTheme(theme, stake);
      },
      onUnlock: () => {
        this.playButtonClick();
        this.showUnlockConfirmation(theme);
      },
    });
  }

  private showUnlockConfirmation(theme: TableThemeConfig): void {
    const unlock = theme.unlock;
    if (!unlock) {
      return;
    }

    const overlay = this.add.container(0, 0).setDepth(100);
    const blocker = this.add.rectangle(640, 360, 1280, 720, 0x030304, 0.82).setInteractive();
    const panel = MedievalPanel.render(this, {
      x: 640,
      y: 360,
      width: 540,
      height: 300,
      skin: CATALOG_LEATHER_PANEL_SKIN,
      fallbackFill: 0x24150f,
      fallbackLine: theme.visual.accentColor,
    });
    const themeWash = this.add.rectangle(640, 360, 500, 260, theme.visual.accentColor, 0.035);
    const title = this.add.text(640, 270, t('tableSelect.unlockConfirmTitle'), {
      fontFamily: DISPLAY_FONT_FAMILY,
      fontSize: '30px',
      color: '#f1e5cf',
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, theme.visual.glowColor, 9, true, true);
    const body = this.add.text(640, 350, t('tableSelect.unlockConfirmBody', {
      name: t(theme.nameKey),
      cost: unlock.coinCost,
      remaining: getProgress().soulCoins - unlock.coinCost,
    }), {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '19px',
      color: COLORS.muted,
      align: 'center',
      lineSpacing: 8,
      wordWrap: { width: 430 },
    }).setOrigin(0.5);
    const cancel = MedievalButton.render(this, {
      x: 430,
      y: 421,
      width: 190,
      height: 46,
      label: t('tableSelect.unlockCancel'),
      fontSize: '17px',
      variant: 'secondary',
      skin: EVERNIGHT_BUTTON_SKIN,
      onActivate: () => {
        this.playButtonClick();
        overlay.destroy(true);
      },
    });
    const confirm = MedievalButton.render(this, {
      x: 660,
      y: 421,
      width: 190,
      height: 46,
      label: t('tableSelect.unlockConfirm'),
      fontSize: '17px',
      variant: 'primary',
      skin: EVERNIGHT_BUTTON_SKIN,
      tint: theme.visual.accentColor,
      onActivate: () => {
        this.playButtonClick();
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
      },
    });

    overlay.add([blocker, panel, themeWash, title, body, cancel, confirm]);
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

  private playButtonClick(): void {
    this.sound.play('buttonClick', { volume: 0.42 });
  }
}

import Phaser from 'phaser';
import { BattleEngine, type BattleCombatPresentationEvent, type BattlePresentationEvent } from '../game/engine';
import { preloadCardImages } from '../game/assets';
import { playBattleMusic, preloadBattleMusic, stopBattleMusic, stopLobbyMusic } from '../game/audio';
import { Card, formatCard } from '../game/card';
import { DEFAULT_ENEMY_IDS } from '../game/data/enemies';
import { getLevelById } from '../game/data/levelRegistry';
import { introIdForLevel } from '../game/data/levelIntros';
import { getTableThemeById } from '../game/data/tableThemes';
import { EconomyChange, settleBattleEconomy, settleReliefBattleEconomy, settleStoryBattleEconomy } from '../game/economy';
import { EnemyState } from '../game/enemy';
import { enemyName, t } from '../game/i18n';
import { useBattleItem } from '../game/itemEffects';
import { ITEMS, ItemDefinition } from '../game/items';
import { consumeItem, getProgress, isStoryLevelCompleted } from '../game/progress';
import { ScoreResult, scoreHand } from '../game/scoring';
import { completeStoryLevelAndUnlockNext, getNextStoryLevel } from '../game/storyProgress';
import type { BattleState } from '../game/core/BattleState';
import type { BattleMechanicId } from '../game/types/level';
import type { ItemId } from '../game/types/item';
import type { EntryStakeMultiplier, TableThemeId, TableThemeVisualConfig } from '../game/types/tableTheme';
import { ActionPanel } from '../ui/components/ActionPanel';
import { AbilityOrbit } from '../ui/components/AbilityOrbit';
import { AbilitySlot } from '../ui/components/AbilitySlot';
import { BlockingMessageModal } from '../ui/components/BlockingMessageModal';
import { CharacterFrame } from '../ui/components/CharacterFrame';
import { HandView, resolveHandItemPose } from '../ui/components/HandView';
import { HeartMeter } from '../ui/components/HeartMeter';
import { ItemBar } from '../ui/components/ItemBar';
import { SkillBar } from '../ui/components/SkillBar';
import { StatusIconRow, type StatusIconState } from '../ui/components/StatusIconRow';
import { ScrollableGrid } from '../ui/catalog';
import {
  configureBattleArtTextures,
  getBattleThemeArt,
  getEnemyCharacterArt,
  preloadBattleArt,
  type BattleArtSelection,
  type CharacterArtPose,
} from '../ui/art';
import { resolveBattleLayout, type BattleLayoutConfig } from '../ui/layout';
import { createCardView } from '../ui/presentation/CardView';
import { applyCharacterPortraitPose, createCharacterPortrait } from '../ui/presentation/CharacterPortrait';
import {
  applyPlayerPortraitPose,
  createPlayerPortrait,
  type PlayerPortraitPose,
} from '../ui/presentation/PlayerPortrait';
import { createScoreBadge } from '../ui/presentation/ScoreBadge';
import { renderBattleTableTheme, resolveTableThemeVisual } from '../ui/presentation/TableThemeRenderer';
import { canUseBattleItemFromState, createBattleUIState, type BattleActionButtonState, type BattleUIState } from '../ui/state/UIState';

const COLORS = {
  bg: 0x101114,
  panel: 0x1b1d22,
  panelAlt: 0x252832,
  line: 0x3b3f4c,
  text: '#f2f2ed',
  muted: '#aeb4c0',
  accent: 0xe8cf73,
  accentText: '#e8cf73',
  red: '#ef6f6c',
  dangerText: '#ff4b5f',
  resonance: '#ffd86b',
  green: '#78d18a',
  button: 0x303542,
  buttonHover: 0x41495b,
  danger: 0x734143,
};

const SKILL_COLORS = {
  player: 0xffb84d,
  bartender: 0xe8cf73,
  goblin: 0x65d46e,
  gambler: 0xf25f9a,
  werewolf: 0x73c7ff,
  paladin: 0xf4e7b0,
  merchant: 0xe2c16b,
  keeper: 0xd7b56d,
  viking_warrior: 0xff8a3d,
  rune_shaman: 0x79c9ff,
  valkyrie: 0xf7d889,
  einherjar: 0xaeb9c9,
  swordsman: 0xf05f42,
  songstress: 0xf29bc2,
  taoist: 0x72d8b3,
  shogun_samurai: 0xe15f58,
  ninja: 0x8e78bb,
  oiran: 0xf09ab5,
};

const PASSIVE_EFFECT_TIMING = {
  stepGap: 150,
  flashIn: 190,
  flashHold: 430,
  flashOut: 760,
  standardTotal: 1400,
  goblinTotal: 1520,
  shockwave: 1040,
  insightLine: 1080,
  shuffleCard: 1040,
  bloodReturn: 920,
};

const MAX_BATTLE_ITEM_USES = 3;

export class BattleScene extends Phaser.Scene {
  private battleLayout: BattleLayoutConfig = resolveBattleLayout({ width: 1280, height: 720, target: 'pc' });
  private battleArtSelection: BattleArtSelection = {
    themeId: 'evernight_tavern',
    enemyIds: DEFAULT_ENEMY_IDS,
  };
  private battle!: BattleEngine;
  private battleEconomySettled = false;
  private economyResult?: EconomyChange;
  private resultModalReady = true;
  private itemModalOpen = false;
  private battleLogOpen = false;
  private battleLogGrid?: ScrollableGrid<{ message: string; empty?: boolean }>;
  private confirmReturnToStorySelect = false;
  private confirmExitFormalGame = false;
  private itemFeedback?: { title: string; message: string; success: boolean };
  private temporaryItems: Partial<Record<ItemId, number>> = {};
  private battleItemUses = 0;
  private battleItemUseCounts: Partial<Record<ItemId, number>> = {};
  private grantedItemRoundIds = new Set<string>();
  private dealing = false;
  private playerRedealing = false;
  private actionDealing = false;
  private autoAdvancingRound = false;
  private stageBannerPlaying = false;
  private actionAnimationPlaying = false;
  private presentationSequencePlaying = false;
  private revealFocusPlaying = false;
  private revealFocusPendingEnemyIds = new Set<string>();
  private dealingRound = 0;
  private dealtPlayerCards = 0;
  private dealtEnemyCards = [0, 0, 0];
  private echoedResonanceRound = 0;
  private resonanceShakeKeys = new Set<string>();
  private visualHpOverride?: { player: number; enemies: number[] };
  private visualEnemyDefeated?: boolean[];
  private hiddenRoundAttackBonusEnemyIds = new Set<string>();
  private hiddenHanamiFanTargetIds = new Set<string>();
  private enemySpeech?: { enemyId: string; text: string };
  private playerHeartMeter?: HeartMeter;
  private playerPortrait?: Phaser.GameObjects.Image;
  private playerPortraitPose: PlayerPortraitPose = 'idle';
  private playerPortraitResetTimer?: Phaser.Time.TimerEvent;
  private enemyPortraits = new Map<number, Phaser.GameObjects.Image>();
  private enemyPortraitPoses = new Map<number, CharacterArtPose>();
  private enemyPortraitResetTimers = new Map<number, Phaser.Time.TimerEvent>();
  private enemyPortraitEnemyIds = new Map<number, EnemyState['id']>();
  private enemyHeartMeters = new Map<string, HeartMeter>();
  private ui: Phaser.GameObjects.Container[] = [];
  private seatContainers = new Map<string, Phaser.GameObjects.Container>();
  private blockingMessage?: { title: string; body: string; buttonLabel: string; onClose?: () => void };
  private shownLessonRoundIds = new Set<string>();
  private shownCompareHintKeys = new Set<string>();
  private shownRevealDialogueRoundIds = new Set<string>();
  private shownInviteDialogueIds = new Set<string>();
  private shownPlayerTurnLessonRoundIds = new Set<string>();
  private shownLevelIntroLesson = false;
  private shownResultStory = false;
  private chapter3TauntIndex = 0;
  private chapter3ConsecutiveLosses = 0;
  private chapter3LossHintShown = false;
  private shownChapter4ResonanceFeedbackIds = new Set<string>();
  private battleLevelId?: string;
  private tableThemeId?: TableThemeId;
  private stakeMultiplier: EntryStakeMultiplier = 1;
  private reliefMode = false;

  constructor() {
    super('BattleScene');
  }

  preload(): void {
    preloadBattleMusic(this);
    preloadCardImages(this);
    this.battleArtSelection = this.resolveBattleArtSelection();
    preloadBattleArt(this, this.battleArtSelection);

    if (!this.cache.audio.exists('cardSlide')) {
      this.load.audio('cardSlide', '/audio/card-slide-2.ogg');
    }

    if (!this.cache.audio.exists('buttonClick')) {
      this.load.audio('buttonClick', '/audio/switch28.ogg');
    }

    if (!this.cache.audio.exists('cardPlace')) {
      this.load.audio('cardPlace', '/audio/card-place-1.ogg');
    }

    if (!this.cache.audio.exists('attackFire')) {
      this.load.audio('attackFire', '/audio/fire-ball.wav');
    }

    if (!this.cache.audio.exists('attackWind')) {
      this.load.audio('attackWind', '/audio/wind-attack.wav');
    }

    if (!this.cache.audio.exists('damageExplosion')) {
      this.load.audio('damageExplosion', '/audio/explosion.wav');
    }

    if (!this.cache.audio.exists('sakuraCut')) {
      this.load.audio('sakuraCut', '/audio/Socapex - new_hits.wav');
    }

    if (!this.cache.audio.exists('resonanceEcho')) {
      this.load.audio('resonanceEcho', '/audio/echo.wav');
    }

    if (!this.cache.audio.exists('healSound')) {
      this.load.audio('healSound', '/audio/poison.wav');
    }

    if (!this.cache.audio.exists('beerBubble')) {
      this.load.audio('beerBubble', '/audio/bubble.wav');
    }
  }

  init(data?: { levelId?: string; tableThemeId?: TableThemeId; stakeMultiplier?: EntryStakeMultiplier; reliefMode?: boolean }): void {
    this.battleLevelId = data?.levelId;
    this.tableThemeId = data?.tableThemeId;
    this.stakeMultiplier = data?.stakeMultiplier ?? 1;
    this.reliefMode = data?.reliefMode ?? false;
  }

  create(): void {
    this.battleLayout = resolveBattleLayout({
      width: Number(this.scale.gameSize.width),
      height: Number(this.scale.gameSize.height),
      target: 'auto',
    });
    stopLobbyMusic(this);
    playBattleMusic(this);
    configureBattleArtTextures(this, this.battleArtSelection);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => stopBattleMusic(this));
    const tableThemeConfig = this.tableThemeId ? getTableThemeById(this.tableThemeId) : undefined;
    this.battle = new BattleEngine({
      levelId: this.battleLevelId,
      tableThemeConfig,
      stakeMultiplier: tableThemeConfig ? this.stakeMultiplier : undefined,
    });
    this.battleEconomySettled = false;
    this.economyResult = undefined;
    this.resultModalReady = true;
    this.autoAdvancingRound = false;
    this.presentationSequencePlaying = false;
    this.confirmReturnToStorySelect = false;
    this.confirmExitFormalGame = false;
    this.battleLogOpen = false;
    this.battleLogGrid?.destroy();
    this.battleLogGrid = undefined;
    this.blockingMessage = undefined;
    this.temporaryItems = {};
    this.battleItemUses = 0;
    this.battleItemUseCounts = {};
    this.grantedItemRoundIds.clear();
    this.resonanceShakeKeys.clear();
    this.shownLessonRoundIds.clear();
    this.shownCompareHintKeys.clear();
    this.shownRevealDialogueRoundIds.clear();
    this.shownInviteDialogueIds.clear();
    this.shownPlayerTurnLessonRoundIds.clear();
    this.shownLevelIntroLesson = false;
    this.shownResultStory = false;
    this.chapter3TauntIndex = 0;
    this.chapter3ConsecutiveLosses = 0;
    this.chapter3LossHintShown = false;
    this.shownChapter4ResonanceFeedbackIds.clear();
    this.hiddenRoundAttackBonusEnemyIds.clear();
    this.hiddenHanamiFanTargetIds.clear();
    this.playerPortraitPose = 'idle';
    this.playerPortraitResetTimer?.remove(false);
    this.playerPortraitResetTimer = undefined;
    this.enemyPortraitResetTimers.forEach((timer) => timer.remove(false));
    this.enemyPortraitResetTimers.clear();
    this.enemyPortraitPoses.clear();
    this.enemyPortraits.clear();
    this.enemyPortraitEnemyIds.clear();
    this.playRoundStartBannerThenDeal();
  }

  private render(): void {
    this.settleEconomyIfNeeded();
    this.grantFixedRoundItemsIfNeeded();
    this.battleLogGrid?.destroy();
    this.battleLogGrid = undefined;
    this.children.removeAll(true);
    this.ui.forEach((item) => item.destroy(true));
    this.ui = [];
    this.seatContainers.clear();
    this.playerHeartMeter = undefined;
    this.playerPortrait = undefined;
    this.enemyPortraits.clear();
    this.enemyHeartMeters.clear();

    this.addBackground();
    this.renderEnemies();
    this.renderCenterInfo();
    this.renderPlayer();
    this.renderBattleLogButton();
    this.renderStoryReturnButton();
    this.renderFormalExitButton();
    this.renderPlayerCommandBar();
    this.renderItemModal();
    this.renderItemFeedback();
    this.renderResultModal();
    this.renderStoryReturnConfirmModal();
    this.renderFormalExitConfirmModal();
    this.renderBlockingMessage();
    this.renderBattleLogModal();
  }

  private addBackground(): void {
    renderBattleTableTheme(
      this,
      this.battle.tableThemeConfig?.visual,
      getBattleThemeArt(this.battleArtSelection.themeId),
    );
  }

  private currentThemeVisual(): TableThemeVisualConfig {
    return resolveTableThemeVisual(this.battle.tableThemeConfig?.visual);
  }

  private resolveBattleArtSelection(): BattleArtSelection {
    const tableTheme = this.tableThemeId ? getTableThemeById(this.tableThemeId) : undefined;
    const level = this.battleLevelId ? getLevelById(this.battleLevelId) : undefined;
    return {
      themeId: tableTheme?.id ?? 'evernight_tavern',
      enemyIds: [...(level?.enemyIds ?? tableTheme?.enemyIds ?? DEFAULT_ENEMY_IDS)],
    };
  }

  private renderEnemies(): void {
    const visual = this.currentThemeVisual();
    const themeArt = getBattleThemeArt(this.battleArtSelection.themeId);
    this.battle.enemies.forEach((enemy, index) => {
      const seat = this.enemySeatForIndex(index);
      const hud = this.enemyHudLayout(index);
      const container = this.add.container(seat.x, seat.y);
      this.ui.push(container);
      this.seatContainers.set(enemy.id, container);
      const active = this.battle.currentEnemyIndex === index && this.battle.phase === 'enemy-turn';
      const displayDefeated = this.enemyDisplayDefeated(index);

      const frame = new CharacterFrame(this, {
        x: hud.portrait.x,
        y: hud.portrait.y,
        width: hud.portrait.width,
        height: hud.portrait.height,
        accentColor: visual.enemyFrameColor,
        skin: themeArt.enemyFrame,
        shape: 'circle',
        backdrop: 'diamond',
        active,
        muted: displayDefeated,
      });
      container.add(frame.container);

      const portraitArt = getEnemyCharacterArt(enemy.id);
      let portraitRendered = false;
      if (portraitArt) {
        if (this.enemyPortraitEnemyIds.get(index) !== enemy.id) {
          this.enemyPortraitResetTimers.get(index)?.remove(false);
          this.enemyPortraitResetTimers.delete(index);
          this.enemyPortraitPoses.set(index, 'idle');
          this.enemyPortraitEnemyIds.set(index, enemy.id);
        }
        const portraitPose = displayDefeated ? 'hurt' : (this.enemyPortraitPoses.get(index) ?? 'idle');
        const portrait = createCharacterPortrait(
          this,
          portraitArt,
          portraitPose,
          0,
          0,
        );
        if (portrait) {
          portrait.setAlpha(displayDefeated ? 0.52 : 1);
          this.enemyPortraits.set(index, portrait);
          frame.addPortrait(portrait);
          portraitRendered = true;
        }
      }

      if (!portraitRendered) {
        const fallback = this.add.text(0, 0, enemyName(enemy.id).slice(0, 1), {
          fontFamily: 'Arial',
          fontSize: '40px',
          color: displayDefeated ? COLORS.muted : visual.glowColor,
          fontStyle: 'bold',
        }).setOrigin(0.5);
        if (!displayDefeated) {
          fallback.setShadow(0, 0, visual.glowColor, 10, true, true);
        }
        frame.addPortrait(fallback);
      }

      const name = this.add.text(hud.name.x, hud.name.y, enemyName(enemy.id), {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: displayDefeated ? COLORS.muted : visual.glowColor,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      if (!displayDefeated) {
        name.setShadow(0, 0, visual.glowColor, 6, true, true);
      }
      container.add(name);

      const heartMeter = new HeartMeter(this, {
        x: hud.health.x,
        y: hud.health.y,
        hp: this.enemyDisplayHp(index),
        maxHp: enemy.maxHp,
        muted: displayDefeated,
        onShowTooltip: () => this.showSkillTooltip(
          seat.x + hud.health.x,
          seat.y + hud.health.y - 68,
          t('common.health'),
          t('common.hp', { hp: this.enemyDisplayHp(index), maxHp: enemy.maxHp }),
        ),
        onHideTooltip: () => this.hideSkillTooltip(),
      });
      this.enemyHeartMeters.set(enemy.id, heartMeter);
      container.add(heartMeter.container);

      const hand = this.renderEnemyCardRow(container, enemy, index, hud.hand.x, hud.hand.y);

      if (this.shouldShowEnemyScore(enemy)) {
        const direction = hud.scoreSide === 'right' ? 1 : -1;
        const scoreX = hud.hand.x + direction * ((hand?.rightEdge ?? 0) + hud.scoreGap);
        this.renderScoreBadge(container, scoreX, hud.hand.y, this.scoreEnemy(enemy), true, this.hasMechanic('resonance'));
      }

      this.renderEnemySpeech(container, enemy, hud.speech);

      if (this.hasMechanic('enemy_passives') && this.enemyHasPassiveInfo(enemy)) {
        const orbit = new AbilityOrbit(this, {
          x: hud.portrait.x,
          y: hud.portrait.y,
          radiusX: hud.orbitRadiusX,
          radiusY: hud.orbitRadiusY,
        });
        orbit.addContainer(hud.passivePosition, this.enemyPassiveIcon(enemy, index, hud));
        container.add(orbit.container);
      }
      this.renderEnemyStatusBadges(container, enemy, index, hud);
    });
  }

  private renderEnemyStatusBadges(
    container: Phaser.GameObjects.Container,
    enemy: EnemyState,
    index: number,
    layout: BattleLayoutConfig['enemyHud']['left'],
  ): void {
    if (enemy.defeated) {
      return;
    }

    const statuses: StatusIconState[] = [];
    if (enemy.id === 'shogun_samurai' && enemy.iaijutsuStacks > 0) {
      statuses.push({
        id: 'iaijutsu',
        icon: '刀',
        color: 0xe15f58,
        textColor: '#ffd19d',
        title: t('battle.status.iaijutsu', { amount: enemy.iaijutsuStacks }),
        description: t('skill.iaijutsuCharge.tooltip'),
        badge: `${enemy.iaijutsuStacks}`,
      });
    }

    if (enemy.id === 'ninja' && enemy.smokeScreenArmed) {
      statuses.push({
        id: 'smoke-screen',
        icon: '影',
        color: 0x8e78bb,
        textColor: '#d8cbff',
        title: t('battle.status.smokeScreen'),
        description: t('skill.smokeSubstitution.tooltip', { threshold: this.battle.enemyPassiveHpThreshold(enemy.id) }),
      });
    }

    const oiran = this.battle.enemies.find((candidate) => candidate.id === 'oiran' && !candidate.defeated);
    if (oiran?.hanamiFanTargetId === enemy.id && !this.hiddenHanamiFanTargetIds.has(enemy.id)) {
      statuses.push({
        id: 'hanami-fan',
        icon: '扇',
        color: 0xf09ab5,
        textColor: '#ffd2e3',
        title: t('battle.status.hanamiFan'),
        description: t('skill.hanamiDance.tooltip'),
      });
    }

    if (enemy.taoistTalismaned) {
      statuses.push({
        id: 'taoist-talisman',
        icon: '符',
        color: 0x72d8b3,
        textColor: '#92f0cc',
        title: t('battle.passive.talismaned'),
        description: t('skill.heavenlyInsight.tooltip'),
      });
    }

    const visibleRoundAttackBonus = this.hiddenRoundAttackBonusEnemyIds.has(enemy.id) ? 0 : enemy.roundAttackBonus;
    const attackBonus = Math.max(0, enemy.attackBonus + visibleRoundAttackBonus);
    if (attackBonus > 0) {
      const title = t('battle.status.attackBonus', { amount: attackBonus });
      statuses.push({
        id: 'attack-bonus',
        icon: '↑',
        color: 0xff4b5f,
        textColor: '#ff8d94',
        title,
        description: title,
        badge: `+${attackBonus}`,
      });
    }

    if (statuses.length === 0) {
      return;
    }

    const seat = this.enemySeatForIndex(index);
    const row = new StatusIconRow(this, {
      x: layout.statuses.x,
      y: layout.statuses.y,
      statuses,
      variant: 'tag',
      onShowTooltip: (x, y, title, description) => this.showSkillTooltip(seat.x + x, seat.y + y, title, description),
      onHideTooltip: () => this.hideSkillTooltip(),
    });
    container.add(row.container);
  }

  private renderCenterInfo(): void {
    const visual = this.currentThemeVisual();
    const battleState = this.battle.getState();
    const container = this.add.container(this.battleLayout.centerInfo.x, this.battleLayout.centerInfo.y);
    this.ui.push(container);

    const lineLeft = this.add.rectangle(-108, 0, 70, 1, visual.accentColor, 0.48);
    const lineRight = this.add.rectangle(108, 0, 70, 1, visual.accentColor, 0.48);
    const round = this.add.text(0, 0, t('battle.roundLabel', { round: battleState.round }), {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: visual.glowColor,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    round.setShadow(0, 0, visual.glowColor, 6, true, true);
    container.add([lineLeft, lineRight, round]);
  }

  private renderPlayer(): void {
    const seat = this.battleLayout.seats.player;
    const hud = this.battleLayout.playerHud;
    const visual = this.currentThemeVisual();
    const container = this.add.container(seat.x, seat.y);
    this.ui.push(container);
    this.seatContainers.set('player', container);

    const frame = new CharacterFrame(this, {
      x: hud.portrait.x,
      y: hud.portrait.y,
      width: hud.portrait.width,
      height: hud.portrait.height,
      accentColor: visual.accentColor,
      skin: getBattleThemeArt(this.battleArtSelection.themeId).playerFrame,
      shape: 'circle',
      backdrop: 'diamond',
      active: this.battle.phase === 'player-turn',
      muted: this.playerDisplayHp() <= 0,
    });
    container.add(frame.container);
    const visiblePose: PlayerPortraitPose = this.playerDisplayHp() <= 0 ? 'hurt' : this.playerPortraitPose;
    this.playerPortrait = createPlayerPortrait(this, visiblePose, 0, 0);
    frame.addPortrait(this.playerPortrait);

    const name = this.add.text(hud.name.x, hud.name.y, t('common.playerDealer'), {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: visual.glowColor,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    name.setShadow(0, 0, visual.glowColor, 6, true, true);
    container.add(name);

    this.playerHeartMeter = new HeartMeter(this, {
      x: hud.health.x,
      y: hud.health.y,
      hp: this.playerDisplayHp(),
      maxHp: this.battle.player.maxHp,
      onShowTooltip: () => this.showSkillTooltip(
        seat.x + hud.health.x,
        seat.y + hud.health.y - 74,
        t('common.health'),
        t('common.hp', { hp: this.playerDisplayHp(), maxHp: this.battle.player.maxHp }),
      ),
      onHideTooltip: () => this.hideSkillTooltip(),
    });
    container.add(this.playerHeartMeter.container);

    const statuses = this.playerStatusStates();
    if (statuses.length > 0) {
      const statusRow = new StatusIconRow(this, {
        x: hud.statuses.x,
        y: hud.statuses.y,
        statuses,
        variant: 'tag',
        onShowTooltip: (x, y, title, description) => this.showSkillTooltip(seat.x + x, seat.y + y, title, description),
        onHideTooltip: () => this.hideSkillTooltip(),
      });
      container.add(statusRow.container);
    }

    const hand = this.renderPlayerCardRow(container, hud.hand.x, hud.hand.y);
    if (this.battle.player.shieldCharges > 0) {
      container.add(this.holyShieldAura(this.battle.player.shieldCharges).setPosition(hud.portrait.x, hud.portrait.y));
    }

    const scoreX = hud.hand.x + hand.rightEdge + hud.scoreGap;
    if (this.battle.phase !== 'choice' && !this.playerRedealing) {
      const score = this.battle.playerScore();
      this.renderScoreBadge(container, scoreX, hud.hand.y, score, true, this.hasMechanic('resonance'));
    } else if (this.battle.phase === 'choice') {
      container.add(this.add.text(scoreX, hud.hand.y, t('battle.handHidden'), {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: COLORS.muted,
      }).setOrigin(0.5));
    }
  }

  private setPlayerPortraitPose(pose: PlayerPortraitPose, resetAfterMs?: number): void {
    this.playerPortraitResetTimer?.remove(false);
    this.playerPortraitResetTimer = undefined;
    this.playerPortraitPose = pose;
    if (this.playerPortrait?.active) {
      applyPlayerPortraitPose(this.playerPortrait, pose);
    }

    if (resetAfterMs === undefined) {
      return;
    }

    this.playerPortraitResetTimer = this.time.delayedCall(resetAfterMs, () => {
      this.playerPortraitResetTimer = undefined;
      const nextPose: PlayerPortraitPose = this.playerDisplayHp() <= 0 ? 'hurt' : 'idle';
      this.playerPortraitPose = nextPose;
      if (this.playerPortrait?.active) {
        applyPlayerPortraitPose(this.playerPortrait, nextPose);
      }
    });
  }

  private setEnemyPortraitPose(enemyIndex: number, pose: CharacterArtPose, resetAfterMs?: number): void {
    const enemy = this.battle.enemies[enemyIndex];
    const portraitArt = enemy ? getEnemyCharacterArt(enemy.id) : undefined;
    if (!enemy || !portraitArt) {
      return;
    }

    this.enemyPortraitResetTimers.get(enemyIndex)?.remove(false);
    this.enemyPortraitResetTimers.delete(enemyIndex);
    const visiblePose: CharacterArtPose = this.enemyDisplayDefeated(enemyIndex) ? 'hurt' : pose;
    this.enemyPortraitPoses.set(enemyIndex, visiblePose);
    const portrait = this.enemyPortraits.get(enemyIndex);
    if (portrait?.active) {
      applyCharacterPortraitPose(portrait, portraitArt, visiblePose);
    }

    if (resetAfterMs === undefined || (visiblePose === 'hurt' && this.enemyDisplayDefeated(enemyIndex))) {
      return;
    }

    const timer = this.time.delayedCall(resetAfterMs, () => {
      this.enemyPortraitResetTimers.delete(enemyIndex);
      const nextEnemy = this.battle.enemies[enemyIndex];
      const nextArt = nextEnemy ? getEnemyCharacterArt(nextEnemy.id) : undefined;
      if (!nextEnemy || !nextArt) {
        return;
      }

      const nextPose: CharacterArtPose = this.enemyDisplayDefeated(enemyIndex) ? 'hurt' : 'idle';
      this.enemyPortraitPoses.set(enemyIndex, nextPose);
      const currentPortrait = this.enemyPortraits.get(enemyIndex);
      if (currentPortrait?.active) {
        applyCharacterPortraitPose(currentPortrait, nextArt, nextPose);
      }
    });
    this.enemyPortraitResetTimers.set(enemyIndex, timer);
  }

  private playPlayerPortraitAttackMotion(): void {
    const portrait = this.playerPortrait;
    if (!portrait?.active) {
      return;
    }

    const startY = portrait.y;
    this.tweens.killTweensOf(portrait);
    this.tweens.add({
      targets: portrait,
      y: startY - 12,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 170,
      yoyo: true,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (!portrait.active) {
          return;
        }
        portrait.y = startY;
        portrait.setScale(1);
      },
    });
  }

  private playEnemyPortraitAttackMotion(enemyIndex: number): void {
    const portrait = this.enemyPortraits.get(enemyIndex);
    if (!portrait?.active) {
      return;
    }

    const seat = this.enemySeatForIndex(enemyIndex);
    const direction = new Phaser.Math.Vector2(
      this.battleLayout.seats.player.x - seat.x,
      this.battleLayout.seats.player.y - seat.y,
    ).normalize().scale(12);
    const startX = portrait.x;
    const startY = portrait.y;
    this.tweens.killTweensOf(portrait);
    this.tweens.add({
      targets: portrait,
      x: startX + direction.x,
      y: startY + direction.y,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 170,
      yoyo: true,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (!portrait.active) {
          return;
        }
        portrait.setPosition(startX, startY);
        portrait.setScale(1);
      },
    });
  }

  private createUIState(state: BattleState = this.battle.getState()): BattleUIState {
    const ownedItemCount = this.totalBattleItemCount();
    return createBattleUIState(state, {
      dealing: this.dealing,
      playerRedealing: this.playerRedealing,
      actionDealing: this.actionDealing,
      stageBannerPlaying: this.stageBannerPlaying,
      actionAnimationPlaying: this.actionAnimationPlaying || this.presentationSequencePlaying,
      ownedItemCount,
      itemUsesRemaining: this.remainingBattleItemUses(),
    });
  }

  private grantFixedRoundItemsIfNeeded(): void {
    const fixedRound = this.currentFixedRoundConfig();
    const grantId = fixedRound ? `${fixedRound.id}:${this.battle.round}` : undefined;
    if (!fixedRound?.grantItems || !grantId || this.grantedItemRoundIds.has(grantId)) {
      return;
    }

    Object.entries(fixedRound.grantItems).forEach(([itemId, count]) => {
      const amount = Math.max(0, Math.floor(count ?? 0));
      if (amount <= 0) {
        return;
      }

      const id = itemId as ItemId;
      this.temporaryItems[id] = (this.temporaryItems[id] ?? 0) + amount;
    });
    this.grantedItemRoundIds.add(grantId);
  }

  private currentFixedRoundConfig() {
    const state = this.battle.getState();
    if (!state.currentFixedRoundId) {
      return undefined;
    }

    return this.battle.levelConfig?.fixedRounds?.find((round) => round.id === state.currentFixedRoundId);
  }

  private battleItemCounts(): Partial<Record<ItemId, number>> {
    const counts: Partial<Record<ItemId, number>> = {};
    ITEMS.forEach((item) => {
      const progressCount = getProgress().ownedItems[item.id] ?? 0;
      const temporaryCount = this.temporaryItems[item.id] ?? 0;
      const total = progressCount + temporaryCount;
      if (total > 0) {
        counts[item.id] = total;
      }
    });
    return counts;
  }

  private totalBattleItemCount(): number {
    return Object.values(this.battleItemCounts()).reduce((total, count) => total + (count ?? 0), 0);
  }

  private remainingBattleItemUses(): number {
    return Math.max(0, MAX_BATTLE_ITEM_USES - this.battleItemUses);
  }

  private consumeBattleItem(itemId: ItemId): void {
    const temporaryCount = this.temporaryItems[itemId] ?? 0;
    if (temporaryCount > 0) {
      const nextCount = temporaryCount - 1;
      if (nextCount <= 0) {
        delete this.temporaryItems[itemId];
      } else {
        this.temporaryItems[itemId] = nextCount;
      }
      return;
    }

    consumeItem(itemId, 1);
  }

  private hasMechanic(mechanic: BattleMechanicId): boolean {
    if (this.reliefMode && mechanic === 'items') {
      return false;
    }
    return this.battle.hasMechanic(mechanic);
  }

  private startDealPresentation(): void {
    const beginDeal = () => {
      this.dealing = true;
      this.dealingRound = this.battle.round;
      this.dealtPlayerCards = 0;
      this.dealtEnemyCards = this.battle.enemies.map(() => 0);
      this.itemModalOpen = false;
      this.itemFeedback = undefined;
      const dealEvents = this.battle.currentRoundDealEvents();
      this.render();
      this.playDealSequence(dealEvents, () => {
        this.dealing = false;
        this.dealtPlayerCards = this.battle.player.hand.length;
        this.dealtEnemyCards = this.battle.enemies.map((enemy) => enemy.hand.length);
        this.render();
        if (this.showLevelIntroLessonIfNeeded(() => {
          if (!this.showRoundLessonIfNeeded()) {
            this.render();
          }
        })) {
          return;
        }
        this.showRoundLessonIfNeeded();
      });
    };

    const roundStartEvents = this.battle.consumePresentationEvents();
    if (roundStartEvents.length === 0) {
      beginDeal();
      return;
    }

    this.playImmediatePresentationEvents(roundStartEvents);
    this.playPassiveEffectEvents(roundStartEvents, beginDeal);
  }

  private playRoundStartBannerThenDeal(): void {
    this.playStageBanner(t('battle.banner.roundStart'), () => {
      this.startDealPresentation();
    });
  }

  private playRevealBannerThen(onComplete: () => void): void {
    this.playStageBanner(t('battle.banner.reveal'), onComplete, false);
  }

  private playSoulRedeemBannerThen(onComplete: () => void): void {
    this.stageBannerPlaying = true;
    this.itemModalOpen = false;
    this.setPlayerPortraitPose('hurt');
    this.render();

    const x = this.battleLayout.seats.player.x;
    const y = this.battleLayout.seats.player.y;
    const blocker = this.add.rectangle(640, 360, 1280, 720, 0x050608, 0.18).setDepth(68).setInteractive();
    const playerShade = this.add.rectangle(x, y, this.battleLayout.seats.player.width, this.battleLayout.seats.player.height, 0x050608, 0.38).setDepth(69);
    const soul = this.add.container(x, y + 14).setDepth(72).setAlpha(0).setScale(0.48);
    const outerSoul = this.add.circle(0, 0, 28, 0xf6df96, 0.18).setStrokeStyle(3, 0xfff0bc, 0.9);
    const innerSoul = this.add.circle(0, 0, 14, 0xe9f6ff, 0.82);
    const glyph = this.add.text(0, -2, '✦', {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#fff7d1',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    glyph.setShadow(0, 0, '#ffe39a', 16, true, true);
    soul.add([outerSoul, innerSoul, glyph]);

    const title = this.add.text(x, y - 132, t('skill.soulRedeem.name'), {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: COLORS.resonance,
      fontStyle: 'bold',
      stroke: '#4b3000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(73).setAlpha(0);
    title.setShadow(0, 0, COLORS.resonance, 18, true, true);

    this.sound.play('resonanceEcho', { volume: 0.44 });
    this.playSoulRedeemParticles(x, y + 14, 8, 0xf6df96);
    this.tweens.add({
      targets: [soul, title],
      alpha: 1,
      duration: 240,
      ease: 'Sine.easeOut',
    });
    this.tweens.add({
      targets: soul,
      y: y - 126,
      scale: 1.12,
      duration: 620,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.playSoulRedeemParticles(soul.x, soul.y, 6, 0xe9f6ff);
        this.time.delayedCall(180, () => {
          this.tweens.add({
            targets: soul,
            y,
            scale: 1.42,
            duration: 480,
            ease: 'Cubic.easeIn',
            onComplete: () => {
              this.setPlayerPortraitPose('idle');
              const revivalRing = this.add.circle(x, y, 30, 0xf6df96, 0.2).setStrokeStyle(4, 0xfff5c8, 0.96).setDepth(72);
              const revivalGlow = this.add.circle(x, y, 20, 0xe9f6ff, 0.36).setDepth(73);
              this.playSoulRedeemParticles(x, y, 16, 0xffe7a2);
              this.playHealGainText(x, y - 74, 3, 74);
              this.tweens.add({
                targets: [revivalRing, revivalGlow, soul, title, playerShade, blocker],
                scale: 3.2,
                alpha: 0,
                duration: 620,
                ease: 'Cubic.easeOut',
                onComplete: () => {
                  revivalRing.destroy();
                  revivalGlow.destroy();
                  soul.destroy(true);
                  title.destroy();
                  playerShade.destroy();
                  blocker.destroy();
                  this.stageBannerPlaying = false;
                  onComplete();
                },
              });
            },
          });
        });
      },
    });
  }

  private playSoulRedeemParticles(x: number, y: number, count: number, color: number): void {
    for (let index = 0; index < count; index += 1) {
      const spark = this.add.circle(
        x + Phaser.Math.Between(-26, 26),
        y + Phaser.Math.Between(-18, 18),
        Phaser.Math.Between(3, 6),
        color,
        0.9,
      ).setDepth(71);
      this.tweens.add({
        targets: spark,
        x: spark.x + Phaser.Math.Between(-54, 54),
        y: spark.y + Phaser.Math.Between(-58, 34),
        scale: 0.3,
        alpha: 0,
        duration: Phaser.Math.Between(440, 680),
        ease: 'Sine.easeOut',
        onComplete: () => spark.destroy(),
      });
    }
  }

  private playEnemySoulRedeemBannerThen(onComplete: () => void): void {
    this.playStageBanner(t('battle.banner.keeperSoulRedeem'), onComplete, false, COLORS.resonance, '#4b3000');
  }

  private hasPendingSoulRedeem(): boolean {
    return this.battle.pendingSoulRedeem || !!this.battle.pendingEnemySoulRedeem;
  }

  private resolvePendingSoulRedeem(): void {
    const beforeRedeem = this.hpSnapshot();
    if (this.battle.pendingSoulRedeem) {
      this.battle.resolveSoulRedeem();
    } else if (this.battle.pendingEnemySoulRedeem) {
      this.battle.resolveEnemySoulRedeem();
    }
    this.playHealSoundIfHpIncreased(beforeRedeem);
    this.startDealPresentation();
  }

  private playPendingSoulRedeemBannerThen(onComplete: () => void): void {
    if (this.battle.pendingEnemySoulRedeem) {
      this.playEnemySoulRedeemBannerThen(onComplete);
      return;
    }

    this.playSoulRedeemBannerThen(onComplete);
  }

  private playStageBanner(label: string, onComplete: () => void, renderBefore = true, color = COLORS.dangerText, stroke = '#3a070d'): void {
    this.stageBannerPlaying = true;
    this.itemModalOpen = false;
    if (renderBefore) {
      this.render();
    }

    const container = this.add.container(this.battleLayout.stageBanner.x, this.battleLayout.stageBanner.y).setDepth(70);
    const blocker = this.add.rectangle(
      0,
      18,
      this.battleLayout.canvas.width,
      this.battleLayout.canvas.height,
      0x000000,
      0.01,
    ).setInteractive();
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Arial',
      fontSize: '104px',
      color,
      fontStyle: 'bold',
      stroke,
      strokeThickness: 8,
      align: 'center',
      lineSpacing: 12,
    }).setOrigin(0.5);
    text.setShadow(0, 0, color, 36, true, true);
    container.add([blocker, text]);
    container.setAlpha(0);
    container.setScale(0.56);

    this.tweens.add({
      targets: container,
      alpha: 1,
      scale: 1,
      duration: 360,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(420, () => {
          this.tweens.add({
            targets: container,
            alpha: 0,
            y: container.y - 34,
            scale: 1.12,
            duration: 320,
            ease: 'Sine.easeIn',
            onComplete: () => {
              container.destroy(true);
              this.stageBannerPlaying = false;
              onComplete();
            },
          });
        });
      },
    });
  }

  private playDealSequence(steps: BattlePresentationEvent[], onComplete: () => void): void {
    const playStep = (index: number) => {
      if (index >= steps.length || !this.dealing || this.dealingRound !== this.battle.round) {
        onComplete();
        return;
      }

      const step = steps[index];
      if (step.type !== 'card-dealt') {
        this.time.delayedCall(0, () => playStep(index + 1));
        return;
      }

      const enemyIndex = step.target === 'player'
        ? -1
        : this.battle.enemies.findIndex((enemy) => enemy.id === step.target);
      if (step.target !== 'player' && enemyIndex < 0) {
        this.time.delayedCall(0, () => playStep(index + 1));
        return;
      }

      const to = step.target === 'player'
        ? this.dealTargetForPlayer(step.cardIndex)
        : this.dealTargetForEnemy(enemyIndex, step.cardIndex);
      const targetAngle = step.target === 'player'
        ? this.dealAngleForPlayer(step.cardIndex)
        : this.dealAngleForEnemy(enemyIndex, step.cardIndex);

      this.playDealCard(to, targetAngle, 'slide', () => {
        if (step.target === 'player') {
          this.dealtPlayerCards = Math.max(this.dealtPlayerCards, step.cardIndex + 1);
        } else {
          this.dealtEnemyCards[enemyIndex] = Math.max(this.dealtEnemyCards[enemyIndex], step.cardIndex + 1);
        }

        this.render();
        this.time.delayedCall(54, () => playStep(index + 1));
      });
    };

    playStep(0);
  }

  private playActionDealEvents(events: BattlePresentationEvent[], onComplete: () => void): void {
    const dealEvents = this.cardDealEvents(events);
    if (dealEvents.length === 0) {
      onComplete();
      return;
    }

    this.actionDealing = true;
    this.dealtPlayerCards = this.battle.player.hand.length;
    this.dealtEnemyCards = this.battle.enemies.map((enemy) => enemy.hand.length);
    dealEvents.forEach((event) => {
      if (event.target === 'player') {
        this.dealtPlayerCards = Math.min(this.dealtPlayerCards, event.cardIndex);
        return;
      }

      const enemyIndex = this.battle.enemies.findIndex((enemy) => enemy.id === event.target);
      if (enemyIndex >= 0) {
        this.dealtEnemyCards[enemyIndex] = Math.min(this.dealtEnemyCards[enemyIndex], event.cardIndex);
      }
    });
    this.render();

    const playStep = (index: number) => {
      if (index >= dealEvents.length || !this.actionDealing) {
        this.actionDealing = false;
        this.dealtPlayerCards = this.battle.player.hand.length;
        this.dealtEnemyCards = this.battle.enemies.map((enemy) => enemy.hand.length);
        this.render();
        onComplete();
        return;
      }

      const event = dealEvents[index];
      const enemyIndex = event.target === 'player'
        ? -1
        : this.battle.enemies.findIndex((enemy) => enemy.id === event.target);
      if (event.target !== 'player' && enemyIndex < 0) {
        this.time.delayedCall(0, () => playStep(index + 1));
        return;
      }

      const to = event.target === 'player'
        ? this.dealTargetForPlayer(event.cardIndex)
        : this.dealTargetForEnemy(enemyIndex, event.cardIndex);
      const targetAngle = event.target === 'player'
        ? this.dealAngleForPlayer(event.cardIndex)
        : this.dealAngleForEnemy(enemyIndex, event.cardIndex);

      this.playDealCard(to, targetAngle, 'place', () => {
        if (event.target === 'player') {
          this.dealtPlayerCards = Math.max(this.dealtPlayerCards, event.cardIndex + 1);
        } else {
          this.dealtEnemyCards[enemyIndex] = Math.max(this.dealtEnemyCards[enemyIndex], event.cardIndex + 1);
        }

        this.render();
        this.time.delayedCall(70, () => playStep(index + 1));
      });
    };

    playStep(0);
  }

  private dealTargetForPlayer(cardIndex: number): Phaser.Math.Vector2 {
    const seat = this.battleLayout.seats.player;
    const hud = this.battleLayout.playerHud;
    const count = Math.max(this.battle.player.hand.length, cardIndex + 1);
    const pose = resolveHandItemPose(
      cardIndex,
      count,
      this.battleLayout.cards.width,
      this.battleLayout.cards.spacing,
      true,
    );
    return new Phaser.Math.Vector2(
      seat.x + hud.hand.x + pose.x,
      seat.y + hud.hand.y + pose.y,
    );
  }

  private dealTargetForEnemy(enemyIndex: number, cardIndex: number): Phaser.Math.Vector2 {
    const seat = this.enemySeatForIndex(enemyIndex);
    const layout = this.enemyHudLayout(enemyIndex);
    const count = Math.max(this.battle.enemies[enemyIndex]?.hand.length ?? 0, cardIndex + 1);
    const pose = resolveHandItemPose(
      cardIndex,
      count,
      this.battleLayout.cards.enemyWidth,
      this.battleLayout.cards.enemySpacing,
      true,
    );
    return new Phaser.Math.Vector2(
      seat.x + layout.hand.x + pose.x,
      seat.y + layout.hand.y + pose.y,
    );
  }

  private dealAngleForPlayer(cardIndex: number): number {
    const count = Math.max(this.battle.player.hand.length, cardIndex + 1);
    return resolveHandItemPose(
      cardIndex,
      count,
      this.battleLayout.cards.width,
      this.battleLayout.cards.spacing,
      true,
    ).angle;
  }

  private dealAngleForEnemy(enemyIndex: number, cardIndex: number): number {
    const count = Math.max(this.battle.enemies[enemyIndex]?.hand.length ?? 0, cardIndex + 1);
    return resolveHandItemPose(
      cardIndex,
      count,
      this.battleLayout.cards.enemyWidth,
      this.battleLayout.cards.enemySpacing,
      true,
    ).angle;
  }

  private enemyCardCenter(enemyIndex: number, cardIndex: number): Phaser.Math.Vector2 {
    const seat = this.enemySeatForIndex(enemyIndex);
    const layout = this.enemyHudLayout(enemyIndex);
    const count = Math.max(this.battle.enemies[enemyIndex]?.hand.length ?? 0, cardIndex + 1);
    const pose = resolveHandItemPose(
      cardIndex,
      count,
      this.battleLayout.cards.enemyWidth,
      this.battleLayout.cards.enemySpacing,
      true,
    );
    return new Phaser.Math.Vector2(
      seat.x + layout.hand.x + pose.x,
      seat.y + layout.hand.y + pose.y,
    );
  }

  private playDealCard(
    to: Phaser.Math.Vector2,
    targetAngle: number,
    sound: 'slide' | 'place',
    onComplete: () => void,
  ): void {
    const card = this.add.container(this.battleLayout.dealOrigin.x, this.battleLayout.dealOrigin.y)
      .setDepth(30)
      .setAngle(Phaser.Math.Between(-5, 5));
    card.add(this.add.rectangle(0, 0, 34, 48, 0xf2f2ed, 0.96).setStrokeStyle(2, COLORS.accent));
    card.add(this.add.rectangle(0, 0, 24, 36, 0x2b303c, 0.18).setStrokeStyle(1, 0x2b303c, 0.45));
    card.add(this.add.text(0, 0, '?', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#101114',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    this.sound.play(sound === 'slide' ? 'cardSlide' : 'cardPlace', {
      volume: sound === 'slide' ? 0.56 : 0.42,
    });
    this.tweens.add({
      targets: card,
      x: to.x,
      y: to.y,
      angle: targetAngle,
      duration: 160,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        card.destroy(true);
        onComplete();
      },
    });
  }

  private playPlayerRedealPresentation(events: BattlePresentationEvent[]): void {
    this.playerRedealing = true;
    this.dealtPlayerCards = 0;
    this.itemModalOpen = false;
    this.itemFeedback = undefined;
    this.render();

    const dealEvents = this.cardDealEvents(events).filter((event) => event.target === 'player');
    const playStep = (index: number) => {
      if (index >= dealEvents.length || !this.playerRedealing) {
        this.playerRedealing = false;
        this.dealtPlayerCards = this.battle.player.hand.length;
        this.playRoundResonanceEchoOnce();
        this.render();
        return;
      }

      const event = dealEvents[index];
      this.playDealCard(this.dealTargetForPlayer(event.cardIndex), this.dealAngleForPlayer(event.cardIndex), 'place', () => {
        this.dealtPlayerCards = Math.max(this.dealtPlayerCards, event.cardIndex + 1);
        this.render();
        this.time.delayedCall(70, () => playStep(index + 1));
      });
    };

    playStep(0);
  }

  private renderBattleLogButton(): void {
    if (this.battleLogOpen || this.battle.phase === 'battle-result') {
      return;
    }

    const container = this.add.container(this.battleLayout.hud.logButton.x, this.battleLayout.hud.logButton.y).setDepth(40);
    this.ui.push(container);
    container.add(this.button(0, 0, 118, 40, t('battle.logButton'), () => {
      if (this.blockingMessage
        || this.itemModalOpen
        || this.itemFeedback
        || this.confirmReturnToStorySelect
        || this.confirmExitFormalGame
        || this.isPresentationBusy()) {
        return;
      }

      this.battleLogOpen = true;
      this.render();
    }, COLORS.button, '16px'));
  }

  private renderBattleLogModal(): void {
    if (!this.battleLogOpen) {
      return;
    }

    const container = this.add.container(640, 360).setDepth(140);
    this.ui.push(container);
    const blocker = this.add.rectangle(0, 0, 1280, 720, 0x050608, 0.78).setInteractive();
    const panel = this.add.rectangle(0, 0, 760, 530, COLORS.panel, 0.99).setStrokeStyle(2, COLORS.accent, 0.9);
    const title = this.add.text(0, -224, t('battle.logTitle'), {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    title.setShadow(0, 0, COLORS.accentText, 8, true, true);
    container.add([blocker, panel, title]);

    const entries = this.battle.log.length > 0
      ? this.battle.log.map((message) => ({ message }))
      : [{ message: t('battle.logEmpty'), empty: true }];
    this.battleLogGrid = new ScrollableGrid(this, {
      x: 310,
      y: 174,
      width: 660,
      height: 330,
      columns: 1,
      cellWidth: 628,
      cellHeight: 56,
      rowGap: 8,
      wheelStep: 64,
      scrollbar: {
        trackColor: COLORS.panelAlt,
        thumbColor: COLORS.accent,
        thumbHoverColor: 0xf4df91,
      },
    });
    this.battleLogGrid.container.setDepth(141);
    this.battleLogGrid.setItems(entries, (scene, entry, index) => {
      const row = scene.add.container(0, 0);
      const isNewest = index === 0 && !entry.empty;
      const background = scene.add.rectangle(0, 0, 628, 56, isNewest ? 0x292719 : COLORS.panelAlt, 0.76)
        .setStrokeStyle(1, isNewest ? COLORS.accent : COLORS.line, isNewest ? 0.72 : 0.55);
      const accent = scene.add.rectangle(-307, 0, 3, 38, isNewest ? COLORS.accent : COLORS.line, isNewest ? 0.95 : 0.5);
      const message = scene.add.text(-294, 0, entry.message, {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: entry.empty ? COLORS.muted : (isNewest ? '#f4df91' : COLORS.text),
        wordWrap: { width: 574, useAdvancedWrap: true },
      }).setOrigin(0, 0.5);
      row.add([background, accent, message]);
      return row;
    });

    container.add(this.button(-78, 202, 156, 44, t('battle.logClose'), () => {
      this.battleLogOpen = false;
      this.render();
    }, COLORS.button, '17px'));
  }

  private renderPlayerCommandBar(): void {
    const uiState = this.createUIState();
    const showItems = this.hasMechanic('items');
    const showSkills = this.hasMechanic('skills');
    const inputBlocked = Boolean(
      this.blockingMessage
      || this.battleLogOpen
      || this.itemModalOpen
      || this.itemFeedback
      || this.confirmReturnToStorySelect
      || this.confirmExitFormalGame,
    );
    const playerSeat = this.battleLayout.seats.player;
    const hud = this.battleLayout.playerHud;
    const controls = this.add.container(playerSeat.x, playerSeat.y);
    this.ui.push(controls);
    const orbit = new AbilityOrbit(this, {
      x: hud.portrait.x,
      y: hud.portrait.y,
      radiusX: hud.orbitRadiusX,
      radiusY: hud.orbitRadiusY,
    });
    controls.add(orbit.container);

    if (this.hasMechanic('soul_redeem')) {
      orbit.addContainer('top-left', this.playerPassiveIcon());
    }

    if (showItems) {
      const itemUsesRemaining = this.remainingBattleItemUses();
      const itemUsesExhausted = itemUsesRemaining <= 0;
      const itemTooltipX = playerSeat.x + hud.portrait.x - hud.orbitRadiusX - 110;
      const itemTooltipY = playerSeat.y + hud.portrait.y + hud.orbitRadiusY - 90;
      orbit.addContainer('bottom-left', ItemBar.render(this, {
        x: 0,
        y: 0,
        enabled: uiState.itemButton.enabled && !inputBlocked && !itemUsesExhausted,
        label: t('battle.itemButtonRemaining', { remaining: itemUsesRemaining, max: MAX_BATTLE_ITEM_USES }),
        badge: `${itemUsesRemaining}`,
        colors: {
          accent: COLORS.accent,
          accentText: COLORS.accentText,
          line: COLORS.line,
          muted: COLORS.muted,
          panelEnabled: 0x2a2e38,
          panelDisabled: 0x20232a,
          text: COLORS.text,
        },
        onShowTooltip: () => this.showSkillTooltip(
          itemTooltipX,
          itemTooltipY,
          t('battle.itemButton'),
          t('battle.itemButtonRemaining', { remaining: itemUsesRemaining, max: MAX_BATTLE_ITEM_USES }),
        ),
        onHideTooltip: () => this.hideSkillTooltip(),
        onOpen: () => {
          this.playClickSound();
          this.itemModalOpen = true;
          this.render();
        },
      }));
    }

    if (showSkills) {
      const skills = {
        shift: { ...uiState.skills.shift, enabled: uiState.skills.shift.enabled && !inputBlocked },
        summon: { ...uiState.skills.summon, enabled: uiState.skills.summon.enabled && !inputBlocked },
      };
      controls.add(SkillBar.render(this, {
        x: hud.portrait.x + hud.orbitRadiusX,
        y: hud.portrait.y - hud.orbitRadiusY,
        skills,
        direction: 'vertical',
        slotGap: hud.orbitRadiusY * 2,
        colors: {
          cooldown: COLORS.dangerText,
          line: COLORS.line,
          muted: COLORS.muted,
          resonance: COLORS.resonance,
          text: COLORS.text,
        },
        tooltipOrigin: { x: playerSeat.x, y: playerSeat.y },
        onShowTooltip: (x, y, title, body) => this.showSkillTooltip(x, y, title, body),
        onHideTooltip: () => this.hideSkillTooltip(),
        onUse: (kind, title, tooltip, tooltipX, tooltipY) => {
          this.playClickSound();
          this.runAction(() => {
            const result = this.battle.execute({
              type: 'use-skill',
              skill: kind === 'shift' ? 'resonance-shift' : 'resonance-summon',
            });
            if (result?.used) {
              this.setPlayerPortraitPose('cast', 1050);
            }
            if (!result?.used) {
              this.showSkillTooltip(tooltipX, tooltipY, title, result?.message ?? tooltip);
            }
          });
        },
      }));
    }

    if (uiState.autoAdvanceRound) {
      this.scheduleNextRound();
      return;
    }

    if (uiState.inputLocked || inputBlocked) {
      return;
    }

    controls.add(ActionPanel.render(this, {
      x: hud.actions.x,
      y: hud.actions.y,
      buttons: uiState.actionButtons,
      colors: {
        button: COLORS.button,
        danger: COLORS.danger,
      },
      createButton: (x, y, width, height, label, onClick, fill, fontSize, sound) => this.button(x, y, width, height, label, onClick, fill, fontSize, sound),
      onAction: (buttonState) => this.handleActionButton(buttonState),
      centered: true,
    }));
  }

  private renderStoryReturnButton(): void {
    if (!this.battle.levelConfig?.id || this.battle.phase === 'battle-result') {
      return;
    }

    const container = this.add.container(this.battleLayout.hud.exitButton.x, this.battleLayout.hud.exitButton.y).setDepth(40);
    this.ui.push(container);
    container.add(this.button(0, 0, 118, 40, t('battle.storyReturn.button'), () => {
      if (this.blockingMessage || this.itemModalOpen || this.itemFeedback || this.presentationSequencePlaying || this.actionAnimationPlaying || this.dealing || this.actionDealing || this.playerRedealing) {
        return;
      }

      this.confirmReturnToStorySelect = true;
      this.render();
    }, COLORS.danger, '16px'));
  }

  private renderFormalExitButton(): void {
    if (this.battle.levelConfig?.id || !this.tableThemeId || this.battle.phase === 'battle-result') {
      return;
    }

    const container = this.add.container(this.battleLayout.hud.exitButton.x, this.battleLayout.hud.exitButton.y).setDepth(40);
    this.ui.push(container);
    container.add(this.button(0, 0, 118, 40, t('battle.formalExit.button'), () => {
      if (this.blockingMessage || this.itemModalOpen || this.itemFeedback || this.presentationSequencePlaying || this.actionAnimationPlaying || this.dealing || this.actionDealing || this.playerRedealing) {
        return;
      }

      this.confirmExitFormalGame = true;
      this.render();
    }, COLORS.danger, '16px'));
  }

  private renderStoryReturnConfirmModal(): void {
    if (!this.confirmReturnToStorySelect) {
      return;
    }

    const container = this.add.container(640, 360).setDepth(105);
    this.ui.push(container);

    const blocker = this.add.rectangle(0, 0, 1280, 720, 0x050608, 0.68);
    blocker.setInteractive();
    container.add(blocker);
    container.add(this.add.rectangle(0, 0, 500, 258, COLORS.panel, 0.98).setStrokeStyle(2, COLORS.danger));

    const title = this.add.text(0, -82, t('battle.storyReturn.title'), {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const body = this.add.text(0, -22, t('battle.storyReturn.body'), {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: COLORS.muted,
      align: 'center',
      lineSpacing: 8,
      wordWrap: { width: 390, useAdvancedWrap: true },
    }).setOrigin(0.5);

    container.add([
      title,
      body,
      this.button(-172, 58, 150, 46, t('battle.storyReturn.cancel'), () => {
        this.confirmReturnToStorySelect = false;
        this.render();
      }),
      this.button(22, 58, 184, 46, t('battle.storyReturn.confirm'), () => {
        this.confirmReturnToStorySelect = false;
        this.scene.start('StorySelectScene');
      }, COLORS.danger, '17px'),
    ]);
  }

  private renderFormalExitConfirmModal(): void {
    if (!this.confirmExitFormalGame) {
      return;
    }

    const container = this.add.container(640, 360).setDepth(105);
    this.ui.push(container);

    const blocker = this.add.rectangle(0, 0, 1280, 720, 0x050608, 0.68);
    blocker.setInteractive();
    container.add(blocker);
    container.add(this.add.rectangle(0, 0, 520, 270, COLORS.panel, 0.98).setStrokeStyle(2, COLORS.danger));

    const title = this.add.text(0, -84, t(this.reliefMode ? 'battle.reliefExit.title' : 'battle.formalExit.title'), {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const body = this.add.text(0, -22, t(this.reliefMode ? 'battle.reliefExit.body' : 'battle.formalExit.body'), {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: COLORS.muted,
      align: 'center',
      lineSpacing: 8,
      wordWrap: { width: 410, useAdvancedWrap: true },
    }).setOrigin(0.5);

    container.add([
      title,
      body,
      this.button(-172, 62, 150, 46, t('battle.formalExit.cancel'), () => {
        this.confirmExitFormalGame = false;
        this.render();
      }),
      this.button(22, 62, 184, 46, t('battle.formalExit.confirm'), () => {
        this.confirmExitFormalGame = false;
        this.scene.start(this.reliefMode ? 'TableSelectScene' : 'StartScene');
      }, COLORS.danger, '17px'),
    ]);
  }

  private handleActionButton(buttonState: BattleActionButtonState): void {
    if (buttonState.id === 'view-hand') {
      this.battle.execute(buttonState.action);
      this.playRoundResonanceEchoOnce();
      this.render();
      if (this.showPlayerTurnLessonIfNeeded()) {
        return;
      }
      this.showCompareHintIfNeeded();
      return;
    }

    if (buttonState.id === 'invite-one') {
      const invitedEnemyId = this.battle.currentEnemy?.id;
      this.battle.execute(buttonState.action);
      const events = this.battle.consumePresentationEvents();
      if (this.cardDealEvents(events).length === 0) {
        this.playClickSound();
      }
      this.playImmediatePresentationEvents(events);
      this.playActionDealEvents(events, () => {
        this.playPassiveEffectEvents(events, () => {
          this.playCardReplacementEvents(events, () => {
            const continueAfterInviteDialogue = () => {
              if (this.showPlayerTurnLessonIfNeeded()) {
                return;
              }

              this.render();
            };

            if (invitedEnemyId && this.showInviteDialogueIfNeeded(invitedEnemyId, continueAfterInviteDialogue)) {
              return;
            }

            continueAfterInviteDialogue();
          });
        });
      });
      return;
    }

    this.runAction(() => this.battle.execute(buttonState.action));
  }

  private scheduleNextRound(): void {
    if (this.autoAdvancingRound || this.battle.phase !== 'round-result') {
      return;
    }

    this.autoAdvancingRound = true;
    this.time.delayedCall(900, () => {
      if (this.isRoundTransitionBusy()) {
        this.autoAdvancingRound = false;
        this.time.delayedCall(120, () => this.scheduleNextRound());
        return;
      }

      this.autoAdvancingRound = false;
      if (this.battle.phase !== 'round-result' || this.battle.battleOutcome) {
        this.render();
        return;
      }

      this.battle.execute({ type: 'next-round' });
      const events = this.battle.consumePresentationEvents();
      this.playImmediatePresentationEvents(events);
      this.playPassiveEffectEvents(events, () => this.startDealPresentation());
    });
  }

  private isRoundTransitionBusy(): boolean {
    return this.dealing
      || this.playerRedealing
      || this.actionDealing
      || this.stageBannerPlaying
      || this.actionAnimationPlaying
      || this.presentationSequencePlaying;
  }

  private settleEconomyIfNeeded(): void {
    if (this.battleEconomySettled || this.battle.phase !== 'battle-result' || !this.battle.battleOutcome) {
      return;
    }

    this.battleEconomySettled = true;
    const levelConfig = this.battle.levelConfig;
    const economy = levelConfig
      ? settleStoryBattleEconomy(
        this.battle.battleOutcome,
        levelConfig.rewards,
        !isStoryLevelCompleted(levelConfig.id),
        levelConfig.id,
      )
      : this.reliefMode
        ? settleReliefBattleEconomy(this.battle.battleOutcome)
      : settleBattleEconomy(
        this.battle.battleOutcome,
        this.battle.player.hp,
        (this.battle.tableThemeConfig?.entryCost ?? 20) * this.stakeMultiplier,
        this.battle.tableThemeConfig?.payoutMultiplier ?? 1.5,
        this.tableThemeId,
        this.stakeMultiplier,
      );
    if (this.battle.battleOutcome === 'victory' && levelConfig) {
      completeStoryLevelAndUnlockNext(levelConfig.id);
    }
    this.economyResult = economy;
    this.battle.log.unshift(this.economyLogText(economy));
  }

  private renderResultModal(): void {
    if (
      this.itemFeedback
      || !this.resultModalReady
      || this.isPresentationBusy()
      || this.battle.phase !== 'battle-result'
      || !this.battle.battleOutcome
      || !this.economyResult
    ) {
      return;
    }

    const isVictory = this.battle.battleOutcome === 'victory';
    const container = this.add.container(640, 360).setDepth(100);
    this.ui.push(container);

    container.add(this.add.rectangle(0, 0, 1280, 720, 0x050608, 0.68));
    const storyResultText = this.storyResultText(isVictory);
    const modalHeight = storyResultText ? 390 : 282;
    container.add(this.add.rectangle(0, 0, 520, modalHeight, COLORS.panel, 0.98).setStrokeStyle(2, isVictory ? 0x78d18a : 0xff4b5f));

    const titleColor = isVictory ? COLORS.green : COLORS.dangerText;
    const title = this.add.text(0, storyResultText ? -148 : -88, isVictory ? t('battle.result.victory') : t('battle.result.defeat'), {
      fontFamily: 'Arial',
      fontSize: '46px',
      color: titleColor,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    title.setShadow(0, 0, titleColor, 12, true, true);

    const goldText = this.add.text(0, storyResultText ? -90 : -24, this.economyResultText(this.economyResult), {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#e8cf73',
    }).setOrigin(0.5);
    goldText.setShadow(0, 0, '#e8cf73', 8, true, true);

    const totalText = this.add.text(0, storyResultText ? -56 : 18, t('battle.result.totalGold', { total: this.economyResult.total }), {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: COLORS.muted,
    }).setOrigin(0.5);
    const children: Phaser.GameObjects.GameObject[] = [title, goldText, totalText];
    if (storyResultText) {
      children.push(this.add.text(0, 42, storyResultText, {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: COLORS.text,
        align: 'center',
        lineSpacing: 7,
        wordWrap: { width: 430, useAdvancedWrap: true },
      }).setOrigin(0.5));
    }
    const buttonY = storyResultText ? 134 : 68;
    const continueLabel = this.reliefMode && !isVictory ? t('battle.result.retry') : t('battle.result.continue');
    children.push(this.button(-230, buttonY, 200, 50, continueLabel, () => {
      this.continueAfterResult();
    }));
    children.push(this.button(30, buttonY, 200, 50, t('battle.result.returnLobby'), () => {
      this.scene.start('StartScene');
    }));
    container.add(children);
  }

  private economyResultText(economy: EconomyChange): string {
    if (this.battle.levelConfig) {
      if (economy.rewardStatus === 'granted') {
        return t('battle.result.storyFirstClearGold', { amount: economy.amount });
      }
      if (economy.rewardStatus === 'already-claimed') {
        return t('battle.result.storyRewardClaimed');
      }
      return t('battle.result.storyNoGold');
    }

    if (this.reliefMode) {
      return this.battle.battleOutcome === 'victory'
        ? t('battle.result.reliefGold', { amount: economy.amount, total: economy.total })
        : t('battle.result.reliefNoGold');
    }

    return this.battle.battleOutcome === 'victory'
      ? t('battle.result.goldGained', { amount: economy.amount })
      : t('battle.result.noGoldGained');
  }

  private economyLogText(economy: EconomyChange): string {
    if (this.battle.levelConfig) {
      if (economy.rewardStatus === 'granted') {
        return t('log.storyFirstClearGold', { amount: economy.amount, total: economy.total });
      }
      if (economy.rewardStatus === 'already-claimed') {
        return t('log.storyRewardClaimed', { total: economy.total });
      }
      return t('log.storyDefeat', { total: economy.total });
    }

    if (this.reliefMode) {
      return this.battle.battleOutcome === 'victory'
        ? t('log.reliefVictory', { amount: economy.amount, total: economy.total })
        : t('log.reliefDefeat', { total: economy.total });
    }

    return this.battle.battleOutcome === 'victory'
      ? t('log.economyVictory', { amount: economy.amount, total: economy.total })
      : t('log.economyDefeat', { total: economy.total });
  }

  private continueAfterResult(): void {
    const levelId = this.battle.levelConfig?.id;
    if (this.reliefMode && this.battle.battleOutcome === 'defeat' && this.tableThemeId) {
      this.scene.start('BattleScene', {
        tableThemeId: this.tableThemeId,
        stakeMultiplier: 1,
        reliefMode: true,
      });
      return;
    }

    if (!levelId && this.tableThemeId) {
      this.scene.start('TableSelectScene');
      return;
    }

    if (!levelId) {
      this.scene.start('BattleScene', {});
      return;
    }

    if (this.battle.battleOutcome === 'defeat') {
      this.scene.start('BattleScene', { levelId });
      return;
    }

    const nextLevel = getNextStoryLevel(levelId);
    if (!nextLevel) {
      this.scene.start('StorySelectScene');
      return;
    }

    this.scene.start('ChapterIntroScene', {
      introId: introIdForLevel(nextLevel.id),
      levelId: nextLevel.id,
    });
  }

  private renderBlockingMessage(): void {
    if (!this.blockingMessage) {
      return;
    }

    this.ui.push(BlockingMessageModal.render(this, {
      title: this.blockingMessage.title,
      body: this.blockingMessage.body,
      buttonLabel: this.blockingMessage.buttonLabel,
      colors: {
        panel: COLORS.panel,
        line: COLORS.line,
        text: COLORS.text,
        muted: COLORS.muted,
        accent: COLORS.accent,
        accentText: COLORS.accentText,
        button: COLORS.button,
        buttonHover: COLORS.buttonHover,
      },
      onClose: () => {
        this.playClickSound();
        const onClose = this.blockingMessage?.onClose;
        this.blockingMessage = undefined;
        if (onClose) {
          onClose();
          return;
        }

        this.render();
      },
    }));
  }

  private showBlockingMessage(title: string, body: string, buttonLabel = t('battle.modal.continue'), onClose?: () => void): void {
    this.blockingMessage = { title, body, buttonLabel, onClose };
    this.render();
  }

  private showBlockingMessageSequence(messages: Array<{ title: string; body: string }>, onComplete: () => void): void {
    const showAt = (index: number) => {
      const message = messages[index];
      if (!message) {
        onComplete();
        return;
      }

      this.showBlockingMessage(message.title, message.body, t('battle.modal.continue'), () => showAt(index + 1));
    };

    showAt(0);
  }

  private showLevelIntroLessonIfNeeded(onClose?: () => void): boolean {
    const state = this.battle.getState();
    if (this.shownLevelIntroLesson || state.round !== 1 || !state.levelIntroLessonKey) {
      return false;
    }

    this.shownLevelIntroLesson = true;
    this.showBlockingMessage(t(this.battle.levelConfig?.titleKey ?? 'battle.modal.tutorialTitle'), t(state.levelIntroLessonKey), t('battle.modal.understood'), onClose);
    return true;
  }

  private showRoundLessonIfNeeded(): boolean {
    const state = this.battle.getState();
    if (!state.currentFixedRoundId || !state.currentLessonKey || this.shownLessonRoundIds.has(state.currentFixedRoundId)) {
      return false;
    }

    this.shownLessonRoundIds.add(state.currentFixedRoundId);
    this.showBlockingMessage(t('battle.modal.tutorialTitle'), t(state.currentLessonKey), t('battle.modal.understood'));
    return true;
  }

  private showCompareHintIfNeeded(): void {
    const state = this.battle.getState();
    if (!state.currentTutorialBeforeCompareKey || this.shownCompareHintKeys.has(state.currentTutorialBeforeCompareKey)) {
      return;
    }

    this.shownCompareHintKeys.add(state.currentTutorialBeforeCompareKey);
    this.showBlockingMessage(t('battle.modal.tutorialTitle'), t(state.currentTutorialBeforeCompareKey), t('battle.modal.understood'));
  }

  private showPlayerTurnLessonIfNeeded(): boolean {
    const state = this.battle.getState();
    if (
      state.phase !== 'player-turn'
      || !state.currentFixedRoundId
      || !state.currentPlayerTurnLessonKey
      || this.shownPlayerTurnLessonRoundIds.has(state.currentFixedRoundId)
    ) {
      return false;
    }

    this.shownPlayerTurnLessonRoundIds.add(state.currentFixedRoundId);
    this.showBlockingMessage(t('battle.modal.tutorialTitle'), t(state.currentPlayerTurnLessonKey), t('battle.modal.understood'));
    return true;
  }

  private showInviteDialogueIfNeeded(enemyId: string, onComplete: () => void): boolean {
    const fixedRound = this.battle.levelConfig?.fixedRounds?.[this.battle.round - 1];
    const fixedEnemy = fixedRound?.enemies.find((enemy) => enemy.enemyId === enemyId);
    if (!fixedRound || !fixedEnemy?.inviteDialogueKeys?.length) {
      return false;
    }

    const dialogueId = `${fixedRound.id}:${enemyId}:invite`;
    if (this.shownInviteDialogueIds.has(dialogueId)) {
      return false;
    }

    this.shownInviteDialogueIds.add(dialogueId);
    this.showBlockingMessageSequence(
      fixedEnemy.inviteDialogueKeys.map((key) => this.dialogueMessageFromKey(key)),
      onComplete,
    );
    return true;
  }

  private showRevealDialogueIfNeeded(onClose: () => void): boolean {
    const fixedRound = this.battle.levelConfig?.fixedRounds?.[this.battle.round - 1];
    if (!fixedRound || this.shownRevealDialogueRoundIds.has(fixedRound.id)) {
      return false;
    }

    const dialogueKeys = [
      ...(fixedRound.afterRevealDialogueKeys ?? []),
      ...fixedRound.enemies.flatMap((fixedEnemy) => {
        const enemy = this.battle.enemies.find((candidate) => candidate.id === fixedEnemy.enemyId);
        return enemy?.invited === undefined ? fixedEnemy.compareWithoutInviteDialogueKeys ?? [] : [];
      }),
    ];
    if (dialogueKeys.length === 0) {
      return false;
    }

    this.shownRevealDialogueRoundIds.add(fixedRound.id);
    this.showBlockingMessage(
      enemyName('bartender'),
      dialogueKeys.map((key) => t(key).replace(/^酒保：/, '').replace(/^Bartender: /, '')).join('\n'),
      t('battle.modal.continue'),
      onClose,
    );
    return true;
  }

  private dialogueMessageFromKey(key: string): { title: string; body: string } {
    const raw = t(key);
    const goblinPrefixes = ['哥布林：', 'Goblin: '];
    const gamblerPrefixes = ['赌徒：', 'Gambler: '];
    const werewolfPrefixes = ['狼人：', 'Werewolf: '];
    const paladinPrefixes = ['圣骑士：', 'Paladin: '];
    const merchantPrefixes = ['商人：', 'Merchant: '];
    const keeperPrefixes = ['酒馆老板：', 'Tavern Owner: '];
    const bartenderPrefixes = ['酒保：', 'Bartender: '];
    const goblinPrefix = goblinPrefixes.find((prefix) => raw.startsWith(prefix));
    if (goblinPrefix) {
      return { title: enemyName('goblin'), body: raw.slice(goblinPrefix.length) };
    }

    const gamblerPrefix = gamblerPrefixes.find((prefix) => raw.startsWith(prefix));
    if (gamblerPrefix) {
      return { title: enemyName('gambler'), body: raw.slice(gamblerPrefix.length) };
    }

    const werewolfPrefix = werewolfPrefixes.find((prefix) => raw.startsWith(prefix));
    if (werewolfPrefix) {
      return { title: enemyName('werewolf'), body: raw.slice(werewolfPrefix.length) };
    }

    const paladinPrefix = paladinPrefixes.find((prefix) => raw.startsWith(prefix));
    if (paladinPrefix) {
      return { title: enemyName('paladin'), body: raw.slice(paladinPrefix.length) };
    }

    const merchantPrefix = merchantPrefixes.find((prefix) => raw.startsWith(prefix));
    if (merchantPrefix) {
      return { title: enemyName('merchant'), body: raw.slice(merchantPrefix.length) };
    }

    const keeperPrefix = keeperPrefixes.find((prefix) => raw.startsWith(prefix));
    if (keeperPrefix) {
      return { title: enemyName('keeper'), body: raw.slice(keeperPrefix.length) };
    }

    const bartenderPrefix = bartenderPrefixes.find((prefix) => raw.startsWith(prefix));
    if (bartenderPrefix) {
      return { title: enemyName('bartender'), body: raw.slice(bartenderPrefix.length) };
    }

    return { title: t('battle.modal.tutorialTitle'), body: raw };
  }

  private storyResultText(isVictory: boolean): string {
    const levelId = this.battle.levelConfig?.id;
    const keys = this.resultSummaryKeys(levelId, isVictory);
    return keys.map((key) => t(key)).join('\n');
  }

  private resultSummaryKeys(levelId: string | undefined, isVictory: boolean): string[] {
    if (levelId === 'chapter1_1') {
      return isVictory ? [
        'tutorial.chapter1.unlockInvite',
        'tutorial.chapter1.unlockHiddenCards',
      ] : [
        'tutorial.chapter1.defeat1',
        'tutorial.chapter1.defeat2',
      ];
    }

    if (levelId === 'chapter1_2') {
      return isVictory ? [
        'tutorial.chapter1_2.unlockAggressiveEnemy',
        'tutorial.chapter1_2.nextGuestGambler',
      ] : [
        'tutorial.chapter1_2.defeatHint1',
        'tutorial.chapter1_2.defeatHint2',
      ];
    }

    if (levelId === 'chapter1_3') {
      return isVictory ? [
        'tutorial.chapter1_3.unlockResonance',
        'tutorial.chapter1_3.nextGuestWerewolf',
      ] : [
        'tutorial.chapter1_3.defeatHint1',
        'tutorial.chapter1_3.defeatHint2',
        'tutorial.chapter1_3.defeatHint3',
      ];
    }

    if (levelId === 'chapter1_4') {
      return isVictory ? [
        'tutorial.chapter1_4.unlockSkills',
        'tutorial.chapter1_4.nextGuestPaladin',
      ] : [
        'tutorial.chapter1_4.defeatHint1',
        'tutorial.chapter1_4.defeatHint2',
        'tutorial.chapter1_4.defeatHint3',
      ];
    }

    if (levelId === 'chapter1_6') {
      return isVictory ? [
        'tutorial.chapter1_6.unlockItems',
        'tutorial.chapter1_6.nextGuestMerchant',
      ] : [
        'tutorial.chapter1_6.defeatHint1',
        'tutorial.chapter1_6.defeatHint2',
        'tutorial.chapter1_6.defeatHint3',
      ];
    }

    if (levelId === 'chapter1_7') {
      return isVictory ? [
        'tutorial.chapter1_7.unlockFinalTrial',
        'tutorial.chapter1_7.nextGuestKeeper',
      ] : [
        'tutorial.chapter1_7.defeatHint1',
        'tutorial.chapter1_7.defeatHint2',
        'tutorial.chapter1_7.defeatHint3',
        'tutorial.chapter1_7.defeatHint4',
      ];
    }

    if (levelId === 'chapter1_8') {
      return isVictory ? [
        'tutorial.chapter1_8.chapterComplete',
        'tutorial.chapter1_8.unlockFreePlay',
      ] : [
        'tutorial.chapter1_8.defeatHint1',
        'tutorial.chapter1_8.defeatHint2',
        'tutorial.chapter1_8.defeatHint3',
        'tutorial.chapter1_8.defeatHint4',
      ];
    }

    if (levelId === 'chapter1_9') {
      return isVictory ? [
        'tutorial.chapter1_9.chapterComplete',
        'tutorial.chapter1_9.unlockStandardGame',
      ] : [
        'tutorial.chapter1_9.defeatHint1',
        'tutorial.chapter1_9.defeatHint2',
        'tutorial.chapter1_9.defeatHint3',
        'tutorial.chapter1_9.defeatHint4',
      ];
    }

    return [];
  }

  private showResultStoryIfNeeded(onComplete: () => void): boolean {
    if (this.shownResultStory || !this.battle.battleOutcome) {
      return false;
    }

    const keys = this.resultStoryKeys(this.battle.levelConfig?.id, this.battle.battleOutcome);
    if (keys.length === 0) {
      return false;
    }

    this.shownResultStory = true;
    this.showBlockingMessageSequence(keys.map((key) => this.dialogueMessageFromKey(key)), onComplete);
    return true;
  }

  private resultStoryKeys(levelId: string | undefined, outcome: 'victory' | 'defeat'): string[] {
    if (levelId === 'chapter1_1' && outcome === 'victory') {
      return [
        'tutorial.chapter1.victory1',
        'tutorial.chapter1.victory2',
        'tutorial.chapter1.victory3',
        'tutorial.chapter1.victory4',
      ];
    }

    if (levelId === 'chapter1_2') {
      return outcome === 'victory' ? [
        'tutorial.chapter1_2.victory1',
        'tutorial.chapter1_2.victory2',
        'tutorial.chapter1_2.victory3',
        'tutorial.chapter1_2.victory4',
      ] : [
        'tutorial.chapter1_2.defeat1',
        'tutorial.chapter1_2.defeat2',
        'tutorial.chapter1_2.defeat3',
        'tutorial.chapter1_2.defeat4',
        'tutorial.chapter1_2.defeat5',
      ];
    }

    if (levelId === 'chapter1_3') {
      return outcome === 'victory' ? [
        'tutorial.chapter1_3.victory1',
        'tutorial.chapter1_3.victory2',
        'tutorial.chapter1_3.victory3',
        'tutorial.chapter1_3.victory4',
        'tutorial.chapter1_3.victory5',
        'tutorial.chapter1_3.victory6',
        'tutorial.chapter1_3.victory7',
      ] : [
        'tutorial.chapter1_3.defeat1',
        'tutorial.chapter1_3.defeat2',
        'tutorial.chapter1_3.defeat3',
        'tutorial.chapter1_3.defeat4',
      ];
    }

    if (levelId === 'chapter1_4') {
      return outcome === 'victory' ? [
        'tutorial.chapter1_4.victory1',
        'tutorial.chapter1_4.victory2',
        'tutorial.chapter1_4.victory3',
        'tutorial.chapter1_4.victory4',
        'tutorial.chapter1_4.victory5',
        'tutorial.chapter1_4.victory6',
      ] : [
        'tutorial.chapter1_4.defeat1',
        'tutorial.chapter1_4.defeat2',
        'tutorial.chapter1_4.defeat3',
        'tutorial.chapter1_4.defeat4',
      ];
    }

    if (levelId === 'chapter1_6') {
      return outcome === 'victory' ? [
        'tutorial.chapter1_6.victory1',
        'tutorial.chapter1_6.victory2',
        'tutorial.chapter1_6.victory3',
        'tutorial.chapter1_6.victory4',
        'tutorial.chapter1_6.victory5',
      ] : [
        'tutorial.chapter1_6.defeat1',
        'tutorial.chapter1_6.defeat2',
        'tutorial.chapter1_6.defeat3',
        'tutorial.chapter1_6.defeat4',
      ];
    }

    if (levelId === 'chapter1_7') {
      return outcome === 'victory' ? [
        'tutorial.chapter1_7.victory1',
        'tutorial.chapter1_7.victory2',
        'tutorial.chapter1_7.victory3',
        'tutorial.chapter1_7.victory4',
        'tutorial.chapter1_7.victory5',
        'tutorial.chapter1_7.victory6',
      ] : [
        'tutorial.chapter1_7.defeat1',
        'tutorial.chapter1_7.defeat2',
        'tutorial.chapter1_7.defeat3',
        'tutorial.chapter1_7.defeat4',
      ];
    }

    if (levelId === 'chapter1_8') {
      return outcome === 'victory' ? [
        'tutorial.chapter1_8.victory1',
        'tutorial.chapter1_8.victory2',
        'tutorial.chapter1_8.victory3',
        'tutorial.chapter1_8.victory4',
        'tutorial.chapter1_8.victory5',
        'tutorial.chapter1_8.victory6',
        'tutorial.chapter1_8.victory7',
        'tutorial.chapter1_8.victory8',
      ] : [
        'tutorial.chapter1_8.defeat1',
        'tutorial.chapter1_8.defeat2',
        'tutorial.chapter1_8.defeat3',
        'tutorial.chapter1_8.defeat4',
        'tutorial.chapter1_8.defeat5',
      ];
    }

    if (levelId === 'chapter1_9') {
      return outcome === 'victory' ? [
        'tutorial.chapter1_9.victory1',
        'tutorial.chapter1_9.victory2',
        'tutorial.chapter1_9.victory3',
        'tutorial.chapter1_9.victory4',
        'tutorial.chapter1_9.victory5',
        'tutorial.chapter1_9.victory6',
        'tutorial.chapter1_9.victory7',
      ] : [
        'tutorial.chapter1_9.defeat1',
        'tutorial.chapter1_9.defeat2',
        'tutorial.chapter1_9.defeat3',
        'tutorial.chapter1_9.defeat4',
      ];
    }

    return [];
  }

  private renderItemFeedback(): void {
    if (!this.itemFeedback || this.battle.phase === 'battle-result') {
      return;
    }

    const container = this.add.container(640, 360).setDepth(90);
    this.ui.push(container);
    const stroke = this.itemFeedback.success ? 0x78d18a : 0xff4b5f;
    const titleColor = this.itemFeedback.success ? COLORS.green : COLORS.dangerText;

    container.add(this.add.rectangle(0, 0, 1280, 720, 0x050608, 0.62));
    container.add(this.add.rectangle(0, 0, 430, 260, COLORS.panel, 0.98).setStrokeStyle(2, stroke));
    const title = this.add.text(0, -76, this.itemFeedback.title, {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: titleColor,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    title.setShadow(0, 0, titleColor, 10, true, true);

    container.add([
      title,
      this.add.text(0, -8, this.itemFeedback.message, {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: COLORS.text,
        align: 'center',
        lineSpacing: 8,
        wordWrap: { width: 340, useAdvancedWrap: true },
      }).setOrigin(0.5),
      this.button(-90, 72, 180, 48, t('battle.itemFeedback.confirm'), () => {
        this.itemFeedback = undefined;
        this.render();
      }),
    ]);
  }

  private button(x: number, y: number, width: number, height: number, label: string, onClick: () => void, fill = COLORS.button, fontSize = '19px', sound: 'button' | 'card' | 'none' = 'button'): Phaser.GameObjects.Container {
    const button = this.add.container(x, y);
    const rect = this.add.rectangle(width / 2, height / 2, width, height, fill).setStrokeStyle(2, COLORS.line);
    const text = this.add.text(width / 2, height / 2, label, {
      fontFamily: 'Arial',
      fontSize,
      color: COLORS.text,
    }).setOrigin(0.5);

    rect.setInteractive({ useHandCursor: true });
    rect.on('pointerover', () => rect.setFillStyle(COLORS.buttonHover));
    rect.on('pointerout', () => rect.setFillStyle(fill));
    rect.on('pointerdown', () => {
      if (sound !== 'none') {
        this.playClickSound(sound);
      }
      onClick();
    });

    button.add([rect, text]);
    return button;
  }

  private playClickSound(sound: 'button' | 'card' = 'button'): void {
    this.sound.play(sound === 'card' ? 'cardPlace' : 'buttonClick', { volume: 0.42 });
  }

  private playRoundResonanceEchoOnce(): void {
    if (this.echoedResonanceRound === this.battle.round || !this.hasVisibleRoundResonance()) {
      return;
    }

    this.echoedResonanceRound = this.battle.round;
    this.sound.play('resonanceEcho', { volume: 0.48 });
  }

  private hasVisibleRoundResonance(): boolean {
    if (this.battle.phase !== 'choice' && this.battle.playerScore().resonance !== 'none') {
      return true;
    }

    return this.battle.results.some((result) => result.playerScore.resonance !== 'none' || result.enemyScore.resonance !== 'none');
  }

  private renderItemModal(): void {
    if (!this.itemModalOpen || this.battle.phase === 'battle-result') {
      return;
    }

    const itemCounts = this.battleItemCounts();
    const ownedItems = ITEMS.filter((item) => (itemCounts[item.id] ?? 0) > 0);
    const container = this.add.container(640, 360).setDepth(80);
    this.ui.push(container);
    container.add(this.add.rectangle(0, 0, 1280, 720, 0x050608, 0.62));
    container.add(this.add.rectangle(0, 0, 640, 520, COLORS.panel, 0.98).setStrokeStyle(2, COLORS.accent));
    container.add(this.add.text(0, -220, t('battle.itemButtonUsage', { used: this.battleItemUses, max: MAX_BATTLE_ITEM_USES }), {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5));
    const itemHint = this.remainingBattleItemUses() > 0
      ? t('battle.itemModal.phaseHint')
      : t('battle.itemModal.limitReached', { max: MAX_BATTLE_ITEM_USES });
    container.add(this.add.text(0, -182, itemHint, {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: this.remainingBattleItemUses() > 0 && (this.battle.phase === 'player-turn' || this.battle.phase === 'choice') ? COLORS.muted : COLORS.dangerText,
    }).setOrigin(0.5));

    if (ownedItems.length === 0) {
      container.add(this.add.text(0, -18, t('battle.itemModal.empty'), {
        fontFamily: 'Arial',
        fontSize: '22px',
        color: COLORS.muted,
        align: 'center',
        wordWrap: { width: 460, useAdvancedWrap: true },
      }).setOrigin(0.5));
    } else {
      ownedItems.forEach((item, index) => {
        container.add(this.itemModalRow(item, -260, -136 + index * 92));
      });
    }

    container.add(this.button(-90, 202, 180, 48, t('battle.itemModal.close'), () => {
      this.itemModalOpen = false;
      this.render();
    }));
  }

  private itemModalRow(item: ItemDefinition, x: number, y: number): Phaser.GameObjects.Container {
    const count = this.battleItemCounts()[item.id] ?? 0;
    const canUse = this.canUseItemNow(item);
    const row = this.add.container(x, y);
    row.add(this.add.rectangle(260, 34, 544, 78, 0x20232a, 0.96).setStrokeStyle(1, canUse ? COLORS.accent : COLORS.line));
    row.add(this.add.text(24, 14, item.icon, {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: canUse ? COLORS.accentText : COLORS.muted,
      fontStyle: 'bold',
    }).setOrigin(0.5));
    row.add(this.add.text(58, 8, `${t(item.nameKey)} x${count}`, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: COLORS.text,
      fontStyle: 'bold',
    }));
    row.add(this.add.text(58, 34, t(item.descriptionKey), {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: COLORS.muted,
      wordWrap: { width: 310, useAdvancedWrap: true },
    }));
    if (canUse) {
      row.add(this.button(414, 10, 112, 46, t('battle.itemModal.use'), () => this.useItemFromModal(item), COLORS.button, '18px'));
    } else {
      const unavailableHint = this.itemUseLimitReached(item)
        ? t('battle.itemModal.itemLimitReached', { max: item.maxUsesPerBattle ?? 0 })
        : this.remainingBattleItemUses() <= 0
        ? t('battle.itemModal.limitReached', { max: MAX_BATTLE_ITEM_USES })
        : t(this.itemTimingHintKey(item));
      row.add(this.add.text(414, 33, unavailableHint, {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: COLORS.muted,
        align: 'center',
        wordWrap: { width: 112, useAdvancedWrap: true },
      }).setOrigin(0.5));
    }
    return row;
  }

  private itemTimingHintKey(item: ItemDefinition): string {
    if (item.id === 'heal_potion' || item.id === 'resonance_dust') {
      return 'battle.itemModal.timingUnknownHand';
    }

    return 'battle.itemModal.timingPlayerTurn';
  }

  private useItemFromModal(item: ItemDefinition): void {
    if (this.itemUseLimitReached(item)) {
      this.showSkillTooltip(640, 592, t(item.nameKey), t('battle.itemModal.itemLimitReached', { max: item.maxUsesPerBattle ?? 0 }));
      return;
    }

    if (this.remainingBattleItemUses() <= 0) {
      this.showSkillTooltip(640, 592, t('battle.itemModal.title'), t('battle.itemModal.limitReached', { max: MAX_BATTLE_ITEM_USES }));
      return;
    }

    const hpBefore = this.hpSnapshot();
    const result = useBattleItem(item.id, this.battle);
    if (result.used) {
      this.setPlayerPortraitPose('cast', 1050);
      this.consumeBattleItem(item.id);
      this.battleItemUses += 1;
      this.battleItemUseCounts[item.id] = (this.battleItemUseCounts[item.id] ?? 0) + 1;
      this.itemFeedback = result.feedback;
    }

    if (result.used && result.revealAfterFeedback) {
      this.playBeerHealThenReveal(result.healed ?? Math.max(0, this.battle.player.hp - hpBefore.player), hpBefore);
      return;
    }

    if (result.used && item.id === 'cooling_charm') {
      const events: BattlePresentationEvent[] = this.battle.player.hand.map((card, cardIndex) => ({
        type: 'card-dealt',
        target: 'player',
        card,
        cardIndex,
        context: 'action',
      }));
      this.playPlayerRedealPresentation(events);
      return;
    }

    if (result.used) {
      this.playRoundResonanceEchoOnce();
    }

    this.playHealSoundIfHpIncreased(hpBefore);
    this.itemModalOpen = false;
    const events = this.battle.consumePresentationEvents();
    this.presentationSequencePlaying = true;
    this.playImmediatePresentationEvents(events);
    const shouldDelayResultModal = this.shouldDelayOutcomeForPresentation(events);
    this.resultModalReady = !shouldDelayResultModal;
    if (!this.hasCombatEvents(events)) {
      this.render();
    }
    this.playPostActionAnimations(events, hpBefore, this.currentRevealEnemyIds(), false, () => {
      if (this.hasPendingSoulRedeem()) {
        this.presentationSequencePlaying = false;
        this.playPendingSoulRedeemBannerThen(() => this.resolvePendingSoulRedeem());
        return;
      }

      if (!shouldDelayResultModal) {
        this.presentationSequencePlaying = false;
        this.render();
        return;
      }

      const showResult = () => {
        this.resultModalReady = true;
        this.presentationSequencePlaying = false;
        this.render();
      };

      if (this.showResultStoryIfNeeded(showResult)) {
        return;
      }

      showResult();
    });
    if (result.used && result.shieldCharges) {
      this.playHolyShieldActivation(result.shieldCharges);
    }
    if (!result.used) {
      this.showSkillTooltip(640, 592, t(item.nameKey), result.message);
    }
  }

  private playBeerHealThenReveal(healed: number, hpBefore: { player: number; enemies: number[] }): void {
    this.itemModalOpen = false;
    this.itemFeedback = undefined;
    this.presentationSequencePlaying = true;
    this.actionAnimationPlaying = true;
    this.visualHpOverride = hpBefore;
    this.render();

    this.playFateBeerDrinkEffect(() => {
      this.visualHpOverride = undefined;
      this.render();
      this.playFateBeerHealEffect(healed);

      this.time.delayedCall(880, () => {
      this.battle.execute({ type: 'reveal-by-item' });
      this.playRoundResonanceEchoOnce();
      const events = this.battle.consumePresentationEvents();
      this.playImmediatePresentationEvents(events);
      const shouldDelayResultModal = this.shouldDelayOutcomeForPresentation(events);
      this.resultModalReady = !shouldDelayResultModal;
      this.render();

      this.time.delayedCall(620, () => this.playPostActionAnimations(events, hpBefore, this.currentRevealEnemyIds(), true, () => {
        if (this.hasPendingSoulRedeem()) {
          this.actionAnimationPlaying = false;
          this.presentationSequencePlaying = false;
          this.playPendingSoulRedeemBannerThen(() => this.resolvePendingSoulRedeem());
          return;
        }

        if (!shouldDelayResultModal) {
          this.actionAnimationPlaying = false;
          this.presentationSequencePlaying = false;
          this.render();
          return;
        }

        const showResult = () => {
          this.resultModalReady = true;
          this.actionAnimationPlaying = false;
          this.presentationSequencePlaying = false;
          this.render();
        };

        if (this.showResultStoryIfNeeded(showResult)) {
          return;
        }

        showResult();
      }));
      });
    });
  }

  private playFateBeerDrinkEffect(onComplete: () => void): void {
    const startX = this.battleLayout.seats.player.x + 172;
    const startY = this.battleLayout.seats.player.y - 16;
    const drinkX = this.battleLayout.seats.player.x + 74;
    const drinkY = this.battleLayout.seats.player.y - 62;
    const beer = this.add.container(startX, startY).setDepth(62).setAlpha(0).setScale(0.72).setRotation(-0.32);
    const handle = this.add.circle(23, 5, 0xe8b24a, 0.2).setStrokeStyle(4, 0xf7d36a, 0.95);
    const handleCutout = this.add.circle(23, 5, 7, COLORS.panel, 1);
    const glass = this.add.rectangle(0, 5, 42, 50, 0xd58a2e, 0.94).setStrokeStyle(3, 0xffdd7a, 1);
    const beerFill = this.add.rectangle(0, 12, 34, 31, 0xb95b20, 0.9);
    const foam = this.add.container(0, -21);
    [-13, -5, 4, 12].forEach((x, index) => foam.add(this.add.circle(x, index % 2 === 0 ? 0 : -3, 8, 0xfff4c9, 0.96)));
    beer.add([handle, handleCutout, glass, beerFill, foam]);

    this.sound.play('beerBubble', { volume: 0.58 });
    this.tweens.add({
      targets: beer,
      x: drinkX,
      y: drinkY,
      alpha: 1,
      scale: 0.96,
      rotation: -0.06,
      duration: 340,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.playBeerBubbles(drinkX + 2, drinkY - 22);
        this.tweens.add({
          targets: beer,
          y: drinkY - 12,
          rotation: 0.48,
          scale: 0.82,
          duration: 300,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            this.tweens.add({
              targets: beer,
              alpha: 0,
              x: drinkX + 18,
              y: drinkY - 30,
              duration: 180,
              ease: 'Quad.easeOut',
              onComplete: () => {
                beer.destroy(true);
                onComplete();
              },
            });
          },
        });
      },
    });
  }

  private playFateBeerHealEffect(amount: number): void {
    const x = this.battleLayout.seats.player.x;
    const y = this.battleLayout.seats.player.y;
    const glow = this.add.circle(x, y, 58, 0x78d18a, 0.2).setStrokeStyle(4, 0x9dffae, 0.9).setDepth(58);
    const innerGlow = this.add.circle(x, y, 26, 0xb9ffc2, 0.32).setDepth(59);
    const halo = this.add.circle(x, y, 18, 0x78d18a, 0.1).setStrokeStyle(3, 0xd0ffd4, 0.95).setDepth(60);

    this.sound.play('healSound', { volume: 0.56 });
    this.playHealGainText(x, y - 86, amount, 64);
    this.playBeerBubbles(x, y - 20, 0x9dffae);
    this.tweens.add({
      targets: glow,
      scale: 2.25,
      alpha: 0,
      duration: 720,
      ease: 'Cubic.easeOut',
      onComplete: () => glow.destroy(),
    });
    this.tweens.add({
      targets: innerGlow,
      scale: 2.8,
      alpha: 0,
      duration: 620,
      ease: 'Quad.easeOut',
      onComplete: () => innerGlow.destroy(),
    });
    this.tweens.add({
      targets: halo,
      scale: 4,
      alpha: 0,
      duration: 820,
      ease: 'Sine.easeOut',
      onComplete: () => halo.destroy(),
    });
  }

  private playBeerBubbles(x: number, y: number, color = 0xfff4c9): void {
    [-18, -7, 6, 18].forEach((offset, index) => {
      const bubble = this.add.circle(x + offset, y + (index % 2) * 7, 4 + (index % 2), color, 0.82).setDepth(63);
      this.tweens.add({
        targets: bubble,
        y: bubble.y - 32 - index * 5,
        x: bubble.x + (index - 1.5) * 8,
        alpha: 0,
        scale: 1.8,
        duration: 440 + index * 70,
        ease: 'Sine.easeOut',
        onComplete: () => bubble.destroy(),
      });
    });
  }

  private holyShieldAura(charges: number): Phaser.GameObjects.Container {
    const shield = this.add.container(0, 0);
    const outer = this.add.circle(0, 0, 104, 0x4f9dff, 0.06).setStrokeStyle(3, 0x72c7ff, 0.74);
    const inner = this.add.circle(0, 0, 82, 0x93dcff, 0.035).setStrokeStyle(1, 0xb9eeff, 0.5);
    const label = this.add.text(0, -70, t('battle.holyShield.status', { charges }), {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#9fe7ff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    label.setShadow(0, 0, '#62c4ff', 10, true, true);
    shield.add([outer, inner, label]);
    this.tweens.add({
      targets: [outer, inner],
      alpha: { from: 0.34, to: 0.82 },
      scale: { from: 0.96, to: 1.05 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    return shield;
  }

  private playHolyShieldActivation(charges: number): void {
    const x = this.battleLayout.seats.player.x;
    const y = this.battleLayout.seats.player.y;
    const halo = this.add.circle(x, y, 44, 0x62c4ff, 0.18).setStrokeStyle(4, 0xbcefff, 0.92).setDepth(62);
    const ring = this.add.circle(x, y, 22, 0x4f9dff, 0.14).setStrokeStyle(3, 0x72c7ff, 0.92).setDepth(63);
    const label = this.add.text(x, y - 126, t('battle.holyShield.status', { charges }), {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#bcefff',
      fontStyle: 'bold',
      stroke: '#173c74',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(64);
    label.setShadow(0, 0, '#62c4ff', 14, true, true);
    this.sound.play('resonanceEcho', { volume: 0.42 });
    this.tweens.add({
      targets: [halo, ring],
      scale: 3.3,
      alpha: 0,
      duration: 680,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        halo.destroy();
        ring.destroy();
      },
    });
    this.tweens.add({
      targets: label,
      y: label.y - 24,
      alpha: 0,
      duration: 820,
      delay: 220,
      ease: 'Sine.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  private playHolyShieldBlock(blockedDamage: number): void {
    const x = this.battleLayout.seats.player.x;
    const y = this.battleLayout.seats.player.y;
    const dome = this.add.circle(x, y, 42, 0x4f9dff, 0.2).setStrokeStyle(5, 0xbcefff, 0.96).setDepth(62);
    const inner = this.add.circle(x, y, 20, 0xa7e7ff, 0.28).setDepth(63);
    const label = this.add.text(x, y - 118, t('battle.holyShield.blocked'), {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: '#c9f4ff',
      fontStyle: 'bold',
      stroke: '#173c74',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(64);
    const damage = this.add.text(x, y - 86, `-${blockedDamage}`, {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#9fe7ff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(64);
    this.sound.play('resonanceEcho', { volume: 0.34 });
    this.tweens.add({
      targets: [dome, inner],
      scale: 3.2,
      alpha: 0,
      duration: 620,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        dome.destroy();
        inner.destroy();
      },
    });
    this.tweens.add({
      targets: [label, damage],
      y: '-=24',
      alpha: 0,
      duration: 700,
      delay: 160,
      ease: 'Sine.easeOut',
      onComplete: () => {
        label.destroy();
        damage.destroy();
      },
    });
  }

  private canUseItemNow(item: ItemDefinition): boolean {
    return !this.itemUseLimitReached(item)
      && this.remainingBattleItemUses() > 0
      && canUseBattleItemFromState(item.id, this.battle.getState());
  }

  private itemUseLimitReached(item: ItemDefinition): boolean {
    return item.maxUsesPerBattle !== undefined
      && (this.battleItemUseCounts[item.id] ?? 0) >= item.maxUsesPerBattle;
  }

  private playerStatusStates(): StatusIconState[] {
    const statuses: StatusIconState[] = [];
    if (this.battle.player.shieldCharges > 0) {
      statuses.push({
        id: 'holy-shield',
        icon: '◇',
        color: 0x68c9ff,
        textColor: '#bfeeff',
        title: t('item.holyShield.name'),
        description: t('item.holyShield.desc'),
        label: t('battle.status.holyShieldTag', { amount: this.battle.player.shieldCharges }),
        badge: `${this.battle.player.shieldCharges}`,
      });
    }

    if (this.battle.player.incomingDamageBonus > 0) {
      statuses.push({
        id: 'incoming-damage',
        icon: '!',
        color: 0xe35661,
        textColor: '#ffb0b7',
        title: t('battle.status.incomingDamage'),
        description: t('battle.phase.playerRiskActive'),
        label: t('battle.status.incomingDamageTag', { amount: this.battle.player.incomingDamageBonus }),
        badge: `+${this.battle.player.incomingDamageBonus}`,
      });
    }

    return statuses;
  }

  private playerPassiveIcon(): Phaser.GameObjects.Container {
    const active = !this.battle.player.soulRedeemUsed;
    const seat = this.battleLayout.seats.player;
    const hud = this.battleLayout.playerHud;
    return new AbilitySlot(this, {
      icon: '✚',
      color: 0xffd86b,
      textColor: COLORS.resonance,
      enabled: active,
      badge: active ? undefined : '×',
      onShowTooltip: () => this.showSkillTooltip(
        seat.x + hud.portrait.x - hud.orbitRadiusX - 110,
        seat.y + hud.portrait.y - hud.orbitRadiusY - 90,
        t('skill.soulRedeem.name'),
        t('skill.soulRedeem.tooltip'),
      ),
      onHideTooltip: () => this.hideSkillTooltip(),
    }).container;
  }

  private enemyPassiveIcon(
    enemy: EnemyState,
    index: number,
    layout: BattleLayoutConfig['enemyHud']['left'],
  ): Phaser.GameObjects.Container {
    const passive = this.enemyPassiveInfo(enemy);
    const active = this.enemyPassiveActive(enemy);
    const worldSeat = this.enemySeatForIndex(index);
    const left = layout.passivePosition.endsWith('left');
    const top = layout.passivePosition.startsWith('top');
    const slotX = layout.portrait.x + (left ? -layout.orbitRadiusX : layout.orbitRadiusX);
    const slotY = layout.portrait.y + (top ? -layout.orbitRadiusY : layout.orbitRadiusY);
    return new AbilitySlot(this, {
      icon: passive.icon,
      color: passive.color,
      textColor: passive.textColor,
      enabled: active,
      onShowTooltip: () => this.showSkillTooltip(
        worldSeat.x + slotX + (left ? -118 : 118),
        worldSeat.y + slotY + (top ? -74 : 74),
        passive.name,
        passive.description,
      ),
      onHideTooltip: () => this.hideSkillTooltip(),
    }).container;
  }

  private enemyHasPassiveInfo(enemy: EnemyState): boolean {
    return enemy.id === 'goblin'
      || enemy.id === 'gambler'
      || enemy.id === 'werewolf'
      || enemy.id === 'keeper'
      || enemy.id === 'viking_warrior'
      || enemy.id === 'rune_shaman'
      || enemy.id === 'valkyrie'
      || enemy.id === 'swordsman'
      || enemy.id === 'songstress'
      || enemy.id === 'taoist'
      || enemy.id === 'shogun_samurai'
      || enemy.id === 'ninja'
      || enemy.id === 'oiran';
  }

  private enemyPassiveInfo(enemy: EnemyState): { name: string; icon: string; description: string; color: number; textColor: string } {
    if (enemy.id === 'goblin') {
      return {
        name: t('skill.goblinInstinct.name'),
        icon: '!',
        description: t('skill.goblinInstinct.tooltip', { threshold: this.battle.enemyPassiveHpThreshold(enemy.id) }),
        color: 0x65d46e,
        textColor: '#78d18a',
      };
    }

    if (enemy.id === 'gambler') {
      return {
        name: t('skill.gamblerBlessing.name'),
        icon: '♢',
        description: t('skill.gamblerBlessing.tooltip', { threshold: this.battle.enemyPassiveHpThreshold(enemy.id) }),
        color: 0xf25f9a,
        textColor: '#f25f9a',
      };
    }

    if (enemy.id === 'keeper') {
      return {
        name: t('skill.soulRedeem.name'),
        icon: '✦',
        description: t('skill.keeperSoulRedeem.tooltip'),
        color: 0xe8cf73,
        textColor: '#ffd86b',
      };
    }

    if (enemy.id === 'viking_warrior') {
      return {
        name: t('skill.warHorn.name'),
        icon: 'H',
        description: t('skill.warHorn.tooltip', { threshold: this.battle.enemyPassiveHpThreshold(enemy.id) }),
        color: 0xff8a3d,
        textColor: '#ffad6b',
      };
    }

    if (enemy.id === 'rune_shaman') {
      return {
        name: t('skill.runeBlessing.name'),
        icon: 'R',
        description: t('skill.runeBlessing.tooltip', { threshold: this.battle.enemyPassiveHpThreshold(enemy.id) }),
        color: 0x79c9ff,
        textColor: '#9ed8ff',
      };
    }

    if (enemy.id === 'valkyrie') {
      return {
        name: t('skill.einherjarSummon.name'),
        icon: 'V',
        description: t('skill.einherjarSummon.tooltip', { threshold: this.battle.enemyPassiveHpThreshold(enemy.id) }),
        color: 0xf7d889,
        textColor: '#ffe39a',
      };
    }

    if (enemy.id === 'swordsman') {
      return {
        name: t('skill.chivalry.name'),
        icon: '侠',
        description: t('skill.chivalry.tooltip'),
        color: 0xf05f42,
        textColor: '#ff9a72',
      };
    }

    if (enemy.id === 'songstress') {
      return {
        name: t('skill.redSilkToast.name'),
        icon: '绸',
        description: t('skill.redSilkToast.tooltip', { threshold: this.battle.enemyPassiveHpThreshold(enemy.id) }),
        color: 0xf29bc2,
        textColor: '#ffb8d6',
      };
    }

    if (enemy.id === 'taoist') {
      return {
        name: t('skill.heavenlyInsight.name'),
        icon: '道',
        description: t('skill.heavenlyInsight.tooltip'),
        color: 0x72d8b3,
        textColor: '#92f0cc',
      };
    }

    if (enemy.id === 'shogun_samurai') {
      return {
        name: t('skill.iaijutsuCharge.name'),
        icon: '刀',
        description: t('skill.iaijutsuCharge.tooltip'),
        color: 0xe15f58,
        textColor: '#ffd19d',
      };
    }

    if (enemy.id === 'ninja') {
      return {
        name: t('skill.smokeSubstitution.name'),
        icon: '影',
        description: t('skill.smokeSubstitution.tooltip', { threshold: this.battle.enemyPassiveHpThreshold(enemy.id) }),
        color: 0x8e78bb,
        textColor: '#d8cbff',
      };
    }

    if (enemy.id === 'oiran') {
      return {
        name: t('skill.hanamiDance.name'),
        icon: '扇',
        description: t('skill.hanamiDance.tooltip'),
        color: 0xf09ab5,
        textColor: '#ffd2e3',
      };
    }

    return {
      name: t('skill.werewolfLifesteal.name'),
      icon: 'V',
      description: t('skill.werewolfLifesteal.tooltip', { threshold: this.battle.enemyPassiveHpThreshold(enemy.id) }),
      color: 0x73c7ff,
      textColor: '#73c7ff',
    };
  }

  private enemyPassiveActive(enemy: EnemyState): boolean {
    if (enemy.id === 'goblin') {
      return enemy.hp < this.battle.enemyPassiveHpThreshold(enemy.id) && !enemy.defeated;
    }

    if (enemy.id === 'gambler') {
      return enemy.hp < this.battle.enemyPassiveHpThreshold(enemy.id) && !enemy.defeated;
    }

    if (enemy.id === 'keeper') {
      return !enemy.soulRedeemUsed && !enemy.defeated;
    }

    if (enemy.id === 'viking_warrior') {
      return enemy.hp < this.battle.enemyPassiveHpThreshold(enemy.id) && !enemy.passiveTriggered && !enemy.defeated;
    }

    if (enemy.id === 'rune_shaman') {
      return enemy.hp < this.battle.enemyPassiveHpThreshold(enemy.id) && !enemy.defeated;
    }

    if (enemy.id === 'valkyrie') {
      return enemy.hp < this.battle.enemyPassiveHpThreshold(enemy.id) && enemy.summonCount < 2 && !enemy.defeated;
    }

    if (enemy.id === 'swordsman') {
      return this.battle.enemies.some((item) => item !== enemy && !item.defeated && item.hp <= 2)
        && !enemy.passiveTriggeredThisRound
        && !enemy.defeated;
    }

    if (enemy.id === 'songstress') {
      return this.battle.enemies.some((item) => (
        item !== enemy
        && !item.defeated
        && item.hp < this.battle.enemyPassiveHpThreshold(enemy.id)
      ))
        && !enemy.passiveTriggeredThisRound
        && !enemy.defeated;
    }

    if (enemy.id === 'taoist') {
      return !enemy.passiveTriggeredThisRound && !enemy.defeated;
    }

    if (enemy.id === 'shogun_samurai') {
      return !enemy.defeated;
    }

    if (enemy.id === 'ninja') {
      return !enemy.smokeScreenUsed && !enemy.defeated;
    }

    if (enemy.id === 'oiran') {
      return this.battle.enemies.some((candidate) => candidate !== enemy && !candidate.defeated);
    }

    return enemy.hp < this.battle.enemyPassiveHpThreshold(enemy.id) && !enemy.defeated;
  }

  private showSkillTooltip(x: number, y: number, title: string, body: string): void {
    this.hideSkillTooltip();
    const width = 320;
    const bodyText = this.add.text(-width / 2 + 16, -18, body, {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: COLORS.text,
      lineSpacing: 4,
      wordWrap: { width: width - 32, useAdvancedWrap: true },
    });
    const height = Math.max(104, bodyText.height + 58);
    const safeX = Phaser.Math.Clamp(x, width / 2 + 12, 1280 - width / 2 - 12);
    const safeY = Phaser.Math.Clamp(y, height / 2 + 12, 720 - height / 2 - 12);
    const tooltip = this.add.container(safeX, safeY).setDepth(50).setName('skill-tooltip');
    tooltip.add(this.add.rectangle(0, 0, width, height, 0x101114, 0.96).setStrokeStyle(2, 0xffd86b));
    tooltip.add(this.add.text(-width / 2 + 16, -height / 2 + 14, title, {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: COLORS.resonance,
      fontStyle: 'bold',
    }));
    bodyText.setY(-height / 2 + 42);
    tooltip.add(bodyText);
  }

  private hideSkillTooltip(): void {
    this.children.getByName('skill-tooltip')?.destroy();
  }

  private renderScoreBadge(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    score: ScoreResult,
    compact = false,
    showResonance = false,
  ): void {
    container.add(createScoreBadge(this, {
      x,
      y,
      point: score.point,
      label: t('common.pointUnit'),
      variant: compact ? 'compact' : 'orb',
      resonance: showResonance ? score.resonance : 'none',
      multiplier: score.multiplier,
      resonanceLabel: showResonance && score.resonance !== 'none' ? this.resonanceText(score) : undefined,
    }));
  }

  private resonanceText(score: ScoreResult): string {
    if (score.resonance === 'strong') {
      return t('score.strongResonance', { multiplier: score.multiplier });
    }

    if (score.resonance === 'resonance') {
      return t('score.resonance', { multiplier: score.multiplier });
    }

    return t('score.noResonance');
  }

  private renderEnemyCardRow(
    container: Phaser.GameObjects.Container,
    enemy: EnemyState,
    enemyIndex: number,
    x: number,
    y: number,
  ): HandView<{ card: Card; faceUp: boolean }> | undefined {
    if (this.enemyDisplayDefeated(enemyIndex) && enemy.hand.length === 0) {
      container.add(this.add.text(x, y, t('battle.notParticipating'), {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: COLORS.muted,
      }).setOrigin(0.5));
      return undefined;
    }

    const visibleCards = this.dealing || this.actionDealing
      ? enemy.hand.slice(0, Math.min(this.dealtEnemyCards[enemyIndex] ?? 0, enemy.hand.length))
      : enemy.hand;
    const pendingReveal = this.revealFocusPlaying && this.revealFocusPendingEnemyIds.has(enemy.id);
    const showAll = !pendingReveal
      && (enemy.revealed || (this.battle.roundRevealed && this.battle.results.some((result) => result.enemy === enemy)));
    const cards = visibleCards.map((card, index) => ({
      card,
      faceUp: showAll || index === 0,
    }));

    const width = this.battleLayout.cards.enemyWidth;
    const resonant = this.enemyHasResonance(enemy);
    const muted = this.enemyDisplayDefeated(enemyIndex);
    const hand = new HandView(this, {
      x,
      y,
      items: cards,
      slotCount: enemy.hand.length,
      itemWidth: width,
      spacing: this.battleLayout.cards.enemySpacing,
      fan: true,
      createItem: ({ card, faceUp }, _index, cardX, cardY, angle) => createCardView(this, {
        x: cardX,
        y: cardY,
        card: faceUp ? card : undefined,
        hidden: !faceUp,
        width,
        resonant,
        muted,
      }).setAngle(angle),
    });
    container.add(hand.container);
    if (resonant && showAll && !muted) {
      this.playResonanceHandShakeOnce(
        `enemy:${enemy.id}:${this.battle.round}:${enemy.hand.map(formatCard).join('|')}`,
        hand.container,
        this.scoreEnemy(enemy).resonance === 'strong',
      );
    }
    return hand;
  }

  private showEnemySpeech(enemyId: string, text: string): void {
    this.enemySpeech = { enemyId, text };
    this.time.delayedCall(1000, () => {
      if (this.enemySpeech?.enemyId !== enemyId || this.enemySpeech.text !== text) {
        return;
      }

      this.enemySpeech = undefined;
      this.render();
    });
  }

  private renderEnemySpeech(container: Phaser.GameObjects.Container, enemy: EnemyState, anchor: { x: number; y: number }): void {
    if (this.enemySpeech?.enemyId !== enemy.id) {
      return;
    }

    const { x, y } = anchor;
    const text = this.add.text(x, y, this.enemySpeech.text, {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#101114',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    const bubbleWidth = Math.max(76, text.width + 26);
    const bubble = this.add.container(0, 0);
    bubble.add(this.add.rectangle(x + bubbleWidth / 2, y, bubbleWidth, 34, 0xf7f3e8, 0.98).setStrokeStyle(2, 0x101114, 0.85));
    bubble.add(this.add.triangle(x + 4, y + 10, 0, 0, -10, 8, 0, 16, 0xf7f3e8, 0.98).setStrokeStyle(1, 0x101114, 0.75));
    bubble.add(text);
    container.add(bubble);
  }

  private renderPlayerCardRow(container: Phaser.GameObjects.Container, x: number, y: number): HandView<{ card: Card; faceUp: boolean }> {
    const visibleCards = this.dealing || this.playerRedealing || this.actionDealing
      ? this.battle.player.hand.slice(0, this.dealtPlayerCards)
      : this.battle.player.hand;
    const faceUp = this.playerRedealing || (!this.dealing && this.battle.phase !== 'choice' && (!this.battle.player.fateMode || this.battle.roundRevealed));
    const cards = visibleCards.map((card) => ({ card, faceUp }));
    const width = this.battleLayout.cards.width;
    const resonant = !this.playerRedealing && this.playerHasResonance();
    const hand = new HandView(this, {
      x,
      y,
      items: cards,
      slotCount: this.battle.player.hand.length,
      itemWidth: width,
      spacing: this.battleLayout.cards.spacing,
      fan: true,
      createItem: ({ card, faceUp }, _index, cardX, cardY, angle) => createCardView(this, {
        x: cardX,
        y: cardY,
        card: faceUp ? card : undefined,
        hidden: !faceUp,
        width,
        resonant,
      }).setAngle(angle),
    });
    container.add(hand.container);
    if (resonant && faceUp) {
      this.playResonanceHandShakeOnce(
        `player:${this.battle.round}:${this.battle.player.hand.map(formatCard).join('|')}`,
        hand.container,
        this.battle.playerScore().resonance === 'strong',
      );
    }
    return hand;
  }

  private playResonanceHandShakeOnce(
    key: string,
    hand: Phaser.GameObjects.Container,
    strong: boolean,
  ): void {
    if (this.resonanceShakeKeys.has(key) || !hand.active) {
      return;
    }

    this.resonanceShakeKeys.add(key);
    this.playResonanceHandShake(hand, strong);
  }

  private playResonanceHandShake(hand: Phaser.GameObjects.Container, strong: boolean): void {
    const originX = hand.x;
    const distance = strong ? 5 : 3;
    const angle = strong ? 2.4 : 1.6;
    hand.setX(originX - distance);
    hand.setAngle(-angle);
    this.tweens.add({
      targets: hand,
      x: originX + distance,
      angle,
      duration: strong ? 46 : 52,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (!hand.active) {
          return;
        }
        hand.setPosition(originX, hand.y);
        hand.setAngle(0);
      },
    });
  }

  private renderCardRow(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    cards: Array<{ card: Card; faceUp: boolean }>,
    options: { width: number; height: number; spacing: number; resonant: boolean; muted?: boolean },
  ): void {
    cards.forEach(({ card, faceUp }, index) => {
      const cardX = x + index * options.spacing;
      container.add(createCardView(this, {
        x: cardX + options.width / 2,
        y,
        card: faceUp ? card : undefined,
        hidden: !faceUp,
        width: options.width,
        resonant: options.resonant,
        muted: options.muted,
      }));
    });
  }

  private cardsText(x: number, y: number, label: string, resonant: boolean, muted = false, fontSize = '24px'): Phaser.GameObjects.Text {
    const text = this.add.text(x, y, label, {
      fontFamily: 'Arial',
      fontSize,
      color: muted ? COLORS.muted : COLORS.text,
      stroke: resonant ? COLORS.resonance : undefined,
      strokeThickness: resonant ? 3 : 0,
    });

    if (resonant) {
      text.setShadow(0, 0, COLORS.resonance, 12, true, true);
    }

    return text;
  }

  private resonanceLabel(x: number, y: number, score: ScoreResult, fontSize = '14px'): Phaser.GameObjects.Text {
    const resonant = score.resonance !== 'none';
    const text = this.add.text(x, y, this.resonanceText(score), {
      fontFamily: 'Arial',
      fontSize,
      color: resonant ? COLORS.resonance : COLORS.muted,
    });

    if (resonant) {
      text.setShadow(0, 0, COLORS.resonance, 12, true, true);
    }

    return text;
  }

  private enemyHasResonance(enemy: EnemyState): boolean {
    return this.shouldShowEnemyScore(enemy) && this.scoreEnemy(enemy).resonance !== 'none';
  }

  private playerHasResonance(): boolean {
    return this.battle.phase !== 'choice' && this.battle.playerScore().resonance !== 'none';
  }

  private hpSnapshot(): { player: number; enemies: number[] } {
    return {
      player: this.battle.player.hp,
      enemies: this.battle.enemies.map((enemy) => enemy.hp),
    };
  }

  private playerDisplayHp(): number {
    return this.visualHpOverride?.player ?? this.battle.player.hp;
  }

  private enemyDisplayHp(index: number): number {
    return this.visualHpOverride?.enemies[index] ?? this.battle.enemies[index].hp;
  }

  private enemyDisplayDefeated(index: number): boolean {
    return this.visualEnemyDefeated?.[index] ?? this.battle.enemies[index].defeated;
  }

  private playHealSoundIfHpIncreased(before: { player: number; enemies: number[] }): void {
    const playerHealed = this.battle.player.hp > before.player;
    const enemyHealed = this.battle.enemies.some((enemy, index) => enemy.hp > (before.enemies[index] ?? enemy.hp));
    if (!playerHealed && !enemyHealed) {
      return;
    }

    this.sound.play('healSound', { volume: 0.5 });
  }

  private playImmediatePresentationEvents(events: BattlePresentationEvent[]): void {
    if (events.some((event) => event.type === 'heal')) {
      this.sound.play('healSound', { volume: 0.5 });
    }

    events.forEach((event) => {
      if (event.type === 'enemy-speech') {
        this.showEnemySpeech(event.enemyId, event.text);
      }
    });
  }

  private passiveEffectEvents(events: BattlePresentationEvent[]): Extract<BattlePresentationEvent, { type: 'passive-effect' }>[] {
    return events.filter((event): event is Extract<BattlePresentationEvent, { type: 'passive-effect' }> => event.type === 'passive-effect');
  }

  private cardsRedealtEvents(events: BattlePresentationEvent[]): Extract<BattlePresentationEvent, { type: 'cards-redealt' }>[] {
    return events.filter((event): event is Extract<BattlePresentationEvent, { type: 'cards-redealt' }> => event.type === 'cards-redealt');
  }

  private cardReplacementEvents(events: BattlePresentationEvent[]): Extract<BattlePresentationEvent, { type: 'card-replaced' }>[] {
    return events.filter((event): event is Extract<BattlePresentationEvent, { type: 'card-replaced' }> => event.type === 'card-replaced');
  }

  private preCombatPresentationEvents(events: BattlePresentationEvent[]): BattlePresentationEvent[] {
    return events.filter((event) => (
      (event.type === 'passive-effect' && event.passiveId === 'gambler_blessing')
      || (event.type === 'passive-effect' && event.passiveId === 'heavenly_insight')
      || (event.type === 'passive-effect' && event.passiveId === 'iaijutsu_charge' && event.effect === 'release')
      || event.type === 'cards-redealt'
      || event.type === 'card-replaced'
    ));
  }

  private postCombatPresentationEvents(events: BattlePresentationEvent[]): BattlePresentationEvent[] {
    return events.filter((event) => !(
      (event.type === 'passive-effect' && event.passiveId === 'gambler_blessing')
      || (event.type === 'passive-effect' && event.passiveId === 'heavenly_insight')
      || (event.type === 'passive-effect' && event.passiveId === 'iaijutsu_charge' && event.effect === 'release')
      || (event.type === 'passive-effect' && event.timing === 'round-start')
      || event.type === 'cards-redealt'
      || event.type === 'card-replaced'
    ));
  }

  private runAction(action: () => void): void {
    const roundBefore = this.battle.round;
    const hpBefore = this.hpSnapshot();
    const phaseBefore = this.battle.phase;
    const currentEnemyIdBefore = phaseBefore === 'enemy-turn' ? this.battle.currentEnemy?.id : undefined;
    const revealedEnemyIdsBefore = new Set(
      this.battle.enemies.filter((enemy) => enemy.revealed).map((enemy) => enemy.id),
    );
    action();
    this.playRoundResonanceEchoOnce();
    const events = this.battle.consumePresentationEvents();
    this.presentationSequencePlaying = true;
    this.playImmediatePresentationEvents(events);
    const shouldDelayResultModal = this.shouldDelayOutcomeForPresentation(events);
    const shouldDealNewRound = this.battle.round > roundBefore && this.battle.phase === 'choice' && !this.battle.battleOutcome;
    this.resultModalReady = !shouldDelayResultModal;
    const directlyComparedEnemyId = phaseBefore === 'enemy-turn' ? currentEnemyIdBefore : undefined;
    const revealEnemyIds = new Set(
      this.hasRoundRevealEvent(events)
        ? this.battle.enemies
          .filter((enemy) => (
            enemy.hand.length > 0
            && this.battle.results.some((result) => result.enemy === enemy)
            && !revealedEnemyIdsBefore.has(enemy.id)
            && enemy.id !== directlyComparedEnemyId
          ))
          .map((enemy) => enemy.id)
        : [],
    );
    const skipRevealBanner = this.hasRoundRevealEvent(events) && revealEnemyIds.size === 0;

    this.playActionDealEvents(events, () => {
      const continueAfterActionDeals = () => {
        if (!this.hasCombatEvents(events)) {
          this.render();
        }

        this.playPostActionAnimations(events, hpBefore, revealEnemyIds, skipRevealBanner, () => {
          this.playPassiveEffectEvents(this.postCombatPresentationEvents(events), () => {
          if (this.hasPendingSoulRedeem()) {
            this.presentationSequencePlaying = false;
            this.playPendingSoulRedeemBannerThen(() => this.resolvePendingSoulRedeem());
            return;
          }

          const continueAfterRevealDialogue = () => {
            if (!shouldDelayResultModal) {
              this.presentationSequencePlaying = false;
              if (shouldDealNewRound) {
                this.startDealPresentation();
              } else if (this.showPlayerTurnLessonIfNeeded()) {
                return;
              } else {
                this.render();
              }
              return;
            }

            const showResult = () => {
              this.resultModalReady = true;
              this.presentationSequencePlaying = false;
              if (shouldDealNewRound) {
                this.startDealPresentation();
              } else if (this.showPlayerTurnLessonIfNeeded()) {
                return;
              } else {
                this.render();
              }
            };

            if (this.showResultStoryIfNeeded(showResult)) {
              return;
            }

            showResult();
          };

          const continueAfterDamageFeedback = () => {
            if (this.hasRoundRevealEvent(events) && this.showRevealDialogueIfNeeded(continueAfterRevealDialogue)) {
              return;
            }

            continueAfterRevealDialogue();
          };

          if (this.showChapter3DamageFeedbackIfNeeded(events, continueAfterDamageFeedback)) {
            return;
          }

          if (this.showChapter4ResonanceFeedbackIfNeeded(events, continueAfterDamageFeedback)) {
            return;
          }

          continueAfterDamageFeedback();
          });
        });
      };

      continueAfterActionDeals();
    });
  }

  private playPostActionAnimations(
    events: BattlePresentationEvent[],
    hpBefore: { player: number; enemies: number[] },
    revealEnemyIds: Set<string>,
    skipRevealBanner = false,
    onComplete?: () => void,
  ): void {
    const combatEvents = this.combatEvents(events);
    if (combatEvents.length === 0) {
      this.playPreCombatPresentationEvents(events, () => onComplete?.());
      return;
    }

    // Logic resolves synchronously, so preserve the pre-combat state throughout
    // reveal and passive presentation. Each impact advances this visual snapshot.
    this.visualHpOverride = {
      player: hpBefore.player,
      enemies: [...hpBefore.enemies],
    };
    this.visualEnemyDefeated = hpBefore.enemies.map((hp) => hp <= 0);

    const playWithDelayedHp = () => {
      this.actionAnimationPlaying = true;
      this.render();
      this.playDamageAnimations(combatEvents, () => {
        this.visualHpOverride = undefined;
        this.visualEnemyDefeated = undefined;
        this.actionAnimationPlaying = false;
        onComplete?.();
      });
    };
    const playPreCombatThenReveal = () => {
      this.playPreCombatPresentationEvents(events, () => {
        if (this.hasRoundRevealEvent(events) && revealEnemyIds.size > 0) {
          this.playRevealFocus(revealEnemyIds, playWithDelayedHp);
          return;
        }

        playWithDelayedHp();
      });
    };

    if (combatEvents.length > 0 && this.hasRoundRevealEvent(events) && !skipRevealBanner) {
      this.playRevealBannerThen(playPreCombatThenReveal);
      return;
    }

    playPreCombatThenReveal();
  }

  private playRevealFocus(revealEnemyIds: Set<string>, onComplete: () => void): void {
    this.actionAnimationPlaying = true;
    this.revealFocusPlaying = true;
    this.revealFocusPendingEnemyIds = new Set(revealEnemyIds);
    this.render();

    const shade = this.add.rectangle(
      this.battleLayout.canvas.width / 2,
      this.battleLayout.canvas.height / 2,
      this.battleLayout.canvas.width,
      this.battleLayout.canvas.height,
      0x020305,
      0.46,
    ).setDepth(29).setInteractive().setAlpha(0);
    const groups = this.createRevealFocusGroups(revealEnemyIds);

    this.tweens.add({
      targets: shade,
      alpha: 0.46,
      duration: 180,
      ease: 'Sine.easeOut',
      onComplete: () => this.playRevealFocusGroup(groups, 0, shade, onComplete),
    });
  }

  private createRevealFocusGroups(revealEnemyIds: Set<string>): Array<{
    container: Phaser.GameObjects.Container;
    cards: Phaser.GameObjects.Container[];
    score: Phaser.GameObjects.Container;
    resonant: boolean;
    flipCards: boolean;
    shakeKey: string;
    strong: boolean;
  }> {
    const groups: Array<{
      container: Phaser.GameObjects.Container;
      cards: Phaser.GameObjects.Container[];
      score: Phaser.GameObjects.Container;
      resonant: boolean;
      flipCards: boolean;
      shakeKey: string;
      strong: boolean;
    }> = [];

    this.battle.enemies.forEach((enemy, index) => {
      if (
        !revealEnemyIds.has(enemy.id)
        || enemy.hand.length === 0
        || !this.battle.results.some((result) => result.enemy === enemy)
      ) {
        return;
      }

      const seat = this.enemySeatForIndex(index);
      const hud = this.enemyHudLayout(index);
      groups.push(this.createRevealFocusGroup(
        seat.x + hud.hand.x,
        seat.y + hud.hand.y,
        enemy.hand,
        this.scoreEnemy(enemy),
        this.battleLayout.cards.enemyWidth,
        this.battleLayout.cards.enemySpacing,
        hud.scoreSide,
        hud.scoreGap,
        true,
        `enemy:${enemy.id}:${this.battle.round}:${enemy.hand.map(formatCard).join('|')}`,
      ));
    });

    groups.push(this.createRevealFocusGroup(
      this.battleLayout.seats.player.x + this.battleLayout.playerHud.hand.x,
      this.battleLayout.seats.player.y + this.battleLayout.playerHud.hand.y,
      this.battle.player.hand,
      this.battle.playerScore(),
      this.battleLayout.cards.width,
      this.battleLayout.cards.spacing,
      'right',
      this.battleLayout.playerHud.scoreGap,
      false,
      `player:${this.battle.round}:${this.battle.player.hand.map(formatCard).join('|')}`,
    ));
    return groups;
  }

  private createRevealFocusGroup(
    x: number,
    y: number,
    cards: Card[],
    scoreResult: ScoreResult,
    cardWidth: number,
    spacing: number,
    scoreSide: 'left' | 'right',
    scoreGap: number,
    flipCards: boolean,
    shakeKey: string,
  ): {
    container: Phaser.GameObjects.Container;
    cards: Phaser.GameObjects.Container[];
    score: Phaser.GameObjects.Container;
    resonant: boolean;
    flipCards: boolean;
    shakeKey: string;
    strong: boolean;
  } {
    const container = this.add.container(x, y).setDepth(31).setAlpha(0);
    const resonant = this.hasMechanic('resonance') && scoreResult.resonance !== 'none';
    const cardViews = cards.map((card, index) => {
      const pose = resolveHandItemPose(index, cards.length, cardWidth, spacing, true);
      const cardView = createCardView(this, {
        x: pose.x,
        y: pose.y,
        card,
        width: cardWidth,
        resonant,
      }).setAngle(pose.angle).setScale(flipCards ? 0.08 : 1, 1);
      container.add(cardView);
      return cardView;
    });
    const handWidth = cardWidth + Math.max(0, cards.length - 1) * spacing;
    const direction = scoreSide === 'right' ? 1 : -1;
    const score = createScoreBadge(this, {
      x: direction * (handWidth / 2 + scoreGap),
      y: 0,
      point: scoreResult.point,
      label: t('common.pointUnit'),
      variant: 'compact',
      resonance: resonant ? scoreResult.resonance : 'none',
      multiplier: scoreResult.multiplier,
      resonanceLabel: resonant ? this.resonanceText(scoreResult) : undefined,
    }).setAlpha(0);
    container.add(score);
    return {
      container,
      cards: cardViews,
      score,
      resonant,
      flipCards,
      shakeKey,
      strong: scoreResult.resonance === 'strong',
    };
  }

  private playRevealFocusGroup(
    groups: Array<{
      container: Phaser.GameObjects.Container;
      cards: Phaser.GameObjects.Container[];
      score: Phaser.GameObjects.Container;
      resonant: boolean;
      flipCards: boolean;
      shakeKey: string;
      strong: boolean;
    }>,
    index: number,
    shade: Phaser.GameObjects.Rectangle,
    onComplete: () => void,
  ): void {
    if (index >= groups.length) {
      this.time.delayedCall(560, () => {
        const containers = groups.map((group) => group.container);
        this.tweens.add({
          targets: [shade, ...containers],
          alpha: 0,
          duration: 240,
          ease: 'Sine.easeIn',
          onComplete: () => {
            shade.destroy();
            containers.forEach((container) => container.destroy(true));
            this.revealFocusPendingEnemyIds.clear();
            this.revealFocusPlaying = false;
            this.actionAnimationPlaying = false;
            onComplete();
          },
        });
      });
      return;
    }

    const group = groups[index];
    if (group.flipCards) {
      this.sound.play('cardPlace', { volume: 0.42 });
    }
    this.tweens.add({
      targets: group.container,
      alpha: 1,
      duration: group.flipCards ? 100 : 180,
      ease: 'Sine.easeOut',
    });
    const revealScore = () => {
      if (group.resonant) {
        this.sound.play('resonanceEcho', { volume: 0.44 });
        this.playResonanceHandShakeOnce(group.shakeKey, group.container, group.strong);
      }
      this.tweens.add({
        targets: group.score,
        alpha: 1,
        scale: { from: 0.82, to: 1 },
        duration: 180,
        ease: 'Back.easeOut',
      });
      this.time.delayedCall(220, () => this.playRevealFocusGroup(groups, index + 1, shade, onComplete));
    };

    if (!group.flipCards) {
      this.time.delayedCall(120, revealScore);
      return;
    }

    this.tweens.add({
      targets: group.cards,
      scaleX: 1,
      duration: 260,
      ease: 'Back.easeOut',
      onComplete: revealScore,
    });
  }

  private playPreCombatPresentationEvents(events: BattlePresentationEvent[], onComplete: () => void): void {
    const preEvents = this.preCombatPresentationEvents(events);
    if (preEvents.length === 0) {
      onComplete();
      return;
    }

    this.playPassiveEffectEvents(preEvents, () => {
      this.playCardsRedealtEvents(preEvents, () => this.playCardReplacementEvents(preEvents, onComplete));
    });
  }

  private playCardsRedealtEvents(events: BattlePresentationEvent[], onComplete: () => void): void {
    const redealEvents = this.cardsRedealtEvents(events);
    if (redealEvents.length === 0) {
      onComplete();
      return;
    }

    const playStep = (index: number) => {
      if (index >= redealEvents.length) {
        onComplete();
        return;
      }

      this.playEnemyRedeal(redealEvents[index], () => {
        this.time.delayedCall(120, () => playStep(index + 1));
      });
    };

    playStep(0);
  }

  private playEnemyRedeal(event: Extract<BattlePresentationEvent, { type: 'cards-redealt' }>, onComplete: () => void): void {
    const enemyIndex = event.targetEnemyIndex;
    if (enemyIndex < 0 || enemyIndex >= this.battle.enemies.length) {
      onComplete();
      return;
    }

    this.actionDealing = true;
    this.dealtEnemyCards = this.battle.enemies.map((enemy) => enemy.hand.length);
    this.dealtEnemyCards[enemyIndex] = 0;
    this.render();

    const count = Math.min(event.count, this.battle.enemies[enemyIndex].hand.length);
    const playCard = (cardIndex: number) => {
      if (cardIndex >= count || !this.actionDealing) {
        this.actionDealing = false;
        this.dealtEnemyCards = this.battle.enemies.map((enemy) => enemy.hand.length);
        this.render();
        onComplete();
        return;
      }

      this.playDealCard(
        this.dealTargetForEnemy(enemyIndex, cardIndex),
        this.dealAngleForEnemy(enemyIndex, cardIndex),
        'place',
        () => {
        this.dealtEnemyCards[enemyIndex] = Math.max(this.dealtEnemyCards[enemyIndex], cardIndex + 1);
        this.render();
        this.time.delayedCall(90, () => playCard(cardIndex + 1));
        },
      );
    };

    playCard(0);
  }

  private playCardReplacementEvents(events: BattlePresentationEvent[], onComplete: () => void): void {
    const replacements = this.cardReplacementEvents(events);
    if (replacements.length === 0) {
      onComplete();
      return;
    }

    const playStep = (index: number) => {
      if (index >= replacements.length) {
        onComplete();
        return;
      }

      this.playEnemyCardReplacement(replacements[index], () => {
        this.time.delayedCall(120, () => playStep(index + 1));
      });
    };

    playStep(0);
  }

  private playEnemyCardReplacement(event: Extract<BattlePresentationEvent, { type: 'card-replaced' }>, onComplete: () => void): void {
    const enemy = this.battle.enemies[event.targetEnemyIndex];
    if (!enemy || enemy.id !== event.target || event.cardIndex < 0 || event.cardIndex >= enemy.hand.length) {
      onComplete();
      return;
    }

    this.actionDealing = true;
    this.render();
    const position = this.enemyCardCenter(event.targetEnemyIndex, event.cardIndex);
    const oldCard = createCardView(this, {
      x: position.x,
      y: position.y,
      card: event.previousCard,
      width: this.battleLayout.cards.enemyWidth,
    }).setDepth(32);
    const talisman = this.add.text(position.x, position.y, '符', {
      fontFamily: 'Arial',
      fontSize: '36px',
      color: '#b6ffe2',
      fontStyle: 'bold',
      stroke: '#12352d',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(34);
    talisman.setShadow(0, 0, '#72d8b3', 14, true, true);
    this.sound.play('attackWind', { volume: 0.36 });
    this.playTalismanBurn(position.x, position.y);
    this.tweens.add({
      targets: [oldCard, talisman],
      alpha: 0,
      scaleX: 1.28,
      scaleY: 0.48,
      duration: 560,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        oldCard.destroy(true);
        talisman.destroy();
        this.playDealCard(position, this.dealAngleForEnemy(event.targetEnemyIndex, event.cardIndex), 'place', () => {
          const replacement = createCardView(this, {
            x: position.x,
            y: position.y,
            card: event.replacementCard,
            width: this.battleLayout.cards.enemyWidth,
          }).setDepth(32).setAlpha(0);
          this.sound.play('cardPlace', { volume: 0.46 });
          this.tweens.add({
            targets: replacement,
            alpha: 1,
            scaleX: 1.08,
            scaleY: 1.08,
            duration: 240,
            yoyo: true,
            ease: 'Back.easeOut',
            onComplete: () => {
              this.time.delayedCall(520, () => {
                this.tweens.add({
                  targets: replacement,
                  alpha: 0,
                  duration: 220,
                  onComplete: () => {
                    replacement.destroy(true);
                    this.actionDealing = false;
                    this.render();
                    onComplete();
                  },
                });
              });
            },
          });
        });
      },
    });
  }

  private hasCombatEvents(events: BattlePresentationEvent[]): boolean {
    return events.some((event) => event.type === 'damage' || event.type === 'clash');
  }

  private hasRoundRevealEvent(events: BattlePresentationEvent[]): boolean {
    return events.some((event) => event.type === 'round-revealed');
  }

  private currentRevealEnemyIds(): Set<string> {
    return new Set(
      this.battle.enemies
        .filter((enemy) => enemy.hand.length > 0 && this.battle.results.some((result) => result.enemy === enemy))
        .map((enemy) => enemy.id),
    );
  }

  private hasBattleEndedEvent(events: BattlePresentationEvent[]): boolean {
    return events.some((event) => event.type === 'battle-ended');
  }

  private shouldDelayOutcomeForPresentation(events: BattlePresentationEvent[]): boolean {
    return (this.hasBattleEndedEvent(events) || this.hasPendingSoulRedeem())
      && (this.hasCombatEvents(events) || this.hasRoundRevealEvent(events));
  }

  private isPresentationBusy(): boolean {
    return this.dealing
      || this.playerRedealing
      || this.actionDealing
      || this.stageBannerPlaying
      || this.actionAnimationPlaying
      || this.presentationSequencePlaying
      || this.autoAdvancingRound;
  }

  private showChapter3DamageFeedbackIfNeeded(events: BattlePresentationEvent[], onComplete: () => void): boolean {
    if (this.battle.levelConfig?.id !== 'chapter1_3') {
      return false;
    }

    const combatEvents = this.combatEvents(events);
    const playerDamaged = combatEvents.some((event) => event.type === 'damage' && event.attacker === 'enemy' && event.amount > 0);
    const playerDealtDamage = combatEvents.some((event) => event.type === 'damage' && event.attacker === 'player' && event.amount > 0);
    const hadClash = combatEvents.some((event) => event.type === 'clash');

    if (playerDamaged) {
      this.chapter3ConsecutiveLosses += 1;
    } else if (playerDealtDamage || hadClash) {
      this.chapter3ConsecutiveLosses = 0;
    }

    if (!playerDamaged) {
      return false;
    }

    const messages = [this.dialogueMessageFromKey(this.nextChapter3TauntKey(this.chapter3LossCause()))];
    if (this.chapter3ConsecutiveLosses >= 2 && !this.chapter3LossHintShown) {
      this.chapter3LossHintShown = true;
      messages.push(this.dialogueMessageFromKey('tutorial.chapter1_3.lossHint'));
    }

    this.showBlockingMessageSequence(messages, onComplete);
    return true;
  }

  private chapter3LossCause(): 'compare' | 'invite' | 'playerDraw' | 'overpush' | 'generic' {
    const state = this.battle.getState();
    const playerDrew = state.player.drawCountThisRound > 0;
    const enemyWasInvited = state.enemies.some((enemy) => enemy.id === 'gambler' && enemy.invited !== undefined);

    if (playerDrew && enemyWasInvited) {
      return 'overpush';
    }

    if (playerDrew) {
      return 'playerDraw';
    }

    if (enemyWasInvited) {
      return 'invite';
    }

    if (state.currentFixedRoundId?.startsWith('chapter1_3')) {
      return 'compare';
    }

    return 'generic';
  }

  private nextChapter3TauntKey(cause: 'compare' | 'invite' | 'playerDraw' | 'overpush' | 'generic'): string {
    const keyGroups: Record<typeof cause, string[]> = {
      compare: [
        'tutorial.chapter1_3.tauntCompare1',
        'tutorial.chapter1_3.tauntCompare2',
      ],
      invite: [
        'tutorial.chapter1_3.tauntInvite1',
        'tutorial.chapter1_3.tauntInvite2',
      ],
      playerDraw: [
        'tutorial.chapter1_3.tauntPlayerDraw1',
        'tutorial.chapter1_3.tauntPlayerDraw2',
      ],
      overpush: [
        'tutorial.chapter1_3.tauntOverpush1',
        'tutorial.chapter1_3.tauntOverpush2',
      ],
      generic: [
        'tutorial.chapter1_3.tauntGeneric1',
        'tutorial.chapter1_3.tauntGeneric2',
      ],
    };
    const keys = keyGroups[cause];
    const key = keys[this.chapter3TauntIndex % keys.length];
    this.chapter3TauntIndex += 1;
    return key;
  }

  private showChapter4ResonanceFeedbackIfNeeded(events: BattlePresentationEvent[], onComplete: () => void): boolean {
    if (this.battle.levelConfig?.id !== 'chapter1_4') {
      return false;
    }

    const resonantDamage = this.combatEvents(events).find((event) => (
      event.type === 'damage'
      && event.amount > 0
      && (event.resonance === 'resonance' || event.resonance === 'strong')
    ));
    if (!resonantDamage || resonantDamage.type !== 'damage') {
      return false;
    }

    const feedbackId = this.chapter4ResonanceFeedbackId(resonantDamage.attacker, resonantDamage.resonance);
    if (!feedbackId || this.shownChapter4ResonanceFeedbackIds.has(feedbackId)) {
      return false;
    }

    const keys = this.chapter4ResonanceFeedbackKeys(feedbackId);
    if (keys.length === 0) {
      return false;
    }

    this.shownChapter4ResonanceFeedbackIds.add(feedbackId);
    this.showBlockingMessageSequence(keys.map((key) => this.dialogueMessageFromKey(key)), onComplete);
    return true;
  }

  private chapter4ResonanceFeedbackId(attacker: 'player' | 'enemy', resonance?: 'none' | 'resonance' | 'strong'): 'player-resonance' | 'player-strong' | 'enemy-resonance' | 'enemy-strong' | undefined {
    if (attacker === 'player' && resonance === 'strong') {
      return 'player-strong';
    }

    if (attacker === 'player' && resonance === 'resonance') {
      return 'player-resonance';
    }

    if (attacker === 'enemy' && resonance === 'strong') {
      return 'enemy-strong';
    }

    if (attacker === 'enemy' && resonance === 'resonance') {
      return 'enemy-resonance';
    }

    return undefined;
  }

  private chapter4ResonanceFeedbackKeys(feedbackId: 'player-resonance' | 'player-strong' | 'enemy-resonance' | 'enemy-strong'): string[] {
    if (feedbackId === 'player-strong') {
      return [
        'tutorial.chapter1_4.feedback.playerStrong1',
        'tutorial.chapter1_4.feedback.playerStrong2',
      ];
    }

    if (feedbackId === 'player-resonance') {
      return [
        'tutorial.chapter1_4.feedback.playerResonance1',
        'tutorial.chapter1_4.feedback.playerResonance2',
      ];
    }

    if (feedbackId === 'enemy-strong') {
      return [
        'tutorial.chapter1_4.feedback.enemyStrong1',
        'tutorial.chapter1_4.feedback.enemyStrong2',
      ];
    }

    if (feedbackId === 'enemy-resonance') {
      return [
        'tutorial.chapter1_4.feedback.enemyResonance1',
        'tutorial.chapter1_4.feedback.enemyResonance2',
      ];
    }

    return [];
  }

  private combatEvents(events: BattlePresentationEvent[]): BattleCombatPresentationEvent[] {
    return events.filter((event): event is BattleCombatPresentationEvent => event.type === 'damage' || event.type === 'clash');
  }

  private cardDealEvents(events: BattlePresentationEvent[]): Extract<BattlePresentationEvent, { type: 'card-dealt' }>[] {
    return events.filter((event): event is Extract<BattlePresentationEvent, { type: 'card-dealt' }> => event.type === 'card-dealt');
  }

  private playDamageAnimations(events: BattleCombatPresentationEvent[], onComplete?: () => void): void {
    if (events.length === 0) {
      onComplete?.();
      return;
    }

    const playNext = (index: number) => {
      if (index >= events.length) {
        onComplete?.();
        return;
      }

      const event = events[index];
      this.playCombatAnimation(event);
      const killRewardHeal = event.type === 'damage'
        ? (event.killRewardHeal ?? event.guard?.killRewardHeal ?? 0)
        : 0;
      const attackDelay = killRewardHeal > 0
        ? Math.max(1520, this.combatPresentationDelay(event, index === events.length - 1))
        : this.combatPresentationDelay(event, index === events.length - 1);
      this.time.delayedCall(attackDelay, () => {
        if (killRewardHeal <= 0 || event.type !== 'damage') {
          playNext(index + 1);
          return;
        }

        const sourceEnemyId = event.guard?.killRewardHeal
          ? event.guard.protectorEnemyId
          : event.enemyId;
        const sourceEnemyIndex = this.battle.enemies.findIndex((enemy) => enemy.id === sourceEnemyId);
        this.playKillRewardSoulHeal(sourceEnemyIndex, killRewardHeal, () => playNext(index + 1));
      });
    };

    playNext(0);
  }

  private playKillRewardSoulHeal(enemyIndex: number, amount: number, onComplete: () => void): void {
    if (enemyIndex < 0 || amount <= 0) {
      onComplete();
      return;
    }

    const source = this.enemySeatCenter(enemyIndex);
    const player = new Phaser.Math.Vector2(
      this.battleLayout.seats.player.x,
      this.battleLayout.seats.player.y,
    );
    const soul = this.add.container(source.x, source.y - 10).setDepth(36);
    const outer = this.add.circle(0, 0, 18, 0x91d8ff, 0.12)
      .setStrokeStyle(3, 0xd9f5ff, 0.82);
    const core = this.add.circle(0, 0, 8, 0xe8fbff, 0.92)
      .setStrokeStyle(2, 0x73c7ff, 0.9);
    const glyph = this.add.text(0, 0, '◇', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    glyph.setShadow(0, 0, '#91d8ff', 10, true, true);
    soul.add([outer, core, glyph]);

    this.playShockwave(source.x, source.y, 0x73c7ff, 92);
    this.playSoulTrail(source, player, 0x91d8ff);
    const midpoint = new Phaser.Math.Vector2(
      (source.x + player.x) / 2 + (source.x <= player.x ? -54 : 54),
      Math.min(source.y, player.y) - 74,
    );

    this.tweens.add({
      targets: soul,
      x: midpoint.x,
      y: midpoint.y,
      scale: 1.25,
      duration: 390,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: soul,
          x: player.x,
          y: player.y,
          scale: 0.66,
          duration: 430,
          ease: 'Sine.easeIn',
          onComplete: () => {
            soul.destroy(true);
            this.sound.play('healSound', { volume: 0.56 });
            if (this.visualHpOverride) {
              this.visualHpOverride.player = Math.min(
                this.battle.player.maxHp,
                this.visualHpOverride.player + amount,
              );
              this.playerHeartMeter?.setHp(this.visualHpOverride.player, true);
            }
            this.playPlayerSoulHealImpact(player.x, player.y, amount);
            this.time.delayedCall(360, onComplete);
          },
        });
      },
    });
  }

  private playSoulTrail(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2, color: number): void {
    for (let index = 0; index < 7; index += 1) {
      const progress = (index + 1) / 8;
      const mote = this.add.circle(
        Phaser.Math.Linear(from.x, to.x, progress),
        Phaser.Math.Linear(from.y, to.y, progress) - Math.sin(progress * Math.PI) * 62,
        Phaser.Math.Between(3, 6),
        color,
        0.7,
      ).setDepth(35).setAlpha(0);
      this.tweens.add({
        targets: mote,
        alpha: { from: 0, to: 0.82 },
        scale: { from: 0.5, to: 1.35 },
        duration: 240,
        delay: index * 54,
        yoyo: true,
        hold: 130,
        ease: 'Sine.easeInOut',
        onComplete: () => mote.destroy(),
      });
    }
  }

  private playPlayerSoulHealImpact(x: number, y: number, amount: number): void {
    const glow = this.add.circle(x, y, 36, 0x78d18a, 0.2)
      .setDepth(37)
      .setStrokeStyle(4, 0xb9ffc2, 0.92);
    const inner = this.add.circle(x, y, 16, 0xe1ffe6, 0.46).setDepth(38);
    this.playHealGainText(x, y - 88, amount, 40);
    this.playSoulRedeemParticles(x, y, 10, 0xb9ffc2);
    this.tweens.add({
      targets: [glow, inner],
      alpha: 0,
      scale: 2.8,
      duration: 680,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        glow.destroy();
        inner.destroy();
      },
    });
  }

  private combatPresentationDelay(event: BattleCombatPresentationEvent, isLast: boolean): number {
    if (event.type === 'damage' && event.guard) {
      return event.guard.legacyAttackBonus ? 3000 : 2500;
    }

    if (
      event.type === 'damage'
      && event.attacker === 'player'
      && (event.resonance === 'resonance' || event.resonance === 'strong')
      && getProgress().equippedAttackEffect === 'sakura_slash'
    ) {
      return isLast ? 1680 : 1380;
    }

    return isLast ? 1520 : 820;
  }

  private playPassiveEffectEvents(events: BattlePresentationEvent[], onComplete: () => void): void {
    const passiveEvents = this.passiveEffectEvents(events);
    if (passiveEvents.length === 0) {
      onComplete();
      return;
    }

    passiveEvents
      .filter((event) => event.passiveId === 'red_silk_toast' || (event.passiveId === 'hanami_dance' && event.effect === 'reward_attack'))
      .forEach((event) => event.targetEnemyIds.forEach((enemyId) => this.hiddenRoundAttackBonusEnemyIds.add(enemyId)));
    passiveEvents
      .filter((event) => event.passiveId === 'hanami_dance' && event.effect === 'mark')
      .forEach((event) => event.targetEnemyIds.forEach((enemyId) => this.hiddenHanamiFanTargetIds.add(enemyId)));
    this.actionAnimationPlaying = true;
    this.render();
    const playStep = (index: number) => {
      if (index >= passiveEvents.length) {
        this.hiddenRoundAttackBonusEnemyIds.clear();
        this.hiddenHanamiFanTargetIds.clear();
        this.actionAnimationPlaying = false;
        this.render();
        onComplete();
        return;
      }

      this.playPassiveEffect(passiveEvents[index], () => {
        this.time.delayedCall(PASSIVE_EFFECT_TIMING.stepGap, () => playStep(index + 1));
      });
    };

    playStep(0);
  }

  private playPassiveEffect(event: Extract<BattlePresentationEvent, { type: 'passive-effect' }>, onComplete: () => void): void {
    this.setEnemyPortraitPose(event.sourceEnemyIndex, 'cast');
    const finish = () => {
      this.setEnemyPortraitPose(event.sourceEnemyIndex, 'idle');
      onComplete();
    };

    if (event.passiveId === 'goblin_instinct') {
      this.playGoblinInstinctEffect(event, finish);
      return;
    }

    if (event.passiveId === 'gambler_blessing') {
      this.playGamblerBlessingEffect(event, finish);
      return;
    }

    if (event.passiveId === 'werewolf_lifesteal') {
      this.playWerewolfLifestealEffect(event, finish);
      return;
    }

    if (event.passiveId === 'war_horn') {
      this.playWarHornEffect(event, finish);
      return;
    }

    if (event.passiveId === 'rune_blessing') {
      this.playRuneBlessingEffect(event, finish);
      return;
    }

    if (event.passiveId === 'red_silk_toast') {
      this.playRedSilkToastEffect(event, finish);
      return;
    }

    if (event.passiveId === 'heavenly_insight') {
      this.playHeavenlyInsightEffect(event, finish);
      return;
    }

    if (event.passiveId === 'iaijutsu_charge') {
      this.playIaijutsuChargeEffect(event, finish);
      return;
    }

    if (event.passiveId === 'smoke_substitution') {
      this.playSmokeScreenArmEffect(event, finish);
      return;
    }

    if (event.passiveId === 'hanami_dance') {
      this.playHanamiDanceEffect(event, finish);
      return;
    }

    this.playEinherjarSummonEffect(event, finish);
  }

  private playIaijutsuChargeEffect(event: Extract<BattlePresentationEvent, { type: 'passive-effect' }>, onComplete: () => void): void {
    const source = this.enemySeatCenter(event.sourceEnemyIndex);
    const amount = event.amount ?? 1;
    const release = event.effect === 'release';
    const color = 0xe15f58;
    const textColor = '#ffd19d';
    const label = release
      ? t('battle.passive.iaijutsuRelease', { amount })
      : t('battle.status.iaijutsu', { amount });

    this.sound.play(release ? 'attackFire' : 'cardPlace', { volume: release ? 0.52 : 0.42 });
    this.flashEnemySeat(event.sourceEnemyIndex, color, label, textColor);
    if (release) {
      this.playIaijutsuSlash(source.x, source.y, color, 0xf5d66b);
    } else {
      this.playIaijutsuSheath(source.x, source.y, color, amount);
    }

    this.time.delayedCall(release ? 1180 : 1040, onComplete);
  }

  private playSmokeScreenArmEffect(event: Extract<BattlePresentationEvent, { type: 'passive-effect' }>, onComplete: () => void): void {
    const source = this.enemySeatCenter(event.sourceEnemyIndex);
    this.sound.play('attackWind', { volume: 0.36 });
    this.flashEnemySeat(event.sourceEnemyIndex, 0x8e78bb, t('battle.passive.smokeScreenArmed'), '#d8cbff');
    this.playSmokeBurst(source.x, source.y, 0x8e78bb, '#e1d7ff');
    this.time.delayedCall(1220, onComplete);
  }

  private playSmokeSubstitutionEvadeEffect(enemy: EnemyState, position: Phaser.Math.Vector2): void {
    const enemyIndex = this.battle.enemies.indexOf(enemy);
    this.sound.play('attackWind', { volume: 0.46 });
    this.flashEnemySeat(enemyIndex, 0x8e78bb, t('battle.passive.smokeScreenEvaded'), '#d8cbff');
    this.playSmokeBurst(position.x, position.y, 0x8e78bb, '#f0ebff', true);
  }

  private playHanamiDanceEffect(event: Extract<BattlePresentationEvent, { type: 'passive-effect' }>, onComplete: () => void): void {
    const targetIndex = event.targetEnemyIndexes[0];
    if (targetIndex === undefined) {
      onComplete();
      return;
    }

    const source = this.enemySeatCenter(event.sourceEnemyIndex);
    const target = this.enemySeatCenter(targetIndex);
    const targetEnemy = this.battle.enemies[targetIndex];
    const amount = event.amount ?? 0;
    const marking = event.effect === 'mark';
    const healing = event.effect === 'reward_heal';
    const color = 0xf09ab5;

    this.sound.play('attackWind', { volume: marking ? 0.34 : 0.42 });
    this.flashEnemySeat(event.sourceEnemyIndex, color, marking ? t('battle.passive.hanamiDance') : t('battle.passive.hanamiReward'), '#ffd2e3');
    this.playRedSilkRibbon(source, target);
    this.playHanamiFanFlight(source, target, color, marking);

    if (marking) {
      this.time.delayedCall(620, () => {
        const targetId = event.targetEnemyIds[0];
        if (targetId) {
          this.hiddenHanamiFanTargetIds.delete(targetId);
        }
        this.render();
        this.flashEnemySeat(targetIndex, color, t('battle.status.hanamiFan'), '#ffd2e3');
      });
      this.time.delayedCall(1320, onComplete);
      return;
    }

    if (healing && targetEnemy) {
      const hpBefore = Math.max(0, targetEnemy.hp - amount);
      this.enemyHeartMeters.get(targetEnemy.id)?.setHp(hpBefore);
      this.time.delayedCall(620, () => {
        this.sound.play('healSound', { volume: 0.48 });
        this.enemyHeartMeters.get(targetEnemy.id)?.setHp(targetEnemy.hp, true);
        this.flashEnemySeat(targetIndex, 0x78d18a, t('battle.passive.hpGain', { amount }), '#89f09f');
        this.playShockwave(target.x, target.y, 0x78d18a, 150);
      });
    } else {
      this.time.delayedCall(620, () => {
        const targetId = event.targetEnemyIds[0];
        if (targetId) {
          this.hiddenRoundAttackBonusEnemyIds.delete(targetId);
        }
        this.render();
        this.flashEnemySeat(targetIndex, 0xff4b5f, t('battle.status.attackBonus', { amount }), '#ff9aaf');
        this.playShockwave(target.x, target.y, 0xf09ab5, 150);
      });
    }

    this.time.delayedCall(1360, onComplete);
  }

  private playHanamiFanFlight(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2, color: number, marking: boolean): void {
    const fan = this.add.container(from.x, from.y).setDepth(29).setScale(0.72);
    const glow = this.add.circle(0, 0, 30, color, 0.16);
    const base = this.add.arc(0, 6, 32, 202, 338, false, color, 0.92).setStrokeStyle(2, 0xffe0ec, 0.92);
    const handle = this.add.rectangle(0, 23, 5, 24, 0xe5ba63, 0.96).setStrokeStyle(1, 0x7c3f52, 0.9);
    fan.add([glow, base, handle]);
    for (let index = 0; index < 5; index += 1) {
      const angle = -42 + index * 21;
      fan.add(this.add.rectangle(0, -3, 2, 45, 0xffe5ef, 0.78).setOrigin(0.5, 1).setAngle(angle));
    }

    this.tweens.add({
      targets: fan,
      x: to.x,
      y: to.y - 8,
      angle: marking ? 460 : -380,
      scale: marking ? 1.18 : 1.02,
      duration: 620,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.playImpactBurst(to.x, to.y, color);
        this.tweens.add({
          targets: fan,
          alpha: 0,
          scale: 1.7,
          duration: 280,
          ease: 'Quad.easeOut',
          onComplete: () => fan.destroy(true),
        });
      },
    });
  }

  private playSmokeBurst(x: number, y: number, color: number, lightColor: string, large = false): void {
    const count = large ? 10 : 7;
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count + Phaser.Math.FloatBetween(-0.22, 0.22);
      const distance = Phaser.Math.Between(26, large ? 84 : 62);
      const puff = this.add.circle(x + Math.cos(angle) * 12, y + Math.sin(angle) * 12, Phaser.Math.Between(10, large ? 20 : 16), color, 0.38).setDepth(27);
      puff.setStrokeStyle(1, 0xffffff, 0.18);
      this.tweens.add({
        targets: puff,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        scale: large ? 2.35 : 1.85,
        alpha: 0,
        duration: large ? 760 : 620,
        ease: 'Cubic.easeOut',
        delay: index * 24,
        onComplete: () => puff.destroy(),
      });
    }

    const core = this.add.circle(x, y, large ? 34 : 24, color, 0.3).setDepth(28).setStrokeStyle(3, Phaser.Display.Color.HexStringToColor(lightColor).color, 0.84);
    this.tweens.add({
      targets: core,
      scale: large ? 3.6 : 2.7,
      alpha: 0,
      duration: large ? 760 : 620,
      ease: 'Cubic.easeOut',
      onComplete: () => core.destroy(),
    });
  }

  private playIaijutsuSheath(x: number, y: number, color: number, stacks: number): void {
    const seal = this.add.container(x, y).setDepth(27);
    const ring = this.add.circle(0, 0, 30, color, 0.1).setStrokeStyle(3, color, 0.9);
    const sheath = this.add.rectangle(0, 7, 78, 8, 0x31181d, 0.96).setStrokeStyle(2, 0xf5d66b, 0.82).setAngle(-18);
    const blade = this.add.rectangle(-8, -5, 58, 4, 0xffe1c0, 0.94).setAngle(-18);
    const stackText = this.add.text(0, -44, `${stacks}`, {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#ffd19d',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    stackText.setShadow(0, 0, '#e15f58', 10, true, true);
    seal.add([ring, sheath, blade, stackText]);
    this.playShockwave(x, y, color, 128 + stacks * 24);
    this.tweens.add({
      targets: seal,
      scale: 1.62,
      alpha: 0,
      angle: -12,
      duration: 940,
      ease: 'Cubic.easeOut',
      onComplete: () => seal.destroy(true),
    });
  }

  private playIaijutsuSlash(x: number, y: number, color: number, gold: number): void {
    const slash = this.add.graphics().setDepth(28);
    slash.lineStyle(12, gold, 0.3);
    slash.beginPath();
    slash.moveTo(x - 72, y + 58);
    slash.lineTo(x + 70, y - 56);
    slash.strokePath();
    slash.lineStyle(4, 0xffffff, 0.96);
    slash.beginPath();
    slash.moveTo(x - 76, y + 58);
    slash.lineTo(x + 76, y - 58);
    slash.strokePath();
    slash.lineStyle(2, color, 1);
    slash.beginPath();
    slash.moveTo(x - 74, y + 58);
    slash.lineTo(x + 74, y - 58);
    slash.strokePath();
    this.playShockwave(x, y, gold, 214);
    this.tweens.add({
      targets: slash,
      alpha: 0,
      scale: 1.45,
      duration: 720,
      ease: 'Cubic.easeOut',
      onComplete: () => slash.destroy(),
    });
  }

  private playGoblinInstinctEffect(event: Extract<BattlePresentationEvent, { type: 'passive-effect' }>, onComplete: () => void): void {
    const source = this.enemySeatCenter(event.sourceEnemyIndex);
    const player = new Phaser.Math.Vector2(this.battleLayout.seats.player.x, this.battleLayout.seats.player.y);
    this.sound.play('attackWind', { volume: 0.28 });
    this.flashEnemySeat(event.sourceEnemyIndex, 0x65d46e, t('battle.passive.goblinInstinct'), '#78d18a');
    this.playShockwave(source.x, source.y, 0x65d46e, 140);
    this.playInsightLine(source, player, 0x65d46e);
    this.time.delayedCall(PASSIVE_EFFECT_TIMING.goblinTotal, onComplete);
  }

  private playGamblerBlessingEffect(event: Extract<BattlePresentationEvent, { type: 'passive-effect' }>, onComplete: () => void): void {
    const source = this.enemySeatCenter(event.sourceEnemyIndex);
    this.sound.play('cardPlace', { volume: 0.48 });
    this.flashEnemySeat(event.sourceEnemyIndex, 0xf25f9a, t('battle.passive.gamblerBlessing'), '#ff7bb6');
    this.playCardShuffleBurst(source.x, source.y + 16, 0xf25f9a);
    this.time.delayedCall(PASSIVE_EFFECT_TIMING.standardTotal, onComplete);
  }

  private playWerewolfLifestealEffect(event: Extract<BattlePresentationEvent, { type: 'passive-effect' }>, onComplete: () => void): void {
    const source = this.enemySeatCenter(event.sourceEnemyIndex);
    const player = new Phaser.Math.Vector2(this.battleLayout.seats.player.x, this.battleLayout.seats.player.y);
    this.sound.play('healSound', { volume: 0.46 });
    this.flashEnemySeat(event.sourceEnemyIndex, 0x73c7ff, t('battle.passive.werewolfLifesteal'), '#88d4ff');
    this.playBloodReturn(player, source, 0xef6f6c);
    this.time.delayedCall(260, () => this.flashEnemySeat(event.sourceEnemyIndex, 0x78d18a, t('battle.passive.hpGain', { amount: event.amount ?? 1 }), '#89f09f'));
    this.time.delayedCall(PASSIVE_EFFECT_TIMING.standardTotal, onComplete);
  }

  private playWarHornEffect(event: Extract<BattlePresentationEvent, { type: 'passive-effect' }>, onComplete: () => void): void {
    const source = this.enemySeatCenter(event.sourceEnemyIndex);
    this.sound.play('attackFire', { volume: 0.46 });
    this.flashEnemySeat(event.sourceEnemyIndex, 0xff8a3d, t('battle.passive.warHorn'), '#ffad6b');
    this.playShockwave(source.x, source.y, 0xff5a2c, 260);
    event.targetEnemyIndexes.forEach((index, offset) => {
      this.time.delayedCall(120 + offset * 70, () => this.flashEnemySeat(index, 0xff3f3f, t('battle.passive.attackUp'), '#ff6f6f'));
    });
    this.time.delayedCall(PASSIVE_EFFECT_TIMING.standardTotal, onComplete);
  }

  private playRuneBlessingEffect(event: Extract<BattlePresentationEvent, { type: 'passive-effect' }>, onComplete: () => void): void {
    const source = this.enemySeatCenter(event.sourceEnemyIndex);
    const isHeal = event.effect === 'heal';
    const color = isHeal ? 0x78d18a : 0x79c9ff;
    const textColor = isHeal ? '#89f09f' : '#9ed8ff';
    this.sound.play(isHeal ? 'healSound' : 'attackWind', { volume: isHeal ? 0.44 : 0.36 });
    this.flashEnemySeat(event.sourceEnemyIndex, 0x79c9ff, t('battle.passive.runeBlessing'), '#9ed8ff');
    this.playShockwave(source.x, source.y, 0x79c9ff, 190);
    event.targetEnemyIndexes.forEach((index, offset) => {
      const label = isHeal ? t('battle.passive.hpUp') : t('battle.passive.attackUp');
      this.time.delayedCall(180 + offset * 80, () => this.flashEnemySeat(index, color, label, textColor));
    });
    this.time.delayedCall(PASSIVE_EFFECT_TIMING.standardTotal, onComplete);
  }

  private playEinherjarSummonEffect(event: Extract<BattlePresentationEvent, { type: 'passive-effect' }>, onComplete: () => void): void {
    const source = this.enemySeatCenter(event.sourceEnemyIndex);
    event.targetEnemyIndexes.forEach((index) => this.setEnemyPortraitPose(index, 'cast'));
    this.sound.play('resonanceEcho', { volume: 0.5 });
    this.flashEnemySeat(event.sourceEnemyIndex, 0xf7d889, t('battle.passive.einherjarSummon'), '#ffe39a');
    this.playShockwave(source.x, source.y, 0xf7d889, 220);
    event.targetEnemyIndexes.forEach((index, offset) => {
      this.time.delayedCall(220 + offset * 120, () => {
        const target = this.enemySeatCenter(index);
        this.playSummonColumn(target.x, target.y, 0xf7d889);
        this.flashEnemySeat(index, 0xf7d889, t('battle.passive.einherjarArrive'), '#ffe39a');
      });
    });
    this.time.delayedCall(PASSIVE_EFFECT_TIMING.standardTotal, () => {
      event.targetEnemyIndexes.forEach((index) => this.setEnemyPortraitPose(index, 'idle'));
      onComplete();
    });
  }

  private playRedSilkToastEffect(event: Extract<BattlePresentationEvent, { type: 'passive-effect' }>, onComplete: () => void): void {
    const targetIndex = event.targetEnemyIndexes[0];
    if (targetIndex === undefined) {
      onComplete();
      return;
    }

    const source = this.enemySeatCenter(event.sourceEnemyIndex);
    const target = this.enemySeatCenter(targetIndex);
    const targetEnemy = this.battle.enemies[targetIndex];
    const hpBeforeToast = targetEnemy ? Math.max(0, targetEnemy.hp - 1) : undefined;
    if (targetEnemy && hpBeforeToast !== undefined) {
      this.enemyHeartMeters.get(targetEnemy.id)?.setHp(hpBeforeToast);
    }
    this.sound.play('attackWind', { volume: 0.38 });
    this.flashEnemySeat(event.sourceEnemyIndex, 0xf29bc2, t('battle.passive.redSilkToast'), '#ffb8d6');
    this.playShockwave(source.x, source.y, 0xf29bc2, 165);
    this.time.delayedCall(180, () => this.playRedSilkRibbon(source, target));
    this.time.delayedCall(660, () => {
      this.sound.play('healSound', { volume: 0.44 });
      if (targetEnemy) {
        this.enemyHeartMeters.get(targetEnemy.id)?.setHp(targetEnemy.hp, true);
      }
      this.flashEnemySeat(targetIndex, 0x78d18a, t('battle.passive.hpUp'), '#89f09f');
      this.playShockwave(target.x, target.y, 0x78d18a, 145);
    });
    this.time.delayedCall(1120, () => {
      const targetEnemyId = event.targetEnemyIds[0];
      if (targetEnemyId) {
        this.hiddenRoundAttackBonusEnemyIds.delete(targetEnemyId);
      }
      this.render();
      this.flashEnemySeat(targetIndex, 0xf4519d, t('battle.passive.attackUp'), '#ffb8d6');
      this.playShockwave(target.x, target.y, 0xf4519d, 145);
    });
    this.time.delayedCall(1820, onComplete);
  }

  private playHeavenlyInsightEffect(event: Extract<BattlePresentationEvent, { type: 'passive-effect' }>, onComplete: () => void): void {
    const source = this.enemySeatCenter(event.sourceEnemyIndex);
    const targetIndex = event.targetEnemyIndexes[0] ?? event.sourceEnemyIndex;
    const target = this.enemySeatCenter(targetIndex);
    this.flashEnemySeat(event.sourceEnemyIndex, 0x72d8b3, t('battle.passive.heavenlyInsight'), '#92f0cc');
    this.playTaoistRune(source.x, source.y, 0x72d8b3);

    if (event.effect === 'sense') {
      this.sound.play('cardPlace', { volume: 0.42 });
      this.time.delayedCall(160, () => this.playTalismanFlight(source, target));
      this.time.delayedCall(620, () => {
        this.flashEnemySeat(targetIndex, 0x72d8b3, t('battle.passive.talismaned'), '#92f0cc');
      });
      this.time.delayedCall(PASSIVE_EFFECT_TIMING.standardTotal, onComplete);
      return;
    }

    this.sound.play('attackWind', { volume: 0.4 });
    this.time.delayedCall(180, () => {
      this.flashEnemySeat(targetIndex, 0x72d8b3, t('battle.passive.talismanBurn'), '#d6ffec');
      this.playShockwave(target.x, target.y, 0x72d8b3, 140);
    });
    this.time.delayedCall(PASSIVE_EFFECT_TIMING.standardTotal, onComplete);
  }

  private playRedSilkRibbon(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2): void {
    const ribbon = this.add.graphics().setDepth(27);
    const drawPath = () => {
      ribbon.beginPath();
      ribbon.moveTo(from.x, from.y);
      const steps = 24;
      for (let step = 1; step <= steps; step += 1) {
        const progress = step / steps;
        const x = Phaser.Math.Linear(from.x, to.x, progress);
        const y = Phaser.Math.Linear(from.y, to.y, progress) + Math.sin(progress * Math.PI * 3) * 18;
        ribbon.lineTo(x, y);
      }
      ribbon.strokePath();
    };

    ribbon.lineStyle(14, 0xf29bc2, 0.25);
    drawPath();
    ribbon.lineStyle(4, 0xffd8e8, 0.9);
    drawPath();

    const petals = Array.from({ length: 4 }, (_, index) => {
      const petal = this.add.circle(from.x, from.y, 6, 0xffc6df, 0.95).setDepth(28);
      petal.setStrokeStyle(1, 0xffffff, 0.9);
      this.time.delayedCall(index * 85, () => {
        this.tweens.add({
          targets: petal,
          x: to.x,
          y: to.y + (index - 1.5) * 12,
          alpha: 0,
          scale: 1.55,
          duration: 650,
          ease: 'Sine.easeInOut',
          onComplete: () => petal.destroy(),
        });
      });
      return petal;
    });

    this.tweens.add({
      targets: ribbon,
      alpha: 0,
      duration: 1540,
      delay: 180,
      ease: 'Sine.easeOut',
      onComplete: () => {
        petals.forEach((petal) => petal.destroy());
        ribbon.destroy();
      },
    });
  }

  private playEnergyTransfer(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2, color: number, textColor: number): void {
    const line = this.add.line(0, 0, from.x, from.y, to.x, to.y, color, 0.72).setOrigin(0, 0).setDepth(27);
    line.setLineWidth(4);
    const orb = this.add.circle(from.x, from.y, 9, color, 0.88).setDepth(28);
    orb.setStrokeStyle(2, textColor, 0.85);
    this.tweens.add({
      targets: line,
      alpha: 0,
      duration: 760,
      ease: 'Sine.easeOut',
      onComplete: () => line.destroy(),
    });
    this.tweens.add({
      targets: orb,
      x: to.x,
      y: to.y,
      scale: 1.45,
      duration: 720,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.playImpactBurst(to.x, to.y, color);
        orb.destroy();
      },
    });
  }

  private playTaoistRune(x: number, y: number, color: number): void {
    const rune = this.add.container(x, y).setDepth(27);
    const outer = this.add.circle(0, 0, 46, color, 0.08).setStrokeStyle(3, color, 0.8);
    const inner = this.add.circle(0, 0, 24, 0x071d18, 0.1).setStrokeStyle(2, 0xffffff, 0.42);
    const lineA = this.add.line(0, 0, -34, 0, 34, 0, color, 0.74).setOrigin(0, 0).setLineWidth(3);
    const lineB = this.add.line(0, 0, 0, -34, 0, 34, color, 0.74).setOrigin(0, 0).setLineWidth(3);
    rune.add([outer, inner, lineA, lineB]);
    this.tweens.add({
      targets: rune,
      angle: 120,
      scale: 1.34,
      alpha: 0,
      duration: 980,
      ease: 'Sine.easeOut',
      onComplete: () => rune.destroy(true),
    });
  }

  private playTalismanFlight(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2): void {
    const talisman = this.add.container(from.x, from.y).setDepth(29);
    const paper = this.add.rectangle(0, 0, 30, 46, 0xd9f8de, 0.96).setStrokeStyle(2, 0x72d8b3, 1);
    const seal = this.add.text(0, 0, '符', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#1e8b6d',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    talisman.add([paper, seal]);
    this.tweens.add({
      targets: talisman,
      x: to.x,
      y: to.y,
      angle: 320,
      duration: 520,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.playShockwave(to.x, to.y, 0x72d8b3, 125);
        this.tweens.add({
          targets: talisman,
          alpha: 0,
          scale: 1.35,
          duration: 360,
          ease: 'Sine.easeOut',
          onComplete: () => talisman.destroy(true),
        });
      },
    });
  }

  private playTalismanBurn(x: number, y: number): void {
    const flame = this.add.container(x, y).setDepth(33);
    const paper = this.add.rectangle(0, 0, 36, 54, 0xd9f8de, 0.96).setStrokeStyle(2, 0x72d8b3, 1);
    const seal = this.add.text(0, 0, '符', {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#1e8b6d',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const glow = this.add.circle(0, 0, 24, 0x9cf3c5, 0.24);
    flame.add([glow, paper, seal]);
    this.tweens.add({
      targets: flame,
      scaleX: 1.52,
      scaleY: 1.86,
      alpha: 0,
      angle: Phaser.Math.Between(-18, 18),
      duration: 620,
      ease: 'Cubic.easeOut',
      onComplete: () => flame.destroy(true),
    });
  }

  private enemySeatCenter(index: number): Phaser.Math.Vector2 {
    const seat = this.enemySeatForIndex(index);
    const hud = this.enemyHudLayout(index);
    return new Phaser.Math.Vector2(seat.x + hud.portrait.x, seat.y + hud.portrait.y);
  }

  private flashEnemySeat(index: number, color: number, label: string, textColor: string): void {
    const center = this.enemySeatCenter(index);
    const hud = this.enemyHudLayout(index);
    const topSeat = this.enemyHudSeat(index) === 'top';
    const overlay = this.add.container(center.x, center.y).setDepth(28);
    const radius = Math.min(hud.portrait.width, hud.portrait.height) / 2;
    const glow = this.add.circle(0, 0, radius + 12, color, 0.12).setStrokeStyle(4, color, 1);
    const inner = this.add.circle(0, 0, radius - 7, color, 0.04).setStrokeStyle(2, color, 0.58);
    const text = this.add.text(topSeat ? radius + 18 : 0, topSeat ? -radius + 14 : -radius - 42, label, {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: textColor,
      fontStyle: 'bold',
      stroke: '#101114',
      strokeThickness: 5,
    }).setOrigin(topSeat ? 0 : 0.5, 0.5);
    text.setShadow(0, 0, textColor, 14, true, true);
    overlay.add([glow, inner, text]);
    overlay.setAlpha(0);
    overlay.setScale(0.94);

    this.tweens.add({
      targets: overlay,
      alpha: 1,
      scale: 1,
      duration: PASSIVE_EFFECT_TIMING.flashIn,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(PASSIVE_EFFECT_TIMING.flashHold, () => {
          this.tweens.add({
            targets: overlay,
            alpha: 0,
            scale: 1.08,
            duration: PASSIVE_EFFECT_TIMING.flashOut,
            ease: 'Sine.easeOut',
            onComplete: () => overlay.destroy(true),
          });
        });
      },
    });
  }

  private playShockwave(x: number, y: number, color: number, radius: number): void {
    const wave = this.add.circle(x, y, 18, color, 0.08).setStrokeStyle(5, color, 0.95).setDepth(24);
    this.tweens.add({
      targets: wave,
      radius,
      alpha: 0,
      duration: PASSIVE_EFFECT_TIMING.shockwave,
      ease: 'Cubic.easeOut',
      onComplete: () => wave.destroy(),
    });
  }

  private playSummonColumn(x: number, y: number, color: number): void {
    const column = this.add.rectangle(x, y, 74, 210, color, 0.24).setDepth(25);
    column.setStrokeStyle(3, color, 0.9);
    this.tweens.add({
      targets: column,
      alpha: 0,
      scaleY: 1.32,
      duration: PASSIVE_EFFECT_TIMING.shockwave,
      ease: 'Sine.easeOut',
      onComplete: () => column.destroy(),
    });
  }

  private playInsightLine(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2, color: number): void {
    const line = this.add.line(0, 0, from.x, from.y, to.x, to.y, color, 0.9).setOrigin(0, 0).setDepth(27);
    line.setLineWidth(4);
    this.tweens.add({
      targets: line,
      alpha: 0,
      duration: PASSIVE_EFFECT_TIMING.insightLine,
      ease: 'Sine.easeOut',
      onComplete: () => line.destroy(),
    });
  }

  private playCardShuffleBurst(x: number, y: number, color: number): void {
    for (let index = 0; index < 5; index += 1) {
      const card = this.add.rectangle(x - 36 + index * 18, y, 26, 36, 0xf2f2ed, 0.92).setStrokeStyle(2, color, 0.9).setDepth(27);
      card.setAngle(-16 + index * 8);
      this.tweens.add({
        targets: card,
        x: x + Math.sin(index) * 52,
        y: y - 34 - index * 4,
        angle: card.angle + 110,
        alpha: 0,
        duration: PASSIVE_EFFECT_TIMING.shuffleCard,
        ease: 'Cubic.easeOut',
        delay: index * 38,
        onComplete: () => card.destroy(),
      });
    }
  }

  private playBloodReturn(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2, color: number): void {
    const orb = this.add.circle(from.x, from.y - 18, 10, color, 0.82).setDepth(27);
    orb.setStrokeStyle(3, 0xffffff, 0.38);
    this.tweens.add({
      targets: orb,
      x: to.x,
      y: to.y,
      scale: 1.35,
      duration: PASSIVE_EFFECT_TIMING.bloodReturn,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.playImpactBurst(to.x, to.y, color);
        orb.destroy();
      },
    });
  }

  private playCombatAnimation(event: BattleCombatPresentationEvent): void {
    const enemy = this.battle.enemies.find((item) => item.id === event.enemyId);
    if (!enemy) {
      return;
    }

    const enemyIndex = this.battle.enemies.indexOf(enemy);
    const positions = this.combatPositions(enemy);
    if (event.type === 'clash') {
      this.setEnemyPortraitPose(enemyIndex, 'attack', 900);
      this.playEnemyPortraitAttackMotion(enemyIndex);
      this.playClashAnimation(positions.player, positions.enemy, enemy);
      return;
    }

    if (!event.attacker) {
      return;
    }

    if (event.attacker === 'player') {
      if (event.guard) {
        this.playBladeToRescueCombatAnimation(event, enemy, positions.player, positions.enemy);
        return;
      }

      if (event.evaded) {
        this.playPlayerAttackEffect(
          positions.player,
          positions.enemy,
          event.resonance,
          1,
          () => undefined,
          () => this.playSmokeSubstitutionEvadeEffect(enemy, positions.enemy),
        );
        return;
      }

      this.playPlayerAttackEffect(positions.player, positions.enemy, event.resonance, event.amount, (damage) => {
        if (damage > 0) {
          this.setEnemyPortraitPose(enemyIndex, 'hurt', 920);
        }
        this.sound.play('damageExplosion', { volume: event.resonance === 'strong' ? 0.62 : 0.5 });
        this.applyVisualDamage(event, enemy, damage);
        this.playImpactBurst(positions.enemy.x, positions.enemy.y, event.resonance === 'strong' ? 0xf5d66b : SKILL_COLORS.player);
        this.playDamageText(positions.enemy.x, positions.enemy.y - 42, damage);
        this.shakeSeat(enemy.id);
      });
      return;
    }

    this.setEnemyPortraitPose(enemyIndex, 'attack', 900);
    this.playEnemyPortraitAttackMotion(enemyIndex);
    if (event.shielded) {
      this.playProjectile(positions.enemy, positions.player, SKILL_COLORS[enemy.id], enemyName(enemy.id), event.resonance === 'resonance' || event.resonance === 'strong', () => {
        this.playHolyShieldBlock(event.originalAmount ?? 0);
      });
      return;
    }

    this.playProjectile(positions.enemy, positions.player, SKILL_COLORS[enemy.id], enemyName(enemy.id), event.resonance === 'resonance' || event.resonance === 'strong', () => {
      this.setPlayerPortraitPose('hurt', 920);
      this.sound.play('damageExplosion', { volume: 0.5 });
      this.applyVisualDamage(event, enemy);
      this.playImpactBurst(positions.player.x, positions.player.y, SKILL_COLORS[enemy.id]);
      this.playDamageText(positions.player.x, positions.player.y - 42, event.amount);
      this.shakeSeat('player');
    });
  }

  private playPlayerAttackEffect(
    from: Phaser.Math.Vector2,
    to: Phaser.Math.Vector2,
    resonance: ScoreResult['resonance'] | undefined,
    damage: number,
    onHit: (damage: number) => void,
    onComplete?: () => void,
  ): void {
    this.setPlayerPortraitPose('attack');
    this.playPlayerPortraitAttackMotion();
    const resonantAttack = resonance === 'resonance' || resonance === 'strong';
    const equippedAttackEffect = getProgress().equippedAttackEffect;
    const complete = () => {
      if (this.playerPortraitPose === 'attack') {
        this.setPlayerPortraitPose(this.playerDisplayHp() <= 0 ? 'hurt' : 'idle');
      }
      onComplete?.();
    };
    if (resonantAttack && equippedAttackEffect === 'sakura_slash') {
      this.playSakuraSlashAttack(from, to, resonance === 'strong', damage, onHit, complete);
      return;
    }

    if (resonantAttack && equippedAttackEffect === 'thunder_hammer') {
      this.playThunderHammerAttack(to, resonance === 'strong' ? 'strong' : 'resonance', () => {
        onHit(damage);
        complete();
      });
      return;
    }

    if (resonantAttack && equippedAttackEffect === 'jade_sword_array') {
      this.playJadeSwordArray(from, to, resonance === 'strong' ? 'strong' : 'resonance', () => {
        onHit(damage);
        complete();
      });
      return;
    }

    this.playProjectile(from, to, SKILL_COLORS.player, t('common.player'), resonantAttack, () => {
      onHit(damage);
      complete();
    });
  }

  private playBladeToRescueCombatAnimation(
    event: Extract<BattleCombatPresentationEvent, { type: 'damage' }>,
    protectedEnemy: EnemyState,
    playerPosition: Phaser.Math.Vector2,
    protectedPosition: Phaser.Math.Vector2,
  ): void {
    const guard = event.guard;
    if (!guard) {
      return;
    }

    const protector = this.battle.enemies[guard.protectorEnemyIndex];
    const protectorPanel = protector && this.seatContainers.get(protector.id);
    if (!protector || !protectorPanel) {
      return;
    }

    this.playBladeToRescueSequence(event, protectedEnemy, protector, protectorPanel, playerPosition, protectedPosition);
  }

  private playBladeToRescueSequence(
    event: Extract<BattleCombatPresentationEvent, { type: 'damage' }>,
    protectedEnemy: EnemyState,
    protector: EnemyState,
    protectorPanel: Phaser.GameObjects.Container,
    playerPosition: Phaser.Math.Vector2,
    protectedPosition: Phaser.Math.Vector2,
  ): void {
    const guard = event.guard;
    if (!guard) {
      return;
    }

    const red = 0xf05f42;
    const gold = 0xf5d66b;
    const protectorPosition = this.enemySeatCenter(guard.protectorEnemyIndex);
    const homePosition = new Phaser.Math.Vector2(protectorPanel.x, protectorPanel.y);
    const incomingDirection = new Phaser.Math.Vector2(
      playerPosition.x - protectedPosition.x,
      playerPosition.y - protectedPosition.y,
    ).normalize();
    const blockPosition = new Phaser.Math.Vector2(
      protectedPosition.x + incomingDirection.x * 76,
      protectedPosition.y + incomingDirection.y * 76,
    );
    const homeDepth = protectorPanel.depth;
    let lastTrailAt = 0;

    this.setEnemyPortraitPose(guard.protectorEnemyIndex, 'cast');
    this.flashEnemySeat(guard.protectorEnemyIndex, red, t('battle.passive.chivalry'), '#ff9a72');
    this.sound.play('attackWind', { volume: 0.56 });
    protectorPanel.setDepth(27);
    this.time.delayedCall(90, () => {
      this.tweens.add({
        targets: protectorPanel,
        x: blockPosition.x,
        y: blockPosition.y,
        alpha: 1,
        scaleX: 1.06,
        scaleY: 1.06,
        duration: 380,
        ease: 'Cubic.easeIn',
        onUpdate: () => {
          if (this.time.now - lastTrailAt < 54) {
            return;
          }
          lastTrailAt = this.time.now;
          this.spawnTrail(protectorPanel.x, protectorPanel.y, red);
        },
      });
    });

    this.playPlayerAttackEffect(playerPosition, blockPosition, event.resonance, event.amount, () => undefined, () => {
      this.playBladeGuardBurst(blockPosition.x, blockPosition.y, red, gold);
      this.sound.play('damageExplosion', { volume: 0.5 });
      this.flashEnemySeat(this.battle.enemies.indexOf(protectedEnemy), gold, t('battle.passive.chivalryBlocked'), '#ffe29a');

      this.time.delayedCall(340, () => {
        this.setEnemyVisualHp(guard.protectorEnemyIndex, guard.protectorHpAfter);
        this.setEnemyPortraitPose(
          guard.protectorEnemyIndex,
          'hurt',
          guard.protectorHpAfter > 0 ? 920 : undefined,
        );
        this.playDamageText(blockPosition.x, blockPosition.y - 48, guard.preventedDamage);
        this.tweens.add({
          targets: protectorPanel,
          scaleX: 1.16,
          scaleY: 1.16,
          duration: 110,
          yoyo: true,
          ease: 'Sine.easeInOut',
        });

        if (!guard.legacyAttackBonus) {
          this.time.delayedCall(220, () => {
            this.tweens.add({
              targets: protectorPanel,
              x: homePosition.x,
              y: homePosition.y,
              scaleX: 1,
              scaleY: 1,
              duration: 480,
              ease: 'Cubic.easeOut',
              onComplete: () => protectorPanel.setDepth(homeDepth),
            });
          });
          return;
        }

        this.flashEnemySeat(guard.protectorEnemyIndex, red, t('battle.passive.chivalry'), '#ff9a72');
        this.tweens.add({
          targets: protectorPanel,
          scale: 1.28,
          alpha: 0,
          duration: 520,
          ease: 'Cubic.easeOut',
        });
        this.time.delayedCall(520, () => {
          this.playEnergyTransfer(protectorPosition, protectedPosition, red, gold);
          this.flashEnemySeat(
            this.battle.enemies.indexOf(protectedEnemy),
            gold,
            t('battle.passive.chivalryLegacy'),
            '#ffe29a',
          );
        });
      });
    });
  }

  private playBladeGuardBurst(x: number, y: number, red: number, gold: number): void {
    const burst = this.add.graphics().setDepth(29);
    burst.lineStyle(8, gold, 0.95);
    burst.beginPath();
    burst.moveTo(x - 44, y + 36);
    burst.lineTo(x + 44, y - 36);
    burst.moveTo(x - 38, y - 42);
    burst.lineTo(x + 38, y + 42);
    burst.strokePath();
    burst.lineStyle(3, 0xffffff, 0.94);
    burst.beginPath();
    burst.moveTo(x - 48, y);
    burst.lineTo(x + 48, y);
    burst.strokePath();
    const ring = this.add.circle(x, y, 20, red, 0.16).setDepth(28).setStrokeStyle(4, gold, 0.9);
    this.tweens.add({
      targets: [burst, ring],
      alpha: 0,
      scale: 2.4,
      duration: 520,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        burst.destroy();
        ring.destroy();
      },
    });
  }

  private playThunderHammerAttack(to: Phaser.Math.Vector2, resonance: 'resonance' | 'strong' | undefined, onHit: () => void): void {
    const strong = resonance === 'strong';
    const stormColor = 0x7fd7ff;
    const goldColor = 0xf6d86b;
    const startY = Math.max(58, to.y - 230);
    const hammer = this.add.container(to.x - 34, startY).setDepth(24).setAlpha(0);
    const handle = this.add.rectangle(0, -16, 12, 98, 0x6b4a2a).setStrokeStyle(2, strong ? goldColor : 0xf4d58a);
    const head = this.add.rectangle(0, 34, 92, 34, 0x4d5566).setStrokeStyle(strong ? 4 : 3, strong ? goldColor : 0xd7e8ff);
    const glow = this.add.circle(0, 34, strong ? 64 : 56, strong ? goldColor : stormColor, strong ? 0.18 : 0.16);
    hammer.add([glow, handle, head]);
    hammer.setAngle(-18);
    hammer.setScale(0.92);

    const charge = this.add.circle(to.x, to.y, strong ? 18 : 12, stormColor, strong ? 0.24 : 0.18).setDepth(22);
    this.tweens.add({
      targets: charge,
      scale: strong ? 7.4 : 5.8,
      alpha: 0,
      duration: strong ? 660 : 520,
      ease: 'Cubic.easeOut',
      onComplete: () => charge.destroy(),
    });

    this.sound.play('attackWind', { volume: strong ? 0.68 : 0.56 });
    this.tweens.add({
      targets: hammer,
      y: to.y - 30,
      x: to.x - 10,
      angle: 8,
      alpha: 1,
      scale: 1.12,
      duration: strong ? 560 : 520,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.playLightningStrike(to.x, to.y, stormColor, goldColor, strong);
        onHit();
        this.tweens.add({
          targets: hammer,
          y: to.y - 92,
          alpha: 0,
          duration: 360,
          ease: 'Quad.easeOut',
          onComplete: () => hammer.destroy(true),
        });
      },
    });
  }

  private playSakuraSlashAttack(
    from: Phaser.Math.Vector2,
    to: Phaser.Math.Vector2,
    strong: boolean,
    damage: number,
    onHit: (damage: number) => void,
    onComplete: () => void,
  ): void {
    const pink = 0xff79bd;
    const softPink = 0xffb7dc;
    const finalColor = 0xffefbd;
    const travelAngle = Phaser.Math.RadToDeg(Phaser.Math.Angle.Between(from.x, from.y, to.x, to.y)) + 90;
    const travelDirection = new Phaser.Math.Vector2(to.x - from.x, to.y - from.y).normalize();
    const cutEnd = new Phaser.Math.Vector2(to.x, to.y).add(travelDirection.scale(112));
    const katana = this.createSakuraKatana(from.x, from.y - 10, pink, finalColor, strong)
      .setAngle(travelAngle - 82)
      .setAlpha(0)
      .setScale(0.94);
    const launchGlow = this.add.circle(from.x, from.y - 14, strong ? 38 : 32, pink, strong ? 0.18 : 0.14)
      .setDepth(22)
      .setStrokeStyle(strong ? 3 : 2, softPink, 0.76);
    let lastTrailAt = 0;

    this.sound.play('attackWind', { volume: strong ? 0.72 : 0.62 });
    this.playSakuraPetals(from.x, from.y - 14, strong ? 7 : 4, pink, strong);
    this.tweens.add({
      targets: launchGlow,
      scale: strong ? 2.8 : 2.2,
      alpha: 0,
      duration: 330,
      ease: 'Cubic.easeOut',
      onComplete: () => launchGlow.destroy(),
    });

    this.tweens.add({
      targets: katana,
      x: cutEnd.x,
      y: cutEnd.y - 10,
      angle: travelAngle + 102,
      alpha: 1,
      scale: strong ? 1.22 : 1.12,
      duration: 470,
      ease: 'Cubic.easeIn',
      onUpdate: () => {
        if (this.time.now - lastTrailAt < 54) {
          return;
        }
        lastTrailAt = this.time.now;
        this.createSakuraKatanaAfterimage(katana.x, katana.y, katana.angle, pink, strong);
      },
      onComplete: () => {
        katana.destroy(true);
      },
    });

    this.time.delayedCall(340, () => {
      const wound = this.createSakuraWound(to.x, to.y, pink, finalColor, strong);
      this.sound.play('sakuraCut', { volume: strong ? 0.68 : 0.56 });
      this.playSakuraPetals(to.x, to.y, strong ? 9 : 5, pink, strong);

      this.time.delayedCall(strong ? 420 : 360, () => {
        this.playSakuraCutImpact(to.x, to.y, pink, softPink, strong);
        if (strong) {
          this.playShockwave(to.x, to.y, finalColor, 108);
        }
        onHit(damage);

        this.tweens.killTweensOf(wound);
        this.tweens.add({
          targets: wound,
          alpha: 0,
          scaleX: 1.7,
          scaleY: 1.35,
          duration: 420,
          delay: 80,
          ease: 'Cubic.easeOut',
          onComplete: () => {
            wound.destroy(true);
            onComplete();
          },
        });
      });
    });
  }

  private createSakuraWound(
    x: number,
    y: number,
    pink: number,
    gold: number,
    strong: boolean,
  ): Phaser.GameObjects.Container {
    const wound = this.add.container(x, y).setDepth(30);
    const size = strong ? 88 : 72;
    const shadow = this.add.graphics();
    shadow.lineStyle(strong ? 13 : 11, 0x3b1028, 0.72);
    shadow.beginPath();
    shadow.moveTo(-size, size * 0.62);
    shadow.lineTo(size, -size * 0.62);
    shadow.strokePath();

    const edge = this.add.graphics();
    edge.lineStyle(strong ? 8 : 7, strong ? gold : pink, 0.96);
    edge.beginPath();
    edge.moveTo(-size, size * 0.62);
    edge.lineTo(size, -size * 0.62);
    edge.strokePath();

    const core = this.add.graphics();
    core.lineStyle(strong ? 3 : 2, 0xffffff, 0.98);
    core.beginPath();
    core.moveTo(-size * 0.9, size * 0.54);
    core.lineTo(size * 0.9, -size * 0.54);
    core.strokePath();

    const glow = this.add.circle(0, 0, strong ? 34 : 26, pink, strong ? 0.2 : 0.15)
      .setStrokeStyle(strong ? 4 : 3, strong ? gold : pink, 0.82);
    wound.add([glow, shadow, edge, core]);
    wound.setScale(0.84);
    this.tweens.add({
      targets: wound,
      scale: 1.06,
      duration: strong ? 230 : 190,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    return wound;
  }

  private createSakuraKatana(x: number, y: number, pink: number, gold: number, strong: boolean): Phaser.GameObjects.Container {
    const katana = this.add.container(x, y).setDepth(25);
    const glow = this.add.circle(0, -24, strong ? 42 : 35, pink, strong ? 0.23 : 0.18);
    const trail = this.add.rectangle(0, 38, strong ? 24 : 20, strong ? 174 : 154, pink, 0.2);
    const blade = this.add.rectangle(0, -34, strong ? 18 : 15, strong ? 142 : 126, 0xfdf4fa, 0.98)
      .setStrokeStyle(strong ? 4 : 3, strong ? gold : pink);
    const bladeCore = this.add.rectangle(0, -34, strong ? 5 : 4, strong ? 126 : 112, 0xffffff, 0.92);
    const guard = this.add.rectangle(0, 38, strong ? 54 : 46, 9, gold, 0.96).setStrokeStyle(2, pink, 0.86);
    const handle = this.add.rectangle(0, 72, 12, 52, 0x241923, 0.98).setStrokeStyle(2, pink, 0.9);
    katana.add([glow, trail, blade, bladeCore, guard, handle]);
    return katana;
  }

  private createSakuraKatanaAfterimage(x: number, y: number, angle: number, pink: number, strong: boolean): void {
    const afterimage = this.add.rectangle(x, y, strong ? 18 : 15, strong ? 142 : 126, pink, strong ? 0.26 : 0.2)
      .setDepth(23)
      .setAngle(angle);
    this.tweens.add({
      targets: afterimage,
      alpha: 0,
      scaleY: 0.72,
      duration: strong ? 300 : 240,
      ease: 'Quad.easeOut',
      onComplete: () => afterimage.destroy(),
    });
  }

  private playSakuraCutImpact(x: number, y: number, pink: number, softPink: number, strong: boolean): void {
    const size = strong ? 82 : 66;
    const scars = this.add.graphics().setDepth(29);
    scars.lineStyle(strong ? 8 : 6, strong ? 0xfff3d5 : pink, 0.96);
    scars.beginPath();
    scars.moveTo(x - size, y + size * 0.64);
    scars.lineTo(x + size, y - size * 0.64);
    scars.strokePath();

    const flash = this.add.circle(x, y, strong ? 34 : 26, 0xffffff, strong ? 0.24 : 0.18).setDepth(28);
    const ring = this.add.circle(x, y, strong ? 32 : 24, pink, strong ? 0.2 : 0.15)
      .setDepth(27)
      .setStrokeStyle(strong ? 4 : 3, softPink, 0.88);
    this.tweens.add({
      targets: [scars, flash, ring],
      alpha: 0,
      scale: strong ? 2.5 : 2.1,
      duration: strong ? 480 : 400,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        scars.destroy();
        flash.destroy();
        ring.destroy();
      },
    });
    this.playSakuraPetals(x, y, strong ? 14 : 9, pink, strong);
  }

  private playSakuraPetals(x: number, y: number, count: number, color: number, strong: boolean): void {
    for (let index = 0; index < count; index += 1) {
      const petal = this.add.ellipse(
        x + Phaser.Math.Between(-18, 18),
        y + Phaser.Math.Between(-18, 18),
        strong ? 10 : 8,
        strong ? 18 : 14,
        color,
        strong ? 0.9 : 0.78,
      ).setDepth(26).setAngle(Phaser.Math.Between(-50, 50));
      const angle = Phaser.Math.FloatBetween(-Math.PI, Math.PI);
      const distance = Phaser.Math.Between(strong ? 48 : 30, strong ? 112 : 76);
      this.tweens.add({
        targets: petal,
        x: petal.x + Math.cos(angle) * distance,
        y: petal.y + Math.sin(angle) * distance - Phaser.Math.Between(6, 28),
        angle: petal.angle + Phaser.Math.Between(-150, 150),
        alpha: 0,
        duration: strong ? 520 : 400,
        ease: 'Sine.easeOut',
        onComplete: () => petal.destroy(),
      });
    }
  }

  private playJadeSwordArray(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2, resonance: 'resonance' | 'strong' | undefined, onHit: () => void): void {
    const strong = resonance === 'strong';
    const jade = 0x65dfbd;
    const gold = 0xf5d66b;
    const swordCount = 5;
    const seal = this.add.circle(from.x, from.y - 24, strong ? 34 : 26, jade, 0.14)
      .setDepth(21)
      .setStrokeStyle(strong ? 4 : 3, strong ? gold : jade, strong ? 0.9 : 0.76);
    const sealGlyph = this.add.text(from.x, from.y - 24, '剑', {
      fontFamily: 'Arial',
      fontSize: strong ? '27px' : '22px',
      color: strong ? '#f8edb3' : '#d7fff0',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(22);
    sealGlyph.setShadow(0, 0, strong ? '#f5d66b' : '#65dfbd', 12, true, true);

    this.tweens.add({
      targets: [seal, sealGlyph],
      scale: strong ? 2.4 : 2,
      alpha: 0,
      angle: strong ? 90 : 54,
      duration: strong ? 620 : 480,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        seal.destroy();
        sealGlyph.destroy();
      },
    });

    this.sound.play('attackWind', { volume: strong ? 0.68 : 0.54 });
    let completed = 0;
    for (let index = 0; index < swordCount; index += 1) {
      const spread = index / (swordCount - 1) - 0.5;
      const startX = from.x + spread * (strong ? 126 : 88);
      const startY = from.y - 56 - Math.abs(spread) * (strong ? 54 : 38);
      const targetX = to.x + spread * (strong ? 84 : 56);
      const targetY = to.y - 8 + Math.abs(spread) * (strong ? 34 : 22);
      const sword = this.createJadeSword(startX, startY, jade, gold, strong && index === swordCount - 1);
      let lastTrailAt = 0;

      this.tweens.add({
        targets: sword,
        x: targetX,
        y: targetY,
        angle: 68 + spread * 36,
        alpha: 1,
        duration: strong ? 430 : 340,
        delay: 90 + index * (strong ? 74 : 48),
        ease: 'Cubic.easeIn',
        onUpdate: () => {
          if (this.time.now - lastTrailAt < 64) {
            return;
          }
          lastTrailAt = this.time.now;
          this.createSwordAfterimage(sword.x, sword.y, sword.angle, jade, strong);
        },
        onComplete: () => {
          this.playSwordImpact(targetX, targetY, jade, gold, strong && index === swordCount - 1);
          sword.destroy(true);
          completed += 1;
          if (completed === swordCount) {
            onHit();
          }
        },
      });
    }
  }

  private createJadeSword(x: number, y: number, jade: number, gold: number, gilded: boolean): Phaser.GameObjects.Container {
    const sword = this.add.container(x, y).setDepth(24).setAlpha(0).setAngle(-58);
    const glow = this.add.circle(0, -12, gilded ? 28 : 23, gilded ? gold : jade, gilded ? 0.2 : 0.16);
    const trail = this.add.rectangle(0, 26, gilded ? 16 : 12, gilded ? 72 : 58, jade, 0.16);
    const blade = this.add.rectangle(0, -18, gilded ? 11 : 9, gilded ? 66 : 58, 0xd8fff1, 0.96)
      .setStrokeStyle(gilded ? 3 : 2, gilded ? gold : jade);
    const guard = this.add.rectangle(0, 16, gilded ? 34 : 28, 6, gold, 0.92);
    const handle = this.add.rectangle(0, 34, 7, 24, 0x264b45, 0.95).setStrokeStyle(1, gold, 0.72);
    sword.add([glow, trail, blade, guard, handle]);
    return sword;
  }

  private createSwordAfterimage(x: number, y: number, angle: number, jade: number, strong: boolean): void {
    const afterimage = this.add.rectangle(x, y, strong ? 10 : 8, strong ? 64 : 52, jade, strong ? 0.2 : 0.16)
      .setDepth(22)
      .setAngle(angle);
    this.tweens.add({
      targets: afterimage,
      alpha: 0,
      scaleY: 0.62,
      duration: strong ? 260 : 210,
      ease: 'Quad.easeOut',
      onComplete: () => afterimage.destroy(),
    });
  }

  private playSwordImpact(x: number, y: number, jade: number, gold: number, gilded: boolean): void {
    const impact = this.add.graphics().setDepth(25);
    const size = gilded ? 42 : 32;
    impact.lineStyle(gilded ? 6 : 4, gold, 0.96);
    impact.beginPath();
    impact.moveTo(x - size, y + size * 0.72);
    impact.lineTo(x + size, y - size * 0.72);
    impact.moveTo(x - size * 0.72, y - size);
    impact.lineTo(x + size * 0.72, y + size);
    impact.strokePath();
    impact.lineStyle(gilded ? 3 : 2, 0xe9fff5, 0.96);
    impact.beginPath();
    impact.moveTo(x - size * 0.9, y + size * 0.64);
    impact.lineTo(x + size * 0.9, y - size * 0.64);
    impact.strokePath();

    const ring = this.add.circle(x, y, gilded ? 24 : 18, jade, gilded ? 0.18 : 0.14)
      .setDepth(23)
      .setStrokeStyle(gilded ? 4 : 3, gold, 0.84);
    this.tweens.add({
      targets: [impact, ring],
      alpha: 0,
      scale: gilded ? 2.6 : 2.1,
      duration: gilded ? 410 : 300,
      ease: 'Quad.easeOut',
      onComplete: () => {
        impact.destroy();
        ring.destroy();
      },
    });
  }

  private playLightningStrike(x: number, y: number, stormColor: number, goldColor: number, strong = false): void {
    const bolt = this.add.graphics().setDepth(23);
    const topY = Math.max(40, y - (strong ? 300 : 250));
    const points = [
      new Phaser.Math.Vector2(x + Phaser.Math.Between(strong ? -28 : -18, strong ? 28 : 18), topY),
      new Phaser.Math.Vector2(x + Phaser.Math.Between(strong ? -52 : -34, strong ? 52 : 34), y - (strong ? 205 : 170)),
      new Phaser.Math.Vector2(x + Phaser.Math.Between(strong ? -44 : -28, strong ? 44 : 28), y - (strong ? 118 : 96)),
      new Phaser.Math.Vector2(x + Phaser.Math.Between(strong ? -26 : -18, strong ? 26 : 18), y - 20),
      new Phaser.Math.Vector2(x, y),
    ];

    bolt.lineStyle(strong ? 14 : 10, 0xffffff, 0.95);
    bolt.beginPath();
    bolt.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => bolt.lineTo(point.x, point.y));
    bolt.strokePath();
    bolt.lineStyle(strong ? 6 : 4, stormColor, 1);
    bolt.beginPath();
    bolt.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => bolt.lineTo(point.x, point.y));
    bolt.strokePath();
    if (strong) {
      this.drawLightningFork(bolt, x, y, stormColor, -1);
      this.drawLightningFork(bolt, x, y, stormColor, 1);
      this.drawLightningFork(bolt, x, y, goldColor, -1);
      this.drawLightningFork(bolt, x, y, goldColor, 1);
      this.drawLightningFork(bolt, x, y, stormColor, Phaser.Math.Between(0, 1) === 0 ? -1 : 1);
    }

    const ring = this.add.circle(x, y, strong ? 28 : 20, goldColor, strong ? 0.24 : 0.18).setDepth(22).setStrokeStyle(strong ? 5 : 4, stormColor, 0.8);
    const core = this.add.circle(x, y, strong ? 14 : 10, 0xffffff, 0.9).setDepth(24);
    const localFlash = this.add.circle(x, y, strong ? 46 : 34, 0xffffff, strong ? 0.22 : 0.18).setDepth(23);
    const outerRing = strong
      ? this.add.circle(x, y, 42, stormColor, 0.08).setDepth(21).setStrokeStyle(3, goldColor, 0.72)
      : undefined;

    this.tweens.add({
      targets: bolt,
      alpha: 0,
      duration: strong ? 360 : 260,
      ease: 'Quad.easeOut',
      onComplete: () => {
        bolt.destroy();
      },
    });
    this.tweens.add({
      targets: ring,
      scale: strong ? 5.6 : 4.6,
      alpha: 0,
      duration: strong ? 680 : 520,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
    this.tweens.add({
      targets: core,
      scale: 2.8,
      alpha: 0,
      duration: 300,
      ease: 'Quad.easeOut',
      onComplete: () => core.destroy(),
    });
    this.tweens.add({
      targets: localFlash,
      scale: 2.2,
      alpha: 0,
      duration: 240,
      ease: 'Quad.easeOut',
      onComplete: () => localFlash.destroy(),
    });
    if (outerRing) {
      this.tweens.add({
        targets: outerRing,
        scale: 4.8,
        alpha: 0,
        duration: 780,
        ease: 'Cubic.easeOut',
        onComplete: () => outerRing.destroy(),
      });
    }
  }

  private drawLightningFork(graphics: Phaser.GameObjects.Graphics, x: number, y: number, color: number, direction: -1 | 1): void {
    const startX = x + Phaser.Math.Between(-18, 18);
    const startY = y - Phaser.Math.Between(92, 158);
    const endX = x + direction * Phaser.Math.Between(54, 92);
    const endY = startY + Phaser.Math.Between(24, 54);
    graphics.lineStyle(3, 0xffffff, 0.82);
    graphics.beginPath();
    graphics.moveTo(startX, startY);
    graphics.lineTo((startX + endX) / 2 + direction * 14, (startY + endY) / 2);
    graphics.lineTo(endX, endY);
    graphics.strokePath();
    graphics.lineStyle(2, color, 0.92);
    graphics.beginPath();
    graphics.moveTo(startX, startY);
    graphics.lineTo((startX + endX) / 2 + direction * 14, (startY + endY) / 2);
    graphics.lineTo(endX, endY);
    graphics.strokePath();
  }

  private applyVisualDamage(event: Extract<BattleCombatPresentationEvent, { type: 'damage' }>, enemy: EnemyState, amount = event.amount): void {
    if (!this.visualHpOverride) {
      return;
    }

    if (event.attacker === 'player') {
      const enemyIndex = this.battle.enemies.indexOf(enemy);
      const hpAfterHit = Math.max(0, this.visualHpOverride.enemies[enemyIndex] - amount);
      this.setEnemyVisualHp(enemyIndex, hpAfterHit);
      return;
    }

    const hpAfterHit = Math.max(0, this.visualHpOverride.player - amount);
    this.visualHpOverride.player = hpAfterHit;
    this.playerHeartMeter?.setHp(hpAfterHit, true);
  }

  private setEnemyVisualHp(enemyIndex: number, hp: number): void {
    const enemy = this.battle.enemies[enemyIndex];
    if (!enemy || !this.visualHpOverride) {
      return;
    }

    this.visualHpOverride.enemies[enemyIndex] = hp;
    this.visualEnemyDefeated![enemyIndex] = hp <= 0;
    this.enemyHeartMeters.get(enemy.id)?.setHp(hp, true);
  }

  private combatPositions(enemy: EnemyState): { player: Phaser.Math.Vector2; enemy: Phaser.Math.Vector2 } {
    const enemyIndex = this.battle.enemies.indexOf(enemy);
    const enemySeat = this.enemySeatForIndex(enemyIndex);
    const enemyLayout = this.enemyHudLayout(enemyIndex);
    return {
      enemy: new Phaser.Math.Vector2(enemySeat.x + enemyLayout.portrait.x, enemySeat.y + enemyLayout.portrait.y),
      player: new Phaser.Math.Vector2(this.battleLayout.seats.player.x, this.battleLayout.seats.player.y),
    };
  }

  private enemySeatForIndex(index: number): { x: number; y: number; width: number; height: number } {
    return this.battle.enemies.length === 1 ? this.battleLayout.seats.enemies[1] : this.battleLayout.seats.enemies[index];
  }

  private enemyHudSeat(index: number): keyof BattleLayoutConfig['enemyHud'] {
    if (this.battle.enemies.length === 1 || index === 1) {
      return 'top';
    }

    return index === 0 ? 'left' : 'right';
  }

  private enemyHudLayout(index: number): BattleLayoutConfig['enemyHud']['left'] {
    return this.battleLayout.enemyHud[this.enemyHudSeat(index)];
  }

  private playProjectile(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2, color: number, label: string, resonantAttack: boolean, onHit: () => void): void {
    let lastTrailAt = 0;
    const projectile = this.add.container(from.x, from.y).setDepth(20);
    projectile.add(this.add.circle(0, 0, 28, color, 0.16));
    projectile.add(this.add.circle(0, 0, 18, color, 0.34));
    projectile.add(this.add.circle(0, 0, 9, 0xffffff, 0.92));
    const rune = this.add.text(0, 0, label.slice(0, 2), {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: COLORS.text,
    }).setOrigin(0.5);
    rune.setShadow(0, 0, '#ffffff', 8, true, true);
    projectile.add(rune);

    this.sound.play(resonantAttack ? 'attackWind' : 'attackFire', { volume: resonantAttack ? 0.48 : 0.45 });
    this.tweens.add({
      targets: projectile,
      x: to.x,
      y: to.y,
      scaleX: 1.16,
      scaleY: 1.16,
      duration: 640,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        if (this.time.now - lastTrailAt < 48) {
          return;
        }

        lastTrailAt = this.time.now;
        this.spawnTrail(projectile.x, projectile.y, color);
      },
      onComplete: () => {
        projectile.destroy(true);
        onHit();
      },
    });
  }

  private playClashAnimation(playerPosition: Phaser.Math.Vector2, enemyPosition: Phaser.Math.Vector2, enemy: EnemyState): void {
    const midpoint = new Phaser.Math.Vector2((playerPosition.x + enemyPosition.x) / 2, (playerPosition.y + enemyPosition.y) / 2);
    let arrived = 0;
    const onArrive = () => {
      arrived += 1;
      if (arrived < 2) {
        return;
      }

      this.playImpactBurst(midpoint.x, midpoint.y, 0xffffff);
      this.playClashText(midpoint.x, midpoint.y - 34);
    };

    this.playProjectile(playerPosition, midpoint, SKILL_COLORS.player, t('common.player'), false, onArrive);
    this.playProjectile(enemyPosition, midpoint, SKILL_COLORS[enemy.id], enemyName(enemy.id), false, onArrive);
  }

  private spawnTrail(x: number, y: number, color: number): void {
    const trail = this.add.circle(x, y, 13, color, 0.28).setDepth(18);
    this.tweens.add({
      targets: trail,
      scale: 0.24,
      alpha: 0,
      duration: 420,
      ease: 'Quad.easeOut',
      onComplete: () => trail.destroy(),
    });
  }

  private playImpactBurst(x: number, y: number, color: number): void {
    const outer = this.add.circle(x, y, 8, color, 0.36).setDepth(19);
    const inner = this.add.circle(x, y, 4, 0xffffff, 0.9).setDepth(20);
    this.tweens.add({
      targets: outer,
      scale: 5,
      alpha: 0,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => outer.destroy(),
    });
    this.tweens.add({
      targets: inner,
      scale: 3,
      alpha: 0,
      duration: 280,
      ease: 'Quad.easeOut',
      onComplete: () => inner.destroy(),
    });
  }

  private playDamageText(x: number, y: number, amount: number): void {
    const text = this.add.text(x, y, `-${amount} HP`, {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: COLORS.red,
      stroke: '#101114',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(21);

    this.tweens.add({
      targets: text,
      y: y - 42,
      alpha: 0,
      duration: 760,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  private playHealGainText(x: number, y: number, amount: number, depth = 21): void {
    const text = this.add.text(x, y, `+${amount} HP`, {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: COLORS.green,
      stroke: '#101114',
      strokeThickness: 4,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(depth);
    text.setShadow(0, 0, COLORS.green, 12, true, true);

    this.tweens.add({
      targets: text,
      y: y - 42,
      alpha: 0,
      duration: 720,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  private playClashText(x: number, y: number): void {
    const text = this.add.text(x, y, t('battle.clashText'), {
      fontFamily: 'Arial',
      fontSize: '26px',
      color: '#d9f4ff',
      stroke: '#101114',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(21);
    text.setShadow(0, 0, '#73c7ff', 10, true, true);

    this.tweens.add({
      targets: text,
      y: y - 34,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  private shakeSeat(id: string): void {
    const container = this.seatContainers.get(id);
    if (!container) {
      return;
    }

    const startX = container.x;
    this.tweens.add({
      targets: container,
      x: startX + 9,
      duration: 44,
      yoyo: true,
      repeat: 5,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        container.x = startX;
      },
    });
  }

  private enemyCardsText(enemy: EnemyState): string {
    if (enemy.defeated && enemy.hand.length === 0) {
      return t('battle.notParticipating');
    }

    if (this.dealing || this.actionDealing) {
      const enemyIndex = this.battle.enemies.indexOf(enemy);
      const visibleCount = Math.min(this.dealtEnemyCards[enemyIndex] ?? 0, enemy.hand.length);
      return enemy.hand.slice(0, visibleCount).map((card, index) => (index === 0 ? formatCard(card) : '??')).join(' ');
    }

    if (enemy.revealed || (this.battle.roundRevealed && this.battle.results.some((result) => result.enemy === enemy))) {
      return enemy.hand.map(formatCard).join(' ');
    }

    return [formatCard(enemy.hand[0]), ...enemy.hand.slice(1).map(() => '??')].join(' ');
  }

  private playerCardsText(): string {
    if (this.dealing || this.actionDealing) {
      return this.battle.player.hand.slice(0, this.dealtPlayerCards).map(() => '??').join(' ');
    }

    if (this.playerRedealing) {
      return this.battle.player.hand.slice(0, this.dealtPlayerCards).map(formatCard).join(' ');
    }

    if (this.battle.phase === 'choice') {
      return this.battle.player.hand.map(() => '??').join(' ');
    }

    if (this.battle.player.fateMode && !this.battle.roundRevealed) {
      return this.battle.player.hand.map(() => '??').join(' ');
    }

    return this.battle.player.hand.map(formatCard).join(' ');
  }

  private phaseText(uiState: BattleUIState = this.createUIState()): string {
    const params = { ...(uiState.center.phaseTextParams ?? {}) };
    if (uiState.center.phaseRiskTextKey) {
      params.risk = t(uiState.center.phaseRiskTextKey);
    }

    return t(uiState.center.phaseTextKey, params);
  }

  private scoreEnemy(enemy: EnemyState) {
    return this.battle.results.find((result) => result.enemy === enemy)?.enemyScore ?? scoreHand(enemy.hand);
  }

  private shouldShowEnemyScore(enemy: EnemyState): boolean {
    return !(this.revealFocusPlaying && this.revealFocusPendingEnemyIds.has(enemy.id))
      && (enemy.revealed || this.battle.roundRevealed)
      && this.battle.results.some((result) => result.enemy === enemy);
  }

  private isResultPhase(): boolean {
    return this.battle.phase === 'round-result' || this.battle.phase === 'battle-result';
  }
}

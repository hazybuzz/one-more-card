import Phaser from 'phaser';
import { BattleEngine, type BattleCombatPresentationEvent, type BattlePresentationEvent } from '../game/engine';
import { preloadCardImages } from '../game/assets';
import { playBattleMusic, preloadBattleMusic, stopBattleMusic, stopLobbyMusic } from '../game/audio';
import { Card, cardImageIndex, formatCard } from '../game/card';
import { introIdForLevel } from '../game/data/levelIntros';
import { EconomyChange, settleBattleEconomy } from '../game/economy';
import { EnemyState } from '../game/enemy';
import { enemyName, enemyPersonality, t } from '../game/i18n';
import { useBattleItem } from '../game/itemEffects';
import { ITEMS, ItemDefinition } from '../game/items';
import { consumeItem, getProgress } from '../game/progress';
import { ScoreResult, scoreHand } from '../game/scoring';
import { completeStoryLevelAndUnlockNext, getNextStoryLevel } from '../game/storyProgress';
import type { BattleState } from '../game/core/BattleState';
import type { BattleMechanicId } from '../game/types/level';
import type { ItemId } from '../game/types/item';
import { ActionPanel } from '../ui/components/ActionPanel';
import { BlockingMessageModal } from '../ui/components/BlockingMessageModal';
import { ItemBar } from '../ui/components/ItemBar';
import { SkillBar } from '../ui/components/SkillBar';
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
};

const SEATS = {
  player: { x: 640, y: 550, width: 520, height: 176 },
  enemy: [
    { x: 190, y: 326, width: 360, height: 178 },
    { x: 640, y: 126, width: 420, height: 190 },
    { x: 1090, y: 326, width: 360, height: 178 },
  ],
};

export class BattleScene extends Phaser.Scene {
  private battle!: BattleEngine;
  private battleEconomySettled = false;
  private economyResult?: EconomyChange;
  private resultModalReady = true;
  private itemModalOpen = false;
  private confirmReturnToStorySelect = false;
  private itemFeedback?: { title: string; message: string; success: boolean };
  private temporaryItems: Partial<Record<ItemId, number>> = {};
  private grantedItemRoundIds = new Set<string>();
  private dealing = false;
  private playerRedealing = false;
  private actionDealing = false;
  private autoAdvancingRound = false;
  private stageBannerPlaying = false;
  private actionAnimationPlaying = false;
  private dealingRound = 0;
  private dealtPlayerCards = 0;
  private dealtEnemyCards = [0, 0, 0];
  private echoedResonanceRound = 0;
  private visualHpOverride?: { player: number; enemies: number[] };
  private enemySpeech?: { enemyId: string; text: string };
  private playerHpText?: Phaser.GameObjects.Text;
  private enemyHpTexts = new Map<string, Phaser.GameObjects.Text>();
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

  constructor() {
    super('BattleScene');
  }

  preload(): void {
    preloadBattleMusic(this);
    preloadCardImages(this);

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

  init(data?: { levelId?: string }): void {
    this.battleLevelId = data?.levelId;
  }

  create(): void {
    stopLobbyMusic(this);
    playBattleMusic(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => stopBattleMusic(this));
    this.battle = new BattleEngine({ levelId: this.battleLevelId });
    this.battleEconomySettled = false;
    this.economyResult = undefined;
    this.resultModalReady = true;
    this.autoAdvancingRound = false;
    this.confirmReturnToStorySelect = false;
    this.blockingMessage = undefined;
    this.temporaryItems = {};
    this.grantedItemRoundIds.clear();
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
    this.playRoundStartBannerThenDeal();
  }

  private render(): void {
    this.settleEconomyIfNeeded();
    this.grantFixedRoundItemsIfNeeded();
    this.children.removeAll(true);
    this.ui.forEach((item) => item.destroy(true));
    this.ui = [];
    this.seatContainers.clear();
    this.playerHpText = undefined;
    this.enemyHpTexts.clear();

    this.addBackground();
    this.renderEnemies();
    this.renderCenterInfo();
    this.renderPlayer();
    this.renderLog();
    this.renderStoryReturnButton();
    this.renderActions();
    this.renderItemModal();
    this.renderItemFeedback();
    this.renderResultModal();
    this.renderStoryReturnConfirmModal();
    this.renderBlockingMessage();
  }

  private addBackground(): void {
    this.add.rectangle(640, 360, 1280, 720, COLORS.bg);
    this.add.rectangle(640, 360, 1280, 720, 0x14161a);
    this.add.circle(640, 350, 205, 0x191c22, 0.95).setStrokeStyle(2, COLORS.line);
    this.add.circle(640, 350, 145, 0x101114, 0.5).setStrokeStyle(1, 0x2b303c);
  }

  private renderEnemies(): void {
    this.battle.enemies.forEach((enemy, index) => {
      const seat = this.enemySeatForIndex(index);
      const container = this.add.container(seat.x, seat.y);
      this.ui.push(container);
      this.seatContainers.set(enemy.id, container);
      const active = this.battle.currentEnemyIndex === index && this.battle.phase === 'enemy-turn';
      const defeatedColor = enemy.defeated ? 0x24262b : COLORS.panel;
      container.add(this.add.rectangle(0, 0, seat.width, seat.height, active ? COLORS.panelAlt : defeatedColor).setStrokeStyle(2, active ? COLORS.accent : COLORS.line));
      container.add(this.add.text(-seat.width / 2 + 18, -seat.height / 2 + 18, enemyName(enemy.id), { fontFamily: 'Arial', fontSize: '22px', color: enemy.defeated ? COLORS.muted : COLORS.text }));
      const hp = this.hpText(seat.width / 2 - 118, -seat.height / 2 + 18, t('common.hp', { hp: this.enemyDisplayHp(index), maxHp: enemy.maxHp }), enemy.defeated);
      this.enemyHpTexts.set(enemy.id, hp);
      container.add(hp);
      container.add(this.add.text(-seat.width / 2 + 18, -seat.height / 2 + 48, enemy.defeated ? t('common.defeated') : enemyPersonality(enemy.id), { fontFamily: 'Arial', fontSize: '15px', color: enemy.defeated ? COLORS.green : COLORS.muted }));
      this.renderEnemyCardRow(container, enemy, index, -seat.width / 2 + 20, -seat.height / 2 + 108);

      if (this.shouldShowEnemyScore(enemy)) {
        this.renderScoreBadge(container, seat.width / 2 - 84, 34, this.scoreEnemy(enemy).point);
        if (this.hasMechanic('resonance')) {
          container.add(this.resonanceLabel(-seat.width / 2 + 20, seat.height / 2 - 26, this.scoreEnemy(enemy)));
        }
      }

      this.renderEnemySpeech(container, enemy, seat);

      if (this.hasMechanic('enemy_passives') && enemy.id !== 'bartender') {
        container.add(this.enemyPassiveIcon(enemy, index, seat));
      }
    });
  }

  private renderCenterInfo(): void {
    const battleState = this.battle.getState();
    const uiState = this.createUIState(battleState);
    const container = this.add.container(640, 342);
    this.ui.push(container);

    container.add(this.add.text(0, -86, t('battle.title', { round: battleState.round }), { fontFamily: 'Arial', fontSize: '28px', color: COLORS.text }).setOrigin(0.5));
    container.add(this.add.text(0, -44, this.phaseText(uiState), { fontFamily: 'Arial', fontSize: '17px', color: COLORS.muted, align: 'center', wordWrap: { width: 430 } }).setOrigin(0.5));

    const targetText = t('battle.target', { target: battleState.currentEnemyId && battleState.phase === 'enemy-turn' ? enemyName(battleState.currentEnemyId) : t('battle.targetNone') });
    container.add(this.add.text(0, 18, targetText, { fontFamily: 'Arial', fontSize: '21px', color: '#e8cf73' }).setOrigin(0.5));

    const tutorialText = this.currentTutorialText(battleState);
    if (tutorialText) {
      const tutorial = this.add.text(0, 82, tutorialText, {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: COLORS.text,
        align: 'center',
        lineSpacing: 5,
        wordWrap: { width: 540 },
      }).setOrigin(0.5);
      tutorial.setShadow(0, 0, COLORS.accentText, 6, true, true);
      container.add(tutorial);
      return;
    }

    const aliveText = t('battle.aliveInfo', { alive: battleState.aliveEnemyIds.length, total: battleState.enemies.length });
    container.add(this.add.text(0, 58, aliveText, { fontFamily: 'Arial', fontSize: '14px', color: COLORS.muted }).setOrigin(0.5));
  }

  private currentTutorialText(state: BattleState): string {
    if (state.currentFixedRoundId) {
      return '';
    }

    if (state.phase === 'choice' && state.currentLessonKey) {
      return t(state.currentLessonKey);
    }

    if (state.phase === 'enemy-turn' && state.currentTutorialBeforeCompareKey) {
      return t(state.currentTutorialBeforeCompareKey);
    }

    return '';
  }

  private renderPlayer(): void {
    const seat = SEATS.player;
    const container = this.add.container(seat.x, seat.y);
    this.ui.push(container);
    this.seatContainers.set('player', container);

    container.add(this.add.rectangle(0, 0, seat.width, seat.height, COLORS.panel).setStrokeStyle(2, COLORS.line));
    container.add(this.add.text(-seat.width / 2 + 20, -seat.height / 2 + 18, t('common.playerDealer'), { fontFamily: 'Arial', fontSize: '24px', color: COLORS.text }));
    this.playerHpText = this.hpText(seat.width / 2 - 132, -seat.height / 2 + 18, t('common.hp', { hp: this.playerDisplayHp(), maxHp: this.battle.player.maxHp }));
    container.add(this.playerHpText);
    this.renderPlayerCardRow(container, -seat.width / 2 + 22, -seat.height / 2 + 98);

    if (this.battle.phase !== 'choice' && !this.playerRedealing) {
      const score = this.battle.playerScore();
      this.renderScoreBadge(container, seat.width / 2 - 86, 28, score.point);
      if (this.hasMechanic('resonance')) {
        container.add(this.resonanceLabel(-seat.width / 2 + 22, seat.height / 2 - 28, score, '18px'));
      }
    } else if (this.battle.phase === 'choice') {
      container.add(this.add.text(-seat.width / 2 + 22, seat.height / 2 - 32, t('battle.handHidden'), { fontFamily: 'Arial', fontSize: '18px', color: COLORS.muted }));
    }

    const uiState = this.createUIState();
    if (this.hasMechanic('skills')) {
      container.add(SkillBar.render(this, {
        x: seat.width / 2 + 54,
        y: -42,
        skills: uiState.skills,
        colors: {
          cooldown: COLORS.dangerText,
          line: COLORS.line,
          muted: COLORS.muted,
          resonance: COLORS.resonance,
          text: COLORS.text,
        },
        tooltipOrigin: { x: SEATS.player.x, y: SEATS.player.y },
        onShowTooltip: (x, y, title, body) => this.showSkillTooltip(x, y, title, body),
        onHideTooltip: () => this.hideSkillTooltip(),
        onUse: (kind, title, tooltip, tooltipX, tooltipY) => {
          this.playClickSound();
          this.runAction(() => {
            const result = this.battle.execute({
              type: 'use-skill',
              skill: kind === 'shift' ? 'resonance-shift' : 'resonance-summon',
            });
            if (!result?.used) {
              this.showSkillTooltip(tooltipX, tooltipY, title, result?.message ?? tooltip);
            }
          });
        },
      }));
    }
    if (this.hasMechanic('soul_redeem')) {
      container.add(this.playerPassiveIcon(seat));
    }
    if (this.hasMechanic('items')) {
      container.add(ItemBar.render(this, {
        x: -seat.width / 2 - 42,
        y: 42,
        enabled: uiState.itemButton.enabled,
        label: t('battle.itemButton'),
        colors: {
          accent: COLORS.accent,
          accentText: COLORS.accentText,
          line: COLORS.line,
          muted: COLORS.muted,
          panelEnabled: 0x2a2e38,
          panelDisabled: 0x20232a,
          text: COLORS.text,
        },
        onOpen: () => {
          this.playClickSound();
          this.itemModalOpen = true;
          this.render();
        },
      }));
    }
  }

  private createUIState(state: BattleState = this.battle.getState()): BattleUIState {
    const ownedItemCount = this.totalBattleItemCount();
    return createBattleUIState(state, {
      dealing: this.dealing,
      playerRedealing: this.playerRedealing,
      actionDealing: this.actionDealing,
      stageBannerPlaying: this.stageBannerPlaying,
      actionAnimationPlaying: this.actionAnimationPlaying,
      ownedItemCount,
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
    return this.battle.hasMechanic(mechanic);
  }

  private startDealPresentation(): void {
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
    this.playStageBanner(t('battle.banner.soulRedeem'), onComplete, false, COLORS.resonance, '#4b3000');
  }

  private playStageBanner(label: string, onComplete: () => void, renderBefore = true, color = COLORS.dangerText, stroke = '#3a070d'): void {
    this.stageBannerPlaying = true;
    this.itemModalOpen = false;
    if (renderBefore) {
      this.render();
    }

    const container = this.add.container(640, 342).setDepth(70);
    const blocker = this.add.rectangle(0, 18, 1280, 720, 0x000000, 0.01).setInteractive();
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

      this.playDealCard(to, () => {
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

      this.playDealCard(to, () => {
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
    const seat = SEATS.player;
    return new Phaser.Math.Vector2(
      seat.x - seat.width / 2 + 46 + cardIndex * 44,
      seat.y - seat.height / 2 + 76,
    );
  }

  private dealTargetForEnemy(enemyIndex: number, cardIndex: number): Phaser.Math.Vector2 {
    const seat = this.enemySeatForIndex(enemyIndex);
    return new Phaser.Math.Vector2(
      seat.x - seat.width / 2 + 44 + cardIndex * 42,
      seat.y - seat.height / 2 + 94,
    );
  }

  private playDealCard(to: Phaser.Math.Vector2, onComplete: () => void): void {
    const card = this.add.container(640, 350).setDepth(30);
    card.add(this.add.rectangle(0, 0, 34, 48, 0xf2f2ed, 0.96).setStrokeStyle(2, COLORS.accent));
    card.add(this.add.rectangle(0, 0, 24, 36, 0x2b303c, 0.18).setStrokeStyle(1, 0x2b303c, 0.45));
    card.add(this.add.text(0, 0, '?', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#101114',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    this.sound.play('cardSlide', { volume: 0.56 });
    this.tweens.add({
      targets: card,
      x: to.x,
      y: to.y,
      angle: Phaser.Math.Between(-5, 5),
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
      this.playDealCard(this.dealTargetForPlayer(event.cardIndex), () => {
        this.dealtPlayerCards = Math.max(this.dealtPlayerCards, event.cardIndex + 1);
        this.render();
        this.time.delayedCall(70, () => playStep(index + 1));
      });
    };

    playStep(0);
  }

  private renderLog(): void {
    const container = this.add.container(24, 520);
    this.ui.push(container);

    container.add(this.add.text(0, 0, t('battle.logTitle'), { fontFamily: 'Arial', fontSize: '20px', color: COLORS.text }));
    this.battle.log.slice(0, 4).forEach((message, index) => {
      container.add(this.add.text(0, 30 + index * 26, message, {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: index === 0 ? '#f4df91' : COLORS.muted,
        wordWrap: { width: 330 },
      }));
    });
  }

  private renderActions(): void {
    if (this.blockingMessage || this.confirmReturnToStorySelect) {
      return;
    }

    const uiState = this.createUIState();

    if (uiState.inputLocked) {
      return;
    }

    if (uiState.autoAdvanceRound) {
      this.scheduleNextRound();
      return;
    }

    this.ui.push(ActionPanel.render(this, {
      x: 448,
      y: 648,
      buttons: uiState.actionButtons,
      colors: {
        button: COLORS.button,
        danger: COLORS.danger,
      },
      createButton: (x, y, width, height, label, onClick, fill, fontSize, sound) => this.button(x, y, width, height, label, onClick, fill, fontSize, sound),
      onAction: (buttonState) => this.handleActionButton(buttonState),
    }));
  }

  private renderStoryReturnButton(): void {
    if (!this.battle.levelConfig?.id || this.battle.phase === 'battle-result') {
      return;
    }

    const container = this.add.container(1128, 116).setDepth(40);
    this.ui.push(container);
    container.add(this.button(0, 0, 118, 40, t('battle.storyReturn.button'), () => {
      if (this.blockingMessage || this.itemModalOpen || this.itemFeedback || this.actionAnimationPlaying || this.dealing || this.actionDealing || this.playerRedealing) {
        return;
      }

      this.confirmReturnToStorySelect = true;
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
      wordWrap: { width: 390 },
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
      this.playImmediatePresentationEvents(events);
      this.playActionDealEvents(events, () => {
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
      this.autoAdvancingRound = false;
      if (this.battle.phase !== 'round-result' || this.battle.battleOutcome) {
        this.render();
        return;
      }

      this.battle.execute({ type: 'next-round' });
      this.startDealPresentation();
    });
  }

  private settleEconomyIfNeeded(): void {
    if (this.battleEconomySettled || this.battle.phase !== 'battle-result' || !this.battle.battleOutcome) {
      return;
    }

    this.battleEconomySettled = true;
    const economy = settleBattleEconomy(this.battle.battleOutcome, this.battle.player.hp);
    if (this.battle.battleOutcome === 'victory' && this.battle.levelConfig?.id) {
      completeStoryLevelAndUnlockNext(this.battle.levelConfig.id);
    }
    this.economyResult = economy;
    this.battle.log.unshift(this.battle.battleOutcome === 'victory'
      ? t('log.economyVictory', { amount: economy.amount, total: economy.total })
      : t('log.economyDefeat', { total: economy.total }));
  }

  private renderResultModal(): void {
    if (this.itemFeedback || !this.resultModalReady || this.battle.phase !== 'battle-result' || !this.battle.battleOutcome || !this.economyResult) {
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

    const goldText = this.add.text(0, storyResultText ? -90 : -24, t('battle.result.goldGained', { amount: this.economyResult.amount }), {
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
        wordWrap: { width: 430 },
      }).setOrigin(0.5));
    }
    const buttonY = storyResultText ? 134 : 68;
    children.push(this.button(-230, buttonY, 200, 50, t('battle.result.continue'), () => {
      this.continueAfterResult();
    }));
    children.push(this.button(30, buttonY, 200, 50, t('battle.result.returnLobby'), () => {
      this.scene.start('StartScene');
    }));
    container.add(children);
  }

  private continueAfterResult(): void {
    const levelId = this.battle.levelConfig?.id;
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
        wordWrap: { width: 340 },
      }).setOrigin(0.5),
      this.button(-90, 72, 180, 48, t('battle.itemFeedback.confirm'), () => {
        this.itemFeedback = undefined;
        this.render();
      }),
    ]);
  }

  private button(x: number, y: number, width: number, height: number, label: string, onClick: () => void, fill = COLORS.button, fontSize = '19px', sound: 'button' | 'card' = 'button'): Phaser.GameObjects.Container {
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
      this.playClickSound(sound);
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
    container.add(this.add.rectangle(0, 0, 640, 420, COLORS.panel, 0.98).setStrokeStyle(2, COLORS.accent));
    container.add(this.add.text(0, -170, t('battle.itemModal.title'), {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5));
    container.add(this.add.text(0, -132, t('battle.itemModal.phaseHint'), {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: this.battle.phase === 'player-turn' || this.battle.phase === 'choice' ? COLORS.muted : COLORS.dangerText,
    }).setOrigin(0.5));

    if (ownedItems.length === 0) {
      container.add(this.add.text(0, -18, t('battle.itemModal.empty'), {
        fontFamily: 'Arial',
        fontSize: '22px',
        color: COLORS.muted,
      }).setOrigin(0.5));
    } else {
      ownedItems.forEach((item, index) => {
        container.add(this.itemModalRow(item, -260, -86 + index * 92));
      });
    }

    container.add(this.button(-90, 152, 180, 48, t('battle.itemModal.close'), () => {
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
      wordWrap: { width: 310 },
    }));
    row.add(this.button(414, 10, 112, 46, t('battle.itemModal.use'), () => this.useItemFromModal(item), canUse ? COLORS.button : 0x25272d, '18px'));
    return row;
  }

  private useItemFromModal(item: ItemDefinition): void {
    const hpBefore = this.hpSnapshot();
    const result = useBattleItem(item.id, this.battle);
    if (result.used) {
      this.consumeBattleItem(item.id);
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
    this.playImmediatePresentationEvents(events);
    const shouldDelayResultModal = (this.hasBattleEndedEvent(events) || this.battle.pendingSoulRedeem) && this.hasCombatEvents(events);
    this.resultModalReady = !shouldDelayResultModal;
    if (!this.hasCombatEvents(events)) {
      this.render();
    }
    this.playPostActionAnimations(events, hpBefore, false, () => {
      if (!shouldDelayResultModal) {
        this.render();
        return;
      }

      this.resultModalReady = true;
      this.render();
    });
    if (!result.used) {
      this.showSkillTooltip(640, 592, t(item.nameKey), result.message);
    }
  }

  private playBeerHealThenReveal(healed: number, hpBefore: { player: number; enemies: number[] }): void {
    this.itemModalOpen = false;
    this.itemFeedback = undefined;
    this.render();
    this.sound.play('beerBubble', { volume: 0.58 });
    this.playHealGainText(SEATS.player.x, SEATS.player.y - 86, healed);
    this.time.delayedCall(720, () => {
      this.battle.execute({ type: 'reveal-by-item' });
      this.playRoundResonanceEchoOnce();
      const events = this.battle.consumePresentationEvents();
      this.playImmediatePresentationEvents(events);
      const shouldDelayResultModal = (this.hasBattleEndedEvent(events) || this.battle.pendingSoulRedeem) && this.hasCombatEvents(events);
      this.resultModalReady = !shouldDelayResultModal;
      this.playPostActionAnimations(events, hpBefore, false, () => {
        if (this.battle.pendingSoulRedeem) {
          this.playSoulRedeemBannerThen(() => {
            const beforeRedeem = this.hpSnapshot();
            this.battle.resolveSoulRedeem();
            this.playHealSoundIfHpIncreased(beforeRedeem);
            this.startDealPresentation();
          });
          return;
        }

        if (!shouldDelayResultModal) {
          this.render();
          return;
        }

        this.resultModalReady = true;
        this.render();
      });
    });
  }

  private canUseItemNow(item: ItemDefinition): boolean {
    return canUseBattleItemFromState(item.id, this.battle.getState());
  }

  private playerPassiveIcon(seat: { width: number; height: number }): Phaser.GameObjects.Container {
    const active = !this.battle.player.soulRedeemUsed;
    const x = -seat.width / 2 - 42;
    const y = -44;
    const icon = this.add.container(x, y);
    const color = 0xffd86b;
    const textColor = active ? COLORS.resonance : COLORS.muted;
    const rect = this.add.rectangle(0, 0, 54, 44, active ? 0x332c20 : 0x20232a).setStrokeStyle(2, active ? color : COLORS.line);
    const glyph = this.add.text(0, -5, '✚', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: textColor,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const label = this.add.text(0, 14, t('common.passive'), {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: active ? COLORS.text : COLORS.muted,
    }).setOrigin(0.5);

    if (active) {
      glyph.setShadow(0, 0, COLORS.resonance, 10, true, true);
    }

    rect.setInteractive({ useHandCursor: false });
    rect.on('pointerover', () => {
      rect.setFillStyle(0x343947);
      this.showSkillTooltip(SEATS.player.x + x - 190, SEATS.player.y + y - 94, t('skill.soulRedeem.name'), t('skill.soulRedeem.tooltip'));
    });
    rect.on('pointerout', () => {
      rect.setFillStyle(active ? 0x332c20 : 0x20232a);
      this.hideSkillTooltip();
    });

    icon.add([rect, glyph, label]);
    return icon;
  }

  private enemyPassiveIcon(enemy: EnemyState, index: number, seat: { width: number; height: number }): Phaser.GameObjects.Container {
    const passive = this.enemyPassiveInfo(enemy);
    const x = index === 1 ? -seat.width / 2 - 34 : -seat.width / 2 + 34;
    const y = index === 1 ? -seat.height / 2 + 36 : -seat.height / 2 - 32;
    const active = this.enemyPassiveActive(enemy);
    const icon = this.add.container(x, y);
    const rect = this.add.rectangle(0, 0, 54, 44, active ? 0x33262b : 0x20232a).setStrokeStyle(2, active ? passive.color : COLORS.line);
    const glyph = this.add.text(0, -5, passive.icon, {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: active ? passive.textColor : COLORS.muted,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const label = this.add.text(0, 14, t('common.passive'), {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: active ? COLORS.text : COLORS.muted,
    }).setOrigin(0.5);

    if (active) {
      glyph.setShadow(0, 0, passive.textColor, 10, true, true);
    }

    rect.setInteractive({ useHandCursor: false });
    rect.on('pointerover', () => {
      rect.setFillStyle(0x343947);
      const worldSeat = this.enemySeatForIndex(index);
      const worldX = worldSeat.x + x + (index === 1 ? -170 : 150);
      const worldY = worldSeat.y + y + (index === 1 ? 104 : -62);
      this.showSkillTooltip(worldX, worldY, passive.name, passive.description);
    });
    rect.on('pointerout', () => {
      rect.setFillStyle(active ? 0x33262b : 0x20232a);
      this.hideSkillTooltip();
    });

    icon.add([rect, glyph, label]);
    return icon;
  }

  private enemyPassiveInfo(enemy: EnemyState): { name: string; icon: string; description: string; color: number; textColor: string } {
    if (enemy.id === 'goblin') {
      return {
        name: t('skill.goblinInstinct.name'),
        icon: '!',
        description: t('skill.goblinInstinct.tooltip'),
        color: 0x65d46e,
        textColor: '#78d18a',
      };
    }

    if (enemy.id === 'gambler') {
      return {
        name: t('skill.gamblerBlessing.name'),
        icon: '♢',
        description: t('skill.gamblerBlessing.tooltip'),
        color: 0xf25f9a,
        textColor: '#f25f9a',
      };
    }

    return {
      name: t('skill.werewolfLifesteal.name'),
      icon: 'V',
      description: t('skill.werewolfLifesteal.tooltip'),
      color: 0x73c7ff,
      textColor: '#73c7ff',
    };
  }

  private enemyPassiveActive(enemy: EnemyState): boolean {
    if (enemy.id === 'goblin') {
      return enemy.hp < 3 && !enemy.defeated;
    }

    if (enemy.id === 'gambler') {
      return enemy.hp < 3 && !enemy.defeated;
    }

    return enemy.hp < 3 && !enemy.defeated;
  }

  private showSkillTooltip(x: number, y: number, title: string, body: string): void {
    this.hideSkillTooltip();
    const tooltip = this.add.container(x, y).setDepth(50).setName('skill-tooltip');
    const width = 320;
    const bodyText = this.add.text(-width / 2 + 16, -18, body, {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: COLORS.text,
      lineSpacing: 4,
      wordWrap: { width: width - 32 },
    });
    const height = Math.max(104, bodyText.height + 58);
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

  private hpText(x: number, y: number, label: string, muted = false): Phaser.GameObjects.Text {
    const text = this.add.text(x, y, label, {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: muted ? COLORS.muted : COLORS.dangerText,
    });
    if (!muted) {
      text.setShadow(0, 0, COLORS.dangerText, 10, true, true);
    }

    return text;
  }

  private renderScoreBadge(container: Phaser.GameObjects.Container, x: number, y: number, point: number): void {
    const color = this.pointColor(point);
    const badge = this.add.container(x, y);
    badge.add(this.add.circle(0, 0, 31, color.fill, 0.18).setStrokeStyle(2, color.stroke, 0.95));
    badge.add(this.add.circle(0, 0, 22, color.fill, 0.26));
    const pointText = this.add.text(0, -3, `${point}`, {
      fontFamily: 'Arial',
      fontSize: '31px',
      color: color.text,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    pointText.setShadow(0, 0, color.glow, 14, true, true);

    if (point >= 7) {
      pointText.setTint(0xcaff8a, 0x55ff9e, 0x1fd97a, 0x079b5a);
    }

    badge.add(pointText);
    badge.add(this.add.text(0, 20, t('common.pointUnit'), {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: color.text,
    }).setOrigin(0.5));
    container.add(badge);
  }

  private pointColor(point: number): { fill: number; stroke: number; text: string; glow: string } {
    if (point >= 1 && point <= 3) {
      return { fill: 0xff4058, stroke: 0xff6f7f, text: '#ff6f7f', glow: '#ff4058' };
    }

    if (point >= 4 && point <= 6) {
      return { fill: 0xffd45c, stroke: 0xffe58a, text: '#ffdf7a', glow: '#ffd45c' };
    }

    if (point >= 7) {
      return { fill: 0x35e582, stroke: 0x98ff9f, text: '#98ff9f', glow: '#35e582' };
    }

    return { fill: 0x8b96aa, stroke: 0xb5c0d0, text: '#b5c0d0', glow: '#8b96aa' };
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

  private renderEnemyCardRow(container: Phaser.GameObjects.Container, enemy: EnemyState, enemyIndex: number, x: number, y: number): void {
    if (enemy.defeated && enemy.hand.length === 0) {
      container.add(this.add.text(x, y - 12, t('battle.notParticipating'), {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: COLORS.muted,
      }));
      return;
    }

    const visibleCards = this.dealing || this.actionDealing
      ? enemy.hand.slice(0, Math.min(this.dealtEnemyCards[enemyIndex] ?? 0, enemy.hand.length))
      : enemy.hand;
    const showAll = enemy.revealed || (this.battle.roundRevealed && this.battle.results.some((result) => result.enemy === enemy));
    const cards = visibleCards.map((card, index) => ({
      card,
      faceUp: showAll || index === 0,
    }));

    this.renderCardRow(container, x, y, cards, {
      width: 70,
      height: 96,
      spacing: 54,
      resonant: this.enemyHasResonance(enemy),
      muted: enemy.defeated,
    });
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

  private renderEnemySpeech(container: Phaser.GameObjects.Container, enemy: EnemyState, seat: { width: number; height: number }): void {
    if (this.enemySpeech?.enemyId !== enemy.id) {
      return;
    }

    const x = -seat.width / 2 + 112;
    const y = -seat.height / 2 + 30;
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

  private renderPlayerCardRow(container: Phaser.GameObjects.Container, x: number, y: number): void {
    const visibleCards = this.dealing || this.playerRedealing || this.actionDealing
      ? this.battle.player.hand.slice(0, this.dealtPlayerCards)
      : this.battle.player.hand;
    const faceUp = this.playerRedealing || (!this.dealing && this.battle.phase !== 'choice' && (!this.battle.player.fateMode || this.battle.roundRevealed));
    const cards = visibleCards.map((card) => ({ card, faceUp }));

    this.renderCardRow(container, x, y, cards, {
      width: 70,
      height: 96,
      spacing: 54,
      resonant: !this.playerRedealing && this.playerHasResonance(),
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
      if (options.resonant) {
        const glow = this.add.rectangle(cardX + options.width / 2, y, options.width + 8, options.height + 8, COLORS.accent, 0.12)
          .setStrokeStyle(2, COLORS.accent, 0.95);
        glow.setAlpha(options.muted ? 0.28 : 1);
        container.add(glow);
      }

      const key = faceUp ? `card-${cardImageIndex(card)}` : 'card-back';
      const image = this.add.image(cardX, y, key).setOrigin(0, 0.5).setDisplaySize(options.width, options.height);
      if (options.muted) {
        image.setAlpha(0.45);
      }
      container.add(image);
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

  private runAction(action: () => void): void {
    const roundBefore = this.battle.round;
    const hpBefore = this.hpSnapshot();
    const phaseBefore = this.battle.phase;
    const aliveBefore = this.battle.aliveEnemies.length;
    const comparedBefore = this.battle.aliveEnemies.filter((enemy) => enemy.compared).length;
    action();
    this.playRoundResonanceEchoOnce();
    const events = this.battle.consumePresentationEvents();
    this.playImmediatePresentationEvents(events);
    const shouldDelayResultModal = this.hasBattleEndedEvent(events) && this.hasCombatEvents(events);
    const shouldDealNewRound = this.battle.round > roundBefore && this.battle.phase === 'choice' && !this.battle.battleOutcome;
    this.resultModalReady = !shouldDelayResultModal;
    const skipRevealBanner = phaseBefore === 'enemy-turn' && comparedBefore === aliveBefore - 1 && this.hasRoundRevealEvent(events);

    this.playActionDealEvents(events, () => {
      if (!this.hasCombatEvents(events)) {
        this.render();
      }

      this.playPostActionAnimations(events, hpBefore, skipRevealBanner, () => {
        if (this.battle.pendingSoulRedeem) {
          this.playSoulRedeemBannerThen(() => {
            const beforeRedeem = this.hpSnapshot();
            this.battle.resolveSoulRedeem();
            this.playHealSoundIfHpIncreased(beforeRedeem);
            this.startDealPresentation();
          });
          return;
        }

        const continueAfterRevealDialogue = () => {
          if (!shouldDelayResultModal) {
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
  }

  private playPostActionAnimations(events: BattlePresentationEvent[], hpBefore: { player: number; enemies: number[] }, skipRevealBanner = false, onComplete?: () => void): void {
    const combatEvents = this.combatEvents(events);
    if (combatEvents.length === 0) {
      onComplete?.();
      return;
    }

    const playWithDelayedHp = () => {
      this.actionAnimationPlaying = true;
      this.visualHpOverride = hpBefore;
      this.render();
      this.playDamageAnimations(combatEvents, () => {
        this.visualHpOverride = undefined;
        this.actionAnimationPlaying = false;
        onComplete?.();
      });
    };

    if (combatEvents.length > 0 && this.hasRoundRevealEvent(events) && !skipRevealBanner) {
      this.playRevealBannerThen(playWithDelayedHp);
      return;
    }

    playWithDelayedHp();
  }

  private hasCombatEvents(events: BattlePresentationEvent[]): boolean {
    return events.some((event) => event.type === 'damage' || event.type === 'clash');
  }

  private hasRoundRevealEvent(events: BattlePresentationEvent[]): boolean {
    return events.some((event) => event.type === 'round-revealed');
  }

  private hasBattleEndedEvent(events: BattlePresentationEvent[]): boolean {
    return events.some((event) => event.type === 'battle-ended');
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

    events.forEach((event, index) => {
      this.time.delayedCall(index * 820, () => this.playCombatAnimation(event));
    });
    const totalDuration = (events.length - 1) * 820 + 640 + 760 + 120;
    this.time.delayedCall(totalDuration, () => onComplete?.());
  }

  private playCombatAnimation(event: BattleCombatPresentationEvent): void {
    const enemy = this.battle.enemies.find((item) => item.id === event.enemyId);
    if (!enemy) {
      return;
    }

    const positions = this.combatPositions(enemy);
    if (event.type === 'clash') {
      this.playClashAnimation(positions.player, positions.enemy, enemy);
      return;
    }

    if (!event.attacker) {
      return;
    }

    const from = event.attacker === 'player' ? positions.player : positions.enemy;
    const to = event.attacker === 'player' ? positions.enemy : positions.player;
    const color = event.attacker === 'player' ? SKILL_COLORS.player : SKILL_COLORS[enemy.id];
    const label = event.attacker === 'player' ? t('common.player') : enemyName(enemy.id);

    const resonantAttack = event.resonance === 'resonance' || event.resonance === 'strong';
    this.playProjectile(from, to, color, label, resonantAttack, () => {
      this.sound.play('damageExplosion', { volume: 0.5 });
      this.applyVisualDamage(event, enemy);
      this.playImpactBurst(to.x, to.y, color);
      this.playDamageText(to.x, to.y - 42, event.amount);
      this.shakeSeat(event.attacker === 'player' ? enemy.id : 'player');
    });
  }

  private applyVisualDamage(event: Extract<BattleCombatPresentationEvent, { type: 'damage' }>, enemy: EnemyState): void {
    if (!this.visualHpOverride) {
      return;
    }

    if (event.attacker === 'player') {
      const enemyIndex = this.battle.enemies.indexOf(enemy);
      this.visualHpOverride.enemies[enemyIndex] = enemy.hp;
      this.enemyHpTexts.get(enemy.id)?.setText(t('common.hp', { hp: enemy.hp, maxHp: enemy.maxHp }));
      return;
    }

    this.visualHpOverride.player = this.battle.player.hp;
    this.playerHpText?.setText(t('common.hp', { hp: this.battle.player.hp, maxHp: this.battle.player.maxHp }));
  }

  private combatPositions(enemy: EnemyState): { player: Phaser.Math.Vector2; enemy: Phaser.Math.Vector2 } {
    const enemyIndex = this.battle.enemies.indexOf(enemy);
    const enemySeat = this.enemySeatForIndex(enemyIndex);
    return {
      enemy: new Phaser.Math.Vector2(enemySeat.x, enemySeat.y),
      player: new Phaser.Math.Vector2(SEATS.player.x, SEATS.player.y),
    };
  }

  private enemySeatForIndex(index: number): { x: number; y: number; width: number; height: number } {
    return this.battle.enemies.length === 1 ? SEATS.enemy[1] : SEATS.enemy[index];
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

  private playHealGainText(x: number, y: number, amount: number): void {
    const text = this.add.text(x, y, `+${amount} HP`, {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: COLORS.green,
      stroke: '#101114',
      strokeThickness: 4,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(21);
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
    return (enemy.revealed || this.battle.roundRevealed) && this.battle.results.some((result) => result.enemy === enemy);
  }

  private isResultPhase(): boolean {
    return this.battle.phase === 'round-result' || this.battle.phase === 'battle-result';
  }
}

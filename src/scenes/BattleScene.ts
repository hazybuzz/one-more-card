import Phaser from 'phaser';
import { BattleEngine, type BattleCombatPresentationEvent, type BattlePresentationEvent } from '../game/engine';
import { preloadCardImages } from '../game/assets';
import { playBattleMusic, preloadBattleMusic, stopBattleMusic, stopLobbyMusic } from '../game/audio';
import { Card, cardImageIndex, formatCard } from '../game/card';
import { EconomyChange, settleBattleEconomy } from '../game/economy';
import { EnemyState } from '../game/enemy';
import { enemyName, enemyPersonality, t } from '../game/i18n';
import { useBattleItem } from '../game/itemEffects';
import { ITEMS, ItemDefinition } from '../game/items';
import { consumeItem, getProgress } from '../game/progress';
import { ScoreResult, scoreHand } from '../game/scoring';

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
  heat: '#ff4b5f',
  resonance: '#ffd86b',
  green: '#78d18a',
  button: 0x303542,
  buttonHover: 0x41495b,
  danger: 0x734143,
};

const SKILL_COLORS = {
  player: 0xffb84d,
  goblin: 0x65d46e,
  gambler: 0xf25f9a,
  werewolf: 0x73c7ff,
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
  private itemFeedback?: { title: string; message: string; success: boolean };
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

  create(data?: { levelId?: string }): void {
    stopLobbyMusic(this);
    playBattleMusic(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => stopBattleMusic(this));
    this.battle = new BattleEngine({ levelId: data?.levelId });
    this.battleEconomySettled = false;
    this.economyResult = undefined;
    this.resultModalReady = true;
    this.autoAdvancingRound = false;
    this.playRoundStartBannerThenDeal();
  }

  private render(): void {
    this.settleEconomyIfNeeded();
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
    this.renderActions();
    this.renderItemModal();
    this.renderItemFeedback();
    this.renderResultModal();
  }

  private addBackground(): void {
    this.add.rectangle(640, 360, 1280, 720, COLORS.bg);
    this.add.rectangle(640, 360, 1280, 720, 0x14161a);
    this.add.circle(640, 350, 205, 0x191c22, 0.95).setStrokeStyle(2, COLORS.line);
    this.add.circle(640, 350, 145, 0x101114, 0.5).setStrokeStyle(1, 0x2b303c);
  }

  private renderEnemies(): void {
    this.battle.enemies.forEach((enemy, index) => {
      const seat = SEATS.enemy[index];
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
        container.add(this.resonanceLabel(-seat.width / 2 + 20, seat.height / 2 - 26, this.scoreEnemy(enemy)));
      }

      this.renderEnemySpeech(container, enemy, seat);

      container.add(this.enemyPassiveIcon(enemy, index, seat));
    });
  }

  private renderCenterInfo(): void {
    const container = this.add.container(640, 342);
    this.ui.push(container);

    container.add(this.add.text(0, -86, t('battle.title', { round: this.battle.round }), { fontFamily: 'Arial', fontSize: '28px', color: COLORS.text }).setOrigin(0.5));
    container.add(this.add.text(0, -44, this.phaseText(), { fontFamily: 'Arial', fontSize: '17px', color: COLORS.muted, align: 'center', wordWrap: { width: 430 } }).setOrigin(0.5));

    const currentEnemy = this.battle.currentEnemy;
    const targetText = t('battle.target', { target: currentEnemy && this.battle.phase === 'enemy-turn' ? enemyName(currentEnemy.id) : t('battle.targetNone') });
    container.add(this.add.text(0, 18, targetText, { fontFamily: 'Arial', fontSize: '21px', color: '#e8cf73' }).setOrigin(0.5));

    const playerRisk = this.battle.player.incomingDamageBonus > 0 ? t('battle.playerRisk') : '';
    const heatColor = this.heatTextColor();
    const heatText = this.add.text(0, 58, t('battle.heat', {
      heat: this.battle.heat,
      bonus: this.battle.heatDamageBonus,
      stage: this.battle.heatStage,
      playerRisk,
    }), {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: heatColor,
    }).setOrigin(0.5);
    heatText.setShadow(0, 0, heatColor, this.battle.heat >= 3 ? 14 : 6, true, true);
    container.add(heatText);

    const aliveText = t('battle.aliveInfo', { alive: this.battle.aliveEnemies.length, total: this.battle.enemies.length });
    container.add(this.add.text(0, 90, aliveText, { fontFamily: 'Arial', fontSize: '14px', color: COLORS.muted }).setOrigin(0.5));
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
      container.add(this.resonanceLabel(-seat.width / 2 + 22, seat.height / 2 - 28, score, '18px'));
    } else if (this.battle.phase === 'choice') {
      container.add(this.add.text(-seat.width / 2 + 22, seat.height / 2 - 32, t('battle.handHidden'), { fontFamily: 'Arial', fontSize: '18px', color: COLORS.muted }));
    }

    container.add(this.skillSlot('shift', seat.width / 2 + 54, -42));
    container.add(this.skillSlot('summon', seat.width / 2 + 54, 42));
    container.add(this.itemSlot(-seat.width / 2 - 42, 42));
    container.add(this.playerPassiveIcon(seat));
  }

  private heatTextColor(): string {
    if (this.battle.heat >= 6) {
      return COLORS.heat;
    }

    if (this.battle.heat >= 3) {
      return COLORS.resonance;
    }

    return COLORS.muted;
  }

  private startDealPresentation(): void {
    this.dealing = true;
    this.dealingRound = this.battle.round;
    this.dealtPlayerCards = 0;
    this.dealtEnemyCards = [0, 0, 0];
    this.itemModalOpen = false;
    this.itemFeedback = undefined;
    const dealEvents = this.battle.currentRoundDealEvents();
    this.render();
    this.playDealSequence(dealEvents, () => {
      this.dealing = false;
      this.dealtPlayerCards = this.battle.player.hand.length;
      this.dealtEnemyCards = this.battle.enemies.map((enemy) => enemy.hand.length);
      this.render();
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

  private playStageBanner(label: string, onComplete: () => void, renderBefore = true, color = COLORS.heat, stroke = '#3a070d'): void {
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
    const seat = SEATS.enemy[enemyIndex];
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
    const container = this.add.container(448, 648);
    this.ui.push(container);

    if (this.dealing || this.playerRedealing || this.actionDealing || this.stageBannerPlaying || this.actionAnimationPlaying) {
      return;
    }

    if (this.battle.phase === 'choice') {
      container.add(this.button(0, 0, 190, 48, t('battle.button.viewHand'), () => {
        this.battle.execute({ type: 'choose-view-hand' });
        this.playRoundResonanceEchoOnce();
        this.render();
      }, COLORS.button, '19px', 'card'));
      return;
    }

    if (this.battle.phase === 'enemy-turn') {
      const currentEnemy = this.battle.currentEnemy;
      if (currentEnemy?.invited === undefined) {
        container.add(this.button(0, 0, 190, 48, t('battle.button.inviteOne'), () => {
          this.battle.execute({ type: 'invite-current-enemy' });
          const events = this.battle.consumePresentationEvents();
          this.playImmediatePresentationEvents(events);
          this.playActionDealEvents(events, () => this.render());
        }, COLORS.button, '19px', 'card'));
      }

      container.add(this.button(currentEnemy?.invited === undefined ? 210 : 0, 0, 170, 48, t('battle.button.compare'), () => {
        this.runAction(() => this.battle.execute({ type: 'compare-current-enemy' }));
      }, COLORS.button, '19px', 'card'));
      return;
    }

    if (this.battle.phase === 'player-turn') {
      if (!this.battle.player.drawLocked && this.battle.player.drawCountThisRound < 2) {
        const isSecondDraw = this.battle.player.drawCountThisRound === 1;
        container.add(this.button(0, 0, isSecondDraw ? 236 : 200, 48, isSecondDraw ? t('battle.button.drawRisk') : t('battle.button.draw'), () => {
          this.runAction(() => this.battle.execute({ type: 'player-draw' }));
        }, isSecondDraw ? COLORS.danger : COLORS.button, '19px', 'card'));
      }
      container.add(this.button(256, 0, 180, 48, t('battle.button.stand'), () => {
        this.runAction(() => this.battle.execute({ type: 'player-stand' }));
      }, COLORS.button, '19px', 'card'));
      return;
    }

    if (this.battle.phase === 'round-result') {
      this.scheduleNextRound();
      return;
    }
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
    container.add(this.add.rectangle(0, 0, 420, 282, COLORS.panel, 0.98).setStrokeStyle(2, isVictory ? 0x78d18a : 0xff4b5f));

    const titleColor = isVictory ? COLORS.green : COLORS.heat;
    const title = this.add.text(0, -88, isVictory ? t('battle.result.victory') : t('battle.result.defeat'), {
      fontFamily: 'Arial',
      fontSize: '46px',
      color: titleColor,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    title.setShadow(0, 0, titleColor, 12, true, true);

    const goldText = this.add.text(0, -24, t('battle.result.goldGained', { amount: this.economyResult.amount }), {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#e8cf73',
    }).setOrigin(0.5);
    goldText.setShadow(0, 0, '#e8cf73', 8, true, true);

    container.add([
      title,
      goldText,
      this.add.text(0, 18, t('battle.result.totalGold', { total: this.economyResult.total }), {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: COLORS.muted,
      }).setOrigin(0.5),
      this.button(-110, 68, 220, 50, t('battle.result.returnLobby'), () => {
        this.scene.start('StartScene');
      }),
    ]);
  }

  private renderItemFeedback(): void {
    if (!this.itemFeedback || this.battle.phase === 'battle-result') {
      return;
    }

    const container = this.add.container(640, 360).setDepth(90);
    this.ui.push(container);
    const stroke = this.itemFeedback.success ? 0x78d18a : 0xff4b5f;
    const titleColor = this.itemFeedback.success ? COLORS.green : COLORS.heat;

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

  private skillSlot(kind: 'shift' | 'summon', x: number, y: number): Phaser.GameObjects.Container {
    const isShift = kind === 'shift';
    const cooldown = isShift ? this.battle.player.resonanceShiftCooldown : this.battle.player.resonanceSummonCooldown;
    const available = !this.dealing
      && !this.playerRedealing
      && !this.actionDealing
      && this.battle.phase === 'player-turn'
      && cooldown === 0
      && (isShift ? this.battle.canUseResonanceShift() : !this.battle.player.resonanceSummonUsed && this.battle.playerScore().resonance !== 'none');
    const title = isShift ? t('skill.resonanceShift.name') : t('skill.resonanceSummon.name');
    const iconGlyph = isShift ? '◇' : '✦';
    const baseTooltip = isShift ? t('skill.resonanceShift.tooltip') : t('skill.resonanceSummon.tooltip');
    const tooltip = cooldown > 0 ? t('skill.cooldown.tooltip', { rounds: cooldown }) : baseTooltip;
    const slot = this.add.container(x, y);
    const rect = this.add.rectangle(0, 0, 78, 64, available ? 0x2a2e38 : 0x20232a).setStrokeStyle(2, available ? 0xffd86b : COLORS.line);
    const iconGlow = this.add.circle(0, -10, 19, 0xffd86b, available ? 0.22 : 0.08);
    const icon = this.add.text(0, -12, iconGlyph, {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: available ? COLORS.resonance : COLORS.muted,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const label = this.add.text(0, 20, title, {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: available ? COLORS.text : COLORS.muted,
    }).setOrigin(0.5);
    const cooldownLabel = cooldown > 0
      ? this.add.text(0, 33, `CD ${cooldown}`, {
        fontFamily: 'Arial',
        fontSize: '11px',
        color: COLORS.heat,
        fontStyle: 'bold',
      }).setOrigin(0.5)
      : undefined;

    if (available) {
      icon.setShadow(0, 0, COLORS.resonance, 10, true, true);
    }

    rect.setInteractive({ useHandCursor: available });
    rect.on('pointerover', () => {
      rect.setFillStyle(0x343947);
      this.showSkillTooltip(SEATS.player.x + x + 70, SEATS.player.y + y - 98, title, tooltip);
    });
    rect.on('pointerout', () => {
      rect.setFillStyle(available ? 0x2a2e38 : 0x20232a);
      this.hideSkillTooltip();
    });
    rect.on('pointerdown', () => {
      if (!available) {
        return;
      }

      this.playClickSound();
      this.runAction(() => {
        const result = this.battle.execute({
          type: 'use-skill',
          skill: isShift ? 'resonance-shift' : 'resonance-summon',
        });
        if (!result?.used) {
          // The log only records real skill attempts; surface invalid use in-place.
          this.showSkillTooltip(SEATS.player.x + x + 70, SEATS.player.y + y - 98, title, result?.message ?? tooltip);
        }
      });
    });

    slot.add(cooldownLabel ? [rect, iconGlow, icon, label, cooldownLabel] : [rect, iconGlow, icon, label]);
    return slot;
  }

  private itemSlot(x: number, y: number): Phaser.GameObjects.Container {
    const ownedCount = Object.values(getProgress().ownedItems).reduce((total, count) => total + count, 0);
    const available = ownedCount > 0 && !this.dealing && !this.playerRedealing && !this.actionDealing && !this.stageBannerPlaying && !this.actionAnimationPlaying;
    const slot = this.add.container(x, y);
    const rect = this.add.rectangle(0, 0, 78, 64, available ? 0x2a2e38 : 0x20232a).setStrokeStyle(2, available ? COLORS.accent : COLORS.line);
    const iconGlow = this.add.circle(0, -10, 19, COLORS.accent, available ? 0.18 : 0.08);
    const icon = this.add.text(0, -12, '□', {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: available ? COLORS.accentText : COLORS.muted,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const label = this.add.text(0, 20, t('battle.itemButton'), {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: available ? COLORS.text : COLORS.muted,
    }).setOrigin(0.5);

    if (available) {
      icon.setShadow(0, 0, COLORS.accentText, 10, true, true);
    }

    rect.setInteractive({ useHandCursor: available });
    rect.on('pointerover', () => rect.setFillStyle(0x343947));
    rect.on('pointerout', () => rect.setFillStyle(available ? 0x2a2e38 : 0x20232a));
    rect.on('pointerdown', () => {
      if (!available) {
        return;
      }

      this.playClickSound();
      this.itemModalOpen = true;
      this.render();
    });

    slot.add([rect, iconGlow, icon, label]);
    return slot;
  }

  private renderItemModal(): void {
    if (!this.itemModalOpen || this.battle.phase === 'battle-result') {
      return;
    }

    const ownedItems = ITEMS.filter((item) => (getProgress().ownedItems[item.id] ?? 0) > 0);
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
      color: this.battle.phase === 'player-turn' || this.battle.phase === 'choice' ? COLORS.muted : COLORS.heat,
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
    const count = getProgress().ownedItems[item.id] ?? 0;
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
      consumeItem(item.id, 1);
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
    if (item.id === 'heal_potion' || item.id === 'resonance_dust') {
      return this.battle.phase === 'choice';
    }

    if (item.id === 'cooling_charm') {
      return this.battle.phase === 'player-turn';
    }

    return false;
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
      const worldX = SEATS.enemy[index].x + x + (index === 1 ? -170 : 150);
      const worldY = SEATS.enemy[index].y + y + (index === 1 ? 104 : -62);
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
      color: muted ? COLORS.muted : COLORS.heat,
    });
    if (!muted) {
      text.setShadow(0, 0, COLORS.heat, 10, true, true);
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

        if (!shouldDelayResultModal) {
          if (shouldDealNewRound) {
            this.startDealPresentation();
          } else {
            this.render();
          }
          return;
        }

        this.resultModalReady = true;
        if (shouldDealNewRound) {
          this.startDealPresentation();
        } else {
          this.render();
        }
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
    const enemySeat = SEATS.enemy[enemyIndex];
    return {
      enemy: new Phaser.Math.Vector2(enemySeat.x, enemySeat.y),
      player: new Phaser.Math.Vector2(SEATS.player.x, SEATS.player.y),
    };
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

  private phaseText(): string {
    if (this.battle.phase === 'choice') {
      return t('battle.phase.choice');
    }

    if (this.battle.phase === 'enemy-turn') {
      return t('battle.phase.enemyTurn');
    }

    if (this.battle.phase === 'player-turn') {
      const remainingDraws = 2 - this.battle.player.drawCountThisRound;
      const risk = this.battle.player.incomingDamageBonus > 0 ? t('battle.phase.playerRiskActive') : t('battle.phase.playerRiskPending');
      return t('battle.phase.playerTurn', { remaining: remainingDraws, risk });
    }

    if (this.battle.phase === 'round-result') {
      return t('battle.phase.roundResult');
    }

    return this.battle.battleOutcome === 'victory'
      ? t('battle.phase.victory')
      : t('battle.phase.defeat');
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

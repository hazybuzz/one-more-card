import Phaser from 'phaser';
import { preloadCardImages } from '../game/assets';
import { playLobbyMusic, preloadLobbyMusic } from '../game/audio';
import { cardValue } from '../game/card';
import { t } from '../game/i18n';
import { pvpClient } from '../game/pvp/PvpClient';
import type { PublicPvpCard, PublicPvpPlayerState, PvpPublicRoomState } from '../game/pvp/PvpTypes';
import { scoreHand } from '../game/scoring';
import { canResonanceShift } from '../game/skills/resonanceSkills';
import { createCardView } from '../ui/presentation/CardView';
import { playClashProjectiles, playDamageProjectile } from '../ui/presentation/DamageAnimator';
import { playDealSequence, type DealAnimationStep } from '../ui/presentation/DealAnimator';
import { shakeContainer, showClashText, showDamageText } from '../ui/presentation/HpEffects';
import { playResonanceEcho, preloadResonanceEffects } from '../ui/presentation/ResonanceEffects';
import { createScoreBadge } from '../ui/presentation/ScoreBadge';
import { playStageBanner } from '../ui/presentation/StageBanner';

const COLORS = {
  bg: 0x101114,
  panel: 0x1b1d22,
  panelAlt: 0x252832,
  line: 0x3b3f4c,
  text: '#f2f2ed',
  muted: '#aeb4c0',
  accent: 0xe8cf73,
  accentText: '#e8cf73',
  green: '#78d18a',
  dangerText: '#ff4b5f',
  button: 0x303542,
  buttonHover: 0x41495b,
  disabled: 0x25272d,
};

export class PvpBattleScene extends Phaser.Scene {
  private state?: PvpPublicRoomState;
  private connected = false;
  private status = '';
  private unsubscribers: Array<() => void> = [];
  private timerText?: Phaser.GameObjects.Text;
  private lastBannerKey = '';
  private dealing = false;
  private visibleCardCounts: Record<string, number> = {};
  private seatContainers = new Map<string, Phaser.GameObjects.Container>();
  private lastDamageAnimationKey = '';
  private lastResonanceEchoKey = '';
  private lastLiveResonanceEchoKey = '';
  private serverClockOffsetMs = 0;
  private gameOverSettledKey = '';
  private gameOverAnimationInFlightKey = '';

  constructor() {
    super('PvpBattleScene');
  }

  preload(): void {
    preloadLobbyMusic(this);
    preloadCardImages(this);
    preloadResonanceEffects(this);
    if (!this.cache.audio.exists('cardSlide')) {
      this.load.audio('cardSlide', '/audio/card-slide-2.ogg');
    }
    if (!this.cache.audio.exists('buttonClick')) {
      this.load.audio('buttonClick', '/audio/switch28.ogg');
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
  }

  create(): void {
    playLobbyMusic(this);
    this.state = undefined;
    this.connected = pvpClient.connected;
    this.status = this.connected ? t('pvp.connected') : t('pvp.disconnected');
    this.unsubscribers = [
      pvpClient.onConnection((connected) => {
        this.connected = connected;
        this.status = connected ? t('pvp.connected') : t('pvp.disconnected');
        this.render();
      }),
      pvpClient.onState((state) => {
        const previousState = this.state;
        const previousPhase = this.state?.phase;
        const previousRound = this.state?.round;
        this.serverClockOffsetMs = Date.now() - state.serverTime;
        this.state = state;
        if (this.startDealAnimationIfNeeded(previousState, state)) {
          return;
        }
        this.render();
        this.playStateBannerIfNeeded(previousPhase, previousRound);
        this.playLiveSelfResonanceIfNeeded();
      }),
      pvpClient.onError((message) => {
        this.status = message;
        this.render();
      }),
    ];
    this.time.addEvent({
      delay: 250,
      loop: true,
      callback: () => this.updateTimerText(),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribers.forEach((unsubscribe) => unsubscribe());
      this.unsubscribers = [];
    });
    this.render();
  }

  private render(): void {
    this.children.removeAll(true);
    this.timerText = undefined;
    this.seatContainers.clear();
    this.addBackground();

    if (!this.state) {
      this.renderNoState();
      return;
    }

    const self = this.selfPlayer();
    const opponent = this.opponentPlayer();
    this.renderHeader();
    this.renderPlayerPanel(640, 566, self, true);
    this.renderPlayerPanel(640, 176, opponent, false);
    this.renderCenterInfo();
    this.renderSkillPanel();
    this.renderActions();
    this.renderLog();
  }

  private addBackground(): void {
    this.add.rectangle(640, 360, 1280, 720, COLORS.bg);
    this.add.circle(640, 360, 250, 0x191c22, 0.92).setStrokeStyle(2, COLORS.line);
    this.add.circle(640, 360, 160, 0x101114, 0.42).setStrokeStyle(1, 0x2b303c);
    this.add.rectangle(640, 360, 1280, 1, COLORS.line, 0.24);
  }

  private renderNoState(): void {
    this.add.text(640, 310, t('pvp.battle.noState'), {
      fontFamily: 'Arial',
      fontSize: '26px',
      color: COLORS.text,
    }).setOrigin(0.5);
    this.button(640, 382, 210, 48, t('pvp.battle.returnRoom'), () => {
      this.scene.start('PvpLobbyScene');
    });
  }

  private renderHeader(): void {
    if (!this.state) {
      return;
    }

    this.add.text(640, 38, t('pvp.battle.title'), {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, COLORS.accentText, 8, true, true);
    this.add.text(640, 72, `${t('pvp.room')} ${this.state.roomId}   ${t('pvp.phase')} ${t(`pvp.phase.${this.state.phase}`)}`, {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: COLORS.muted,
    }).setOrigin(0.5);
    this.button(108, 48, 170, 42, t('pvp.battle.returnRoom'), () => {
      this.handleReturnRoom();
    }, '15px');
    this.renderRematchControl();
  }

  private renderPlayerPanel(x: number, y: number, player: PublicPvpPlayerState | undefined, isSelf: boolean): void {
    const width = isSelf ? 680 : 640;
    const height = isSelf ? 178 : 160;
    const panel = this.add.container(x, y);
    if (player) {
      this.seatContainers.set(player.id, panel);
    }
    panel.add(this.add.rectangle(0, 0, width, height, COLORS.panel, 0.95).setStrokeStyle(2, isSelf ? 0x78d18a : COLORS.accent));

    if (!player) {
      panel.add(this.add.text(0, 0, t('pvp.battle.waitingOpponent'), {
        fontFamily: 'Arial',
        fontSize: '22px',
        color: COLORS.muted,
      }).setOrigin(0.5));
      return;
    }

    const titleColor = isSelf ? COLORS.green : COLORS.accentText;
    panel.add(this.add.text(-width / 2 + 24, -height / 2 + 18, `${player.name}${isSelf ? ` ${t('pvp.self')}` : ''}`, {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: titleColor,
      fontStyle: 'bold',
    }));
    panel.add(this.add.text(width / 2 - 132, -height / 2 + 20, `HP ${player.hp}/${player.maxHp}`, {
      fontFamily: 'Arial',
      fontSize: '25px',
      color: COLORS.dangerText,
      fontStyle: 'bold',
    }).setShadow(0, 0, COLORS.dangerText, 10, true, true));
    panel.add(this.add.text(-width / 2 + 24, height / 2 - 42, this.playerStatusText(player, isSelf), {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: player.secondDrawRisk ? COLORS.dangerText : COLORS.muted,
    }));

    const cardWidth = isSelf ? 72 : 64;
    const cardGap = isSelf ? 84 : 76;
    const startX = -((player.hand.length - 1) * cardGap) / 2;
    player.hand.forEach((card, index) => {
      if (index >= this.visibleCardCountFor(player)) {
        return;
      }

      panel.add(createCardView(this, {
        x: startX + index * cardGap,
        y: isSelf ? 18 : 14,
        card: card.hidden ? undefined : card.card,
        hidden: card.hidden,
        width: cardWidth,
        resonant: this.shouldHighlightCard(player, isSelf),
      }));
    });

    this.renderScoreSummary(panel, player, startX, cardGap, cardWidth, isSelf);
  }

  private renderCenterInfo(): void {
    if (!this.state) {
      return;
    }

    const panel = this.add.container(640, 360);
    panel.add(this.add.rectangle(0, 0, 430, 172, COLORS.panel, 0.94).setStrokeStyle(2, COLORS.line));
    panel.add(this.add.text(0, -58, t('pvp.battle.round', { round: this.state.round }), {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5));

    this.timerText = this.add.text(0, -18, '', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: COLORS.accentText,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    panel.add(this.timerText);
    this.updateTimerText();

    panel.add(this.add.text(0, 22, this.centerStatusText(), {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: COLORS.muted,
      align: 'center',
      wordWrap: { width: 370 },
    }).setOrigin(0.5));

    const result = this.roundResultText();
    if (result) {
      const text = this.add.text(0, 64, result, {
        fontFamily: 'Arial',
        fontSize: '17px',
        color: COLORS.accentText,
        align: 'center',
      }).setOrigin(0.5);
      text.setShadow(0, 0, COLORS.accentText, 8, true, true);
      panel.add(text);
    }
  }

  private renderActions(): void {
    const self = this.selfPlayer();
    const canAct = this.state?.phase === 'playing' && !!self && !self.stood;
    const canDraw = canAct && !self?.drawLocked && (self?.drawCount ?? 0) < 2;
    this.button(510, 676, 180, 48, t('pvp.battle.draw'), () => pvpClient.draw(), '18px', canDraw);
    this.button(750, 676, 180, 48, t('pvp.battle.stand'), () => pvpClient.stand(), '18px', canAct);
  }

  private renderSkillPanel(): void {
    const self = this.selfPlayer();
    if (!self) {
      return;
    }

    const panel = this.add.container(214, 610);
    panel.add(this.add.rectangle(0, 0, 248, 122, COLORS.panel, 0.94).setStrokeStyle(2, COLORS.line));
    panel.add(this.add.text(-104, -48, t('pvp.battle.skills'), {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: COLORS.text,
      fontStyle: 'bold',
    }));
    panel.add(this.skillButton(-54, 20, 'resonance_shift', '◇', t('skill.resonanceShift.name'), this.canUsePvpSkill(self, 'resonance_shift')));
    panel.add(this.skillButton(58, 20, 'resonance_summon', '✦', t('skill.resonanceSummon.name'), this.canUsePvpSkill(self, 'resonance_summon')));
  }

  private skillButton(x: number, y: number, skillId: string, icon: string, label: string, enabled: boolean): Phaser.GameObjects.Container {
    const button = this.add.container(x, y);
    const cooldown = this.selfPlayer()?.skillCooldowns[skillId] ?? 0;
    const rect = this.add.rectangle(0, 0, 92, 64, enabled ? 0x2a2e38 : 0x20232a).setStrokeStyle(2, enabled ? COLORS.accent : COLORS.line);
    const iconText = this.add.text(0, -12, icon, {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: enabled ? COLORS.accentText : COLORS.muted,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const labelText = this.add.text(0, 18, cooldown > 0 ? `CD ${cooldown}` : label, {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: enabled ? COLORS.text : COLORS.muted,
    }).setOrigin(0.5);
    if (enabled) {
      iconText.setShadow(0, 0, COLORS.accentText, 9, true, true);
      rect.setInteractive({ useHandCursor: true });
      rect.on('pointerover', () => rect.setFillStyle(COLORS.buttonHover));
      rect.on('pointerout', () => rect.setFillStyle(0x2a2e38));
      rect.on('pointerdown', () => {
        this.playButtonClick();
        pvpClient.useSkill(skillId);
      });
    }

    button.add([rect, iconText, labelText]);
    return button;
  }

  private renderRematchControl(): void {
    if (!this.state || this.state.phase !== 'game-over' || this.isGameOverSettling()) {
      return;
    }

    const requested = this.state.rematchRequestedIds.includes(this.state.selfId);
    this.button(108, 98, 170, 42, t('pvp.battle.rematch'), () => pvpClient.rematch(), '15px', !requested);
    const label = requested ? t('pvp.battle.rematchWaiting') : t('pvp.battle.rematchHint');
    this.add.text(108, 130, label, {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: requested ? COLORS.accentText : COLORS.muted,
    }).setOrigin(0.5);
  }

  private renderLog(): void {
    if (!this.state) {
      return;
    }

    const panel = this.add.container(1110, 374);
    panel.add(this.add.rectangle(0, 0, 260, 520, COLORS.panel, 0.94).setStrokeStyle(2, COLORS.line));
    panel.add(this.add.text(-106, -238, t('pvp.battle.log'), {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: COLORS.text,
      fontStyle: 'bold',
    }));
    this.state.logs.slice(0, 12).forEach((line, index) => {
      panel.add(this.add.text(-106, -198 + index * 34, line, {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: index === 0 ? COLORS.accentText : COLORS.muted,
        wordWrap: { width: 214 },
      }));
    });
  }

  private button(x: number, y: number, width: number, height: number, label: string, onClick: () => void, fontSize = '18px', enabled = true): Phaser.GameObjects.Container {
    const button = this.add.container(x, y);
    const fill = enabled ? COLORS.button : COLORS.disabled;
    const rect = this.add.rectangle(0, 0, width, height, fill).setStrokeStyle(2, enabled ? COLORS.line : 0x343741);
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Arial',
      fontSize,
      color: enabled ? COLORS.text : COLORS.muted,
    }).setOrigin(0.5);
    if (enabled) {
      rect.setInteractive({ useHandCursor: true });
      rect.on('pointerover', () => rect.setFillStyle(COLORS.buttonHover));
      rect.on('pointerout', () => rect.setFillStyle(fill));
      rect.on('pointerdown', () => {
        this.playButtonClick();
        onClick();
      });
    }
    button.add([rect, text]);
    return button;
  }

  private updateTimerText(): void {
    if (!this.timerText || !this.state) {
      return;
    }

    if (this.state.phase !== 'playing' || !this.state.actionDeadline) {
      const text = this.state.phase === 'round-reveal' || this.isGameOverSettling()
        ? t('pvp.battle.reveal')
        : this.gameOverText();
      this.timerText.setText(text);
      return;
    }

    const serverNow = Date.now() - this.serverClockOffsetMs;
    const remainingMs = Math.max(0, this.state.actionDeadline - serverNow);
    const remaining = Math.ceil(remainingMs / 1000);
    this.timerText.setText(t('pvp.battle.timer', { seconds: remaining }));
    this.timerText.setColor(remaining <= 5 ? COLORS.dangerText : COLORS.accentText);
  }

  private centerStatusText(): string {
    if (!this.state) {
      return '';
    }

    if (this.state.phase === 'game-over') {
      if (this.isGameOverSettling()) {
        return t('pvp.battle.settling');
      }

      return this.gameOverText();
    }

    const self = this.selfPlayer();
    const opponent = this.opponentPlayer();
    if (this.state.phase === 'round-reveal') {
      return t('pvp.battle.revealHint');
    }

    if (self?.stood && opponent?.stood) {
      return t('pvp.battle.bothStood');
    }

    if (self?.stood) {
      return t('pvp.battle.youStood');
    }

    if (opponent?.stood) {
      return t('pvp.battle.opponentStood');
    }

    return t('pvp.battle.chooseAction');
  }

  private roundResultText(): string {
    if (!this.state?.lastRoundResult) {
      return '';
    }

    const result = this.state.lastRoundResult;
    if (result.outcome === 'draw') {
      return t('pvp.battle.drawRound');
    }

    const winner = this.state.players.find((player) => player.id === result.winnerId);
    const loser = this.state.players.find((player) => player.id === result.loserId);
    const resonanceText = result.resonance === 'strong'
      ? t('pvp.battle.strongResonance')
      : result.resonance === 'resonance'
        ? t('pvp.battle.resonance')
        : '';
    return t('pvp.battle.roundDamage', {
      winner: winner?.name ?? '',
      loser: loser?.name ?? '',
      damage: result.damage,
      resonance: resonanceText,
      risk: result.riskBonus > 0 ? t('pvp.battle.riskBonus', { amount: result.riskBonus }) : '',
    });
  }

  private playerStatusText(player: PublicPvpPlayerState, isSelf: boolean): string {
    const score = this.state?.lastRoundResult?.scores[player.id];
    const point = score && (this.state?.phase === 'round-reveal' || this.state?.phase === 'game-over')
      ? ` · ${t('pvp.battle.point', { point: score.point })}`
      : '';
    const risk = player.secondDrawRisk || player.incomingDamageBonus > 0 ? ` · ${t('pvp.battle.secondDrawRisk')}` : '';
    const stood = player.stood ? ` · ${isSelf ? t('pvp.battle.youStoodShort') : t('pvp.battle.opponentStoodShort')}` : '';
    const usedSkills = player.usedSkillIds.length > 0 ? ` · ${t('pvp.battle.skillUsedCount', { count: player.usedSkillIds.length })}` : '';
    return `${t('pvp.battle.drawCount', { count: player.drawCount })}${risk}${stood}${point}${usedSkills}`;
  }

  private gameOverText(): string {
    if (!this.state || this.state.phase !== 'game-over') {
      return this.status;
    }

    return this.state.winnerId === this.state.selfId ? t('pvp.battle.victory') : t('pvp.battle.defeat');
  }

  private selfPlayer(): PublicPvpPlayerState | undefined {
    return this.state?.players.find((player) => player.id === this.state?.selfId);
  }

  private opponentPlayer(): PublicPvpPlayerState | undefined {
    return this.state?.players.find((player) => player.id !== this.state?.selfId);
  }

  private playButtonClick(): void {
    this.sound.play('buttonClick', { volume: 0.42 });
  }

  private canUsePvpSkill(player: PublicPvpPlayerState, skillId: string): boolean {
    if (this.state?.phase !== 'playing'
      || player.stood
      || !player.skills.includes(skillId)
      || (player.skillCooldowns[skillId] ?? 0) > 0) {
      return false;
    }

    const cards = player.hand
      .filter((card): card is Extract<PublicPvpCard, { hidden: false }> => !card.hidden)
      .map((card) => card.card);
    if (cards.length !== player.hand.length) {
      return false;
    }

    if (skillId === 'resonance_shift') {
      return scoreHand(cards).resonance === 'none' && canResonanceShift(cards);
    }

    if (skillId === 'resonance_summon') {
      return cards.length < 4 && scoreHand(cards).resonance !== 'none';
    }

    return false;
  }

  private renderScoreSummary(panel: Phaser.GameObjects.Container, player: PublicPvpPlayerState, startX: number, cardGap: number, cardWidth: number, isSelf: boolean): void {
    if (!isSelf && this.state?.phase === 'playing') {
      return;
    }

    const score = this.realtimeScoreFor(player);
    if (!score || score.values.length === 0) {
      return;
    }

    const visibleCount = this.visibleCardCountFor(player);
    const x = startX + (Math.max(visibleCount, 1) - 1) * cardGap + cardWidth / 2 + 58;
    panel.add(createScoreBadge(this, {
      x,
      y: 16,
      point: score.point,
      label: t('common.pointUnit'),
      scale: 0.72,
    }));
  }

  private handleReturnRoom(): void {
    if (!this.state || this.state.phase === 'game-over' || this.state.phase === 'waiting') {
      this.scene.start('PvpLobbyScene', { suppressBattleAutoOpen: true });
      return;
    }

    pvpClient.surrender();
  }

  private startDealAnimationIfNeeded(previousState: PvpPublicRoomState | undefined, state: PvpPublicRoomState): boolean {
    if (state.phase !== 'playing' || state.players.length === 0) {
      this.visibleCardCounts = {};
      this.dealing = false;
      return false;
    }

    const isNewRound = !previousState || previousState.round !== state.round || previousState.phase !== 'playing';
    const previousCounts = this.visibleCardCountsFromPreviousState(previousState, state, isNewRound);
    const steps = this.dealStepsForState(previousCounts, state);
    if (steps.length === 0) {
      this.visibleCardCounts = Object.fromEntries(state.players.map((player) => [player.id, player.hand.length]));
      return false;
    }

    this.dealing = true;
    this.visibleCardCounts = { ...previousCounts };
    this.render();
    playDealSequence(this, {
      steps,
      soundKey: 'cardSlide',
      soundVolume: 0.56,
      delayMs: isNewRound ? 62 : 52,
      canContinue: () => this.dealing && this.state?.round === state.round,
      onComplete: () => {
        this.dealing = false;
        this.visibleCardCounts = Object.fromEntries(state.players.map((player) => [player.id, player.hand.length]));
        this.render();
        this.playLiveSelfResonanceIfNeeded();
      },
    });
    return true;
  }

  private visibleCardCountsFromPreviousState(previousState: PvpPublicRoomState | undefined, state: PvpPublicRoomState, isNewRound: boolean): Record<string, number> {
    if (isNewRound) {
      return Object.fromEntries(state.players.map((player) => [player.id, 0]));
    }

    return Object.fromEntries(state.players.map((player) => {
      const previousPlayer = previousState?.players.find((item) => item.id === player.id);
      return [player.id, Math.min(previousPlayer?.hand.length ?? this.visibleCardCountFor(player), player.hand.length)];
    }));
  }

  private dealStepsForState(previousCounts: Record<string, number>, state: PvpPublicRoomState): DealAnimationStep[] {
    const steps: DealAnimationStep[] = [];
    const maxCards = Math.max(...state.players.map((player) => player.hand.length));
    const orderedPlayers = [...state.players].sort((a, b) => Number(a.id === state.selfId) - Number(b.id === state.selfId));

    for (let cardIndex = 0; cardIndex < maxCards; cardIndex += 1) {
      orderedPlayers.forEach((player) => {
        const previousCount = previousCounts[player.id] ?? 0;
        if (cardIndex < previousCount || cardIndex >= player.hand.length) {
          return;
        }

        steps.push({
          to: this.cardDealTargetFor(player, cardIndex),
          onArrive: () => {
            this.visibleCardCounts[player.id] = Math.max(this.visibleCardCounts[player.id] ?? 0, cardIndex + 1);
            this.render();
          },
        });
      });
    }

    return steps;
  }

  private cardDealTargetFor(player: PublicPvpPlayerState, cardIndex: number): Phaser.Math.Vector2 {
    const isSelf = player.id === this.state?.selfId;
    const panelX = 640;
    const panelY = isSelf ? 566 : 176;
    const cardGap = isSelf ? 84 : 76;
    const handLength = Math.max(player.hand.length, cardIndex + 1);
    const startX = -((handLength - 1) * cardGap) / 2;
    return new Phaser.Math.Vector2(panelX + startX + cardIndex * cardGap, panelY + (isSelf ? 18 : 14));
  }

  private visibleCardCountFor(player: PublicPvpPlayerState): number {
    if (!this.dealing) {
      return player.hand.length;
    }

    return Math.min(this.visibleCardCounts[player.id] ?? 0, player.hand.length);
  }

  private shouldHighlightCard(player: PublicPvpPlayerState, isSelf: boolean): boolean {
    const score = this.state?.lastRoundResult?.scores[player.id];
    if ((this.state?.phase === 'round-reveal' || this.state?.phase === 'game-over') && !!score && score.resonance !== 'none') {
      return true;
    }

    return isSelf && this.state?.phase === 'playing' && this.realtimeScoreFor(player)?.resonance !== 'none';
  }

  private playStateBannerIfNeeded(previousPhase?: string, previousRound?: number): void {
    if (!this.state) {
      return;
    }

    if (this.state.phase === 'round-reveal' && previousPhase !== 'round-reveal') {
      const key = `reveal:${this.state.round}`;
      if (this.lastBannerKey === key) {
        return;
      }

      this.lastBannerKey = key;
      playStageBanner(this, {
        text: t('pvp.battle.reveal'),
        color: COLORS.dangerText,
        stroke: '#3a070d',
        onComplete: () => {
          this.playRevealResonanceEcho(key);
          this.playRoundDamageAnimation(key);
        },
      });
      return;
    }

    if (this.state.phase === 'game-over' && previousPhase !== 'game-over') {
      this.playGameOverDamageBeforeSettlement();
      return;
    }

    if (this.state.phase === 'playing' && previousRound !== undefined && this.state.round !== previousRound) {
      this.lastBannerKey = '';
      this.gameOverSettledKey = '';
      this.gameOverAnimationInFlightKey = '';
    }
  }

  private playRoundDamageAnimation(key: string, onComplete?: () => void): void {
    if (!this.state?.lastRoundResult || this.lastDamageAnimationKey === key) {
      onComplete?.();
      return;
    }

    this.lastDamageAnimationKey = key;
    const result = this.state.lastRoundResult;
    if (result.outcome === 'draw') {
      const [a, b] = this.state.players;
      if (!a || !b) {
        return;
      }

      playClashProjectiles(this, {
        a: {
          from: this.playerPosition(a),
          to: this.playerPosition(b),
          color: this.playerColor(a),
          label: a.name,
          attackSoundKey: 'attackFire',
        },
        b: {
          from: this.playerPosition(b),
          to: this.playerPosition(a),
          color: this.playerColor(b),
          label: b.name,
          attackSoundKey: 'attackFire',
        },
        onClash: (point) => showClashText(this, point.x, point.y - 34, t('pvp.battle.drawRound')),
        onComplete,
      });
      return;
    }

    const winner = this.state.players.find((player) => player.id === result.winnerId);
    const loser = this.state.players.find((player) => player.id === result.loserId);
    if (!winner || !loser) {
      return;
    }

    const resonant = result.resonance === 'resonance' || result.resonance === 'strong';
    playDamageProjectile(this, {
      from: this.playerPosition(winner),
      to: this.playerPosition(loser),
      color: this.playerColor(winner),
      label: winner.name,
      resonant,
      attackSoundKey: 'attackFire',
      resonanceSoundKey: 'attackWind',
      impactSoundKey: 'damageExplosion',
      onImpact: () => {
        const to = this.playerPosition(loser);
        showDamageText(this, to.x, to.y - 42, result.damage);
        shakeContainer(this, this.seatContainers.get(loser.id));
      },
      onComplete,
    });
  }

  private playGameOverDamageBeforeSettlement(): void {
    if (!this.state?.lastRoundResult) {
      this.gameOverSettledKey = this.currentGameOverKey();
      this.render();
      return;
    }

    const key = this.currentGameOverKey();
    if (this.gameOverSettledKey === key || this.gameOverAnimationInFlightKey === key) {
      return;
    }

    this.gameOverAnimationInFlightKey = key;
    this.playRevealResonanceEcho(key);
    this.playRoundDamageAnimation(key, () => {
      this.time.delayedCall(360, () => {
        if (this.currentGameOverKey() !== key) {
          return;
        }

        this.gameOverSettledKey = key;
        this.gameOverAnimationInFlightKey = '';
        this.render();
      });
    });
  }

  private isGameOverSettling(): boolean {
    return this.state?.phase === 'game-over' && this.gameOverSettledKey !== this.currentGameOverKey();
  }

  private currentGameOverKey(): string {
    if (!this.state || this.state.phase !== 'game-over') {
      return '';
    }

    return `game-over:${this.state.round}:${this.state.winnerId ?? 'draw'}`;
  }

  private playerPosition(player: PublicPvpPlayerState): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(640, player.id === this.state?.selfId ? 566 : 176);
  }

  private playerColor(player: PublicPvpPlayerState): number {
    return player.id === this.state?.selfId ? 0x78d18a : 0xe8cf73;
  }

  private visibleScoreFor(player: PublicPvpPlayerState) {
    if (this.state?.phase !== 'round-reveal' && this.state?.phase !== 'game-over') {
      return undefined;
    }

    return this.state.lastRoundResult?.scores[player.id];
  }

  private realtimeScoreFor(player: PublicPvpPlayerState): { rawTotal: number; point: number; resonance: 'none' | 'resonance' | 'strong'; values: string[] } | undefined {
    const revealedScore = this.visibleScoreFor(player);
    if (revealedScore) {
      return {
        rawTotal: revealedScore.rawTotal,
        point: revealedScore.point,
        resonance: revealedScore.resonance,
        values: player.hand
          .filter((card, index): card is Extract<PublicPvpCard, { hidden: false }> => index < this.visibleCardCountFor(player) && !card.hidden)
          .map((card) => `${cardValue(card.card)}`),
      };
    }

    const visibleCards = player.hand
      .slice(0, this.visibleCardCountFor(player))
      .filter((card): card is Extract<PublicPvpCard, { hidden: false }> => !card.hidden);
    const cards = visibleCards.map((card) => card.card);
    const score = scoreHand(cards);
    return {
      rawTotal: score.rawTotal,
      point: score.point,
      resonance: score.resonance,
      values: cards.map((card) => `${cardValue(card)}`),
    };
  }

  private playRevealResonanceEcho(key: string): void {
    if (this.lastResonanceEchoKey === key || !this.state?.lastRoundResult) {
      return;
    }

    const hasResonance = Object.values(this.state.lastRoundResult.scores).some((score) => score.resonance !== 'none');
    if (!hasResonance) {
      return;
    }

    this.lastResonanceEchoKey = key;
    playResonanceEcho(this);
  }

  private playLiveSelfResonanceIfNeeded(): void {
    const self = this.selfPlayer();
    if (!self || this.state?.phase !== 'playing' || this.dealing) {
      return;
    }

    const cards = self.hand
      .filter((card): card is Extract<PublicPvpCard, { hidden: false }> => !card.hidden)
      .map((card) => card.card);
    if (cards.length !== self.hand.length) {
      return;
    }

    const score = scoreHand(cards);
    if (score.resonance === 'none') {
      this.lastLiveResonanceEchoKey = '';
      return;
    }

    const cardKey = cards.map((card) => `${card.suit ?? ''}${card.rank}`).join('|');
    const skillKey = self.usedSkillIds.join('|');
    const key = `live:${this.state.round}:${score.resonance}:${cardKey}:skills:${skillKey}`;
    if (this.lastLiveResonanceEchoKey === key) {
      return;
    }

    this.lastLiveResonanceEchoKey = key;
    playResonanceEcho(this);
  }
}

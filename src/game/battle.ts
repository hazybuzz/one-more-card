import { Card, RANKS, SUITS, Suit, cardFromCode, formatCard, isJoker } from './card';
import type { BattleState } from './core/BattleState';
import { getLevelById } from './data/levelRegistry';
import { enemyName, t } from './i18n';
import { Deck } from './deck';
import { EnemyState, createEnemiesForLevel, decideInvite } from './enemy';
import { EnemyType } from './enemy';
import { ResonanceKind, ScoreResult, scoreHand } from './scoring';
import type { BattleMechanicId, FixedRoundConfig, FixedRoundEnemyConfig, LevelConfig } from './types/level';

export type BattlePhase = 'choice' | 'enemy-turn' | 'player-turn' | 'round-result' | 'battle-result';
export type BattleOutcome = 'victory' | 'defeat' | undefined;

export interface PlayerState {
  hp: number;
  maxHp: number;
  hand: Card[];
  fateMode: boolean;
  drawCountThisRound: number;
  resonanceShiftUsed: boolean;
  resonanceSummonUsed: boolean;
  resonanceShiftCooldown: number;
  resonanceSummonCooldown: number;
  drawLocked: boolean;
  incomingDamageBonus: number;
  soulRedeemUsed: boolean;
}

export interface BattleResult {
  enemy: EnemyState;
  enemyScore: ScoreResult;
  playerScore: ScoreResult;
  outcome: 'win' | 'lose' | 'draw';
  damage: number;
}

export interface DamageEvent {
  type: 'damage' | 'clash';
  attacker?: 'player' | 'enemy';
  enemyId: EnemyType;
  amount: number;
  resonance?: ResonanceKind;
}

export interface SkillResult {
  used: boolean;
  success: boolean;
  message: string;
}

export interface BattleInitOptions {
  levelId?: string;
  levelConfig?: LevelConfig;
}

export class Battle {
  readonly player: PlayerState;
  readonly enemies: EnemyState[];
  readonly log: string[];
  readonly levelConfig?: LevelConfig;

  phase: BattlePhase;
  battleOutcome: BattleOutcome;
  currentEnemyIndex: number;
  round: number;
  roundRevealed: boolean;
  pendingSoulRedeem: boolean;
  results: BattleResult[];
  damageEvents: DamageEvent[];

  private deck: Deck;

  constructor(options: BattleInitOptions = {}) {
    this.deck = new Deck();
    this.levelConfig = options.levelConfig ?? (options.levelId ? getLevelById(options.levelId) : undefined);
    const playerHp = this.levelConfig?.playerHp ?? 12;
    this.player = {
      hp: playerHp,
      maxHp: playerHp,
      hand: [],
      fateMode: false,
      drawCountThisRound: 0,
      resonanceShiftUsed: false,
      resonanceSummonUsed: false,
      resonanceShiftCooldown: 0,
      resonanceSummonCooldown: 0,
      drawLocked: false,
      incomingDamageBonus: 0,
      soulRedeemUsed: false,
    };
    this.enemies = createEnemiesForLevel(this.levelConfig);
    this.log = [];
    this.phase = 'choice';
    this.battleOutcome = undefined;
    this.currentEnemyIndex = 0;
    this.round = 0;
    this.roundRevealed = false;
    this.pendingSoulRedeem = false;
    this.results = [];
    this.damageEvents = [];
    this.startRound();
  }

  chooseViewHand(): void {
    if (this.phase !== 'choice') {
      return;
    }

    this.player.fateMode = false;
    this.logEvent(t('log.viewHand', { cards: this.player.hand.map(formatCard).join(' ') }));
    this.phase = 'enemy-turn';
  }

  chooseFate(): void {
    if (this.phase !== 'choice') {
      return;
    }

    this.player.fateMode = true;
    this.logEvent(t('log.fate'));
    this.phase = 'enemy-turn';
  }

  inviteCurrentEnemy(): void {
    this.clearDamageEvents();
    const enemy = this.currentEnemy;
    if (!this.hasMechanic('invite') || !enemy || this.phase !== 'enemy-turn' || enemy.invited !== undefined) {
      return;
    }

    const drawCount = 1;
    if (this.hasMechanic('enemy_passives') && enemy.id === 'goblin' && enemy.hp < 3 && !enemy.passiveTriggeredThisRound) {
      enemy.passiveTriggeredThisRound = true;
      this.logEvent(t('log.goblinInstinct'));
    }

    const fixedEnemy = this.currentFixedEnemyConfig(enemy.id);
    const decision = fixedEnemy?.scriptedInviteResult
      ? {
        accepts: fixedEnemy.scriptedInviteResult === 'accept',
        reason: fixedEnemy.scriptedInviteReasonKey ? t(fixedEnemy.scriptedInviteReasonKey) : t('enemy.ai.goblin.mid'),
      }
      : decideInvite(enemy, this.playerScore().point);
    enemy.invited = true;
    enemy.invitedDrawCount = drawCount;
    enemy.acceptedInvite = decision.accepts;
    if (decision.accepts) {
      const cards = fixedEnemy?.drawCardOnAccept
        ? [cardFromCode(fixedEnemy.drawCardOnAccept)]
        : this.drawCards(drawCount);
      enemy.hand.push(...cards);
      this.logEvent(t('log.enemyAcceptInvite', { enemy: enemyName(enemy.id), reason: decision.reason }));
    } else {
      this.logEvent(t('log.enemyRejectInvite', { enemy: enemyName(enemy.id), reason: decision.reason }));
    }

    this.advanceEnemy();
  }

  compareCurrentEnemy(): void {
    this.clearDamageEvents();
    const enemy = this.currentEnemy;
    if (!enemy || this.phase !== 'enemy-turn') {
      return;
    }

    const result = this.compareEnemy(enemy);
    this.results.push(result);
    enemy.compared = true;
    this.logCompareResult(result);
    this.applyDefeatAndReward(enemy);

    if (this.markSoulRedeemPending()) {
      return;
    }

    if (this.player.hp <= 0) {
      this.battleOutcome = 'defeat';
      this.phase = 'battle-result';
      this.logEvent(t('log.playerHpZero'));
      return;
    }

    this.advanceEnemy();
  }

  playerDraw(): void {
    this.clearDamageEvents();
    const maxPlayerDraws = this.maxPlayerDrawsThisRound();
    if (!this.hasMechanic('player_draw') || this.phase !== 'player-turn' || this.player.drawLocked || this.player.drawCountThisRound >= maxPlayerDraws) {
      return;
    }

    const fixedCardCode = this.currentFixedRound()?.playerDrawCards?.[this.player.drawCountThisRound];
    const card = fixedCardCode ? cardFromCode(fixedCardCode) : this.deck.draw();
    this.player.hand.push(card);
    this.player.drawCountThisRound += 1;
    if (this.player.drawCountThisRound >= 2) {
      this.player.incomingDamageBonus = 1;
    }
    this.logEvent(this.player.fateMode
      ? t('log.playerDrawFate')
      : t('log.playerDraw', { card: formatCard(card) }));

    if (this.player.drawCountThisRound >= 2) {
      this.player.drawLocked = true;
      this.logEvent(t('log.secondDrawRisk'));
      this.logEvent(t('log.playerMustReveal'));
    }
  }

  useResonanceShift(): SkillResult {
    this.clearDamageEvents();
    if (!this.hasMechanic('skills')) {
      return { used: false, success: false, message: t('skill.invalid.playerTurnOnly') };
    }

    if (this.phase !== 'player-turn') {
      return { used: false, success: false, message: t('skill.invalid.playerTurnOnly') };
    }

    if (this.player.resonanceShiftUsed) {
      return { used: false, success: false, message: t('skill.invalid.shiftUsed') };
    }

    if (this.player.resonanceShiftCooldown > 0) {
      return { used: false, success: false, message: t('skill.invalid.shiftCooldown', { rounds: this.player.resonanceShiftCooldown }) };
    }

    if (this.playerScore().resonance !== 'none') {
      return { used: false, success: false, message: t('skill.invalid.shiftAlreadyResonant') };
    }

    const candidates = this.player.hand.filter((card) => !isJoker(card) && card.suit);
    if (candidates.length < 2) {
      this.logEvent(t('log.shiftNotEnough'));
      return { used: false, success: false, message: t('skill.invalid.notEnoughSuitedCards') };
    }

    const conversion = this.chooseResonanceShift(candidates);
    if (!conversion) {
      this.logEvent(t('log.shiftNoNeed'));
      return { used: false, success: false, message: t('skill.invalid.noShiftPath') };
    }

    this.player.resonanceShiftUsed = true;
    this.player.resonanceShiftCooldown = 2;
    this.player.drawLocked = true;

    const before = formatCard(conversion.card);
    conversion.card.suit = conversion.targetSuit;
    const after = formatCard(conversion.card);
    this.logEvent(t('log.shiftSuccess', { before, after }));
    return { used: true, success: true, message: t('log.shiftSuccessShort', { before, after }) };
  }

  useResonanceSummon(): SkillResult {
    this.clearDamageEvents();
    if (!this.hasMechanic('skills')) {
      return { used: false, success: false, message: t('skill.invalid.playerTurnOnly') };
    }

    if (this.phase !== 'player-turn') {
      return { used: false, success: false, message: t('skill.invalid.playerTurnOnly') };
    }

    if (this.player.resonanceSummonUsed) {
      return { used: false, success: false, message: t('skill.invalid.summonUsed') };
    }

    if (this.player.resonanceSummonCooldown > 0) {
      return { used: false, success: false, message: t('skill.invalid.summonCooldown', { rounds: this.player.resonanceSummonCooldown }) };
    }

    const score = this.playerScore();
    if (score.resonance === 'none') {
      this.logEvent(t('log.summonNoResonance'));
      return { used: false, success: false, message: t('skill.invalid.noResonance') };
    }

    const targetSuit = this.chooseResonanceSummonSuit();
    if (!targetSuit) {
      this.logEvent(t('log.summonNoSuit'));
      return { used: false, success: false, message: t('skill.invalid.noSummonSuit') };
    }

    const card = this.deck.drawWhere((candidate) => !isJoker(candidate) && candidate.suit === targetSuit);
    if (!card) {
      this.logEvent(t('log.summonNoDeckSuit', { suit: targetSuit }));
      return { used: false, success: false, message: t('skill.invalid.noSuitInDeck', { suit: targetSuit }) };
    }

    this.player.resonanceSummonUsed = true;
    this.player.resonanceSummonCooldown = 2;
    this.player.resonanceShiftUsed = true;
    this.player.drawLocked = true;
    this.player.incomingDamageBonus = 1;
    this.player.hand.push(card);
    this.logEvent(t('log.summon', { card: formatCard(card) }));
    this.logEvent(t('log.playerMustReveal'));
    return { used: true, success: true, message: t('log.summonShort', { card: formatCard(card) }) };
  }

  playerStand(): void {
    this.clearDamageEvents();
    if (this.phase !== 'player-turn') {
      return;
    }

    this.logEvent(t('log.playerStand'));
    this.revealRound();
  }

  nextRound(): void {
    this.clearDamageEvents();
    if (this.phase !== 'round-result') {
      return;
    }

    this.startRound();
  }

  revealByItem(): void {
    this.clearDamageEvents();
    this.revealRound();
  }

  get currentEnemy(): EnemyState | undefined {
    return this.enemies[this.currentEnemyIndex];
  }

  get aliveEnemies(): EnemyState[] {
    return this.enemies.filter((enemy) => !enemy.defeated);
  }

  getState(): BattleState {
    return {
      levelId: this.levelConfig?.id,
      levelConfig: this.levelConfig,
      levelIntroLessonKey: this.levelConfig?.levelIntroLessonKey,
      phase: this.phase,
      battleOutcome: this.battleOutcome,
      currentEnemyIndex: this.currentEnemyIndex,
      currentEnemyId: this.currentEnemy?.id,
      round: this.round,
      currentFixedRoundId: this.currentFixedRound()?.id,
      currentLessonKey: this.currentFixedRound()?.lessonKey,
      currentTutorialBeforeCompareKey: this.currentFixedRound()?.tutorialBeforeCompareKey,
      currentPlayerTurnLessonKey: this.currentFixedRound()?.playerTurnLessonKey,
      availableActions: this.currentFixedRound()?.availableActions,
      maxPlayerDrawsThisRound: this.maxPlayerDrawsThisRound(),
      roundRevealed: this.roundRevealed,
      pendingSoulRedeem: this.pendingSoulRedeem,
      player: {
        hp: this.player.hp,
        maxHp: this.player.maxHp,
        hand: this.player.hand.map((card) => ({ ...card })),
        fateMode: this.player.fateMode,
        drawCountThisRound: this.player.drawCountThisRound,
        resonanceShiftUsed: this.player.resonanceShiftUsed,
        resonanceSummonUsed: this.player.resonanceSummonUsed,
        resonanceShiftCooldown: this.player.resonanceShiftCooldown,
        resonanceSummonCooldown: this.player.resonanceSummonCooldown,
        canUseResonanceShift: this.canUseResonanceShift(),
        canUseResonanceSummon: this.canUseResonanceSummon(),
        drawLocked: this.player.drawLocked,
        incomingDamageBonus: this.player.incomingDamageBonus,
        soulRedeemUsed: this.player.soulRedeemUsed,
        score: this.playerScore(),
      },
      enemies: this.enemies.map((enemy) => ({
        id: enemy.id,
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        hand: enemy.hand.map((card) => ({ ...card })),
        revealed: enemy.revealed,
        compared: enemy.compared,
        invited: enemy.invited,
        acceptedInvite: enemy.acceptedInvite,
        invitedDrawCount: enemy.invitedDrawCount,
        passiveTriggeredThisRound: enemy.passiveTriggeredThisRound,
        defeated: enemy.defeated,
        score: this.scoreFor(enemy.hand),
      })),
      aliveEnemyIds: this.aliveEnemies.map((enemy) => enemy.id),
      results: this.results.map((result) => ({
        enemyId: result.enemy.id,
        enemyScore: result.enemyScore,
        playerScore: result.playerScore,
        outcome: result.outcome,
        damage: result.damage,
      })),
      logs: [...this.log],
    };
  }

  playerScore(): ScoreResult {
    return this.scoreFor(this.player.hand);
  }

  canUseResonanceShift(): boolean {
    if (this.phase !== 'player-turn' || this.player.resonanceShiftUsed || this.player.resonanceShiftCooldown > 0 || this.playerScore().resonance !== 'none') {
      return false;
    }

    const candidates = this.player.hand.filter((card) => !isJoker(card) && card.suit);
    return this.chooseResonanceShift(candidates) !== undefined;
  }

  canUseResonanceSummon(): boolean {
    return this.phase === 'player-turn'
      && !this.player.resonanceSummonUsed
      && this.player.resonanceSummonCooldown <= 0
      && this.playerScore().resonance !== 'none';
  }

  healPlayer(amount: number): number {
    const beforeHp = this.player.hp;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.max(0, Math.floor(amount)));
    return this.player.hp - beforeHp;
  }

  addLog(message: string): void {
    this.logEvent(message);
  }

  useResonanceHorn(): { success: boolean; cards: Card[] } {
    const success = Math.random() < 0.8;
    if (success) {
      this.player.hand = this.createRandomResonantPair();
    }

    this.player.fateMode = false;
    this.logEvent(success
      ? t('itemEffect.resonanceHorn.success', { cards: this.player.hand.map(formatCard).join(' ') })
      : t('itemEffect.resonanceHorn.fail', { cards: this.player.hand.map(formatCard).join(' ') }));
    this.phase = 'enemy-turn';
    return {
      success,
      cards: this.player.hand,
    };
  }

  rerollPlayerHandByFate(): Card[] {
    const drawCount = Math.max(1, this.player.hand.length);
    this.player.hand = this.drawCards(drawCount);
    this.player.incomingDamageBonus = Math.max(this.player.incomingDamageBonus, 1);
    this.player.drawLocked = true;
    this.player.resonanceShiftUsed = true;
    this.player.resonanceSummonUsed = true;
    return this.player.hand;
  }

  private startRound(): void {
    this.deck = new Deck();
    this.round += 1;
    this.results = [];
    this.phase = 'choice';
    this.battleOutcome = undefined;
    this.roundRevealed = false;
    this.currentEnemyIndex = this.firstAliveEnemyIndex();
    this.player.fateMode = false;
    this.player.drawCountThisRound = 0;
    this.player.resonanceShiftUsed = false;
    this.player.resonanceSummonUsed = false;
    this.player.resonanceShiftCooldown = Math.max(0, this.player.resonanceShiftCooldown - 1);
    this.player.resonanceSummonCooldown = Math.max(0, this.player.resonanceSummonCooldown - 1);
    this.player.drawLocked = false;
    this.player.incomingDamageBonus = 0;
    const fixedRound = this.currentFixedRound();
    this.player.hand = fixedRound
      ? fixedRound.playerCards.map(cardFromCode)
      : [this.deck.draw(), this.deck.draw()];
    this.enemies.forEach((enemy) => {
      enemy.hand = [];
      enemy.revealed = false;
      enemy.compared = false;
      enemy.invited = undefined;
      enemy.acceptedInvite = undefined;
      enemy.invitedDrawCount = undefined;
      enemy.passiveTriggeredThisRound = false;

      if (enemy.defeated) {
        return;
      }

      const fixedEnemy = this.currentFixedEnemyConfig(enemy.id);
      enemy.hand = fixedEnemy
        ? fixedEnemy.cards.map(cardFromCode)
        : [this.deck.draw(), this.deck.draw()];
    });
    this.logEvent(t('log.roundStart', { round: this.round }));
  }

  private advanceEnemy(): void {
    const enemy = this.currentEnemy;
    if (enemy) {
      enemy.revealed = false;
    }

    this.currentEnemyIndex += 1;
    this.currentEnemyIndex = this.nextAliveEnemyIndex(this.currentEnemyIndex);
    if (this.currentEnemyIndex >= this.enemies.length) {
      if (this.aliveEnemies.every((enemy) => enemy.compared)) {
        this.logEvent(t('log.allComparedReveal'));
        this.revealRound();
        return;
      }

      this.phase = 'player-turn';
      this.logEvent(t('log.enemyPhaseDone'));
    } else {
      const nextEnemy = this.currentEnemy;
      if (nextEnemy) {
        this.logEvent(t('log.currentTarget', { enemy: enemyName(nextEnemy.id) }));
      }
    }
  }

  private compareEnemy(enemy: EnemyState, playerScoreOverride?: ScoreResult): BattleResult {
    this.applyPreComparePassive(enemy);
    const playerScore = playerScoreOverride ?? this.scoreFor(this.player.hand);
    const fateDamageMultiplier = this.player.fateMode ? 2 : 1;
    const enemyScore = this.scoreFor(enemy.hand);
    let outcome: BattleResult['outcome'] = 'draw';
    let damage = 0;

    const comparison = compareScores(playerScore, enemyScore);

    if (comparison > 0) {
      outcome = 'win';
      damage = playerScore.multiplier * fateDamageMultiplier;
      enemy.hp = Math.max(0, enemy.hp - damage);
      this.damageEvents.push({ type: 'damage', attacker: 'player', enemyId: enemy.id, amount: damage, resonance: playerScore.resonance });
    } else if (comparison < 0) {
      outcome = 'lose';
      damage = enemyScore.multiplier + this.player.incomingDamageBonus;
      this.player.hp = Math.max(0, this.player.hp - damage);
      this.applyPostDamagePassive(enemy, damage);
      this.damageEvents.push({ type: 'damage', attacker: 'enemy', enemyId: enemy.id, amount: damage, resonance: enemyScore.resonance });
    } else {
      this.damageEvents.push({ type: 'clash', enemyId: enemy.id, amount: 0 });
    }

    return {
      enemy,
      enemyScore,
      playerScore,
      outcome,
      damage,
    };
  }

  private revealRound(): void {
    this.comparePendingEnemies();
    this.roundRevealed = true;
    this.results.forEach((result) => {
      result.enemy.revealed = true;
    });

    this.logEvent(t('log.roundRevealHeader', { round: this.round }));
    this.logEvent(t('log.playerReveal', { cards: this.player.hand.map(formatCard).join(' '), score: describeScore(this.revealPlayerScore()) }));
    this.results.forEach((result) => {
      this.logEvent(t('log.enemyReveal', {
        enemy: enemyName(result.enemy.id),
        cards: result.enemy.hand.map(formatCard).join(' '),
        score: describeScore(result.enemyScore),
        outcome: describeOutcome(result),
      }));
    });
    this.logFixedRoundReveal();

    if (this.markSoulRedeemPending()) {
      return;
    }

    this.updateBattleOutcome();
  }

  private comparePendingEnemies(): void {
    const playerScore = this.scoreFor(this.player.hand);
    for (const enemy of this.aliveEnemies) {
      if (enemy.compared) {
        continue;
      }

      const result = this.compareEnemy(enemy, playerScore);
      this.results.push(result);
      enemy.compared = true;
      this.logCompareResult(result);
      this.applyDefeatAndReward(enemy);

      if (this.player.hp <= 0) {
        return;
      }
    }
  }

  private applyPreComparePassive(enemy: EnemyState): void {
    if (!this.hasMechanic('enemy_passives') || enemy.id !== 'gambler' || enemy.hp >= 3 || enemy.passiveTriggeredThisRound) {
      return;
    }

    const point = this.scoreFor(enemy.hand).point;
    if (point >= 4) {
      return;
    }

    const drawCount = enemy.hand.length;
    enemy.hand = this.drawCards(drawCount as 1 | 2);
    enemy.passiveTriggeredThisRound = true;
    this.logEvent(t('log.gamblerBlessing', { count: drawCount }));
  }

  private applyPostDamagePassive(enemy: EnemyState, damage: number): void {
    if (!this.hasMechanic('enemy_passives') || enemy.id !== 'werewolf' || enemy.hp >= 3 || damage <= 0) {
      return;
    }

    const beforeHeal = enemy.hp;
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + damage);
    const healed = enemy.hp - beforeHeal;
    if (healed > 0) {
      this.logEvent(t('log.werewolfLifesteal', { healed }));
    }
  }

  private applyDefeatAndReward(enemy: EnemyState): void {
    if (enemy.defeated || enemy.hp > 0) {
      return;
    }

    enemy.defeated = true;
    const beforeHeal = this.player.hp;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
    const healed = this.player.hp - beforeHeal;
    this.logEvent(t('log.enemyDefeatedReward', { enemy: enemyName(enemy.id), healed }));
  }

  resolveSoulRedeem(): void {
    if (!this.pendingSoulRedeem) {
      return;
    }

    this.pendingSoulRedeem = false;
    this.player.hp = Math.min(this.player.maxHp, 3);
    this.startRound();
  }

  private markSoulRedeemPending(): boolean {
    if (!this.hasMechanic('soul_redeem') || this.player.hp > 0 || this.player.soulRedeemUsed || this.enemies.every((enemy) => enemy.defeated)) {
      return false;
    }

    this.player.soulRedeemUsed = true;
    this.pendingSoulRedeem = true;
    this.roundRevealed = true;
    this.results.forEach((result) => {
      result.enemy.revealed = true;
    });
    this.logEvent(t('log.soulRedeem'));
    return true;
  }

  private logCompareResult(result: BattleResult): void {
    const resonanceText = this.compareResonanceText(result);
    if (result.outcome === 'win') {
      this.logEvent(t('log.enemyDefeated', { enemy: enemyName(result.enemy.id), resonance: resonanceText, damage: result.damage }));
    } else if (result.outcome === 'lose') {
      this.logEvent(t('log.playerDefeated', { resonance: resonanceText, damage: result.damage }));
    } else {
      this.logEvent(t('log.compareDraw', { enemy: enemyName(result.enemy.id), resonance: resonanceText }));
    }
  }

  private logFixedRoundReveal(): void {
    const fixedRound = this.currentFixedRound();
    fixedRound?.revealSummaryKeys?.forEach((key) => this.logEvent(t(key)));
    fixedRound?.afterRevealDialogueKeys?.forEach((key) => this.logEvent(t(key)));
  }

  private compareResonanceText(result: BattleResult): string {
    if (result.outcome === 'win' && result.playerScore.resonance !== 'none') {
      return t('log.triggerResonance', { resonance: result.playerScore.resonance === 'strong' ? t('log.triggerResonanceStrong') : t('log.triggerResonanceNormal') });
    }

    if (result.outcome === 'lose' && result.enemyScore.resonance !== 'none') {
      return t('log.triggerResonance', { resonance: result.enemyScore.resonance === 'strong' ? t('log.triggerResonanceStrong') : t('log.triggerResonanceNormal') });
    }

    return '';
  }

  private updateBattleOutcome(): void {
    if (this.enemies.every((enemy) => enemy.defeated)) {
      this.battleOutcome = 'victory';
      this.phase = 'battle-result';
      this.logEvent(t('log.battleVictory'));
      return;
    }

    if (this.markSoulRedeemPending()) {
      return;
    }

    if (this.player.hp <= 0) {
      this.battleOutcome = 'defeat';
      this.phase = 'battle-result';
      this.logEvent(t('log.playerHpZero'));
      return;
    }

    this.phase = 'round-result';
    this.logEvent(t('log.nextRoundReady'));
  }

  private firstAliveEnemyIndex(): number {
    return this.nextAliveEnemyIndex(0);
  }

  private nextAliveEnemyIndex(startIndex: number): number {
    for (let index = startIndex; index < this.enemies.length; index += 1) {
      if (!this.enemies[index].defeated) {
        return index;
      }
    }

    return this.enemies.length;
  }

  private logEvent(message: string): void {
    this.log.unshift(message);
    if (this.log.length > 18) {
      this.log.pop();
    }
  }

  clearDamageEvents(): void {
    this.damageEvents = [];
  }

  private drawCards(count: number): Card[] {
    return Array.from({ length: count }, () => this.deck.draw());
  }

  private scoreFor(hand: Card[]): ScoreResult {
    const score = scoreHand(hand);
    if (this.hasMechanic('resonance')) {
      return score;
    }

    return {
      ...score,
      resonance: 'none',
      multiplier: 1,
      reason: t('score.reason.none'),
    };
  }

  hasMechanic(mechanic: BattleMechanicId): boolean {
    if (!this.levelConfig) {
      return true;
    }

    return this.levelConfig.unlockedMechanics.includes(mechanic);
  }

  private currentFixedRound(): FixedRoundConfig | undefined {
    return this.levelConfig?.fixedRounds?.[this.round - 1];
  }

  private maxPlayerDrawsThisRound(): number {
    return this.currentFixedRound()?.maxPlayerDraws
      ?? this.levelConfig?.maxPlayerDrawsPerRound
      ?? 2;
  }

  private currentFixedEnemyConfig(enemyId: EnemyType): FixedRoundEnemyConfig | undefined {
    return this.currentFixedRound()?.enemies.find((config) => config.enemyId === enemyId);
  }

  private chooseResonanceShift(cards: Card[]): { card: Card; targetSuit: Suit } | undefined {
    if (cards.length < 2) {
      return undefined;
    }

    const suitGroups = new Map<Suit, Card[]>();
    cards.forEach((card) => {
      if (!card.suit) {
        return;
      }

      const group = suitGroups.get(card.suit) ?? [];
      group.push(card);
      suitGroups.set(card.suit, group);
    });

    if (suitGroups.size <= 1) {
      return undefined;
    }

    const groups = [...suitGroups.entries()];
    if (groups.length > 2) {
      return undefined;
    }

    const counts = groups.map(([, group]) => group.length);
    const allEqual = counts.every((count) => count === counts[0]);

    if (allEqual) {
      if (cards.length !== 2) {
        return undefined;
      }

      const source = randomItem(cards);
      const target = randomItem(cards.filter((card) => card !== source && card.suit && card.suit !== source?.suit));
      if (!source || !target?.suit) {
        return undefined;
      }

      return { card: source, targetSuit: target.suit };
    }

    const maxCount = Math.max(...counts);
    const minCount = Math.min(...counts);
    if (minCount !== 1) {
      return undefined;
    }

    const majoritySuits = groups.filter(([, group]) => group.length === maxCount).map(([suit]) => suit);
    const minorityCards = groups.filter(([, group]) => group.length === minCount).flatMap(([, group]) => group);
    const card = randomItem(minorityCards);
    const targetSuit = randomItem(majoritySuits);
    if (!card || !targetSuit || card.suit === targetSuit) {
      return undefined;
    }

    return { card, targetSuit };
  }

  private chooseResonanceSummonSuit(): Suit | undefined {
    const suitedCards = this.player.hand.filter((card) => !isJoker(card) && card.suit);
    if (suitedCards.length === 0) {
      return randomItem(['♠', '♥', '♦', '♣']);
    }

    const counts = new Map<Suit, number>();
    suitedCards.forEach((card) => {
      if (!card.suit) {
        return;
      }

      counts.set(card.suit, (counts.get(card.suit) ?? 0) + 1);
    });

    const maxCount = Math.max(...counts.values());
    return randomItem([...counts.entries()].filter(([, count]) => count === maxCount).map(([suit]) => suit));
  }

  private createRandomResonantPair(): Card[] {
    if (Math.random() < 0.5) {
      const suit = randomItem(SUITS) ?? '♠';
      return [
        { suit, rank: randomItem(RANKS) ?? 'A' },
        { suit, rank: randomItem(RANKS) ?? '2' },
      ];
    }

    const rank = randomItem(RANKS) ?? 'A';
    const firstSuit = randomItem(SUITS) ?? '♠';
    const otherSuits = SUITS.filter((suit) => suit !== firstSuit);
    return [
      { suit: firstSuit, rank },
      { suit: randomItem(otherSuits) ?? '♥', rank },
    ];
  }

  private revealPlayerScore(): ScoreResult {
    const lastPlayerScore = [...this.results].reverse().find((result) => result.playerScore)?.playerScore;
    return lastPlayerScore ?? this.playerScore();
  }
}

export function describeScore(score: ScoreResult): string {
  const resonance = score.resonance === 'strong'
    ? t('score.strongResonance', { multiplier: score.multiplier })
    : score.resonance === 'resonance'
      ? t('score.resonance', { multiplier: score.multiplier })
      : t('score.noResonance');
  return t('score.describe', { point: score.point, resonance });
}

function describeOutcome(result: BattleResult): string {
  if (result.outcome === 'win') {
    return t('score.outcome.playerWin');
  }

  if (result.outcome === 'lose') {
    return t('score.outcome.enemyWin', { enemy: enemyName(result.enemy.id) });
  }

  return t('score.outcome.draw');
}

function compareScores(playerScore: ScoreResult, enemyScore: ScoreResult): number {
  if (playerScore.point !== enemyScore.point) {
    return playerScore.point - enemyScore.point;
  }

  return resonanceRank(playerScore.resonance) - resonanceRank(enemyScore.resonance);
}

function resonanceRank(resonance: ResonanceKind): number {
  if (resonance === 'strong') {
    return 2;
  }

  if (resonance === 'resonance') {
    return 1;
  }

  return 0;
}

function randomItem<T>(items: T[]): T | undefined {
  return items[Math.floor(Math.random() * items.length)];
}

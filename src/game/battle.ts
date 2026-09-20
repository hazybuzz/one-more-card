import { EndlessRandom } from './endless/EndlessRandom';
import { rerollResonancePoint } from './resonanceReroll';
import type { EndlessBattleSnapshot } from './endless/EndlessSnapshot';
import type { EndlessEndReason } from './endless/EndlessSettlement';
import type { ItemId } from './types/item';
import type { EndlessPurchaseResult } from './endless/EndlessShop';
import { EndlessLedger } from './endless/EndlessLedger';
import { ENDLESS_CONFIG } from './endless/EndlessConfig';
import { EndlessRoster } from './endless/EndlessRoster';
import { Card, RANKS, SUITS, cardFromCode, formatCard, isJoker } from './card';
import type { BattleState } from './core/BattleState';
import { getLevelById } from './data/levelRegistry';
import { getStakeDifficulty } from './data/stakeDifficulties';
import { enemyName, t } from './i18n';
import { Deck } from './deck';
import { getNpcBasePassiveThreshold } from './data/npcOrigins';
import { EnemyState, createEnemyState, createEnemyInstancePrefix, createEnemiesForLevel, decideInvite } from './enemy';
import { EnemyType } from './enemy';
import { ResonanceKind, ScoreResult, compareScoreResults, scoreHand } from './scoring';
import { chooseResonanceShift, chooseResonanceSummonTarget, isResonanceSummonMatch } from './skills/resonanceSkills';
import type { BattlePresentationEvent } from './engine/BattleEvents';
import type { BattleMechanicId, FixedRoundConfig, FixedRoundEnemyConfig, LevelConfig } from './types/level';
import type { SkillId } from './types/skill';
import type { EntryStakeMultiplier, StakeDifficultyConfig, TableThemeConfig } from './types/tableTheme';

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
  shieldCharges: number;
  soulRedeemUsed: boolean;
}

export interface BattleResult {
  enemy: EnemyState;
  enemyScore: ScoreResult;
  playerScore: ScoreResult;
  outcome: 'win' | 'lose' | 'draw';
  damage: number;
  evaded?: boolean;
  shielded?: boolean;
  originalDamage?: number;
  guard?: DamageEvent['guard'];
}

export interface DamageEvent {
  type: 'damage' | 'clash';
  attacker?: 'player' | 'enemy';
  enemyId: EnemyType;
  enemyInstanceId?: string;
  amount: number;
  resonance?: ResonanceKind;
  hpAfter?: number;
  evaded?: boolean;
  shielded?: boolean;
  originalAmount?: number;
  iaijutsuBonus?: number;
  killRewardHeal?: number;
  guard?: {
    protectorEnemyId: EnemyType;
    protectorEnemyInstanceId?: string;
    protectorEnemyIndex: number;
    protectorHpAfter: number;
    preventedDamage: number;
    legacyAttackBonus?: number;
    killRewardHeal?: number;
  };
}

export interface SkillResult {
  used: boolean;
  success: boolean;
  message: string;
}

export interface BattleInitOptions {
  mode?: 'story' | 'formal' | 'endless';
  enemyIds?: EnemyType[];
  runId?: string;
  endlessSeed?: number;
  endlessSnapshot?: EndlessBattleSnapshot;
  /** Supplied by the paid reservation; absent on legacy runs. */
  startingSupplyCoins?: number;
  levelId?: string;
  levelConfig?: LevelConfig;
  tableThemeConfig?: TableThemeConfig;
  stakeMultiplier?: EntryStakeMultiplier;
}

export class Battle {
  readonly mode: 'story' | 'formal' | 'endless';
  readonly endlessRoster?: EndlessRoster;
  readonly endlessLedger?: EndlessLedger;
  private nextLogicAction = 0;
  private currentLogicActionId?: string;
  private enemyDamageActions = new Map<string, string>();
  private readonly instancePrefix: string;
  private nextEnemyInstance = 0;
  readonly player: PlayerState;
  readonly enemies: EnemyState[];
  readonly log: string[];
  readonly levelConfig?: LevelConfig;
  readonly tableThemeConfig?: TableThemeConfig;
  readonly stakeMultiplier?: EntryStakeMultiplier;
  readonly stakeDifficulty?: StakeDifficultyConfig;

  phase: BattlePhase;
  battleOutcome: BattleOutcome;
  endlessEndReason?: EndlessEndReason;
  currentEnemyIndex: number;
  round: number;
  roundRevealed: boolean;
  pendingSoulRedeem: boolean;
  pendingEnemySoulRedeem?: EnemyType;
  results: BattleResult[];
  damageEvents: DamageEvent[];
  passiveEffectEvents: BattlePresentationEvent[];

  private deck: Deck;
  private endlessRandom?: EndlessRandom;
  pendingItemReveal = false;
  private transactionDepth = 0;
  private persistence?: { before: () => void; commit: (snapshot: EndlessBattleSnapshot) => void; onError?: (error: unknown) => void };

  constructor(options: BattleInitOptions = {}) {
    if (options.mode === 'endless') this.endlessRandom = new EndlessRandom(options.endlessSnapshot?.randomState ?? options.endlessSeed ?? 1);
    this.deck = new Deck(this.random, options.endlessSnapshot?.deck);
    this.levelConfig = options.levelConfig ?? (options.levelId ? getLevelById(options.levelId) : undefined);
    this.tableThemeConfig = options.tableThemeConfig;
    this.mode = options.mode ?? (this.levelConfig ? 'story' : 'formal');
    this.instancePrefix = options.endlessSnapshot?.runId ?? options.runId ?? createEnemyInstancePrefix();
    if (this.mode === 'endless') this.endlessLedger = new EndlessLedger(options.startingSupplyCoins ?? 0);
    if (this.mode === 'endless') this.endlessRoster = new EndlessRoster(options.endlessSeed ?? Math.floor(Math.random() * 0x100000000));
    this.stakeMultiplier = this.mode === 'endless' ? 3 : options.tableThemeConfig ? options.stakeMultiplier : undefined;
    this.stakeDifficulty = this.stakeMultiplier ? getStakeDifficulty(this.stakeMultiplier) : undefined;
    const playerHp = this.mode === 'endless' ? ENDLESS_CONFIG.playerHp : this.levelConfig?.playerHp ?? this.tableThemeConfig?.playerHp ?? 12;
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
      shieldCharges: 0,
      soulRedeemUsed: false,
    };
    this.enemies = createEnemiesForLevel(
      this.levelConfig,
      this.tableThemeConfig,
      this.stakeDifficulty?.enemyHpModifier ?? 0,
      this.instancePrefix,
    );
    if (this.mode === 'endless') {
      const roster = options.enemyIds ?? [0, 1, 2].map((seat) => this.endlessRoster!.draw(seat));
      if (options.enemyIds) roster.forEach((id, seat) => this.endlessRoster!.rememberInitialOccupant(seat, id));
      this.enemies = roster.map((id, index) => createEnemyState(id, {
        instanceId: `${this.instancePrefix}:${index + 1}`, seatIndex: index,
        hpModifier: 1,
      }));
    }
    this.nextEnemyInstance = this.enemies.length;
    this.log = [];
    this.phase = 'choice';
    this.battleOutcome = undefined;
    this.currentEnemyIndex = 0;
    this.round = 0;
    this.roundRevealed = false;
    this.pendingSoulRedeem = false;
    this.pendingEnemySoulRedeem = undefined;
    this.results = [];
    this.damageEvents = [];
    this.passiveEffectEvents = [];
    if (options.endlessSnapshot) this.restoreEndlessSnapshot(options.endlessSnapshot);
    else if (this.endlessLedger && this.endlessLedger.startingSupplyCoins > 0) this.endlessLedger.shop.openStartingShop();
    else this.startRound();
  }

  private random = (): number => this.endlessRandom?.next() ?? Math.random();

  exportEndlessSnapshot(): EndlessBattleSnapshot {
    if (!this.endlessRoster || !this.endlessLedger || !this.endlessRandom) throw new Error('Not an endless battle');
    return JSON.parse(JSON.stringify({ version: 1, runId: this.instancePrefix, randomState: this.endlessRandom.state,
      nextEnemyInstance: this.nextEnemyInstance, nextLogicAction: this.nextLogicAction,
      enemyDamageActions: [...this.enemyDamageActions], roster: this.endlessRoster.getState(), ledger: this.endlessLedger.getSaveState(),
      player: this.player, enemies: this.enemies, deck: this.deck.getState(), log: this.log,
      phase: this.phase, battleOutcome: this.battleOutcome, endlessEndReason: this.endlessEndReason,
      currentEnemyIndex: this.currentEnemyIndex, round: this.round, roundRevealed: this.roundRevealed,
      pendingSoulRedeem: this.pendingSoulRedeem, pendingEnemySoulRedeem: this.pendingEnemySoulRedeem,
      pendingItemReveal: this.pendingItemReveal, results: this.results,
    }));
  }

  private restoreEndlessSnapshot(saved: EndlessBattleSnapshot): void {
    const state: EndlessBattleSnapshot = JSON.parse(JSON.stringify(saved));
    this.endlessRandom!.state = state.randomState;
    this.nextEnemyInstance = state.nextEnemyInstance; this.nextLogicAction = state.nextLogicAction;
    this.enemyDamageActions = new Map(state.enemyDamageActions);
    this.endlessRoster!.restore(state.roster); this.endlessLedger!.restore(state.ledger);
    Object.assign(this.player, state.player); this.enemies.splice(0, this.enemies.length, ...state.enemies);
    this.deck = new Deck(this.random, state.deck); this.log.splice(0, this.log.length, ...state.log);
    this.phase = state.phase; this.battleOutcome = state.battleOutcome; this.endlessEndReason = state.endlessEndReason;
    this.currentEnemyIndex = state.currentEnemyIndex; this.round = state.round; this.roundRevealed = state.roundRevealed;
    this.pendingSoulRedeem = state.pendingSoulRedeem; this.pendingEnemySoulRedeem = state.pendingEnemySoulRedeem;
    this.pendingItemReveal = state.pendingItemReveal;
    this.results = state.results.map((result) => ({ ...result, enemy: this.enemies.find((enemy) => enemy.instanceId === result.enemy.instanceId) ?? result.enemy }));
    this.clearDamageEvents(); this.passiveEffectEvents = [];
  }

  configureEndlessPersistence(persistence: { before: () => void; commit: (snapshot: EndlessBattleSnapshot) => void; onError?: (error: unknown) => void }): void {
    if (this.mode !== 'endless' || this.persistence) return;
    this.persistence = persistence;
    // Nested public calls form a single synchronous logic transaction.
    const methods = ['execute', 'chooseViewHand', 'chooseFate', 'inviteCurrentEnemy', 'compareCurrentEnemy', 'playerDraw',
      'playerStand', 'nextRound', 'revealByItem', 'useResonanceShift', 'useResonanceSummon', 'resolveSoulRedeem',
      'resolveEnemySoulRedeem', 'rerollPlayerResonance', 'openEndlessShop', 'buyEndlessItem', 'finishEndlessShopVisit', 'endEndlessRun'];
    const self = this as unknown as Record<string, unknown>;
    for (const name of methods) {
      const original = self[name];
      if (typeof original === 'function') self[name] = (...args: unknown[]) => {
        try { return this.endlessTransaction(() => original.apply(this, args)); }
        catch (error) {
          if (!this.persistence?.onError) throw error;
          if (name === 'buyEndlessItem') return { bought: false, reason: 'closed' };
          if (name.startsWith('useResonance')) return { used: false, success: false, message: t('endless.save.storage-unavailable') };
          return false;
        }
      };
    }
  }

  endlessTransaction<T>(operation: () => T): T {
    if (!this.persistence || this.transactionDepth > 0) return operation();
    try { this.persistence.before(); }
    catch (error) { this.persistence.onError?.(error); throw error; }
    const before = this.exportEndlessSnapshot();
    this.transactionDepth += 1;
    try {
      const result = operation();
      const after = this.exportEndlessSnapshot();
      if (JSON.stringify(after) !== JSON.stringify(before)) this.persistence.commit(after);
      return result;
    } catch (error) {
      this.restoreEndlessSnapshot(before);
      const engine = this as unknown as { clearPendingPresentationEvents?: () => void };
      engine.clearPendingPresentationEvents?.();
      this.persistence.onError?.(error);
      throw error;
    } finally { this.transactionDepth -= 1; }
  }

  chooseViewHand(): void {
    if (this.phase !== 'choice' || this.round === 0) {
      return;
    }

    this.player.fateMode = false;
    this.logEvent(t('log.viewHand', { cards: this.player.hand.map(formatCard).join(' ') }));
    this.phase = this.shouldSkipEnemyHandlingPhase() ? 'player-turn' : 'enemy-turn';
    if (this.phase === 'player-turn') {
      this.logEvent(t('log.enemyPhaseDone'));
    }
  }

  chooseFate(): void {
    if (this.phase !== 'choice' || this.round === 0) {
      return;
    }

    this.player.fateMode = true;
    this.logEvent(t('log.fate'));
    this.phase = this.shouldSkipEnemyHandlingPhase() ? 'player-turn' : 'enemy-turn';
    if (this.phase === 'player-turn') {
      this.logEvent(t('log.enemyPhaseDone'));
    }
  }

  inviteCurrentEnemy(): void {
    this.clearDamageEvents();
    const enemy = this.currentEnemy;
    if (!this.hasMechanic('invite') || !enemy || this.phase !== 'enemy-turn' || enemy.invited !== undefined) {
      return;
    }

    const drawCount = 1;
    if (
      this.hasMechanic('enemy_passives')
      && enemy.id === 'goblin'
      && enemy.hp < this.enemyPassiveHpThreshold(enemy.id)
      && !enemy.passiveTriggeredThisRound
    ) {
      enemy.passiveTriggeredThisRound = true;
      this.pushPassiveEffect('goblin_instinct', enemy, [enemy], 'sense');
      this.logEvent(t('log.goblinInstinct'));
    }

    const fixedEnemy = this.currentFixedEnemyConfig(enemy.id);
    const decision = fixedEnemy?.scriptedInviteResult
      ? {
        accepts: fixedEnemy.scriptedInviteResult === 'accept',
        reason: fixedEnemy.scriptedInviteReasonKey ? t(fixedEnemy.scriptedInviteReasonKey) : t('enemy.ai.goblin.mid'),
      }
      : decideInvite(enemy, this.playerScore().point, this.enemyPassiveHpThreshold(enemy.id), this.random);
    enemy.invited = true;
    enemy.invitedDrawCount = drawCount;
    enemy.acceptedInvite = decision.accepts;
    if (decision.accepts) {
      const cards = fixedEnemy?.drawCardOnAccept
        ? [cardFromCode(fixedEnemy.drawCardOnAccept)]
        : this.drawCards(drawCount);
      enemy.hand.push(...cards);
      this.applyHeavenlyInsightIfNeeded(enemy, cards[0]);
      this.logEvent(t('log.enemyAcceptInvite', { enemy: enemyName(enemy.id), reason: decision.reason }));
    } else {
      this.applyIaijutsuChargeIfNeeded(enemy);
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
    enemy.revealed = true;
    this.logCompareResult(result);
    const killRewardHeal = this.applyDefeatAndReward(enemy);
    this.attachKillRewardToLatestDamage(enemy.id, killRewardHeal);

    if (this.markSoulRedeemPending()) {
      return;
    }

    if (this.player.hp <= 0) {
      this.battleOutcome = 'defeat';
      if (this.mode === 'endless') this.endlessEndReason = 'defeat';
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
    if (!this.hasMechanic('skills') || !this.isSkillAvailable('resonance_shift')) {
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

    const conversion = chooseResonanceShift(candidates, this.random);
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
    if (!this.hasMechanic('skills') || !this.isSkillAvailable('resonance_summon')) {
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

    const summonTarget = chooseResonanceSummonTarget(this.player.hand, this.random);
    if (!summonTarget) {
      this.logEvent(t('log.summonNoTarget'));
      return { used: false, success: false, message: t('skill.invalid.noSummonTarget') };
    }

    const fixedSummonCard = this.currentFixedRound()?.resonanceSummonCard
      ? cardFromCode(this.currentFixedRound()?.resonanceSummonCard ?? '')
      : undefined;
    const card = fixedSummonCard && isResonanceSummonMatch(fixedSummonCard, summonTarget)
      ? this.deck.drawWhere((candidate) => candidate.suit === fixedSummonCard.suit && candidate.rank === fixedSummonCard.rank) ?? fixedSummonCard
      : this.deck.drawWhere((candidate) => isResonanceSummonMatch(candidate, summonTarget));
    if (!card) {
      const target = summonTarget.kind === 'rank' ? summonTarget.rank : summonTarget.suit;
      this.logEvent(t('log.summonNoDeckTarget', { target }));
      return { used: false, success: false, message: t('skill.invalid.noSummonTargetInDeck', { target }) };
    }

    this.player.resonanceSummonUsed = true;
    this.player.resonanceSummonCooldown = 2;
    this.player.resonanceShiftUsed = true;
    this.player.drawLocked = true;
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
    if (this.phase !== 'round-result' || this.pendingSoulRedeem || this.pendingEnemySoulRedeem) {
      return;
    }

    if (this.player.hp <= 0) {
      this.updateBattleOutcome();
      return;
    }
    if (this.openEndlessShop()) return;
    this.clearDamageEvents();
    this.startRound();
  }

  revealByItem(): void {
    if (this.round === 0) return;
    this.pendingItemReveal = false;
    this.clearDamageEvents();
    this.revealRound();
  }

  get currentEnemy(): EnemyState | undefined {
    return this.enemies[this.currentEnemyIndex];
  }

  get aliveEnemies(): EnemyState[] {
    return this.enemies.filter((enemy) => !enemy.defeated);
  }

  endEndlessRun(): boolean {
    if (this.mode !== 'endless' || this.battleOutcome || this.pendingSoulRedeem || this.pendingEnemySoulRedeem
      || this.player.hp <= 0 || !['choice', 'enemy-turn', 'player-turn', 'round-result'].includes(this.phase)) return false;
    this.endlessEndReason = 'exit';
    this.battleOutcome = 'defeat';
    this.phase = 'battle-result';
    return true;
  }

  openEndlessShop(): boolean {
    if (this.endlessLedger?.shop.isOpeningVisit) return this.round === 0 && this.phase === 'choice' && !this.battleOutcome;
    if (!this.endlessLedger || this.phase !== 'round-result' || this.battleOutcome
      || this.player.hp <= 0 || this.pendingSoulRedeem || this.pendingEnemySoulRedeem) return false;
    return this.endlessLedger.shop.open(this.endlessLedger.getState().defeatedCount);
  }

  buyEndlessItem(itemId: ItemId, visitId: number): EndlessPurchaseResult {
    if (!this.openEndlessShop()) return { bought: false, reason: 'closed' };
    return this.endlessLedger!.shop.buy(itemId, visitId, this.endlessLedger!.getState().earnedCoins + this.endlessLedger!.startingSupplyCoins);
  }

  finishEndlessShopVisit(visitId: number): boolean {
    if (!this.openEndlessShop()) return false;
    const opening = this.endlessLedger!.shop.isOpeningVisit;
    const finished = this.endlessLedger!.shop.finishVisit(visitId);
    if (finished && opening) this.startRound();
    return finished;
  }

  getState(): BattleState {
    return {
      mode: this.mode,
      endlessRoster: this.endlessRoster?.getState(),
      endlessAccounting: this.endlessLedger?.getState(),
      endlessEndReason: this.endlessEndReason,
      levelId: this.levelConfig?.id,
      levelConfig: this.levelConfig,
      levelIntroLessonKey: this.levelConfig?.levelIntroLessonKey,
      phase: this.phase,
      battleOutcome: this.battleOutcome,
      currentEnemyIndex: this.currentEnemyIndex,
      currentEnemyId: this.currentEnemy?.id,
      currentEnemyInstanceId: this.currentEnemy?.instanceId,
      round: this.round,
      currentFixedRoundId: this.currentFixedRound()?.id,
      currentLessonKey: this.currentFixedRound()?.lessonKey,
      currentTutorialBeforeCompareKey: this.currentFixedRound()?.tutorialBeforeCompareKey,
      currentPlayerTurnLessonKey: this.currentFixedRound()?.playerTurnLessonKey,
      availableActions: this.currentFixedRound()?.availableActions,
      availableSkills: this.currentFixedRound()?.availableSkills,
      maxPlayerDrawsThisRound: this.maxPlayerDrawsThisRound(),
      roundRevealed: this.roundRevealed,
      pendingSoulRedeem: this.pendingSoulRedeem,
      pendingEnemySoulRedeem: this.pendingEnemySoulRedeem,
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
        shieldCharges: this.player.shieldCharges,
        soulRedeemUsed: this.player.soulRedeemUsed,
        score: this.playerScore(),
      },
      enemies: this.enemies.map((enemy) => ({
        id: enemy.id,
        instanceId: enemy.instanceId, seatIndex: enemy.seatIndex, sourceThemeId: enemy.sourceThemeId,
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        hand: enemy.hand.map((card) => ({ ...card })),
        revealed: enemy.revealed,
        compared: enemy.compared,
        invited: enemy.invited,
        acceptedInvite: enemy.acceptedInvite,
        invitedDrawCount: enemy.invitedDrawCount,
        passiveTriggered: enemy.passiveTriggered,
        passiveTriggeredThisRound: enemy.passiveTriggeredThisRound,
        soulRedeemUsed: enemy.soulRedeemUsed,
        defeated: enemy.defeated,
        attackBonus: enemy.attackBonus,
        roundAttackBonus: enemy.roundAttackBonus,
        taoistTalismaned: enemy.taoistTalismaned,
        talismanSourceInstanceId: enemy.talismanSourceInstanceId,
        iaijutsuStacks: enemy.iaijutsuStacks,
        smokeScreenArmed: enemy.smokeScreenArmed,
        smokeScreenUsed: enemy.smokeScreenUsed,
        hanamiFanTargetId: enemy.hanamiFanTargetId,
        hanamiFanTargetInstanceId: enemy.hanamiFanTargetInstanceId,
        hanamiDamageBank: enemy.hanamiDamageBank,
        summoned: enemy.summoned,
        summonCount: enemy.summonCount,
        score: this.scoreFor(enemy.hand),
      })),
      aliveEnemyIds: this.aliveEnemies.map((enemy) => enemy.id),
      results: this.results.map((result) => ({
        enemyId: result.enemy.id,
        enemyScore: result.enemyScore,
        playerScore: result.playerScore,
        outcome: result.outcome,
        damage: result.damage,
        evaded: result.evaded,
        shielded: result.shielded,
        originalDamage: result.originalDamage,
      })),
      logs: [...this.log],
    };
  }

  playerScore(): ScoreResult {
    return this.scoreFor(this.player.hand);
  }

  canUseResonanceShift(): boolean {
    if (!this.isSkillAvailable('resonance_shift') || this.phase !== 'player-turn' || this.player.resonanceShiftUsed || this.player.resonanceShiftCooldown > 0 || this.playerScore().resonance !== 'none') {
      return false;
    }

    const candidates = this.player.hand.filter((card) => !isJoker(card) && card.suit);
    return chooseResonanceShift(candidates) !== undefined;
  }

  canUseResonanceSummon(): boolean {
    return this.isSkillAvailable('resonance_summon')
      && this.phase === 'player-turn'
      && !this.player.resonanceSummonUsed
      && this.player.resonanceSummonCooldown <= 0
      && this.playerScore().resonance !== 'none';
  }

  healPlayer(amount: number): number {
    const beforeHp = this.player.hp;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.max(0, Math.floor(amount)));
    return this.player.hp - beforeHp;
  }

  activateHolyShield(charges = 2): boolean {
    if (this.phase !== 'player-turn' || this.player.shieldCharges > 0) {
      return false;
    }

    this.player.shieldCharges = Math.max(1, Math.floor(charges));
    this.logEvent(t('itemEffect.holyShield.used', { charges: this.player.shieldCharges }));
    return true;
  }

  addLog(message: string): void {
    this.logEvent(message);
  }

  useResonanceHorn(): { success: boolean; cards: Card[] } {
    const fixedCards = this.currentFixedRound()?.resonanceHornCards;
    this.player.hand = fixedCards
      ? fixedCards.map(cardFromCode)
      : this.createRandomResonantPair();

    this.player.fateMode = false;
    this.logEvent(t('itemEffect.resonanceHorn.success', { cards: this.player.hand.map(formatCard).join(' ') }));
    this.phase = 'enemy-turn';
    return {
      success: true,
      cards: this.player.hand,
    };
  }

  rerollPlayerHandByFate(): Card[] {
    const drawCount = Math.max(1, this.player.hand.length);
    const fixedCards = this.currentFixedRound()?.fateRerollCards;
    this.player.hand = fixedCards
      ? fixedCards.slice(0, drawCount).map(cardFromCode)
      : this.drawCards(drawCount);
    this.player.incomingDamageBonus = Math.max(this.player.incomingDamageBonus, 1);
    this.player.drawLocked = true;
    this.player.resonanceShiftUsed = true;
    this.player.resonanceSummonUsed = true;
    return this.player.hand;
  }

  rerollPlayerResonance(): boolean {
    if (this.phase !== 'player-turn' || this.battleOutcome || this.pendingSoulRedeem || this.pendingEnemySoulRedeem) return false;
    const before = this.playerScore().point;
    const hand = rerollResonancePoint(this.player.hand, this.random);
    if (!hand) return false;
    this.player.hand = hand;
    this.logEvent(t('itemEffect.resonanceDice.used', { before, after: this.playerScore().point }));
    return true;
  }

  private startRound(): void {
    this.deck = new Deck(this.random);
    this.round += 1;
    this.endlessLedger?.beginRound(this.round, `${this.instancePrefix}:round:${this.round}`);
    this.results = [];
    this.phase = 'choice';
    this.battleOutcome = undefined;
    this.roundRevealed = false;
    this.player.fateMode = false;
    this.player.drawCountThisRound = 0;
    this.player.resonanceShiftUsed = false;
    this.player.resonanceSummonUsed = false;
    this.player.resonanceShiftCooldown = Math.max(0, this.player.resonanceShiftCooldown - 1);
    this.player.resonanceSummonCooldown = Math.max(0, this.player.resonanceSummonCooldown - 1);
    this.player.drawLocked = false;
    this.player.incomingDamageBonus = 0;
    const fixedRound = this.currentFixedRound();
    if (fixedRound?.playerHp !== undefined) {
      this.player.hp = Math.min(this.player.maxHp, Math.max(0, Math.floor(fixedRound.playerHp)));
    }
    this.prepareEnemyRoundStartPassives();
    this.currentEnemyIndex = this.firstAliveEnemyIndex();
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
    if (enemy && !enemy.compared) {
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
    const actionId = `${this.instancePrefix}:attack:${++this.nextLogicAction}`;
    this.currentLogicActionId = actionId;
    this.enemyDamageActions.set(enemy.instanceId, actionId);
    this.applyPreComparePassive(enemy);
    const playerScore = playerScoreOverride ?? this.scoreFor(this.player.hand);
    const fateDamageMultiplier = this.player.fateMode ? 2 : 1;
    const enemyScore = this.scoreFor(enemy.hand);
    let outcome: BattleResult['outcome'] = 'draw';
    let damage = 0;
    let evaded = false;
    let shielded = false;
    let originalDamage: number | undefined;
    let iaijutsuBonus = 0;
    let guard: DamageEvent['guard'];

    const comparison = compareScoreResults(playerScore, enemyScore);

    if (comparison > 0) {
      outcome = 'win';
      damage = playerScore.multiplier * fateDamageMultiplier;
      originalDamage = damage;
      const smokeEvaded = this.applySmokeSubstitutionIfNeeded(enemy, originalDamage);
      evaded = smokeEvaded;
      const protectorHpBefore = this.enemies.find((candidate) => candidate.id === 'swordsman' && candidate !== enemy && !candidate.defeated && !candidate.passiveTriggeredThisRound)?.hp;
      const bladeRescue = smokeEvaded ? undefined : this.applyBladeToRescueIfNeeded(enemy, damage);
      damage = smokeEvaded ? 0 : (bladeRescue?.damageAfter ?? damage);
      guard = bladeRescue?.guard;
      const hpBefore = enemy.hp;
      enemy.hp = Math.max(0, enemy.hp - damage);
      const protector = guard ? this.enemies.find((candidate) => candidate.instanceId === guard?.protectorEnemyInstanceId) : undefined;
      const recipient = protector ?? enemy;
      const actualDamage = guard ? Math.min(guard.preventedDamage, protectorHpBefore ?? 0) : hpBefore - enemy.hp;
      if (!enemy.summoned && enemy.id !== 'einherjar' && !recipient.summoned && recipient.id !== 'einherjar' && playerScore.resonance !== 'none') {
        this.endlessLedger?.recordResonance(actionId, recipient.instanceId, playerScore.multiplier, actualDamage);
      }
      this.damageEvents.push({
        type: 'damage',
        attacker: 'player',
        enemyId: enemy.id,
        enemyInstanceId: enemy.instanceId,
        amount: damage,
        resonance: playerScore.resonance,
        hpAfter: enemy.hp,
        evaded: smokeEvaded,
        originalAmount: smokeEvaded ? originalDamage : undefined,
        guard,
      });
    } else if (comparison < 0) {
      outcome = 'lose';
      iaijutsuBonus = this.consumeIaijutsuOnWin(enemy);
      damage = enemyScore.multiplier + this.player.incomingDamageBonus + this.enemyAttackBonus(enemy) + iaijutsuBonus;
      originalDamage = damage;
      if (this.player.shieldCharges > 0 && damage > 0) {
        this.player.shieldCharges -= 1;
        shielded = true;
        damage = 0;
      } else {
        this.player.hp = Math.max(0, this.player.hp - damage);
        this.recordHanamiDamage(damage);
        this.applyPostDamagePassive(enemy, damage);
      }
      this.damageEvents.push({
        type: 'damage',
        attacker: 'enemy',
        enemyId: enemy.id,
        enemyInstanceId: enemy.instanceId,
        amount: damage,
        resonance: enemyScore.resonance,
        shielded,
        originalAmount: shielded ? originalDamage : undefined,
        ...(iaijutsuBonus > 0 ? { iaijutsuBonus } : {}),
      });
    } else {
      this.damageEvents.push({ type: 'clash', enemyId: enemy.id, enemyInstanceId: enemy.instanceId, amount: 0 });
    }

    this.currentLogicActionId = undefined;
    return {
      enemy,
      enemyScore,
      playerScore,
      outcome,
      damage,
      evaded,
      shielded,
      originalDamage: evaded || shielded ? originalDamage : undefined,
      guard,
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
      if (enemy.defeated || enemy.compared) {
        continue;
      }

      const result = this.compareEnemy(enemy, playerScore);
      this.results.push(result);
      enemy.compared = true;
      this.logCompareResult(result);
      const killRewardHeal = this.applyDefeatAndReward(enemy);
      this.attachKillRewardToLatestDamage(enemy.id, killRewardHeal);

      if (this.player.hp <= 0) {
        return;
      }
    }
  }

  private applyPreComparePassive(enemy: EnemyState): void {
    if (
      !this.hasMechanic('enemy_passives')
      || enemy.id !== 'gambler'
      || enemy.hp >= this.enemyPassiveHpThreshold(enemy.id)
      || enemy.passiveTriggeredThisRound
    ) {
      return;
    }

    const point = this.scoreFor(enemy.hand).point;
    if (point >= 4) {
      return;
    }

    const drawCount = enemy.hand.length;
    enemy.hand = this.drawCards(drawCount as 1 | 2);
    enemy.passiveTriggeredThisRound = true;
    this.pushPassiveEffect('gambler_blessing', enemy, [enemy], 'reroll', drawCount);
    this.pushCardsRedealtEvent(enemy, drawCount);
    this.logEvent(t('log.gamblerBlessing', { count: drawCount }));
  }

  private applyPostDamagePassive(enemy: EnemyState, damage: number): void {
    if (
      !this.hasMechanic('enemy_passives')
      || enemy.id !== 'werewolf'
      || enemy.hp >= this.enemyPassiveHpThreshold(enemy.id)
      || damage <= 0
    ) {
      return;
    }

    const beforeHeal = enemy.hp;
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + damage);
    const healed = enemy.hp - beforeHeal;
    if (healed > 0) {
      this.pushPassiveEffect('werewolf_lifesteal', enemy, [enemy], 'heal', healed);
      this.logEvent(t('log.werewolfLifesteal', { healed }));
    }
  }

  private applyDefeatAndReward(enemy: EnemyState): number {
    if (enemy.defeated || enemy.hp > 0) {
      this.applyWarHornIfNeeded(enemy);
      return 0;
    }

    if (this.markEnemySoulRedeemPending(enemy)) {
      return 0;
    }

    enemy.defeated = true;
    this.endlessLedger?.recordDefeat(this.currentLogicActionId ?? this.enemyDamageActions.get(enemy.instanceId) ?? `${this.instancePrefix}:defeat:${enemy.instanceId}`, enemy.instanceId, enemy.id, enemy.summoned || enemy.id === 'einherjar');
    if (enemy.summoned || this.mode === 'endless' && enemy.id === 'einherjar') {
      this.logEvent(t('log.summonedEnemyDefeated', { enemy: enemyName(enemy.id) }));
      return 0;
    }

    const beforeHeal = this.player.hp;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
    const healed = this.player.hp - beforeHeal;
    this.logEvent(t('log.enemyDefeatedReward', { enemy: enemyName(enemy.id), healed }));
    return healed;
  }

  private attachKillRewardToLatestDamage(enemyId: EnemyType, amount: number): void {
    if (amount <= 0) {
      return;
    }

    for (let index = this.damageEvents.length - 1; index >= 0; index -= 1) {
      const event = this.damageEvents[index];
      if (event.type === 'damage' && event.attacker === 'player' && event.enemyId === enemyId) {
        event.killRewardHeal = amount;
        return;
      }
    }
  }

  private prepareEnemyRoundStartPassives(): void {
    this.enemies.forEach((enemy) => {
      enemy.roundAttackBonus = 0;
      enemy.passiveTriggeredThisRound = false;
      enemy.taoistTalismaned = false;
      enemy.talismanSourceInstanceId = undefined;
    });

    if (!this.hasMechanic('enemy_passives')) {
      return;
    }

    if (this.mode === 'endless') {
      this.applyEinherjarSummon();
      this.refillEndlessSeats();
    }
    this.applyRuneBlessing();
    if (this.mode !== 'endless') this.applyEinherjarSummon();
    this.applyRedSilkToast();
    this.applyTaoistTalisman();
    this.applyHanamiDance();
    this.applySmokeScreenArm();
  }

  private refillEndlessSeats(): void {
    this.enemies.forEach((enemy, index) => {
      if (!enemy.defeated) return;
      const id = this.endlessRoster!.draw(index);
      const next = this.replaceEnemyAt(index, id);
      this.logEvent(t('endless.npcEntered', { enemy: enemyName(id) }));
      this.passiveEffectEvents.push({ type: 'enemy-entered', enemyId: id,
        enemyInstanceId: next.instanceId, enemyIndex: index, sourceThemeId: next.sourceThemeId });
    });
  }

  private applyBladeToRescueIfNeeded(enemy: EnemyState, damage: number): {
    damageAfter: number;
    guard: NonNullable<DamageEvent['guard']>;
  } | undefined {
    if (!this.hasMechanic('enemy_passives') || damage < enemy.hp) {
      return undefined;
    }

    const damageAfter = 0;

    const swordsman = this.enemies.find((candidate) => (
      candidate.id === 'swordsman'
      && candidate !== enemy
      && !candidate.defeated
      && !candidate.passiveTriggeredThisRound
    ));
    if (!swordsman) {
      return undefined;
    }

    swordsman.passiveTriggeredThisRound = true;
    swordsman.hp = Math.max(0, swordsman.hp - damage);
    const swordsmanDefeated = swordsman.hp <= 0;
    if (swordsmanDefeated) {
      const killRewardHeal = this.applyDefeatAndReward(swordsman);
      enemy.attackBonus += 2;
      this.logEvent(t('log.chivalryLegacy', { enemy: enemyName(enemy.id) }));
      return {
        damageAfter,
        guard: {
          protectorEnemyId: swordsman.id,
          protectorEnemyInstanceId: swordsman.instanceId,
          protectorEnemyIndex: this.enemies.indexOf(swordsman),
          protectorHpAfter: swordsman.hp,
          preventedDamage: damage,
          legacyAttackBonus: 2,
          killRewardHeal,
        },
      };
    }
    return {
      damageAfter,
      guard: {
        protectorEnemyId: swordsman.id,
        protectorEnemyInstanceId: swordsman.instanceId,
        protectorEnemyIndex: this.enemies.indexOf(swordsman),
        protectorHpAfter: swordsman.hp,
        preventedDamage: damage,
        legacyAttackBonus: undefined,
      },
    };
  }

  private applyRuneBlessing(): void {
    const shaman = this.enemies.find((enemy) => enemy.id === 'rune_shaman' && !enemy.defeated);
    if (!shaman || shaman.hp >= this.enemyPassiveHpThreshold(shaman.id)) {
      return;
    }

    const candidates = this.aliveEnemies.filter((enemy) => enemy.id !== 'rune_shaman');
    const attackTarget = candidates[Math.floor(this.random() * candidates.length)] ?? shaman;
    const woundedTargets = this.aliveEnemies.filter((enemy) => enemy.hp < enemy.maxHp);
    const shouldHeal = woundedTargets.length > 0 && this.random() >= 0.5;
    if (!shouldHeal) {
      const target = attackTarget;
      target.roundAttackBonus += 1;
      shaman.passiveTriggeredThisRound = true;
      this.pushPassiveEffect('rune_blessing', shaman, [target], 'attack', 1);
      this.logEvent(t('log.runeBlessingAttack', { enemy: enemyName(target.id) }));
      return;
    }

    const target = woundedTargets[Math.floor(this.random() * woundedTargets.length)];
    const beforeHp = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + 1);
    const healed = target.hp - beforeHp;
    shaman.passiveTriggeredThisRound = true;
    this.pushPassiveEffect('rune_blessing', shaman, [target], 'heal', healed);
    this.logEvent(t('log.runeBlessingHeal', { enemy: enemyName(target.id), healed }));
  }

  private applyEinherjarSummon(): void {
    const valkyrie = this.enemies.find((enemy) => enemy.id === 'valkyrie' && !enemy.defeated);
    if (!valkyrie || valkyrie.hp >= this.enemyPassiveHpThreshold(valkyrie.id) || valkyrie.summonCount >= 2) {
      return;
    }

    if (this.enemies.some((enemy) => enemy.id === 'einherjar' && !enemy.defeated)) {
      return;
    }

    const defeatedSlot = this.enemies.find((enemy) => enemy.defeated && enemy.id !== 'valkyrie');
    if (!defeatedSlot) {
      return;
    }

    const summoned = this.replaceEnemyAt(this.enemies.indexOf(defeatedSlot), 'einherjar', { maxHp: 1, summoned: true });
    valkyrie.summonCount += 1;
    valkyrie.passiveTriggeredThisRound = true;
    this.pushPassiveEffect('einherjar_summon', valkyrie, [summoned], 'summon', valkyrie.summonCount);
    this.logEvent(t('log.einherjarSummon', { count: valkyrie.summonCount }));
  }

  private applyWarHornIfNeeded(enemy: EnemyState): void {
    if (!this.hasMechanic('enemy_passives') || enemy.id !== 'viking_warrior' || enemy.summoned || enemy.hp >= this.enemyPassiveHpThreshold(enemy.id) || enemy.passiveTriggered) {
      return;
    }

    enemy.passiveTriggered = true;
    enemy.passiveTriggeredThisRound = true;
    this.enemies.forEach((candidate) => {
      if (!candidate.defeated) {
        candidate.attackBonus += 1;
      }
    });
    this.pushPassiveEffect('war_horn', enemy, this.aliveEnemies, 'attack', 1);
    this.logEvent(t('log.warHorn'));
  }

  private applyRedSilkToast(): void {
    const songstress = this.enemies.find((enemy) => enemy.id === 'songstress' && !enemy.defeated);
    if (!songstress) {
      return;
    }

    const threshold = this.enemyPassiveHpThreshold(songstress.id);
    const candidates = this.aliveEnemies.filter((enemy) => enemy !== songstress && enemy.hp < threshold);
    if (candidates.length === 0) {
      return;
    }

    const lowestHp = Math.min(...candidates.map((enemy) => enemy.hp));
    const lowestHpCandidates = candidates.filter((enemy) => enemy.hp === lowestHp);
    const target = lowestHpCandidates[Math.floor(this.random() * lowestHpCandidates.length)];
    target.hp = Math.min(target.maxHp, target.hp + 1);
    target.roundAttackBonus += 1;
    songstress.passiveTriggeredThisRound = true;
    this.pushPassiveEffect('red_silk_toast', songstress, [target], 'attack', 1);
    this.logEvent(t('log.redSilkToast', { enemy: enemyName(target.id) }));
  }

  private applyTaoistTalisman(): void {
    const taoist = this.enemies.find((enemy) => enemy.id === 'taoist' && !enemy.defeated);
    if (!taoist) {
      return;
    }

    const candidates = this.aliveEnemies;
    if (candidates.length === 0) {
      return;
    }

    const target = candidates[Math.floor(this.random() * candidates.length)];
    target.taoistTalismaned = true;
    target.talismanSourceInstanceId = taoist.instanceId;
    taoist.passiveTriggeredThisRound = true;
    this.pushPassiveEffect('heavenly_insight', taoist, [target], 'sense');
    this.logEvent(t('log.heavenlyInsightMark', { enemy: enemyName(target.id) }));
  }

  private applyHeavenlyInsightIfNeeded(enemy: EnemyState, drawnCard: Card | undefined): void {
    if (!drawnCard || !this.hasMechanic('enemy_passives') || !enemy.taoistTalismaned) {
      return;
    }

    enemy.taoistTalismaned = false;
    if (this.scoreFor(enemy.hand).point >= 4) {
      return;
    }

    const taoist = this.enemies.find((candidate) => candidate.instanceId === enemy.talismanSourceInstanceId && candidate.id === 'taoist');
    enemy.talismanSourceInstanceId = undefined;
    if (!taoist) {
      return;
    }

    const replacement = this.deck.draw();
    const cardIndex = enemy.hand.length - 1;
    enemy.hand[cardIndex] = replacement;
    this.pushPassiveEffect('heavenly_insight', taoist, [enemy], 'reroll', 1);
    this.pushCardReplacementEvent(enemy, cardIndex, drawnCard, replacement);
    this.logEvent(t('log.heavenlyInsight', { before: formatCard(drawnCard), after: formatCard(replacement) }));
  }

  private applyIaijutsuChargeIfNeeded(enemy: EnemyState): void {
    if (!this.hasMechanic('enemy_passives') || enemy.id !== 'shogun_samurai' || enemy.defeated || enemy.iaijutsuStacks >= 2) {
      return;
    }

    enemy.iaijutsuStacks += 1;
    this.pushPassiveEffect('iaijutsu_charge', enemy, [enemy], 'charge', enemy.iaijutsuStacks);
    this.logEvent(t('log.iaijutsuCharge', { stacks: enemy.iaijutsuStacks }));
  }

  private consumeIaijutsuOnWin(enemy: EnemyState): number {
    if (!this.hasMechanic('enemy_passives') || enemy.id !== 'shogun_samurai' || enemy.iaijutsuStacks <= 0) {
      return 0;
    }

    const bonus = enemy.iaijutsuStacks;
    enemy.iaijutsuStacks = 0;
    this.pushPassiveEffect('iaijutsu_charge', enemy, [enemy], 'release', bonus);
    this.logEvent(t('log.iaijutsuRelease', { bonus }));
    return bonus;
  }

  private applySmokeScreenArm(): void {
    const ninja = this.enemies.find((enemy) => enemy.id === 'ninja' && !enemy.defeated);
    if (!ninja || ninja.hp >= this.enemyPassiveHpThreshold(ninja.id) || ninja.smokeScreenUsed || ninja.smokeScreenArmed) {
      return;
    }

    ninja.smokeScreenArmed = true;
    this.pushPassiveEffect('smoke_substitution', ninja, [ninja], 'arm');
    this.logEvent(t('log.smokeScreenArmed'));
  }

  private applySmokeSubstitutionIfNeeded(enemy: EnemyState, damage: number): boolean {
    if (!this.hasMechanic('enemy_passives') || enemy.id !== 'ninja' || !enemy.smokeScreenArmed || damage <= 0) {
      return false;
    }

    enemy.smokeScreenArmed = false;
    enemy.smokeScreenUsed = true;
    return true;
  }

  private recordHanamiDamage(damage: number): void {
    if (!this.hasMechanic('enemy_passives') || damage <= 0) {
      return;
    }

    const oiran = this.enemies.find((enemy) => enemy.id === 'oiran' && !enemy.defeated);
    if (!oiran || !oiran.hanamiFanTargetInstanceId) {
      return;
    }

    oiran.hanamiDamageBank += damage;
  }

  private applyHanamiDance(): void {
    const oiran = this.enemies.find((enemy) => enemy.id === 'oiran' && !enemy.defeated);
    if (!oiran) {
      return;
    }

    const previousTarget = oiran.hanamiFanTargetInstanceId
      ? this.enemies.find((enemy) => enemy.instanceId === oiran.hanamiFanTargetInstanceId && !enemy.defeated)
      : undefined;
    const rewardAmount = Math.min(2, oiran.hanamiDamageBank);
    oiran.hanamiFanTargetId = undefined;
    oiran.hanamiFanTargetInstanceId = undefined;
    oiran.hanamiDamageBank = 0;

    if (previousTarget && rewardAmount > 0) {
      const canHeal = previousTarget.hp < previousTarget.maxHp;
      const shouldHeal = canHeal && this.random() < 0.5;
      if (shouldHeal) {
        const hpBefore = previousTarget.hp;
        previousTarget.hp = Math.min(previousTarget.maxHp, previousTarget.hp + rewardAmount);
        const healed = previousTarget.hp - hpBefore;
        this.pushPassiveEffect('hanami_dance', oiran, [previousTarget], 'reward_heal', healed, 'round-start');
        this.logEvent(t('log.hanamiRewardHeal', { enemy: enemyName(previousTarget.id), amount: healed }));
      } else {
        previousTarget.roundAttackBonus += rewardAmount;
        this.pushPassiveEffect('hanami_dance', oiran, [previousTarget], 'reward_attack', rewardAmount, 'round-start');
        this.logEvent(t('log.hanamiRewardAttack', { enemy: enemyName(previousTarget.id), amount: rewardAmount }));
      }
    }

    const candidates = this.aliveEnemies.filter((enemy) => enemy !== oiran);
    if (candidates.length === 0) {
      return;
    }

    const target = candidates[Math.floor(this.random() * candidates.length)];
    oiran.hanamiFanTargetId = target.id;
    oiran.hanamiFanTargetInstanceId = target.instanceId;
    this.pushPassiveEffect('hanami_dance', oiran, [target], 'mark', undefined, 'round-start');
    this.logEvent(t('log.hanamiMark', { enemy: enemyName(target.id) }));
  }

  private enemyAttackBonus(enemy: EnemyState): number {
    return Math.max(0, enemy.attackBonus + enemy.roundAttackBonus) + (this.endlessLedger?.currentAttackBonus ?? 0);
  }

  enemyPassiveHpThreshold(enemyId: EnemyType): number {
    const baseThreshold = this.mode === 'endless'
      ? getNpcBasePassiveThreshold(enemyId)
      : this.tableThemeConfig?.passiveHpThresholds?.[enemyId] ?? (this.tableThemeConfig ? getNpcBasePassiveThreshold(enemyId) : 3);
    return Math.max(1, baseThreshold + (this.stakeDifficulty?.passiveHpThresholdModifier ?? 0));
  }

  /** Replacing a seat invalidates relationships to the departed instance. */
  replaceEnemyAt(index: number, enemyId: EnemyType, options: { maxHp?: number; summoned?: boolean } = {}): EnemyState {
    const previous = this.enemies[index];
    if (!previous) throw new Error(`Unknown enemy seat: ${index}`);
    for (const enemy of this.enemies) {
      if (enemy.hanamiFanTargetInstanceId === previous.instanceId) {
        enemy.hanamiFanTargetId = undefined;
        enemy.hanamiFanTargetInstanceId = undefined;
        enemy.hanamiDamageBank = 0;
      }
      if (enemy.talismanSourceInstanceId === previous.instanceId) {
        enemy.taoistTalismaned = false;
        enemy.talismanSourceInstanceId = undefined;
      }
    }
    const next = createEnemyState(enemyId, { hpModifier: (this.stakeDifficulty?.enemyHpModifier ?? 0) + (this.endlessLedger?.currentStage ?? 0), ...options, instanceId: `${this.instancePrefix}:${++this.nextEnemyInstance}`, seatIndex: index });
    this.enemies[index] = next;
    return next;
  }

  consumePassiveEffectEvents(): BattlePresentationEvent[] {
    const events = [...this.passiveEffectEvents];
    this.passiveEffectEvents = [];
    return events;
  }

  private pushPassiveEffect(
    passiveId: Extract<BattlePresentationEvent, { type: 'passive-effect' }>['passiveId'],
    source: EnemyState,
    targets: EnemyState[],
    effect: Extract<BattlePresentationEvent, { type: 'passive-effect' }>['effect'],
    amount?: number,
    timing: 'round-start' | 'combat' = 'combat',
  ): void {
    this.passiveEffectEvents.push({
      type: 'passive-effect',
      passiveId,
      sourceEnemyId: source.id,
      sourceEnemyInstanceId: source.instanceId,
      sourceEnemyIndex: this.enemies.indexOf(source),
      targetEnemyIds: targets.map((target) => target.id),
      targetEnemyInstanceIds: targets.map((target) => target.instanceId),
      targetEnemyIndexes: targets.map((target) => this.enemies.indexOf(target)),
      effect,
      amount,
      timing,
    });
  }

  private pushCardsRedealtEvent(enemy: EnemyState, count: number): void {
    this.passiveEffectEvents.push({
      type: 'cards-redealt',
      target: enemy.id,
      targetEnemyIndex: this.enemies.indexOf(enemy),
      targetEnemyInstanceId: enemy.instanceId,
      count,
    });
  }

  private pushCardReplacementEvent(enemy: EnemyState, cardIndex: number, previousCard: Card, replacementCard: Card): void {
    this.passiveEffectEvents.push({
      type: 'card-replaced',
      target: enemy.id,
      targetEnemyIndex: this.enemies.indexOf(enemy),
      targetEnemyInstanceId: enemy.instanceId,
      cardIndex,
      previousCard,
      replacementCard,
    });
  }

  resolveSoulRedeem(): void {
    if (!this.pendingSoulRedeem) {
      return;
    }

    this.pendingSoulRedeem = false;
    this.player.hp = Math.min(this.player.maxHp, 3);
    if (this.endlessLedger?.shop.hasPending(this.endlessLedger.getState().defeatedCount)) {
      this.phase = 'round-result';
      this.roundRevealed = true;
      return;
    }
    this.startRound();
  }

  resolveEnemySoulRedeem(): void {
    if (!this.pendingEnemySoulRedeem) {
      return;
    }

    const enemy = this.enemies.find((candidate) => candidate.id === this.pendingEnemySoulRedeem);
    this.pendingEnemySoulRedeem = undefined;
    if (enemy && !enemy.defeated) {
      enemy.hp = Math.min(enemy.maxHp, 3);
    }
    this.startRound();
  }

  private markEnemySoulRedeemPending(enemy: EnemyState): boolean {
    if (
      !this.hasMechanic('enemy_passives')
      || enemy.id !== 'keeper'
      || enemy.soulRedeemUsed
      || this.pendingEnemySoulRedeem
    ) {
      return false;
    }

    enemy.soulRedeemUsed = true;
    this.pendingEnemySoulRedeem = enemy.id;
    this.roundRevealed = true;
    enemy.revealed = true;
    this.logEvent(t('log.keeperSoulRedeem'));
    return true;
  }

  private markSoulRedeemPending(): boolean {
    if (!this.hasMechanic('soul_redeem') || this.player.hp > 0 || this.player.soulRedeemUsed || this.mode !== 'endless' && this.enemies.every((enemy) => enemy.defeated)) {
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
      if (result.guard) {
        this.logEvent(t('log.chivalryFullGuard', {
          enemy: enemyName(result.enemy.id),
          protector: enemyName(result.guard.protectorEnemyId),
          damage: result.guard.preventedDamage,
        }));
        return;
      }
      if (result.evaded && result.enemy.id === 'ninja') {
        this.logEvent(t('log.smokeScreenEvaded', { damage: result.originalDamage ?? 0 }));
        return;
      }
      this.logEvent(t('log.enemyDefeated', { enemy: enemyName(result.enemy.id), resonance: resonanceText, damage: result.damage }));
    } else if (result.outcome === 'lose') {
      if (result.shielded) {
        this.logEvent(t('log.holyShieldBlocked', { enemy: enemyName(result.enemy.id), damage: result.originalDamage ?? 0 }));
        return;
      }
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
      return this.triggeredHandText(result.playerScore);
    }

    if (result.outcome === 'lose' && result.enemyScore.resonance !== 'none') {
      return this.triggeredHandText(result.enemyScore);
    }

    return '';
  }

  private triggeredHandText(score: ScoreResult): string {
    const label = score.resonance === 'boom'
      ? t('score.boomWithRank', { rank: score.boomRank ?? '' })
      : score.resonance === 'strong'
        ? t('log.triggerResonanceStrong')
        : t('log.triggerResonanceNormal');
    return t('log.triggerResonance', { resonance: label });
  }

  private updateBattleOutcome(): void {
    if (this.pendingSoulRedeem || this.pendingEnemySoulRedeem) return;
    if (this.mode !== 'endless' && this.enemies.every((enemy) => enemy.defeated)) {
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
      if (this.mode === 'endless') this.endlessEndReason = 'defeat';
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
    const fixedRounds = this.levelConfig?.fixedRounds;
    if (!fixedRounds?.length) {
      return undefined;
    }

    const fixedRound = fixedRounds[this.round - 1];
    if (fixedRound) {
      return fixedRound;
    }

    if (this.levelConfig?.useRandomAfterFixedRounds === false) {
      return fixedRounds[fixedRounds.length - 1];
    }

    return undefined;
  }

  private maxPlayerDrawsThisRound(): number {
    return this.currentFixedRound()?.maxPlayerDraws
      ?? this.levelConfig?.maxPlayerDrawsPerRound
      ?? 2;
  }

  private isSkillAvailable(skillId: SkillId): boolean {
    const availableSkills = this.currentFixedRound()?.availableSkills;
    return !availableSkills || availableSkills.includes(skillId);
  }

  private currentFixedEnemyConfig(enemyId: EnemyType): FixedRoundEnemyConfig | undefined {
    return this.currentFixedRound()?.enemies.find((config) => config.enemyId === enemyId);
  }

  private shouldSkipEnemyHandlingPhase(): boolean {
    return this.levelConfig?.tutorialFocus === 'skills';
  }

  private createRandomResonantPair(): Card[] {
    if (this.random() < 0.5) {
      const suit = randomItem(SUITS, this.random) ?? '♠';
      return [
        { suit, rank: randomItem(RANKS, this.random) ?? 'A' },
        { suit, rank: randomItem(RANKS, this.random) ?? '2' },
      ];
    }

    const rank = randomItem(RANKS, this.random) ?? 'A';
    const firstSuit = randomItem(SUITS, this.random) ?? '♠';
    const otherSuits = SUITS.filter((suit) => suit !== firstSuit);
    return [
      { suit: firstSuit, rank },
      { suit: randomItem(otherSuits, this.random) ?? '♥', rank },
    ];
  }

  private revealPlayerScore(): ScoreResult {
    const lastPlayerScore = [...this.results].reverse().find((result) => result.playerScore)?.playerScore;
    return lastPlayerScore ?? this.playerScore();
  }
}

export function describeScore(score: ScoreResult): string {
  if (score.resonance === 'boom') {
    return t('score.describeBoom', { rank: score.boomRank ?? '', count: score.boomSize ?? 3 });
  }

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

function randomItem<T>(items: T[], random: () => number = Math.random): T | undefined {
  return items[Math.floor(random() * items.length)];
}

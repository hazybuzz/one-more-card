import { Battle, type BattleInitOptions, type SkillResult } from '../battle';
import { t } from '../i18n';
import type { BattleAction } from './BattleTypes';
import type { BattlePresentationEvent } from './BattleEvents';

export class BattleEngine extends Battle {
  private presentationEvents: BattlePresentationEvent[] = [];

  constructor(options: BattleInitOptions = {}) {
    super(options);
  }

  execute(action: BattleAction): SkillResult | undefined {
    const before = this.snapshotForEvents();
    const invitedEnemy = action.type === 'invite-current-enemy' ? this.currentEnemy : undefined;
    let result: SkillResult | undefined;

    switch (action.type) {
      case 'choose-view-hand':
        this.chooseViewHand();
        break;
      case 'choose-fate':
        this.chooseFate();
        break;
      case 'invite-current-enemy':
        this.inviteCurrentEnemy();
        break;
      case 'compare-current-enemy':
        this.compareCurrentEnemy();
        break;
      case 'player-draw':
        this.playerDraw();
        break;
      case 'player-stand':
        this.playerStand();
        break;
      case 'next-round':
        this.nextRound();
        break;
      case 'reveal-by-item':
        this.revealByItem();
        break;
      case 'use-skill':
        result = action.skill === 'resonance-shift'
          ? this.useResonanceShift()
          : this.useResonanceSummon();
        break;
      case 'debug-set-current-enemy':
        this.currentEnemyIndex = this.enemies.findIndex((enemy) => enemy.id === action.enemyId);
        break;
      default:
        break;
    }

    this.collectEventsAfterAction(before, invitedEnemy);
    return result;
  }

  consumePresentationEvents(): BattlePresentationEvent[] {
    const events = [
      ...this.presentationEvents,
      ...this.damageEvents.map((event): BattlePresentationEvent => {
        if (event.type === 'clash') {
          return {
            type: 'clash',
            enemyId: event.enemyId,
            amount: event.amount,
          };
        }

        return {
          type: 'damage',
          attacker: event.attacker ?? 'enemy',
          enemyId: event.enemyId,
          amount: event.amount,
          resonance: event.resonance,
        };
      }),
    ];
    this.presentationEvents = [];
    return events;
  }

  currentRoundDealEvents(): BattlePresentationEvent[] {
    const events: BattlePresentationEvent[] = [];
    const maxCards = Math.max(0, this.player.hand.length, ...this.aliveEnemies.map((enemy) => enemy.hand.length));

    for (let cardIndex = 0; cardIndex < maxCards; cardIndex += 1) {
      if (cardIndex < this.player.hand.length) {
        events.push({
          type: 'card-dealt',
          target: 'player',
          card: this.player.hand[cardIndex],
          cardIndex,
          context: 'round-start',
        });
      }

      this.enemies.forEach((enemy) => {
        if (!enemy.defeated && cardIndex < enemy.hand.length) {
          events.push({
            type: 'card-dealt',
            target: enemy.id,
            card: enemy.hand[cardIndex],
            cardIndex,
            context: 'round-start',
          });
        }
      });
    }

    return events;
  }

  private snapshotForEvents() {
    return {
      phase: this.phase,
      outcome: this.battleOutcome,
      round: this.round,
      roundRevealed: this.roundRevealed,
      playerHp: this.player.hp,
      playerHandLength: this.player.hand.length,
      enemyHp: this.enemies.map((enemy) => enemy.hp),
      enemyHandLengths: this.enemies.map((enemy) => enemy.hand.length),
    };
  }

  private collectEventsAfterAction(before: ReturnType<BattleEngine['snapshotForEvents']>, invitedEnemy?: typeof this.currentEnemy): void {
    if (this.player.hand.length > before.playerHandLength) {
      this.player.hand.slice(before.playerHandLength).forEach((card, offset) => {
        this.presentationEvents.push({
          type: 'card-dealt',
          target: 'player',
          card,
          cardIndex: before.playerHandLength + offset,
          context: 'action',
        });
      });
    }

    this.enemies.forEach((enemy, enemyIndex) => {
      const beforeLength = before.enemyHandLengths[enemyIndex] ?? 0;
      if (enemy.hand.length > beforeLength) {
        enemy.hand.slice(beforeLength).forEach((card, offset) => {
          this.presentationEvents.push({
            type: 'card-dealt',
            target: enemy.id,
            card,
            cardIndex: beforeLength + offset,
            context: 'action',
          });
        });
      }

      const healed = enemy.hp - (before.enemyHp[enemyIndex] ?? enemy.hp);
      if (healed > 0) {
        this.presentationEvents.push({ type: 'heal', target: enemy.id, amount: healed });
      }
    });

    const playerHealed = this.player.hp - before.playerHp;
    if (playerHealed > 0) {
      this.presentationEvents.push({ type: 'heal', target: 'player', amount: playerHealed });
    }

    if (invitedEnemy?.invited && invitedEnemy.acceptedInvite !== undefined) {
      this.presentationEvents.push({
        type: 'enemy-speech',
        enemyId: invitedEnemy.id,
        text: invitedEnemy.acceptedInvite ? t('battle.speech.draw') : t('battle.speech.pass'),
      });
    }

    if (!before.roundRevealed && this.roundRevealed) {
      this.presentationEvents.push({ type: 'round-revealed', round: this.round });
    }

    if (before.phase !== 'round-result' && this.phase === 'round-result') {
      this.presentationEvents.push({ type: 'round-ended', round: this.round });
    }

    if (before.outcome === undefined && this.battleOutcome) {
      this.presentationEvents.push({ type: 'battle-ended', outcome: this.battleOutcome });
    }
  }
}

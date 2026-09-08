import Phaser from 'phaser';
import type { BattlePresentationEvent } from '../../../game/engine';

export type PassiveEffectEvent = Extract<BattlePresentationEvent, { type: 'passive-effect' }>;

export interface PassiveVfxAnchors {
  source: Phaser.Math.Vector2;
  sourceLabel?: Phaser.Math.Vector2;
  sourceHealth?: Phaser.Math.Vector2;
  targets: Phaser.Math.Vector2[];
  player: Phaser.Math.Vector2;
  playerHand?: Phaser.Math.Vector2;
  sourceHand?: Phaser.Math.Vector2;
}

export interface PassiveVfxContext {
  scene: Phaser.Scene;
  event: PassiveEffectEvent;
  anchors: PassiveVfxAnchors;
  feedback?: {
    showEnemyHeal?: (enemyIndex: number, amount: number) => void;
    revealEnemyAttackBonus?: (enemyIndex: number) => void;
    revealSummonedEnemy?: (enemyIndex: number) => void;
  };
  onComplete: () => void;
}

export type PassiveVfxHandler = (context: PassiveVfxContext) => void;

export class PassiveVfxDirector {
  private readonly handlers = new Map<PassiveEffectEvent['passiveId'], PassiveVfxHandler>();

  register(passiveId: PassiveEffectEvent['passiveId'], handler: PassiveVfxHandler): this {
    this.handlers.set(passiveId, handler);
    return this;
  }

  supports(passiveId: PassiveEffectEvent['passiveId']): boolean {
    return this.handlers.has(passiveId);
  }

  play(context: PassiveVfxContext): boolean {
    const handler = this.handlers.get(context.event.passiveId);
    if (!handler) {
      return false;
    }

    let completed = false;
    handler({
      ...context,
      onComplete: () => {
        if (completed) {
          return;
        }
        completed = true;
        context.onComplete();
      },
    });
    return true;
  }
}

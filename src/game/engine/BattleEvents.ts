import { Card } from '../card';
import { EnemyType } from '../enemy';
import { ResonanceKind } from '../scoring';

export type BattlePresentationEvent =
  | { type: 'card-dealt'; target: 'player' | EnemyType; card: Card; cardIndex: number; context: 'round-start' | 'action' }
  | { type: 'enemy-speech'; enemyId: EnemyType; text: string }
  | { type: 'damage'; attacker: 'player' | 'enemy'; enemyId: EnemyType; amount: number; resonance?: ResonanceKind }
  | { type: 'clash'; enemyId: EnemyType; amount: number }
  | { type: 'heal'; target: 'player' | EnemyType; amount: number }
  | { type: 'round-revealed'; round: number }
  | { type: 'round-ended'; round: number }
  | { type: 'battle-ended'; outcome: 'victory' | 'defeat' };

export type BattleCombatPresentationEvent = Extract<BattlePresentationEvent, { type: 'damage' | 'clash' }>;

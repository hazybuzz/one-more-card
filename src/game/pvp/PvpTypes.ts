import type { Card } from '../card';
import type { ResonanceKind, ScoreResult } from '../scoring';

export type PvpRoomPhase = 'waiting' | 'playing' | 'round-reveal' | 'game-over';

export type PvpPlayerRole = 'host' | 'guest';

export interface PvpPlayerState {
  id: string;
  name: string;
  role: PvpPlayerRole;
  connected: boolean;
  ready: boolean;
  hp: number;
  maxHp: number;
  hand: Card[];
  publicCardIndexes: number[];
  stood: boolean;
  drawCount: number;
  secondDrawRisk: boolean;
  drawLocked: boolean;
  incomingDamageBonus: number;
  resonanceCount: number;
  skills: string[];
  usedSkillIds: string[];
  skillCooldowns: Record<string, number>;
  items: string[];
  effects: string[];
}

export interface PvpRoundResult {
  round: number;
  scores: Record<string, ScoreResult>;
  outcome: 'draw' | 'win';
  winnerId?: string;
  loserId?: string;
  damage: number;
  resonance?: ResonanceKind;
  riskBonus: number;
}

export interface PvpRoomState {
  roomId: string;
  phase: PvpRoomPhase;
  round: number;
  players: PvpPlayerState[];
  deck: Card[];
  turnDeadlines: Record<string, number>;
  lastRoundResult?: PvpRoundResult;
  winnerId?: string;
  rematchRequestedIds: string[];
  logs: string[];
  createdAt: number;
  updatedAt: number;
}

export type PublicPvpCard =
  | { hidden: false; card: Card }
  | { hidden: true };

export interface PublicPvpPlayerState {
  id: string;
  name: string;
  role: PvpPlayerRole;
  connected: boolean;
  ready: boolean;
  hp: number;
  maxHp: number;
  hand: PublicPvpCard[];
  stood: boolean;
  drawCount: number;
  secondDrawRisk: boolean;
  drawLocked: boolean;
  incomingDamageBonus: number;
  resonanceCount: number;
  skills: string[];
  usedSkillIds: string[];
  skillCooldowns: Record<string, number>;
  items: string[];
  effects: string[];
}

export interface PvpPublicRoomState {
  roomId: string;
  phase: PvpRoomPhase;
  round: number;
  players: PublicPvpPlayerState[];
  selfId: string;
  opponentId?: string;
  actionDeadline?: number;
  serverTime: number;
  lastRoundResult?: PvpRoundResult;
  winnerId?: string;
  rematchRequestedIds: string[];
  logs: string[];
}

export interface PvpRoomSummary {
  roomId: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  phase: PvpRoomPhase;
  createdAt: number;
  updatedAt: number;
}

export type PvpAction =
  | { type: 'draw' }
  | { type: 'stand' }
  | { type: 'use-skill'; skillId: string; targetId?: string }
  | { type: 'use-item'; itemId: string; targetId?: string };

export type PvpClientMessage =
  | { type: 'create-room'; playerName: string }
  | { type: 'join-room'; roomId: string; playerName: string }
  | { type: 'list-rooms' }
  | { type: 'ready' }
  | { type: 'rematch' }
  | { type: 'surrender' }
  | PvpAction;

export type PvpServerMessage =
  | { type: 'connected'; clientId: string }
  | { type: 'room-created'; roomId: string; playerId: string }
  | { type: 'room-joined'; roomId: string; playerId: string }
  | { type: 'room-state'; state: PvpPublicRoomState }
  | { type: 'room-list'; rooms: PvpRoomSummary[] }
  | { type: 'error'; message: string };

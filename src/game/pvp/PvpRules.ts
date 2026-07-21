import { Card, RANKS, SUITS } from '../card';
import { scoreHand } from '../scoring';
import { chooseResonanceShift, chooseResonanceSummonSuit } from '../skills/resonanceSkills';
import type { PvpAction, PvpPlayerRole, PvpPlayerState, PvpPublicRoomState, PvpRoomState } from './PvpTypes';

export const PVP_MAX_HP = 10;
export const PVP_INITIAL_CARDS = 2;
export const PVP_MAX_DRAWS_PER_ROUND = 2;
export const PVP_ACTION_TIME_MS = 15_000;
export const PVP_SKILL_COOLDOWN_ROUNDS = 3;

export interface PvpActionResult {
  ok: boolean;
  message?: string;
}

export function createPvpRoom(roomId: string, hostId: string, hostName: string, now = Date.now()): PvpRoomState {
  return {
    roomId,
    phase: 'waiting',
    round: 0,
    players: [createPvpPlayer(hostId, hostName, 'host')],
    deck: createShuffledPvpDeck(),
    turnDeadlines: {},
    rematchRequestedIds: [],
    logs: [`${hostName} 创建了房间。`],
    createdAt: now,
    updatedAt: now,
  };
}

export function joinPvpRoom(room: PvpRoomState, playerId: string, playerName: string, now = Date.now()): PvpActionResult {
  if (room.players.length >= 2 && !room.players.some((player) => player.id === playerId)) {
    return { ok: false, message: '房间已满。' };
  }

  if (room.phase !== 'waiting') {
    return { ok: false, message: '牌局已经开始。' };
  }

  const existing = room.players.find((player) => player.id === playerId);
  if (existing) {
    existing.connected = true;
    existing.name = playerName || existing.name;
  } else {
    room.players.push(createPvpPlayer(playerId, playerName, 'guest'));
  }

  room.logs.unshift(`${playerName} 加入了房间。`);
  touch(room, now);
  return { ok: true };
}

export function setPvpReady(room: PvpRoomState, playerId: string, now = Date.now()): PvpActionResult {
  const player = findPlayer(room, playerId);
  if (!player) {
    return { ok: false, message: '玩家不在房间中。' };
  }

  if (room.phase !== 'waiting') {
    return { ok: false, message: '牌局已经开始。' };
  }

  player.ready = true;
  room.logs.unshift(`${player.name} 已准备。`);
  if (room.players.length === 2 && room.players.every((item) => item.ready)) {
    startPvpGame(room, now);
  } else {
    touch(room, now);
  }

  return { ok: true };
}

export function startPvpGame(room: PvpRoomState, now = Date.now()): void {
  room.phase = 'playing';
  room.round = 0;
  room.winnerId = undefined;
  room.lastRoundResult = undefined;
  room.rematchRequestedIds = [];
  room.deck = createShuffledPvpDeck();
  room.players.forEach((player) => {
    player.hp = PVP_MAX_HP;
    player.maxHp = PVP_MAX_HP;
    player.resonanceCount = 0;
    player.ready = false;
    player.skills = ['resonance_shift', 'resonance_summon'];
    player.usedSkillIds = [];
    player.skillCooldowns = {};
  });
  room.logs.unshift('牌局开始。');
  startPvpRound(room, now);
}

export function startPvpRound(room: PvpRoomState, now = Date.now()): void {
  if (room.phase === 'game-over') {
    return;
  }

  if (room.deck.length < room.players.length * 4) {
    room.deck = createShuffledPvpDeck();
    room.logs.unshift('牌堆重新洗牌。');
  }

  room.phase = 'playing';
  room.round += 1;
  room.lastRoundResult = undefined;
  room.turnDeadlines = {};
  room.players.forEach((player) => {
    player.hand = [];
    player.publicCardIndexes = [];
    player.stood = false;
    player.drawCount = 0;
    player.secondDrawRisk = false;
    player.drawLocked = false;
    player.incomingDamageBonus = 0;
    player.skillCooldowns = decrementSkillCooldowns(player.skillCooldowns);
    player.effects = [];
  });

  for (let index = 0; index < PVP_INITIAL_CARDS; index += 1) {
    room.players.forEach((player) => {
      player.hand.push(drawFromRoom(room));
    });
  }

  room.players.forEach((player) => {
    player.publicCardIndexes = [0];
    room.turnDeadlines[player.id] = now + PVP_ACTION_TIME_MS;
  });

  room.logs.unshift(`第 ${room.round} 轮开始。`);
  touch(room, now);
}

export function applyPvpAction(room: PvpRoomState, playerId: string, action: PvpAction, now = Date.now()): PvpActionResult {
  if (action.type === 'use-item') {
    return { ok: false, message: '道具暂未开放。' };
  }

  if (room.phase !== 'playing') {
    return { ok: false, message: '当前不能行动。' };
  }

  const player = findPlayer(room, playerId);
  if (!player) {
    return { ok: false, message: '玩家不在房间中。' };
  }

  if (player.stood) {
    return { ok: false, message: '你已经开牌。' };
  }

  if (action.type === 'use-skill') {
    return applyPvpSkill(room, player, action.skillId, now);
  }

  if (action.type === 'draw') {
    if (player.drawLocked) {
      return { ok: false, message: '本轮已经不能再摸牌。' };
    }

    if (player.drawCount >= PVP_MAX_DRAWS_PER_ROUND) {
      return { ok: false, message: '本轮已经不能再摸牌。' };
    }

    player.hand.push(drawFromRoom(room));
    player.publicCardIndexes.push(player.hand.length - 1);
    player.drawCount += 1;
    if (player.drawCount >= 2) {
      player.secondDrawRisk = true;
    }
    room.turnDeadlines[player.id] = now + PVP_ACTION_TIME_MS;
    room.logs.unshift(`${player.name} 选择再来一张。`);
    touch(room, now);
    return { ok: true };
  }

  player.stood = true;
  delete room.turnDeadlines[player.id];
  room.logs.unshift(`${player.name} 选择开牌。`);
  resolvePvpRoundIfReady(room, now);
  touch(room, now);
  return { ok: true };
}

export function autoStandExpiredPlayers(room: PvpRoomState, now = Date.now()): boolean {
  if (room.phase !== 'playing') {
    return false;
  }

  let changed = false;
  room.players.forEach((player) => {
    const deadline = room.turnDeadlines[player.id];
    if (!player.stood && deadline !== undefined && deadline <= now) {
      player.stood = true;
      delete room.turnDeadlines[player.id];
      room.logs.unshift(`${player.name} 超时，自动开牌。`);
      changed = true;
    }
  });

  if (changed) {
    resolvePvpRoundIfReady(room, now);
    touch(room, now);
  }

  return changed;
}

export function resolvePvpRoundIfReady(room: PvpRoomState, now = Date.now()): boolean {
  if (room.phase !== 'playing' || room.players.length < 2 || !room.players.every((player) => player.stood)) {
    return false;
  }

  const [playerA, playerB] = room.players;
  const scoreA = scoreHand(playerA.hand);
  const scoreB = scoreHand(playerB.hand);
  if (scoreA.resonance !== 'none') {
    playerA.resonanceCount += 1;
  }
  if (scoreB.resonance !== 'none') {
    playerB.resonanceCount += 1;
  }

  const comparison = comparePvpScores(scoreA, scoreB);
  if (comparison === 0) {
    room.lastRoundResult = {
      round: room.round,
      scores: {
        [playerA.id]: scoreA,
        [playerB.id]: scoreB,
      },
      outcome: 'draw',
      damage: 0,
      riskBonus: 0,
    };
    room.logs.unshift('双方平分抵消。');
  } else {
    const winner = comparison > 0 ? playerA : playerB;
    const loser = comparison > 0 ? playerB : playerA;
    const winnerScore = comparison > 0 ? scoreA : scoreB;
    const riskBonus = Math.max(loser.secondDrawRisk ? 1 : 0, loser.incomingDamageBonus);
    const damage = winnerScore.multiplier + riskBonus;
    loser.hp = Math.max(0, loser.hp - damage);
    room.lastRoundResult = {
      round: room.round,
      scores: {
        [playerA.id]: scoreA,
        [playerB.id]: scoreB,
      },
      outcome: 'win',
      winnerId: winner.id,
      loserId: loser.id,
      damage,
      resonance: winnerScore.resonance,
      riskBonus,
    };
    room.logs.unshift(`${winner.name} 赢得本轮，造成 ${damage} 点伤害。`);
    if (loser.hp <= 0) {
      room.phase = 'game-over';
      room.winnerId = winner.id;
      room.logs.unshift(`${winner.name} 赢得对战。`);
      touch(room, now);
      return true;
    }
  }

  room.phase = 'round-reveal';
  touch(room, now);
  return true;
}

export function requestPvpRematch(room: PvpRoomState, playerId: string, now = Date.now()): PvpActionResult {
  if (room.phase !== 'game-over') {
    return { ok: false, message: '对局结束后才能再来一局。' };
  }

  const player = findPlayer(room, playerId);
  if (!player) {
    return { ok: false, message: '玩家不在房间中。' };
  }

  if (!room.rematchRequestedIds.includes(playerId)) {
    room.rematchRequestedIds.push(playerId);
    room.logs.unshift(`${player.name} 想再来一局。`);
  }

  if (room.players.length === 2 && room.players.every((item) => room.rematchRequestedIds.includes(item.id))) {
    room.logs.unshift('双方都选择再来一局。');
    startPvpGame(room, now);
  } else {
    touch(room, now);
  }

  return { ok: true };
}

export function createPublicPvpState(room: PvpRoomState, viewerId: string, now = Date.now()): PvpPublicRoomState {
  const opponent = room.players.find((player) => player.id !== viewerId);
  return {
    roomId: room.roomId,
    phase: room.phase,
    round: room.round,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      role: player.role,
      connected: player.connected,
      ready: player.ready,
      hp: player.hp,
      maxHp: player.maxHp,
      hand: player.hand.map((card, index) => {
        const shouldReveal = player.id === viewerId || room.phase === 'round-reveal' || room.phase === 'game-over' || player.publicCardIndexes.includes(index);
        return shouldReveal ? { hidden: false, card } : { hidden: true };
      }),
      stood: player.stood,
      drawCount: player.drawCount,
      secondDrawRisk: player.secondDrawRisk,
      drawLocked: player.drawLocked,
      incomingDamageBonus: player.incomingDamageBonus,
      resonanceCount: player.resonanceCount,
      skills: [...player.skills],
      usedSkillIds: [...player.usedSkillIds],
      skillCooldowns: { ...player.skillCooldowns },
      items: [...player.items],
      effects: [...player.effects],
    })),
    selfId: viewerId,
    opponentId: opponent?.id,
    actionDeadline: room.turnDeadlines[viewerId],
    serverTime: now,
    lastRoundResult: room.lastRoundResult,
    winnerId: room.winnerId,
    rematchRequestedIds: [...room.rematchRequestedIds],
    logs: room.logs.slice(0, 30),
  };
}

function createPvpPlayer(id: string, name: string, role: PvpPlayerRole): PvpPlayerState {
  return {
    id,
    name: name.trim() || (role === 'host' ? '玩家一' : '玩家二'),
    role,
    connected: true,
    ready: false,
    hp: PVP_MAX_HP,
    maxHp: PVP_MAX_HP,
    hand: [],
    publicCardIndexes: [],
    stood: false,
    drawCount: 0,
    secondDrawRisk: false,
    drawLocked: false,
    incomingDamageBonus: 0,
    resonanceCount: 0,
    skills: ['resonance_shift', 'resonance_summon'],
    usedSkillIds: [],
    skillCooldowns: {},
    items: [],
    effects: [],
  };
}

function createShuffledPvpDeck(): Card[] {
  const cards = [
    ...SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank }))),
    { rank: '小王' as const },
    { rank: '大王' as const },
  ];

  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [cards[index], cards[swapIndex]] = [cards[swapIndex], cards[index]];
  }

  return cards;
}

function drawFromRoom(room: PvpRoomState): Card {
  const card = room.deck.pop();
  if (!card) {
    room.deck = createShuffledPvpDeck();
    const replacement = room.deck.pop();
    if (!replacement) {
      throw new Error('PvP deck is empty.');
    }
    return replacement;
  }

  return card;
}

function applyPvpSkill(room: PvpRoomState, player: PvpPlayerState, skillId: string, now: number): PvpActionResult {
  if (!player.skills.includes(skillId)) {
    return { ok: false, message: '你没有这个技能。' };
  }

  if ((player.skillCooldowns[skillId] ?? 0) > 0) {
    return { ok: false, message: `技能冷却中，还需 ${player.skillCooldowns[skillId]} 轮。` };
  }

  if (skillId === 'resonance_shift') {
    if (scoreHand(player.hand).resonance !== 'none') {
      return { ok: false, message: '当前手牌已经触发共鸣。' };
    }

    const conversion = chooseResonanceShift(player.hand);
    if (!conversion) {
      return { ok: false, message: '当前手牌无法进行共鸣转换。' };
    }

    conversion.card.suit = conversion.targetSuit;
    player.usedSkillIds.push(skillId);
    player.skillCooldowns[skillId] = PVP_SKILL_COOLDOWN_ROUNDS;
    player.drawLocked = true;
    room.turnDeadlines[player.id] = now + PVP_ACTION_TIME_MS;
    room.logs.unshift(`${player.name} 使用了共鸣转换。`);
    touch(room, now);
    return { ok: true };
  }

  if (skillId === 'resonance_summon') {
    if (player.hand.length >= 4) {
      return { ok: false, message: '本轮最多只能拥有四张牌。' };
    }

    if (scoreHand(player.hand).resonance === 'none') {
      return { ok: false, message: '当前手牌没有共鸣，无法召唤。' };
    }

    const targetSuit = chooseResonanceSummonSuit(player.hand);
    if (!targetSuit) {
      return { ok: false, message: '无法确定召唤花色。' };
    }

    const card = drawWhere(room, (candidate) => candidate.suit === targetSuit);
    if (!card) {
      return { ok: false, message: `牌堆中没有 ${targetSuit} 花色牌。` };
    }

    player.hand.push(card);
    player.publicCardIndexes.push(player.hand.length - 1);
    player.usedSkillIds.push(skillId);
    player.skillCooldowns[skillId] = PVP_SKILL_COOLDOWN_ROUNDS;
    player.drawLocked = true;
    player.incomingDamageBonus = Math.max(player.incomingDamageBonus, 1);
    room.turnDeadlines[player.id] = now + PVP_ACTION_TIME_MS;
    room.logs.unshift(`${player.name} 使用了共鸣召唤。`);
    touch(room, now);
    return { ok: true };
  }

  return { ok: false, message: '未知技能。' };
}

function drawWhere(room: PvpRoomState, predicate: (card: Card) => boolean): Card | undefined {
  const index = room.deck.findIndex(predicate);
  if (index < 0) {
    return undefined;
  }

  const [card] = room.deck.splice(index, 1);
  return card;
}

function decrementSkillCooldowns(cooldowns: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(cooldowns).map(([skillId, rounds]) => [skillId, Math.max(0, rounds - 1)]),
  );
}

function comparePvpScores(scoreA: ReturnType<typeof scoreHand>, scoreB: ReturnType<typeof scoreHand>): number {
  if (scoreA.point !== scoreB.point) {
    return scoreA.point - scoreB.point;
  }

  return resonancePower(scoreA.resonance) - resonancePower(scoreB.resonance);
}

function resonancePower(resonance: ReturnType<typeof scoreHand>['resonance']): number {
  if (resonance === 'strong') {
    return 2;
  }

  if (resonance === 'resonance') {
    return 1;
  }

  return 0;
}

function findPlayer(room: PvpRoomState, playerId: string): PvpPlayerState | undefined {
  return room.players.find((player) => player.id === playerId);
}

function touch(room: PvpRoomState, now: number): void {
  room.updatedAt = now;
}

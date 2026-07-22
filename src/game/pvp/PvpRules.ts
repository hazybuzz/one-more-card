import { Card, RANKS, SUITS } from '../card';
import { scoreHand } from '../scoring';
import type { PvpAction, PvpPlayerRole, PvpPlayerState, PvpPublicRoomState, PvpRoomState, PvpSkillId } from './PvpTypes';

export const PVP_MAX_HP = 8;
export const PVP_INITIAL_ACTION_POINTS = 3;
export const PVP_MAX_ACTION_POINTS = 4;
export const PVP_SKILL_COST = 1;
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
    pendingInvitation: false,
    hasAskerDrawnExtra: false,
    hasResponderDrawnExtra: false,
    privateNotices: {},
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
    player.actionPoints = PVP_INITIAL_ACTION_POINTS;
    player.maxActionPoints = PVP_MAX_ACTION_POINTS;
    player.skills = ['peek', 'stop_loss', 'raise_stakes', 'swap_hand'];
    player.usedSkillIds = [];
    player.skillCooldowns = {};
    player.hasUsedSkillThisRound = false;
    player.hasUsedPeekThisRound = false;
    player.hasUsedActionSkillThisRound = false;
    player.hasUsedSkillThisPhase = false;
    player.roundDamageCap = undefined;
    player.roundDamageBonus = 0;
    player.roundDamageTakenBonus = 0;
  });
  room.privateNotices = {};
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
  const isFirstRound = room.round === 0;
  room.round += 1;
  room.lastRoundResult = undefined;
  room.turnDeadlines = {};
  const asker = room.players[(room.round - 1) % room.players.length];
  const responder = room.players.find((player) => player.id !== asker?.id);
  room.askerId = asker?.id;
  room.responderId = responder?.id;
  room.duelPhase = 'asker-action';
  room.pendingInvitation = false;
  room.hasAskerDrawnExtra = false;
  room.hasResponderDrawnExtra = false;
  room.players.forEach((player) => {
    player.hand = [];
    player.publicCardIndexes = [];
    player.stood = false;
    player.drawCount = 0;
    player.secondDrawRisk = false;
    player.drawLocked = false;
    player.incomingDamageBonus = 0;
    player.actionPoints = isFirstRound
      ? player.actionPoints
      : Math.min(player.maxActionPoints, player.actionPoints + 1);
    player.hasUsedSkillThisRound = false;
    player.hasUsedPeekThisRound = false;
    player.hasUsedActionSkillThisRound = false;
    player.hasUsedSkillThisPhase = false;
    player.roundDamageCap = undefined;
    player.roundDamageBonus = 0;
    player.roundDamageTakenBonus = 0;
    room.privateNotices ??= {};
    room.privateNotices[player.id] = undefined;
    player.usedSkillIds = [];
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
    return applyPvpSkill(room, player, action.skillId, now, action.cardIndex);
  }

  if (action.type === 'draw') {
    if (player.drawLocked) {
      return { ok: false, message: '本轮已经不能再摸牌。' };
    }

    if (player.drawCount >= PVP_MAX_DRAWS_PER_ROUND) {
      return { ok: false, message: '本轮已经不能再摸牌。' };
    }

    player.hand.push(drawFromRoom(room));
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
  const viewer = room.players.find((player) => player.id === viewerId);
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
        const shouldReveal = player.id === viewerId
          || room.phase === 'round-reveal'
          || room.phase === 'game-over'
          || player.publicCardIndexes.includes(index);
        return shouldReveal ? { hidden: false, card } : { hidden: true };
      }),
      stood: player.stood,
      drawCount: player.drawCount,
      secondDrawRisk: player.secondDrawRisk,
      drawLocked: player.drawLocked,
      incomingDamageBonus: player.incomingDamageBonus,
      actionPoints: player.actionPoints,
      maxActionPoints: player.maxActionPoints,
      hasUsedSkillThisRound: player.hasUsedSkillThisRound,
      hasUsedPeekThisRound: player.hasUsedPeekThisRound,
      hasUsedActionSkillThisRound: player.hasUsedActionSkillThisRound,
      hasUsedSkillThisPhase: player.hasUsedSkillThisPhase,
      roundDamageCap: player.roundDamageCap,
      roundDamageBonus: player.roundDamageBonus,
      roundDamageTakenBonus: player.roundDamageTakenBonus,
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
    askerId: room.askerId,
    responderId: room.responderId,
    duelPhase: room.duelPhase,
    pendingInvitation: room.pendingInvitation,
    hasAskerDrawnExtra: room.hasAskerDrawnExtra,
    hasResponderDrawnExtra: room.hasResponderDrawnExtra,
    privateNotice: room.privateNotices?.[viewerId],
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
    actionPoints: PVP_INITIAL_ACTION_POINTS,
    maxActionPoints: PVP_MAX_ACTION_POINTS,
    hasUsedSkillThisRound: false,
    hasUsedPeekThisRound: false,
    hasUsedActionSkillThisRound: false,
    hasUsedSkillThisPhase: false,
    roundDamageCap: undefined,
    roundDamageBonus: 0,
    roundDamageTakenBonus: 0,
    resonanceCount: 0,
    skills: ['peek', 'stop_loss', 'raise_stakes', 'swap_hand'],
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

function applyPvpSkill(room: PvpRoomState, player: PvpPlayerState, skillId: PvpSkillId, now: number, cardIndex?: number): PvpActionResult {
  if (!player.skills.includes(skillId)) {
    return { ok: false, message: '你没有这个技能。' };
  }

  if (player.hasUsedSkillThisPhase) {
    return { ok: false, message: '当前阶段已经使用过技能。' };
  }

  if (player.actionPoints < PVP_SKILL_COST) {
    return { ok: false, message: '行动点不足。' };
  }

  const opponent = room.players.find((item) => item.id !== player.id);
  if (!opponent) {
    return { ok: false, message: '对手不存在。' };
  }

  if (skillId === 'peek') {
    if (player.hasUsedPeekThisRound) {
      return { ok: false, message: '本轮已经使用过看破。' };
    }

    const range = pvpPointRangeLabel(scoreHand(opponent.hand).point);
    spendPvpSkillCost(room, player, skillId, now, 'peek');
    room.privateNotices ??= {};
    room.privateNotices[player.id] = `你看破了对方的气息：${range}。`;
    room.logs.unshift(`${player.name} 使用了【看破】。`);
    return { ok: true };
  }

  if (skillId === 'stop_loss') {
    if (player.hasUsedActionSkillThisRound) {
      return { ok: false, message: '本轮已经使用过行动技能。' };
    }

    player.roundDamageCap = 1;
    spendPvpSkillCost(room, player, skillId, now, 'action');
    room.logs.unshift(`${player.name} 使用了【止损】，本轮受到的伤害最多为 1。`);
    return { ok: true };
  }

  if (skillId === 'raise_stakes') {
    if (player.hasUsedActionSkillThisRound) {
      return { ok: false, message: '本轮已经使用过行动技能。' };
    }

    player.roundDamageBonus = 1;
    player.roundDamageTakenBonus = 1;
    spendPvpSkillCost(room, player, skillId, now, 'action');
    room.logs.unshift(`${player.name} 使用了【加码】，本轮造成伤害 +1，但受到伤害也 +1。`);
    return { ok: true };
  }

  if (skillId === 'swap_hand') {
    if (player.hasUsedActionSkillThisRound) {
      return { ok: false, message: '本轮已经使用过行动技能。' };
    }

    if (!Number.isInteger(cardIndex) || cardIndex === undefined || cardIndex < 0 || cardIndex >= player.hand.length) {
      return { ok: false, message: '请选择一张自己的手牌。' };
    }

    if (opponent.hand.length === 0) {
      return { ok: false, message: '对方没有可交换的手牌。' };
    }

    const opponentIndex = Math.floor(Math.random() * opponent.hand.length);
    [player.hand[cardIndex], opponent.hand[opponentIndex]] = [opponent.hand[opponentIndex], player.hand[cardIndex]];
    markPvpCardPublic(player, cardIndex);
    markPvpCardPublic(opponent, opponentIndex);
    room.privateNotices ??= {};
    room.privateNotices[player.id] = undefined;
    room.privateNotices[opponent.id] = undefined;
    spendPvpSkillCost(room, player, skillId, now, 'action');
    room.logs.unshift(`${player.name} 使用了【换手】，交换了一张手牌。`);
    return { ok: true };
  }

  return { ok: false, message: '未知技能。' };
}

function spendPvpSkillCost(room: PvpRoomState, player: PvpPlayerState, skillId: PvpSkillId, now: number, kind: 'peek' | 'action'): void {
  player.actionPoints = Math.max(0, player.actionPoints - PVP_SKILL_COST);
  player.hasUsedSkillThisRound = true;
  player.hasUsedSkillThisPhase = true;
  if (kind === 'peek') {
    player.hasUsedPeekThisRound = true;
  } else {
    player.hasUsedActionSkillThisRound = true;
  }
  player.usedSkillIds.push(skillId);
  touch(room, now);
}

function markPvpCardPublic(player: PvpPlayerState, cardIndex: number): void {
  if (!player.publicCardIndexes.includes(cardIndex)) {
    player.publicCardIndexes.push(cardIndex);
  }
}

function pvpPointRangeLabel(point: number): string {
  if (point <= 3) {
    return '低点 0-3';
  }

  if (point <= 6) {
    return '中点 4-6';
  }

  return '高点 7-9';
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

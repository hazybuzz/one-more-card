import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number(process.env.PVP_PORT ?? 8787);
const MAX_HP = 8;
const INITIAL_ACTION_POINTS = 3;
const MAX_ACTION_POINTS = 4;
const SKILL_COST = 1;
const ACTION_TIME_MS = 15_000;
const REVEAL_TIME_MS = 4_200;
const SKILL_COOLDOWN_ROUNDS = 3;
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const rooms = new Map();
const clientRooms = new Map();
const clients = new Map();

const wss = new WebSocketServer({ host: '0.0.0.0', port: PORT });

wss.on('listening', () => {
  console.log(`PvP server listening on ws://0.0.0.0:${PORT}`);
});

wss.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`PvP server failed: port ${PORT} is already in use.`);
    process.exit(1);
  }

  throw error;
});

wss.on('connection', (socket) => {
  const clientId = randomUUID();
  clients.set(clientId, socket);
  send(socket, { type: 'connected', clientId });

  socket.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      sendError(socket, '消息格式错误。');
      return;
    }

    handleMessage(clientId, socket, message);
  });

  socket.on('close', () => {
    clients.delete(clientId);
    const roomId = clientRooms.get(clientId);
    clientRooms.delete(clientId);
    if (!roomId) {
      return;
    }

    const room = rooms.get(roomId);
    const player = room?.players.find((item) => item.id === clientId);
    if (room && player) {
      player.connected = false;
      room.logs.unshift(`${player.name} 断开了连接。`);
      broadcastRoom(room);
      broadcastRoomList();
    }
  });
});

setInterval(() => {
  const now = Date.now();
  rooms.forEach((room) => {
    let changed = false;

    if (room.phase === 'round-reveal' && room.nextRoundAt && room.nextRoundAt <= now) {
      startRound(room, now);
      changed = true;
    }

    if (changed) {
      broadcastRoom(room);
      broadcastRoomList();
    }
  });
}, 250);

function handleMessage(clientId, socket, message) {
  switch (message.type) {
    case 'create-room':
      createRoomForClient(clientId, socket, message.playerName);
      return;
    case 'join-room':
      joinRoomForClient(clientId, socket, message.roomId, message.playerName);
      return;
    case 'list-rooms':
      sendRoomList(socket);
      return;
    case 'ready':
      readyClient(clientId, socket);
      return;
    case 'rematch':
      requestRematch(clientId, socket);
      return;
    case 'surrender':
      surrenderClient(clientId, socket);
      return;
    case 'draw':
    case 'stand':
    case 'invite-draw':
    case 'pass':
    case 'accept-invite':
    case 'decline-invite':
    case 'confirm':
    case 'draw-self':
    case 'confirm-reveal':
    case 'use-skill':
    case 'use-item':
      applyActionForClient(clientId, socket, message);
      return;
    default:
      sendError(socket, '未知消息。');
  }
}

function createRoomForClient(clientId, socket, playerName) {
  const existingRoomId = clientRooms.get(clientId);
  if (existingRoomId) {
    rooms.delete(existingRoomId);
    clientRooms.delete(clientId);
    broadcastRoomList();
  }

  const roomId = createRoomId();
  const room = {
    roomId,
    phase: 'waiting',
    round: 0,
    players: [createPlayer(clientId, playerName, 'host')],
    deck: createDeck(),
    turnDeadlines: {},
    lastRoundResult: undefined,
    winnerId: undefined,
    rematchRequests: new Set(),
    nextRoundAt: undefined,
    askerId: undefined,
    responderId: undefined,
    duelPhase: undefined,
    pendingInvitation: false,
    hasAskerDrawnExtra: false,
    hasResponderDrawnExtra: false,
    privateNotices: {},
    logs: [`${safeName(playerName, '玩家一')} 创建了房间。`],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  rooms.set(roomId, room);
  clientRooms.set(clientId, roomId);
  send(socket, { type: 'room-created', roomId, playerId: clientId });
  broadcastRoom(room);
  broadcastRoomList();
}

function joinRoomForClient(clientId, socket, roomId, playerName) {
  const normalizedRoomId = String(roomId ?? '').trim().toUpperCase();
  const room = rooms.get(normalizedRoomId);
  if (!room) {
    sendError(socket, '房间不存在。');
    return;
  }

  if (room.phase !== 'waiting') {
    sendError(socket, '牌局已经开始。');
    return;
  }

  if (room.players.length >= 2 && !room.players.some((player) => player.id === clientId)) {
    sendError(socket, '房间已满。');
    return;
  }

  const existing = room.players.find((player) => player.id === clientId);
  if (existing) {
    existing.connected = true;
    existing.name = safeName(playerName, existing.name);
  } else {
    room.players.push(createPlayer(clientId, playerName, 'guest'));
  }

  clientRooms.set(clientId, normalizedRoomId);
  room.logs.unshift(`${safeName(playerName, '玩家二')} 加入了房间。`);
  room.updatedAt = Date.now();
  send(socket, { type: 'room-joined', roomId: normalizedRoomId, playerId: clientId });
  broadcastRoom(room);
  broadcastRoomList();
}

function readyClient(clientId, socket) {
  const room = roomForClient(clientId, socket);
  if (!room) {
    return;
  }

  if (room.phase !== 'waiting') {
    sendError(socket, '牌局已经开始。');
    return;
  }

  const player = room.players.find((item) => item.id === clientId);
  if (!player) {
    sendError(socket, '玩家不在房间中。');
    return;
  }

  player.ready = true;
  room.logs.unshift(`${player.name} 已准备。`);
  if (room.players.length === 2 && room.players.every((item) => item.ready)) {
    startGame(room);
  } else {
    room.updatedAt = Date.now();
  }

  broadcastRoom(room);
  broadcastRoomList();
}

function applyActionForClient(clientId, socket, action) {
  const room = roomForClient(clientId, socket);
  if (!room) {
    return;
  }

  if (action.type === 'use-item') {
    sendError(socket, '本测试版本暂未开放道具。');
    return;
  }

  if (room.phase !== 'playing') {
    sendError(socket, '当前不能行动。');
    return;
  }

  const player = room.players.find((item) => item.id === clientId);
  if (!player) {
    sendError(socket, '玩家不在房间中。');
    return;
  }

  const result = applyDuelAction(room, player, action);
  if (!result.ok) {
    sendError(socket, result.message);
    return;
  }

  broadcastRoom(room);
  broadcastRoomList();
}

function requestRematch(clientId, socket) {
  const room = roomForClient(clientId, socket);
  if (!room) {
    return;
  }

  if (room.phase !== 'game-over') {
    sendError(socket, '对局结束后才能再来一局。');
    return;
  }

  const player = room.players.find((item) => item.id === clientId);
  if (!player) {
    sendError(socket, '玩家不在房间中。');
    return;
  }

  room.rematchRequests ??= new Set();
  if (!room.rematchRequests.has(clientId)) {
    room.rematchRequests.add(clientId);
    room.logs.unshift(`${player.name} 想再来一局。`);
  }

  if (room.players.length === 2 && room.players.every((item) => room.rematchRequests.has(item.id))) {
    room.logs.unshift('双方都选择再来一局。');
    startGame(room);
  } else {
    room.updatedAt = Date.now();
  }

  broadcastRoom(room);
}

function surrenderClient(clientId, socket) {
  const room = roomForClient(clientId, socket);
  if (!room) {
    return;
  }

  if (room.phase === 'waiting' || room.phase === 'game-over') {
    sendError(socket, '当前不能认输。');
    return;
  }

  const player = room.players.find((item) => item.id === clientId);
  const opponent = room.players.find((item) => item.id !== clientId);
  if (!player || !opponent) {
    sendError(socket, '对手不存在，无法认输。');
    return;
  }

  room.phase = 'game-over';
  room.winnerId = opponent.id;
  room.lastRoundResult = undefined;
  room.nextRoundAt = undefined;
  room.turnDeadlines = {};
  room.duelPhase = undefined;
  player.stood = true;
  opponent.stood = true;
  player.hp = 0;
  room.rematchRequests = new Set();
  room.logs.unshift(`${player.name} 离开牌桌，视为认输。`);
  room.logs.unshift(`${opponent.name} 赢得对战。`);
  room.updatedAt = Date.now();
  broadcastRoom(room);
  broadcastRoomList();
}

function startGame(room) {
  room.phase = 'playing';
  room.round = 0;
  room.winnerId = undefined;
  room.lastRoundResult = undefined;
  room.rematchRequests = new Set();
  room.deck = createDeck();
  room.players.forEach((player) => {
    player.hp = MAX_HP;
    player.maxHp = MAX_HP;
    player.resonanceCount = 0;
    player.ready = false;
    player.actionPoints = INITIAL_ACTION_POINTS;
    player.maxActionPoints = MAX_ACTION_POINTS;
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
  startRound(room);
  broadcastRoomList();
}

function startRound(room, now = Date.now()) {
  if (room.phase === 'game-over') {
    return;
  }

  if (room.deck.length < room.players.length * 4) {
    room.deck = createDeck();
    room.logs.unshift('牌堆重新洗牌。');
  }

  room.phase = 'playing';
  const isFirstRound = room.round === 0;
  room.round += 1;
  room.lastRoundResult = undefined;
  room.nextRoundAt = undefined;
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
      ? player.actionPoints ?? INITIAL_ACTION_POINTS
      : Math.min(player.maxActionPoints ?? MAX_ACTION_POINTS, (player.actionPoints ?? INITIAL_ACTION_POINTS) + 1);
    player.maxActionPoints = player.maxActionPoints ?? MAX_ACTION_POINTS;
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
    player.skillCooldowns = decrementSkillCooldowns(player.skillCooldowns ?? {});
    player.effects = [];
  });

  for (let index = 0; index < 2; index += 1) {
    room.players.forEach((player) => player.hand.push(draw(room)));
  }

  room.players.forEach((player) => {
    player.publicCardIndexes = [0];
  });
  room.logs.unshift(`第 ${room.round} 轮开始。${asker?.name ?? '玩家'} 是发问者。`);
  room.updatedAt = now;
}

function applyDuelAction(room, player, action, now = Date.now()) {
  if (!room.duelPhase || !room.askerId || !room.responderId) {
    return { ok: false, message: '对局阶段尚未初始化。' };
  }

  const asker = room.players.find((item) => item.id === room.askerId);
  const responder = room.players.find((item) => item.id === room.responderId);
  if (!asker || !responder) {
    return { ok: false, message: '发问者或应对者不存在。' };
  }

  if (room.duelPhase === 'asker-action') {
    if (player.id !== room.askerId) {
      return { ok: false, message: '等待发问者行动。' };
    }

    if (action.type === 'use-skill') {
      const result = applyPvpSkill(room, player, action.skillId, action);
      if (!result.ok) {
        return result;
      }

      if (result.keepPhase) {
        room.updatedAt = now;
        return { ok: true };
      }

      room.pendingInvitation = false;
      advanceDuelPhase(room, 'responder-response');
      room.updatedAt = now;
      return { ok: true };
    }

    if (action.type === 'invite-draw') {
      room.pendingInvitation = true;
      advanceDuelPhase(room, 'responder-response');
      room.logs.unshift(`${asker.name} 邀请 ${responder.name} 再来一张。`);
      room.updatedAt = now;
      return { ok: true };
    }

    if (action.type === 'pass') {
      room.pendingInvitation = false;
      advanceDuelPhase(room, 'responder-response');
      room.logs.unshift(`${asker.name} 停手。`);
      room.updatedAt = now;
      return { ok: true };
    }

    return { ok: false, message: '发问者阶段只能邀请或停手。' };
  }

  if (room.duelPhase === 'responder-response') {
    if (player.id !== room.responderId) {
      return { ok: false, message: '等待应对者回应。' };
    }

    if (action.type === 'use-skill') {
      const result = applyPvpSkill(room, player, action.skillId, action);
      if (!result.ok) {
        return result;
      }

      if (result.keepPhase) {
        room.updatedAt = now;
        return { ok: true };
      }

      room.pendingInvitation = false;
      advanceDuelPhase(room, 'asker-final');
      room.updatedAt = now;
      return { ok: true };
    }

    if (room.pendingInvitation) {
      if (action.type === 'accept-invite') {
        if (room.hasResponderDrawnExtra) {
          return { ok: false, message: '应对者本轮已经追加过牌。' };
        }

        responder.hand.push(draw(room));
        responder.drawCount += 1;
        room.hasResponderDrawnExtra = true;
        advanceDuelPhase(room, 'asker-final');
        room.logs.unshift(`${responder.name} 接受邀请，摸了 1 张牌。`);
        room.updatedAt = now;
        return { ok: true };
      }

      if (action.type === 'decline-invite') {
        advanceDuelPhase(room, 'asker-final');
        room.logs.unshift(`${responder.name} 拒绝邀请，保留当前手牌。`);
        room.updatedAt = now;
        return { ok: true };
      }

      return { ok: false, message: '应对者只能接受或拒绝邀请。' };
    }

    if (action.type === 'confirm') {
      advanceDuelPhase(room, 'asker-final');
      room.logs.unshift(`${responder.name} 确认。`);
      room.updatedAt = now;
      return { ok: true };
    }

    return { ok: false, message: '没有邀请时应对者只能确认。' };
  }

  if (room.duelPhase === 'asker-final') {
    if (player.id !== room.askerId) {
      return { ok: false, message: '等待发问者最终确认。' };
    }

    if (action.type === 'use-skill') {
      const result = applyPvpSkill(room, player, action.skillId, action);
      if (!result.ok) {
        return result;
      }

      if (result.keepPhase) {
        room.updatedAt = now;
        return { ok: true };
      }

      advanceDuelPhase(room, 'responder-final');
      room.updatedAt = now;
      return { ok: true };
    }

    if (action.type === 'draw-self') {
      if (room.hasAskerDrawnExtra) {
        return { ok: false, message: '发问者本轮已经追加过牌。' };
      }

      asker.hand.push(draw(room));
      asker.drawCount += 1;
      room.hasAskerDrawnExtra = true;
      advanceDuelPhase(room, 'responder-final');
      room.logs.unshift(`${asker.name} 选择自己再来一张。`);
      room.updatedAt = now;
      return { ok: true };
    }

    if (action.type === 'confirm-reveal') {
      advanceDuelPhase(room, 'responder-final');
      room.logs.unshift(`${asker.name} 确认 Reveal。`);
      room.updatedAt = now;
      return { ok: true };
    }

    return { ok: false, message: '发问者最终确认只能自己再来一张或 Reveal。' };
  }

  if (room.duelPhase === 'responder-final') {
    if (player.id !== room.responderId) {
      return { ok: false, message: '等待应对者确认 Reveal。' };
    }

    if (action.type === 'use-skill') {
      const result = applyPvpSkill(room, player, action.skillId, action);
      if (!result.ok) {
        return result;
      }

      if (result.keepPhase) {
        room.updatedAt = now;
        return { ok: true };
      }

      room.logs.unshift(`${responder.name} 使用技能后确认 Reveal。`);
      resolveRound(room, now);
      return { ok: true };
    }

    if (action.type !== 'confirm-reveal') {
      return { ok: false, message: '应对者最终回应只能 Reveal。' };
    }

    room.logs.unshift(`${responder.name} 确认 Reveal。`);
    resolveRound(room, now);
    return { ok: true };
  }

  return { ok: false, message: '未知对局阶段。' };
}

function resolveRound(room, now = Date.now()) {
  if (room.phase !== 'playing' || room.players.length < 2) {
    return false;
  }

  room.logs.unshift('双方揭晓。');
  const [playerA, playerB] = room.players;
  const scoreA = scoreHand(playerA.hand);
  const scoreB = scoreHand(playerB.hand);
  if (scoreA.resonance !== 'none') {
    playerA.resonanceCount += 1;
  }
  if (scoreB.resonance !== 'none') {
    playerB.resonanceCount += 1;
  }

  const comparison = compareScores(scoreA, scoreB);
  if (comparison === 0) {
    room.lastRoundResult = {
      round: room.round,
      scores: { [playerA.id]: scoreA, [playerB.id]: scoreB },
      outcome: 'draw',
      damage: 0,
      riskBonus: 0,
    };
    room.logs.unshift('双方平分抵消。');
    room.logs.unshift(`${playerA.name} 点数 ${scoreA.point}，${playerB.name} 点数 ${scoreB.point}。`);
  } else {
    const winner = comparison > 0 ? playerA : playerB;
    const loser = comparison > 0 ? playerB : playerA;
    const winnerScore = comparison > 0 ? scoreA : scoreB;
    const baseDamage = winnerScore.multiplier;
    const damageBonus = winner.roundDamageBonus ?? 0;
    const takenBonus = loser.roundDamageTakenBonus ?? 0;
    const uncappedDamage = baseDamage + damageBonus + takenBonus;
    const damage = loser.roundDamageCap !== undefined ? Math.min(loser.roundDamageCap, uncappedDamage) : uncappedDamage;
    const riskBonus = damage - baseDamage;
    loser.hp = Math.max(0, loser.hp - damage);
    room.lastRoundResult = {
      round: room.round,
      scores: { [playerA.id]: scoreA, [playerB.id]: scoreB },
      outcome: 'win',
      winnerId: winner.id,
      loserId: loser.id,
      damage,
      resonance: winnerScore.resonance,
      riskBonus,
    };
    if (damageBonus > 0) {
      room.logs.unshift(`${winner.name} 的【加码】使伤害 +${damageBonus}。`);
    }
    if (takenBonus > 0) {
      room.logs.unshift(`${loser.name} 的【加码】使自己受到伤害 +${takenBonus}。`);
    }
    if (loser.roundDamageCap !== undefined && damage < uncappedDamage) {
      room.logs.unshift(`${loser.name} 的【止损】使最终伤害降为 ${damage}。`);
    }
    room.logs.unshift(`${winner.name} 赢得本轮，造成 ${damage} 点伤害。`);
    room.logs.unshift(`${playerA.name} 点数 ${scoreA.point}，${playerB.name} 点数 ${scoreB.point}。`);

    if (loser.hp <= 0) {
      room.phase = 'game-over';
      room.winnerId = winner.id;
      room.nextRoundAt = undefined;
      room.duelPhase = undefined;
      room.logs.unshift(`${winner.name} 赢得对战。`);
      room.updatedAt = now;
      return true;
    }
  }

  room.phase = 'round-reveal';
  room.duelPhase = undefined;
  room.nextRoundAt = now + REVEAL_TIME_MS;
  room.updatedAt = now;
  return true;
}

function createPublicState(room, viewerId) {
  const now = Date.now();
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
      incomingDamageBonus: player.incomingDamageBonus ?? 0,
      actionPoints: player.actionPoints ?? INITIAL_ACTION_POINTS,
      maxActionPoints: player.maxActionPoints ?? MAX_ACTION_POINTS,
      hasUsedSkillThisRound: player.hasUsedSkillThisRound ?? false,
      hasUsedPeekThisRound: player.hasUsedPeekThisRound ?? false,
      hasUsedActionSkillThisRound: player.hasUsedActionSkillThisRound ?? false,
      hasUsedSkillThisPhase: player.hasUsedSkillThisPhase ?? false,
      roundDamageCap: player.roundDamageCap,
      roundDamageBonus: player.roundDamageBonus ?? 0,
      roundDamageTakenBonus: player.roundDamageTakenBonus ?? 0,
      resonanceCount: player.resonanceCount,
      skills: [...player.skills],
      usedSkillIds: [...(player.usedSkillIds ?? [])],
      skillCooldowns: { ...(player.skillCooldowns ?? {}) },
      items: [...player.items],
      effects: [...player.effects],
    })),
    selfId: viewerId,
    opponentId: opponent?.id,
    actionDeadline: room.turnDeadlines[viewerId],
    serverTime: now,
    lastRoundResult: room.lastRoundResult,
    winnerId: room.winnerId,
    rematchRequestedIds: [...(room.rematchRequests ?? [])],
    askerId: room.askerId,
    responderId: room.responderId,
    duelPhase: room.duelPhase,
    pendingInvitation: room.pendingInvitation ?? false,
    hasAskerDrawnExtra: room.hasAskerDrawnExtra ?? false,
    hasResponderDrawnExtra: room.hasResponderDrawnExtra ?? false,
    privateNotice: room.privateNotices?.[viewerId],
    logs: room.logs.slice(0, 30),
  };
}

function applyPvpSkill(room, player, skillId, action = {}) {
  if (!player.skills.includes(skillId)) {
    return { ok: false, message: '你没有这个技能。' };
  }

  if (player.hasUsedSkillThisPhase) {
    return { ok: false, message: '当前阶段已经使用过技能。' };
  }

  if ((player.actionPoints ?? 0) < SKILL_COST) {
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

    const range = pointRangeLabel(scoreHand(opponent.hand).point);
    spendSkillCost(room, player, skillId, 'peek');
    room.privateNotices ??= {};
    room.privateNotices[player.id] = `你看破了对方的气息：${range}。`;
    room.logs.unshift(`${player.name} 使用了【看破】。`);
    return { ok: true, keepPhase: true };
  }

  if (skillId === 'stop_loss') {
    if (player.hasUsedActionSkillThisRound) {
      return { ok: false, message: '本轮已经使用过行动技能。' };
    }

    player.roundDamageCap = 1;
    spendSkillCost(room, player, skillId, 'action');
    room.logs.unshift(`${player.name} 使用了【止损】，本轮受到的伤害最多为 1。`);
    return { ok: true };
  }

  if (skillId === 'raise_stakes') {
    if (player.hasUsedActionSkillThisRound) {
      return { ok: false, message: '本轮已经使用过行动技能。' };
    }

    player.roundDamageBonus = 1;
    player.roundDamageTakenBonus = 1;
    spendSkillCost(room, player, skillId, 'action');
    room.logs.unshift(`${player.name} 使用了【加码】，本轮造成伤害 +1，但受到伤害也 +1。`);
    return { ok: true };
  }

  if (skillId === 'swap_hand') {
    if (player.hasUsedActionSkillThisRound) {
      return { ok: false, message: '本轮已经使用过行动技能。' };
    }

    const ownIndex = Number(action.cardIndex);
    if (!Number.isInteger(ownIndex) || ownIndex < 0 || ownIndex >= player.hand.length) {
      return { ok: false, message: '请选择一张自己的手牌。' };
    }

    if (opponent.hand.length === 0) {
      return { ok: false, message: '对方没有可交换的手牌。' };
    }

    const opponentIndex = Math.floor(Math.random() * opponent.hand.length);
    [player.hand[ownIndex], opponent.hand[opponentIndex]] = [opponent.hand[opponentIndex], player.hand[ownIndex]];
    markCardPublic(player, ownIndex);
    markCardPublic(opponent, opponentIndex);
    room.privateNotices[player.id] = undefined;
    room.privateNotices[opponent.id] = undefined;
    spendSkillCost(room, player, skillId, 'action');
    room.logs.unshift(`${player.name} 使用了【换手】，交换了一张手牌。`);
    return { ok: true };
  }

  return { ok: false, message: '未知技能。' };
}

function spendSkillCost(room, player, skillId, kind) {
  player.actionPoints = Math.max(0, (player.actionPoints ?? 0) - SKILL_COST);
  player.hasUsedSkillThisRound = true;
  player.hasUsedSkillThisPhase = true;
  if (kind === 'peek') {
    player.hasUsedPeekThisRound = true;
  } else {
    player.hasUsedActionSkillThisRound = true;
  }
  player.usedSkillIds ??= [];
  player.usedSkillIds.push(skillId);
  room.updatedAt = Date.now();
}

function advanceDuelPhase(room, phase) {
  room.duelPhase = phase;
  room.players.forEach((player) => {
    player.hasUsedSkillThisPhase = false;
  });
}

function markCardPublic(player, cardIndex) {
  if (!player.publicCardIndexes.includes(cardIndex)) {
    player.publicCardIndexes.push(cardIndex);
  }
}

function pointRangeLabel(point) {
  if (point <= 3) {
    return '低点 0-3';
  }

  if (point <= 6) {
    return '中点 4-6';
  }

  return '高点 7-9';
}

function createPlayer(id, name, role) {
  return {
    id,
    name: safeName(name, role === 'host' ? '玩家一' : '玩家二'),
    role,
    connected: true,
    ready: false,
    hp: MAX_HP,
    maxHp: MAX_HP,
    hand: [],
    publicCardIndexes: [],
    stood: false,
    drawCount: 0,
    secondDrawRisk: false,
    drawLocked: false,
    incomingDamageBonus: 0,
    actionPoints: INITIAL_ACTION_POINTS,
    maxActionPoints: MAX_ACTION_POINTS,
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

function drawWhere(room, predicate) {
  const index = room.deck.findIndex(predicate);
  if (index < 0) {
    return undefined;
  }

  const [card] = room.deck.splice(index, 1);
  return card;
}

function decrementSkillCooldowns(cooldowns) {
  return Object.fromEntries(
    Object.entries(cooldowns).map(([skillId, rounds]) => [skillId, Math.max(0, rounds - 1)]),
  );
}

function createDeck() {
  const cards = [
    ...SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank }))),
    { rank: '小王' },
    { rank: '大王' },
  ];

  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [cards[index], cards[swapIndex]] = [cards[swapIndex], cards[index]];
  }

  return cards;
}

function draw(room) {
  const card = room.deck.pop();
  if (card) {
    return card;
  }

  room.deck = createDeck();
  return room.deck.pop();
}

function scoreHand(cards) {
  const rawTotal = cards.reduce((total, card) => total + cardValue(card), 0);
  const sameSuit = hasSameSuitWithJokers(cards);
  const sameRank = cards.length >= 2 && cards.every((card) => !isJoker(card) && card.rank === cards[0].rank);
  const resonance = sameSuit || sameRank
    ? cards.length >= 3 ? 'strong' : 'resonance'
    : 'none';
  return {
    rawTotal,
    point: rawTotal % 10,
    resonance,
    multiplier: resonance === 'strong' ? 3 : resonance === 'resonance' ? 2 : 1,
    reason: sameRank ? 'same-rank' : sameSuit ? 'same-suit' : 'none',
  };
}

function cardValue(card) {
  if (isJoker(card) || card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') {
    return 0;
  }

  if (card.rank === 'A') {
    return 1;
  }

  return Number(card.rank);
}

function isJoker(card) {
  return card.rank === '小王' || card.rank === '大王';
}

function hasSameSuitWithJokers(cards) {
  if (cards.length < 2) {
    return false;
  }

  const suitedCards = cards.filter((card) => !isJoker(card));
  if (suitedCards.length === 0) {
    return true;
  }

  return suitedCards.every((card) => card.suit === suitedCards[0].suit);
}

function compareScores(scoreA, scoreB) {
  if (scoreA.point !== scoreB.point) {
    return scoreA.point - scoreB.point;
  }

  return resonancePower(scoreA.resonance) - resonancePower(scoreB.resonance);
}

function resonancePower(resonance) {
  if (resonance === 'strong') {
    return 2;
  }

  if (resonance === 'resonance') {
    return 1;
  }

  return 0;
}

function chooseResonanceShift(cards) {
  if (cards.length < 2) {
    return undefined;
  }

  const suitGroups = new Map();
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

function chooseResonanceSummonSuit(cards) {
  const suitedCards = cards.filter((card) => !isJoker(card) && card.suit);
  if (suitedCards.length === 0) {
    return randomItem(SUITS);
  }

  const counts = new Map();
  suitedCards.forEach((card) => {
    if (!card.suit) {
      return;
    }

    counts.set(card.suit, (counts.get(card.suit) ?? 0) + 1);
  });

  const maxCount = Math.max(...counts.values());
  return randomItem([...counts.entries()].filter(([, count]) => count === maxCount).map(([suit]) => suit));
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function roomForClient(clientId, socket) {
  const roomId = clientRooms.get(clientId);
  const room = roomId ? rooms.get(roomId) : undefined;
  if (!room) {
    sendError(socket, '你还没有进入房间。');
  }

  return room;
}

function broadcastRoom(room) {
  room.players.forEach((player) => {
    const socket = clients.get(player.id);
    if (socket?.readyState === WebSocket.OPEN) {
      send(socket, { type: 'room-state', state: createPublicState(room, player.id) });
    }
  });
}

function broadcastRoomList() {
  clients.forEach((socket) => sendRoomList(socket));
}

function sendRoomList(socket) {
  send(socket, { type: 'room-list', rooms: createRoomList() });
}

function createRoomList() {
  return [...rooms.values()]
    .map((room) => ({
      roomId: room.roomId,
      hostName: room.players[0]?.name ?? '玩家',
      playerCount: room.players.length,
      maxPlayers: 2,
      phase: room.phase,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    }))
    .sort((a, b) => {
      const aJoinable = a.phase === 'waiting' && a.playerCount < a.maxPlayers;
      const bJoinable = b.phase === 'waiting' && b.playerCount < b.maxPlayers;
      if (aJoinable !== bJoinable) {
        return aJoinable ? -1 : 1;
      }

      return b.updatedAt - a.updatedAt;
    });
}

function send(socket, message) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function sendError(socket, message) {
  send(socket, { type: 'error', message });
}

function createRoomId() {
  let roomId = '';
  do {
    roomId = Math.random().toString(36).slice(2, 6).toUpperCase();
  } while (rooms.has(roomId));
  return roomId;
}

function safeName(name, fallback) {
  const value = String(name ?? '').trim();
  return value.slice(0, 18) || fallback;
}

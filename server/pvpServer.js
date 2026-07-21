import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number(process.env.PVP_PORT ?? 8787);
const MAX_HP = 10;
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
    if (room.phase === 'playing') {
      changed = autoStandExpiredPlayers(room, now);
    }

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
    case 'use-skill':
    case 'draw':
    case 'stand':
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
    sendError(socket, '道具暂未开放。');
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

  if (player.stood) {
    sendError(socket, '你已经开牌。');
    return;
  }

  if (action.type === 'use-skill') {
    const result = applySkill(room, player, action.skillId);
    if (!result.ok) {
      sendError(socket, result.message);
      return;
    }

    broadcastRoom(room);
    return;
  }

  if (action.type === 'draw') {
    if (player.drawLocked) {
      sendError(socket, '本轮已经不能再摸牌。');
      return;
    }

    if (player.drawCount >= 2) {
      sendError(socket, '本轮已经不能再摸牌。');
      return;
    }

    player.hand.push(draw(room));
    player.publicCardIndexes.push(player.hand.length - 1);
    player.drawCount += 1;
    if (player.drawCount >= 2) {
      player.secondDrawRisk = true;
    }
    room.turnDeadlines[player.id] = Date.now() + ACTION_TIME_MS;
    room.logs.unshift(`${player.name} 选择再来一张。`);
    room.updatedAt = Date.now();
    broadcastRoom(room);
    return;
  }

  player.stood = true;
  delete room.turnDeadlines[player.id];
  room.logs.unshift(`${player.name} 选择开牌。`);
  resolveRoundIfReady(room);
  room.updatedAt = Date.now();
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
    player.skills = ['resonance_shift', 'resonance_summon'];
    player.usedSkillIds = [];
    player.skillCooldowns = {};
  });
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
  room.round += 1;
  room.lastRoundResult = undefined;
  room.nextRoundAt = undefined;
  room.turnDeadlines = {};
  room.players.forEach((player) => {
    player.hand = [];
    player.publicCardIndexes = [];
    player.stood = false;
    player.drawCount = 0;
    player.secondDrawRisk = false;
    player.drawLocked = false;
    player.incomingDamageBonus = 0;
    player.skillCooldowns = decrementSkillCooldowns(player.skillCooldowns ?? {});
    player.effects = [];
  });

  for (let index = 0; index < 2; index += 1) {
    room.players.forEach((player) => player.hand.push(draw(room)));
  }

  room.players.forEach((player) => {
    player.publicCardIndexes = [0];
    room.turnDeadlines[player.id] = now + ACTION_TIME_MS;
  });
  room.logs.unshift(`第 ${room.round} 轮开始。`);
  room.updatedAt = now;
}

function autoStandExpiredPlayers(room, now) {
  let changed = false;
  room.players.forEach((player) => {
    const deadline = room.turnDeadlines[player.id];
    if (!player.stood && deadline && deadline <= now) {
      player.stood = true;
      delete room.turnDeadlines[player.id];
      room.logs.unshift(`${player.name} 超时，自动开牌。`);
      changed = true;
    }
  });

  if (changed) {
    resolveRoundIfReady(room, now);
    room.updatedAt = now;
  }

  return changed;
}

function resolveRoundIfReady(room, now = Date.now()) {
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
  } else {
    const winner = comparison > 0 ? playerA : playerB;
    const loser = comparison > 0 ? playerB : playerA;
    const winnerScore = comparison > 0 ? scoreA : scoreB;
    const riskBonus = Math.max(loser.secondDrawRisk ? 1 : 0, loser.incomingDamageBonus ?? 0);
    const damage = winnerScore.multiplier + riskBonus;
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
    room.logs.unshift(`${winner.name} 赢得本轮，造成 ${damage} 点伤害。`);

    if (loser.hp <= 0) {
      room.phase = 'game-over';
      room.winnerId = winner.id;
      room.nextRoundAt = undefined;
      room.logs.unshift(`${winner.name} 赢得对战。`);
      room.updatedAt = now;
      return true;
    }
  }

  room.phase = 'round-reveal';
  room.nextRoundAt = now + REVEAL_TIME_MS;
  room.updatedAt = now;
  return true;
}

function createPublicState(room, viewerId) {
  const now = Date.now();
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
    logs: room.logs.slice(0, 30),
  };
}

function applySkill(room, player, skillId) {
  if (!player.skills.includes(skillId)) {
    return { ok: false, message: '你没有这个技能。' };
  }

  player.usedSkillIds ??= [];
  player.skillCooldowns ??= {};
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
    player.skillCooldowns[skillId] = SKILL_COOLDOWN_ROUNDS;
    player.drawLocked = true;
    room.turnDeadlines[player.id] = Date.now() + ACTION_TIME_MS;
    room.logs.unshift(`${player.name} 使用了共鸣转换。`);
    room.updatedAt = Date.now();
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

    const card = drawWhere(room, (candidate) => !isJoker(candidate) && candidate.suit === targetSuit);
    if (!card) {
      return { ok: false, message: `牌堆中没有 ${targetSuit} 花色牌。` };
    }

    player.hand.push(card);
    player.publicCardIndexes.push(player.hand.length - 1);
    player.usedSkillIds.push(skillId);
    player.skillCooldowns[skillId] = SKILL_COOLDOWN_ROUNDS;
    player.drawLocked = true;
    player.incomingDamageBonus = Math.max(player.incomingDamageBonus ?? 0, 1);
    room.turnDeadlines[player.id] = Date.now() + ACTION_TIME_MS;
    room.logs.unshift(`${player.name} 使用了共鸣召唤。`);
    room.updatedAt = Date.now();
    return { ok: true };
  }

  return { ok: false, message: '未知技能。' };
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
    resonanceCount: 0,
    skills: ['resonance_shift', 'resonance_summon'],
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

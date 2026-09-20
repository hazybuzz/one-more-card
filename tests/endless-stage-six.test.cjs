const assert = require('node:assert/strict');
const { test } = require('node:test');
const { runtime } = require('./helpers/typescript-runtime.cjs');
function setup({ paid = true, storage } = {}) {
  const r = runtime({
    saved: storage ? undefined : { soulCoins: 1000, ownedItems: { heal_potion: 5 } }, storage,
    external: { phaser: { default: { Scene: class { }, BlendModes: { ADD: 1 }, GameObjects: { Events: { DESTROY: 'destroy' } } } } }
  });
  const { BattleEngine } = r.load('src/game/engine/BattleEngine.ts');
  if (paid && !storage) {
    for (const theme of ['evernight_tavern', 'northern_longhouse', 'dragon_gate', 'edo_teahouse'])
      for (const difficulty of [1, 2, 3]) r.progress.recordFormalTableResult('victory', theme, difficulty);
    assert.equal(r.progress.reserveEndlessEntry('settlement-run').status, 'created');
  }
  const battle = new BattleEngine({ mode: 'endless', enemyIds: ['goblin', 'gambler', 'werewolf'], runId: 'settlement-run', endlessSeed: 42 });
  const { BattleScene } = r.load('src/scenes/BattleScene.ts'); const scene = Object.create(BattleScene.prototype);
  scene.battleLayout = r.load('src/ui/layout/pcLayout.ts').PC_BATTLE_LAYOUT;
  Object.assign(scene, { battle, endlessRunId: 'settlement-run', resultModalReady: true, ui: [], render() { }, playClickSound() { } });
  const { summarizeEndlessRun } = r.load('src/game/endless/EndlessSettlement.ts');
  return { r, battle, scene, summary: (reason = 'exit') => summarizeEndlessRun('settlement-run', battle.round, battle.getState().endlessAccounting, reason) };
}
function score(battle, n = 3) {
  for (let i = 0; i < n; i++)battle.endlessLedger.recordDefeat('hit' + i, 'dead' + i, 'goblin', false);
  battle.endlessLedger.recordDefeat('spirit', 'dead-spirit', 'einherjar', true);
  battle.endlessLedger.recordResonance('resonance', 'dead0', 4, 1);
}
async function settleCallbacks() { await new Promise(resolve => setImmediate(resolve)); }
function mockDisplay(scene) {
  class Node {
    constructor(kind, x, y, text) { Object.assign(this, { kind, x, y, text, list: [], events: {}, active: true }); }
    add(nodes) { this.list.push(...(Array.isArray(nodes) ? nodes : [nodes])); return this; }
    setDepth(depth) { this.depth = depth; return this; } setOrigin() { return this; } setStrokeStyle() { return this; }
    setInteractive() { this.interactive = true; return this; } setShadow() { return this; } setFillStyle() { return this; }
    setY(y) { this.y = y; return this; } setColor() { return this; } on(name, callback) { this.events[name] = callback; return this; }
    setTint() { return this; } setAlpha() { return this; } setBlendMode() { return this; } once() { return this; }
    setDisplaySize(width, height) { Object.assign(this, { width, height }); return this; }
  }
  const nodes = []; const make = (...args) => { const node = new Node(...args); nodes.push(node); return node; };
  scene.add = {
    container: (x, y) => make('container', x, y), rectangle: (x, y, w, h, color, opacity) => { const n = make('rectangle', x, y); Object.assign(n, { width: w, height: h, opacity }); return n; },
    text: (x, y, text) => make('text', x, y, text), image: (x, y, key) => { const n = make('image', x, y); n.key = key; return n; }
  };
  scene.tweens = { add: () => ({ remove() { } }) };
  scene.textures = { exists: () => false }; scene.battleArtSelection = { themeId: 'evernight_tavern' };
  return nodes;
}
function button(root, label) { return root.list.find(n => n.kind === 'container' && n.list.some(c => c.text === label)); }

test('payout commits remaining wallet plus capped rewards once without affecting formal stats or inventory', () => {
  const { r, battle, summary } = setup(); score(battle); battle.phase = 'round-result'; battle.openEndlessShop();
  assert(battle.buyEndlessItem('heal_potion', battle.getState().endlessAccounting.shop.visit.id).bought);
  const p = r.progress.getProgress(), stats = JSON.stringify(p.formalTableStats), items = JSON.stringify(p.ownedItems);
  const s = summary(); assert.equal(s.earned, 75); assert.equal(s.spent, 20); assert.equal(s.wallet, 55);
  assert.equal(s.defeatBonus, 30); assert.equal(s.resonanceBonus, 8); assert.equal(s.total, 93);
  const result = r.progress.settleEndlessProgress(s); assert.equal(result.status, 'settled'); assert.equal(result.receipt.balanceAfter, 993);
  assert.equal(r.progress.getProgress().endlessSession, undefined);
  assert.equal(JSON.stringify(r.progress.getProgress().formalTableStats), stats); assert.equal(JSON.stringify(r.progress.getProgress().ownedItems), items);
  assert.equal(r.progress.getProgress().economyStats.incomeBySource.endless_settlement, 93);
  assert.equal(r.progress.settleEndlessProgress(s).status, 'already-settled'); assert.equal(r.progress.getProgress().soulCoins, 993);
  assert.equal(r.progress.getProgress().economyTransactions.filter(t => t.category === 'endless_settlement').length, 1);
});

test('receipt survives reload and a second runtime cannot credit the same run again', () => {
  const { r, battle, summary } = setup(); score(battle); const s = summary(); const first = r.progress.settleEndlessProgress(s);
  const second = runtime({ storage: r.storage }); assert.equal(second.progress.settleEndlessProgress(s).status, 'already-settled');
  assert.equal(second.progress.getProgress().soulCoins, first.receipt.balanceAfter);
  const third = runtime({ storage: r.storage }); third.progress.reserveEndlessEntry('new-run');
  assert.equal(third.progress.settleEndlessProgress(s).status, 'already-settled');
  assert.equal(third.progress.getProgress().endlessSession.runId, 'new-run');
});

test('failed settlement storage write preserves balance, reservation, receipt and inventory', () => {
  const { r, battle, summary } = setup(); score(battle); const before = JSON.stringify(r.progress.getProgress()); r.failWrite();
  assert.equal(r.progress.settleEndlessProgress(summary()).status, 'storage-unavailable');
  assert.deepEqual(JSON.parse(JSON.stringify(r.progress.getProgress())), JSON.parse(before));
  assert.equal(JSON.parse(r.storage.get(r.key)).endlessSession.runId, 'settlement-run');
});

test('invalid or unreserved payouts cannot grant coins', () => {
  const { r, battle, summary } = setup(); score(battle); const s = summary();
  for (const bad of [{ ...s, runId: 'unknown' }, { ...s, total: 99999 }, { ...s, spent: 999 }, { ...s, defeatedCount: NaN }])
    assert.equal(r.progress.settleEndlessProgress(bad).status, 'invalid-run');
  assert.equal(r.progress.getProgress().soulCoins, 900);
  const unpaid = setup({ paid: false }); score(unpaid.battle); assert.equal(unpaid.r.progress.settleEndlessProgress(unpaid.summary()).status, 'invalid-run');
});

test('zero-kill payout is zero and does not refund or charge the entry fee again', () => {
  const { r, summary } = setup(); assert.equal(summary().total, 0);
  assert.equal(r.progress.settleEndlessProgress(summary()).status, 'settled'); assert.equal(r.progress.getProgress().soulCoins, 900);
});

test('exit and defeat have identical payout formulas, including the resonance reward cap', () => {
  const { battle, summary } = setup(); score(battle, 1); battle.endlessLedger.recordResonance('huge', 'dead0', 100, 1);
  assert.equal(summary('exit').total, 45); assert.equal(summary('defeat').total, 45);
  assert.equal(summary().resonanceBonus, 10);
});

test('active soul redemption and enemy redemption prevent ending; shop allows ending without buying', () => {
  const { battle, scene } = setup(); score(battle); battle.phase = 'round-result'; battle.openEndlessShop();
  assert.equal(scene.endlessExitBlocked(), false); battle.pendingSoulRedeem = true; assert.equal(battle.endEndlessRun(), false);
  battle.pendingSoulRedeem = false; battle.pendingEnemySoulRedeem = 'keeper'; assert.equal(battle.endEndlessRun(), false);
  battle.pendingEnemySoulRedeem = undefined; assert.equal(battle.endEndlessRun(), true);
  assert.equal(battle.getState().endlessEndReason, 'exit'); assert.equal(battle.endEndlessRun(), false);
});

test('scene settlement waits for final animations, pays once, then discards run items', async () => {
  const { r, battle, scene } = setup(); score(battle); battle.phase = 'round-result'; battle.openEndlessShop();
  assert(battle.buyEndlessItem('heal_potion', battle.getState().endlessAccounting.shop.visit.id).bought); battle.endEndlessRun();
  scene.presentationSequencePlaying = true; scene.settleEconomyIfNeeded(); await settleCallbacks(); assert.equal(r.progress.getProgress().soulCoins, 900);
  scene.presentationSequencePlaying = false; scene.settleEconomyIfNeeded(); scene.settleEconomyIfNeeded(); await settleCallbacks();
  assert.equal(r.progress.getProgress().soulCoins, 993); assert.equal(scene.battleEconomySettled, true);
  assert.equal(battle.endlessLedger.shop.inventoryCount, 0); assert.equal(battle.endlessLedger.shop.isOpen, false);
  assert.equal(scene.endlessSettlementSummary.spent, 20); scene.settleEconomyIfNeeded(); await settleCallbacks(); assert.equal(r.progress.getProgress().soulCoins, 993);
});

test('scene storage failure retains supplies and reports retry instead of crediting or leaving', async () => {
  const { r, battle, scene } = setup(); score(battle); battle.phase = 'round-result'; battle.openEndlessShop();
  battle.buyEndlessItem('heal_potion', battle.getState().endlessAccounting.shop.visit.id); battle.endEndlessRun(); r.failWrite();
  scene.settleEconomyIfNeeded(); await settleCallbacks(); assert.equal(scene.battleEconomySettled, undefined);
  assert(scene.endlessSettlementError); assert.equal(battle.endlessLedger.shop.inventoryCount, 1); assert.equal(r.progress.getProgress().soulCoins, 900);
});

test('HUD and background use endless assets, show ledger totals and avoid the top NPC', () => {
  const { r, battle, scene } = setup(); score(battle); const nodes = mockDisplay(scene); scene.addBackground(); scene.renderEndlessHud();
  const config = r.load('src/game/endless/EndlessConfig.ts').ENDLESS_CONFIG;
  assert.equal(nodes.find(n => n.kind === 'image').key, config.backgroundTextureKey);
  assert.equal(nodes.find(n => n.kind === 'rectangle').opacity, config.backgroundShadeOpacity);
  const hud = scene.ui[0]; assert.equal(hud.depth, 150); assert.equal(hud.list.length, 4);
  const [defeats, resonance, wallet, payout] = hud.list;
  assert.equal(defeats.y, 46); assert.equal(resonance.y, 46); assert.equal(wallet.y, 46); assert.equal(payout.y, 46);
  assert.equal(defeats.list[0].width, 130); assert.equal(resonance.list[0].width, 130);
  assert.equal(wallet.list[0].width, 180); assert.equal(payout.list[0].width, 180);
  assert(resonance.x > defeats.x); assert(payout.x > wallet.x);
  assert(resonance.x + 65 < 449); assert(wallet.x - 90 > 800);
  for (const [frame, label, value] of [[defeats, '已击败：', '3'], [resonance, '共鸣：', '4'], [wallet, '当前金币：', '75'], [payout, '结算获得：', '113']]) {
    const texts = frame.list.filter(n => n.kind === 'text').map(n => n.text);
    assert(texts.includes(label)); assert(texts.includes(value)); assert.equal(texts.length, 2);
  }
  assert.equal(defeats.list.filter(n => n.kind === 'image').length, 0);
  assert.equal(wallet.list.filter(n => n.kind === 'image' && n.key === 'ui-soul-coin').length, 2);
  assert.equal(payout.list.filter(n => n.kind === 'image' && n.key === 'ui-soul-coin').length, 2);
  assert.equal(scene.ui[1].y, scene.battleLayout.hud.exitButton.y);
  assert.equal(scene.ui[1].x + 180, 1256);
});

test('cancel ending during shopping keeps the visit; confirm shows expected payout and settles', () => {
  const { battle, scene } = setup(); score(battle); battle.phase = 'round-result'; battle.openEndlessShop(); mockDisplay(scene);
  const id = battle.getState().endlessAccounting.shop.visit.id; scene.confirmExitEndless = true; scene.renderEndlessExitConfirm();
  let root = scene.ui.at(-1); assert(root.list.some(n => n.text?.includes('预计获得 113')));
  button(root, '继续挑战').list[0].events.pointerdown(); assert.equal(scene.confirmExitEndless, false);
  assert.equal(battle.getState().endlessAccounting.shop.visit.id, id); assert.equal(battle.phase, 'round-result');
  scene.confirmExitEndless = true; scene.renderEndlessExitConfirm(); root = scene.ui.at(-1);
  button(root, '结束并结算').list[0].events.pointerdown(); assert.equal(battle.phase, 'battle-result'); assert.equal(battle.endlessEndReason, 'exit');
});

test('result UI lists all amounts, blocks return until paid, and returns to lobby after receipt', async () => {
  const { battle, scene } = setup(); score(battle); battle.endEndlessRun(); mockDisplay(scene);
  scene.endlessSettlementPending = true; scene.renderEndlessResult(); let root = scene.ui.at(-1);
  assert.equal(button(root, '返回大厅').list[0].interactive, undefined);
  scene.endlessSettlementPending = false; scene.settleEconomyIfNeeded(); await settleCallbacks(); scene.renderEndlessResult(); root = scene.ui.at(-1);
  assert.equal(button(root, '返回大厅').list[0].interactive, true);
  let destination; scene.scene = { start: name => destination = name }; button(root, '返回大厅').list[0].events.pointerdown(); assert.equal(destination, 'StartScene');
  for (const label of ['累计局内收入', '局内购买消费', '剩余局内金币', '击败奖励', '共鸣奖励（已计上限）']) assert(root.list.some(n => n.text === label));
});

test('production launch is ready and test mode reserves an isolated virtual run without double charging', async () => {
  const wins = Object.fromEntries(['evernight_tavern', 'northern_longhouse', 'dragon_gate', 'edo_teahouse'].map(id => [id, { 1: 1, 2: 1, 3: 1 }]));
  const r = runtime({ mode: 'test', saved: { soulCoins: 1000, formalTableStats: { winsByThemeAndDifficulty: wins } } });
  const economy = r.load('src/game/economy.ts'); const created = await economy.tryEnterEndlessMode();
  assert.equal(created.status, 'created'); assert.equal(created.total, 900);
  const resumed = await economy.tryEnterEndlessMode(); assert.equal(resumed.status, 'resumed'); assert.equal(resumed.total, 900);
  assert.equal(resumed.session.runId, created.session.runId);
  const config = r.load('src/game/endless/EndlessConfig.ts'); assert.equal(config.isEndlessBattleReady('production'), true);
  assert.equal(config.isEndlessBattleReady('test'), true); assert.equal(r.storage.has('one-more-card-progress'), false);
});

test('test-mode entry UI starts the mixed endless scene with reservation identity and seed once', async () => {
  const wins = Object.fromEntries(['evernight_tavern', 'northern_longhouse', 'dragon_gate', 'edo_teahouse'].map(id => [id, { 1: 1, 2: 1, 3: 1 }]));
  const r = runtime({ mode: 'test', saved: { soulCoins: 1000, formalTableStats: { winsByThemeAndDifficulty: wins } }, external: { phaser: { default: { Scene: class { } } } } });
  const { StartScene } = r.load('src/scenes/StartScene.ts'); const scene = Object.create(StartScene.prototype);
  const nodes = mockDisplay(scene); scene.playButtonClick = () => { }; const launches = []; scene.scene = { start: (name, data) => launches.push({ name, data }) };
  scene.renderMenu(); const menu = nodes.find(n => n.kind === 'container' && n.x === 462);
  const story = button(menu, '故事模式'), endless = button(menu, '无尽模式'); assert(story.y < endless.y);
  const shop = button(menu, '道具商店'); assert(endless.y < shop.y); endless.list[0].events.pointerdown();
  const modal = nodes.find(n => n.kind === 'container' && n.depth === 110); const enter = button(modal, '支付并进入');
  enter.list[0].events.pointerdown(); enter.list[0].events.pointerdown(); await settleCallbacks();
  assert.equal(launches.length, 1); assert.equal(launches[0].name, 'BattleScene'); assert.equal(launches[0].data.mode, 'endless');
  const reservation = r.progress.getProgress().endlessSession; assert.equal(launches[0].data.runId, reservation.runId);
  assert.equal(launches[0].data.seed, reservation.seed); assert.equal(r.progress.getProgress().soulCoins, 900);
});

test('death does not settle before redemption; final death settles as defeat', async () => {
  const { r, battle, scene } = setup(); score(battle); battle.player.hp = 0; battle.updateBattleOutcome();
  assert.equal(battle.pendingSoulRedeem, true); scene.settleEconomyIfNeeded(); await settleCallbacks(); assert.equal(r.progress.getProgress().soulCoins, 900);
  battle.resolveSoulRedeem(); assert.equal(battle.player.hp, 3); battle.player.hp = 0; battle.updateBattleOutcome();
  assert.equal(battle.endlessEndReason, 'defeat'); assert.equal(battle.pendingSoulRedeem, false);
  scene.settleEconomyIfNeeded(); await settleCallbacks(); assert.equal(r.progress.getProgress().soulCoins, 1013);
  assert.equal(scene.endlessSettlementReceipt.reason, 'defeat');
});

test('ending is locked during attack and redemption, and confirmation pauses round transition', () => {
  const { scene } = setup(); scene.actionAnimationPlaying = true; assert.equal(scene.endlessExitBlocked(), true);
  scene.actionAnimationPlaying = false; scene.battle.pendingSoulRedeem = true; assert.equal(scene.endlessExitBlocked(), true);
  scene.battle.pendingSoulRedeem = false; scene.confirmExitEndless = true; assert.equal(scene.isRoundTransitionBusy(), true);
});
